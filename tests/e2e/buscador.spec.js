// Buscador por teclado (Ctrl+K): con datos ficticios y sin red.
import { test, expect } from '@playwright/test';
import { abrirConDatos } from './ayudantes.js';

test('antes de iniciar sesión, Ctrl+K no abre nada', async ({ page }) => {
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto('/');
  await page.keyboard.press('Control+k');
  await expect(page.locator('.paleta')).toHaveCount(0);
  expect(errores).toEqual([]);
});

test('busca sin tildes y lleva a Comprobantes filtrado por rubro', async ({ page }) => {
  await abrirConDatos(page);
  await page.evaluate(() => verObra(D.obras[0].id));
  await page.keyboard.press('Control+k');
  await page.locator('#paleta-input').fill('mamposteria');
  await expect(page.locator('.paleta-item.on')).toContainText('Mampostería');
  await page.keyboard.press('Enter');
  await expect(page.locator('.paleta')).toHaveCount(0);
  await expect(page.locator('.tab.on')).toHaveText('Comprobantes');
  // Solo en la tabla: los filtros de arriba listan a todos los proveedores
  const filas = page.locator('#cuerpo table tbody');
  await expect(filas).toContainText('Corralón San Martín');
  await expect(filas).not.toContainText('Hormigones Elaborados');
});

test('las flechas mueven la selección y Esc cierra', async ({ page }) => {
  await abrirConDatos(page);
  await page.keyboard.press('Control+k');
  const primero = await page.locator('.paleta-item.on').textContent();
  await page.keyboard.press('ArrowDown');
  expect(await page.locator('.paleta-item.on').textContent()).not.toBe(primero);
  await page.keyboard.press('Escape');
  await expect(page.locator('.paleta')).toHaveCount(0);
});

test('un inversor no ve Historial en el buscador', async ({ page }) => {
  await abrirConDatos(page);
  await page.evaluate(() => { perfil.rol = 'inversor'; verObra(D.obras[0].id); });
  await page.keyboard.press('Control+k');
  await page.locator('#paleta-input').fill('historial');
  await expect(page.locator('.paleta-vacio')).toBeVisible();
});
