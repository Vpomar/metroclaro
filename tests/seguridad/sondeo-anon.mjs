// =====================================================================
//  Sondeo de seguridad como visitante sin sesión (rol anon)
//
//  Uso:
//    SUPABASE_URL=https://xxx.supabase.co SUPABASE_KEY=sb_publishable_... \
//      node tests/seguridad/sondeo-anon.mjs [--escritura]
//
//  Solo pide conteos y nombres de columnas: nunca imprime datos.
//  --escritura agrega pruebas que intentan escribir. Usarlo solo
//  contra staging: si la protección fallara, la escritura ocurriría.
// =====================================================================

const URL_SB = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_KEY;
const ESCRITURA = process.argv.includes('--escritura');
if (!URL_SB || !KEY) { console.error('Faltan SUPABASE_URL y SUPABASE_KEY'); process.exit(2); }

const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const VISTAS = ['v_analisis','v_cuotas','v_honorarios','v_inversores','v_iva','v_obras',
  'v_proveedores','v_rubros','v_superficies','v_unidades','v_ventas'];
const TABLAS = ['perfiles','obras','clases','rubros','presupuestos','cajas','inversores',
  'participaciones','aportes','comprobantes','ventas','avances','documentos','fichas',
  'analisis','niveles','proveedores','pedidos','pedido_respuestas','indices','cuotas',
  'auditoria','cierres','enlaces','unidades'];

let fallas = 0;
const ok  = (m) => console.log('  ok    ' + m);
const mal = (m) => { fallas++; console.log('  FALLA ' + m); };

async function filas(objeto) {
  const r = await fetch(`${URL_SB}/rest/v1/${objeto}?select=*&limit=0`,
    { headers: { ...H, Prefer: 'count=exact' } });
  await r.text();
  const total = Number((r.headers.get('content-range') || '*/0').split('/')[1]) || 0;
  return { status: r.status, total };
}

console.log('\nVistas: no deben ser legibles');
for (const v of VISTAS) {
  const { status, total } = await filas(v);
  status >= 400 || total === 0 ? ok(`${v} (${status})`) : mal(`${v} devuelve ${total} filas`);
}

console.log('\nTablas: anon no debe ver filas');
for (const t of TABLAS) {
  const { status, total } = await filas(t);
  status >= 400 || total === 0 ? ok(`${t} (${status})`) : mal(`${t} devuelve ${total} filas`);
}

console.log('\nFunciones de la base: anon no debe ejecutarlas');
for (const [f, cuerpo] of [['rol_actual', {}], ['obra_visible', { o: '00000000-0000-0000-0000-000000000000' }],
                           ['periodo_cerrado', { p_obra: '00000000-0000-0000-0000-000000000000' }]]) {
  const r = await fetch(`${URL_SB}/rest/v1/rpc/${f}`, { method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
  await r.text();
  r.status >= 400 ? ok(`${f} (${r.status})`) : mal(`${f} ejecutable (${r.status})`);
}

console.log('\nArchivos: anon no debe listar');
for (const b of ['comprobantes', 'avance', 'documentos']) {
  const r = await fetch(`${URL_SB}/storage/v1/object/list/${b}`, { method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefix: '', limit: 10 }) });
  const j = await r.json().catch(() => null);
  !Array.isArray(j) || j.length === 0 ? ok(`${b}`) : mal(`${b} lista ${j.length} elementos`);
}

console.log('\nAuth: el registro público debe estar cerrado');
const s = await (await fetch(`${URL_SB}/auth/v1/settings`, { headers: H })).json();
s.disable_signup ? ok('disable_signup = true') : mal('el registro público está abierto');
!s.mailer_autoconfirm ? ok('mailer_autoconfirm = false') : mal('el email se confirma solo');

console.log('\nEdge Functions: deben exigir un usuario');
for (const [fn, cuerpo] of [['leer-comprobante', {}], ['asistente', { accion: 'nada' }],
                            ['gestionar-usuarios', { accion: 'nada' }]]) {
  const r = await fetch(`${URL_SB}/functions/v1/${fn}`, { method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
  await r.text();
  if (r.status === 404) { console.log(`  --    ${fn} no está desplegada`); continue; }
  r.status === 401 || r.status === 403 ? ok(`${fn} (${r.status})`) : mal(`${fn} responde ${r.status} sin usuario`);
}

if (ESCRITURA) {
  console.log('\nEscritura (solo staging): anon no debe poder insertar');
  const r = await fetch(`${URL_SB}/rest/v1/auditoria`, { method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ tabla: 'sondeo', accion: 'alta', usuario: 'sondeo-anon' }) });
  await r.text();
  r.status >= 400 ? ok(`insert en auditoria rechazado (${r.status})`) : mal(`insert en auditoria aceptado (${r.status})`);
}

console.log(`\n${fallas === 0 ? 'SIN FALLAS' : fallas + ' FALLA(S)'}\n`);
process.exit(fallas === 0 ? 0 : 1);
