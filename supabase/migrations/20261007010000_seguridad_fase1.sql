-- =====================================================================
--  Fase 1 — Correcciones de seguridad (auditoría 2026-10-07)
--
--  C-01  Las vistas v_* eran security definer y anon podía leerlas:
--        exponían inversores, capital, proveedores y costos sin login.
--  H-01  Cualquier usuario autenticado leía todos los archivos.
--  H-02  Cualquiera, incluso sin login, podía insertar en auditoria.
--  M-01  anon y authenticated tenían todos los privilegios (incluido
--        TRUNCATE) y los objetos nuevos nacían igual de abiertos.
--  L-02  anon podía ejecutar sumar_visita.
--
--  No toca datos. La aplicación no usa las vistas: las lee la base
--  pero ninguna pantalla las consulta.
-- =====================================================================


-- ---------------------------------------------------------------------
--  C-01. Vistas: respetan el RLS de quien consulta y salen de la API
-- ---------------------------------------------------------------------
alter view public.v_analisis    set (security_invoker = true);
alter view public.v_cuotas      set (security_invoker = true);
alter view public.v_honorarios  set (security_invoker = true);
alter view public.v_inversores  set (security_invoker = true);
alter view public.v_iva         set (security_invoker = true);
alter view public.v_obras       set (security_invoker = true);
alter view public.v_proveedores set (security_invoker = true);
alter view public.v_rubros      set (security_invoker = true);
alter view public.v_superficies set (security_invoker = true);
alter view public.v_unidades    set (security_invoker = true);
alter view public.v_ventas      set (security_invoker = true);

revoke all on public.v_analisis, public.v_cuotas, public.v_honorarios, public.v_inversores,
              public.v_iva, public.v_obras, public.v_proveedores, public.v_rubros,
              public.v_superficies, public.v_unidades, public.v_ventas
  from anon, authenticated;


-- ---------------------------------------------------------------------
--  H-02. Historial: solo lo escribe el disparador, que corre como dueño
-- ---------------------------------------------------------------------
drop policy if exists audit_alta on public.auditoria;
revoke insert, update, delete, truncate on public.auditoria from anon, authenticated;
revoke all on sequence public.auditoria_id_seq from anon, authenticated;


-- ---------------------------------------------------------------------
--  M-01. Permisos mínimos
--
--  anon no necesita nada del esquema public: el login va por Auth y
--  el portal del inversor pasa por la función rendicion.
--  authenticated conserva lectura y escritura; el RLS decide las filas.
-- ---------------------------------------------------------------------
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke truncate, trigger, references on all tables in schema public from authenticated;

-- Funciones: por defecto PUBLIC (y por lo tanto anon) puede ejecutarlas.
revoke execute on all functions in schema public from public, anon;
grant  execute on function public.rol_actual()            to authenticated;
grant  execute on function public.puede_editar()          to authenticated;
grant  execute on function public.es_admin()              to authenticated;
grant  execute on function public.obra_visible(uuid)      to authenticated;
grant  execute on function public.periodo_cerrado(uuid)   to authenticated;
grant  execute on function public.nueva_obra(text)        to authenticated;
grant  execute on function public.nueva_caja(uuid, text, text)       to authenticated;
grant  execute on function public.nuevo_rubro(text, text, boolean)   to authenticated;

-- Las funciones de disparador no se invocan por la API.
revoke execute on function public.crear_perfil()     from authenticated;
revoke execute on function public.registrar_cambio() from authenticated;
revoke execute on function public.proteger_cierre()  from authenticated;

-- L-02. sumar_visita solo la usa la función rendicion (service_role).
revoke execute on function public.sumar_visita(uuid) from authenticated;
grant  execute on function public.sumar_visita(uuid) to service_role;

-- Lo que se cree de acá en adelante nace cerrado para anon.
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke truncate, trigger, references on tables from authenticated;


-- ---------------------------------------------------------------------
--  M-01. Las políticas pasan de PUBLIC a authenticated
-- ---------------------------------------------------------------------
do $$
declare p record;
begin
  for p in select tablename, policyname from pg_policies
           where schemaname = 'public' and roles = '{public}'
  loop
    execute format('alter policy %I on public.%I to authenticated', p.policyname, p.tablename);
  end loop;
end $$;


-- ---------------------------------------------------------------------
--  H-01. Archivos: cada uno ve lo que ve en las tablas
--
--  comprobantes/ y avance/   la carpeta es el id de la obra
--  documentos/               el archivo tiene que estar en la tabla
--                            documentos y respetar si es reservado
-- ---------------------------------------------------------------------
create or replace function public.puede_ver_archivo(p_bucket text, p_nombre text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when public.puede_editar() then true
    when p_bucket in ('comprobantes', 'avance') then exists (
      select 1 from public.obras o
      where o.id::text = split_part(p_nombre, '/', 1) and public.obra_visible(o.id))
    when p_bucket = 'documentos' then exists (
      select 1 from public.documentos d
      where d.archivo = p_bucket || '/' || p_nombre
        and public.obra_visible(d.obra_id)
        and (d.inversor_id is null or exists (
              select 1 from public.inversores i
              where i.id = d.inversor_id and i.perfil_id = auth.uid())))
    else false
  end
$$;

revoke execute on function public.puede_ver_archivo(text, text) from public, anon;
grant  execute on function public.puede_ver_archivo(text, text) to authenticated;

drop policy if exists archivos_ver    on storage.objects;
drop policy if exists archivos_subir  on storage.objects;
drop policy if exists archivos_borrar on storage.objects;

create policy archivos_ver on storage.objects for select to authenticated
  using (bucket_id in ('comprobantes','avance','documentos')
         and public.puede_ver_archivo(bucket_id, name));
create policy archivos_subir on storage.objects for insert to authenticated
  with check (bucket_id in ('comprobantes','avance','documentos') and public.puede_editar());
create policy archivos_borrar on storage.objects for delete to authenticated
  using (bucket_id in ('comprobantes','avance','documentos') and public.es_admin());
