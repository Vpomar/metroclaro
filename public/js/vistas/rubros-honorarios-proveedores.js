/* =====================================================================
   vistas/rubros-honorarios-proveedores.js
   Pestañas Rubros, Honorarios y Proveedores

   Script clásico: comparte el ámbito global con los demás archivos de
   js/. El orden de carga está en index.html (ver js/README.md).
   ===================================================================== */
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

