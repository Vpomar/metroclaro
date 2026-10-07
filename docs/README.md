# Documentación de metroclaro

| Documento | Para qué sirve |
|---|---|
| [01 · Qué es y para qué sirve](01-funcionamiento.md) | Qué hace la aplicación, quién la usa y cada pantalla |
| [02 · Arquitectura y tecnologías](02-arquitectura.md) | Cómo está armada, entornos, flujo de datos |
| [03 · Modelo de datos y cálculos](03-modelo-de-datos.md) | Tablas, relaciones y cómo se calcula cada número |
| [04 · Seguridad](04-seguridad.md) | Roles, RLS, archivos, funciones y controles |
| [05 · Desarrollo local](05-desarrollo-local.md) | Cómo trabajar en la aplicación sin tocar producción |
| [06 · Base de datos y migraciones](06-base-de-datos.md) | Cómo cambiar la base de forma segura |
| [07 · Despliegue y nuevos clientes](07-despliegue.md) | Publicación, Edge Functions y alta de un cliente |
| [08 · Respaldos](08-respaldos.md) | Qué respaldar, cómo y cómo restaurar |
| [09 · Operación y soporte](09-operacion.md) | Tareas del día a día y problemas frecuentes |
| [Auditoría 2026-10](auditoria-2026-10.md) | Hallazgos de la auditoría y su estado |
| [Decisiones](decisiones.md) | Por qué las cosas son como son |

## Resumen en cinco líneas

- Aplicación web para administrar obras en fideicomiso: cajas, comprobantes,
  inversores, ventas en cuotas y rendiciones.
- Frontend estático (HTML + JavaScript, sin framework) publicado en Vercel.
- Backend en Supabase: Postgres con Row Level Security, Auth, Storage y
  Edge Functions.
- Cada cliente tiene su propio proyecto de Supabase y su propio dominio.
- Todo cambio pasa por una rama, se prueba en staging y entra a `main` por
  pull request.
