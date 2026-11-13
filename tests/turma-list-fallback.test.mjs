import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/bot/50-combat-and-arena.js',import.meta.url),'utf8');
const helper=source.slice(source.indexOf('  function turmaListMiss('),source.indexOf('  function combatTick()'));
test('tres búsquedas fallidas aplazan Turma y permiten otras tareas',()=>{
  let now=100000, reloads=0;
  const state={}, context={state,Date:{now:()=>now},document:{querySelector:()=>({})},navigation:()=>{reloads++;return true;},save:()=>{},log:()=>{}};
  vm.createContext(context); vm.runInContext(helper,context);
  context.turmaListMiss('#cooldown_bar_ct'); context.turmaListMiss('#cooldown_bar_ct');
  assert.equal(state.turmaListRetry.count,1);
  now+=15000; context.turmaListMiss('#cooldown_bar_ct');
  now+=15000; context.turmaListMiss('#cooldown_bar_ct');
  assert.equal(reloads,2); assert.equal(state.turmaListRetry,undefined); assert.equal(state.turmaSkipUntil,now+300000);
  assert.match(source,/const ctReady = ctRemaining === 0 && Date\.now\(\) >= \(state\.turmaSkipUntil \|\| 0\)/);
});
