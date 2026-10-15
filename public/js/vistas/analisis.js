/* =====================================================================
   vistas/analisis.js
   Pestaña Análisis económico (anteproyecto)

   Script clásico: comparte el ámbito global con los demás archivos de
   js/. El orden de carga está en index.html (ver js/README.md).
   ===================================================================== */
/* ---------- Análisis económico ---------- */
const m2f = v => (+v||0).toLocaleString('es-AR',{maximumFractionDigits:2}) + ' m²';

/* Qué análisis se está mirando. Son miradas distintas sobre la misma obra,
   así que van en un desplegable y no en pestañas aparte. */
let analisisVista = 'anteproyecto';
function setAnalisis(v){ analisisVista = v; render(); }

const ANALISIS = [
  ['anteproyecto', 'Económico del anteproyecto'],
  ['vender',       'Vender una unidad hoy']
];

function selectorAnalisis(){
  return `<div class="acciones no-imprimir">
    <label for="sel-analisis" style="font-size:11px;color:var(--gris)">Análisis</label>
    <select id="sel-analisis" onchange="setAnalisis(this.value)"
      style="font:inherit;font-size:12.5px;padding:6px 26px 6px 9px;
        border:1px solid var(--linea-fuerte);border-radius:var(--radio);background:var(--hoja)">
      ${ANALISIS.map(([v,t]) =>
        `<option value="${v}" ${v===analisisVista?'selected':''}>${esc(t)}</option>`).join('')}
    </select>
  </div>`;
}

function vAnalisis(o){
  // Los supuestos del simulador son de una obra: al cambiar de obra vuelven a cero
  if(ventaHoy.obra !== o.id)
    ventaHoy = { obra:o.id, unidad:null, precio:null, mesVenta:null, precioFinal:null, tasaRef:8 };
  const c = computo(o.id);
  const a = analisisDe(o.id);
  const ns = nivelesDe(o.id);

  if(a && analisisVista === 'vender') return selectorAnalisis() + vVenderHoy(o, c);

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

  return selectorAnalisis() + `
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


/* =====================================================================
   Vender una unidad hoy

   Qué le hace al proyecto cobrar una unidad al contado ahora, en vez de
   venderla terminada. Pantalla interna: no va a la rendición.

   Hay tres precios y conviene no confundirlos:
     costo de la unidad  lo que consumió del emprendimiento
     piso                el costo más la parte del margen que hace falta
                         para que la tasa del inversor no baje
     valor terminado     lo que se espera cobrar al cierre
   ===================================================================== */
let ventaHoy = { obra:null, unidad:null, precio:null, mesVenta:null, precioFinal:null, tasaRef:8 };

/* El precio se recalcula al soltar el control deslizante (onchange): si se
   redibujara mientras se arrastra, el control se reemplaza y el arrastre se
   corta. Mientras tanto solo se actualiza el número (oninput). */
function setVentaHoy(campo, valor){
  const n = parseFloat(valor);
  ventaHoy[campo] = (campo === 'unidad') ? valor : (isNaN(n) ? null : n);
  if(campo === 'unidad') ventaHoy.precio = null;   // el rango cambia con la unidad
  render();
}

/* Tasa interna de retorno mensual, por bisección.
   El flujo tiene un solo cambio de signo, así que converge siempre. */
function tirMensual(flujo){
  const van = r => flujo.reduce((s,f,i) => s + f / Math.pow(1 + r, i), 0);
  if(van(0) <= 0) return null;
  let lo = 0, hi = 2;
  if(van(hi) > 0) return null;
  for(let k = 0; k < 160; k++){ const m = (lo + hi) / 2; if(van(m) > 0) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
const tirAnual = m => m === null ? null : Math.pow(1 + m, 12) - 1;

/* Curva de obra: lenta al principio, pico en el medio, baja al final.
   Reparte el costo mes a mes, que es lo que define el costo financiero. */
function curvaObra(meses){
  const p = [];
  for(let i = 0; i < meses; i++){
    const x = (i + 0.5) / meses;
    p.push(Math.exp(-Math.pow((x - 0.5) / 0.28, 2) / 2));
  }
  const s = p.reduce((a, b) => a + b, 0);
  return p.map(v => v / s);
}

/* El inversor aporta lo que se gasta y cobra al vender. Si entra plata
   hoy, cubre los egresos siguientes y por esa parte no se le pide nada. */
function flujoVenta(base, ingresoHoy, m2Resignados){
  const aportes = base.egresos.slice();
  let resto = ingresoHoy;
  for(let i = base.mesHoy; i < aportes.length && resto > 0; i++){
    const usa = Math.min(aportes[i], resto);
    aportes[i] -= usa;
    resto -= usa;
  }
  const flujo = aportes.map(a => -a);
  if(resto > 0) flujo[base.mesHoy] = (flujo[base.mesHoy] || 0) + resto;
  flujo[base.mesVenta] = (flujo[base.mesVenta] || 0) +
    (base.vendible - m2Resignados) * base.precioFinal;
  return { flujo, aportes };
}

function calcularVentaHoy(o, c){
  const us = cuadroUnidades(o.id).filter(f => f.u.estado === 'disponible');
  if(!us.length || !c || !c.total) return null;

  const elegida = us.find(f => f.u.id === ventaHoy.unidad) || us[0];
  const sup = elegida.superficie;

  const meses   = c.a.plazo_meses || 24;
  const mesHoy  = mesesDeObra(o, meses);
  const mesVenta = ventaHoy.mesVenta ?? (meses + 3);
  const precioFinal = ventaHoy.precioFinal ?? (c.porVendible ? Math.round(c.porVendible * 1.32) : 0);
  const rRef = (ventaHoy.tasaRef ?? 8) / 100;

  const egresos = new Array(Math.max(mesVenta, meses) + 1).fill(0);
  curvaObra(meses).forEach((p, i) => egresos[i] += c.total * p);

  const base = { egresos, mesHoy, mesVenta, vendible: c.vendible, precioFinal };

  const costoAsignado  = c.total * elegida.porcentual / 100;
  const valorTerminado = sup * precioFinal;

  const min = Math.max(0, Math.round(costoAsignado * 0.55 / 1000) * 1000);
  const max = Math.round(valorTerminado * 1.02 / 1000) * 1000;
  const precio = ventaHoy.precio ?? Math.round((costoAsignado + valorTerminado) / 2);

  const sin = flujoVenta(base, 0, 0);
  const con = flujoVenta(base, precio, sup);
  const tSin = tirAnual(tirMensual(sin.flujo));
  const tCon = tirAnual(tirMensual(con.flujo));

  /* Piso: el precio donde la tasa queda igual que sin vender */
  let piso = null;
  if(tSin !== null){
    let lo = 0, hi = valorTerminado * 2;
    for(let k = 0; k < 70; k++){
      const m = (lo + hi) / 2;
      const t = tirAnual(tirMensual(flujoVenta(base, m, sup).flujo));
      if(t === null || t < tSin) lo = m; else hi = m;
    }
    piso = (lo + hi) / 2;
  }

  const faltaEjecutar = egresos.slice(mesHoy).reduce((a, b) => a + b, 0);
  const aportesMenos = sin.aportes.slice(mesHoy).reduce((a, b) => a + b, 0)
                     - con.aportes.slice(mesHoy).reduce((a, b) => a + b, 0);
  let mesesCubiertos = 0, acum = 0;
  for(let i = mesHoy; i < egresos.length; i++){
    acum += egresos[i];
    if(acum <= precio) mesesCubiertos++; else break;
  }

  /* El costo que esta unidad no absorbe lo pagan las que quedan */
  const m2Restantes = c.vendible - sup;
  const costoM2Proyecto  = c.vendible ? c.total / c.vendible : 0;
  const costoM2Restantes = m2Restantes ? (c.total - precio) / m2Restantes : 0;

  /* El costo de cada unidad sale de su porcentual sobre las unidades
     cargadas: si no están todas, cada una absorbe de más */
  const supCargada = cuadroUnidades(o.id).reduce((s, f) => s + f.superficie, 0);
  const cobertura = c.vendible ? supCargada / c.vendible : 1;

  return { us, elegida, sup, meses, supCargada, cobertura, mesHoy, mesVenta, precioFinal, rRef, base,
    costoAsignado, valorTerminado, precio, min, max, tSin, tCon, piso,
    faltaEjecutar, aportesMenos, mesesCubiertos,
    costoM2Proyecto, costoM2Restantes,
    descuento: valorTerminado ? (1 - precio / valorTerminado) * 100 : 0 };
}

/* Meses transcurridos desde el inicio de obra cargado en la ficha */
function mesesDeObra(o, tope){
  const f = fichaDe(o.id);
  if(!f.inicio) return Math.min(Math.round(tope / 2), tope);
  const ini = new Date(f.inicio + 'T00:00:00');
  const hoyD = new Date(hoy() + 'T00:00:00');
  const m = (hoyD.getFullYear() - ini.getFullYear()) * 12 + (hoyD.getMonth() - ini.getMonth());
  return Math.min(Math.max(1, m), tope);
}

function vVenderHoy(o, c){
  /* Con unidades a medio cargar el porcentual miente, y con él el costo
     asignado y el piso. Mejor no mostrar números que no sirven. */
  const cob = typeof coberturaUnidades === 'function' ? coberturaUnidades(o.id) : null;
  if(cob && cob.pct < 98 && cob.cargada > 0){
    return `<div class="vacio" style="text-align:left;border-style:solid;
      border-color:var(--ambar);color:var(--ambar)">
      <strong style="color:var(--ambar)">Faltan unidades por cargar.</strong>
      Hay ${m2f(cob.cargada)} cargados contra ${m2f(cob.total)} del anteproyecto.
      Con la carga incompleta, el costo asignado de cada unidad sale mal: se reparte
      el total del emprendimiento entre las pocas que hay, y el piso de venta queda
      muy por encima del real.
      <br><br>Completalas en la solapa Unidades y volvé.
    </div>`;
  }

  const d = calcularVentaHoy(o, c);

  if(!d) return `<div class="vacio" style="text-align:left">
    <strong>Simular la venta de una unidad.</strong>
    <p style="font-size:12.5px;color:var(--gris);margin:6px 0 0">
      Hace falta el análisis del anteproyecto cargado y al menos una unidad disponible
      en la solapa Unidades, con su superficie y su coeficiente de valor.</p>
  </div>`;

  const bajoCosto = d.precio < d.costoAsignado;
  const conviene  = d.piso !== null && d.precio >= d.piso;
  const mejora    = d.tCon !== null && d.tSin !== null && d.tCon >= d.tSin;
  const ubicar = v => Math.max(0, Math.min(100, (v - d.min) / ((d.max - d.min) || 1) * 100));

  const incompleto = d.cobertura < 0.9 || d.cobertura > 1.1;

  return `
  ${incompleto ? `<div class="vacio" style="text-align:left;border-style:solid;
    border-color:var(--ambar);color:var(--tinta);margin-bottom:16px">
    <strong>Los números todavía no son confiables.</strong>
    Las unidades cargadas suman ${m2f(d.supCargada)} y el anteproyecto tiene
    ${m2f(c.vendible)} vendibles. El costo de cada unidad se reparte entre las
    unidades cargadas, así que hasta completarlas en la solapa Unidades cada una
    absorbe más (o menos) de lo que le toca.
  </div>` : ''}
  <p class="sub" style="margin-top:0">Qué le hace al proyecto cobrar una unidad al contado
  hoy, en vez de venderla terminada. Es una pantalla interna: no aparece en la rendición
  del inversor.</p>

  <h3>Supuestos</h3>
  <div class="campos no-imprimir">
    <div class="campo"><label for="vh-unidad">Unidad</label>
      <select id="vh-unidad" onchange="setVentaHoy('unidad', this.value)">
        ${d.us.map(f => `<option value="${f.u.id}" ${f.u.id === d.elegida.u.id ? 'selected' : ''}>${
          esc(f.u.codigo)} · ${m2f(f.superficie)}</option>`).join('')}
      </select></div>
    <div class="campo"><label for="vh-final">Precio terminado USD/m²</label>
      <input id="vh-final" type="number" step="50" value="${Math.round(d.precioFinal)}"
        onchange="setVentaHoy('precioFinal', this.value)">
      <span class="ayuda">lo que se espera cobrar al cierre</span></div>
    <div class="campo"><label for="vh-mes">Venta final en el mes</label>
      <input id="vh-mes" type="number" step="1" min="1" max="96" value="${d.mesVenta}"
        onchange="setVentaHoy('mesVenta', this.value)">
      <span class="ayuda">la obra va por el mes ${d.mesHoy} de ${d.meses}</span></div>
    <div class="campo"><label for="vh-tasa">Tasa de referencia anual %</label>
      <input id="vh-tasa" type="number" step="0.5" value="${(d.rRef * 100).toFixed(1)}"
        onchange="setVentaHoy('tasaRef', this.value)"></div>
  </div>

  <div class="acciones no-imprimir" style="margin:20px 0 6px;align-items:baseline">
    <label for="vh-precio" style="font-size:11px;color:var(--gris)">Precio al contado hoy</label>
    <strong class="num" id="vh-precio-txt" style="font-size:21px;font-weight:400;letter-spacing:-.04em">${fmtUsd(d.precio)}</strong>
    <span class="pct" style="margin:0">${fmtUsd2(d.precio / d.sup)} el m² ·
      ${fmtPct(d.descuento)} bajo el valor terminado</span>
  </div>
  <input id="vh-precio" type="range" min="${d.min}" max="${d.max}" step="500"
    value="${Math.round(d.precio)}" class="no-imprimir"
    oninput="document.getElementById('vh-precio-txt').textContent = fmtUsd(+this.value)"
    onchange="setVentaHoy('precio', this.value)"
    style="width:100%;accent-color:var(--naranja);margin:0">
  <div class="no-imprimir" style="position:relative;height:62px;margin-bottom:10px">
    ${[['costo de la unidad', d.costoAsignado, 'var(--rojo)'],
       ['piso', d.piso, 'var(--naranja)']].filter(m => m[1] !== null).map(([t, v, col], i, todas) => {
      // Si las dos marcas quedan cerca, la segunda baja para que no se pisen
      const cerca = i === 1 && Math.abs(ubicar(v) - ubicar(todas[0][1])) < 22;
      return `
      <div style="position:absolute;left:${ubicar(v).toFixed(2)}%;transform:translateX(-50%);
        text-align:center;white-space:nowrap">
        <div style="width:1px;height:${cerca ? 36 : 7}px;margin:0 auto 3px;background:${col}"></div>
        <span style="font-size:9.5px;color:${col}">${t}<br>${fmtUsd(v)}</span>
      </div>`; }).join('')}
  </div>

  <div class="fila" style="margin-top:28px">
    <div class="kpi"><p class="r">Piso para vender hoy</p>
      <p class="v num">${d.piso === null ? '—' : fmtUsd(d.piso)}</p>
      <p class="s">${d.piso === null ? 'el proyecto no recupera lo invertido'
        : fmtUsd2(d.piso / d.sup) + ' el m²'}</p></div>
    <div class="kpi ${mejora ? '' : 'alerta'}"><p class="r">Tasa del proyecto</p>
      <p class="v num">${d.tCon === null ? '—' : fmtPct(d.tCon * 100)}</p>
      <p class="s">contra ${d.tSin === null ? '—' : fmtPct(d.tSin * 100)} sin vender hoy</p></div>
    <div class="kpi"><p class="r">Aportes que no se piden</p>
      <p class="v num">${fmtUsd(d.aportesMenos)}</p>
      <p class="s">${d.mesesCubiertos} ${d.mesesCubiertos === 1 ? 'mes' : 'meses'} de obra cubiertos</p></div>
    <div class="kpi"><p class="r">Metros que se resignan</p>
      <p class="v num">${m2f(d.sup)}</p>
      <p class="s">valdrían ${fmtUsd(d.valorTerminado)} terminados</p></div>
    <div class="kpi ${d.costoM2Restantes <= d.costoM2Proyecto ? '' : 'alerta'}">
      <p class="r">Costo del m² que queda</p>
      <p class="v num">${fmtUsd2(d.costoM2Restantes)}</p>
      <p class="s">contra ${fmtUsd2(d.costoM2Proyecto)} del proyecto entero</p></div>
  </div>

  ${bajoCosto ? `<div class="vacio" style="text-align:left;border-color:var(--rojo);
    border-style:solid;background:var(--rojo-luz, #F9EDEA);color:var(--rojo)">
    <strong style="color:var(--rojo)">Estás vendiendo por debajo del costo de la unidad.</strong>
    Esa unidad consumió ${fmtUsd(d.costoAsignado)} del emprendimiento y entrarían
    ${fmtUsd(d.precio)}. La diferencia de ${fmtUsd(d.costoAsignado - d.precio)} la terminan
    pagando las unidades que quedan: su costo pasa de ${fmtUsd2(d.costoM2Proyecto)}
    a ${fmtUsd2(d.costoM2Restantes)} el metro.
    Se hace cuando la alternativa es frenar la obra, no para apurar una venta.
  </div>` : `<p class="sub">${conviene
    ? `A ${fmtUsd(d.precio)} conviene vender: la plata que entra hoy evita
       ${fmtUsd(d.aportesMenos)} de aportes y adelanta el recupero, y eso compensa los
       ${fmtUsd(d.valorTerminado - d.precio)} de valor que se resignan.`
    : `A ${fmtUsd(d.precio)} no conviene: faltan ${fmtUsd(d.piso - d.precio)} para llegar
       al piso de ${fmtUsd(d.piso)}, que son ${fmtUsd2(d.piso / d.sup)} el metro.`}</p>`}

  <h3>Los tres precios</h3>
  <table><thead><tr><th>Precio</th><th class="der">Importe</th><th class="der">Por m²</th>
    <th class="ocultar-chico">Qué significa</th></tr></thead><tbody>
    <tr><td>Costo de la unidad</td>
      <td class="der num">${fmtUsd(d.costoAsignado)}</td>
      <td class="der num">${fmtUsd2(d.costoAsignado / d.sup)}</td>
      <td class="ocultar-chico">Lo que esta unidad consumió del emprendimiento. Por debajo,
        el resto de los inversores subsidia la venta.</td></tr>
    <tr><td>Piso de indiferencia</td>
      <td class="der num">${d.piso === null ? '—' : fmtUsd(d.piso)}</td>
      <td class="der num">${d.piso === null ? '—' : fmtUsd2(d.piso / d.sup)}</td>
      <td class="ocultar-chico">El costo más la parte del margen que hace falta para que la
        tasa no baje, ya descontada la ventaja de cobrar antes.</td></tr>
    <tr><td>Valor terminado</td>
      <td class="der num">${fmtUsd(d.valorTerminado)}</td>
      <td class="der num">${fmtUsd2(d.precioFinal)}</td>
      <td class="ocultar-chico">Lo que se espera cobrar al cierre, ${d.mesVenta - d.mesHoy}
        meses más adelante.</td></tr>
  </tbody></table>
  ${d.piso === null ? '' : d.piso >= d.costoAsignado
    ? `<p class="sub">Acá el piso queda por encima del costo: vender al costo recupera lo que
      la unidad consumió, pero regala los ${fmtUsd(d.valorTerminado - d.costoAsignado)} de
      margen que iba a dejar. El piso devuelve la parte de ese margen que la ventaja de
      cobrar antes no alcanza a compensar.</p>`
    : `<p class="sub">Acá el piso queda por debajo del costo: cobrar
      ${d.mesVenta - d.mesHoy} meses antes vale más que el margen que se resigna, así que la
      tasa del inversor no baja aunque la unidad se venda bajo su costo. Igual, por debajo
      del costo el faltante lo pagan las unidades que quedan (ver el costo del m² que queda).</p>`}

  <h3>Mes a mes, con y sin la venta</h3>
  <table><thead><tr><th>Mes</th><th class="der">Egreso de obra</th>
    <th class="der">Aporte sin vender</th><th class="der">Aporte vendiendo</th>
    <th class="der ocultar-chico">Diferencia</th></tr></thead><tbody>
    ${(() => {
      const sin = flujoVenta(d.base, 0, 0).aportes;
      const con = flujoVenta(d.base, d.precio, d.sup).aportes;
      const filas = [];
      for(let i = 0; i <= d.mesVenta; i++){
        if(!d.base.egresos[i] && i !== d.mesVenta) continue;
        const dif = sin[i] - con[i];
        filas.push(`<tr>
          <td class="num">${i}${i === d.mesHoy ? ' <span class="chip a">hoy</span>' : ''}</td>
          <td class="der num">${d.base.egresos[i] ? fmtUsd(d.base.egresos[i]) : '—'}</td>
          <td class="der num">${sin[i] ? fmtUsd(sin[i]) : '—'}</td>
          <td class="der num">${con[i] ? fmtUsd(con[i]) : '—'}</td>
          <td class="der num ocultar-chico">${dif > 1 ? '−' + fmtUsd(dif).replace('US$ ', '') : '—'}</td>
        </tr>`);
      }
      return filas.join('');
    })()}
  </tbody></table>
  <p class="sub">Desde el mes en curso, la plata que entra hoy va cubriendo los egresos uno
  por uno: esos son los aportes que no hay que pedir. Cuando se agota, se vuelve a pedir
  como antes.</p>

  <p class="sub" style="margin-top:22px">Resultado antes de impuestos. El precio terminado
  de ${fmtUsd2(d.precioFinal)} el metro es un supuesto que todavía no se validó: si el
  mercado está más abajo, el piso de hoy también baja. El cálculo supone que el resto de
  las unidades se vende en el mes ${d.mesVenta}.</p>`;
}
