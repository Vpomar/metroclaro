# 12 · Respuesta a incidentes

Qué hacer si se sospecha un problema de seguridad: una clave filtrada, un
acceso que no corresponde, datos de un inversor vistos por otro, un
dispositivo perdido con la sesión abierta. SOC 2 CC7.3–CC7.5 · ISO 27001
A.5.24–A.5.28 · ISO 27701 6.13.

**Ante la duda, se trata como incidente.** Es más barato descartarlo que
descubrirlo tarde.

## Severidad

| Nivel | Ejemplos | Respuesta |
|---|---|---|
| Crítico | Clave de servicio o `ANTHROPIC_API_KEY` filtrada; datos de inversores expuestos a terceros; base alterada sin autorización | Inmediata, cualquier día y hora |
| Alto | Cuenta `admin` o `carga` comprometida; un inversor ve datos de otro | En el día |
| Medio | Enlace de rendición reenviado a quien no corresponde; dispositivo perdido con sesión | En 48 horas |
| Bajo | Intentos fallidos de acceso; vulnerabilidad reportada sin explotación | En la semana |

## Pasos

1. **Registrar.** Abrir un registro (un issue privado o un documento):
   qué se vio, cuándo, quién lo detectó. Anotar todo con hora.
2. **Contener**, según el caso:
   - *Clave filtrada:* rotarla ya. Supabase → Settings → API (secret key) o
     `supabase secrets set ANTHROPIC_API_KEY=...`; revocar la anterior en el
     panel del proveedor.
   - *Cuenta comprometida:* en Usuarios, cambiar el rol a `inversor` o
     eliminar el usuario; en Supabase → Auth, cerrar sus sesiones.
   - *Enlace de rendición:* darlo de baja en Control → Enlaces.
   - *Dispositivo perdido:* cerrar las sesiones de ese usuario en Supabase → Auth
     y cambiar su contraseña.
   - *Cambio de base no autorizado:* no tocar nada más; respaldo inmediato
     (`scripts/respaldo.bat`) para conservar la evidencia.
3. **Investigar.** Fuentes:
   - Historial de la app (`auditoria`): quién cambió qué y cuándo. Es
     inmutable, así que es confiable.
   - Supabase → Logs: Auth (inicios de sesión, IPs), API, Edge Functions.
   - Vercel → Logs y GitHub → historial de la rama `main`.
4. **Corregir** la causa con el flujo normal (rama, PR, staging) salvo que
   la urgencia exija otra cosa; en ese caso, documentar la excepción.
5. **Notificar** si hubo datos personales comprometidos:
   - Al **cliente** (responsable del tratamiento) sin demora y dentro de las
     **48 horas** de confirmado: qué pasó, qué datos, a quiénes afecta y qué
     se hizo.
   - El cliente evalúa notificar a la **AAIP** y a los **titulares**
     (Resolución AAIP 47/2018). Se le da toda la información que necesite.
6. **Cerrar.** Completar el registro: causa, impacto, acciones y lecciones.
   Si cambió algo del sistema, actualizar la documentación y, si
   corresponde, agregar una prueba que lo detecte.

## Contactos

Completar y mantener actualizado:

| Rol | Nombre | Contacto |
|---|---|---|
| Responsable de seguridad | | |
| Responsable de datos personales | | |
| Contacto técnico de cada cliente | | |
| Soporte de Supabase | | https://supabase.com/dashboard/support |
| Soporte de Vercel | | https://vercel.com/help |
