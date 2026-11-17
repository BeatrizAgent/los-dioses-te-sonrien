import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const healing=readFileSync(new URL('../src/bot/20-healing.js',import.meta.url),'utf8');
const market=readFileSync(new URL('../src/bot/30-guild-market.js',import.meta.url),'utf8');
function foodFixture(){
 const body=healing.slice(healing.indexOf('  function packageFoodTick()'),healing.indexOf('  function skipHealing('));
 let page=1,visits=0,moves=0,skipped='';const state={packageFoodTrip:true,packageScan:{key:'1:7',at:Date.now()-6000}},bag={classList:{contains:()=>true},getAttribute:()=>null},inv={querySelectorAll:()=>[]};
 const item={getAttribute:k=>({'data-hash':'food2','data-measurement-x':'1','data-measurement-y':'1'}[k]??null),hasAttribute:()=>true,dispatchEvent:()=>moves++};
 const packages={querySelectorAll:()=>page===2?[item]:[]};const loc={origin:'https://s1-es.gladiatus.gameforge.com',href:'https://s1-es.gladiatus.gameforge.com/game/index.php?mod=packages&f=7',assign:()=>visits++};
 const context={state,mod:'packages',params:new URLSearchParams('mod=packages&f=7'),location:loc,URL,Date,Number,Object,Array,window:{},MouseEvent:class{},document:{querySelector:s=>({'#inv':inv,'#packages':packages,'#inventory_nav a':bag,'.paging_right_step':page===1?{}:null}[s]||null)},visible:x=>!!x,validItemHash:x=>!!x,healingFood:e=>({item:e,name:'Pan'}),packageUsable:()=>null,inventorySpace:()=>true,skipHealing:m=>{skipped=m;},save(){},log(){},BUILD_CONFIG:{modules:{foodMarket:false}}};
 vm.createContext(context);vm.runInContext(body,context);return {context,state,setPage(n){page=n;context.params=new URLSearchParams('mod=packages&f=7&page='+n);loc.href='https://s1-es.gladiatus.gameforge.com/game/index.php?mod=packages&f=7&page='+n;},get visits(){return visits},get moves(){return moves},get skipped(){return skipped}};
}
test('comida en segunda página: espera carga, recoge una vez y verifica traslado',()=>{
 const x=foodFixture();assert.equal(x.context.packageFoodTick(),true);assert.equal(x.visits,1);assert.equal(x.moves,0);
 x.context.packageFoodTick();assert.equal(x.visits,1);x.setPage(2);x.context.packageFoodTick();x.state.packageScan.at=Date.now()-6000;x.context.packageFoodTick();assert.equal(x.moves,1);assert.equal(x.state.pendingPackageFood.hash,'food2');
 x.context.packageFoodTick();assert.equal(x.moves,1);
});
test('página repetida de comida se aplaza sin recoger',()=>{
 const x=foodFixture();x.state.packageScan={key:'2:7',at:Date.now()-6000,pages:[1],fingerprints:{1:'food2'}};x.setPage(2);x.context.packageFoodTick();assert.match(x.skipped,/repetida/);assert.equal(x.moves,0);
});
function repairFixture(){
 const code=market.slice(0,market.indexOf('  function goldItem('))+market.slice(market.indexOf('  // Reparación del personaje:'));
 let page=1,visits=0,moves=0,itemPage=2;const item={name:'Botas',hash:'new',basis:'8-4',quality:'2',level:'104',owner:'Cassius',width:2,height:2,refinement:100};
 const el={getAttribute:k=>k==='data-hash'?'new':null,hasAttribute:()=>true,closest:()=>({textContent:'Banco de trabajo'}),dispatchEvent:()=>moves++};item.el=el;
 const tx={stage:'find',at:Date.now(),loadedAt:Date.now()-6000,item:{...item,hash:'old'},packageFilter:{type:'0',query:'Botas',optimized:false},scan:{pages:[],matches:[],fingerprints:{}}};const state={repairTx:tx};
 const bag={classList:{contains:()=>true}},inv={querySelectorAll:()=>[]},packages={querySelectorAll:()=>page===itemPage?[el]:[]};
 const loc={origin:'https://s1-es.gladiatus.gameforge.com',href:'https://s1-es.gladiatus.gameforge.com/game/index.php?mod=packages&f=0&fq=-1&qry=Botas',assign:()=>visits++};
 const c={state,BUILD_CONFIG:{modules:{repair:true}},Date,Number,String,URL,Object,Array,JSON,params:new URLSearchParams('mod=packages&f=0&fq=-1&qry=Botas'),mod:'packages',sub:'',location:loc,window:{},MouseEvent:class{},document:{querySelector:s=>s.includes('data-bag-number')?bag:s==='#inv'?inv:s==='#packages'?packages:s==='.paging_right_step'&&page===1?{}:null},visible:x=>!!x,validItemHash:x=>!!x,save(){},log(){},selectMainGladiator:()=> 'ready',mainGladiatorSelected:()=>true};
 vm.createContext(c);vm.runInContext(code,c);c.repairItem=e=>e===el?item:null;return {c,state,tx,setItemPage(n){itemPage=n;},setPage(n){page=n;c.params=new URLSearchParams('mod=packages&f=0&fq=-1&qry=Botas&page='+n);loc.href='https://s1-es.gladiatus.gameforge.com/game/index.php?mod=packages&f=0&fq=-1&qry=Botas&page='+n;},get visits(){return visits},get moves(){return moves}};
}
test('pieza reparada en página dos se recoge solo tras revisar ambas páginas',()=>{
 const x=repairFixture();assert.equal(x.c.repairTick(),true);assert.equal(x.visits,1);assert.equal(x.moves,0);x.tx.loadedAt=Date.now()-6000;x.c.repairTick();assert.equal(x.visits,1);
 x.setPage(2);x.tx.loadedAt=Date.now()-6000;x.c.repairTick();assert.equal(x.moves,1);assert.equal(x.tx.stage,'collect');x.c.repairTick();assert.equal(x.moves,1);
});
test('página repetida en reparación se bloquea sin trasladar pieza',()=>{
 const x=repairFixture();x.setPage(2);x.tx.scan={pages:[1],matches:[],fingerprints:{1:'new'}};x.c.repairTick();assert.equal(x.state.repairTx.blocked,true);assert.equal(x.moves,0);
});


test('pieza hallada antes vuelve a su página solo tras comprobar las demás',()=>{
 const x=repairFixture();x.setItemPage(1);x.c.repairTick();assert.equal(x.moves,0);assert.equal(x.visits,1);
 x.setPage(2);x.tx.loadedAt=Date.now()-6000;x.c.repairTick();assert.equal(x.moves,0);assert.equal(x.visits,2);assert.equal(x.tx.scan.complete,true);
 x.setPage(1);x.tx.loadedAt=Date.now()-6000;x.c.repairTick();assert.equal(x.moves,1);assert.equal(x.tx.stage,'collect');
});
test('búsqueda de pieza en carga no falla ni envía otra acción',()=>{
 const x=repairFixture();x.tx.searchRequestedAt=Date.now();x.c.params=new URLSearchParams('mod=packages&f=0');
 assert.equal(x.c.repairTick(),true);assert.equal(x.tx.blocked,undefined);assert.equal(x.moves,0);
});
