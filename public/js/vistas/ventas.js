/* =====================================================================
   vistas/ventas.js
   Pestaña Ventas: ventas de unidades, planes de cuotas y cobros

   Script clásico: comparte el ámbito global con los demás archivos de
   js/. El orden de carga está en index.html (ver js/README.md).
   ===================================================================== */
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

