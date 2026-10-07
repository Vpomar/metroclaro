/* =====================================================================
   nucleo/cotizacion.js
   Cotización del dólar (dolarapi.com) y su selección

   Script clásico: comparte el ámbito global con los demás archivos de
   js/. El orden de carga está en index.html (ver js/README.md).
   ===================================================================== */
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

