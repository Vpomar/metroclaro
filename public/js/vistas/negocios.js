/* =====================================================================
   vistas/negocios.js
   Estructurar un negocio

   El paso previo a una obra: alguien tiene un lote en un barrio cerrado
   y quiere construir. Acá se arma la propuesta y se ve cómo queda cada
   parte, antes de que la obra exista.

   La cascada: primero vuelve el capital, después la tasa preferente por
   el tiempo que la plata estuvo adentro, y recién entonces se reparte
   la rentabilidad. La tasa no está garantizada: si no alcanza, se recorta
   a prorrata y después se pierde capital.
   ===================================================================== */

let negocioAbierto = null;
/* El precio que se está mirando con la barra. No se guarda: es para
   entender el negocio moviéndolo, no para cambiar el supuesto. */
let precioMirado = null;
function mirarPrecio(v){
  precioMirado = parseFloat(v);
  const d = cuentasNegocio(negocioActual(), precioMirado);
  const caja = document.getElementById('mirador');
  if(caja) caja.innerHTML = miradorHtml(negocioActual(), d);
}
function negocioActual(){
  const gs = negociosDe();
  return gs.find(x => x.id === negocioAbierto) || gs[0];
}

function negociosDe(){ return (D.negocios || []).slice()
  .sort((a,b) => b.creado_en.localeCompare(a.creado_en)); }

const ESTADO_NEGOCIO = {
  borrador:   ['Borrador', ''],
  ofrecido:   ['Ofrecido', 'a'],
  cerrado:    ['Cerrado', 'v'],
  descartado: ['Descartado', 'r']
};

/* Curva de obra: lenta al principio, pico en el medio, baja al final.
   Define cuándo entra cada peso, y con eso cuánta tasa devenga. */
function curvaDeObra(meses){
  const p = [];
  for(let i = 0; i < meses; i++){
    const x = (i + 0.5) / meses;
    p.push(Math.exp(-Math.pow((x - 0.5) / 0.28, 2) / 2));
  }
  const s = p.reduce((a, b) => a + b, 0);
  return p.map(v => v / s);
}

/* Tasa interna de retorno anual, por bisección */
function tirAnualDe(flujo){
  const van = r => flujo.reduce((s, f, i) => s + f / Math.pow(1 + r, i), 0);
  if(van(0) <= 0) return null;
  let lo = 0, hi = 3;
  if(van(hi) > 0) return null;
  for(let k = 0; k < 160; k++){ const m = (lo + hi) / 2; if(van(m) > 0) lo = m; else hi = m; }
  return Math.pow(1 + (lo + hi) / 2, 12) - 1;
}

/* El valor del lote según el criterio elegido */
function valorDelLote(g){
  const ts = [g.tasacion_1, g.tasacion_2, g.tasacion_3].map(x => +x || 0).filter(x => x > 0);
  if(!ts.length) return +g.valor_lote || 0;
  if(g.criterio_lote === 'promedio') return ts.reduce((a, b) => a + b, 0) / ts.length;
  if(g.criterio_lote === 'menor')    return Math.min(...ts);
  return +g.valor_lote || 0;
}

function cuentasNegocio(g, precioAlternativo){
  const lote = valorDelLote(g);
  const construccion = (+g.m2 || 0) * (+g.costo_m2 || 0);
  const honorarios = construccion * (+g.pct_honorarios || 0) / 100;
  const meses = Math.max(1, +g.meses_obra || 1);
  const mesVenta = Math.max(meses, +g.mes_venta || meses);
  const expensas = (+g.expensas_mes || 0) * mesVenta;

  const efectivo = construccion + honorarios + expensas;
  const capital = lote + efectivo;

  const precio = precioAlternativo != null ? precioAlternativo : (+g.precio_venta || 0);
  const comision = precio * (+g.pct_comision || 0) / 100;
  const neto = precio - comision;

  const rMes  = Math.pow(1 + (+g.tasa_efectivo || 0) / 100, 1/12) - 1;
  const rLMes = Math.pow(1 + (+g.tasa_lote || 0) / 100, 1/12) - 1;

  /* Cuándo sale cada peso del efectivo */
  const egresos = new Array(mesVenta + 1).fill(0);
  curvaDeObra(meses).forEach((p, i) => egresos[i] += (construccion + honorarios) * p);
  for(let i = 0; i < mesVenta; i++) egresos[i] += (+g.expensas_mes || 0);

  const prefLote = lote * (Math.pow(1 + rLMes, mesVenta) - 1);
  const prefCash = egresos.reduce((s, e, i) => s + e * (Math.pow(1 + rMes, mesVenta - i) - 1), 0);
  const preferente = prefLote + prefCash;

  const aDevolver = capital + preferente;
  const excedente = neto - aDevolver;

  const pA = (+g.pct_exc_admin || 0) / 100;
  const pL = (+g.pct_exc_lote  || 0) / 100;
  const pC = (+g.pct_exc_cash  || 0) / 100;

  let cobraLote, cobraCash, cobraAdm, perdida = 0;
  if(excedente >= 0){
    cobraLote = lote + prefLote + excedente * pL;
    cobraCash = efectivo + prefCash + excedente * pC;
    cobraAdm  = excedente * pA;
  } else {
    perdida = -excedente;
    cobraAdm = 0;
    if(perdida <= preferente){
      /* Alcanza para el capital: se recorta la tasa a prorrata */
      const sobra = preferente - perdida;
      cobraLote = lote + prefLote * (sobra / preferente);
      cobraCash = efectivo + prefCash * (sobra / preferente);
    } else {
      /* Se pierde capital, a prorrata de lo que puso cada uno */
      const falta = perdida - preferente;
      cobraLote = lote - falta * (capital ? lote / capital : 0);
      cobraCash = efectivo - falta * (capital ? efectivo / capital : 0);
    }
  }

  const flujoLote = new Array(mesVenta + 1).fill(0);
  flujoLote[0] = -lote;
  flujoLote[mesVenta] += cobraLote;

  const flujoCash = egresos.map(e => -e);
  flujoCash[mesVenta] = (flujoCash[mesVenta] || 0) + cobraCash;

  /* El dueño del lote venía pagando las expensas. Al absorberlas el
     proyecto, se las ahorra enteras; lo único que le cuesta es la parte
     que esas expensas le restan a la rentabilidad que él cobra. */
  const ahorroDueno = (g.expensas_las_pagaba_el_dueno === false)
    ? 0 : expensas - (excedente >= 0 ? expensas * pL : 0);

  /* El efectivo se expresa en fichas: más simple de administrar que
     porcentajes sueltos. Lo que no llega a una ficha queda como resto. */
  const valorFicha = +g.valor_ficha || 5000;
  const fichas = Math.floor(efectivo / valorFicha);
  const resto = efectivo - fichas * valorFicha;

  const comisionPct = (+g.pct_comision || 0) / 100;
  return { lote, construccion, honorarios, expensas, efectivo, capital, ahorroDueno,
    valorFicha, fichas, resto,
    meses, mesVenta, precio, comision, neto, egresos,
    prefLote, prefCash, preferente, aDevolver, excedente, perdida,
    cobraLote, cobraCash, cobraAdm, totalAdm: honorarios + cobraAdm,
    tirLote: tirAnualDe(flujoLote), tirCash: tirAnualDe(flujoCash),
    equilibrio: aDevolver / (1 - comisionPct),
    soloCapital: capital / (1 - comisionPct) };
}

/* ---------- La pantalla ---------- */
function vNegocios(){
  const gs = negociosDe();

  if(!gs.length){
    return `<div class="vacio" style="text-align:left">
      <strong>Estructurar un negocio.</strong>
      <p style="font-size:12.5px;color:var(--gris);margin:6px 0 12px">
        Alguien tiene un lote en un barrio cerrado y quiere construir. Acá armás la
        propuesta, ponés el valor del lote, el costo de obra y el reparto, y ves cómo
        queda cada parte antes de que la obra exista.</p>
      ${puedeEditar() ? `<button class="btn" onclick="formNegocio()">Armar el primero</button>` : ''}
    </div>`;
  }

  const abierto = gs.find(x => x.id === negocioAbierto) || gs[0];

  return `
  ${puedeEditar() ? `<div class="acciones">
    <button class="btn" onclick="formNegocio()">Nuevo negocio</button>
    <button class="btn sec" onclick="formNegocio('${abierto.id}')">Editar supuestos</button>
    <button class="btn sec" onclick="compartirNegocio('${abierto.id}')">Compartir propuesta</button>
    <button class="btn sec" onclick="window.print()">Imprimir</button>
  </div>` : ''}

  ${gs.length > 1 ? `<div class="acciones">
    <label for="sel-negocio" style="font-size:11px;color:var(--gris)">Negocio</label>
    <select id="sel-negocio" onchange="verNegocio(this.value)"
      style="font:inherit;font-size:12.5px;padding:6px 26px 6px 9px;
        border:1px solid var(--linea-fuerte);border-radius:var(--radio);background:var(--hoja)">
      ${gs.map(g => `<option value="${g.id}" ${g.id === abierto.id ? 'selected' : ''}>${
        esc(g.nombre)}${g.ubicacion ? ' · ' + esc(g.ubicacion) : ''}</option>`).join('')}
    </select>
  </div>` : ''}

  ${detalleNegocio(abierto)}`;
}

function verNegocio(id){ negocioAbierto = id; render(); }

/* La barra de precio con su resultado. Mover el precio es la forma más
   rápida de entender dónde está parado el negocio. */
function miradorHtml(g, d){
  const gana = d.excedente >= 0;
  return `
  <div class="fila" style="margin-bottom:0">
    <div class="kpi ${gana ? '' : 'alerta'}"><p class="r">Rentabilidad a repartir</p>
      <p class="v num">${fmtUsd(d.excedente)}</p>
      <p class="s">${gana ? 'después de capital y tasa' : 'no alcanza'}</p></div>
    <div class="kpi"><p class="r">Rinde el lote</p>
      <p class="v num">${d.tirLote === null ? 'pierde' : fmtPct(d.tirLote * 100)}</p>
      <p class="s">más ${fmtUsd(d.ahorroDueno)} de expensas que se ahorra</p></div>
    <div class="kpi"><p class="r">Rinden los aportantes</p>
      <p class="v num">${d.tirCash === null ? 'pierden' : fmtPct(d.tirCash * 100)}</p>
      <p class="s">${d.fichas} fichas de ${fmtUsd(d.valorFicha)}${
        d.resto > 1 ? ' más ' + fmtUsd(d.resto) : ''}</p></div>
    <div class="kpi"><p class="r">Se lleva el administrador</p>
      <p class="v num">${fmtUsd(d.totalAdm)}</p>
      <p class="s">honorarios más rentabilidad</p></div>
  </div>`;
}

function detalleNegocio(g){
  const d = cuentasNegocio(g);
  const gana = d.excedente >= 0;
  const [et, color] = ESTADO_NEGOCIO[g.estado] || ['—', ''];

  return `
  <div class="rep-cabeza" style="margin-bottom:24px">
    <h2>${esc(g.nombre)}</h2>
    <p>${g.ubicacion ? esc(g.ubicacion) + ' · ' : ''}${d.m2 || g.m2} m² ·
      ${d.meses} meses de obra · venta en el mes ${d.mesVenta}
      <span class="chip ${color}" style="margin-left:6px">${et}</span></p>
    ${g.propietario ? `<p class="pct">Lote de ${esc(g.propietario)}</p>` : ''}
  </div>

  ${g.render ? `<div class="foto" style="max-width:420px;margin-bottom:22px">
    <img data-ruta="${esc(g.render)}" alt="Anteproyecto">
    <div class="pie-foto"><strong>Anteproyecto</strong>
      <p class="pct">Es lo que ve quien recibe la invitación</p></div>
  </div>` : `<div class="vacio no-imprimir" style="text-align:left;margin-bottom:22px">
    Falta el render del anteproyecto. Sin imagen, la invitación no convence a nadie.
    ${puedeEditar() ? `<br><br><button class="btn sec" onclick="formNegocio('${g.id}')">Subir el render</button>` : ''}
  </div>`}

  <div class="acciones no-imprimir" style="margin-bottom:6px;align-items:baseline">
    <label for="ng-mirar" style="font-size:11px;color:var(--gris)">Si se vende a</label>
    <strong class="num" style="font-size:19px;font-weight:400;letter-spacing:-.035em"
      id="ng-mirar-txt">${fmtUsd(d.precio)}</strong>
    <span class="pct" style="margin:0">equilibrio en ${fmtUsd(d.equilibrio)} ·
      solo el capital ${fmtUsd(d.soloCapital)}</span>
  </div>
  <input id="ng-mirar" type="range" class="no-imprimir"
    min="${Math.round(d.soloCapital * 0.8)}" max="${Math.round(d.precio * 1.3)}" step="5000"
    value="${Math.round(d.precio)}"
    oninput="document.getElementById('ng-mirar-txt').textContent=fmtUsd(this.value);mirarPrecio(this.value)"
    style="width:100%;accent-color:var(--naranja);margin:0 0 18px">

  <div id="mirador">${miradorHtml(g, d)}</div>

  <h3>La cascada</h3>
  <table><tbody>
    <tr><td>Precio de venta</td><td class="der num">${fmtUsd(d.precio)}</td></tr>
    <tr><td style="padding-left:22px;color:var(--gris)">Comisión inmobiliaria</td>
      <td class="der num">−${fmtUsd(d.comision).replace('US$ ','')}</td></tr>
    <tr><td><strong>Neto de la venta</strong></td>
      <td class="der num"><strong>${fmtUsd(d.neto)}</strong></td></tr>

    <tr class="grupo-rubro"><td colspan="2">Capital aportado</td></tr>
    <tr><td style="padding-left:22px">Lote, a valor de tasación</td>
      <td class="der num">${fmtUsd(d.lote)}</td></tr>
    <tr><td style="padding-left:22px">Construcción · ${g.m2} m² a ${fmtUsd(g.costo_m2)}</td>
      <td class="der num">${fmtUsd(d.construccion)}</td></tr>
    <tr><td style="padding-left:22px">Honorarios · ${fmtPct(g.pct_honorarios)}</td>
      <td class="der num">${fmtUsd(d.honorarios)}</td></tr>
    <tr><td style="padding-left:22px">Expensas e impuestos · ${d.mesVenta} meses</td>
      <td class="der num">${fmtUsd(d.expensas)}</td></tr>
    <tr><td><strong>Capital total</strong></td>
      <td class="der num"><strong>${fmtUsd(d.capital)}</strong></td></tr>

    <tr class="grupo-rubro"><td colspan="2">Tasa preferente</td></tr>
    <tr><td style="padding-left:22px">Del lote · ${fmtPct(g.tasa_lote)} por ${d.mesVenta} meses</td>
      <td class="der num">${fmtUsd(d.prefLote)}</td></tr>
    <tr><td style="padding-left:22px">Del efectivo · ${fmtPct(g.tasa_efectivo)} según cuándo entró</td>
      <td class="der num">${fmtUsd(d.prefCash)}</td></tr>
    <tr><td><strong>Tasa total</strong></td>
      <td class="der num"><strong>${fmtUsd(d.preferente)}</strong></td></tr>

    <tr><td style="padding-top:16px"><strong>Rentabilidad</strong></td>
      <td class="der num" style="padding-top:16px"><strong>${fmtUsd(d.excedente)}</strong></td></tr>
  </tbody></table>

  <h3>Quién se lleva qué</h3>
  <table><thead><tr><th>Parte</th><th class="der">Puso</th><th class="der">Tasa</th>
    <th class="der ocultar-chico">De la rentabilidad</th><th class="der">Cobra</th>
    <th class="der">Anual</th></tr></thead><tbody>
    <tr><td>Dueño del lote</td>
      <td class="der num">${fmtUsd(d.lote)}</td>
      <td class="der num">${gana ? fmtUsd(d.prefLote) : '—'}</td>
      <td class="der num ocultar-chico">${gana ? fmtUsd(d.excedente * (+g.pct_exc_lote/100)) : '—'}
        <span class="pct" style="display:inline">${fmtPct(g.pct_exc_lote)}</span></td>
      <td class="der num" style="font-weight:500">${fmtUsd(d.cobraLote)}</td>
      <td class="der num">${d.tirLote === null ? 'pierde' : fmtPct(d.tirLote * 100)}</td></tr>
    ${d.ahorroDueno > 0 ? `<tr><td style="padding-left:22px;color:var(--gris)">
      Además deja de pagar las expensas</td>
      <td class="der"></td><td class="der"></td><td class="der ocultar-chico"></td>
      <td class="der num" style="color:var(--verde)">${fmtUsd(d.ahorroDueno)}</td>
      <td class="der"></td></tr>` : ''}
    <tr><td>Aportantes de efectivo</td>
      <td class="der num">${fmtUsd(d.efectivo)}</td>
      <td class="der num">${gana ? fmtUsd(d.prefCash) : '—'}</td>
      <td class="der num ocultar-chico">${gana ? fmtUsd(d.excedente * (+g.pct_exc_cash/100)) : '—'}
        <span class="pct" style="display:inline">${fmtPct(g.pct_exc_cash)}</span></td>
      <td class="der num" style="font-weight:500">${fmtUsd(d.cobraCash)}</td>
      <td class="der num">${d.tirCash === null ? 'pierden' : fmtPct(d.tirCash * 100)}</td></tr>
    <tr><td>Administrador</td>
      <td class="der">—</td><td class="der">—</td>
      <td class="der num ocultar-chico">${gana ? fmtUsd(d.cobraAdm) : '—'}
        <span class="pct" style="display:inline">${fmtPct(g.pct_exc_admin)}</span></td>
      <td class="der num" style="font-weight:500">${fmtUsd(d.totalAdm)}</td>
      <td class="der">—</td></tr>
  </tbody></table>
  ${d.ahorroDueno > 0 ? `<p class="sub">El dueño del lote, además de lo que cobra, deja de
  pagar ${fmtUsd(d.expensas)} de expensas e impuestos durante los ${d.mesVenta} meses: los
  absorbe el proyecto. Neto de lo que eso le resta a la rentabilidad, se ahorra
  ${fmtUsd(d.ahorroDueno)}. Es parte de lo que gana y conviene decirlo en la reunión.</p>` : ''}

  <p class="sub">El administrador no pone capital, así que no tiene tasa de retorno: cobra
  ${fmtUsd(d.honorarios)} de honorarios durante la obra más su parte de la rentabilidad.
  Cobra por los dos lados, y conviene que esté a la vista desde el primer día.</p>

  <h3>Qué pasa a distintos precios</h3>
  <table><thead><tr><th>Precio</th><th class="der ocultar-chico">Por m²</th>
    <th class="der">Rentabilidad</th><th class="der">Lote</th>
    <th class="der">Aportantes</th><th class="der ocultar-chico">Administrador</th>
    </tr></thead><tbody>
    ${(() => {
      const base = Math.round(d.soloCapital * 0.92 / 10000) * 10000;
      const tope = Math.max(d.precio * 1.14, d.equilibrio * 1.2);
      const paso = Math.max(10000, Math.round((tope - base) / 8 / 10000) * 10000);
      const filas = [];
      for(let p = base; p <= tope; p += paso){
        const x = cuentasNegocio(g, p);
        const cerca = Math.abs(p - d.precio) < paso / 2;
        filas.push(`<tr style="${cerca ? 'font-weight:500' : ''}">
          <td class="num">${fmtUsd(p)}${cerca ? ' <span class="chip a">estimado</span>' : ''}</td>
          <td class="der num ocultar-chico">${g.m2 ? fmtUsd2(p / g.m2) : '—'}</td>
          <td class="der num" style="${x.excedente < 0 ? 'color:var(--rojo)' : ''}">${fmtUsd(x.excedente)}</td>
          <td class="der num">${x.tirLote === null ? 'pierde' : fmtPct(x.tirLote * 100)}</td>
          <td class="der num">${x.tirCash === null ? 'pierden' : fmtPct(x.tirCash * 100)}</td>
          <td class="der num ocultar-chico">${fmtUsd(x.totalAdm)}</td>
        </tr>`);
      }
      return filas.join('');
    })()}
  </tbody></table>

  ${!gana ? `<div class="vacio" style="text-align:left;border-style:solid;
    border-color:var(--rojo);color:var(--rojo);margin-top:18px">
    <strong style="color:var(--rojo)">Al precio cargado no alcanza.</strong>
    Faltan ${fmtUsd(d.perdida)} para cubrir capital más tasa.
    ${d.perdida <= d.preferente
      ? 'La tasa se recorta a prorrata y el capital vuelve entero.'
      : `Se pierde capital: ${fmtUsd(d.perdida - d.preferente)}, repartidos a prorrata
         de lo que puso cada uno.`}
  </div>` : ''}

  <p class="sub" style="margin-top:22px">La tasa preferente es el orden en que se cobra, no una
  promesa: si el proyecto no alcanza, se recorta. Los números son antes de impuestos, y aportar
  el lote a valor de mercado puede ser hecho imponible por la diferencia contra su costo.
  El lote pesa el ${fmtPct(d.capital ? d.lote / d.capital * 100 : 0)} del capital: si pesara
  mucho más, el reparto de la rentabilidad habría que revisarlo.</p>`;
}

/* ---------- Alta y edición ---------- */
function formNegocio(id){
  const g = id ? (D.negocios || []).find(x => x.id === id) : {
    criterio_lote:'promedio', pct_honorarios:20, meses_obra:18, mes_venta:21, valor_ficha:5000,
    pct_comision:3, tasa_efectivo:8, tasa_lote:8,
    pct_exc_admin:30, pct_exc_lote:10, pct_exc_cash:60, estado:'borrador'
  };
  const n = (campo, etiqueta, paso = '0.01', ayuda = '') =>
    `<div class="campo"><label for="ng-${campo}">${etiqueta}</label>
      <input id="ng-${campo}" type="number" step="${paso}" value="${g[campo] ?? ''}">
      ${ayuda ? `<span class="ayuda">${ayuda}</span>` : ''}</div>`;

  modal(id ? 'Editar el negocio' : 'Nuevo negocio', `
    <div class="campo ancho"><label for="ng-nombre">Nombre</label>
      <input id="ng-nombre" value="${esc(g.nombre || '')}" placeholder="Casa en Kentucky"></div>
    <div class="campo"><label for="ng-ubicacion">Ubicación</label>
      <input id="ng-ubicacion" value="${esc(g.ubicacion || '')}" placeholder="Barrio, zona"></div>
    <div class="campo"><label for="ng-propietario">Dueño del lote</label>
      <input id="ng-propietario" value="${esc(g.propietario || '')}"></div>
    <div class="campo"><label for="ng-estado">Estado</label>
      <select id="ng-estado">${Object.entries(ESTADO_NEGOCIO).map(([k, v]) =>
        `<option value="${k}" ${k === g.estado ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></div>

    <div class="campo ancho"><span class="ayuda"><strong>El lote.</strong>
      Tres tasaciones o tres publicaciones de lotes parecidos. El promedio si las tres
      son parejas, la menor si hay una que se despega.</span></div>
    ${n('tasacion_1', 'Tasación 1', '1000')}
    ${n('tasacion_2', 'Tasación 2', '1000')}
    ${n('tasacion_3', 'Tasación 3', '1000')}
    <div class="campo"><label for="ng-criterio_lote">Criterio</label>
      <select id="ng-criterio_lote">
        <option value="promedio" ${g.criterio_lote === 'promedio' ? 'selected' : ''}>Promedio</option>
        <option value="menor" ${g.criterio_lote === 'menor' ? 'selected' : ''}>La menor</option>
        <option value="manual" ${g.criterio_lote === 'manual' ? 'selected' : ''}>A convenir</option>
      </select></div>
    ${n('valor_lote', 'Valor del aporte', '1000', 'solo se usa si el criterio es a convenir')}

    <div class="campo ancho"><span class="ayuda"><strong>La obra.</strong></span></div>
    ${n('m2', 'Superficie a construir m²', '5')}
    ${n('costo_m2', 'Costo de construcción USD/m²', '50')}
    ${n('pct_honorarios', 'Honorarios %', '1', 'proyecto, conducción y administración')}
    ${n('expensas_mes', 'Expensas e impuestos por mes', '50')}
    <div class="campo"><label for="ng-expensas_las_pagaba_el_dueno">¿Las venía pagando el dueño?</label>
      <select id="ng-expensas_las_pagaba_el_dueno">
        <option value="si" ${g.expensas_las_pagaba_el_dueno !== false ? 'selected' : ''}>Sí, se las ahorra</option>
        <option value="no" ${g.expensas_las_pagaba_el_dueno === false ? 'selected' : ''}>No</option>
      </select><span class="ayuda">al absorberlas el proyecto, es un beneficio suyo</span></div>
    ${n('meses_obra', 'Plazo de obra en meses', '1')}
    ${n('mes_venta', 'Se vende en el mes', '1')}

    <div class="campo ancho"><span class="ayuda"><strong>La venta y el reparto.</strong>
      La tasa del lote puede ser distinta: está inmovilizado todo el plazo, mientras que
      el efectivo entra de a poco.</span></div>
    ${n('precio_venta', 'Precio de venta estimado', '10000')}
    ${n('valor_ficha', 'Valor de cada ficha', '1000', 'la participación en efectivo se divide en fichas')}
    ${n('pct_comision', 'Comisión inmobiliaria %', '0.5')}
    ${n('tasa_efectivo', 'Tasa del efectivo %', '0.5')}
    ${n('tasa_lote', 'Tasa del lote %', '0.5')}
    ${n('pct_exc_admin', 'Rentabilidad · administrador %', '1')}
    ${n('pct_exc_lote', 'Rentabilidad · terreno %', '1')}
    ${n('pct_exc_cash', 'Rentabilidad · aportantes %', '1')}
    <div class="campo ancho"><label for="ng-render">Render del anteproyecto</label>
      <input id="ng-render" type="file" accept="image/*"
        onchange="archivoPendiente = this.files[0] || null">
      <span class="ayuda">${g.render
        ? 'Ya hay uno cargado. Si elegís otro, lo reemplaza.'
        : 'Es lo que hace que alguien se imagine el proyecto. Sin render, la invitación no convence.'}</span></div>
    <div class="campo ancho"><label for="ng-nota">Nota</label>
      <input id="ng-nota" value="${esc(g.nota || '')}" placeholder="Opcional"></div>
    ${id && esAdmin() ? `<div class="campo ancho">
      <button class="btn sec" onclick="cerrar();borrar('negocios','${id}')">Eliminar este negocio</button>
    </div>` : ''}`,
    async () => {
      if(!val('ng-nombre')) return err('Poné un nombre.');
      const num = c => { const v = val('ng-' + c); return v === '' ? null : parseFloat(v); };
      const reparto = (num('pct_exc_admin') || 0) + (num('pct_exc_lote') || 0) + (num('pct_exc_cash') || 0);
      if(Math.abs(reparto - 100) > 0.01)
        return err(`El reparto de la rentabilidad suma ${reparto}%. Tiene que dar 100.`);

      const datos = {
        nombre: val('ng-nombre'), ubicacion: val('ng-ubicacion'),
        propietario: val('ng-propietario'), estado: val('ng-estado'),
        tasacion_1: num('tasacion_1'), tasacion_2: num('tasacion_2'), tasacion_3: num('tasacion_3'),
        criterio_lote: val('ng-criterio_lote'), valor_lote: num('valor_lote') || 0,
        m2: num('m2') || 0, costo_m2: num('costo_m2') || 0,
        pct_honorarios: num('pct_honorarios') || 0, expensas_mes: num('expensas_mes') || 0,
        meses_obra: parseInt(val('ng-meses_obra')) || 18,
        mes_venta: parseInt(val('ng-mes_venta')) || 21,
        precio_venta: num('precio_venta') || 0, pct_comision: num('pct_comision') || 0,
        tasa_efectivo: num('tasa_efectivo') || 0, tasa_lote: num('tasa_lote') || 0,
        pct_exc_admin: num('pct_exc_admin') || 0, pct_exc_lote: num('pct_exc_lote') || 0,
        pct_exc_cash: num('pct_exc_cash') || 0,
        valor_ficha: num('valor_ficha') || 5000,
        expensas_las_pagaba_el_dueno: val('ng-expensas_las_pagaba_el_dueno') === 'si',
        nota: val('ng-nota'), creado_por: perfil.id
      };
      /* El render va a su depósito; en la tabla queda la ruta */
      if(archivoPendiente){
        const ruta = await subirArchivo('renders', archivoPendiente, id || 'nuevos');
        archivoPendiente = null;
        if(ruta) datos.render = ruta;
      }
      cerrar();
      await guardar('negocios', datos, id);
      if(!id) negocioAbierto = null;
    });
}


/* ---------- Compartir la propuesta ----------
   Un enlace público por negocio, sin usuario ni contraseña. El que lo
   abre ve el proyecto y puede mover el precio y su aporte. */
function urlInvitacion(token){
  return location.origin + location.pathname.replace(/[^/]*$/, '') +
    'invitacion.html?t=' + token;
}

async function compartirNegocio(id){
  const g = (D.negocios || []).find(x => x.id === id);
  if(!g) return;

  const previas = (D.invitaciones || []).filter(x => x.negocio_id === id && x.activo);
  let enlace = previas[0];

  if(!enlace){
    /* Token largo y aleatorio: el enlace es la única llave */
    const bytes = new Uint8Array(36);
    crypto.getRandomValues(bytes);
    const token = Array.from(bytes, b => b.toString(36).padStart(2, '0')).join('').slice(0, 48);
    const { data, error } = await sb.from('invitaciones')
      .insert({ token, negocio_id: id, titulo: g.nombre, creado_por: perfil.id })
      .select().single();
    if(error) return aviso('No se pudo crear el enlace: ' + error.message, true);
    enlace = data;
    await cargarDatos();
  }

  const url = urlInvitacion(enlace.token);
  const texto = `${g.nombre}${g.ubicacion ? ' · ' + g.ubicacion : ''}\n` +
    `${g.m2} m² · ${g.meses_obra} meses de obra · tasa preferente del ${g.tasa_efectivo}% anual en dólares\n\n` +
    `Mirá la propuesta y probá con el monto que quieras:\n${url}`;

  modal('Compartir la propuesta', `
    <div class="campo ancho"><span class="ayuda">
      Cualquiera con este enlace ve la propuesta: el anteproyecto, los plazos y una
      calculadora donde puede mover el precio de venta y su aporte. No ve el nombre del
      dueño del lote ni las notas internas.
    </span></div>
    <div class="campo ancho"><label for="inv-url">Enlace</label>
      <input id="inv-url" value="${esc(url)}" readonly onclick="this.select()"></div>
    <div class="campo ancho"><label for="inv-texto">Mensaje</label>
      <textarea id="inv-texto" rows="5">${esc(texto)}</textarea>
      <span class="ayuda">Se puede editar antes de mandarlo.</span></div>
    <div class="campo ancho" style="flex-direction:row;gap:8px;flex-wrap:wrap">
      <button class="btn" onclick="mandarPorWhatsapp()">Abrir WhatsApp</button>
      <button class="btn sec" onclick="copiarTexto('inv-url','Enlace copiado')">Copiar enlace</button>
      <button class="btn sec" onclick="copiarTexto('inv-texto','Mensaje copiado')">Copiar mensaje</button>
    </div>
    ${enlace.visitas ? `<div class="campo ancho"><span class="ayuda">
      Abierto ${enlace.visitas} ${enlace.visitas === 1 ? 'vez' : 'veces'}.</span></div>` : ''}`,
    cerrar);
  /* Acá no se guarda nada: el botón principal solo cierra */
  const ok = document.getElementById('ok');
  if(ok) ok.textContent = 'Listo';
}

function mandarPorWhatsapp(){
  const t = document.getElementById('inv-texto').value;
  window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank', 'noopener');
}

async function copiarTexto(id, mensaje){
  const campo = document.getElementById(id);
  try {
    await navigator.clipboard.writeText(campo.value);
    aviso(mensaje);
  } catch(e) {
    campo.select();
    aviso('Copialo con Ctrl+C');
  }
}
