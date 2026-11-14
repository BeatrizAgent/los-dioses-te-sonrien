import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../src/bot/40-popup-and-pve.js',import.meta.url),'utf8');
const fn=source.slice(source.indexOf('  function recordDungeonOutcome'),source.indexOf('  function pveTick()'));
function setup(){const ctx={state:{},String,Number,BUILD_CONFIG:{dungeon:{lossLimit:3}}};vm.runInNewContext(fn,ctx);return ctx;}
const p={dungeonId:'dungeon-test'};
test('tres derrotas confirmadas del mismo enemigo solicitan reinicio una sola vez',()=>{
 const c=setup();c.recordDungeonOutcome(p,'loss','Jefe','101');c.recordDungeonOutcome(p,'loss','Jefe','101');assert.equal(c.state.dungeonLosses.count,1);c.recordDungeonOutcome(p,'loss','Jefe','102');assert.equal(c.state.dungeonReset,undefined);c.recordDungeonOutcome(p,'loss','Jefe','103');assert.equal(c.state.dungeonReset.phase,'needed');
});
test('resultado desconocido conserva derrotas y victoria limpia solo el mismo rival',()=>{
 const c=setup();c.recordDungeonOutcome(p,'loss','Jefe','101');c.recordDungeonOutcome(p,'loss','Otro','102');assert.equal(c.state.dungeonLosses.count,1);c.recordDungeonOutcome(p,null,'Otro','103');assert.equal(c.state.dungeonLosses.count,1);c.recordDungeonOutcome(p,'win','Jefe','104');assert.equal(c.state.dungeonLosses.count,1);c.recordDungeonOutcome(p,'win','Otro','105');assert.equal(c.state.dungeonLosses,null);
});
test('el umbral elegido cambia cuándo se solicita el reinicio',()=>{
 const c=setup();c.BUILD_CONFIG.dungeon.lossLimit=2;c.recordDungeonOutcome(p,'loss','Jefe','101');assert.equal(c.state.dungeonReset,undefined);c.recordDungeonOutcome(p,'loss','Jefe','102');assert.equal(c.state.dungeonReset.phase,'needed');
});
test('una laguna desconocida rompe la racha sin borrar el contador anterior hasta una nueva derrota',()=>{
 const c=setup();c.recordDungeonOutcome(p,'loss','Jefe','101');c.recordDungeonOutcome(p,'loss','Jefe','102');c.state.dungeonLosses.uncertain=true;
 assert.equal(c.state.dungeonLosses.count,2);c.recordDungeonOutcome(p,'loss','Jefe','103');assert.equal(c.state.dungeonLosses.count,1);assert.equal(c.state.dungeonReset,undefined);
});
