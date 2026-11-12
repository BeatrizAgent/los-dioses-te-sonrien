import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../src/bot/40-popup-and-pve.js', import.meta.url), 'utf8');
const pve = source.slice(source.indexOf('  function pveTick()'), source.lastIndexOf('\n'));
function run({mode='expedition', onclick="attack(null, '7', 4, 0, '')", name='Sumo Chaman', visibleButton=true, disabled=false, fightCalls=[], reset=null, cancelAction='cancelDungeon', entered=false, points='10', city=false, countryHref='/game/index.php?mod=map&submod=country'}={}) {
  let clicks = [];
  const area={id:'gorge',name:'El Desfiladero',entryLevel:90};
  const areaLink={textContent:area.name,getAttribute:()=>'/game/index.php?mod=location&loc=7',visible:true};
  const bar={textContent:'00:00',querySelector:()=>({visible:true,getAttribute:()=>'/game/index.php?mod=dungeon&loc=7'})};
  const button={getAttribute:()=>onclick,visible:visibleButton,disabled,outerHTML:'<button>Atacar</button>',click:()=>clicks.push('expedition')};
  const cancelForm={method:'post',getAttribute:()=>`/game/index.php?mod=dungeon&loc=7&action=${cancelAction}`,querySelector:(q)=>q.includes('dungeonId')?{value:'instance-1'}:{value:'opaque'}};
  const cancel={value:'Cancelar Mazmorra',visible:true,disabled:false,form:cancelForm,outerHTML:'<input>',click:()=>clicks.push('cancel')};
  const enter={visible:true,disabled:false};
  const fights=fightCalls.map(call=>({visible:true,outerHTML:'<img>',getAttribute:()=>call,click:()=>clicks.push(call)}));
  const country={visible:true,getAttribute:()=>countryHref};
  const doc={querySelector(selector){if(selector==='a')return null;if(selector==='#submenuhead1')return city?{visible:true}:null;if(selector.includes('cooldown_bar_'))return selector.endsWith(' a')?bar.querySelector():bar;if(selector.includes('points_value'))return {textContent:points};if(selector==='#content h3')return {textContent:'Mazmorra Abierto hasta mañana'};if(selector.includes('expedition_info'))return {textContent:name};if(selector.startsWith('#content input[type="submit"][name='))return entered?enter:null;return null;},querySelectorAll(selector){if(selector==='#submenuhead1 a.submenuswitch')return [country];if(selector==='#mainnav a, #mainmenu a')return city?[]:[areaLink];if(selector==='#expedition_list .expedition_button')return [{},{},{},button];if(selector==='#content img[onclick^="startFight"]')return fights;if(selector==='#content input[type="submit"]')return [cancel];return [];}};
  const context={document:doc,location:{origin:'https://s64-es.gladiatus.gameforge.com',href:`https://s64-es.gladiatus.gameforge.com/game/index.php?mod=${mode==='expedition'?'location':'dungeon'}&loc=7`},params:new URLSearchParams(`mod=${mode==='expedition'?'location':'dungeon'}&loc=7`),mod:mode==='expedition'?'location':'dungeon',URL,Date,Number,String,BUILD_CONFIG:{playerLevel:99,modules:{expedition:mode==='expedition',dungeon:mode==='dungeon'},expedition:{area,enemy:{position:4,name:'Sumo Chamán',levelMin:106,levelMax:108}},dungeon:{id:'dungeon-test',area,name:'Mazmorra',difficulty:'advanced',boss:'Jefe',levelMin:1,levelMax:2}},state:{pveTarget:mode,dungeonReset:reset},visible:el=>!!el?.visible,cooldownSeconds:()=>0,log:()=>{},save:()=>{},stop:()=>{},navigation:()=>{clicks.push('country');}};
  vm.runInNewContext(`${pve}\npveTick()`,context);
  return {clicks,state:context.state};
}
test('recupera menú de territorio tras visitar ciudad y rechaza rutas externas',()=>{
 assert.deepEqual(run({city:true}).clicks,['country']);
 assert.deepEqual(run({city:true,countryHref:'https://example.com/game/index.php?mod=map&submod=country'}).clicks,[]);
});
test('expedición usa la posición y acepta la llamada real de cinco argumentos aunque falte el acento',()=>{
  const result=run();assert.deepEqual(result.clicks,['expedition']);assert.equal(result.state.pendingPve.target,'Sumo Chaman');
});
test('expedición acepta seis argumentos y rechaza posición o zona de ataque distintas',()=>{
  assert.equal(run({onclick:`attack(null, '7', 4, 0, '', '')`}).clicks.length,1);
  assert.equal(run({onclick:`attack(null, '7', 3, 0, '')`}).clicks.length,0);
  assert.equal(run({onclick:`attack(null, '8', 4, 0, '')`}).clicks.length,0);
  assert.equal(run({disabled:true}).clicks.length,0);
});
test('mazmorra elige el primer encuentro válido disponible',()=>{
  const result=run({mode:'dungeon',fightCalls:[`startFight('1', '2'); showWait(); return false;`,`startFight('3', '4');showWait();return false;`]});
  assert.deepEqual(result.clicks,[`startFight('1', '2'); showWait(); return false;`]);
});


test('cancela una sola vez y espera confirmación antes de recrear',()=>{
 const first=run({mode:'dungeon',reset:{dungeonId:'dungeon-test',phase:'needed'}});assert.deepEqual(first.clicks,['cancel']);assert.equal(first.state.dungeonReset.phase,'submitted');
 const second=run({mode:'dungeon',reset:first.state.dungeonReset});assert.deepEqual(second.clicks,[]);assert.equal(second.state.dungeonReset.phase,'submitted');
 const confirmed=run({mode:'dungeon',reset:first.state.dungeonReset,entered:true,points:'0'});assert.equal(confirmed.state.dungeonReset,null);assert.equal(confirmed.state.dungeonLosses,null);
 const bad=run({mode:'dungeon',reset:{dungeonId:'dungeon-test',phase:'needed'},cancelAction:'other'});assert.deepEqual(bad.clicks,[]);
});
