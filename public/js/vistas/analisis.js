/* =====================================================================
   vistas/analisis.js
   Pestaña Análisis económico (anteproyecto)

   Script clásico: comparte el ámbito global con los demás archivos de
   js/. El orden de carga está en index.html (ver js/README.md).
   ===================================================================== */
/* ---------- Análisis económico ---------- */
const m2f = v => (+v||0).toLocaleString('es-AR',{maximumFractionDigits:2}) + ' m²';

function vAnalisis(o){
  const c = computo(o.id);
  const a = analisisDe(o.id);
  const ns = nivelesDe(o.id);

  if(!a){
    return `<div class="vacio" style="text-align:left">
      <strong>Análisis económico del anteproyecto.</strong>
      <p style="font-size:12.5px;color:var(--gris);margin:6px 0 12px">
        Cargá el costo del metro cubierto, los coeficientes de incidencia de cada tipo
        de superficie y los indirectos. Después las superficies por nivel.
        De ahí sale el costo por metro vendible proyectado.</p>
      ${puedeEditar()?`<button class="btn" onclick="formAnalisis()">Configurar el análisis</button>`:''}
    </div>`;
  }

  const t = totalesObra(o.id);
  const real = c && c.vendible ? t.egr / c.vendible : 0;

  return `
  ${puedeEditar()?`<div class="acciones">
    <button class="btn sec" onclick="formAnalisis()">Parámetros</button>
    <button class="btn" onclick="formNivel()">Agregar nivel</button>
    <button class="btn sec" onclick="window.print()">Imprimir</button>
  </div>`:''}

  <div class="reporte">
    <div class="rep-cabeza">
      <h2>${esc(o.nombre)}</h2>
      <p>Análisis económico del anteproyecto${a.zona?` · ${esc(a.zona)}`:''}</p>
      <p class="pct">Costo del metro cubierto ${fmtUsd(a.costo_m2_base)}
        ${a.plazo_meses?` · plazo ${a.plazo_meses} meses`:''}
        ${a.terreno_ancho&&a.terreno_largo
          ? ` · terreno ${a.terreno_ancho} × ${a.terreno_largo} = ${m2f(a.terreno_ancho*a.terreno_largo)}`:''}</p>
    </div>

    <h3>Superficies por nivel</h3>
    ${ns.length ? `<table><thead><tr><th>Nivel</th>
      <th class="der ocultar-chico">Coch. SS</th><th class="der ocultar-chico">Coch. PB</th>
      <th class="der">Cubierta</th><th class="der">Semi</th>
      <th class="der">Comunes</th><th class="der ocultar-chico">Terrazas</th>
      <th class="der">Unid.</th><th></th></tr></thead><tbody>
      ${ns.map(n=>`<tr><td>${esc(n.nombre)}</td>
        <td class="der num ocultar-chico">${+n.coch_ss||'—'}</td>
        <td class="der num ocultar-chico">${+n.coch_pb||'—'}</td>
        <td class="der num">${+n.cubierta||'—'}</td>
        <td class="der num">${+n.semicubierta||'—'}</td>
        <td class="der num">${+n.comun||'—'}</td>
        <td class="der num ocultar-chico">${+n.terraza||'—'}</td>
        <td class="der num">${+n.unidades||'—'}</td>
        <td class="der no-imprimir">${puedeEditar()?`<button class="link" onclick="formNivel('${n.id}')">Editar</button>`:''}</td>
      </tr>`).join('')}
      <tr><td><strong>Total</strong></td>
        ${['coch_ss','coch_pb','cubierta','semicubierta','comun','terraza'].map((k,i)=>
          `<td class="der num ${i<2||i===5?'ocultar-chico':''}"><strong>${
            ns.reduce((s,n)=>s+ +n[k]||0,0).toLocaleString('es-AR',{maximumFractionDigits:2})||'—'}</strong></td>`).join('')}
        <td class="der num"><strong>${ns.reduce((s,n)=>s+ +n.unidades||0,0)||'—'}</strong></td><td></td></tr>
    </tbody></table>` : `<div class="vacio">Todavía no hay niveles cargados.</div>`}

    ${c ? `
    <h3>Costo de construcción</h3>
    <table><thead><tr><th>Concepto</th><th class="der">m²</th><th class="der">Incidencia</th>
      <th class="der">U$S/m²</th><th class="der">Total</th></tr></thead><tbody>
      ${c.lineas.filter(l=>l.m2).map(l=>`<tr><td>${esc(l.nombre)}</td>
        <td class="der num">${l.m2.toLocaleString('es-AR',{maximumFractionDigits:2})}</td>
        <td class="der num">${fmtPct(l.coef*100)}</td>
        <td class="der num">${fmtUsd(l.costoM2)}</td>
        <td class="der num">${fmtUsd(l.total)}</td></tr>`).join('')}
      <tr><td colspan="4"><strong>Costo de construcción neto</strong></td>
        <td class="der num"><strong>${fmtUsd(c.construccion)}</strong></td></tr>
    </tbody></table>

    <h3>Terreno e indirectos</h3>
    <table><thead><tr><th>Concepto</th><th>Base</th><th class="der">Importe</th></tr></thead><tbody>
      ${c.indirectos.map(([n,v,base])=>`<tr><td>${esc(n)}</td>
        <td><span class="pct">${esc(base)}</span></td>
        <td class="der num">${fmtUsd(v)}</td></tr>`).join('')}
      <tr><td colspan="2"><strong>Costo total del emprendimiento</strong></td>
        <td class="der num"><strong>${fmtUsd(c.total)}</strong></td></tr>
    </tbody></table>

    <h3>Incidencia en el metro vendible</h3>
    <table><thead><tr><th>Componente</th><th class="der">Importe</th>
      <th class="der">U$S por m² vendible</th><th class="der">Participación</th>
      </tr></thead><tbody>
      ${c.desglose.map(([n,v,x])=>`<tr><td>${esc(n)}</td>
        <td class="der num">${fmtUsd(v)}</td>
        <td class="der num">${fmtUsd2(x)}</td>
        <td class="der num">${fmtPct(v/c.total*100)}</td></tr>`).join('')}
      <tr><td><strong>Costo por m² vendible</strong></td>
        <td class="der num"><strong>${fmtUsd(c.total)}</strong></td>
        <td class="der num"><strong>${fmtUsd2(c.porVendible)}</strong></td>
        <td class="der num">100,0%</td></tr>
      <tr><td>Sobre el total construido <span class="pct">${m2f(c.totalM2)}</span></td>
        <td class="der">—</td>
        <td class="der num">${fmtUsd2(c.porTotal)}</td><td class="der">—</td></tr>
    </tbody></table>
    <p class="sub">El terreno y los indirectos se prorratean sobre los metros vendibles,
    igual que la construcción. Por eso el costo final del metro los incluye.</p>

    ${(() => {
      const us = cuadroUnidades(o.id);
      if(!us.length) return '';
      const vend = us.filter(f=>f.u.estado==='vendida');
      const asig = us.filter(f=>['asignada','reservada'].includes(f.u.estado));
      return `<h3>Unidades</h3>
      <table><thead><tr><th>Unidad</th><th class="der">Superficie</th>
        <th class="der">Coef.</th><th class="der">Porcentual</th>
        <th class="der">Costo asignado</th><th>Situación</th></tr></thead><tbody>
        ${us.map(f=>`<tr><td>${esc(f.u.codigo)}</td>
          <td class="der num">${f.superficie.toLocaleString('es-AR',{maximumFractionDigits:2})} m²</td>
          <td class="der num">${(+f.u.coeficiente).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
          <td class="der num">${fmtPct(f.porcentual)}</td>
          <td class="der num">${fmtUsd(c.total*f.porcentual/100)}</td>
          <td>${(ESTADO_UNIDAD[f.u.estado]||[''])[0]}
            ${f.u.inversor_id?`<br><span class="pct">${esc(inv(f.u.inversor_id)?.nombre||'')}</span>`:''}
            ${f.u.venta_id?`<br><span class="pct">${esc(D.ventas.find(v=>v.id===f.u.venta_id)?.cliente||'')}</span>`:''}</td>
        </tr>`).join('')}
        <tr><td><strong>Total</strong></td>
          <td class="der num"><strong>${us.reduce((s,f)=>s+f.superficie,0).toLocaleString('es-AR',{maximumFractionDigits:2})} m²</strong></td>
          <td></td><td class="der num"><strong>100,0%</strong></td>
          <td class="der num"><strong>${fmtUsd(c.total)}</strong></td>
          <td><span class="pct">${vend.length} vendida${vend.length===1?'':'s'} · ${asig.length} asignada${asig.length===1?'':'s'}</span></td></tr>
      </tbody></table>`;
    })()}

    <h3>Resultado</h3>
    <div class="fila">
      <div class="kpi"><p class="r">Vendible</p><p class="v num">${m2f(c.vendible)}</p>
        <p class="s">${c.totalM2?fmtPct(c.vendible/c.totalM2*100):''} del total</p></div>
      <div class="kpi"><p class="r">Comunes</p><p class="v num">${m2f(c.comunes)}</p>
        <p class="s">${c.totalM2?fmtPct(c.comunes/c.totalM2*100):''} del total</p></div>
      <div class="kpi"><p class="r">Costo por m² vendible</p>
        <p class="v num">${fmtUsd(c.porVendible)}</p>
        <p class="s">proyectado</p></div>
      ${real?`<div class="kpi ${real>c.porVendible?'alerta':''}">
        <p class="r">Ejecutado por m² vendible</p><p class="v num">${fmtUsd(real)}</p>
        <p class="s">${fmtUsd(t.egr)} gastados a hoy</p></div>`:''}
      ${c.unidades?`<div class="kpi"><p class="r">Por unidad</p>
        <p class="v num">${fmtUsd(c.total/c.unidades)}</p>
        <p class="s">${c.unidades} unidades</p></div>`:''}
    </div>` : ''}
  </div>`;
}

function formAnalisis(){
  const o = obra(), a = analisisDe(o.id) || {};
  const n = (id, et, v, paso='0.01') =>
    `<div class="campo"><label for="${id}">${et}</label>
      <input id="${id}" type="number" step="${paso}" value="${v ?? ''}"></div>`;
  modal('Parámetros del análisis', `
    <div class="campo ancho"><label for="an-zona">Zona</label>
      <input id="an-zona" value="${esc(a.zona||'')}" placeholder="Pichincha, Rosario"></div>
    ${n('an-base','Costo del m² cubierto U$S', a.costo_m2_base, '1')}
    ${n('an-plazo','Plazo en meses', a.plazo_meses, '1')}
    ${n('an-terreno','Costo del terreno U$S', a.costo_terreno, '100')}
    ${n('an-ancho','Ancho del terreno m', a.terreno_ancho)}
    ${n('an-largo','Largo del terreno m', a.terreno_largo)}
    <div class="campo ancho"><span class="ayuda"><strong>Coeficientes de incidencia</strong>
      sobre el costo del metro cubierto. 1 es el cubierto pleno.</span></div>
    ${n('an-cochss','Cocheras subsuelo', a.coef_coch_ss ?? 0.70)}
    ${n('an-cochpb','Cocheras planta baja', a.coef_coch_pb ?? 0.40)}
    ${n('an-cub','Cubierta', a.coef_cubierta ?? 1)}
    ${n('an-semi','Semicubierta', a.coef_semicubierta ?? 0.60)}
    ${n('an-comun','Comunes', a.coef_comun ?? 0.60)}
    ${n('an-terraza','Terrazas', a.coef_terraza ?? 0.40)}
    <div class="campo ancho"><span class="ayuda"><strong>Indirectos.</strong>
      Los porcentajes se aplican sobre el costo de construcción neto,
      salvo la comisión que va sobre el terreno.</span></div>
    ${n('an-proy','Proyecto %', a.pct_proyecto ?? 3.5, '0.1')}
    ${n('an-dir','Dirección y conducción %', a.pct_direccion ?? 9, '0.1')}
    ${n('an-des','Desarrollo y gestión %', a.pct_desarrollo ?? 5, '0.1')}
    ${n('an-adm','Administración financiera %', a.pct_administracion ?? 2, '0.1')}
    ${n('an-com','Comisión inmobiliaria %', a.pct_comision ?? 3, '0.1')}
    ${n('an-esc','Escritura y fideicomiso U$S', a.gastos_escritura, '100')}
    ${n('an-mun','Gastos y permisos U$S', a.gastos_municipales, '100')}
    <div class="campo ancho"><label for="an-nota">Nota</label>
      <input id="an-nota" value="${esc(a.nota||'')}" placeholder="Opcional"></div>`,
    async ()=>{
      const num = id => { const v = val(id); return v === '' ? null : parseFloat(v); };
      const datos = { obra_id:o.id, zona:val('an-zona'),
        costo_m2_base:num('an-base')||0, plazo_meses:num('an-plazo'),
        costo_terreno:num('an-terreno')||0,
        terreno_ancho:num('an-ancho'), terreno_largo:num('an-largo'),
        coef_coch_ss:num('an-cochss')||0, coef_coch_pb:num('an-cochpb')||0,
        coef_cubierta:num('an-cub')||0, coef_semicubierta:num('an-semi')||0,
        coef_comun:num('an-comun')||0, coef_terraza:num('an-terraza')||0,
        pct_proyecto:num('an-proy')||0, pct_direccion:num('an-dir')||0,
        pct_desarrollo:num('an-des')||0, pct_administracion:num('an-adm')||0,
        pct_comision:num('an-com')||0,
        gastos_escritura:num('an-esc')||0, gastos_municipales:num('an-mun')||0,
        nota:val('an-nota'), actualizado_en:new Date().toISOString() };
      cerrar();
      const { error } = await sb.from('analisis').upsert(datos);
      if(error) return aviso('No se pudo guardar: ' + error.message, true);
      aviso('Análisis actualizado');
      await cargarDatos();
    });
}

function formNivel(id){
  const o = obra();
  const v = id ? D.niveles.find(x=>x.id===id) : {};
  const n = (campo, et) =>
    `<div class="campo"><label for="ni-${campo}">${et}</label>
      <input id="ni-${campo}" type="number" step="0.01" min="0" value="${+v[campo]||''}"></div>`;
  modal(id ? 'Editar nivel' : 'Agregar nivel', `
    <div class="campo ancho"><label for="ni-nombre">Nivel</label>
      <input id="ni-nombre" value="${esc(v.nombre||'')}" placeholder="Planta 3° Piso"></div>
    ${n('coch_ss','Cocheras subsuelo m²')}
    ${n('coch_pb','Cocheras planta baja m²')}
    ${n('cubierta','Cubierta exclusiva m²')}
    ${n('semicubierta','Semicubierta exclusiva m²')}
    ${n('comun','Comunes m²')}
    ${n('terraza','Terrazas m²')}
    <div class="campo"><label for="ni-unidades">Unidades</label>
      <input id="ni-unidades" type="number" step="1" min="0" value="${+v.unidades||''}"></div>
    <div class="campo"><label for="ni-orden">Orden</label>
      <input id="ni-orden" type="number" step="1" value="${v.orden ?? nivelesDe(o.id).length*10}"></div>
    ${id && esAdmin() ? `<div class="campo ancho">
      <button class="btn sec" onclick="cerrar();borrar('niveles','${id}')">Eliminar este nivel</button></div>`:''}`,
    async ()=>{
      if(!val('ni-nombre')) return err('Poné el nombre del nivel.');
      const num = campo => parseFloat(val('ni-'+campo))||0;
      const datos = { obra_id:o.id, nombre:val('ni-nombre'),
        coch_ss:num('coch_ss'), coch_pb:num('coch_pb'),
        cubierta:num('cubierta'), semicubierta:num('semicubierta'),
        comun:num('comun'), terraza:num('terraza'),
        unidades:parseInt(val('ni-unidades'))||0,
        orden:parseInt(val('ni-orden'))||0 };
      cerrar();
      await guardar('niveles', datos, id);
    });
}

