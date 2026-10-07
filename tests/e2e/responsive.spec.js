// La app tiene que poder usarse en celular, tablet y PC. Esta prueba la
// dibuja con datos ficticios (sin sesión y sin red: los pedidos a Supabase
// se cortan) en cada tamaño de pantalla y recorre todas las pestañas.
//
// Falla si alguna pantalla obliga a desplazar la PÁGINA hacia el costado.
// Las tablas anchas sí pueden desplazarse, pero dentro de su recuadro.
//
// Con CAPTURAS=1 guarda una imagen por pantalla en test-results/capturas.
import { test, expect } from '@playwright/test';
import { abrirConDatos } from './ayudantes.js';

const PANTALLAS = [
  { nombre: 'iphone-se', width: 375, height: 667, movil: true },
  { nombre: 'iphone-13', width: 390, height: 844, movil: true },
  { nombre: 'iphone-15', width: 393, height: 852, movil: true },
  { nombre: 'iphone-pro-max', width: 440, height: 956, movil: true },
  { nombre: 'ipad-vertical', width: 820, height: 1180, movil: true },
  { nombre: 'ipad-horizontal', width: 1180, height: 820, movil: true },
  { nombre: 'pc', width: 1440, height: 900, movil: false }
];

const DE_OBRA = ['resumen', 'cajas', 'gastos', 'rubros', 'honorarios', 'proveedores', 'analisis',
  'unidades', 'inversores', 'ventas', 'avance', 'documentos', 'contador', 'rendicion', 'historial'];
const GENERALES = ['panel', 'indices'];

// Cuánto se puede desplazar la página hacia el costado (0 = nada). Se
// compara con el ancho del equipo y no con window.innerWidth: en un celular,
// si el contenido no entra, el navegador agranda la ventana para que entre
// (y achica todo), y innerWidth crece con ella.
const desborde = (page, ancho) =>
  page.evaluate(() => document.documentElement.scrollWidth).then((w) => w - ancho);

for (const p of PANTALLAS) {
  test.describe(p.nombre, () => {
    test.use({ viewport: { width: p.width, height: p.height }, isMobile: p.movil, hasTouch: p.movil });

    test('la pantalla de acceso entra sin desplazarse', async ({ page }) => {
      await page.goto('/');
      expect(await desborde(page, p.width)).toBeLessThanOrEqual(0);
      if (process.env.CAPTURAS)
        await page.screenshot({ path: `test-results/capturas/${p.nombre}-acceso.png`, fullPage: true });
    });

    test('ninguna pestaña desborda la página', async ({ page }) => {
      await abrirConDatos(page);
      const errores = [];
      page.on('pageerror', (e) => errores.push(e.message));
      const problemas = [];
      for (const tab of [...GENERALES, ...DE_OBRA]) {
        await page.evaluate((t) => { if (t === 'resumen') verObra(D.obras[0].id); verTab(t); }, tab);
        const fallo = await page.evaluate(() =>
          document.querySelector('#cuerpo .vacio strong')?.textContent.includes('Algo falló'));
        if (fallo) problemas.push(`${tab}: error al dibujar`);
        const px = await desborde(page, p.width);
        if (px > 0) problemas.push(`${tab}: ${px}px de más`);
        if (process.env.CAPTURAS)
          await page.screenshot({ path: `test-results/capturas/${p.nombre}-${tab}.png`, fullPage: true });
      }
      expect(problemas).toEqual([]);
      expect(errores).toEqual([]);
    });

    test('la lista de obras se puede usar', async ({ page }) => {
      await abrirConDatos(page);
      const segunda = page.locator('#lista-obras .obra-btn').nth(1);
      if (p.width <= 820) {
        // Plegada bajo el botón "Obras"; elegir una obra la vuelve a cerrar
        await expect(segunda).toBeHidden();
        await page.locator('#btn-menu').click();
        await expect(page.locator('#btn-menu')).toHaveAttribute('aria-expanded', 'true');
        if (process.env.CAPTURAS)
          await page.screenshot({ path: `test-results/capturas/${p.nombre}-menu.png` });
      } else {
        await expect(page.locator('#btn-menu')).toBeHidden();
      }
      await segunda.click();
      await expect(page.locator('#titulo')).toHaveText('Dúplex Fisherton');
      if (p.width <= 820) await expect(segunda).toBeHidden();
    });

    test('las ventanas de carga entran en la pantalla', async ({ page }) => {
      await abrirConDatos(page);
      await page.evaluate(() => { verObra(D.obras[0].id); formGasto(); });
      const modal = page.locator('.modal');
      await expect(modal).toBeVisible();
      const caja = await modal.boundingBox();
      expect(caja.x).toBeGreaterThanOrEqual(0);
      expect(caja.x + caja.width).toBeLessThanOrEqual(p.width);
      expect(await desborde(page, p.width)).toBeLessThanOrEqual(0);
      if (process.env.CAPTURAS)
        await page.screenshot({ path: `test-results/capturas/${p.nombre}-modal.png` });
    });
  });
}
