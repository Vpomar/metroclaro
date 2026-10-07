/* =====================================================================
   formularios/lectura-comprobante.js
   Lectura de comprobantes: QR de ARCA → texto (PDF u OCR) → IA

   Script clásico: comparte el ámbito global con los demás archivos de
   js/. El orden de carga está en index.html (ver js/README.md).
   ===================================================================== */

/* Al elegir la foto o el PDF en "Cargar comprobante", se prueba en orden
   y se para apenas están todos los datos (ver faltantesLectura):

     1. QR de ARCA. Toda factura electrónica lo trae: fecha, CUIT, tipo,
        número, total y moneda exactos. Código, gratis, sin red.
     2. Texto. Si es un PDF digital, su propio texto (exacto). Si es una
        foto o un PDF escaneado, OCR en el teléfono (Tesseract). Aporta el
        desglose de IVA y lo que el QR no trae.
     3. IA (Edge Function leer-comprobante). Solo si todavía falta algo o
        los números no cierran. Si falla, queda lo que leyeron 1 y 2.

   Con el CUIT se busca el proveedor en el catálogo: de ahí salen su
   nombre exacto y su rubro. Lo que vino de cada fuente queda marcado en
   el formulario para revisarlo. Las librerías (public/vendor/) se cargan
   recién acá, la primera vez que se usan. */

const VENDOR = {
  zxing: 'vendor/zxing-3.1.5/zxing-reader.js',
  zxingWasm: 'vendor/zxing-3.1.5/zxing_reader.wasm',
  pdf: 'vendor/pdfjs-6.4.299/pdf.min.mjs',
  pdfWorker: 'vendor/pdfjs-6.4.299/pdf.worker.min.mjs',
  tesseract: 'vendor/tesseract-7.0.0/tesseract.min.js',
  tesseractWorker: 'vendor/tesseract-7.0.0/worker.min.js',
  tesseractCore: 'vendor/tesseract-core-7.0.0',
  tesseractIdioma: 'vendor/tesseract-spa-1.0.0'
};
const MAX_ARCHIVO = 15 * 1024 * 1024;   // el límite del depósito de archivos
const MAX_IA = 8 * 1024 * 1024;         // lo que acepta la Edge Function
const LADO_MAX = 2000;                  // px: alcanza para leer y pesa poco
const LADO_QR = 4096;                   // px: segundo intento del QR, en la foto original

const urlVendor = r => new URL(r, location.href).href;
const scriptsCargados = {};
function cargarScript(ruta){
  return scriptsCargados[ruta] ??= new Promise((ok, mal) => {
    const s = document.createElement('script');
    s.src = urlVendor(ruta);
    s.onload = ok;
    s.onerror = () => { delete scriptsCargados[ruta]; mal(new Error('No se pudo cargar ' + ruta)); };
    document.head.append(s);
  });
}
const aBase64 = blob => new Promise((ok, mal) => {
  const r = new FileReader();
  r.onload = () => ok(r.result.split(',')[1]);
  r.onerror = () => mal(new Error('lectura'));
  r.readAsDataURL(blob);
});

/* ---------- preparar el archivo ---------- */

/* La foto se achica a 2000 px y se pasa a JPEG: una foto de iPhone pesa
   3 a 6 MB (la IA no acepta más de 5) y puede venir en HEIC, que la IA no
   lee. La versión achicada es también la que se guarda con el asiento. */
async function prepararImagen(f){
  const url = URL.createObjectURL(f);
  try{
    const img = await new Promise((ok, mal) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => mal(new Error('formato'));
      i.src = url;
    });
    const k = Math.min(1, LADO_MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * k);
    canvas.height = Math.round(img.naturalHeight * k);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(ok => canvas.toBlob(ok, 'image/jpeg', 0.85));
    const nombre = (f.name || 'comprobante').replace(/\.[^.]+$/, '') + '.jpg';
    const archivo = new File([blob], nombre, { type: 'image/jpeg' });
    // Para el QR se usa la foto a resolución completa (hasta 4096 px): en una
    // foto achicada el QR de un ticket queda con módulos de 1 o 2 píxeles.
    let original = canvas;
    if(k < 1){
      const ko = Math.min(1, LADO_QR / Math.max(img.naturalWidth, img.naturalHeight));
      original = document.createElement('canvas');
      original.width = Math.round(img.naturalWidth * ko);
      original.height = Math.round(img.naturalHeight * ko);
      original.getContext('2d').drawImage(img, 0, 0, original.width, original.height);
    }
    return { canvas, original, archivo, ia: { blob, tipo: 'image/jpeg' } };
  } finally { URL.revokeObjectURL(url); }
}

/* El PDF se guarda tal cual. Se le saca el texto (si es digital) y se
   dibuja la primera página para buscar el QR o pasarle el OCR. */
async function prepararPdf(f){
  const pdfjs = await import(urlVendor(VENDOR.pdf));
  pdfjs.GlobalWorkerOptions.workerSrc = urlVendor(VENDOR.pdfWorker);
  const tarea = pdfjs.getDocument({ data: await f.arrayBuffer(), isEvalSupported: false });
  const doc = await tarea.promise;
  try{
    const lineas = [];
    for(let n = 1; n <= Math.min(doc.numPages, 3); n++){
      const c = await (await doc.getPage(n)).getTextContent();
      // Se agrupan los fragmentos por altura para rearmar las líneas
      const porLinea = new Map();
      for(const it of c.items){
        if(!it.str?.trim()) continue;
        const y = Math.round(it.transform[5] / 3);
        if(!porLinea.has(y)) porLinea.set(y, []);
        porLinea.get(y).push(it);
      }
      [...porLinea.entries()].sort((a, b) => b[0] - a[0]).forEach(([, items]) =>
        lineas.push(items.sort((a, b) => a.transform[4] - b.transform[4]).map(i => i.str.trim()).join(' ')));
    }
    const pagina = await doc.getPage(1);
    const base = pagina.getViewport({ scale: 1 });
    const viewport = pagina.getViewport({ scale: LADO_MAX / Math.max(base.width, base.height) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await pagina.render({ canvas, canvasContext: ctx, viewport }).promise;
    const texto = lineas.join('\n');
    return { canvas, archivo: f, texto: texto.replace(/\s/g, '').length > 40 ? texto : '',
             ia: f.size <= MAX_IA ? { blob: f, tipo: 'application/pdf' } : null };
  } finally { tarea.destroy(); }
}

/* ---------- 1. QR ---------- */

/* Primero el lector nativo del navegador, si tiene (Chrome en Android), y
   si no ZXing, sobre la foto achicada y, si no aparece, sobre la original.
   Además de los datos devuelve cuánto está girado el comprobante (el QR
   se imprime derecho), para enderezar la foto antes del OCR. Un QR muy
   borroso o arrugado puede no leerse: para eso siguen el OCR y la IA. */
let zxingListo = null;
async function cargarZxing(){
  return zxingListo ??= cargarScript(VENDOR.zxing).then(() => {
    window.ZXingWASM.prepareZXingModule({
      overrides: { locateFile: (p, prefijo) => p.endsWith('.wasm') ? urlVendor(VENDOR.zxingWasm) : prefijo + p },
      fireImmediately: true
    });
  });
}
async function buscarQr(canvas, original){
  if('BarcodeDetector' in window){
    try{
      const det = new window.BarcodeDetector({ formats: ['qr_code'] });
      for(const r of await det.detect(canvas)){
        const datos = leerQrArca(r.rawValue);
        if(!datos) continue;
        const [a, b] = r.cornerPoints || [];
        datos.giro = a && b ? Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI : null;
        return datos;
      }
    }catch(e){ /* no soporta QR: sigue con ZXing */ }
  }
  await cargarZxing();
  for(const c of original && original !== canvas ? [canvas, original] : [canvas]){
    const px = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    const res = await window.ZXingWASM.readBarcodes(px,
      { formats: ['QRCode'], tryHarder: true, maxNumberOfSymbols: 2 });
    for(const r of res){
      const datos = r.isValid && leerQrArca(r.text);
      if(datos){ datos.giro = r.orientation; return datos; }
    }
  }
  return null;
}

/* ---------- 2. OCR ---------- */

async function abrirOcr(){
  await cargarScript(VENDOR.tesseract);
  return window.Tesseract.createWorker('spa', 1, {
    workerPath: urlVendor(VENDOR.tesseractWorker),
    corePath: urlVendor(VENDOR.tesseractCore),
    langPath: urlVendor(VENDOR.tesseractIdioma),
    gzip: true
  });
}

function rotarCanvas(canvas, grados){
  const r = grados * Math.PI / 180, cos = Math.abs(Math.cos(r)), sin = Math.abs(Math.sin(r));
  const c = document.createElement('canvas');
  c.width = Math.round(canvas.width * cos + canvas.height * sin);
  c.height = Math.round(canvas.width * sin + canvas.height * cos);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate(r);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return c;
}

/* Cuántos datos clave sacó una lectura: sirve para elegir la orientación */
const puntajeLectura = t => t ? ['cuit','importe','fecha','nro','tipo'].filter(k => t[k] != null).length : 0;

/* OCR de la foto. Si el QR dijo cuánto está girada, se endereza; si no
   hay QR, se prueba derecha y, si sale poco, de costado hacia cada lado
   (muchas fotos de facturas A4 se sacan apaisadas). */
async function leerConOcr(canvas, qr, interpretar){
  const giros = qr?.giro != null ? [-qr.giro] : [0, 90, -90];
  const worker = await abrirOcr();
  // Se cierra al terminar: en un celular el OCR ocupa bastante memoria
  try{
    let mejor = null;
    for(const g of giros){
      const c = Math.abs(g) > 2 ? rotarCanvas(canvas, g) : canvas;
      const t = interpretar((await worker.recognize(c)).data.text);
      if(puntajeLectura(t) > puntajeLectura(mejor)) mejor = t;
      if(puntajeLectura(mejor) >= 4) break;
    }
    return mejor;
  } finally { worker.terminate(); }
}

/* ---------- 3. IA ---------- */

const ERRORES_IA = {
  sin_clave: 'la lectura con IA no está configurada en este sistema',
  sin_permiso: 'tu usuario no puede usar la lectura con IA',
  muy_grande: 'el archivo es demasiado grande para la IA',
  servicio: 'el servicio de IA no respondió'
};
async function consultarIA(prep, conocido){
  const b64 = await aBase64(prep.ia.blob);
  const pistas = {};
  for(const k of ['fecha','cuit','tipo','nro','importe','moneda'])
    if(conocido[k] != null) pistas[k] = conocido[k];
  const { data, error } = await sb.functions.invoke('leer-comprobante', {
    body: { archivo: b64, tipo: prep.ia.tipo, rubros: D.rubros.map(r => r.nombre), pistas }
  });
  if(error){
    let codigo = null;
    try{ codigo = (await error.context?.json())?.codigo; }catch(e){}
    throw new Error(ERRORES_IA[codigo] || 'el servicio de IA no respondió');
  }
  if(data?.error) throw new Error(ERRORES_IA[data.codigo] || data.error);
  return data;
}

/* ---------- combinar y completar el formulario ---------- */

function evaluarLectura(capas){
  const r = combinarLecturas(capas);
  // El proveedor del catálogo manda: nombre exacto y su rubro
  const p = r.datos.cuit && proveedorPorCuit(r.datos.cuit);
  if(p){
    r.datos.proveedor = p.nombre; r.fuente.proveedor = 'catalogo';
    if(p.rubro_id) r.rubroId = p.rubro_id;
  }
  r.faltan = faltantesLectura(r.datos);
  return r;
}

function completarFormulario(r){
  const marcar = (el, f) => {
    el.classList.add('leido');
    el.title = 'Completado con: ' + (f === 'catalogo' ? 'catálogo de proveedores' : NOMBRE_FUENTE[f]);
    el.addEventListener('input', () => el.classList.remove('leido'), { once: true });
    el.addEventListener('change', () => el.classList.remove('leido'), { once: true });
  };
  const poner = (id, k) => {
    const el = document.getElementById(id), v = r.datos[k];
    if(!el || v == null || v === '') return;
    el.value = v; marcar(el, r.fuente[k]);
  };
  poner('f', 'fecha'); poner('prov', 'proveedor'); poner('cuit', 'cuit');
  poner('nro', 'nro'); poner('det', 'detalle'); poner('imp', 'importe');
  // Un desglose dudoso no se completa: mejor vacío que con un número mal leído
  if(!r.faltan.includes('neto e IVA')){
    poner('neto', 'neto'); poner('iva', 'iva'); poner('perc', 'percepciones');
  }
  const tipo = document.getElementById('tipo');
  if(r.datos.tipo && [...tipo.options].some(op => op.text === r.datos.tipo)){
    tipo.value = r.datos.tipo; marcar(tipo, r.fuente.tipo);
  }
  if(r.datos.moneda){
    const mon = document.getElementById('mon');
    mon.value = r.datos.moneda; marcar(mon, r.fuente.moneda); tglCotiz();
    if(r.datos.moneda === 'USD' && r.datos.cotizacion) poner('ct', 'cotizacion');
  }
  // El rubro elegido a mano no se toca
  const rub = document.getElementById('rub');
  if(!rub.dataset.tocado){
    const id = r.rubroId || D.rubros.find(x => x.nombre === r.datos.rubro)?.id;
    if(id && D.rubros.some(x => x.id === id)){
      rub.value = id; marcar(rub, r.rubroId ? 'catalogo' : r.fuente.rubro);
    }
  }
  if(r.fuente.proveedor !== 'catalogo') autoProveedor();
  calcularIva();
}

/* ---------- la lectura completa ---------- */

async function leerComprobante(input){
  const f = input.files?.[0]; if(!f) return;
  const box = document.getElementById('lector'), est = document.getElementById('foto-estado');
  const paso = t => { est.textContent = t; };
  archivoPendiente = null;
  if(f.size > MAX_ARCHIVO){
    input.value = '';
    return paso('El archivo pesa más de 15 MB. Probá con una foto o un PDF más liviano.');
  }
  box.classList.add('leyendo');
  const capas = {};
  const usadas = [];
  let prep = null, problemaIA = null;
  try{
    paso('Preparando el archivo…');
    const esPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
    try{ prep = esPdf ? await prepararPdf(f) : await prepararImagen(f); }
    catch(e){ console.warn(e); prep = { archivo: f }; }
    archivoPendiente = prep.archivo;
    if(!prep.canvas){
      box.classList.remove('leyendo');
      return paso('No pude abrir el archivo para leerlo (si es una foto HEIC, sacala desde ' +
        'la cámara o exportala como JPG). Se guarda igual: cargá los datos a mano.');
    }

    paso('Buscando el código QR de la factura…');
    try{ const q = await buscarQr(prep.canvas, prep.original); if(q){ capas.qr = q; usadas.push('qr'); } }
    catch(e){ console.warn('QR', e); }
    const receptor = capas.qr?.receptor;

    // CUIT de los proveedores conocidos: ayudan a distinguir emisor y cliente
    const conocidos = proveedoresConocidos().map(p => soloDigitos(p.cuit)).filter(c => c.length === 11);
    if(prep.texto){
      const t = leerTextoComprobante(prep.texto, receptor, conocidos);
      if(t){ capas.pdf = t; usadas.push('pdf'); }
    }
    let r = evaluarLectura(capas);

    if(r.faltan.length && !prep.texto){
      paso('Leyendo el texto del comprobante… (la primera vez tarda un poco más)');
      try{
        const t = await leerConOcr(prep.canvas, capas.qr, x => leerTextoComprobante(x, receptor, conocidos));
        if(t){ capas.ocr = t; usadas.push('ocr'); r = evaluarLectura(capas); }
      }catch(e){ console.warn('OCR', e); }
    }

    if(r.faltan.length && prep.ia){
      paso('Consultando a la IA por lo que falta…');
      try{ capas.ia = await consultarIA(prep, r.datos); usadas.push('ia'); r = evaluarLectura(capas); }
      catch(e){ console.warn('IA', e); problemaIA = e.message; }
    }

    completarFormulario(r);

    const partes = [];
    partes.push(usadas.length
      ? `Leído con: ${usadas.map(u => NOMBRE_FUENTE[u]).join(', ')}. Revisá los campos marcados.`
      : 'No pude leer datos del comprobante.');
    if(problemaIA) partes.push(`No usé la IA: ${problemaIA}.`);
    if(r.faltan.length) partes.push(`Completá a mano: ${r.faltan.join(', ')}.`);
    partes.push(...r.avisos);
    const dup = comprobanteDuplicado(r.datos.cuit, r.datos.nro, document.getElementById('lector').dataset.id);
    if(dup) partes.push(`Atención: ya está cargado el comprobante ${dup.numero} de ${dup.proveedor} ` +
      `(${fecha(dup.fecha)}${dup.obra ? ', ' + dup.obra : ''}).`);
    partes.push('El archivo se guarda con el asiento.');
    paso(partes.join(' '));
  }catch(e){
    console.error(e);
    paso('No pude leer el comprobante, pero el archivo se guarda igual. Cargá los datos a mano.');
  }
  box.classList.remove('leyendo');
}
