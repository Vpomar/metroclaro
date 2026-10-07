-- =====================================================================
--  Migración 5 — Control interno
--
--  1) Historial de cambios: qué se modificó, quién y cuándo.
--  2) IVA discriminado en los comprobantes.
--  3) Cierre de período: lo rendido no se toca más.
--
--  Pegar completo en el SQL Editor y ejecutar. No borra nada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. HISTORIAL DE CAMBIOS
--
--    Guarda el estado anterior y el nuevo de cada movimiento. Es la
--    respuesta a "este número antes decía otra cosa, quién lo cambió".
-- ---------------------------------------------------------------------
create table if not exists public.auditoria (
  id          bigserial primary key,
  tabla       text not null,
  registro_id uuid,
  obra_id     uuid,
  accion      text not null check (accion in ('alta','cambio','baja')),
  antes       jsonb,
  despues     jsonb,
  usuario_id  uuid,
  usuario     text,
  cuando      timestamptz not null default now()
);

create index if not exists auditoria_obra_idx    on public.auditoria (obra_id, cuando desc);
create index if not exists auditoria_registro_idx on public.auditoria (tabla, registro_id, cuando desc);

create or replace function public.registrar_cambio()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_antes  jsonb := case when TG_OP = 'INSERT' then null else to_jsonb(OLD) end;
  v_desp   jsonb := case when TG_OP = 'DELETE' then null else to_jsonb(NEW) end;
  v_obra   uuid;
  v_nombre text;
begin
  v_obra := coalesce((v_desp->>'obra_id')::uuid, (v_antes->>'obra_id')::uuid);
  select nombre into v_nombre from public.perfiles where id = auth.uid();

  insert into public.auditoria (tabla, registro_id, obra_id, accion, antes, despues, usuario_id, usuario)
  values (
    TG_TABLE_NAME,
    coalesce((v_desp->>'id')::uuid, (v_antes->>'id')::uuid),
    v_obra,
    case TG_OP when 'INSERT' then 'alta' when 'UPDATE' then 'cambio' else 'baja' end,
    v_antes, v_desp, auth.uid(), coalesce(v_nombre, 'sistema')
  );
  return coalesce(NEW, OLD);
end $$;

drop trigger if exists auditar on public.comprobantes;
create trigger auditar after insert or update or delete on public.comprobantes
  for each row execute function public.registrar_cambio();

drop trigger if exists auditar on public.aportes;
create trigger auditar after insert or update or delete on public.aportes
  for each row execute function public.registrar_cambio();

drop trigger if exists auditar on public.inversores;
create trigger auditar after insert or update or delete on public.inversores
  for each row execute function public.registrar_cambio();

drop trigger if exists auditar on public.obras;
create trigger auditar after insert or update or delete on public.obras
  for each row execute function public.registrar_cambio();

drop trigger if exists auditar on public.documentos;
create trigger auditar after insert or update or delete on public.documentos
  for each row execute function public.registrar_cambio();

alter table public.auditoria enable row level security;
create policy audit_ver on public.auditoria for select using (public.puede_editar());
create policy audit_alta on public.auditoria for insert with check (true);
-- Sin políticas de update ni delete: el historial no se corrige.

-- ---------------------------------------------------------------------
-- 2. IVA DISCRIMINADO
--
--    importe sigue siendo el total del comprobante. Estos campos son
--    opcionales: si quedan en cero, el comprobante no está discriminado.
-- ---------------------------------------------------------------------
alter table public.comprobantes
  add column if not exists neto         numeric(14,2) not null default 0,
  add column if not exists iva          numeric(14,2) not null default 0,
  add column if not exists percepciones numeric(14,2) not null default 0;

create or replace view public.v_iva as
select
  c.obra_id,
  to_char(c.fecha, 'YYYY-MM')                       as periodo,
  c.tipo,
  count(*)                                          as comprobantes,
  sum(c.neto)                                       as neto,
  sum(c.iva)                                        as iva,
  sum(c.percepciones)                               as percepciones,
  sum(c.importe)                                    as total,
  sum(c.importe - c.neto - c.iva - c.percepciones)  as sin_discriminar
from public.comprobantes c
where c.afecta_caja
group by c.obra_id, to_char(c.fecha, 'YYYY-MM'), c.tipo;

-- ---------------------------------------------------------------------
-- 3. CIERRE DE PERÍODO
--
--    Una vez rendido un mes, sus movimientos no se editan ni se borran,
--    y no se pueden agregar nuevos con fecha anterior al cierre.
--    Solo un administrador cierra y solo un administrador reabre.
-- ---------------------------------------------------------------------
create table if not exists public.cierres (
  id          uuid primary key default gen_random_uuid(),
  obra_id     uuid not null references public.obras(id) on delete cascade,
  hasta       date not null,
  nota        text default '',
  cerrado_por uuid references public.perfiles(id),
  cerrado_en  timestamptz not null default now()
);

create index if not exists cierres_obra_idx on public.cierres (obra_id, hasta desc);

alter table public.cierres enable row level security;
create policy cierre_ver    on public.cierres for select using (public.obra_visible(obra_id));
create policy cierre_crear  on public.cierres for insert with check (public.es_admin());
create policy cierre_borrar on public.cierres for delete using (public.es_admin());

create or replace function public.periodo_cerrado(p_obra uuid)
returns date language sql stable security definer set search_path = public as $$
  select max(hasta) from public.cierres where obra_id = p_obra
$$;

create or replace function public.proteger_cierre()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_obra  uuid := coalesce(NEW.obra_id, OLD.obra_id);
  v_hasta date := public.periodo_cerrado(v_obra);
  v_fecha date := least(coalesce(NEW.fecha, OLD.fecha), coalesce(OLD.fecha, NEW.fecha));
begin
  if v_hasta is not null and v_fecha <= v_hasta then
    raise exception 'El período hasta el % está cerrado. Para modificar este movimiento hay que reabrirlo.', v_hasta
      using errcode = 'check_violation';
  end if;
  return coalesce(NEW, OLD);
end $$;

drop trigger if exists proteger on public.comprobantes;
create trigger proteger before insert or update or delete on public.comprobantes
  for each row execute function public.proteger_cierre();

drop trigger if exists proteger on public.aportes;
create trigger proteger before insert or update or delete on public.aportes
  for each row execute function public.proteger_cierre();

-- ---------------------------------------------------------------------
-- 4. Control
-- ---------------------------------------------------------------------
select 'auditoria' as objeto, count(*)::text as estado from public.auditoria
union all
select 'columnas de IVA', count(*)::text from information_schema.columns
  where table_name = 'comprobantes' and column_name in ('neto','iva','percepciones')
union all
select 'tabla cierres', count(*)::text from information_schema.tables where table_name = 'cierres';
