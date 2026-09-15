(function (root) {
  const categories = ['全部', '家常菜', '热辣过瘾', '清爽轻食', '暖心汤羹', '主食小吃'];
  const commonChineseDishes = [
    { id: 'd13', name: '番茄炒鸡蛋', desc: '酸甜番茄遇上嫩鸡蛋，最熟悉的家的味道', price: 0, spice: 0, kind: '素菜', category: '家常菜', emoji: '🍅', image: '', tags: ['经典家常', '番茄炒蛋'] },
    { id: 'd14', name: '辣椒炒肉', desc: '青椒鲜辣、肉片香嫩，再来一碗米饭', price: 0, spice: 2, kind: '荤菜', category: '热辣过瘾', emoji: '🌶️', image: '', tags: ['下饭神器', '湘味家常'] },
    { id: 'd15', name: '红烧肉', desc: '小火慢炖，软糯的肉香里都是幸福', price: 0, spice: 0, kind: '荤菜', category: '家常菜', emoji: '🥩', image: '', tags: ['软糯入味', '家的味道'] },
    { id: 'd16', name: '宫保鸡丁', desc: '嫩鸡丁配酥脆花生，酸甜微辣刚刚好', price: 0, spice: 1, kind: '荤菜', category: '家常菜', emoji: '🍗', image: '', tags: ['经典川味', '超下饭'] },
    { id: 'd17', name: '鱼香肉丝', desc: '肉丝与时蔬裹满鱼香汁，一口就开胃', price: 0, spice: 1, kind: '荤菜', category: '家常菜', emoji: '🥢', image: '', tags: ['酸甜鲜香', '经典家常'] },
    { id: 'd18', name: '麻婆豆腐', desc: '嫩豆腐与肉末咕嘟入味，麻辣鲜香', price: 0, spice: 2, kind: '荤菜', category: '热辣过瘾', emoji: '🥘', image: '', tags: ['麻辣鲜香', '肉末豆腐'] },
    { id: 'd19', name: '回锅肉', desc: '煸香的肉片搭配青椒蒜苗，越吃越香', price: 0, spice: 2, kind: '荤菜', category: '热辣过瘾', emoji: '🥓', image: '', tags: ['经典川味', '香辣下饭'] },
    { id: 'd20', name: '糖醋里脊', desc: '酥嫩里脊裹上酸甜酱汁，是快乐的味道', price: 0, spice: 0, kind: '荤菜', category: '家常菜', emoji: '🍖', image: '', tags: ['酸甜开胃', '外酥里嫩'] },
    { id: 'd21', name: '可乐鸡翅', desc: '浓浓酱汁收进鸡翅里，连手指都想舔', price: 0, spice: 0, kind: '荤菜', category: '家常菜', emoji: '🍗', image: '', tags: ['咸甜入味', '人气家常'] },
    { id: 'd22', name: '土豆炖牛腩', desc: '软烂牛腩配绵软土豆，慢炖一锅温暖', price: 0, spice: 0, kind: '荤菜', category: '家常菜', emoji: '🥔', image: '', tags: ['暖心炖菜', '软烂入味'] },
    { id: 'd23', name: '酸辣土豆丝', desc: '清脆爽口的土豆丝，简单也能很下饭', price: 0, spice: 1, kind: '素菜', category: '家常菜', emoji: '🥔', image: '', tags: ['酸辣开胃', '清脆爽口'] },
    { id: 'd24', name: '地三鲜', desc: '茄子、土豆和青椒，凑成一盘家常鲜', price: 0, spice: 0, kind: '素菜', category: '家常菜', emoji: '🍆', image: '', tags: ['东北家常', '鲜香下饭'] },
    { id: 'd25', name: '手撕包菜', desc: '大火快炒的脆嫩包菜，香辣又开胃', price: 0, spice: 1, kind: '素菜', category: '家常菜', emoji: '🥬', image: '', tags: ['清脆爽口', '经典家常'] },
    { id: 'd26', name: '蒜蓉西兰花', desc: '翠绿西兰花添一点蒜香，清爽又好吃', price: 0, spice: 0, kind: '素菜', category: '清爽轻食', emoji: '🥦', image: '', tags: ['清淡家常', '新鲜时蔬'] },
    { id: 'd27', name: '香菇青菜', desc: '鲜香菌菇配嫩绿青菜，给餐桌添一抹绿', price: 0, spice: 0, kind: '素菜', category: '清爽轻食', emoji: '🍄', image: '', tags: ['菌菇鲜香', '清淡家常'] },
    { id: 'd28', name: '凉拌黄瓜', desc: '拍一拍、拌一拌，酸香爽脆的小凉菜', price: 0, spice: 1, kind: '素菜', category: '清爽轻食', emoji: '🥒', image: '', tags: ['开胃凉菜', '拍黄瓜'] },
    { id: 'd29', name: '紫菜蛋花汤', desc: '轻盈蛋花与鲜香紫菜，饭前暖暖胃', price: 0, spice: 0, kind: '素菜', category: '暖心汤羹', emoji: '🥣', image: '', tags: ['鲜美清淡', '家常快手'] },
    { id: 'd30', name: '冬瓜排骨汤', desc: '排骨慢炖出鲜味，冬瓜清甜又暖心', price: 0, spice: 0, kind: '荤菜', category: '暖心汤羹', emoji: '🍲', image: '', tags: ['清甜鲜美', '暖心煲汤'] },
    { id: 'd31', name: '清蒸鲈鱼', desc: '葱姜衬出鱼肉的鲜嫩，好好吃一顿饭', price: 0, spice: 0, kind: '荤菜', category: '家常菜', emoji: '🐟', image: '', tags: ['清蒸鲜嫩', '经典中餐'] },
    { id: 'd32', name: '蛋炒饭', desc: '米饭裹上金黄蛋香，一碗简单的小满足', price: 0, spice: 0, kind: '素菜', category: '主食小吃', emoji: '🍚', image: '', tags: ['粒粒分明', '家常主食'] }
  ];
  const dishes = [
    ...commonChineseDishes,
    { id: 'd1', name: '田园藜麦能量碗', desc: '新鲜时蔬，把好心情装进碗里', price: 0, spice: 0, kind: '素菜', category: '清爽轻食', emoji: '🥗', image: '', tags: ['元气满满', '新鲜时蔬'] },
    { id: 'd2', name: '香橙鸡丁', desc: '酸甜橙香裹住鸡丁，一口就心动', price: 0, spice: 1, kind: '荤菜', category: '家常菜', emoji: '🍗', image: '', tags: ['酸甜开胃', '超下饭'] },
    { id: 'd3', name: '黑椒牛肉炒面', desc: '浓郁黑椒与嫩牛肉，热乎乎的小满足', price: 0, spice: 2, kind: '荤菜', category: '热辣过瘾', emoji: '🍜', image: '', tags: ['两人分享', '热气腾腾'] },
    { id: 'd4', name: '牛油果鲜蔬沙拉', desc: '给忙碌的一天，来一点清新', price: 0, spice: 0, kind: '素菜', category: '清爽轻食', emoji: '🥑', image: '', tags: ['轻盈无负担', '新鲜时蔬'] },
    { id: 'd5', name: '鲜虾黄金炒饭', desc: '一碗粒粒分明，幸福感刚刚好', price: 0, spice: 0, kind: '荤菜', category: '家常菜', emoji: '🍱', image: '', tags: ['一碗满足', '人气之选'] },
    { id: 'd6', name: '青酱蘑菇意面', desc: '清新罗勒与鲜香蘑菇，约会的小浪漫', price: 0, spice: 0, kind: '素菜', category: '主食小吃', emoji: '🍝', image: '', tags: ['约会必备', '鲜香浓郁'] },
    { id: 'd7', name: '香浓南瓜汤', desc: '把柔软和温暖，都盛进碗里', price: 0, spice: 0, kind: '素菜', category: '暖心汤羹', emoji: '🎃', image: '', tags: ['暖胃暖心', '细腻香甜'] },
    { id: 'd8', name: '韩式石锅拌饭', desc: '热辣酱汁和多彩配菜，越拌越喜欢', price: 0, spice: 2, kind: '素菜', category: '热辣过瘾', emoji: '🌶️', image: '', tags: ['热辣过瘾', '韩式风味'] },
    { id: 'd9', name: '手作小笼包', desc: '轻咬一口，包住热乎乎的小幸福', price: 0, spice: 0, kind: '荤菜', category: '主食小吃', emoji: '🥟', image: '', tags: ['鲜香多汁', '手作温度'] },
    { id: 'd10', name: '香煎三文鱼', desc: '慢慢煎，认真吃，和你一起', price: 0, spice: 0, kind: '荤菜', category: '清爽轻食', emoji: '🐟', image: '', tags: ['优质蛋白', '仪式感'] },
    { id: 'd11', name: '番茄蔬菜浓汤', desc: '一碗酸甜鲜香，治愈今天的疲惫', price: 0, spice: 0, kind: '素菜', category: '暖心汤羹', emoji: '🍅', image: '', tags: ['清淡鲜美', '暖心之选'] },
    { id: 'd12', name: '双人分享披萨', desc: '你一半，我一半，美味不止一倍', price: 0, spice: 0, kind: '荤菜', category: '主食小吃', emoji: '🍕', image: '', tags: ['快乐加倍', '芝士爱好者'] }
  ];
  dishes.forEach(d => { d.image = `/assets/food/${d.id}-v2.jpg`; });
  const imageSources = dishes.map(d => ({id:d.id,name:d.name,url:d.image}));
  function decorate(room, person, filters = {}) {
    return room.dishes.map(d => ({ ...d, vote: room.votes[person][d.id] || '', partnerVote: room.votes[person === 'a' ? 'b' : 'a'][d.id] || '', matched: room.votes.a[d.id] === 'yes' && room.votes.b[d.id] === 'yes', favorite: (room.favorites[person] || []).includes(d.id), spiceLabel: ['不辣', '微辣', '中辣', '特辣'][d.spice], priceLabel: `¥${d.price}` }))
      .filter(d => (!filters.category || filters.category === '全部' || d.category === filters.category) && (!filters.query || `${d.name} ${d.desc} ${d.tags.join(' ')}`.includes(filters.query.trim())) && (!filters.kind || d.kind === filters.kind) && (filters.spice === '' || filters.spice == null || d.spice === Number(filters.spice)) && (!filters.price || (filters.price === 'low' ? d.price <= 25 : filters.price === 'mid' ? d.price > 25 && d.price <= 50 : d.price > 50)) && (!filters.favorites || d.favorite));
  }
  function matches(room) { return room.dishes.filter(d => room.votes.a[d.id] === 'yes' && room.votes.b[d.id] === 'yes'); }
  function candidates(room, person) {
    const allowed = room.dishes.filter(d => room.votes.a[d.id] !== 'no' && room.votes.b[d.id] !== 'no');
    const common = allowed.filter(d => room.votes.a[d.id] === 'yes' && room.votes.b[d.id] === 'yes');
    const liked = allowed.filter(d => person ? room.votes[person][d.id] === 'yes' : room.votes.a[d.id] === 'yes' || room.votes.b[d.id] === 'yes');
    return common.length ? common : liked.length ? liked : allowed;
  }
  const model = { categories, dishes, decorate, matches, candidates, imageSources, commonChineseDishes };
  if (typeof module !== 'undefined' && module.exports) module.exports = model;
  else root.MenuModel = model;
})(typeof globalThis !== 'undefined' ? globalThis : this);
