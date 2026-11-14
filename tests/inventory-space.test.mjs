import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../src/bot/20-healing.js', import.meta.url), 'utf8');
const code = source.slice(source.indexOf('  function inventorySpace('), source.indexOf('  function rememberUnknownPackageFood('));
const ctx = {visible: item => item.visible !== false};
vm.createContext(ctx);
vm.runInContext(code, ctx);

function bag(cols, rows, items = [], scale = 1) {
  return {
    inv: {offsetWidth: cols * 32, offsetHeight: rows * 32, getBoundingClientRect: () => ({left: 0, top: 0, width: cols * 32 * scale, height: rows * 32 * scale})},
    items: items.map(([x, y, w, h]) => ({getAttribute: name => ({'data-measurement-x': String(w), 'data-measurement-y': String(h)})[name] ?? null, getBoundingClientRect: () => ({left: x * 32 * scale, top: y * 32 * scale})})),
  };
}

test('baúl vacío, lleno y una sola casilla libre', () => {
  assert.equal(ctx.inventorySpace(bag(2, 2), {width: 2, height: 2}), true);
  assert.equal(ctx.inventorySpace(bag(2, 2, [[0, 0, 2, 2]]), {width: 1, height: 1}), false);
  assert.equal(ctx.inventorySpace(bag(2, 2, [[0, 0, 2, 1], [0, 1, 1, 1]]), {width: 1, height: 1}), true);
});

test('espacio fragmentado no equivale a hueco contiguo', () => {
  const inventory = bag(2, 2, [[0, 0, 1, 1], [1, 1, 1, 1]]);
  assert.equal(ctx.inventorySpace(inventory, {width: 1, height: 1}), true);
  assert.equal(ctx.inventorySpace(inventory, {width: 2, height: 1}), false);
});

test('escala visual y geometría incompleta o contradictoria', () => {
  for (const scale of [1, 1.25, 1.5]) assert.equal(ctx.inventorySpace(bag(2, 2, [[0, 0, 1, 1]], scale), {width: 1, height: 1}), true);
  assert.equal(ctx.inventorySpace(bag(2, 2, [[0, 0, 2, 2], [1, 1, 1, 1]]), {width: 1, height: 1}), false);
  const incomplete = bag(2, 2); incomplete.inv.offsetWidth = 0;
  assert.equal(ctx.inventorySpace(incomplete, {width: 1, height: 1}), false);
  assert.equal(ctx.inventorySpace(bag(2, 2), {width: 0, height: 1}), false);
});

test('recogida con baúl lleno no despacha ni crea operación pendiente', () => {
  const tick = source.slice(source.indexOf('  function packageFoodTick()'), source.indexOf('  function skipHealing('));
  const inventory = bag(1, 1, [[0, 0, 1, 1]]);
  const occupied = inventory.items[0];
  const originalGet = occupied.getAttribute;
  occupied.getAttribute = name => name === 'data-hash' ? 'existing' : name === 'data-container-number' ? '512' : originalGet(name);
  inventory.inv.querySelectorAll = () => inventory.items;
  const attrs = {'data-hash': 'food', 'data-measurement-x': '1', 'data-measurement-y': '1'};
  let clicks = 0, skipped = '';
  const food = {getAttribute: name => attrs[name] ?? null, hasAttribute: () => true, dispatchEvent: () => clicks++};
  const selected = {classList: {contains: () => true}, getAttribute: () => '512'};
  const state = {packageScan: {key: '1:7', at: 1}};
  const context = {state, mod: 'packages', params: new URLSearchParams('f=7'), Date: {now: () => 10000},
    document: {querySelector: name => ({'#inv': inventory.inv, '#packages': {querySelectorAll: () => [food]}, '#inventory_nav a': selected})[name] ?? null},
    visible: x => !!x, validItemHash: x => !!x, healingFood: item => ({item, name: 'Comida', level: null}),
    skipHealing: message => { skipped = message; }, save: () => {}, BUILD_CONFIG: {modules: {foodMarket: false}}};
  vm.createContext(context);
  vm.runInContext(code + tick, context);
  context.packageFoodTick();
  assert.equal(clicks, 0);
  assert.equal(state.pendingPackageFood, undefined);
  assert.match(skipped, /lleno|no verificable/);
});
