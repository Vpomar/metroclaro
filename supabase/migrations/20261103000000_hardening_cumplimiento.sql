-- =====================================================================
--  Hardening de cumplimiento (SOC 2 · ISO 27001 · ISO 27701)
--
--  HC-01  El historial (auditoria) se podía modificar o borrar con la
--         clave de servicio o desde el SQL editor. Ahora es de solo
--         agregado: UPDATE, DELETE y TRUNCATE fallan siempre, salvo la
--         purga por retención (HC-02). SOC 2 CC7.2 · ISO 27001 A.8.15.
--  HC-02  Sin regla de retención del historial, que guarda filas
--         completas con datos personales. purgar_auditoria() borra solo
--         lo anterior a 10 años (plazo de conservación de registros
--         contables, CCyC art. 328) y deja constancia de la purga.
--         ISO 27701 7.4.7 · ISO 27001 A.5.33.
--  HC-03  Sin un procedimiento repetible para el derecho de acceso del
--         titular (Ley 25.326 art. 14). exportar_datos_inversor() arma
--         todo lo que hay de un inversor y registra quién lo pidió.
--         ISO 27701 7.3.8 / 7.3.9 · SOC 2 P5.1.
--
--  Ver docs/10-cumplimiento.md y docs/11-privacidad.md.
-- =====================================================================

-- La exportación de datos personales queda en el historial como su propia acción
alter table public.auditoria drop constraint if exists auditoria_accion_check;
alter table public.auditoria add constraint auditoria_accion_check
  check (accion in ('alta', 'cambio', 'baja', 'exportacion'));

-- ---------------------------------------------------------------------
-- HC-01. Historial de solo agregado
-- ---------------------------------------------------------------------
create or replace function public.proteger_auditoria()
returns trigger language plpgsql set search_path = public as $$
begin
  -- Única excepción: la purga por retención, que prende esta marca solo
  -- dentro de su propia transacción.
  if TG_OP = 'DELETE' and current_setting('metroclaro.purga_auditoria', true) = 'on' then
    return OLD;
  end if;
  raise exception 'El historial de auditoría no se modifica ni se borra (%).', TG_OP
    using errcode = '42501';
end $$;

revoke execute on function public.proteger_auditoria() from public, anon, authenticated;

create trigger proteger_auditoria before update or delete on public.auditoria
  for each row execute function public.proteger_auditoria();
create trigger proteger_auditoria_truncate before truncate on public.auditoria
  for each statement execute function public.proteger_auditoria();

-- ---------------------------------------------------------------------
-- HC-02. Retención: 10 años
-- ---------------------------------------------------------------------
create or replace function public.purgar_auditoria(p_antes_de timestamptz)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_filas bigint;
begin
  if p_antes_de > now() - interval '10 years' then
    raise exception 'El historial se conserva 10 años: solo se purga lo anterior a %.',
      (now() - interval '10 years')::date;
  end if;
  perform set_config('metroclaro.purga_auditoria', 'on', true);
  delete from public.auditoria where cuando < p_antes_de;
  get diagnostics v_filas = row_count;
  perform set_config('metroclaro.purga_auditoria', 'off', true);

  insert into public.auditoria (tabla, accion, despues, usuario_id, usuario)
  values ('auditoria', 'baja',
          jsonb_build_object('purga_antes_de', p_antes_de, 'filas', v_filas),
          auth.uid(), 'purga por retención');
  return v_filas;
end $$;

-- Solo la clave de servicio (operación programada o manual del responsable)
revoke execute on function public.purgar_auditoria(timestamptz) from public, anon, authenticated;
grant  execute on function public.purgar_auditoria(timestamptz) to service_role;

-- ---------------------------------------------------------------------
-- HC-03. Derecho de acceso: exportar todo lo de un inversor
-- ---------------------------------------------------------------------
create or replace function public.exportar_datos_inversor(p_inversor uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_datos jsonb;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede exportar datos personales.'
      using errcode = '42501';
  end if;
  if not exists (select 1 from public.inversores where id = p_inversor) then
    raise exception 'No existe el inversor %.', p_inversor using errcode = 'P0002';
  end if;

  select jsonb_build_object(
    'generado', now(),
    'inversor', (select to_jsonb(i) from public.inversores i where i.id = p_inversor),
    'usuario', (select jsonb_build_object('id', p.id, 'nombre', p.nombre, 'rol', p.rol, 'creado_en', p.creado_en)
                  from public.perfiles p join public.inversores i on i.perfil_id = p.id
                 where i.id = p_inversor),
    'participaciones', coalesce((select jsonb_agg(to_jsonb(x)) from public.participaciones x
                                  where x.inversor_id = p_inversor), '[]'::jsonb),
    'aportes', coalesce((select jsonb_agg(to_jsonb(x) order by x.fecha) from public.aportes x
                          where x.inversor_id = p_inversor), '[]'::jsonb),
    'ventas', coalesce((select jsonb_agg(to_jsonb(x) order by x.fecha) from public.ventas x
                         where x.inversor_id = p_inversor), '[]'::jsonb),
    'cuotas', coalesce((select jsonb_agg(to_jsonb(c) order by c.vencimiento) from public.cuotas c
                         join public.ventas v on v.id = c.venta_id
                        where v.inversor_id = p_inversor), '[]'::jsonb),
    'documentos', coalesce((select jsonb_agg(to_jsonb(x)) from public.documentos x
                             where x.inversor_id = p_inversor), '[]'::jsonb),
    -- Sin el token: es una credencial, no un dato del titular
    'enlaces', coalesce((select jsonb_agg(to_jsonb(x) - 'token') from public.enlaces x
                          where x.inversor_id = p_inversor), '[]'::jsonb),
    'historial', coalesce((select jsonb_agg(jsonb_build_object('accion', a.accion, 'cuando', a.cuando,
                                                               'usuario', a.usuario) order by a.cuando)
                             from public.auditoria a
                            where a.tabla = 'inversores' and a.registro_id = p_inversor), '[]'::jsonb)
  ) into v_datos;

  insert into public.auditoria (tabla, registro_id, accion, despues, usuario_id, usuario)
  values ('inversores', p_inversor, 'exportacion',
          jsonb_build_object('motivo', 'derecho de acceso'),
          auth.uid(), coalesce((select nombre from public.perfiles where id = auth.uid()), 'sistema'));
  return v_datos;
end $$;

revoke execute on function public.exportar_datos_inversor(uuid) from public, anon;
grant  execute on function public.exportar_datos_inversor(uuid) to authenticated;
