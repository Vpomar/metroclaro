/* =====================================================================
   vistas/documentos.js
   Pestaña Documentos (legajo)

   Script clásico: comparte el ámbito global con los demás archivos de
   js/. El orden de carga está en index.html (ver js/README.md).
   ===================================================================== */
/* ---------- Legajo de documentos ---------- */
const CATEGORIAS_DOC = {
  'Legales':      ['Contrato de fideicomiso','Adhesión al fideicomiso','Boleto de compraventa',
                   'Escritura','Reglamento','Acta','Seguro','Poder','Otro'],
  'Arquitectura': ['Plano','Permiso municipal','Memoria descriptiva','Pliego',
                   'Cómputo','Certificado','Relevamiento','Otro'],
  'Presupuestos': ['Presupuesto','Cotización','Comparativa','Orden de compra','Contrato con proveedor','Otro'],
  'Otros':        ['Otro']
};
const TIPOS_DOC = [...new Set(Object.values(CATEGORIAS_DOC).flat())];

function vDocumentos(o){
  const docs = docsDe(o.id).slice()
    .sort((a,b)=> (b.fecha||'').localeCompare(a.fecha||'') || b.creado_en.localeCompare(a.creado_en));

  let filas = '';
  const cats = Object.keys(CATEGORIAS_DOC)
    .map(cat => ({ cat, ds: docs.filter(d => (d.categoria||'Legales') === cat) }))
    .filter(x => x.ds.length);

  cats.forEach(({cat,ds}) => {
    filas += `<tr class="grupo-rubro"><td colspan="5">${esc(cat)}
      <span style="font-weight:400"> · ${ds.length} documento${ds.length===1?'':'s'}</span></td></tr>`;
    ds.forEach(d => {
      filas += `<tr>
        <td><strong>${esc(d.titulo)}</strong>
          <br><span class="pct">${esc(d.tipo)}</span>
          ${d.descripcion?`<br><span class="pct">${esc(d.descripcion)}</span>`:''}
          ${d.referencia?`<br><span class="pct num">${esc(d.referencia)}</span>`:''}</td>
        <td class="num">${d.fecha?fecha(d.fecha):'—'}</td>
        <td>${d.inversor_id
          ? `<span class="chip a">${esc(inv(d.inversor_id)?.nombre||'reservado')}</span>`
          : '<span class="pct">todos</span>'}
          ${d.unidad?`<br><span class="chip">${esc(d.unidad)}</span>`:''}</td>
        <td class="der"><button class="link" data-ruta="${esc(d.archivo)}" onclick="verArchivo(this.dataset.ruta)">Abrir</button></td>
        <td class="der">${puedeEditar()?`<button class="link" onclick="formDocumento('${d.id}')">Editar</button>`:''}
          ${esAdmin()?`<br><button class="link" onclick="borrar('documentos','${d.id}')">Eliminar</button>`:''}</td>
      </tr>`;
    });
  });

  const reservados = docs.filter(d=>d.inversor_id).length;

  return `
  ${puedeEditar()?`<div class="acciones">
    <button class="btn" onclick="formDocumento()">Subir documento</button></div>`:''}
  <p class="sub">El legajo de la obra: contrato de fideicomiso, adhesiones, boletos, escrituras,
  planos y permisos. Todo en un solo lugar, disponible para quien lo necesite.</p>

  ${docs.length ? `<table><thead><tr><th>Documento</th><th>Fecha</th>
    <th>Visible para</th><th class="der">Archivo</th><th></th></tr></thead>
    <tbody>${filas}</tbody></table>
    ${reservados?`<p class="sub" style="margin-top:12px">${reservados}
      documento${reservados===1?'':'s'} asignado${reservados===1?'':'s'} a un inversor:
      solo lo ve el equipo y esa persona. El resto de los inversores no lo ve.</p>`:''}`
    : `<div class="vacio">Todavía no hay documentos cargados en esta obra.</div>`}`;
}

function formDocumento(id){
  const o = obra();
  const d = id ? D.documentos.find(x=>x.id===id) : null, v = d || {};
  modal(d ? 'Editar documento' : 'Subir documento', `
    ${d ? '' : `<div class="lector" id="lector">
      <label for="doc-archivo">Archivo</label>
      <input id="doc-archivo" type="file" accept="application/pdf,image/*">
      <span class="ayuda">PDF o imagen. Queda guardado en el sistema, no en una carpeta suelta.</span>
    </div>`}
    <div class="campo ancho"><label for="doc-titulo">Título</label>
      <input id="doc-titulo" value="${esc(v.titulo||'')}" placeholder="Contrato de fideicomiso San Lorenzo 2634"></div>
    <div class="campo"><label for="doc-cat">Categoría</label>
      <select id="doc-cat" onchange="tiposDeCategoria()">
        ${Object.keys(CATEGORIAS_DOC).map(k=>
          `<option ${k===(v.categoria||'Legales')?'selected':''}>${k}</option>`).join('')}</select></div>
    <div class="campo"><label for="doc-tipo">Tipo</label>
      <select id="doc-tipo"></select></div>
    <div class="campo"><label for="doc-fecha">Fecha del documento</label>
      <input id="doc-fecha" type="date" value="${v.fecha||''}"></div>
    <div class="campo ancho"><label for="doc-ref">Referencia</label>
      <input id="doc-ref" value="${esc(v.referencia||'')}" placeholder="Escribanía, tomo y folio, número de acta — opcional"></div>
    <div class="campo"><label for="doc-inv">Inversor</label>
      <select id="doc-inv"><option value="">Visible para todos</option>
        ${partsDe(o.id).map(p=>inv(p.inversor_id)).filter(Boolean)
          .map(i=>`<option value="${i.id}" ${i.id===v.inversor_id?'selected':''}>${esc(i.nombre)}</option>`).join('')}
      </select>
      <span class="ayuda">Si elegís uno, solo él y el equipo lo ven.</span></div>
    <div class="campo"><label for="doc-unidad">Unidad</label>
      <input id="doc-unidad" value="${esc(v.unidad||'')}" placeholder="3ºB — opcional"></div>
    <div class="campo ancho"><label for="doc-desc">Descripción</label>
      <input id="doc-desc" value="${esc(v.descripcion||'')}" placeholder="Opcional"></div>`,
    async ()=>{
      const titulo = val('doc-titulo');
      if(!titulo) return err('Poné un título.');
      const f = d ? null : document.getElementById('doc-archivo').files?.[0];
      if(!d && !f) return err('Elegí el archivo.');
      const datos = { obra_id:o.id, titulo, categoria:val('doc-cat'), tipo:val('doc-tipo'),
        fecha: val('doc-fecha') || null, referencia:val('doc-ref'),
        inversor_id: val('doc-inv') || null, unidad:val('doc-unidad'),
        descripcion:val('doc-desc'), creado_por: perfil.id };
      document.getElementById('ok').disabled = true;
      if(f){
        err('Subiendo el archivo…');
        const ruta = await subirArchivo('documentos', f, o.id);
        if(!ruta){ document.getElementById('ok').disabled = false; return err('No se pudo subir el archivo.'); }
        datos.archivo = ruta;
      }
      cerrar();
      await guardar('documentos', datos, d?.id);
    });
  tiposDeCategoria(v.tipo);
}

function tiposDeCategoria(elegido){
  const c = document.getElementById('doc-cat'), t = document.getElementById('doc-tipo');
  if(!c || !t) return;
  const lista = CATEGORIAS_DOC[c.value] || ['Otro'];
  t.innerHTML = lista.map(x=>`<option ${x===elegido?'selected':''}>${x}</option>`).join('');
}

