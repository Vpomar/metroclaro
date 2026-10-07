// =====================================================================
//  Clientes: genera la configuración de cada uno a partir de clientes.json
//
//  Un único proyecto de Vercel sirve a todos los clientes. Cada cliente
//  entra por su subdominio, y vercel.json le entrega SU config.js:
//
//    stgo.metroclaro.com.ar/config.js     → public/clientes/stgo.js
//    staging.metroclaro.com.ar/config.js  → public/clientes/staging.js
//    cualquier otro dominio (previews)    → el cliente "porDefecto" (staging)
//
//  Uso:   npm run clientes
//  Genera public/clientes/*.js y la sección "rewrites" de vercel.json.
//  Los archivos generados se commitean; una prueba de la CI falla si
//  quedaron desincronizados de clientes.json.
// =====================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CARPETA = path.join(RAIZ, 'public/clientes');

export function leerClientes() {
  return JSON.parse(fs.readFileSync(path.join(RAIZ, 'clientes.json'), 'utf8'));
}

// Devuelve la lista de errores (vacía si todo está bien).
export function validar(datos) {
  const errores = [];
  const lista = datos?.clientes ?? [];
  if (!lista.length) errores.push('No hay clientes');
  const ids = new Set(), dominios = new Set();
  for (const c of lista) {
    const q = `cliente "${c.id ?? '?'}"`;
    if (!/^[a-z0-9-]+$/.test(c.id ?? '')) errores.push(`${q}: id solo con minúsculas, números y guiones`);
    if (ids.has(c.id)) errores.push(`${q}: id repetido`);
    ids.add(c.id);
    if (!c.nombre?.trim()) errores.push(`${q}: falta nombre`);
    if (!['produccion', 'staging'].includes(c.entorno)) errores.push(`${q}: entorno tiene que ser produccion o staging`);
    if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(c.supabaseUrl ?? '')) errores.push(`${q}: supabaseUrl inválida`);
    if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(c.supabaseKey ?? '')) errores.push(`${q}: supabaseKey tiene que ser una publishable key`);
    if (/sb_secret_|service_role|^eyJ/.test(c.supabaseKey ?? '')) errores.push(`${q}: supabaseKey parece SECRETA, nunca va al navegador`);
    if (!Array.isArray(c.dominios) || !c.dominios.length) errores.push(`${q}: falta al menos un dominio`);
    for (const d of c.dominios ?? []) {
      // Cada cliente entra por <cliente>.metroclaro.com.ar. Se admiten además
      // direcciones técnicas de Vercel (*.vercel.app).
      if (!/^[a-z0-9-]+\.metroclaro\.com\.ar$|^[a-z0-9-]+\.vercel\.app$/.test(d))
        errores.push(`${q}: el dominio "${d}" tiene que ser <subdominio>.metroclaro.com.ar`);
      if (dominios.has(d)) errores.push(`${q}: el dominio "${d}" ya es de otro cliente`);
      dominios.add(d);
    }
  }
  const def = lista.find(c => c.id === datos?.porDefecto);
  if (!def) errores.push('porDefecto tiene que ser el id de un cliente');
  else if (def.entorno !== 'staging') errores.push('porDefecto tiene que ser de staging: un dominio desconocido nunca debe ver datos de un cliente real');
  return errores;
}

export function textoConfig(c) {
  const config = { url: c.supabaseUrl, key: c.supabaseKey, cliente: c.nombre, entorno: c.entorno };
  return `// Generado por scripts/clientes.mjs desde clientes.json. No editar a mano.
window.CONFIG = ${JSON.stringify(config, null, 2)};
`;
}

// Una regla por dominio y, al final, la regla por defecto (sin condición).
export function reglas(datos) {
  const r = [];
  for (const c of datos.clientes)
    for (const d of c.dominios)
      r.push({ source: '/config.js', has: [{ type: 'host', value: d }], destination: `/clientes/${c.id}.js` });
  r.push({ source: '/config.js', destination: `/clientes/${datos.porDefecto}.js` });
  return r;
}

export function generar() {
  const datos = leerClientes();
  const errores = validar(datos);
  if (errores.length) throw new Error('clientes.json tiene errores:\n  - ' + errores.join('\n  - '));

  fs.rmSync(CARPETA, { recursive: true, force: true });
  fs.mkdirSync(CARPETA, { recursive: true });
  for (const c of datos.clientes) fs.writeFileSync(path.join(CARPETA, `${c.id}.js`), textoConfig(c));

  const archivoVercel = path.join(RAIZ, 'vercel.json');
  const vercel = JSON.parse(fs.readFileSync(archivoVercel, 'utf8'));
  vercel.rewrites = reglas(datos);
  fs.writeFileSync(archivoVercel, JSON.stringify(vercel, null, 2) + '\n');
  return datos;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const datos = generar();
    for (const c of datos.clientes) console.log(`  ${c.id.padEnd(10)} ${c.entorno.padEnd(11)} ${c.dominios.join(', ')}`);
    console.log(`Listo: public/clientes/ y vercel.json. Por defecto: ${datos.porDefecto}.`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
