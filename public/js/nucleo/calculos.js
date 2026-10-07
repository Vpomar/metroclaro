/* =====================================================================
   nucleo/calculos.js
   Consultas sobre los datos en memoria y cálculos: unidades, CAC, cuotas, análisis, honorarios, totales, cajas, proveedores

   Script clásico: comparte el ámbito global con los demás archivos de
   js/. El orden de carga está en index.html (ver js/README.md).
   ===================================================================== */
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

