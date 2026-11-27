import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_CONFIG, normalizeBuildConfig, buildUserscript } from '../src/lib/build-config.mjs';
import { configToSearch, searchToConfig } from '../src/lib/install-link.mjs';

const catalog = JSON.parse(await readFile(new URL('../src/data/catalog.json', import.meta.url), 'utf8'));
const moduleFiles = [
  '00-bootstrap.js',
  '10-core-and-missions.js',
  '20-healing.js',
  '30-guild-market.js',
  '40-popup-and-pve.js',
  '50-combat-and-arena.js',
  '60-panel-theme.js',
  '60-panel.js',
];
const fragments = await Promise.all(
  moduleFiles.map(name => readFile(new URL(`../src/bot/${name}`, import.meta.url), 'utf8'))
);

test('allianceChat es opcional por defecto y se serializa en enlaces de instalación', () => {
  assert.equal(normalizeBuildConfig(DEFAULT_CONFIG, catalog).allianceChat, false);
  const enabled = { ...DEFAULT_CONFIG, allianceChat: true };
  assert.equal(normalizeBuildConfig(enabled, catalog).allianceChat, true);

  const search = configToSearch(enabled);
  assert.equal(search.get('allianceChat'), '1');
  const parsed = searchToConfig(search);
  assert.equal(parsed.allianceChat, true);
  assert.equal(normalizeBuildConfig(parsed, catalog).allianceChat, true);

  assert.equal(searchToConfig(configToSearch(DEFAULT_CONFIG)).allianceChat, false);
  assert.throws(() => searchToConfig(new URLSearchParams('v=1&modules=missions&level=20&region=%C3%81frica&allianceChat=bad')), /chat de alianza/);
});

test('el userscript generado incluye la configuración allianceChat y excluye CassiusFerox', () => {
  const cfg = normalizeBuildConfig({ ...DEFAULT_CONFIG, allianceChat: true }, catalog);
  const script = buildUserscript(cfg, fragments);
  assert.ok(script.includes('"allianceChat":true'));
  assert.ok(script.includes('/api/chat/trigger'));
  assert.ok(script.includes('/api/outbox/ack'));
  assert.ok(script.includes("cassiusferox"));
});
