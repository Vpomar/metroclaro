// =====================================================================
//  gestionar-usuarios
//
//  Alta, roles y vinculación de usuarios desde la propia aplicación.
//  Usa la clave de servicio, que vive solo acá: nunca baja al navegador.
//  Cada llamada verifica que quien la hace sea administrador.
//
//  Desplegar con:  supabase functions deploy gestionar-usuarios
//  No hace falta configurar secretos: Supabase inyecta los suyos.
// =====================================================================

import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' }
  });

const URL_SB = Deno.env.get('SUPABASE_URL')!;
const CLAVE_SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CLAVE_PUBLICA = Deno.env.get('SUPABASE_ANON_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'Falta autenticación.' }, 401);

  // Quién llama
  const comoUsuario = createClient(URL_SB, CLAVE_PUBLICA, {
    global: { headers: { Authorization: auth } }
  });
  const { data: quien, error: errUsuario } = await comoUsuario.auth.getUser();
  if (errUsuario || !quien?.user) return json({ error: 'Sesión inválida.' }, 401);

  // Solo administradores
  const admin = createClient(URL_SB, CLAVE_SERVICIO);
  const { data: perfil } = await admin
    .from('perfiles').select('rol').eq('id', quien.user.id).single();
  if (perfil?.rol !== 'admin') {
    return json({ error: 'Solo un administrador puede gestionar usuarios.' }, 403);
  }

  let cuerpo: Record<string, string>;
  try { cuerpo = await req.json(); }
  catch { return json({ error: 'Cuerpo inválido.' }, 400); }

  const { accion } = cuerpo;
  const ROLES = ['admin', 'carga', 'inversor'];

  try {
    // -----------------------------------------------------------------
    if (accion === 'listar') {
      // Se piden todas las páginas: antes se listaban solo los primeros 200.
      const todos = [];
      for (let pagina = 1; ; pagina++) {
        const { data: lista, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 200 });
        if (error) throw error;
        todos.push(...lista.users);
        if (lista.users.length < 200) break;
      }
      const { data: perfiles } = await admin.from('perfiles').select('id,nombre,rol');
      const { data: inversores } = await admin.from('inversores').select('id,nombre,perfil_id');

      const usuarios = todos.map((u) => {
        const p = perfiles?.find((x) => x.id === u.id);
        const inv = inversores?.find((x) => x.perfil_id === u.id);
        return {
          id: u.id,
          email: u.email,
          nombre: p?.nombre ?? '',
          rol: p?.rol ?? 'inversor',
          ultimo_acceso: u.last_sign_in_at,
          confirmado: !!u.email_confirmed_at,
          inversor_id: inv?.id ?? null,
          inversor_nombre: inv?.nombre ?? null,
          soy_yo: u.id === quien.user.id
        };
      }).sort((a, b) => (a.nombre || a.email || '').localeCompare(b.nombre || b.email || ''));

      return json({ usuarios });
    }

    // -----------------------------------------------------------------
    if (accion === 'crear') {
      const { email, nombre, rol, modo, password } = cuerpo;
      if (!email || !nombre) return json({ error: 'Faltan el email o el nombre.' }, 400);
      if (!ROLES.includes(rol)) return json({ error: 'Rol inválido.' }, 400);

      let id: string;
      if (modo === 'password') {
        if (!password || password.length < 8) {
          return json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, 400);
        }
        const { data, error } = await admin.auth.admin.createUser({
          email, password, email_confirm: true, user_metadata: { nombre }
        });
        if (error) throw error;
        id = data.user.id;
      } else {
        const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
          data: { nombre }
        });
        if (error) throw error;
        id = data.user.id;
      }

      // El disparador crea el perfil; acá se fija el nombre y el rol.
      await admin.from('perfiles').upsert({ id, nombre, rol });
      return json({ ok: true, id });
    }

    // -----------------------------------------------------------------
    if (accion === 'rol') {
      const { id, rol } = cuerpo;
      if (!ROLES.includes(rol)) return json({ error: 'Rol inválido.' }, 400);
      if (id === quien.user.id && rol !== 'admin') {
        return json({ error: 'No podés quitarte a vos mismo el rol de administrador.' }, 400);
      }
      const { error } = await admin.from('perfiles').update({ rol }).eq('id', id);
      if (error) throw error;
      return json({ ok: true });
    }

    // -----------------------------------------------------------------
    if (accion === 'nombre') {
      const { id, nombre } = cuerpo;
      if (!nombre?.trim()) return json({ error: 'El nombre no puede quedar vacío.' }, 400);
      const { error } = await admin.from('perfiles').update({ nombre }).eq('id', id);
      if (error) throw error;
      return json({ ok: true });
    }

    // -----------------------------------------------------------------
    if (accion === 'vincular') {
      const { id, inversor_id } = cuerpo;
      // Un usuario se vincula a un solo inversor
      await admin.from('inversores').update({ perfil_id: null }).eq('perfil_id', id);
      if (inversor_id) {
        const { error } = await admin.from('inversores')
          .update({ perfil_id: id }).eq('id', inversor_id);
        if (error) throw error;
      }
      return json({ ok: true });
    }

    // -----------------------------------------------------------------
    if (accion === 'recuperar') {
      const { email } = cuerpo;
      const { error } = await admin.auth.resetPasswordForEmail(email);
      if (error) throw error;
      return json({ ok: true });
    }

    // -----------------------------------------------------------------
    if (accion === 'eliminar') {
      const { id } = cuerpo;
      if (id === quien.user.id) {
        return json({ error: 'No podés eliminar tu propio usuario.' }, 400);
      }
      // La base también lo impide; esto es para dar un mensaje claro.
      const { data: admins } = await admin.from('perfiles').select('id').eq('rol', 'admin');
      if (admins?.length === 1 && admins[0].id === id) {
        return json({ error: 'No se puede eliminar al último administrador.' }, 400);
      }
      await admin.from('inversores').update({ perfil_id: null }).eq('perfil_id', id);
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: 'Acción desconocida.' }, 400);
  } catch (e) {
    console.error(accion, e);
    return json({ error: (e as Error).message ?? 'Error inesperado.' }, 500);
  }
});
