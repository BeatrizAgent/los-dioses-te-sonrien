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
    visible: () => false, captcha: () => false, verified: () => true, lootTick: () => false,
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
