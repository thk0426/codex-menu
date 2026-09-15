const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { dishes, categories, candidates } = require('../miniprogram/utils/model');

const ROOT = path.resolve(__dirname, '..');
const id = (bytes = 16) => crypto.randomBytes(bytes).toString('hex');
class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (condition, status, message) => { if (condition) throw new ApiError(status, message); };

function createApp({ dataDir = process.env.DATA_DIR || path.join(ROOT, '.data') } = {}) {
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, 'rooms.json');
  const rooms = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  for (const room of Object.values(rooms)) { room.cart ||= {}; room.orders ||= []; }
  const waiters = new Map();
  const presence = new Map();
  const rates = new Map();
  function save() { const temp = `${file}.tmp`; fs.writeFileSync(temp, JSON.stringify(rooms)); fs.renameSync(temp, file); }
  function state(room) {
    const { members, ...safe } = room;
    const online = {};
    for (const person of ['a', 'b']) online[person] = Date.now() - (presence.get(`${room.id}:${person}`) || 0) < 45000;
    return { ...safe, people: { a: members.a?.name || '我', b: members.b?.name || room.partnerName || 'TA' }, joined: !!members.b, online };
  }
  function publish(room) {
    room.version += 1;
    room.updatedAt = Date.now();
    save();
    for (const finish of [...(waiters.get(room.id) || [])]) finish();
  }
  function response(res, status, value) {
    if (!res.writableEnded) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); }
  }
  function auth(req, room) {
    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    const person = ['a', 'b'].find(p => room.members[p]?.token === token);
    fail(!person, 401, '房间凭证已失效，请重新加入');
    const key = `${room.id}:${person}`;
    const wasOffline = Date.now() - (presence.get(key) || 0) > 45000;
    presence.set(key, Date.now());
    if (wasOffline) publish(room);
    return person;
  }
  async function body(req) {
    let raw = '';
    for await (const chunk of req) { raw += chunk; fail(Buffer.byteLength(raw) > 65536, 413, '提交的内容太大了'); }
    try { return JSON.parse(raw || '{}'); } catch { throw new ApiError(400, '请求格式不正确'); }
  }
  function validateDish(input) {
    const name = String(input.name || '').trim();
    const desc = String(input.desc || '').trim();
    const price = Number(input.price);
    fail(!name || name.length > 24, 400, '菜名请填写 1–24 个字');
    fail(desc.length > 80, 400, '描述最多 80 个字');
    fail(input.price === '' || input.price == null || !Number.isFinite(price) || price < 0 || price > 9999, 400, '请填写 0–9999 元之间的价格');
    fail(!Number.isInteger(Number(input.spice)) || Number(input.spice) < 0 || Number(input.spice) > 3, 400, '请选择正确的辣度');
    fail(!['荤菜', '素菜'].includes(input.kind) || !categories.slice(1).includes(input.category), 400, '请选择菜品分类和荤素');
    const emoji = ['🍜', '🍲', '🥗', '🍝', '🥟', '🍕', '🍗', '🍰'].includes(input.emoji) ? input.emoji : '🍲';
    return { name, desc: desc || '专属于我们的小小美味', price: 0, spice: Number(input.spice), kind: input.kind, category: input.category, emoji, tags: ['我们的私房菜'], image: '', custom: true };
  }
  function action(room, person, input) {
    const target = input.person || person;
    const canAct = () => { fail(!['a', 'b'].includes(target), 400, '请选择点菜身份'); fail(room.mode === 'remote' && target !== person, 403, '远程模式下，只能修改自己的选择'); };
    const dish = () => { const d = room.dishes.find(d => d.id === input.id); fail(!d, 404, '这道菜已经不在菜单里了'); return d; };
    switch (input.type) {
      case 'vote':
        canAct(); dish(); fail(!['yes', 'no', ''].includes(input.value), 400, '选择无效');
        if (input.value) room.votes[target][input.id] = input.value; else delete room.votes[target][input.id];
        room.proposal = null;
        break;
      case 'favorite': {
        canAct(); dish(); const set = new Set(room.favorites[target]);
        if (input.value) set.add(input.id); else set.delete(input.id);
        room.favorites[target] = [...set]; break;
      }
      case 'add':
        fail(room.dishes.filter(d => d.custom).length >= 100, 400, '最多添加 100 道私房菜');
        room.dishes.push({ id: id(8), ...validateDish(input.dish || {}) }); break;
      case 'edit':
        fail(!dish().custom, 403, '精选菜品暂不支持编辑');
        Object.assign(dish(), validateDish(input.dish || {})); room.proposal = null; break;
      case 'delete':
        fail(!dish().custom, 403, '精选菜品暂不支持删除');
        delete room.cart[input.id];
        room.dishes = room.dishes.filter(d => d.id !== input.id);
        for (const p of ['a', 'b']) { delete room.votes[p][input.id]; room.favorites[p] = room.favorites[p].filter(d => d !== input.id); }
        room.proposal = null; break;
      case 'mode':
        fail(person !== 'a', 403, '请由房间创建者切换模式');
        fail(!['together', 'remote'].includes(input.value), 400, '模式无效');
        room.mode = input.value; break;
      case 'decisionMode':
        fail(!['random', 'turn'].includes(input.value), 400, '决定方式无效');
        room.decisionMode = input.value; room.proposal = null; break;
      case 'propose': {
        const method = input.method || 'random';
        fail(!['random', 'pick'].includes(method), 400, '决定方式无效');
        fail(room.decisionMode === 'turn' && room.mode === 'remote' && room.turn !== person, 403, '这次轮到另一位决定啦');
        const pool = candidates(room, room.decisionMode === 'turn' ? room.turn : null);
        fail(!pool.length, 409, '暂时没有合适的菜，试试调整不想吃的选项，或添加新菜');
        let chosen;
        if (method === 'pick') {
          chosen = dish();
          fail(room.votes.a[chosen.id] === 'no' || room.votes.b[chosen.id] === 'no', 409, '有一位暂时不想吃这道，换一道吧');
        } else {
          const varied = pool.length > 1 ? pool.filter(d => d.id !== room.proposal?.dish.id) : pool;
          chosen = varied[crypto.randomInt(varied.length)];
        }
        room.proposal = { id: id(8), dish: { ...chosen }, method: room.decisionMode === 'turn' ? 'turn' : method, by: person, createdAt: Date.now() };
        break;
      }
      case 'confirm':
        fail(!room.proposal || room.proposal.id !== input.proposalId, 409, '推荐已更新，请重新确认');
        fail(room.decisionMode === 'turn' && room.mode === 'remote' && room.turn !== person, 403, '这次轮到另一位决定啦');
        room.history.unshift({ ...room.proposal, confirmedAt: Date.now() });
        room.orders.unshift({ id:room.proposal.id,number:String(crypto.randomInt(100000,1000000)),createdAt:Date.now(),status:0,note:'我们的共同选择 · 现在开始',items:[{dish:{...room.proposal.dish,price:0},quantity:1}] });
        room.orders = room.orders.slice(0, 200);
        room.history = room.history.slice(0, 200);
        room.proposal = null;
        if (room.decisionMode === 'turn') room.turn = room.turn === 'a' ? 'b' : 'a';
        break;
      case 'cart': {
        canAct(); const chosen = dish();
        fail(![-1,1].includes(input.delta),400,'每次添加或减少一份');
        const quantity = (room.cart[chosen.id] || 0) + input.delta;
        fail(quantity < 0 || quantity > 9,400,'每道菜最多选择 9 份');
        if (input.delta > 0) {
          fail(room.votes[target === 'a' ? 'b' : 'a'][chosen.id] === 'no',409,'另一位暂时不想吃这道，换一道吧');
          fail(Object.values(room.cart).reduce((n,q)=>n+q,0) >= 50,400,'一餐最多选择 50 份');
          room.votes[target][chosen.id] = 'yes'; room.proposal = null;
        }
        if (quantity) room.cart[chosen.id] = quantity; else delete room.cart[chosen.id];
        break;
      }
      case 'checkout': {
        fail(room.decisionMode === 'turn' && room.mode === 'remote' && room.turn !== person,403,'这次轮到另一位决定啦');
        const items = room.dishes.filter(d=>room.cart[d.id]>0).map(d=>({dish:{...d,price:0},quantity:room.cart[d.id]}));
        fail(!items.length,409,'先选几道喜欢的菜吧');
        fail(items.some(i=>room.votes.a[i.dish.id]==='no'||room.votes.b[i.dish.id]==='no'),409,'已选中有一位不想吃的菜，请先移除或调整选择');
        const note = String(input.note || '').trim();
        fail(note.length > 120,400,'备注最多 120 个字');
        const order = {id:id(8),number:String(crypto.randomInt(100000,1000000)),createdAt:Date.now(),status:0,note:note || '用心做饭 · 现在开始',items};
        room.orders.unshift(order); room.orders = room.orders.slice(0,200); room.cart = {}; room.proposal = null;
        if(room.decisionMode==='turn')room.turn=room.turn==='a'?'b':'a';
        break;
      }
      case 'order-status': {
        const order = room.orders.find(o=>o.id===input.id);
        fail(!order,404,'没有找到这份订单');
        fail(!Number.isInteger(input.status)||input.status<1||input.status>3,400,'订单状态无效');
        fail(input.status!==order.status+1,409,'订单进度已更新，请查看最新状态');
        order.status=input.status; order.updatedAt=Date.now();
        break;
      }
      case 'order-delete': {
        const exists = room.orders.some(o => o.id === input.id) || room.history.some(h => h.id === input.id);
        fail(!exists, 404, '这份订单已被删除或不存在');
        room.orders = room.orders.filter(o => o.id !== input.id);
        // A confirmed recommendation is also stored in history; remove its matching snapshot
        // so the legacy history view cannot recreate the deleted order.
        room.history = room.history.filter(h => h.id !== input.id);
        break;
      }
      case 'reset':
        fail(person !== 'a', 403, '请由房间创建者开始新一轮');
        room.votes = { a: {}, b: {} }; room.proposal = null; break;
      case 'rename': {
        canAct(); const name = String(input.value || '').trim(); fail(!name || name.length > 12, 400, '昵称请填写 1–12 个字');
        if (room.members[target]) room.members[target].name = name;
        else room.partnerName = name;
        break;
      }
      default: throw new ApiError(400, '不支持的操作');
    }
    publish(room);
  }
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/health') return response(res, 200, { ok: true });
      if (url.pathname.startsWith('/api/')) {
        fail(!['GET', 'POST'].includes(req.method), 405, '请求方法不支持');
        if (['/api/rooms', '/api/join'].includes(url.pathname) && req.method === 'POST') {
          const key = req.socket.remoteAddress;
          const bucket = rates.get(key) || { count: 0, start: Date.now() };
          if (Date.now() - bucket.start > 60000) { bucket.count = 0; bucket.start = Date.now(); }
          bucket.count++; rates.set(key, bucket); fail(bucket.count > 30, 429, '操作有点快，请一分钟后再试');
          const input = await body(req);
          fail(!/^[a-zA-Z0-9_-]{12,80}$/.test(input.clientId || ''), 400, '设备标识无效');
          let room, person;
          if (url.pathname === '/api/rooms') {
            room = { id: id(12), code: crypto.randomBytes(4).toString('hex').toUpperCase(), version: 1, mode: 'together', decisionMode: 'random', turn: 'a', members: { a: { clientId: input.clientId, token: id(24), name: '我' } }, dishes: structuredClone(dishes), votes: { a: {}, b: {} }, favorites: { a: [], b: [] }, proposal: null, history: [], createdAt: Date.now(), updatedAt: Date.now() };
            room.cart = {}; room.orders = [];
            rooms[room.id] = room; person = 'a';
          } else {
            room = Object.values(rooms).find(r => r.code === String(input.code || '').trim().toUpperCase());
            fail(!room, 404, '没有找到这个房间，请检查邀请码');
            person = ['a', 'b'].find(p => room.members[p]?.clientId === input.clientId);
            if (!person) {
              fail(!!room.members.b, 409, '这个房间已经有两位啦，请创建一个新房间');
              fail(room.mode !== 'remote', 409, '请先让房主开启远程邀请');
              person = 'b'; room.members.b = { clientId: input.clientId, token: id(24), name: room.partnerName || 'TA' };
            }
            room.mode = 'remote';
          }
          presence.set(`${room.id}:${person}`, Date.now()); publish(room);
          return response(res, 200, { room: state(room), person, token: room.members[person].token });
        }
        const match = url.pathname.match(/^\/api\/rooms\/([a-f0-9]{24})(\/actions)?$/);
        fail(!match, 404, '接口不存在');
        const room = rooms[match[1]]; fail(!room, 404, '房间不存在，请重新创建');
        const person = auth(req, room);
        if (match[2] && req.method === 'POST') {
          action(room, person, await body(req)); return response(res, 200, { room: state(room) });
        }
        fail(req.method !== 'GET' || !!match[2], 405, '请求方法不支持');
        if (url.searchParams.get('wait') === '1' && Number(url.searchParams.get('since')) >= room.version) {
          const list = waiters.get(room.id) || new Set(); waiters.set(room.id, list);
          let timer;
          const cleanup = () => { clearTimeout(timer); list.delete(finish); if (!list.size) waiters.delete(room.id); };
          const finish = () => { cleanup(); response(res, 200, { room: state(room) }); };
          list.add(finish); timer = setTimeout(finish, 20000); res.on('close', cleanup);
          return;
        }
        return response(res, 200, { room: state(room) });
      }
      fail(req.method !== 'GET' && req.method !== 'HEAD', 405, '请求方法不支持');
      const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
      const publicDir = path.join(ROOT, 'public');
      let asset = path.resolve(publicDir, relative);
      if (url.pathname === '/shared/model.js') asset = path.join(ROOT, 'miniprogram/utils/model.js');
      else if (url.pathname === '/shared/presentation.js') asset = path.join(ROOT, 'miniprogram/utils/presentation.js');
      else if (/^\/assets\/food\/d\d+(?:-v\d+)?\.jpg$/.test(url.pathname) && !fs.existsSync(asset)) asset = path.join(ROOT, 'miniprogram', relative);
      else fail(!asset.startsWith(publicDir + path.sep), 403, '禁止访问');
      fail(!fs.existsSync(asset) || !fs.statSync(asset).isFile(), 404, '页面不存在');
      const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };
      res.writeHead(200, { 'Content-Type': types[path.extname(asset)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
      if (req.method === 'HEAD') res.end(); else fs.createReadStream(asset).pipe(res);
    } catch (error) {
      if (!error.status) console.error(error.message);
      response(res, error.status || 500, { error: error.status ? error.message : '服务暂时忙，请稍后重试' });
    }
  });
  server.on('close', () => { for (const list of waiters.values()) for (const finish of [...list]) finish(); });
  return server;
}
if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  createApp().listen(port, '0.0.0.0', () => console.log(`一餐两人已启动：http://localhost:${port}`));
}
module.exports = { createApp };
