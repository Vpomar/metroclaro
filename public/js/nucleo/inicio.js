/* =====================================================================
   nucleo/inicio.js
   Arranque: acceso, sesión y registro de manejadores globales. Se carga último

   Script clásico: comparte el ámbito global con los demás archivos de
   js/. El orden de carga está en index.html (ver js/README.md).
   ===================================================================== */
/* =====================================================================
   ACCESO
   ===================================================================== */
document.getElementById('form-acceso').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('btn-entrar');
  const err = document.getElementById('error-acceso');
  err.textContent = ''; btn.disabled = true; btn.textContent = 'Entrando…';
  const { error } = await sb.auth.signInWithPassword({
    email: document.getElementById('email').value.trim(),
    password: document.getElementById('clave').value
  });
  btn.disabled = false; btn.textContent = 'Entrar';
  if(error) err.textContent = error.message === 'Invalid login credentials'
    ? 'Email o contraseña incorrectos.' : error.message;
});

async function salir(){ await sb.auth.signOut(); location.reload(); }

sb.auth.onAuthStateChange((_evento, sesion) => { if(sesion) iniciar(); });

/* La instancia se deduce del subdominio: cada cliente entra por el suyo */
(() => {
  const p = document.getElementById('pie-instancia');
  if(!p) return;
  const h = location.hostname.split('.');
  const sub = h.length > 2 ? h[0] : '';
  p.textContent = sub && sub !== 'www'
    ? `Instancia ${sub}. Ingresá con tu cuenta.`
    : 'Ingresá con tu cuenta para continuar.';
})();

(async () => {
  if(window.CONFIG.key.startsWith('PEGAR')){
    document.getElementById('pie-acceso').textContent =
      'Falta configurar la clave en config.js.';
    return;
  }
  const { data } = await sb.auth.getSession();
  if(data.session) iniciar();
})();

async function iniciar(){
  if(perfil) return;
  const { data: sesion } = await sb.auth.getUser();
  // Sesión vencida o revocada: antes la app fallaba acá y quedaba en blanco.
  if(!sesion?.user){
    await sb.auth.signOut();
    document.getElementById('error-acceso').textContent =
      'Tu sesión venció. Ingresá de nuevo.';
    return;
  }
  const { data: p, error } = await sb.from('perfiles')
    .select('id,nombre,rol').eq('id', sesion.user.id).single();
  if(error || !p){
    document.getElementById('error-acceso').textContent =
      'Tu usuario no tiene perfil cargado. Avisá al administrador.';
    return;
  }
  perfil = p;
  document.getElementById('acceso').classList.add('oculto');
  document.getElementById('app').classList.remove('oculto');
  document.getElementById('quien').textContent = `${p.nombre} · ${p.rol}`;
  document.querySelectorAll('.solo-equipo').forEach(e => { if(!puedeEditar()) e.remove(); });
  document.querySelectorAll('.solo-admin').forEach(e => { if(!esAdmin()) e.remove(); });
  await cargarDatos();
  traerCotizacion();
}


/* Los manejadores en línea del HTML se resuelven contra el ámbito global. */
Object.assign(window, { verObra, verTab, setCotiz, setTcRef, tglAfecta, setCalc, calcularIva, setRango,
  autoProveedor, setFiltro, limpiarFiltros,
  cargarUsuarios, formUsuario, tglModoUsuario, cambiarRol, vincularInversor,
  descargarRespaldo, descargarFotos, formDocumento, tiposDeCategoria,
  cargarHistorial, formCierre, reabrirCierre,
  formParticipacion, tglNuevoInversor, quitarDeObra, formInversor,
  formVenta, tglCotizVenta, tglCobro, exportarVentas,
  abrirVenta, formPlan, recalcPlan, cobrarCuota, revertirCuota, tglModalidad,
  formEnlace, copiarEnlace, bajaEnlace,
  formIndice,
  formFicha, interpretarFicha, sumarM2, formAnalisis, formNivel,
  formUnidad, asignarUnidad, tglAsignar, exportarUnidades,
  renombrarGrupo, nuevoGrupo, tglGrupoNuevo,
  renombrarUsuario, recuperarClave, eliminarUsuario, setMesContador, setInvRendicion,
  setPresu, setPctHon, setClase, borrar, cerrar, salir, traerCotizacion,
  formGasto, formAporte, formInversor, formCaja, formRubro, formAvance,
  nuevaObra, renombrarObra, eliminarObra, marcarPagado, archivarRubro,
  leerComprobante, verArchivo, tglCotiz, tglPago,
  exportarComprobantes, exportarContador });

document.addEventListener('keydown', e => { if(e.key==='Escape') cerrar(); });
