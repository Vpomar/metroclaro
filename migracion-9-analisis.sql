-- =====================================================================
--  Migración 9 — Análisis económico
--
--  Replica la planilla de anteproyecto: superficies por nivel, cada
--  tipo con su coeficiente de incidencia sobre el costo del metro
--  cubierto, más los costos indirectos con sus porcentajes.
--
--  De ahí sale el costo por metro vendible proyectado, que es el
--  número contra el que se compara el ejecutado real.
--
--  Pegar completo en el SQL Editor y ejecutar. No borra nada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Parámetros del análisis, uno por obra
-- ---------------------------------------------------------------------
create table if not exists public.analisis (
  obra_id             uuid primary key references public.obras(id) on delete cascade,

  -- Costo de construcción
  costo_m2_base       numeric(12,2) not null default 0,   -- U$S por m² cubierto

  -- Coeficientes de incidencia sobre el costo base
  coef_coch_ss        numeric(5,4) not null default 0.70,
  coef_coch_pb        numeric(5,4) not null default 0.40,
  coef_cubierta       numeric(5,4) not null default 1.00,
  coef_semicubierta   numeric(5,4) not null default 0.60,
  coef_comun          numeric(5,4) not null default 0.60,
  coef_terraza        numeric(5,4) not null default 0.40,

  -- Terreno y plazo
  costo_terreno       numeric(14,2) not null default 0,
  terreno_ancho       numeric(8,2),
  terreno_largo       numeric(8,2),
  plazo_meses         int,

  -- Indirectos en porcentaje sobre el costo de construcción neto
  pct_proyecto        numeric(6,3) not null default 3.5,
  pct_direccion       numeric(6,3) not null default 9.0,
  pct_desarrollo      numeric(6,3) not null default 5.0,
  pct_administracion  numeric(6,3) not null default 2.0,

  -- Indirectos en porcentaje sobre el terreno
  pct_comision        numeric(6,3) not null default 3.0,

  -- Indirectos de monto fijo
  gastos_escritura    numeric(14,2) not null default 0,
  gastos_municipales  numeric(14,2) not null default 0,

  zona                text default '',
  nota                text default '',
  actualizado_en      timestamptz not null default now()
);

alter table public.analisis enable row level security;
create policy analisis_ver    on public.analisis for select using (public.obra_visible(obra_id));
create policy analisis_editar on public.analisis for all
  using (public.puede_editar()) with check (public.puede_editar());

-- ---------------------------------------------------------------------
-- 2. Superficies por nivel
-- ---------------------------------------------------------------------
create table if not exists public.niveles (
  id            uuid primary key default gen_random_uuid(),
  obra_id       uuid not null references public.obras(id) on delete cascade,
  orden         int not null default 0,
  nombre        text not null,
  coch_ss       numeric(10,2) not null default 0,
  coch_pb       numeric(10,2) not null default 0,
  cubierta      numeric(10,2) not null default 0,
  semicubierta  numeric(10,2) not null default 0,
  comun         numeric(10,2) not null default 0,
  terraza       numeric(10,2) not null default 0,
  unidades      int not null default 0,
  nota          text default ''
);

create index if not exists niveles_obra_idx on public.niveles (obra_id, orden);

alter table public.niveles enable row level security;
create policy nivel_ver    on public.niveles for select using (public.obra_visible(obra_id));
create policy nivel_editar on public.niveles for all
  using (public.puede_editar()) with check (public.puede_editar());

-- ---------------------------------------------------------------------
-- 3. Vista de cómputo
--
--    Vendible = cubierta + semicubierta. Común = comunes + terrazas.
--    Las cocheras se cuentan aparte porque tienen su propia incidencia.
-- ---------------------------------------------------------------------
create or replace view public.v_analisis as
with sup as (
  select
    n.obra_id,
    sum(n.coch_ss)      as coch_ss,
    sum(n.coch_pb)      as coch_pb,
    sum(n.cubierta)     as cubierta,
    sum(n.semicubierta) as semicubierta,
    sum(n.comun)        as comun,
    sum(n.terraza)      as terraza,
    sum(n.unidades)     as unidades
  from public.niveles n
  group by n.obra_id
),
costo as (
  select
    s.*,
    a.costo_m2_base,
    a.costo_terreno,
    s.coch_ss      * a.costo_m2_base * a.coef_coch_ss      as c_coch_ss,
    s.coch_pb      * a.costo_m2_base * a.coef_coch_pb      as c_coch_pb,
    s.cubierta     * a.costo_m2_base * a.coef_cubierta     as c_cubierta,
    s.semicubierta * a.costo_m2_base * a.coef_semicubierta as c_semicubierta,
    s.comun        * a.costo_m2_base * a.coef_comun        as c_comun,
    s.terraza      * a.costo_m2_base * a.coef_terraza      as c_terraza,
    a.pct_proyecto, a.pct_direccion, a.pct_desarrollo,
    a.pct_administracion, a.pct_comision,
    a.gastos_escritura, a.gastos_municipales
  from sup s
  join public.analisis a on a.obra_id = s.obra_id
)
select
  c.obra_id,
  c.cubierta + c.semicubierta                            as vendible,
  c.comun + c.terraza                                    as comun_total,
  c.cubierta + c.semicubierta + c.comun + c.terraza      as total_m2,
  c.unidades,
  (c.c_coch_ss + c.c_coch_pb + c.c_cubierta
   + c.c_semicubierta + c.c_comun + c.c_terraza)         as construccion_neto,
  c.costo_terreno,
  c.gastos_escritura + c.gastos_municipales              as gastos_fijos,
  c.costo_terreno * c.pct_comision / 100                 as comision,
  (c.c_coch_ss + c.c_coch_pb + c.c_cubierta + c.c_semicubierta + c.c_comun + c.c_terraza)
    * (c.pct_proyecto + c.pct_direccion + c.pct_desarrollo + c.pct_administracion) / 100
                                                         as honorarios,
  (c.c_coch_ss + c.c_coch_pb + c.c_cubierta + c.c_semicubierta + c.c_comun + c.c_terraza)
    * (1 + (c.pct_proyecto + c.pct_direccion + c.pct_desarrollo + c.pct_administracion) / 100)
    + c.costo_terreno * (1 + c.pct_comision / 100)
    + c.gastos_escritura + c.gastos_municipales          as costo_total
from costo c;

-- ---------------------------------------------------------------------
-- 4. Control
-- ---------------------------------------------------------------------
select 'tabla analisis' as objeto,
       (select count(*) from information_schema.tables where table_name='analisis')::text as ok
union all
select 'tabla niveles',
       (select count(*) from information_schema.tables where table_name='niveles')::text;
