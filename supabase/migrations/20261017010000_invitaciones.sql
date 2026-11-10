-- =====================================================================
--  Invitaciones
--
--  Un enlace público por negocio, para mandarle la propuesta a alguien
--  por WhatsApp. El que lo abre ve el proyecto y puede mover el precio
--  de venta y su aporte para entender cómo le queda.
--
--  Mismo criterio que la rendición: el token no expone la base, lo
--  sirve una función del servidor.
-- =====================================================================

create table if not exists public.invitaciones (
  id            uuid primary key default gen_random_uuid(),
  token         text not null unique,
  negocio_id    uuid not null references public.negocios(id) on delete cascade,
  titulo        text default '',
  vence         date,
  activo        boolean not null default true,
  visitas       int not null default 0,
  ultima_visita timestamptz,
  creado_por    uuid references public.perfiles(id),
  creado_en     timestamptz not null default now()
);

create index if not exists invitaciones_negocio_idx
  on public.invitaciones (negocio_id, creado_en desc);

alter table public.invitaciones enable row level security;

create policy invitacion_ver    on public.invitaciones for select to authenticated
  using (public.puede_editar());
create policy invitacion_crear  on public.invitaciones for insert to authenticated
  with check (public.puede_editar());
create policy invitacion_editar on public.invitaciones for update to authenticated
  using (public.puede_editar()) with check (public.puede_editar());
create policy invitacion_borrar on public.invitaciones for delete to authenticated
  using (public.es_admin());

drop trigger if exists auditar on public.invitaciones;
create trigger auditar after insert or update or delete on public.invitaciones
  for each row execute function public.registrar_cambio();

-- El dueño del lote deja de pagar expensas: las absorbe el proyecto.
-- Es un beneficio suyo que no estaba contemplado y conviene mostrarlo.
alter table public.negocios
  add column if not exists expensas_las_pagaba_el_dueno boolean not null default true;

comment on column public.negocios.expensas_las_pagaba_el_dueno is
  'Si el dueño del lote venía pagando las expensas antes del proyecto. '
  'Cuando es verdadero, lo que el proyecto absorbe es un ahorro para él.';

select 'tabla invitaciones' as objeto,
       (select count(*) from information_schema.tables
        where table_name = 'invitaciones')::text as ok;
