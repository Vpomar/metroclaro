// public/vendor/ tiene que ser una copia exacta de node_modules (versiones
// de package.json) y contener lo que pide la lectura de comprobantes.
// Si falla: `npm install` y `npm run vendor`, y commitear public/vendor/.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { archivos, sha256, DESTINO, RAIZ } from '../../scripts/vendor.mjs';

describe('librerías propias (public/vendor)', () => {
  it('son idénticas a las versiones instaladas', () => {
    for (const { origen, destino } of archivos()) {
      expect(fs.existsSync(destino), `falta ${destino}`).toBe(true);
      expect(sha256(destino), path.relative(DESTINO, destino)).toBe(sha256(origen));
    }
  });

  it('no hay archivos de más', () => {
    const esperados = new Set(archivos().map(a => path.resolve(a.destino)));
    const hay = fs.readdirSync(DESTINO, { recursive: true })
      .map(r => path.resolve(DESTINO, r))
      .filter(f => fs.statSync(f).isFile() && !f.endsWith('LEEME.md'));
    expect(hay.filter(f => !esperados.has(f))).toEqual([]);
  });

  it('las rutas que usa la app existen', () => {
    const codigo = fs.readFileSync(path.join(RAIZ, 'public/js/formularios/lectura-comprobante.js'), 'utf8');
    const rutas = [...codigo.matchAll(/'(vendor\/[^']+)'/g)].map(m => m[1]);
    expect(rutas.length).toBeGreaterThan(5);
    for (const r of rutas) expect(fs.existsSync(path.join(RAIZ, 'public', r)), r).toBe(true);
  });
});
