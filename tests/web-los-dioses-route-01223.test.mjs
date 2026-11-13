import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const src=fs.readFileSync(new URL('../src/bot/40-popup-and-pve.js',import.meta.url),'utf8') + fs.readFileSync(new URL('../src/bot/20-healing.js',import.meta.url),'utf8');
const pve=src.slice(src.indexOf('  function pveTick()'),src.indexOf('  function cooldownSeconds(text)'));
function route({mod='location',loc='0',active=false,guard=null,globalLoc='0',lastNavigationAt=0,navSucceeds=true,retryAt=0}={}) {
 let navigated=[],stopped='';
 const area={id:'temple',name:'El Templo Vudú',entryLevel:20},areaLink={textContent:area.name,getAttribute:()=>'/game/index.php?mod=location&loc=0'};
 const dungeonLink={textContent:'Mazmorra',getAttribute:()=>`/game/index.php?mod=dungeon&loc=${loc}`};
 const bar={textContent:'0:00',querySelector:()=>({getAttribute:()=>'/game/index.php?mod=dungeon&loc='+globalLoc})};
 const doc={querySelector(s){if(s.includes('cooldown_bar_'))return s.endsWith(' a')?bar.querySelector():bar;if(s.includes('points_value'))return {textContent:'1'};return null;},querySelectorAll(s){if(s==='#mainnav a, #mainmenu a')return [areaLink,dungeonLink];if(s==='#content input, #content button'&&active)return [{value:'Cancelar Mazmorra'}];return [];}};
 const state={pveTarget:'dungeon',pveRouteGuard:guard,lastNavigationAt,dungeonRouteRetryAt:retryAt};const context={document:doc,location:{origin:'https://s64-es.gladiatus.gameforge.com',href:'https://s64-es.gladiatus.gameforge.com/game/index.php?mod='+mod+'&loc='+loc},params:new URLSearchParams('mod='+mod+'&loc='+loc),mod,URL,Date,Number,String,state,BUILD_CONFIG:{playerLevel:99,modules:{dungeon:true},dungeon:{id:'temple',name:'Perdición',area}},visible:x=>!!x,cooldownSeconds:()=>0,save:()=>{},log:()=>{},stop:m=>{stopped=m},navigation:a=>{if(navSucceeds)navigated.push(a.getAttribute('href'));return navSucceeds;}};
 vm.runInNewContext(pve+'\npveTick()',context);return {navigated,stopped,state};
}
test('usa enlace de mazmorra del territorio elegido, no temporizador de otra zona',()=>{const r=route();assert.deepEqual(r.navigated,['/game/index.php?mod=dungeon&loc=0']);});
test('mazmorra activa de otra zona detiene sin navegar ni cancelar',()=>{const r=route({mod:'dungeon',loc:'4',active:true});assert.equal(r.stopped,'');assert.match(r.state.message,/otra zona/);assert.ok(r.state.dungeonRouteRetryAt>Date.now());assert.deepEqual(r.navigated,[]);});
test('rutas repetidas aplazan solo mazmorra sin detener ni cancelar',()=>{const r=route({guard:{key:'temple:0',leg:'dungeon',attempts:3,at:Date.now()}});assert.equal(r.stopped,'');assert.match(r.state.message,/aplazada/);assert.ok(r.state.dungeonRouteRetryAt>Date.now());assert.equal(r.state.pveTarget,null);assert.deepEqual(r.navigated,[]);});
test('avanzar de zona a mazmorra inicia contador nuevo',()=>{const r=route({guard:{key:'temple:0',leg:'area',attempts:3,at:Date.now()}});assert.equal(r.stopped,'');assert.equal(r.state.pveRouteGuard.leg,'dungeon');assert.equal(r.state.pveRouteGuard.attempts,1);assert.equal(r.navigated.length,1);});
test('navegación rechazada no suma intentos',()=>{const guard={key:'temple:0',leg:'dungeon',attempts:1,at:Date.now()};const r=route({guard,navSucceeds:false});assert.equal(r.state.pveRouteGuard.attempts,1);assert.deepEqual(r.navigated,[]);});
test('espera entre navegaciones no suma intentos ni detiene',()=>{const guard={key:'temple:0',leg:'dungeon',attempts:3,at:Date.now()};const r=route({guard,lastNavigationAt:Date.now()});assert.equal(r.stopped,'');assert.equal(r.state.pveRouteGuard.attempts,3);assert.deepEqual(r.navigated,[]);});
test('tras el plazo vuelve a intentar la ruta',()=>{const r=route({retryAt:Date.now()-1});assert.equal(r.stopped,'');assert.equal(r.navigated.length,1);});
test('recupera solo la parada antigua de ruta, no una pausa del jugador',()=>{
 const core=fs.readFileSync(new URL('../src/bot/10-core-and-missions.js',import.meta.url),'utf8');
 const migration=core.slice(core.indexOf('  // Recuperar únicamente'),core.indexOf('  // Migración única:'));
 function run(message){const state={running:false,message,pveTarget:'dungeon',pveRouteGuard:{attempts:4},dungeonReset:{phase:'needed'}};vm.runInNewContext(migration,{state,BUILD_CONFIG:{modules:{dungeon:true}},Date,log:()=>{},save:()=>{}});return state;}
 const recovered=run('Ruta de mazmorra repetida; revisión necesaria. No se ha cancelado ninguna mazmorra.');assert.equal(recovered.running,true);assert.ok(recovered.dungeonRouteRetryAt>Date.now());assert.equal(recovered.pveRouteGuard,undefined);assert.equal(recovered.dungeonReset.phase,'needed');
 assert.equal(run('Misiones detenidas por el jugador.').running,false);
});
test('reconoce alimento real de nivel compatible',()=>{const code=src.slice(src.indexOf('  function healingFood('),src.indexOf('  function packageFoodTick()'));const c={accountName:'CassiusFerox'};vm.createContext(c);vm.runInContext(code,c);const attrs={'data-content-type':'64','data-tooltip':JSON.stringify([[['Queso del Dolor','verde'],['En uso: Cura 1231 punto(s) de vida','blanco'],['Nivel 17','gris']]]),'data-measurement-x':'1','data-measurement-y':'1'};const food=c.healingFood({getAttribute:k=>attrs[k]??null});assert.equal(food.amount,1231);assert.equal(food.level,17);});

test('enlace global antiguo no impide entrar a la zona elegida',()=>{const r=route({globalLoc:'4'});assert.deepEqual(r.navigated,['/game/index.php?mod=dungeon&loc=0']);assert.ok(!r.state.dungeonRouteRetryAt);});
