import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ, leerClientes, validar, textoConfig, reglas } from '../../scripts/clientes.mjs';

const datos = leerClientes();

describe('clientes.json', () => {
  it('es válido', () => {
    expect(validar(datos)).toEqual([]);
  });

  it('los archivos generados están al día (si falla: npm run clientes)', () => {
    const carpeta = path.join(RAIZ, 'public/clientes');
    const enDisco = fs.readdirSync(carpeta).sort();
    expect(enDisco).toEqual(datos.clientes.map(c => `${c.id}.js`).sort());
    for (const c of datos.clientes)
      expect(fs.readFileSync(path.join(carpeta, `${c.id}.js`), 'utf8'), c.id).toBe(textoConfig(c));

    const vercel = JSON.parse(fs.readFileSync(path.join(RAIZ, 'vercel.json'), 'utf8'));
    expect(vercel.rewrites).toEqual(reglas(datos));
  });

  it('no existe un public/config.js fijo: cada dominio recibe el suyo', () => {
    expect(fs.existsSync(path.join(RAIZ, 'public/config.js'))).toBe(false);
  });

  it('la última regla (dominio desconocido o vista previa) lleva a staging', () => {
    const ultima = reglas(datos).at(-1);
    expect(ultima.has).toBeUndefined();
    const def = datos.clientes.find(c => `/clientes/${c.id}.js` === ultima.destination);
    expect(def.entorno).toBe('staging');
  });

  it('cada dominio de producción apunta a la base de su cliente', () => {
    for (const r of reglas(datos).filter(r => r.has)) {
      const cliente = datos.clientes.find(c => c.dominios.includes(r.has[0].value));
      expect(r.destination).toBe(`/clientes/${cliente.id}.js`);
    }
  });
});

describe('validación de clientes', () => {
  const base = () => JSON.parse(JSON.stringify(datos));
  const conCambio = (fn) => { const d = base(); fn(d); return validar(d); };

  it.each([
    ['clave secreta', d => { d.clientes[0].supabaseKey = 'sb_secret_xyz'; }],
    ['clave service_role (JWT)', d => { d.clientes[0].supabaseKey = 'eyJhbGciOi.eyJyb2xl.x'; }],
    ['URL que no es de Supabase', d => { d.clientes[0].supabaseUrl = 'https://otra.com'; }],
    ['dominio fuera de metroclaro.com.ar', d => { d.clientes[0].dominios = ['cliente.otrodominio.com']; }],
    ['dominio repetido entre clientes', d => { d.clientes[1].dominios.push(d.clientes[0].dominios[0]); }],
    ['id repetido', d => { d.clientes[1].id = d.clientes[0].id; }],
    ['por defecto un cliente de producción', d => { d.porDefecto = 'stgo'; }],
    ['entorno inválido', d => { d.clientes[0].entorno = 'dev'; }],
    ['sin nombre', d => { d.clientes[0].nombre = ' '; }]
  ])('rechaza: %s', (_, cambio) => {
    expect(conCambio(cambio).length).toBeGreaterThan(0);
  });

  it('acepta un cliente nuevo bien cargado', () => {
    const errores = conCambio(d => d.clientes.push({
      id: 'mympropiedades', nombre: 'MYM Propiedades', entorno: 'produccion',
      dominios: ['mympropiedades.metroclaro.com.ar'],
      supabaseUrl: 'https://abcdefghijklmnopqrst.supabase.co',
      supabaseKey: 'sb_publishable_ejemplo123'
    }));
    expect(errores).toEqual([]);
  });
});
