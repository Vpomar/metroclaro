// =====================================================================
//  leer-comprobante
//
//  Recibe la foto o el PDF de un comprobante y devuelve sus datos. Es el
//  último paso de la lectura: la app primero lee el QR de ARCA y el texto
//  (PDF u OCR) y llama acá solo si todavía falta algo. Lo que ya se sabe
//  llega en "pistas" para que la IA no lo contradiga.
//
//  La clave de Anthropic vive acá, en el servidor, y nunca baja
//  al navegador del usuario.
//
//  Desplegar con:  supabase functions deploy leer-comprobante
//  La clave se carga con: supabase secrets set ANTHROPIC_API_KEY=...
//  Opcional: MODELO_LECTURA para usar otro modelo sin tocar el código.
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
// "codigo" le permite a la app explicar qué pasó (ver ERRORES_IA en la app)
const falla = (codigo: string, error: string, status: number) => json({ codigo, error }, status);

// Un archivo de 8 MB pesa unos 11 MB en base64.
const MAX_BYTES = 12 * 1024 * 1024;
const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
const MODELO = Deno.env.get('MODELO_LECTURA') || 'claude-sonnet-5-5';

// Solo admin y carga. Tener el encabezado no alcanza: la clave pública
// del proyecto también viaja ahí, así que se valida la sesión real.
async function exigirEquipo(req: Request): Promise<Response | null> {
  const auth = req.headers.get('Authorization');
  if (!auth) return falla('sin_sesion', 'Falta autenticación.', 401);
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } }
  });
  const { data, error } = await sb.auth.getUser();
  if (error || !data?.user) return falla('sin_sesion', 'Sesión inválida.', 401);
  const { data: puede } = await sb.rpc('puede_editar');
  if (puede !== true) return falla('sin_permiso', 'Tu usuario no puede cargar comprobantes.', 403);
  return null;
}

// La respuesta se pide como una "herramienta" con esquema fijo: el modelo
// tiene que devolver exactamente estos campos, sin texto alrededor.
const n = { type: ['number', 'null'] };
const t = { type: ['string', 'null'] };
const herramienta = (rubros: string[]) => ({
  name: 'registrar_comprobante',
  description: 'Registra los datos leídos del comprobante. null en lo que no se lee con claridad.',
  input_schema: {
    type: 'object',
    properties: {
      fecha: { ...t, description: 'Fecha de emisión, AAAA-MM-DD' },
      proveedor: { ...t, description: 'Razón social del EMISOR (no del cliente)' },
      cuit: { ...t, description: 'CUIT del emisor, con guiones' },
      tipo: { type: ['string', 'null'],
        enum: ['Factura A', 'Factura B', 'Factura C', 'Recibo', 'Remito', 'Sin comprobante', null] },
      nro: { ...t, description: 'Punto de venta y número, ej 0001-00001234' },
      moneda: { type: ['string', 'null'], enum: ['ARS', 'USD', null] },
      importe: { ...n, description: 'TOTAL final del comprobante' },
      neto: { ...n, description: 'Neto gravado' },
      iva: { ...n, description: 'Suma de todas las alícuotas de IVA' },
      percepciones: { ...n, description: 'Suma de percepciones y otros tributos' },
      detalle: { ...t, description: 'Qué se compró, en pocas palabras' },
      rubro: { type: ['string', 'null'], enum: [...rubros, null] }
    },
    required: ['fecha', 'proveedor', 'cuit', 'tipo', 'nro', 'moneda', 'importe',
               'neto', 'iva', 'percepciones', 'detalle', 'rubro']
  }
});

const CONSIGNA = [
  'Sos un asistente contable argentino. Este es un comprobante de compra de una obra en construcción.',
  'Registrá sus datos con la herramienta registrar_comprobante.',
  '',
  'Reglas para los importes:',
  '- "importe" es el TOTAL final del comprobante, el que se paga.',
  '- En FACTURA A los impuestos vienen discriminados. Buscá en el pie "Neto Gravado" o "Subtotal",',
  '  "IVA 21%", "IVA 10,5%", y las percepciones de IVA, Ganancias, Ingresos Brutos o impuestos internos.',
  '  "iva" es la suma de todas las alícuotas; "percepciones", la de percepciones y otros tributos.',
  '- Si hay importe exento o no gravado, sumalo a "neto".',
  '- neto + iva + percepciones tiene que dar exactamente "importe". Verificalo antes de responder.',
  '- En FACTURA B y C el IVA no se discrimina: "neto" igual al total, y 0 en "iva" y "percepciones".',
  '- En remitos y comprobantes sin discriminación, 0 en los tres.',
  '- No inventes datos: si algo no se lee con claridad, null.'
].join('\n');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const rechazo = await exigirEquipo(req);
  if (rechazo) return rechazo;

  if (Number(req.headers.get('content-length') || 0) > MAX_BYTES) {
    return falla('muy_grande', 'El archivo es demasiado grande.', 413);
  }

  const clave = Deno.env.get('ANTHROPIC_API_KEY');
  if (!clave) return falla('sin_clave', 'Falta configurar ANTHROPIC_API_KEY.', 500);

  let archivo: string, tipo: string, rubros: string[], pistas: Record<string, unknown>;
  try {
    ({ archivo, tipo, rubros, pistas } = await req.json());
  } catch {
    return falla('invalido', 'Cuerpo inválido.', 400);
  }
  if (!archivo || typeof archivo !== 'string') return falla('invalido', 'No llegó el archivo.', 400);
  if (archivo.length > MAX_BYTES) return falla('muy_grande', 'El archivo es demasiado grande.', 413);
  if (!TIPOS.includes(tipo)) return falla('formato', 'Formato no soportado.', 400);
  const listaRubros = (Array.isArray(rubros) ? rubros : [])
    .filter((r) => typeof r === 'string').map((r) => r.slice(0, 80)).slice(0, 200);

  const bloque = tipo === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: tipo, data: archivo } }
    : { type: 'image', source: { type: 'base64', media_type: tipo, data: archivo } };

  // Lo que la app ya leyó del QR de ARCA o del texto: son datos firmes
  const conocidos = Object.entries(pistas && typeof pistas === 'object' ? pistas : {})
    .filter(([k, v]) => ['fecha', 'cuit', 'tipo', 'nro', 'importe', 'moneda'].includes(k) &&
      ['string', 'number'].includes(typeof v))
    .map(([k, v]) => `${k}: ${String(v).slice(0, 40)}`);
  const consigna = conocidos.length
    ? `${CONSIGNA}\n\nEstos datos ya se leyeron del código QR de ARCA o del texto del comprobante y son correctos; usalos tal cual:\n${conocidos.join('\n')}`
    : CONSIGNA;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': clave,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 1000,
        tools: [herramienta(listaRubros)],
        tool_choice: { type: 'tool', name: 'registrar_comprobante' },
        messages: [{ role: 'user', content: [bloque, { type: 'text', text: consigna }] }]
      })
    });

    if (!r.ok) {
      console.error('Anthropic respondió', r.status, await r.text());
      return falla('servicio', 'El servicio de lectura no respondió.', 502);
    }

    const d = await r.json();
    const uso = (d.content || []).find((c: { type: string }) => c.type === 'tool_use');
    if (!uso?.input) return falla('ilegible', 'No se pudo interpretar el comprobante.', 422);
    const datos = uso.input;

    // Si la suma no cierra, se deja lo que sí se leyó y se avisa.
    const num = (x: unknown) => Number(x) || 0;
    const suma = num(datos.neto) + num(datos.iva) + num(datos.percepciones);
    if (suma > 0 && Math.abs(suma - num(datos.importe)) > 1) {
      datos.aviso = 'El neto, el IVA y las percepciones que leyó la IA no suman el total. Revisalos.';
    }

    return json(datos);
  } catch (e) {
    console.error(e);
    return falla('servicio', 'No se pudo interpretar el comprobante.', 502);
  }
});
