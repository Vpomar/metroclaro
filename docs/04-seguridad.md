# 04 · Seguridad

## Principio

**La seguridad la aplica la base, no la pantalla.** Que la interfaz oculte
un botón no impide nada: cualquiera puede abrir las herramientas del
navegador y llamar a la API. Cada regla tiene que estar en Supabase (RLS,
permisos, disparadores o Edge Functions).

## Capas

```
Usuario
 └─ Auth                 Sin registro público; altas solo desde el panel de Usuarios
     └─ Frontend         Solo comodidad: oculta lo que el rol no puede usar
         └─ API (PostgREST)
             └─ GRANT    anon no tiene permisos en public; authenticated sin TRUNCATE
                 └─ RLS  Decide qué filas ve y modifica cada usuario
                     └─ Disparadores  Cierre, caja, autoría, último admin, historial
Storage                  Política por obra y por documento reservado
Edge Functions           Validan la sesión y el rol antes de usar claves secretas
```

## Roles en la base

Todo se apoya en tres funciones:

| Función | Devuelve |
|---|---|
| `rol_actual()` | El rol del usuario de la sesión (`perfiles.rol`) |
| `puede_editar()` | `true` para `admin` y `carga` |
| `es_admin()` | `true` para `admin` |
| `obra_visible(obra)` | `true` si es admin o carga, o si el usuario es un inversor con participación en esa obra |

Las tres son `SECURITY DEFINER` con `search_path` fijo, así que no se
pueden secuestrar con objetos de otro esquema.

## Qué puede hacer cada rol

| Tabla | inversor | carga | admin |
|---|---|---|---|
| obras, comprobantes, ventas, avances | Lee las de sus obras | Lee, crea y edita | Además borra |
| aportes | Solo los suyos | Lee, crea y edita | Además borra |
| documentos | Los de sus obras; los reservados solo si son suyos | Lee, crea y edita | Además borra |
| cajas, clases, presupuestos, cuotas, fichas, análisis, niveles, unidades, pedidos | Lee las de sus obras | **Lee, crea, edita y borra** ⚠️ | Lee, crea, edita y borra |
| participaciones | Las de sus obras | **Lee, crea, edita y borra** ⚠️ | Lee, crea, edita y borra |
| inversores | Solo su ficha | **Lee, crea, edita y borra** ⚠️ | Lee, crea, edita y borra |
| rubros, proveedores, índices | Lee | Lee, crea, edita y borra | Lee, crea, edita y borra |
| enlaces | — | Lee, crea, edita y borra | Lee, crea, edita y borra |
| auditoria | — | Lee | Lee |
| perfiles | Solo el suyo | Solo el suyo | Todos; cambia roles |
| cierres (cerrar / reabrir) | Lee | Lee | Cierra y reabre |

⚠️ La regla original era "carga no borra", pero las políticas `*_editar` de
esas tablas son `FOR ALL` y le permiten borrar. Ver el hallazgo N-01 en la
[auditoría](auditoria-2026-10.md).

Las pruebas que verifican esta tabla están en `tests/seguridad/rls-roles.sql`.

## Archivos (Storage)

- Depósitos privados: `comprobantes`, `avance`, `documentos`. Solo imágenes
  y PDF, hasta 15 MB.
- La ruta es `<bucket>/<obra_id>/<archivo>`.
- **Ver:** admin y carga ven todo. Un inversor ve los de `comprobantes` y
  `avance` de sus obras, y de `documentos` solo los que figuran en la tabla
  `documentos` y puede ver (respeta los reservados). Lo decide
  `puede_ver_archivo()`.
- **Subir:** admin y carga. **Borrar:** admin. **Reemplazar:** nadie.
- Se abren con URLs firmadas que vencen a los 5 o 10 minutos.

## Edge Functions

| Función | Quién puede llamarla | Qué valida |
|---|---|---|
| `gestionar-usuarios` | admin | Sesión válida y rol admin; usa la service_role solo después de validar |
| `leer-comprobante` | admin, carga | Sesión válida y `puede_editar()`; tamaño máximo |
| `asistente` | admin, carga | Igual que la anterior; textos recortados |
| `rendicion` | Cualquiera con un enlace | Token válido, activo y no vencido; devuelve solo lo de ese inversor, y de los demás solo totales por clase |

Tener el encabezado `Authorization` **no alcanza**: la publishable key
también viaja ahí. Por eso las funciones llaman a `auth.getUser()`.

## Claves

| Clave | Dónde vive | ¿Es secreta? |
|---|---|---|
| Publishable key (`sb_publishable_...`) | `public/config.js` | No: está pensada para el navegador |
| Service role / secret key | Solo dentro de las Edge Functions (la inyecta Supabase) | **Sí. Nunca en el repo ni en el navegador** |
| `ANTHROPIC_API_KEY` | Secretos de Edge Functions de cada proyecto | **Sí** |
| Contraseña de la base | Solo la persona responsable | **Sí** |

## Headers del sitio

`vercel.json` agrega `X-Frame-Options: DENY`, `X-Content-Type-Options:
nosniff`, `Referrer-Policy` y `Permissions-Policy`.

## Verificar la seguridad

```bash
npm run test:seguridad        # contra el entorno de .env.local
```

El sondeo intenta, sin iniciar sesión, leer todas las tablas y vistas,
ejecutar funciones, listar archivos, registrarse y usar las Edge Functions.
Tiene que terminar en **SIN FALLAS**. Para staging se puede agregar
`--escritura`, que además intenta escribir.

Las pruebas por rol (`rls-roles.sql`) y de integridad (`integridad.sql`)
se corren **solo en staging**, después de cargar `rls-preparar.sql`.

## Pendiente de decisión

- Un inversor ve las participaciones (montos suscriptos, sin nombres) de los
  otros inversores de su obra.
- Un inversor ve el catálogo de proveedores.

Ambas cosas funcionan así por diseño; si se decide restringirlas, se cambian
las políticas `part_ver` y `prov_ver` con una migración.
