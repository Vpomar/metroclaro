# 08 · Respaldos

Hay tres cosas que respaldar, y se pierden por motivos distintos:

| Qué | Dónde vive | Si se pierde |
|---|---|---|
| Datos | Base de Supabase de cada cliente | Se pierde toda la contabilidad de las obras |
| Archivos | Storage de Supabase | Se pierden comprobantes, fotos y documentos legales |
| Código | GitHub (`Vpomar/metroclaro`) | Está versionado: se recupera de GitHub |

> El plan gratuito de Supabase **no tiene backups automáticos**. El plan Pro
> incluye backups diarios con 7 días de retención. En cuanto haya plata real
> de inversores cargada, conviene pasar a Pro.

**Dónde se guardan:** en `respaldos/` dentro del proyecto (está fuera de
git y nunca se publica) **y además** en otro lugar: Drive o un disco
externo. Una copia en la misma computadora no es un respaldo.

## 1. Datos desde la aplicación (el más simple)

Pestaña **Usuarios** → **Descargar datos**. Baja un JSON con todas las
tablas, incluidos el historial (`auditoria`) y los cierres, sin límite de
filas.

- **Cuándo:** una vez por mes y antes de cualquier cambio en la base.
- **Comprobar que sirve:** abrir `scripts/verificar-respaldo.html` con doble
  clic y arrastrarle el JSON. Muestra la fecha, cuántos registros tiene cada
  tabla, el ejecutado y los aportes de cada obra. **Esos números tienen que
  coincidir con el Panel de la aplicación.**

Restaurarlo requiere trabajo manual: sirve para reconstruir, no para volver
atrás con un clic.

## 2. Base completa (estructura + datos + roles)

Doble clic en `scripts/respaldo.bat`. Deja en `respaldos/AAAA-MM-DD/` tres
archivos:

- `1-estructura.sql`: tablas, políticas, funciones y vistas
- `2-datos.sql`: todo lo cargado
- `3-roles.sql`: roles y permisos

Requiere la CLI de Supabase con el proyecto vinculado
(`npx supabase link --project-ref <ref>`), Docker Desktop corriendo y la
contraseña de la base, que la pide en cada paso.

**Los tres archivos hacen falta.** Para restaurar se corre primero la
estructura y después los datos.

También se puede bajar desde el panel de Supabase: *Database → Backups*
(solo en plan Pro).

## 3. Archivos

Pestaña **Usuarios** → **Descargar fotos**: abre una descarga por archivo.
Para muchos archivos es más práctico bajarlos desde el panel de Supabase
(*Storage*, seleccionando la carpeta de la obra).

## 4. Antes de cada cambio en la base

1. Descargar los datos desde la app (punto 1) y verificarlos.
2. Si el cambio es grande, además el respaldo completo (punto 2).
3. Anotar los totales del Panel (aportes y ejecutado por obra) para
   compararlos después del cambio.

## Ensayo de restauración

Un respaldo que nunca se restauró no está probado. Conviene hacerlo una vez
sobre **staging**:

1. Regenerar staging desde cero (ver [06 · Base de datos](06-base-de-datos.md))
   sin correr `seed.sql`.
2. Cargar los datos del respaldo.
3. Abrir la app en local contra staging y comparar los totales del Panel con
   los de producción.
4. Volver a dejar staging con los datos ficticios.

## Si algo se rompe

| Situación | Qué hacer |
|---|---|
| Se borró un movimiento por error | Cargarlo de nuevo. El historial muestra cómo era (*Historial*, o la tabla `auditoria`) |
| Se cargó algo en un período cerrado por error | Un admin reabre el período, se corrige y se vuelve a cerrar. Todo queda en el historial |
| Se corrompió una tabla | Restaurar desde el respaldo completo (punto 2) |
| La aplicación dejó de funcionar pero los datos están | Revertir el último PR en GitHub: Vercel vuelve a publicar la versión anterior. Los datos no se tocan |
| Se perdió el acceso al proyecto de Supabase | Sin respaldo no hay vuelta atrás: por eso el punto 2 y el plan Pro |
