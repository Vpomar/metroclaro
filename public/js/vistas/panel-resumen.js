/* =====================================================================
   vistas/panel-resumen.js
   Panel general, Resumen de la obra, ficha técnica y costo por metro

   Script clásico: comparte el ámbito global con los demás archivos de
   js/. El orden de carga está en index.html (ver js/README.md).
   ===================================================================== */
/* ---------- Panel: todas las obras juntas ---------- */
function vPanel(){
  const fs = D.obras.map(o => ({ o, t: totalesObra(o.id),
    cierre: cierreDe(o.id), docs: docsDe(o.id).length }));
  const sum = k => fs.reduce((s,f)=>s+f.t[k],0);

  return `
  <div class="fila">
    <div class="kpi"><p class="r">Obras activas</p><p class="v num">${fs.length}</p></div>
    <div class="kpi"><p class="r">Aportes recibidos</p><p class="v num">${fmtUsd(sum('ing'))}</p></div>
    <div class="kpi"><p class="r">Ejecutado</p><p class="v num">${fmtUsd(sum('egr'))}</p></div>
    <div class="kpi ${sum('deuda')>0?'alerta':''}"><p class="r">Deuda a proveedores</p>
      <p class="v num">${fmtUsd(sum('deuda'))}</p></div>
    <div class="kpi ${sum('neto')<0?'alerta':''}"><p class="r">Disponible neto</p>
      <p class="v num">${fmtUsd(sum('neto'))}</p></div>
  </div>

  <h3>Comparativo por obra</h3>
  ${fs.length ? `<table><thead><tr><th>Obra</th><th class="der">Presupuesto</th>
    <th class="der">Ejecutado</th><th style="width:150px" class="ocultar-chico">Avance</th>
    <th class="der">Deuda</th><th class="der">Disponible neto</th></tr></thead><tbody>
    ${fs.map(f=>{
      const pct = f.t.pres ? f.t.egr/f.t.pres*100 : 0, ex = f.t.pres && f.t.egr > f.t.pres;
      return `<tr><td><button class="link" style="font-size:13.5px;font-weight:600"
          onclick="verObra('${f.o.id}');verTab('resumen')">${esc(f.o.nombre)}</button>
        ${f.cierre?`<br><span class="pct">cerrada hasta ${fecha(f.cierre)}</span>`:''}
        ${f.docs?`<br><span class="pct">${f.docs} documento${f.docs===1?'':'s'}</span>`:''}</td>
      <td class="der num">${f.t.pres?fmtUsd(f.t.pres):'—'}</td>
      <td class="der num">${fmtUsd(f.t.egr)}</td>
      <td class="ocultar-chico"><div class="medida ${ex?'excedido':''}">
        <i style="width:${Math.min(pct,100)}%"></i></div>
        <p class="pct">${f.t.pres?fmtPct(pct):'sin presupuesto'}</p></td>
      <td class="der num" style="${f.t.deuda>0?'color:var(--rojo);font-weight:600':''}">
        ${f.t.deuda?fmtUsd(f.t.deuda):'—'}</td>
      <td class="der num" style="font-weight:600;${f.t.neto<0?'color:var(--rojo)':''}">
        ${fmtUsd(f.t.neto)}</td></tr>`;}).join('')}
    <tr><td><strong>Total</strong></td>
      <td class="der num"><strong>${fmtUsd(sum('pres'))}</strong></td>
      <td class="der num"><strong>${fmtUsd(sum('egr'))}</strong></td><td class="ocultar-chico"></td>
      <td class="der num"><strong>${fmtUsd(sum('deuda'))}</strong></td>
      <td class="der num"><strong>${fmtUsd(sum('neto'))}</strong></td></tr>
    </tbody></table>` : `<div class="vacio">No hay obras visibles.</div>`}

  <p class="sub" style="margin-top:14px">Tocá el nombre de una obra para entrar a su detalle.</p>`;
}

/* ---------- Resumen ---------- */
function vResumen(o){
  const t = totalesObra(o.id), exc = t.pres && t.egr > t.pres;
  const ults = gastosDe(o.id).filter(computa).slice().sort((a,b)=>b.fecha.localeCompare(a.fecha)).slice(0,8);
  const porRubro = D.rubros.map(r=>({r,p:presu(o.id,r.id),e:ejecutado(o.id,r.id)}))
    .filter(x=>x.p||x.e).sort((a,b)=>b.e-a.e);
  return `
  <div class="fila">
    <div class="kpi"><p class="r">Aportes integrados</p><p class="v num">${fmtUsd(t.ing)}</p>
      <p class="s">${aportesDe(o.id).length} movimientos</p></div>
    <div class="kpi"><p class="r">Ejecutado</p><p class="v num">${fmtUsd(t.egr)}</p>
      <p class="s">${fmtUsd(t.pag)} pagado${t.sinCaja?` · ${fmtUsd(t.sinCaja)} informativo aparte`:''}</p></div>
    <div class="kpi ${t.deuda>0?'alerta':''}"><p class="r">Deuda a proveedores</p>
      <p class="v num">${fmtUsd(t.deuda)}</p>
      <p class="s">${t.deuda>0?'facturas pendientes':'sin facturas pendientes'}</p></div>
    <div class="kpi ${t.neto<0?'alerta':''}"><p class="r">Disponible neto</p>
      <p class="v num">${fmtUsd(t.neto)}</p>
      <p class="s">${fmtUsd(t.saldo)} en cajas menos la deuda</p></div>
    <div class="kpi ${exc?'alerta':''}"><p class="r">Avance del presupuesto</p>
      <p class="v num">${t.pres?fmtPct(t.avance):'—'}</p>
      <p class="s">${t.pres?('sobre '+fmtUsd(t.pres)):'Cargá el presupuesto en Rubros'}</p></div>
  </div>
  ${bloqueFicha(o, t)}

  <h3>Ejecución por rubro</h3>
  ${porRubro.length ? `<table><thead><tr><th>Rubro</th><th class="der">Presupuesto</th>
    <th class="der">Ejecutado</th><th style="width:170px" class="ocultar-chico">Avance</th></tr></thead><tbody>
    ${porRubro.map(({r,p,e})=>{const pct=p?e/p*100:0,ex=p&&e>p;
      return `<tr><td>${esc(r.nombre)}</td><td class="der num">${p?fmtUsd(p):'—'}</td>
      <td class="der num" ${ex?'style="color:var(--rojo);font-weight:600"':''}>${fmtUsd(e)}</td>
      <td class="ocultar-chico"><div class="medida ${ex?'excedido':''}"><i style="width:${Math.min(pct,100)}%"></i></div>
      <p class="pct">${p?fmtPct(pct):'sin presupuesto'}</p></td></tr>`;}).join('')}
    </tbody></table>` : `<div class="vacio">Sin movimientos todavía.</div>`}
  <h3>Últimos comprobantes</h3>
  ${ults.length ? `<table><thead><tr><th>Fecha</th><th>Proveedor</th><th>Rubro</th>
    <th class="ocultar-chico">Caja</th><th class="der">Importe</th></tr></thead><tbody>
    ${ults.map(g=>`<tr><td class="num">${fecha(g.fecha)}</td><td>${esc(g.proveedor)}</td>
      <td><span class="chip">${esc(rubro(g.rubro_id)?.nombre||'—')}</span></td>
      <td class="ocultar-chico">${esc(caja(g.caja_id)?.nombre||'—')}</td>
      <td class="der num">${fmtUsd2(g.usd)}</td></tr>`).join('')}</tbody></table>`
    : `<div class="vacio">Ningún comprobante cargado.</div>`}`;
}

/* ---------- Ficha técnica y costo por metro ---------- */
function bloqueFicha(o, t){
  const c = computo(o.id);
  if(c && c.vendible) return bloqueMetro(o, t, c);

  const s = superficies(o.id);
  const f = s.f;

  if(!s.construida){
    if(!puedeEditar()) return '';
    return `<h3>Ficha técnica</h3>
      <div class="vacio" style="text-align:left">
        <strong>Falta cargar las superficies de la obra.</strong>
        <p style="font-size:12.5px;color:var(--gris);margin:6px 0 12px">
          Se completa una sola vez, al inicio. Con eso el sistema calcula el costo
          por metro cuadrado y lo va actualizando solo a medida que se carga el gasto.
          Es el número que se compara contra el mercado.</p>
        <button class="btn" onclick="formFicha()">Cargar la ficha</button>
      </div>`;
  }

  const m2 = v => v.toLocaleString('es-AR',{maximumFractionDigits:0}) + ' m²';
  const real = t.egr / s.construida;
  const proyectado = t.pres ? t.pres / s.construida : 0;
  const avance = t.pres ? t.egr / t.pres : 0;
  const alCierre = avance > 0.05 ? (t.egr / avance) / s.construida : 0;
  const porVendible = s.vendible ? t.egr / s.vendible : 0;
  const desvio = proyectado && alCierre ? (alCierre/proyectado - 1) * 100 : 0;

  const detalle = [
    ['Cubierta', s.cub], ['Semicubierta', s.semi], ['Común a construir', s.com]
  ].filter(x => x[1]);

  return `
  <h3>Costo por metro cuadrado</h3>
  <div class="fila">
    <div class="kpi"><p class="r">Total construido</p>
      <p class="v num">${m2(s.construida)}</p>
      <p class="s">${detalle.map(([n,v])=>`${n.toLowerCase()} ${m2(v)}`).join(' · ')}</p></div>
    <div class="kpi"><p class="r">Valor del m² hoy</p>
      <p class="v num">${fmtUsd(real)}</p>
      <p class="s">${fmtUsd(t.egr)} ejecutados</p></div>
    ${proyectado?`<div class="kpi"><p class="r">m² presupuestado</p>
      <p class="v num">${fmtUsd(proyectado)}</p>
      <p class="s">${fmtUsd(t.pres)} de presupuesto</p></div>`:''}
    ${alCierre?`<div class="kpi ${desvio>5?'alerta':''}"><p class="r">Proyección al cierre</p>
      <p class="v num">${fmtUsd(alCierre)}</p>
      <p class="s">${proyectado
        ? (desvio>0.5?`${fmtPct(desvio)} sobre lo previsto`
          : desvio<-0.5?`${fmtPct(-desvio)} por debajo`:'en línea con lo previsto')
        : 'al ritmo actual de gasto'}</p></div>`:''}
    ${porVendible?`<div class="kpi"><p class="r">m² vendible</p>
      <p class="v num">${fmtUsd(porVendible)}</p>
      <p class="s">sobre ${m2(s.vendible)} vendibles</p></div>`:''}
  </div>

  <table><thead><tr><th>Superficie</th><th class="der">m²</th>
    <th class="der">Participación</th><th class="der">Costo acumulado</th></tr></thead><tbody>
    ${detalle.map(([n,v])=>`<tr><td>${n}</td>
      <td class="der num">${m2(v)}</td>
      <td class="der num">${fmtPct(v/s.construida*100)}</td>
      <td class="der num">${fmtUsd(real*v)}</td></tr>`).join('')}
    <tr><td><strong>Total construido</strong></td>
      <td class="der num"><strong>${m2(s.construida)}</strong></td>
      <td class="der num">100,0%</td>
      <td class="der num"><strong>${fmtUsd(t.egr)}</strong></td></tr>
    ${s.desc?`<tr><td>Descubierta <span class="pct">no computa</span></td>
      <td class="der num">${m2(s.desc)}</td><td class="der">—</td><td class="der">—</td></tr>`:''}
    ${s.terreno?`<tr><td>Terreno <span class="pct">no computa</span></td>
      <td class="der num">${m2(s.terreno)}</td>
      <td class="der num">${fmtPct(s.construida/s.terreno*100)} de FOT</td>
      <td class="der">—</td></tr>`:''}
  </tbody></table>

  <p class="sub" style="margin-top:10px">${esc(f.descripcion||'')}
    ${f.niveles?` · ${f.niveles} nivel${f.niveles===1?'':'es'}`:''}
    ${f.subsuelos?` · ${f.subsuelos} subsuelo${f.subsuelos===1?'':'s'}`:''}
    ${f.unidades?` · ${f.unidades} unidad${f.unidades===1?'':'es'}`:''}
    ${f.cocheras?` · ${f.cocheras} cochera${f.cocheras===1?'':'s'}`:''}
    ${f.unidades && s.vendible?` · ${m2(s.vendible/f.unidades)} promedio por unidad`:''}
    ${puedeEditar()?` <button class="link" onclick="formFicha()">Editar ficha</button>`:''}</p>`;
}

function formFicha(){
  const o = obra(), f = fichaDe(o.id);
  const c = (id, etiqueta, valor, extra='') =>
    `<div class="campo"><label for="${id}">${etiqueta}</label>
      <input id="${id}" type="number" step="0.01" min="0" value="${valor??''}" ${extra}></div>`;
  modal('Ficha técnica de la obra', `
    <div class="lector" id="lector">
      <label for="fi-desc">Descripción</label>
      <input id="fi-desc" value="${esc(f.descripcion||'')}"
        placeholder="PB + 4 + terraza, 8 deptos, 2 cocheras">
      <button class="btn sec" style="align-self:flex-start" onclick="interpretarFicha()">
        Completar campos desde la descripción</button>
      <span class="ayuda" id="fi-estado">Se completa una sola vez, al inicio de la obra.
        Escribila como la describirías por teléfono y el sistema completa lo que pueda.
        Revisá siempre antes de guardar.</span>
    </div>
    ${c('fi-niveles','Niveles sobre nivel', f.niveles, 'step="1"')}
    ${c('fi-subsuelos','Subsuelos', f.subsuelos, 'step="1"')}
    ${c('fi-unidades','Unidades', f.unidades, 'step="1"')}
    ${c('fi-cocheras','Cocheras', f.cocheras, 'step="1"')}
    ${c('fi-terreno','Superficie del terreno m²', f.sup_terreno)}
    ${c('fi-cubierta','Cubierta m²', f.sup_cubierta, 'onchange="sumarM2()"')}
    ${c('fi-semi','Semicubierta m²', f.sup_semicubierta, 'onchange="sumarM2()"')}
    ${c('fi-descubierta','Descubierta m²', f.sup_descubierta)}
    ${c('fi-comun','Común a construir m²', f.sup_comun, 'onchange="sumarM2()"')}
    <div class="campo"><label>Total construido</label>
      <p id="fi-total" class="num" style="font-size:20px;font-weight:700;margin:5px 0 0">—</p>
      <span class="ayuda">Cubierta + semicubierta + común</span></div>
    <div class="campo ancho"><span class="ayuda">Cubierta, semicubierta y común suman el
      total construido, que es la base del costo por metro. La descubierta y el terreno
      quedan afuera del cálculo.</span></div>
    ${c('fi-vendible','Vendible m²', f.sup_vendible)}
    <div class="campo"><label for="fi-inicio">Inicio de obra</label>
      <input id="fi-inicio" type="date" value="${f.inicio||''}"></div>
    <div class="campo"><label for="fi-fin">Fin previsto</label>
      <input id="fi-fin" type="date" value="${f.fin_previsto||''}"></div>
    <div class="campo ancho"><label for="fi-nota">Nota</label>
      <input id="fi-nota" value="${esc(f.nota||'')}" placeholder="Opcional"></div>`,
    async ()=>{
      const num = id => { const v = val(id); return v === '' ? null : parseFloat(v); };
      const datos = { obra_id:o.id, descripcion:val('fi-desc'),
        niveles:num('fi-niveles'), subsuelos:num('fi-subsuelos'),
        unidades:num('fi-unidades'), cocheras:num('fi-cocheras'),
        sup_terreno:num('fi-terreno'), sup_cubierta:num('fi-cubierta'),
        sup_semicubierta:num('fi-semi'), sup_descubierta:num('fi-descubierta'),
        sup_comun:num('fi-comun'), sup_vendible:num('fi-vendible'),
        inicio:val('fi-inicio')||null, fin_previsto:val('fi-fin')||null,
        nota:val('fi-nota'), actualizado_en:new Date().toISOString() };
      cerrar();
      const { error } = await sb.from('fichas').upsert(datos);
      if(error) return aviso('No se pudo guardar: ' + error.message, true);
      aviso('Ficha guardada');
      await cargarDatos();
    });
  sumarM2();
}

function sumarM2(){
  const e = document.getElementById('fi-total'); if(!e) return;
  const n = id => parseFloat(val(id))||0;
  const t = n('fi-cubierta') + n('fi-semi') + n('fi-comun');
  e.textContent = t ? t.toLocaleString('es-AR',{maximumFractionDigits:0}) + ' m²' : '—';
}

async function interpretarFicha(){
  const texto = val('fi-desc');
  const est = document.getElementById('fi-estado');
  if(!texto) return est.textContent = 'Escribí primero la descripción.';
  est.textContent = 'Interpretando…';
  const { data, error } = await sb.functions.invoke('asistente', {
    body: { accion:'ficha', texto } });
  if(error || data?.error){
    est.textContent = 'No se pudo interpretar. Cargá los campos a mano.';
    return;
  }
  const mapa = { niveles:'fi-niveles', subsuelos:'fi-subsuelos', unidades:'fi-unidades',
    cocheras:'fi-cocheras', sup_terreno:'fi-terreno', sup_cubierta:'fi-cubierta',
    sup_semicubierta:'fi-semi', sup_descubierta:'fi-descubierta',
    sup_comun:'fi-comun', sup_vendible:'fi-vendible' };
  let puestos = 0;
  Object.entries(mapa).forEach(([k,id])=>{
    if(data[k] !== null && data[k] !== undefined && data[k] !== ''){
      document.getElementById(id).value = data[k]; puestos++;
    }
  });
  sumarM2();
  est.textContent = puestos
    ? `Completé ${puestos} campo${puestos===1?'':'s'}. Revisalos y corregí lo que haga falta.`
    : 'No pude sacar datos de esa descripción. Cargalos a mano.';
}

/* ---------- Costo por metro en el Resumen ---------- */
const FUERA_CONSTRUCCION = ['Previo','Honorarios'];
/* Ejecutado que es estrictamente obra, sin terreno, honorarios ni permisos */
function ejecutadoConstruccion(obraId){
  return gastosDe(obraId).filter(g => {
    if(!computa(g)) return false;
    const r = rubro(g.rubro_id);
    return r && !FUERA_CONSTRUCCION.includes(r.grupo);
  }).reduce((s,g)=>s+ +g.usd, 0);
}

function bloqueMetro(o, t, c){
  const real       = t.egr / c.vendible;
  const proyectado = c.porVendible;
  const avance     = c.total ? t.egr / c.total : 0;
  const alCierre   = avance > 0.05 ? (t.egr / avance) / c.vendible : 0;
  const desvio     = proyectado ? (real/proyectado - 1) * 100 : 0;

  const ejecConstr   = ejecutadoConstruccion(o.id);
  const constrProy   = c.construccion / c.vendible;
  const constrReal   = ejecConstr / c.vendible;
  const avanceConstr = c.construccion ? ejecConstr / c.construccion : 0;
  const constrCierre = avanceConstr > 0.05 ? (ejecConstr/avanceConstr) / c.vendible : 0;

  /* Cada componente proyectado contra lo efectivamente ejecutado */
  const ejecutadoDe = nombre => {
    if(nombre === 'Construcción') return ejecConstr;
    if(nombre === 'Terreno y comisión')
      return gastosDe(o.id).filter(g => computa(g) &&
        (rubro(g.rubro_id)?.nombre||'').toLowerCase().includes('terreno'))
        .reduce((s,g)=>s+ +g.usd,0);
    return t.egr - ejecConstr - gastosDe(o.id).filter(g => computa(g) &&
      (rubro(g.rubro_id)?.nombre||'').toLowerCase().includes('terreno'))
      .reduce((s,g)=>s+ +g.usd,0);
  };

  return `
  <h3>Costo por metro cuadrado</h3>
  <div class="fila">
    <div class="kpi"><p class="r">Proyectado por m² vendible</p>
      <p class="v num">${fmtUsd(proyectado)}</p>
      <p class="s">sobre ${m2f(c.vendible)} vendibles</p></div>
    <div class="kpi"><p class="r">Ejecutado por m² vendible</p>
      <p class="v num">${fmtUsd(real)}</p>
      <p class="s">${fmtUsd(t.egr)} gastados a hoy</p></div>
    <div class="kpi"><p class="r">Construcción proyectada</p>
      <p class="v num">${fmtUsd(constrProy)}</p>
      <p class="s">sin terreno ni honorarios</p></div>
    <div class="kpi ${constrCierre && constrCierre>constrProy*1.05?'alerta':''}">
      <p class="r">Construcción real</p><p class="v num">${fmtUsd(constrReal)}</p>
      <p class="s">${fmtUsd(ejecConstr)} de obra pura</p></div>
    <div class="kpi ${desvio>5?'alerta':''}"><p class="r">Avance económico</p>
      <p class="v num">${fmtPct(avance*100)}</p>
      <p class="s">sobre ${fmtUsd(c.total)} proyectados</p></div>
  </div>

  <table><thead><tr><th>Componente</th>
    <th class="der">Proyectado</th><th class="der">U$S/m² proyectado</th>
    <th class="der">Ejecutado</th><th class="der">U$S/m² ejecutado</th>
    <th class="der">Consumido</th></tr></thead><tbody>
    ${c.desglose.map(([n,v,x])=>{
      const e = ejecutadoDe(n);
      const pc = v ? e/v*100 : 0;
      return `<tr><td>${esc(n)}</td>
        <td class="der num">${fmtUsd(v)}</td>
        <td class="der num">${fmtUsd2(x)}</td>
        <td class="der num">${e?fmtUsd(e):'—'}</td>
        <td class="der num">${e?fmtUsd2(e/c.vendible):'—'}</td>
        <td class="der num" style="${pc>100?'color:var(--rojo);font-weight:600':''}">${fmtPct(pc)}</td>
      </tr>`;}).join('')}
    <tr><td><strong>Total por m² vendible</strong></td>
      <td class="der num"><strong>${fmtUsd(c.total)}</strong></td>
      <td class="der num"><strong>${fmtUsd2(proyectado)}</strong></td>
      <td class="der num"><strong>${fmtUsd(t.egr)}</strong></td>
      <td class="der num"><strong>${fmtUsd2(real)}</strong></td>
      <td class="der num"><strong>${fmtPct(avance*100)}</strong></td></tr>
    <tr><td>Sobre el total construido <span class="pct">${m2f(c.totalM2)}</span></td>
      <td class="der">—</td><td class="der num">${fmtUsd2(c.porTotal)}</td>
      <td class="der">—</td><td class="der num">${fmtUsd2(t.egr/c.totalM2)}</td>
      <td class="der">—</td></tr>
  </tbody></table>
  <p class="sub" style="margin-top:10px">
    ${constrCierre ? `Al ritmo actual, la construcción cerraría en ${fmtUsd2(constrCierre)} el metro
      contra ${fmtUsd2(constrProy)} proyectados. ` : ''}
    La columna de construcción excluye terreno, honorarios, impuestos y permisos:
    es el número comparable contra el mercado.
    <button class="link" onclick="verTab('analisis')">Ver el análisis completo</button></p>`;
}

