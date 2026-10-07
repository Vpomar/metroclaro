// Recorridos por rol contra STAGING. Necesitan las contraseñas de los
// usuarios de prueba en variables de entorno (en GitHub, como secrets):
//   E2E_ADMIN_PASSWORD, E2E_CARGA_PASSWORD, E2E_INVERSOR_A_PASSWORD, E2E_INVERSOR_B_PASSWORD
// Si una falta, ese bloque se saltea. Nunca usar usuarios de producción.
import { test, expect } from '@playwright/test';

const USUARIOS = {
  admin:     { email: 'admin@metroclaro.test',      clave: process.env.E2E_ADMIN_PASSWORD },
  carga:     { email: 'carga@metroclaro.test',      clave: process.env.E2E_CARGA_PASSWORD },
  inversorA: { email: 'inversor.a@metroclaro.test', clave: process.env.E2E_INVERSOR_A_PASSWORD },
  inversorB: { email: 'inversor.b@metroclaro.test', clave: process.env.E2E_INVERSOR_B_PASSWORD }
};

const PESTAÑAS_OBRA = ['Resumen', 'Cajas', 'Comprobantes', 'Rubros', 'Honorarios', 'Proveedores',
  'Análisis', 'Unidades', 'Inversores', 'Ventas', 'Avance', 'Documentos', 'Contador', 'Rendición'];

async function entrar(page, quien) {
  await page.goto('/');
  await page.getByLabel('Email').fill(quien.email);
  await page.getByLabel('Contraseña').fill(quien.clave);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.locator('#app')).toBeVisible();
}

const obras = page => page.locator('#lista-obras .obra-btn span');

test.describe('admin', () => {
  test.skip(!USUARIOS.admin.clave, 'Falta E2E_ADMIN_PASSWORD');

  test('ve todas las obras y todas las pantallas dibujan', async ({ page }) => {
    const errores = [];
    page.on('pageerror', e => errores.push(e.message));
    await entrar(page, USUARIOS.admin);
    await expect(obras(page)).toHaveText(['Obra Demo Norte', 'Obra Demo Sur']);

    await obras(page).first().click();
    for (const p of [...PESTAÑAS_OBRA, 'Historial']) {
      await page.locator('#tabs').getByRole('button', { name: p, exact: true }).click();
      await expect(page.locator('#cuerpo')).not.toContainText('Algo falló');
    }
    expect(errores).toEqual([]);
  });

  test('tiene acceso a Usuarios', async ({ page }) => {
    await entrar(page, USUARIOS.admin);
    await expect(page.locator('#tabs').getByRole('button', { name: 'Usuarios' })).toBeVisible();
  });
});

test.describe('carga', () => {
  test.skip(!USUARIOS.carga.clave, 'Falta E2E_CARGA_PASSWORD');

  test('ve todas las obras pero no puede eliminar ni gestionar usuarios', async ({ page }) => {
    await entrar(page, USUARIOS.carga);
    await expect(obras(page)).toHaveCount(2);
    await expect(page.locator('#tabs').getByRole('button', { name: 'Usuarios' })).toHaveCount(0);
    await obras(page).first().click();
    await page.locator('#tabs').getByRole('button', { name: 'Comprobantes', exact: true }).click();
    await expect(page.locator('#cuerpo').getByRole('button', { name: 'Eliminar' })).toHaveCount(0);
    await expect(page.locator('#btn-borrar-obra')).toHaveCount(0);
  });
});

for (const [rol, propia, ajena] of [
  ['inversorA', 'Obra Demo Norte', 'Obra Demo Sur'],
  ['inversorB', 'Obra Demo Sur', 'Obra Demo Norte']
]) {
  test.describe(rol, () => {
    test.skip(!USUARIOS[rol].clave, `Falta la contraseña de ${rol}`);

    test(`ve solo ${propia}`, async ({ page }) => {
      await entrar(page, USUARIOS[rol]);
      await expect(obras(page)).toHaveText([propia]);
      await expect(page.locator('#lista-obras')).not.toContainText(ajena);
      await expect(page.locator('#tabs').getByRole('button', { name: 'Historial' })).toHaveCount(0);
    });

    test('la API no le devuelve la otra obra aunque la pida por nombre', async ({ page }) => {
      await entrar(page, USUARIOS[rol]);
      const filas = await page.evaluate(async nombre =>
        (await sb.from('obras').select('id').eq('nombre', nombre)).data?.length ?? -1, ajena);
      expect(filas).toBe(0);
    });

    test('no puede escribir aunque llame a la API directamente', async ({ page }) => {
      await entrar(page, USUARIOS[rol]);
      const r = await page.evaluate(async () => {
        const { data } = await sb.from('obras').select('id').limit(1);
        const upd = await sb.from('obras').update({ descripcion: 'x' }).eq('id', data[0].id).select('id');
        const ins = await sb.from('rubros').insert({ nombre: 'Rubro intruso' });
        return { actualizadas: upd.data?.length ?? 0, insertError: !!ins.error };
      });
      expect(r).toEqual({ actualizadas: 0, insertError: true });
    });
  });
}
