import { buildUserscript, normalizeBuildConfig } from '../src/lib/build-config.mjs';
import { searchToConfig } from '../src/lib/install-link.mjs';

export function createHandler(catalog, fragments) {
  return request => {
    const url = new URL(request.url);
    if (url.pathname !== '/los-dioses-te-sonrien.user.js') return new Response('No encontrado', { status: 404 });
    if (request.method !== 'GET') return new Response('Método no permitido', { status: 405, headers: { Allow: 'GET' } });
    try {
      const config = normalizeBuildConfig(searchToConfig(url.searchParams), catalog);
      return new Response(buildUserscript(config, fragments), { headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' } });
    } catch (error) {
      return new Response(`Configuración no válida: ${error.message}`, { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
    }
  };
}
