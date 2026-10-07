-- =====================================================================
--  Migración 7 — Ventas de unidades
--
--  Registra las facturas emitidas por la venta de unidades. El sistema
--  no emite comprobantes ante ARCA: se cargan los que ya se emitieron
--  desde el sistema de facturación del estudio. Sirve para tener la
--  unidad vinculada al comprador, el CAE a mano y las ventas del
--  período en el reporte contable.
--
--  Pegar completo en el SQL Editor y ejecutar. No borra nada.
-- =====================================================================

create table if not exists public.ventas (
  id           uuid primary key default gen_random_uuid(),
  obra_id      uuid not null references public.obras(id) on delete cascade,
  fecha        date not null default current_date,
  tipo         text not null default 'Factura A',
  numero       text default '',                 -- punto de venta y número
  cae          text default '',
  cae_vence    date,
  cliente      text not null,                   -- razón social del comprador
  cuit         text default '',
  inversor_id  uuid references public.inversores(id) on delete set null,
  unidad       text default '',
  concepto     text default '',
  moneda       text not null default 'ARS' check (moneda in ('ARS','USD')),
  importe      numeric(14,2) not null check (importe > 0),
  neto         numeric(14,2) not null default 0,
  iva          numeric(14,2) not null default 0,
  percepciones numeric(14,2) not null default 0,
  cotizacion   numeric(14,4) not null default 1 check (cotizacion > 0),
  usd          numeric(14,2) generated always as (
                 case when moneda = 'USD' then importe else importe / cotizacion end
               ) stored,
  cobro        text not null default 'cobrado' check (cobro in ('cobrado','pendiente')),
  fecha_cobro  date,
  caja_id      uuid references public.cajas(id) on delete set null,
  archivo      text,                            -- copia del comprobante
  nota         text default '',
  creado_por   uuid references public.perfiles(id),
  creado_en    timestamptz not null default now(),
  constraint cobro_coherente check (
    (cobro = 'cobrado' and fecha_cobro is not null) or cobro = 'pendiente'
  )
);

create index if not exists ventas_obra_idx    on public.ventas (obra_id, fecha desc);
create index if not exists ventas_unidad_idx  on public.ventas (obra_id, unidad) where unidad <> '';

alter table public.ventas enable row level security;

create policy venta_ver    on public.ventas for select using (public.obra_visible(obra_id));
create policy venta_crear  on public.ventas for insert with check (public.puede_editar());
create policy venta_editar on public.ventas for update using (public.puede_editar());
create policy venta_borrar on public.ventas for delete using (public.es_admin());

-- El historial y el cierre de período también alcanzan a las ventas
drop trigger if exists auditar on public.ventas;
create trigger auditar after insert or update or delete on public.ventas
  for each row execute function public.registrar_cambio();

drop trigger if exists proteger on public.ventas;
create trigger proteger before insert or update or delete on public.ventas
  for each row execute function public.proteger_cierre();

-- ---------------------------------------------------------------------
--  Ventas por período, para el reporte contable
-- ---------------------------------------------------------------------
create or replace view public.v_ventas as
select
  v.obra_id,
  to_char(v.fecha, 'YYYY-MM')                       as periodo,
  v.tipo,
  count(*)                                          as comprobantes,
  sum(v.neto)                                       as neto,
  sum(v.iva)                                        as iva,
  sum(v.percepciones)                               as percepciones,
  sum(v.importe)                                    as total,
  sum(v.usd)                                        as total_usd,
  sum(v.usd) filter (where v.cobro = 'pendiente')   as por_cobrar
from public.ventas v
group by v.obra_id, to_char(v.fecha, 'YYYY-MM'), v.tipo;

-- ---------------------------------------------------------------------
--  Control
-- ---------------------------------------------------------------------
select 'tabla ventas' as objeto,
       (select count(*) from information_schema.tables where table_name = 'ventas')::text as ok;
