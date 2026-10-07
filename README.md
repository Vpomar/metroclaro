# metroclaro — Administración de obras

Aplicación web para administrar obras en fideicomiso: cajas, comprobantes,
proveedores, inversores, ventas, cuotas y rendiciones. El frontend es un sitio
estático (HTML + JavaScript sin framework) y el backend es Supabase
(Postgres con RLS, Auth, Storage y Edge Functions).

**Documentación completa en [`docs/`](docs/README.md)**: funcionamiento,
arquitectura, modelo de datos, seguridad, desarrollo, migraciones,
despliegue, respaldos y operación.

## Estructura

```
├── public/               Lo que se publica en Vercel (nada más)
│   ├── index.html        Aplicación
│   ├── rendicion.html    Portal del inversor por enlace
│   ├── clientes/         config.js de cada cliente (generados desde clientes.json)
│   ├── js/               Código: nucleo/, vistas/, formularios/ (ver js/README.md)
│   ├── css/  img/
│   ├── manifest.json     PWA
│   └── sw.js
├── supabase/
│   ├── migrations/       Esquema versionado: única fuente de verdad de la base
│   ├── functions/        Edge Functions (Deno)
│   └── seed.sql          Datos ficticios para staging (nunca en producción)
├── clientes.json         Registro de clientes: subdominio → su Supabase (npm run clientes)
├── scripts/              Servidor local, generador de clientes y respaldos
├── tests/                Pruebas (seguridad, RLS)
├── docs/                 Documentación
└── respaldos/            Respaldos locales — fuera de git, nunca se publican
```

## Entornos

Un único proyecto de Vercel sirve a todos los clientes; cada uno entra por
su subdominio de `metroclaro.com.ar` y tiene su propio proyecto de Supabase.

| Cliente | Dominio | Supabase | Uso |
|---|---|---|---|
| Simple STGO | https://stgo.metroclaro.com.ar | `gccbybrslcrecimfblwe` | Producción, datos reales |
| Staging | https://staging.metroclaro.com.ar | `tverjzxsmwnrnpnsimgh` | Pruebas, datos ficticios |

## Desarrollo local

Requiere Node 20 o superior.

```bash
cp .env.example .env.local     # apunta a staging por defecto
npm run dev                    # http://localhost:8000
```

`npm run dev` sirve `public/` y entrega como `config.js` los valores de
`.env.local` (o staging, si no existe), así nunca se trabaja contra
producción por accidente.

## Pruebas

```bash
npm install                    # una vez
npx playwright install chromium
npm run test:unit              # cálculos y reglas del código (Vitest, sin red)
npm run test:seguridad         # sondeo sin login contra el entorno de .env.local
npm run test:e2e               # navegador real contra staging (Playwright)
```

La CI de GitHub corre las tres en cada pull request. Las pruebas de RLS por
rol (`tests/seguridad/rls-roles.sql`) y de integridad se corren solo contra
staging.

## Cómo se trabaja

Reglas obligatorias en [`AGENTS.md`](AGENTS.md) (y [`CLAUDE.md`](CLAUDE.md)
para Claude Code). En resumen: **cada funcionalidad en una rama nueva, y se
integra a `main` con un pull request desde GitHub.**

## Publicación

Vercel publica la carpeta `public/` (ver `vercel.json`). Nunca publicar la
carpeta del proyecto entera.
