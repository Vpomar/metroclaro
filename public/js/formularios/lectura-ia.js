/* =====================================================================
   formularios/lectura-ia.js
   Lectura de comprobantes con IA (Edge Function leer-comprobante)

   Script clásico: comparte el ámbito global con los demás archivos de
   js/. El orden de carga está en index.html (ver js/README.md).
   ===================================================================== */
/* ---------- lectura del comprobante ---------- */
async function leerComprobante(input){
  const f = input.files?.[0]; if(!f) return;
  const box = document.getElementById('lector'), est = document.getElementById('foto-estado');
  if(f.size > 8*1024*1024){ est.textContent = 'La imagen pesa demasiado. Probá con una más liviana.'; return; }
  archivoPendiente = f;
  box.classList.add('leyendo');
  est.textContent = 'Leyendo el comprobante…';
  try{
    const b64 = await new Promise((res,rej)=>{
      const r = new FileReader();
      r.onload = ()=>res(r.result.split(',')[1]);
      r.onerror = ()=>rej(new Error('lectura'));
      r.readAsDataURL(f);
    });
    const { data, error } = await sb.functions.invoke('leer-comprobante', {
      body: { archivo: b64, tipo: f.type, rubros: D.rubros.map(r=>r.nombre) }
    });
    if(error) throw error;
    if(data.error) throw new Error(data.error);

    const set = (id,v) => { if(v!=null && v!=='') document.getElementById(id).value = v; };
    set('f', data.fecha); set('prov', data.proveedor); set('cuit', data.cuit);
    set('nro', data.nro); set('det', data.detalle); set('imp', data.importe);
    set('neto', data.neto); set('iva', data.iva); set('perc', data.percepciones);
    if(data.tipo){ const s=document.getElementById('tipo');
      [...s.options].forEach(op => { if(op.text===data.tipo) s.value = op.value||op.text; }); }
    if(data.moneda){ document.getElementById('mon').value = data.moneda; tglCotiz(); }
    if(data.rubro){ const rr = D.rubros.find(x=>x.nombre===data.rubro);
      if(rr) document.getElementById('rub').value = rr.id; }
    if(data.aviso) console.warn(data.aviso);
    const faltan = ['proveedor','importe','fecha'].filter(k=>!data[k]);
    est.textContent = faltan.length
      ? `Leí el comprobante pero no saqué: ${faltan.join(', ')}. Completalo a mano.`
      : (data.aviso || 'Listo. Revisá el rubro y el importe. La imagen se guarda con el asiento.');
    calcularIva();
  }catch(e){
    est.textContent = 'No pude leer el comprobante, pero la imagen se guarda igual. Cargá los datos a mano.';
  }
  box.classList.remove('leyendo');
}

