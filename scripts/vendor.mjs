// =====================================================================
//  Librerías propias del sitio: public/vendor/
//
//  La lectura de comprobantes usa tres librerías que se cargan solo
//  cuando hacen falta (QR, PDF y OCR). Se sirven desde nuestro dominio,
//  no desde un CDN: así no dependen de terceros y el worker y el wasm
//  que cargan por su cuenta no quedan fuera del control de versiones.
//
//  Las versiones salen de package.json (devDependencies, versión exacta).
//  Para actualizar: cambiar la versión, `npm install` y `npm run vendor`.
//  Los archivos copiados se commitean (Vercel no instala dependencias);
//  una prueba unitaria falla si quedaron distintos a node_modules.
//
//  Uso:   node scripts/vendor.mjs
// =====================================================================

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NM = path.join(RAIZ, 'node_modules');
export const DESTINO = path.join(RAIZ, 'public', 'vendor');

const version = (paquete) =>
  JSON.parse(fs.readFileSync(path.join(NM, paquete, 'package.json'), 'utf8')).version;

// Cada carpeta lleva la versión en el nombre: si cambia la versión cambia
// la ruta, y por eso Vercel puede guardarlas en caché para siempre.
export function archivos() {
  const qr = `zxing-${version('zxing-wasm')}`;
  const pdf = `pdfjs-${version('pdfjs-dist')}`;
  const tess = `tesseract-${version('tesseract.js')}`;
  const core = `tesseract-core-${version('tesseract.js-core')}`;
  const spa = `tesseract-spa-${version('@tesseract.js-data/spa')}`;
  return [
    // Lector de QR (ZXing compilado a WebAssembly): lee fotos de celular
    // mejor que las alternativas en JavaScript puro
    ['zxing-wasm/dist/iife/reader/index.js', `${qr}/zxing-reader.js`],
    ['zxing-wasm/dist/reader/zxing_reader.wasm', `${qr}/zxing_reader.wasm`],
    // La versión "legacy" funciona también en iPhones con Safari no tan nuevos
    ['pdfjs-dist/legacy/build/pdf.min.mjs', `${pdf}/pdf.min.mjs`],
    ['pdfjs-dist/legacy/build/pdf.worker.min.mjs', `${pdf}/pdf.worker.min.mjs`],
    ['tesseract.js/dist/tesseract.min.js', `${tess}/tesseract.min.js`],
    ['tesseract.js/dist/worker.min.js', `${tess}/worker.min.js`],
    // Tesseract elige solo entre estas tres según lo que soporte el equipo
    ['tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', `${core}/tesseract-core-relaxedsimd-lstm.wasm.js`],
    ['tesseract.js-core/tesseract-core-simd-lstm.wasm.js', `${core}/tesseract-core-simd-lstm.wasm.js`],
    ['tesseract.js-core/tesseract-core-lstm.wasm.js', `${core}/tesseract-core-lstm.wasm.js`],
    // Modelo de castellano "best_int": preciso y de 2 MB (el completo pesa 8 MB)
    ['@tesseract.js-data/spa/4.0.0_best_int/spa.traineddata.gz', `${spa}/spa.traineddata.gz`]
  ].map(([origen, destino]) => ({ origen: path.join(NM, origen), destino: path.join(DESTINO, destino) }));
}

export const sha256 = (archivo) => createHash('sha256').update(fs.readFileSync(archivo)).digest('hex');

export function copiar() {
  fs.rmSync(DESTINO, { recursive: true, force: true });
  const lineas = [];
  for (const { origen, destino } of archivos()) {
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.copyFileSync(origen, destino);
    const rel = path.relative(DESTINO, destino).replaceAll('\\', '/');
    lineas.push(`| \`${rel}\` | ${(fs.statSync(destino).size / 1024).toFixed(0)} KB | \`${sha256(destino).slice(0, 16)}…\` |`);
  }
  fs.writeFileSync(path.join(DESTINO, 'LEEME.md'), `# public/vendor

Librerías de terceros servidas desde nuestro dominio. **No editar a mano**:
las copia \`npm run vendor\` desde \`node_modules\` (versiones exactas en
\`package.json\`). Las usa la lectura de comprobantes
(\`js/formularios/lectura-comprobante.js\`) y se cargan solo cuando hacen falta.

| Archivo | Tamaño | sha256 |
|---|---|---|
${lineas.join('\n')}
`);
  return lineas.length;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Listo: ${copiar()} archivos en public/vendor/.`);
}
