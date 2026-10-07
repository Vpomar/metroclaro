-- =====================================================================
--  Esquema base — réplica del esquema real de producción (Simple STGO)
--  al 2026-10-07, reconstruido desde el catálogo de Postgres.
--
--  Reemplaza a instalar-sistema.sql y a migracion-2..13.sql, que no
--  coincidían con la base real. Reproduce el estado tal cual estaba,
--  incluidos los problemas de seguridad detectados en la auditoría:
--  esos se corrigen en la migración siguiente, no acá.
-- =====================================================================


-- ---------------------------------------------------------------------
--  Tablas
-- ---------------------------------------------------------------------

create table public.perfiles (
  id        uuid primary key references auth.users(id) on delete cascade,
  nombre    text not null default '',
  rol       text not null default 'inversor' check (rol in ('admin','carga','inversor')),
  creado_en timestamptz not null default now()
);

create table public.obras (
  id                 uuid primary key default gen_random_uuid(),
  nombre             text not null,
  descripcion        text default '',
  pct_conduccion     numeric(6,3) not null default 0,
  pct_administracion numeric(6,3) not null default 0,
  activa             boolean not null default true,
  creado_en          timestamptz not null default now(),
  pct_desarrolladora numeric(6,3) not null default 0
);

create table public.clases (
  id          uuid primary key default gen_random_uuid(),
  obra_id     uuid not null references public.obras(id) on delete cascade,
  letra       text not null check (letra in ('A','B')),
  nombre      text not null default 'Cuota A',
  coeficiente numeric(8,4) not null default 1,
  unique (obra_id, letra)
);

create table public.rubros (
  id              uuid primary key default gen_random_uuid(),
  grupo           text not null default 'Otros',
  nombre          text not null unique,
  base_honorarios boolean not null default true,
  activo          boolean not null default true,
  orden           int not null default 0
);

create table public.presupuestos (
  obra_id   uuid not null references public.obras(id)  on delete cascade,
  rubro_id  uuid not null references public.rubros(id) on delete cascade,
  monto_usd numeric(14,2) not null default 0,
  primary key (obra_id, rubro_id)
);

create table public.cajas (
  id      uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  nombre  text not null,
  detalle text default '',
  activa  boolean not null default true,
  orden   int not null default 0,
  unique (obra_id, nombre)
);

-- comp_a / comp_b: columnas heredadas de antes de la migración 6.
-- El capital suscripto vigente vive en participaciones.
create table public.inversores (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null,
  cuit      text default '',
  email     text default '',
  perfil_id uuid references public.perfiles(id) on delete set null,
  comp_a    numeric(14,2) not null default 0,
  comp_b    numeric(14,2) not null default 0
);

create table public.participaciones (
  id          uuid primary key default gen_random_uuid(),
  obra_id     uuid not null references public.obras(id)      on delete cascade,
  inversor_id uuid not null references public.inversores(id) on delete cascade,
  comp_a      numeric(14,2) not null default 0,
  comp_b      numeric(14,2) not null default 0,
  nota        text default '',
  creado_en   timestamptz not null default now(),
  unique (obra_id, inversor_id)
);

create table public.niveles (
  id           uuid primary key default gen_random_uuid(),
  obra_id      uuid not null references public.obras(id) on delete cascade,
  orden        int not null default 0,
  nombre       text not null,
  coch_ss      numeric(10,2) not null default 0,
  coch_pb      numeric(10,2) not null default 0,
  cubierta     numeric(10,2) not null default 0,
  semicubierta numeric(10,2) not null default 0,
  comun        numeric(10,2) not null default 0,
  terraza      numeric(10,2) not null default 0,
  unidades     int not null default 0,
  nota         text default ''
);

create table public.ventas (
  id              uuid primary key default gen_random_uuid(),
  obra_id         uuid not null references public.obras(id) on delete cascade,
  fecha           date not null default current_date,
  tipo            text not null default 'Factura A',
  numero          text default '',
  cae             text default '',
  cae_vence       date,
  cliente         text not null,
  cuit            text default '',
  inversor_id     uuid references public.inversores(id) on delete set null,
  unidad          text default '',
  concepto        text default '',
  moneda          text not null default 'ARS' check (moneda in ('ARS','USD')),
  importe         numeric(14,2) not null check (importe > 0),
  neto            numeric(14,2) not null default 0,
  iva             numeric(14,2) not null default 0,
  percepciones    numeric(14,2) not null default 0,
  cotizacion      numeric(14,4) not null default 1 check (cotizacion > 0),
  usd             numeric(14,2) generated always as (
                    case when moneda = 'USD' then importe else importe / cotizacion end
                  ) stored,
  cobro           text not null default 'cobrado' check (cobro in ('cobrado','pendiente')),
  fecha_cobro     date,
  caja_id         uuid references public.cajas(id) on delete set null,
  archivo         text,
  nota            text default '',
  creado_por      uuid references public.perfiles(id),
  creado_en       timestamptz not null default now(),
  modalidad       text not null default 'contado'
                  check (modalidad in ('contado','cuotas_usd','cuotas_cac')),
  anticipo        numeric(14,2) not null default 0,
  cuotas_cantidad int not null default 0,
  periodo_base    text,
  indice_base     numeric(14,4),
  unidad_id       uuid,
  constraint cobro_coherente check (
    (cobro = 'cobrado' and fecha_cobro is not null) or cobro = 'pendiente'
  )
);

create table public.unidades (
  id               uuid primary key default gen_random_uuid(),
  obra_id          uuid not null references public.obras(id) on delete cascade,
  nivel_id         uuid references public.niveles(id) on delete set null,
  codigo           text not null,
  tipo             text not null default 'Departamento'
                   check (tipo in ('Departamento','Cochera','Baulera','Local','Otro')),
  piso             int,
  orden            int not null default 0,
  sup_cubierta     numeric(10,2) not null default 0,
  sup_semicubierta numeric(10,2) not null default 0,
  sup_comun        numeric(10,2) not null default 0,
  coeficiente      numeric(6,4) not null default 1 check (coeficiente > 0),
  estado           text not null default 'disponible'
                   check (estado in ('disponible','reservada','asignada','vendida')),
  inversor_id      uuid references public.inversores(id) on delete set null,
  venta_id         uuid references public.ventas(id)     on delete set null,
  precio_lista     numeric(14,2),
  nota             text default '',
  creado_en        timestamptz not null default now(),
  unique (obra_id, codigo)
);

alter table public.ventas add constraint ventas_unidad_id_fkey
  foreign key (unidad_id) references public.unidades(id) on delete set null;

create table public.aportes (
  id          uuid primary key default gen_random_uuid(),
  obra_id     uuid not null references public.obras(id)      on delete cascade,
  inversor_id uuid not null references public.inversores(id) on delete restrict,
  caja_id     uuid not null references public.cajas(id)      on delete restrict,
  clase       text not null default 'A' check (clase in ('A','B')),
  fecha       date not null default current_date,
  moneda      text not null default 'USD' check (moneda in ('ARS','USD')),
  importe     numeric(14,2) not null check (importe > 0),
  cotizacion  numeric(14,4) not null default 1 check (cotizacion > 0),
  usd         numeric(14,2) generated always as (
                case when moneda = 'USD' then importe else importe / cotizacion end
              ) stored,
  nota        text default '',
  creado_por  uuid references public.perfiles(id),
  creado_en   timestamptz not null default now(),
  unidad      text not null default '',
  unidad_id   uuid references public.unidades(id) on delete set null
);

create table public.comprobantes (
  id                 uuid primary key default gen_random_uuid(),
  obra_id            uuid not null references public.obras(id)  on delete cascade,
  caja_id            uuid references public.cajas(id)           on delete restrict,
  rubro_id           uuid not null references public.rubros(id) on delete restrict,
  fecha              date not null default current_date,
  proveedor          text not null,
  cuit               text default '',
  tipo               text not null default 'Factura A',
  numero             text default '',
  detalle            text default '',
  moneda             text not null default 'ARS' check (moneda in ('ARS','USD')),
  importe            numeric(14,2) not null check (importe > 0),
  cotizacion         numeric(14,4) not null default 1 check (cotizacion > 0),
  usd                numeric(14,2) generated always as (
                       case when moneda = 'USD' then importe else importe / cotizacion end
                     ) stored,
  pago               text not null default 'pagado' check (pago in ('pagado','pendiente')),
  fecha_pago         date,
  archivo            text,
  creado_por         uuid references public.perfiles(id),
  creado_en          timestamptz not null default now(),
  afecta_caja        boolean not null default true,
  neto               numeric(14,2) not null default 0,
  iva                numeric(14,2) not null default 0,
  percepciones       numeric(14,2) not null default 0,
  computa_honorarios boolean not null default true,
  constraint fecha_pago_coherente check (
    afecta_caja = false
    or (pago = 'pagado' and fecha_pago is not null)
    or pago = 'pendiente'
  )
);

create table public.indices (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null default 'CAC',
  periodo     text not null,
  valor       numeric(14,4),
  variacion   numeric(8,4),
  fuente      text default 'cifrasonline.com.ar',
  nota        text default '',
  cargado_por uuid references public.perfiles(id),
  cargado_en  timestamptz not null default now(),
  unique (nombre, periodo)
);

create table public.cuotas (
  id            uuid primary key default gen_random_uuid(),
  venta_id      uuid not null references public.ventas(id) on delete cascade,
  numero        int not null,
  vencimiento   date not null,
  monto_base    numeric(14,2) not null check (monto_base > 0),
  moneda        text not null default 'ARS' check (moneda in ('ARS','USD')),
  estado        text not null default 'pendiente'
                check (estado in ('pendiente','cobrada','anulada')),
  fecha_cobro   date,
  monto_cobrado numeric(14,2),
  cotizacion    numeric(14,4),
  indice_cobro  numeric(14,4),
  caja_id       uuid references public.cajas(id) on delete set null,
  nota          text default '',
  creado_en     timestamptz not null default now(),
  unique (venta_id, numero),
  constraint cobro_cuota_coherente check (
    estado <> 'cobrada' or (fecha_cobro is not null and monto_cobrado is not null)
  )
);

create table public.avances (
  id          uuid primary key default gen_random_uuid(),
  obra_id     uuid not null references public.obras(id) on delete cascade,
  fecha       date not null default current_date,
  titulo      text not null default '',
  descripcion text default '',
  pct_avance  numeric(5,2) check (pct_avance between 0 and 100),
  archivo     text,
  creado_por  uuid references public.perfiles(id),
  creado_en   timestamptz not null default now()
);

create table public.documentos (
  id          uuid primary key default gen_random_uuid(),
  obra_id     uuid not null references public.obras(id) on delete cascade,
  tipo        text not null default 'Otro',
  titulo      text not null,
  descripcion text default '',
  fecha       date,
  referencia  text default '',
  inversor_id uuid references public.inversores(id) on delete set null,
  unidad      text default '',
  archivo     text not null,
  creado_por  uuid references public.perfiles(id),
  creado_en   timestamptz not null default now(),
  categoria   text not null default 'Legales'
              check (categoria in ('Legales','Arquitectura','Presupuestos','Otros'))
);

create table public.fichas (
  obra_id          uuid primary key references public.obras(id) on delete cascade,
  descripcion      text default '',
  niveles          int,
  subsuelos        int,
  unidades         int,
  cocheras         int,
  sup_terreno      numeric(10,2),
  sup_cubierta     numeric(10,2),
  sup_semicubierta numeric(10,2),
  sup_descubierta  numeric(10,2),
  sup_comun        numeric(10,2),
  sup_vendible     numeric(10,2),
  inicio           date,
  fin_previsto     date,
  nota             text default '',
  actualizado_en   timestamptz not null default now()
);

create table public.analisis (
  obra_id            uuid primary key references public.obras(id) on delete cascade,
  costo_m2_base      numeric(12,2) not null default 0,
  coef_coch_ss       numeric(5,4) not null default 0.70,
  coef_coch_pb       numeric(5,4) not null default 0.40,
  coef_cubierta      numeric(5,4) not null default 1.00,
  coef_semicubierta  numeric(5,4) not null default 0.60,
  coef_comun         numeric(5,4) not null default 0.60,
  coef_terraza       numeric(5,4) not null default 0.40,
  costo_terreno      numeric(14,2) not null default 0,
  terreno_ancho      numeric(8,2),
  terreno_largo      numeric(8,2),
  plazo_meses        int,
  pct_proyecto       numeric(6,3) not null default 3.5,
  pct_direccion      numeric(6,3) not null default 9.0,
  pct_desarrollo     numeric(6,3) not null default 5.0,
  pct_administracion numeric(6,3) not null default 2.0,
  pct_comision       numeric(6,3) not null default 3.0,
  gastos_escritura   numeric(14,2) not null default 0,
  gastos_municipales numeric(14,2) not null default 0,
  zona               text default '',
  nota               text default '',
  actualizado_en     timestamptz not null default now()
);

create table public.proveedores (
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

create table public.pedidos (
  id         uuid primary key default gen_random_uuid(),
  obra_id    uuid not null references public.obras(id)  on delete cascade,
  rubro_id   uuid references public.rubros(id)          on delete set null,
  titulo     text not null,
  detalle    text default '',
  cuerpo     text default '',
  fecha      date not null default current_date,
  vence      date,
  estado     text not null default 'abierto'
             check (estado in ('abierto','adjudicado','desierto','cancelado')),
  creado_por uuid references public.perfiles(id),
  creado_en  timestamptz not null default now()
);

create table public.pedido_respuestas (
  id           uuid primary key default gen_random_uuid(),
  pedido_id    uuid not null references public.pedidos(id) on delete cascade,
  proveedor_id uuid references public.proveedores(id)      on delete set null,
  proveedor    text not null default '',
  enviado      boolean not null default false,
  respondio    boolean not null default false,
  moneda       text not null default 'USD' check (moneda in ('ARS','USD')),
  importe      numeric(14,2),
  cotizacion   numeric(14,4) not null default 1,
  usd          numeric(14,2) generated always as (
                 case when moneda = 'USD' then importe else importe / cotizacion end
               ) stored,
  plazo        text default '',
  adjudicado   boolean not null default false,
  nota         text default '',
  archivo      text,
  unique (pedido_id, proveedor_id)
);

create table public.enlaces (
  id            uuid primary key default gen_random_uuid(),
  token         text not null unique,
  obra_id       uuid not null references public.obras(id)      on delete cascade,
  inversor_id   uuid not null references public.inversores(id) on delete cascade,
  titulo        text default '',
  vence         date,
  activo        boolean not null default true,
  visitas       int not null default 0,
  ultima_visita timestamptz,
  creado_por    uuid references public.perfiles(id),
  creado_en     timestamptz not null default now()
);

create table public.auditoria (
  id          bigserial primary key,
  tabla       text not null,
  registro_id uuid,
  obra_id     uuid,
  accion      text not null check (accion in ('alta','cambio','baja')),
  antes       jsonb,
  despues     jsonb,
  usuario_id  uuid,
  usuario     text,
  cuando      timestamptz not null default now()
);

create table public.cierres (
  id          uuid primary key default gen_random_uuid(),
  obra_id     uuid not null references public.obras(id) on delete cascade,
  hasta       date not null,
  nota        text default '',
  cerrado_por uuid references public.perfiles(id),
  cerrado_en  timestamptz not null default now()
);


-- ---------------------------------------------------------------------
--  Índices (mismos nombres que en producción)
-- ---------------------------------------------------------------------
create index aportes_obra_id_inversor_id_idx   on public.aportes (obra_id, inversor_id);
create index aportes_unidad_idx                on public.aportes (obra_id, unidad) where unidad <> '';
create index auditoria_obra_idx                on public.auditoria (obra_id, cuando desc);
create index auditoria_registro_idx            on public.auditoria (tabla, registro_id, cuando desc);
create index avances_obra_id_fecha_idx         on public.avances (obra_id, fecha desc);
create index cierres_obra_idx                  on public.cierres (obra_id, hasta desc);
create index comprobantes_obra_id_fecha_idx    on public.comprobantes (obra_id, fecha desc);
create index comprobantes_obra_id_rubro_id_idx on public.comprobantes (obra_id, rubro_id);
create index comprobantes_obra_id_pago_idx     on public.comprobantes (obra_id, pago);
create index comprobantes_afecta_caja_idx      on public.comprobantes (obra_id, afecta_caja);
create index comprobantes_honorarios_idx       on public.comprobantes (obra_id) where computa_honorarios;
create index cuotas_venta_idx                  on public.cuotas (venta_id, numero);
create index cuotas_venc_idx                   on public.cuotas (vencimiento) where estado = 'pendiente';
create index documentos_obra_idx               on public.documentos (obra_id, tipo, fecha desc);
create index documentos_categoria_idx          on public.documentos (obra_id, categoria, fecha desc);
create index enlaces_token_idx                 on public.enlaces (token) where activo;
create index enlaces_obra_idx                  on public.enlaces (obra_id, inversor_id);
create index indices_periodo_idx               on public.indices (nombre, periodo desc);
create index niveles_obra_idx                  on public.niveles (obra_id, orden);
create index participaciones_obra_idx          on public.participaciones (obra_id);
create index pedidos_obra_idx                  on public.pedidos (obra_id, fecha desc);
create index proveedores_rubro_idx             on public.proveedores (rubro_id) where activo;
create index unidades_obra_idx                 on public.unidades (obra_id, orden);
create index unidades_inversor_idx             on public.unidades (inversor_id) where inversor_id is not null;
create index ventas_obra_idx                   on public.ventas (obra_id, fecha desc);
create index ventas_unidad_idx                 on public.ventas (obra_id, unidad) where unidad <> '';


-- ---------------------------------------------------------------------
--  Funciones
-- ---------------------------------------------------------------------
create or replace function public.crear_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, nombre)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', new.email));
  return new;
end $$;

create or replace function public.rol_actual()
returns text language sql stable security definer set search_path = public as $$
  select rol from public.perfiles where id = auth.uid()
$$;

create or replace function public.puede_editar()
returns boolean language sql stable as $$
  select public.rol_actual() in ('admin','carga')
$$;

create or replace function public.es_admin()
returns boolean language sql stable as $$
  select public.rol_actual() = 'admin'
$$;

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

create or replace function public.periodo_cerrado(p_obra uuid)
returns date language sql stable security definer set search_path = public as $$
  select max(hasta) from public.cierres where obra_id = p_obra
$$;

create or replace function public.proteger_cierre()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_obra  uuid := coalesce(NEW.obra_id, OLD.obra_id);
  v_hasta date := public.periodo_cerrado(v_obra);
  v_fecha date := least(coalesce(NEW.fecha, OLD.fecha), coalesce(OLD.fecha, NEW.fecha));
begin
  if v_hasta is not null and v_fecha <= v_hasta then
    raise exception 'El período hasta el % está cerrado. Para modificar este movimiento hay que reabrirlo.', v_hasta
      using errcode = 'check_violation';
  end if;
  return coalesce(NEW, OLD);
end $$;

create or replace function public.registrar_cambio()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_antes  jsonb := case when TG_OP = 'INSERT' then null else to_jsonb(OLD) end;
  v_desp   jsonb := case when TG_OP = 'DELETE' then null else to_jsonb(NEW) end;
  v_obra   uuid;
  v_nombre text;
begin
  v_obra := coalesce((v_desp->>'obra_id')::uuid, (v_antes->>'obra_id')::uuid);
  select nombre into v_nombre from public.perfiles where id = auth.uid();

  insert into public.auditoria (tabla, registro_id, obra_id, accion, antes, despues, usuario_id, usuario)
  values (
    TG_TABLE_NAME,
    coalesce((v_desp->>'id')::uuid, (v_antes->>'id')::uuid),
    v_obra,
    case TG_OP when 'INSERT' then 'alta' when 'UPDATE' then 'cambio' else 'baja' end,
    v_antes, v_desp, auth.uid(), coalesce(v_nombre, 'sistema')
  );
  return coalesce(NEW, OLD);
end $$;

create or replace function public.sumar_visita(p_enlace uuid)
returns void language sql security definer set search_path = public as $$
  update public.enlaces
  set visitas = visitas + 1, ultima_visita = now()
  where id = p_enlace
$$;

create or replace function public.nueva_obra(p_nombre text)
returns uuid language plpgsql set search_path = public as $$
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

create or replace function public.nueva_caja(p_obra uuid, p_nombre text, p_detalle text default '')
returns uuid language plpgsql set search_path = public as $$
declare v_id uuid;
begin
  insert into public.cajas (obra_id, nombre, detalle, orden)
  values (p_obra, p_nombre, p_detalle,
          coalesce((select max(orden) + 10 from public.cajas where obra_id = p_obra), 10))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.nuevo_rubro(
  p_nombre text, p_grupo text default 'Otros', p_base boolean default true)
returns uuid language plpgsql set search_path = public as $$
declare v_id uuid;
begin
  insert into public.rubros (nombre, grupo, base_honorarios, orden)
  values (p_nombre, p_grupo, p_base,
          coalesce((select max(orden) + 1 from public.rubros where grupo = p_grupo),
                   (select max(orden) + 10 from public.rubros)))
  returning id into v_id;
  return v_id;
end $$;


-- ---------------------------------------------------------------------
--  Disparadores
-- ---------------------------------------------------------------------
create trigger al_crear_usuario after insert on auth.users
  for each row execute function public.crear_perfil();

create trigger auditar after insert or update or delete on public.aportes         for each row execute function public.registrar_cambio();
create trigger auditar after insert or update or delete on public.comprobantes    for each row execute function public.registrar_cambio();
create trigger auditar after insert or update or delete on public.cuotas          for each row execute function public.registrar_cambio();
create trigger auditar after insert or update or delete on public.documentos      for each row execute function public.registrar_cambio();
create trigger auditar after insert or update or delete on public.enlaces         for each row execute function public.registrar_cambio();
create trigger auditar after insert or update or delete on public.inversores      for each row execute function public.registrar_cambio();
create trigger auditar after insert or update or delete on public.obras           for each row execute function public.registrar_cambio();
create trigger auditar after insert or update or delete on public.participaciones for each row execute function public.registrar_cambio();
create trigger auditar after insert or update or delete on public.pedidos         for each row execute function public.registrar_cambio();
create trigger auditar after insert or update or delete on public.unidades        for each row execute function public.registrar_cambio();
create trigger auditar after insert or update or delete on public.ventas          for each row execute function public.registrar_cambio();

create trigger proteger before insert or update or delete on public.aportes      for each row execute function public.proteger_cierre();
create trigger proteger before insert or update or delete on public.comprobantes for each row execute function public.proteger_cierre();
create trigger proteger before insert or update or delete on public.ventas       for each row execute function public.proteger_cierre();


-- ---------------------------------------------------------------------
--  Vistas (definiciones de producción)
-- ---------------------------------------------------------------------
create view public.v_rubros as
select obra_id, rubro_id,
  sum(usd) filter (where afecta_caja)                          as ejecutado,
  sum(usd) filter (where pago = 'pagado' and afecta_caja)      as pagado,
  sum(usd) filter (where pago = 'pendiente' and afecta_caja)   as adeudado,
  sum(usd) filter (where not afecta_caja)                      as solo_informativo
from public.comprobantes c
group by obra_id, rubro_id;

create view public.v_honorarios as
select o.id as obra_id,
  coalesce(b.base, 0)                               as base_ejecutada,
  coalesce(b.base, 0) * o.pct_conduccion     / 100  as conduccion_devengada,
  coalesce(b.base, 0) * o.pct_administracion / 100  as administracion_devengada,
  coalesce(b.base, 0) * o.pct_desarrolladora / 100  as desarrolladora_devengada
from public.obras o
left join (
  select c.obra_id, sum(c.usd) as base
  from public.comprobantes c
  join public.rubros r on r.id = c.rubro_id
  where r.base_honorarios and c.afecta_caja and c.computa_honorarios
  group by c.obra_id
) b on b.obra_id = o.id;

create view public.v_proveedores as
select obra_id, proveedor,
  max(cuit)                                                        as cuit,
  sum(usd) filter (where afecta_caja)                              as comprado,
  sum(usd) filter (where pago = 'pagado' and afecta_caja)          as pagado,
  sum(usd) filter (where pago = 'pendiente' and afecta_caja)       as adeudado,
  min(fecha) filter (where pago = 'pendiente' and afecta_caja)     as pendiente_mas_antiguo
from public.comprobantes c
group by obra_id, proveedor;

create view public.v_inversores as
with u as (
  select a.obra_id, a.inversor_id,
    sum(a.usd) filter (where a.clase = 'A')  as capital_a,
    sum(a.usd) filter (where a.clase = 'B')  as capital_b,
    sum(a.usd)                               as capital,
    sum(a.usd * coalesce(cl.coeficiente, 1)) as unidades
  from public.aportes a
  left join public.clases cl on cl.obra_id = a.obra_id and cl.letra = a.clase
  group by a.obra_id, a.inversor_id
)
select u.obra_id, u.inversor_id, i.nombre,
  coalesce(u.capital_a, 0) as capital_a,
  coalesce(u.capital_b, 0) as capital_b,
  u.capital, u.unidades,
  round(100 * u.unidades / nullif(sum(u.unidades) over (partition by u.obra_id), 0), 4) as participacion
from u
join public.inversores i on i.id = u.inversor_id;

create view public.v_obras as
select o.id as obra_id, o.nombre,
  coalesce((select sum(a.usd) from public.aportes a where a.obra_id = o.id), 0) as aportes,
  coalesce((select sum(c.usd) from public.comprobantes c where c.obra_id = o.id and c.afecta_caja), 0) as ejecutado,
  coalesce((select sum(c.usd) from public.comprobantes c where c.obra_id = o.id and c.pago = 'pagado' and c.afecta_caja), 0) as pagado,
  coalesce((select sum(c.usd) from public.comprobantes c where c.obra_id = o.id and c.pago = 'pendiente' and c.afecta_caja), 0) as deuda,
  coalesce((select sum(c.usd) from public.comprobantes c where c.obra_id = o.id and not c.afecta_caja), 0) as solo_informativo,
  coalesce((select sum(p.monto_usd) from public.presupuestos p where p.obra_id = o.id), 0) as presupuesto
from public.obras o;

create view public.v_iva as
select obra_id, to_char(fecha, 'YYYY-MM') as periodo, tipo,
  count(*) as comprobantes, sum(neto) as neto, sum(iva) as iva,
  sum(percepciones) as percepciones, sum(importe) as total,
  sum(importe - neto - iva - percepciones) as sin_discriminar
from public.comprobantes c
where afecta_caja
group by obra_id, to_char(fecha, 'YYYY-MM'), tipo;

create view public.v_ventas as
select obra_id, to_char(fecha, 'YYYY-MM') as periodo, tipo,
  count(*) as comprobantes, sum(neto) as neto, sum(iva) as iva,
  sum(percepciones) as percepciones, sum(importe) as total,
  sum(usd) as total_usd,
  sum(usd) filter (where cobro = 'pendiente') as por_cobrar
from public.ventas v
group by obra_id, to_char(fecha, 'YYYY-MM'), tipo;

create view public.v_cuotas as
with ultimo as (
  select valor from public.indices
  where nombre = 'CAC' and valor is not null
  order by periodo desc limit 1
)
select c.id, v.obra_id, c.venta_id, v.cliente, v.unidad, c.numero, c.vencimiento,
  c.moneda, c.monto_base,
  case
    when c.estado = 'cobrada' then c.monto_cobrado
    when v.modalidad = 'cuotas_cac' and v.indice_base > 0
      then c.monto_base * coalesce((select valor from ultimo), v.indice_base) / v.indice_base
    else c.monto_base
  end as monto_actual,
  c.estado, c.fecha_cobro,
  case when c.estado = 'pendiente' and c.vencimiento < current_date
       then current_date - c.vencimiento else 0 end as dias_vencida
from public.cuotas c
join public.ventas v on v.id = c.venta_id;

create view public.v_superficies as
select obra_id,
  coalesce(sup_cubierta, 0)     as cubierta,
  coalesce(sup_semicubierta, 0) as semicubierta,
  coalesce(sup_comun, 0)        as comun,
  coalesce(sup_vendible, 0)     as vendible,
  coalesce(sup_cubierta, 0) + coalesce(sup_semicubierta, 0) * 0.5 as computable,
  coalesce(sup_cubierta, 0) + coalesce(sup_semicubierta, 0) * 0.5 + coalesce(sup_comun, 0) as total_construida
from public.fichas f;

create view public.v_analisis as
with sup as (
  select n.obra_id,
    sum(n.coch_ss) as coch_ss, sum(n.coch_pb) as coch_pb,
    sum(n.cubierta) as cubierta, sum(n.semicubierta) as semicubierta,
    sum(n.comun) as comun, sum(n.terraza) as terraza,
    sum(n.unidades) as unidades
  from public.niveles n
  group by n.obra_id
),
costo as (
  select s.obra_id, s.coch_ss, s.coch_pb, s.cubierta, s.semicubierta, s.comun, s.terraza, s.unidades,
    a.costo_m2_base, a.costo_terreno,
    s.coch_ss      * a.costo_m2_base * a.coef_coch_ss      as c_coch_ss,
    s.coch_pb      * a.costo_m2_base * a.coef_coch_pb      as c_coch_pb,
    s.cubierta     * a.costo_m2_base * a.coef_cubierta     as c_cubierta,
    s.semicubierta * a.costo_m2_base * a.coef_semicubierta as c_semicubierta,
    s.comun        * a.costo_m2_base * a.coef_comun        as c_comun,
    s.terraza      * a.costo_m2_base * a.coef_terraza      as c_terraza,
    a.pct_proyecto, a.pct_direccion, a.pct_desarrollo, a.pct_administracion, a.pct_comision,
    a.gastos_escritura, a.gastos_municipales
  from sup s
  join public.analisis a on a.obra_id = s.obra_id
)
select obra_id,
  cubierta + semicubierta                         as vendible,
  comun + terraza                                 as comun_total,
  cubierta + semicubierta + comun + terraza       as total_m2,
  unidades,
  c_coch_ss + c_coch_pb + c_cubierta + c_semicubierta + c_comun + c_terraza as construccion_neto,
  costo_terreno,
  gastos_escritura + gastos_municipales           as gastos_fijos,
  costo_terreno * pct_comision / 100              as comision,
  (c_coch_ss + c_coch_pb + c_cubierta + c_semicubierta + c_comun + c_terraza)
    * (pct_proyecto + pct_direccion + pct_desarrollo + pct_administracion) / 100 as honorarios,
  (c_coch_ss + c_coch_pb + c_cubierta + c_semicubierta + c_comun + c_terraza)
    * (1 + (pct_proyecto + pct_direccion + pct_desarrollo + pct_administracion) / 100)
    + costo_terreno * (1 + pct_comision / 100)
    + gastos_escritura + gastos_municipales       as costo_total
from costo c;

create view public.v_unidades as
with base as (
  select u.*,
    u.sup_cubierta + u.sup_semicubierta + u.sup_comun                 as superficie,
    (u.sup_cubierta + u.sup_semicubierta + u.sup_comun) * u.coeficiente as ponderada
  from public.unidades u
)
select b.id, b.obra_id, b.codigo, b.tipo, b.piso, b.superficie, b.coeficiente, b.ponderada,
  round(100 * b.ponderada / nullif(sum(b.ponderada) over (partition by b.obra_id), 0), 4) as porcentual,
  b.estado, b.inversor_id, i.nombre as inversor, b.venta_id, v.cliente as comprador, b.precio_lista
from base b
left join public.inversores i on i.id = b.inversor_id
left join public.ventas     v on v.id = b.venta_id;


-- ---------------------------------------------------------------------
--  Seguridad a nivel de fila (tal como está en producción)
-- ---------------------------------------------------------------------
alter table public.perfiles          enable row level security;
alter table public.obras             enable row level security;
alter table public.clases            enable row level security;
alter table public.rubros            enable row level security;
alter table public.presupuestos      enable row level security;
alter table public.cajas             enable row level security;
alter table public.inversores        enable row level security;
alter table public.participaciones   enable row level security;
alter table public.aportes           enable row level security;
alter table public.comprobantes      enable row level security;
alter table public.ventas            enable row level security;
alter table public.avances           enable row level security;
alter table public.documentos        enable row level security;
alter table public.fichas            enable row level security;
alter table public.analisis          enable row level security;
alter table public.niveles           enable row level security;
alter table public.proveedores       enable row level security;
alter table public.pedidos           enable row level security;
alter table public.pedido_respuestas enable row level security;
alter table public.indices           enable row level security;
alter table public.cuotas            enable row level security;
alter table public.auditoria         enable row level security;
alter table public.cierres           enable row level security;
alter table public.enlaces           enable row level security;
alter table public.unidades          enable row level security;

create policy perfil_propio on public.perfiles for select using (id = auth.uid() or public.es_admin());
create policy perfil_edita  on public.perfiles for update using (public.es_admin()) with check (public.es_admin());

create policy obras_ver    on public.obras for select using (public.obra_visible(id));
create policy obras_crear  on public.obras for insert with check (public.puede_editar());
create policy obras_editar on public.obras for update using (public.puede_editar());
create policy obras_borrar on public.obras for delete using (public.es_admin());

create policy rubros_ver    on public.rubros for select using (auth.uid() is not null);
create policy rubros_editar on public.rubros for all using (public.puede_editar()) with check (public.puede_editar());

create policy prov_ver    on public.proveedores for select using (auth.uid() is not null);
create policy prov_editar on public.proveedores for all using (public.puede_editar()) with check (public.puede_editar());

create policy clases_ver    on public.clases for select using (public.obra_visible(obra_id));
create policy clases_editar on public.clases for all using (public.puede_editar()) with check (public.puede_editar());

create policy cajas_ver    on public.cajas for select using (public.obra_visible(obra_id));
create policy cajas_editar on public.cajas for all using (public.puede_editar()) with check (public.puede_editar());

create policy presu_ver    on public.presupuestos for select using (public.obra_visible(obra_id));
create policy presu_editar on public.presupuestos for all using (public.puede_editar()) with check (public.puede_editar());

create policy ficha_ver    on public.fichas for select using (public.obra_visible(obra_id));
create policy ficha_editar on public.fichas for all using (public.puede_editar()) with check (public.puede_editar());

create policy analisis_ver    on public.analisis for select using (public.obra_visible(obra_id));
create policy analisis_editar on public.analisis for all using (public.puede_editar()) with check (public.puede_editar());

create policy nivel_ver    on public.niveles for select using (public.obra_visible(obra_id));
create policy nivel_editar on public.niveles for all using (public.puede_editar()) with check (public.puede_editar());

create policy avance_ver    on public.avances for select using (public.obra_visible(obra_id));
create policy avance_crear  on public.avances for insert with check (public.puede_editar());
create policy avance_editar on public.avances for update using (public.puede_editar());
create policy avance_borrar on public.avances for delete using (public.es_admin());

create policy venta_ver    on public.ventas for select using (public.obra_visible(obra_id));
create policy venta_crear  on public.ventas for insert with check (public.puede_editar());
create policy venta_editar on public.ventas for update using (public.puede_editar());
create policy venta_borrar on public.ventas for delete using (public.es_admin());

create policy comp_ver    on public.comprobantes for select using (public.obra_visible(obra_id));
create policy comp_crear  on public.comprobantes for insert with check (public.puede_editar());
create policy comp_editar on public.comprobantes for update using (public.puede_editar());
create policy comp_borrar on public.comprobantes for delete using (public.es_admin());

create policy pedido_ver    on public.pedidos for select using (public.obra_visible(obra_id));
create policy pedido_editar on public.pedidos for all using (public.puede_editar()) with check (public.puede_editar());

create policy resp_ver on public.pedido_respuestas for select using (
  exists (select 1 from public.pedidos p where p.id = pedido_respuestas.pedido_id and public.obra_visible(p.obra_id)));
create policy resp_editar on public.pedido_respuestas for all using (public.puede_editar()) with check (public.puede_editar());

create policy cierre_ver    on public.cierres for select using (public.obra_visible(obra_id));
create policy cierre_crear  on public.cierres for insert with check (public.es_admin());
create policy cierre_borrar on public.cierres for delete using (public.es_admin());

create policy inv_ver    on public.inversores for select using (public.puede_editar() or perfil_id = auth.uid());
create policy inv_editar on public.inversores for all using (public.puede_editar()) with check (public.puede_editar());

create policy part_ver on public.participaciones for select using (
  public.obra_visible(obra_id)
  or exists (select 1 from public.inversores i where i.id = participaciones.inversor_id and i.perfil_id = auth.uid()));
create policy part_editar on public.participaciones for all using (public.puede_editar()) with check (public.puede_editar());

create policy aportes_ver on public.aportes for select using (
  public.puede_editar()
  or exists (select 1 from public.inversores i where i.id = aportes.inversor_id and i.perfil_id = auth.uid()));
create policy aportes_crear  on public.aportes for insert with check (public.puede_editar());
create policy aportes_editar on public.aportes for update using (public.puede_editar());
create policy aportes_borrar on public.aportes for delete using (public.es_admin());

create policy doc_ver on public.documentos for select using (
  public.obra_visible(obra_id)
  and (inversor_id is null or public.puede_editar()
       or exists (select 1 from public.inversores i where i.id = documentos.inversor_id and i.perfil_id = auth.uid())));
create policy doc_crear  on public.documentos for insert with check (public.puede_editar());
create policy doc_editar on public.documentos for update using (public.puede_editar());
create policy doc_borrar on public.documentos for delete using (public.es_admin());

create policy indice_ver    on public.indices for select using (auth.uid() is not null);
create policy indice_editar on public.indices for all using (public.puede_editar()) with check (public.puede_editar());

create policy cuota_ver on public.cuotas for select using (
  exists (select 1 from public.ventas v where v.id = cuotas.venta_id and public.obra_visible(v.obra_id)));
create policy cuota_editar on public.cuotas for all using (public.puede_editar()) with check (public.puede_editar());

create policy audit_ver  on public.auditoria for select using (public.puede_editar());
create policy audit_alta on public.auditoria for insert with check (true);

create policy enlace_ver    on public.enlaces for select using (public.puede_editar());
create policy enlace_editar on public.enlaces for all using (public.puede_editar()) with check (public.puede_editar());

create policy unidad_ver on public.unidades for select using (
  public.obra_visible(obra_id)
  or exists (select 1 from public.inversores i where i.id = unidades.inversor_id and i.perfil_id = auth.uid()));
create policy unidad_editar on public.unidades for all using (public.puede_editar()) with check (public.puede_editar());


-- ---------------------------------------------------------------------
--  Archivos
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values
  ('comprobantes','comprobantes',false),
  ('avance','avance',false),
  ('documentos','documentos',false)
on conflict (id) do nothing;

create policy archivos_ver on storage.objects for select
  using (bucket_id in ('comprobantes','avance','documentos') and auth.uid() is not null);
create policy archivos_subir on storage.objects for insert
  with check (bucket_id in ('comprobantes','avance','documentos') and public.puede_editar());
create policy archivos_borrar on storage.objects for delete
  using (bucket_id in ('comprobantes','avance','documentos') and public.es_admin());


-- ---------------------------------------------------------------------
--  Permisos (tal como están en producción)
-- ---------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
