import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { eligibleDungeons, eligibleExpeditions, normalizeBuildConfig, DEFAULT_CONFIG } from '../src/lib/build-config.mjs';

const catalog = JSON.parse(await readFile(new URL('../src/data/catalog.json', import.meta.url), 'utf8'));

test('catálogo incluye todas las zonas de Italia, África y Germania accesibles hasta nivel 99', () => {
  assert.equal(catalog.expeditions.length, 20);
  assert.deepEqual(new Set(catalog.expeditions.map(area => area.region)), new Set(['Italia', 'África', 'Germania']));
  assert.ok(catalog.expeditions.every(area => area.entryLevel <= 99 && area.enemies.length === 4));
  assert.equal(catalog.expeditions.flatMap(area => area.enemies).length, 80);
});

test('todos los monstruos tienen posición y rango de aparición válido', () => {
  for (const area of catalog.expeditions) {
    assert.deepEqual(area.enemies.map(enemy => enemy.position), [1, 2, 3, 4]);
    assert.ok(area.enemies.every(enemy => enemy.levelMin <= enemy.levelMax));
    assert.equal(area.enemies.filter(enemy => enemy.boss).length, 1);
  }
});

test('catálogo cubre las 22 mazmorras con requisito hasta nivel 99', () => {
  assert.equal(catalog.dungeons.length, 22);
  assert.ok(catalog.dungeons.every(dungeon => dungeon.entryLevel <= 99 && dungeon.levelMin <= dungeon.levelMax));
  assert.ok(!catalog.dungeons.some(dungeon => dungeon.entryLevel > 99));
  assert.ok(catalog.dungeons.some(dungeon => dungeon.levelMax > 99));
});

test('el nivel del personaje filtra acceso, sin recortar el nivel de aparición del enemigo', () => {
  assert.ok(eligibleExpeditions(catalog, 20).some(area => area.id === 'af-voodoo-temple'));
  assert.ok(!eligibleExpeditions(catalog, 20).some(area => area.id === 'it-ancient-temple'));
  assert.ok(eligibleDungeons(catalog, 99).some(dungeon => dungeon.id === 'dungeon-heart-of-decay'));
  assert.equal(catalog.expeditions.find(area => area.id === 'de-vandal-village').enemies[3].levelMax, 110);
});

test('expediciones y mazmorras se filtran por una región compartida', () => {
  assert.ok(eligibleExpeditions(catalog, 99, 'África').length > 0);
  assert.ok(eligibleExpeditions(catalog, 99, 'África').every(area => area.region === 'África'));
  assert.ok(eligibleDungeons(catalog, 99, 'Germania').length > 0);
  assert.ok(eligibleDungeons(catalog, 99, 'Germania').every(dungeon => dungeon.region === 'Germania'));
  for (const dungeon of catalog.dungeons) {
    const area = catalog.expeditions.find(row => row.id === dungeon.areaId);
    assert.equal(dungeon.region, area?.region, `${dungeon.name} y su zona deben compartir región`);
  }
});

test('el catálogo documenta referencias y discrepancias en vez de inventar el nombre español', () => {
  assert.ok(catalog.sources.some(source => source.id === 'official-expedition-guide'));
  assert.ok(catalog.sources.some(source => source.id === 'fansite-dungeons'));
  assert.match(catalog.dungeons.find(dungeon => dungeon.id === 'dungeon-true-owner').nameNote, /pendiente de confirmar/i);
  assert.match(catalog.dungeons.find(dungeon => dungeon.id === 'dungeon-sasama-last-journey').nameNote, /Akhekhu/);
});

test('la configuración por defecto mantiene apagados PvE y mercado', () => {
  const config = normalizeBuildConfig(DEFAULT_CONFIG, catalog);
  assert.equal(config.modules.guildGold, false);
  assert.equal(config.modules.expedition, false);
  assert.equal(config.modules.dungeon, false);
  assert.equal(config.modules.arenaCircus, true);
});
