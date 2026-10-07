-- =====================================================================
--  Huella del esquema: un hash por categoría de objetos.
--  Correr en staging y en producción: si las huellas coinciden, las dos
--  bases tienen exactamente la misma estructura, políticas y permisos.
--  Solo lectura.
-- =====================================================================
with o as (
  select 'columnas' k, c.relname || '.' || a.attname || ':' || format_type(a.atttypid, a.atttypmod) || ':' ||
         a.attnotnull || ':' || coalesce(pg_get_expr(d.adbin, d.adrelid), '') v
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
  left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
  where n.nspname = 'public' and c.relkind in ('r', 'v')
  union all
  select 'constraints', conrelid::regclass::text || ':' || contype::text || ':' || pg_get_constraintdef(oid)
  from pg_constraint where connamespace = 'public'::regnamespace
  union all
  select 'indices', indexdef from pg_indexes where schemaname = 'public'
  union all
  select 'politicas', schemaname || '.' || tablename || '.' || policyname || ':' || cmd || ':' ||
         array_to_string(roles, ',') || ':' || coalesce(qual, '') || ':' || coalesce(with_check, '')
  from pg_policies where schemaname in ('public', 'storage')
  union all
  select 'funciones', p.proname || ':' || p.prosecdef::text || ':' || coalesce(array_to_string(p.proconfig, ','), '') ||
         ':' || regexp_replace(prosrc, '\s+', '', 'g')
  from pg_proc p where pronamespace = 'public'::regnamespace
  union all
  select 'permisos_funciones', p.proname || ':' || has_function_privilege('anon', p.oid, 'EXECUTE')::text || ':' ||
         has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
  from pg_proc p where pronamespace = 'public'::regnamespace
  union all
  select 'permisos_tablas', table_name || ':' || grantee || ':' || privilege_type
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('anon', 'authenticated')
  union all
  select 'disparadores', c.relname || '.' || t.tgname || ':' || regexp_replace(pg_get_triggerdef(t.oid), '\s+', ' ', 'g')
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
  where not t.tgisinternal and n.nspname in ('public', 'auth')
  union all
  select 'vistas', c.relname || ':' || coalesce(array_to_string(c.reloptions, ','), '') || ':' ||
         regexp_replace(pg_get_viewdef(c.oid, true), '\s+', ' ', 'g')
  from pg_class c where relnamespace = 'public'::regnamespace and relkind = 'v'
  union all
  select 'rls', relname || ':' || relrowsecurity::text
  from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'
  union all
  select 'buckets', id || ':' || public::text || ':' || coalesce(file_size_limit::text, '') || ':' ||
         coalesce(array_to_string(allowed_mime_types, ','), '')
  from storage.buckets
)
select k as categoria, count(*) as objetos, md5(string_agg(v, '|' order by v collate "C")) as huella
from o group by k order by k;
