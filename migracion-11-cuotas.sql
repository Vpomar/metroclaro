-- =====================================================================
--  Migración 11 — Ventas financiadas, cuotas e índice CAC
--
--  1) Tabla de índices: el CAC se carga una vez por mes.
--  2) Ventas en cuotas, en dólares o en pesos ajustadas por CAC.
--  3) Cada cuota se cobra contra una caja y queda saldada.
--
--  Pegar completo en el SQL Editor y ejecutar. No borra nada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ÍNDICES
--
--    Se puede cargar el nivel del índice o la variación mensual.
--    Si solo hay variación, el nivel se encadena desde el mes anterior.
-- ---------------------------------------------------------------------
create table if not exists public.indices (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null default 'CAC',
  periodo     text not null,                    -- 'AAAA-MM'
  valor       numeric(14,4),                    -- nivel del índice
  variacion   numeric(8,4),                     -- % respecto al mes anterior
  fuente      text default 'cifrasonline.com.ar',
  nota        text default '',
  cargado_por uuid references public.perfiles(id),
  cargado_en  timestamptz not null default now(),
  unique (nombre, periodo)
);

create index if not exists indices_periodo_idx on public.indices (nombre, periodo desc);

alter table public.indices enable row level security;
create policy indice_ver    on public.indices for select using (auth.uid() is not null);
create policy indice_editar on public.indices for all
  using (public.puede_editar()) with check (public.puede_editar());

-- ---------------------------------------------------------------------
-- 2. VENTAS FINANCIADAS
--
--    contado     una sola vez, como hasta ahora
--    cuotas_usd  el saldo se divide en cuotas en dólares
--    cuotas_cac  cuotas en pesos que se ajustan por CAC
-- ---------------------------------------------------------------------
alter table public.ventas
  add column if not exists modalidad text not null default 'contado'
    check (modalidad in ('contado','cuotas_usd','cuotas_cac')),
  add column if not exists anticipo         numeric(14,2) not null default 0,
  add column if not exists cuotas_cantidad  int not null default 0,
  add column if not exists periodo_base     text,
  add column if not exists indice_base      numeric(14,4);

-- ---------------------------------------------------------------------
-- 3. CUOTAS
--
--    monto_base queda fijo. En las ventas por CAC el importe a cobrar
--    se recalcula con el índice del mes; al cobrar se guarda el índice
--    usado, así el importe cobrado no cambia nunca más.
-- ---------------------------------------------------------------------
create table if not exists public.cuotas (
  id            uuid primary key default gen_random_uuid(),
  venta_id      uuid not null references public.ventas(id) on delete cascade,
  numero        int not null,
  vencimiento   date not null,
  monto_base    numeric(14,2) not null check (monto_base > 0),
  moneda        text not null default 'ARS' check (moneda in ('ARS','USD')),
  estado        text not null default 'pendiente'
                check (estado in ('pendiente','cobrada','anulada')),
  fecha_cobro   date,
  monto_cobrado numeric(14,2),
  cotizacion    numeric(14,4),
  indice_cobro  numeric(14,4),
  caja_id       uuid references public.cajas(id) on delete set null,
  nota          text default '',
  creado_en     timestamptz not null default now(),
  unique (venta_id, numero),
  constraint cobro_cuota_coherente check (
    estado <> 'cobrada' or (fecha_cobro is not null and monto_cobrado is not null)
  )
);

create index if not exists cuotas_venta_idx on public.cuotas (venta_id, numero);
create index if not exists cuotas_venc_idx  on public.cuotas (vencimiento) where estado = 'pendiente';

alter table public.cuotas enable row level security;

create policy cuota_ver on public.cuotas for select using (
  exists (select 1 from public.ventas v
          where v.id = cuotas.venta_id and public.obra_visible(v.obra_id))
);
create policy cuota_editar on public.cuotas for all
  using (public.puede_editar()) with check (public.puede_editar());

drop trigger if exists auditar on public.cuotas;
create trigger auditar after insert or update or delete on public.cuotas
  for each row execute function public.registrar_cambio();

-- ---------------------------------------------------------------------
-- 4. Vista de cobranzas
--
--    Importe ajustado de cada cuota pendiente según el último índice.
-- ---------------------------------------------------------------------
create or replace view public.v_cuotas as
with ultimo as (
  select valor from public.indices
  where nombre = 'CAC' and valor is not null
  order by periodo desc limit 1
)
select
  c.id,
  v.obra_id,
  c.venta_id,
  v.cliente,
  v.unidad,
  c.numero,
  c.vencimiento,
  c.moneda,
  c.monto_base,
  case
    when c.estado = 'cobrada'      then c.monto_cobrado
    when v.modalidad = 'cuotas_cac' and v.indice_base > 0
      then c.monto_base * coalesce((select valor from ultimo), v.indice_base) / v.indice_base
    else c.monto_base
  end                                                   as monto_actual,
  c.estado,
  c.fecha_cobro,
  case when c.estado = 'pendiente' and c.vencimiento < current_date
       then current_date - c.vencimiento else 0 end     as dias_vencida
from public.cuotas c
join public.ventas v on v.id = c.venta_id;

-- ---------------------------------------------------------------------
-- 5. Control
-- ---------------------------------------------------------------------
select 'tabla indices' as objeto,
       (select count(*) from information_schema.tables where table_name='indices')::text as ok
union all
select 'tabla cuotas',
       (select count(*) from information_schema.tables where table_name='cuotas')::text
union all
select 'columnas de financiación en ventas',
       (select count(*) from information_schema.columns
        where table_name='ventas'
          and column_name in ('modalidad','anticipo','cuotas_cantidad','periodo_base','indice_base'))::text;
