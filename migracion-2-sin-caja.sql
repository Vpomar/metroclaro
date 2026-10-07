-- =====================================================================
--  Migración 2 — Comprobantes solo informativos
--
--  Para comprobantes que solo son información para el contador:
--  no suman al costo de la obra, no tocan caja ni generan deuda.
--  Aparecen únicamente en el reporte contable.
--
--  Pegar completo en el SQL Editor y ejecutar. No borra nada.
-- =====================================================================

alter table public.comprobantes
  add column if not exists afecta_caja boolean not null default true;

-- Sin movimiento de fondos, la caja pasa a ser opcional.
alter table public.comprobantes alter column caja_id drop not null;

-- La fecha de pago solo se exige cuando el comprobante mueve la caja.
alter table public.comprobantes drop constraint if exists fecha_pago_coherente;
alter table public.comprobantes add constraint fecha_pago_coherente check (
  afecta_caja = false
  or (pago = 'pagado' and fecha_pago is not null)
  or pago = 'pendiente'
);

create index if not exists comprobantes_afecta_caja_idx
  on public.comprobantes (obra_id, afecta_caja);

-- ---------------------------------------------------------------------
--  Vistas actualizadas: lo informativo no suma al costo ni genera deuda
--
--  Se borran y se recrean porque cambian columnas de lugar, y
--  create or replace solo admite agregar columnas al final.
--  Las vistas no guardan datos: borrarlas no pierde nada.
-- ---------------------------------------------------------------------
drop view if exists public.v_obras;
drop view if exists public.v_proveedores;
drop view if exists public.v_rubros;

create view public.v_rubros as
select
  c.obra_id,
  c.rubro_id,
  sum(c.usd) filter (where c.afecta_caja)                             as ejecutado,
  sum(c.usd) filter (where c.pago = 'pagado' and c.afecta_caja)       as pagado,
  sum(c.usd) filter (where c.pago = 'pendiente' and c.afecta_caja)    as adeudado,
  sum(c.usd) filter (where not c.afecta_caja)                         as solo_informativo
from public.comprobantes c
group by c.obra_id, c.rubro_id;

create view public.v_proveedores as
select
  c.obra_id,
  c.proveedor,
  max(c.cuit)                                                                   as cuit,
  sum(c.usd) filter (where c.afecta_caja)                                       as comprado,
  sum(c.usd) filter (where c.pago = 'pagado' and c.afecta_caja)                 as pagado,
  sum(c.usd) filter (where c.pago = 'pendiente' and c.afecta_caja)              as adeudado,
  min(c.fecha) filter (where c.pago = 'pendiente' and c.afecta_caja)            as pendiente_mas_antiguo
from public.comprobantes c
group by c.obra_id, c.proveedor;

create view public.v_obras as
select
  o.id as obra_id,
  o.nombre,
  coalesce((select sum(usd) from public.aportes a where a.obra_id = o.id), 0)      as aportes,
  coalesce((select sum(usd) from public.comprobantes c
            where c.obra_id = o.id and c.afecta_caja), 0)                          as ejecutado,
  coalesce((select sum(usd) from public.comprobantes c
            where c.obra_id = o.id and c.pago = 'pagado' and c.afecta_caja), 0)    as pagado,
  coalesce((select sum(usd) from public.comprobantes c
            where c.obra_id = o.id and c.pago = 'pendiente' and c.afecta_caja), 0) as deuda,
  coalesce((select sum(usd) from public.comprobantes c
            where c.obra_id = o.id and not c.afecta_caja), 0)                      as solo_informativo,
  coalesce((select sum(monto_usd) from public.presupuestos p where p.obra_id = o.id), 0)
                                                                                   as presupuesto
from public.obras o;
