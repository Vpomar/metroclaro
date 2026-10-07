/* =====================================================================
   Administración de obras — cliente conectado a Supabase
   ===================================================================== */

const sb = window.supabase.createClient(window.CONFIG.url, window.CONFIG.key);

const RUB_COND = 'Honorarios de conducción técnica';
const RUB_ADM  = 'Administración de obra';
const RUB_DES  = 'Honorarios de desarrolladora';
const HONORARIOS = [
  [RUB_COND, 'pct_conduccion'],
  [RUB_ADM,  'pct_administracion'],
  [RUB_DES,  'pct_desarrolladora']
];

let perfil = null;                 // { id, nombre, rol }
let D = null;                      // datos en memoria
let obraActiva = null;
let vista = 'panel';
let cotizacion = 1000, fuenteCotiz = null;
let tcCompra = null, tcVenta = null;
let tcRef = (() => { try { return localStorage.getItem('obras:tcref') || 'promedio'; }
                     catch(e){ return 'promedio'; } })();
let mesContador = 'todos', contDesde = '', contHasta = '', invRendicion = 'todos';
let filtroRubro = '', filtroProv = '', filtroTipo = '', filtroEstado = '', filtroTexto = '';
let ventaAbierta = null;
function abrirVenta(id){ ventaAbierta = ventaAbierta === id ? null : id; render(); }
let calcMonto = null, calcBase = 'participacion', calcMetodo = 'nivelar', calcMoneda = 'USD';
let usuarios = null;
let historial = null, historialObra = null;

/* ---------- utilidades ---------- */
const fmtUsd  = v => 'US$ ' + (+v||0).toLocaleString('es-AR',{maximumFractionDigits:0});
const fmtUsd2 = v => 'US$ ' + (+v||0).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtArs  = v => '$ ' + (+v||0).toLocaleString('es-AR',{maximumFractionDigits:0});
const fmtPct  = v => (+v||0).toLocaleString('es-AR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';
const fecha   = f => { if(!f) return '—'; const [a,m,d]=f.split('-'); return `${d}/${m}/${a}`; };
/* Fechas en hora local. toISOString() las pasa a UTC: en Argentina,
   después de las 21 h devolvía el día siguiente. */
const fechaLocal = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const hoy     = () => fechaLocal(new Date());
/* Suma meses a una fecha AAAA-MM-DD sin desbordar: el 31/01 más un mes
   es el 28/02 (o 29), no el 3 de marzo. */
function sumarMeses(f, n){
  const [a, m, d] = f.split('-').map(Number);
  const total = (m - 1) + n;
  const anio = a + Math.floor(total / 12), mes = ((total % 12) + 12) % 12;
  const ultimo = new Date(anio, mes + 1, 0).getDate();
  return fechaLocal(new Date(anio, mes, Math.min(d, ultimo)));
}
const esc     = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mesDe   = f => f.slice(0,7);
const nombreMes = m => { const [a,mm]=m.split('-');
  return new Date(+a,+mm-1,1).toLocaleDateString('es-AR',{month:'long',year:'numeric'}); };

const puedeEditar = () => perfil && (perfil.rol === 'admin' || perfil.rol === 'carga');
const esAdmin     = () => perfil && perfil.rol === 'admin';

function aviso(texto, mal){
  const el = document.getElementById('aviso');
  el.textContent = texto;
  el.className = 'aviso-flotante' + (mal ? ' mal' : '');
  clearTimeout(aviso.t);
  aviso.t = setTimeout(()=> el.classList.add('oculto'), 3200);
}

/* =====================================================================
   ACCESO
   ===================================================================== */
document.getElementById('form-acceso').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('btn-entrar');
  const err = document.getElementById('error-acceso');
  err.textContent = ''; btn.disabled = true; btn.textContent = 'Entrando…';
  const { error } = await sb.auth.signInWithPassword({
    email: document.getElementById('email').value.trim(),
    password: document.getElementById('clave').value
  });
  btn.disabled = false; btn.textContent = 'Entrar';
  if(error) err.textContent = error.message === 'Invalid login credentials'
    ? 'Email o contraseña incorrectos.' : error.message;
});

async function salir(){ await sb.auth.signOut(); location.reload(); }

sb.auth.onAuthStateChange((_evento, sesion) => { if(sesion) iniciar(); });

/* La instancia se deduce del subdominio: cada cliente entra por el suyo */
(() => {
  const p = document.getElementById('pie-instancia');
  if(!p) return;
  const h = location.hostname.split('.');
  const sub = h.length > 2 ? h[0] : '';
  p.textContent = sub && sub !== 'www'
    ? `Instancia ${sub}. Ingresá con tu cuenta.`
    : 'Ingresá con tu cuenta para continuar.';
})();

(async () => {
  if(window.CONFIG.key.startsWith('PEGAR')){
    document.getElementById('pie-acceso').textContent =
      'Falta configurar la clave en config.js.';
    return;
  }
  const { data } = await sb.auth.getSession();
  if(data.session) iniciar();
})();

async function iniciar(){
  if(perfil) return;
  const { data: sesion } = await sb.auth.getUser();
  // Sesión vencida o revocada: antes la app fallaba acá y quedaba en blanco.
  if(!sesion?.user){
    await sb.auth.signOut();
    document.getElementById('error-acceso').textContent =
      'Tu sesión venció. Ingresá de nuevo.';
    return;
  }
  const { data: p, error } = await sb.from('perfiles')
    .select('id,nombre,rol').eq('id', sesion.user.id).single();
  if(error || !p){
    document.getElementById('error-acceso').textContent =
      'Tu usuario no tiene perfil cargado. Avisá al administrador.';
    return;
  }
  perfil = p;
  document.getElementById('acceso').classList.add('oculto');
  document.getElementById('app').classList.remove('oculto');
  document.getElementById('quien').textContent = `${p.nombre} · ${p.rol}`;
  document.querySelectorAll('.solo-equipo').forEach(e => { if(!puedeEditar()) e.remove(); });
  document.querySelectorAll('.solo-admin').forEach(e => { if(!esAdmin()) e.remove(); });
  await cargarDatos();
  traerCotizacion();
}

/* =====================================================================
   CARGA DE DATOS
   ===================================================================== */
/* PostgREST devuelve como máximo 1000 filas por consulta. Se pide por
   páginas hasta traer todo: sin esto, al pasar las 1000 filas los totales
   quedaban incompletos sin ningún aviso. La clave primaria se agrega al
   final del orden para que las páginas no se pisen. */
const PAGINA = 1000;
const CLAVE = { presupuestos:['obra_id','rubro_id'], fichas:['obra_id'], analisis:['obra_id'] };
async function todo(tabla, armar = q => q){
  const filas = [];
  for(let desde = 0; ; desde += PAGINA){
    let q = armar(sb.from(tabla).select('*'));
    for(const c of CLAVE[tabla] || ['id']) q = q.order(c);
    const { data, error } = await q.range(desde, desde + PAGINA - 1);
    if(error) return { data: null, error };
    filas.push(...data);
    if(data.length < PAGINA) return { data: filas, error: null };
  }
}

async function cargarDatos(){
  const t = [
    todo('obras', q => q.order('creado_en')),
    todo('rubros', q => q.eq('activo', true).order('orden')),
    todo('cajas', q => q.eq('activa', true).order('orden')),
    todo('clases'),
    todo('presupuestos'),
    todo('inversores', q => q.order('nombre')),
    todo('aportes', q => q.order('fecha')),
    todo('comprobantes', q => q.order('fecha')),
    todo('avances', q => q.order('fecha')),
    todo('documentos', q => q.order('fecha')),
    todo('cierres', q => q.order('hasta')),
    todo('participaciones'),
    todo('ventas', q => q.order('fecha')),
    todo('fichas'),
    todo('proveedores', q => q.order('nombre')),
    todo('pedidos', q => q.order('fecha')),
    todo('pedido_respuestas'),
    todo('analisis'),
    todo('niveles', q => q.order('orden')),
    todo('indices', q => q.order('periodo')),
    todo('cuotas', q => q.order('numero')),
    todo('enlaces', q => q.order('creado_en')),
    todo('unidades', q => q.order('orden'))
  ];
  const r = await Promise.all(t);
  const malo = r.find(x => x.error);
  if(malo){ aviso('No se pudieron cargar los datos: ' + malo.error.message, true); return; }
  D = { obras:r[0].data, rubros:r[1].data, cajas:r[2].data, clases:r[3].data,
        presupuestos:r[4].data, inversores:r[5].data, aportes:r[6].data,
        comprobantes:r[7].data, avances:r[8].data, documentos:r[9].data, cierres:r[10].data, participaciones:r[11].data, ventas:r[12].data,
        fichas:r[13].data, proveedores:r[14].data,
        pedidos:r[15].data, respuestas:r[16].data,
        analisis:r[17].data, niveles:r[18].data,
        indices:r[19].data, cuotas:r[20].data, enlaces:r[21].data,
        unidades_obra:r[22].data };
  if(!obraActiva || !D.obras.some(o => o.id === obraActiva))
    obraActiva = D.obras[0]?.id ?? null;
  render();
}

/* ---------- accesos rápidos ---------- */
const obra      = () => D.obras.find(o => o.id === obraActiva);
const ORDEN_CAJA = ['caja en efectivo','efectivo','caja mutual','mutual','banco'];
const rangoCaja = c => {
  const i = ORDEN_CAJA.findIndex(x => c.nombre.toLowerCase().includes(x));
  return i < 0 ? 99 : i;
};
const cajasDe   = id => D.cajas.filter(c => c.obra_id === id)
  .slice().sort((a,b) => rangoCaja(a) - rangoCaja(b) || (a.orden||0) - (b.orden||0)
    || a.nombre.localeCompare(b.nombre));
const gastosDe  = id => D.comprobantes.filter(g => g.obra_id === id);
const aportesDe = id => D.aportes.filter(a => a.obra_id === id);
const avancesDe = id => D.avances.filter(a => a.obra_id === id);
const docsDe    = id => D.documentos.filter(d => d.obra_id === id);
const partsDe   = id => D.participaciones.filter(p => p.obra_id === id);

/* Proveedores conocidos: los del catálogo más los que ya aparecieron
   en comprobantes. Sirve para no escribir el mismo nombre de dos formas. */
function proveedoresConocidos(){
  const m = new Map();
  D.proveedores.filter(p=>p.activo!==false).forEach(p =>
    m.set(p.nombre.trim(), { nombre:p.nombre.trim(), cuit:p.cuit||'', rubro_id:p.rubro_id||null }));
  D.comprobantes.forEach(g => {
    const n = (g.proveedor||'').trim();
    if(!n) return;
    if(!m.has(n)) m.set(n, { nombre:n, cuit:g.cuit||'', rubro_id:g.rubro_id||null });
    else if(!m.get(n).cuit && g.cuit) m.get(n).cuit = g.cuit;
  });
  return [...m.values()].sort((a,b)=>a.nombre.localeCompare(b.nombre));
}

function listaProveedores(id){
  return `<datalist id="${id}">${proveedoresConocidos()
    .map(p=>`<option value="${esc(p.nombre)}">${p.cuit?esc(p.cuit):''}</option>`).join('')}</datalist>`;
}

/* Al elegir un proveedor conocido se completan CUIT y rubro habitual */
function autoProveedor(){
  const inp = document.getElementById('prov'); if(!inp) return;
  const p = proveedoresConocidos().find(x => x.nombre.toLowerCase() === inp.value.trim().toLowerCase());
  if(!p) return;
  const cuit = document.getElementById('cuit');
  if(cuit && !cuit.value && p.cuit) cuit.value = p.cuit;
  const rub = document.getElementById('rub');
  if(rub && p.rubro_id && D.rubros.some(r=>r.id===p.rubro_id) && !rub.dataset.tocado)
    rub.value = p.rubro_id;
}
const ventasDe  = id => D.ventas.filter(v => v.obra_id === id);
const cuotasDe  = id => D.cuotas.filter(c => c.venta_id === id).slice().sort((a,b)=>a.numero-b.numero);
const enlacesDe = id => (D.enlaces||[]).filter(e => e.obra_id === id);

/* ---------- Unidades ----------
   El porcentual sale de la superficie por el coeficiente de valor:
   así una unidad de un cuarto piso pesa más que la misma de un primero. */
const unidadesDe = id => (D.unidades_obra||[]).filter(u => u.obra_id === id)
  .slice().sort((a,b)=> (a.orden||0)-(b.orden||0) || a.codigo.localeCompare(b.codigo));

function cuadroUnidades(obraId){
  const us = unidadesDe(obraId);
  const sup = u => (+u.sup_cubierta||0) + (+u.sup_semicubierta||0) + (+u.sup_comun||0);
  const pond = u => sup(u) * (+u.coeficiente||1);
  const total = us.reduce((s,u)=>s+pond(u), 0);
  return us.map(u => ({ u, superficie: sup(u), ponderada: pond(u),
    porcentual: total ? pond(u)/total*100 : 0 }));
}
const urlRendicion = t => location.origin +
  location.pathname.replace(/[^/]*$/, '') + 'rendicion.html?t=' + t;

/* ---------- Índice CAC ----------
   Se carga el nivel del índice o la variación mensual. Si solo hay
   variación, el nivel se encadena desde el mes anterior. */
function serieCac(){
  const filas = D.indices.filter(i => i.nombre === 'CAC')
    .slice().sort((a,b)=>a.periodo.localeCompare(b.periodo));
  let ultimo = null;
  return filas.map(f => {
    let valor = f.valor != null ? +f.valor : null;
    if(valor == null && f.variacion != null && ultimo != null)
      valor = ultimo * (1 + +f.variacion/100);
    if(valor == null && f.variacion != null && ultimo == null) valor = 100;
    if(valor != null) ultimo = valor;
    return { ...f, nivel: valor };
  });
}
const cacDe   = periodo => serieCac().find(x => x.periodo === periodo)?.nivel ?? null;
const cacUltimo = () => { const s = serieCac().filter(x=>x.nivel!=null); return s.length ? s[s.length-1] : null; };

/* Importe a cobrar de una cuota, ajustado al último índice publicado */
function montoCuota(v, c){
  if(c.estado === 'cobrada') return +c.monto_cobrado || 0;
  if(v.modalidad !== 'cuotas_cac') return +c.monto_base;
  const base = +v.indice_base, u = cacUltimo();
  if(!base || !u) return +c.monto_base;
  return +c.monto_base * u.nivel / base;
}
function resumenVenta(v){
  const cs = cuotasDe(v.id);
  const cobradas  = cs.filter(c=>c.estado==='cobrada');
  const pendientes= cs.filter(c=>c.estado==='pendiente');
  const vencidas  = pendientes.filter(c=>c.vencimiento < hoy());
  return { cs, cobradas, pendientes, vencidas,
    cobrado:   cobradas.reduce((s,c)=>s+ +c.monto_cobrado||0, 0),
    porCobrar: pendientes.reduce((s,c)=>s+montoCuota(v,c), 0),
    vencido:   vencidas.reduce((s,c)=>s+montoCuota(v,c), 0) };
}
const fichaDe   = id => D.fichas.find(f => f.obra_id === id) || {};
const pedidosDe = id => D.pedidos.filter(p => p.obra_id === id);
const respDe    = id => D.respuestas.filter(r => r.pedido_id === id);
const analisisDe= id => D.analisis.find(a => a.obra_id === id) || null;
const nivelesDe = id => D.niveles.filter(n => n.obra_id === id);

/* Cómputo del anteproyecto: superficies por tipo, cada una con su
   coeficiente de incidencia sobre el costo del metro cubierto. */
const TIPOS_SUP = [
  ['coch_ss',      'Cocheras subsuelo',  'coef_coch_ss'],
  ['coch_pb',      'Cocheras planta baja','coef_coch_pb'],
  ['cubierta',     'Cubierta exclusiva', 'coef_cubierta'],
  ['semicubierta', 'Semicubierta exclusiva','coef_semicubierta'],
  ['comun',        'Comunes',            'coef_comun'],
  ['terraza',      'Terrazas',           'coef_terraza']
];

function computo(obraId){
  const a = analisisDe(obraId);
  const ns = nivelesDe(obraId);
  if(!a || !ns.length) return null;
  const base = +a.costo_m2_base||0;

  const lineas = TIPOS_SUP.map(([campo, nombre, campoCoef]) => {
    const m2 = ns.reduce((s,n)=>s+ +n[campo]||0, 0);
    const coef = +a[campoCoef] || 0;
    return { campo, nombre, m2, coef, costoM2: base*coef, total: m2*base*coef };
  });
  const sup = c => lineas.find(l=>l.campo===c)?.m2 || 0;

  const construccion = lineas.reduce((s,l)=>s+l.total, 0);
  const vendible = sup('cubierta') + sup('semicubierta');
  const comunes  = sup('comun') + sup('terraza');
  const cocheras = sup('coch_ss') + sup('coch_pb');
  const totalM2  = vendible + comunes;

  const pct = k => +a[k] || 0;
  const indirectos = [
    ['Terreno',                   +a.costo_terreno||0, ''],
    ['Comisión inmobiliaria',     (+a.costo_terreno||0)*pct('pct_comision')/100, `${pct('pct_comision')}% del terreno`],
    ['Escritura y fideicomiso',   +a.gastos_escritura||0, ''],
    ['Honorarios de proyecto',    construccion*pct('pct_proyecto')/100, `${pct('pct_proyecto')}%`],
    ['Gastos y permisos',         +a.gastos_municipales||0, ''],
    ['Dirección y conducción',    construccion*pct('pct_direccion')/100, `${pct('pct_direccion')}%`],
    ['Desarrollo y gestión',      construccion*pct('pct_desarrollo')/100, `${pct('pct_desarrollo')}%`],
    ['Administración financiera', construccion*pct('pct_administracion')/100, `${pct('pct_administracion')}%`]
  ].filter(x=>x[1]);

  const terreno = (+a.costo_terreno||0) + (+a.costo_terreno||0)*pct('pct_comision')/100;
  const otros = indirectos.reduce((s,x)=>s+x[1], 0) - terreno;
  const total = construccion + terreno + otros;
  return { a, ns, lineas, indirectos, construccion, terreno, otros, total,
           vendible, comunes, cocheras, totalM2,
           unidades: ns.reduce((s,n)=>s+ +n.unidades||0, 0),
           porVendible: vendible ? total/vendible : 0,
           porTotal:    totalM2  ? total/totalM2  : 0,
           desglose: vendible ? [
             ['Construcción', construccion, construccion/vendible],
             ['Terreno y comisión', terreno, terreno/vendible],
             ['Honorarios, escritura y permisos', otros, otros/vendible]
           ].filter(x=>x[1]) : [] };
}

/* Superficies de la obra. El total construido es lo que se levanta:
   cubierta más semicubierta más superficie común. Es el divisor del
   costo por metro cuadrado. Terreno y descubierta quedan afuera. */
function superficies(obraId){
  const f = fichaDe(obraId);
  const cub = +f.sup_cubierta||0, semi = +f.sup_semicubierta||0;
  const com = +f.sup_comun||0, desc = +f.sup_descubierta||0;
  return { f, cub, semi, com, desc,
           vendible: +f.sup_vendible||0,
           terreno:  +f.sup_terreno||0,
           construida: cub + semi + com };
}
const cierreDe  = id => D.cierres.filter(c => c.obra_id === id)
  .map(c => c.hasta).sort().pop() || null;
const estaCerrado = (id, f) => { const h = cierreDe(id); return !!h && f <= h; };
const rubro     = id => D.rubros.find(r => r.id === id);
const caja      = id => D.cajas.find(c => c.id === id);
const inv       = id => D.inversores.find(i => i.id === id);

const presuManual = (o,r) =>
  +(D.presupuestos.find(p => p.obra_id===o && p.rubro_id===r)?.monto_usd || 0);
const basePresu = o => D.rubros.filter(r=>r.base_honorarios)
  .reduce((s,r)=>s+presuManual(o,r.id),0);
const ejecutado = (o,r) => gastosDe(o).filter(g=>g.rubro_id===r&&computa(g)).reduce((s,g)=>s+ +g.usd,0);
const baseEjec  = o => D.rubros.filter(r=>r.base_honorarios)
  .reduce((s,r)=>s+ejecutado(o,r.id),0);

const esHonorario = r => r && HONORARIOS.some(([n])=>n === r.nombre);
function pctHon(obraId, nombre){
  const o = D.obras.find(x=>x.id===obraId) || {};
  const col = HONORARIOS.find(([n])=>n === nombre)?.[1];
  return col ? +o[col] || 0 : 0;
}
/* Base de honorarios: solo rubros de obra, y dentro de ellos los
   comprobantes que computan. Los fletes y los honorarios quedan afuera. */
function baseEjecutada(obraId){
  return gastosDe(obraId).filter(g => {
    if(!computa(g)) return false;
    if(g.computa_honorarios === false) return false;
    const r = rubro(g.rubro_id);
    return r && r.base_honorarios;
  }).reduce((s,g)=>s+ +g.usd, 0);
}
function presu(o, rId){
  const r = rubro(rId);
  if(esHonorario(r)){ const p = pctHon(o, r.nombre); if(p) return basePresu(o)*p/100; }
  return presuManual(o, rId);
}
function honorarios(obraId){
  const bE = baseEjecutada(obraId), bP = basePresu(obraId);
  return HONORARIOS.map(([nombre]) => {
    const r = D.rubros.find(x=>x.nombre===nombre);
    const pct = pctHon(obraId, nombre);
    const devengado = bE*pct/100, pagado = r ? ejecutado(obraId, r.id) : 0;
    return { nombre, pct, devengado, pagado, saldo:devengado-pagado, proyectado:bP*pct/100 };
  });
}
function clasesDe(obraId){
  const g = l => D.clases.find(c => c.obra_id===obraId && c.letra===l) || {};
  const a = g('A'), b = g('B');
  return { A:{ nombre:a.nombre||'Cuota A', coef:+(a.coeficiente ?? 1) },
           B:{ nombre:b.nombre||'Cuota B', coef:+(b.coeficiente ?? 1) } };
}
const unidades = (obraId, ap) => +ap.usd * clasesDe(obraId)[ap.clase==='B'?'B':'A'].coef;

/* afecta_caja = false: comprobante solo informativo para el contador.
   No suma al costo de la obra, no toca caja, no genera deuda. */
const computa = g => g.afecta_caja !== false;
const soloInfo = g => g.afecta_caja === false;

function saldoCaja(id){
  const ing = D.aportes.filter(a=>a.caja_id===id).reduce((s,a)=>s+ +a.usd,0);
  const egr = D.comprobantes.filter(g=>g.caja_id===id&&computa(g)&&g.pago==='pagado')
    .reduce((s,g)=>s+ +g.usd,0);
  const deuda = D.comprobantes.filter(g=>g.caja_id===id&&computa(g)&&g.pago!=='pagado')
    .reduce((s,g)=>s+ +g.usd,0);
  return { ing, egr, deuda, saldo:ing-egr };
}
function totalesObra(id){
  const gs = gastosDe(id);
  const ing = aportesDe(id).reduce((s,a)=>s+ +a.usd,0);
  const egr = gs.filter(computa).reduce((s,g)=>s+ +g.usd,0);
  const pag = gs.filter(g=>computa(g)&&g.pago==='pagado').reduce((s,g)=>s+ +g.usd,0);
  const deuda = gs.filter(g=>computa(g)&&g.pago!=='pagado').reduce((s,g)=>s+ +g.usd,0);
  const sinCaja = gs.filter(soloInfo).reduce((s,g)=>s+ +g.usd,0);
  const pres = D.rubros.reduce((s,r)=>s+presu(id,r.id),0);
  return { ing, egr, pag, deuda, sinCaja, saldo:ing-pag, neto:ing-pag-deuda,
           pres, avance: pres ? egr/pres*100 : 0 };
}
function deudaProveedores(obraId){
  const m = new Map();
  gastosDe(obraId).filter(computa).forEach(g => {
    const k = (g.proveedor||'Sin identificar').trim();
    if(!m.has(k)) m.set(k, { proveedor:k, cuit:'', total:0, pagado:0, deuda:0, sinCaja:0, pendientes:[] });
    const p = m.get(k);
    if(!p.cuit && g.cuit) p.cuit = g.cuit;
    p.total += +g.usd;
    if(g.pago==='pagado') p.pagado += +g.usd;
    else { p.deuda += +g.usd; p.pendientes.push(g); }
  });
  const ahora = Date.now();
  return [...m.values()].map(p => {
    const viejo = p.pendientes.map(g=>g.fecha).sort()[0];
    p.dias = viejo ? Math.floor((ahora - new Date(viejo+'T00:00:00').getTime())/86400000) : 0;
    p.pendientes.sort((a,b)=>a.fecha.localeCompare(b.fecha));
    return p;
  }).sort((a,b)=>b.deuda-a.deuda || b.total-a.total);
}

/* =====================================================================
   COTIZACIÓN
   ===================================================================== */
async function traerCotizacion(){
  const box = document.getElementById('fuente-cotiz');
  box.textContent = 'Buscando cotización…';
  try{
    const r = await fetch('https://dolarapi.com/v1/dolares/oficial',{cache:'no-store'});
    const d = await r.json();
    if(!+d.venta) throw new Error('sin dato');
    tcCompra = +d.compra || null;
    tcVenta  = +d.venta;
    aplicarTcRef();
    fuenteCotiz = { cuando: d.fechaActualizacion || new Date().toISOString() };
    document.getElementById('cotiz').value = cotizacion;
    pintarFuente();
  }catch(e){
    box.innerHTML = 'No se pudo traer la cotización. Cargala a mano. ' +
      '<button onclick="traerCotizacion()">Reintentar</button>';
  }
}

function aplicarTcRef(){
  if(!tcVenta) return;
  cotizacion = tcRef === 'compra' ? (tcCompra || tcVenta)
             : tcRef === 'venta'  ? tcVenta
             : tcCompra ? (tcCompra + tcVenta) / 2 : tcVenta;
  cotizacion = Math.round(cotizacion * 100) / 100;
}

function setTcRef(v){
  tcRef = v;
  try{ localStorage.setItem('obras:tcref', v); }catch(e){}
  aplicarTcRef();
  document.getElementById('cotiz').value = cotizacion;
  render();
}
function pintarFuente(){
  const box = document.getElementById('fuente-cotiz');
  if(!box) return;
  if(!fuenteCotiz){
    box.innerHTML = 'Valor cargado a mano. <button onclick="traerCotizacion()">Actualizar</button>';
    return;
  }
  const d = new Date(fuenteCotiz.cuando);
  const n = v => v ? v.toLocaleString('es-AR',{maximumFractionDigits:2}) : '—';
  const prom = tcCompra && tcVenta ? (tcCompra + tcVenta)/2 : tcVenta;
  const opcion = (v,t,val) => `<label style="display:inline-flex;align-items:center;gap:3px;margin-right:8px">
    <input type="radio" name="tcref" value="${v}" ${tcRef===v?'checked':''}
      onchange="setTcRef('${v}')" style="width:auto;margin:0"> ${t} ${n(val)}</label>`;
  box.innerHTML = `Oficial al ${d.toLocaleDateString('es-AR')} ` +
    `${d.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}<br>` +
    opcion('compra','Compra',tcCompra) + opcion('venta','Venta',tcVenta) +
    opcion('promedio','Promedio',prom) +
    `<br><button onclick="traerCotizacion()">Actualizar</button>`;
}
function setCotiz(v){ cotizacion = parseFloat(v)||0; fuenteCotiz = null; pintarFuente(); }

/* =====================================================================
   RENDER
   ===================================================================== */
function render(){
  try{ dibujar(); }
  catch(e){
    document.getElementById('cuerpo').innerHTML =
      `<div class="vacio" style="text-align:left;border-color:var(--rojo);color:var(--tinta)">
        <strong>Algo falló al dibujar la pantalla.</strong>
        <p style="font-size:12.5px;color:var(--gris)">${esc(e.message)}</p></div>`;
    console.error(e);
  }
}

function dibujar(){
  if(!D) return;
  document.getElementById('sub-obras').textContent =
    D.obras.length + (D.obras.length===1 ? ' obra activa' : ' obras activas');
  document.getElementById('lista-obras').innerHTML = D.obras.map(o => {
    const t = totalesObra(o.id);
    return `<button class="obra-btn ${o.id===obraActiva && vista!=='panel' && vista!=='usuarios' ?'on':''}"
      onclick="verObra('${o.id}')">
      <span>${esc(o.nombre)}</span><small class="num">${fmtUsd(t.egr)}</small></button>`;
  }).join('');

  const enPanel = vista === 'panel' || vista === 'usuarios' || vista === 'indices';
  const TABS = enPanel
    ? [['panel','Panel']]
        .concat(puedeEditar() ? [['indices','Índices']] : [])
        .concat(esAdmin() ? [['usuarios','Usuarios']] : [])
    : [['resumen','Resumen'],['cajas','Cajas'],['gastos','Comprobantes'],
       ['rubros','Rubros'],['honorarios','Honorarios'],['proveedores','Proveedores'],
       ['analisis','Análisis'],['unidades','Unidades'],['inversores','Inversores'],['ventas','Ventas'],['avance','Avance'],['documentos','Documentos'],
       ['contador','Contador'],['rendicion','Rendición']]
       .concat(puedeEditar() ? [['historial','Historial']] : []);
  document.getElementById('tabs').innerHTML = TABS.map(([k,n]) =>
    `<button class="tab ${vista===k?'on':''}" onclick="verTab('${k}')">${n}</button>`).join('');

  document.getElementById('btn-ver-panel').classList.toggle('on', enPanel);

  const o = obra();
  document.getElementById('titulo').textContent = enPanel
    ? (vista==='usuarios' ? 'Usuarios' : vista==='indices' ? 'Índices' : 'Panel general')
    : (o ? o.nombre : 'Sin obras');
  ['btn-renombrar','btn-borrar-obra'].forEach(id => {
    const b = document.getElementById(id); if(b) b.style.display = (o && !enPanel) ? '' : 'none';
  });
  document.getElementById('btn-panel').style.display = enPanel ? 'none' : '';

  document.getElementById('cuerpo').innerHTML =
      vista === 'panel'    ? vPanel()
    : vista === 'indices'  ? vIndices()
    : vista === 'usuarios' ? vUsuarios()
    : !o ? `<div class="vacio">No hay obras visibles para tu usuario.</div>`
    : ({resumen:vResumen,cajas:vCajas,gastos:vGastos,rubros:vRubros,honorarios:vHonorarios,
        proveedores:vProveedores,inversores:vInversores,avance:vAvance,
        contador:vContador,rendicion:vRendicion,documentos:vDocumentos,
        ventas:vVentas,analisis:vAnalisis,unidades:vUnidades,historial:vHistorial}[vista])(o);
  pintarFuente();
}
function verObra(id){ obraActiva = id; if(vista==='panel') vista = 'resumen'; render(); }
function verTab(k){ vista = k; render(); }

/* ---------- Panel: todas las obras juntas ---------- */
function vPanel(){
  const fs = D.obras.map(o => ({ o, t: totalesObra(o.id),
    cierre: cierreDe(o.id), docs: docsDe(o.id).length }));
  const sum = k => fs.reduce((s,f)=>s+f.t[k],0);

  return `
  <div class="fila">
    <div class="kpi"><p class="r">Obras activas</p><p class="v num">${fs.length}</p></div>
    <div class="kpi"><p class="r">Aportes recibidos</p><p class="v num">${fmtUsd(sum('ing'))}</p></div>
    <div class="kpi"><p class="r">Ejecutado</p><p class="v num">${fmtUsd(sum('egr'))}</p></div>
    <div class="kpi ${sum('deuda')>0?'alerta':''}"><p class="r">Deuda a proveedores</p>
      <p class="v num">${fmtUsd(sum('deuda'))}</p></div>
    <div class="kpi ${sum('neto')<0?'alerta':''}"><p class="r">Disponible neto</p>
      <p class="v num">${fmtUsd(sum('neto'))}</p></div>
  </div>

  <h3>Comparativo por obra</h3>
  ${fs.length ? `<table><thead><tr><th>Obra</th><th class="der">Presupuesto</th>
    <th class="der">Ejecutado</th><th style="width:150px" class="ocultar-chico">Avance</th>
    <th class="der">Deuda</th><th class="der">Disponible neto</th></tr></thead><tbody>
    ${fs.map(f=>{
      const pct = f.t.pres ? f.t.egr/f.t.pres*100 : 0, ex = f.t.pres && f.t.egr > f.t.pres;
      return `<tr><td><button class="link" style="font-size:13.5px;font-weight:600"
          onclick="verObra('${f.o.id}');verTab('resumen')">${esc(f.o.nombre)}</button>
        ${f.cierre?`<br><span class="pct">cerrada hasta ${fecha(f.cierre)}</span>`:''}
        ${f.docs?`<br><span class="pct">${f.docs} documento${f.docs===1?'':'s'}</span>`:''}</td>
      <td class="der num">${f.t.pres?fmtUsd(f.t.pres):'—'}</td>
      <td class="der num">${fmtUsd(f.t.egr)}</td>
      <td class="ocultar-chico"><div class="medida ${ex?'excedido':''}">
        <i style="width:${Math.min(pct,100)}%"></i></div>
        <p class="pct">${f.t.pres?fmtPct(pct):'sin presupuesto'}</p></td>
      <td class="der num" style="${f.t.deuda>0?'color:var(--rojo);font-weight:600':''}">
        ${f.t.deuda?fmtUsd(f.t.deuda):'—'}</td>
      <td class="der num" style="font-weight:600;${f.t.neto<0?'color:var(--rojo)':''}">
        ${fmtUsd(f.t.neto)}</td></tr>`;}).join('')}
    <tr><td><strong>Total</strong></td>
      <td class="der num"><strong>${fmtUsd(sum('pres'))}</strong></td>
      <td class="der num"><strong>${fmtUsd(sum('egr'))}</strong></td><td class="ocultar-chico"></td>
      <td class="der num"><strong>${fmtUsd(sum('deuda'))}</strong></td>
      <td class="der num"><strong>${fmtUsd(sum('neto'))}</strong></td></tr>
    </tbody></table>` : `<div class="vacio">No hay obras visibles.</div>`}

  <p class="sub" style="margin-top:14px">Tocá el nombre de una obra para entrar a su detalle.</p>`;
}

/* ---------- Resumen ---------- */
function vResumen(o){
  const t = totalesObra(o.id), exc = t.pres && t.egr > t.pres;
  const ults = gastosDe(o.id).filter(computa).slice().sort((a,b)=>b.fecha.localeCompare(a.fecha)).slice(0,8);
  const porRubro = D.rubros.map(r=>({r,p:presu(o.id,r.id),e:ejecutado(o.id,r.id)}))
    .filter(x=>x.p||x.e).sort((a,b)=>b.e-a.e);
  return `
  <div class="fila">
    <div class="kpi"><p class="r">Aportes integrados</p><p class="v num">${fmtUsd(t.ing)}</p>
      <p class="s">${aportesDe(o.id).length} movimientos</p></div>
    <div class="kpi"><p class="r">Ejecutado</p><p class="v num">${fmtUsd(t.egr)}</p>
      <p class="s">${fmtUsd(t.pag)} pagado${t.sinCaja?` · ${fmtUsd(t.sinCaja)} informativo aparte`:''}</p></div>
    <div class="kpi ${t.deuda>0?'alerta':''}"><p class="r">Deuda a proveedores</p>
      <p class="v num">${fmtUsd(t.deuda)}</p>
      <p class="s">${t.deuda>0?'facturas pendientes':'sin facturas pendientes'}</p></div>
    <div class="kpi ${t.neto<0?'alerta':''}"><p class="r">Disponible neto</p>
      <p class="v num">${fmtUsd(t.neto)}</p>
      <p class="s">${fmtUsd(t.saldo)} en cajas menos la deuda</p></div>
    <div class="kpi ${exc?'alerta':''}"><p class="r">Avance del presupuesto</p>
      <p class="v num">${t.pres?fmtPct(t.avance):'—'}</p>
      <p class="s">${t.pres?('sobre '+fmtUsd(t.pres)):'Cargá el presupuesto en Rubros'}</p></div>
  </div>
  ${bloqueFicha(o, t)}

  <h3>Ejecución por rubro</h3>
  ${porRubro.length ? `<table><thead><tr><th>Rubro</th><th class="der">Presupuesto</th>
    <th class="der">Ejecutado</th><th style="width:170px" class="ocultar-chico">Avance</th></tr></thead><tbody>
    ${porRubro.map(({r,p,e})=>{const pct=p?e/p*100:0,ex=p&&e>p;
      return `<tr><td>${esc(r.nombre)}</td><td class="der num">${p?fmtUsd(p):'—'}</td>
      <td class="der num" ${ex?'style="color:var(--rojo);font-weight:600"':''}>${fmtUsd(e)}</td>
      <td class="ocultar-chico"><div class="medida ${ex?'excedido':''}"><i style="width:${Math.min(pct,100)}%"></i></div>
      <p class="pct">${p?fmtPct(pct):'sin presupuesto'}</p></td></tr>`;}).join('')}
    </tbody></table>` : `<div class="vacio">Sin movimientos todavía.</div>`}
  <h3>Últimos comprobantes</h3>
  ${ults.length ? `<table><thead><tr><th>Fecha</th><th>Proveedor</th><th>Rubro</th>
    <th class="ocultar-chico">Caja</th><th class="der">Importe</th></tr></thead><tbody>
    ${ults.map(g=>`<tr><td class="num">${fecha(g.fecha)}</td><td>${esc(g.proveedor)}</td>
      <td><span class="chip">${esc(rubro(g.rubro_id)?.nombre||'—')}</span></td>
      <td class="ocultar-chico">${esc(caja(g.caja_id)?.nombre||'—')}</td>
      <td class="der num">${fmtUsd2(g.usd)}</td></tr>`).join('')}</tbody></table>`
    : `<div class="vacio">Ningún comprobante cargado.</div>`}`;
}

/* ---------- Ficha técnica y costo por metro ---------- */
function bloqueFicha(o, t){
  const c = computo(o.id);
  if(c && c.vendible) return bloqueMetro(o, t, c);

  const s = superficies(o.id);
  const f = s.f;

  if(!s.construida){
    if(!puedeEditar()) return '';
    return `<h3>Ficha técnica</h3>
      <div class="vacio" style="text-align:left">
        <strong>Falta cargar las superficies de la obra.</strong>
        <p style="font-size:12.5px;color:var(--gris);margin:6px 0 12px">
          Se completa una sola vez, al inicio. Con eso el sistema calcula el costo
          por metro cuadrado y lo va actualizando solo a medida que se carga el gasto.
          Es el número que se compara contra el mercado.</p>
        <button class="btn" onclick="formFicha()">Cargar la ficha</button>
      </div>`;
  }

  const m2 = v => v.toLocaleString('es-AR',{maximumFractionDigits:0}) + ' m²';
  const real = t.egr / s.construida;
  const proyectado = t.pres ? t.pres / s.construida : 0;
  const avance = t.pres ? t.egr / t.pres : 0;
  const alCierre = avance > 0.05 ? (t.egr / avance) / s.construida : 0;
  const porVendible = s.vendible ? t.egr / s.vendible : 0;
  const desvio = proyectado && alCierre ? (alCierre/proyectado - 1) * 100 : 0;

  const detalle = [
    ['Cubierta', s.cub], ['Semicubierta', s.semi], ['Común a construir', s.com]
  ].filter(x => x[1]);

  return `
  <h3>Costo por metro cuadrado</h3>
  <div class="fila">
    <div class="kpi"><p class="r">Total construido</p>
      <p class="v num">${m2(s.construida)}</p>
      <p class="s">${detalle.map(([n,v])=>`${n.toLowerCase()} ${m2(v)}`).join(' · ')}</p></div>
    <div class="kpi"><p class="r">Valor del m² hoy</p>
      <p class="v num">${fmtUsd(real)}</p>
      <p class="s">${fmtUsd(t.egr)} ejecutados</p></div>
    ${proyectado?`<div class="kpi"><p class="r">m² presupuestado</p>
      <p class="v num">${fmtUsd(proyectado)}</p>
      <p class="s">${fmtUsd(t.pres)} de presupuesto</p></div>`:''}
    ${alCierre?`<div class="kpi ${desvio>5?'alerta':''}"><p class="r">Proyección al cierre</p>
      <p class="v num">${fmtUsd(alCierre)}</p>
      <p class="s">${proyectado
        ? (desvio>0.5?`${fmtPct(desvio)} sobre lo previsto`
          : desvio<-0.5?`${fmtPct(-desvio)} por debajo`:'en línea con lo previsto')
        : 'al ritmo actual de gasto'}</p></div>`:''}
    ${porVendible?`<div class="kpi"><p class="r">m² vendible</p>
      <p class="v num">${fmtUsd(porVendible)}</p>
      <p class="s">sobre ${m2(s.vendible)} vendibles</p></div>`:''}
  </div>

  <table><thead><tr><th>Superficie</th><th class="der">m²</th>
    <th class="der">Participación</th><th class="der">Costo acumulado</th></tr></thead><tbody>
    ${detalle.map(([n,v])=>`<tr><td>${n}</td>
      <td class="der num">${m2(v)}</td>
      <td class="der num">${fmtPct(v/s.construida*100)}</td>
      <td class="der num">${fmtUsd(real*v)}</td></tr>`).join('')}
    <tr><td><strong>Total construido</strong></td>
      <td class="der num"><strong>${m2(s.construida)}</strong></td>
      <td class="der num">100,0%</td>
      <td class="der num"><strong>${fmtUsd(t.egr)}</strong></td></tr>
    ${s.desc?`<tr><td>Descubierta <span class="pct">no computa</span></td>
      <td class="der num">${m2(s.desc)}</td><td class="der">—</td><td class="der">—</td></tr>`:''}
    ${s.terreno?`<tr><td>Terreno <span class="pct">no computa</span></td>
      <td class="der num">${m2(s.terreno)}</td>
      <td class="der num">${fmtPct(s.construida/s.terreno*100)} de FOT</td>
      <td class="der">—</td></tr>`:''}
  </tbody></table>

  <p class="sub" style="margin-top:10px">${esc(f.descripcion||'')}
    ${f.niveles?` · ${f.niveles} nivel${f.niveles===1?'':'es'}`:''}
    ${f.subsuelos?` · ${f.subsuelos} subsuelo${f.subsuelos===1?'':'s'}`:''}
    ${f.unidades?` · ${f.unidades} unidad${f.unidades===1?'':'es'}`:''}
    ${f.cocheras?` · ${f.cocheras} cochera${f.cocheras===1?'':'s'}`:''}
    ${f.unidades && s.vendible?` · ${m2(s.vendible/f.unidades)} promedio por unidad`:''}
    ${puedeEditar()?` <button class="link" onclick="formFicha()">Editar ficha</button>`:''}</p>`;
}

function formFicha(){
  const o = obra(), f = fichaDe(o.id);
  const c = (id, etiqueta, valor, extra='') =>
    `<div class="campo"><label for="${id}">${etiqueta}</label>
      <input id="${id}" type="number" step="0.01" min="0" value="${valor??''}" ${extra}></div>`;
  modal('Ficha técnica de la obra', `
    <div class="lector" id="lector">
      <label for="fi-desc">Descripción</label>
      <input id="fi-desc" value="${esc(f.descripcion||'')}"
        placeholder="PB + 4 + terraza, 8 deptos, 2 cocheras">
      <button class="btn sec" style="align-self:flex-start" onclick="interpretarFicha()">
        Completar campos desde la descripción</button>
      <span class="ayuda" id="fi-estado">Se completa una sola vez, al inicio de la obra.
        Escribila como la describirías por teléfono y el sistema completa lo que pueda.
        Revisá siempre antes de guardar.</span>
    </div>
    ${c('fi-niveles','Niveles sobre nivel', f.niveles, 'step="1"')}
    ${c('fi-subsuelos','Subsuelos', f.subsuelos, 'step="1"')}
    ${c('fi-unidades','Unidades', f.unidades, 'step="1"')}
    ${c('fi-cocheras','Cocheras', f.cocheras, 'step="1"')}
    ${c('fi-terreno','Superficie del terreno m²', f.sup_terreno)}
    ${c('fi-cubierta','Cubierta m²', f.sup_cubierta, 'onchange="sumarM2()"')}
    ${c('fi-semi','Semicubierta m²', f.sup_semicubierta, 'onchange="sumarM2()"')}
    ${c('fi-descubierta','Descubierta m²', f.sup_descubierta)}
    ${c('fi-comun','Común a construir m²', f.sup_comun, 'onchange="sumarM2()"')}
    <div class="campo"><label>Total construido</label>
      <p id="fi-total" class="num" style="font-size:20px;font-weight:700;margin:5px 0 0">—</p>
      <span class="ayuda">Cubierta + semicubierta + común</span></div>
    <div class="campo ancho"><span class="ayuda">Cubierta, semicubierta y común suman el
      total construido, que es la base del costo por metro. La descubierta y el terreno
      quedan afuera del cálculo.</span></div>
    ${c('fi-vendible','Vendible m²', f.sup_vendible)}
    <div class="campo"><label for="fi-inicio">Inicio de obra</label>
      <input id="fi-inicio" type="date" value="${f.inicio||''}"></div>
    <div class="campo"><label for="fi-fin">Fin previsto</label>
      <input id="fi-fin" type="date" value="${f.fin_previsto||''}"></div>
    <div class="campo ancho"><label for="fi-nota">Nota</label>
      <input id="fi-nota" value="${esc(f.nota||'')}" placeholder="Opcional"></div>`,
    async ()=>{
      const num = id => { const v = val(id); return v === '' ? null : parseFloat(v); };
      const datos = { obra_id:o.id, descripcion:val('fi-desc'),
        niveles:num('fi-niveles'), subsuelos:num('fi-subsuelos'),
        unidades:num('fi-unidades'), cocheras:num('fi-cocheras'),
        sup_terreno:num('fi-terreno'), sup_cubierta:num('fi-cubierta'),
        sup_semicubierta:num('fi-semi'), sup_descubierta:num('fi-descubierta'),
        sup_comun:num('fi-comun'), sup_vendible:num('fi-vendible'),
        inicio:val('fi-inicio')||null, fin_previsto:val('fi-fin')||null,
        nota:val('fi-nota'), actualizado_en:new Date().toISOString() };
      cerrar();
      const { error } = await sb.from('fichas').upsert(datos);
      if(error) return aviso('No se pudo guardar: ' + error.message, true);
      aviso('Ficha guardada');
      await cargarDatos();
    });
  sumarM2();
}

function sumarM2(){
  const e = document.getElementById('fi-total'); if(!e) return;
  const n = id => parseFloat(val(id))||0;
  const t = n('fi-cubierta') + n('fi-semi') + n('fi-comun');
  e.textContent = t ? t.toLocaleString('es-AR',{maximumFractionDigits:0}) + ' m²' : '—';
}

async function interpretarFicha(){
  const texto = val('fi-desc');
  const est = document.getElementById('fi-estado');
  if(!texto) return est.textContent = 'Escribí primero la descripción.';
  est.textContent = 'Interpretando…';
  const { data, error } = await sb.functions.invoke('asistente', {
    body: { accion:'ficha', texto } });
  if(error || data?.error){
    est.textContent = 'No se pudo interpretar. Cargá los campos a mano.';
    return;
  }
  const mapa = { niveles:'fi-niveles', subsuelos:'fi-subsuelos', unidades:'fi-unidades',
    cocheras:'fi-cocheras', sup_terreno:'fi-terreno', sup_cubierta:'fi-cubierta',
    sup_semicubierta:'fi-semi', sup_descubierta:'fi-descubierta',
    sup_comun:'fi-comun', sup_vendible:'fi-vendible' };
  let puestos = 0;
  Object.entries(mapa).forEach(([k,id])=>{
    if(data[k] !== null && data[k] !== undefined && data[k] !== ''){
      document.getElementById(id).value = data[k]; puestos++;
    }
  });
  sumarM2();
  est.textContent = puestos
    ? `Completé ${puestos} campo${puestos===1?'':'s'}. Revisalos y corregí lo que haga falta.`
    : 'No pude sacar datos de esa descripción. Cargalos a mano.';
}

/* ---------- Costo por metro en el Resumen ---------- */
const FUERA_CONSTRUCCION = ['Previo','Honorarios'];
/* Ejecutado que es estrictamente obra, sin terreno, honorarios ni permisos */
function ejecutadoConstruccion(obraId){
  return gastosDe(obraId).filter(g => {
    if(!computa(g)) return false;
    const r = rubro(g.rubro_id);
    return r && !FUERA_CONSTRUCCION.includes(r.grupo);
  }).reduce((s,g)=>s+ +g.usd, 0);
}

function bloqueMetro(o, t, c){
  const real       = t.egr / c.vendible;
  const proyectado = c.porVendible;
  const avance     = c.total ? t.egr / c.total : 0;
  const alCierre   = avance > 0.05 ? (t.egr / avance) / c.vendible : 0;
  const desvio     = proyectado ? (real/proyectado - 1) * 100 : 0;

  const ejecConstr   = ejecutadoConstruccion(o.id);
  const constrProy   = c.construccion / c.vendible;
  const constrReal   = ejecConstr / c.vendible;
  const avanceConstr = c.construccion ? ejecConstr / c.construccion : 0;
  const constrCierre = avanceConstr > 0.05 ? (ejecConstr/avanceConstr) / c.vendible : 0;

  /* Cada componente proyectado contra lo efectivamente ejecutado */
  const ejecutadoDe = nombre => {
    if(nombre === 'Construcción') return ejecConstr;
    if(nombre === 'Terreno y comisión')
      return gastosDe(o.id).filter(g => computa(g) &&
        (rubro(g.rubro_id)?.nombre||'').toLowerCase().includes('terreno'))
        .reduce((s,g)=>s+ +g.usd,0);
    return t.egr - ejecConstr - gastosDe(o.id).filter(g => computa(g) &&
      (rubro(g.rubro_id)?.nombre||'').toLowerCase().includes('terreno'))
      .reduce((s,g)=>s+ +g.usd,0);
  };

  return `
  <h3>Costo por metro cuadrado</h3>
  <div class="fila">
    <div class="kpi"><p class="r">Proyectado por m² vendible</p>
      <p class="v num">${fmtUsd(proyectado)}</p>
      <p class="s">sobre ${m2f(c.vendible)} vendibles</p></div>
    <div class="kpi"><p class="r">Ejecutado por m² vendible</p>
      <p class="v num">${fmtUsd(real)}</p>
      <p class="s">${fmtUsd(t.egr)} gastados a hoy</p></div>
    <div class="kpi"><p class="r">Construcción proyectada</p>
      <p class="v num">${fmtUsd(constrProy)}</p>
      <p class="s">sin terreno ni honorarios</p></div>
    <div class="kpi ${constrCierre && constrCierre>constrProy*1.05?'alerta':''}">
      <p class="r">Construcción real</p><p class="v num">${fmtUsd(constrReal)}</p>
      <p class="s">${fmtUsd(ejecConstr)} de obra pura</p></div>
    <div class="kpi ${desvio>5?'alerta':''}"><p class="r">Avance económico</p>
      <p class="v num">${fmtPct(avance*100)}</p>
      <p class="s">sobre ${fmtUsd(c.total)} proyectados</p></div>
  </div>

  <table><thead><tr><th>Componente</th>
    <th class="der">Proyectado</th><th class="der">U$S/m² proyectado</th>
    <th class="der">Ejecutado</th><th class="der">U$S/m² ejecutado</th>
    <th class="der">Consumido</th></tr></thead><tbody>
    ${c.desglose.map(([n,v,x])=>{
      const e = ejecutadoDe(n);
      const pc = v ? e/v*100 : 0;
      return `<tr><td>${esc(n)}</td>
        <td class="der num">${fmtUsd(v)}</td>
        <td class="der num">${fmtUsd2(x)}</td>
        <td class="der num">${e?fmtUsd(e):'—'}</td>
        <td class="der num">${e?fmtUsd2(e/c.vendible):'—'}</td>
        <td class="der num" style="${pc>100?'color:var(--rojo);font-weight:600':''}">${fmtPct(pc)}</td>
      </tr>`;}).join('')}
    <tr><td><strong>Total por m² vendible</strong></td>
      <td class="der num"><strong>${fmtUsd(c.total)}</strong></td>
      <td class="der num"><strong>${fmtUsd2(proyectado)}</strong></td>
      <td class="der num"><strong>${fmtUsd(t.egr)}</strong></td>
      <td class="der num"><strong>${fmtUsd2(real)}</strong></td>
      <td class="der num"><strong>${fmtPct(avance*100)}</strong></td></tr>
    <tr><td>Sobre el total construido <span class="pct">${m2f(c.totalM2)}</span></td>
      <td class="der">—</td><td class="der num">${fmtUsd2(c.porTotal)}</td>
      <td class="der">—</td><td class="der num">${fmtUsd2(t.egr/c.totalM2)}</td>
      <td class="der">—</td></tr>
  </tbody></table>
  <p class="sub" style="margin-top:10px">
    ${constrCierre ? `Al ritmo actual, la construcción cerraría en ${fmtUsd2(constrCierre)} el metro
      contra ${fmtUsd2(constrProy)} proyectados. ` : ''}
    La columna de construcción excluye terreno, honorarios, impuestos y permisos:
    es el número comparable contra el mercado.
    <button class="link" onclick="verTab('analisis')">Ver el análisis completo</button></p>`;
}

/* ---------- Unidades ---------- */
const TIPOS_UNIDAD = ['Departamento','Cochera','Baulera','Local','Otro'];
const ESTADO_UNIDAD = {
  disponible: ['Disponible',''],
  reservada:  ['Reservada','a'],
  asignada:   ['Asignada','v'],
  vendida:    ['Vendida','v']
};

function vUnidades(o){
  const filas = cuadroUnidades(o.id);
  const c = computo(o.id);
  const m2 = v => (+v||0).toLocaleString('es-AR',{maximumFractionDigits:2}) + ' m²';

  if(!filas.length){
    return `<div class="vacio" style="text-align:left">
      <strong>Unidades del emprendimiento.</strong>
      <p style="font-size:12.5px;color:var(--gris);margin:6px 0 12px">
        Cargá cada departamento, cochera o local con su superficie y su coeficiente de valor.
        El porcentual de cada uno se calcula solo, y desde acá se asignan a inversores
        o se vinculan con una venta.</p>
      ${puedeEditar()?`<button class="btn" onclick="formUnidad()">Cargar la primera unidad</button>`:''}
    </div>`;
  }

  const porEstado = e => filas.filter(f=>f.u.estado===e);
  const supTotal = filas.reduce((s,f)=>s+f.superficie,0);
  const costoUnidad = f => c && c.total ? c.total * f.porcentual/100 : 0;

  return `
  ${puedeEditar()?`<div class="acciones">
    <button class="btn" onclick="formUnidad()">Agregar unidad</button>
    <button class="btn sec" onclick="exportarUnidades()">Exportar a Excel</button>
  </div>`:''}

  <div class="fila">
    <div class="kpi"><p class="r">Unidades</p><p class="v num">${filas.length}</p>
      <p class="s">${m2(supTotal)} en total</p></div>
    <div class="kpi"><p class="r">Disponibles</p><p class="v num">${porEstado('disponible').length}</p>
      <p class="s">${fmtPct(porEstado('disponible').reduce((s,f)=>s+f.porcentual,0))} del total</p></div>
    <div class="kpi"><p class="r">Asignadas</p>
      <p class="v num">${porEstado('asignada').length + porEstado('reservada').length}</p>
      <p class="s">a inversores</p></div>
    <div class="kpi"><p class="r">Vendidas</p><p class="v num">${porEstado('vendida').length}</p>
      <p class="s">${fmtPct(porEstado('vendida').reduce((s,f)=>s+f.porcentual,0))} del total</p></div>
    ${c && c.total ? `<div class="kpi"><p class="r">Costo del m² vendible</p>
      <p class="v num">${fmtUsd(c.porVendible)}</p>
      <p class="s">según el análisis</p></div>` : ''}
  </div>

  <table><thead><tr><th>Unidad</th><th class="ocultar-chico">Tipo</th>
    <th class="der">Superficie</th><th class="der">Coef.</th><th class="der">Porcentual</th>
    ${c&&c.total?'<th class="der ocultar-chico">Costo asignado</th>':''}
    <th>Situación</th><th></th></tr></thead><tbody>
    ${filas.map(f=>{
      const u = f.u;
      const [et, color] = ESTADO_UNIDAD[u.estado] || ['—',''];
      const quien = u.inversor_id ? inv(u.inversor_id)?.nombre
                  : u.venta_id ? D.ventas.find(v=>v.id===u.venta_id)?.cliente : null;
      return `<tr>
        <td><strong>${esc(u.codigo)}</strong>
          ${u.piso!=null?`<br><span class="pct">Piso ${u.piso}</span>`:''}</td>
        <td class="ocultar-chico">${esc(u.tipo)}</td>
        <td class="der num">${m2(f.superficie)}</td>
        <td class="der num">${(+u.coeficiente).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
        <td class="der num" style="font-weight:600">${fmtPct(f.porcentual)}</td>
        ${c&&c.total?`<td class="der num ocultar-chico">${fmtUsd(costoUnidad(f))}</td>`:''}
        <td><span class="chip ${color}">${et}</span>
          ${quien?`<br><span class="pct">${esc(quien)}</span>`:''}</td>
        <td class="der">${puedeEditar()?`<button class="link" onclick="formUnidad('${u.id}')">Editar</button>`:''}
          ${puedeEditar()?`<br><button class="link" onclick="asignarUnidad('${u.id}')">Asignar</button>`:''}</td>
      </tr>`;
    }).join('')}
    <tr><td><strong>Total</strong></td><td class="ocultar-chico"></td>
      <td class="der num"><strong>${m2(supTotal)}</strong></td><td></td>
      <td class="der num"><strong>100,0%</strong></td>
      ${c&&c.total?`<td class="der num ocultar-chico"><strong>${fmtUsd(c.total)}</strong></td>`:''}
      <td colspan="2"></td></tr>
  </tbody></table>

  <p class="sub" style="margin-top:12px">El porcentual sale de la superficie por el coeficiente
  de valor. Un coeficiente de 1,10 significa que esa unidad vale un 10% más por metro que la
  de referencia, que es la que tiene 1,00.
  ${c&&c.total?' El costo asignado reparte el costo total del emprendimiento según ese porcentual.':''}</p>`;
}

function formUnidad(id){
  const o = obra();
  const u = id ? (D.unidades_obra||[]).find(x=>x.id===id) : {};
  const ns = nivelesDe(o.id);
  const n = (campo, et, paso='0.01') =>
    `<div class="campo"><label for="un-${campo}">${et}</label>
      <input id="un-${campo}" type="number" step="${paso}" min="0" value="${u[campo] ?? ''}"></div>`;

  modal(id ? 'Editar unidad' : 'Agregar unidad', `
    <div class="campo"><label for="un-codigo">Unidad</label>
      <input id="un-codigo" value="${esc(u.codigo||'')}" placeholder="3ºB"></div>
    <div class="campo"><label for="un-tipo">Tipo</label>
      <select id="un-tipo">${TIPOS_UNIDAD.map(t=>`<option ${t===u.tipo?'selected':''}>${t}</option>`).join('')}</select></div>
    <div class="campo"><label for="un-piso">Piso</label>
      <input id="un-piso" type="number" step="1" value="${u.piso ?? ''}"></div>
    <div class="campo"><label for="un-nivel">Nivel del análisis</label>
      <select id="un-nivel"><option value="">Sin vincular</option>
        ${ns.map(x=>`<option value="${x.id}" ${x.id===u.nivel_id?'selected':''}>${esc(x.nombre)}</option>`).join('')}
      </select></div>
    ${n('sup_cubierta','Cubierta m²')}
    ${n('sup_semicubierta','Semicubierta m²')}
    ${n('sup_comun','Común m²')}
    <div class="campo"><label for="un-coeficiente">Coeficiente de valor</label>
      <input id="un-coeficiente" type="number" step="0.01" min="0.01"
        value="${u.coeficiente ?? 1}">
      <span class="ayuda">1,00 es la referencia. Un cuarto piso puede ir en 1,10.</span></div>
    <div class="campo"><label for="un-precio">Precio de lista USD</label>
      <input id="un-precio" type="number" step="1000" min="0" value="${u.precio_lista ?? ''}"></div>
    <div class="campo"><label for="un-orden">Orden</label>
      <input id="un-orden" type="number" step="1" value="${u.orden ?? unidadesDe(o.id).length*10}"></div>
    <div class="campo ancho"><label for="un-nota">Nota</label>
      <input id="un-nota" value="${esc(u.nota||'')}" placeholder="Opcional"></div>
    ${id && esAdmin() ? `<div class="campo ancho">
      <button class="btn sec" onclick="cerrar();borrar('unidades','${id}')">Eliminar esta unidad</button></div>`:''}`,
    async ()=>{
      const codigo = val('un-codigo');
      if(!codigo) return err('Poné el código de la unidad.');
      const num = c => { const v = val('un-'+c); return v === '' ? null : parseFloat(v); };
      const datos = { obra_id:o.id, codigo, tipo:val('un-tipo'),
        piso: num('piso'), nivel_id: val('un-nivel') || null,
        sup_cubierta: num('sup_cubierta')||0, sup_semicubierta: num('sup_semicubierta')||0,
        sup_comun: num('sup_comun')||0, coeficiente: num('coeficiente')||1,
        precio_lista: num('precio'), orden: parseInt(val('un-orden'))||0,
        nota: val('un-nota') };
      cerrar();
      await guardar('unidades', datos, id);
    });
}

function asignarUnidad(id){
  const o = obra();
  const u = (D.unidades_obra||[]).find(x=>x.id===id);
  const invObra = partsDe(o.id).map(p=>inv(p.inversor_id)).filter(Boolean)
    .sort((a,b)=>a.nombre.localeCompare(b.nombre));
  const vs = ventasDe(o.id);

  modal(`Situación de ${esc(u.codigo)}`, `
    <div class="campo ancho"><label for="as-estado">Estado</label>
      <select id="as-estado" onchange="tglAsignar()">
        ${Object.entries(ESTADO_UNIDAD).map(([k,v])=>
          `<option value="${k}" ${k===u.estado?'selected':''}>${v[0]}</option>`).join('')}
      </select></div>
    <div class="campo ancho" id="wrap-as-inv"><label for="as-inv">Inversor</label>
      <select id="as-inv"><option value="">Sin asignar</option>
        ${invObra.map(i=>`<option value="${i.id}" ${i.id===u.inversor_id?'selected':''}>${esc(i.nombre)}</option>`).join('')}
      </select>
      <span class="ayuda">Queda a nombre de ese inversor y él la ve en su rendición.</span></div>
    <div class="campo ancho" id="wrap-as-venta"><label for="as-venta">Venta</label>
      <select id="as-venta"><option value="">Sin vincular</option>
        ${vs.map(v=>`<option value="${v.id}" ${v.id===u.venta_id?'selected':''}>${esc(v.cliente)}${v.unidad?` · ${esc(v.unidad)}`:''}</option>`).join('')}
      </select>
      ${vs.length ? '' : '<span class="ayuda">Todavía no hay ventas cargadas en esta obra.</span>'}</div>`,
    async ()=>{
      const estado = val('as-estado');
      const datos = { estado,
        inversor_id: ['asignada','reservada'].includes(estado) ? (val('as-inv')||null) : null,
        venta_id:    estado === 'vendida' ? (val('as-venta')||null) : null };
      cerrar();
      await guardar('unidades', datos, id);
    });
  tglAsignar();
}
function tglAsignar(){
  const e = document.getElementById('as-estado');
  if(!e) return;
  const wi = document.getElementById('wrap-as-inv');
  const wv = document.getElementById('wrap-as-venta');
  if(wi) wi.style.display = ['asignada','reservada'].includes(e.value) ? '' : 'none';
  if(wv) wv.style.display = e.value === 'vendida' ? '' : 'none';
}

function exportarUnidades(){
  const o = obra();
  const c = computo(o.id);
  const num = v => Math.round((+v||0)*100)/100;
  const filas = [['Unidad','Tipo','Piso','Cubierta','Semicubierta','Común','Superficie',
                  'Coeficiente','Ponderada','Porcentual','Costo asignado','Precio de lista',
                  'Estado','Inversor','Comprador','Nota']];
  cuadroUnidades(o.id).forEach(f=>{
    const u = f.u;
    filas.push([u.codigo, u.tipo, u.piso ?? '', num(u.sup_cubierta), num(u.sup_semicubierta),
      num(u.sup_comun), num(f.superficie), num(u.coeficiente), num(f.ponderada),
      num(f.porcentual), c && c.total ? num(c.total*f.porcentual/100) : '',
      u.precio_lista ? num(u.precio_lista) : '',
      (ESTADO_UNIDAD[u.estado]||[''])[0],
      u.inversor_id ? (inv(u.inversor_id)?.nombre||'') : '',
      u.venta_id ? (D.ventas.find(v=>v.id===u.venta_id)?.cliente||'') : '',
      u.nota||'']);
  });
  bajarExcel([{ nombre:'Unidades', filas }],
    `unidades-${o.nombre.replace(/\s+/g,'-').toLowerCase()}`);
}

/* ---------- Análisis económico ---------- */
const m2f = v => (+v||0).toLocaleString('es-AR',{maximumFractionDigits:2}) + ' m²';

function vAnalisis(o){
  const c = computo(o.id);
  const a = analisisDe(o.id);
  const ns = nivelesDe(o.id);

  if(!a){
    return `<div class="vacio" style="text-align:left">
      <strong>Análisis económico del anteproyecto.</strong>
      <p style="font-size:12.5px;color:var(--gris);margin:6px 0 12px">
        Cargá el costo del metro cubierto, los coeficientes de incidencia de cada tipo
        de superficie y los indirectos. Después las superficies por nivel.
        De ahí sale el costo por metro vendible proyectado.</p>
      ${puedeEditar()?`<button class="btn" onclick="formAnalisis()">Configurar el análisis</button>`:''}
    </div>`;
  }

  const t = totalesObra(o.id);
  const real = c && c.vendible ? t.egr / c.vendible : 0;

  return `
  ${puedeEditar()?`<div class="acciones">
    <button class="btn sec" onclick="formAnalisis()">Parámetros</button>
    <button class="btn" onclick="formNivel()">Agregar nivel</button>
    <button class="btn sec" onclick="window.print()">Imprimir</button>
  </div>`:''}

  <div class="reporte">
    <div class="rep-cabeza">
      <h2>${esc(o.nombre)}</h2>
      <p>Análisis económico del anteproyecto${a.zona?` · ${esc(a.zona)}`:''}</p>
      <p class="pct">Costo del metro cubierto ${fmtUsd(a.costo_m2_base)}
        ${a.plazo_meses?` · plazo ${a.plazo_meses} meses`:''}
        ${a.terreno_ancho&&a.terreno_largo
          ? ` · terreno ${a.terreno_ancho} × ${a.terreno_largo} = ${m2f(a.terreno_ancho*a.terreno_largo)}`:''}</p>
    </div>

    <h3>Superficies por nivel</h3>
    ${ns.length ? `<table><thead><tr><th>Nivel</th>
      <th class="der ocultar-chico">Coch. SS</th><th class="der ocultar-chico">Coch. PB</th>
      <th class="der">Cubierta</th><th class="der">Semi</th>
      <th class="der">Comunes</th><th class="der ocultar-chico">Terrazas</th>
      <th class="der">Unid.</th><th></th></tr></thead><tbody>
      ${ns.map(n=>`<tr><td>${esc(n.nombre)}</td>
        <td class="der num ocultar-chico">${+n.coch_ss||'—'}</td>
        <td class="der num ocultar-chico">${+n.coch_pb||'—'}</td>
        <td class="der num">${+n.cubierta||'—'}</td>
        <td class="der num">${+n.semicubierta||'—'}</td>
        <td class="der num">${+n.comun||'—'}</td>
        <td class="der num ocultar-chico">${+n.terraza||'—'}</td>
        <td class="der num">${+n.unidades||'—'}</td>
        <td class="der no-imprimir">${puedeEditar()?`<button class="link" onclick="formNivel('${n.id}')">Editar</button>`:''}</td>
      </tr>`).join('')}
      <tr><td><strong>Total</strong></td>
        ${['coch_ss','coch_pb','cubierta','semicubierta','comun','terraza'].map((k,i)=>
          `<td class="der num ${i<2||i===5?'ocultar-chico':''}"><strong>${
            ns.reduce((s,n)=>s+ +n[k]||0,0).toLocaleString('es-AR',{maximumFractionDigits:2})||'—'}</strong></td>`).join('')}
        <td class="der num"><strong>${ns.reduce((s,n)=>s+ +n.unidades||0,0)||'—'}</strong></td><td></td></tr>
    </tbody></table>` : `<div class="vacio">Todavía no hay niveles cargados.</div>`}

    ${c ? `
    <h3>Costo de construcción</h3>
    <table><thead><tr><th>Concepto</th><th class="der">m²</th><th class="der">Incidencia</th>
      <th class="der">U$S/m²</th><th class="der">Total</th></tr></thead><tbody>
      ${c.lineas.filter(l=>l.m2).map(l=>`<tr><td>${esc(l.nombre)}</td>
        <td class="der num">${l.m2.toLocaleString('es-AR',{maximumFractionDigits:2})}</td>
        <td class="der num">${fmtPct(l.coef*100)}</td>
        <td class="der num">${fmtUsd(l.costoM2)}</td>
        <td class="der num">${fmtUsd(l.total)}</td></tr>`).join('')}
      <tr><td colspan="4"><strong>Costo de construcción neto</strong></td>
        <td class="der num"><strong>${fmtUsd(c.construccion)}</strong></td></tr>
    </tbody></table>

    <h3>Terreno e indirectos</h3>
    <table><thead><tr><th>Concepto</th><th>Base</th><th class="der">Importe</th></tr></thead><tbody>
      ${c.indirectos.map(([n,v,base])=>`<tr><td>${esc(n)}</td>
        <td><span class="pct">${esc(base)}</span></td>
        <td class="der num">${fmtUsd(v)}</td></tr>`).join('')}
      <tr><td colspan="2"><strong>Costo total del emprendimiento</strong></td>
        <td class="der num"><strong>${fmtUsd(c.total)}</strong></td></tr>
    </tbody></table>

    <h3>Incidencia en el metro vendible</h3>
    <table><thead><tr><th>Componente</th><th class="der">Importe</th>
      <th class="der">U$S por m² vendible</th><th class="der">Participación</th>
      </tr></thead><tbody>
      ${c.desglose.map(([n,v,x])=>`<tr><td>${esc(n)}</td>
        <td class="der num">${fmtUsd(v)}</td>
        <td class="der num">${fmtUsd2(x)}</td>
        <td class="der num">${fmtPct(v/c.total*100)}</td></tr>`).join('')}
      <tr><td><strong>Costo por m² vendible</strong></td>
        <td class="der num"><strong>${fmtUsd(c.total)}</strong></td>
        <td class="der num"><strong>${fmtUsd2(c.porVendible)}</strong></td>
        <td class="der num">100,0%</td></tr>
      <tr><td>Sobre el total construido <span class="pct">${m2f(c.totalM2)}</span></td>
        <td class="der">—</td>
        <td class="der num">${fmtUsd2(c.porTotal)}</td><td class="der">—</td></tr>
    </tbody></table>
    <p class="sub">El terreno y los indirectos se prorratean sobre los metros vendibles,
    igual que la construcción. Por eso el costo final del metro los incluye.</p>

    ${(() => {
      const us = cuadroUnidades(o.id);
      if(!us.length) return '';
      const vend = us.filter(f=>f.u.estado==='vendida');
      const asig = us.filter(f=>['asignada','reservada'].includes(f.u.estado));
      return `<h3>Unidades</h3>
      <table><thead><tr><th>Unidad</th><th class="der">Superficie</th>
        <th class="der">Coef.</th><th class="der">Porcentual</th>
        <th class="der">Costo asignado</th><th>Situación</th></tr></thead><tbody>
        ${us.map(f=>`<tr><td>${esc(f.u.codigo)}</td>
          <td class="der num">${f.superficie.toLocaleString('es-AR',{maximumFractionDigits:2})} m²</td>
          <td class="der num">${(+f.u.coeficiente).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
          <td class="der num">${fmtPct(f.porcentual)}</td>
          <td class="der num">${fmtUsd(c.total*f.porcentual/100)}</td>
          <td>${(ESTADO_UNIDAD[f.u.estado]||[''])[0]}
            ${f.u.inversor_id?`<br><span class="pct">${esc(inv(f.u.inversor_id)?.nombre||'')}</span>`:''}
            ${f.u.venta_id?`<br><span class="pct">${esc(D.ventas.find(v=>v.id===f.u.venta_id)?.cliente||'')}</span>`:''}</td>
        </tr>`).join('')}
        <tr><td><strong>Total</strong></td>
          <td class="der num"><strong>${us.reduce((s,f)=>s+f.superficie,0).toLocaleString('es-AR',{maximumFractionDigits:2})} m²</strong></td>
          <td></td><td class="der num"><strong>100,0%</strong></td>
          <td class="der num"><strong>${fmtUsd(c.total)}</strong></td>
          <td><span class="pct">${vend.length} vendida${vend.length===1?'':'s'} · ${asig.length} asignada${asig.length===1?'':'s'}</span></td></tr>
      </tbody></table>`;
    })()}

    <h3>Resultado</h3>
    <div class="fila">
      <div class="kpi"><p class="r">Vendible</p><p class="v num">${m2f(c.vendible)}</p>
        <p class="s">${c.totalM2?fmtPct(c.vendible/c.totalM2*100):''} del total</p></div>
      <div class="kpi"><p class="r">Comunes</p><p class="v num">${m2f(c.comunes)}</p>
        <p class="s">${c.totalM2?fmtPct(c.comunes/c.totalM2*100):''} del total</p></div>
      <div class="kpi"><p class="r">Costo por m² vendible</p>
        <p class="v num">${fmtUsd(c.porVendible)}</p>
        <p class="s">proyectado</p></div>
      ${real?`<div class="kpi ${real>c.porVendible?'alerta':''}">
        <p class="r">Ejecutado por m² vendible</p><p class="v num">${fmtUsd(real)}</p>
        <p class="s">${fmtUsd(t.egr)} gastados a hoy</p></div>`:''}
      ${c.unidades?`<div class="kpi"><p class="r">Por unidad</p>
        <p class="v num">${fmtUsd(c.total/c.unidades)}</p>
        <p class="s">${c.unidades} unidades</p></div>`:''}
    </div>` : ''}
  </div>`;
}

function formAnalisis(){
  const o = obra(), a = analisisDe(o.id) || {};
  const n = (id, et, v, paso='0.01') =>
    `<div class="campo"><label for="${id}">${et}</label>
      <input id="${id}" type="number" step="${paso}" value="${v ?? ''}"></div>`;
  modal('Parámetros del análisis', `
    <div class="campo ancho"><label for="an-zona">Zona</label>
      <input id="an-zona" value="${esc(a.zona||'')}" placeholder="Pichincha, Rosario"></div>
    ${n('an-base','Costo del m² cubierto U$S', a.costo_m2_base, '1')}
    ${n('an-plazo','Plazo en meses', a.plazo_meses, '1')}
    ${n('an-terreno','Costo del terreno U$S', a.costo_terreno, '100')}
    ${n('an-ancho','Ancho del terreno m', a.terreno_ancho)}
    ${n('an-largo','Largo del terreno m', a.terreno_largo)}
    <div class="campo ancho"><span class="ayuda"><strong>Coeficientes de incidencia</strong>
      sobre el costo del metro cubierto. 1 es el cubierto pleno.</span></div>
    ${n('an-cochss','Cocheras subsuelo', a.coef_coch_ss ?? 0.70)}
    ${n('an-cochpb','Cocheras planta baja', a.coef_coch_pb ?? 0.40)}
    ${n('an-cub','Cubierta', a.coef_cubierta ?? 1)}
    ${n('an-semi','Semicubierta', a.coef_semicubierta ?? 0.60)}
    ${n('an-comun','Comunes', a.coef_comun ?? 0.60)}
    ${n('an-terraza','Terrazas', a.coef_terraza ?? 0.40)}
    <div class="campo ancho"><span class="ayuda"><strong>Indirectos.</strong>
      Los porcentajes se aplican sobre el costo de construcción neto,
      salvo la comisión que va sobre el terreno.</span></div>
    ${n('an-proy','Proyecto %', a.pct_proyecto ?? 3.5, '0.1')}
    ${n('an-dir','Dirección y conducción %', a.pct_direccion ?? 9, '0.1')}
    ${n('an-des','Desarrollo y gestión %', a.pct_desarrollo ?? 5, '0.1')}
    ${n('an-adm','Administración financiera %', a.pct_administracion ?? 2, '0.1')}
    ${n('an-com','Comisión inmobiliaria %', a.pct_comision ?? 3, '0.1')}
    ${n('an-esc','Escritura y fideicomiso U$S', a.gastos_escritura, '100')}
    ${n('an-mun','Gastos y permisos U$S', a.gastos_municipales, '100')}
    <div class="campo ancho"><label for="an-nota">Nota</label>
      <input id="an-nota" value="${esc(a.nota||'')}" placeholder="Opcional"></div>`,
    async ()=>{
      const num = id => { const v = val(id); return v === '' ? null : parseFloat(v); };
      const datos = { obra_id:o.id, zona:val('an-zona'),
        costo_m2_base:num('an-base')||0, plazo_meses:num('an-plazo'),
        costo_terreno:num('an-terreno')||0,
        terreno_ancho:num('an-ancho'), terreno_largo:num('an-largo'),
        coef_coch_ss:num('an-cochss')||0, coef_coch_pb:num('an-cochpb')||0,
        coef_cubierta:num('an-cub')||0, coef_semicubierta:num('an-semi')||0,
        coef_comun:num('an-comun')||0, coef_terraza:num('an-terraza')||0,
        pct_proyecto:num('an-proy')||0, pct_direccion:num('an-dir')||0,
        pct_desarrollo:num('an-des')||0, pct_administracion:num('an-adm')||0,
        pct_comision:num('an-com')||0,
        gastos_escritura:num('an-esc')||0, gastos_municipales:num('an-mun')||0,
        nota:val('an-nota'), actualizado_en:new Date().toISOString() };
      cerrar();
      const { error } = await sb.from('analisis').upsert(datos);
      if(error) return aviso('No se pudo guardar: ' + error.message, true);
      aviso('Análisis actualizado');
      await cargarDatos();
    });
}

function formNivel(id){
  const o = obra();
  const v = id ? D.niveles.find(x=>x.id===id) : {};
  const n = (campo, et) =>
    `<div class="campo"><label for="ni-${campo}">${et}</label>
      <input id="ni-${campo}" type="number" step="0.01" min="0" value="${+v[campo]||''}"></div>`;
  modal(id ? 'Editar nivel' : 'Agregar nivel', `
    <div class="campo ancho"><label for="ni-nombre">Nivel</label>
      <input id="ni-nombre" value="${esc(v.nombre||'')}" placeholder="Planta 3° Piso"></div>
    ${n('coch_ss','Cocheras subsuelo m²')}
    ${n('coch_pb','Cocheras planta baja m²')}
    ${n('cubierta','Cubierta exclusiva m²')}
    ${n('semicubierta','Semicubierta exclusiva m²')}
    ${n('comun','Comunes m²')}
    ${n('terraza','Terrazas m²')}
    <div class="campo"><label for="ni-unidades">Unidades</label>
      <input id="ni-unidades" type="number" step="1" min="0" value="${+v.unidades||''}"></div>
    <div class="campo"><label for="ni-orden">Orden</label>
      <input id="ni-orden" type="number" step="1" value="${v.orden ?? nivelesDe(o.id).length*10}"></div>
    ${id && esAdmin() ? `<div class="campo ancho">
      <button class="btn sec" onclick="cerrar();borrar('niveles','${id}')">Eliminar este nivel</button></div>`:''}`,
    async ()=>{
      if(!val('ni-nombre')) return err('Poné el nombre del nivel.');
      const num = campo => parseFloat(val('ni-'+campo))||0;
      const datos = { obra_id:o.id, nombre:val('ni-nombre'),
        coch_ss:num('coch_ss'), coch_pb:num('coch_pb'),
        cubierta:num('cubierta'), semicubierta:num('semicubierta'),
        comun:num('comun'), terraza:num('terraza'),
        unidades:parseInt(val('ni-unidades'))||0,
        orden:parseInt(val('ni-orden'))||0 };
      cerrar();
      await guardar('niveles', datos, id);
    });
}

/* ---------- Cajas ---------- */
function vCajas(o){
  const cs = cajasDe(o.id);
  return `
  ${puedeEditar() ? `<div class="acciones">
    <button class="btn" onclick="formAporte()">Registrar aporte</button>
    <button class="btn sec" onclick="formCaja()">Agregar caja</button></div>` : ''}
  <p class="sub">Las cajas dicen dónde está la plata, no para qué se gastó: eso lo dice el rubro. Los aportes entran a la caja que corresponda y los pagos salen de ahí.</p>
  <table><thead><tr><th>Caja</th><th class="der">Ingresos</th><th class="der">Egresos</th>
    <th class="der">Deuda</th><th class="der">Saldo</th></tr></thead><tbody>
    ${cs.map(c=>{const s=saldoCaja(c.id);
      return `<tr><td><strong>${esc(c.nombre)}</strong>
      ${c.detalle?`<br><span class="pct">${esc(c.detalle)}</span>`:''}
      ${puedeEditar()?`<br><button class="link" onclick="formCaja('${c.id}')">Editar</button>`:''}</td>
      <td class="der num">${fmtUsd(s.ing)}</td><td class="der num">${fmtUsd(s.egr)}</td>
      <td class="der num">${s.deuda?fmtUsd(s.deuda):'—'}</td>
      <td class="der num" style="font-weight:600;${s.saldo<0?'color:var(--rojo)':''}">${fmtUsd(s.saldo)}</td>
      </tr>`;}).join('')}</tbody></table>
  <h3>Aportes registrados</h3>
  ${aportesDe(o.id).length ? `<table><thead><tr><th>Fecha</th><th>Inversor</th><th>Clase</th>
    <th>Caja</th><th class="der">Original</th><th class="der">En USD</th><th></th></tr></thead><tbody>
    ${aportesDe(o.id).slice().sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(a=>`<tr>
      <td class="num">${fecha(a.fecha)}</td><td>${esc(inv(a.inversor_id)?.nombre||'—')}</td>
      <td><span class="chip ${a.clase==='B'?'a':''}">${esc(clasesDe(o.id)[a.clase==='B'?'B':'A'].nombre)}</span></td>
      <td>${esc(caja(a.caja_id)?.nombre||'—')}
        ${a.unidad?`<br><span class="pct">${esc(a.unidad)}</span>`:''}</td>
      <td class="der num">${a.moneda==='USD'?fmtUsd2(a.importe):fmtArs(a.importe)}</td>
      <td class="der num" style="font-weight:600">${fmtUsd2(a.usd)}</td>
      <td class="der">${puedeEditar()?`<button class="link" onclick="formAporte('${a.id}')">Editar</button>`:''}
        ${esAdmin()?`<br><button class="link" onclick="borrar('aportes','${a.id}')">Eliminar</button>`:''}</td>
      </tr>`).join('')}</tbody></table>`
    : `<div class="vacio">Sin aportes registrados.</div>`}`;
}

/* ---------- Comprobantes ---------- */
function setFiltro(campo, v){
  ({rubro:()=>filtroRubro=v, prov:()=>filtroProv=v, tipo:()=>filtroTipo=v,
    estado:()=>filtroEstado=v, texto:()=>filtroTexto=v}[campo])();
  render();
}
function limpiarFiltros(){
  filtroRubro = filtroProv = filtroTipo = filtroEstado = filtroTexto = '';
  render();
}

function vGastos(o){
  const todos = gastosDe(o.id).slice().sort((a,b)=>b.fecha.localeCompare(a.fecha));

  const texto = filtroTexto.trim().toLowerCase();
  const gs = todos.filter(g => {
    if(filtroRubro && g.rubro_id !== filtroRubro) return false;
    if(filtroProv  && (g.proveedor||'').trim() !== filtroProv) return false;
    if(filtroTipo  && g.tipo !== filtroTipo) return false;
    if(filtroEstado === 'pendiente' && !(computa(g) && g.pago !== 'pagado')) return false;
    if(filtroEstado === 'pagado'    && !(computa(g) && g.pago === 'pagado')) return false;
    if(filtroEstado === 'info'      && computa(g)) return false;
    if(texto){
      const donde = [g.proveedor, g.detalle, g.numero, g.cuit,
                     rubro(g.rubro_id)?.nombre, caja(g.caja_id)?.nombre]
        .join(' ').toLowerCase();
      if(!donde.includes(texto)) return false;
    }
    return true;
  });

  const hayFiltro = filtroRubro || filtroProv || filtroTipo || filtroEstado || texto;
  const totalFiltrado = gs.filter(computa).reduce((s,g)=>s+ +g.usd, 0);

  const rubrosUsados = D.rubros.filter(r => todos.some(g=>g.rubro_id===r.id));
  const provUsados = [...new Set(todos.map(g=>(g.proveedor||'').trim()).filter(Boolean))].sort();
  const tiposUsados = [...new Set(todos.map(g=>g.tipo).filter(Boolean))].sort();
  const est = 'font:inherit;font-size:13px;padding:6px 9px;border:1px solid var(--linea-fuerte);border-radius:3px';

  return `
  ${puedeEditar() ? `<div class="acciones">
    <button class="btn" onclick="formGasto()">Cargar comprobante</button>
    <button class="btn sec" onclick="exportarComprobantes()">Exportar a Excel</button></div>` : ''}

  ${todos.length ? `<div class="acciones">
    <input id="f-texto" value="${esc(filtroTexto)}" placeholder="Buscar por proveedor, detalle o número"
      onchange="setFiltro('texto',this.value)" style="${est};width:250px">
    <select onchange="setFiltro('rubro',this.value)" style="${est}">
      <option value="">Todos los rubros</option>
      ${rubrosUsados.map(r=>`<option value="${r.id}" ${r.id===filtroRubro?'selected':''}>${esc(r.nombre)}</option>`).join('')}
    </select>
    <select onchange="setFiltro('prov',this.value)" style="${est}">
      <option value="">Todos los proveedores</option>
      ${provUsados.map(p=>`<option value="${esc(p)}" ${p===filtroProv?'selected':''}>${esc(p)}</option>`).join('')}
    </select>
    <select onchange="setFiltro('tipo',this.value)" style="${est}">
      <option value="">Todo comprobante</option>
      ${tiposUsados.map(t=>`<option value="${esc(t)}" ${t===filtroTipo?'selected':''}>${esc(t)}</option>`).join('')}
    </select>
    <select onchange="setFiltro('estado',this.value)" style="${est}">
      <option value="">Todo estado</option>
      <option value="pagado" ${filtroEstado==='pagado'?'selected':''}>Pagados</option>
      <option value="pendiente" ${filtroEstado==='pendiente'?'selected':''}>Pendientes</option>
      <option value="info" ${filtroEstado==='info'?'selected':''}>Informativos</option>
    </select>
    ${hayFiltro?`<button class="link" onclick="limpiarFiltros()">Limpiar</button>`:''}
  </div>
  ${hayFiltro?`<p class="sub">${gs.length} de ${todos.length} comprobantes ·
    ${fmtUsd(totalFiltrado)} en lo filtrado</p>`:''}` : ''}

  ${gs.length ? `<table><thead><tr><th>Fecha</th><th>Proveedor</th><th>Rubro</th>
    <th class="ocultar-chico">Comprobante</th><th>Estado</th>
    <th class="der">Original</th><th class="der">TC</th>
    <th class="der">En USD</th><th></th></tr></thead><tbody>
    ${gs.map(g=>`<tr><td class="num">${fecha(g.fecha)}</td>
      <td>${esc(g.proveedor)}${g.detalle?`<br><span class="pct">${esc(g.detalle)}</span>`:''}
        ${g.archivo?`<br><button class="link" data-ruta="${esc(g.archivo)}" onclick="verArchivo(this.dataset.ruta)">Ver comprobante</button>`:''}</td>
      <td>${esc(rubro(g.rubro_id)?.nombre||'—')}
        ${g.computa_honorarios===false?'<br><span class="pct">no computa honorarios</span>':''}</td>
      <td class="ocultar-chico"><span class="chip ${g.tipo==='Sin comprobante'?'a':''}">${esc(g.tipo)}</span>
        ${g.numero?`<br><span class="pct num">${esc(g.numero)}</span>`:''}
        <br><span class="pct">${esc(caja(g.caja_id)?.nombre||'sin caja')}</span></td>
      <td>${soloInfo(g)
        ? `<span class="chip">Informativo</span><br><span class="pct">no suma al costo</span>`
        : g.pago==='pagado'
        ? `<span class="chip v">Pagado</span>${g.fecha_pago?`<br><span class="pct num">${fecha(g.fecha_pago)}</span>`:''}`
        : `<span class="chip a">Pendiente</span>${puedeEditar()?`<br><button class="link" onclick="marcarPagado('${g.id}')">Marcar pagado</button>`:''}`}</td>
      <td class="der num">${g.moneda==='USD'?fmtUsd2(g.importe):fmtArs(g.importe)}</td>
      <td class="der num">${fmtTc(g)}</td>
      <td class="der num" style="font-weight:600">${fmtUsd2(g.usd)}
        ${g.moneda==='USD' && tcDe(g)
          ? `<br><span class="pct">${fmtArs(+g.importe*tcDe(g))}</span>` : ''}</td>
      <td class="der">${puedeEditar()?`<button class="link" onclick="formGasto('${g.id}')">Editar</button>`:''}
        ${esAdmin()?`<br><button class="link" onclick="borrar('comprobantes','${g.id}')">Eliminar</button>`:''}</td>
      </tr>`).join('')}</tbody></table>`
    : `<div class="vacio">${hayFiltro
        ? 'Ningún comprobante coincide con el filtro. <button class="link" onclick="limpiarFiltros()">Limpiar</button>'
        : 'Ningún comprobante cargado en esta obra.'}</div>`}`;
}

/* ---------- Rubros ---------- */
function vRubros(o){
  const totP = D.rubros.reduce((s,r)=>s+presu(o.id,r.id),0);
  const totE = D.rubros.reduce((s,r)=>s+ejecutado(o.id,r.id),0);
  let grupo = null, filas = '';
  D.rubros.forEach(r => {
    if(r.grupo !== grupo){ grupo = r.grupo;
      filas += `<tr class="grupo-rubro"><td colspan="6">${esc(grupo)}
        ${puedeEditar()?` <button class="link" data-grupo="${esc(grupo)}" onclick="renombrarGrupo(this.dataset.grupo)">renombrar</button>`:''}
        </td></tr>`; }
    const p = presu(o.id,r.id), e = ejecutado(o.id,r.id), d = p-e;
    const auto = esHonorario(r) && pctHon(o.id, r.nombre);
    const celda = auto
      ? `<span class="num">${fmtUsd(p)}</span><br><span class="pct">${fmtPct(pctHon(o.id,r.nombre))} sobre la base</span>`
      : (puedeEditar()
         ? `<input type="number" min="0" step="100" value="${p||''}" placeholder="0"
             style="width:130px;text-align:right;font:inherit;padding:5px 7px;
             border:1px solid var(--linea-fuerte);border-radius:3px"
             onchange="setPresu('${r.id}',this.value)">`
         : `<span class="num">${p?fmtUsd(p):'—'}</span>`);
    filas += `<tr><td>${esc(r.nombre)}${r.base_honorarios?'':' <span class="pct">· fuera de la base</span>'}
      ${puedeEditar()?`<br><button class="link" onclick="formRubro('${r.id}')">Editar</button>`:''}</td>
      <td class="der">${celda}</td>
      <td class="der num">${totP&&p?fmtPct(p/totP*100):'—'}</td>
      <td class="der num">${fmtUsd(e)}</td>
      <td class="der num">${totE&&e?fmtPct(e/totE*100):'—'}</td>
      <td class="der num" style="${p&&d<0?'color:var(--rojo);font-weight:600':''}">${p?fmtUsd(d):'—'}</td></tr>`;
  });
  return `<p class="sub">Presupuesto en dólares por rubro. Conducción técnica y administración
  se calculan solas con los porcentajes de la pestaña Honorarios.</p>
  <table><thead><tr><th>Rubro</th><th class="der" style="width:160px">Presupuesto USD</th>
    <th class="der">% del total</th><th class="der">Ejecutado</th>
    <th class="der">% del total</th><th class="der">Diferencia</th></tr></thead>
    <tbody>${filas}
    <tr><td><strong>Total</strong></td>
      <td class="der num"><strong>${fmtUsd(totP)}</strong></td>
      <td class="der num">${totP?'100,0%':'—'}</td>
      <td class="der num"><strong>${fmtUsd(totE)}</strong></td>
      <td class="der num">${totE?'100,0%':'—'}</td>
      <td class="der num">${totP?fmtUsd(totP-totE):'—'}</td></tr>
    </tbody></table>
  ${puedeEditar()?`<div class="acciones" style="margin-top:14px">
    <button class="btn sec" onclick="formRubro()">Agregar rubro</button>
    <button class="btn sec" onclick="nuevoGrupo()">Agregar grupo</button></div>`:''}`;
}

/* ---------- Honorarios ---------- */
function vHonorarios(o){
  const bE = baseEjecutada(o.id), bP = basePresu(o.id), hs = honorarios(o.id);
  const campo = (col,v) => puedeEditar()
    ? `<input type="number" min="0" step="0.5" value="${v||''}" placeholder="0"
        style="width:80px;text-align:right;font:inherit;padding:5px 7px;
        border:1px solid var(--linea-fuerte);border-radius:3px"
        onchange="setPctHon('${col}',this.value)">`
    : `<span class="num">${fmtPct(v)}</span>`;
  return `
  <p class="sub">Porcentaje sobre los rubros de obra. Quedan afuera terreno, escrituración,
  impuestos, permisos y todos los honorarios. Tampoco computan los fletes ni los
  comprobantes marcados como no computables.</p>
  <div class="fila">
    <div class="kpi"><p class="r">Base presupuestada</p><p class="v num">${fmtUsd(bP)}</p></div>
    <div class="kpi"><p class="r">Base ejecutada</p><p class="v num">${fmtUsd(bE)}</p>
      <p class="s">${bP?fmtPct(bE/bP*100)+' de la base':'sin presupuesto'}</p></div>
  </div>
  <table><thead><tr><th>Concepto</th><th class="der">%</th><th class="der">Proyectado</th>
    <th class="der">Devengado</th><th class="der">Pagado</th><th class="der">A pagar</th></tr></thead><tbody>
    ${hs.map(x=>`<tr><td><strong>${esc(x.nombre)}</strong></td>
      <td class="der">${campo(HONORARIOS.find(([n])=>n===x.nombre)[1], x.pct)}</td>
      <td class="der num">${fmtUsd(x.proyectado)}</td>
      <td class="der num">${fmtUsd(x.devengado)}</td>
      <td class="der num">${fmtUsd(x.pagado)}</td>
      <td class="der num" style="font-weight:600;${x.saldo<0?'color:var(--rojo)':''}">${fmtUsd2(x.saldo)}</td>
      </tr>`).join('')}
    <tr><td><strong>Total</strong></td><td></td>
      <td class="der num">${fmtUsd(hs.reduce((s,x)=>s+x.proyectado,0))}</td>
      <td class="der num"><strong>${fmtUsd(hs.reduce((s,x)=>s+x.devengado,0))}</strong></td>
      <td class="der num">${fmtUsd(hs.reduce((s,x)=>s+x.pagado,0))}</td>
      <td class="der num"><strong>${fmtUsd2(hs.reduce((s,x)=>s+x.saldo,0))}</strong></td></tr>
  </tbody></table>
  <p class="sub" style="margin-top:12px">Devengado es lo ganado según el avance real.
  Pagado son los comprobantes imputados a esos rubros.</p>

  ${(() => {
    const fuera = gastosDe(o.id).filter(g => computa(g) && g.computa_honorarios === false
      && rubro(g.rubro_id)?.base_honorarios);
    if(!fuera.length) return '';
    const total = fuera.reduce((s,g)=>s+ +g.usd,0);
    return `<h3>Excluido de la base</h3>
    <p class="sub">${fuera.length} comprobante${fuera.length===1?'':'s'} por ${fmtUsd(total)}
    imputados a rubros de obra pero marcados como no computables, típicamente fletes.
    Si estuvieran en la base, los honorarios subirían ${fmtUsd(total*hs.reduce((s,x)=>s+x.pct,0)/100)}.</p>
    <table><thead><tr><th>Fecha</th><th>Proveedor</th><th>Rubro</th>
      <th class="der">Importe</th></tr></thead><tbody>
      ${fuera.slice().sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(g=>`<tr>
        <td class="num">${fecha(g.fecha)}</td><td>${esc(g.proveedor)}
          ${g.detalle?`<br><span class="pct">${esc(g.detalle)}</span>`:''}</td>
        <td>${esc(rubro(g.rubro_id)?.nombre||'—')}</td>
        <td class="der num">${fmtUsd2(g.usd)}</td></tr>`).join('')}
    </tbody></table>`;
  })()}`;
}

/* ---------- Proveedores ---------- */
function vProveedores(o){
  const ps = deudaProveedores(o.id), t = totalesObra(o.id);
  const deuda = ps.reduce((s,p)=>s+p.deuda,0);
  const conDeuda = ps.filter(p=>p.deuda>0);
  return `
  <div class="fila">
    <div class="kpi ${deuda>0?'alerta':''}"><p class="r">Deuda total</p><p class="v num">${fmtUsd(deuda)}</p>
      <p class="s">${conDeuda.length} proveedor${conDeuda.length===1?'':'es'} con saldo</p></div>
    <div class="kpi"><p class="r">Disponible en cajas</p><p class="v num">${fmtUsd(t.saldo)}</p></div>
    <div class="kpi ${t.neto<0?'alerta':''}"><p class="r">Queda después de pagar</p>
      <p class="v num">${fmtUsd(t.neto)}</p>
      <p class="s">${t.neto<0?'hace falta un refuerzo':'sin necesidad de refuerzo'}</p></div>
  </div>
  <h3>Cuenta corriente por proveedor</h3>
  ${ps.length ? `<table><thead><tr><th>Proveedor</th><th class="der">Comprado</th>
    <th class="der">Pagado</th><th class="der">Adeudado</th><th class="der">Antigüedad</th>
    </tr></thead><tbody>
    ${ps.map(p=>`<tr><td><strong>${esc(p.proveedor)}</strong>
      ${p.cuit?`<br><span class="pct num">${esc(p.cuit)}</span>`:''}</td>
      <td class="der num">${fmtUsd2(p.total)}</td>
      <td class="der num">${fmtUsd2(p.pagado)}</td>
      <td class="der num" style="font-weight:600;${p.deuda>0?'color:var(--rojo)':''}">${p.deuda?fmtUsd2(p.deuda):'—'}</td>
      <td class="der">${p.deuda
        ? `<span class="chip ${p.dias>60?'r':p.dias>30?'a':''}">${p.dias} día${p.dias===1?'':'s'}</span>`
        : '<span class="chip v">Al día</span>'}</td></tr>`).join('')}
    <tr><td><strong>Total</strong></td>
      <td class="der num">${fmtUsd2(ps.reduce((s,p)=>s+p.total,0))}</td>
      <td class="der num">${fmtUsd2(ps.reduce((s,p)=>s+p.pagado,0))}</td>
      <td class="der num"><strong>${fmtUsd2(deuda)}</strong></td><td></td></tr>
    </tbody></table>` : `<div class="vacio">Todavía no hay comprobantes.</div>`}
  <h3>Comprobantes pendientes de pago</h3>
  ${conDeuda.length ? `<table><thead><tr><th>Proveedor</th><th>Fecha</th><th>Rubro</th>
    <th class="der">Importe</th><th class="der">Días</th><th></th></tr></thead><tbody>
    ${conDeuda.flatMap(p=>p.pendientes.map(g=>{
      const d = Math.floor((Date.now()-new Date(g.fecha+'T00:00:00').getTime())/86400000);
      return `<tr><td>${esc(p.proveedor)}</td><td class="num">${fecha(g.fecha)}</td>
      <td>${esc(rubro(g.rubro_id)?.nombre||'—')}
        ${g.detalle?`<br><span class="pct">${esc(g.detalle)}</span>`:''}</td>
      <td class="der num" style="font-weight:600">${fmtUsd2(g.usd)}</td>
      <td class="der num">${d}</td>
      <td class="der">${puedeEditar()?`<button class="link" onclick="marcarPagado('${g.id}')">Pagar</button>`:''}</td></tr>`;
    })).join('')}</tbody></table>`
    : `<div class="vacio">No hay facturas pendientes.</div>`}`;
}

/* ---------- Inversores ---------- */
function vInversores(o){
  const cl = clasesDe(o.id), ap0 = aportesDe(o.id);
  const total = ap0.reduce((s,a)=>s+ +a.usd,0);
  const totU  = ap0.reduce((s,a)=>s+unidades(o.id,a),0);
  const totA = ap0.filter(a=>a.clase!=='B').reduce((s,a)=>s+ +a.usd,0);
  const totB = ap0.filter(a=>a.clase==='B').reduce((s,a)=>s+ +a.usd,0);
  const difCoef = cl.A.coef !== cl.B.coef;
  const filas = partsDe(o.id).map(p=>{
    const i = inv(p.inversor_id);
    if(!i) return null;
    const ap = ap0.filter(a=>a.inversor_id===i.id);
    const a = ap.filter(x=>x.clase!=='B').reduce((s,x)=>s+ +x.usd,0);
    const b = ap.filter(x=>x.clase==='B').reduce((s,x)=>s+ +x.usd,0);
    const u = ap.reduce((s,x)=>s+unidades(o.id,x),0);
    const cA = +p.comp_a||0, cB = +p.comp_b||0, integrado = a+b, comp = cA+cB;
    const porAporte = [...new Set(ap.map(x=>x.unidad).filter(Boolean))];
    const adjudicadas = unidadesDe(o.id).filter(x=>x.inversor_id===i.id).map(x=>x.codigo);
    const asignadas = [...new Set([...adjudicadas, ...porAporte])];
    return { p,i,a,b,u,cA,cB,asignadas,integrado,comp,pendiente:comp-integrado,
             part: totU?u/totU*100:0, partA: totA?a/totA*100:0, partB: totB?b/totB*100:0, n:ap.length };
  }).filter(Boolean)
    .sort((x,y)=> (y.integrado+y.comp)-(x.integrado+x.comp) || x.i.nombre.localeCompare(y.i.nombre));

  const campoCl = (letra,campo,v,ancho) => puedeEditar()
    ? `<input value="${esc(v)}" onchange="setClase('${letra}','${campo}',this.value)"
        ${campo==='coeficiente'?'type="number" min="0" step="0.01"':''}
        style="width:${ancho};${campo==='coeficiente'?'text-align:right;':''}font:inherit;padding:5px 7px;
        border:1px solid var(--linea-fuerte);border-radius:3px">`
    : esc(v);

  return `
  ${puedeEditar()?`<div class="acciones">
    <button class="btn" onclick="formParticipacion()">Sumar inversor a esta obra</button>
    <button class="btn sec" onclick="formAporte()">Registrar aporte</button></div>`:''}
  <h3>Clases de participación</h3>
  <table><thead><tr><th>Clase</th><th>Nombre</th><th class="der" style="width:120px">Coeficiente</th>
    <th class="der">Capital</th><th class="der">Unidades</th></tr></thead><tbody>
    ${['A','B'].map(L=>{const cap = L==='A'?totA:totB;
      return `<tr><td><strong>${L}</strong></td>
      <td>${campoCl(L,'nombre',cl[L].nombre,'150px')}</td>
      <td class="der">${campoCl(L,'coeficiente',cl[L].coef,'90px')}</td>
      <td class="der num">${fmtUsd(cap)}</td>
      <td class="der num">${fmtUsd(cap*cl[L].coef)}</td></tr>`;}).join('')}
  </tbody></table>
  <p class="sub" style="margin-top:8px">El coeficiente convierte capital en unidades de participación.
  Con ambas en 1,00 la participación es proporcional al capital.</p>

  <h3>Posición de cada inversor</h3>
  ${filas.length ? `<table><thead><tr><th>Inversor</th><th class="der">${esc(cl.A.nombre)}</th>
    <th class="der">${esc(cl.B.nombre)}</th><th class="der">Integrado</th>
    <th class="der ocultar-chico">Comprometido</th><th class="der">Pendiente</th>
    <th class="der">Participación</th></tr></thead><tbody>
    ${filas.map(f=>`<tr><td><strong>${esc(f.i.nombre)}</strong>
      <br><span class="pct">${f.n ? `${f.n} aporte${f.n===1?'':'s'}`
        : (f.comp ? 'sin aportes todavía' : 'sin participación en esta obra')}</span>
      ${f.asignadas.length?`<br><span class="chip">${f.asignadas.map(esc).join(' · ')}</span>`:''}
      ${puedeEditar()?`<br><button class="link" onclick="formParticipacion('${f.p.id}')">Editar</button>`:''}
      ${puedeEditar() && !f.n
        ? `<br><button class="link" data-nombre="${esc(f.i.nombre)}" onclick="quitarDeObra('${f.p.id}', this.dataset.nombre)">Quitar de la obra</button>` : ''}</td>
      <td class="der num">${f.a?fmtUsd(f.a):'—'}
        ${f.a?`<br><span class="pct">${fmtPct(f.partA)} de la clase</span>`:''}
        ${f.cA?`<br><span class="pct">de ${fmtUsd(f.cA)} suscriptos</span>`:''}</td>
      <td class="der num">${f.b?fmtUsd(f.b):'—'}
        ${f.b?`<br><span class="pct">${fmtPct(f.partB)} de la clase</span>`:''}
        ${f.cB?`<br><span class="pct">de ${fmtUsd(f.cB)} suscriptos</span>`:''}</td>
      <td class="der num" style="font-weight:600">${fmtUsd(f.integrado)}
        ${difCoef?`<br><span class="pct">${fmtUsd(f.u)} en unidades</span>`:''}</td>
      <td class="der num ocultar-chico">${f.comp?fmtUsd(f.comp):'—'}</td>
      <td class="der">${f.comp ? (f.pendiente>0
        ? `<span class="chip a num">${fmtUsd(f.pendiente)}</span>`
        : `<span class="chip v">Integrado</span>`) : '—'}</td>
      <td class="der num" style="font-weight:600">${fmtPct(f.part)}</td></tr>`).join('')}
    <tr><td><strong>Total</strong></td>
      <td class="der num"><strong>${fmtUsd(totA)}</strong></td>
      <td class="der num"><strong>${fmtUsd(totB)}</strong></td>
      <td class="der num"><strong>${fmtUsd(total)}</strong></td>
      <td class="der num ocultar-chico">${fmtUsd(filas.reduce((s,f)=>s+f.comp,0))}</td><td></td>
      <td class="der num"><strong>${total?'100,0%':'—'}</strong></td></tr>
    </tbody></table>
    <p class="sub" style="margin-top:12px">La ficha del inversor es una sola para todo el estudio,
    pero el capital suscripto y la participación son de esta obra.</p>
    ${calculadorAportes(o, filas, totU)}`
    : `<div class="vacio">Todavía no hay inversores en esta obra.
       Sumá el primero con el botón de arriba.</div>`}`;
}

/* ---------- Calculador de aportes a requerir ---------- */
function setCalc(campo, v){
  if(campo === 'monto'){
    const n = parseFloat(String(v).replace(/\./g,'').replace(',','.'));
    // El monto se guarda siempre en dólares, se ingrese en la moneda que se ingrese
    calcMonto = isNaN(n) ? null : (calcMoneda === 'ARS' ? n / (cotizacion||1) : n);
  }
  else if(campo === 'moneda') calcMoneda = v;
  else if(campo === 'base')   calcBase = v;
  else calcMetodo = v;
  render();
}

function calculadorAportes(o, filas, totU){
  const t = totalesObra(o.id);
  const faltante = Math.max(t.deuda - t.saldo, 0);
  const monto = calcMonto == null ? t.deuda : calcMonto;

  // Base de prorrateo: capital suscripto (lo contractual) o participación actual
  const hayComp = filas.some(f => f.comp > 0);
  const base = calcBase==='suscripto' && hayComp ? 'suscripto' : 'participacion';
  const degenerado = base==='participacion' && calcMetodo==='nivelar';
  const baseDe = f => base==='suscripto' ? f.comp : f.u;
  const sumaBase = filas.reduce((s,f)=>s+baseDe(f), 0);
  const yaAportado = filas.reduce((s,f)=>s+f.integrado, 0);
  const objetivo = yaAportado + monto;

  const calc = filas.map(f => {
    const pct = sumaBase ? baseDe(f)/sumaBase : 0;
    const corresponde = calcMetodo==='nivelar' ? pct*objetivo : f.integrado + pct*monto;
    const dif = corresponde - f.integrado;
    return { f, pct:pct*100, corresponde, requerir: Math.max(dif,0), excedente: Math.max(-dif,0) };
  });
  const totalReq = calc.reduce((s,c)=>s+c.requerir,0);
  const totalExc = calc.reduce((s,c)=>s+c.excedente,0);

  const sel = (id,campo,ops,actual) => `<select id="${id}" onchange="setCalc('${campo}',this.value)"
    style="font:inherit;font-size:13.5px;padding:6px 9px;border:1px solid var(--linea-fuerte);border-radius:3px">
    ${ops.map(([v,n])=>`<option value="${v}" ${v===actual?'selected':''}>${n}</option>`).join('')}</select>`;

  return `
  <h3>Cuánto pedirle a cada inversor</h3>
  <p class="sub">Calcula el aporte a requerir según la proporción de cada uno, descontando lo que ya integró.</p>

  <div class="acciones">
    <label for="calc-monto" style="font-size:12.5px;color:var(--gris)">Monto a cubrir</label>
    <input id="calc-monto" type="number" min="0" step="1000"
      value="${Math.round(calcMoneda === 'ARS' ? monto*cotizacion : monto)||''}"
      onchange="setCalc('monto',this.value)"
      style="width:150px;text-align:right;font:inherit;font-size:13.5px;padding:6px 9px;
      border:1px solid var(--linea-fuerte);border-radius:3px">
    <select onchange="setCalc('moneda',this.value)"
      style="font:inherit;font-size:13.5px;padding:6px 9px;border:1px solid var(--linea-fuerte);border-radius:3px">
      <option value="USD" ${calcMoneda==='USD'?'selected':''}>Dólares</option>
      <option value="ARS" ${calcMoneda==='ARS'?'selected':''}>Pesos</option>
    </select>
    <span class="pct">${calcMoneda === 'ARS'
      ? `= ${fmtUsd(monto)} a ${cotizacion.toLocaleString('es-AR',{maximumFractionDigits:2})}`
      : `= ${fmtArs(monto*cotizacion)} a ${cotizacion.toLocaleString('es-AR',{maximumFractionDigits:2})}`}</span>
    <button class="btn sec" onclick="setCalc('moneda','USD');setCalc('monto',${Math.round(t.deuda)})">Deuda ${fmtUsd(t.deuda)}</button>
    <button class="btn sec" onclick="setCalc('moneda','USD');setCalc('monto',${Math.round(faltante)})">Faltante ${fmtUsd(faltante)}</button>
    ${sel('calc-base','base',[['participacion','Prorratear por participación actual'],
      ['suscripto','Prorratear por capital suscripto']], base)}
    ${sel('calc-metodo','metodo',[['nivelar','Nivelar posiciones'],
      ['proporcional','Proporcional al nuevo aporte']], calcMetodo)}
  </div>

  ${!sumaBase ? `<div class="vacio">Para calcular hace falta capital suscripto o aportes cargados.</div>`
  : `<p class="sub">Se pide ${fmtUsd(monto)}, equivalentes a ${fmtArs(monto*cotizacion)}
    a la cotización de ${cotizacion.toLocaleString('es-AR',{maximumFractionDigits:2})} del panel.
    Los importes por inversor van en las dos monedas.</p>
    <table><thead><tr><th>Inversor</th><th class="der">Proporción</th>
      <th class="der">Ya integró</th><th class="der ocultar-chico">% del capital</th>
      <th class="der">Le corresponde</th>
      <th class="der">A requerir USD</th><th class="der">A requerir $</th>
      <th class="der">Excedente</th></tr></thead><tbody>
    ${calc.map(c=>`<tr>
      <td><strong>${esc(c.f.i.nombre)}</strong></td>
      <td class="der num">${fmtPct(c.pct)}</td>
      <td class="der num">${fmtUsd(c.f.integrado)}</td>
      <td class="der num ocultar-chico">${yaAportado?fmtPct(c.f.integrado/yaAportado*100):'—'}</td>
      <td class="der num">${fmtUsd(c.corresponde)}</td>
      <td class="der num" style="font-weight:600">${c.requerir>0.5?fmtUsd(c.requerir):'—'}</td>
      <td class="der num">${c.requerir>0.5?fmtArs(c.requerir*cotizacion):'—'}</td>
      <td class="der">${c.excedente>0.5?`<span class="chip v num">${fmtUsd(c.excedente)}</span>`:'—'}</td>
      </tr>`).join('')}
    <tr><td><strong>Total</strong></td><td class="der num">100,0%</td>
      <td class="der num">${fmtUsd(yaAportado)}</td>
      <td class="der num ocultar-chico">${yaAportado?'100,0%':'—'}</td>
      <td class="der num">${fmtUsd(calc.reduce((s,c)=>s+c.corresponde,0))}</td>
      <td class="der num"><strong>${fmtUsd(totalReq)}</strong></td>
      <td class="der num"><strong>${fmtArs(totalReq*cotizacion)}</strong></td>
      <td class="der num">${totalExc>0.5?fmtUsd(totalExc):'—'}</td></tr>
    </tbody></table>

    <p class="sub" style="margin-top:12px">
    ${base==='suscripto'
      ? 'Prorrateo según el capital suscripto de cada uno, que es lo que fija el contrato.'
      : 'Prorrateo según la participación actual, calculada sobre las unidades ya integradas.'}
    ${calcMetodo==='nivelar'
      ? ' Método nivelar: se calcula la posición que le corresponde sobre el total y se le pide la diferencia. El que venía adelantado aporta menos o nada.'
      : ' Método proporcional: cada uno aporta su porcentaje del nuevo requerimiento, sin corregir desfasajes anteriores.'}
    </p>
    ${totalExc>0.5 && calcMetodo==='nivelar' ? `<p class="sub">
      El total a requerir (${fmtUsd(totalReq)}) supera el monto a cubrir porque hay
      ${fmtUsd(totalExc)} aportados de más. Si no querés devolver ese excedente,
      pedí solo hasta completar el monto y el desfasaje se corrige en el próximo llamado.</p>` : ''}
    ${degenerado ? `<p class="sub">
      Con la participación actual como base, nivelar y proporcional dan el mismo resultado:
      la proporción se calcula sobre lo ya integrado, así que nadie figura adelantado.
      Para que el sistema compense a quien puso de más, cargá el capital suscripto de cada
      inversor y elegí ese prorrateo.</p>` : ''}
    ${filas.some(f=>f.pendiente>0) ? `<p class="sub">
      Hay inversores con capital suscripto pendiente de integrar. Revisá la columna Pendiente
      de la tabla de arriba antes de mandar el pedido.</p>` : ''}`}`;
}

/* ---------- Avance con fotos y gráficos ---------- */
function vAvance(o){
  const av = avancesDe(o.id).slice().sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const gs = gastosDe(o.id).slice().sort((a,b)=>a.fecha.localeCompare(b.fecha));
  const pres = totalesObra(o.id).pres;

  // Serie mensual: financiero acumulado vs avance físico declarado
  const meses = [...new Set([...gs.map(g=>mesDe(g.fecha)), ...av.map(a=>mesDe(a.fecha))])].sort();
  let acum = 0;
  const serie = meses.map(m => {
    acum += gs.filter(g=>mesDe(g.fecha)===m).reduce((s,g)=>s+ +g.usd,0);
    const fis = av.filter(a=>mesDe(a.fecha)===m && a.pct_avance!=null)
                  .map(a=>+a.pct_avance).sort((x,y)=>y-x)[0];
    return { mes:m, fin: pres ? acum/pres*100 : null, fis };
  });
  let ultFis = null;
  serie.forEach(p => { if(p.fis!=null) ultFis = p.fis; else p.fis = ultFis; });

  return `
  ${puedeEditar()?`<div class="acciones">
    <button class="btn" onclick="formAvance()">Cargar foto de avance</button></div>`:''}
  ${serie.length>1 ? `<h3>Avance físico contra avance financiero</h3>
    <div class="grafico">${grafico(serie)}</div>
    <p class="sub" style="margin-top:10px">Si la línea financiera va muy por encima de la física,
    se está gastando más rápido de lo que se construye.</p>` : ''}

  <h3>Registro fotográfico</h3>
  ${av.length ? `<div class="galeria">
    ${av.map(a=>`<div class="foto">
      <img loading="lazy" alt="${esc(a.titulo||'Avance de obra')}"
        src="" data-ruta="${esc(a.archivo||'')}" onerror="this.style.opacity=.3">
      <div class="pie-foto">
        <strong>${esc(a.titulo||'Sin título')}</strong>
        <p class="pct">${fecha(a.fecha)}${a.pct_avance!=null?` · ${fmtPct(a.pct_avance)} de avance`:''}</p>
        ${a.descripcion?`<p class="pct">${esc(a.descripcion)}</p>`:''}
        ${esAdmin()?`<button class="link" onclick="borrar('avances','${a.id}')">Eliminar</button>`:''}
      </div></div>`).join('')}
    </div>` : `<div class="vacio">Sin fotos cargadas todavía.</div>`}`;
}

function grafico(serie){
  const W = 700, H = 260, mx = 44, my = 24;
  const x = i => mx + i*(W-mx-14)/Math.max(serie.length-1,1);
  const y = v => H-my - (v/100)*(H-my*2);
  const linea = (campo,color,guion) => {
    const pts = serie.map((p,i)=>p[campo]==null?null:`${x(i)},${y(Math.min(p[campo],100))}`).filter(Boolean);
    return pts.length>1 ? `<polyline fill="none" stroke="${color}" stroke-width="2"
      ${guion?'stroke-dasharray="5 4"':''} points="${pts.join(' ')}"/>` : '';
  };
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Avance físico y financiero por mes">
    ${[0,25,50,75,100].map(v=>`<line x1="${mx}" y1="${y(v)}" x2="${W-14}" y2="${y(v)}"
      stroke="var(--linea)" stroke-width="1"/>
      <text x="${mx-8}" y="${y(v)+4}" text-anchor="end" font-size="10"
        fill="var(--gris)">${v}%</text>`).join('')}
    ${linea('fin','var(--azul)',false)}
    ${linea('fis','var(--verde)',true)}
    ${serie.map((p,i)=> i%Math.ceil(serie.length/6)===0
      ? `<text x="${x(i)}" y="${H-6}" text-anchor="middle" font-size="10"
          fill="var(--gris)">${p.mes.slice(5)}/${p.mes.slice(2,4)}</text>` : '').join('')}
    <g font-size="11">
      <line x1="${W-190}" y1="14" x2="${W-170}" y2="14" stroke="var(--azul)" stroke-width="2"/>
      <text x="${W-165}" y="18" fill="var(--gris)">financiero</text>
      <line x1="${W-95}" y1="14" x2="${W-75}" y2="14" stroke="var(--verde)" stroke-width="2" stroke-dasharray="5 4"/>
      <text x="${W-70}" y="18" fill="var(--gris)">físico</text>
    </g></svg>`;
}

/* ---------- Historial de cambios ---------- */
const CAMPOS_OCULTOS = ['id','obra_id','creado_por','creado_en','usd'];
const NOMBRE_CAMPO = { caja_id:'caja', rubro_id:'rubro', inversor_id:'inversor',
  fecha_pago:'fecha de pago', afecta_caja:'tratamiento', comp_a:'suscripto A',
  comp_b:'suscripto B', pct_conduccion:'% conducción', pct_administracion:'% administración',
  percepciones:'percepciones', numero:'número' };

function valorLegible(campo, v){
  if(v === null || v === '' || v === undefined) return '—';
  if(campo === 'caja_id')     return caja(v)?.nombre || v.slice(0,8);
  if(campo === 'rubro_id')    return rubro(v)?.nombre || v.slice(0,8);
  if(campo === 'inversor_id') return inv(v)?.nombre || v.slice(0,8);
  if(campo === 'afecta_caja') return v ? 'costo de obra' : 'solo informativo';
  if(typeof v === 'boolean')  return v ? 'sí' : 'no';
  return String(v);
}

function diferencias(a, d){
  if(!a) return [];
  if(!d) return [];
  return Object.keys(d)
    .filter(k => !CAMPOS_OCULTOS.includes(k) && String(a[k]) !== String(d[k]))
    .map(k => ({ campo: NOMBRE_CAMPO[k] || k.replace(/_/g,' '),
                 antes: valorLegible(k, a[k]), despues: valorLegible(k, d[k]) }));
}

async function cargarHistorial(obraId){
  const { data, error } = await sb.from('auditoria').select('*')
    .eq('obra_id', obraId).order('cuando', { ascending:false }).limit(200);
  if(error){ aviso('No se pudo leer el historial: ' + error.message, true); historial = []; }
  else historial = data;
  historialObra = obraId;
  render();
}

function vHistorial(o){
  if(historial === null || historialObra !== o.id){
    cargarHistorial(o.id);
    return `<div class="vacio">Cargando historial…</div>`;
  }
  const TABLA = { comprobantes:'Comprobante', aportes:'Aporte', inversores:'Inversor',
                  obras:'Obra', documentos:'Documento' };
  const ACCION = { alta:['Alta','v'], cambio:['Modificación','a'], baja:['Baja','r'] };

  return `
  <div class="acciones">
    <button class="btn sec" onclick="cargarHistorial('${o.id}')">Actualizar</button>
  </div>
  <p class="sub">Cada alta, cambio y baja de esta obra, con quién la hizo. El historial no se
  puede editar ni borrar, ni siquiera por un administrador. Se muestran los últimos 200 movimientos.</p>

  ${historial.length ? `<table><thead><tr><th>Cuándo</th><th>Quién</th><th>Qué</th>
    <th>Detalle</th></tr></thead><tbody>
    ${historial.map(h=>{
      const d = h.despues || h.antes || {};
      const ref = d.proveedor || d.titulo || d.nombre ||
        (h.tabla==='aportes' ? (inv(d.inversor_id)?.nombre || 'aporte') : '');
      const monto = d.importe ? (d.moneda==='USD'?fmtUsd2(d.importe):fmtArs(d.importe)) : '';
      const difs = h.accion==='cambio' ? diferencias(h.antes, h.despues) : [];
      const [etiqueta, color] = ACCION[h.accion];
      return `<tr>
        <td class="num">${new Date(h.cuando).toLocaleDateString('es-AR')}
          <br><span class="pct num">${new Date(h.cuando).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}</span></td>
        <td>${esc(h.usuario||'—')}</td>
        <td><span class="chip ${color}">${etiqueta}</span>
          <br><span class="pct">${TABLA[h.tabla]||h.tabla}</span></td>
        <td>${esc(ref)}${monto?` · <span class="num">${monto}</span>`:''}
          ${difs.length ? `<br>${difs.slice(0,6).map(x=>
            `<span class="pct">${esc(x.campo)}: ${esc(x.antes)} → <strong>${esc(x.despues)}</strong></span>`
            ).join('<br>')}` : ''}
          ${h.accion==='cambio' && !difs.length ? '<br><span class="pct">sin cambios de fondo</span>' : ''}
        </td></tr>`;
    }).join('')}
    </tbody></table>` : `<div class="vacio">Todavía no hay movimientos registrados en esta obra.</div>`}`;
}

/* ---------- Cierre de período ---------- */
function bloqueCierre(o){
  const hasta = cierreDe(o.id);
  const cs = D.cierres.filter(c=>c.obra_id===o.id).sort((a,b)=>b.hasta.localeCompare(a.hasta));
  return `
  <h3 class="no-imprimir">Cierre de período</h3>
  <p class="sub no-imprimir">Una vez rendido un mes, sus movimientos quedan bloqueados:
  no se editan, no se borran y no se pueden agregar nuevos con fecha anterior.
  ${hasta ? `<strong>Cerrado hasta el ${fecha(hasta)}.</strong>` : 'Todavía no hay ningún cierre.'}</p>
  ${esAdmin() ? `<div class="acciones no-imprimir">
    <button class="btn sec" onclick="formCierre()">Cerrar un período</button>
    ${cs.length?`<button class="btn sec" onclick="reabrirCierre('${cs[0].id}','${cs[0].hasta}')">Reabrir el último</button>`:''}
  </div>` : ''}
  ${cs.length ? `<table class="no-imprimir"><thead><tr><th>Cerrado hasta</th><th>Nota</th>
    <th>Cuándo</th></tr></thead><tbody>
    ${cs.map(c=>`<tr><td class="num"><strong>${fecha(c.hasta)}</strong></td>
      <td>${esc(c.nota||'—')}</td>
      <td class="num">${new Date(c.cerrado_en).toLocaleDateString('es-AR')}</td></tr>`).join('')}
    </tbody></table>` : ''}`;
}

function formCierre(){
  const o = obra();
  modal('Cerrar período', `
    <div class="campo ancho"><label for="ci-hasta">Cerrar hasta la fecha</label>
      <input id="ci-hasta" type="date" value="${hoy()}">
      <span class="ayuda">Todos los movimientos con fecha igual o anterior quedan bloqueados.</span></div>
    <div class="campo ancho"><label for="ci-nota">Nota</label>
      <input id="ci-nota" placeholder="Rendición de septiembre entregada a los inversores"></div>`,
    async ()=>{
      const hasta = val('ci-hasta');
      if(!hasta) return err('Elegí la fecha.');
      const nota = val('ci-nota');
      cerrar();
      const { error } = await sb.from('cierres').insert({ obra_id:o.id, hasta, nota, cerrado_por:perfil.id });
      if(error) return aviso('No se pudo cerrar: ' + error.message, true);
      aviso('Período cerrado');
      await cargarDatos();
    });
}

async function reabrirCierre(id, hasta){
  if(!confirm(`Reabrir el período cerrado hasta ${fecha(hasta)}? Los movimientos vuelven a ser editables. La reapertura queda registrada.`)) return;
  const { data, error } = await sb.from('cierres').delete().eq('id', id).select('id');
  if(error) return aviso('No se pudo reabrir: ' + error.message, true);
  if(!data?.length) return aviso(SIN_EFECTO, true);
  aviso('Período reabierto');
  await cargarDatos();
}

/* ---------- Enlaces de rendición para el inversor ---------- */
function bloqueEnlaces(o){
  if(!puedeEditar()) return '';
  const es = enlacesDe(o.id);
  const activos = es.filter(e => e.activo &&
    (!e.vence || e.vence >= hoy()));

  return `
  <div class="no-imprimir">
    <h3>Enlaces para inversores</h3>
    <p class="sub">Le mandás el enlace y ve su rendición sin usuario ni contraseña.
    Es de solo lectura, se actualiza solo y lo podés dar de baja cuando quieras.</p>
    <div class="acciones">
      <button class="btn sec" onclick="formEnlace()">Generar enlace</button>
    </div>
    ${es.length ? `<table><thead><tr><th>Inversor</th><th>Estado</th>
      <th class="ocultar-chico">Visitas</th><th class="ocultar-chico">Vence</th>
      <th></th></tr></thead><tbody>
      ${es.slice().sort((a,b)=>b.creado_en.localeCompare(a.creado_en)).map(e=>{
        const vencido = e.vence && e.vence < hoy();
        return `<tr>
          <td><strong>${esc(inv(e.inversor_id)?.nombre||'—')}</strong>
            ${e.titulo?`<br><span class="pct">${esc(e.titulo)}</span>`:''}</td>
          <td>${!e.activo ? '<span class="chip r">Dado de baja</span>'
               : vencido ? '<span class="chip a">Vencido</span>'
               : '<span class="chip v">Activo</span>'}</td>
          <td class="der num ocultar-chico">${e.visitas||0}
            ${e.ultima_visita?`<br><span class="pct">${new Date(e.ultima_visita).toLocaleDateString('es-AR')}</span>`:''}</td>
          <td class="num ocultar-chico">${e.vence?fecha(e.vence):'sin vencimiento'}</td>
          <td class="der">
            ${e.activo && !vencido ? `<button class="link" data-token="${esc(e.token)}" onclick="copiarEnlace(this.dataset.token)">Copiar enlace</button>` : ''}
            ${e.activo ? `<br><button class="link" onclick="bajaEnlace('${e.id}')">Dar de baja</button>` : ''}
          </td></tr>`;
      }).join('')}
    </tbody></table>
    ${activos.length ? '' : '<p class="sub">Ningún enlace activo en este momento.</p>'}`
    : ''}
  </div>`;
}

function formEnlace(){
  const o = obra();
  const invObra = partsDe(o.id).map(p=>inv(p.inversor_id)).filter(Boolean)
    .sort((a,b)=>a.nombre.localeCompare(b.nombre));
  if(!invObra.length) return alert('Primero sumá inversores a esta obra.');
  const enTres = sumarMeses(hoy(), 3);

  modal('Generar enlace de rendición', `
    <div class="campo ancho"><label for="en-inv">Inversor</label>
      <select id="en-inv">${invObra.map(i=>`<option value="${i.id}">${esc(i.nombre)}</option>`).join('')}</select></div>
    <div class="campo"><label for="en-vence">Vence el</label>
      <input id="en-vence" type="date" value="${enTres}"></div>
    <div class="campo"><label for="en-titulo">Referencia</label>
      <input id="en-titulo" placeholder="Opcional"></div>
    <div class="campo ancho"><span class="ayuda">Dejá la fecha vacía si querés que no venza.
      Igual lo podés dar de baja cuando quieras: el enlace deja de funcionar al instante.</span></div>`,
    async ()=>{
      const inversor_id = val('en-inv');
      const vence = val('en-vence') || null;
      const titulo = val('en-titulo');
      // Token largo y aleatorio: no se adivina ni se enumera
      const bytes = new Uint8Array(24);
      crypto.getRandomValues(bytes);
      const token = [...bytes].map(b=>b.toString(36).padStart(2,'0')).join('');
      cerrar();
      const { error } = await sb.from('enlaces').insert({
        token, obra_id:o.id, inversor_id, vence, titulo, creado_por: perfil.id });
      if(error) return aviso('No se pudo generar: ' + error.message, true);
      await cargarDatos();
      copiarEnlace(token, 'Enlace generado y copiado');
    });
}

async function copiarEnlace(token, mensaje){
  const url = urlRendicion(token);
  try{
    await navigator.clipboard.writeText(url);
    aviso(mensaje || 'Enlace copiado');
  }catch(e){
    modal('Enlace de rendición', `
      <div class="campo ancho"><label>Copialo y mandáselo al inversor</label>
        <input value="${esc(url)}" onclick="this.select()" readonly></div>`,
      ()=>cerrar());
  }
}

async function bajaEnlace(id){
  if(!confirm('Dar de baja este enlace? Deja de funcionar de inmediato.')) return;
  await guardar('enlaces', { activo:false }, id);
}

/* ---------- Ventas de unidades ---------- */
const TIPOS_VENTA = ['Factura A','Factura B','Factura C','Boleto','Recibo','Nota de crédito'];

function vVentas(o){
  const vs = ventasDe(o.id).slice().sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const tot = vs.reduce((s,v)=>s+ +v.usd,0);
  const cobrado = vs.filter(v=>v.cobro==='cobrado').reduce((s,v)=>s+ +v.usd,0);
  const unidades = [...new Set(vs.map(v=>v.unidad).filter(Boolean))];

  return `
  ${puedeEditar()?`<div class="acciones">
    <button class="btn" onclick="formVenta()">Registrar venta</button>
    <button class="btn sec" onclick="exportarVentas()">Exportar a Excel</button></div>`:''}
  <p class="sub">Las facturas de venta se emiten desde el sistema de facturación del estudio.
  Acá se registran para tener la unidad vinculada al comprador y las ventas en el reporte contable.</p>

  ${vs.length ? `<div class="fila">
    <div class="kpi"><p class="r">Vendido</p><p class="v num">${fmtUsd(tot)}</p>
      <p class="s">${vs.length} comprobante${vs.length===1?'':'s'}</p></div>
    <div class="kpi"><p class="r">Cobrado</p><p class="v num">${fmtUsd(cobrado)}</p></div>
    <div class="kpi ${tot-cobrado>0?'alerta':''}"><p class="r">Por cobrar</p>
      <p class="v num">${fmtUsd(tot-cobrado)}</p></div>
    <div class="kpi"><p class="r">Unidades vendidas</p><p class="v num">${unidades.length||'—'}</p>
      <p class="s">${unidades.slice(0,4).map(esc).join(', ')||''}</p></div>
  </div>

  <table><thead><tr><th>Fecha</th><th>Comprador</th><th class="ocultar-chico">Comprobante</th>
    <th>Unidad</th><th>Financiación</th><th class="der">Total</th><th class="der">USD</th><th></th>
    </tr></thead><tbody>
    ${vs.map(v=>{
      const r = resumenVenta(v);
      const abierta = ventaAbierta === v.id;
      return `<tr>
      <td class="num">${fecha(v.fecha)}</td>
      <td><button class="link" style="font-size:13.5px;font-weight:600"
            onclick="abrirVenta('${v.id}')">${esc(v.cliente)}</button>
        ${v.cuit?`<br><span class="pct num">${esc(v.cuit)}</span>`:''}
        ${v.inversor_id?`<br><span class="chip">${esc(inv(v.inversor_id)?.nombre||'')}</span>`:''}
        ${v.archivo?`<br><button class="link" data-ruta="${esc(v.archivo)}" onclick="verArchivo(this.dataset.ruta)">Ver comprobante</button>`:''}</td>
      <td class="ocultar-chico"><span class="chip">${esc(v.tipo)}</span>
        ${v.numero?`<br><span class="pct num">${esc(v.numero)}</span>`:''}
        ${v.cae?`<br><span class="pct num">CAE ${esc(v.cae)}</span>`:''}</td>
      <td>${v.unidad?`<span class="chip">${esc(v.unidad)}</span>`:'—'}
        ${v.concepto?`<br><span class="pct">${esc(v.concepto)}</span>`:''}</td>
      <td>${v.modalidad === 'contado'
        ? (v.cobro==='cobrado'
            ? `<span class="chip v">Cobrado</span>${v.fecha_cobro?`<br><span class="pct num">${fecha(v.fecha_cobro)}</span>`:''}`
            : '<span class="chip a">Pendiente</span>')
        : `<span class="chip ${v.modalidad==='cuotas_cac'?'a':''}">${
             v.modalidad==='cuotas_cac'?'Cuotas CAC':'Cuotas USD'}</span>
           <br><span class="pct">${r.cobradas.length} de ${r.cs.length} cobradas</span>
           ${r.vencidas.length?`<br><span class="chip r">${r.vencidas.length} vencida${r.vencidas.length===1?'':'s'}</span>`:''}
           <br><button class="link" onclick="abrirVenta('${v.id}')">${abierta?'Ocultar':'Ver'} cuotas</button>`}</td>
      <td class="der num">${v.moneda==='USD'?fmtUsd2(v.importe):fmtArs(v.importe)}
        ${+v.iva?`<br><span class="pct">IVA ${v.moneda==='USD'?fmtUsd2(v.iva):fmtArs(v.iva)}</span>`:''}</td>
      <td class="der num" style="font-weight:600">${fmtUsd2(v.usd)}</td>
      <td class="der">${puedeEditar()?`<button class="link" onclick="formVenta('${v.id}')">Editar</button>`:''}
        ${puedeEditar() && v.modalidad!=='contado' && !r.cs.length
          ? `<br><button class="link" onclick="formPlan('${v.id}')">Generar plan</button>`:''}
        ${esAdmin()?`<br><button class="link" onclick="borrar('ventas','${v.id}')">Eliminar</button>`:''}</td>
      </tr>
      ${abierta ? `<tr><td colspan="8" style="background:#FAFAF7">${planCuotas(v)}</td></tr>` : ''}`;
    }).join('')}
    <tr><td colspan="6"><strong>Total</strong></td>
      <td class="der num"><strong>${fmtUsd2(tot)}</strong></td><td></td></tr>
    </tbody></table>`
    : `<div class="vacio">Todavía no hay ventas registradas en esta obra.</div>`}`;
}

function planCuotas(v){
  const r = resumenVenta(v);
  const u = cacUltimo();
  const mon = c => v.modalidad === 'cuotas_usd' ? fmtUsd2(c) : fmtArs(c);

  if(!r.cs.length) return `<div class="vacio" style="text-align:left">
    Esta venta es financiada pero todavía no tiene plan de cuotas.
    ${puedeEditar()?`<br><br><button class="btn sec" onclick="formPlan('${v.id}')">Generar el plan</button>`:''}
  </div>`;

  return `
  <div class="fila" style="margin:10px 0 14px">
    <div class="kpi"><p class="r">Cobrado</p><p class="v num">${mon(r.cobrado)}</p>
      <p class="s">${r.cobradas.length} de ${r.cs.length} cuotas</p></div>
    <div class="kpi"><p class="r">Por cobrar</p><p class="v num">${mon(r.porCobrar)}</p>
      <p class="s">${v.modalidad==='cuotas_cac'?'ajustado al último índice':'en dólares'}</p></div>
    ${r.vencidas.length?`<div class="kpi alerta"><p class="r">Vencido</p>
      <p class="v num">${mon(r.vencido)}</p>
      <p class="s">${r.vencidas.length} cuota${r.vencidas.length===1?'':'s'}</p></div>`:''}
    ${v.modalidad==='cuotas_cac'?`<div class="kpi"><p class="r">Coeficiente</p>
      <p class="v num">${u && +v.indice_base ? (u.nivel/+v.indice_base).toLocaleString('es-AR',{minimumFractionDigits:3,maximumFractionDigits:3}) : '—'}</p>
      <p class="s">base ${v.periodo_base||'—'} contra ${u?u.periodo:'sin índice'}</p></div>`:''}
  </div>

  <table><thead><tr><th>Cuota</th><th>Vence</th><th class="der">Monto base</th>
    ${v.modalidad==='cuotas_cac'?'<th class="der">Ajustado</th>':''}
    <th>Estado</th><th class="ocultar-chico">Cobro</th><th></th></tr></thead><tbody>
    ${r.cs.map(c=>{
      const venc = c.estado==='pendiente' && c.vencimiento < hoy();
      return `<tr>
      <td class="num">${c.numero}/${r.cs.length}</td>
      <td class="num" style="${venc?'color:var(--rojo);font-weight:600':''}">${fecha(c.vencimiento)}</td>
      <td class="der num">${mon(+c.monto_base)}</td>
      ${v.modalidad==='cuotas_cac'
        ? `<td class="der num" style="font-weight:600">${c.estado==='cobrada'?'—':fmtArs(montoCuota(v,c))}</td>`:''}
      <td>${c.estado==='cobrada' ? '<span class="chip v">Cobrada</span>'
           : venc ? '<span class="chip r">Vencida</span>' : '<span class="chip a">Pendiente</span>'}</td>
      <td class="ocultar-chico">${c.estado==='cobrada'
        ? `${fecha(c.fecha_cobro)}<br><span class="pct">${mon(+c.monto_cobrado)}
            ${c.indice_cobro?` · índice ${(+c.indice_cobro).toLocaleString('es-AR',{maximumFractionDigits:2})}`:''}
            ${c.caja_id?`<br>${esc(caja(c.caja_id)?.nombre||'')}`:''}</span>`
        : '<span class="pct">—</span>'}</td>
      <td class="der">${puedeEditar()
        ? (c.estado==='cobrada'
            ? `<button class="link" onclick="revertirCuota('${c.id}')">Revertir</button>`
            : `<button class="link" onclick="cobrarCuota('${c.id}')">Cobrar</button>`)
        : ''}</td></tr>`;
    }).join('')}
  </tbody></table>
  ${v.modalidad==='cuotas_cac' && !u
    ? `<p class="sub">No hay ningún índice CAC cargado, así que las cuotas se muestran sin ajustar.
       Cargalo en la solapa Índices.</p>` : ''}`;
}

function formPlan(ventaId){
  const v = D.ventas.find(x=>x.id===ventaId);
  ventaDelPlan = v;
  const u = cacUltimo();
  modal('Generar plan de cuotas', `
    <div class="campo ancho"><span class="ayuda">
      ${esc(v.cliente)} · ${esc(v.unidad||'sin unidad')} · total ${
        v.moneda==='USD'?fmtUsd2(v.importe):fmtArs(v.importe)}</span></div>
    <div class="campo"><label for="pl-anticipo">Anticipo</label>
      <input id="pl-anticipo" type="number" step="0.01" min="0" value="${+v.anticipo||''}"
        onchange="recalcPlan()"></div>
    <div class="campo"><label for="pl-cant">Cantidad de cuotas</label>
      <input id="pl-cant" type="number" step="1" min="1" max="240"
        value="${v.cuotas_cantidad||12}" onchange="recalcPlan()"></div>
    <div class="campo"><label for="pl-primera">Primer vencimiento</label>
      <input id="pl-primera" type="date" value="${hoy()}"></div>
    <div class="campo"><label>Valor de cada cuota</label>
      <p id="pl-valor" class="num" style="font-size:19px;font-weight:700;margin:5px 0 0">—</p></div>
    ${v.modalidad === 'cuotas_cac' ? `
    <div class="campo ancho"><label for="pl-periodo">Período base del CAC</label>
      <select id="pl-periodo">
        ${serieCac().filter(x=>x.nivel!=null).slice().reverse()
          .map(x=>`<option value="${x.periodo}" ${x.periodo===(v.periodo_base||u?.periodo)?'selected':''}>${
            nombreMes(x.periodo)} · ${x.nivel.toLocaleString('es-AR',{maximumFractionDigits:2})}</option>`).join('')}
      </select>
      <span class="ayuda">${u ? 'Las cuotas se ajustan por la variación desde este mes.'
        : 'No hay índices cargados: cargá al menos uno en la solapa Índices.'}</span></div>` : `
    <div class="campo ancho"><span class="ayuda">El saldo se divide en cuotas iguales en dólares,
      sin ajuste.</span></div>`}`,
    async ()=>{
      const cant = parseInt(val('pl-cant'))||0;
      const ant  = parseFloat(val('pl-anticipo'))||0;
      const primera = val('pl-primera');
      if(cant < 1) return err('Poné al menos una cuota.');
      if(!primera) return err('Elegí el primer vencimiento.');
      const saldoReal = +v.importe - ant;
      if(saldoReal <= 0) return err('El anticipo cubre el total: no hay nada que financiar.');

      const periodoBase = v.modalidad === 'cuotas_cac' ? val('pl-periodo') : null;
      if(v.modalidad === 'cuotas_cac' && !periodoBase)
        return err('Elegí el período base del índice.');

      const cuota = Math.round(saldoReal / cant * 100) / 100;
      const filas = [];
      for(let i = 1; i <= cant; i++){
        filas.push({ numero: i, vencimiento: sumarMeses(primera, i - 1),
          // la última absorbe el redondeo
          monto_base: i === cant ? Math.round((saldoReal - cuota*(cant-1))*100)/100 : cuota,
          moneda: v.modalidad === 'cuotas_usd' ? 'USD' : 'ARS' });
      }
      document.getElementById('ok').disabled = true;
      cerrar();

      // Venta y cuotas en una sola transacción: si algo falla, no queda
      // una venta con un plan a medias.
      const { error } = await sb.rpc('generar_plan_cuotas', {
        p_venta: v.id, p_anticipo: ant, p_cuotas: filas,
        p_periodo_base: periodoBase, p_indice_base: periodoBase ? cacDe(periodoBase) : null });
      if(error) return aviso('No se pudo generar el plan: ' + error.message, true);
      aviso(`${cant} cuotas generadas`);
      ventaAbierta = v.id;
      await cargarDatos();
    });
  recalcPlan();
}

let ventaDelPlan = null;

function recalcPlan(){
  const e = document.getElementById('pl-valor');
  if(!e || !ventaDelPlan) return;
  const ant  = parseFloat(val('pl-anticipo')) || 0;
  const cant = parseInt(val('pl-cant')) || 0;
  const saldo = +ventaDelPlan.importe - ant;
  e.textContent = (cant > 0 && saldo > 0)
    ? (ventaDelPlan.modalidad === 'cuotas_usd' ? fmtUsd2(saldo/cant) : fmtArs(saldo/cant))
    : '—';
}

function cobrarCuota(id){
  const c = D.cuotas.find(x=>x.id===id);
  const v = D.ventas.find(x=>x.id===c.venta_id);
  const o = obra();
  const u = cacUltimo();
  const sugerido = montoCuota(v, c);
  const enUsd = v.modalidad === 'cuotas_usd';
  modal(`Cobrar cuota ${c.numero}`, `
    <div class="campo ancho"><span class="ayuda">${esc(v.cliente)} · ${esc(v.unidad||'')}
      · vence ${fecha(c.vencimiento)} · base ${enUsd?fmtUsd2(c.monto_base):fmtArs(c.monto_base)}</span></div>
    <div class="campo"><label for="cu-fecha">Fecha de cobro</label>
      <input id="cu-fecha" type="date" value="${hoy()}"></div>
    <div class="campo"><label for="cu-monto">Importe cobrado ${enUsd?'USD':'$'}</label>
      <input id="cu-monto" type="number" step="0.01" min="0" value="${Math.round(sugerido*100)/100}"></div>
    <div class="campo ancho"><label for="cu-caja">Caja donde entró</label>
      <select id="cu-caja"><option value="">Sin asignar</option>
        ${cajasDe(o.id).map(x=>`<option value="${x.id}">${esc(x.nombre)}</option>`).join('')}
      </select></div>
    ${!enUsd?`<div class="campo"><label for="cu-cotiz">Cotización del día</label>
      <input id="cu-cotiz" type="number" step="0.01" min="0" value="${cotizacion}"></div>`:''}
    ${v.modalidad==='cuotas_cac'?`<div class="campo"><label for="cu-indice">Índice aplicado</label>
      <input id="cu-indice" type="number" step="0.0001" value="${u?u.nivel:''}">
      <span class="ayuda">${u?`Último publicado: ${nombreMes(u.periodo)}`:'Sin índices cargados'}</span></div>`:''}
    <div class="campo ancho"><label for="cu-nota">Nota</label>
      <input id="cu-nota" placeholder="Opcional"></div>`,
    async ()=>{
      const monto = parseFloat(val('cu-monto'));
      if(!monto || monto <= 0) return err('Poné el importe cobrado.');
      const datos = { estado:'cobrada', fecha_cobro:val('cu-fecha'), monto_cobrado:monto,
        caja_id: val('cu-caja') || null, nota: val('cu-nota'),
        cotizacion: enUsd ? 1 : (parseFloat(val('cu-cotiz'))||null),
        indice_cobro: v.modalidad==='cuotas_cac' ? (parseFloat(val('cu-indice'))||null) : null };
      cerrar();
      await guardar('cuotas', datos, id);
    });
}

async function revertirCuota(id){
  if(!confirm('Revertir el cobro de esta cuota? Vuelve a quedar pendiente.')) return;
  await guardar('cuotas', { estado:'pendiente', fecha_cobro:null, monto_cobrado:null,
    caja_id:null, indice_cobro:null, cotizacion:null }, id);
}

function formVenta(id){
  const o = obra(), cs = cajasDe(o.id);
  const v = id ? D.ventas.find(x=>x.id===id) : {};
  const invObra = partsDe(o.id).map(p=>inv(p.inversor_id)).filter(Boolean);
  modal(id ? 'Editar venta' : 'Registrar venta', `
    ${id ? '' : `<div class="lector" id="lector">
      <label for="v-archivo">Copia del comprobante</label>
      <input id="v-archivo" type="file" accept="application/pdf,image/*">
      <span class="ayuda">Opcional. Queda junto al registro.</span></div>`}
    <div class="campo"><label for="v-fecha">Fecha</label>
      <input id="v-fecha" type="date" value="${v.fecha||hoy()}"></div>
    <div class="campo"><label for="v-tipo">Tipo</label>
      <select id="v-tipo">${TIPOS_VENTA.map(t=>`<option ${t===v.tipo?'selected':''}>${t}</option>`).join('')}</select></div>
    <div class="campo ancho"><label for="v-cliente">Comprador</label>
      <input id="v-cliente" value="${esc(v.cliente||'')}" list="clientes-conocidos"
        autocomplete="off" placeholder="Nombre o razón social">
      <datalist id="clientes-conocidos">${
        [...new Set(D.ventas.map(x=>(x.cliente||'').trim()).filter(Boolean))]
          .sort().map(n=>`<option value="${esc(n)}">`).join('')}</datalist></div>
    <div class="campo"><label for="v-cuit">CUIT</label>
      <input id="v-cuit" value="${esc(v.cuit||'')}" placeholder="20-12345678-9"></div>
    <div class="campo"><label for="v-inv">Es un inversor de la obra</label>
      <select id="v-inv"><option value="">No</option>
        ${invObra.map(i=>`<option value="${i.id}" ${i.id===v.inversor_id?'selected':''}>${esc(i.nombre)}</option>`).join('')}
      </select></div>
    <div class="campo"><label for="v-num">Número</label>
      <input id="v-num" value="${esc(v.numero||'')}" placeholder="0001-00000012"></div>
    <div class="campo"><label for="v-unidad">Unidad</label>
      ${unidadesDe(o.id).length
        ? `<select id="v-unidad-id" onchange="document.getElementById('v-unidad').value =
             this.options[this.selectedIndex].dataset.codigo || ''">
            <option value="">Sin unidad</option>
            ${unidadesDe(o.id).map(x=>`<option value="${x.id}" data-codigo="${esc(x.codigo)}"
              ${x.id===v.unidad_id?'selected':''}>${esc(x.codigo)} · ${esc(x.tipo)}</option>`).join('')}
          </select>
          <input id="v-unidad" type="hidden" value="${esc(v.unidad||'')}">`
        : `<input id="v-unidad" value="${esc(v.unidad||'')}" placeholder="3ºB">`}</div>
    <div class="campo"><label for="v-cae">CAE</label>
      <input id="v-cae" value="${esc(v.cae||'')}" placeholder="opcional"></div>
    <div class="campo"><label for="v-caev">Vencimiento del CAE</label>
      <input id="v-caev" type="date" value="${v.cae_vence||''}"></div>
    <div class="campo"><label for="v-mon">Moneda</label>
      <select id="v-mon" onchange="tglCotizVenta()">
        <option value="ARS" ${v.moneda!=='USD'?'selected':''}>Pesos</option>
        <option value="USD" ${v.moneda==='USD'?'selected':''}>Dólares</option></select></div>
    <div class="campo"><label for="v-imp">Total</label>
      <input id="v-imp" type="number" step="0.01" min="0" value="${v.importe||''}"></div>
    <div class="campo"><label for="v-neto">Neto</label>
      <input id="v-neto" type="number" step="0.01" min="0" value="${+v.neto||''}" placeholder="opcional"></div>
    <div class="campo"><label for="v-iva">IVA</label>
      <input id="v-iva" type="number" step="0.01" min="0" value="${+v.iva||''}" placeholder="opcional"></div>
    <div class="campo ancho" id="wrap-vcotiz"><label for="v-ct">Cotización del día</label>
      <input id="v-ct" type="number" step="0.01" min="0"
        value="${+v.cotizacion > 1 ? v.cotizacion : cotizacion}">
      <span class="ayuda">Referencia histórica de la operación.</span></div>
    <div class="campo ancho"><label for="v-modalidad">Forma de pago</label>
      <select id="v-modalidad" onchange="tglModalidad()">
        <option value="contado"    ${(v.modalidad||'contado')==='contado'?'selected':''}>Contado</option>
        <option value="cuotas_usd" ${v.modalidad==='cuotas_usd'?'selected':''}>Cuotas en dólares</option>
        <option value="cuotas_cac" ${v.modalidad==='cuotas_cac'?'selected':''}>Cuotas en pesos ajustadas por CAC</option>
      </select>
      <span class="ayuda" id="ayuda-modalidad"></span></div>
    <div class="campo" id="wrap-cobro"><label for="v-cobro">Cobro</label>
      <select id="v-cobro" onchange="tglCobro()">
        <option value="cobrado" ${v.cobro!=='pendiente'?'selected':''}>Cobrado</option>
        <option value="pendiente" ${v.cobro==='pendiente'?'selected':''}>Pendiente</option></select></div>
    <div class="campo" id="wrap-fcobro"><label for="v-fcobro">Fecha de cobro</label>
      <input id="v-fcobro" type="date" value="${v.fecha_cobro||hoy()}"></div>
    <div class="campo ancho"><label for="v-caja">Caja donde entró</label>
      <select id="v-caja"><option value="">Sin asignar</option>
        ${cs.map(c=>`<option value="${c.id}" ${c.id===v.caja_id?'selected':''}>${esc(c.nombre)}</option>`).join('')}
      </select>
      <span class="ayuda">Informativo: la venta no mueve el saldo de la caja.</span></div>
    <div class="campo ancho"><label for="v-concepto">Concepto</label>
      <input id="v-concepto" value="${esc(v.concepto||'')}" placeholder="Venta unidad 3ºB"></div>`,
    async ()=>{
      const imp = parseFloat(val('v-imp'));
      if(!val('v-cliente')) return err('Poné el comprador.');
      if(!imp || imp<=0) return err('El total tiene que ser mayor a cero.');
      const mon = val('v-mon'), ct = parseFloat(val('v-ct'));
      if(!ct || ct<=0) return err('Necesito la cotización del día.');
      const cobro = val('v-cobro');
      const modalidad = val('v-modalidad');
      const datos = { obra_id:o.id, modalidad, fecha:val('v-fecha'), tipo:val('v-tipo'),
        numero:val('v-num'), cae:val('v-cae'), cae_vence: val('v-caev')||null,
        cliente:val('v-cliente'), cuit:val('v-cuit'), inversor_id: val('v-inv')||null,
        unidad:val('v-unidad'), unidad_id: val('v-unidad-id') || null,
        concepto:val('v-concepto'), moneda:mon, importe:imp,
        neto:parseFloat(val('v-neto'))||0, iva:parseFloat(val('v-iva'))||0,
        cotizacion: ct,
        cobro: modalidad === 'contado' ? cobro : 'pendiente',
        fecha_cobro: modalidad === 'contado' && cobro==='cobrado' ? val('v-fcobro') : null,
        caja_id: val('v-caja')||null, creado_por: perfil.id };
      document.getElementById('ok').disabled = true;
      const f = id ? null : document.getElementById('v-archivo').files?.[0];
      if(f){ const ruta = await subirArchivo('documentos', f, o.id); if(ruta) datos.archivo = ruta; }
      cerrar();
      await guardar('ventas', datos, id);
    });
  tglCotizVenta(); tglCobro(); tglModalidad();
}

function tglModalidad(){
  const m = document.getElementById('v-modalidad');
  const w = document.getElementById('wrap-cobro');
  const f = document.getElementById('wrap-fcobro');
  const a = document.getElementById('ayuda-modalidad');
  if(!m) return;
  const contado = m.value === 'contado';
  if(w) w.style.display = contado ? '' : 'none';
  if(f) f.style.display = contado && document.getElementById('v-cobro').value === 'cobrado' ? '' : 'none';
  if(a) a.textContent = contado
    ? 'Un solo cobro.'
    : 'Al guardar vas a poder generar el plan de cuotas desde el listado.';
}
function tglCotizVenta(){ /* la cotización se pide siempre, como referencia histórica */ }
function tglCobro(){
  const c = document.getElementById('v-cobro'), w = document.getElementById('wrap-fcobro');
  if(c&&w) w.style.display = c.value==='cobrado' ? '' : 'none';
}
function exportarVentas(){
  const o = obra();
  const filas = [['Fecha','Tipo','Numero','CAE','Comprador','CUIT','Unidad','Concepto',
                  'Moneda','Neto','IVA','Total','Cotizacion','Total USD','Cobro','Fecha de cobro']];
  const num = v => Math.round((+v||0)*100)/100;
  ventasDe(o.id).slice().sort((a,b)=>a.fecha.localeCompare(b.fecha)).forEach(v =>
    filas.push([v.fecha,v.tipo,v.numero,v.cae,v.cliente,v.cuit,v.unidad,v.concepto,v.moneda,
      num(v.neto),num(v.iva),num(v.importe),num(v.cotizacion),num(v.usd),
      v.cobro,v.fecha_cobro||'']));
  bajarExcel([{ nombre:'Ventas', filas }], `ventas-${o.nombre.replace(/\s+/g,'-').toLowerCase()}`);
}

/* ---------- Legajo de documentos ---------- */
const CATEGORIAS_DOC = {
  'Legales':      ['Contrato de fideicomiso','Adhesión al fideicomiso','Boleto de compraventa',
                   'Escritura','Reglamento','Acta','Seguro','Poder','Otro'],
  'Arquitectura': ['Plano','Permiso municipal','Memoria descriptiva','Pliego',
                   'Cómputo','Certificado','Relevamiento','Otro'],
  'Presupuestos': ['Presupuesto','Cotización','Comparativa','Orden de compra','Contrato con proveedor','Otro'],
  'Otros':        ['Otro']
};
const TIPOS_DOC = [...new Set(Object.values(CATEGORIAS_DOC).flat())];

function vDocumentos(o){
  const docs = docsDe(o.id).slice()
    .sort((a,b)=> (b.fecha||'').localeCompare(a.fecha||'') || b.creado_en.localeCompare(a.creado_en));

  let filas = '';
  const cats = Object.keys(CATEGORIAS_DOC)
    .map(cat => ({ cat, ds: docs.filter(d => (d.categoria||'Legales') === cat) }))
    .filter(x => x.ds.length);

  cats.forEach(({cat,ds}) => {
    filas += `<tr class="grupo-rubro"><td colspan="5">${esc(cat)}
      <span style="font-weight:400"> · ${ds.length} documento${ds.length===1?'':'s'}</span></td></tr>`;
    ds.forEach(d => {
      filas += `<tr>
        <td><strong>${esc(d.titulo)}</strong>
          <br><span class="pct">${esc(d.tipo)}</span>
          ${d.descripcion?`<br><span class="pct">${esc(d.descripcion)}</span>`:''}
          ${d.referencia?`<br><span class="pct num">${esc(d.referencia)}</span>`:''}</td>
        <td class="num">${d.fecha?fecha(d.fecha):'—'}</td>
        <td>${d.inversor_id
          ? `<span class="chip a">${esc(inv(d.inversor_id)?.nombre||'reservado')}</span>`
          : '<span class="pct">todos</span>'}
          ${d.unidad?`<br><span class="chip">${esc(d.unidad)}</span>`:''}</td>
        <td class="der"><button class="link" data-ruta="${esc(d.archivo)}" onclick="verArchivo(this.dataset.ruta)">Abrir</button></td>
        <td class="der">${puedeEditar()?`<button class="link" onclick="formDocumento('${d.id}')">Editar</button>`:''}
          ${esAdmin()?`<br><button class="link" onclick="borrar('documentos','${d.id}')">Eliminar</button>`:''}</td>
      </tr>`;
    });
  });

  const reservados = docs.filter(d=>d.inversor_id).length;

  return `
  ${puedeEditar()?`<div class="acciones">
    <button class="btn" onclick="formDocumento()">Subir documento</button></div>`:''}
  <p class="sub">El legajo de la obra: contrato de fideicomiso, adhesiones, boletos, escrituras,
  planos y permisos. Todo en un solo lugar, disponible para quien lo necesite.</p>

  ${docs.length ? `<table><thead><tr><th>Documento</th><th>Fecha</th>
    <th>Visible para</th><th class="der">Archivo</th><th></th></tr></thead>
    <tbody>${filas}</tbody></table>
    ${reservados?`<p class="sub" style="margin-top:12px">${reservados}
      documento${reservados===1?'':'s'} asignado${reservados===1?'':'s'} a un inversor:
      solo lo ve el equipo y esa persona. El resto de los inversores no lo ve.</p>`:''}`
    : `<div class="vacio">Todavía no hay documentos cargados en esta obra.</div>`}`;
}

function formDocumento(id){
  const o = obra();
  const d = id ? D.documentos.find(x=>x.id===id) : null, v = d || {};
  modal(d ? 'Editar documento' : 'Subir documento', `
    ${d ? '' : `<div class="lector" id="lector">
      <label for="doc-archivo">Archivo</label>
      <input id="doc-archivo" type="file" accept="application/pdf,image/*">
      <span class="ayuda">PDF o imagen. Queda guardado en el sistema, no en una carpeta suelta.</span>
    </div>`}
    <div class="campo ancho"><label for="doc-titulo">Título</label>
      <input id="doc-titulo" value="${esc(v.titulo||'')}" placeholder="Contrato de fideicomiso San Lorenzo 2634"></div>
    <div class="campo"><label for="doc-cat">Categoría</label>
      <select id="doc-cat" onchange="tiposDeCategoria()">
        ${Object.keys(CATEGORIAS_DOC).map(k=>
          `<option ${k===(v.categoria||'Legales')?'selected':''}>${k}</option>`).join('')}</select></div>
    <div class="campo"><label for="doc-tipo">Tipo</label>
      <select id="doc-tipo"></select></div>
    <div class="campo"><label for="doc-fecha">Fecha del documento</label>
      <input id="doc-fecha" type="date" value="${v.fecha||''}"></div>
    <div class="campo ancho"><label for="doc-ref">Referencia</label>
      <input id="doc-ref" value="${esc(v.referencia||'')}" placeholder="Escribanía, tomo y folio, número de acta — opcional"></div>
    <div class="campo"><label for="doc-inv">Inversor</label>
      <select id="doc-inv"><option value="">Visible para todos</option>
        ${partsDe(o.id).map(p=>inv(p.inversor_id)).filter(Boolean)
          .map(i=>`<option value="${i.id}" ${i.id===v.inversor_id?'selected':''}>${esc(i.nombre)}</option>`).join('')}
      </select>
      <span class="ayuda">Si elegís uno, solo él y el equipo lo ven.</span></div>
    <div class="campo"><label for="doc-unidad">Unidad</label>
      <input id="doc-unidad" value="${esc(v.unidad||'')}" placeholder="3ºB — opcional"></div>
    <div class="campo ancho"><label for="doc-desc">Descripción</label>
      <input id="doc-desc" value="${esc(v.descripcion||'')}" placeholder="Opcional"></div>`,
    async ()=>{
      const titulo = val('doc-titulo');
      if(!titulo) return err('Poné un título.');
      const f = d ? null : document.getElementById('doc-archivo').files?.[0];
      if(!d && !f) return err('Elegí el archivo.');
      const datos = { obra_id:o.id, titulo, categoria:val('doc-cat'), tipo:val('doc-tipo'),
        fecha: val('doc-fecha') || null, referencia:val('doc-ref'),
        inversor_id: val('doc-inv') || null, unidad:val('doc-unidad'),
        descripcion:val('doc-desc'), creado_por: perfil.id };
      document.getElementById('ok').disabled = true;
      if(f){
        err('Subiendo el archivo…');
        const ruta = await subirArchivo('documentos', f, o.id);
        if(!ruta){ document.getElementById('ok').disabled = false; return err('No se pudo subir el archivo.'); }
        datos.archivo = ruta;
      }
      cerrar();
      await guardar('documentos', datos, d?.id);
    });
  tiposDeCategoria(v.tipo);
}

function tiposDeCategoria(elegido){
  const c = document.getElementById('doc-cat'), t = document.getElementById('doc-tipo');
  if(!c || !t) return;
  const lista = CATEGORIAS_DOC[c.value] || ['Otro'];
  t.innerHTML = lista.map(x=>`<option ${x===elegido?'selected':''}>${x}</option>`).join('');
}

/* ---------- Contador ---------- */
const TIPOS_FISCALES = ['Factura A','Factura C'];
const esImpuesto = g => (rubro(g.rubro_id)?.nombre||'').toLowerCase().includes('impuesto');
const esFiscal = g => TIPOS_FISCALES.includes(g.tipo) || esImpuesto(g);
function setMesContador(v){
  mesContador = v;
  if(v === 'todos'){ contDesde = ''; contHasta = ''; }
  else if(v !== 'rango'){
    const [a,m] = v.split('-').map(Number);
    contDesde = v + '-01';
    contHasta = fechaLocal(new Date(a, m, 0));
  }
  render();
}
function setRango(campo, v){
  if(campo === 'desde') contDesde = v; else contHasta = v;
  mesContador = 'rango';
  render();
}
const enPeriodo = x =>
  (!contDesde || x.fecha >= contDesde) && (!contHasta || x.fecha <= contHasta);
function nombrePeriodo(){
  if(!contDesde && !contHasta) return 'todos los períodos';
  if(mesContador !== 'rango' && mesContador !== 'todos') return nombreMes(mesContador);
  if(contDesde && contHasta) return `del ${fecha(contDesde)} al ${fecha(contHasta)}`;
  return contDesde ? `desde el ${fecha(contDesde)}` : `hasta el ${fecha(contHasta)}`;
}

function vContador(o){
  const todos = gastosDe(o.id).filter(esFiscal);
  const meses = [...new Set([...todos.map(g=>mesDe(g.fecha)),
                             ...aportesDe(o.id).map(a=>mesDe(a.fecha))])].sort().reverse();
  const enMes = enPeriodo;
  const gs = todos.filter(enMes).sort((a,b)=>a.fecha.localeCompare(b.fecha));
  const aps = aportesDe(o.id).filter(enMes);
  const excluidos = gastosDe(o.id).filter(g=>!esFiscal(g)&&enMes(g));
  const cl = clasesDe(o.id);

  const porTipo = {};
  gs.forEach(g => { const k = esImpuesto(g)&&!TIPOS_FISCALES.includes(g.tipo) ? 'Impuestos y tasas' : g.tipo;
                    porTipo[k] = porTipo[k] || { total:0, neto:0, iva:0, perc:0 };
                    porTipo[k].total += +g.usd;
                    const f = +g.importe ? +g.usd / +g.importe : 0;
                    porTipo[k].neto += (+g.neto||0) * f;
                    porTipo[k].iva  += (+g.iva||0) * f;
                    porTipo[k].perc += (+g.percepciones||0) * f; });

  const cuadro = (letra, titulo) => {
    const m = new Map();
    aps.filter(a => (a.clase==='B'?'B':'A')===letra).forEach(a => {
      const k = a.inversor_id + '|' + mesDe(a.fecha);
      if(!m.has(k)) m.set(k, { inv:a.inversor_id, mes:mesDe(a.fecha), total:0, n:0 });
      const x = m.get(k); x.total += +a.usd; x.n++;
    });
    const fs = [...m.values()].sort((x,y)=> x.mes.localeCompare(y.mes) ||
      (inv(x.inv)?.nombre||'').localeCompare(inv(y.inv)?.nombre||''));
    const tot = fs.reduce((s,f)=>s+f.total,0);
    return `<h3>${esc(titulo)}</h3>
    ${fs.length ? `<table><thead><tr><th>Mes</th><th>Inversor</th>
      <th class="der ocultar-chico">Aportes</th><th class="der">Importe USD</th></tr></thead><tbody>
      ${fs.map(f=>`<tr><td>${nombreMes(f.mes)}</td><td>${esc(inv(f.inv)?.nombre||'—')}</td>
        <td class="der num ocultar-chico">${f.n}</td>
        <td class="der num" style="font-weight:600">${fmtUsd2(f.total)}</td></tr>`).join('')}
      <tr><td colspan="3"><strong>Total ${esc(titulo)}</strong></td>
        <td class="der num"><strong>${fmtUsd2(tot)}</strong></td></tr></tbody></table>`
      : `<div class="vacio">Sin aportes de esta clase en el período.</div>`}`;
  };

  return `
  <div class="acciones no-imprimir">
    <label for="sel-mes" style="font-size:12.5px;color:var(--gris)">Período</label>
    <select id="sel-mes" onchange="setMesContador(this.value)"
      style="font:inherit;font-size:13.5px;padding:6px 9px;border:1px solid var(--linea-fuerte);border-radius:3px">
      <option value="todos" ${mesContador==='todos'?'selected':''}>Todos los meses</option>
      ${meses.map(m=>`<option value="${m}" ${m===mesContador?'selected':''}>${nombreMes(m)}</option>`).join('')}
      <option value="rango" ${mesContador==='rango'?'selected':''}>Rango de fechas</option>
    </select>
    <label for="cont-desde" style="font-size:12.5px;color:var(--gris)">Desde</label>
    <input id="cont-desde" type="date" value="${contDesde}" onchange="setRango('desde',this.value)"
      style="font:inherit;font-size:13.5px;padding:6px 9px;border:1px solid var(--linea-fuerte);border-radius:3px">
    <label for="cont-hasta" style="font-size:12.5px;color:var(--gris)">Hasta</label>
    <input id="cont-hasta" type="date" value="${contHasta}" onchange="setRango('hasta',this.value)"
      style="font:inherit;font-size:13.5px;padding:6px 9px;border:1px solid var(--linea-fuerte);border-radius:3px">
    <button class="btn" onclick="window.print()">Imprimir o guardar en PDF</button>
    <button class="btn sec" onclick="exportarContador()">Exportar a Excel</button>
  </div>
  <div class="reporte">
    <div class="rep-cabeza"><h2>${esc(o.nombre)}</h2>
      <p>Reporte contable · ${nombrePeriodo()}</p>
      <p class="pct">Comprobantes tipo A y C, más impuestos y tasas.</p></div>
    <h3>Comprobantes</h3>
    ${gs.length ? `<table><thead><tr><th>Fecha</th><th>Proveedor</th><th>CUIT</th><th>Tipo</th>
      <th class="ocultar-chico">Número</th><th>Rubro</th><th class="der">Neto</th>
      <th class="der">IVA</th><th class="der">Total</th>
      <th class="der">USD</th></tr></thead><tbody>
      ${gs.map(g=>`<tr><td class="num">${fecha(g.fecha)}</td><td>${esc(g.proveedor)}</td>
        <td class="num">${esc(g.cuit||'—')}</td><td><span class="chip">${esc(g.tipo)}</span></td>
        <td class="ocultar-chico num">${esc(g.numero||'—')}</td>
        <td>${esc(rubro(g.rubro_id)?.nombre||'—')}
          ${soloInfo(g)?' <span class="chip">informativo</span>':''}</td>
        <td class="der num">${+g.neto?(g.moneda==='USD'?fmtUsd2(g.neto):fmtArs(g.neto)):'—'}</td>
        <td class="der num">${+g.iva?(g.moneda==='USD'?fmtUsd2(g.iva):fmtArs(g.iva)):'—'}</td>
        <td class="der num">${g.moneda==='USD'?fmtUsd2(g.importe):fmtArs(g.importe)}</td>
        <td class="der num">${fmtUsd2(g.usd)}</td></tr>`).join('')}
      <tr><td colspan="9"><strong>Total</strong></td>
        <td class="der num"><strong>${fmtUsd2(gs.reduce((s,g)=>s+ +g.usd,0))}</strong></td></tr>
      </tbody></table>
      <h3>Resumen por tipo</h3>
      <table><thead><tr><th>Tipo</th><th class="der">Neto</th><th class="der">IVA</th>
        <th class="der">Percepciones</th><th class="der">Total USD</th></tr></thead><tbody>
      ${Object.entries(porTipo).map(([k,v])=>`<tr><td>${esc(k)}</td>
        <td class="der num">${v.neto?fmtUsd2(v.neto):'—'}</td>
        <td class="der num">${v.iva?fmtUsd2(v.iva):'—'}</td>
        <td class="der num">${v.perc?fmtUsd2(v.perc):'—'}</td>
        <td class="der num" style="font-weight:600">${fmtUsd2(v.total)}</td></tr>`).join('')}
      </tbody></table>`
      : `<div class="vacio">Sin comprobantes fiscales en el período.</div>`}
    ${(() => {
      const vs = ventasDe(o.id).filter(enMes).sort((a,b)=>a.fecha.localeCompare(b.fecha));
      if(!vs.length) return '';
      return `<h3>Ventas del período</h3>
      <table><thead><tr><th>Fecha</th><th>Comprobante</th><th>Comprador</th><th>CUIT</th>
        <th>Unidad</th><th class="der">Neto</th><th class="der">IVA</th>
        <th class="der">Total</th></tr></thead><tbody>
        ${vs.map(v=>`<tr><td class="num">${fecha(v.fecha)}</td>
          <td><span class="chip">${esc(v.tipo)}</span>
            ${v.numero?`<br><span class="pct num">${esc(v.numero)}</span>`:''}</td>
          <td>${esc(v.cliente)}</td><td class="num">${esc(v.cuit||'—')}</td>
          <td>${esc(v.unidad||'—')}</td>
          <td class="der num">${+v.neto?(v.moneda==='USD'?fmtUsd2(v.neto):fmtArs(v.neto)):'—'}</td>
          <td class="der num">${+v.iva?(v.moneda==='USD'?fmtUsd2(v.iva):fmtArs(v.iva)):'—'}</td>
          <td class="der num" style="font-weight:600">${v.moneda==='USD'?fmtUsd2(v.importe):fmtArs(v.importe)}</td>
          </tr>`).join('')}
        <tr><td colspan="7"><strong>Total en dólares</strong></td>
          <td class="der num"><strong>${fmtUsd2(vs.reduce((s,v)=>s+ +v.usd,0))}</strong></td></tr>
      </tbody></table>`;
    })()}
    ${cuadro('A', cl.A.nombre)}
    ${cuadro('B', cl.B.nombre)}
    ${aps.length ? `<table style="margin-top:14px"><tbody><tr>
      <td><strong>Total de aportes del período</strong></td>
      <td class="der num"><strong>${fmtUsd2(aps.reduce((s,a)=>s+ +a.usd,0))}</strong></td>
      </tr></tbody></table>` : ''}
    ${bloqueCierre(o)}
    ${excluidos.length ? `<h3>Fuera de este reporte</h3>
      <p class="sub">${excluidos.length} comprobante${excluidos.length===1?'':'s'} por
      ${fmtUsd2(excluidos.reduce((s,g)=>s+ +g.usd,0))} que no son A ni C ni impuestos.
      Están cargados y se ven en Comprobantes.</p>` : ''}
  </div>`;
}

/* ---------- Rendición ---------- */
function setInvRendicion(v){ invRendicion = v; render(); }

function vRendicion(o){
  const t = totalesObra(o.id);
  const total = aportesDe(o.id).reduce((s,a)=>s+ +a.usd,0);
  const totU = aportesDe(o.id).reduce((s,a)=>s+unidades(o.id,a),0);
  const sel = invRendicion!=='todos' ? inv(invRendicion) : null;
  const mis = sel ? aportesDe(o.id).filter(a=>a.inversor_id===sel.id) : [];
  const integrado = mis.reduce((s,a)=>s+ +a.usd,0);
  const misU = mis.reduce((s,a)=>s+unidades(o.id,a),0);
  const part = totU ? misU/totU*100 : 0;
  const hs = honorarios(o.id).filter(x=>x.pct);
  const cl = clasesDe(o.id);

  let grupo = null, filasRubro = '';
  D.rubros.forEach(r => {
    const p = presu(o.id,r.id), e = ejecutado(o.id,r.id);
    if(!p && !e) return;
    if(r.grupo!==grupo){ grupo = r.grupo; filasRubro += `<tr class="grupo-rubro"><td colspan="4">${esc(grupo)}</td></tr>`; }
    filasRubro += `<tr><td>${esc(r.nombre)}</td><td class="der num">${p?fmtUsd(p):'—'}</td>
      <td class="der num">${fmtUsd(e)}</td>
      <td class="der num" style="${p&&e>p?'color:var(--rojo);font-weight:600':''}">${p?fmtPct(e/p*100):'—'}</td></tr>`;
  });
  const gs = gastosDe(o.id).filter(computa).slice().sort((a,b)=>a.fecha.localeCompare(b.fecha));

  return `
  ${bloqueEnlaces(o)}
  <div class="acciones no-imprimir">
    <label for="sel-inv" style="font-size:12.5px;color:var(--gris)">Rendición para</label>
    <select id="sel-inv" onchange="setInvRendicion(this.value)"
      style="font:inherit;font-size:13.5px;padding:6px 9px;border:1px solid var(--linea-fuerte);border-radius:3px">
      <option value="todos" ${invRendicion==='todos'?'selected':''}>Todos los inversores</option>
      ${partsDe(o.id).map(p=>inv(p.inversor_id)).filter(Boolean)
        .map(i=>`<option value="${i.id}" ${i.id===invRendicion?'selected':''}>${esc(i.nombre)}</option>`).join('')}
    </select>
    <button class="btn" onclick="window.print()">Imprimir o guardar en PDF</button>
  </div>
  <div class="reporte">
    <div class="rep-cabeza"><h2>${esc(o.nombre)}</h2>
      <p>Rendición de cuentas al ${new Date().toLocaleDateString('es-AR',{day:'numeric',month:'long',year:'numeric'})}
        ${sel?` · ${esc(sel.nombre)}`:''}</p>
      <p class="pct">Importes en dólares, cada movimiento valuado a la cotización de su fecha.</p></div>
    ${sel ? `<h3>Su posición</h3>
      <div class="fila">
        <div class="kpi"><p class="r">Capital integrado</p><p class="v num">${fmtUsd(integrado)}</p>
          <p class="s">${mis.length} aporte${mis.length===1?'':'s'}</p></div>
        <div class="kpi"><p class="r">Participación</p><p class="v num">${fmtPct(part)}</p>
          <p class="s">sobre ${fmtUsd(total)} aportados por todos</p></div>
      </div>
      ${mis.length ? `<table><thead><tr><th>Fecha</th><th>Clase</th><th>Caja</th>
        <th class="der">Importe original</th><th class="der">En USD</th></tr></thead><tbody>
        ${mis.slice().sort((a,b)=>a.fecha.localeCompare(b.fecha)).map(a=>`<tr>
          <td class="num">${fecha(a.fecha)}</td>
          <td>${esc(cl[a.clase==='B'?'B':'A'].nombre)}${a.unidad?`<br><span class="pct">${esc(a.unidad)}</span>`:''}</td>
          <td>${esc(caja(a.caja_id)?.nombre||'—')}</td>
          <td class="der num">${a.moneda==='USD'?fmtUsd2(a.importe):fmtArs(a.importe)}</td>
          <td class="der num">${fmtUsd2(a.usd)}</td></tr>`).join('')}</tbody></table>`:''}` : ''}
    <h3>Estado de la obra</h3>
    <div class="fila">
      <div class="kpi"><p class="r">Presupuesto</p><p class="v num">${fmtUsd(t.pres)}</p></div>
      <div class="kpi"><p class="r">Ejecutado</p><p class="v num">${fmtUsd(t.egr)}</p>
        <p class="s">${t.pres?fmtPct(t.avance)+' del presupuesto':''}</p></div>
      <div class="kpi"><p class="r">Aportes recibidos</p><p class="v num">${fmtUsd(t.ing)}</p></div>
      <div class="kpi"><p class="r">Deuda a proveedores</p><p class="v num">${fmtUsd(t.deuda)}</p></div>
      <div class="kpi"><p class="r">Disponible neto</p><p class="v num">${fmtUsd(t.neto)}</p></div>
    </div>
    <h3>Ejecución por rubro</h3>
    ${filasRubro ? `<table><thead><tr><th>Rubro</th><th class="der">Presupuesto</th>
      <th class="der">Ejecutado</th><th class="der">Avance</th></tr></thead>
      <tbody>${filasRubro}</tbody></table>` : `<div class="vacio">Sin movimientos.</div>`}
    ${hs.length ? `<h3>Honorarios devengados</h3>
      <table><thead><tr><th>Concepto</th><th class="der">%</th><th class="der">Devengado</th>
      <th class="der">Pagado</th><th class="der">A pagar</th></tr></thead><tbody>
      ${hs.map(x=>`<tr><td>${esc(x.nombre)}</td><td class="der num">${fmtPct(x.pct)}</td>
        <td class="der num">${fmtUsd(x.devengado)}</td><td class="der num">${fmtUsd(x.pagado)}</td>
        <td class="der num">${fmtUsd2(x.saldo)}</td></tr>`).join('')}</tbody></table>` : ''}
    <h3>Saldo de cajas</h3>
    <table><thead><tr><th>Caja</th><th class="der">Ingresos</th><th class="der">Egresos</th>
      <th class="der">Saldo</th></tr></thead><tbody>
      ${cajasDe(o.id).map(c=>{const s=saldoCaja(c.id);
        return `<tr><td>${esc(c.nombre)}</td><td class="der num">${fmtUsd(s.ing)}</td>
        <td class="der num">${fmtUsd(s.egr)}</td>
        <td class="der num" style="font-weight:600">${fmtUsd(s.saldo)}</td></tr>`;}).join('')}
    </tbody></table>
    <h3>Detalle de comprobantes</h3>
    ${gs.length ? `<table><thead><tr><th>Fecha</th><th>Proveedor</th><th>Detalle</th>
      <th>Rubro</th><th class="der">Importe USD</th></tr></thead><tbody>
      ${gs.map(g=>`<tr><td class="num">${fecha(g.fecha)}</td><td>${esc(g.proveedor)}</td>
        <td>${esc(g.detalle||'—')}</td><td>${esc(rubro(g.rubro_id)?.nombre||'—')}
        ${g.pago!=='pagado'?' <span class="chip a">impaga</span>':''}</td>
        <td class="der num">${fmtUsd2(g.usd)}</td></tr>`).join('')}
      <tr><td colspan="4"><strong>Total ejecutado</strong></td>
        <td class="der num"><strong>${fmtUsd2(t.egr)}</strong></td></tr>
      </tbody></table>` : `<div class="vacio">Sin comprobantes.</div>`}
  </div>`;
}

/* ---------- Índice CAC ---------- */
function vIndices(){
  const serie = serieCac().slice().reverse();
  const u = cacUltimo();
  const mesActual = hoy().slice(0,7);
  const falta = !serie.some(x => x.periodo === mesActual);

  return `
  ${puedeEditar()?`<div class="acciones">
    <button class="btn" onclick="formIndice()">Cargar índice del mes</button>
  </div>`:''}
  <p class="sub">El índice de la Cámara Argentina de la Construcción ajusta las cuotas de las
  ventas financiadas en pesos. Se carga una vez por mes, desde
  <a href="https://www.cifrasonline.com.ar/indice-cac/" target="_blank" rel="noopener"
     style="color:var(--azul)">cifrasonline.com.ar</a>.
  Podés cargar el nivel del índice o la variación mensual: si cargás solo la variación,
  el nivel se encadena desde el mes anterior.</p>

  ${falta && u ? `<div class="vacio" style="text-align:left;border-color:var(--ambar)">
    <strong>Falta el índice de ${nombreMes(mesActual)}.</strong>
    <p style="font-size:12.5px;color:var(--gris);margin:6px 0 0">
      Hasta que lo cargues, las cuotas se ajustan con el de ${nombreMes(u.periodo)}.</p>
  </div>` : ''}

  ${serie.length ? `<table><thead><tr><th>Período</th><th class="der">Nivel</th>
    <th class="der">Variación</th><th class="der">Acumulado 12 meses</th>
    <th>Cargado</th><th></th></tr></thead><tbody>
    ${serie.map((x,i)=>{
      const ant = serie[i+1];
      const varMes = x.variacion != null ? +x.variacion
        : (ant && ant.nivel && x.nivel ? (x.nivel/ant.nivel - 1)*100 : null);
      const hace12 = serie[i+12];
      const anual = hace12 && hace12.nivel && x.nivel ? (x.nivel/hace12.nivel - 1)*100 : null;
      return `<tr>
        <td><strong>${nombreMes(x.periodo)}</strong>
          ${x.periodo===u?.periodo?' <span class="chip v">último</span>':''}</td>
        <td class="der num">${x.nivel!=null?x.nivel.toLocaleString('es-AR',{maximumFractionDigits:2}):'—'}
          ${x.valor==null?'<br><span class="pct">encadenado</span>':''}</td>
        <td class="der num">${varMes!=null?fmtPct(varMes):'—'}</td>
        <td class="der num">${anual!=null?fmtPct(anual):'—'}</td>
        <td><span class="pct">${esc(x.nota||x.fuente||'')}</span></td>
        <td class="der">${puedeEditar()?`<button class="link" onclick="formIndice('${x.id}')">Editar</button>`:''}
          ${esAdmin()?`<br><button class="link" onclick="borrar('indices','${x.id}')">Eliminar</button>`:''}</td>
      </tr>`;
    }).join('')}
  </tbody></table>` : `<div class="vacio">Todavía no hay índices cargados.
    Cargá al menos uno para poder ajustar cuotas por CAC.</div>`}

  ${(() => {
    const usadas = D.ventas.filter(v => v.modalidad === 'cuotas_cac');
    if(!usadas.length) return '';
    return `<h3>Ventas ajustadas por este índice</h3>
    <table><thead><tr><th>Obra</th><th>Comprador</th><th>Base</th>
      <th class="der">Coeficiente</th><th class="der">Por cobrar</th></tr></thead><tbody>
      ${usadas.map(v=>{
        const r = resumenVenta(v);
        const coef = u && +v.indice_base ? u.nivel/+v.indice_base : null;
        return `<tr><td>${esc(D.obras.find(o=>o.id===v.obra_id)?.nombre||'')}</td>
          <td>${esc(v.cliente)} <span class="pct">${esc(v.unidad||'')}</span></td>
          <td>${v.periodo_base?nombreMes(v.periodo_base):'—'}
            <br><span class="pct num">${v.indice_base?(+v.indice_base).toLocaleString('es-AR',{maximumFractionDigits:2}):''}</span></td>
          <td class="der num">${coef?coef.toLocaleString('es-AR',{minimumFractionDigits:3,maximumFractionDigits:3}):'—'}</td>
          <td class="der num">${fmtArs(r.porCobrar)}</td></tr>`;
      }).join('')}
    </tbody></table>`;
  })()}`;
}

function formIndice(id){
  const x = id ? D.indices.find(i=>i.id===id) : null;
  const mes = hoy().slice(0,7);
  modal(id ? 'Editar índice' : 'Cargar índice CAC', `
    <div class="campo"><label for="ix-periodo">Período</label>
      <input id="ix-periodo" type="month" value="${x?x.periodo:mes}"></div>
    <div class="campo"><label for="ix-valor">Nivel del índice</label>
      <input id="ix-valor" type="number" step="0.0001" value="${x&&x.valor!=null?x.valor:''}"
        placeholder="opcional"></div>
    <div class="campo"><label for="ix-var">Variación mensual %</label>
      <input id="ix-var" type="number" step="0.0001" value="${x&&x.variacion!=null?x.variacion:''}"
        placeholder="opcional"></div>
    <div class="campo"><label for="ix-nota">Nota</label>
      <input id="ix-nota" value="${x?esc(x.nota||''):''}" placeholder="Opcional"></div>
    <div class="campo ancho"><span class="ayuda">Cargá el nivel si lo tenés.
      Si en la publicación solo figura el porcentaje de aumento respecto al mes anterior,
      cargá la variación y el sistema encadena el nivel.</span></div>`,
    async ()=>{
      const periodo = val('ix-periodo');
      if(!periodo) return err('Elegí el período.');
      const valor = val('ix-valor'), variacion = val('ix-var');
      if(!valor && !variacion) return err('Cargá el nivel o la variación.');
      const datos = { nombre:'CAC', periodo,
        valor: valor ? parseFloat(valor) : null,
        variacion: variacion ? parseFloat(variacion) : null,
        nota: val('ix-nota'), cargado_por: perfil.id };
      cerrar();
      if(id) return guardar('indices', datos, id);
      const { error } = await sb.from('indices').upsert(datos, { onConflict:'nombre,periodo' });
      if(error) return aviso('No se pudo guardar: ' + error.message, true);
      aviso('Índice guardado');
      await cargarDatos();
    });
}

/* =====================================================================
   PANEL DE USUARIOS
   ===================================================================== */
async function usuariosLlamar(cuerpo){
  const { data, error } = await sb.functions.invoke('gestionar-usuarios', { body: cuerpo });
  if(error){
    let detalle = error.message;
    try{ const c = await error.context?.json(); if(c?.error) detalle = c.error; }catch(e){}
    aviso(detalle, true);
    return null;
  }
  if(data?.error){ aviso(data.error, true); return null; }
  return data;
}

async function cargarUsuarios(){
  const d = await usuariosLlamar({ accion:'listar' });
  usuarios = d ? d.usuarios : [];
  render();
}

const ROLES = [['admin','Administrador'],['carga','Carga'],['inversor','Inversor']];
const DESC_ROL = {
  admin: 'Todo, incluido eliminar y gestionar usuarios',
  carga: 'Ve todo y carga movimientos. No elimina',
  inversor: 'Solo lectura, y solo de las obras donde aportó'
};

function vUsuarios(){
  if(usuarios === null){
    cargarUsuarios();
    return `<div class="vacio">Cargando usuarios…</div>`;
  }
  const libres = D.inversores.filter(i => !i.perfil_id);
  return `
  <div class="acciones">
    <button class="btn" onclick="formUsuario()">Agregar usuario</button>
    <button class="btn sec" onclick="cargarUsuarios()">Actualizar</button>
  </div>
  <p class="sub">El rol define qué puede hacer cada uno. Los cambios tienen efecto
  la próxima vez que la persona entre o recargue.</p>

  ${usuarios.length ? `<table><thead><tr><th>Usuario</th><th>Rol</th>
    <th class="ocultar-chico">Inversor vinculado</th><th class="ocultar-chico">Último acceso</th>
    <th></th></tr></thead><tbody>
    ${usuarios.map(u=>`<tr>
      <td><strong>${esc(u.nombre || '(sin nombre)')}</strong>
        <br><span class="pct">${esc(u.email)}</span>
        ${u.soy_yo?' <span class="chip">vos</span>':''}
        ${!u.confirmado?' <span class="chip a">invitación pendiente</span>':''}
        <br><button class="link" onclick="renombrarUsuario('${u.id}')">Cambiar nombre</button></td>
      <td><select onchange="cambiarRol('${u.id}',this.value)" ${u.soy_yo?'disabled':''}
          style="font:inherit;font-size:13px;padding:5px 7px;
          border:1px solid var(--linea-fuerte);border-radius:3px">
          ${ROLES.map(([v,n])=>`<option value="${v}" ${v===u.rol?'selected':''}>${n}</option>`).join('')}
        </select>
        <p class="pct">${esc(DESC_ROL[u.rol])}</p></td>
      <td class="ocultar-chico">
        ${u.rol==='inversor'
          ? `<select onchange="vincularInversor('${u.id}',this.value)"
              style="font:inherit;font-size:13px;padding:5px 7px;
              border:1px solid var(--linea-fuerte);border-radius:3px">
              <option value="">Sin vincular</option>
              ${D.inversores.filter(i => !i.perfil_id || i.id===u.inversor_id)
                .map(i=>`<option value="${i.id}" ${i.id===u.inversor_id?'selected':''}>${esc(i.nombre)}</option>`).join('')}
            </select>
            ${!u.inversor_id?`<p class="pct">Sin vincular no ve ninguna obra.</p>`:''}`
          : '<span class="pct">—</span>'}</td>
      <td class="ocultar-chico num">${u.ultimo_acceso
        ? new Date(u.ultimo_acceso).toLocaleDateString('es-AR')
        : '<span class="pct">nunca entró</span>'}</td>
      <td class="der">
        <button class="link" data-email="${esc(u.email)}" onclick="recuperarClave(this.dataset.email)">Enviar recuperación</button>
        ${u.soy_yo?'':`<br><button class="link" data-nombre="${esc(u.nombre||u.email)}" onclick="eliminarUsuario('${u.id}', this.dataset.nombre)">Eliminar</button>`}</td>
      </tr>`).join('')}
    </tbody></table>` : `<div class="vacio">No se pudieron listar los usuarios.
      Revisá que la función esté desplegada.</div>`}

  ${libres.length ? `<p class="sub" style="margin-top:12px">Inversores sin usuario:
    ${libres.map(i=>esc(i.nombre)).join(', ')}.</p>` : ''}

  <h3>Respaldo</h3>
  <p class="sub">Descargá una copia de todo lo cargado. Guardala fuera de la computadora:
  Drive, un disco externo, donde tengas el resto de los respaldos del estudio.</p>
  <div class="acciones">
    <button class="btn" onclick="descargarRespaldo()">Descargar datos</button>
    <button class="btn sec" onclick="descargarFotos()">Descargar fotos</button>
  </div>
  <p class="sub">Los datos salen en un archivo JSON con todas las tablas. Las fotos van aparte,
  una descarga por archivo, porque el navegador no puede armar un comprimido.
  Un respaldo por mes, y uno antes de cualquier cambio grande, alcanza.</p>`;
}

/* ---------- Respaldo de datos ---------- */
const TABLAS_RESPALDO = ['obras','clases','rubros','presupuestos','cajas',
  'inversores','participaciones','aportes','comprobantes','ventas','avances',
  'documentos','fichas','analisis','niveles','unidades','indices','cuotas','enlaces',
  'proveedores','pedidos','pedido_respuestas','perfiles','cierres','auditoria'];

async function descargarRespaldo(){
  aviso('Armando el respaldo…');
  const copia = { generado: new Date().toISOString(), proyecto: window.CONFIG.url, tablas: {} };
  for(const t of TABLAS_RESPALDO){
    const { data, error } = await todo(t);
    if(error){ aviso(`No se pudo leer ${t}: ${error.message}`, true); return; }
    copia.tablas[t] = data;
  }
  const filas = Object.entries(copia.tablas).map(([t,d])=>`${t}: ${d.length}`).join(', ');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(copia,null,2)],{type:'application/json'}));
  a.download = `respaldo-obras-${hoy()}.json`;
  a.click(); URL.revokeObjectURL(a.href);
  aviso('Respaldo descargado');
  console.log('Respaldo:', filas);
}

async function descargarFotos(){
  const conArchivo = [
    ...D.comprobantes.filter(c=>c.archivo).map(c=>({ruta:c.archivo, nombre:`comprobante-${c.fecha}-${c.proveedor}`})),
    ...D.avances.filter(a=>a.archivo).map(a=>({ruta:a.archivo, nombre:`avance-${a.fecha}-${a.titulo||''}`})),
    ...D.documentos.filter(x=>x.archivo).map(x=>({ruta:x.archivo, nombre:`documento-${x.tipo}-${x.titulo}`}))
  ];
  if(!conArchivo.length) return aviso('No hay fotos cargadas todavía.');
  if(!confirm(`Se van a abrir ${conArchivo.length} descargas, una por foto. ¿Seguir?`)) return;
  for(const f of conArchivo){
    const i = f.ruta.indexOf('/');
    const { data } = await sb.storage.from(f.ruta.slice(0,i)).createSignedUrl(f.ruta.slice(i+1), 300);
    if(!data) continue;
    const a = document.createElement('a');
    a.href = data.signedUrl;
    a.download = f.nombre.replace(/[^\w\-]+/g,'-').slice(0,80);
    a.click();
    await new Promise(r=>setTimeout(r, 350));
  }
  aviso('Descarga de fotos iniciada');
}

function formUsuario(){
  modal('Agregar usuario', `
    <div class="campo ancho"><label for="u-nombre">Nombre</label>
      <input id="u-nombre" placeholder="Nombre y apellido"></div>
    <div class="campo ancho"><label for="u-email">Email</label>
      <input id="u-email" type="email" placeholder="persona@ejemplo.com"></div>
    <div class="campo"><label for="u-rol">Rol</label>
      <select id="u-rol">${ROLES.map(([v,n])=>`<option value="${v}" ${v==='carga'?'selected':''}>${n}</option>`).join('')}</select></div>
    <div class="campo"><label for="u-modo">Cómo entra</label>
      <select id="u-modo" onchange="tglModoUsuario()">
        <option value="invitacion">Le llega una invitación por email</option>
        <option value="password">Le doy una contraseña inicial</option>
      </select></div>
    <div class="campo ancho" id="wrap-pass" style="display:none">
      <label for="u-pass">Contraseña inicial</label>
      <input id="u-pass" type="password" autocomplete="new-password" placeholder="mínimo 8 caracteres">
      <span class="ayuda">Se la pasás vos por otro medio y conviene que la cambie al entrar.</span></div>
    <div class="campo ancho"><span class="ayuda">Con invitación la persona elige su propia
      contraseña y vos nunca la ves. Es la opción recomendada.</span></div>`,
    async ()=>{
      const nombre = val('u-nombre'), email = val('u-email');
      const rol = val('u-rol'), modo = val('u-modo'), password = val('u-pass');
      if(!nombre) return err('Poné el nombre.');
      if(!email.includes('@')) return err('Revisá el email.');
      if(modo==='password' && password.length < 8) return err('La contraseña necesita 8 caracteres o más.');
      document.getElementById('ok').disabled = true;
      const r = await usuariosLlamar({ accion:'crear', nombre, email, rol, modo, password });
      if(!r){ const b = document.getElementById('ok'); if(b) b.disabled = false; return; }
      cerrar();
      aviso(modo==='password' ? 'Usuario creado' : 'Invitación enviada');
      await cargarUsuarios();
    });
}
function tglModoUsuario(){
  const m = document.getElementById('u-modo'), w = document.getElementById('wrap-pass');
  if(m&&w) w.style.display = m.value==='password' ? '' : 'none';
}

async function cambiarRol(id, rol){
  const r = await usuariosLlamar({ accion:'rol', id, rol });
  if(r){ aviso('Rol actualizado'); await cargarUsuarios(); } else await cargarUsuarios();
}
async function vincularInversor(id, inversor_id){
  const r = await usuariosLlamar({ accion:'vincular', id, inversor_id });
  if(r){ aviso('Vínculo actualizado'); await cargarDatos(); await cargarUsuarios(); }
}
function renombrarUsuario(id){
  const u = usuarios.find(x=>x.id===id);
  modal('Cambiar nombre', `<div class="campo ancho"><label for="u-n">Nombre</label>
    <input id="u-n" value="${esc(u.nombre)}"></div>`,
    async ()=>{
      const nombre = val('u-n');
      if(!nombre) return err('El nombre no puede quedar vacío.');
      cerrar();
      if(await usuariosLlamar({ accion:'nombre', id, nombre })){
        aviso('Nombre actualizado'); await cargarUsuarios();
      }
    });
}
async function recuperarClave(email){
  if(!confirm(`Enviar un correo de recuperación de contraseña a ${email}?`)) return;
  if(await usuariosLlamar({ accion:'recuperar', email })) aviso('Correo enviado');
}
async function eliminarUsuario(id, nombre){
  if(!confirm(`Eliminar el usuario de ${nombre}? Pierde el acceso de inmediato. Los movimientos que cargó se conservan.`)) return;
  if(await usuariosLlamar({ accion:'eliminar', id })){
    aviso('Usuario eliminado'); await cargarDatos(); await cargarUsuarios();
  }
}

/* =====================================================================
   ESCRITURA
   ===================================================================== */
const SIN_EFECTO = 'No se hizo ningún cambio: tu usuario no tiene permiso o el registro ya no existe.';

async function guardar(tabla, datos, id){
  if('nombre' in datos && !String(datos.nombre||'').trim()){
    aviso('No se guardó: el nombre quedó vacío.', true);
    return false;
  }
  const q = id ? sb.from(tabla).update(datos).eq('id', id)
               : sb.from(tabla).insert(datos);
  // .select() devuelve las filas afectadas. Si el RLS no deja tocar el
  // registro, la base no da error: simplemente no afecta ninguna fila.
  const { data, error } = await q.select('id');
  if(error){ aviso('No se pudo guardar: ' + error.message, true); return false; }
  if(!data?.length){ aviso(SIN_EFECTO, true); return false; }
  aviso('Guardado');
  await cargarDatos();
  return true;
}
async function borrar(tabla, id){
  if(!confirm('¿Eliminar este registro? No se puede deshacer.')) return;
  const { data, error } = await sb.from(tabla).delete().eq('id', id).select('id');
  if(error){ aviso('No se pudo eliminar: ' + error.message, true); return; }
  if(!data?.length){ aviso(SIN_EFECTO, true); return; }
  aviso('Eliminado');
  await cargarDatos();
}

async function setPresu(rubroId, v){
  const monto = parseFloat(v)||0;
  const { error } = monto
    ? await sb.from('presupuestos').upsert({ obra_id:obraActiva, rubro_id:rubroId, monto_usd:monto })
    : await sb.from('presupuestos').delete().eq('obra_id',obraActiva).eq('rubro_id',rubroId);
  if(error) return aviso('No se pudo guardar: ' + error.message, true);
  await cargarDatos();
}
async function setPctHon(columna, v){
  await guardar('obras', { [columna]: parseFloat(v)||0 }, obraActiva);
}
async function setClase(letra, campo, v){
  const c = D.clases.find(x=>x.obra_id===obraActiva && x.letra===letra);
  const valor = campo==='coeficiente' ? (parseFloat(v)||0) : v.trim();
  if(c) await guardar('clases', { [campo]: valor }, c.id);
  else await guardar('clases', { obra_id:obraActiva, letra, [campo]: valor });
}

/* =====================================================================
   FORMULARIOS
   ===================================================================== */
function cerrar(){ document.getElementById('modal-host').innerHTML=''; }
function modal(titulo, campos, onOk){
  document.getElementById('modal-host').innerHTML = `
    <div class="fondo" onclick="if(event.target===this)cerrar()">
      <div class="modal" role="dialog" aria-modal="true"><header><h4>${titulo}</h4></header>
      <div class="campos">${campos}</div><p class="error" id="err"></p>
      <footer><button class="btn sec" onclick="cerrar()">Cancelar</button>
      <button class="btn" id="ok">Guardar</button></footer></div></div>`;
  document.getElementById('ok').onclick = onOk;
  const p = document.querySelector('.modal input,.modal select'); if(p) p.focus();
}
const err = m => document.getElementById('err').textContent = m;
const val = id => document.getElementById(id)?.value.trim() ?? '';
const opciones = (arr, sel, campo='nombre') =>
  arr.map(x=>`<option value="${x.id}" ${x.id===sel?'selected':''}>${esc(x[campo])}</option>`).join('');

function tglCotiz(){
  const m = document.getElementById('mon'), e = document.getElementById('ayuda-cotiz');
  if(!m || !e) return;
  e.textContent = m.value === 'USD'
    ? 'Queda guardada como referencia histórica. No altera el importe en dólares.'
    : 'Fija el valor en dólares del movimiento. No cambia si después se mueve el dólar.';
}
/* Cotización con la que se cargó el movimiento. Los registros viejos en
   dólares se guardaron con 1 y no tienen referencia histórica. */
const tcDe  = m => (m.moneda === 'USD' && +m.cotizacion <= 1) ? null : +m.cotizacion;
const fmtTc = m => { const t = tcDe(m);
  return t ? t.toLocaleString('es-AR',{maximumFractionDigits:2}) : '—'; };
function tglPago(){
  const p = document.getElementById('pago'), w = document.getElementById('wrap-fpago');
  if(p&&w) w.style.display = p.value==='pagado' ? '' : 'none';
}
function calcularIva(){
  const e = document.getElementById('dif-iva'); if(!e) return;
  const tot = parseFloat(val('imp'))||0;
  const suma = (parseFloat(val('neto'))||0) + (parseFloat(val('iva'))||0) + (parseFloat(val('perc'))||0);
  if(!suma){ e.textContent = 'sin discriminar'; e.style.color = 'var(--gris)'; return; }
  const d = tot - suma;
  e.textContent = Math.abs(d) < 0.5 ? 'cierra con el total' : `${d>0?'faltan':'sobran'} ${Math.abs(d).toFixed(2)}`;
  e.style.color = Math.abs(d) < 0.5 ? 'var(--verde)' : 'var(--rojo)';
}

function tglAfecta(){
  const a = document.getElementById('afecta');
  if(!a) return;
  const mueve = a.value === 'si';
  ['wrap-caja','wrap-estado'].forEach(id => {
    const e = document.getElementById(id); if(e) e.style.display = mueve ? '' : 'none';
  });
  const n = document.getElementById('nota-info');
  if(n) n.style.display = mueve ? 'none' : '';
  const f = document.getElementById('wrap-fpago');
  if(f) f.style.display = mueve && document.getElementById('pago').value==='pagado' ? '' : 'none';
}

/* ---------- comprobante ---------- */
function formGasto(id){
  const o = obra(), cs = cajasDe(o.id);
  const g = id ? D.comprobantes.find(x=>x.id===id) : null, v = g || {};
  if(!cs.length) return alert('Primero agregá una caja a esta obra.');
  modal(g ? 'Editar comprobante' : 'Cargar comprobante', `
    <div class="lector" id="lector">
      <label for="foto">Comprobante</label>
      <input id="foto" type="file" accept="image/*,application/pdf" capture="environment"
        onchange="leerComprobante(this)">
      <span class="ayuda" id="foto-estado">Sacá la foto o subí el PDF: completo los campos
        y guardo el archivo junto al asiento. Revisalos antes de guardar.</span>
    </div>
    <div class="campo"><label for="f">Fecha</label><input id="f" type="date" value="${v.fecha||hoy()}"></div>
    <div class="campo"><label for="prov">Proveedor</label>
      <input id="prov" value="${esc(v.proveedor||'')}" list="prov-conocidos"
        autocomplete="off" onchange="autoProveedor()"
        placeholder="Elegí uno o escribí el nombre nuevo">
      ${listaProveedores('prov-conocidos')}</div>
    <div class="campo"><label for="cuit">CUIT</label>
      <input id="cuit" value="${esc(v.cuit||'')}" placeholder="30-12345678-9"></div>
    <div class="campo"><label for="rub">Rubro</label>
      <select id="rub" onchange="this.dataset.tocado='1'">${opciones(D.rubros, v.rubro_id)}</select></div>
    <div class="campo" id="wrap-caja"><label for="cj">Caja</label>
      <select id="cj">${opciones(cs, v.caja_id)}</select></div>
    <div class="campo"><label for="tipo">Tipo de comprobante</label><select id="tipo">
      ${['Factura A','Factura B','Factura C','Recibo','Remito','Sin comprobante']
        .map(t=>`<option ${t===v.tipo?'selected':''}>${t}</option>`).join('')}</select></div>
    <div class="campo"><label for="nro">Número</label>
      <input id="nro" value="${esc(v.numero||'')}" placeholder="0001-00001234"></div>
    <div class="campo"><label for="mon">Moneda</label><select id="mon" onchange="tglCotiz()">
      <option value="ARS" ${v.moneda!=='USD'?'selected':''}>Pesos</option>
      <option value="USD" ${v.moneda==='USD'?'selected':''}>Dólares</option></select></div>
    <div class="campo"><label for="imp">Importe</label>
      <input id="imp" type="number" step="0.01" min="0" value="${v.importe||''}"
        onchange="calcularIva()"></div>
    <div class="campo ancho" id="wrap-cotiz"><label for="ct">Cotización del día</label>
      <input id="ct" type="number" step="0.01" min="0"
        value="${+v.cotizacion > 1 ? v.cotizacion : cotizacion}" onchange="calcularIva()">
      <span class="ayuda" id="ayuda-cotiz"></span></div>

    <div class="campo" id="wrap-estado"><label for="pago">Estado</label><select id="pago" onchange="tglPago()">
      <option value="pagado" ${v.pago!=='pendiente'?'selected':''}>Pagado</option>
      <option value="pendiente" ${v.pago==='pendiente'?'selected':''}>Pendiente de pago</option></select></div>
    <div class="campo" id="wrap-fpago"><label for="fp">Fecha de pago</label>
      <input id="fp" type="date" value="${v.fecha_pago||hoy()}"></div>
    <div class="campo ancho"><label for="det">Detalle</label>
      <input id="det" value="${esc(v.detalle||'')}" placeholder="12 m³ H21 para platea"></div>
    <div class="campo"><label for="neto">Neto gravado</label>
      <input id="neto" type="number" step="0.01" min="0" value="${+v.neto||''}"
        placeholder="opcional" onchange="calcularIva()"></div>
    <div class="campo"><label for="iva">IVA</label>
      <input id="iva" type="number" step="0.01" min="0" value="${+v.iva||''}"
        placeholder="opcional" onchange="calcularIva()"></div>
    <div class="campo"><label for="perc">Percepciones</label>
      <input id="perc" type="number" step="0.01" min="0" value="${+v.percepciones||''}"
        placeholder="opcional" onchange="calcularIva()"></div>
    <div class="campo"><label>Diferencia</label>
      <p class="ayuda" id="dif-iva" style="padding-top:8px">—</p></div>
    <div class="campo ancho"><label for="honor">Computa para honorarios</label>
      <select id="honor">
        <option value="si" ${v.computa_honorarios!==false?'selected':''}>Sí, entra en la base</option>
        <option value="no" ${v.computa_honorarios===false?'selected':''}>No: flete, honorario o similar</option>
      </select>
      <span class="ayuda">Los fletes se pagan sobre materiales que ya computan.
      Incluirlos duplicaría la base de cálculo.</span></div>
    <div class="campo ancho"><label for="afecta">Tratamiento</label>
      <select id="afecta" onchange="tglAfecta()">
        <option value="si" ${v.afecta_caja!==false?'selected':''}>Costo de obra</option>
        <option value="no" ${v.afecta_caja===false?'selected':''}>Solo informativo al contador</option>
      </select>
      <span class="ayuda">Dejalo como está salvo que el comprobante no deba sumar al costo.</span>
      <span class="ayuda" id="nota-info" style="display:none">No suma al costo de la obra,
      no toca caja ni genera deuda. Aparece únicamente en la pestaña Contador.</span></div>`,
    async ()=>{
      const imp = parseFloat(val('imp'));
      if(!val('prov')) return err('Poné el proveedor.');
      if(!imp || imp<=0) return err('El importe tiene que ser mayor a cero.');
      const mon = val('mon'), ct = parseFloat(val('ct'));
      if(!ct || ct<=0) return err('Necesito la cotización del día.');
      document.getElementById('ok').disabled = true;
      const afecta = val('afecta') === 'si';
      const datos = { obra_id:o.id, rubro_id:val('rub'), fecha:val('f'),
        proveedor:val('prov'), cuit:val('cuit'), tipo:val('tipo'), numero:val('nro'),
        detalle:val('det'), moneda:mon, importe:imp, cotizacion: ct,
        afecta_caja: afecta,
        caja_id: afecta ? val('cj') : null,
        computa_honorarios: val('honor') !== 'no',
        neto: parseFloat(val('neto'))||0,
        iva: parseFloat(val('iva'))||0,
        percepciones: parseFloat(val('perc'))||0,
        pago: afecta ? val('pago') : 'pagado',
        fecha_pago: afecta && val('pago')==='pagado' ? val('fp') : null,
        creado_por: perfil.id };
      if(archivoPendiente) datos.archivo = await subirArchivo('comprobantes', archivoPendiente, o.id);
      cerrar();
      await guardar('comprobantes', datos, g?.id);
      archivoPendiente = null;
    });
  tglCotiz(); tglPago(); tglAfecta(); calcularIva(); archivoPendiente = null;
}

function marcarPagado(id){
  const g = D.comprobantes.find(x=>x.id===id);
  modal('Registrar el pago', `
    <div class="campo ancho"><label for="fp">Fecha de pago</label>
      <input id="fp" type="date" value="${hoy()}">
      <span class="ayuda">${esc(g.proveedor)} · ${fmtUsd2(g.usd)}. Recién ahora sale de la caja.</span></div>`,
    async ()=>{ const f = val('fp'); cerrar();
      await guardar('comprobantes', { pago:'pagado', fecha_pago:f }, id); });
}

/* ---------- aporte ---------- */
function formAporte(id){
  const o = obra(), cs = cajasDe(o.id), cl = clasesDe(o.id);
  const a = id ? D.aportes.find(x=>x.id===id) : null, v = a || {};
  const invObra = partsDe(o.id).map(p=>inv(p.inversor_id)).filter(Boolean)
    .sort((x,y)=>x.nombre.localeCompare(y.nombre));
  if(!invObra.length) return alert('Primero sumá al menos un inversor a esta obra.');
  modal(a ? 'Editar aporte' : 'Registrar aporte', `
    <div class="campo"><label for="f">Fecha</label><input id="f" type="date" value="${v.fecha||hoy()}"></div>
    <div class="campo"><label for="iv">Inversor</label>
      <select id="iv">${opciones(invObra, v.inversor_id)}</select></div>
    <div class="campo ancho"><label for="cj">Caja de destino</label>
      <select id="cj">${opciones(cs, v.caja_id)}</select></div>
    <div class="campo ancho"><label for="unidad">Unidad</label>
      ${unidadesDe(o.id).length
        ? `<select id="unidad-id" onchange="document.getElementById('unidad').value =
             this.options[this.selectedIndex].dataset.codigo || ''">
            <option value="">Sin unidad</option>
            ${unidadesDe(o.id).map(x=>`<option value="${x.id}" data-codigo="${esc(x.codigo)}"
              ${x.id===v.unidad_id?'selected':''}>${esc(x.codigo)} · ${esc(x.tipo)}</option>`).join('')}
          </select>
          <input id="unidad" type="hidden" value="${esc(v.unidad||'')}">`
        : `<input id="unidad" value="${esc(v.unidad||'')}" placeholder="3ºB, Lote 4 — opcional">
           <span class="ayuda">Cargá las unidades en su solapa para elegirlas de una lista.</span>`}</div>
    <div class="campo ancho"><label for="clase">Clase de participación</label>
      <select id="clase"><option value="A" ${v.clase!=='B'?'selected':''}>${esc(cl.A.nombre)}</option>
      <option value="B" ${v.clase==='B'?'selected':''}>${esc(cl.B.nombre)}</option></select></div>
    <div class="campo"><label for="mon">Moneda</label><select id="mon" onchange="tglCotiz()">
      <option value="USD" ${v.moneda!=='ARS'?'selected':''}>Dólares</option>
      <option value="ARS" ${v.moneda==='ARS'?'selected':''}>Pesos</option></select></div>
    <div class="campo"><label for="imp">Importe</label>
      <input id="imp" type="number" step="0.01" min="0" value="${v.importe||''}"></div>
    <div class="campo ancho" id="wrap-cotiz"><label for="ct">Cotización del día</label>
      <input id="ct" type="number" step="0.01" min="0"
        value="${+v.cotizacion > 1 ? v.cotizacion : cotizacion}">
      <span class="ayuda" id="ayuda-cotiz"></span></div>`,
    async ()=>{
      const imp = parseFloat(val('imp'));
      if(!imp || imp<=0) return err('El importe tiene que ser mayor a cero.');
      const mon = val('mon'), ct = parseFloat(val('ct'));
      if(!ct || ct<=0) return err('Necesito la cotización del día.');
      const datos = { obra_id:o.id, inversor_id:val('iv'), caja_id:val('cj'),
        clase:val('clase'), unidad:val('unidad'), unidad_id: val('unidad-id') || null,
        fecha:val('f'), moneda:mon, importe:imp,
        cotizacion: ct, creado_por: perfil.id };
      cerrar();
      await guardar('aportes', datos, a?.id);
    });
  tglCotiz();
}

/* ---------- inversor, caja, rubro, obra ---------- */
function formParticipacion(id){
  const o = obra();
  const p = id ? D.participaciones.find(x=>x.id===id) : null;
  const yaEstan = partsDe(o.id).map(x=>x.inversor_id);
  const libres = D.inversores.filter(i => !yaEstan.includes(i.id));
  const cl = clasesDe(o.id);

  modal(p ? 'Participación en esta obra' : 'Sumar inversor a esta obra', `
    ${p ? `<div class="campo ancho"><label>Inversor</label>
        <p style="font-size:15px;font-weight:600;margin:2px 0 0">${esc(inv(p.inversor_id)?.nombre||'')}</p>
        <button class="link" style="margin-top:4px"
          onclick="cerrar();formInversor('${p.inversor_id}')">Editar sus datos personales</button></div>`
      : `<div class="campo ancho"><label for="pa-quien">Quién</label>
        <select id="pa-quien" onchange="tglNuevoInversor()">
          ${libres.map(i=>`<option value="${i.id}">${esc(i.nombre)}</option>`).join('')}
          <option value="__nuevo">— Cargar un inversor nuevo —</option>
        </select>
        <span class="ayuda">Elegí uno ya cargado en el estudio o creá uno nuevo.</span></div>
        <div class="campo ancho" id="wrap-nuevo" style="display:none">
          <label for="pa-nombre">Nombre del inversor nuevo</label>
          <input id="pa-nombre" placeholder="Nombre o razón social">
          <span class="ayuda">Queda disponible para sumarlo también a otras obras.</span></div>`}
    <div class="campo"><label for="pa-ca">Suscripto en ${esc(cl.A.nombre)}</label>
      <input id="pa-ca" type="number" min="0" step="1000" value="${p?(+p.comp_a||''):''}" placeholder="0"></div>
    <div class="campo"><label for="pa-cb">Suscripto en ${esc(cl.B.nombre)}</label>
      <input id="pa-cb" type="number" min="0" step="1000" value="${p?(+p.comp_b||''):''}" placeholder="0"></div>
    <div class="campo ancho"><label for="pa-nota">Nota</label>
      <input id="pa-nota" value="${p?esc(p.nota||''):''}" placeholder="Opcional"></div>`,
    async ()=>{
      const comp_a = parseFloat(val('pa-ca'))||0, comp_b = parseFloat(val('pa-cb'))||0;
      const nota = val('pa-nota');
      if(p){ cerrar(); return guardar('participaciones', { comp_a, comp_b, nota }, p.id); }

      let invId = val('pa-quien');
      if(invId === '__nuevo'){
        const nombre = val('pa-nombre');
        if(!nombre) return err('Poné el nombre del inversor.');
        document.getElementById('ok').disabled = true;
        const { data, error } = await sb.from('inversores').insert({ nombre }).select('id').single();
        if(error){ document.getElementById('ok').disabled = false;
          return err('No se pudo crear el inversor: ' + error.message); }
        invId = data.id;
      }
      if(!invId) return err('Elegí un inversor.');
      cerrar();
      await guardar('participaciones', { obra_id:o.id, inversor_id:invId, comp_a, comp_b, nota });
    });
  tglNuevoInversor();
}
function tglNuevoInversor(){
  const q = document.getElementById('pa-quien'), w = document.getElementById('wrap-nuevo');
  if(!q || !w) return;
  w.style.display = (q.value === '__nuevo' || q.options.length === 1) ? '' : 'none';
}
async function quitarDeObra(id, nombre){
  if(!confirm(`Quitar a ${nombre} de esta obra? La ficha del inversor se conserva y sus aportes en otras obras no se tocan.`)) return;
  const { data, error } = await sb.from('participaciones').delete().eq('id', id).select('id');
  if(error) return aviso('No se pudo quitar: ' + error.message, true);
  if(!data?.length) return aviso(SIN_EFECTO, true);
  aviso('Quitado de la obra');
  await cargarDatos();
}

function formInversor(id){
  const i = id ? D.inversores.find(x=>x.id===id) : null;
  const enObras = i ? D.participaciones.filter(p=>p.inversor_id===i.id)
    .map(p=>D.obras.find(o=>o.id===p.obra_id)?.nombre).filter(Boolean) : [];
  modal(i ? 'Datos del inversor' : 'Nuevo inversor', `
    <div class="campo ancho"><label for="n">Nombre</label>
      <input id="n" value="${i?esc(i.nombre):''}" placeholder="Nombre o razón social"></div>
    <div class="campo"><label for="cu">CUIT</label><input id="cu" value="${i?esc(i.cuit||''):''}"></div>
    <div class="campo"><label for="em">Email</label><input id="em" type="email" value="${i?esc(i.email||''):''}"></div>
    <div class="campo ancho"><span class="ayuda">${enObras.length
      ? `Participa en: ${esc(enObras.join(', '))}. El capital suscripto de cada obra se edita desde la obra.`
      : 'El capital suscripto se carga al sumarlo a una obra.'}</span></div>`,
    async ()=>{
      if(!val('n')) return err('Poné un nombre.');
      const datos = { nombre:val('n'), cuit:val('cu'), email:val('em') };
      cerrar();
      await guardar('inversores', datos, i?.id);
    });
}

function formCaja(id){
  const c = id ? D.cajas.find(x=>x.id===id) : null;
  const usos = c ? D.comprobantes.filter(g=>g.caja_id===c.id).length
                 + D.aportes.filter(a=>a.caja_id===c.id).length : 0;
  modal(c ? 'Editar caja' : 'Agregar caja', `
    <div class="campo ancho"><label for="n">Nombre</label>
      <input id="n" value="${c?esc(c.nombre):''}" placeholder="Refuerzo hormigón"></div>
    <div class="campo ancho"><label for="d">Detalle</label>
      <input id="d" value="${c?esc(c.detalle||''):''}" placeholder="Opcional"></div>
    ${c ? `<div class="campo ancho"><span class="ayuda">${usos
      ? `Tiene ${usos} movimiento${usos===1?'':'s'}. Se puede renombrar, no eliminar.`
      : 'Sin movimientos.'}</span>
      ${usos||!esAdmin() ? '' : `<button class="btn sec" style="margin-top:8px"
        onclick="cerrar();borrar('cajas','${c.id}')">Eliminar esta caja</button>`}</div>` : ''}`,
    async ()=>{
      if(!val('n')) return err('Poné un nombre.');
      const datos = c ? { nombre:val('n'), detalle:val('d') }
                      : { obra_id:obraActiva, nombre:val('n'), detalle:val('d') };
      cerrar();
      await guardar('cajas', datos, c?.id);
    });
}

function renombrarGrupo(actual){
  modal('Renombrar grupo', `
    <div class="campo ancho"><label for="gr-nombre">Nombre del grupo</label>
      <input id="gr-nombre" value="${esc(actual)}"></div>
    <div class="campo ancho"><span class="ayuda">Cambia en todos los rubros del grupo,
      en todas las obras. Los movimientos ya cargados no se tocan.</span></div>`,
    async ()=>{
      const nuevo = val('gr-nombre');
      if(!nuevo) return err('Poné un nombre.');
      if(nuevo === actual) return cerrar();
      cerrar();
      const { data, error } = await sb.from('rubros').update({ grupo:nuevo }).eq('grupo', actual).select('id');
      if(error) return aviso('No se pudo renombrar: ' + error.message, true);
      if(!data?.length) return aviso(SIN_EFECTO, true);
      aviso('Grupo renombrado');
      await cargarDatos();
    });
}

function nuevoGrupo(){
  modal('Agregar grupo', `
    <div class="campo ancho"><label for="gr-nuevo">Nombre del grupo</label>
      <input id="gr-nuevo" placeholder="Instalaciones especiales"></div>
    <div class="campo ancho"><label for="gr-rubro">Primer rubro del grupo</label>
      <input id="gr-rubro" placeholder="Ascensores"></div>
    <div class="campo ancho"><label for="gr-base">Integra la base de honorarios</label>
      <select id="gr-base"><option value="si">Sí</option><option value="no">No</option></select>
      <span class="ayuda">Un grupo existe mientras tenga al menos un rubro.</span></div>`,
    async ()=>{
      const grupo = val('gr-nuevo'), nombre = val('gr-rubro');
      if(!grupo)  return err('Poné el nombre del grupo.');
      if(!nombre) return err('Poné al menos un rubro para el grupo.');
      cerrar();
      await guardar('rubros', { grupo, nombre, base_honorarios: val('gr-base')==='si',
        orden: (D.rubros.reduce((m,r)=>Math.max(m,r.orden||0),0)) + 10 });
    });
}

function formRubro(id){
  const r = id ? D.rubros.find(x=>x.id===id) : null;
  const grupos = [...new Set(D.rubros.map(x=>x.grupo))];
  const usos = r ? D.comprobantes.filter(g=>g.rubro_id===r.id).length : 0;
  modal(r ? 'Editar rubro' : 'Agregar rubro', `
    <div class="campo ancho"><label for="n">Nombre del rubro</label>
      <input id="n" value="${r?esc(r.nombre):''}" placeholder="Ascensores"></div>
    <div class="campo"><label for="g">Grupo</label><select id="g" onchange="tglGrupoNuevo()">
      ${grupos.map(g=>`<option ${r&&r.grupo===g?'selected':''}>${esc(g)}</option>`).join('')}
      <option value="__nuevo">— Grupo nuevo —</option></select></div>
    <div class="campo" id="wrap-grupo" style="display:none">
      <label for="g-nuevo">Nombre del grupo nuevo</label><input id="g-nuevo"></div>
    <div class="campo"><label for="b">Integra la base de honorarios</label>
      <select id="b"><option value="si" ${!r||r.base_honorarios?'selected':''}>Sí</option>
      <option value="no" ${r&&!r.base_honorarios?'selected':''}>No</option></select></div>
    ${r ? `<div class="campo ancho"><span class="ayuda">${usos
      ? `Tiene ${usos} comprobante${usos===1?'':'s'} imputado${usos===1?'':'s'}. Se puede renombrar o archivar.`
      : 'Sin comprobantes imputados.'}</span>
      ${esAdmin() ? `<button class="btn sec" style="margin-top:8px"
        onclick="cerrar();archivarRubro('${r.id}')">Archivar este rubro</button>` : ''}</div>` : ''}`,
    async ()=>{
      if(!val('n')) return err('Poné un nombre.');
      const grupo = val('g') === '__nuevo' ? val('g-nuevo') : val('g');
      if(!grupo) return err('Poné el nombre del grupo.');
      const datos = { nombre:val('n'), grupo, base_honorarios: val('b')==='si' };
      cerrar();
      await guardar('rubros', datos, r?.id);
    });
  tglGrupoNuevo();
}
function tglGrupoNuevo(){
  const g = document.getElementById('g'), w = document.getElementById('wrap-grupo');
  if(g&&w) w.style.display = g.value === '__nuevo' ? '' : 'none';
}
async function archivarRubro(id){
  if(!confirm('El rubro deja de aparecer al cargar, pero los movimientos históricos se conservan. ¿Seguir?')) return;
  await guardar('rubros', { activo:false }, id);
}

function nuevaObra(){
  modal('Agregar obra', `<div class="campo ancho"><label for="n">Nombre de la obra</label>
    <input id="n" placeholder="Edificio Fideicomiso San Lorenzo 2634"></div>`,
    async ()=>{
      if(!val('n')) return err('Poné un nombre.');
      const nombre = val('n'); cerrar();
      const { data, error } = await sb.rpc('nueva_obra', { p_nombre: nombre });
      if(error) return aviso('No se pudo crear: ' + error.message, true);
      obraActiva = data; aviso('Obra creada'); await cargarDatos();
    });
}
function renombrarObra(){
  const o = obra();
  modal('Renombrar obra', `<div class="campo ancho"><label for="n">Nombre de la obra</label>
    <input id="n" value="${esc(o.nombre)}"></div>`,
    async ()=>{
      if(!val('n')) return err('El nombre no puede quedar vacío.');
      const nombre = val('n'); cerrar();
      await guardar('obras', { nombre }, o.id);
    });
}
async function eliminarObra(){
  const o = obra();
  const n = gastosDe(o.id).length + aportesDe(o.id).length;
  if(!confirm(`"${o.nombre}" tiene ${n} movimiento${n===1?'':'s'}. Se borra todo. ¿Seguir?`)) return;
  const { data, error } = await sb.from('obras').delete().eq('id', o.id).select('id');
  if(error) return aviso('No se pudo eliminar: ' + error.message, true);
  if(!data?.length) return aviso(SIN_EFECTO, true);
  obraActiva = null; aviso('Obra eliminada'); await cargarDatos();
}

/* ---------- avance ---------- */
function formAvance(){
  const o = obra();
  modal('Cargar foto de avance', `
    <div class="lector" id="lector">
      <label for="foto-av">Fotografía</label>
      <input id="foto-av" type="file" accept="image/*" capture="environment">
      <span class="ayuda">Se guarda en el sistema y aparece en la rendición al inversor.</span>
    </div>
    <div class="campo"><label for="f">Fecha</label><input id="f" type="date" value="${hoy()}"></div>
    <div class="campo"><label for="pc">Avance declarado %</label>
      <input id="pc" type="number" min="0" max="100" step="1" placeholder="Opcional"></div>
    <div class="campo ancho"><label for="ti">Título</label>
      <input id="ti" placeholder="Hormigonado de losa del primer piso"></div>
    <div class="campo ancho"><label for="de">Descripción</label>
      <input id="de" placeholder="Opcional"></div>`,
    async ()=>{
      const f = document.getElementById('foto-av').files?.[0];
      if(!f) return err('Elegí una foto.');
      document.getElementById('ok').disabled = true;
      err('Subiendo la foto…');
      const ruta = await subirArchivo('avance', f, o.id);
      if(!ruta){ document.getElementById('ok').disabled = false; return err('No se pudo subir la foto.'); }
      const datos = { obra_id:o.id, fecha:val('f'), titulo:val('ti'),
        descripcion:val('de'), pct_avance: val('pc') ? parseFloat(val('pc')) : null,
        archivo: ruta, creado_por: perfil.id };
      cerrar();
      await guardar('avances', datos);
    });
}

/* ---------- archivos ---------- */
let archivoPendiente = null;

async function subirArchivo(bucket, file, obraId){
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const ruta = `${obraId}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
  const { error } = await sb.storage.from(bucket).upload(ruta, file, { upsert:false });
  if(error){ aviso('No se pudo subir el archivo: ' + error.message, true); return null; }
  return `${bucket}/${ruta}`;
}
async function verArchivo(ruta){
  const i = ruta.indexOf('/');
  const { data, error } = await sb.storage.from(ruta.slice(0,i))
    .createSignedUrl(ruta.slice(i+1), 300);
  if(error) return aviso('No se pudo abrir el archivo.', true);
  window.open(data.signedUrl, '_blank', 'noopener');
}
async function pintarFotos(){
  for(const img of document.querySelectorAll('img[data-ruta]')){
    const ruta = img.dataset.ruta;
    if(!ruta || img.src) continue;
    const i = ruta.indexOf('/');
    const { data } = await sb.storage.from(ruta.slice(0,i))
      .createSignedUrl(ruta.slice(i+1), 600);
    if(data) img.src = data.signedUrl;
  }
}
new MutationObserver(() => { if(vista==='avance') pintarFotos(); })
  .observe(document.getElementById('cuerpo'), { childList:true });

/* ---------- lectura del comprobante ---------- */
async function leerComprobante(input){
  const f = input.files?.[0]; if(!f) return;
  const box = document.getElementById('lector'), est = document.getElementById('foto-estado');
  if(f.size > 8*1024*1024){ est.textContent = 'La imagen pesa demasiado. Probá con una más liviana.'; return; }
  archivoPendiente = f;
  box.classList.add('leyendo');
  est.textContent = 'Leyendo el comprobante…';
  try{
    const b64 = await new Promise((res,rej)=>{
      const r = new FileReader();
      r.onload = ()=>res(r.result.split(',')[1]);
      r.onerror = ()=>rej(new Error('lectura'));
      r.readAsDataURL(f);
    });
    const { data, error } = await sb.functions.invoke('leer-comprobante', {
      body: { archivo: b64, tipo: f.type, rubros: D.rubros.map(r=>r.nombre) }
    });
    if(error) throw error;
    if(data.error) throw new Error(data.error);

    const set = (id,v) => { if(v!=null && v!=='') document.getElementById(id).value = v; };
    set('f', data.fecha); set('prov', data.proveedor); set('cuit', data.cuit);
    set('nro', data.nro); set('det', data.detalle); set('imp', data.importe);
    set('neto', data.neto); set('iva', data.iva); set('perc', data.percepciones);
    if(data.tipo){ const s=document.getElementById('tipo');
      [...s.options].forEach(op => { if(op.text===data.tipo) s.value = op.value||op.text; }); }
    if(data.moneda){ document.getElementById('mon').value = data.moneda; tglCotiz(); }
    if(data.rubro){ const rr = D.rubros.find(x=>x.nombre===data.rubro);
      if(rr) document.getElementById('rub').value = rr.id; }
    if(data.aviso) console.warn(data.aviso);
    const faltan = ['proveedor','importe','fecha'].filter(k=>!data[k]);
    est.textContent = faltan.length
      ? `Leí el comprobante pero no saqué: ${faltan.join(', ')}. Completalo a mano.`
      : (data.aviso || 'Listo. Revisá el rubro y el importe. La imagen se guarda con el asiento.');
    calcularIva();
  }catch(e){
    est.textContent = 'No pude leer el comprobante, pero la imagen se guarda igual. Cargá los datos a mano.';
  }
  box.classList.remove('leyendo');
}

/* ---------- exportaciones ---------- */
/* Excel de verdad: una hoja por tabla y los números como números.
   Si la librería no cargó, cae en CSV para no dejar al usuario sin nada. */
function bajarExcel(hojas, nombre){
  if(!window.XLSX){
    const todo = [];
    hojas.forEach((h,i) => { if(i) todo.push([]); todo.push([h.nombre]); todo.push(...h.filas); });
    bajarCsv(todo, nombre + '.csv');
    aviso('Se descargó en CSV: no se pudo cargar el generador de Excel.', true);
    return;
  }
  const libro = XLSX.utils.book_new();
  hojas.forEach(h => {
    const hoja = XLSX.utils.aoa_to_sheet(h.filas);
    hoja['!cols'] = (h.filas[0]||[]).map((_,i) => ({
      wch: Math.min(38, Math.max(11, ...h.filas.map(f => String(f[i] ?? '').length + 2)))
    }));
    XLSX.utils.book_append_sheet(libro, hoja, h.nombre.slice(0,31));
  });
  XLSX.writeFile(libro, nombre + '.xlsx');
}

function bajarCsv(filas, nombre){
  const q = s => `"${String(s??'').replace(/"/g,'""')}"`;
  const csv = '\ufeff' + filas.map(f=>f.map(q).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.download = nombre; a.click(); URL.revokeObjectURL(a.href);
}
function exportarComprobantes(){
  const o = obra();
  const num = v => Math.round((+v||0)*100)/100;
  const filas = [['Fecha','Caja','Grupo','Rubro','Proveedor','CUIT','Tipo','Numero','Detalle',
                  'Moneda','Neto','IVA','Percepciones','Importe','Cotizacion','Importe USD',
                  'Estado','Fecha de pago','Tratamiento','Computa honorarios']];
  const gs = gastosDe(o.id).slice().sort((a,b)=>a.fecha.localeCompare(b.fecha));
  gs.forEach(g=>{
    const r = rubro(g.rubro_id);
    filas.push([g.fecha, caja(g.caja_id)?.nombre || '', r?.grupo || '', r?.nombre || '',
      g.proveedor, g.cuit, g.tipo, g.numero, g.detalle, g.moneda,
      num(g.neto), num(g.iva), num(g.percepciones), num(g.importe),
      num(g.cotizacion), num(g.usd), g.pago, g.fecha_pago || '',
      soloInfo(g) ? 'informativo' : 'costo de obra',
      g.computa_honorarios === false ? 'no' : 'si']);
  });
  if(gs.length) filas.push(['Total','','','','','','','','','','','','',
    '','', num(gs.filter(computa).reduce((s,g)=>s+ +g.usd,0)),'','','','']);
  bajarExcel([{ nombre:'Comprobantes', filas }],
    `comprobantes-${o.nombre.replace(/\s+/g,'-').toLowerCase()}`);
}
function exportarContador(){
  const o = obra();
  const num = v => Math.round((+v||0)*100)/100;

  /* Compras: comprobantes fiscales del período */
  const compras = [['Fecha','Proveedor','CUIT','Tipo','Numero','Rubro','Detalle','Moneda',
                    'Neto','IVA','Percepciones','Total','Cotizacion','Total USD',
                    'Estado','Tratamiento']];
  const gs = gastosDe(o.id).filter(g=>esFiscal(g)&&enPeriodo(g))
    .sort((a,b)=>a.fecha.localeCompare(b.fecha));
  gs.forEach(g => compras.push([g.fecha, g.proveedor, g.cuit, g.tipo, g.numero,
    rubro(g.rubro_id)?.nombre || '', g.detalle, g.moneda,
    num(g.neto), num(g.iva), num(g.percepciones), num(g.importe),
    num(g.cotizacion), num(g.usd), g.pago,
    soloInfo(g) ? 'informativo' : 'costo de obra']));
  if(gs.length) compras.push(['Total','','','','','','','',
    num(gs.reduce((s,g)=>s+ +g.neto,0)), num(gs.reduce((s,g)=>s+ +g.iva,0)),
    num(gs.reduce((s,g)=>s+ +g.percepciones,0)), '', '',
    num(gs.reduce((s,g)=>s+ +g.usd,0)), '', '']);

  /* Ventas del período */
  const ventas = [['Fecha','Tipo','Numero','CAE','Comprador','CUIT','Unidad','Concepto',
                   'Moneda','Neto','IVA','Total','Cotizacion','Total USD','Cobro']];
  ventasDe(o.id).filter(enPeriodo).sort((a,b)=>a.fecha.localeCompare(b.fecha))
    .forEach(v => ventas.push([v.fecha, v.tipo, v.numero, v.cae, v.cliente, v.cuit,
      v.unidad, v.concepto, v.moneda, num(v.neto), num(v.iva), num(v.importe),
      num(v.cotizacion), num(v.usd), v.cobro]));

  /* Aportes por clase */
  const cl = clasesDe(o.id);
  const aportes = [['Fecha','Mes','Inversor','Clase','Unidad','Moneda',
                    'Importe','Cotizacion','Importe USD']];
  aportesDe(o.id).filter(enPeriodo).sort((a,b)=>a.fecha.localeCompare(b.fecha))
    .forEach(a => aportes.push([a.fecha, mesDe(a.fecha), inv(a.inversor_id)?.nombre || '',
      cl[a.clase==='B'?'B':'A'].nombre, a.unidad, a.moneda,
      num(a.importe), num(a.cotizacion), num(a.usd)]));

  /* Resumen del período */
  const porTipo = {};
  gs.forEach(g => { const k = esImpuesto(g)&&!TIPOS_FISCALES.includes(g.tipo)
    ? 'Impuestos y tasas' : g.tipo;
    porTipo[k] = porTipo[k] || { total:0, neto:0, iva:0, perc:0 };
    const f = +g.importe ? +g.usd / +g.importe : 0;
    porTipo[k].total += +g.usd;
    porTipo[k].neto  += (+g.neto||0)*f;
    porTipo[k].iva   += (+g.iva||0)*f;
    porTipo[k].perc  += (+g.percepciones||0)*f; });

  const resumen = [
    ['Obra', o.nombre],
    ['Período', nombrePeriodo()],
    ['Emitido', hoy()],
    [],
    ['Compras por tipo de comprobante (en USD)'],
    ['Tipo','Neto','IVA','Percepciones','Total']
  ];
  Object.entries(porTipo).forEach(([k,v]) =>
    resumen.push([k, num(v.neto), num(v.iva), num(v.perc), num(v.total)]));
  resumen.push([], ['Aportes por clase (en USD)'], ['Clase','Cantidad','Importe']);
  ['A','B'].forEach(letra => {
    const ap = aportesDe(o.id).filter(enPeriodo).filter(a=>(a.clase==='B'?'B':'A')===letra);
    resumen.push([cl[letra].nombre, ap.length, num(ap.reduce((s,a)=>s+ +a.usd,0))]);
  });
  const vs = ventasDe(o.id).filter(enPeriodo);
  if(vs.length) resumen.push([], ['Ventas del período (en USD)'],
    ['Comprobantes', vs.length], ['Total', num(vs.reduce((s,v)=>s+ +v.usd,0))]);

  const hojas = [{ nombre:'Resumen', filas:resumen }, { nombre:'Compras', filas:compras }];
  if(ventas.length > 1)  hojas.push({ nombre:'Ventas',  filas:ventas });
  if(aportes.length > 1) hojas.push({ nombre:'Aportes', filas:aportes });

  bajarExcel(hojas,
    `contable-${o.nombre.replace(/\s+/g,'-').toLowerCase()}-${contDesde||'inicio'}-${contHasta||'hoy'}`);
}

/* Los manejadores en línea del HTML se resuelven contra el ámbito global. */
Object.assign(window, { verObra, verTab, setCotiz, setTcRef, tglAfecta, setCalc, calcularIva, setRango,
  autoProveedor, setFiltro, limpiarFiltros,
  cargarUsuarios, formUsuario, tglModoUsuario, cambiarRol, vincularInversor,
  descargarRespaldo, descargarFotos, formDocumento, tiposDeCategoria,
  cargarHistorial, formCierre, reabrirCierre,
  formParticipacion, tglNuevoInversor, quitarDeObra, formInversor,
  formVenta, tglCotizVenta, tglCobro, exportarVentas,
  abrirVenta, formPlan, recalcPlan, cobrarCuota, revertirCuota, tglModalidad,
  formEnlace, copiarEnlace, bajaEnlace,
  formIndice,
  formFicha, interpretarFicha, sumarM2, formAnalisis, formNivel,
  formUnidad, asignarUnidad, tglAsignar, exportarUnidades,
  renombrarGrupo, nuevoGrupo, tglGrupoNuevo,
  renombrarUsuario, recuperarClave, eliminarUsuario, setMesContador, setInvRendicion,
  setPresu, setPctHon, setClase, borrar, cerrar, salir, traerCotizacion,
  formGasto, formAporte, formInversor, formCaja, formRubro, formAvance,
  nuevaObra, renombrarObra, eliminarObra, marcarPagado, archivarRubro,
  leerComprobante, verArchivo, tglCotiz, tglPago,
  exportarComprobantes, exportarContador });

document.addEventListener('keydown', e => { if(e.key==='Escape') cerrar(); });
