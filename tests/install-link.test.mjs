import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_CONFIG } from '../src/lib/build-config.mjs';
import { configToSearch, searchToConfig } from '../src/lib/install-link.mjs';
import { createHandler } from '../worker/handler.mjs';
const catalog = JSON.parse(await readFile(new URL('../src/data/catalog.json', import.meta.url), 'utf8'));
const names = ['00-bootstrap.js','10-core-and-missions.js','20-healing.js','30-guild-market.js','40-popup-and-pve.js','50-combat-and-arena.js','60-panel-theme.js','60-panel.js'];
const fragments = await Promise.all(names.map(name => readFile(new URL(`../src/bot/${name}`, import.meta.url), 'utf8')));
const handler = createHandler(catalog, fragments);
test('el enlace reconstruye la selección y devuelve un userscript instalable', async () => {
  const input = {...DEFAULT_CONFIG, playerLevel: 90, modules: {...DEFAULT_CONFIG.modules, expedition: true}, expeditionAreaId: 'af-gorge', expeditionEnemyId: 'af-gorge-high-shaman'};
  const params = configToSearch(input);
  assert.deepEqual(searchToConfig(params).modules, input.modules);
  const response = handler(new Request(`https://example.com/los-dioses-te-sonrien.user.js?${params}`));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /javascript/);
  const text = await response.text();
  assert.match(text, /^\/\/ ==UserScript==/);
  assert.match(text, /Sumo Chamán/);
  assert.doesNotMatch(text, /__BUILD_CONFIG__/);
});
test('el servicio rechaza módulos y niveles inválidos', () => {
  for (const query of ['v=1&level=999&region=Italia&modules=missions', 'v=1&level=20&region=Italia&modules=bad']) {
    assert.equal(handler(new Request(`https://example.com/los-dioses-te-sonrien.user.js?${query}`)).status, 400);
  }
});

test('el enlace conserva el límite y los enlaces antiguos mantienen tres derrotas', async () => {
  const input = { ...DEFAULT_CONFIG, modules: { ...DEFAULT_CONFIG.modules, dungeon: true }, dungeonLossLimit: 5 };
  const params = configToSearch(input);
  const response = handler(new Request(`https://example.com/los-dioses-te-sonrien.user.js?${params}`));
  assert.match(await response.text(), /"lossLimit":5/);
  params.delete('losses');
  assert.match(await (await handler(new Request(`https://example.com/los-dioses-te-sonrien.user.js?${params}`))).text(), /"lossLimit":3/);
  for (const invalid of ['0', '11', '1.5', '']) { params.set('losses', invalid); assert.equal(handler(new Request(`https://example.com/los-dioses-te-sonrien.user.js?${params}`)).status, 400); }
});
