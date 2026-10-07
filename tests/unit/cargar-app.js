// =====================================================================
//  Carga los scripts de public/js/ en un navegador simulado (jsdom), sin
//  red ni Supabase, y devuelve sus funciones para poder probarlas.
//
//  Los scripts son clásicos (no módulos) y comparten el ámbito global:
//  se concatenan en el MISMO orden en que los carga index.html, se
//  ejecutan dentro de una función y al final se devuelven las funciones
//  que interesan. Así se prueba también que ese orden funcione.
// =====================================================================
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '../..');

// Supabase falso: la app arranca sin sesión y cualquier consulta falla,
// para que ninguna prueba dependa de la red por accidente.
function supabaseFalso() {
  const sinRed = () => { throw new Error('Las pruebas unitarias no usan la red'); };
  return {
    createClient: () => ({
      auth: {
        getSession: async () => ({ data: { session: null } }),
        getUser: async () => ({ data: { user: null } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
        signOut: async () => ({})
      },
      from: sinRed, rpc: sinRed, storage: { from: sinRed }, functions: { invoke: sinRed }
    })
  };
}

const EXPORTAR = [
  'fechaLocal', 'hoy', 'sumarMeses', 'fecha', 'esc', 'fmtUsd',
  'totalesObra', 'saldoCaja', 'baseEjecutada', 'honorarios', 'presu',
  'clasesDe', 'unidades', 'serieCac', 'cacDe', 'cacUltimo', 'montoCuota',
  'deudaProveedores', 'estaCerrado',
  'numeroAR', 'cuitValido', 'fechaISO', 'claveNumero', 'leerQrArca', 'leerTextoComprobante',
  'combinarLecturas', 'faltantesLectura', 'proveedorPorCuit', 'comprobanteDuplicado'
];

// Scripts propios de la app, en el orden de index.html (sin config.js ni CDN).
export function scriptsDeLaApp() {
  const html = fs.readFileSync(path.join(RAIZ, 'public/index.html'), 'utf8');
  return [...html.matchAll(/<script src="(js\/[^"]+)"/g)].map(m => m[1]);
}

export function codigoDeLaApp() {
  return scriptsDeLaApp()
    .map(s => fs.readFileSync(path.join(RAIZ, 'public', s), 'utf8'))
    .join('\n');
}

export function cargarApp() {
  const html = fs.readFileSync(path.join(RAIZ, 'public/index.html'), 'utf8');
  document.body.innerHTML = html
    .match(/<body>([\s\S]*)<\/body>/)[1]
    .replace(/<script[\s\S]*?<\/script>/g, '');

  window.CONFIG = { url: 'https://prueba.supabase.co', key: 'sb_publishable_prueba' };
  window.supabase = supabaseFalso();

  const codigo = codigoDeLaApp();
  const salida = `\nreturn { ${EXPORTAR.join(', ')},
    fijarDatos: d => { D = d; }, fijarPerfil: p => { perfil = p; } };`;
  return new Function(codigo + salida)();
}

// Estructura vacía de D, con todas las colecciones que usa la app.
export function datosVacios() {
  return {
    obras: [], rubros: [], cajas: [], clases: [], presupuestos: [], inversores: [],
    aportes: [], comprobantes: [], avances: [], documentos: [], cierres: [],
    participaciones: [], ventas: [], fichas: [], proveedores: [], pedidos: [],
    respuestas: [], analisis: [], niveles: [], indices: [], cuotas: [], enlaces: [],
    unidades_obra: []
  };
}
