/* =====================================================================
   vistas/usuarios.js
   Pestaña Usuarios: gestión de usuarios y respaldos

   Script clásico: comparte el ámbito global con los demás archivos de
   js/. El orden de carga está en index.html (ver js/README.md).
   ===================================================================== */
/* =====================================================================
   PANEL DE USUARIOS
   ===================================================================== */
async function usuariosLlamar(cuerpo){
  const { data, error } = await sb.functions.invoke('gestionar-usuarios', { body: cuerpo });
  if(error){
    let detalle = error.message;
    try{ const c = await error.context?.json(); if(c?.error) detalle = c.error; }catch(e){}
    aviso(detalle, true);
    return null;
  }
  if(data?.error){ aviso(data.error, true); return null; }
  return data;
}

async function cargarUsuarios(){
  const d = await usuariosLlamar({ accion:'listar' });
  usuarios = d ? d.usuarios : [];
  render();
}

const ROLES = [['admin','Administrador'],['carga','Carga'],['inversor','Inversor']];
const DESC_ROL = {
  admin: 'Todo, incluido eliminar y gestionar usuarios',
  carga: 'Ve todo y carga movimientos. No elimina',
  inversor: 'Solo lectura, y solo de las obras donde aportó'
};

function vUsuarios(){
  if(usuarios === null){
    cargarUsuarios();
    return `<div class="vacio">Cargando usuarios…</div>`;
  }
  const libres = D.inversores.filter(i => !i.perfil_id);
  return `
  <div class="acciones">
    <button class="btn" onclick="formUsuario()">Agregar usuario</button>
    <button class="btn sec" onclick="cargarUsuarios()">Actualizar</button>
  </div>
  <p class="sub">El rol define qué puede hacer cada uno. Los cambios tienen efecto
  la próxima vez que la persona entre o recargue.</p>

  ${usuarios.length ? `<table><thead><tr><th>Usuario</th><th>Rol</th>
    <th class="ocultar-chico">Inversor vinculado</th><th class="ocultar-chico">Último acceso</th>
    <th></th></tr></thead><tbody>
    ${usuarios.map(u=>`<tr>
      <td><strong>${esc(u.nombre || '(sin nombre)')}</strong>
        <br><span class="pct">${esc(u.email)}</span>
        ${u.soy_yo?' <span class="chip">vos</span>':''}
        ${!u.confirmado?' <span class="chip a">invitación pendiente</span>':''}
        <br><button class="link" onclick="renombrarUsuario('${u.id}')">Cambiar nombre</button></td>
      <td><select onchange="cambiarRol('${u.id}',this.value)" ${u.soy_yo?'disabled':''}
          style="font:inherit;font-size:13px;padding:5px 7px;
          border:1px solid var(--linea-fuerte);border-radius:3px">
          ${ROLES.map(([v,n])=>`<option value="${v}" ${v===u.rol?'selected':''}>${n}</option>`).join('')}
        </select>
        <p class="pct">${esc(DESC_ROL[u.rol])}</p></td>
      <td class="ocultar-chico">
        ${u.rol==='inversor'
          ? `<select onchange="vincularInversor('${u.id}',this.value)"
              style="font:inherit;font-size:13px;padding:5px 7px;
              border:1px solid var(--linea-fuerte);border-radius:3px">
              <option value="">Sin vincular</option>
              ${D.inversores.filter(i => !i.perfil_id || i.id===u.inversor_id)
                .map(i=>`<option value="${i.id}" ${i.id===u.inversor_id?'selected':''}>${esc(i.nombre)}</option>`).join('')}
            </select>
            ${!u.inversor_id?`<p class="pct">Sin vincular no ve ninguna obra.</p>`:''}`
          : '<span class="pct">—</span>'}</td>
      <td class="ocultar-chico num">${u.ultimo_acceso
        ? new Date(u.ultimo_acceso).toLocaleDateString('es-AR')
        : '<span class="pct">nunca entró</span>'}</td>
      <td class="der">
        <button class="link" data-email="${esc(u.email)}" onclick="recuperarClave(this.dataset.email)">Enviar recuperación</button>
        ${u.soy_yo?'':`<br><button class="link" data-nombre="${esc(u.nombre||u.email)}" onclick="eliminarUsuario('${u.id}', this.dataset.nombre)">Eliminar</button>`}</td>
      </tr>`).join('')}
    </tbody></table>` : `<div class="vacio">No se pudieron listar los usuarios.
      Revisá que la función esté desplegada.</div>`}

  ${libres.length ? `<p class="sub" style="margin-top:12px">Inversores sin usuario:
    ${libres.map(i=>esc(i.nombre)).join(', ')}.</p>` : ''}

  <h3>Respaldo</h3>
  <p class="sub">Descargá una copia de todo lo cargado. Guardala fuera de la computadora:
  Drive, un disco externo, donde tengas el resto de los respaldos del estudio.</p>
  <div class="acciones">
    <button class="btn" onclick="descargarRespaldo()">Descargar datos</button>
    <button class="btn sec" onclick="descargarFotos()">Descargar fotos</button>
  </div>
  <p class="sub">Los datos salen en un archivo JSON con todas las tablas. Las fotos van aparte,
  una descarga por archivo, porque el navegador no puede armar un comprimido.
  Un respaldo por mes, y uno antes de cualquier cambio grande, alcanza.</p>`;
}

/* ---------- Respaldo de datos ---------- */
const TABLAS_RESPALDO = ['obras','clases','rubros','presupuestos','cajas',
  'inversores','participaciones','aportes','comprobantes','ventas','avances',
  'documentos','fichas','analisis','niveles','unidades','indices','cuotas','enlaces',
  'proveedores','pedidos','pedido_respuestas','perfiles','cierres','auditoria'];

async function descargarRespaldo(){
  aviso('Armando el respaldo…');
  const copia = { generado: new Date().toISOString(), proyecto: window.CONFIG.url, tablas: {} };
  for(const t of TABLAS_RESPALDO){
    const { data, error } = await todo(t);
    if(error){ aviso(`No se pudo leer ${t}: ${error.message}`, true); return; }
    copia.tablas[t] = data;
  }
  const filas = Object.entries(copia.tablas).map(([t,d])=>`${t}: ${d.length}`).join(', ');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(copia,null,2)],{type:'application/json'}));
  a.download = `respaldo-obras-${hoy()}.json`;
  a.click(); URL.revokeObjectURL(a.href);
  aviso('Respaldo descargado');
  console.log('Respaldo:', filas);
}

async function descargarFotos(){
  const conArchivo = [
    ...D.comprobantes.filter(c=>c.archivo).map(c=>({ruta:c.archivo, nombre:`comprobante-${c.fecha}-${c.proveedor}`})),
    ...D.avances.filter(a=>a.archivo).map(a=>({ruta:a.archivo, nombre:`avance-${a.fecha}-${a.titulo||''}`})),
    ...D.documentos.filter(x=>x.archivo).map(x=>({ruta:x.archivo, nombre:`documento-${x.tipo}-${x.titulo}`}))
  ];
  if(!conArchivo.length) return aviso('No hay fotos cargadas todavía.');
  if(!confirm(`Se van a abrir ${conArchivo.length} descargas, una por foto. ¿Seguir?`)) return;
  for(const f of conArchivo){
    const i = f.ruta.indexOf('/');
    const { data } = await sb.storage.from(f.ruta.slice(0,i)).createSignedUrl(f.ruta.slice(i+1), 300);
    if(!data) continue;
    const a = document.createElement('a');
    a.href = data.signedUrl;
    a.download = f.nombre.replace(/[^\w\-]+/g,'-').slice(0,80);
    a.click();
    await new Promise(r=>setTimeout(r, 350));
  }
  aviso('Descarga de fotos iniciada');
}

function formUsuario(){
  modal('Agregar usuario', `
    <div class="campo ancho"><label for="u-nombre">Nombre</label>
      <input id="u-nombre" placeholder="Nombre y apellido"></div>
    <div class="campo ancho"><label for="u-email">Email</label>
      <input id="u-email" type="email" placeholder="persona@ejemplo.com"></div>
    <div class="campo"><label for="u-rol">Rol</label>
      <select id="u-rol">${ROLES.map(([v,n])=>`<option value="${v}" ${v==='carga'?'selected':''}>${n}</option>`).join('')}</select></div>
    <div class="campo"><label for="u-modo">Cómo entra</label>
      <select id="u-modo" onchange="tglModoUsuario()">
        <option value="invitacion">Le llega una invitación por email</option>
        <option value="password">Le doy una contraseña inicial</option>
      </select></div>
    <div class="campo ancho" id="wrap-pass" style="display:none">
      <label for="u-pass">Contraseña inicial</label>
      <input id="u-pass" type="password" autocomplete="new-password" placeholder="mínimo 8 caracteres">
      <span class="ayuda">Se la pasás vos por otro medio y conviene que la cambie al entrar.</span></div>
    <div class="campo ancho"><span class="ayuda">Con invitación la persona elige su propia
      contraseña y vos nunca la ves. Es la opción recomendada.</span></div>`,
    async ()=>{
      const nombre = val('u-nombre'), email = val('u-email');
      const rol = val('u-rol'), modo = val('u-modo'), password = val('u-pass');
      if(!nombre) return err('Poné el nombre.');
      if(!email.includes('@')) return err('Revisá el email.');
      if(modo==='password' && password.length < 8) return err('La contraseña necesita 8 caracteres o más.');
      document.getElementById('ok').disabled = true;
      const r = await usuariosLlamar({ accion:'crear', nombre, email, rol, modo, password });
      if(!r){ const b = document.getElementById('ok'); if(b) b.disabled = false; return; }
      cerrar();
      aviso(modo==='password' ? 'Usuario creado' : 'Invitación enviada');
      await cargarUsuarios();
    });
}
function tglModoUsuario(){
  const m = document.getElementById('u-modo'), w = document.getElementById('wrap-pass');
  if(m&&w) w.style.display = m.value==='password' ? '' : 'none';
}

async function cambiarRol(id, rol){
  const r = await usuariosLlamar({ accion:'rol', id, rol });
  if(r){ aviso('Rol actualizado'); await cargarUsuarios(); } else await cargarUsuarios();
}
async function vincularInversor(id, inversor_id){
  const r = await usuariosLlamar({ accion:'vincular', id, inversor_id });
  if(r){ aviso('Vínculo actualizado'); await cargarDatos(); await cargarUsuarios(); }
}
function renombrarUsuario(id){
  const u = usuarios.find(x=>x.id===id);
  modal('Cambiar nombre', `<div class="campo ancho"><label for="u-n">Nombre</label>
    <input id="u-n" value="${esc(u.nombre)}"></div>`,
    async ()=>{
      const nombre = val('u-n');
      if(!nombre) return err('El nombre no puede quedar vacío.');
      cerrar();
      if(await usuariosLlamar({ accion:'nombre', id, nombre })){
        aviso('Nombre actualizado'); await cargarUsuarios();
      }
    });
}
async function recuperarClave(email){
  if(!confirm(`Enviar un correo de recuperación de contraseña a ${email}?`)) return;
  if(await usuariosLlamar({ accion:'recuperar', email })) aviso('Correo enviado');
}
async function eliminarUsuario(id, nombre){
  if(!confirm(`Eliminar el usuario de ${nombre}? Pierde el acceso de inmediato. Los movimientos que cargó se conservan.`)) return;
  if(await usuariosLlamar({ accion:'eliminar', id })){
    aviso('Usuario eliminado'); await cargarDatos(); await cargarUsuarios();
  }
}

