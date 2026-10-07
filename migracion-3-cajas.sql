-- =====================================================================
--  Migración 3 — Cajas por dónde está la plata, no por para qué se gasta
--
--  Antes había cinco cajas por obra, tres de ellas por destino
--  (terreno, impuestos, obra). Eso duplicaba lo que ya dice el rubro.
--  Quedan tres, que es lo único que la caja debería informar:
--  en qué bolsillo está el dinero.
--
--      Caja en efectivo
--      Caja mutual
--      Banco
--
--  Cada obra conserva sus propias cajas.
--  Pegar completo en el SQL Editor y ejecutar. No borra movimientos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Crear las tres cajas en cada obra, si faltan
-- ---------------------------------------------------------------------
insert into public.cajas (obra_id, nombre, detalle, orden)
select o.id, n.nombre, n.detalle, n.orden
from public.obras o
cross join (values
  ('Caja en efectivo', 'Fondo en efectivo de la obra',            10),
  ('Caja mutual',      'Movimientos por la cuenta en la mutual',  20),
  ('Banco',            'Cuenta bancaria de la obra',              30)
) as n(nombre, detalle, orden)
where not exists (
  select 1 from public.cajas c
  where c.obra_id = o.id and c.nombre = n.nombre
);

-- ---------------------------------------------------------------------
-- 2. Mudar los movimientos de las cajas viejas a Caja en efectivo
--
--    Cualquier movimiento que en realidad haya sido por banco o por
--    la mutual se reasigna después desde la aplicación, con el botón
--    Editar del comprobante o del aporte.
-- ---------------------------------------------------------------------
update public.comprobantes c
set caja_id = destino.id
from public.cajas vieja
join public.cajas destino
  on destino.obra_id = vieja.obra_id and destino.nombre = 'Caja en efectivo'
where c.caja_id = vieja.id
  and vieja.nombre in ('Terreno y escritura', 'Impuestos y mantenimiento', 'Obra');

update public.aportes a
set caja_id = destino.id
from public.cajas vieja
join public.cajas destino
  on destino.obra_id = vieja.obra_id and destino.nombre = 'Caja en efectivo'
where a.caja_id = vieja.id
  and vieja.nombre in ('Terreno y escritura', 'Impuestos y mantenimiento', 'Obra');

-- ---------------------------------------------------------------------
-- 3. Eliminar las cajas viejas, ya vacías
--
--    La condición de "sin movimientos" es una red de seguridad: si
--    algo quedó apuntando a una caja vieja, esa caja no se borra y
--    se puede revisar a mano.
-- ---------------------------------------------------------------------
delete from public.cajas c
where c.nombre in ('Terreno y escritura', 'Impuestos y mantenimiento', 'Obra')
  and not exists (select 1 from public.comprobantes x where x.caja_id = c.id)
  and not exists (select 1 from public.aportes     x where x.caja_id = c.id);

-- ---------------------------------------------------------------------
-- 4. Las obras nuevas nacen con las tres cajas
-- ---------------------------------------------------------------------
create or replace function public.nueva_obra(p_nombre text)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_id uuid;
begin
  insert into public.obras (nombre) values (p_nombre) returning id into v_id;

  insert into public.cajas (obra_id, nombre, detalle, orden) values
    (v_id, 'Caja en efectivo', 'Fondo en efectivo de la obra',           10),
    (v_id, 'Caja mutual',      'Movimientos por la cuenta en la mutual', 20),
    (v_id, 'Banco',            'Cuenta bancaria de la obra',             30);

  insert into public.clases (obra_id, letra, nombre, coeficiente) values
    (v_id, 'A', 'Cuota A', 1),
    (v_id, 'B', 'Cuota B', 1);

  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- 5. Control
--
--    Debería devolver tres filas por obra. Si aparece alguna caja
--    vieja, es que todavía tiene movimientos apuntando a ella.
-- ---------------------------------------------------------------------
select o.nombre as obra, c.nombre as caja, c.orden
from public.obras o
join public.cajas c on c.obra_id = o.id
order by o.nombre, c.orden;
