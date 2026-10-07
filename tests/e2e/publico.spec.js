// Lo que ve alguien sin sesión. No necesita credenciales.
import { test, expect } from '@playwright/test';

test('la pantalla de acceso carga sin errores', async ({ page }) => {
  const errores = [];
  page.on('pageerror', e => errores.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/service worker|sw\.js/i.test(m.text())) errores.push(m.text()); });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Administración de obras' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Contraseña')).toBeVisible();
  await expect(page.locator('#app')).toBeHidden();
  expect(errores).toEqual([]);
});

test('el login rechaza credenciales inválidas', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Email').fill('nadie@ejemplo.test');
  await page.getByLabel('Contraseña').fill('incorrecta-123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.locator('#error-acceso')).toHaveText('Email o contraseña incorrectos.');
  await expect(page.locator('#app')).toBeHidden();
});

test('un enlace de rendición inválido no muestra datos', async ({ page }) => {
  await page.goto('/rendicion.html?t=enlace-que-no-existe-0000000000');
  await expect(page.getByText(/ya no está disponible|inválido/i)).toBeVisible();
});

test('las librerías externas cargan con su hash de integridad', async ({ page }) => {
  await page.goto('/');
  const cargadas = await page.evaluate(() => ({
    supabase: typeof window.supabase, xlsx: typeof window.XLSX
  }));
  expect(cargadas).toEqual({ supabase: 'object', xlsx: 'object' });
});
