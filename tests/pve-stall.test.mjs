import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../src/bot/40-popup-and-pve.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('  function pveStallTick('),source.indexOf('  function pveTick('));
function fixture(){
  let now=1000000,points='10 / 72',cooldown='0',navigations=0;
  const link={getAttribute:()=>'/game/index.php?mod=overview'},bar={get textContent(){return cooldown;},querySelector:()=>({})},state={};
  const c={state,BUILD_CONFIG:{modules:{expedition:true,dungeon:false},expedition:{}},Date:{now:()=>now},Number,Math,URL,location:{href:'https://example.org/game/index.php',origin:'https://example.org'},document:{querySelector:s=>s==='#expeditionpoints_value'?{textContent:points}:s==='#cooldown_bar_expedition'?bar:s.includes('mod=overview')?link:null},cooldownSeconds:x=>x==='0'?0:30,visible:x=>!!x,captcha:()=>false,verified:()=>true,navigation:()=>{navigations++;return true;},save:()=>{},log:()=>{}};
  vm.createContext(c);vm.runInContext(code,c);
  return {c,state,advance:n=>now+=n,points:v=>points=v,cooldown:v=>cooldown=v,navigations:()=>navigations};
}
test('recupera navegación tras cinco minutos disponible sin consumo',()=>{const x=fixture();x.c.pveStallTick(100);x.advance(300000);assert.equal(x.c.pveStallTick(100),true);assert.equal(x.navigations(),1);assert.equal(x.state.pveStallRecoveryAt,1300000);});
test('consumo y enfriamiento reinician vigilancia',()=>{const x=fixture();x.c.pveStallTick(100);x.advance(299000);x.points('9 / 72');x.c.pveStallTick(100);x.advance(299000);assert.equal(x.c.pveStallTick(100),false);x.cooldown('30');x.c.pveStallTick(100);assert.equal(x.state.pveWatch.expedition,undefined);});
test('transacción pendiente pausa el reloj y se conserva',()=>{const x=fixture();x.c.pveStallTick(100);x.advance(100000);x.state.goldTx={stage:'buy'};x.c.pveStallTick(100);x.advance(500000);assert.equal(x.c.pveStallTick(100),false);assert.equal(x.state.goldTx.stage,'buy');x.state.goldTx=null;x.c.pveStallTick(100);x.advance(199999);assert.equal(x.c.pveStallTick(100),false);x.advance(1);assert.equal(x.c.pveStallTick(100),true);});
test('sin puntos, CAPTCHA o navegación segura no reinicia',()=>{const x=fixture();x.points('0 / 72');x.c.pveStallTick(100);x.advance(600000);assert.equal(x.c.pveStallTick(100),false);x.points('10 / 72');x.c.pveStallTick(100);x.advance(300000);x.c.captcha=()=>true;assert.equal(x.c.pveStallTick(100),false);assert.equal(x.navigations(),0);});
test('mazmorra se vigila por separado y resultado desconocido impide recuperación',()=>{const x=fixture();x.c.BUILD_CONFIG.modules.expedition=false;x.c.BUILD_CONFIG.modules.dungeon=true;x.c.BUILD_CONFIG.dungeon={};const query=x.c.document.querySelector;x.c.document.querySelector=s=>query(s.replace('dungeonpoints','expeditionpoints').replace('bar_dungeon','bar_expedition'));x.state.dungeonCombatUnknown={};x.c.pveStallTick(100);x.advance(400000);assert.equal(x.c.pveStallTick(100),false);x.state.dungeonCombatUnknown=null;x.c.pveStallTick(100);x.advance(300000);assert.equal(x.c.pveStallTick(100),true);});
