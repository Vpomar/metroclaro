// =====================================================================
//  invitacion
//
//  Sirve la propuesta de un negocio a partir de un enlace público.
//  Valida el token, controla el vencimiento y devuelve solo los
//  supuestos de ese negocio. No expone la base al navegador.
//
//  Desplegar con:  supabase functions deploy invitacion --no-verify-jwt
//  El --no-verify-jwt es necesario: quien entra no tiene sesión.
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

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  let token = '';
  try { ({ token } = await req.json()); }
  catch { return json({ error: 'Enlace inválido.' }, 400); }

  if (!token || token.length < 20) return json({ error: 'Enlace inválido.' }, 400);

  // 1. Validar el enlace
  const { data: enlace, error: e1 } = await db
    .from('invitaciones')
    .select('id, negocio_id, titulo, vence, activo, visitas')
    .eq('token', token)
    .maybeSingle();

  if (e1) return json({ error: 'No se pudo abrir la invitación.' }, 500);
  if (!enlace || !enlace.activo) return json({ error: 'Este enlace ya no está disponible.' }, 404);
  if (enlace.vence && enlace.vence < new Date().toISOString().slice(0, 10))
    return json({ error: 'Este enlace venció.' }, 410);

  // 2. Traer los supuestos del negocio
  const { data: negocio, error: e2 } = await db
    .from('negocios')
    .select(`nombre, ubicacion, m2, costo_m2, pct_honorarios, expensas_mes,
             meses_obra, mes_venta, precio_venta, pct_comision,
             tasa_efectivo, tasa_lote, pct_exc_admin, pct_exc_lote, pct_exc_cash,
             tasacion_1, tasacion_2, tasacion_3, criterio_lote, valor_lote, render`)
    .eq('id', enlace.negocio_id)
    .maybeSingle();

  if (e2 || !negocio) return json({ error: 'No se encontró la propuesta.' }, 404);

  // 3. Dejar registro de la visita, sin frenar la respuesta
  db.from('invitaciones')
    .update({ visitas: (enlace.visitas || 0) + 1, ultima_visita: new Date().toISOString() })
    .eq('id', enlace.id)
    .then(() => {});

  // El propietario y las notas internas no salen: es material comercial
  return json({ titulo: enlace.titulo || negocio.nombre, negocio });
});
