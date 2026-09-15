const {test,before,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {createApp}=require('../server');
let server,base,dir;
before(async()=>{dir=fs.mkdtempSync(path.join(os.tmpdir(),'heart-order-test-'));server=createApp({dataDir:dir});await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;});
after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));const resolved=path.resolve(dir);assert.ok(resolved.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(resolved).startsWith('heart-order-test-'));fs.rmSync(resolved,{recursive:true,force:true});});
async function req(url,input,token){const r=await fetch(base+url,{method:input===undefined?'GET':'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:input===undefined?undefined:JSON.stringify(input)});return{status:r.status,...await r.json()};}
const newRoom=()=>req('/api/rooms',{clientId:crypto.randomUUID().replaceAll('-','')});
const act=(s,input)=>req(`/api/rooms/${s.room.id}/actions`,input,s.token);
const presentation=require('../miniprogram/utils/presentation');
test('已选数量增减、份数边界与远程身份权限',async()=>{
  const s=await newRoom();assert.equal((await act(s,{type:'cart',id:'d13',delta:-1})).status,400);
  assert.equal((await act(s,{type:'cart',id:'d13',delta:2})).status,400);
  for(let i=0;i<9;i++)assert.equal((await act(s,{type:'cart',id:'d13',delta:1})).status,200);
  assert.equal((await act(s,{type:'cart',id:'d13',delta:1})).status,400);
  const r=await act(s,{type:'cart',id:'d13',delta:-1});assert.equal(r.room.cart.d13,8);assert.equal(r.room.votes.a.d13,'yes');
  await act(s,{type:'mode',value:'remote'});assert.equal((await act(s,{type:'cart',id:'d14',delta:1,person:'b'})).status,403);
});
test('下单排除拒绝项，订单快照固定 0 元，重复提交不产生重复单',async()=>{
  const s=await newRoom();await act(s,{type:'cart',id:'d13',delta:1});await act(s,{type:'vote',person:'b',id:'d13',value:'no'});
  assert.equal((await act(s,{type:'checkout',note:'不要辣'})).status,409);
  assert.equal((await act(s,{type:'cart',id:'d13',delta:1})).status,409);
  await act(s,{type:'vote',person:'b',id:'d13',value:'yes'});await act(s,{type:'cart',id:'d21',delta:1});
  assert.equal((await act(s,{type:'checkout',note:'很长'.repeat(70)})).status,400);
  const r=await act(s,{type:'checkout',note:'不要辣 · 现在开始'});assert.equal(r.status,200);assert.deepEqual(r.room.cart,{});assert.equal(r.room.orders.length,1);const order=r.room.orders[0];assert.equal(order.items.length,2);assert.equal(order.status,0);assert.equal(order.note,'不要辣 · 现在开始');assert.ok(order.items.every(i=>i.dish.price===0));
  assert.equal((await act(s,{type:'checkout'})).status,409);await act(s,{type:'reset'});
  const persisted=JSON.parse(fs.readFileSync(path.join(dir,'rooms.json'),'utf8'))[s.room.id];assert.deepEqual(persisted.orders[0],order);
});
test('订单状态只能向前一步，重复或过期更新不跳过进度',async()=>{
  const s=await newRoom();await act(s,{type:'cart',id:'d15',delta:1});let r=await act(s,{type:'checkout'});const id=r.room.orders[0].id;
  assert.equal((await act(s,{type:'order-status',id,status:2})).status,409);
  r=await act(s,{type:'order-status',id,status:1});assert.equal(r.room.orders[0].status,1);
  assert.equal((await act(s,{type:'order-status',id,status:1})).status,409);
  await act(s,{type:'order-status',id,status:2});r=await act(s,{type:'order-status',id,status:3});assert.equal(r.room.orders[0].status,3);
  assert.equal((await act(s,{type:'order-status',id,status:4})).status,400);
  assert.equal((await act(s,{type:'order-status',id:'missing',status:1})).status,404);
});
test('删除指定订单并持久化，不影响其他订单、已选、选择和收藏',async()=>{
  const s=await newRoom();await act(s,{type:'cart',id:'d13',delta:1});
  let r=await act(s,{type:'checkout'});const deletedId=r.room.orders[0].id;
  for(const status of [1,2,3])await act(s,{type:'order-status',id:deletedId,status});
  await act(s,{type:'cart',id:'d15',delta:1});await act(s,{type:'checkout'});
  await act(s,{type:'cart',id:'d21',delta:1});r=await act(s,{type:'favorite',id:'d13',value:true});
  const before=r.room;
  r=await act(s,{type:'order-delete',id:deletedId});assert.equal(r.status,200);
  assert.deepEqual(r.room.orders,before.orders.filter(o=>o.id!==deletedId));
  for(const key of ['cart','votes','favorites'])assert.deepEqual(r.room[key],before[key]);
  const persisted=JSON.parse(fs.readFileSync(path.join(dir,'rooms.json'),'utf8'))[s.room.id];
  assert.deepEqual(persisted.orders,r.room.orders);
  assert.equal((await act(s,{type:'order-delete',id:deletedId})).status,404);
  assert.equal((await act(s,{type:'order-status',id:deletedId,status:1})).status,404);
});
test('推荐订单及旧版历史均可删除，历史回退和服务重启不会恢复已删记录',async()=>{
  for(const legacy of [false,true]){
    const s=await newRoom();const proposal=await act(s,{type:'propose',method:'pick',id:'d13'});
    await act(s,{type:'confirm',proposalId:proposal.room.proposal.id});
    const fixture=JSON.parse(fs.readFileSync(path.join(dir,'rooms.json'),'utf8'))[s.room.id];
    const deletedId=fixture.history[0].id;
    if(legacy)delete fixture.orders;
    const fixtureDir=path.join(dir,legacy?'legacy-history':'confirmed-order');fs.mkdirSync(fixtureDir);
    fs.writeFileSync(path.join(fixtureDir,'rooms.json'),JSON.stringify({[s.room.id]:fixture}));
    for(const restored of [false,true]){
      const instance=createApp({dataDir:fixtureDir});await new Promise(r=>instance.listen(0,'127.0.0.1',r));
      const url=`http://127.0.0.1:${instance.address().port}/api/rooms/${s.room.id}`;
      const headers={authorization:`Bearer ${s.token}`,'content-type':'application/json'};
      try{
        if(!restored){
          const before=await (await fetch(url,{headers})).json();assert.equal(presentation.orders(before.room).length,1);
          const response=await fetch(url+'/actions',{method:'POST',headers,body:JSON.stringify({type:'order-delete',id:deletedId})});
          assert.equal(response.status,200);
        }
        const result=await (await fetch(url,{headers})).json();
        assert.deepEqual(result.room.orders,[]);assert.deepEqual(result.room.history,[]);
        assert.deepEqual(presentation.orders(result.room),[]);
      }finally{instance.closeAllConnections();await new Promise(r=>instance.close(r));}
    }
  }
});
test('删除受房间凭证保护，另一位成员可删除并通过长轮询同步',async()=>{
  const host=await newRoom();await act(host,{type:'cart',id:'d13',delta:1});
  const checkout=await act(host,{type:'checkout'});const deletedId=checkout.room.orders[0].id;
  const foreign=await newRoom();
  assert.equal((await act(foreign,{type:'order-delete',id:deletedId})).status,404);
  assert.equal((await req(`/api/rooms/${host.room.id}/actions`,{type:'order-delete',id:deletedId},foreign.token)).status,401);
  assert.equal((await req(`/api/rooms/${host.room.id}/actions`,{type:'order-delete',id:deletedId})).status,401);
  await act(host,{type:'mode',value:'remote'});
  const guest=await req('/api/join',{code:host.room.code,clientId:crypto.randomUUID().replaceAll('-','')});
  await req(`/api/rooms/${host.room.id}`,undefined,guest.token);
  const before=await req(`/api/rooms/${host.room.id}`,undefined,host.token);assert.equal(before.room.orders.length,1);
  const waiting=req(`/api/rooms/${host.room.id}?wait=1&since=${before.room.version}`,undefined,host.token);
  await new Promise(r=>setTimeout(r,40));
  const removed=await act(guest,{type:'order-delete',id:deletedId});assert.equal(removed.status,200);
  const synced=await waiting;assert.deepEqual(synced.room.orders,[]);assert.ok(synced.room.version>before.room.version);
});
