# 05 · Desarrollo local

## Requisitos

- Node 20 o superior (solo para el servidor local y las pruebas; la app no
  tiene build).
- Git y acceso al repositorio `Vpomar/metroclaro`.
- Acceso al proyecto **metroclaro-staging** en Supabase.

## Puesta en marcha

```bash
git clone https://github.com/Vpomar/metroclaro.git
cd metroclaro
cp .env.example .env.local
npm run dev
```

Se abre en http://localhost:8000.

`.env.local` apunta a **staging** por defecto. El servidor local
(`scripts/servidor-local.mjs`) sirve `public/` y entrega como `config.js` los
valores de `.env.local`; sin `.env.local`, entrega el cliente por defecto de
`clientes.json` (staging). Así nunca se trabaja contra producción por
accidente.

> Abrir `index.html` con doble clic no funciona: el navegador bloquea las
> peticiones desde `file://`.

## Usuarios de prueba (staging)

| Email | Rol | Ve |
|---|---|---|
| `admin@metroclaro.test` | admin | Todo |
| `carga@metroclaro.test` | carga | Todo |
| `inversor.a@metroclaro.test` | inversor | Solo Obra Demo Norte |
| `inversor.b@metroclaro.test` | inversor | Solo Obra Demo Sur |

Las contraseñas no están en el repo: las tiene el responsable del proyecto.

## Datos de staging

`supabase/seed.sql` carga datos ficticios: dos obras, tres inversores
(A en Norte, B en Sur, C en las dos), aportes, comprobantes, proveedores y
un documento reservado. Si staging se ensucia, se puede regenerar
(ver [06 · Base de datos](06-base-de-datos.md)).

## Pruebas automáticas

Una vez, después de clonar:

```bash
npm install
```
```bash
npx playwright install chromium
```

| Comando | Qué hace |
|---|---|
| `npm run test:unit` | Vitest. Carga los scripts de `public/js/` (en el orden de `index.html`) en un navegador simulado, sin red, y prueba los cálculos (totales, honorarios, participación, CAC, cuotas), las fechas, el escape de HTML y reglas de seguridad del código (sin XSS en manejadores, librerías con SRI, sin claves secretas en `public/`, borrados verificados) |
| `npm run test:watch` | Lo mismo, re-ejecutando al guardar |
| `npm run test:seguridad` | Sondeo sin login contra el entorno de `.env.local` |
| `npm run test:e2e` | Playwright en Chromium contra staging: pantalla de acceso, login inválido, rendición inválida, diseño en celular/iPad/PC (`responsive.spec.js`, con datos ficticios y sin red) y, si están las contraseñas, recorridos por rol |
| `npm run verificar` | Las tres juntas |

Las pruebas por rol de Playwright necesitan las contraseñas de los usuarios
de staging en `E2E_ADMIN_PASSWORD`, `E2E_CARGA_PASSWORD`,
`E2E_INVERSOR_A_PASSWORD` y `E2E_INVERSOR_B_PASSWORD`. Sin ellas se saltean.
En GitHub se cargan como *secrets* del repositorio (*Settings → Secrets and
variables → Actions*).

Para agregar una prueba de un cálculo, sumar el caso en
`tests/unit/calculos.test.js`; si la función todavía no está expuesta,
agregarla a la lista `EXPORTAR` de `tests/unit/cargar-app.js`.

## Flujo de trabajo

1. Crear una rama desde `main` actualizado:
   ```bash
   git switch main
   ```
   ```bash
   git pull
   ```
   ```bash
   git switch -c tipo/descripcion-corta
   ```
   Prefijos: `funcionalidad/`, `correccion/`, `seguridad/`, `docs/`, `base/`.
2. Hacer el cambio y probarlo en local contra staging.
3. Si toca la base, crear la migración y aplicarla **primero en staging**.
4. Correr las pruebas:
   ```bash
   npm run verificar
   ```
5. Commit y push de la rama; abrir el pull request en GitHub. Vercel arma
   una vista previa y la CI corre las pruebas.
6. Con la CI en verde, mergear a `main`. Vercel publica en producción.

Nunca se trabaja directamente sobre `main`. Las reglas completas están en
[`AGENTS.md`](../AGENTS.md).

## Convenciones del código

- Todo en castellano: nombres de funciones, variables, comentarios y textos.
- Antes de insertar texto en HTML se escapa con `esc()`.
- **Nunca** se interpola texto dentro de un `onclick="…"`: se pasa por un
  atributo `data-*` y el manejador lo lee con `this.dataset` (ver
  [Auditoría](auditoria-2026-10.md), H-04).
- Las escrituras usan `guardar()` y `borrar()`, que verifican las filas
  afectadas. Para escrituras directas, usar `.select()` y comprobar el
  resultado.
- Las fechas se arman con `fechaLocal()`, `hoy()` y `sumarMeses()`. No usar
  `toISOString().slice(0,10)`: devuelve la fecha en UTC.
- Las lecturas grandes usan `todo(tabla)`, que pagina de a 1000 filas.
- La app tiene que funcionar en celular, iPad y PC. Hasta 820 px de ancho
  (celulares y iPad vertical) la lista de obras se pliega bajo el botón
  "Obras", las pestañas van en una fila que se desliza y las tablas se
  desplazan dentro de su recuadro. Para ver las capturas de cada pantalla:
  `CAPTURAS=1 npx playwright test responsive` (quedan en
  `test-results/capturas/`).
