import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../src/bot/40-popup-and-pve.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('  function pveTick()'),source.indexOf('  function cooldownSeconds(text)'));
function run(rival) {
  let clicks=0;
  const link={textContent:'Zona',getAttribute:()=>'/game/index.php?mod=location&loc=1'};
  const button={getAttribute:()=>"attack(null, '1', 1, 0, 'x')",outerHTML:'<button>',click:()=>clicks++};
  const bar={textContent:'0:00',querySelector:()=>link};
  const state={pveTarget:'expedition'};
  const ctx={state,Date,URL,Number,String,mod:'location',params:new URLSearchParams('mod=location&loc=1'),location:{origin:'https://s1-es.gladiatus.gameforge.com',href:'https://s1-es.gladiatus.gameforge.com/game/index.php?mod=location&loc=1'},
    BUILD_CONFIG:{playerLevel:20,modules:{expedition:true},expedition:{area:{id:'zone',name:'Zona',entryLevel:1},enemy:{name:'Rata',position:1,levelMin:1,levelMax:2}}},
    document:{querySelector:s=>s==='#header_values_level'?{textContent:'20'}:s==='#expedition_info1 .expedition_name'?{textContent:rival}:s.includes('points_value')?{textContent:'1'}:s.includes('cooldown_bar')?bar:null,querySelectorAll:s=>s==='#mainnav a, #mainmenu a'?[link]:s==='#expedition_list .expedition_button'?[button]:[]},
    visible:x=>!!x,cooldownSeconds:()=>0,save(){},log(){},navigation(){throw new Error('navegación inesperada');}};
  vm.runInNewContext(code+'\npveTick()',ctx);return {clicks,state};
}
test('ataca solo si nombre observado y posición coinciden con objetivo',()=>{
  assert.equal(run('Rata').clicks,1);
  for(const rival of ['Lobo','', 'Rata gigante']) {const result=run(rival);assert.equal(result.clicks,0);assert.match(result.state.message,/no coincide/);}
});
