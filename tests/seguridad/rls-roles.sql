-- =====================================================================
--  Pruebas de RLS por rol. SOLO STAGING / LOCAL (requiere rls-preparar.sql
--  y los datos ficticios de staging).
--
--  Reemplazar :UID por el id del usuario a simular y ejecutar. Devuelve
--  una fila por control con lo que ve / puede hacer ese usuario.
--
--  Datos de staging: obra Norte (inversores A y C), obra Sur (B y C).
--  Esperado por rol en docs de pruebas / tests/seguridad/README.
-- =====================================================================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":":UID","role":"authenticated"}', true);

with norte as (select id from public.obras where nombre = 'Obra Demo Norte'),
     sur   as (select id from public.obras where nombre = 'Obra Demo Sur')
select * from (values
  ('rol',                       coalesce(public.rol_actual(), '—')),
  ('ver obras',                 (select count(*) from public.obras)::text),
  ('ver obra Sur por id',       (select count(*) from public.obras where id = (select id from sur))::text),
  ('ver obra Norte por id',     (select count(*) from public.obras where id = (select id from norte))::text),
  ('ver inversores',            (select count(*) from public.inversores)::text),
  ('ver participaciones',       (select count(*) from public.participaciones)::text),
  ('ver aportes',               (select count(*) from public.aportes)::text),
  ('ver comprobantes',          (select count(*) from public.comprobantes)::text),
  ('ver documentos',            (select count(*) from public.documentos)::text),
  ('ver doc reservado de C',    (select count(*) from public.documentos where titulo = 'Boleto reservado de C')::text),
  ('ver archivos (storage)',    (select count(*) from storage.objects)::text),
  ('ver auditoria',             (select count(*) from public.auditoria)::text),
  ('ver enlaces',               (select count(*) from public.enlaces)::text),
  ('ver perfiles',              (select count(*) from public.perfiles)::text),
  ('ver proveedores',           (select count(*) from public.proveedores)::text),
  ('leer vista v_inversores',   pruebas.intentar('select * from public.v_inversores')),
  ('crear comprobante',         pruebas.intentar(format($q$insert into public.comprobantes (obra_id, rubro_id, proveedor, importe, pago)
                                  select %L, id, 'Prueba RLS', 1, 'pendiente' from public.rubros limit 1$q$, (select id from norte)))),
  ('editar obra Norte',         pruebas.intentar(format('update public.obras set descripcion = descripcion where id = %L', (select id from norte)))),
  ('borrar comprobantes Norte', pruebas.intentar(format('delete from public.comprobantes where obra_id = %L', (select id from norte)))),
  ('cerrar período',            pruebas.intentar(format('insert into public.cierres (obra_id, hasta) values (%L, %L)', (select id from norte), '2000-01-01'))),
  ('subirse a admin',           pruebas.intentar(format('update public.perfiles set rol = %L where id = %L', 'admin', ':UID'))),
  ('escribir auditoria',        pruebas.intentar($q$insert into public.auditoria (tabla, accion) values ('x', 'alta')$q$)),
  -- N-01: carga crea y edita, pero solo admin borra
  ('editar participaciones',    pruebas.intentar('update public.participaciones set nota = nota')),
  ('borrar participaciones',    pruebas.intentar('delete from public.participaciones')),
  ('borrar proveedores',        pruebas.intentar('delete from public.proveedores')),
  ('borrar rubro sin uso',      pruebas.intentar($q$delete from public.rubros where nombre = 'Mampostería'$q$)),
  ('cargar presupuesto en 0',   pruebas.intentar(format($q$insert into public.presupuestos (obra_id, rubro_id, monto_usd)
                                  select %L, id, 0 from public.rubros where nombre = 'Estructura'
                                  on conflict (obra_id, rubro_id) do update set monto_usd = 0$q$, (select id from norte)))),
  ('vaciar tabla (truncate)',   pruebas.intentar('truncate public.indices'))
) as t(control, resultado);
