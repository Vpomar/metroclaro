// =====================================================================
//  _shared/http.ts
//
//  Respuestas y CORS comunes a todas las Edge Functions.
//
//  CORS: antes se respondía "Access-Control-Allow-Origin: *". Ahora solo
//  se habilitan los orígenes de la app (subdominios de metroclaro.com.ar,
//  las direcciones de Vercel de clientes.json y localhost para desarrollo).
//  Un navegador desde otro sitio recibe 403 antes de que la función haga
//  nada. Los pedidos sin Origin (servidor a servidor, el sondeo de
//  seguridad) siguen pasando: CORS no reemplaza la validación de sesión.
//
//  ORIGENES_PERMITIDOS (secreto opcional del proyecto, separado por comas)
//  reemplaza la lista por defecto. En producción conviene fijarlo sin
//  localhost. Ver docs/04-seguridad.md.
// =====================================================================

const POR_DEFECTO = [
  /^https:\/\/([a-z0-9-]+\.)?metroclaro\.com\.ar$/,
  /^https:\/\/app-simplestgo\.vercel\.app$/,
  /^http:\/\/(localhost|127\.0\.0\.1):\d+$/
];

const configurados = (Deno.env.get('ORIGENES_PERMITIDOS') ?? '')
  .split(',').map(o => o.trim()).filter(Boolean);

export function origenPermitido(origen: string | null): boolean {
  if (!origen) return true;
  if (configurados.length) return configurados.includes(origen);
  return POR_DEFECTO.some(r => r.test(origen));
}

export function cabeceras(req: Request): Record<string, string> {
  const origen = req.headers.get('Origin');
  const h: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
    // Las respuestas llevan datos financieros y personales: que nada las guarde
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  };
  if (origen && origenPermitido(origen)) h['Access-Control-Allow-Origin'] = origen;
  return h;
}

// Envuelve el manejador: corta OPTIONS, métodos y orígenes ajenos, y suma
// los encabezados comunes a cualquier respuesta que devuelva.
export function servir(manejador: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    const h = cabeceras(req);
    if (!origenPermitido(req.headers.get('Origin'))) {
      return new Response(JSON.stringify({ error: 'Origen no permitido.' }),
        { status: 403, headers: { ...h, 'Content-Type': 'application/json' } });
    }
    if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Método no permitido.' }),
        { status: 405, headers: { ...h, 'Content-Type': 'application/json' } });
    }
    const r = await manejador(req);
    for (const [k, v] of Object.entries(h)) r.headers.set(k, v);
    return r;
  };
}
