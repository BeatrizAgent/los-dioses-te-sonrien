import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildUserscript, DEFAULT_CONFIG, normalizeBuildConfig } from '../src/lib/build-config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(await readFile(path.resolve(root, 'src/data/catalog.json'), 'utf8'));
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
const fragments = await Promise.all(moduleFiles.map(name => readFile(path.resolve(root, 'src/bot', name), 'utf8')));
const config = normalizeBuildConfig(DEFAULT_CONFIG, catalog);
const result = buildUserscript(config, fragments);
if (result.includes('__BUILD_CONFIG__')) throw new Error('Quedó un marcador de configuración sin resolver.');
const output = path.resolve(root, '.generated/los-dioses-te-sonrien.user.js');
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, result, 'utf8');
console.log(`Userscript generado: ${path.relative(root, output)} (${result.length} caracteres).`);
