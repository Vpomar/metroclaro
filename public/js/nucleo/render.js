/* =====================================================================
   nucleo/render.js
   Dibujo de la pantalla: pestañas, lista de obras y navegación

   Script clásico: comparte el ámbito global con los demás archivos de
   js/. El orden de carga está en index.html (ver js/README.md).
   ===================================================================== */
/* =====================================================================
   RENDER
   ===================================================================== */
function render(){
  try{ dibujar(); }
  catch(e){
    document.getElementById('cuerpo').innerHTML =
      `<div class="vacio" style="text-align:left;border-color:var(--rojo);color:var(--tinta)">
        <strong>Algo falló al dibujar la pantalla.</strong>
        <p style="font-size:12.5px;color:var(--gris)">${esc(e.message)}</p></div>`;
    console.error(e);
  }
}

function dibujar(){
  if(!D) return;
  document.getElementById('sub-obras').textContent =
    D.obras.length + (D.obras.length===1 ? ' obra activa' : ' obras activas');
  document.getElementById('lista-obras').innerHTML = D.obras.map(o => {
    const t = totalesObra(o.id);
    return `<button class="obra-btn ${o.id===obraActiva && vista!=='panel' && vista!=='usuarios' ?'on':''}"
      onclick="verObra('${o.id}')">
      <span>${esc(o.nombre)}</span><small class="num">${fmtUsd(t.egr)}</small></button>`;
  }).join('');

  const enPanel = vista === 'panel' || vista === 'usuarios' || vista === 'indices';
  const TABS = enPanel
    ? [['panel','Panel']]
        .concat(puedeEditar() ? [['indices','Índices']] : [])
        .concat(esAdmin() ? [['usuarios','Usuarios']] : [])
    : [['resumen','Resumen'],['cajas','Cajas'],['gastos','Comprobantes'],
       ['rubros','Rubros'],['honorarios','Honorarios'],['proveedores','Proveedores'],
       ['analisis','Análisis'],['unidades','Unidades'],['inversores','Inversores'],['ventas','Ventas'],['avance','Avance'],['documentos','Documentos'],
       ['contador','Contador'],['rendicion','Rendición']]
       .concat(puedeEditar() ? [['historial','Historial']] : []);
  document.getElementById('tabs').innerHTML = TABS.map(([k,n]) =>
    `<button class="tab ${vista===k?'on':''}" onclick="verTab('${k}')">${n}</button>`).join('');

  document.getElementById('btn-ver-panel').classList.toggle('on', enPanel);

  const o = obra();
  document.getElementById('titulo').textContent = enPanel
    ? (vista==='usuarios' ? 'Usuarios' : vista==='indices' ? 'Índices' : 'Panel general')
    : (o ? o.nombre : 'Sin obras');
  ['btn-renombrar','btn-borrar-obra'].forEach(id => {
    const b = document.getElementById(id); if(b) b.style.display = (o && !enPanel) ? '' : 'none';
  });
  document.getElementById('btn-panel').style.display = enPanel ? 'none' : '';

  document.getElementById('cuerpo').innerHTML =
      vista === 'panel'    ? vPanel()
    : vista === 'indices'  ? vIndices()
    : vista === 'usuarios' ? vUsuarios()
    : !o ? `<div class="vacio">No hay obras visibles para tu usuario.</div>`
    : ({resumen:vResumen,cajas:vCajas,gastos:vGastos,rubros:vRubros,honorarios:vHonorarios,
        proveedores:vProveedores,inversores:vInversores,avance:vAvance,
        contador:vContador,rendicion:vRendicion,documentos:vDocumentos,
        ventas:vVentas,analisis:vAnalisis,unidades:vUnidades,historial:vHistorial}[vista])(o);
  pintarFuente();
}
function verObra(id){ obraActiva = id; if(vista==='panel') vista = 'resumen'; render(); }
function verTab(k){ vista = k; render(); }

