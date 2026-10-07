# metroclaro — Administración de obras

Aplicación web para administrar obras en fideicomiso: cajas, comprobantes,
proveedores, inversores, ventas, cuotas y rendiciones. El frontend es un sitio
estático (HTML + JavaScript sin framework) y el backend es Supabase
(Postgres con RLS, Auth, Storage y Edge Functions).

## Estructura

```
├── public/               Lo que se publica en Vercel (nada más)
│   ├── index.html        Aplicación
│   ├── rendicion.html    Portal del inversor por enlace
│   ├── config.js         URL y publishable key de producción
│   ├── css/  js/  img/
│   ├── manifest.json     PWA
│   └── sw.js
├── supabase/
│   ├── migrations/       Esquema versionado: única fuente de verdad de la base
│   ├── functions/        Edge Functions (Deno)
│   └── seed.sql          Datos ficticios para staging (nunca en producción)
├── scripts/              Servidor local y herramientas de respaldo
├── tests/                Pruebas (seguridad, RLS)
├── docs/                 Documentación
└── respaldos/            Respaldos locales — fuera de git, nunca se publican
```

## Entornos

| Entorno | Supabase | Uso |
|---|---|---|
| Producción | Simple STGO (`gccbybrslcrecimfblwe`) | Datos reales del cliente |
| Staging | metroclaro-staging (`tverjzxsmwnrnpnsimgh`) | Pruebas con datos ficticios |

## Desarrollo local

Requiere Node 20 o superior.

```bash
cp .env.example .env.local     # apunta a staging por defecto
npm run dev                    # http://localhost:8000
```

`npm run dev` sirve `public/` y reemplaza `config.js` por los valores de
`.env.local`, así nunca se trabaja contra producción por accidente.

## Pruebas

```bash
npm run test:seguridad         # sondeo sin login contra el entorno de .env.local
```

Las pruebas de RLS por rol están en `tests/seguridad/rls-roles.sql` y se
corren solo contra staging.

## Flujo de trabajo

1. Toda funcionalidad nueva se hace en una rama nueva.
2. Se prueba en local contra staging.
3. Se abre un pull request en GitHub y se mergea a `main`.
4. Los cambios de base de datos van siempre como migración en
   `supabase/migrations/`, primero a staging y después a producción.

## Publicación

Vercel publica la carpeta `public/` (ver `vercel.json`). Nunca publicar la
carpeta del proyecto entera.
