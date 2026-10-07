/* =====================================================================
   vistas/control.js
   Historial de cambios, cierre de período y enlaces de rendición

   Script clásico: comparte el ámbito global con los demás archivos de
   js/. El orden de carga está en index.html (ver js/README.md).
   ===================================================================== */
/* ---------- Historial de cambios ---------- */
const CAMPOS_OCULTOS = ['id','obra_id','creado_por','creado_en','usd'];
const NOMBRE_CAMPO = { caja_id:'caja', rubro_id:'rubro', inversor_id:'inversor',
  fecha_pago:'fecha de pago', afecta_caja:'tratamiento', comp_a:'suscripto A',
  comp_b:'suscripto B', pct_conduccion:'% conducción', pct_administracion:'% administración',
  percepciones:'percepciones', numero:'número' };

function valorLegible(campo, v){
  if(v === null || v === '' || v === undefined) return '—';
  if(campo === 'caja_id')     return caja(v)?.nombre || v.slice(0,8);
  if(campo === 'rubro_id')    return rubro(v)?.nombre || v.slice(0,8);
  if(campo === 'inversor_id') return inv(v)?.nombre || v.slice(0,8);
  if(campo === 'afecta_caja') return v ? 'costo de obra' : 'solo informativo';
  if(typeof v === 'boolean')  return v ? 'sí' : 'no';
  return String(v);
}

function diferencias(a, d){
  if(!a) return [];
  if(!d) return [];
  return Object.keys(d)
    .filter(k => !CAMPOS_OCULTOS.includes(k) && String(a[k]) !== String(d[k]))
    .map(k => ({ campo: NOMBRE_CAMPO[k] || k.replace(/_/g,' '),
                 antes: valorLegible(k, a[k]), despues: valorLegible(k, d[k]) }));
}

async function cargarHistorial(obraId){
  const { data, error } = await sb.from('auditoria').select('*')
    .eq('obra_id', obraId).order('cuando', { ascending:false }).limit(200);
  if(error){ aviso('No se pudo leer el historial: ' + error.message, true); historial = []; }
  else historial = data;
  historialObra = obraId;
  render();
}

function vHistorial(o){
  if(historial === null || historialObra !== o.id){
    cargarHistorial(o.id);
    return `<div class="vacio">Cargando historial…</div>`;
  }
  const TABLA = { comprobantes:'Comprobante', aportes:'Aporte', inversores:'Inversor',
                  obras:'Obra', documentos:'Documento' };
  const ACCION = { alta:['Alta','v'], cambio:['Modificación','a'], baja:['Baja','r'] };

  return `
  <div class="acciones">
    <button class="btn sec" onclick="cargarHistorial('${o.id}')">Actualizar</button>
  </div>
  <p class="sub">Cada alta, cambio y baja de esta obra, con quién la hizo. El historial no se
  puede editar ni borrar, ni siquiera por un administrador. Se muestran los últimos 200 movimientos.</p>

  ${historial.length ? `<table><thead><tr><th>Cuándo</th><th>Quién</th><th>Qué</th>
    <th>Detalle</th></tr></thead><tbody>
    ${historial.map(h=>{
      const d = h.despues || h.antes || {};
      const ref = d.proveedor || d.titulo || d.nombre ||
        (h.tabla==='aportes' ? (inv(d.inversor_id)?.nombre || 'aporte') : '');
      const monto = d.importe ? (d.moneda==='USD'?fmtUsd2(d.importe):fmtArs(d.importe)) : '';
      const difs = h.accion==='cambio' ? diferencias(h.antes, h.despues) : [];
      const [etiqueta, color] = ACCION[h.accion];
      return `<tr>
        <td class="num">${new Date(h.cuando).toLocaleDateString('es-AR')}
          <br><span class="pct num">${new Date(h.cuando).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}</span></td>
        <td>${esc(h.usuario||'—')}</td>
        <td><span class="chip ${color}">${etiqueta}</span>
          <br><span class="pct">${TABLA[h.tabla]||h.tabla}</span></td>
        <td>${esc(ref)}${monto?` · <span class="num">${monto}</span>`:''}
          ${difs.length ? `<br>${difs.slice(0,6).map(x=>
            `<span class="pct">${esc(x.campo)}: ${esc(x.antes)} → <strong>${esc(x.despues)}</strong></span>`
            ).join('<br>')}` : ''}
          ${h.accion==='cambio' && !difs.length ? '<br><span class="pct">sin cambios de fondo</span>' : ''}
        </td></tr>`;
    }).join('')}
    </tbody></table>` : `<div class="vacio">Todavía no hay movimientos registrados en esta obra.</div>`}`;
}

/* ---------- Cierre de período ---------- */
function bloqueCierre(o){
  const hasta = cierreDe(o.id);
  const cs = D.cierres.filter(c=>c.obra_id===o.id).sort((a,b)=>b.hasta.localeCompare(a.hasta));
  return `
  <h3 class="no-imprimir">Cierre de período</h3>
  <p class="sub no-imprimir">Una vez rendido un mes, sus movimientos quedan bloqueados:
  no se editan, no se borran y no se pueden agregar nuevos con fecha anterior.
  ${hasta ? `<strong>Cerrado hasta el ${fecha(hasta)}.</strong>` : 'Todavía no hay ningún cierre.'}</p>
  ${esAdmin() ? `<div class="acciones no-imprimir">
    <button class="btn sec" onclick="formCierre()">Cerrar un período</button>
    ${cs.length?`<button class="btn sec" onclick="reabrirCierre('${cs[0].id}','${cs[0].hasta}')">Reabrir el último</button>`:''}
  </div>` : ''}
  ${cs.length ? `<table class="no-imprimir"><thead><tr><th>Cerrado hasta</th><th>Nota</th>
    <th>Cuándo</th></tr></thead><tbody>
    ${cs.map(c=>`<tr><td class="num"><strong>${fecha(c.hasta)}</strong></td>
      <td>${esc(c.nota||'—')}</td>
      <td class="num">${new Date(c.cerrado_en).toLocaleDateString('es-AR')}</td></tr>`).join('')}
    </tbody></table>` : ''}`;
}

function formCierre(){
  const o = obra();
  modal('Cerrar período', `
    <div class="campo ancho"><label for="ci-hasta">Cerrar hasta la fecha</label>
      <input id="ci-hasta" type="date" value="${hoy()}">
      <span class="ayuda">Todos los movimientos con fecha igual o anterior quedan bloqueados.</span></div>
    <div class="campo ancho"><label for="ci-nota">Nota</label>
      <input id="ci-nota" placeholder="Rendición de septiembre entregada a los inversores"></div>`,
    async ()=>{
      const hasta = val('ci-hasta');
      if(!hasta) return err('Elegí la fecha.');
      const nota = val('ci-nota');
      cerrar();
      const { error } = await sb.from('cierres').insert({ obra_id:o.id, hasta, nota, cerrado_por:perfil.id });
      if(error) return aviso('No se pudo cerrar: ' + error.message, true);
      aviso('Período cerrado');
      await cargarDatos();
    });
}

async function reabrirCierre(id, hasta){
  if(!confirm(`Reabrir el período cerrado hasta ${fecha(hasta)}? Los movimientos vuelven a ser editables. La reapertura queda registrada.`)) return;
  const { data, error } = await sb.from('cierres').delete().eq('id', id).select('id');
  if(error) return aviso('No se pudo reabrir: ' + error.message, true);
  if(!data?.length) return aviso(SIN_EFECTO, true);
  aviso('Período reabierto');
  await cargarDatos();
}

/* ---------- Enlaces de rendición para el inversor ---------- */
function bloqueEnlaces(o){
  if(!puedeEditar()) return '';
  const es = enlacesDe(o.id);
  const activos = es.filter(e => e.activo &&
    (!e.vence || e.vence >= hoy()));

  return `
  <div class="no-imprimir">
    <h3>Enlaces para inversores</h3>
    <p class="sub">Le mandás el enlace y ve su rendición sin usuario ni contraseña.
    Es de solo lectura, se actualiza solo y lo podés dar de baja cuando quieras.</p>
    <div class="acciones">
      <button class="btn sec" onclick="formEnlace()">Generar enlace</button>
    </div>
    ${es.length ? `<table><thead><tr><th>Inversor</th><th>Estado</th>
      <th class="ocultar-chico">Visitas</th><th class="ocultar-chico">Vence</th>
      <th></th></tr></thead><tbody>
      ${es.slice().sort((a,b)=>b.creado_en.localeCompare(a.creado_en)).map(e=>{
        const vencido = e.vence && e.vence < hoy();
        return `<tr>
          <td><strong>${esc(inv(e.inversor_id)?.nombre||'—')}</strong>
            ${e.titulo?`<br><span class="pct">${esc(e.titulo)}</span>`:''}</td>
          <td>${!e.activo ? '<span class="chip r">Dado de baja</span>'
               : vencido ? '<span class="chip a">Vencido</span>'
               : '<span class="chip v">Activo</span>'}</td>
          <td class="der num ocultar-chico">${e.visitas||0}
            ${e.ultima_visita?`<br><span class="pct">${new Date(e.ultima_visita).toLocaleDateString('es-AR')}</span>`:''}</td>
          <td class="num ocultar-chico">${e.vence?fecha(e.vence):'sin vencimiento'}</td>
          <td class="der">
            ${e.activo && !vencido ? `<button class="link" data-token="${esc(e.token)}" onclick="copiarEnlace(this.dataset.token)">Copiar enlace</button>` : ''}
            ${e.activo ? `<br><button class="link" onclick="bajaEnlace('${e.id}')">Dar de baja</button>` : ''}
          </td></tr>`;
      }).join('')}
    </tbody></table>
    ${activos.length ? '' : '<p class="sub">Ningún enlace activo en este momento.</p>'}`
    : ''}
  </div>`;
}

function formEnlace(){
  const o = obra();
  const invObra = partsDe(o.id).map(p=>inv(p.inversor_id)).filter(Boolean)
    .sort((a,b)=>a.nombre.localeCompare(b.nombre));
  if(!invObra.length) return alert('Primero sumá inversores a esta obra.');
  const enTres = sumarMeses(hoy(), 3);

  modal('Generar enlace de rendición', `
    <div class="campo ancho"><label for="en-inv">Inversor</label>
      <select id="en-inv">${invObra.map(i=>`<option value="${i.id}">${esc(i.nombre)}</option>`).join('')}</select></div>
    <div class="campo"><label for="en-vence">Vence el</label>
      <input id="en-vence" type="date" value="${enTres}"></div>
    <div class="campo"><label for="en-titulo">Referencia</label>
      <input id="en-titulo" placeholder="Opcional"></div>
    <div class="campo ancho"><span class="ayuda">Dejá la fecha vacía si querés que no venza.
      Igual lo podés dar de baja cuando quieras: el enlace deja de funcionar al instante.</span></div>`,
    async ()=>{
      const inversor_id = val('en-inv');
      const vence = val('en-vence') || null;
      const titulo = val('en-titulo');
      // Token largo y aleatorio: no se adivina ni se enumera
      const bytes = new Uint8Array(24);
      crypto.getRandomValues(bytes);
      const token = [...bytes].map(b=>b.toString(36).padStart(2,'0')).join('');
      cerrar();
      const { error } = await sb.from('enlaces').insert({
        token, obra_id:o.id, inversor_id, vence, titulo, creado_por: perfil.id });
      if(error) return aviso('No se pudo generar: ' + error.message, true);
      await cargarDatos();
      copiarEnlace(token, 'Enlace generado y copiado');
    });
}

async function copiarEnlace(token, mensaje){
  const url = urlRendicion(token);
  try{
    await navigator.clipboard.writeText(url);
    aviso(mensaje || 'Enlace copiado');
  }catch(e){
    modal('Enlace de rendición', `
      <div class="campo ancho"><label>Copialo y mandáselo al inversor</label>
        <input value="${esc(url)}" onclick="this.select()" readonly></div>`,
      ()=>cerrar());
  }
}

async function bajaEnlace(id){
  if(!confirm('Dar de baja este enlace? Deja de funcionar de inmediato.')) return;
  await guardar('enlaces', { activo:false }, id);
}

