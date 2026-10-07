// =====================================================================
//  Carga public/js/app.js en un navegador simulado (jsdom), sin red ni
//  Supabase, y devuelve sus funciones de cálculo para poder probarlas.
//
//  app.js es un script clásico (no un módulo): se ejecuta dentro de una
//  función y al final se devuelven las funciones que interesan. Así no
//  hace falta cambiar app.js para testearlo.
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
  'deudaProveedores', 'estaCerrado'
];

export function cargarApp() {
  const html = fs.readFileSync(path.join(RAIZ, 'public/index.html'), 'utf8');
  document.body.innerHTML = html
    .match(/<body>([\s\S]*)<\/body>/)[1]
    .replace(/<script[\s\S]*?<\/script>/g, '');

  window.CONFIG = { url: 'https://prueba.supabase.co', key: 'sb_publishable_prueba' };
  window.supabase = supabaseFalso();

  const codigo = fs.readFileSync(path.join(RAIZ, 'public/js/app.js'), 'utf8');
  const salida = `\nreturn { ${EXPORTAR.join(', ')},
    fijarDatos: d => { D = d; }, fijarPerfil: p => { perfil = p; } };`;
  return new Function(codigo + salida)();
}

// Estructura vacía de D, con todas las colecciones que usa app.js.
export function datosVacios() {
  return {
    obras: [], rubros: [], cajas: [], clases: [], presupuestos: [], inversores: [],
    aportes: [], comprobantes: [], avances: [], documentos: [], cierres: [],
    participaciones: [], ventas: [], fichas: [], proveedores: [], pedidos: [],
    respuestas: [], analisis: [], niveles: [], indices: [], cuotas: [], enlaces: [],
    unidades_obra: []
  };
}
