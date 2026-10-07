/* =====================================================================
   formularios/avance-archivos.js
   Formulario de avance, subida y apertura de archivos

   Script clásico: comparte el ámbito global con los demás archivos de
   js/. El orden de carga está en index.html (ver js/README.md).
   ===================================================================== */
/* ---------- avance ---------- */
function formAvance(){
  const o = obra();
  modal('Cargar foto de avance', `
    <div class="lector" id="lector">
      <label for="foto-av">Fotografía</label>
      <input id="foto-av" type="file" accept="image/*" capture="environment">
      <span class="ayuda">Se guarda en el sistema y aparece en la rendición al inversor.</span>
    </div>
    <div class="campo"><label for="f">Fecha</label><input id="f" type="date" value="${hoy()}"></div>
    <div class="campo"><label for="pc">Avance declarado %</label>
      <input id="pc" type="number" min="0" max="100" step="1" placeholder="Opcional"></div>
    <div class="campo ancho"><label for="ti">Título</label>
      <input id="ti" placeholder="Hormigonado de losa del primer piso"></div>
    <div class="campo ancho"><label for="de">Descripción</label>
      <input id="de" placeholder="Opcional"></div>`,
    async ()=>{
      const f = document.getElementById('foto-av').files?.[0];
      if(!f) return err('Elegí una foto.');
      document.getElementById('ok').disabled = true;
      err('Subiendo la foto…');
      const ruta = await subirArchivo('avance', f, o.id);
      if(!ruta){ document.getElementById('ok').disabled = false; return err('No se pudo subir la foto.'); }
      const datos = { obra_id:o.id, fecha:val('f'), titulo:val('ti'),
        descripcion:val('de'), pct_avance: val('pc') ? parseFloat(val('pc')) : null,
        archivo: ruta, creado_por: perfil.id };
      cerrar();
      await guardar('avances', datos);
    });
}

/* ---------- archivos ---------- */
let archivoPendiente = null;

async function subirArchivo(bucket, file, obraId){
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const ruta = `${obraId}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
  const { error } = await sb.storage.from(bucket).upload(ruta, file, { upsert:false });
  if(error){ aviso('No se pudo subir el archivo: ' + error.message, true); return null; }
  return `${bucket}/${ruta}`;
}
async function verArchivo(ruta){
  const i = ruta.indexOf('/');
  const { data, error } = await sb.storage.from(ruta.slice(0,i))
    .createSignedUrl(ruta.slice(i+1), 300);
  if(error) return aviso('No se pudo abrir el archivo.', true);
  window.open(data.signedUrl, '_blank', 'noopener');
}
async function pintarFotos(){
  for(const img of document.querySelectorAll('img[data-ruta]')){
    const ruta = img.dataset.ruta;
    if(!ruta || img.src) continue;
    const i = ruta.indexOf('/');
    const { data } = await sb.storage.from(ruta.slice(0,i))
      .createSignedUrl(ruta.slice(i+1), 600);
    if(data) img.src = data.signedUrl;
  }
}
new MutationObserver(() => { if(vista==='avance') pintarFotos(); })
  .observe(document.getElementById('cuerpo'), { childList:true });

