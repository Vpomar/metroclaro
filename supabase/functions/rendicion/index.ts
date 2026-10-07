// =====================================================================
//  rendicion
//
//  Sirve la rendición de un inversor a partir de un enlace público.
//  Valida el token, controla el vencimiento y devuelve únicamente lo
//  de ese inversor en esa obra. No expone la base al navegador.
//
//  Desplegar con:  supabase functions deploy rendicion --no-verify-jwt
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
  const { data: enlace } = await db
    .from('enlaces')
    .select('id, obra_id, inversor_id, titulo, vence, activo')
    .eq('token', token)
    .maybeSingle();

  if (!enlace || !enlace.activo) {
    return json({ error: 'Este enlace ya no está disponible. Pedí uno nuevo.' }, 404);
  }
  if (enlace.vence && enlace.vence < new Date().toISOString().slice(0, 10)) {
    return json({ error: 'Este enlace venció. Pedí uno nuevo.' }, 410);
  }

  const { obra_id, inversor_id } = enlace;

  // 2. Traer solo lo que corresponde
  const [obra, inversor, part, clases, aportes, rubros, presu, comp, avances, ventas] =
    await Promise.all([
      db.from('obras').select('nombre, pct_conduccion, pct_administracion, pct_desarrolladora')
        .eq('id', obra_id).single(),
      db.from('inversores').select('nombre').eq('id', inversor_id).single(),
      db.from('participaciones').select('comp_a, comp_b')
        .eq('obra_id', obra_id).eq('inversor_id', inversor_id).maybeSingle(),
      db.from('clases').select('letra, nombre, coeficiente').eq('obra_id', obra_id),
      db.from('aportes').select('fecha, clase, unidad, moneda, importe, cotizacion, usd, inversor_id')
        .eq('obra_id', obra_id),
      db.from('rubros').select('id, nombre, grupo, base_honorarios, orden').order('orden'),
      db.from('presupuestos').select('rubro_id, monto_usd').eq('obra_id', obra_id),
      db.from('comprobantes')
        .select('fecha, proveedor, detalle, rubro_id, usd, pago, afecta_caja')
        .eq('obra_id', obra_id).eq('afecta_caja', true).order('fecha'),
      db.from('avances').select('fecha, titulo, descripcion, pct_avance, archivo')
        .eq('obra_id', obra_id).order('fecha', { ascending: false }).limit(12),
      db.from('ventas').select('id, cliente, unidad, modalidad, indice_base, inversor_id')
        .eq('obra_id', obra_id).eq('inversor_id', inversor_id)
    ]);

  // Cuotas solo de las ventas de este inversor, filtradas en la base
  const misVentas = (ventas.data ?? []).map(v => v.id);
  const cuotas = misVentas.length
    ? await db.from('cuotas')
        .select('id, venta_id, numero, vencimiento, monto_base, moneda, estado, monto_cobrado')
        .in('venta_id', misVentas)
    : { data: [] };

  if (obra.error || inversor.error) return json({ error: 'No se pudo armar la rendición.' }, 500);

  // 3. Enlaces firmados de las fotos de avance
  const fotos = [];
  for (const a of avances.data ?? []) {
    if (!a.archivo) continue;
    const i = a.archivo.indexOf('/');
    const { data } = await db.storage.from(a.archivo.slice(0, i))
      .createSignedUrl(a.archivo.slice(i + 1), 3600);
    fotos.push({ ...a, url: data?.signedUrl ?? null, archivo: undefined });
  }

  // 4. Aportes de los demás: solo el total por clase, que es lo que la
  //    página necesita para calcular la participación. Ni fechas, ni
  //    montos individuales, ni a quién pertenecen.
  const totalPorClase = new Map<string, number>();
  for (const a of aportes.data ?? []) {
    totalPorClase.set(a.clase, (totalPorClase.get(a.clase) ?? 0) + Number(a.usd));
  }
  const aportesTotales = [...totalPorClase].map(([clase, usd]) => ({ clase, usd }));

  // 5. Registrar la visita, sin bloquear la respuesta
  db.rpc('sumar_visita', { p_enlace: enlace.id }).then(() => {}, () => {});

  return json({
    obra: obra.data,
    inversor: inversor.data,
    participacion: part.data ?? { comp_a: 0, comp_b: 0 },
    clases: clases.data ?? [],
    aportes: aportesTotales,
    mis_aportes: (aportes.data ?? []).filter(a => a.inversor_id === inversor_id)
      .map(a => ({ ...a, inversor_id: undefined })),
    rubros: rubros.data ?? [],
    presupuestos: presu.data ?? [],
    comprobantes: comp.data ?? [],
    avances: fotos,
    ventas: ventas.data ?? [],
    cuotas: cuotas.data ?? [],
    titulo: enlace.titulo,
    emitido: new Date().toISOString()
  });
});
