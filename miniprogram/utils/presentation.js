(function (root) {
  const tabs = [
    { id: 'all', icon: '🎀', label: '今日推荐' },
    { id: 'meat', icon: '🍗', label: '肉肉满足' },
    { id: 'seafood', icon: '🦐', label: '鲜鲜海味' },
    { id: 'veg', icon: '🥬', label: '清新时蔬' },
    { id: 'soup', icon: '🥣', label: '暖心汤羹' },
    { id: 'staple', icon: '🍚', label: '主食小吃' }
  ];
  const minutes = { d13:12,d14:18,d15:60,d16:25,d17:25,d18:20,d19:25,d20:30,d21:30,d22:90,d23:15,d24:25,d25:10,d26:12,d27:15,d28:8,d29:10,d30:60,d31:20,d32:12,d1:20,d2:25,d3:20,d4:10,d5:18,d6:20,d7:30,d8:25,d9:40,d10:20,d11:30,d12:35 };
  const statuses = ['已接单', '准备中', '制作中', '可以开饭'];
  function inTab(dish, tab) {
    const seafood = /虾|鱼|海鲜|蟹|贝/.test(dish.name) && !/鱼香/.test(dish.name);
    return !tab || tab === 'all' || (tab === 'meat' && dish.kind === '荤菜' && !seafood) || (tab === 'seafood' && seafood) || (tab === 'veg' && dish.kind === '素菜' && !['暖心汤羹','主食小吃'].includes(dish.category)) || (tab === 'soup' && dish.category === '暖心汤羹') || (tab === 'staple' && dish.category === '主食小吃');
  }
  function food(dish, cart = {}) {
    const time = minutes[dish.id] || 20;
    return { ...dish, minutes: time, hearts: time <= 15 ? '♥♥' : time < 35 ? '♥♥♥' : '♥♥♥♥', quantity: cart[dish.id] || 0 };
  }
  function cartItems(room) { return room.dishes.filter(d => room.cart && room.cart[d.id] > 0).map(d => food(d, room.cart)); }
  function orders(room) {
    const active = room.orders || [];
    const legacy = (room.history || []).filter(h => !active.some(o => o.id === h.id)).map(h => ({ id:h.id,number:h.id.slice(-6).toUpperCase(),createdAt:h.confirmedAt,status:3,note:'我们的共同选择',items:[{dish:h.dish,quantity:1}] }));
    return [...active, ...legacy].sort((a,b)=>b.createdAt-a.createdAt).map(o => {
      const date = new Date(o.createdAt);
      return { ...o, items:o.items.map(i=>({...i,id:i.dish.id})), number:o.number || o.id.slice(-6).toUpperCase(), statusLabel:statuses[o.status], quantity:o.items.reduce((n,i)=>n+i.quantity,0), date:`${date.getMonth()+1}/${date.getDate()} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`, steps:statuses.map((label,index)=>({label,index,done:index<=o.status,line:index<o.status})), nextStatus:o.status+1, nextLabel:statuses[o.status+1] || '' };
    });
  }
  const api = { tabs, statuses, inTab, food, cartItems, orders };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MenuPresentation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
