/**
 * Schlanker statischer Server fuer die lokale Kontrolle.
 * Bildet das Verhalten von Vercel nach: '/pfad/' liefert 'pfad/index.html',
 * unbekannte Adressen liefern 404.html mit Statuscode 404.
 *
 *   node scripts/serve.mjs [verzeichnis] [port]
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIR = join(ROOT, process.argv[2] || 'dist');
const PORT = Number(process.argv[3] || 4174);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2'
};

async function resolve(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  const candidates = clean.endsWith('/')
    ? [join(DIR, clean, 'index.html')]
    : [join(DIR, clean), join(DIR, clean, 'index.html'), join(DIR, clean + '/index.html')];
  for (const c of candidates) {
    try { if ((await stat(c)).isFile()) return c; } catch {}
  }
  return null;
}

createServer(async (req, res) => {
  const file = await resolve(req.url || '/');
  if (!file) {
    let body = 'Not found';
    try { body = await readFile(join(DIR, '404.html')); } catch {}
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(body);
  }
  const type = TYPES[extname(file)] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type });
  res.end(await readFile(file));
}).listen(PORT, () => console.log(`Lokal: http://localhost:${PORT}/  (aus ${DIR})`));
