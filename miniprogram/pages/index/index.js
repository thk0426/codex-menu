const model = require('../../utils/model');
const presentation = require('../../utils/presentation');
const { apiBase } = require('../../config');
const SESSION = 'together-session-v1';
const CLIENT = 'together-client-v1';
const cleanFilters = () => ({ query: '', category: '全部', kind: '', spice: '', price: '' });
const newDish = () => ({ name:'', desc:'', price:0, spice:0, kind:'荤菜', category:'家常菜', emoji:'🍲' });

Page({
  data: {
    foodTabs:presentation.tabs,uiTab:'all',tabTitle:'🎀 今日推荐',expandedDish:'',kitchenMode:false,orders:[],cartItems:[],cartCount:0,orderCount:0,orderNote:'',
    loading:true, error:'', connected:true, page:'menu', person:'a', role:'a', statusBar:20,
    categories:model.categories, categoryEmoji:['','🥘','🌶️','🥬','🍲','🍙'], filters:cleanFilters(), filterOpen:false,
    navs:[{id:'menu',emoji:'🎀',label:'点菜'},{id:'history',emoji:'🧾',label:'订单'},{id:'cart',emoji:'🛒',label:'已选'},{id:'us',emoji:'💞',label:'我们'}],
    room:null, dishes:[], matched:[], history:[], people:[], modeText:'面对面点菜', count:0, pageTitle:'今天吃什么',
    modal:'', form:newDish(), editingId:'', emojis:['🍜','🍲','🥗','🍝','🥟','🍕','🍗','🍰'],
    spiceOptions:['不辣','微辣','中辣','特辣'], kindOptions:['荤菜','素菜'], dishCategories:model.categories.slice(1),
    spiceFilters:['不限辣度','不辣','微辣','中辣','特辣'], kindFilters:['荤素不限','荤菜','素菜'], priceFilters:['全部 0 元','0 元菜品'],
    filterLabels:['不限辣度','荤素不限','全部 0 元'], filterCount:0, joinCode:'', nickname:'', saving:false, drawing:false,
    turnName:'我', pending:null, ownName:'我', formKindIndex:0, formCategoryIndex:0, emptyTitle:'', emptyDescription:'', emptyEmoji:'🥗'
  },
  onLoad(options) {
    this._visible = true; this._generation = 0; this._busy = new Set(); this._failedImages = new Set();
    this._client = wx.getStorageSync(CLIENT);
    if(!this._client){ this._client=`wx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;wx.setStorageSync(CLIENT,this._client); }
    this._session=wx.getStorageSync(SESSION)||null;
    this.setData({statusBar:wx.getWindowInfo ? wx.getWindowInfo().statusBarHeight : 20});
    this.init(options.room);
  },
  onShow(){this._visible=true;if(this.data.room&&!this._polling)this.poll();},
  onHide(){this._visible=false;this.stopPoll();},
  onUnload(){this._visible=false;this.stopPoll();},
  async onPullDownRefresh(){try{if(this._session){const data=await this.request(`/api/rooms/${this._session.id}`);this.applyRoom(data.room);}else await this.init();}catch(e){this.toast(e.message);}finally{wx.stopPullDownRefresh();}},
  onShareAppMessage(){return{title:'今天想和你吃点好的，来我们的餐桌一起选吧 ♡',path:`/pages/index/index?room=${this.data.room ? this.data.room.code : ''}`,imageUrl:'/assets/share.png'};},
  toast(title){wx.showToast({title,icon:'none',duration:2600});},
  name(person,room=this.data.room){const name=room.people[person];return room.mode==='remote'&&['我','TA'].includes(name)?(person===this._session.person?'我':'TA'):name;},
  request(endpoint,payload,track){return new Promise((resolve,reject)=>{
    const task=wx.request({url:`${apiBase.replace(/\/$/,'')}${endpoint}`,method:payload===undefined?'GET':'POST',data:payload,timeout:30000,header:{'content-type':'application/json',...(this._session?{Authorization:`Bearer ${this._session.token}`}:{})},
      success:res=>{if(res.statusCode>=200&&res.statusCode<300)resolve(res.data);else reject(Object.assign(new Error(res.data.error||'请求失败'),{status:res.statusCode}));},
      fail:err=>reject(Object.assign(new Error('连接失败，请检查网络和服务状态'),{aborted:err.errMsg&&err.errMsg.includes('abort')}))});
    if(track)this._pollTask=task;
  });},
  async init(code){
    this.setData({loading:true,error:''});
    try{
      if(code){try{this.saveSession(await this.request('/api/join',{code,clientId:this._client}));this.toast('已加入我们的餐桌');return;}catch(e){this.toast(e.message);}}
      if(this._session){try{const data=await this.request(`/api/rooms/${this._session.id}`);this.setData({person:this._session.person,role:this._session.person});this.applyRoom(data.room);this.poll();return;}catch(e){if(![401,404].includes(e.status))throw e;this._session=null;wx.removeStorageSync(SESSION);}}
      this.saveSession(await this.request('/api/rooms',{clientId:this._client}));
    }catch(e){this.setData({loading:false,error:e.message});}
  },
  retry(){this.init();},
  saveSession(data){this.stopPoll();this._session={id:data.room.id,token:data.token,person:data.person};wx.setStorageSync(SESSION,this._session);this.setData({room:null,person:data.person,role:data.person});this.applyRoom(data.room);this.poll();},
  applyRoom(room){
    if(this._session&&room.id!==this._session.id)return;
    if(this.data.room&&room.id===this.data.room.id&&room.version<this.data.room.version)return;
    const person=room.mode==='remote'?this._session.person:this.data.person;
    const patch={room,person,role:this._session.person,connected:true,loading:false,error:'',ownName:this.name(person,room),turnName:this.name(room.turn,room),pending:room.proposal?{...room.proposal,spiceLabel:this.data.spiceOptions[room.proposal.dish.spice]}:null};
    if(this.data.modal==='draw'&&!room.proposal)patch.modal='';
    this.setData(patch);this.refresh();
  },
  refresh(){
    const {room,page,person,filters}=this.data;if(!room)return;
    let dishes=model.decorate(room,person,{...(page==='manage'?{}:filters),favorites:page==='favorites'});
    if(page==='manage')dishes=dishes.filter(d=>d.custom);
    else dishes=dishes.filter(d=>presentation.inTab(d,this.data.uiTab));
    const priority=['d13','d21','d22'];if(this.data.uiTab==='all'&&!filters.query)dishes.sort((a,b)=>(priority.includes(a.id)?priority.indexOf(a.id):99)-(priority.includes(b.id)?priority.indexOf(b.id):99));
    dishes=dishes.map(d=>({...presentation.food(d,room.cart),displayName:d.id==='d13'?'番茄抱抱蛋':d.id==='d21'?'可乐小鸡翅':d.name,displayDescription:d.id==='d13'?'酸甜番茄裹着嫩嫩鸡蛋，拌饭第一名':d.desc,image:this._failedImages.has(d.id)?'':d.image,partnerName:this.name(person==='a'?'b':'a')}));
    const matched=model.matches(room).map(d=>({...d,image:this._failedImages.has(d.id)?'':d.image}));
    const people=['a','b'].map(p=>({id:p,name:this.name(p),avatar:p==='a'?'👩🏻':'👨🏻',count:Object.values(room.votes[p]).filter(v=>v==='yes').length,active:p===person}));
    const history=room.history.map(h=>{const d=new Date(h.confirmedAt);return{...h,date:`${d.getMonth()+1}月${d.getDate()}日 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`,methodLabel:h.method==='turn'?'轮流决定':h.method==='pick'?'我们的选择':'交给一点缘分'};});
    const other=this._session.person==='a'?'b':'a';
    const modeText=!this.data.connected?'正在重连':room.mode==='together'?'面对面点菜':room.online[other]?'双方已在线':room.joined?'等待对方上线':'等待另一位';
    let emptyTitle='这一口心动，还没找到',emptyDescription='试试换个关键词，或放宽一点口味筛选。',emptyEmoji='🥗';
    if(page==='favorites'&&!room.favorites[person].length){emptyTitle='留住每一次心动的味道';emptyDescription='轻点菜品右上角的爱心，把常点的美味收进这里。';emptyEmoji='🤍';}
    if(page==='manage'){emptyTitle='我们的小菜单，还差你的拿手菜';emptyDescription='给它起个名字，下一餐就多一个心动选项。';emptyEmoji='👩🏻‍🍳';}
    if(page==='history'){emptyTitle='把一起吃饭的日子，收藏起来';emptyDescription='确认今天吃什么后，第一段食光就会出现在这里。';emptyEmoji='🍽️';}
    const count=page==='favorites'?room.favorites[person].length:page==='manage'?room.dishes.filter(d=>d.custom).length:page==='history'?history.length:room.dishes.length;
    this.setData({dishes,matched,people,history,modeText,count,pageTitle:({menu:'今天的菜单',history:'心动订单',cart:'已选的小心动',us:'我们的心动日常',favorites:'心动收藏',manage:'私房菜单'})[page],orders:presentation.orders(room),cartItems:presentation.cartItems(room).map(d=>({...d,conflict:room.votes.a[d.id]==='no'||room.votes.b[d.id]==='no'})),cartCount:Object.values(room.cart||{}).reduce((n,q)=>n+q,0),orderCount:(room.orders||[]).filter(o=>o.status<3).length,tabTitle:presentation.tabs.find(t=>t.id===this.data.uiTab).icon+' '+presentation.tabs.find(t=>t.id===this.data.uiTab).label,emptyTitle,emptyDescription,emptyEmoji,filterCount:[filters.spice,filters.kind,filters.price].filter(v=>v!=='').length});
  },
  stopPoll(){this._generation++;this._polling=false;if(this._pollTask){this._pollTask.abort();this._pollTask=null;}clearTimeout(this._retryTimer);},
  async poll(){
    if(!this._visible||!this._session||this._polling)return;
    const generation=++this._generation;this._polling=true;
    while(this._visible&&generation===this._generation){
      try{const data=await this.request(`/api/rooms/${this._session.id}?wait=1&since=${this.data.room.version}`,undefined,true);if(generation!==this._generation)return;this.applyRoom(data.room);}
      catch(e){if(generation!==this._generation||e.aborted)return;this.setData({connected:false});this.refresh();this._polling=false;if([401,404].includes(e.status)){this.setData({error:'房间凭证已失效，请重新连接'});return;}this._retryTimer=setTimeout(()=>this.poll(),2500);return;}
    }
    this._polling=false;
  },
  async act(input){
    const key=`${input.type}:${input.person||this.data.person}:${input.id||''}`;if(this._busy.has(key))return false;this._busy.add(key);
    try{const data=await this.request(`/api/rooms/${this._session.id}/actions`,input);this.applyRoom(data.room);return true;}catch(e){this.toast(e.message);return false;}finally{this._busy.delete(key);}
  },
  switchPage(e){const page=e.currentTarget.dataset.page;this.setData({page,uiTab:'all',expandedDish:'',kitchenMode:false,filters:cleanFilters(),filterOpen:false,filterLabels:['不限辣度','荤素不限','全部 0 元']});this.refresh();wx.pageScrollTo({scrollTop:0,duration:200});},
  switchPerson(e){const person=e.currentTarget.dataset.person;if(this.data.room.mode==='remote'&&person!==this._session.person)return this.toast('远程时各自选菜，结果自动同步');this.setData({person,ownName:this.data.room.people[person]});this.refresh();this.toast(`现在轮到${this.data.room.people[person]}选菜啦`);},
  vote(e){const {id,value}=e.currentTarget.dataset;const {room,person}=this.data;return this.act({type:'vote',id,person,value:room.votes[person][id]===value?'':value});},
  async favorite(e){const id=e.currentTarget.dataset.id;const {room,person}=this.data;const value=!room.favorites[person].includes(id);if(await this.act({type:'favorite',id,person,value}))this.toast(value?'已收进心动收藏 ♡':'已取消收藏');},
  search(e){this.setData({'filters.query':e.detail.value});this.refresh();},
  category(e){this.setData({'filters.category':e.currentTarget.dataset.category});this.refresh();},
  foodTab(e){this.setData({uiTab:e.currentTarget.dataset.tab});this.refresh();},
  detail(e){const id=e.currentTarget.dataset.id;this.setData({expandedDish:this.data.expandedDish===id?'':id});},
  kitchen(){this.setData({kitchenMode:!this.data.kitchenMode,page:'history'});this.refresh();wx.pageScrollTo({scrollTop:0,duration:200});},
  async cartChange(e){const {id,delta}=e.currentTarget.dataset;if(await this.act({type:'cart',id,delta:Number(delta),person:this.data.person})&&Number(delta)>0)this.toast('已加入小餐篮 ♡');},
  noteInput(e){this.setData({orderNote:e.detail.value});},
  async checkout(){if(this.data.saving)return;this.setData({saving:true});try{if(await this.act({type:'checkout',note:this.data.orderNote})){this.setData({orderNote:'',page:'history',kitchenMode:false});this.refresh();wx.pageScrollTo({scrollTop:0,duration:200});this.toast('心动订单已送到小厨房 ♡');}}finally{this.setData({saving:false});}},
  async orderStatus(e){if(await this.act({type:'order-status',id:e.currentTarget.dataset.id,status:Number(e.currentTarget.dataset.status)}))this.toast('制作进度已同步给另一半');},
  deleteOrder(e){
    const id=e.currentTarget.dataset.id;
    const order=this.data.orders.find(o=>o.id===id);
    if(!order)return this.toast('这份订单已被删除');
    wx.showModal({title:`删除心动单号 ${order.number}？`,content:'删除后会从两人的订单记录中移除，无法恢复。',confirmText:'删除订单',confirmColor:'#e4528b',success:async res=>{if(res.confirm&&await this.act({type:'order-delete',id}))this.toast('订单已删除，另一端会同步更新');}});
  },
  toggleFilter(){this.setData({filterOpen:!this.data.filterOpen});},
  filterChange(e){const type=e.currentTarget.dataset.type;const index=Number(e.detail.value);const values={spice:['','0','1','2','3'],kind:['','荤菜','素菜'],price:['','low']};const labelIndex={spice:0,kind:1,price:2};const labels={spice:this.data.spiceFilters,kind:this.data.kindFilters,price:this.data.priceFilters};this.setData({[`filters.${type}`]:values[type][index],[`filterLabels[${labelIndex[type]}]`]:labels[type][index]});this.refresh();},
  clearFilters(){this.setData({uiTab:'all',filters:cleanFilters(),filterLabels:['不限辣度','荤素不限','全部 0 元']});this.refresh();},
  imageError(e){this._failedImages.add(e.currentTarget.dataset.id);this.refresh();},
  add(){this.setData({modal:'dish',editingId:'',form:newDish(),formKindIndex:0,formCategoryIndex:0});},
  edit(e){const dish=this.data.room.dishes.find(d=>d.id===e.currentTarget.dataset.id);this.setData({modal:'dish',editingId:dish.id,form:{...dish},formKindIndex:this.data.kindOptions.indexOf(dish.kind),formCategoryIndex:this.data.dishCategories.indexOf(dish.category)});},
  formInput(e){this.setData({[`form.${e.currentTarget.dataset.field}`]:e.detail.value});},
  formSelect(e){const field=e.currentTarget.dataset.field;const i=Number(e.detail.value);const lists={kind:this.data.kindOptions,category:this.data.dishCategories};const patch={[`form.${field}`]:field==='spice'?i:lists[field][i]};if(field==='kind')patch.formKindIndex=i;if(field==='category')patch.formCategoryIndex=i;this.setData(patch);},
  emoji(e){this.setData({'form.emoji':e.currentTarget.dataset.emoji});},
  async saveDish(){if(this.data.saving)return;this.setData({saving:true});try{if(await this.act({type:this.data.editingId?'edit':'add',id:this.data.editingId||undefined,dish:this.data.form})){this.close();this.toast('私房菜已保存，两个人都能看到啦');}}finally{this.setData({saving:false});}},
  remove(e){const id=e.currentTarget.dataset.id;wx.showModal({title:'移除这道私房菜？',content:'对应的想吃与收藏也会移除，已经记录的食光会保留。',confirmText:'确认移除',confirmColor:'#f35495',success:res=>{if(res.confirm)this.act({type:'delete',id});}});},
  async invite(){if(this.data.room.mode!=='remote'&&this._session.person==='a'){if(!await this.act({type:'mode',value:'remote'}))return;}this.setData({modal:'invite',joinCode:''});},
  copyCode(){wx.setClipboardData({data:this.data.room.code});},
  joinInput(e){this.setData({joinCode:e.detail.value.toUpperCase()});},
  async join(){if(this.data.saving)return;if(!/^[A-F0-9]{8}$/.test(this.data.joinCode.trim()))return this.toast('请填写正确的 8 位邀请码');this.setData({saving:true});try{const data=await this.request('/api/join',{code:this.data.joinCode,clientId:this._client});this.saveSession(data);this.close();this.toast('已加入 TA 的餐桌');}catch(e){this.toast(e.message);}finally{this.setData({saving:false});}},
  async together(){if(await this.act({type:'mode',value:'together'})){this.close();this.toast('点头像即可面对面轮流选菜');}},
  async turn(){const value=this.data.room.decisionMode==='turn'?'random':'turn';if(await this.act({type:'decisionMode',value}))this.toast(value==='turn'?`这次听${this.data.turnName}的，下次交换`:'让缘分帮我们选一道');},
  async draw(){if(this.data.drawing)return;this.setData({drawing:true});try{if(await this.act({type:'propose',method:'random'}))this.setData({modal:'draw'});}finally{this.setData({drawing:false});}},
  async pick(e){if(await this.act({type:'propose',method:'pick',id:e.currentTarget.dataset.id}))this.setData({modal:'draw'});},
  async confirm(){if(this.data.saving||!this.data.pending)return;this.setData({saving:true});try{if(await this.act({type:'confirm',proposalId:this.data.pending.id})){this.close();this.toast('开饭啦！这一餐已收进我们的食光 ♡');}}finally{this.setData({saving:false});}},
  reset(){wx.showModal({title:'开始新一轮点菜？',content:'两人的选择将清空，收藏、私房菜和历史都会保留。',confirmColor:'#d37d54',success:res=>{if(res.confirm)this.act({type:'reset'});}});},
  profile(){this.setData({modal:'profile',nickname:this.data.room.people[this.data.person]});},
  nicknameInput(e){this.setData({nickname:e.detail.value});},
  async saveName(){if(await this.act({type:'rename',person:this.data.person,value:this.data.nickname})){this.close();this.toast('昵称已更新');}},
  newRoom(){wx.showModal({title:'准备一张新的餐桌？',content:'旧餐桌会保留。请先保存当前邀请码，便于以后回来。',confirmText:'创建',confirmColor:'#d37d54',success:async res=>{if(res.confirm){try{this.saveSession(await this.request('/api/rooms',{clientId:this._client}));this.close();}catch(e){this.toast(e.message);}}}});},
  about(){this.setData({modal:'about'});},
  close(){this.setData({modal:''});},
  noop(){},
  emptyAction(){if(this.data.page==='manage')return this.add();if(this.data.page==='history'||this.data.page==='favorites'){this.setData({page:'menu'});}this.clearFilters();}
});
