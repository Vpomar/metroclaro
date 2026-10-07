/* =====================================================================
   vistas/cajas-comprobantes.js
   Pestañas Cajas y Comprobantes

   Script clásico: comparte el ámbito global con los demás archivos de
   js/. El orden de carga está en index.html (ver js/README.md).
   ===================================================================== */
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

