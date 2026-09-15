const { decorate, matches, categories } = window.MenuModel;
const MenuPresentation = window.MenuPresentation;
let uiTab='all', expandedDish='', kitchen=false, orderNote='';
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const paths = {
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  bowl: '<path d="M3 11h18a9 9 0 0 1-18 0Zm4 10h10M8 7c-3-3 3-3 0-6m6 6c-3-3 3-3 0-6m4 7 3-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  book: '<path d="M4 3h13a2 2 0 0 1 2 2v16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm0 14h15M7 7h8m-8 4h5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  filter: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2" fill="currentColor" stroke="none"/><circle cx="16" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="10" cy="18" r="2" fill="currentColor" stroke="none"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  cross: '<path d="m6 6 12 12M18 6 6 18"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5"/>',
  link: '<path d="m10 13 4-4m-4 7-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 0 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="4" transform="rotate(-9 12 12)"/><path d="M8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01" stroke-width="2.8"/>',
  swap: '<path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  leaf: '<path d="M20 3C5 1 0 16 9 19 19 23 22 12 20 3ZM4 22 16 9"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  settings: '<circle cx="12" cy="12" r="4"/><path d="m12 2 1 3 3 1 3-1 1 3 2 2-2 2v4l-3 1-2 3-3-1-3 1-2-3-3-1v-4l-2-2 2-2 1-3 3 1 3-1Z"/>'
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.heart}</svg>`;
const navs = [['menu', 'bowl', '今天吃什么'], ['favorites', 'heart', '心动收藏'], ['history', 'clock', '我们的食光'], ['manage', 'book', '私房菜单']];
let room, credential, person = 'a', page = 'menu', connected = true, filtersOpen = false;
let filters = { query: '', category: '全部', kind: '', spice: '', price: '' };
let modal = null, pollGeneration = 0, pollController, toastTimer, returnFocus;
const busy = new Set();
let clientId = localStorage.getItem('together-client');
if (!clientId) { clientId = crypto.randomUUID().replaceAll('-', ''); localStorage.setItem('together-client', clientId); }
try { credential = JSON.parse(localStorage.getItem('together-session')); } catch { credential = null; }
function notify(message) { const el = $('#toast'); el.textContent = message; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 3400); }
function names(p) { const name=room?.people[p] || (p === 'a' ? '我' : 'TA'); return room?.mode==='remote'&&['我','TA'].includes(name) ? (p===credential.person?'我':'TA') : name; }
function avatar(p, small = false) { return `<span class="avatar ${p === 'b' ? 'sage' : ''} ${small ? 'small' : ''}" aria-hidden="true">${p === 'a' ? '👩🏻' : '👨🏻'}</span>`; }
function setRoom(next) {
  if (credential && next.id !== credential.id) return;
  if (room && next.id === room.id && next.version < room.version) return;
  const previousProposal = room?.proposal?.id;
  room = next;
  if (room.mode === 'remote') person = credential.person;
  render();
  if (modal?.orderId && !MenuPresentation.orders(room).some(o => o.id === modal.orderId)) {
    closeModal(); notify('订单已删除，另一端会同步更新');
  }
  if (modal?.type === 'draw' && previousProposal !== room.proposal?.id) {
    if (room.proposal) renderModal(); else { closeModal(); notify('这一餐的选择已更新'); }
  }
}
async function request(endpoint, payload, signal) {
  const response = await fetch(endpoint, { method: payload === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(credential ? { Authorization: `Bearer ${credential.token}` } : {}) }, body: payload === undefined ? undefined : JSON.stringify(payload), signal });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error || '请求失败，请稍后再试'), { status: response.status });
  return data;
}
function saveSession(data) { credential = { id: data.room.id, token: data.token, person: data.person }; localStorage.setItem('together-session', JSON.stringify(credential)); person = data.person; room = null; setRoom(data.room); startPolling(); }
async function start() {
  try {
    const code = new URL(location.href).searchParams.get('room');
    if (code) {
      try { saveSession(await request('/api/join', { code, clientId })); history.replaceState(null, '', location.pathname); notify('已进入双人房间，一起选菜吧'); return; }
      catch (error) { notify(error.message); history.replaceState(null, '', location.pathname); }
    }
    if (credential) {
      try { const data = await request(`/api/rooms/${credential.id}`); person = credential.person; connected = true; setRoom(data.room); startPolling(); return; }
      catch (error) { if (![401, 404].includes(error.status)) throw error; credential = null; localStorage.removeItem('together-session'); }
    }
    saveSession(await request('/api/rooms', { clientId }));
  } catch (error) {
    $('#app').innerHTML = `<div class="boot"><img src="/assets/logo.svg" width="58" alt="一餐两人"><p>暂时没能连接到我们的餐桌</p><p>${esc(error.message)}</p><button class="primary-btn" data-action="retry">重新连接</button></div>`;
  }
}
async function startPolling() {
  const generation = ++pollGeneration;
  pollController?.abort();
  while (generation === pollGeneration && credential) {
    pollController = new AbortController();
    try {
      const data = await request(`/api/rooms/${credential.id}?wait=1&since=${room.version}`, undefined, pollController.signal);
      if (generation !== pollGeneration) return;
      const changed = !connected || data.room.version !== room.version || JSON.stringify(data.room.online) !== JSON.stringify(room.online);
      connected = true;
      if (changed) setRoom(data.room);
    } catch (error) {
      if (error.name === 'AbortError' || generation !== pollGeneration) return;
      connected = false; render();
      if ([401, 404].includes(error.status)) { notify('房间凭证已失效，请重新加入'); return; }
      await new Promise(resolve => setTimeout(resolve, 2500));
    }
  }
}
async function act(input) {
  const key = `${input.type}:${input.person || person}:${input.id || ''}`;
  if (busy.has(key)) return false;
  busy.add(key);
  try { const data = await request(`/api/rooms/${credential.id}/actions`, input); connected = true; setRoom(data.room); return true; }
  catch (error) { notify(error.message); return false; }
  finally { busy.delete(key); }
}
function statusText() { return !connected ? '正在重连' : room.mode === 'together' ? '面对面点菜' : room.online[credential.person === 'a' ? 'b' : 'a'] ? '双方已在线' : room.joined ? '等待对方上线' : '等待另一位'; }
function render() {
  if (!room) return;
  const focus = document.activeElement?.id, selection = document.activeElement?.selectionStart;
  const focusData={...document.activeElement?.dataset};
  const categoryScroll = $('.category-row')?.scrollLeft || 0;
  const quantity = Object.values(room.cart || {}).reduce((n,q)=>n+q,0);
  const orderCount = (room.orders || []).filter(o=>o.status<3).length;
  const navigation = [['menu','🎀','点菜'],['history','🧾','订单'],['cart','🛒','已选'],['us','💞','我们']];
  $('#app').innerHTML = `<div class="heart-app">
    <header class="heart-header"><div class="header-inner"><button class="heart-brand" data-action="nav" data-page="menu" aria-label="心动菜单首页"><span class="heart-cloud">♥</span><span><strong>心动菜单</strong><small>今天也要好好吃饭呀</small></span></button><span class="desktop-motto">把每一餐，都做成喜欢的样子 ♡</span><button class="chef-button ${kitchen ? 'on' : ''}" data-action="kitchen" aria-label="厨房订单管理">👨‍🍳</button></div></header>
    ${!connected ? '<div class="error-banner">连接暂时中断，正在重连。<button data-action="retry-poll">重试</button></div>' : ''}
    <main class="heart-main">
    ${page === 'menu' ? `<section class="kitty-hero"><img src="/assets/kitty-kitchen-v2.jpg" alt="Hello Kitty 在温暖的粉色厨房里准备家常菜" fetchpriority="high"><div class="hero-shade"></div><div class="kitty-copy"><span class="kitty-label">HELLO KITTY · 私房菜</span><h1>今天想吃什么？</h1><p>宝贝点菜，我负责把喜欢端上桌</p></div></section><div class="personal-note"><span class="letter-emoji">💌</span><p><strong>小成的专属菜单：</strong>不算价格，只计算心动。</p><span class="note-bow">🎀</span></div>` : ''}
    <section class="heart-content ${page === 'menu' ? 'menu-content' : ''}">${renderMenu()}</section>
    </main><nav class="heart-tabbar" aria-label="主导航"><div>${navigation.map(([id,emoji,label])=>`<button class="heart-tab ${id === page || id === 'us' && ['favorites','manage'].includes(page) ? 'active' : ''} ${id==='cart'?'cart-tab':''}" data-action="nav" data-page="${id}" ${page===id?'aria-current="page"':''}><span class="tab-symbol">${emoji}${id==='history'&&orderCount?`<i class="tab-count">${orderCount}</i>`:id==='cart'&&quantity?`<i class="tab-count">${quantity}</i>`:''}</span><span>${label}</span></button>`).join('')}</div></nav></div>`;
  const row=$('.category-row');if(row)row.scrollLeft=categoryScroll;
  if(!focus&&focusData.action){const target=[...document.querySelectorAll('[data-action]')].find(el=>Object.entries(focusData).every(([key,value])=>el.dataset[key]===value));target?.focus({preventScroll:true});}
  if(focus&&document.getElementById(focus)){const el=document.getElementById(focus);el.focus({preventScroll:true});if(typeof selection==='number'&&el.setSelectionRange)el.setSelectionRange(selection,selection);}
}
function renderMenu() {
  if(page==='history')return renderOrders();
  if(page==='cart')return renderCart();
  if(page==='us')return `<div class="page-intro"><h1>我们的心动日常</h1><p>一人点菜，一人下厨，两个人好好吃饭。</p></div><div class="us-shortcuts"><button data-action="nav" data-page="favorites">♥<span>心动收藏</span><small>${room.favorites[person].length} 道常吃的喜欢</small></button><button data-action="nav" data-page="manage">📖<span>私房菜单</span><small>把拿手菜写进我们的日常</small></button><button data-action="profile">💌<span>我们的昵称</span><small>${esc(names('a'))} & ${esc(names('b'))}</small></button></div><div class="us-panels">${renderPanels()}</div><button class="text-button" data-action="about">怎么一起点菜？</button>`;
  let list=decorate(room,person,{...filters,favorites:page==='favorites'}).filter(d=>page==='manage'?d.custom:MenuPresentation.inTab(d,uiTab));
  const priority=['d13','d21','d22'];
  if(uiTab==='all'&&!filters.query)list.sort((a,b)=>(priority.includes(a.id)?priority.indexOf(a.id):99)-(priority.includes(b.id)?priority.indexOf(b.id):99));
  const title=page==='favorites'?'心动收藏':page==='manage'?'我们的私房菜单':'今天的菜单';
  let html=`${page!=='menu'?'<button class="back-link" data-action="nav" data-page="us">‹ 返回我们</button>':''}<div class="menu-heading"><h2>${title}</h2><span>${list.length} 道可选</span></div>`;
  if(page==='manage')html+=`<p class="section-caption">家里的拿手菜，也值得被认真期待。</p><button class="primary-btn add-custom" data-action="add">＋ 添加菜品</button>`;
  else html+=`<div class="category-row" aria-label="菜品分类">${MenuPresentation.tabs.map(t=>`<button class="category-pill ${uiTab===t.id?'active':''}" data-action="food-tab" data-tab="${t.id}" aria-pressed="${uiTab===t.id}"><span>${t.icon}</span>${t.label}</button>`).join('')}</div><div class="dish-section-heading"><h2>${MenuPresentation.tabs.find(t=>t.id===uiTab).icon} ${MenuPresentation.tabs.find(t=>t.id===uiTab).label}</h2><button class="quiet-filter ${filtersOpen?'active':''}" data-action="filter" aria-expanded="${filtersOpen}" aria-label="搜索与口味筛选">爱心难度不是价格</button></div>`;
  if(filtersOpen&&page!=='manage')html+=`<div class="menu-tools"><label class="search-box">${icon('search')}<input id="search" type="search" placeholder="搜索菜名、口味…" aria-label="搜索菜品" value="${esc(filters.query)}"></label><div class="filter-panel"><label>辣度<select data-filter="spice">${options([['','不限辣度'],['0','不辣'],['1','微辣'],['2','中辣'],['3','特辣']],filters.spice)}</select></label><label>荤素<select data-filter="kind">${options([['','荤素不限'],['荤菜','荤菜'],['素菜','素菜']],filters.kind)}</select></label><label>价格<select data-filter="price">${options([['','全部 0 元'],['low','0 元菜品']],filters.price)}</select></label><button class="text-button" data-action="clear-filters">清空筛选</button></div></div>`;
  if(room.decisionMode==='turn')html+=`<div class="turn-notice">⇄ 这一次，听${esc(names(room.turn))}的。决定后下次交换。</div>`;
  html+=list.length?`<div class="heart-dishes">${list.map(d=>card(d,page==='manage')).join('')}</div>`:empty('💗',page==='favorites'?'把喜欢的味道收藏起来':'暂时没有找到这道心动','试试其他分类，或者添加一道拿手菜。',page==='manage'?'添加第一道菜':'查看全部菜品',page==='manage'?'add':'clear-filters');
  html+=`<div class="menu-bottom-tools"><button data-action="filter">${icon('search','sm')}搜索 / 筛选</button><button data-action="add">＋ 添加菜品</button><button data-action="draw">⚄ 随机推荐</button></div><p class="heart-footnote">♡ 好好吃饭，慢慢相爱 · 全部菜品 0 元</p>`;
  return html;
}
function card(input,managing=false) {
  const d=MenuPresentation.food(input,room.cart), expanded=expandedDish===d.id;
  const alias=d.id==='d13'?'番茄抱抱蛋':d.id==='d21'?'可乐小鸡翅':d.name;
  const desc=d.id==='d13'?'酸甜番茄裹着嫩嫩鸡蛋，拌饭第一名':d.desc;
  const tag=d.matched?'双向心动':d.partnerVote==='yes'?'TA 爱吃':d.vote==='yes'?'我想吃':d.tags[0];
  return `<article class="heart-dish ${d.matched?'matched':''} ${expanded?'expanded':''}" data-dish-id="${d.id}"><div class="dish-main-row"><button class="dish-thumb" data-action="detail" data-id="${d.id}" aria-label="查看${esc(d.name)}详情"><span>${esc(d.emoji)}</span>${d.image?`<img src="${esc(d.image)}" alt="${esc(d.name)}" loading="lazy">`:''}<i>♥</i></button><div class="dish-info"><button class="dish-name-button" data-action="detail" data-id="${d.id}" aria-expanded="${expanded}"><h3>${esc(alias)}</h3></button><p class="dish-description">${esc(desc)}</p><div class="dish-bottom"><span class="cook-time" title="预计制作时间">⏱ ${d.minutes}分钟</span><span class="difficulty" title="爱心代表制作难度">${d.hearts}</span><span class="taste-tag">${esc(tag)}</span></div></div><button class="dish-favorite ${d.favorite?'saved':''}" data-action="favorite" data-id="${d.id}" aria-label="${d.favorite?'取消收藏':'收藏'}${esc(d.name)}" aria-pressed="${d.favorite}">♥</button>${!managing?`<button class="dish-add ${d.quantity?'has-quantity':''}" data-action="cart-add" data-id="${d.id}" aria-label="添加${esc(d.name)}到已选">${d.quantity||'＋'}</button>`:''}</div>${managing?`<div class="edit-actions"><button data-action="edit" data-id="${d.id}">编辑</button><button class="delete" data-action="delete" data-id="${d.id}">删除</button></div>`:expanded?`<div class="dish-expanded"><div class="detail-meta"><strong>${esc(d.name)}</strong><span>0 元 · ${d.spiceLabel} · ${d.kind}</span></div><p>现在是${esc(names(person))}在选${room.mode==='together'?'，可在「我们」切换身份':''}</p><div class="vote-row"><button class="vote-btn ${d.vote==='yes'?'selected':''}" data-action="vote" data-id="${d.id}" data-value="yes" aria-pressed="${d.vote==='yes'}">${icon('heart')}想吃${d.vote==='yes'?'！':''}</button><button class="vote-btn no ${d.vote==='no'?'selected':''}" data-action="vote" data-id="${d.id}" data-value="no" aria-pressed="${d.vote==='no'}">${icon('cross')}${d.vote==='no'?'已跳过':'不想吃'}</button><button class="pick-inline" data-action="pick" data-id="${d.id}">就吃这道</button></div>${d.partnerVote?`<p class="partner-hint">${esc(names(person==='a'?'b':'a'))}${d.partnerVote==='yes'?'也想吃这道 ♡':'这次想换个口味'}</p>`:''}</div>`:''}</article>`;
}
function renderOrders() {
  const orders=MenuPresentation.orders(room);
  return `<div class="page-intro"><h1>${kitchen?'今天的小厨房':'心动订单'}</h1><p>${kitchen?'用心做饭，把喜欢准时端上桌。':'每一次认真吃饭，都是我们的小纪念'}</p></div>${orders.length?`<div class="order-list">${orders.map(o=>`<article class="order-card" data-order-id="${esc(o.id)}"><div class="order-header"><div><h2>心动单号 ${esc(o.number)}</h2><p>${o.date} · ${o.quantity} 份</p></div><div class="order-header-actions"><span class="order-status ${o.status===3?'complete':''}">${o.statusLabel}</span><button class="order-delete" data-action="order-delete" data-id="${esc(o.id)}" aria-label="删除订单 ${esc(o.number)}">删除</button></div></div><div class="order-body"><div class="order-items">${o.items.map(i=>`<span>${esc(i.dish.emoji)} ${esc(i.dish.name)} × ${i.quantity}</span>`).join('')}</div><p class="order-note">${esc(o.note)}</p><div class="order-progress" aria-label="订单进度：${o.statusLabel}">${o.steps.map(s=>`<div class="order-step ${s.done?'done':''} ${s.line?'line-done':''}"><i></i><span>${s.label}</span></div>`).join('')}</div>${kitchen&&o.status<3?`<button class="primary-btn order-advance" data-action="order-status" data-id="${o.id}" data-status="${o.nextStatus}">${o.nextStatus===3?'🍽️ ':'👨‍🍳 '}标记为${o.nextLabel}</button>`:''}</div></article>`).join('')}</div>`:empty('🧾','第一份心动，等你下单','在菜单里选好喜欢的菜，我们就开始记录。','去点菜','menu')}`;
}
function renderCart() {
  const items=MenuPresentation.cartItems(room),quantity=items.reduce((n,d)=>n+d.quantity,0);
  return `<div class="page-intro"><h1>已选的小心动</h1><p>喜欢的都装进来，这一餐听我们的。</p></div>${items.length?`<div class="cart-list">${items.map(d=>`<article class="cart-item" data-cart-id="${d.id}">${d.image?`<img src="${esc(d.image)}" alt="${esc(d.name)}">`:`<span class="cart-emoji">${esc(d.emoji)}</span>`}<div class="cart-info"><h3>${esc(d.name)}</h3><p>0 元 · ${['不辣','微辣','中辣','特辣'][d.spice]}</p>${room.votes.a[d.id]==='no'||room.votes.b[d.id]==='no'?'<small class="cart-conflict">有一位暂时不想吃，请移除或调整选择</small>':''}</div><div class="quantity-control"><button data-action="cart-remove" data-id="${d.id}" aria-label="减少${esc(d.name)}">−</button><span>${d.quantity}</span><button data-action="cart-add" data-id="${d.id}" aria-label="增加${esc(d.name)}">＋</button></div></article>`).join('')}</div><form id="checkout-form" class="checkout-card"><label for="order-note">💌 给大厨的小纸条</label><textarea id="order-note" name="note" maxlength="120" placeholder="例如：不要辣 · 现在开始">${esc(orderNote)}</textarea><div class="checkout-total"><span>共 ${quantity} 份心动</span><strong>合计 0 元</strong></div><button class="primary-btn" type="submit">🎀 就这些，交给大厨</button></form>`:empty('🛒','小餐篮还空着呢','点一下菜品旁的加号，把喜欢装进来。','去挑几道菜','menu')}`;
}

function options(list, selected) { return list.map(([v,l]) => `<option value="${v}" ${String(v) === String(selected) ? 'selected' : ''}>${l}</option>`).join(''); }
function empty(emoji, title, desc, label, action) { return `<div class="empty-state"><span class="big-emoji">${emoji}</span><h3>${title}</h3><p>${desc}</p><button class="secondary-btn" data-action="${action}">${label}${icon('arrow','sm')}</button></div>`; }
function renderPanels() {
  const matched = matches(room);
  const total = p => Object.values(room.votes[p]).filter(v => v === 'yes').length;
  return `<section class="panel room-panel"><div class="panel-heading"><h3>${icon('users')}我们的餐桌</h3><span class="status-pill ${!connected ? 'offline' : ''}"><i class="status-dot"></i>${statusText()}</span></div><div class="people-switcher">${['a','b'].map((p,i) => `${i ? '<span class="between-heart">♡</span>' : ''}<button class="person-switch ${person === p ? 'active' : ''}" data-action="person" data-person="${p}" aria-label="切换到${esc(names(p))}选菜" aria-pressed="${person === p}">${avatar(p)}<div class="person-name">${esc(names(p))}</div><div class="person-meta">${total(p)} 道想吃</div></button>`).join('')}</div><div class="pair-info">${room.mode === 'together' ? `现在是${esc(names(person))}在选 · 轻点头像切换` : `你已选 ${total(credential.person)} 道 · 选择自动同步`}</div><button class="invite-btn" data-action="invite">${icon('link')}${room.mode === 'together' ? '邀请另一半，一起远程选' : `房间 ${room.code} · 邀请 / 加入`}</button></section>
    <section class="panel match-panel"><div class="panel-heading"><h3>${icon('heart')}我们的双向心动</h3><span class="count-badge">${matched.length}</span></div><p>${matched.length ? '原来，我们的胃口这么合拍。' : '两个人都想吃的美味，会在这里相遇。'}</p>${matched.length ? `<div class="matched-list">${matched.map(d => `<div class="matched-item">${d.image ? `<img src="${esc(d.image)}" alt="">` : `<span style="font-size:26px">${esc(d.emoji)}</span>`}<div><strong>${esc(d.name)}</strong><p>默契 +1 · ¥${d.price}</p></div><button data-action="pick" data-id="${d.id}">就吃它</button></div>`).join('')}</div>` : `<div class="match-empty"><div class="empty-heart">${icon('heart')}${icon('heart')}</div><div><strong>心动正在发生…</strong><p>各自选选，看看会有什么默契</p></div></div><div class="quick-decide"><button data-action="draw">${icon('dice')}随机推荐</button><button data-action="turn">${icon('swap')}${room.decisionMode === 'turn' ? '切换随机模式' : '轮流来决定'}</button></div>`}</section>
    <section class="panel random-panel"><h3>${room.decisionMode === 'turn' ? `今天，听${esc(names(room.turn))}的` : '选择困难？交给一点缘分'}</h3><p>${room.decisionMode === 'turn' ? '你来决定这一餐，我来期待小惊喜。' : '把「随便」变成小惊喜，<br>下一道心动，说不定就在这里。'}</p><button class="primary-btn" data-action="draw">${icon(room.decisionMode === 'turn' ? 'swap' : 'dice')}${room.decisionMode === 'turn' ? '帮我挑一道' : '今天吃什么，摇一下'}</button><button class="turn-btn" data-action="turn">${icon('swap')}${room.decisionMode === 'turn' ? '切换回随机推荐' : '或者，轮流来决定'}${icon('arrow')}</button></section><div class="love-note">${icon('leaf')}好好吃饭，就是最日常的浪漫</div>`;
}
function openModal(type, extra = {}) { returnFocus = document.activeElement; modal = { type, ...extra }; renderModal(); }
function closeModal() { modal = null; $('#modal-root').innerHTML = ''; document.body.style.overflow = ''; returnFocus?.focus?.({ preventScroll: true }); }
function renderModal() {
  if (!modal) return;
  let content = '';
  if (modal.type === 'invite') {
    content = `<div class="modal-eyebrow">SAVE A SEAT FOR YOUR LOVE</div><h2>这张餐桌，就差你啦</h2><p class="modal-subtitle">把邀请码或链接发给另一半。即使隔着距离，也能实时看见彼此想吃的菜。</p><div class="room-code">${room.code}</div><button class="primary-btn" data-action="copy-link">${icon('link')}复制邀请链接</button><button class="secondary-btn" data-action="copy-code">复制邀请码</button><p class="invite-note">房间仅限两位 · ${room.joined ? '另一位已加入' : '等待另一位加入'}</p><div class="modal-divider">已有另一半的邀请码？</div><form id="join-form"><label class="input-field">输入 8 位邀请码<input name="code" maxlength="8" minlength="8" required placeholder="例如 A1B2C3D4" autocomplete="off" style="text-transform:uppercase"></label><button type="submit" class="secondary-btn">加入 TA 的餐桌</button></form>${credential.person === 'a' ? '<button class="text-button" style="margin-top:17px" data-action="together">切换为面对面点菜 →</button>' : ''}`;
  } else if (modal.type === 'add' || modal.type === 'edit') {
    const d = modal.dish || { name:'',desc:'',price:0,spice:0,kind:'荤菜',category:'家常菜',emoji:'🍲' };
    content = `<div class="modal-eyebrow">OUR LITTLE SECRET MENU</div><h2>${modal.type === 'edit' ? '编辑这道小心动' : '添一道我们的私房菜'}</h2><p class="modal-subtitle">家里的拿手菜，也值得被认真期待。</p><form id="dish-form"><div class="emoji-picker">${['🍜','🍲','🥗','🍝','🥟','🍕','🍗','🍰'].map(e => `<button type="button" class="${e === d.emoji ? 'selected' : ''}" data-action="emoji" data-emoji="${e}" aria-label="选择${e}">${e}</button>`).join('')}</div><input name="emoji" type="hidden" value="${d.emoji}"><label class="input-field">菜品名称<input name="name" required maxlength="24" value="${esc(d.name)}" placeholder="比如：TA 最爱的红烧排骨"></label><label class="input-field">一句话描述<textarea name="desc" maxlength="80" placeholder="这道菜，有什么特别的小故事？">${esc(d.desc)}</textarea></label><div class="form-grid"><label class="input-field">参考价格（元）<input type="number" name="price" readonly value="0"></label><label class="input-field">辣度<select name="spice">${options([['0','不辣'],['1','微辣'],['2','中辣'],['3','特辣']],d.spice)}</select></label><label class="input-field">荤素<select name="kind">${options([['荤菜','荤菜'],['素菜','素菜']],d.kind)}</select></label><label class="input-field">分类<select name="category">${options(categories.slice(1).map(c=>[c,c]),d.category)}</select></label></div><button class="primary-btn" type="submit">${icon('plus')}${modal.type === 'edit' ? '保存修改' : '加入我们的菜单'}</button></form>`;
  } else if (modal.type === 'draw') {
    const proposal = room.proposal;
    if (!proposal) return closeModal();
    const d = proposal.dish;
    content = `<div class="draw-card"><div class="modal-eyebrow">${proposal.method === 'turn' ? 'YOUR TURN, OUR LITTLE JOY' : 'A DELICIOUS LITTLE SURPRISE'}</div><h2>今天，就让它温暖我们</h2>${d.image ? `<img class="draw-image" src="${esc(d.image)}" alt="${esc(d.name)}">` : `<div class="draw-emoji">${esc(d.emoji)}</div>`}<h3>${esc(d.name)}</h3><p class="draw-description">${esc(d.desc)}</p><p class="draw-meta">¥${d.price} · ${['不辣','微辣','中辣','特辣'][d.spice]} · ${d.kind}</p><div class="draw-priority">${matches(room).some(m=>m.id===d.id) ? '♡ 双向心动，这就是我们的默契' : '已避开任意一方不想吃的菜'}</div><button class="primary-btn" data-action="confirm">${icon('check')}就吃它，开饭啦</button><button class="secondary-btn" data-action="draw">${icon('dice','sm')}再来一道小惊喜</button></div>`;
  } else if (modal.type === 'profile') {
    content = `<div class="modal-eyebrow">HELLO, MY FAVORITE PERSON</div><h2>今天，怎么称呼你？</h2><p class="modal-subtitle">给${esc(names(person))}起一个亲切的小昵称。</p><form id="profile-form"><label class="input-field">昵称<input name="name" value="${esc(names(person))}" maxlength="12" required></label><button class="primary-btn" type="submit">保存昵称</button></form><button class="secondary-btn" data-action="invite">邀请 / 加入餐桌</button><button class="text-button" style="margin-top:17px" data-action="new-room">创建新的餐桌 →</button>`;
  } else if (modal.type === 'confirm-action') {
    content = `<div class="modal-eyebrow">A LITTLE FRESH START</div><h2>${esc(modal.title)}</h2><p class="modal-subtitle">${esc(modal.description)}</p><button class="primary-btn" data-action="execute-confirm">${esc(modal.label || '确认')}</button><button class="secondary-btn" data-action="close">再想想</button>`;
  } else {
    content = `<div class="modal-eyebrow">A TABLE FOR TWO</div><h2>一餐两人，刚好是我们</h2><p class="modal-subtitle">把选择的纠结，变成两个人的小默契。</p><div class="about-detail"><p><strong>01 · 各自选选</strong><br>轻点「想吃」或「不想吃」。面对面时点头像切换身份，远程时邀请另一半加入。</p><br><p><strong>02 · 发现默契</strong><br>两个人都想吃的菜，会自动高亮在「双向心动」。</p><br><p><strong>03 · 一起开饭</strong><br>直接选心动菜、随机摇一道，或轮流决定。确认后自动记录这一餐。</p><br><p>这里是小程序的浏览器预览，使用相同的菜单和同步服务。</p></div><button class="primary-btn" data-action="close">开始我们的一餐</button>`;
  }
  $('#modal-root').innerHTML = `<div class="modal-overlay"><section class="modal" role="dialog" aria-modal="true" aria-label="${modal.type === 'draw' ? '今日推荐' : '餐桌设置'}" tabindex="-1"><button class="icon-btn modal-close" data-action="close" aria-label="关闭">${icon('cross')}</button>${content}</section></div>`;
  document.body.style.overflow = 'hidden';
  const input = $('.modal input:not([type="hidden"])');
  (input || $('.modal')).focus({ preventScroll: true });
}
async function copy(text, message) { try { await navigator.clipboard.writeText(text); notify(message); } catch { openModal('confirm-action',{title:'请手动复制',description:text,label:'已复制',execute:async()=>true}); } }
document.addEventListener('click', async event => {
  if (event.target.classList.contains('modal-overlay')) return closeModal();
  const el = event.target.closest('[data-action]'); if (!el || el.disabled) return;
  const a = el.dataset.action, id = el.dataset.id;
  if (a === 'nav' || a === 'menu') { uiTab='all';filtersOpen=false;expandedDish='';if(el.dataset.page!=='history')kitchen=false; page = el.dataset.page || 'menu'; filters = { query:'',category:'全部',kind:'',spice:'',price:'' }; render(); window.scrollTo({top:0,behavior:'smooth'}); }
  else if(a === 'kitchen'){kitchen=!kitchen;page='history';render();window.scrollTo({top:0,behavior:'smooth'});}
  else if(a === 'food-tab'){uiTab=el.dataset.tab;render();}
  else if(a === 'detail'){expandedDish=expandedDish===id?'':id;render();}
  else if(a === 'cart-add'||a === 'cart-remove'){el.disabled=true;if(await act({type:'cart',id,person,delta:a==='cart-add'?1:-1})&&a==='cart-add')notify('已加入小餐篮 ♡');el.disabled=false;}
  else if(a === 'order-status'){el.disabled=true;if(await act({type:'order-status',id,status:Number(el.dataset.status)}))notify('制作进度已同步给另一半');el.disabled=false;}
  else if(a === 'order-delete') {
    const order=MenuPresentation.orders(room).find(o=>o.id===id);
    if(!order)return notify('这份订单已被删除');
    openModal('confirm-action',{title:`删除心动单号 ${order.number}？`,description:'删除后会从两人的订单记录中移除，无法恢复。',label:'删除订单',orderId:id,execute:()=>act({type:'order-delete',id})});
  }
  else if (a === 'person') { if (room.mode === 'remote' && el.dataset.person !== credential.person) return notify('远程时各自选菜，另一半的选择会自动同步'); person = el.dataset.person; render(); notify(`现在轮到${names(person)}选菜啦`); }
  else if (a === 'vote') { const value = room.votes[person][id] === el.dataset.value ? '' : el.dataset.value; el.disabled=true; await act({type:'vote',id,value,person}); el.disabled=false; }
  else if (a === 'favorite') { const value = !room.favorites[person].includes(id); el.disabled=true; if(await act({type:'favorite',id,value,person})) notify(value ? '已收进心动收藏 ♡' : '已取消收藏'); el.disabled=false; }
  else if (a === 'filter') { filtersOpen=!filtersOpen;render(); }
  else if (a === 'category') { filters.category=el.dataset.category;render(); }
  else if (a === 'clear-filters') { uiTab='all'; filters={query:'',category:'全部',kind:'',spice:'',price:''};render(); }
  else if (a === 'add') openModal('add');
  else if (a === 'edit') openModal('edit',{dish:room.dishes.find(d=>d.id===id)});
  else if (a === 'delete') openModal('confirm-action',{title:'从菜单移除这道菜？',description:'这道菜的想吃和收藏标记也会移除，已经记录的食光会保留。',label:'确认移除',execute:()=>act({type:'delete',id})});
  else if (a === 'emoji') { $('.emoji-picker .selected')?.classList.remove('selected');el.classList.add('selected');$('#dish-form [name="emoji"]').value=el.dataset.emoji; }
  else if (a === 'invite') { if(room.mode !== 'remote' && credential.person === 'a') { if(!await act({type:'mode',value:'remote'})) return; } openModal('invite'); }
  else if (a === 'copy-link') copy(`${location.origin}/?room=${room.code}`,'邀请链接已复制，发给另一半吧');
  else if (a === 'copy-code') copy(room.code,'邀请码已复制');
  else if (a === 'together') { if(await act({type:'mode',value:'together'})){closeModal();notify('已切换为面对面，点头像即可轮流选菜');} }
  else if (a === 'turn') { const value=room.decisionMode==='turn'?'random':'turn';if(await act({type:'decisionMode',value}))notify(value==='turn'?`这次听${names(room.turn)}的，下次交换`:'让缘分帮我们选一道'); }
  else if (a === 'draw' || a === 'pick') { el.disabled=true;if(await act({type:'propose',method:a==='pick'?'pick':'random',...(id?{id}:{})}))openModal('draw');else el.disabled=false; }
  else if (a === 'confirm') { const proposalId=room.proposal?.id;el.disabled=true;if(await act({type:'confirm',proposalId})){closeModal();notify('开饭啦！这一餐已收进我们的食光 ♡');}else el.disabled=false; }
  else if (a === 'reset') openModal('confirm-action',{title:'开始新一轮小心动？',description:'两人的想吃和不想吃标记将清空，收藏、菜单和历史记录都会保留。',label:'开始新一轮',execute:()=>act({type:'reset'})});
  else if (a === 'new-room') openModal('confirm-action',{title:'准备一张新的餐桌？',description:'当前餐桌的数据会保留，但本设备会切换到新房间。请先保存当前邀请码，以便以后回来。',label:'创建新餐桌',execute:async()=>{saveSession(await request('/api/rooms',{clientId}));return true;}});
  else if (a === 'execute-confirm') { el.disabled=true;try{if(await modal.execute())closeModal();}catch(error){notify(error.message);}finally{el.disabled=false;} }
  else if (a === 'profile') openModal('profile');
  else if (a === 'about') openModal('about');
  else if (a === 'close') closeModal();
  else if (a === 'retry') start();
  else if (a === 'retry-poll') startPolling();
});
document.addEventListener('input',event=>{if(event.target.id==='order-note')orderNote=event.target.value;if(event.target.id==='search'){filters.query=event.target.value;render();}});
document.addEventListener('change',event=>{if(event.target.dataset.filter){filters[event.target.dataset.filter]=event.target.value;render();}});
document.addEventListener('error',event=>{if(event.target.tagName==='IMG'){event.target.classList.add('failed');event.target.alt='';}},true);
document.addEventListener('submit',async event=>{
  event.preventDefault();const form=event.target;const input=Object.fromEntries(new FormData(form));const button=form.querySelector('[type="submit"]');if(button.disabled)return;button.disabled=true;
  try {
    if(form.id==='checkout-form'){if(await act({type:'checkout',note:input.note})){orderNote='';page='history';kitchen=false;render();window.scrollTo({top:0,behavior:'smooth'});notify('心动订单已送到小厨房 ♡');}}
    else if(form.id==='dish-form'){const type=modal.type;const id=modal.dish?.id;if(await act({type:type==='edit'?'edit':'add',id,dish:input})){closeModal();notify(type==='edit'?'私房菜已更新':'新美味已加入，两个人都能看到啦');}}
    else if(form.id==='join-form'){const data=await request('/api/join',{code:input.code,clientId});saveSession(data);closeModal();notify('已加入 TA 的餐桌');}
    else if(form.id==='profile-form'){if(await act({type:'rename',person,value:input.name})){closeModal();notify('昵称已更新');}}
  }catch(error){notify(error.message);}finally{button.disabled=false;}
});
document.addEventListener('keydown',event=>{
  if(!modal)return;if(event.key==='Escape')return closeModal();
  if(event.key==='Tab'){const items=[...document.querySelectorAll('.modal button:not(:disabled),.modal input:not([type="hidden"]),.modal select,.modal textarea')];const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
});
window.addEventListener('pagehide',()=>{pollGeneration++;pollController?.abort();});
window.addEventListener('pageshow',e=>{if(e.persisted&&credential)startPolling();});
start();
