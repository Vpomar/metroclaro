/* =====================================================================
   nucleo/buscador.js
   Buscador por teclado: Ctrl+K en Windows, ⌘K en Mac

   Una sola entrada para llegar a cualquier obra, pestaña, acción o
   registro sin levantar las manos del teclado. Busca sobre lo que ya
   está cargado en D, así que responde sin esperar a la red.

   Script clásico: comparte el ámbito global con los demás archivos de
   js/. No ejecuta nada al cargar; lo arranca iniciarBuscador() desde
   nucleo/inicio.js.
   ===================================================================== */

let paletaAbierta = false, paletaSel = 0, paletaFiltro = '';

/* Compara sin tildes ni mayúsculas: "mamposteria" encuentra "Mampostería" */
function aplanar(t){
  return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function resaltarCoincidencia(texto, filtro){
  if(!filtro) return esc(texto);
  const i = aplanar(texto).indexOf(aplanar(filtro));
  if(i < 0) return esc(texto);
  return esc(texto.slice(0, i)) + '<mark>' + esc(texto.slice(i, i + filtro.length)) +
         '</mark>' + esc(texto.slice(i + filtro.length));
}

/* Todo lo que se puede alcanzar desde el buscador */
function accionesBuscador(){
  const r = [];
  const o = obraActiva ? obra() : null;

  D.obras.forEach(x => r.push({ grupo:'Obras', texto:x.nombre,
    detalle: x.id === obraActiva ? 'abierta' : '',
    hacer: () => verObra(x.id) }));

  r.push({ grupo:'Ir a', texto:'Panel general', hacer: () => verTab('panel') });
  if(puedeEditar()) r.push({ grupo:'Ir a', texto:'Índices', hacer: () => verTab('indices') });
  if(esAdmin())     r.push({ grupo:'Ir a', texto:'Usuarios', hacer: () => verTab('usuarios') });

  if(o){
    [['resumen','Resumen'],['cajas','Cajas'],['gastos','Comprobantes'],
     ['proveedores','Proveedores'],['rubros','Rubros'],['honorarios','Honorarios'],
     ['analisis','Análisis'],['unidades','Unidades'],['inversores','Inversores'],
     ['ventas','Ventas'],['avance','Avance'],['documentos','Documentos'],
     ['rendicion','Rendición'],['contador','Contador']]
      // Historial solo para el equipo, igual que en las pestañas
      .concat(puedeEditar() ? [['historial','Historial']] : [])
      .forEach(([v,t]) => r.push({ grupo:'Ir a', texto:t, detalle:o.nombre,
        hacer: () => verTab(v) }));

    if(puedeEditar()){
      const abrir = (vista, form) => () => { verTab(vista); setTimeout(form, 30); };
      r.push({ grupo:'Cargar', texto:'Cargar comprobante', detalle:o.nombre,
        hacer: abrir('gastos', formGasto) });
      r.push({ grupo:'Cargar', texto:'Registrar aporte', detalle:o.nombre,
        hacer: abrir('inversores', formAporte) });
      r.push({ grupo:'Cargar', texto:'Registrar venta', detalle:o.nombre,
        hacer: abrir('ventas', formVenta) });
      r.push({ grupo:'Cargar', texto:'Agregar unidad', detalle:o.nombre,
        hacer: abrir('unidades', formUnidad) });
      r.push({ grupo:'Cargar', texto:'Subir avance de obra', detalle:o.nombre,
        hacer: abrir('avance', formAvance) });
      r.push({ grupo:'Cargar', texto:'Cargar índice CAC',
        hacer: abrir('indices', formIndice) });
    }

    /* Buscar dentro de lo que ya está cargado */
    unidadesDe(o.id).forEach(u => r.push({ grupo:'Unidades', texto:u.codigo,
      detalle: u.tipo + (u.estado !== 'disponible' ? ' · ' + u.estado : ''),
      hacer: () => verTab('unidades') }));

    partsDe(o.id).map(p => inv(p.inversor_id)).filter(Boolean).forEach(i =>
      r.push({ grupo:'Inversores', texto:i.nombre, hacer: () => verTab('inversores') }));

    proveedoresConocidos().slice(0, 40).forEach(p => r.push({ grupo:'Proveedores',
      texto:p.nombre, detalle:p.cuit || '',
      hacer: () => { verTab('gastos'); setTimeout(() => setFiltro('prov', p.nombre), 30); } }));

    D.rubros.filter(x => x.activo !== false).forEach(x => r.push({ grupo:'Rubros',
      texto:x.nombre, detalle:x.grupo,
      hacer: () => { verTab('gastos'); setTimeout(() => setFiltro('rubro', x.id), 30); } }));
  }

  r.push({ grupo:'Cuenta', texto:'Cerrar sesión', hacer: salir });
  return r;
}

function resultadosBuscador(){
  const todo = accionesBuscador();
  const f = paletaFiltro.trim();
  /* Sin nada escrito: lo más usado, no la lista entera */
  if(!f) return todo.filter(x => ['Obras','Ir a','Cargar'].includes(x.grupo)).slice(0, 9);
  const q = aplanar(f);
  return todo
    .map(x => {
      const i = aplanar(x.texto).indexOf(q);
      if(i < 0) return null;
      /* Los que empiezan igual van primero */
      return Object.assign({}, x, { peso: (i === 0 ? 0 : 1) * 100 + i });
    })
    .filter(Boolean)
    .sort((a, b) => a.peso - b.peso)
    .slice(0, 40);
}

function abrirBuscador(){
  // Antes de iniciar sesión no hay datos que buscar
  if(paletaAbierta || !D || !perfil) return;
  paletaAbierta = true; paletaSel = 0; paletaFiltro = '';
  document.getElementById('paleta-host').innerHTML = `
    <div class="paleta" id="paleta-velo">
      <div class="paleta-caja" role="dialog" aria-modal="true" aria-label="Buscar">
        <div class="paleta-busca">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="7" cy="7" r="4.6" stroke="currentColor" stroke-width="1.4"/>
            <path d="M10.6 10.6L14 14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
          <input id="paleta-input" autocomplete="off" spellcheck="false"
            placeholder="Buscar obra, pestaña, proveedor o rubro">
        </div>
        <div class="paleta-lista" id="paleta-lista"></div>
        <div class="paleta-pie">
          <span><span class="tecla">↑</span><span class="tecla">↓</span>moverse</span>
          <span><span class="tecla">↵</span>abrir</span>
          <span><span class="tecla">esc</span>cerrar</span>
        </div>
      </div>
    </div>`;

  document.getElementById('paleta-velo').addEventListener('click', e => {
    if(e.target.id === 'paleta-velo') cerrarBuscador();
  });
  const inp = document.getElementById('paleta-input');
  inp.addEventListener('input', () => {
    paletaFiltro = inp.value; paletaSel = 0; pintarBuscador();
  });
  pintarBuscador();
  inp.focus();
}

function cerrarBuscador(){
  paletaAbierta = false;
  document.getElementById('paleta-host').innerHTML = '';
}

function pintarBuscador(){
  const lista = document.getElementById('paleta-lista');
  if(!lista) return;
  const res = resultadosBuscador();

  if(!res.length){
    lista.innerHTML = `<p class="paleta-vacio">Nada coincide con
      “${esc(paletaFiltro)}”. Probá con otra palabra.</p>`;
    return;
  }

  let grupo = null, html = '';
  res.forEach((x, i) => {
    if(x.grupo !== grupo){
      grupo = x.grupo;
      html += `<p class="paleta-grupo">${esc(grupo)}</p>`;
    }
    html += `<button class="paleta-item ${i === paletaSel ? 'on' : ''}" data-i="${i}">
      <span class="q">${resaltarCoincidencia(x.texto, paletaFiltro)}</span>
      ${x.detalle ? `<span class="d">${esc(x.detalle)}</span>` : ''}
    </button>`;
  });
  lista.innerHTML = html;

  /* Los manejadores se enganchan acá: nunca se interpola texto en onclick */
  lista.querySelectorAll('.paleta-item').forEach(b => {
    b.addEventListener('click', () => elegirBuscador(+b.dataset.i));
    b.addEventListener('mousemove', () => {
      const i = +b.dataset.i;
      if(i === paletaSel) return;
      paletaSel = i;
      lista.querySelectorAll('.paleta-item').forEach(x =>
        x.classList.toggle('on', +x.dataset.i === i));
    });
  });

  const act = lista.querySelector('.paleta-item.on');
  if(act && act.scrollIntoView) act.scrollIntoView({ block:'nearest' });
}

function elegirBuscador(i){
  const x = resultadosBuscador()[i];
  cerrarBuscador();
  if(x) x.hacer();
}

/* Lo llama nucleo/inicio.js después de entrar */
function iniciarBuscador(){
  /* En Windows el atajo es Ctrl, no la tecla de comando */
  const t = document.getElementById('tecla-paleta');
  if(t && !/Mac|iPhone|iPad/.test(navigator.platform || '')) t.textContent = 'Ctrl K';

  document.addEventListener('keydown', e => {
    if((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'){
      e.preventDefault();
      paletaAbierta ? cerrarBuscador() : abrirBuscador();
      return;
    }
    if(!paletaAbierta) return;
    const total = resultadosBuscador().length;
    if(e.key === 'Escape'){ e.preventDefault(); cerrarBuscador(); }
    else if(e.key === 'ArrowDown'){ e.preventDefault();
      paletaSel = total ? (paletaSel + 1) % total : 0; pintarBuscador(); }
    else if(e.key === 'ArrowUp'){ e.preventDefault();
      paletaSel = total ? (paletaSel - 1 + total) % total : 0; pintarBuscador(); }
    else if(e.key === 'Enter'){ e.preventDefault(); elegirBuscador(paletaSel); }
  });
}
