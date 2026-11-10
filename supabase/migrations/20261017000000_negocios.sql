-- =====================================================================
--  Negocios
--
--  El paso previo a una obra: alguien tiene un lote en un barrio
--  cerrado y quiere construir. Acá se arma la propuesta y se simula
--  cómo queda cada parte, antes de que exista la obra.
--
--  El lote entra a valor de tasación. El resto se aporta en efectivo.
--  Al vender se devuelve capital, después la tasa preferente por el
--  tiempo que la plata estuvo adentro, y recién entonces se reparte
--  el excedente entre administrador, terreno y aportantes.
--
--  La tasa es preferente, no garantizada: si no alcanza, se recorta.
-- =====================================================================

create table if not exists public.negocios (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  ubicacion     text default '',
  estado        text not null default 'borrador'
                check (estado in ('borrador','ofrecido','cerrado','descartado')),

  -- El lote
  tasacion_1    numeric(14,2),
  tasacion_2    numeric(14,2),
  tasacion_3    numeric(14,2),
  criterio_lote text not null default 'promedio'
                check (criterio_lote in ('promedio','menor','manual')),
  valor_lote    numeric(14,2) not null default 0,
  propietario   text default '',

  -- La obra
  m2            numeric(10,2) not null default 0,
  costo_m2      numeric(12,2) not null default 0,
  pct_honorarios numeric(6,3) not null default 20,
  expensas_mes  numeric(12,2) not null default 0,
  meses_obra    int not null default 18,
  mes_venta     int not null default 21,

  -- La venta
  precio_venta  numeric(14,2) not null default 0,
  pct_comision  numeric(6,3) not null default 3,

  -- Las tasas, que pueden ser distintas
  tasa_efectivo numeric(6,3) not null default 8,
  tasa_lote     numeric(6,3) not null default 8,

  -- El reparto del excedente
  pct_exc_admin numeric(6,3) not null default 30,
  pct_exc_lote  numeric(6,3) not null default 10,
  pct_exc_cash  numeric(6,3) not null default 60,

  render        text,                       -- imagen del anteproyecto
  nota          text default '',
  obra_id       uuid references public.obras(id) on delete set null,
  creado_por    uuid references public.perfiles(id),
  creado_en     timestamptz not null default now(),

  constraint reparto_cierra check (
    abs(pct_exc_admin + pct_exc_lote + pct_exc_cash - 100) < 0.01
  )
);

create index if not exists negocios_estado_idx on public.negocios (estado, creado_en desc);

alter table public.negocios enable row level security;

-- Es información comercial del estudio: la ve el equipo, no los inversores
create policy negocio_ver    on public.negocios for select to authenticated
  using (public.puede_editar());
create policy negocio_crear  on public.negocios for insert to authenticated
  with check (public.puede_editar());
create policy negocio_editar on public.negocios for update to authenticated
  using (public.puede_editar()) with check (public.puede_editar());
create policy negocio_borrar on public.negocios for delete to authenticated
  using (public.es_admin());

drop trigger if exists auditar on public.negocios;
create trigger auditar after insert or update or delete on public.negocios
  for each row execute function public.registrar_cambio();

-- ---------------------------------------------------------------------
--  Control
-- ---------------------------------------------------------------------
select 'tabla negocios' as objeto,
       (select count(*) from information_schema.tables
        where table_name = 'negocios')::text as ok;
