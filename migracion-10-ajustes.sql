-- =====================================================================
--  Migración 10 — Ajustes de honorarios y documentos
--
--  1) Honorarios de desarrolladora, con su porcentaje como los otros.
--  2) Los fletes y los honorarios quedan fuera de la base de cálculo.
--  3) Los documentos se agrupan en legales, arquitectura y presupuestos.
--
--  Pegar completo en el SQL Editor y ejecutar. No borra nada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Honorarios de desarrolladora
-- ---------------------------------------------------------------------
alter table public.obras
  add column if not exists pct_desarrolladora numeric(6,3) not null default 0;

insert into public.rubros (grupo, nombre, base_honorarios, orden)
select 'Honorarios', 'Honorarios de desarrolladora', false,
       coalesce((select max(orden) + 1 from public.rubros where grupo = 'Honorarios'), 55)
where not exists (
  select 1 from public.rubros where nombre = 'Honorarios de desarrolladora'
);

-- ---------------------------------------------------------------------
-- 2. Comprobantes que no computan para honorarios
--
--    Los fletes se pagan sobre materiales que ya computan, así que
--    incluirlos duplicaría la base. Lo mismo cualquier honorario.
-- ---------------------------------------------------------------------
alter table public.comprobantes
  add column if not exists computa_honorarios boolean not null default true;

-- Todo lo imputado a rubros de honorarios queda excluido de una vez.
update public.comprobantes c
set computa_honorarios = false
from public.rubros r
where r.id = c.rubro_id
  and r.grupo = 'Honorarios'
  and c.computa_honorarios;

-- Lo que ya está cargado con "flete" en el detalle o el proveedor.
update public.comprobantes
set computa_honorarios = false
where computa_honorarios
  and (lower(coalesce(detalle,''))   like '%flete%'
    or lower(coalesce(proveedor,'')) like '%flete%');

create index if not exists comprobantes_honorarios_idx
  on public.comprobantes (obra_id) where computa_honorarios;

-- ---------------------------------------------------------------------
-- 3. Categoría de los documentos
-- ---------------------------------------------------------------------
alter table public.documentos
  add column if not exists categoria text not null default 'Legales'
  check (categoria in ('Legales','Arquitectura','Presupuestos','Otros'));

-- Reubicar lo ya cargado según su tipo.
update public.documentos set categoria = 'Arquitectura'
where tipo in ('Plano','Permiso municipal');

update public.documentos set categoria = 'Presupuestos'
where tipo in ('Presupuesto','Cotización');

create index if not exists documentos_categoria_idx
  on public.documentos (obra_id, categoria, fecha desc);

-- ---------------------------------------------------------------------
-- 4. Base de honorarios actualizada
--
--    Excluye los rubros marcados fuera de base y, dentro de los que
--    sí computan, los comprobantes marcados como no computables.
-- ---------------------------------------------------------------------
create or replace view public.v_honorarios as
select
  o.id                                                       as obra_id,
  coalesce(b.base, 0)                                        as base_ejecutada,
  coalesce(b.base, 0) * o.pct_conduccion      / 100           as conduccion_devengada,
  coalesce(b.base, 0) * o.pct_administracion  / 100           as administracion_devengada,
  coalesce(b.base, 0) * o.pct_desarrolladora  / 100           as desarrolladora_devengada
from public.obras o
left join (
  select c.obra_id, sum(c.usd) as base
  from public.comprobantes c
  join public.rubros r on r.id = c.rubro_id
  where r.base_honorarios
    and c.afecta_caja
    and c.computa_honorarios
  group by c.obra_id
) b on b.obra_id = o.id;

-- ---------------------------------------------------------------------
-- 5. Control
-- ---------------------------------------------------------------------
select 'rubro desarrolladora' as control,
       (select count(*) from public.rubros where nombre='Honorarios de desarrolladora')::text as ok
union all
select 'comprobantes excluidos de honorarios',
       (select count(*) from public.comprobantes where not computa_honorarios)::text
union all
select 'documentos por categoría',
       (select string_agg(categoria || ': ' || n, ' · ')
        from (select categoria, count(*) n from public.documentos group by categoria) x)::text;
