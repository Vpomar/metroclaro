-- =====================================================================
--  Migración 12 — Portal del inversor por enlace
--
--  Le mandás un enlace al inversor y ve su rendición sin usuario ni
--  contraseña. El enlace es de solo lectura, tiene vencimiento y se
--  puede revocar en cualquier momento.
--
--  Los datos no se sirven desde el navegador: una función del
--  servidor valida el enlace y devuelve únicamente lo de ese inversor
--  en esa obra. La tabla queda cerrada para el público.
--
--  Pegar completo en el SQL Editor y ejecutar. No borra nada.
-- =====================================================================

create table if not exists public.enlaces (
  id             uuid primary key default gen_random_uuid(),
  token          text not null unique,
  obra_id        uuid not null references public.obras(id)      on delete cascade,
  inversor_id    uuid not null references public.inversores(id) on delete cascade,
  titulo         text default '',
  vence          date,
  activo         boolean not null default true,
  visitas        int not null default 0,
  ultima_visita  timestamptz,
  creado_por     uuid references public.perfiles(id),
  creado_en      timestamptz not null default now()
);

create index if not exists enlaces_token_idx on public.enlaces (token) where activo;
create index if not exists enlaces_obra_idx  on public.enlaces (obra_id, inversor_id);

alter table public.enlaces enable row level security;

-- Solo el equipo ve y administra los enlaces. El público no toca
-- esta tabla: llega por la función, que corre con otra identidad.
create policy enlace_ver    on public.enlaces for select using (public.puede_editar());
create policy enlace_editar on public.enlaces for all
  using (public.puede_editar()) with check (public.puede_editar());

drop trigger if exists auditar on public.enlaces;
create trigger auditar after insert or update or delete on public.enlaces
  for each row execute function public.registrar_cambio();

-- ---------------------------------------------------------------------
--  Contador de visitas
--
--  La función del servidor la llama cada vez que alguien abre el
--  enlace. Va aparte para que el resto de la tabla siga cerrada.
-- ---------------------------------------------------------------------
create or replace function public.sumar_visita(p_enlace uuid)
returns void language sql security definer set search_path = public as $$
  update public.enlaces
  set visitas = visitas + 1, ultima_visita = now()
  where id = p_enlace
$$;

-- ---------------------------------------------------------------------
--  Control
-- ---------------------------------------------------------------------
select 'tabla enlaces' as objeto,
       (select count(*) from information_schema.tables where table_name='enlaces')::text as ok;
