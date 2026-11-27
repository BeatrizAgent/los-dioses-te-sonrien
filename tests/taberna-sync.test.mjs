import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_CONFIG, normalizeBuildConfig, buildUserscript } from '../src/lib/build-config.mjs';
import { configToSearch, searchToConfig } from '../src/lib/install-link.mjs';

const catalog=JSON.parse(await readFile(new URL('../src/data/catalog.json',import.meta.url),'utf8'));
test('sincronización es opcional y sobrevive a enlaces de instalación',()=>{
  assert.equal(normalizeBuildConfig(DEFAULT_CONFIG,catalog).tabernaSync,false);
  const source={...DEFAULT_CONFIG,tabernaSync:true};
  const parsed=searchToConfig(configToSearch(source));
  assert.equal(normalizeBuildConfig(parsed,catalog).tabernaSync,true);
  assert.equal(searchToConfig(configToSearch(DEFAULT_CONFIG)).tabernaSync,false);
  assert.throws(()=>searchToConfig(new URLSearchParams('v=1&taberna=bad')),/taberna/);
});
