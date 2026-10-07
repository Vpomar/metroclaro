/* =====================================================================
   formularios/base.js
   Ventana modal y ayudantes de formularios

   Script clásico: comparte el ámbito global con los demás archivos de
   js/. El orden de carga está en index.html (ver js/README.md).
   ===================================================================== */
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

