-- =====================================================================
--  Migración 13 — Unidades
--
--  Hasta ahora la unidad era texto suelto en aportes y ventas. Pasa a
--  ser una entidad propia: superficie, coeficiente de valor y estado.
--
--  El coeficiente resuelve que un cuarto piso no vale lo mismo que un
--  primero. El porcentual de cada unidad sale de su superficie por su
--  coeficiente, sobre el total del emprendimiento.
--
--  Pegar completo en el SQL Editor y ejecutar. No borra nada.
-- =====================================================================

create table if not exists public.unidades (
  id           uuid primary key default gen_random_uuid(),
  obra_id      uuid not null references public.obras(id) on delete cascade,
  nivel_id     uuid references public.niveles(id) on delete set null,

  codigo       text not null,                    -- 3ºB, Cochera 2, Local 1
  tipo         text not null default 'Departamento'
               check (tipo in ('Departamento','Cochera','Baulera','Local','Otro')),
  piso         int,
  orden        int not null default 0,

  -- Superficies de la unidad
  sup_cubierta     numeric(10,2) not null default 0,
  sup_semicubierta numeric(10,2) not null default 0,
  sup_comun        numeric(10,2) not null default 0,

  -- Valor relativo. 1,00 es la unidad de referencia.
  coeficiente  numeric(6,4) not null default 1 check (coeficiente > 0),

  -- Situación comercial
  estado       text not null default 'disponible'
               check (estado in ('disponible','reservada','asignada','vendida')),
  inversor_id  uuid references public.inversores(id) on delete set null,
  venta_id     uuid references public.ventas(id)     on delete set null,

  precio_lista numeric(14,2),
  nota         text default '',
  creado_en    timestamptz not null default now(),
  unique (obra_id, codigo)
);

create index if not exists unidades_obra_idx     on public.unidades (obra_id, orden);
create index if not exists unidades_inversor_idx on public.unidades (inversor_id) where inversor_id is not null;

alter table public.unidades enable row level security;

create policy unidad_ver on public.unidades for select using (
  public.obra_visible(obra_id)
  or exists (select 1 from public.inversores i
             where i.id = unidades.inversor_id and i.perfil_id = auth.uid())
);
create policy unidad_editar on public.unidades for all
  using (public.puede_editar()) with check (public.puede_editar());

drop trigger if exists auditar on public.unidades;
create trigger auditar after insert or update or delete on public.unidades
  for each row execute function public.registrar_cambio();

-- ---------------------------------------------------------------------
-- 2. Vincular aportes y ventas con la unidad
--
--    El campo de texto se conserva: sirve de referencia y no rompe
--    nada de lo ya cargado.
-- ---------------------------------------------------------------------
alter table public.aportes add column if not exists unidad_id uuid
  references public.unidades(id) on delete set null;
alter table public.ventas  add column if not exists unidad_id uuid
  references public.unidades(id) on delete set null;

-- ---------------------------------------------------------------------
-- 3. Vista con el porcentual de cada unidad
--
--    superficie ponderada = (cubierta + semicubierta + común) × coeficiente
--    porcentual = la ponderada de la unidad sobre el total de la obra
-- ---------------------------------------------------------------------
create or replace view public.v_unidades as
with base as (
  select
    u.*,
    (u.sup_cubierta + u.sup_semicubierta + u.sup_comun)                  as superficie,
    (u.sup_cubierta + u.sup_semicubierta + u.sup_comun) * u.coeficiente  as ponderada
  from public.unidades u
)
select
  b.id,
  b.obra_id,
  b.codigo,
  b.tipo,
  b.piso,
  b.superficie,
  b.coeficiente,
  b.ponderada,
  round(100 * b.ponderada / nullif(sum(b.ponderada) over (partition by b.obra_id), 0), 4)
                                                      as porcentual,
  b.estado,
  b.inversor_id,
  i.nombre                                            as inversor,
  b.venta_id,
  v.cliente                                           as comprador,
  b.precio_lista
from base b
left join public.inversores i on i.id = b.inversor_id
left join public.ventas     v on v.id = b.venta_id;

-- ---------------------------------------------------------------------
-- 4. Control
-- ---------------------------------------------------------------------
select 'tabla unidades' as objeto,
       (select count(*) from information_schema.tables where table_name='unidades')::text as ok
union all
select 'vínculo en aportes y ventas',
       (select count(*) from information_schema.columns
        where column_name='unidad_id' and table_name in ('aportes','ventas'))::text;
