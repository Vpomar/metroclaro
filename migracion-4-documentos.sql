-- =====================================================================
--  Migración 4 — Unidad del aporte y legajo de documentos
--
--  1) Cada aporte puede indicar para qué unidad se hace. Opcional:
--     sirve cuando el fideicomiso adjudica departamentos o lotes.
--     Va en el aporte y no en el inversor porque la misma persona
--     puede participar en varias obras y varias unidades.
--
--  2) Legajo por obra: escrituras, contrato de fideicomiso, adhesiones,
--     boletos de compraventa, planos y permisos.
--
--  Pegar completo en el SQL Editor y ejecutar. No borra nada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Unidad del aporte
-- ---------------------------------------------------------------------
alter table public.aportes
  add column if not exists unidad text not null default '';

create index if not exists aportes_unidad_idx
  on public.aportes (obra_id, unidad) where unidad <> '';

-- ---------------------------------------------------------------------
-- 2. Documentos
--
--    inversor_id opcional: si está cargado, el documento es reservado
--    y solo lo ven el equipo y ese inversor. Sirve para adhesiones y
--    boletos, donde cada uno debe ver el suyo y no el de los demás.
-- ---------------------------------------------------------------------
create table if not exists public.documentos (
  id          uuid primary key default gen_random_uuid(),
  obra_id     uuid not null references public.obras(id) on delete cascade,
  tipo        text not null default 'Otro',
  titulo      text not null,
  descripcion text default '',
  fecha       date,
  referencia  text default '',          -- escribanía, número de acta, tomo y folio
  inversor_id uuid references public.inversores(id) on delete set null,
  unidad      text default '',
  archivo     text not null,            -- ruta en el bucket 'documentos'
  creado_por  uuid references public.perfiles(id),
  creado_en   timestamptz not null default now()
);

create index if not exists documentos_obra_idx on public.documentos (obra_id, tipo, fecha desc);

alter table public.documentos enable row level security;

-- Un documento reservado solo lo ve el equipo y su inversor.
create policy doc_ver on public.documentos for select using (
  public.obra_visible(obra_id)
  and (
    inversor_id is null
    or public.puede_editar()
    or exists (
      select 1 from public.inversores i
      where i.id = documentos.inversor_id and i.perfil_id = auth.uid()
    )
  )
);
create policy doc_crear  on public.documentos for insert with check (public.puede_editar());
create policy doc_editar on public.documentos for update using (public.puede_editar());
create policy doc_borrar on public.documentos for delete using (public.es_admin());

-- ---------------------------------------------------------------------
-- 3. Almacenamiento de los archivos
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;

-- Las políticas de archivos nombran los buckets uno por uno.
drop policy if exists archivos_ver    on storage.objects;
drop policy if exists archivos_subir  on storage.objects;
drop policy if exists archivos_borrar on storage.objects;

create policy archivos_ver on storage.objects for select
  using (bucket_id in ('comprobantes','avance','documentos') and auth.uid() is not null);
create policy archivos_subir on storage.objects for insert
  with check (bucket_id in ('comprobantes','avance','documentos') and public.puede_editar());
create policy archivos_borrar on storage.objects for delete
  using (bucket_id in ('comprobantes','avance','documentos') and public.es_admin());

-- ---------------------------------------------------------------------
-- 4. Control
-- ---------------------------------------------------------------------
select 'unidad en aportes' as control,
       count(*) filter (where column_name = 'unidad') as ok
from information_schema.columns
where table_name = 'aportes'
union all
select 'tabla documentos',
       count(*) from information_schema.tables where table_name = 'documentos'
union all
select 'bucket documentos',
       count(*) from storage.buckets where id = 'documentos';
