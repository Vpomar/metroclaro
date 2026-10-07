-- =====================================================================
--  N-01 — El rol carga no borra (auditoría 2026-10-07)
--
--  La regla del negocio es que carga crea y edita pero no elimina. Las
--  políticas *_editar de estas tablas eran FOR ALL con puede_editar(), así
--  que carga también podía borrar cuotas, participaciones, fichas de
--  inversores, cajas, unidades y catálogos.
--
--  Cada política FOR ALL se reemplaza por tres: alta y cambio para admin y
--  carga, baja solo para admin. Las políticas de lectura no cambian.
-- =====================================================================
do $$
declare
  t record;
  prefijo text;
begin
  for t in select * from (values
      ('cajas',             'cajas_editar'),
      ('clases',            'clases_editar'),
      ('presupuestos',      'presu_editar'),
      ('cuotas',            'cuota_editar'),
      ('fichas',            'ficha_editar'),
      ('analisis',          'analisis_editar'),
      ('niveles',           'nivel_editar'),
      ('unidades',          'unidad_editar'),
      ('pedidos',           'pedido_editar'),
      ('pedido_respuestas', 'resp_editar'),
      ('participaciones',   'part_editar'),
      ('inversores',        'inv_editar'),
      ('rubros',            'rubros_editar'),
      ('proveedores',       'prov_editar'),
      ('indices',           'indice_editar'),
      ('enlaces',           'enlace_editar')
    ) as x(tabla, politica)
  loop
    prefijo := replace(t.politica, '_editar', '');
    execute format('drop policy if exists %I on public.%I', t.politica, t.tabla);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.puede_editar())',
                   prefijo || '_crear', t.tabla);
    execute format('create policy %I on public.%I for update to authenticated using (public.puede_editar()) with check (public.puede_editar())',
                   prefijo || '_editar', t.tabla);
    execute format('create policy %I on public.%I for delete to authenticated using (public.es_admin())',
                   prefijo || '_borrar', t.tabla);
  end loop;
end $$;
