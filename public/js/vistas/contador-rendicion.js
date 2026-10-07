/* =====================================================================
   vistas/contador-rendicion.js
   Pestañas Contador y Rendición

   Script clásico: comparte el ámbito global con los demás archivos de
   js/. El orden de carga está en index.html (ver js/README.md).
   ===================================================================== */
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

