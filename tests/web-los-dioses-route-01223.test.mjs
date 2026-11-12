import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const src=fs.readFileSync(new URL('../src/bot/40-popup-and-pve.js',import.meta.url),'utf8') + fs.readFileSync(new URL('../src/bot/20-healing.js',import.meta.url),'utf8');
const pve=src.slice(src.indexOf('  function pveTick()'),src.indexOf('  function cooldownSeconds(text)'));
function route({mod='location',loc='0',active=false,guard=null,globalLoc='0'}={}) {
 let navigated=[],stopped='';
 const area={id:'temple',name:'El Templo Vudú',entryLevel:20},areaLink={textContent:area.name,getAttribute:()=>'/game/index.php?mod=location&loc=0'};
 const dungeonLink={textContent:'Mazmorra',getAttribute:()=>`/game/index.php?mod=dungeon&loc=${loc}`};
 const bar={textContent:'0:00',querySelector:()=>({getAttribute:()=>'/game/index.php?mod=dungeon&loc='+globalLoc})};
 const doc={querySelector(s){if(s.includes('cooldown_bar_'))return s.endsWith(' a')?bar.querySelector():bar;if(s.includes('points_value'))return {textContent:'1'};return null;},querySelectorAll(s){if(s==='#mainnav a, #mainmenu a')return [areaLink,dungeonLink];if(s==='#content input, #content button'&&active)return [{value:'Cancelar Mazmorra'}];return [];}};
 const state={pveTarget:'dungeon',pveRouteGuard:guard};const context={document:doc,location:{origin:'https://s64-es.gladiatus.gameforge.com',href:'https://s64-es.gladiatus.gameforge.com/game/index.php?mod='+mod+'&loc='+loc},params:new URLSearchParams('mod='+mod+'&loc='+loc),mod,URL,Date,Number,String,state,BUILD_CONFIG:{playerLevel:99,modules:{dungeon:true},dungeon:{id:'temple',name:'Perdición',area}},visible:x=>!!x,cooldownSeconds:()=>0,save:()=>{},log:()=>{},stop:m=>{stopped=m},navigation:a=>{navigated.push(a.getAttribute('href'))}};
 vm.runInNewContext(pve+'\npveTick()',context);return {navigated,stopped,state};
}
test('usa enlace de mazmorra del territorio elegido, no temporizador de otra zona',()=>{const r=route();assert.deepEqual(r.navigated,['/game/index.php?mod=dungeon&loc=0']);});
test('mazmorra activa de otra zona detiene sin navegar ni cancelar',()=>{const r=route({mod:'dungeon',loc:'4',active:true});assert.equal(r.stopped,'');assert.match(r.state.message,/otra zona/);assert.ok(r.state.dungeonRouteRetryAt>Date.now());assert.deepEqual(r.navigated,[]);});
test('rutas repetidas se detienen',()=>{const r=route({guard:{key:'temple:0',attempts:3,at:Date.now()}});assert.match(r.stopped,/repetida/);assert.deepEqual(r.navigated,[]);});
test('reconoce alimento real de nivel compatible',()=>{const code=src.slice(src.indexOf('  function healingFood('),src.indexOf('  function packageFoodTick()'));const c={accountName:'CassiusFerox'};vm.createContext(c);vm.runInContext(code,c);const attrs={'data-content-type':'64','data-tooltip':JSON.stringify([[['Queso del Dolor','verde'],['En uso: Cura 1231 punto(s) de vida','blanco'],['Nivel 17','gris']]]),'data-measurement-x':'1','data-measurement-y':'1'};const food=c.healingFood({getAttribute:k=>attrs[k]??null});assert.equal(food.amount,1231);assert.equal(food.level,17);});

test('enlace global antiguo no impide entrar a la zona elegida',()=>{const r=route({globalLoc:'4'});assert.deepEqual(r.navigated,['/game/index.php?mod=dungeon&loc=0']);assert.equal(r.state.dungeonRouteRetryAt,undefined);});
