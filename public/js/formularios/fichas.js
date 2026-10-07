/* =====================================================================
   formularios/fichas.js
   Formularios de inversor, participación, caja, rubro y obra

   Script clásico: comparte el ámbito global con los demás archivos de
   js/. El orden de carga está en index.html (ver js/README.md).
   ===================================================================== */
/* ---------- inversor, caja, rubro, obra ---------- */
function formParticipacion(id){
  const o = obra();
  const p = id ? D.participaciones.find(x=>x.id===id) : null;
  const yaEstan = partsDe(o.id).map(x=>x.inversor_id);
  const libres = D.inversores.filter(i => !yaEstan.includes(i.id));
  const cl = clasesDe(o.id);

  modal(p ? 'Participación en esta obra' : 'Sumar inversor a esta obra', `
    ${p ? `<div class="campo ancho"><label>Inversor</label>
        <p style="font-size:15px;font-weight:600;margin:2px 0 0">${esc(inv(p.inversor_id)?.nombre||'')}</p>
        <button class="link" style="margin-top:4px"
          onclick="cerrar();formInversor('${p.inversor_id}')">Editar sus datos personales</button></div>`
      : `<div class="campo ancho"><label for="pa-quien">Quién</label>
        <select id="pa-quien" onchange="tglNuevoInversor()">
          ${libres.map(i=>`<option value="${i.id}">${esc(i.nombre)}</option>`).join('')}
          <option value="__nuevo">— Cargar un inversor nuevo —</option>
        </select>
        <span class="ayuda">Elegí uno ya cargado en el estudio o creá uno nuevo.</span></div>
        <div class="campo ancho" id="wrap-nuevo" style="display:none">
          <label for="pa-nombre">Nombre del inversor nuevo</label>
          <input id="pa-nombre" placeholder="Nombre o razón social">
          <span class="ayuda">Queda disponible para sumarlo también a otras obras.</span></div>`}
    <div class="campo"><label for="pa-ca">Suscripto en ${esc(cl.A.nombre)}</label>
      <input id="pa-ca" type="number" min="0" step="1000" value="${p?(+p.comp_a||''):''}" placeholder="0"></div>
    <div class="campo"><label for="pa-cb">Suscripto en ${esc(cl.B.nombre)}</label>
      <input id="pa-cb" type="number" min="0" step="1000" value="${p?(+p.comp_b||''):''}" placeholder="0"></div>
    <div class="campo ancho"><label for="pa-nota">Nota</label>
      <input id="pa-nota" value="${p?esc(p.nota||''):''}" placeholder="Opcional"></div>`,
    async ()=>{
      const comp_a = parseFloat(val('pa-ca'))||0, comp_b = parseFloat(val('pa-cb'))||0;
      const nota = val('pa-nota');
      if(p){ cerrar(); return guardar('participaciones', { comp_a, comp_b, nota }, p.id); }

      let invId = val('pa-quien');
      if(invId === '__nuevo'){
        const nombre = val('pa-nombre');
        if(!nombre) return err('Poné el nombre del inversor.');
        document.getElementById('ok').disabled = true;
        const { data, error } = await sb.from('inversores').insert({ nombre }).select('id').single();
        if(error){ document.getElementById('ok').disabled = false;
          return err('No se pudo crear el inversor: ' + error.message); }
        invId = data.id;
      }
      if(!invId) return err('Elegí un inversor.');
      cerrar();
      await guardar('participaciones', { obra_id:o.id, inversor_id:invId, comp_a, comp_b, nota });
    });
  tglNuevoInversor();
}
function tglNuevoInversor(){
  const q = document.getElementById('pa-quien'), w = document.getElementById('wrap-nuevo');
  if(!q || !w) return;
  w.style.display = (q.value === '__nuevo' || q.options.length === 1) ? '' : 'none';
}
async function quitarDeObra(id, nombre){
  if(!confirm(`Quitar a ${nombre} de esta obra? La ficha del inversor se conserva y sus aportes en otras obras no se tocan.`)) return;
  const { data, error } = await sb.from('participaciones').delete().eq('id', id).select('id');
  if(error) return aviso('No se pudo quitar: ' + error.message, true);
  if(!data?.length) return aviso(SIN_EFECTO, true);
  aviso('Quitado de la obra');
  await cargarDatos();
}

function formInversor(id){
  const i = id ? D.inversores.find(x=>x.id===id) : null;
  const enObras = i ? D.participaciones.filter(p=>p.inversor_id===i.id)
    .map(p=>D.obras.find(o=>o.id===p.obra_id)?.nombre).filter(Boolean) : [];
  modal(i ? 'Datos del inversor' : 'Nuevo inversor', `
    <div class="campo ancho"><label for="n">Nombre</label>
      <input id="n" value="${i?esc(i.nombre):''}" placeholder="Nombre o razón social"></div>
    <div class="campo"><label for="cu">CUIT</label><input id="cu" value="${i?esc(i.cuit||''):''}"></div>
    <div class="campo"><label for="em">Email</label><input id="em" type="email" value="${i?esc(i.email||''):''}"></div>
    <div class="campo ancho"><span class="ayuda">${enObras.length
      ? `Participa en: ${esc(enObras.join(', '))}. El capital suscripto de cada obra se edita desde la obra.`
      : 'El capital suscripto se carga al sumarlo a una obra.'}</span></div>`,
    async ()=>{
      if(!val('n')) return err('Poné un nombre.');
      const datos = { nombre:val('n'), cuit:val('cu'), email:val('em') };
      cerrar();
      await guardar('inversores', datos, i?.id);
    });
}

function formCaja(id){
  const c = id ? D.cajas.find(x=>x.id===id) : null;
  const usos = c ? D.comprobantes.filter(g=>g.caja_id===c.id).length
                 + D.aportes.filter(a=>a.caja_id===c.id).length : 0;
  modal(c ? 'Editar caja' : 'Agregar caja', `
    <div class="campo ancho"><label for="n">Nombre</label>
      <input id="n" value="${c?esc(c.nombre):''}" placeholder="Refuerzo hormigón"></div>
    <div class="campo ancho"><label for="d">Detalle</label>
      <input id="d" value="${c?esc(c.detalle||''):''}" placeholder="Opcional"></div>
    ${c ? `<div class="campo ancho"><span class="ayuda">${usos
      ? `Tiene ${usos} movimiento${usos===1?'':'s'}. Se puede renombrar, no eliminar.`
      : 'Sin movimientos.'}</span>
      ${usos||!esAdmin() ? '' : `<button class="btn sec" style="margin-top:8px"
        onclick="cerrar();borrar('cajas','${c.id}')">Eliminar esta caja</button>`}</div>` : ''}`,
    async ()=>{
      if(!val('n')) return err('Poné un nombre.');
      const datos = c ? { nombre:val('n'), detalle:val('d') }
                      : { obra_id:obraActiva, nombre:val('n'), detalle:val('d') };
      cerrar();
      await guardar('cajas', datos, c?.id);
    });
}

function renombrarGrupo(actual){
  modal('Renombrar grupo', `
    <div class="campo ancho"><label for="gr-nombre">Nombre del grupo</label>
      <input id="gr-nombre" value="${esc(actual)}"></div>
    <div class="campo ancho"><span class="ayuda">Cambia en todos los rubros del grupo,
      en todas las obras. Los movimientos ya cargados no se tocan.</span></div>`,
    async ()=>{
      const nuevo = val('gr-nombre');
      if(!nuevo) return err('Poné un nombre.');
      if(nuevo === actual) return cerrar();
      cerrar();
      const { data, error } = await sb.from('rubros').update({ grupo:nuevo }).eq('grupo', actual).select('id');
      if(error) return aviso('No se pudo renombrar: ' + error.message, true);
      if(!data?.length) return aviso(SIN_EFECTO, true);
      aviso('Grupo renombrado');
      await cargarDatos();
    });
}

function nuevoGrupo(){
  modal('Agregar grupo', `
    <div class="campo ancho"><label for="gr-nuevo">Nombre del grupo</label>
      <input id="gr-nuevo" placeholder="Instalaciones especiales"></div>
    <div class="campo ancho"><label for="gr-rubro">Primer rubro del grupo</label>
      <input id="gr-rubro" placeholder="Ascensores"></div>
    <div class="campo ancho"><label for="gr-base">Integra la base de honorarios</label>
      <select id="gr-base"><option value="si">Sí</option><option value="no">No</option></select>
      <span class="ayuda">Un grupo existe mientras tenga al menos un rubro.</span></div>`,
    async ()=>{
      const grupo = val('gr-nuevo'), nombre = val('gr-rubro');
      if(!grupo)  return err('Poné el nombre del grupo.');
      if(!nombre) return err('Poné al menos un rubro para el grupo.');
      cerrar();
      await guardar('rubros', { grupo, nombre, base_honorarios: val('gr-base')==='si',
        orden: (D.rubros.reduce((m,r)=>Math.max(m,r.orden||0),0)) + 10 });
    });
}

function formRubro(id){
  const r = id ? D.rubros.find(x=>x.id===id) : null;
  const grupos = [...new Set(D.rubros.map(x=>x.grupo))];
  const usos = r ? D.comprobantes.filter(g=>g.rubro_id===r.id).length : 0;
  modal(r ? 'Editar rubro' : 'Agregar rubro', `
    <div class="campo ancho"><label for="n">Nombre del rubro</label>
      <input id="n" value="${r?esc(r.nombre):''}" placeholder="Ascensores"></div>
    <div class="campo"><label for="g">Grupo</label><select id="g" onchange="tglGrupoNuevo()">
      ${grupos.map(g=>`<option ${r&&r.grupo===g?'selected':''}>${esc(g)}</option>`).join('')}
      <option value="__nuevo">— Grupo nuevo —</option></select></div>
    <div class="campo" id="wrap-grupo" style="display:none">
      <label for="g-nuevo">Nombre del grupo nuevo</label><input id="g-nuevo"></div>
    <div class="campo"><label for="b">Integra la base de honorarios</label>
      <select id="b"><option value="si" ${!r||r.base_honorarios?'selected':''}>Sí</option>
      <option value="no" ${r&&!r.base_honorarios?'selected':''}>No</option></select></div>
    ${r ? `<div class="campo ancho"><span class="ayuda">${usos
      ? `Tiene ${usos} comprobante${usos===1?'':'s'} imputado${usos===1?'':'s'}. Se puede renombrar o archivar.`
      : 'Sin comprobantes imputados.'}</span>
      ${esAdmin() ? `<button class="btn sec" style="margin-top:8px"
        onclick="cerrar();archivarRubro('${r.id}')">Archivar este rubro</button>` : ''}</div>` : ''}`,
    async ()=>{
      if(!val('n')) return err('Poné un nombre.');
      const grupo = val('g') === '__nuevo' ? val('g-nuevo') : val('g');
      if(!grupo) return err('Poné el nombre del grupo.');
      const datos = { nombre:val('n'), grupo, base_honorarios: val('b')==='si' };
      cerrar();
      await guardar('rubros', datos, r?.id);
    });
  tglGrupoNuevo();
}
function tglGrupoNuevo(){
  const g = document.getElementById('g'), w = document.getElementById('wrap-grupo');
  if(g&&w) w.style.display = g.value === '__nuevo' ? '' : 'none';
}
async function archivarRubro(id){
  if(!confirm('El rubro deja de aparecer al cargar, pero los movimientos históricos se conservan. ¿Seguir?')) return;
  await guardar('rubros', { activo:false }, id);
}

function nuevaObra(){
  modal('Agregar obra', `<div class="campo ancho"><label for="n">Nombre de la obra</label>
    <input id="n" placeholder="Edificio Fideicomiso San Lorenzo 2634"></div>`,
    async ()=>{
      if(!val('n')) return err('Poné un nombre.');
      const nombre = val('n'); cerrar();
      const { data, error } = await sb.rpc('nueva_obra', { p_nombre: nombre });
      if(error) return aviso('No se pudo crear: ' + error.message, true);
      obraActiva = data; aviso('Obra creada'); await cargarDatos();
    });
}
function renombrarObra(){
  const o = obra();
  modal('Renombrar obra', `<div class="campo ancho"><label for="n">Nombre de la obra</label>
    <input id="n" value="${esc(o.nombre)}"></div>`,
    async ()=>{
      if(!val('n')) return err('El nombre no puede quedar vacío.');
      const nombre = val('n'); cerrar();
      await guardar('obras', { nombre }, o.id);
    });
}
async function eliminarObra(){
  const o = obra();
  const n = gastosDe(o.id).length + aportesDe(o.id).length;
  if(!confirm(`"${o.nombre}" tiene ${n} movimiento${n===1?'':'s'}. Se borra todo. ¿Seguir?`)) return;
  const { data, error } = await sb.from('obras').delete().eq('id', o.id).select('id');
  if(error) return aviso('No se pudo eliminar: ' + error.message, true);
  if(!data?.length) return aviso(SIN_EFECTO, true);
  obraActiva = null; aviso('Obra eliminada'); await cargarDatos();
}

