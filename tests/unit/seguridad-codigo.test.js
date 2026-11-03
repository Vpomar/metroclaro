// Reglas de seguridad que se pueden verificar leyendo el código.
// Si alguna falla, alguien reintrodujo un patrón que la auditoría corrigió.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { codigoDeLaApp, scriptsDeLaApp, cargarApp } from './cargar-app.js';

const RAIZ = path.resolve(import.meta.dirname, '../..');
const leer = f => fs.readFileSync(path.join(RAIZ, f), 'utf8');
const app = codigoDeLaApp();

describe('módulos de public/js', () => {
  it('index.html carga todos los archivos de js/ y ninguno que no exista', () => {
    const enIndex = scriptsDeLaApp().map(s => s.replace(/^js\//, '')).sort();
    const enDisco = fs.readdirSync(path.join(RAIZ, 'public/js'), { recursive: true })
      .filter(f => f.endsWith('.js')).map(f => f.replaceAll('\\', '/')).sort();
    expect(enIndex).toEqual(enDisco);
  });

  it('el arranque se carga último', () => {
    expect(scriptsDeLaApp().at(-1)).toBe('js/nucleo/inicio.js');
  });

  it('todos los módulos se ejecutan juntos sin errores', () => {
    expect(() => cargarApp()).not.toThrow();
  });

  it('cada función se define una sola vez en toda la app', () => {
    const nombres = [...app.matchAll(/^(?:async )?function (\w+)\(/gm)].map(m => m[1]);
    const repetidas = nombres.filter((n, i) => nombres.indexOf(n) !== i);
    expect(repetidas).toEqual([]);
  });
});

describe('XSS (H-04)', () => {
  it('ningún manejador inline recibe texto escapado con esc()', () => {
    // esc() no protege dentro de onclick="…": el navegador decodifica &#39;
    // antes de ejecutar. El texto tiene que viajar en un atributo data-*.
    const peligrosos = app.match(/on(click|change|input)="[^"]*\$\{esc\(/g) || [];
    expect(peligrosos).toEqual([]);
  });

  it('los manejadores inline solo interpolan ids o valores fijos', () => {
    const interpolaciones = [...app.matchAll(/on(?:click|change|input)="[^"]*?\$\{([^}]+)\}/g)]
      .map(m => m[1].trim());
    // ids (uuid en la base: no se pueden manipular para inyectar código) y constantes del código
    const permitidas = /(^|\.)(id|\w+_id)$|^(k|v|col|campo|letra|Math\.round\([\w.]+\)|cs\[0\]\.hasta)$/;
    const sospechosas = interpolaciones.filter(x => !permitidas.test(x));
    expect(sospechosas).toEqual([]);
  });

  it('los títulos de los modales que llevan datos se escapan', () => {
    const titulos = [...app.matchAll(/modal\(`([^`]*)`/g)].map(m => m[1]);
    const sinEscapar = titulos.filter(t => /\$\{(?!esc\(|c\.numero\})/.test(t));
    expect(sinEscapar).toEqual([]);
  });
});

describe('configuración publicada', () => {
  it('la configuración de cada cliente solo tiene una publishable key', () => {
    const archivos = fs.readdirSync(path.join(RAIZ, 'public/clientes'));
    expect(archivos.length).toBeGreaterThan(0);
    for (const f of archivos) {
      const config = leer(path.join('public/clientes', f));
      expect(config, f).toMatch(/sb_publishable_/);
      expect(config, f).not.toMatch(/service_role|sb_secret_|eyJ[\w-]+\.[\w-]+\.[\w-]+/);
    }
  });

  it('las librerías externas tienen versión exacta y hash de integridad', () => {
    const html = leer('public/index.html');
    const scripts = [...html.matchAll(/<script[^>]+src="https?:[^"]+"[^>]*>/g)].map(m => m[0]);
    expect(scripts.length).toBeGreaterThan(0);
    for (const s of scripts) {
      expect(s).toMatch(/@\d+\.\d+\.\d+\//);
      expect(s).toMatch(/integrity="sha384-/);
    }
  });

  it('ningún archivo de public/ contiene claves secretas', () => {
    const archivos = fs.readdirSync(path.join(RAIZ, 'public'), { recursive: true })
      .filter(f => /\.(js|html|json)$/.test(f));
    for (const f of archivos) {
      const texto = leer(path.join('public', f));
      expect(texto, f).not.toMatch(/sb_secret_|service_role|sk-ant-/);
    }
  });
});

describe('escrituras', () => {
  it('ningún delete directo deja de verificar las filas afectadas', () => {
    const deletes = [...app.matchAll(/\.delete\(\)[^;\n]*/g)].map(m => m[0]);
    for (const d of deletes) expect(d).toMatch(/\.select\(/);
  });

  it('no se usa toISOString para armar fechas del día', () => {
    expect(app).not.toMatch(/toISOString\(\)\.slice\(0,\s*10\)/);
  });
});

describe('hardening de cumplimiento (docs/10-cumplimiento.md)', () => {
  const vercel = JSON.parse(leer('vercel.json'));
  const headersDe = fuente => Object.fromEntries(
    (vercel.headers.find(h => h.source === fuente)?.headers || []).map(h => [h.key, h.value]));

  it('el sitio publica CSP, HSTS y COOP', () => {
    const h = headersDe('/(.*)');
    const csp = h['Content-Security-Policy'] || '';
    expect(csp).toMatch(/frame-ancestors 'none'/);
    expect(csp).toMatch(/object-src 'none'/);
    expect(csp).toMatch(/base-uri 'self'/);
    // eval queda prohibido; WebAssembly sí (OCR y lector de QR)
    expect(csp).not.toMatch(/'unsafe-eval'/);
    expect(h['Strict-Transport-Security']).toMatch(/max-age=\d{8,}/);
    expect(h['Cross-Origin-Opener-Policy']).toBe('same-origin');
  });

  it('la rendición no filtra el token por Referer ni queda en caché', () => {
    const h = headersDe('/rendicion.html');
    expect(h['Referrer-Policy']).toBe('no-referrer');
    expect(h['Cache-Control']).toBe('no-store');
  });

  it('las Edge Functions no habilitan CORS para cualquier origen', () => {
    const dir = path.join(RAIZ, 'supabase/functions');
    const funciones = fs.readdirSync(dir).filter(f => !f.startsWith('_'));
    expect(funciones.length).toBeGreaterThan(0);
    for (const f of funciones) {
      const codigo = leer(`supabase/functions/${f}/index.ts`);
      expect(codigo, f).not.toMatch(/Access-Control-Allow-Origin['"]?\s*:\s*['"]\*/);
      expect(codigo, f).toMatch(/Deno\.serve\(servir\(/);
    }
  });

  it('la contraseña mínima es de 12 caracteres en la app y en el servidor', () => {
    expect(leer('supabase/functions/gestionar-usuarios/index.ts')).toMatch(/password\.length < 12/);
    expect(leer('public/js/vistas/usuarios.js')).toMatch(/password\.length < 12/);
  });

  it('la sesión se cierra por inactividad', () => {
    expect(app).toMatch(/function vigilarInactividad\(/);
    expect(app).toMatch(/vigilarInactividad\(\);/);
  });
});
