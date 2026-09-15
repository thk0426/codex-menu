const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const path=require('node:path');
const fs=require('node:fs');
const {createRequire}=require('node:module');
const compiler=require('miniprogram-compiler');
const {dishes}=require('../miniprogram/utils/model');
const root=path.resolve(__dirname,'../miniprogram');
const ctx=vm.createContext({window:{},console});
const make=vm.runInContext(`(function(global){${compiler.wxmlToJs(root)}})({})`,ctx);
const generate=make('pages/index/index.wxml');
const nodes=tree=>typeof tree==='object'&&tree?[tree,...(tree.children||[]).flatMap(nodes)]:[];
const cssNodes=(tree,cls)=>nodes(tree).filter(n=>String(n.attr?.class||'').split(' ').includes(cls));
function ready(){let p;const file=path.join(root,'pages/index/index.js');vm.runInNewContext(fs.readFileSync(file,'utf8'),{Page:v=>{p=v;},wx:{},require:createRequire(file),Set,setTimeout,clearTimeout,console});p.data=JSON.parse(JSON.stringify(p.data));p._session={id:'compile-fixture',person:'a'};p._failedImages=new Set();p.setData=function(data){Object.assign(this.data,data);};p.applyRoom({id:'compile-fixture',version:1,mode:'together',decisionMode:'random',turn:'a',people:{a:'我',b:'TA'},online:{a:true,b:false},dishes,votes:{a:{d1:'yes'},b:{d1:'yes'}},favorites:{a:[],b:[]},history:[],proposal:null});return p;}
test('官方编译器可编译全部 WXML 与 WXSS',()=>{const css=compiler.wxssToJs(root);assert.ok(css.length>1000);assert.equal(typeof generate,'function');});
test('编译后的原生页面正确切换加载、菜单与各弹层',()=>{const loading=generate({loading:true,statusBar:24});assert.equal(cssNodes(loading,'loading-state').length,1);assert.equal(cssNodes(loading,'heart-dish').length,0);const p=ready();let tree=generate(p.data);assert.equal(cssNodes(tree,'heart-dish').length,dishes.length);assert.equal(cssNodes(tree,'matched').length,1);assert.equal(cssNodes(tree,'loading-state').length,0);assert.equal(cssNodes(tree,'sheet-mask').length,0);for(const modal of ['invite','dish','profile','about']){p.setData({modal});tree=generate(p.data);assert.equal(cssNodes(tree,'sheet-mask').length,1);assert.equal(cssNodes(tree,'sheet-body').length,1);}p.setData({modal:'',page:'favorites'});p.refresh();tree=generate(p.data);assert.equal(cssNodes(tree,'heart-dish').length,0);assert.equal(cssNodes(tree,'empty').length,1);});
