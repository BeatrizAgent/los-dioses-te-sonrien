import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createHandler } from './handler.mjs';

const root = resolve('dist');
const catalog = JSON.parse(await readFile('src/data/catalog.json', 'utf8'));
const names = ['00-bootstrap.js','10-core-and-missions.js','20-healing.js','30-guild-market.js','40-popup-and-pve.js','50-combat-and-arena.js','60-panel-theme.js','60-panel.js'];
const fragments = await Promise.all(names.map(name => readFile(`src/bot/${name}`, 'utf8')));
const handler = createHandler(catalog, fragments);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon' };
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/los-dioses-te-sonrien.user.js') {
      const response = handler(new Request(url, { method: req.method }));
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
    if (url.pathname === '/') { res.writeHead(302, { Location: '/los-dioses-te-sonrien/' }); res.end(); return; }
    const prefix = '/los-dioses-te-sonrien/';
    if (!url.pathname.startsWith(prefix)) { res.writeHead(404); res.end(); return; }
    const path = decodeURIComponent(url.pathname.slice(prefix.length));
    const file = resolve(root, path || 'index.html');
    if (!file.startsWith(root + sep)) { res.writeHead(404); res.end(); return; }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(404); res.end('No encontrado'); }
}).listen(Number(process.env.PORT || 3000), '0.0.0.0');
