// Ayudantes de las pruebas e2e que dibujan la app sin iniciar sesión.
import { datosDemo } from './datos-demo.js';

// Dibuja la app como la vería un admin, con datos ficticios y sin red: los
// pedidos a Supabase y a dolarapi se cortan. `cambiar` modifica los datos
// antes de dibujar (recibe D, corre en el navegador).
export async function abrirConDatos(page, cambiar) {
  await page.route(/supabase\.co|dolarapi\.com/, (r) => r.abort());
  await page.goto('/');
  await page.evaluate((datos) => {
    perfil = { id: 'demo', nombre: 'Usuario de prueba', rol: 'admin' };
    document.getElementById('acceso').classList.add('oculto');
    document.getElementById('app').classList.remove('oculto');
    document.getElementById('quien').textContent = 'Usuario de prueba · admin';
    D = datos;
  }, datosDemo());
  // Se evalúa como expresión de Playwright y no con new Function dentro de
  // la página: la CSP de la app no permite eval.
  if (cambiar) await page.evaluate(`(${cambiar})(D)`);
  await page.evaluate(() => {
    obraActiva = D.obras[0].id;
    vista = 'panel';
    render();
  });
}
