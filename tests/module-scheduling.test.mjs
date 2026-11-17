import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const combat = readFileSync(new URL('../src/bot/50-combat-and-arena.js', import.meta.url), 'utf8');
const pveSource = readFileSync(new URL('../src/bot/40-popup-and-pve.js', import.meta.url), 'utf8');
const pve = pveSource.slice(pveSource.indexOf('  function pveTick()'), pveSource.indexOf('  function cooldownSeconds(text)'));

test('PvE continúa después de un combate cuando Arena está desactivada', () => {
  const link = { textContent: 'Zona', getAttribute: () => '/game/index.php?mod=location&loc=1' };
  const bar = { textContent: '0:00', querySelector: () => link };
  let navigated = false;
  const state = { lastAction: 'pve', lastPveAt: 0 };
  const context = { state, Date, URL, Number, String, params: new URLSearchParams('mod=overview'), mod: 'overview',
    location: { href: 'https://s1-es.gladiatus.gameforge.com/game/index.php?mod=overview', origin: 'https://s1-es.gladiatus.gameforge.com' },
    BUILD_CONFIG: { playerLevel: 20, modules: { expedition: true, arenaCircus: false }, expedition: { area: { id: 'zone', name: 'Zona', entryLevel: 20 } } },
    document: { querySelector: s => s==='#header_values_level' ? {textContent:'20'} : s.includes('points_value') ? { textContent: '1' } : s.includes('cooldown_bar') ? bar : null, querySelectorAll: () => [link] },
    visible: x => !!x, cooldownSeconds: () => 0, save() {}, log() {}, navigation() { navigated = true; return true; } };
  vm.runInNewContext(pve + '\npveTick()', context);
  assert.equal(navigated, true);
});

function runCombat(mod, state = {}) {
  const calls = [];
  const context = { state: { running: true, ...state }, ownerActive: true, mod, sub: '', params: new URLSearchParams(), Date, Number,
    BUILD_CONFIG: { modules: { missions: true, arenaCircus: false } },
    document: { querySelector: s => s.includes('mod=quests') ? {} : null, querySelectorAll: () => [] },
    visible: () => false, captcha: () => false, verified: () => true, lootTick: () => false, updateMessage: message => { context.state.message=message; },
    healthReading: () => ({ current: 100, maximum: 100 }), goldTick: () => false, pveTick: () => { calls.push('pve'); return false; },
    questTick: () => calls.push('quest'), navigation: () => { calls.push('navigation'); return true; }, save() {}, log() {} };
  vm.runInNewContext(combat.slice(combat.indexOf('  function combatTick()')) + '\ncombatTick()', context);
  return { calls, state: context.state };
}

test('misiones visita Panteón sin Arena', () => {
  assert.deepEqual(runCombat('overview').calls, ['pve', 'navigation']);
});
test('misiones cede paso a PvE y respeta intervalo tras visitar Panteón', () => {
  const first = runCombat('quests');
  assert.deepEqual(first.calls, ['quest', 'pve']);
  assert.deepEqual(runCombat('quests', { lastQuestVisit: first.state.lastQuestVisit }).calls, ['pve']);
});

test('sin enlace de Circo, misiones cede paso a PvE y no se repite cada ciclo', () => {
  const calls=[], state={running:true};
  const context={state,ownerActive:true,mod:'quests',sub:'',params:new URLSearchParams(),Date,Number,
    BUILD_CONFIG:{modules:{missions:true,arenaCircus:true}},
    document:{querySelector:()=>null,querySelectorAll:()=>[]},visible:()=>false,captcha:()=>false,verified:()=>true,lootTick:()=>false,
    healthReading:()=>({current:100,maximum:100}),goldTick:()=>false,pveTick:()=>{calls.push('pve');return true;},
    questTick:()=>calls.push('quest'),checkTurmaParticipation:()=>false,navigation:()=>false,save(){},log(){}};
  vm.createContext(context);vm.runInContext(combat.slice(combat.indexOf('  function combatTick()')),context);
  context.combatTick();context.combatTick();
  assert.deepEqual(calls,['quest','pve','pve']);
});

test('temporizadores de Arena ausentes permiten visitar misiones', () => {
  const calls=[],state={running:true};
  const context={state,ownerActive:true,mod:'overview',sub:'',params:new URLSearchParams(),Date,Number,
    BUILD_CONFIG:{modules:{missions:true,arenaCircus:true}},ID:'identity',sessionStorage:{getItem:()=>JSON.stringify({at:Date.now()})},
    document:{querySelector:s=>s.includes('mod=quests')?{}:null,querySelectorAll:()=>[]},visible:()=>false,captcha:()=>false,verified:()=>true,lootTick:()=>false,
    healthReading:()=>({current:100,maximum:100}),goldTick:()=>false,pveTick:()=>false,checkTurmaParticipation:()=>false,cooldownSeconds:()=>null,
    navigation:(_link,purpose)=>{calls.push(purpose);return true;},save(){},log(){}};
  vm.runInNewContext(combat.slice(combat.indexOf('  function combatTick()'))+'\ncombatTick()',context);
  assert.deepEqual(calls,['Revisando misiones del Panteón.']);
});

test('búsqueda de alimento aplazada no bloquea oro', () => {
  const calls=[],state={running:true,foodSupportNeeded:true,foodBuyRetryAt:Date.now()+60000};
  const context={state,ownerActive:true,mod:'overview',sub:'',params:new URLSearchParams(),Date,Number,
    BUILD_CONFIG:{modules:{guildGold:true,foodMarket:true}},
    document:{querySelector:()=>null,querySelectorAll:()=>[]},visible:()=>false,captcha:()=>false,verified:()=>true,lootTick:()=>false,
    healthReading:()=>({current:100,maximum:100}),goldBalance:()=>500000,goldTick:pending=>{calls.push(pending?'pendiente':'oro');return !pending;},
    foodMarketTick:()=>{throw Error('alimento aplazado');},save(){},log(){}};
  vm.runInNewContext(combat.slice(combat.indexOf('  function combatTick()'))+'\ncombatTick()',context);
  assert.deepEqual(calls,['pendiente','oro']);
});

test('vida baja con curación aplazada permite misiones pero no inicia PvE', () => {
  const calls=[],state={running:true,healSkipUntil:Date.now()+60000,packageCollectAt:Date.now()+60000};
  const context={state,ownerActive:true,mod:'overview',sub:'',params:new URLSearchParams(),Date,Number,
    BUILD_CONFIG:{modules:{missions:true,arenaCircus:true,healing:true}},
    document:{querySelector:s=>s.includes('mod=quests')?{}:null,querySelectorAll:()=>[]},visible:()=>false,captcha:()=>false,verified:()=>true,lootTick:()=>false,
    healthReading:()=>({current:1000,maximum:10000}),goldTick:()=>false,pveTick:()=>{calls.push('pve');return true;},
    navigation:(_link,purpose)=>{calls.push(purpose);return true;},save(){},log(){}};
  vm.runInNewContext(combat.slice(combat.indexOf('  function combatTick()'))+'\ncombatTick()',context);
  assert.deepEqual(calls,['Revisando misiones mientras recupero vida.']);assert.equal(state.running,true);
});


test('Arena disponible sin atacar no impide expediciones indefinidamente',()=>{
 let now=1000000,navigations=0;const area={id:'zone',name:'Zona',entryLevel:20};
 const link={textContent:'Zona',getAttribute:()=>'/game/index.php?mod=location&loc=1'},bar={textContent:'0:00',querySelector:()=>link};
 const state={lastAction:'pve',lastPveAt:now-60000};
 const c={state,Date:{now:()=>now},URL,Number,String,params:new URLSearchParams('mod=overview'),mod:'overview',location:{href:'https://s1-es.gladiatus.gameforge.com/game/index.php?mod=overview',origin:'https://s1-es.gladiatus.gameforge.com'},
 BUILD_CONFIG:{playerLevel:20,modules:{expedition:true,arenaCircus:true},expedition:{area}},document:{querySelector:s=>s==='#header_values_level'?{textContent:'20'}:s.includes('points_value')?{textContent:'1'}:s.includes('cooldown_bar')?bar:null,querySelectorAll:()=>[link]},visible:x=>!!x,cooldownSeconds:()=>0,save(){},log(){},navigation(){navigations++;return true;}};
 vm.createContext(c);vm.runInContext(pve,c);assert.equal(c.pveTick(),false);assert.equal(navigations,0);now+=31000;assert.equal(c.pveTick(),true);assert.equal(navigations,1);
});
