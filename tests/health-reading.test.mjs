import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../src/bot/50-combat-and-arena.js',import.meta.url),'utf8');
const code=source.slice(0,source.indexOf('  function combatTick()'));
function read(points, value, max) {
  const context={document:{querySelector:s=>s==='#header_values_hp_points' ? (points==null?null:{textContent:points}) : {getAttribute:k=>k==='data-value'?value:max}},parseGold:s=>Number(s.replace(/[.\s]/g,''))};
  vm.createContext(context); vm.runInContext(code,context);
  return JSON.stringify(context.healthReading());
}
test('lee puntos visibles y atributos de la barra en territorio',()=>{
  assert.equal(read('7.498 / 10.700','1','2'),'{"current":7498,"maximum":10700}');
  assert.equal(read(null,'7498','10700'),'{"current":7498,"maximum":10700}');
});
test('rechaza datos ausentes, inconsistentes o fuera de rango',()=>{
  for (const [value,max] of [[null,'100'],['101','100'],['-1','100'],['1','0'],['1x','100']]) assert.equal(read(null,value,max),'null');
  assert.equal(read('101 / 100','1','100'),'null');
});
