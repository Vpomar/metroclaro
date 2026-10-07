/* =====================================================================
   formularios/aporte.js
   Formulario de aporte

   Script clásico: comparte el ámbito global con los demás archivos de
   js/. El orden de carga está en index.html (ver js/README.md).
   ===================================================================== */
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

