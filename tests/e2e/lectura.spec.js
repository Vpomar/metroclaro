// Lectura de comprobantes de punta a punta, en un navegador real y sin red:
// QR de ARCA → texto (PDF u OCR) → IA. La IA (Edge Function) se simula;
// el QR, el PDF y el OCR corren de verdad con las librerías de public/vendor.
import { test, expect } from '@playwright/test';
import { abrirConDatos } from './ayudantes.js';
import { htmlFactura, EMISOR } from './factura-demo.js';

test.setTimeout(120_000);

// Proveedor del catálogo con el CUIT de la factura de prueba
const CATALOGO = `D => {
  const r = D.rubros.find(x => x.nombre === 'Estructura');
  D.proveedores.push({ id: 'p-horm', nombre: 'Hormigones del Paraná SA', cuit: '30-71234567-1',
    rubro_id: r.id, activo: true });
}`;

async function generar(browser, opciones, formato) {
  const p = await browser.newPage({ viewport: { width: 1000, height: 1300 } });
  await p.setContent(await htmlFactura(opciones));
  if (formato === 'girada') {
    // Como una foto de una factura A4 sacada apaisada
    await p.evaluate(() => Object.assign(document.body.style,
      { transform: 'rotate(90deg) translate(0,-100%)', transformOrigin: 'top left' }));
    await p.setViewportSize({ width: 1300, height: 1000 });
  }
  const b = formato === 'pdf'
    ? await p.pdf({ format: 'A4', printBackground: true })
    : await p.screenshot({ fullPage: formato !== 'girada' });
  await p.close();
  return b;
}

// Simula la Edge Function y cuenta las llamadas
async function simularIA(page, responder) {
  const llamadas = [];
  await page.route(/functions\/v1\/leer-comprobante/, async (route) => {
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 200, headers: cors });
    llamadas.push(route.request().postDataJSON());
    const [status, cuerpo] = responder();
    await route.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(cuerpo) });
  });
  return llamadas;
}

async function leer(page, archivo) {
  await page.evaluate(() => { verObra(D.obras[0].id); formGasto(); });
  await page.locator('#foto').setInputFiles(archivo);
  const estado = page.locator('#foto-estado');
  await expect(estado).toContainText(/se guarda/, { timeout: 100_000 });
  return estado;
}
const valor = (page, id) => page.locator('#' + id).inputValue();

test('PDF de ARCA: QR y texto completan todo, sin IA', async ({ page, browser }) => {
  const pdf = await generar(browser, {}, 'pdf');
  await abrirConDatos(page, CATALOGO);
  const ia = await simularIA(page, () => [500, { error: 'no debería llamarse' }]);
  const estado = await leer(page, { name: 'factura.pdf', mimeType: 'application/pdf', buffer: pdf });

  await expect(estado).toContainText('QR de ARCA');
  await expect(estado).toContainText('texto del PDF');
  expect(ia).toHaveLength(0);
  expect(await valor(page, 'prov')).toBe('Hormigones del Paraná SA');      // nombre del catálogo
  expect(await valor(page, 'cuit')).toBe('30-71234567-1');
  expect(await valor(page, 'nro')).toBe('0003-00001234');
  expect(await valor(page, 'f')).toBe('2026-05-21');
  expect(await valor(page, 'tipo')).toBe('Factura A');
  expect(+await valor(page, 'imp')).toBe(121000);
  expect(+await valor(page, 'neto')).toBe(100000);
  expect(+await valor(page, 'iva')).toBe(21000);
  const estructura = await page.evaluate(() => D.rubros.find(x => x.nombre === 'Estructura').id);
  expect(await valor(page, 'rub')).toBe(estructura);                       // rubro del proveedor
  await expect(page.locator('#imp')).toHaveClass(/leido/);
  await expect(page.locator('#imp')).toHaveAttribute('title', /QR de ARCA/);
});

test('foto de la factura: QR y OCR completan todo, sin IA', async ({ page, browser }) => {
  const png = await generar(browser, {}, 'png');
  await abrirConDatos(page, CATALOGO);
  const ia = await simularIA(page, () => [500, { error: 'no debería llamarse' }]);
  const estado = await leer(page, { name: 'foto.png', mimeType: 'image/png', buffer: png });

  await expect(estado).toContainText('QR de ARCA');
  await expect(estado).toContainText('OCR');
  expect(ia).toHaveLength(0);
  expect(+await valor(page, 'imp')).toBe(121000);
  expect(+await valor(page, 'neto')).toBe(100000);
  expect(+await valor(page, 'iva')).toBe(21000);
  expect(await valor(page, 'prov')).toBe('Hormigones del Paraná SA');
});

test('foto girada 90°: el QR la endereza para el OCR', async ({ page, browser }) => {
  const png = await generar(browser, {}, 'girada');
  await abrirConDatos(page, CATALOGO);
  const ia = await simularIA(page, () => [500, { error: 'no debería llamarse' }]);
  const estado = await leer(page, { name: 'girada.png', mimeType: 'image/png', buffer: png });
  await expect(estado).toContainText('OCR');
  expect(ia).toHaveLength(0);
  expect(+await valor(page, 'neto')).toBe(100000);
  expect(+await valor(page, 'iva')).toBe(21000);
});

test('sin QR ni texto legible: completa la IA', async ({ page, browser }) => {
  const png = await generar(browser, { soloTitulo: true }, 'png');
  await abrirConDatos(page);
  const ia = await simularIA(page, () => [200, {
    fecha: '2026-06-02', proveedor: 'Corralón San Martín', cuit: '30-69999999-3', tipo: 'Factura B',
    nro: '0002-00045123', moneda: 'ARS', importe: 85000, neto: 85000, iva: 0, percepciones: 0,
    detalle: 'Cemento', rubro: 'Mampostería'
  }]);
  const estado = await leer(page, { name: 'ticket.png', mimeType: 'image/png', buffer: png });

  expect(ia).toHaveLength(1);
  expect(ia[0].tipo).toBe('image/jpeg');                 // la foto viaja achicada y en JPEG
  await expect(estado).toContainText('IA');
  expect(await valor(page, 'prov')).toBe('Corralón San Martín');
  expect(+await valor(page, 'imp')).toBe(85000);
  expect(await valor(page, 'det')).toBe('Cemento');
  await expect(page.locator('#prov')).toHaveAttribute('title', /IA/);
});

test('si la IA no está configurada, lo dice y deja lo que leyó', async ({ page, browser }) => {
  const png = await generar(browser, { soloTitulo: true }, 'png');
  await abrirConDatos(page);
  await simularIA(page, () => [500, { codigo: 'sin_clave', error: 'Falta configurar ANTHROPIC_API_KEY.' }]);
  const estado = await leer(page, { name: 'ticket.png', mimeType: 'image/png', buffer: png });
  await expect(estado).toContainText('no está configurada');
  await expect(estado).toContainText('Completá a mano');
});

test('avisa si el comprobante ya está cargado', async ({ page, browser }) => {
  const pdf = await generar(browser, {}, 'pdf');
  await abrirConDatos(page, `D => { D.comprobantes.push({ ...D.comprobantes[0], id: 'dup',
    cuit: '${EMISOR}', numero: '3-1234', proveedor: 'Hormigones del Paraná SA', fecha: '2026-05-21' }); }`);
  await simularIA(page, () => [500, {}]);
  const estado = await leer(page, { name: 'factura.pdf', mimeType: 'application/pdf', buffer: pdf });
  await expect(estado).toContainText('ya está cargado el comprobante 3-1234');
});
