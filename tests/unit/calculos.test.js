import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { cargarApp, datosVacios } from './cargar-app.js';

let app;
beforeAll(() => { app = cargarApp(); });

// Obra de prueba: dos inversores, una caja, rubros con y sin base de honorarios.
function obraDePrueba() {
  const D = datosVacios();
  D.obras = [{ id: 'o1', nombre: 'Obra', pct_conduccion: 10, pct_administracion: 3, pct_desarrolladora: 0 }];
  D.cajas = [{ id: 'c1', obra_id: 'o1', nombre: 'Banco' }];
  D.clases = [
    { obra_id: 'o1', letra: 'A', nombre: 'Cuota A', coeficiente: 1 },
    { obra_id: 'o1', letra: 'B', nombre: 'Cuota B', coeficiente: 1.5 }
  ];
  D.rubros = [
    { id: 'r-est', nombre: 'Estructura', grupo: 'Obra gruesa', base_honorarios: true },
    { id: 'r-ter', nombre: 'Terreno y escrituración', grupo: 'Previo', base_honorarios: false },
    { id: 'r-con', nombre: 'Honorarios de conducción técnica', grupo: 'Honorarios', base_honorarios: false },
    { id: 'r-adm', nombre: 'Administración de obra', grupo: 'Honorarios', base_honorarios: false }
  ];
  D.presupuestos = [
    { obra_id: 'o1', rubro_id: 'r-est', monto_usd: 100000 },
    { obra_id: 'o1', rubro_id: 'r-ter', monto_usd: 50000 }
  ];
  D.aportes = [
    { obra_id: 'o1', inversor_id: 'i1', caja_id: 'c1', clase: 'A', usd: 25000 },
    { obra_id: 'o1', inversor_id: 'i2', caja_id: 'c1', clase: 'B', usd: 15000 }
  ];
  D.comprobantes = [
    // computa, pagado, base de honorarios
    { obra_id: 'o1', caja_id: 'c1', rubro_id: 'r-est', usd: 10000, pago: 'pagado', afecta_caja: true, computa_honorarios: true, proveedor: 'Hormigones', fecha: '2026-08-01' },
    // computa, pendiente, base de honorarios
    { obra_id: 'o1', caja_id: 'c1', rubro_id: 'r-est', usd: 2000, pago: 'pendiente', afecta_caja: true, computa_honorarios: true, proveedor: 'Hormigones', fecha: '2026-09-01' },
    // computa pero excluido de honorarios (flete)
    { obra_id: 'o1', caja_id: 'c1', rubro_id: 'r-est', usd: 500, pago: 'pagado', afecta_caja: true, computa_honorarios: false, proveedor: 'Fletes', fecha: '2026-08-02' },
    // computa, rubro fuera de la base
    { obra_id: 'o1', caja_id: 'c1', rubro_id: 'r-ter', usd: 18000, pago: 'pagado', afecta_caja: true, computa_honorarios: true, proveedor: 'Escribanía', fecha: '2026-07-01' },
    // honorario de conducción ya pagado
    { obra_id: 'o1', caja_id: 'c1', rubro_id: 'r-con', usd: 300, pago: 'pagado', afecta_caja: true, computa_honorarios: false, proveedor: 'Estudio', fecha: '2026-09-10' },
    // solo informativo: no computa en nada
    { obra_id: 'o1', caja_id: null, rubro_id: 'r-est', usd: 999, pago: 'pagado', afecta_caja: false, computa_honorarios: true, proveedor: 'Info', fecha: '2026-09-15' }
  ];
  return D;
}

beforeEach(() => { app.fijarDatos(obraDePrueba()); });

describe('totales de la obra', () => {
  it('suma aportes, ejecutado, pagado y deuda sin los informativos', () => {
    const t = app.totalesObra('o1');
    expect(t.ing).toBe(40000);
    expect(t.egr).toBe(10000 + 2000 + 500 + 18000 + 300);   // 30800
    expect(t.pag).toBe(10000 + 500 + 18000 + 300);           // 28800
    expect(t.deuda).toBe(2000);
    expect(t.sinCaja).toBe(999);
    expect(t.saldo).toBe(40000 - 28800);
    expect(t.neto).toBe(40000 - 28800 - 2000);
  });

  it('el saldo de una caja resta solo lo pagado', () => {
    const s = app.saldoCaja('c1');
    expect(s.ing).toBe(40000);
    expect(s.egr).toBe(28800);
    expect(s.deuda).toBe(2000);
    expect(s.saldo).toBe(11200);
  });
});

describe('honorarios', () => {
  it('la base ejecutada solo incluye rubros base que computan honorarios', () => {
    expect(app.baseEjecutada('o1')).toBe(12000);   // 10000 + 2000; sin flete, terreno ni informativo
  });

  it('devengado, pagado, saldo y proyectado', () => {
    const [cond, adm, des] = app.honorarios('o1');
    expect(cond).toMatchObject({ pct: 10, devengado: 1200, pagado: 300, saldo: 900, proyectado: 10000 });
    expect(adm).toMatchObject({ pct: 3, devengado: 360, pagado: 0, proyectado: 3000 });
    expect(des).toMatchObject({ pct: 0, devengado: 0 });
  });

  it('el presupuesto de un rubro de honorario sale del porcentaje', () => {
    expect(app.presu('o1', 'r-con')).toBe(10000);   // 10% de 100000 (solo rubros base)
    expect(app.presu('o1', 'r-ter')).toBe(50000);   // presupuesto manual
  });
});

describe('participación', () => {
  it('cada aporte vale su USD por el coeficiente de su clase', () => {
    expect(app.unidades('o1', { usd: 25000, clase: 'A' })).toBe(25000);
    expect(app.unidades('o1', { usd: 15000, clase: 'B' })).toBe(22500);
  });

  it('una clase sin configurar vale coeficiente 1', () => {
    const D = obraDePrueba(); D.clases = []; app.fijarDatos(D);
    expect(app.unidades('o1', { usd: 1000, clase: 'B' })).toBe(1000);
  });
});

describe('índice CAC y cuotas', () => {
  it('encadena variaciones y respeta los niveles cargados', () => {
    const D = obraDePrueba();
    D.indices = [
      { nombre: 'CAC', periodo: '2026-08', valor: null, variacion: 4 },
      { nombre: 'CAC', periodo: '2026-07', valor: null, variacion: 1.5 },
      { nombre: 'CAC', periodo: '2026-09', valor: 200, variacion: null }
    ];
    app.fijarDatos(D);
    expect(app.cacDe('2026-07')).toBe(100);         // primera variación sin nivel previo: base 100
    expect(app.cacDe('2026-08')).toBeCloseTo(104);  // 100 × 1,04
    expect(app.cacUltimo().nivel).toBe(200);
  });

  it('una cuota CAC se ajusta por el último índice; cobrada, queda fija', () => {
    const D = obraDePrueba();
    D.indices = [{ nombre: 'CAC', periodo: '2026-09', valor: 110, variacion: null }];
    app.fijarDatos(D);
    const venta = { modalidad: 'cuotas_cac', indice_base: 100 };
    expect(app.montoCuota(venta, { estado: 'pendiente', monto_base: 1000 })).toBeCloseTo(1100);
    expect(app.montoCuota(venta, { estado: 'cobrada', monto_base: 1000, monto_cobrado: 1050 })).toBe(1050);
    expect(app.montoCuota({ modalidad: 'cuotas_usd' }, { estado: 'pendiente', monto_base: 1000 })).toBe(1000);
  });
});

describe('proveedores y cierre', () => {
  it('agrupa la deuda por proveedor, la mayor primero', () => {
    const lista = app.deudaProveedores('o1');
    expect(lista[0]).toMatchObject({ proveedor: 'Hormigones', total: 12000, pagado: 10000, deuda: 2000 });
    expect(lista.find(p => p.proveedor === 'Info')).toBeUndefined();   // los informativos no cuentan
  });

  it('una fecha está cerrada si es igual o anterior al último cierre', () => {
    const D = obraDePrueba();
    D.cierres = [{ obra_id: 'o1', hasta: '2026-06-30' }, { obra_id: 'o1', hasta: '2026-08-31' }];
    app.fijarDatos(D);
    expect(app.estaCerrado('o1', '2026-08-31')).toBe(true);
    expect(app.estaCerrado('o1', '2026-09-01')).toBe(false);
  });
});
