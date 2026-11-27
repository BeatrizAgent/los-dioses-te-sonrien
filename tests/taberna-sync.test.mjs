import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_CONFIG, normalizeBuildConfig, buildUserscript } from '../src/lib/build-config.mjs';
import { configToSearch, searchToConfig } from '../src/lib/install-link.mjs';
import vm from 'node:vm';

const catalog=JSON.parse(await readFile(new URL('../src/data/catalog.json',import.meta.url),'utf8'));
test('sincronización es opcional y sobrevive a enlaces de instalación',()=>{
  assert.equal(normalizeBuildConfig(DEFAULT_CONFIG,catalog).tabernaSync,false);
  const source={...DEFAULT_CONFIG,tabernaSync:true};
  const parsed=searchToConfig(configToSearch(source));
  assert.equal(normalizeBuildConfig(parsed,catalog).tabernaSync,true);
  assert.equal(searchToConfig(configToSearch(DEFAULT_CONFIG)).tabernaSync,false);
  assert.throws(()=>searchToConfig(new URLSearchParams('v=1&taberna=bad')),/taberna/);
});

test('identificador inválido se reemplaza incluso si la página modifica Number.toString',async()=>{
  const source=await readFile(new URL('../src/bot/60-panel.js',import.meta.url),'utf8');
  const match=source.match(/if \(!\/\^\[a-f0-9\]\{64\}\$\/.test\(token \|\| ''\)\) \{[^\n]+\}/);
  assert.ok(match, 'falta la generación de identificador');
  const saved={};
  const sandbox={token:'11625310524017525316910517222523911202019991246514466477518145215123403922013622022',key:'test',localStorage:{setItem:(k,v)=>saved[k]=v},crypto:{getRandomValues:bytes=>{bytes.set(Array.from({length:32},(_,i)=>i*8));return bytes;}}};
  vm.runInNewContext(`Number.prototype.toString = function () { return 'decimal'; }; ${match[0]}`,sandbox);
  assert.match(saved.test,/^[a-f0-9]{64}$/);
  assert.equal(saved.test.slice(0,8),'00081018');
});
