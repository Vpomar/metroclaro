import { describe, it, expect, beforeAll } from 'vitest';
import { cargarApp } from './cargar-app.js';

let app;
beforeAll(() => { app = cargarApp(); });

describe('fechas (L-04)', () => {
  it('fechaLocal usa la fecha local, no UTC', () => {
    // 23:30 del 7/10 en hora local: con toISOString daba el 8/10 en Argentina
    expect(app.fechaLocal(new Date(2026, 9, 7, 23, 30))).toBe('2026-10-07');
    expect(app.fechaLocal(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
  });

  it('hoy devuelve AAAA-MM-DD', () => {
    expect(app.hoy()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it.each([
    ['2026-01-31', 1, '2026-02-28'],
    ['2028-01-31', 1, '2028-02-29'],   // año bisiesto
    ['2026-03-31', 1, '2026-04-30'],
    ['2026-01-31', 2, '2026-03-31'],   // vuelve al 31 si el mes lo tiene
    ['2026-11-15', 2, '2027-01-15'],   // cambio de año
    ['2026-12-31', 12, '2027-12-31'],
    ['2026-08-31', 0, '2026-08-31'],
    ['2026-05-10', -6, '2025-11-10']
  ])('sumarMeses(%s, %i) = %s', (f, n, esperado) => {
    expect(app.sumarMeses(f, n)).toBe(esperado);
  });

  it('fecha formatea DD/MM/AAAA y tolera vacíos', () => {
    expect(app.fecha('2026-10-07')).toBe('07/10/2026');
    expect(app.fecha(null)).toBe('—');
  });
});

describe('escape de HTML', () => {
  it('esc escapa los cinco caracteres peligrosos', () => {
    expect(app.esc(`<img src=x onerror="a('b')">&`))
      .toBe('&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;');
  });

  it('esc tolera null y números', () => {
    expect(app.esc(null)).toBe('');
    expect(app.esc(12)).toBe('12');
  });
});
