/* =====================================================================
   vistas/unidades.js
   Pestaña Unidades

   Script clásico: comparte el ámbito global con los demás archivos de
   js/. El orden de carga está en index.html (ver js/README.md).
   ===================================================================== */
/* ---------- Unidades ---------- */
const TIPOS_UNIDAD = ['Departamento','Cochera','Baulera','Local','Otro'];
const ESTADO_UNIDAD = {
  disponible: ['Disponible',''],
  reservada:  ['Reservada','a'],
  asignada:   ['Asignada','v'],
  vendida:    ['Vendida','v']
};

function vUnidades(o){
  const filas = cuadroUnidades(o.id);
  const c = computo(o.id);
  const m2 = v => (+v||0).toLocaleString('es-AR',{maximumFractionDigits:2}) + ' m²';

  if(!filas.length){
    return `<div class="vacio" style="text-align:left">
      <strong>Unidades del emprendimiento.</strong>
      <p style="font-size:12.5px;color:var(--gris);margin:6px 0 12px">
        Cargá cada departamento, cochera o local con su superficie y su coeficiente de valor.
        El porcentual de cada uno se calcula solo, y desde acá se asignan a inversores
        o se vinculan con una venta.</p>
      ${puedeEditar()?`<button class="btn" onclick="formGenerarUnidades()">Copiar del anteproyecto</button>
        <button class="btn sec" onclick="formUnidad()">Cargar una a mano</button>`:''}
    </div>`;
  }

  const porEstado = e => filas.filter(f=>f.u.estado===e);
  const supTotal = filas.reduce((s,f)=>s+f.superficie,0);
  const costoUnidad = f => c && c.total ? c.total * f.porcentual/100 : 0;

  const cob = coberturaUnidades(o.id);
  const incompleta = cob && cob.pct < 98;

  return `
  ${incompleta ? `<div class="vacio" style="text-align:left;border-style:solid;
    border-color:var(--ambar);color:var(--ambar);margin-bottom:20px">
    <strong style="color:var(--ambar)">Falta cargar unidades.</strong>
    Hay ${m2f(cob.cargada)} cargados contra ${m2f(cob.total)} del anteproyecto,
    o sea ${fmtPct(cob.pct)}. Hasta completarlas, el porcentual y el costo asignado
    de cada unidad salen mal: se reparte el total del emprendimiento entre las pocas
    que hay.
    ${puedeEditar() ? `<br><br><button class="btn sec" onclick="formGenerarUnidades()">Copiar del anteproyecto</button>` : ''}
  </div>` : ''}

  ${puedeEditar()?`<div class="acciones">
    <button class="btn" onclick="formUnidad()">Agregar unidad</button>
    <button class="btn sec" onclick="formGenerarUnidades()">Copiar del anteproyecto</button>
    <button class="btn sec" onclick="exportarUnidades()">Exportar a Excel</button>
  </div>`:''}

  <div class="fila">
    <div class="kpi"><p class="r">Unidades</p><p class="v num">${filas.length}</p>
      <p class="s">${m2(supTotal)} en total</p></div>
    <div class="kpi"><p class="r">Disponibles</p><p class="v num">${porEstado('disponible').length}</p>
      <p class="s">${fmtPct(porEstado('disponible').reduce((s,f)=>s+f.porcentual,0))} del total</p></div>
    <div class="kpi"><p class="r">Asignadas</p>
      <p class="v num">${porEstado('asignada').length + porEstado('reservada').length}</p>
      <p class="s">a inversores</p></div>
    <div class="kpi"><p class="r">Vendidas</p><p class="v num">${porEstado('vendida').length}</p>
      <p class="s">${fmtPct(porEstado('vendida').reduce((s,f)=>s+f.porcentual,0))} del total</p></div>
    ${c && c.total ? `<div class="kpi"><p class="r">Costo del m² vendible</p>
      <p class="v num">${fmtUsd(c.porVendible)}</p>
      <p class="s">según el análisis</p></div>` : ''}
  </div>

  <table><thead><tr><th>Unidad</th><th class="ocultar-chico">Tipo</th>
    <th class="der">Superficie</th><th class="der">Coef.</th><th class="der">Porcentual</th>
    ${c&&c.total?'<th class="der ocultar-chico">Costo asignado</th>':''}
    <th>Situación</th><th></th></tr></thead><tbody>
    ${filas.map(f=>{
      const u = f.u;
      const [et, color] = ESTADO_UNIDAD[u.estado] || ['—',''];
      const quien = u.inversor_id ? inv(u.inversor_id)?.nombre
                  : u.venta_id ? D.ventas.find(v=>v.id===u.venta_id)?.cliente : null;
      return `<tr>
        <td><strong>${esc(u.codigo)}</strong>
          ${u.piso!=null?`<br><span class="pct">Piso ${u.piso}</span>`:''}</td>
        <td class="ocultar-chico">${esc(u.tipo)}</td>
        <td class="der num">${m2(f.superficie)}</td>
        <td class="der num">${(+u.coeficiente).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
        <td class="der num" style="font-weight:600">${fmtPct(f.porcentual)}</td>
        ${c&&c.total?`<td class="der num ocultar-chico">${fmtUsd(costoUnidad(f))}</td>`:''}
        <td><span class="chip ${color}">${et}</span>
          ${quien?`<br><span class="pct">${esc(quien)}</span>`:''}</td>
        <td class="der">${puedeEditar()?`<button class="link" onclick="formUnidad('${u.id}')">Editar</button>`:''}
          ${puedeEditar()?`<br><button class="link" onclick="asignarUnidad('${u.id}')">Asignar</button>`:''}</td>
      </tr>`;
    }).join('')}
    <tr><td><strong>Total</strong></td><td class="ocultar-chico"></td>
      <td class="der num"><strong>${m2(supTotal)}</strong></td><td></td>
      <td class="der num"><strong>100,0%</strong></td>
      ${c&&c.total?`<td class="der num ocultar-chico"><strong>${fmtUsd(c.total)}</strong></td>`:''}
      <td colspan="2"></td></tr>
  </tbody></table>

  <p class="sub" style="margin-top:12px">El porcentual sale de la superficie por el coeficiente
  de valor. Un coeficiente de 1,10 significa que esa unidad vale un 10% más por metro que la
  de referencia, que es la que tiene 1,00.
  ${c&&c.total?' El costo asignado reparte el costo total del emprendimiento según ese porcentual.':''}</p>`;
}

function formUnidad(id){
  const o = obra();
  const u = id ? (D.unidades_obra||[]).find(x=>x.id===id) : {};
  const ns = nivelesDe(o.id);
  const n = (campo, et, paso='0.01') =>
    `<div class="campo"><label for="un-${campo}">${et}</label>
      <input id="un-${campo}" type="number" step="${paso}" min="0" value="${u[campo] ?? ''}"></div>`;

  modal(id ? 'Editar unidad' : 'Agregar unidad', `
    <div class="campo"><label for="un-codigo">Unidad</label>
      <input id="un-codigo" value="${esc(u.codigo||'')}" placeholder="3ºB"></div>
    <div class="campo"><label for="un-tipo">Tipo</label>
      <select id="un-tipo">${TIPOS_UNIDAD.map(t=>`<option ${t===u.tipo?'selected':''}>${t}</option>`).join('')}</select></div>
    <div class="campo"><label for="un-piso">Piso</label>
      <input id="un-piso" type="number" step="1" value="${u.piso ?? ''}"></div>
    <div class="campo"><label for="un-nivel">Nivel del análisis</label>
      <select id="un-nivel"><option value="">Sin vincular</option>
        ${ns.map(x=>`<option value="${x.id}" ${x.id===u.nivel_id?'selected':''}>${esc(x.nombre)}</option>`).join('')}
      </select></div>
    ${n('sup_cubierta','Cubierta m²')}
    ${n('sup_semicubierta','Semicubierta m²')}
    ${n('sup_comun','Común m²')}
    <div class="campo"><label for="un-coeficiente">Coeficiente de valor</label>
      <input id="un-coeficiente" type="number" step="0.01" min="0.01"
        value="${u.coeficiente ?? 1}">
      <span class="ayuda">1,00 es la referencia. Un cuarto piso puede ir en 1,10.</span></div>
    <div class="campo"><label for="un-precio">Precio de lista USD</label>
      <input id="un-precio" type="number" step="1000" min="0" value="${u.precio_lista ?? ''}"></div>
    <div class="campo"><label for="un-orden">Orden</label>
      <input id="un-orden" type="number" step="1" value="${u.orden ?? unidadesDe(o.id).length*10}"></div>
    <div class="campo ancho"><label for="un-nota">Nota</label>
      <input id="un-nota" value="${esc(u.nota||'')}" placeholder="Opcional"></div>
    ${id && esAdmin() ? `<div class="campo ancho">
      <button class="btn sec" onclick="cerrar();borrar('unidades','${id}')">Eliminar esta unidad</button></div>`:''}`,
    async ()=>{
      const codigo = val('un-codigo');
      if(!codigo) return err('Poné el código de la unidad.');
      const num = c => { const v = val('un-'+c); return v === '' ? null : parseFloat(v); };
      const datos = { obra_id:o.id, codigo, tipo:val('un-tipo'),
        piso: num('piso'), nivel_id: val('un-nivel') || null,
        sup_cubierta: num('sup_cubierta')||0, sup_semicubierta: num('sup_semicubierta')||0,
        sup_comun: num('sup_comun')||0, coeficiente: num('coeficiente')||1,
        precio_lista: num('precio'), orden: parseInt(val('un-orden'))||0,
        nota: val('un-nota') };
      cerrar();
      await guardar('unidades', datos, id);
    });
}

function asignarUnidad(id){
  const o = obra();
  const u = (D.unidades_obra||[]).find(x=>x.id===id);
  const invObra = partsDe(o.id).map(p=>inv(p.inversor_id)).filter(Boolean)
    .sort((a,b)=>a.nombre.localeCompare(b.nombre));
  const vs = ventasDe(o.id);

  modal(`Situación de ${esc(u.codigo)}`, `
    <div class="campo ancho"><label for="as-estado">Estado</label>
      <select id="as-estado" onchange="tglAsignar()">
        ${Object.entries(ESTADO_UNIDAD).map(([k,v])=>
          `<option value="${k}" ${k===u.estado?'selected':''}>${v[0]}</option>`).join('')}
      </select></div>
    <div class="campo ancho" id="wrap-as-inv"><label for="as-inv">Inversor</label>
      <select id="as-inv"><option value="">Sin asignar</option>
        ${invObra.map(i=>`<option value="${i.id}" ${i.id===u.inversor_id?'selected':''}>${esc(i.nombre)}</option>`).join('')}
      </select>
      <span class="ayuda">Queda a nombre de ese inversor y él la ve en su rendición.</span></div>
    <div class="campo ancho" id="wrap-as-venta"><label for="as-venta">Venta</label>
      <select id="as-venta"><option value="">Sin vincular</option>
        ${vs.map(v=>`<option value="${v.id}" ${v.id===u.venta_id?'selected':''}>${esc(v.cliente)}${v.unidad?` · ${esc(v.unidad)}`:''}</option>`).join('')}
      </select>
      ${vs.length ? '' : '<span class="ayuda">Todavía no hay ventas cargadas en esta obra.</span>'}</div>`,
    async ()=>{
      const estado = val('as-estado');
      const datos = { estado,
        inversor_id: ['asignada','reservada'].includes(estado) ? (val('as-inv')||null) : null,
        venta_id:    estado === 'vendida' ? (val('as-venta')||null) : null };
      cerrar();
      await guardar('unidades', datos, id);
    });
  tglAsignar();
}
function tglAsignar(){
  const e = document.getElementById('as-estado');
  if(!e) return;
  const wi = document.getElementById('wrap-as-inv');
  const wv = document.getElementById('wrap-as-venta');
  if(wi) wi.style.display = ['asignada','reservada'].includes(e.value) ? '' : 'none';
  if(wv) wv.style.display = e.value === 'vendida' ? '' : 'none';
}

function exportarUnidades(){
  const o = obra();
  const c = computo(o.id);
  const num = v => Math.round((+v||0)*100)/100;
  const filas = [['Unidad','Tipo','Piso','Cubierta','Semicubierta','Común','Superficie',
                  'Coeficiente','Ponderada','Porcentual','Costo asignado','Precio de lista',
                  'Estado','Inversor','Comprador','Nota']];
  cuadroUnidades(o.id).forEach(f=>{
    const u = f.u;
    filas.push([u.codigo, u.tipo, u.piso ?? '', num(u.sup_cubierta), num(u.sup_semicubierta),
      num(u.sup_comun), num(f.superficie), num(u.coeficiente), num(f.ponderada),
      num(f.porcentual), c && c.total ? num(c.total*f.porcentual/100) : '',
      u.precio_lista ? num(u.precio_lista) : '',
      (ESTADO_UNIDAD[u.estado]||[''])[0],
      u.inversor_id ? (inv(u.inversor_id)?.nombre||'') : '',
      u.venta_id ? (D.ventas.find(v=>v.id===u.venta_id)?.cliente||'') : '',
      u.nota||'']);
  });
  bajarExcel([{ nombre:'Unidades', filas }],
    `unidades-${o.nombre.replace(/\s+/g,'-').toLowerCase()}`);
}


/* =====================================================================
   Copiar las unidades del anteproyecto

   Los niveles ya tienen su superficie y cuántas unidades hay en cada
   uno, así que el sistema puede crearlas solo. Es la forma de que la
   carga quede completa: con unidades a medio cargar, el porcentual de
   cada una sale mal y el costo asignado también.

   El coeficiente queda en 1,00 a propósito. Que un cuarto piso valga
   más que un primero es una decisión comercial, no una fórmula.
   ===================================================================== */

const LETRAS_UNIDAD = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';

/* Qué unidades faltan, comparando con los niveles del anteproyecto */
function unidadesDelAnteproyecto(obraId){
  const ya = unidadesDe(obraId).map(u => u.codigo.trim().toLowerCase());
  const propuestas = [];

  nivelesDe(obraId).forEach(n => {
    const cuantas = +n.unidades || 0;
    if(!cuantas) return;
    const sup = (+n.cubierta || 0) + (+n.semicubierta || 0) + (+n.comun || 0);
    for(let i = 0; i < cuantas; i++){
      const codigo = cuantas === 1 ? n.nombre : `${n.nombre} ${LETRAS_UNIDAD[i] || (i + 1)}`;
      propuestas.push({
        codigo,
        nivel_id: n.id,
        nivel: n.nombre,
        sup: Math.round(sup / cuantas * 100) / 100,
        repartida: cuantas > 1,
        existe: ya.includes(codigo.trim().toLowerCase())
      });
    }
  });

  /* Las cocheras van aparte: no son unidades de un nivel */
  nivelesDe(obraId).forEach(n => {
    const m2 = (+n.coch_ss || 0) + (+n.coch_pb || 0);
    if(m2 > 0) propuestas.push({
      codigo: `Cocheras ${n.nombre}`, nivel_id: n.id, nivel: n.nombre,
      sup: m2, repartida: false, cochera: true,
      existe: ya.includes(`cocheras ${n.nombre}`.trim().toLowerCase())
    });
  });

  return propuestas;
}

/* Cuánto de la superficie vendible del análisis está cubierto por las
   unidades cargadas. Si no llega, el porcentual de cada una miente. */
function coberturaUnidades(obraId){
  const c = computo(obraId);
  if(!c || !c.vendible) return null;
  const cargada = unidadesDe(obraId)
    .reduce((s, u) => s + (+u.sup_cubierta || 0) + (+u.sup_semicubierta || 0) + (+u.sup_comun || 0), 0);
  const total = c.totalM2 || c.vendible;
  return { cargada, total, pct: total ? cargada / total * 100 : 0 };
}

function formGenerarUnidades(){
  const o = obra();
  const propuestas = unidadesDelAnteproyecto(o.id);
  const faltan = propuestas.filter(p => !p.existe);
  const repartidas = faltan.filter(p => p.repartida).length;

  if(!nivelesDe(o.id).length){
    return alert('Primero cargá los niveles en la solapa Análisis: de ahí salen las unidades.');
  }
  if(!propuestas.length){
    return alert('Ninguno de los niveles tiene unidades cargadas. Completá la columna Unidades en el Análisis.');
  }
  if(!faltan.length){
    return alert('Las unidades del anteproyecto ya están cargadas. No hay nada para copiar.');
  }

  modal('Copiar del anteproyecto', `
    <div class="campo ancho"><span class="ayuda">
      Se van a crear <strong>${faltan.length}</strong> unidad${faltan.length === 1 ? '' : 'es'}
      a partir de los niveles del análisis. Las que ya existen no se tocan.
    </span></div>
    <div class="campo ancho">
      <table><thead><tr><th>Unidad</th><th>Nivel</th><th class="der">Superficie</th></tr></thead>
      <tbody>
        ${propuestas.map(p => `<tr style="${p.existe ? 'opacity:.45' : ''}">
          <td>${esc(p.codigo)}${p.existe ? ' <span class="chip">ya existe</span>' : ''}</td>
          <td>${esc(p.nivel)}</td>
          <td class="der num">${m2f(p.sup)}</td></tr>`).join('')}
      </tbody></table>
    </div>
    <div class="campo ancho"><span class="ayuda">
      El coeficiente de valor queda en <strong>1,00</strong> en todas: que un piso alto
      valga más es una decisión tuya, no una fórmula. Se ajusta después, unidad por unidad.
      ${repartidas ? `<br><br>En los niveles con más de una unidad la superficie se reparte
        en partes iguales. Si hay un contrafrente más chico, corregilo a mano.` : ''}
    </span></div>`,
    async () => {
      const filas = faltan.map((p, i) => ({
        obra_id: o.id,
        nivel_id: p.nivel_id,
        codigo: p.codigo,
        tipo: p.cochera ? 'Cochera' : 'Departamento',
        sup_cubierta: p.sup,
        sup_semicubierta: 0,
        sup_comun: 0,
        coeficiente: 1,
        estado: 'disponible',
        orden: (unidadesDe(o.id).length + i) * 10
      }));
      document.getElementById('ok').disabled = true;
      cerrar();
      const { error } = await sb.from('unidades').insert(filas);
      if(error) return aviso('No se pudieron crear: ' + error.message, true);
      aviso(`${filas.length} unidad${filas.length === 1 ? '' : 'es'} creada${filas.length === 1 ? '' : 's'}`);
      await cargarDatos();
    });
}
