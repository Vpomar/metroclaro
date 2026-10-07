/* =====================================================================
   formularios/comprobante.js
   Formulario de comprobante

   Script clásico: comparte el ámbito global con los demás archivos de
   js/. El orden de carga está en index.html (ver js/README.md).
   ===================================================================== */
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

