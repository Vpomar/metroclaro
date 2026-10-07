# 06 · Base de datos y migraciones

## Regla de oro

**La base nunca se modifica a mano.** Todo cambio de estructura, política,
función o permiso es un archivo en `supabase/migrations/`, se aplica primero
en staging, se prueba y recién después se aplica en producción (y en cada
cliente).

Los archivos de `supabase/migrations/` son la **única fuente de verdad** del
esquema. Una base nueva se arma aplicándolos todos, en orden.

## Migraciones actuales

| Archivo | Qué hace |
|---|---|
| `20261007000000_esquema_base.sql` | Réplica exacta del esquema de producción al 2026-10-07 (antes de las correcciones) |
| `20261007010000_seguridad_fase1.sql` | Correcciones de seguridad de la auditoría (vistas, archivos, auditoría, permisos) |
| `20261007020000_integridad_fase3.sql` | Cierre de período, autoría, caja por obra, último admin, plan de cuotas, límites de archivos |
| `20261007030000_carga_no_borra.sql` | El rol carga crea y edita pero no borra (N-01) |

> En producción (Simple STGO) la migración base no figura como aplicada:
> ese esquema ya existía y la migración se reconstruyó a partir de él. Las
> siguientes sí están registradas.

## Cómo hacer un cambio en la base

1. **Crear la migración** en la rama de trabajo:
   `supabase/migrations/AAAAMMDDHHMMSS_descripcion_corta.sql`.
   - Comentar al principio qué hace y por qué.
   - Que sea **idempotente cuando se pueda** (`create or replace`, `if not exists`).
   - Si agrega una función, revocar `execute` a `public` y `anon`, y dar
     permiso explícito solo a quien corresponda.
   - Si agrega una tabla: `enable row level security`, políticas
     `to authenticated` separadas por operación (`*_ver`, `*_crear` y
     `*_editar` con `puede_editar()`, `*_borrar` con `es_admin()`; nunca
     `for all`) y disparador `auditar`.
   - **Nunca** modificar una migración ya aplicada: se agrega una nueva.
2. **Aplicarla en staging.** Con Claude (conector de Supabase) o desde el
   SQL Editor de staging.
3. **Probar:**
   - en local contra staging (`npm run dev`);
   - `npm run test:seguridad`;
   - si toca permisos: `tests/seguridad/rls-roles.sql`;
   - si toca reglas de negocio: `tests/seguridad/integridad.sql` (o una prueba nueva).
4. **Hacer un respaldo de producción** ([08 · Respaldos](08-respaldos.md)).
5. **Aplicarla en producción**, en el mismo orden y con el mismo contenido.
6. **Verificar** que producción quedó igual a staging: correr
   `tests/seguridad/huella-esquema.sql` en los dos y comparar. Las huellas
   tienen que coincidir.
7. Si la migración es necesaria para el código nuevo, aplicarla **antes**
   de mergear el PR. Conviene que siempre sea compatible con el código
   publicado.

## Regenerar staging desde cero

Si staging se ensucia o se quiere una base nueva:

1. En el SQL Editor de staging, borrar el esquema `public` (solo en staging).
2. Aplicar todas las migraciones en orden.
3. Correr `supabase/seed.sql`.
4. Crear los usuarios de prueba en *Authentication → Users*
   (con *Auto Confirm*) y asignarles rol y ficha
   (ver los comentarios al principio de `seed.sql`).
5. Correr `tests/seguridad/rls-preparar.sql` para poder usar las pruebas por rol.

## Pruebas que escriben (solo staging)

`rls-roles.sql` e `integridad.sql` simulan un usuario con:

```sql
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<uuid>","role":"authenticated"}', true);
```

y usan `pruebas.intentar()` / `pruebas.valor()`, que ejecutan la sentencia y
**siempre la revierten**. El esquema `pruebas` existe solo en staging.

## Edge Functions

El código está en `supabase/functions/<nombre>/index.ts`. Se despliegan con
Claude (conector de Supabase) o con la CLI:

```bash
npx supabase functions deploy leer-comprobante --project-ref <ref>
```

`rendicion` se despliega **sin** verificación de JWT (`--no-verify-jwt`),
porque la abre gente sin sesión; valida el token del enlace por su cuenta.
Las otras tres van con verificación.

Igual que con la base: primero staging, después producción.
