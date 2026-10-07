// =====================================================================
//  Arma la carpeta dist/ con SOLO los archivos que se publican.
//
//  Uso:   node scripts/preparar-publicacion.mjs
//  Después: arrastrar la carpeta dist/ a Vercel (o, más adelante,
//  Vercel la publica solo desde GitHub).
//
//  Nunca publicar la carpeta del proyecto entera: tiene respaldos con
//  datos reales, migraciones, scripts y pruebas.
// =====================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(RAIZ, 'dist');

const PUBLICOS = [
  'index.html', 'app.js', 'config.js', 'estilos.css', 'sw.js', 'manifest.json',
  'rendicion.html', 'fondo.svg', 'icono-192.png', 'icono-512.png', 'apple-touch-icon.png'
];

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST);
for (const f of PUBLICOS) fs.copyFileSync(path.join(RAIZ, f), path.join(DIST, f));

// Control: config.js tiene que tener solo la publishable key.
const config = fs.readFileSync(path.join(DIST, 'config.js'), 'utf8');
if (/service_role|sb_secret_|eyJ[\w-]+\.[\w-]+\.[\w-]+/.test(config) || !/sb_publishable_/.test(config)) {
  console.error('config.js no tiene una publishable key válida o contiene una clave secreta. No publicar.');
  process.exit(1);
}

console.log(`dist/ lista con ${PUBLICOS.length} archivos:`);
for (const f of PUBLICOS) console.log('  ' + f);
