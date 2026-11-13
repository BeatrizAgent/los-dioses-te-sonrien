import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { buildUserscript, DEFAULT_CONFIG, normalizeBuildConfig } from '../src/lib/build-config.mjs';

const catalog = JSON.parse(await readFile(new URL('../src/data/catalog.json', import.meta.url), 'utf8'));
const names = ['00-bootstrap.js','10-core-and-missions.js','20-healing.js','30-guild-market.js','40-popup-and-pve.js','50-combat-and-arena.js','60-panel-theme.js','60-panel.js'];
const fragments = await Promise.all(names.map(name => readFile(new URL('../src/bot/' + name, import.meta.url), 'utf8')));

test('genera un userscript completo desde los ocho módulos y sustituye la configuración', () => {
  const config = normalizeBuildConfig(DEFAULT_CONFIG, catalog);
  const result = buildUserscript(config, fragments);
  assert.match(result, /@name\s+Los Dioses Te Sonríen/);
  assert.match(result, /@version\s+0\.12\.33/);
  assert.match(result, /const BUILD_CONFIG = Object\.freeze\(\{"playerLevel":20/);
  assert.ok(result.trimEnd().endsWith('})();'));
  assert.ok(!result.includes('__BUILD_CONFIG__'));
  assert.ok(!result.includes('gist.githubusercontent.com'));
  assert.doesNotThrow(() => new vm.Script(result));
});

test('la configuración conserva la posición elegida del enemigo', () => {
  const config = normalizeBuildConfig({
    playerLevel: 90,
    modules: { ...DEFAULT_CONFIG.modules, expedition: true },
    expeditionAreaId: 'af-gorge',
    expeditionEnemyId: 'af-gorge-high-shaman',
  }, catalog);
  assert.equal(config.expedition.enemy.name, 'Sumo Chamán');
  assert.equal(config.expedition.enemy.position, 4);
});

test('rechaza nivel, zona, objetivo y mazmorra fuera del catálogo accesible', () => {
  assert.throws(() => normalizeBuildConfig({ ...DEFAULT_CONFIG, playerLevel: 100 }, catalog), /entre 20 y 99/);
  assert.throws(() => normalizeBuildConfig({
    playerLevel: 20,
    modules: { ...DEFAULT_CONFIG.modules, expedition: true },
    expeditionAreaId: 'af-gorge',
    expeditionEnemyId: 'af-gorge-high-shaman',
  }, catalog), /no alcanza el acceso/);
  assert.throws(() => normalizeBuildConfig({
    playerLevel: 20,
    modules: { ...DEFAULT_CONFIG.modules, dungeon: true },
    dungeonId: 'dungeon-sasama-last-journey',
  }, catalog), /no alcanza el acceso/);
});

test('rechaza una expedición y una mazmorra de regiones distintas', () => {
  assert.throws(() => normalizeBuildConfig({
    playerLevel: 90,
    modules: { ...DEFAULT_CONFIG.modules, expedition: true, dungeon: true },
    expeditionAreaId: 'af-gorge',
    expeditionEnemyId: 'af-gorge-high-shaman',
    dungeonId: 'dungeon-dark-catacombs',
  }, catalog), /misma región/);
});

test('conserva región única cuando se activan ambos módulos PvE', () => {
  const config = normalizeBuildConfig({
    ...DEFAULT_CONFIG,
    modules: { ...DEFAULT_CONFIG.modules, expedition: true, dungeon: true },
  }, catalog);
  assert.equal(config.campaignRegion, 'África');
  assert.equal(config.expedition.area.region, config.campaignRegion);
  assert.equal(config.dungeon.region, config.campaignRegion);
});

test('rechaza objetivos PvE que no coinciden con la región seleccionada', () => {
  assert.throws(() => normalizeBuildConfig({
    playerLevel: 90,
    campaignRegion: 'Germania',
    modules: { ...DEFAULT_CONFIG.modules, expedition: true },
    expeditionAreaId: 'af-gorge',
    expeditionEnemyId: 'af-gorge-high-shaman',
  }, catalog), /región seleccionada/);
});

test('el código generado valida CAPTCHA y no contiene funciones premium añadidas por el generador', () => {
  const result = buildUserscript(normalizeBuildConfig(DEFAULT_CONFIG, catalog), fragments);
  assert.match(result, /CAPTCHA detectado\. Intervención humana requerida\./);
  assert.match(result, /rub\[ií\]\|diamant\|premium/);
});

test('los módulos opcionales se limitan según las casillas y preservan las comprobaciones pendientes', () => {
  assert.match(fragments[5], /BUILD_CONFIG\.modules\.guildGold && goldTick\(\)/);
  assert.match(fragments[5], /mod === 'quests' && BUILD_CONFIG\.modules\.missions/);
  assert.match(fragments[5], /!BUILD_CONFIG\.modules\.arenaCircus/);
  assert.match(fragments[5], /goldTick\(true\)/);
  assert.match(fragments[5], /state\.pendingHeal \|\| state\.packageFoodTrip/);
});
