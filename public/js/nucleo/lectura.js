/* =====================================================================
   nucleo/lectura.js
   Interpretación de comprobantes: QR de ARCA, texto (PDF u OCR) y
   combinación de lo que aporta cada fuente

   Funciones puras, sin pantalla ni red: las usa la lectura de
   comprobantes (formularios/lectura-comprobante.js) y se prueban en
   tests/unit/lectura.test.js.

   Script clásico: comparte el ámbito global con los demás archivos de
   js/. El orden de carga está en index.html (ver js/README.md).
   ===================================================================== */

/* Fuentes, de la más confiable a la menos. El QR lo genera ARCA con los
   datos que autorizó: es exacto. El texto de un PDF digital también. La
   IA interpreta la imagen y el OCR de una foto puede confundir dígitos. */
const FUENTES = ['qr', 'pdf', 'ia', 'ocr'];
const NOMBRE_FUENTE = { qr:'QR de ARCA', pdf:'texto del PDF', ia:'IA', ocr:'OCR',
  cuenta:'cuenta con el total y la alícuota' };

const TIPOS_ARCA = { 1:'Factura A', 6:'Factura B', 11:'Factura C' };
const NOTAS_ARCA = [2,3,7,8,12,13,52,53];

/* ---------- números, fechas y CUIT ---------- */

/* "1.234.567,89", "$ 1234,5", "1,234,567.89" o "121000" → número.
   El último separador seguido de 1 o 2 dígitos es el decimal. */
function numeroAR(s){
  if(s == null) return null;
  let t = String(s).replace(/[^\d.,-]/g, '');
  if(!/\d/.test(t)) return null;
  const m = t.match(/[.,](\d{1,2})$/);
  if(m){
    const ent = t.slice(0, -m[0].length).replace(/[.,]/g, '');
    t = `${ent}.${m[1]}`;
  } else t = t.replace(/[.,]/g, '');
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/* El último dígito del CUIT es verificador: descarta los que el OCR o la
   IA leyeron mal (un dígito cambiado casi nunca pasa la cuenta). */
function cuitValido(c){
  const d = String(c ?? '').replace(/\D/g, '');
  if(!/^(20|23|24|25|26|27|30|33|34)\d{9}$/.test(d)) return false;
  const pesos = [5,4,3,2,7,6,5,4,3,2];
  const s = pesos.reduce((a, p, i) => a + p * +d[i], 0);
  let v = 11 - (s % 11);
  if(v === 11) v = 0;
  if(v === 10) v = 9;
  return v === +d[10];
}
const soloDigitos = c => String(c ?? '').replace(/\D/g, '');
const formatoCuit = c => { const d = soloDigitos(c);
  return d.length === 11 ? `${d.slice(0,2)}-${d.slice(2,10)}-${d.slice(10)}` : (c || ''); };

/* dd/mm/aaaa, dd-mm-aa o aaaa-mm-dd → AAAA-MM-DD, solo si la fecha existe */
function fechaISO(s){
  if(!s) return null;
  let a, m, d, r;
  if((r = String(s).match(/(\d{4})-(\d{1,2})-(\d{1,2})/))) [, a, m, d] = r;
  else if((r = String(s).match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/))){
    [, d, m, a] = r;
    if(a.length === 2) a = '20' + a;
  } else return null;
  const f = new Date(+a, +m - 1, +d);
  if(f.getFullYear() !== +a || f.getMonth() !== +m - 1 || f.getDate() !== +d) return null;
  if(+a < 2000 || +a > 2100) return null;
  return `${a}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

const numeroComprobante = (pv, nro) =>
  `${String(+pv).padStart(4,'0')}-${String(+nro).padStart(8,'0')}`;
/* Para comparar números de comprobante escritos distinto (0003-00001234 y 3-1234) */
const claveNumero = n => {
  const p = String(n ?? '').match(/(\d+)\D+(\d+)/);
  return p ? `${+p[1]}-${+p[2]}` : soloDigitos(n).replace(/^0+/, '');
};

/* ---------- QR de ARCA ----------
   El QR es un enlace https://www.afip.gob.ar/fe/qr/?p=<JSON en base64>
   (o arca.gob.ar) con fecha, CUIT, tipo, punto de venta, número, total,
   moneda, cotización y CAE. Especificación: RG 4291. */
function leerQrArca(texto){
  if(!texto) return null;
  let p;
  try{
    const u = new URL(String(texto).trim());
    if(!/(^|\.)(afip|arca)\.gob\.ar$/.test(u.hostname)) return null;
    p = u.searchParams.get('p');
  }catch(e){ return null; }
  if(!p) return null;
  let j;
  try{
    const b64 = p.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '');
    j = JSON.parse(atob(b64 + '='.repeat((4 - b64.length % 4) % 4)));
  }catch(e){ return null; }
  if(!j || !j.cuit || !j.importe) return null;

  const datos = {
    fecha: fechaISO(j.fecha),
    cuit: cuitValido(j.cuit) ? formatoCuit(j.cuit) : null,
    tipo: TIPOS_ARCA[+j.tipoCmp] || null,
    nro: j.ptoVta != null && j.nroCmp != null ? numeroComprobante(j.ptoVta, j.nroCmp) : null,
    importe: Number(j.importe) || null,
    moneda: j.moneda === 'PES' ? 'ARS' : j.moneda === 'DOL' ? 'USD' : null,
    cae: j.codAut ? String(j.codAut) : null,
    receptor: j.nroDocRec ? soloDigitos(j.nroDocRec) : null
  };
  if(datos.moneda === 'USD' && +j.ctz > 1) datos.cotizacion = +j.ctz;
  if(NOTAS_ARCA.includes(+j.tipoCmp))
    datos.aviso = 'Es una nota de crédito o débito: el sistema la carga como factura. Revisá el tipo.';
  return datos;
}

/* ---------- texto de la factura (PDF u OCR) ----------
   Busca los rótulos que usan las facturas argentinas ("Importe Neto
   Gravado", "IVA 21%", "Importe Total", "Punto de Venta", "CAE"…). Toma
   el último importe de la línea del rótulo o, si no hay, de la siguiente. */
const RE_IMPORTE = /-?\$?\s*\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{1,2})?(?!\d)|-?\$?\s*\d+(?:[.,]\d{1,2})?(?!\d)/g;
function importesDe(linea){
  // Se sacan los porcentajes ("IVA 21%") para que no se confundan con montos
  const limpia = linea.replace(/\d+(?:[.,]\d+)?\s*%/g, ' ');
  return [...limpia.matchAll(RE_IMPORTE)].map(m => numeroAR(m[0])).filter(n => n != null);
}
/* Busca la primera línea con el rótulo y devuelve su último importe (o,
   si no tiene, el de la línea siguiente) junto con la línea. "s?ub" en el
   subtotal: el OCR a veces se come la S. */
function rotulo(lineas, re, excluir){
  for(let i = 0; i < lineas.length; i++){
    const l = lineas[i];
    if(!re.test(l) || (excluir && excluir.test(l)) || NO_ES_IMPORTE.test(l)) continue;
    const aca = importesDe(l.replace(re, ' '));
    if(aca.length) return { valor: aca[aca.length - 1], linea: l };
    // La de abajo solo si es nada más que un importe (sin otro rótulo)
    const abajo = lineas[i+1] || '';
    const sig = !/[a-zñ]{3,}/i.test(abajo.replace(/u\$s/gi, '')) ? importesDe(abajo) : [];
    if(sig.length) return { valor: sig[sig.length - 1], linea: l + ' ' + lineas[i+1] };
  }
  return null;
}

/* Tiques de controlador fiscal: 81 = tique factura A, 82 = B, 111 = C */
const TIPOS_TIQUE = { 81:'Factura A', 82:'Factura B', 111:'Factura C' };
const ALICUOTAS = [0, 2.5, 5, 10.5, 21, 27];
const RE_CLIENTE = /cliente|se[ñn]or(es)?|apellido\s*y\s*nombre|comprador|destinatario/i;
/* Líneas que tienen un importe pero no son del comprobante: el total en
   letras, números de Ingresos Brutos, el IVA "contenido" de la ley del
   consumidor. */
const NO_ES_IMPORTE = /\b(son|centavos)\b|ing(?:resos)?\.?\s*brutos|\bIIBB\s*:|contenido/i;

function leerTextoComprobante(texto, receptor, conocidos){
  if(!texto || !texto.trim()) return null;
  const lineas = texto.split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const todo = lineas.join('\n');
  const d = {};

  // CUIT del emisor. Se descartan el del receptor (si se sabe por el QR) y
  // los que están en el bloque del cliente. Si alguno es de un proveedor
  // del catálogo, ese es el emisor; si no, el primero (el emisor va arriba).
  const cuits = [];
  lineas.forEach((l, i) => {
    for(const m of l.matchAll(/\b(\d{2})[-\s.]?(\d{8})[-\s.]?(\d)\b/g)){
      const c = m[1] + m[2] + m[3];
      if(!cuitValido(c) || c === receptor || cuits.some(x => x.c === c)) continue;
      // Bloque del cliente: el rótulo en la misma línea o en las de arriba,
      // sin otro CUIT en el medio (ese sería el de otro bloque)
      let cliente = false;
      for(let j = i; j >= Math.max(0, i - 3); j--){
        if(j < i && /\d{2}[-\s.]?\d{8}[-\s.]?\d/.test(lineas[j])) break;
        if(RE_CLIENTE.test(lineas[j])){ cliente = true; break; }
      }
      // "CUIT (80) 30…": el 80 es el código de tipo de documento del receptor
      if(/\(\s*80\s*\)\s*$/.test(l.slice(0, m.index))) cliente = true;
      cuits.push({ c, cliente });
    }
  });
  // Si el único CUIT legible es el del cliente, mejor ninguno que el equivocado
  const emisor = cuits.find(x => conocidos?.includes(x.c)) || cuits.find(x => !x.cliente);
  if(emisor) d.cuit = formatoCuit(emisor.c);

  // Tipo: el código ("COD. 01", "Cód.081") o la letra junto a "FACTURA".
  // La letra tiene que estar en mayúscula: "factura a nombre de…" no cuenta.
  const cod = todo.match(/C[OÓ]D(?:IGO)?\.?\s*(?:N\s*[°ºo]\.?\s*)?:?\s*(\d{1,3})\b/i);
  const n = cod ? +cod[1] : null;
  const letra = [...todo.matchAll(/\b(?:FACTURAS?|FAC\.?)\b[^\n]{0,14}?["'“”]?\b([ABC])\b/gi)]
    .find(m => m[1] === m[1].toUpperCase());
  if(TIPOS_ARCA[n] || TIPOS_TIQUE[n]) d.tipo = TIPOS_ARCA[n] || TIPOS_TIQUE[n];
  else if(letra) d.tipo = 'Factura ' + letra[1];
  else if(/^\s*([ABC])\s*$/m.test(todo) && /FACTURA/i.test(todo)) d.tipo = 'Factura ' + todo.match(/^\s*([ABC])\s*$/m)[1];
  else if(/\bRECIBO\b/i.test(todo)) d.tipo = 'Recibo';
  else if(/\bREMITO\b/i.test(todo)) d.tipo = 'Remito';

  // Número: "Punto de Venta: 00003 Comp. Nro: 00001234" (a veces con los
  // valores en la línea de abajo) o "0003-00001234"
  const pv = todo.match(/Punto\s*de\s*Venta\s*:?\s*(\d{1,5})[\s\S]{0,40}?(?:Comp(?:robante)?\.?\s*)?N(?:ro|°|º|o)\.?\s*:?\s*(\d{1,8})/i)
          || todo.match(/Punto\s*de\s*Venta\s*:?\s*Comp\.?\s*Nro\.?\s*:?\s*(\d{1,5})\s+(\d{1,8})/i);
  const guion = todo.match(/\b(\d{4,5})\s*-\s*(\d{8})\b/);
  if(pv) d.nro = numeroComprobante(pv[1], pv[2]);
  else if(guion) d.nro = numeroComprobante(guion[1], guion[2]);

  // Fecha de emisión. Si no está rotulada, la primera fecha que no sea de
  // inicio de actividades, vencimiento, período o impresión.
  const femi = todo.match(/Fecha(?:\s*de\s*Emisi[oó]n)?\s*:?\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/i);
  const otra = lineas.filter(l => !/inicio|activ|venc|vto|impresi|desde|hasta|pago/i.test(l))
    .map(l => l.match(/\b\d{1,2}[/.-]\d{1,2}[/.-]\d{4}\b/)?.[0]).find(f => fechaISO(f));
  d.fecha = fechaISO(femi?.[1]) || fechaISO(otra);

  // Razón social del emisor (el formato de ARCA la rotula)
  const rs = todo.match(/Raz[oó]n\s*Social\s*:?\s*([^\n]{3,80})/i);
  // (sin lo que el OCR pega de la columna de al lado: números sueltos al final)
  if(rs) d.proveedor = rs[1].replace(/\s*(Fecha|Domicilio|CUIT).*$/i, '')
    .replace(/(\s+[\d.,:-]+)+\s*$/, '').trim() || undefined;

  // Total. Con "u$s" en la línea del total, el comprobante es en dólares
  // (no alcanza con que diga "Tipo de cambio: U$S 1 = …").
  const NO_TOTAL = /sub\s*-?\s*tot|total\s*(?:de\s*)?iva|\b(son|centavos)\b/i;
  const total = rotulo(lineas, /importe\s*total|\btotal\b\s*(?:a\s*pagar|general|factura|\$)?\s*[:$]/i, NO_TOTAL)
             || rotulo(lineas, /^\s*total\b/i, NO_TOTAL);
  if(total){
    d.importe = total.valor;
    if(/u\$s|us\$|\busd\b/i.test(total.linea)) d.moneda = 'USD';
  }

  // Neto gravado. "Subtotal" solo seguido de ":", "$" o un número: en el
  // encabezado de la tabla de ítems también aparece, y ahí no es el neto.
  d.neto = rotulo(lineas, /neto\s*gravado|neto\.?\s*s\.?\s*\/?\s*iva|importe\s*neto|monto\s*gravado|^\s*gravado\b|^\s*neto\s*:/i)?.valor
        ?? rotulo(lineas, /\bs?ub\s*-?\s*total\s*[:$]|^\s*sub\s*-?\s*total\b(?=\s*\$?\s*\d)/i, /iva/i)?.valor;
  const exento = rotulo(lineas, /(?:importe|monto|subtot\.?\s*imp\.?)\s*exento/i)?.valor;
  if(exento > 0) d.exento = exento;

  // IVA: el total de IVA si está rotulado; si no, la suma de las alícuotas
  // ("IVA 21%: $ 21000,00", "I.V.A. 10,5% 21.000", "IVA: 21.00 5223.97")
  const ivaTotal = rotulo(lineas, /sub\s*total\s*iva|total\s*(?:de\s*)?iva|importe\s*iva\b/i);
  if(ivaTotal) d.iva = ivaTotal.valor;
  else {
    let suma = 0, hay = false;
    for(const l of lineas){
      if(/percep|contenido|inscri|respons|exento/i.test(l)) continue;
      for(const m of l.matchAll(/I\.?\s?V\.?\s?A\.?\s*:?\s*(\d{1,2}(?:[.,]\d{1,2})?)\s*%?\s*:?\s*[-–—]?\s*(?:u?\$s?)?\s*(\d[\d.,]*)/gi)){
        if(!ALICUOTAS.includes(numeroAR(m[1]))) continue;
        const v = numeroAR(m[2]);
        if(v != null){ suma += v; hay = true; }
      }
    }
    if(hay) d.iva = Math.round(suma * 100) / 100;
  }

  // Percepciones y otros tributos
  d.percepciones = rotulo(lineas, /importe\s*otros\s*tributos/i)?.valor;
  if(d.percepciones == null){
    let p = 0, hay = false;
    for(const l of lineas){
      if(!/percep|\bperc\.\s/i.test(l)) continue;
      const v = importesDe(l);
      if(v.length){ p += v[v.length - 1]; hay = true; }
    }
    if(hay) d.percepciones = Math.round(p * 100) / 100;
  }

  for(const k of Object.keys(d)) if(d[k] == null) delete d[k];
  return Object.keys(d).length ? d : null;
}

/* ---------- combinar ---------- */

/* El desglose (neto + IVA + percepciones) cierra con el total, con un peso
   de tolerancia por redondeos. */
const cierraDesglose = (x, total) => {
  const s = (+x.neto || 0) + (+x.exento || 0) + (+x.iva || 0) + (+x.percepciones || 0);
  return s > 0 && total > 0 && Math.abs(s - total) <= 1;
};

/* Junta lo que leyó cada fuente. Cada campo sale de la fuente más
   confiable que lo tenga; el desglose sale entero de una sola fuente,
   la primera cuyo desglose cierre con el total elegido. Devuelve los
   datos y de qué fuente salió cada uno. */
function combinarLecturas(capas){
  const datos = {}, fuente = {};
  const orden = FUENTES.filter(f => capas[f]);
  const CAMPOS = ['fecha','proveedor','cuit','tipo','nro','moneda','importe','cotizacion','detalle','rubro'];
  for(const k of CAMPOS){
    for(const f of orden){
      let v = capas[f][k];
      if(v == null || v === '') continue;
      if(k === 'cuit'){ if(!cuitValido(v)) continue; v = formatoCuit(v); }
      if(k === 'fecha'){ v = fechaISO(v); if(!v) continue; }
      if(k === 'importe' || k === 'cotizacion'){ v = +v; if(!(v > 0)) continue; }
      datos[k] = v; fuente[k] = f; break;
    }
  }
  const conDesglose = orden.filter(f => ['neto','exento','iva','percepciones'].some(k => capas[f][k] != null));
  const elegida = conDesglose.find(f => cierraDesglose(capas[f], datos.importe)) || conDesglose[0];
  if(elegida) for(const k of ['neto','exento','iva','percepciones']){
    if(capas[elegida][k] != null){ datos[k] = +capas[elegida][k] || 0; fuente[k] = elegida; }
  }
  const avisos = orden.map(f => capas[f].aviso).filter(Boolean);
  // Si el desglose no cierra pero el total es firme (QR o PDF), se prueba
  // corregir un solo dato con la cuenta: el IVA tiene que ser una alícuota
  // real del neto (21 %, 10,5 %, 27 %…). Típico de un dígito mal leído.
  if(elegida && datos.importe && ['qr','pdf'].includes(fuente.importe) && !cierraDesglose(datos, datos.importe)){
    const arreglo = repararDesglose(datos, datos.importe);
    if(arreglo){
      Object.assign(datos, arreglo.datos);
      for(const k of Object.keys(arreglo.datos)) fuente[k] = 'cuenta';
      avisos.push(arreglo.aviso);
    }
  }
  // El formulario no tiene campo para lo exento: va sumado al neto
  if(datos.exento > 0){
    datos.neto = (+datos.neto || 0) + datos.exento;
    fuente.neto = fuente.neto || fuente.exento;
    avisos.push('El comprobante tiene importe exento: quedó sumado al neto.');
  }
  // Si el total de la IA o del OCR no coincide con el del QR, manda el QR
  if(capas.qr?.importe && ['ia','ocr'].some(f => capas[f]?.importe &&
       Math.abs(+capas[f].importe - capas.qr.importe) > 1))
    avisos.push('El total leído de la imagen no coincide con el del QR: se usó el del QR.');
  const sinExento = { ...datos, exento: 0 };
  if(datos.neto != null && datos.importe && !cierraDesglose(sinExento, datos.importe) &&
     ((+datos.neto||0)+(+datos.iva||0)+(+datos.percepciones||0)) > 0)
    avisos.push('El neto, el IVA y las percepciones no suman el total. Revisalos.');
  return { datos, fuente, avisos };
}

const TASAS = [0.21, 0.105, 0.27, 0.05, 0.025];
const esTasa = (iva, neto) => neto > 0 && TASAS.some(t => Math.abs(iva - neto * t) <= Math.max(1, neto * t * 0.002));
const r2 = n => Math.round(n * 100) / 100;
function repararDesglose(d, total){
  const iva = +d.iva || 0, neto = +d.neto || 0, otros = (+d.percepciones || 0) + (+d.exento || 0);
  const netoCalc = r2(total - iva - otros);
  if(iva > 0 && esTasa(iva, netoCalc))
    return { datos: { neto: netoCalc }, aviso: 'El neto se calculó como total menos IVA: revisalo.' };
  const ivaCalc = r2(total - neto - otros);
  if(neto > 0 && ivaCalc > 0 && esTasa(ivaCalc, neto))
    return { datos: { iva: ivaCalc }, aviso: 'El IVA se calculó como total menos neto: revisalo.' };
  return null;
}

/* Qué falta para dar el comprobante por leído. Si no falta nada, no se
   consulta a la IA. El detalle y el rubro no cuentan: el rubro sale del
   proveedor conocido y el detalle es opcional. */
function faltantesLectura(d){
  const f = [];
  if(!d.fecha) f.push('fecha');
  if(!d.proveedor) f.push('proveedor');
  if(!d.cuit && d.tipo !== 'Sin comprobante') f.push('CUIT');
  if(!d.tipo) f.push('tipo');
  if(!d.nro && /^Factura/.test(d.tipo || '')) f.push('número');
  if(!d.importe) f.push('importe');
  // Una factura A sin IVA es sospechosa (suele ser el total leído como
  // neto), salvo que el comprobante sea exento
  if(d.tipo === 'Factura A' && (!cierraDesglose({ ...d, exento: 0 }, d.importe) || !(+d.iva > 0 || +d.exento > 0)))
    f.push('neto e IVA');
  return f;
}
