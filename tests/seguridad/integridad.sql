-- =====================================================================
--  Pruebas de integridad (migración integridad_fase3). SOLO STAGING.
--  Requiere rls-preparar.sql y los datos de supabase/seed.sql.
--  Reemplazar :UID por el usuario a simular (carga o admin) y :ADMIN por
--  el id del único admin de staging (un usuario no puede leer auth.users).
--  Todas las escrituras se revierten.
-- =====================================================================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":":UID","role":"authenticated"}', true);

with ids as (
  select (select id from public.obras where nombre = 'Obra Demo Norte') norte,
         (select id from public.obras where nombre = 'Obra Demo Sur')   sur,
         (select c.id from public.cajas c join public.obras o on o.id = c.obra_id
            where o.nombre = 'Obra Demo Norte' and c.nombre = 'Banco')  caja_norte,
         (select c.id from public.cajas c join public.obras o on o.id = c.obra_id
            where o.nombre = 'Obra Demo Sur' and c.nombre = 'Banco')    caja_sur,
         (select id from public.inversores where nombre = 'Inversor Prueba A') inv_a,
         (select id from public.rubros where nombre = 'Estructura')     rubro,
         ':ADMIN'::uuid admin
)
select t.* from ids, lateral (values
  ('autor lo fija la base (manda otro creado_por)',
   pruebas.valor(format($q$insert into public.comprobantes (obra_id, caja_id, rubro_id, proveedor, importe, pago, creado_por)
     values (%L, %L, %L, 'Prueba', 1, 'pendiente', %L) returning (creado_por = auth.uid())::text$q$, norte, caja_norte, rubro, admin))),
  ('aporte con caja de otra obra',
   pruebas.valor(format($q$insert into public.aportes (obra_id, inversor_id, caja_id, importe)
     values (%L, %L, %L, 1) returning 'aceptado'$q$, norte, inv_a, caja_sur))),
  ('plan de cuotas en una transacción',
   pruebas.valor(format($q$
     insert into public.ventas (id, obra_id, cliente, importe, cobro, modalidad)
       values ('11111111-1111-1111-1111-111111111111', %L, 'Comprador Prueba', 1000, 'pendiente', 'cuotas_usd');
     select public.generar_plan_cuotas('11111111-1111-1111-1111-111111111111', 100,
       '[{"numero":1,"vencimiento":"2026-11-10","monto_base":450,"moneda":"USD"},
         {"numero":2,"vencimiento":"2026-12-10","monto_base":450,"moneda":"USD"}]'::jsonb)::text$q$, norte))),
  ('plan de cuotas dos veces',
   pruebas.valor(format($q$
     insert into public.ventas (id, obra_id, cliente, importe, cobro, modalidad)
       values ('22222222-2222-2222-2222-222222222222', %L, 'Comprador Prueba', 1000, 'pendiente', 'cuotas_usd');
     select public.generar_plan_cuotas('22222222-2222-2222-2222-222222222222', 0,
       '[{"numero":1,"vencimiento":"2026-11-10","monto_base":1000,"moneda":"USD"}]'::jsonb);
     select public.generar_plan_cuotas('22222222-2222-2222-2222-222222222222', 0,
       '[{"numero":1,"vencimiento":"2026-11-10","monto_base":1000,"moneda":"USD"}]'::jsonb)::text$q$, norte))),
  ('cierre: sacar un movimiento de una obra cerrada (solo admin cierra)',
   pruebas.valor(format($q$
     insert into public.cierres (obra_id, hasta) values (%L, '2026-12-31');
     update public.comprobantes set obra_id = %L, caja_id = %L where obra_id = %L returning 'movido'$q$,
     norte, sur, caja_sur, norte))),
  ('cierre: cobrar una cuota con fecha en período cerrado',
   pruebas.valor(format($q$
     insert into public.ventas (id, obra_id, cliente, importe, cobro, modalidad, fecha)
       values ('33333333-3333-3333-3333-333333333333', %L, 'Comprador Prueba', 1000, 'pendiente', 'cuotas_usd', '2027-01-15');
     insert into public.cuotas (venta_id, numero, vencimiento, monto_base, moneda)
       values ('33333333-3333-3333-3333-333333333333', 1, '2026-11-10', 1000, 'USD');
     insert into public.cierres (obra_id, hasta) values (%L, '2026-12-31');
     update public.cuotas set estado = 'cobrada', fecha_cobro = '2026-11-10', monto_cobrado = 1000
       where venta_id = '33333333-3333-3333-3333-333333333333' returning 'cobrada'$q$, norte, norte))),
  ('reabrir un cierre queda en el historial',
   pruebas.valor(format($q$
     insert into public.cierres (obra_id, hasta) values (%L, '2000-01-01');
     delete from public.cierres where obra_id = %L and hasta = '2000-01-01';
     select count(*)::text from public.auditoria where tabla = 'cierres' and accion = 'baja'$q$, norte, norte))),
  ('quitarse el rol al último admin',
   pruebas.valor(format($q$update public.perfiles set rol = 'carga' where id = %L returning 'quitado'$q$, admin)))
) as t(control, resultado);
