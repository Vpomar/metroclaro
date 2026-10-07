-- =====================================================================
--  Fase 3 — Integridad y controles (auditoría 2026-10-07)
--
--  M-04  Plan de cuotas en una sola transacción (RPC generar_plan_cuotas)
--  M-05  El cierre de período alcanza a las cuotas cobradas y al cambio
--        de obra; las reaperturas y otros cambios quedan en el historial
--  L-01  creado_por / cargado_por / cerrado_por los fija la base
--  L-03  Límite de tamaño y de tipo en los depósitos de archivos
--  L-05  Nunca puede quedar el sistema sin un administrador
--  Integridad: la caja de un movimiento tiene que ser de la misma obra
--
--  No modifica datos existentes.
-- =====================================================================


-- ---------------------------------------------------------------------
--  M-05. Cierre de período
--
--  Antes solo se miraba la obra nueva: un UPDATE que cambiaba obra_id
--  sacaba un movimiento de una obra cerrada sin control.
-- ---------------------------------------------------------------------
create or replace function public.proteger_cierre()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_hasta date;
begin
  if TG_OP in ('UPDATE', 'DELETE') then
    v_hasta := public.periodo_cerrado(OLD.obra_id);
    if v_hasta is not null and OLD.fecha <= v_hasta then
      raise exception 'El período hasta el % está cerrado. Para modificar este movimiento hay que reabrirlo.', v_hasta
        using errcode = 'check_violation';
    end if;
  end if;
  if TG_OP in ('INSERT', 'UPDATE') then
    v_hasta := public.periodo_cerrado(NEW.obra_id);
    if v_hasta is not null and NEW.fecha <= v_hasta then
      raise exception 'El período hasta el % está cerrado. No se pueden cargar movimientos con fecha anterior.', v_hasta
        using errcode = 'check_violation';
    end if;
  end if;
  return coalesce(NEW, OLD);
end $$;

-- Las cuotas no tienen obra ni fecha propias: se toman de la venta, y
-- lo que cuenta como movimiento de caja es la fecha de cobro.
create or replace function public.proteger_cierre_cuota()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_hasta date;
begin
  if TG_OP in ('UPDATE', 'DELETE') and OLD.fecha_cobro is not null then
    select public.periodo_cerrado(v.obra_id) into v_hasta from public.ventas v where v.id = OLD.venta_id;
    if v_hasta is not null and OLD.fecha_cobro <= v_hasta then
      raise exception 'La cuota se cobró en un período cerrado (hasta el %). Hay que reabrirlo para modificarla.', v_hasta
        using errcode = 'check_violation';
    end if;
  end if;
  if TG_OP in ('INSERT', 'UPDATE') and NEW.fecha_cobro is not null then
    select public.periodo_cerrado(v.obra_id) into v_hasta from public.ventas v where v.id = NEW.venta_id;
    if v_hasta is not null and NEW.fecha_cobro <= v_hasta then
      raise exception 'El período hasta el % está cerrado. No se puede registrar un cobro con fecha anterior.', v_hasta
        using errcode = 'check_violation';
    end if;
  end if;
  return coalesce(NEW, OLD);
end $$;

create trigger proteger before insert or update or delete on public.cuotas
  for each row execute function public.proteger_cierre_cuota();


-- ---------------------------------------------------------------------
--  M-05. Historial: lo que faltaba registrar
--
--  cierres: las reaperturas (borrado del cierre) quedan registradas.
--  perfiles: los cambios de rol quedan registrados.
-- ---------------------------------------------------------------------
create trigger auditar after insert or update or delete on public.cierres           for each row execute function public.registrar_cambio();
create trigger auditar after insert or update or delete on public.perfiles          for each row execute function public.registrar_cambio();
create trigger auditar after insert or update or delete on public.cajas             for each row execute function public.registrar_cambio();
create trigger auditar after insert or update or delete on public.clases            for each row execute function public.registrar_cambio();
create trigger auditar after insert or update or delete on public.presupuestos      for each row execute function public.registrar_cambio();
create trigger auditar after insert or update or delete on public.fichas            for each row execute function public.registrar_cambio();
create trigger auditar after insert or update or delete on public.analisis          for each row execute function public.registrar_cambio();
create trigger auditar after insert or update or delete on public.niveles           for each row execute function public.registrar_cambio();
create trigger auditar after insert or update or delete on public.rubros            for each row execute function public.registrar_cambio();
create trigger auditar after insert or update or delete on public.proveedores       for each row execute function public.registrar_cambio();
create trigger auditar after insert or update or delete on public.indices           for each row execute function public.registrar_cambio();
create trigger auditar after insert or update or delete on public.pedido_respuestas for each row execute function public.registrar_cambio();
create trigger auditar after insert or update or delete on public.avances           for each row execute function public.registrar_cambio();


-- ---------------------------------------------------------------------
--  L-01. Autoría: la decide la base, no el navegador
--
--  Al crear se toma el usuario de la sesión; al editar se conserva el
--  original. Si no hay sesión (SQL Editor, service_role) se respeta lo
--  que venga, para no romper cargas administrativas.
-- ---------------------------------------------------------------------
create or replace function public.fijar_autor()
returns trigger language plpgsql set search_path = public as $$
declare
  v_col text := TG_ARGV[0];
  v_valor jsonb;
begin
  if TG_OP = 'INSERT' then
    if auth.uid() is null then return NEW; end if;
    v_valor := to_jsonb(auth.uid());
  else
    v_valor := to_jsonb(OLD) -> v_col;
  end if;
  NEW := jsonb_populate_record(NEW, jsonb_build_object(v_col, v_valor));
  return NEW;
end $$;

create trigger fijar_autor before insert or update on public.aportes      for each row execute function public.fijar_autor('creado_por');
create trigger fijar_autor before insert or update on public.comprobantes for each row execute function public.fijar_autor('creado_por');
create trigger fijar_autor before insert or update on public.ventas       for each row execute function public.fijar_autor('creado_por');
create trigger fijar_autor before insert or update on public.avances      for each row execute function public.fijar_autor('creado_por');
create trigger fijar_autor before insert or update on public.documentos   for each row execute function public.fijar_autor('creado_por');
create trigger fijar_autor before insert or update on public.pedidos      for each row execute function public.fijar_autor('creado_por');
create trigger fijar_autor before insert or update on public.enlaces      for each row execute function public.fijar_autor('creado_por');
create trigger fijar_autor before insert or update on public.indices      for each row execute function public.fijar_autor('cargado_por');
create trigger fijar_autor before insert or update on public.cierres      for each row execute function public.fijar_autor('cerrado_por');


-- ---------------------------------------------------------------------
--  Integridad: la caja tiene que ser de la misma obra que el movimiento
-- ---------------------------------------------------------------------
create or replace function public.validar_caja()
returns trigger language plpgsql set search_path = public as $$
declare
  v_obra uuid;
begin
  if NEW.caja_id is null then return NEW; end if;
  if TG_TABLE_NAME = 'cuotas' then
    select obra_id into v_obra from public.ventas where id = NEW.venta_id;
  else
    v_obra := NEW.obra_id;
  end if;
  if not exists (select 1 from public.cajas c where c.id = NEW.caja_id and c.obra_id = v_obra) then
    raise exception 'La caja elegida no pertenece a la obra del movimiento.'
      using errcode = 'check_violation';
  end if;
  return NEW;
end $$;

create trigger validar_caja before insert or update of caja_id, obra_id on public.aportes      for each row execute function public.validar_caja();
create trigger validar_caja before insert or update of caja_id, obra_id on public.comprobantes for each row execute function public.validar_caja();
create trigger validar_caja before insert or update of caja_id, obra_id on public.ventas       for each row execute function public.validar_caja();
create trigger validar_caja before insert or update of caja_id          on public.cuotas       for each row execute function public.validar_caja();


-- ---------------------------------------------------------------------
--  L-05. Siempre tiene que quedar al menos un administrador
-- ---------------------------------------------------------------------
create or replace function public.mantener_un_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if OLD.rol = 'admin'
     and (TG_OP = 'DELETE' or NEW.rol <> 'admin')
     and not exists (select 1 from public.perfiles p where p.rol = 'admin' and p.id <> OLD.id) then
    raise exception 'No se puede quitar al último administrador.'
      using errcode = 'check_violation';
  end if;
  return coalesce(NEW, OLD);
end $$;

create trigger mantener_un_admin before update of rol or delete on public.perfiles
  for each row execute function public.mantener_un_admin();


-- ---------------------------------------------------------------------
--  M-04. Plan de cuotas en una sola transacción
--
--  Antes: se actualizaba la venta y después se insertaban las cuotas.
--  Si lo segundo fallaba, la venta quedaba con un plan que no existía.
--  Corre con los permisos de quien llama: el RLS decide si puede.
-- ---------------------------------------------------------------------
create or replace function public.generar_plan_cuotas(
  p_venta uuid, p_anticipo numeric, p_cuotas jsonb,
  p_periodo_base text default null, p_indice_base numeric default null)
returns int language plpgsql security invoker set search_path = public as $$
declare
  v_cant int := jsonb_array_length(p_cuotas);
begin
  if v_cant < 1 then
    raise exception 'El plan tiene que tener al menos una cuota.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.cuotas where venta_id = p_venta) then
    raise exception 'Esta venta ya tiene un plan de cuotas.' using errcode = 'unique_violation';
  end if;

  update public.ventas
     set anticipo = p_anticipo, cuotas_cantidad = v_cant,
         periodo_base = coalesce(p_periodo_base, periodo_base),
         indice_base  = coalesce(p_indice_base, indice_base)
   where id = p_venta;
  if not found then
    raise exception 'La venta no existe o no tenés permiso para modificarla.' using errcode = 'insufficient_privilege';
  end if;

  insert into public.cuotas (venta_id, numero, vencimiento, monto_base, moneda)
  select p_venta, (c->>'numero')::int, (c->>'vencimiento')::date,
         (c->>'monto_base')::numeric, c->>'moneda'
  from jsonb_array_elements(p_cuotas) c;

  return v_cant;
end $$;

revoke execute on function public.generar_plan_cuotas(uuid, numeric, jsonb, text, numeric) from public, anon;
grant  execute on function public.generar_plan_cuotas(uuid, numeric, jsonb, text, numeric) to authenticated;

-- Funciones de disparador: no se invocan por la API.
revoke execute on function public.proteger_cierre_cuota() from public, anon, authenticated;
revoke execute on function public.fijar_autor()           from public, anon, authenticated;
revoke execute on function public.validar_caja()          from public, anon, authenticated;
revoke execute on function public.mantener_un_admin()     from public, anon, authenticated;


-- ---------------------------------------------------------------------
--  L-03. Archivos: solo imágenes y PDF, hasta 15 MB
--  (la aplicación solo acepta esos tipos en sus formularios)
-- ---------------------------------------------------------------------
update storage.buckets
   set file_size_limit = 15 * 1024 * 1024,
       allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf']
 where id in ('comprobantes', 'avance', 'documentos');
