-- =====================================================================
--  Migración 6 — El inversor participa en obras, no en todas
--
--  Hasta ahora la ficha del inversor era global y el capital suscripto
--  también, así que toda obra nueva mostraba a todos los inversores.
--
--  Ahora hay una tabla de participación: quién entra en qué obra y
--  con cuánto suscripto en cada clase. La ficha del inversor conserva
--  solo lo que es de la persona: nombre, CUIT y email.
--
--  Pegar completo en el SQL Editor y ejecutar. No borra nada.
-- =====================================================================

create table if not exists public.participaciones (
  id          uuid primary key default gen_random_uuid(),
  obra_id     uuid not null references public.obras(id)      on delete cascade,
  inversor_id uuid not null references public.inversores(id) on delete cascade,
  comp_a      numeric(14,2) not null default 0,
  comp_b      numeric(14,2) not null default 0,
  nota        text default '',
  creado_en   timestamptz not null default now(),
  unique (obra_id, inversor_id)
);

create index if not exists participaciones_obra_idx on public.participaciones (obra_id);

-- ---------------------------------------------------------------------
-- Traer lo que ya existe
--
-- 1) Todo inversor con aportes en una obra participa de esa obra.
--    El capital suscripto que tenía en su ficha se copia a la primera
--    obra donde participa; si participa en varias, revisalo a mano.
-- ---------------------------------------------------------------------
insert into public.participaciones (obra_id, inversor_id, comp_a, comp_b)
select
  a.obra_id,
  a.inversor_id,
  case when a.obra_id = (
    select min(x.obra_id::text)::uuid from public.aportes x where x.inversor_id = a.inversor_id
  ) then coalesce(i.comp_a, 0) else 0 end,
  case when a.obra_id = (
    select min(x.obra_id::text)::uuid from public.aportes x where x.inversor_id = a.inversor_id
  ) then coalesce(i.comp_b, 0) else 0 end
from public.aportes a
join public.inversores i on i.id = a.inversor_id
group by a.obra_id, a.inversor_id, i.comp_a, i.comp_b
on conflict (obra_id, inversor_id) do nothing;

-- 2) Un inversor con capital suscripto pero sin ningún aporte todavía
--    se asigna a la obra más antigua, para no perderlo de vista.
insert into public.participaciones (obra_id, inversor_id, comp_a, comp_b)
select
  (select id from public.obras order by creado_en limit 1),
  i.id, coalesce(i.comp_a,0), coalesce(i.comp_b,0)
from public.inversores i
where (coalesce(i.comp_a,0) + coalesce(i.comp_b,0)) > 0
  and not exists (select 1 from public.aportes a where a.inversor_id = i.id)
  and exists (select 1 from public.obras)
on conflict (obra_id, inversor_id) do nothing;

-- ---------------------------------------------------------------------
-- Seguridad
-- ---------------------------------------------------------------------
alter table public.participaciones enable row level security;

create policy part_ver on public.participaciones for select using (
  public.obra_visible(obra_id)
  or exists (
    select 1 from public.inversores i
    where i.id = participaciones.inversor_id and i.perfil_id = auth.uid()
  )
);
create policy part_editar on public.participaciones for all
  using (public.puede_editar()) with check (public.puede_editar());

drop trigger if exists auditar on public.participaciones;
create trigger auditar after insert or update or delete on public.participaciones
  for each row execute function public.registrar_cambio();

-- ---------------------------------------------------------------------
-- Un inversor pasa a verse solo en las obras donde participa
-- ---------------------------------------------------------------------
create or replace function public.obra_visible(o uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when public.rol_actual() in ('admin','carga') then true
    else exists (
      select 1
      from public.participaciones p
      join public.inversores i on i.id = p.inversor_id
      where p.obra_id = o and i.perfil_id = auth.uid()
    )
  end
$$;

-- ---------------------------------------------------------------------
-- Control: qué inversor participa en qué obra
-- ---------------------------------------------------------------------
select o.nombre as obra, i.nombre as inversor, p.comp_a, p.comp_b
from public.participaciones p
join public.obras o      on o.id = p.obra_id
join public.inversores i on i.id = p.inversor_id
order by o.nombre, i.nombre;
