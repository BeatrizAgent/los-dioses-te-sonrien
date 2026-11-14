import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/bot/20-healing.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('  function packageUsable('),source.indexOf('  function inventorySpace('));
function usable(attrs) {
  const c={item:{getAttribute:k=>attrs[k]??null}};vm.createContext(c);return vm.runInContext(code+'\npackageUsable(item)',c);
}
test('recoge utilizables de cualquier nivel, sin exigir efecto de curación',()=>{
  const attrs={'data-content-type':'64','data-basis':'7-6','data-level':'110','data-tooltip':JSON.stringify([[['Poción de salud','white']]])};
  assert.equal(usable(attrs)?.name,'Poción de salud');
  attrs['data-level']='1';assert.equal(usable(attrs)?.name,'Poción de salud');
});
test('no confunde bienes de forja, datos sin identificar o categorías distintas',()=>{
  const attrs={'data-content-type':'64','data-basis':'12-1','data-tooltip':JSON.stringify([[['Material','white']]])};
  assert.equal(usable(attrs),null);attrs['data-basis']='7-1';attrs['data-content-type']='32';assert.equal(usable(attrs),null);attrs['data-content-type']='64';attrs['data-tooltip']='mal';assert.equal(usable(attrs),null);
});
test('traslada un utilizable de nivel superior y confirma antes de continuar',()=>{
  const body=source.slice(source.indexOf('  function packageFoodTick()'),source.indexOf('  function skipHealing('));
  const state={packageCollectTrip:true,packageScan:{key:'1:7',at:1}}, inventory=[];
  let clicks=0;
  const attrs={'data-content-type':'64','data-basis':'7-6','data-level':'110','data-hash':'item1','data-measurement-x':'1','data-measurement-y':'1','data-tooltip':JSON.stringify([[['Poción','white']]])};
  const item={getAttribute:k=>attrs[k]??null,hasAttribute:k=>k==='data-gca-flag_double-click-event',dispatchEvent:()=>{clicks++;}};
  const bag={classList:{contains:()=>true},getAttribute:()=>null};
  const inv={querySelectorAll:()=>inventory},packages={querySelectorAll:()=>[item]};
  const c={state,mod:'packages',params:new URLSearchParams('f=7'),document:{querySelector:s=>({'#inv':inv,'#packages':packages,'#inventory_nav a':bag,'#header_values_level':{textContent:'99'}}[s]||null)},window:{},Date:{now:()=>10000},visible:x=>!!x,validItemHash:x=>!!x,inventorySpace:()=>true,healingFood:()=>null,log:()=>{},save:()=>{},MouseEvent:class{},BUILD_CONFIG:{modules:{foodMarket:false}}};
  vm.createContext(c);vm.runInContext(code+'\n'+body,c);c.packageFoodTick();assert.equal(clicks,1);assert.equal(state.pendingPackageFood.hash,'item1');
  inventory.push({getAttribute:k=>k==='data-container-number'?'512':k==='data-hash'?'item1':null});c.packageFoodTick();assert.equal(state.pendingPackageFood,null);assert.equal(state.packageCollectTrip,false);assert.equal(clicks,1);
});

test('usa comida de nivel superior en el baúl sin buscar paquetes',()=>{
  const healing=source.slice(source.indexOf('  function healingFood('),source.indexOf('  function packageUsable('));
  const tick=source.slice(source.indexOf('  function healTick('),source.indexOf('  // La compra de alimento'));
  const attrs={'data-content-type':'64','data-hash':'pan-109','data-measurement-x':'1','data-measurement-y':'1','data-tooltip':JSON.stringify([[['Rollos de pan','white'],['Nivel 109','gray'],['En uso: Cura 3.219 punto(s) de vida','green']]])};
  const item={getAttribute:k=>attrs[k]??null};const bag={classList:{contains:()=>true}},target={};let drags=0,navigations=0;
  const state={};const c={state,accountName:'CassiusFerox',mod:'overview',Date,Number,String,document:{querySelectorAll:s=>s==='#inventory_nav a'?[bag]:s.startsWith('#inv ')?[item]:[],querySelector:s=>s==='#avatar'?target:null},validItemHash:x=>!!x,visible:x=>!!x,save:()=>{},log:()=>{},dragFood:()=>{drags++;return true;},navigation:()=>{navigations++;return true;}};
  vm.createContext(c);vm.runInContext(healing+'\n'+tick,c);c.healTick(1000,10000);assert.equal(drags,1);assert.equal(navigations,0);assert.equal(state.pendingHeal.hash,'pan-109');
});

test('una curación sin confirmar no vuelve a intentarse',()=>{
  const tick=source.slice(source.indexOf('  function healTick('),source.indexOf('  // La compra de alimento'));
  const bag={classList:{contains:()=>true}},item={};let drags=0;
  const state={pendingHeal:{hash:'pan-109',name:'Pan',before:1000,bagIndex:0,at:Date.now()-20000,refreshRequestedAt:Date.now()-16000}};
  const c={state,mod:'overview',Date,Number,String,document:{querySelectorAll:()=>[bag],querySelector:s=>s==='#inv'?{}:null},validItemHash:x=>!!x,inventoryItemByHash:()=>item,visible:()=>true,save:()=>{},log:()=>{},dragFood:()=>{drags++;},skipHealing:()=>{state.pendingHeal=null;}};
  vm.createContext(c);vm.runInContext(tick,c);c.healTick(1000,10000);assert.equal(drags,0);assert.deepEqual(Array.from(state.unknownHealFood),['pan-109']);assert.equal(state.pendingHeal,null);
});

test('un filtro de paquetes no verificable aplaza la recogida sin detener el bot',()=>{
  const body=source.slice(source.indexOf('  function packageFoodTick()'),source.indexOf('  function skipHealing('));
  const state={running:true,packageCollectTrip:true};let skipped='';
  const filter={getAttribute:()=>'/game/index.php?mod=packages&f=8'};
  const c={state,mod:'packages',params:new URLSearchParams('f=0'),document:{querySelector:s=>s==='#inv'||s==='#packages'?{}:filter},location:{href:'https://s64-es.gladiatus.gameforge.com/game/index.php',origin:'https://s64-es.gladiatus.gameforge.com'},URL,visible:x=>!!x,skipHealing:m=>{skipped=m;state.packageCollectTrip=false;},stop:()=>{state.running=false;},save:()=>{}};
  vm.createContext(c);vm.runInContext(body,c);assert.equal(c.packageFoodTick(),true);assert.equal(state.running,true);assert.equal(state.packageCollectTrip,false);assert.match(skipped,/aplazada/);
});
