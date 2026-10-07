/* =====================================================================
   nucleo/base.js
   Cliente de Supabase, estado global, formatos, fechas y avisos

   Script clásico: comparte el ámbito global con los demás archivos de
   js/. El orden de carga está en index.html (ver js/README.md).
   ===================================================================== */
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

