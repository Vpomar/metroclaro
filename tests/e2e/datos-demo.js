// Datos ficticios con la forma de las tablas de Supabase, para dibujar la
// app sin iniciar sesión ni tocar la red (ver responsive.spec.js). Los
// textos son a propósito largos: si algo se desborda en un celular, que se
// desborde acá.

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let sec = 1;
const nuevo = () => id(sec++);

export function datosDemo() {
  sec = 1;
  const obras = [
    { id: nuevo(), nombre: 'Edificio Bv. Oroño 1450', descripcion: 'Viviendas', pct_conduccion: 10,
      pct_administracion: 3, pct_desarrolladora: 5, activa: true, creado_en: '2026-01-10T12:00:00Z' },
    { id: nuevo(), nombre: 'Dúplex Fisherton', descripcion: '', pct_conduccion: 8,
      pct_administracion: 3, pct_desarrolladora: 0, activa: true, creado_en: '2026-03-01T12:00:00Z' }
  ];
  const [norte, sur] = obras.map((o) => o.id);

  const nombresRubros = [
    ['Previo', 'Terreno y escrituración', false], ['Previo', 'Impuestos, tasas y permisos', false],
    ['Honorarios', 'Honorarios de proyecto', false], ['Honorarios', 'Honorarios de conducción técnica', false],
    ['Honorarios', 'Administración de obra', false], ['Honorarios', 'Honorarios de desarrolladora', false],
    ['Obra gruesa', 'Estructura', true], ['Obra gruesa', 'Mampostería', true],
    ['Instalaciones', 'Electricidad', true], ['Instalaciones', 'Instalación sanitaria y gas', true],
    ['Cierre', 'Terminaciones', true]
  ];
  const rubros = nombresRubros.map(([grupo, nombre, base], i) =>
    ({ id: nuevo(), grupo, nombre, base_honorarios: base, activo: true, orden: (i + 1) * 10 }));
  const rubro = (n) => rubros.find((r) => r.nombre === n).id;

  const cajas = [];
  const clases = [];
  for (const o of [norte, sur]) {
    ['Banco', 'Efectivo pesos', 'Efectivo dólares'].forEach((nombre, i) =>
      cajas.push({ id: nuevo(), obra_id: o, nombre, detalle: '', activa: true, orden: i }));
    ['A', 'B'].forEach((letra) =>
      clases.push({ id: nuevo(), obra_id: o, letra, nombre: `Clase ${letra}`, coeficiente: 1 }));
  }
  const caja = (o, n = 'Banco') => cajas.find((c) => c.obra_id === o && c.nombre === n).id;

  const presupuestos = rubros.slice(6).flatMap((r, i) => [
    { obra_id: norte, rubro_id: r.id, monto_usd: 40000 + i * 15000 },
    { obra_id: sur, rubro_id: r.id, monto_usd: 15000 + i * 5000 }
  ]);

  const inversores = [
    'María Fernanda Gutiérrez Castellanos', 'Inversiones del Litoral SRL',
    'Juan Pablo Rossi', 'Fideicomiso Familia Bertolini'
  ].map((nombre, i) => ({ id: nuevo(), nombre, cuit: `20-${30000000 + i}-1`,
    email: `inversor${i}@ejemplo.test`, perfil_id: null, comp_a: 0, comp_b: 0 }));
  const inv = inversores.map((i) => i.id);

  const participaciones = [
    [norte, inv[0], 120000, 20000], [norte, inv[1], 250000, 0], [norte, inv[2], 60000, 15000],
    [sur, inv[2], 40000, 0], [sur, inv[3], 90000, 0]
  ].map(([obra_id, inversor_id, comp_a, comp_b]) =>
    ({ id: nuevo(), obra_id, inversor_id, comp_a, comp_b, nota: '', creado_en: '2026-01-10T12:00:00Z' }));

  const aportes = [];
  participaciones.forEach((p, i) => {
    for (let m = 1; m <= 3; m++) {
      const ars = (i + m) % 3 === 0;
      aportes.push({ id: nuevo(), obra_id: p.obra_id, inversor_id: p.inversor_id,
        caja_id: caja(p.obra_id, ars ? 'Efectivo pesos' : 'Banco'), clase: 'A',
        fecha: `2026-0${m + 2}-0${m + 1}`, moneda: ars ? 'ARS' : 'USD',
        importe: ars ? 18000000 : p.comp_a / 6, cotizacion: ars ? 1200 : 1,
        usd: ars ? 15000 : p.comp_a / 6, nota: '', creado_por: null,
        creado_en: '2026-03-01T12:00:00Z', unidad: null, unidad_id: null });
    }
  });

  const proveedoresNombres = [
    ['Hormigones Elaborados del Paraná SA', 'Estructura'], ['Escribanía Martínez & Asociados', 'Terreno y escrituración'],
    ['Corralón San Martín', 'Mampostería'], ['Electricidad Integral Rosario', 'Electricidad'],
    ['Municipalidad de Rosario', 'Impuestos, tasas y permisos']
  ];
  const proveedores = proveedoresNombres.map(([nombre, r]) => ({ id: nuevo(), nombre,
    cuit: '30-71234567-8', email: 'contacto@proveedor-de-ejemplo.test', telefono: '0341 155 123456',
    rubro_id: rubro(r), contacto: 'Responsable de ventas', nota: '', activo: true,
    creado_en: '2026-01-10T12:00:00Z' }));

  const comprobantes = [];
  [norte, norte, norte, sur].forEach((o, k) => {
    proveedoresNombres.forEach(([prov, r], i) => {
      const ars = (i + k) % 2 === 0;
      const importe = ars ? 2500000 + i * 730000 : 3200 + i * 1100;
      comprobantes.push({ id: nuevo(), obra_id: o, caja_id: caja(o), rubro_id: rubro(r),
        fecha: `2026-0${3 + k}-${String(5 + i * 4).padStart(2, '0')}`, proveedor: prov,
        cuit: '30-71234567-8', tipo: 'Factura A', numero: `0003-000${1200 + i + k * 10}`,
        detalle: 'Certificado de avance mensual con materiales y mano de obra incluidos',
        moneda: ars ? 'ARS' : 'USD', importe, cotizacion: ars ? 1250 : 1,
        usd: ars ? importe / 1250 : importe, pago: i % 3 === 0 ? 'pendiente' : 'pagado',
        fecha_pago: i % 3 === 0 ? null : `2026-0${3 + k}-20`, archivo: null, creado_por: null,
        creado_en: '2026-03-01T12:00:00Z', afecta_caja: true, neto: null, iva: null,
        percepciones: null, computa_honorarios: true });
    });
  });

  const avances = [
    { id: nuevo(), obra_id: norte, fecha: '2026-05-30', titulo: 'Hormigonado losa del 3er piso',
      descripcion: 'Se completó el hormigonado y el desencofrado de la losa.', pct_avance: 35,
      archivo: null, creado_por: null, creado_en: '2026-05-30T12:00:00Z' },
    { id: nuevo(), obra_id: norte, fecha: '2026-04-15', titulo: 'Excavación y bases',
      descripcion: '', pct_avance: 15, archivo: null, creado_por: null, creado_en: '2026-04-15T12:00:00Z' }
  ];

  const documentos = [
    { id: nuevo(), obra_id: norte, categoria: 'Legales', tipo: 'Contrato de fideicomiso',
      titulo: 'Contrato de fideicomiso de administración y construcción al costo', descripcion: '',
      fecha: '2026-01-10', referencia: '', inversor_id: null, unidad: null,
      archivo: `documentos/${norte}/contrato.pdf`, creado_por: null, creado_en: '2026-01-10T12:00:00Z' },
    { id: nuevo(), obra_id: norte, categoria: 'Planos', tipo: 'Plano municipal', titulo: 'Planos aprobados',
      descripcion: '', fecha: '2026-02-01', referencia: 'Expte. 12345/26', inversor_id: null, unidad: null,
      archivo: `documentos/${norte}/planos.pdf`, creado_por: null, creado_en: '2026-02-01T12:00:00Z' }
  ];

  const cierres = [{ id: nuevo(), obra_id: norte, hasta: '2026-03-31', nota: 'Cierre del primer trimestre',
    cerrado_por: null, cerrado_en: '2026-04-05T12:00:00Z' }];

  const niveles = ['Subsuelo', 'Planta baja', '1º piso', '2º piso', '3º piso'].map((nombre, i) => ({
    id: nuevo(), obra_id: norte, orden: i, nombre, coch_ss: i === 0 ? 300 : 0, coch_pb: i === 1 ? 80 : 0,
    cubierta: i > 0 ? 220 : 0, semicubierta: i > 1 ? 30 : 0, comun: 25, terraza: i === 4 ? 60 : 0,
    unidades: i > 1 ? 4 : 0, nota: '' }));

  const ventas = [
    { id: nuevo(), obra_id: norte, fecha: '2026-04-10', tipo: 'Boleto', numero: '001', cae: null,
      cae_vence: null, cliente: 'Lucía Benítez y Martín Acosta', cuit: '27-28123456-4', inversor_id: null,
      unidad: '2º A', concepto: 'Departamento 2 dormitorios con cochera', moneda: 'USD', importe: 145000,
      neto: null, iva: null, percepciones: null, cotizacion: 1, usd: 145000, cobro: 'pendiente',
      fecha_cobro: null, caja_id: caja(norte), archivo: null, nota: '', creado_por: null,
      creado_en: '2026-04-10T12:00:00Z', modalidad: 'cuotas', anticipo: 45000, cuotas_cantidad: 6,
      periodo_base: '2026-03', indice_base: 100, unidad_id: null },
    { id: nuevo(), obra_id: norte, fecha: '2026-05-02', tipo: 'Factura B', numero: '0002-00000045',
      cae: '76123456789012', cae_vence: '2026-05-12', cliente: 'Cochera Pérez', cuit: '20-20123456-3',
      inversor_id: null, unidad: 'Cochera 4', concepto: 'Cochera', moneda: 'ARS', importe: 24000000,
      neto: 19834711, iva: 4165289, percepciones: 0, cotizacion: 1200, usd: 20000, cobro: 'cobrado',
      fecha_cobro: '2026-05-05', caja_id: caja(norte), archivo: null, nota: '', creado_por: null,
      creado_en: '2026-05-02T12:00:00Z', modalidad: 'contado', anticipo: null, cuotas_cantidad: null,
      periodo_base: null, indice_base: null, unidad_id: null }
  ];
  const cuotas = Array.from({ length: 6 }, (_, i) => ({ id: nuevo(), venta_id: ventas[0].id, numero: i + 1,
    vencimiento: `2026-${String(5 + i).padStart(2, '0')}-10`, monto_base: 100000 / 6, moneda: 'USD',
    estado: i < 2 ? 'cobrada' : 'pendiente', fecha_cobro: i < 2 ? `2026-0${5 + i}-09` : null,
    monto_cobrado: i < 2 ? 17100 : null, cotizacion: 1, indice_cobro: i < 2 ? 104 : null,
    caja_id: caja(norte), nota: '', creado_en: '2026-04-10T12:00:00Z' }));

  const unidades = ['1º A', '1º B', '2º A', '2º B', 'Cochera 4'].map((codigo, i) => ({
    id: nuevo(), obra_id: norte, nivel_id: niveles[Math.min(i + 2, 4)].id, codigo,
    tipo: codigo.startsWith('Cochera') ? 'Cochera' : 'Departamento', piso: i + 1, orden: i,
    sup_cubierta: 65, sup_semicubierta: 8, sup_comun: 12, coeficiente: 0.05,
    estado: i === 2 ? 'vendida' : i === 0 ? 'asignada' : 'disponible',
    inversor_id: i === 0 ? inv[0] : null, venta_id: i === 2 ? ventas[0].id : null,
    precio_lista: 140000, nota: '', creado_en: '2026-01-10T12:00:00Z' }));

  const fichas = [{ obra_id: norte, descripcion: 'Edificio de 4 pisos con 16 departamentos y cocheras',
    niveles: 5, subsuelos: 1, unidades: 16, cocheras: 12, sup_terreno: 450, sup_cubierta: 1180,
    sup_semicubierta: 90, sup_descubierta: 60, sup_comun: 125, sup_vendible: 1050,
    inicio: '2026-03-01', fin_previsto: '2027-12-31', nota: '', actualizado_en: '2026-03-01T12:00:00Z' }];

  const analisis = [{ obra_id: norte, costo_m2_base: 950, coef_coch_ss: 0.5, coef_coch_pb: 0.5,
    coef_cubierta: 1, coef_semicubierta: 0.5, coef_comun: 1, coef_terraza: 0.3, costo_terreno: 280000,
    terreno_ancho: 15, terreno_largo: 30, plazo_meses: 24, pct_proyecto: 4, pct_direccion: 6,
    pct_desarrollo: 5, pct_administracion: 3, pct_comision: 3, gastos_escritura: 2,
    gastos_municipales: 1.5, zona: 'Centro', nota: '', actualizado_en: '2026-03-01T12:00:00Z' }];

  const pedidos = [{ id: nuevo(), obra_id: norte, rubro_id: rubro('Electricidad'),
    titulo: 'Instalación eléctrica completa', detalle: 'Según planos', cuerpo: '', fecha: '2026-05-01',
    vence: '2026-05-20', estado: 'abierto', creado_por: null, creado_en: '2026-05-01T12:00:00Z' }];
  const respuestas = [{ id: nuevo(), pedido_id: pedidos[0].id, proveedor_id: proveedores[3].id,
    proveedor: proveedores[3].nombre, enviado: true, respondio: true, moneda: 'USD', importe: 48000,
    cotizacion: 1, usd: 48000, plazo: '90 días', adjudicado: false, nota: '', archivo: null }];

  const indices = ['2026-03', '2026-04', '2026-05', '2026-06'].map((periodo, i) => ({ id: nuevo(),
    nombre: 'CAC', periodo, valor: 100 + i * 4, variacion: 4, fuente: 'Cámara Argentina de la Construcción',
    nota: '', cargado_por: null, cargado_en: '2026-07-01T12:00:00Z' }));

  const enlaces = [{ id: nuevo(), token: 'token-de-ejemplo-sin-valor', obra_id: norte, inversor_id: inv[0],
    titulo: 'Rendición trimestral', vence: '2026-12-31', activo: true, visitas: 3,
    ultima_visita: '2026-06-01T12:00:00Z', creado_por: null, creado_en: '2026-05-01T12:00:00Z' }];

  return { obras, rubros, cajas, clases, presupuestos, inversores, aportes, comprobantes, avances,
    documentos, cierres, participaciones, ventas, fichas, proveedores, pedidos, respuestas, analisis,
    niveles, indices, cuotas, enlaces, unidades_obra: unidades };
}
