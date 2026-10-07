# AGENTS.md — Cómo se trabaja en metroclaro

Instrucciones para cualquier persona o agente de IA (Claude Code, Codex,
Cursor, etc.) que modifique este repositorio. Son obligatorias.

## Qué es

Aplicación web para administrar obras en fideicomiso (cajas, comprobantes,
inversores, ventas en cuotas, rendiciones). Frontend estático en `public/`
(HTML + JavaScript sin framework ni build), publicado en Vercel. Backend en
Supabase: Postgres con RLS, Auth, Storage y Edge Functions. Maneja **datos
financieros reales de inversores**: la seguridad no es opcional.

Documentación completa: `docs/README.md`.

## Flujo de trabajo (obligatorio)

**Siempre trabajamos cada funcionalidad nueva en una rama nueva, y se integra
a `main` con un pull request desde GitHub.**

1. Partir de `main` actualizado: `git switch main && git pull`.
2. Crear una rama nueva: `git switch -c <tipo>/<descripcion-corta>`.
   Tipos: `funcionalidad/`, `correccion/`, `seguridad/`, `base/`, `docs/`,
   `herramientas/`.
3. Hacer el cambio con commits chicos y descriptivos, en castellano.
4. Probar (ver "Antes de abrir el pull request").
5. `git push -u origin <rama>` y abrir el pull request contra `main` en GitHub.
6. El pull request se mergea solo con la CI en verde. Al mergear, Vercel
   publica en producción.

Prohibido:
- Commitear o pushear directamente a `main`.
- Mergear un pull request con la CI fallando.
- Reescribir la historia de `main` (`push --force`, `reset` sobre ramas publicadas).
- Mezclar en un mismo pull request cambios que no tienen relación.

## Entornos

| Entorno | Supabase (ref) | Uso |
|---|---|---|
| Producción · Simple STGO | `gccbybrslcrecimfblwe` | Datos reales. https://stgo.metroclaro.com.ar |
| Staging | `tverjzxsmwnrnpnsimgh` | Pruebas, datos ficticios (`supabase/seed.sql`) |

- **Todo se prueba primero en staging.** Producción solo recibe lo que ya pasó por staging.
- `npm run dev` levanta la app en http://localhost:8000 contra el entorno de
  `.env.local` (staging por defecto).
- Nunca correr pruebas que escriben contra producción.

## Base de datos (obligatorio)

- **La base nunca se modifica a mano.** Todo cambio de esquema, política,
  función o permiso es una migración nueva en
  `supabase/migrations/AAAAMMDDHHMMSS_descripcion.sql`.
- Nunca editar una migración ya aplicada: se agrega otra.
- Orden: aplicar en staging → probar → respaldo de producción → aplicar en
  producción → comparar `tests/seguridad/huella-esquema.sql` en los dos
  (las huellas tienen que coincidir).
- Si el código nuevo necesita la migración, la migración va a producción
  **antes** de mergear, y tiene que ser compatible con el código publicado.
- Tablas nuevas: `enable row level security`; políticas `to authenticated`
  separadas por operación (`*_ver`, `*_crear`, `*_editar` con
  `puede_editar()`, `*_borrar` con `es_admin()`; **nunca `for all`**);
  disparador `auditar`.
- Funciones nuevas: `revoke execute ... from public, anon` y `grant` explícito.
  Si son `security definer`, con `set search_path = public` y nombres calificados.
- Vistas: `security_invoker = true` y sin permisos para `anon`.

Detalle: `docs/06-base-de-datos.md`.

## Seguridad (reglas que no se negocian)

- La seguridad la aplica la base (RLS, permisos, disparadores) o una Edge
  Function. Ocultar un botón en la interfaz **no** es un control.
- Roles: `admin` todo; `carga` crea y edita pero **nunca borra**; `inversor`
  solo lee lo de sus obras.
- Nunca poner en el repo ni en `public/`: service role / secret key,
  `ANTHROPIC_API_KEY`, contraseñas, ni datos reales. `public/config.js` solo
  lleva la URL y la **publishable** key.
- Nunca commitear `respaldos/`, `.env.local` ni archivos con datos de inversores.
- Edge Functions que usan claves secretas validan la sesión con
  `auth.getUser()` y el rol antes de hacer nada. El encabezado
  `Authorization` solo no alcanza.
- Librerías externas: versión exacta y hash `integrity` (SRI).

Detalle: `docs/04-seguridad.md`.

## Convenciones del código

- El frontend está en `public/js/` en scripts clásicos que comparten el
  ámbito global (`nucleo/`, `vistas/`, `formularios/`). Antes de agregar
  código, leer `public/js/README.md`: dónde va cada cosa, el orden de carga
  en `index.html` y por qué `nucleo/inicio.js` va último.
- Ningún archivo salvo `nucleo/inicio.js` ejecuta código al cargar. Los
  nombres de funciones son únicos en toda la app.
- Todo en castellano: funciones, variables, comentarios, textos y commits.
- Insertar texto en HTML siempre con `esc()`.
- **Nunca** interpolar texto dentro de `onclick="…"`: pasarlo en un atributo
  `data-*` y leerlo con `this.dataset`. Solo se interpolan ids (`uuid`).
- Escrituras con `guardar()` / `borrar()`. Un `update`/`delete` directo
  tiene que terminar en `.select()` y verificar que afectó filas.
- Lecturas de tablas con `todo(tabla)` (pagina de a 1000 filas).
- Fechas con `fechaLocal()`, `hoy()` y `sumarMeses()`. Nunca
  `toISOString().slice(0,10)`.
- Si se cambia un cálculo, actualizar `docs/03-modelo-de-datos.md`, las
  pruebas de `tests/unit/calculos.test.js` y, si aplica, `rendicion.html`.
- Comentarios: explican el *por qué*, en el estilo de los existentes.

## Pruebas

| Comando | Qué prueba | Contra |
|---|---|---|
| `npm run test:unit` | Cálculos, fechas, escape y reglas de seguridad del código (Vitest) | Nada (sin red) |
| `npm run test:seguridad` | Sondeo sin login: tablas, vistas, funciones, archivos, registro, Edge Functions | `.env.local` |
| `npm run test:e2e` | Navegador real: login, rendición, recorridos por rol (Playwright) | Staging |
| `tests/seguridad/rls-roles.sql` | Qué ve y qué puede hacer cada rol | Solo staging |
| `tests/seguridad/integridad.sql` | Cierre, caja, autoría, último admin, plan de cuotas | Solo staging |
| `tests/seguridad/huella-esquema.sql` | Que staging y producción tengan el mismo esquema | Los dos (solo lectura) |

La CI (`.github/workflows/ci.yml`) corre unitarias, sondeo y e2e en cada
pull request.

## Antes de abrir el pull request

- [ ] `npm run test:unit` en verde.
- [ ] `npm run test:seguridad` sin fallas contra staging.
- [ ] Probado a mano en `npm run dev` con el rol que corresponda.
- [ ] Si toca la base: migración aplicada y probada en staging.
- [ ] Si toca permisos: `rls-roles.sql` corrido en staging.
- [ ] Documentación actualizada si cambió un comportamiento.
- [ ] Sin respaldos, `.env.local` ni secretos en el diff.
