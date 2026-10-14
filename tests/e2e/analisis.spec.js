// Análisis: el desplegable y el simulador "Vender una unidad hoy", con
// datos ficticios y sin red.
import { test, expect } from '@playwright/test';
import { abrirConDatos } from './ayudantes.js';

// Unidades que cubren los 970 m² vendibles del anteproyecto de prueba
const COMPLETAS = `D => D.unidades_obra.forEach(u => { u.sup_cubierta = 174; })`;

async function abrirSimulador(page, cambiar = COMPLETAS) {
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await abrirConDatos(page, cambiar);
  await page.evaluate(() => { verObra(D.obras[0].id); verTab('analisis'); });
  await page.locator('#sel-analisis').selectOption('vender');
  await expect(page.locator('#vh-unidad')).toBeVisible();
  return errores;
}

test('el desplegable cambia entre anteproyecto y venta anticipada', async ({ page }) => {
  const errores = await abrirSimulador(page);
  await expect(page.locator('#cuerpo')).toContainText('Piso para vender hoy');
  await page.locator('#sel-analisis').selectOption('anteproyecto');
  await expect(page.locator('#vh-unidad')).toHaveCount(0);
  expect(errores).toEqual([]);
});

test('avisa si las unidades cargadas no cubren lo vendible', async ({ page }) => {
  await abrirSimulador(page, null);           // los datos de prueba tienen 425 de 970 m²
  await expect(page.locator('#cuerpo')).toContainText('todavía no son confiables');
  await abrirSimulador(page);
  await expect(page.locator('#cuerpo')).not.toContainText('todavía no son confiables');
});

test('mover el precio recalcula y avisa si queda bajo el costo', async ({ page }) => {
  const errores = await abrirSimulador(page);
  const slider = page.locator('#vh-precio');
  const minimo = await slider.getAttribute('min');
  await slider.fill(minimo);                  // dispara input y change
  await expect(page.locator('#cuerpo')).toContainText('Estás vendiendo por debajo del costo');
  const maximo = await page.locator('#vh-precio').getAttribute('max');
  await page.locator('#vh-precio').fill(maximo);
  await expect(page.locator('#cuerpo')).not.toContainText('Estás vendiendo por debajo del costo');
  await expect(page.locator('#vh-precio-txt')).toContainText(/US\$/);
  expect(errores).toEqual([]);
});

test('los supuestos se reinician al cambiar de obra', async ({ page }) => {
  await abrirSimulador(page);
  await page.locator('#vh-precio').fill(await page.locator('#vh-precio').getAttribute('min'));
  // La segunda obra no tiene análisis: muestra el anteproyecto vacío, sin errores
  await page.evaluate(() => verObra(D.obras[1].id));
  await page.evaluate(() => verObra(D.obras[0].id));
  await expect(page.locator('#cuerpo')).not.toContainText('Estás vendiendo por debajo del costo');
});

test.describe('en iPhone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('el simulador no desborda la pantalla', async ({ page }) => {
    const errores = await abrirSimulador(page);
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(ancho).toBeLessThanOrEqual(390);
    if (process.env.CAPTURAS)
      await page.screenshot({ path: 'test-results/capturas/iphone-13-vender-hoy.png', fullPage: true });
    expect(errores).toEqual([]);
  });
});

test('captura en PC', async ({ page }) => {
  await abrirSimulador(page);
  if (process.env.CAPTURAS)
    await page.screenshot({ path: 'test-results/capturas/pc-vender-hoy.png', fullPage: true });
});
