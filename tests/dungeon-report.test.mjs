import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const combat=await readFile(new URL('../src/bot/50-combat-and-arena.js',import.meta.url),'utf8');
const code=combat.slice(combat.indexOf('    if (state.pendingPve) {'),combat.indexOf('    if (goldTick(true))'));
function run(winner,defender='Aldeano',attacker='CassiusFerox'){
 const state={pendingPve:{mode:'dungeon',dungeonId:'route',at:Date.now()},statsEvents:[]};let observed=[];
 const context={state,document:{querySelector:s=>s==='#attackerAvatar1'?{innerText:attacker}:s==='#defenderAvatar11'?{innerText:defender}:null,querySelectorAll:()=>winner?[{textContent:'Ganador: '+winner}]:[]},mod:'reports',sub:'showCombatReport',params:new URLSearchParams('t=1&reportId=101'),accountName:'CassiusFerox',recordDungeonOutcome:(...a)=>observed.push(a),reportGold:()=>null,log:()=>{},save:()=>{},Date,String,Number};
 vm.runInNewContext(`(function(){${code}})()`,context);return {state,observed};
}
test('derrota exige atacante y ganador coincidente con defensor',()=>{let r=run('Aldeano');assert.equal(r.state.statsEvents[0].result,'loss');assert.equal(r.observed[0][1],'loss');assert.equal(r.observed[0][2],'Aldeano');});
test('resultado ambiguo no cuenta como derrota',()=>{for(const [winner,defender,attacker] of [['Otro','Aldeano','CassiusFerox'],['Aldeano','','CassiusFerox'],['Aldeano','Aldeano','Otro']]){let r=run(winner,defender,attacker);assert.equal(r.state.statsEvents[0].result,null);assert.equal(r.observed[0][1],null);}});
