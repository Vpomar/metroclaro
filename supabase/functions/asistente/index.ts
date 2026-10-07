// =====================================================================
//  asistente
//
//  Dos tareas de redacción y lectura:
//    ficha  — convierte una descripción libre de la obra en campos
//             estructurados (niveles, unidades, superficies).
//    pedido — redacta el correo de solicitud de presupuesto.
//
//  Desplegar con:  supabase functions deploy asistente
//  Usa la misma clave que leer-comprobante.
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

async function pedirle(clave: string, texto: string, tokens = 1200) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': clave,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: tokens,
      messages: [{ role: 'user', content: texto }]
    })
  });
  if (!r.ok) {
    console.error('Anthropic respondió', r.status, await r.text());
    throw new Error('El servicio no respondió.');
  }
  const d = await r.json();
  return (d.content || [])
    .filter((c: { type: string }) => c.type === 'text')
    .map((c: { text: string }) => c.text)
    .join('')
    .trim();
}

const MAX_BYTES = 64 * 1024;
const corto = (v: unknown) => String(v ?? '').slice(0, 2000);

// Solo admin y carga. Tener el encabezado no alcanza: la clave pública
// del proyecto también viaja ahí, así que se valida la sesión real.
async function exigirEquipo(req: Request): Promise<Response | null> {
  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'Falta autenticación.' }, 401);
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } }
  });
  const { data, error } = await sb.auth.getUser();
  if (error || !data?.user) return json({ error: 'Sesión inválida.' }, 401);
  const { data: puede } = await sb.rpc('puede_editar');
  if (puede !== true) return json({ error: 'Tu usuario no puede usar el asistente.' }, 403);
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const rechazo = await exigirEquipo(req);
  if (rechazo) return rechazo;
  if (Number(req.headers.get('content-length') || 0) > MAX_BYTES) {
    return json({ error: 'El pedido es demasiado grande.' }, 413);
  }

  const clave = Deno.env.get('ANTHROPIC_API_KEY');
  if (!clave) return json({ error: 'Falta configurar ANTHROPIC_API_KEY.' }, 500);

  let cuerpo: Record<string, unknown>;
  try { cuerpo = await req.json(); }
  catch { return json({ error: 'Cuerpo inválido.' }, 400); }

  const accion = String(cuerpo.accion || '');

  try {
    // -----------------------------------------------------------------
    if (accion === 'ficha') {
      const texto = String(cuerpo.texto || '').slice(0, 2000);
      if (!texto) return json({ error: 'No llegó la descripción.' }, 400);

      const consigna = [
        'Sos un asistente de un estudio de arquitectura argentino.',
        'De la siguiente descripción de una obra, extraé los datos que estén presentes.',
        'Respondé SOLO con un objeto JSON, sin markdown ni texto alrededor:',
        '',
        '{"niveles":entero o null,"subsuelos":entero o null,"unidades":entero o null,',
        ' "cocheras":entero o null,"sup_terreno":numero o null,"sup_cubierta":numero o null,',
        ' "sup_semicubierta":numero o null,"sup_descubierta":numero o null,',
        ' "sup_comun":numero o null,"sup_vendible":numero o null}',
        '',
        'Criterios:',
        '- "niveles" son las plantas sobre nivel de vereda. "PB + 4" son 5 niveles.',
        '  Una terraza accesible no cuenta como nivel salvo que tenga unidades.',
        '- "unidades" son departamentos o viviendas, sin contar cocheras ni bauleras.',
        '- Las superficies van en metros cuadrados, solo números.',
        '- Lo que no aparezca en la descripción va en null. No estimes ni inventes.',
        '',
        'Descripción:',
        texto
      ].join('\n');

      const salida = await pedirle(clave, consigna, 600);
      return json(JSON.parse(salida.replace(/```json|```/g, '').trim()));
    }

    // -----------------------------------------------------------------
    if (accion === 'pedido') {
      const [obra, rubro, detalle, vence, ficha, estudio] =
        ['obra', 'rubro', 'detalle', 'vence', 'ficha', 'estudio'].map(k => corto(cuerpo[k]));

      const consigna = [
        'Redactá un correo breve y profesional pidiendo presupuesto a un proveedor',
        'de la construcción en Argentina. Tono cordial y directo, sin exageraciones',
        'ni frases de relleno. Español rioplatense, trato de usted.',
        '',
        'Datos:',
        `- Obra: ${obra || 'obra en curso'}`,
        `- Rubro: ${rubro || 'sin especificar'}`,
        ficha ? `- Características: ${ficha}` : '',
        detalle ? `- Lo que se necesita: ${detalle}` : '',
        vence ? `- Fecha límite para recibir la propuesta: ${vence}` : '',
        estudio ? `- Firma: ${estudio}` : '',
        '',
        'Pedí que la propuesta incluya precio, plazo de entrega, forma de pago',
        'y validez de la oferta. No inventes datos técnicos que no estén arriba.',
        'Respondé SOLO con el texto del correo, empezando por el saludo.',
        'No agregues asunto ni comentarios previos.'
      ].filter(Boolean).join('\n');

      return json({ cuerpo: await pedirle(clave, consigna, 900) });
    }

    return json({ error: 'Acción desconocida.' }, 400);
  } catch (e) {
    console.error(accion, e);
    return json({ error: (e as Error).message || 'Error inesperado.' }, 500);
  }
});
