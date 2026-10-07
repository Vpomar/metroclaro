# 07 · Despliegue y nuevos clientes

## Frontend (Vercel)

- El proyecto de Vercel está conectado al repositorio `Vpomar/metroclaro`.
- Cada merge a `main` publica en producción: https://stgo.metroclaro.com.ar
- Cada pull request tiene su URL de vista previa (protegida con login de Vercel).
- `vercel.json` define que se publica **solo `public/`**, sin build, y agrega
  los headers de seguridad.

Configuración del proyecto en Vercel (*Settings → Build and Deployment*):

| Campo | Valor |
|---|---|
| Framework Preset | Other |
| Root Directory | vacío (la raíz del repo, donde está `vercel.json`) |
| Build Command | vacío |
| Output Directory | `public` |
| Production Branch | `main` |

**Nunca** publicar a mano la carpeta del proyecto entera: tiene respaldos
con datos reales, migraciones y pruebas.

## Edge Functions y secretos

Las funciones se despliegan por proyecto de Supabase (ver
[06 · Base de datos](06-base-de-datos.md)). Secretos necesarios en cada
proyecto (*Edge Functions → Secrets*):

| Secreto | Para qué |
|---|---|
| `ANTHROPIC_API_KEY` | `leer-comprobante` y `asistente` |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Los inyecta Supabase solo |

Conviene fijar un **límite de gasto** en console.anthropic.com para cada clave.

## Configuración de Auth (cada proyecto)

En *Authentication → Sign In / Providers*:

- **Allow new users to sign up:** desactivado. Los usuarios se crean desde
  la pestaña Usuarios de la app.
- **Confirm email:** activado.

En *Authentication → URL Configuration*: la **Site URL** es el dominio del
cliente (por ejemplo `https://stgo.metroclaro.com.ar`), para que los mails
de invitación y recuperación vuelvan a la app.

Verificación:

```bash
npm run test:seguridad
```

Tiene que decir `disable_signup = true`.

## Alta de un cliente nuevo

Cada cliente tiene **su propio proyecto de Supabase** (ver
[Decisiones](decisiones.md)). Requiere plan Pro de Supabase: el plan
gratuito admite 2 proyectos activos y los pausa por inactividad.

1. **Supabase:** *New project* en la organización "Obras", región `sa-east-1`.
   Guardar la contraseña de la base en un gestor de contraseñas.
2. **Esquema:** aplicar todas las migraciones de `supabase/migrations/` en orden.
3. **Datos iniciales:** cargar los rubros del estudio (los de staging sirven
   de modelo). **No** correr `seed.sql`, que tiene datos ficticios.
4. **Edge Functions:** desplegar las cuatro y cargar `ANTHROPIC_API_KEY`.
5. **Auth:** registro cerrado, confirmación de email, Site URL.
6. **Primer administrador:** *Authentication → Users → Add user*, y después
   en el SQL Editor:
   ```sql
   update public.perfiles set rol = 'admin', nombre = 'Nombre'
   where id = (select id from auth.users where email = 'cliente@...');
   ```
7. **Verificar:** `tests/seguridad/huella-esquema.sql` igual a producción, y
   `npm run test:seguridad` contra el proyecto nuevo, sin fallas.
8. **Frontend:** un proyecto de Vercel nuevo, conectado al mismo
   repositorio, con el dominio del cliente.

> **Pendiente antes del primer cliente nuevo:** hoy `public/config.js` tiene
> fija la URL de Simple STGO, y la marca del estudio está escrita en
> `index.html`. Para publicar el mismo código para varios clientes hay que
> generar `config.js` en el deploy a partir de variables de entorno de
> Vercel (`SUPABASE_URL`, `SUPABASE_KEY`, nombre de la marca). Se implementa
> en una rama propia antes de dar de alta al segundo cliente.
