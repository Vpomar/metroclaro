/* =====================================================================
   nucleo/escritura.js
   Escritura: guardar, borrar y cambios directos (verifican las filas afectadas)

   Script clásico: comparte el ámbito global con los demás archivos de
   js/. El orden de carga está en index.html (ver js/README.md).
   ===================================================================== */
/* =====================================================================
   ESCRITURA
   ===================================================================== */
const SIN_EFECTO = 'No se hizo ningún cambio: tu usuario no tiene permiso o el registro ya no existe.';

async function guardar(tabla, datos, id){
  if('nombre' in datos && !String(datos.nombre||'').trim()){
    aviso('No se guardó: el nombre quedó vacío.', true);
    return false;
  }
  const q = id ? sb.from(tabla).update(datos).eq('id', id)
               : sb.from(tabla).insert(datos);
  // .select() devuelve las filas afectadas. Si el RLS no deja tocar el
  // registro, la base no da error: simplemente no afecta ninguna fila.
  const { data, error } = await q.select('id');
  if(error){ aviso('No se pudo guardar: ' + error.message, true); return false; }
  if(!data?.length){ aviso(SIN_EFECTO, true); return false; }
  aviso('Guardado');
  await cargarDatos();
  return true;
}
async function borrar(tabla, id){
  if(!confirm('¿Eliminar este registro? No se puede deshacer.')) return;
  const { data, error } = await sb.from(tabla).delete().eq('id', id).select('id');
  if(error){ aviso('No se pudo eliminar: ' + error.message, true); return; }
  if(!data?.length){ aviso(SIN_EFECTO, true); return; }
  aviso('Eliminado');
  await cargarDatos();
}

async function setPresu(rubroId, v){
  const monto = parseFloat(v)||0;
  // Un presupuesto en 0 se guarda como 0 en vez de borrar la fila:
  // carga puede editar presupuestos pero no borrar (N-01).
  const { error } = await sb.from('presupuestos')
    .upsert({ obra_id:obraActiva, rubro_id:rubroId, monto_usd:monto });
  if(error) return aviso('No se pudo guardar: ' + error.message, true);
  await cargarDatos();
}
async function setPctHon(columna, v){
  await guardar('obras', { [columna]: parseFloat(v)||0 }, obraActiva);
}
async function setClase(letra, campo, v){
  const c = D.clases.find(x=>x.obra_id===obraActiva && x.letra===letra);
  const valor = campo==='coeficiente' ? (parseFloat(v)||0) : v.trim();
  if(c) await guardar('clases', { [campo]: valor }, c.id);
  else await guardar('clases', { obra_id:obraActiva, letra, [campo]: valor });
}

