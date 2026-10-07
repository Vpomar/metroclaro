-- =====================================================================
--  Datos ficticios para staging y desarrollo local. NUNCA en producción.
--
--  Obra Demo Norte: inversores A y C.  Obra Demo Sur: inversores B y C.
--  Un documento reservado para C en Norte, para probar la visibilidad.
--
--  Los usuarios de prueba se crean desde el panel de Supabase
--  (Authentication → Users) y después se vinculan con:
--    update public.perfiles set rol = 'admin' where id = (select id from auth.users where email = 'admin@metroclaro.test');
--    update public.inversores set perfil_id = (select id from auth.users where email = 'inversor.a@metroclaro.test')
--      where nombre = 'Inversor Prueba A';
-- =====================================================================
do $$
declare
  norte uuid; sur uuid; ia uuid; ib uuid; ic uuid;
  r_terr uuid; r_est uuid; r_imp uuid; c_norte uuid; c_sur uuid;
begin
  insert into public.rubros (grupo, nombre, base_honorarios, orden) values
    ('Previo','Terreno y escrituración',false,10),('Previo','Impuestos, tasas y permisos',false,20),
    ('Honorarios','Honorarios de proyecto',false,30),('Honorarios','Honorarios de conducción técnica',false,40),
    ('Honorarios','Administración de obra',false,50),('Honorarios','Honorarios de desarrolladora',false,55),
    ('Obra gruesa','Estructura',true,80),('Obra gruesa','Mampostería',true,90),
    ('Instalaciones','Electricidad',true,110),('Cierre','Terminaciones',true,150);
  select id into r_terr from public.rubros where nombre = 'Terreno y escrituración';
  select id into r_est  from public.rubros where nombre = 'Estructura';
  select id into r_imp  from public.rubros where nombre = 'Impuestos, tasas y permisos';

  norte := public.nueva_obra('Obra Demo Norte');
  sur   := public.nueva_obra('Obra Demo Sur');
  update public.obras set pct_conduccion = 10, pct_administracion = 3 where id in (norte, sur);
  select id into c_norte from public.cajas where obra_id = norte and nombre = 'Banco';
  select id into c_sur   from public.cajas where obra_id = sur   and nombre = 'Banco';

  insert into public.inversores (nombre, cuit, email) values ('Inversor Prueba A','20-11111111-1','a@ejemplo.test') returning id into ia;
  insert into public.inversores (nombre, cuit, email) values ('Inversor Prueba B','20-22222222-2','b@ejemplo.test') returning id into ib;
  insert into public.inversores (nombre, cuit, email) values ('Inversor Prueba C','20-33333333-3','c@ejemplo.test') returning id into ic;

  insert into public.participaciones (obra_id, inversor_id, comp_a, comp_b) values
    (norte, ia, 50000, 0), (norte, ic, 30000, 0), (sur, ib, 40000, 0), (sur, ic, 20000, 0);

  insert into public.aportes (obra_id, inversor_id, caja_id, clase, fecha, moneda, importe) values
    (norte, ia, c_norte, 'A', '2026-08-01', 'USD', 25000),
    (norte, ic, c_norte, 'A', '2026-08-05', 'USD', 15000),
    (sur,   ib, c_sur,   'A', '2026-08-02', 'USD', 20000),
    (sur,   ic, c_sur,   'A', '2026-08-06', 'USD', 10000);

  insert into public.comprobantes (obra_id, caja_id, rubro_id, fecha, proveedor, cuit, tipo, moneda, importe, cotizacion, pago, fecha_pago) values
    (norte, c_norte, r_terr, '2026-08-10', 'Escribanía Demo', '30-44444444-4', 'Factura A', 'USD', 18000, 1, 'pagado', '2026-08-10'),
    (norte, c_norte, r_est,  '2026-09-01', 'Hormigones Demo SA', '30-55555555-5', 'Factura A', 'ARS', 1500000, 1500, 'pendiente', null),
    (sur,   c_sur,   r_imp,  '2026-08-20', 'Municipalidad Demo', '', 'Recibo', 'ARS', 300000, 1500, 'pagado', '2026-08-20');

  insert into public.proveedores (nombre, cuit, email, telefono, rubro_id) values
    ('Hormigones Demo SA','30-55555555-5','ventas@hormigones.test','0341-5555555', r_est),
    ('Escribanía Demo','30-44444444-4','escribania@demo.test','0341-4444444', r_terr);

  insert into public.documentos (obra_id, categoria, tipo, titulo, archivo, inversor_id) values
    (norte, 'Legales', 'Contrato de fideicomiso', 'Contrato Demo Norte', 'documentos/' || norte || '/contrato.pdf', null),
    (norte, 'Legales', 'Boleto', 'Boleto reservado de C', 'documentos/' || norte || '/boleto-c.pdf', ic);

  -- Solo los metadatos: alcanzan para probar las políticas de archivos.
  insert into storage.objects (bucket_id, name, metadata) values
    ('documentos', norte || '/contrato.pdf', '{"mimetype":"application/pdf","size":1}'),
    ('documentos', norte || '/boleto-c.pdf', '{"mimetype":"application/pdf","size":1}'),
    ('comprobantes', sur || '/factura-sur.jpg', '{"mimetype":"image/jpeg","size":1}');

  insert into public.indices (nombre, periodo, variacion) values ('CAC', '2026-08', 4.0);
end $$;
