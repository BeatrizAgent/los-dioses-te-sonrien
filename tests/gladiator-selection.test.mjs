import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../src/bot/10-core-and-missions.js',import.meta.url),'utf8');
const code=src.slice(src.indexOf('  function mainGladiatorSelected()'),src.indexOf('  function navigation('));
function setup({doll='2',active='2',handler="selectDoll('index.php?mod=overview&doll=1&sh=test')"}={}) {
 let clicks=0,now=20000;const state={};const button={getAttribute:()=>handler,click:()=>clicks++};
 const selected={querySelector:()=>active==='1'?{}:null};const c={state,URL,Date:{now:()=>now},location:{href:'https://s1-es.gladiatus.gameforge.com/game/index.php?mod=overview',origin:'https://s1-es.gladiatus.gameforge.com'},document:{querySelector:s=>s==='#plDoll'?{value:doll}:button,querySelectorAll:()=>[selected]},visible:x=>!!x,save(){}};vm.createContext(c);vm.runInContext(code,c);return {c,state,get clicks(){return clicks},setDoll:x=>doll=x,setActive:x=>active=x,setNow:x=>now=x};
}
test('selecciona batalla estándar y espera confirmación antes de actuar',()=>{const x=setup();assert.equal(x.c.selectMainGladiator(),'waiting');assert.equal(x.clicks,1);assert.equal(x.c.selectMainGladiator(),'waiting');assert.equal(x.clicks,1);x.setDoll('1');x.setActive('1');assert.equal(x.c.selectMainGladiator(),'ready');});
test('no acepta señales contradictorias ni reintenta indefinidamente',()=>{const x=setup({doll:'1',active:'2'});assert.equal(x.c.mainGladiatorSelected(),false);assert.equal(x.c.selectMainGladiator(),'waiting');x.setNow(35001);assert.equal(x.c.selectMainGladiator(),'unavailable');});
test('rechaza selección con acción adicional',()=>{const x=setup({handler:"selectDoll('index.php?mod=overview&doll=1&action=delete')"});assert.equal(x.c.selectMainGladiator(),'unavailable');assert.equal(x.clicks,0);});
