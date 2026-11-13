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
