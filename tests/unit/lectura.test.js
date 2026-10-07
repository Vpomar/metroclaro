// Lectura de comprobantes: QR de ARCA, texto de facturas y combinación
// de fuentes (public/js/nucleo/lectura.js). Sin red ni navegador real.
import { describe, it, expect, beforeAll } from 'vitest';
import { cargarApp, datosVacios } from './cargar-app.js';

let app;
beforeAll(() => { app = cargarApp(); });

// CUIT ficticios con dígito verificador correcto
const EMISOR = '30712345671';
const RECEPTOR = '30700000016';

const qrArca = (datos) =>
  'https://www.afip.gob.ar/fe/qr/?p=' + Buffer.from(JSON.stringify(datos)).toString('base64');
const QR_BASE = { ver: 1, fecha: '2026-05-21', cuit: +EMISOR, ptoVta: 3, tipoCmp: 1, nroCmp: 1234,
  importe: 121000, moneda: 'PES', ctz: 1, tipoDocRec: 80, nroDocRec: +RECEPTOR,
  tipoCodAut: 'E', codAut: 76123456789012 };

describe('números, fechas y CUIT', () => {
  it('interpreta importes con formato argentino y otros', () => {
    expect(app.numeroAR('1.234.567,89')).toBe(1234567.89);
    expect(app.numeroAR('$ 121000,00')).toBe(121000);
    expect(app.numeroAR('1,234,567.89')).toBe(1234567.89);
    expect(app.numeroAR('21.000')).toBe(21000);
    expect(app.numeroAR('10,5')).toBe(10.5);
    expect(app.numeroAR('sin número')).toBeNull();
  });

  it('valida el dígito verificador del CUIT', () => {
    expect(app.cuitValido(EMISOR)).toBe(true);
    expect(app.cuitValido('30-71234567-1')).toBe(true);
    expect(app.cuitValido('30-71234567-2')).toBe(false);   // un dígito mal leído
    expect(app.cuitValido('12345678901')).toBe(false);     // prefijo inexistente
  });

  it('normaliza fechas y descarta las imposibles', () => {
    expect(app.fechaISO('21/05/2026')).toBe('2026-05-21');
    expect(app.fechaISO('1-5-26')).toBe('2026-05-01');
    expect(app.fechaISO('2026-05-21')).toBe('2026-05-21');
    expect(app.fechaISO('31/02/2026')).toBeNull();
  });

  it('compara números de comprobante escritos distinto', () => {
    expect(app.claveNumero('0003-00001234')).toBe(app.claveNumero('3-1234'));
  });
});

describe('QR de ARCA', () => {
  it('lee los datos de una factura A en pesos', () => {
    expect(app.leerQrArca(qrArca(QR_BASE))).toMatchObject({
      fecha: '2026-05-21', cuit: '30-71234567-1', tipo: 'Factura A', nro: '0003-00001234',
      importe: 121000, moneda: 'ARS', cae: '76123456789012', receptor: RECEPTOR
    });
  });

  it('acepta el dominio de ARCA y factura en dólares con cotización', () => {
    const d = app.leerQrArca(qrArca({ ...QR_BASE, tipoCmp: 6, moneda: 'DOL', ctz: 1250.5 })
      .replace('www.afip.gob.ar', 'www.arca.gob.ar'));
    expect(d).toMatchObject({ tipo: 'Factura B', moneda: 'USD', cotizacion: 1250.5 });
  });

  it('avisa si es una nota de crédito', () => {
    expect(app.leerQrArca(qrArca({ ...QR_BASE, tipoCmp: 3 })).aviso).toMatch(/nota de crédito/);
  });

  it('ignora otros QR y datos corruptos', () => {
    expect(app.leerQrArca('https://ejemplo.com/?p=' + Buffer.from('{}').toString('base64'))).toBeNull();
    expect(app.leerQrArca('https://www.afip.gob.ar/fe/qr/?p=no-es-base64!!')).toBeNull();
    expect(app.leerQrArca('texto cualquiera')).toBeNull();
  });
});

// Texto como lo devuelve un PDF de "Comprobantes en línea" de ARCA
const FACTURA_A = `ORIGINAL
HORMIGONES DEL PARANÁ S.A. A FACTURA
COD. 01 Punto de Venta: 00003 Comp. Nro: 00001234
Razón Social: HORMIGONES DEL PARANÁ S.A. Fecha de Emisión: 21/05/2026
Domicilio Comercial: Av. Siempre Viva 123 - Rosario CUIT: ${EMISOR}
Condición frente al IVA: IVA Responsable Inscripto
CUIT: ${RECEPTOR} Apellido y Nombre / Razón Social: FIDEICOMISO OBRA NORTE
Código Producto / Servicio Cantidad U. Medida Precio Unit. % Bonif Subtotal Alícuota IVA Subtotal c/IVA
1 Hormigón H21 10,00 m3 10000,00 0,00 100000,00 21% 121000,00
Importe Neto Gravado: $ 100000,00
IVA 27%: $ 0,00
IVA 21%: $ 21000,00
IVA 10.5%: $ 0,00
Importe Otros Tributos: $ 0,00
Importe Total: $ 121000,00
CAE N°: 76123456789012 Fecha de Vto. de CAE: 31/05/2026`;

describe('texto de la factura', () => {
  it('lee una factura A de ARCA completa', () => {
    expect(app.leerTextoComprobante(FACTURA_A, RECEPTOR)).toMatchObject({
      cuit: '30-71234567-1', tipo: 'Factura A', nro: '0003-00001234', fecha: '2026-05-21',
      proveedor: 'HORMIGONES DEL PARANÁ S.A.', importe: 121000, neto: 100000, iva: 21000, percepciones: 0
    });
  });

  it('suma varias alícuotas de IVA y percepciones sueltas', () => {
    const d = app.leerTextoComprobante(`FACTURA A
CUIT ${EMISOR}  0005-00000077  Fecha 02/06/2026
Subtotal 1.000.000,00
I.V.A. 21% 168.000,00
I.V.A. 10,5% 21.000,00
Percepción IIBB 3% 30.000,00
Percepción IVA 15.000,00
TOTAL $ 1.234.000,00`);
    expect(d).toMatchObject({ tipo: 'Factura A', nro: '0005-00000077', neto: 1000000,
      iva: 189000, percepciones: 45000, importe: 1234000 });
  });

  it('lee un ticket con texto desprolijo de OCR', () => {
    const d = app.leerTextoComprobante(`CORRALON SAN MARTIN
C.U.I.T. N°: 30-69999999-3
TIQUE FACTURA B  N° 0002-00045123
Fecha: 05/06/26
Cemento x 50kg   10  8.500,00
TOTAL    $ 85.000,00`);
    expect(d).toMatchObject({ cuit: '30-69999999-3', tipo: 'Factura B', nro: '0002-00045123',
      fecha: '2026-06-05', importe: 85000 });
  });

  // Formatos reales de tiques y facturas, con nombres y CUIT ficticios
  it('tique de controlador fiscal A, exento, con el cliente abajo', () => {
    const d = app.leerTextoComprobante(`FARMACIA DEMO
PEREZ JUAN
C.U.I.T. Nro.: 20-30111222-0
Ing. Brutos: 021-204378-3
Inicio de Actividades: 22/05/2003
IVA RESPONSABLE INSCRIPTO
TIQUE FACTURA "A" (Cód.081) N° 00004-00000586
Fecha 20/08/2026
FIDEICOMISO DEMO
C.U.I.T. Nro.: 30-70000001-6
COMPROBANTES ASOCIADOS:
Cód. 910 00001-00000001
5,0000 u x 17666,8700
SUBTOT. IMP. EXENTO 218330,29
ALICUOTA 0,00% 0,00
TOTAL 218330,29
Efectivo 218330,29
IVA Contenido: 0,00`);
    expect(d).toMatchObject({ cuit: '20-30111222-0', tipo: 'Factura A', nro: '0004-00000586',
      fecha: '2026-08-20', importe: 218330.29, exento: 218330.29 });
    const r = app.combinarLecturas({ ocr: { ...d, proveedor: 'Farmacia Demo' } });
    expect(r.datos.neto).toBe(218330.29);                       // lo exento va al neto
    expect(app.faltantesLectura(r.datos)).toEqual([]);
  });

  it('tique con "IVA: 21.00" y punto decimal, sin rótulo de fecha', () => {
    const d = app.leerTextoComprobante(`AUTOSERVICIO DEMO
CUIT: 20-30111222-0
IIBB: 0214312797
Inicio de Actividades: 01/12/2015
FACTURAS A
(Cod. 1)
Nro.: 00005-00000016
11:12:40 02/10/2026
fideicomiso demo (3)
CUIT (80) 30700000016
Neto.S/IVA: 24876.03
IVA: 21.00 5223.97
Total: 30100.00`);
    expect(d).toMatchObject({ cuit: '20-30111222-0', tipo: 'Factura A', nro: '0005-00000016',
      fecha: '2026-10-02', neto: 24876.03, iva: 5223.97, importe: 30100 });
  });

  it('"Subtotal" e "IVA 21 %" no se confunden con el total', () => {
    const d = app.leerTextoComprobante(`DEMO S.R.L.
CUIT: 30-69999999-3
Factura A-00017-00000094
(cód. 1)
06/10/2026 11:31
FIDEICOMISO DEMO
CUIT 30700000016
Subtotal: $50.000,00
IVA 21 %: $10.500,00
TOTAL: $60.500,00`);
    expect(d).toMatchObject({ cuit: '30-69999999-3', nro: '0017-00000094', fecha: '2026-10-06',
      neto: 50000, iva: 10500, importe: 60500 });
  });

  it('IVA total rotulado y varias alícuotas en una línea', () => {
    const d = app.leerTextoComprobante(`FACTURA A 0004 - 00000255
FECHA: 1/10/2026
CUIT: 20301112220
Cliente: Fideicomiso Demo
CUIT: 30700000016
IVA 21%: $ 206.912,00 IVA 10,5%: $ 0,00 IVA 5%: $ 0,00
Subtotal: $ 985.295,23
Subtotal IVA: $ 206.912,00
Percepciones: $ 0,00
TOTAL: $ 1192207,23`);
    expect(d).toMatchObject({ cuit: '20-30111222-0', fecha: '2026-10-01', neto: 985295.23,
      iva: 206912, percepciones: 0, importe: 1192207.23 });
  });

  it('factura en dólares: "u$s" en el total, no en el tipo de cambio', () => {
    const d = app.leerTextoComprobante(`FACTURA N°: FAC A 0060-00071759
Tipo de cambio: 1535,00
TOTAL u$s 242,01`);
    expect(d).toMatchObject({ importe: 242.01, moneda: 'USD', nro: '0060-00071759' });
    expect(app.leerTextoComprobante(`Tipo de Cambio: U$S 1 = 1395.00
TOTAL 69442.51`).moneda).toBeUndefined();
  });

  it('elige como emisor al proveedor conocido', () => {
    const t = `Cliente: Fideicomiso Demo CUIT 30-70000001-6
Proveedor Demo CUIT 30-69999999-3`;
    expect(app.leerTextoComprobante(t).cuit).toBe('30-69999999-3');      // el del cliente se descarta
    expect(app.leerTextoComprobante(t, null, ['30700000016']).cuit).toBe('30-70000001-6');
  });

  it('una factura A sin IVA ni exento no se da por leída', () => {
    expect(app.faltantesLectura({ fecha: '2026-08-28', proveedor: 'X', cuit: '30-71234567-1',
      tipo: 'Factura A', nro: '0003-00013287', importe: 69442.51, neto: 69442.51 }))
      .toEqual(['neto e IVA']);
  });

  it('no inventa: sin datos reconocibles devuelve null', () => {
    expect(app.leerTextoComprobante('hola mundo')).toBeNull();
    expect(app.leerTextoComprobante('')).toBeNull();
  });
});

describe('combinar fuentes', () => {
  it('el QR manda sobre la IA y el OCR', () => {
    const r = app.combinarLecturas({
      qr: { importe: 121000, cuit: '30-71234567-1', fecha: '2026-05-21' },
      ocr: { importe: 127000, cuit: '30-71234567-1', proveedor: 'HORMIGONES' },
      ia: { importe: 121000, proveedor: 'Hormigones del Paraná SA', detalle: 'Hormigón H21' }
    });
    expect(r.datos).toMatchObject({ importe: 121000, proveedor: 'Hormigones del Paraná SA', detalle: 'Hormigón H21' });
    expect(r.fuente).toMatchObject({ importe: 'qr', proveedor: 'ia', fecha: 'qr' });
    expect(r.avisos.join(' ')).toMatch(/no coincide con el del QR/);
  });

  it('toma el desglose de la fuente que cierra con el total', () => {
    const r = app.combinarLecturas({
      qr: { importe: 121000 },
      ocr: { neto: 100000, iva: 2100, percepciones: 0 },       // el OCR leyó mal el IVA
      ia: { neto: 100000, iva: 21000, percepciones: 0 }
    });
    expect(r.datos).toMatchObject({ neto: 100000, iva: 21000 });
    expect(r.fuente.iva).toBe('ia');
  });

  it('con el total firme, corrige un dígito mal leído usando la alícuota', () => {
    const r = app.combinarLecturas({ qr: { importe: 121000 }, ocr: { neto: 10000, iva: 21000, percepciones: 0 } });
    expect(r.datos).toMatchObject({ neto: 100000, iva: 21000 });
    expect(r.avisos.join(' ')).toMatch(/neto se calculó/);
    // Si no da ninguna alícuota real, no inventa
    const r2 = app.combinarLecturas({ qr: { importe: 121000 }, ocr: { neto: 10000, iva: 2000 } });
    expect(r2.datos.neto).toBe(10000);
  });

  it('descarta un CUIT con dígito verificador incorrecto', () => {
    const r = app.combinarLecturas({ ocr: { cuit: '30-71234567-2' }, ia: { cuit: '30-71234567-1' } });
    expect(r.datos.cuit).toBe('30-71234567-1');
    expect(r.fuente.cuit).toBe('ia');
  });

  it('decide si hace falta consultar a la IA', () => {
    const completa = { fecha: '2026-05-21', proveedor: 'X', cuit: '30-71234567-1', tipo: 'Factura A',
      nro: '0003-00001234', importe: 121000, neto: 100000, iva: 21000, percepciones: 0 };
    expect(app.faltantesLectura(completa)).toEqual([]);
    expect(app.faltantesLectura({ ...completa, iva: 0 })).toEqual(['neto e IVA']);
    expect(app.faltantesLectura({ ...completa, proveedor: null })).toEqual(['proveedor']);
    expect(app.faltantesLectura({ ...completa, tipo: 'Factura B', neto: null, iva: null })).toEqual([]);
  });
});

describe('catálogo y duplicados', () => {
  it('encuentra el proveedor por CUIT y avisa duplicados', () => {
    const d = datosVacios();
    d.obras = [{ id: 'o1', nombre: 'Obra Norte' }];
    d.proveedores = [{ id: 'p1', nombre: 'Hormigones del Paraná SA', cuit: '30-71234567-1', rubro_id: 'r1', activo: true }];
    d.comprobantes = [{ id: 'c1', obra_id: 'o1', proveedor: 'Hormigones del Paraná SA',
      cuit: '30712345671', numero: '3-1234', fecha: '2026-05-21' }];
    app.fijarDatos(d);
    expect(app.proveedorPorCuit('30-71234567-1')).toMatchObject({ nombre: 'Hormigones del Paraná SA', rubro_id: 'r1' });
    expect(app.proveedorPorCuit('30-70000001-6')).toBeNull();
    expect(app.comprobanteDuplicado('30-71234567-1', '0003-00001234')).toMatchObject({ id: 'c1', obra: 'Obra Norte' });
    expect(app.comprobanteDuplicado('30-71234567-1', '0003-00001234', 'c1')).toBeNull();   // el que se edita
    expect(app.comprobanteDuplicado('30-71234567-1', '0003-00009999')).toBeNull();
  });
});
