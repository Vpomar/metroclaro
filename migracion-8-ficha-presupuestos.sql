-- =====================================================================
--  Migración 8 — Ficha técnica y pedidos de presupuesto
--
--  1) Ficha de la obra: niveles, unidades y superficies. Permite
--     calcular el costo por metro cuadrado, que es el número con el
--     que se compara contra el mercado.
--  2) Proveedores con contacto, por rubro.
--  3) Pedidos de presupuesto y las respuestas recibidas.
--
--  Pegar completo en el SQL Editor y ejecutar. No borra nada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. FICHA TÉCNICA
--
--    Una por obra. Las superficies en metros cuadrados.
-- ---------------------------------------------------------------------
create table if not exists public.fichas (
  obra_id           uuid primary key references public.obras(id) on delete cascade,
  descripcion       text default '',        -- "PB + 4 + terraza, 8 deptos, 2 cocheras"
  niveles           int,
  subsuelos         int,
  unidades          int,
  cocheras          int,
  sup_terreno       numeric(10,2),
  sup_cubierta      numeric(10,2),
  sup_semicubierta  numeric(10,2),
  sup_descubierta   numeric(10,2),
  sup_comun         numeric(10,2),
  sup_vendible      numeric(10,2),
  inicio            date,
  fin_previsto      date,
  nota              text default '',
  actualizado_en    timestamptz not null default now()
);

alter table public.fichas enable row level security;
create policy ficha_ver    on public.fichas for select using (public.obra_visible(obra_id));
create policy ficha_editar on public.fichas for all
  using (public.puede_editar()) with check (public.puede_editar());

-- Superficie computable: cubierta + la mitad de la semicubierta,
-- que es el criterio habitual para medir costo por metro.
create or replace view public.v_superficies as
select
  f.obra_id,
  coalesce(f.sup_cubierta,0)                                   as cubierta,
  coalesce(f.sup_semicubierta,0)                               as semicubierta,
  coalesce(f.sup_comun,0)                                      as comun,
  coalesce(f.sup_vendible,0)                                   as vendible,
  coalesce(f.sup_cubierta,0)
    + coalesce(f.sup_semicubierta,0) * 0.5                     as computable,
  coalesce(f.sup_cubierta,0)
    + coalesce(f.sup_semicubierta,0) * 0.5
    + coalesce(f.sup_comun,0)                                  as total_construida
from public.fichas f;

-- ---------------------------------------------------------------------
-- 2. PROVEEDORES
--
--    Catálogo del estudio, compartido entre obras. rubro_id es el
--    rubro principal: sirve para saber a quién pedirle presupuesto.
-- ---------------------------------------------------------------------
create table if not exists public.proveedores (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null,
  cuit      text default '',
  email     text default '',
  telefono  text default '',
  rubro_id  uuid references public.rubros(id) on delete set null,
  contacto  text default '',
  nota      text default '',
  activo    boolean not null default true,
  creado_en timestamptz not null default now()
);

create index if not exists proveedores_rubro_idx on public.proveedores (rubro_id) where activo;

alter table public.proveedores enable row level security;
create policy prov_ver    on public.proveedores for select using (auth.uid() is not null);
create policy prov_editar on public.proveedores for all
  using (public.puede_editar()) with check (public.puede_editar());

-- ---------------------------------------------------------------------
-- 3. PEDIDOS DE PRESUPUESTO
--
--    El envío del correo lo hace el usuario desde su propia casilla.
--    Acá queda el registro de a quién se le pidió y qué contestó.
-- ---------------------------------------------------------------------
create table if not exists public.pedidos (
  id           uuid primary key default gen_random_uuid(),
  obra_id      uuid not null references public.obras(id) on delete cascade,
  rubro_id     uuid references public.rubros(id) on delete set null,
  titulo       text not null,
  detalle      text default '',
  cuerpo       text default '',            -- texto del correo enviado
  fecha        date not null default current_date,
  vence        date,
  estado       text not null default 'abierto'
               check (estado in ('abierto','adjudicado','desierto','cancelado')),
  creado_por   uuid references public.perfiles(id),
  creado_en    timestamptz not null default now()
);

create table if not exists public.pedido_respuestas (
  id            uuid primary key default gen_random_uuid(),
  pedido_id     uuid not null references public.pedidos(id) on delete cascade,
  proveedor_id  uuid references public.proveedores(id) on delete set null,
  proveedor     text not null default '',
  enviado       boolean not null default false,
  respondio     boolean not null default false,
  moneda        text not null default 'USD' check (moneda in ('ARS','USD')),
  importe       numeric(14,2),
  cotizacion    numeric(14,4) not null default 1,
  usd           numeric(14,2) generated always as (
                  case when moneda = 'USD' then importe else importe / cotizacion end
                ) stored,
  plazo         text default '',
  adjudicado    boolean not null default false,
  nota          text default '',
  archivo       text,
  unique (pedido_id, proveedor_id)
);

create index if not exists pedidos_obra_idx on public.pedidos (obra_id, fecha desc);

alter table public.pedidos           enable row level security;
alter table public.pedido_respuestas enable row level security;

create policy pedido_ver    on public.pedidos for select using (public.obra_visible(obra_id));
create policy pedido_editar on public.pedidos for all
  using (public.puede_editar()) with check (public.puede_editar());

create policy resp_ver on public.pedido_respuestas for select using (
  exists (select 1 from public.pedidos p
          where p.id = pedido_respuestas.pedido_id and public.obra_visible(p.obra_id))
);
create policy resp_editar on public.pedido_respuestas for all
  using (public.puede_editar()) with check (public.puede_editar());

drop trigger if exists auditar on public.pedidos;
create trigger auditar after insert or update or delete on public.pedidos
  for each row execute function public.registrar_cambio();

-- ---------------------------------------------------------------------
-- 4. Sembrar proveedores con los que ya aparecen en los comprobantes
-- ---------------------------------------------------------------------
insert into public.proveedores (nombre, cuit, rubro_id)
select distinct on (trim(c.proveedor))
  trim(c.proveedor),
  coalesce(max(c.cuit), ''),
  (array_agg(c.rubro_id order by c.fecha desc))[1]
from public.comprobantes c
where coalesce(trim(c.proveedor),'') <> ''
group by trim(c.proveedor)
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 5. Control
-- ---------------------------------------------------------------------
select 'proveedores sembrados' as control, count(*)::text as cantidad from public.proveedores
union all
select 'tabla fichas', (select count(*) from information_schema.tables where table_name='fichas')::text
union all
select 'tabla pedidos', (select count(*) from information_schema.tables where table_name='pedidos')::text;
