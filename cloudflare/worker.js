import menuModel from '../miniprogram/utils/model.js';

const { dishes, categories, candidates } = menuModel;
const jsonHeaders = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const encoder = new TextEncoder();

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (condition, status, message) => { if (condition) throw new ApiError(status, message); };
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: jsonHeaders });
const randomHex = bytes => {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return [...data].map(value => value.toString(16).padStart(2, '0')).join('');
};
const randomInt = max => {
  const ceiling = 0x100000000 - (0x100000000 % max);
  const data = new Uint32Array(1);
  do crypto.getRandomValues(data); while (data[0] >= ceiling);
  return data[0] % max;
};
const clone = value => structuredClone(value);

function publicRoom(room, presence) {
  const { members, ...safe } = room;
  const online = {};
  for (const person of ['a', 'b']) online[person] = Date.now() - (presence.get(`${room.id}:${person}`) || 0) < 45000;
  return {
    ...safe,
    people: { a: members.a?.name || '我', b: members.b?.name || room.partnerName || 'TA' },
    joined: !!members.b,
    online
  };
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

function updateRoom(room, person, input) {
  const target = input.person || person;
  const canAct = () => {
    fail(!['a', 'b'].includes(target), 400, '请选择点菜身份');
    fail(room.mode === 'remote' && target !== person, 403, '远程模式下，只能修改自己的选择');
  };
  const dish = () => {
    const found = room.dishes.find(item => item.id === input.id);
    fail(!found, 404, '这道菜已经不在菜单里了');
    return found;
  };
  switch (input.type) {
    case 'vote':
      canAct(); dish(); fail(!['yes', 'no', ''].includes(input.value), 400, '选择无效');
      if (input.value) room.votes[target][input.id] = input.value; else delete room.votes[target][input.id];
      room.proposal = null;
      break;
    case 'favorite': {
      canAct(); dish(); const selected = new Set(room.favorites[target]);
      if (input.value) selected.add(input.id); else selected.delete(input.id);
      room.favorites[target] = [...selected]; break;
    }
    case 'add':
      fail(room.dishes.filter(item => item.custom).length >= 100, 400, '最多添加 100 道私房菜');
      room.dishes.push({ id: randomHex(8), ...validateDish(input.dish || {}) }); break;
    case 'edit':
      fail(!dish().custom, 403, '精选菜品暂不支持编辑');
      Object.assign(dish(), validateDish(input.dish || {})); room.proposal = null; break;
    case 'delete':
      fail(!dish().custom, 403, '精选菜品暂不支持删除');
      delete room.cart[input.id];
      room.dishes = room.dishes.filter(item => item.id !== input.id);
      for (const selectedPerson of ['a', 'b']) {
        delete room.votes[selectedPerson][input.id];
        room.favorites[selectedPerson] = room.favorites[selectedPerson].filter(id => id !== input.id);
      }
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
        const varied = pool.length > 1 ? pool.filter(item => item.id !== room.proposal?.dish.id) : pool;
        chosen = varied[randomInt(varied.length)];
      }
      room.proposal = { id: randomHex(8), dish: { ...chosen }, method: room.decisionMode === 'turn' ? 'turn' : method, by: person, createdAt: Date.now() };
      break;
    }
    case 'confirm':
      fail(!room.proposal || room.proposal.id !== input.proposalId, 409, '推荐已更新，请重新确认');
      fail(room.decisionMode === 'turn' && room.mode === 'remote' && room.turn !== person, 403, '这次轮到另一位决定啦');
      room.history.unshift({ ...room.proposal, confirmedAt: Date.now() });
      room.orders.unshift({ id: room.proposal.id, number: String(100000 + randomInt(900000)), createdAt: Date.now(), status: 0, note: '我们的共同选择 · 现在开始', items: [{ dish: { ...room.proposal.dish, price: 0 }, quantity: 1 }] });
      room.orders = room.orders.slice(0, 200); room.history = room.history.slice(0, 200); room.proposal = null;
      if (room.decisionMode === 'turn') room.turn = room.turn === 'a' ? 'b' : 'a';
      break;
    case 'cart': {
      canAct(); const chosen = dish();
      fail(![-1, 1].includes(input.delta), 400, '每次添加或减少一份');
      const quantity = (room.cart[chosen.id] || 0) + input.delta;
      fail(quantity < 0 || quantity > 9, 400, '每道菜最多选择 9 份');
      if (input.delta > 0) {
        fail(room.votes[target === 'a' ? 'b' : 'a'][chosen.id] === 'no', 409, '另一位暂时不想吃这道，换一道吧');
        fail(Object.values(room.cart).reduce((sum, value) => sum + value, 0) >= 50, 400, '一餐最多选择 50 份');
        room.votes[target][chosen.id] = 'yes'; room.proposal = null;
      }
      if (quantity) room.cart[chosen.id] = quantity; else delete room.cart[chosen.id];
      break;
    }
    case 'checkout': {
      fail(room.decisionMode === 'turn' && room.mode === 'remote' && room.turn !== person, 403, '这次轮到另一位决定啦');
      const items = room.dishes.filter(item => room.cart[item.id] > 0).map(item => ({ dish: { ...item, price: 0 }, quantity: room.cart[item.id] }));
      fail(!items.length, 409, '先选几道喜欢的菜吧');
      fail(items.some(item => room.votes.a[item.dish.id] === 'no' || room.votes.b[item.dish.id] === 'no'), 409, '已选中有一位不想吃的菜，请先移除或调整选择');
      const note = String(input.note || '').trim(); fail(note.length > 120, 400, '备注最多 120 个字');
      room.orders.unshift({ id: randomHex(8), number: String(100000 + randomInt(900000)), createdAt: Date.now(), status: 0, note: note || '用心做饭 · 现在开始', items });
      room.orders = room.orders.slice(0, 200); room.cart = {}; room.proposal = null;
      if (room.decisionMode === 'turn') room.turn = room.turn === 'a' ? 'b' : 'a';
      break;
    }
    case 'order-status': {
      const order = room.orders.find(item => item.id === input.id);
      fail(!order, 404, '没有找到这份订单');
      fail(!Number.isInteger(input.status) || input.status < 1 || input.status > 3, 400, '订单状态无效');
      fail(input.status !== order.status + 1, 409, '订单进度已更新，请查看最新状态');
      order.status = input.status; order.updatedAt = Date.now(); break;
    }
    case 'order-delete': {
      const exists = room.orders.some(item => item.id === input.id) || room.history.some(item => item.id === input.id);
      fail(!exists, 404, '这份订单已被删除或不存在');
      room.orders = room.orders.filter(item => item.id !== input.id);
      room.history = room.history.filter(item => item.id !== input.id); break;
    }
    case 'reset':
      fail(person !== 'a', 403, '请由房间创建者开始新一轮');
      room.votes = { a: {}, b: {} }; room.proposal = null; break;
    case 'rename': {
      canAct(); const name = String(input.value || '').trim();
      fail(!name || name.length > 12, 400, '昵称请填写 1–12 个字');
      if (room.members[target]) room.members[target].name = name; else room.partnerName = name;
      break;
    }
    default: throw new ApiError(400, '不支持的操作');
  }
}

export class MenuRooms {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.presence = new Map();
    this.rates = new Map();
    this.waiters = new Map();
  }

  async readBody(request) {
    const raw = await request.text();
    fail(encoder.encode(raw).byteLength > 65536, 413, '提交的内容太大了');
    try { return JSON.parse(raw || '{}'); } catch { throw new ApiError(400, '请求格式不正确'); }
  }

  rateLimit(request) {
    const key = request.headers.get('cf-connecting-ip') || 'local';
    const bucket = this.rates.get(key) || { count: 0, start: Date.now() };
    if (Date.now() - bucket.start > 60000) { bucket.count = 0; bucket.start = Date.now(); }
    bucket.count += 1; this.rates.set(key, bucket);
    fail(bucket.count > 30, 429, '操作有点快，请一分钟后再试');
  }

  async getRoom(id) {
    const room = await this.state.storage.get(`room:${id}`);
    if (room) { room.cart ||= {}; room.orders ||= []; }
    return room;
  }

  async saveRoom(room) {
    await this.state.storage.put(`room:${room.id}`, room);
    for (const resolve of [...(this.waiters.get(room.id) || [])]) resolve();
  }

  authenticate(request, room) {
    const token = (request.headers.get('authorization') || '').replace(/^Bearer /, '');
    const person = ['a', 'b'].find(key => room.members[key]?.token === token);
    fail(!person, 401, '房间凭证已失效，请重新加入');
    this.presence.set(`${room.id}:${person}`, Date.now());
    return person;
  }

  async createOrJoin(request, pathname) {
    this.rateLimit(request);
    const input = await this.readBody(request);
    fail(!/^[a-zA-Z0-9_-]{12,80}$/.test(input.clientId || ''), 400, '设备标识无效');
    let room, person;
    if (pathname === '/api/rooms') {
      room = {
        id: randomHex(12), code: randomHex(4).toUpperCase(), version: 1, mode: 'together', decisionMode: 'random', turn: 'a',
        members: { a: { clientId: input.clientId, token: randomHex(24), name: '我' } }, dishes: clone(dishes),
        votes: { a: {}, b: {} }, favorites: { a: [], b: [] }, proposal: null, history: [], cart: {}, orders: [],
        createdAt: Date.now(), updatedAt: Date.now()
      };
      person = 'a';
      await this.state.storage.put(`code:${room.code}`, room.id);
    } else {
      const code = String(input.code || '').trim().toUpperCase();
      const roomId = await this.state.storage.get(`code:${code}`);
      room = roomId && await this.getRoom(roomId);
      fail(!room, 404, '没有找到这个房间，请检查邀请码');
      person = ['a', 'b'].find(key => room.members[key]?.clientId === input.clientId);
      if (!person) {
        fail(!!room.members.b, 409, '这个房间已经有两位啦，请创建一个新房间');
        fail(room.mode !== 'remote', 409, '请先让房主开启远程邀请');
        person = 'b'; room.members.b = { clientId: input.clientId, token: randomHex(24), name: room.partnerName || 'TA' };
      }
      room.mode = 'remote';
    }
    this.presence.set(`${room.id}:${person}`, Date.now());
    room.version += 1; room.updatedAt = Date.now(); await this.saveRoom(room);
    return json({ room: publicRoom(room, this.presence), person, token: room.members[person].token });
  }

  async waitForChange(room) {
    let timer;
    await new Promise(resolve => {
      const list = this.waiters.get(room.id) || new Set();
      this.waiters.set(room.id, list);
      const finish = () => {
        clearTimeout(timer); list.delete(finish); if (!list.size) this.waiters.delete(room.id); resolve();
      };
      list.add(finish); timer = setTimeout(finish, 15000);
    });
    return await this.getRoom(room.id) || room;
  }

  async fetch(request) {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname;
      fail(!['GET', 'POST'].includes(request.method), 405, '请求方法不支持');
      if (['/api/rooms', '/api/join'].includes(pathname) && request.method === 'POST') return await this.createOrJoin(request, pathname);
      const match = pathname.match(/^\/api\/rooms\/([a-f0-9]{24})(\/actions)?$/);
      fail(!match, 404, '接口不存在');
      fail(!!match[2] && request.method !== 'POST', 405, '请求方法不支持');
      const input = match[2] ? await this.readBody(request) : null;
      let room = await this.getRoom(match[1]); fail(!room, 404, '房间不存在，请重新创建');
      const person = this.authenticate(request, room);
      if (match[2]) {
        updateRoom(room, person, input);
        room.version += 1; room.updatedAt = Date.now(); await this.saveRoom(room);
        return json({ room: publicRoom(room, this.presence) });
      }
      fail(request.method !== 'GET', 405, '请求方法不支持');
      if (url.searchParams.get('wait') === '1' && Number(url.searchParams.get('since')) >= room.version) room = await this.waitForChange(room);
      return json({ room: publicRoom(room, this.presence) });
    } catch (error) {
      if (!error.status) console.error(error);
      return json({ error: error.status ? error.message : '服务暂时忙，请稍后重试' }, error.status || 500);
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') return json({ ok: true, runtime: 'cloudflare-workers' });
    if (url.pathname.startsWith('/api/')) {
      const id = env.ROOMS.idFromName('heart-menu-rooms');
      return env.ROOMS.get(id).fetch(request);
    }
    return env.ASSETS.fetch(request);
  }
};
