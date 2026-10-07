# Auditoría de seguridad e integridad · octubre 2026

Auditoría integral del 7 de octubre de 2026 sobre el código, la base de
Supabase de producción (Simple STGO), Auth, Storage y Edge Functions.
Todos los hallazgos se verificaron contra producción; ninguno es teórico.

## Estado

| ID | Severidad | Hallazgo | Estado | Dónde se corrigió |
|---|---|---|---|---|
| C-01 | Crítica | Las 11 vistas `v_*` eran *security definer* y `anon` podía leerlas: inversores, capital, proveedores con CUIT, costos y deudas, sin login | ✅ Resuelto | `seguridad_fase1` |
| C-02 | Crítica | Registro público abierto con confirmación automática: cualquiera obtenía una sesión | ✅ Resuelto | Configuración de Auth |
| H-01 | Alta | Cualquier usuario autenticado podía listar y bajar todos los archivos, incluidos documentos reservados | ✅ Resuelto | `seguridad_fase1` (`puede_ver_archivo`) |
| H-02 | Alta | Cualquiera, incluso sin login, podía escribir en el historial (`auditoria`) | ✅ Resuelto | `seguridad_fase1` |
| H-03 | Alta | `leer-comprobante` y `asistente` aceptaban la clave pública como sesión: uso libre de la clave de Anthropic | ✅ Resuelto | Edge Functions |
| H-04 | Alta | XSS almacenado en manejadores `onclick`: un usuario `carga` podía tomar la sesión de un admin | ✅ Resuelto | `app.js` (atributos `data-*`) |
| M-01 | Media | Permisos totales (incluido `TRUNCATE`) para `anon` y `authenticated`; objetos nuevos nacían abiertos | ✅ Resuelto | `seguridad_fase1` |
| M-02 | Media | El enlace de rendición devolvía los aportes individuales de todos los inversores | ✅ Resuelto | Edge Function `rendicion` |
| M-03 | Media | La interfaz mostraba "Guardado/Eliminado" aunque el RLS no hubiera dejado tocar nada | ✅ Resuelto | `app.js` |
| M-04 | Media | Plan de cuotas en dos pasos: podía quedar a medias | ✅ Resuelto | `integridad_fase3` + `app.js` |
| M-05 | Media | El cierre de período no protegía cuotas ni el cambio de obra; las reaperturas no quedaban registradas | ✅ Resuelto | `integridad_fase3` |
| M-06 | Media | Librerías del CDN sin versión fija ni verificación de integridad | ✅ Resuelto | `index.html` (SRI) |
| M-07 | Media | Tope silencioso de 1000 filas en la carga y en el respaldo; el respaldo no incluía historial ni cierres | ✅ Resuelto | `app.js` |
| M-08 | Media | El instalador y las migraciones del repo no coincidían con la base real (y el instalador daba una app que no funcionaba) | ✅ Resuelto | Migración base verificada por huella |
| L-01 | Baja | `creado_por` lo decidía el navegador | ✅ Resuelto | `integridad_fase3` |
| L-02 | Baja | `anon` podía ejecutar `sumar_visita` | ✅ Resuelto | `seguridad_fase1` |
| L-03 | Baja | Depósitos sin límite de tamaño ni de tipo | ✅ Resuelto | `integridad_fase3` |
| L-04 | Baja | Fechas en UTC (después de las 21 h, "hoy" era mañana) y vencimientos del día 31 desbordados | ✅ Resuelto | `app.js` |
| L-05 | Baja | Se podía dejar el sistema sin administradores; el panel listaba 200 usuarios | ✅ Resuelto | `integridad_fase3` + `gestionar-usuarios` |
| L-06 | Baja | Contraseña inicial visible en pantalla | ✅ Resuelto | `app.js` |
| L-07 | Baja | Sin headers de seguridad | ✅ Resuelto | `vercel.json` |
| L-08 | Baja | `xlsx` 0.18.5 tiene vulnerabilidades conocidas al **leer** archivos | ⏸️ No aplica | La app solo **escribe** Excel |
| L-09 | Baja | 27 claves foráneas sin índice | ⏸️ Diferido | Sin impacto con el volumen actual |
| — | — | Con la sesión vencida la app quedaba en blanco | ✅ Resuelto | `app.js` |
| — | — | Se podía asignar una caja de otra obra | ✅ Resuelto | `integridad_fase3` |
| N-01 | Media | El rol `carga` puede **borrar** cuotas, participaciones, fichas de inversores, cajas, unidades, presupuestos y catálogos, aunque la regla del negocio es "carga no borra" | ⏳ Pendiente | Separar las políticas `FOR ALL` en insert/update (carga) y delete (admin) |

## Pendiente de decisión del negocio

- ¿Un inversor debe ver las participaciones de los otros inversores de su obra?
- ¿Un inversor debe ver el catálogo de proveedores?

## Cómo se verificó

- Sondeo sin login contra producción (`tests/seguridad/sondeo-anon.mjs`): sin fallas.
- Pruebas por rol en staging (`rls-roles.sql`) con admin, carga e inversores A y B.
- Pruebas de integridad en staging (`integridad.sql`).
- Huella del esquema idéntica entre staging y producción (`huella-esquema.sql`).
- Totales de producción iguales antes y después de cada cambio.
- Recorrido de las 33 pantallas en local contra staging.
