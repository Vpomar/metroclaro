// =====================================================================
//  Servidor local de desarrollo
//
//  Sirve la aplicación en http://localhost:8000 y reemplaza config.js
//  por los valores de .env.local, así se puede trabajar contra staging
//  sin tocar el config.js que se publica.
//
//  Uso:   node scripts/servidor-local.mjs
//  .env.local (no se sube al repo):
//    SUPABASE_URL=https://xxxx.supabase.co
//    SUPABASE_KEY=sb_publishable_...
//    PUERTO=8000
// =====================================================================

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const env = {};
const archivoEnv = path.join(RAIZ, '.env.local');
if (fs.existsSync(archivoEnv)) {
  for (const linea of fs.readFileSync(archivoEnv, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2];
  }
}
const PUERTO = Number(process.env.PUERTO || env.PUERTO || 8000);
const URL_SB = process.env.SUPABASE_URL || env.SUPABASE_URL;
const KEY = process.env.SUPABASE_KEY || env.SUPABASE_KEY;

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json'
};

// Solo se sirven los archivos de la aplicación, nunca respaldos ni secretos.
const PROHIBIDO = /(^|\/)(\.|respaldos|node_modules|supabase|tests|scripts)/;

http.createServer((req, res) => {
  const ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (ruta === '/config.js' && URL_SB && KEY) {
    res.writeHead(200, { 'Content-Type': TIPOS['.js'], 'Cache-Control': 'no-store' });
    return res.end(`window.CONFIG = ${JSON.stringify({ url: URL_SB, key: KEY })};\n`);
  }
  const relativa = ruta === '/' ? 'index.html' : ruta.replace(/^\/+/, '');
  const archivo = path.join(RAIZ, relativa);
  if (PROHIBIDO.test(relativa) || !archivo.startsWith(RAIZ) || !fs.existsSync(archivo)
      || fs.statSync(archivo).isDirectory()) {
    res.writeHead(404); return res.end('No encontrado');
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo)] || 'application/octet-stream',
                       'Cache-Control': 'no-store' });
  fs.createReadStream(archivo).pipe(res);
}).listen(PUERTO, '127.0.0.1', () => {
  const destino = URL_SB ? URL_SB : 'config.js (sin .env.local)';
  console.log(`Aplicación en http://localhost:${PUERTO}  →  Supabase: ${destino}`);
});
