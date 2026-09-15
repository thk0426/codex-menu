// Render the compiler's actual WXML tree to a browser for supplementary visual QA.
// This does not replace WeChat device testing.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {make}=require('./compile-miniprogram');
const {dishes}=require('../miniprogram/utils/model');
const root=path.resolve(__dirname,'../miniprogram');
const pageFile=path.join(root,'pages/index/index.js');
let page;
vm.runInNewContext(fs.readFileSync(pageFile,'utf8'),{require:createRequire(pageFile),Page:p=>{page=p;},wx:{},console,Set,setTimeout,clearTimeout});
page.data=JSON.parse(JSON.stringify(page.data));page._session={id:'qa',person:'a'};page._failedImages=new Set();page.setData=function(p){Object.assign(this.data,p);};
page.applyRoom({id:'qa',version:1,code:'LOVE2026',mode:'together',decisionMode:'random',turn:'a',people:{a:'我',b:'TA'},online:{a:true,b:false},dishes,votes:{a:{d2:'yes',d4:'yes'},b:{d2:'yes'}},favorites:{a:['d2'],b:[]},history:[],proposal:null});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tags={'wx-view':'div','wx-text':'span','wx-image':'img','wx-button':'button','wx-input':'input','wx-textarea':'textarea','wx-scroll-view':'div','wx-picker':'div'};
function render(node){
  if(typeof node==='string'||typeof node==='number')return esc(node);
  if(!node)return'';
  const children=(node.children||[]).map(render).join('');
  const tag=tags[node.tag];if(!tag)return children;
  const a=node.attr||{};let attrs='';
  for(const k of ['class','style','value','placeholder'])if(a[k]!=null)attrs+=` ${k}="${esc(a[k])}"`;
  if(tag==='img'&&a.src){const source=path.join(root,a.src);if(fs.existsSync(source)){const type=a.src.endsWith('.jpg')?'image/jpeg':'image/png';attrs+=` src="data:${type};base64,${fs.readFileSync(source).toString('base64')}"`;}}
  if(tag==='img'||tag==='input')return `<${tag}${attrs}>`;
  return `<${tag}${attrs}>${children}</${tag}>`;
}
const map={page:'body',view:'div',text:'span',image:'img',picker:'div'};
const css=(fs.readFileSync(path.join(root,'app.wxss'),'utf8')+'\n'+fs.readFileSync(path.join(root,'pages/index/index.wxss'),'utf8')+'\n'+fs.readFileSync(path.join(root,'pages/index/heart.wxss'),'utf8')).replace(/@import[^;]+;/g,'').replace(/(?<![a-zA-Z-:])(page|view|text|image|picker)(?![a-zA-Z-])/g,m=>map[m]).replace(/(-?[\d.]+)rpx/g,(_,n)=>`${Number(n)*390/750}px`);
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});const tab=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});try{
  for(const state of ['menu','invite','dish','draw','history','cart','us']){
    page.setData({modal:'',page:'menu'});page.refresh();
    if(state==='invite')page.setData({modal:'invite'});
    if(state==='dish')page.add();
    if(state==='draw')page.setData({modal:'draw',pending:{dish:dishes[1],spiceLabel:'微辣'}});
    if(state==='history'){page.data.room.orders=[{id:'qa-order',number:'932014',createdAt:Date.now(),status:2,note:'不要辣 · 现在开始',items:[{dish:dishes.find(d=>d.id==='d22'),quantity:1},{dish:dishes.find(d=>d.id==='d15'),quantity:1}]}];page.setData({page:'history'});page.refresh();}
    if(state==='cart'){page.data.room.cart={d13:1,d21:1};page.setData({page:'cart'});page.refresh();}if(state==='us'){page.setData({page:'us'});page.refresh();}const tree=make('pages/index/index.wxml')(page.data);const html=`<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}button{border:0;font-family:inherit;cursor:pointer}input,textarea{font-family:inherit}img{object-fit:cover}.categories,.match-scroll,.heart-categories{overflow-x:auto}.sheet-scroll{overflow-y:auto}.page{overflow-x:hidden}${css}</style><body>${render(tree)}</body></html>`;
    await tab.setContent(html);await tab.screenshot({path:`artifacts/native-${state}.png`,fullPage:false});
    if(state==='menu')await tab.screenshot({path:'artifacts/native-menu-full.png',fullPage:true});
    console.log(`原生模板截图：${state}`);
  }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
