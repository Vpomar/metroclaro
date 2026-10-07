// =====================================================================
//  leer-comprobante
//
//  Recibe la foto o el PDF de un comprobante y devuelve sus datos.
//  La clave de Anthropic vive acá, en el servidor, y nunca baja
//  al navegador del usuario.
//
//  Desplegar con:  supabase functions deploy leer-comprobante
//  La clave se carga con: supabase secrets set ANTHROPIC_API_KEY=...
// =====================================================================

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  // Solo usuarios autenticados. Sin encabezado no se procesa nada.
  if (!req.headers.get('Authorization')) {
    return json({ error: 'Falta autenticación.' }, 401);
  }

  const clave = Deno.env.get('ANTHROPIC_API_KEY');
  if (!clave) return json({ error: 'Falta configurar ANTHROPIC_API_KEY.' }, 500);

  let archivo: string, tipo: string, rubros: string[];
  try {
    ({ archivo, tipo, rubros } = await req.json());
  } catch {
    return json({ error: 'Cuerpo inválido.' }, 400);
  }
  if (!archivo) return json({ error: 'No llegó el archivo.' }, 400);

  const bloque = tipo === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: archivo } }
    : { type: 'image',    source: { type: 'base64', media_type: tipo || 'image/jpeg', data: archivo } };

  const listaRubros = (rubros || []).join(' | ');

  const consigna = [
    'Sos un asistente contable argentino. Este es un comprobante de compra de una obra en construcción.',
    'Extraé los datos y respondé SOLO con un objeto JSON, sin markdown ni texto alrededor:',
    '',
    '{"fecha":"AAAA-MM-DD","proveedor":"razón social del emisor","cuit":"CUIT del emisor con guiones",',
    ' "tipo":"Factura A|Factura B|Factura C|Recibo|Remito|Sin comprobante",',
    ' "nro":"punto de venta y número, ej 0001-00001234","moneda":"ARS o USD",',
    ' "importe":numero,"neto":numero,"iva":numero,"percepciones":numero,',
    ' "detalle":"qué se compró, breve","rubro":"el más adecuado de: ' + listaRubros + '"}',
    '',
    'Reglas para los importes:',
    '- "importe" es el TOTAL final del comprobante, el que se paga.',
    '- En FACTURA A los impuestos vienen discriminados. Buscá en el pie las líneas rotuladas',
    '  "Neto Gravado" o "Subtotal", "IVA 21%" o "IVA 10,5%", y las percepciones de IVA,',
    '  Ganancias, Ingresos Brutos o impuestos internos.',
    '  Cargá "neto" con el neto gravado, "iva" con la suma de todas las alícuotas de IVA,',
    '  y "percepciones" con la suma de percepciones y otros tributos.',
    '  Si hay más de una alícuota de IVA, sumalas en un solo número.',
    '- neto + iva + percepciones tiene que dar exactamente "importe".',
    '  Verificá esa suma antes de responder y corregí si no cierra.',
    '- En FACTURA B y C el IVA no se discrimina: poné "neto" igual al importe total,',
    '  y 0 en "iva" y "percepciones".',
    '- En remitos y comprobantes sin discriminación, poné 0 en los tres.',
    '- Los números van sin separador de miles y con punto decimal.',
    '  No inventes datos: si algo no se lee, poné null.'
  ].join('\n');

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': clave,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ role: 'user', content: [bloque, { type: 'text', text: consigna }] }]
      })
    });

    if (!r.ok) {
      const detalle = await r.text();
      console.error('Anthropic respondió', r.status, detalle);
      return json({ error: 'El servicio de lectura no respondió.' }, 502);
    }

    const d = await r.json();
    const texto = (d.content || [])
      .filter((c: { type: string }) => c.type === 'text')
      .map((c: { text: string }) => c.text)
      .join('')
      .replace(/```json|```/g, '')
      .trim();

    const datos = JSON.parse(texto);

    // Si la suma no cierra, se deja lo que sí se leyó y se avisa.
    const n = (x: unknown) => Number(x) || 0;
    const suma = n(datos.neto) + n(datos.iva) + n(datos.percepciones);
    if (suma > 0 && Math.abs(suma - n(datos.importe)) > 1) {
      datos.aviso = 'El neto, el IVA y las percepciones no suman el total. Revisalos.';
    }

    return json(datos);
  } catch (e) {
    console.error(e);
    return json({ error: 'No se pudo interpretar el comprobante.' }, 500);
  }
});
