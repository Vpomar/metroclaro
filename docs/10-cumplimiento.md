# 10 · Cumplimiento: SOC 2, ISO 27001 e ISO 27701

Mapa de los controles de metroclaro contra los tres marcos: qué está
implementado, dónde se ve la evidencia y qué falta. Sirve para preparar una
auditoría y para saber qué no hay que romper.

> **Alcance.** Este documento cubre lo técnico: código, base, infraestructura
> y procesos de desarrollo. Una certificación también exige controles de
> organización (políticas firmadas, análisis de riesgos, capacitación,
> contratos). Esos figuran en la sección [Pendientes de la organización](#pendientes-de-la-organización):
> el software no los puede resolver.

Referencias: SOC 2 = Trust Services Criteria 2017 (rev. 2022). ISO 27001 =
anexo A de la versión 2022. ISO 27701 = cláusulas 7 (responsable del
tratamiento) y 8 (encargado).

## Estado de un vistazo

| Área | Estado |
|---|---|
| Control de acceso y roles | ✅ Implementado y probado (RLS, pruebas por rol) |
| Registro de auditoría | ✅ Completo, inmutable, con autor en acciones de administración |
| Cifrado en tránsito y en reposo | ✅ Lo dan Vercel y Supabase; HSTS en el sitio |
| Protección del navegador | ✅ CSP, SRI, headers de seguridad |
| Gestión de cambios | ✅ Ramas, pull request, CI obligatoria, staging primero |
| Gestión de vulnerabilidades | ✅ `npm audit` y gitleaks en la CI; Dependabot |
| Datos personales (27701) | 🟡 Inventario, retención y derecho de acceso listos; faltan acuerdos con proveedores |
| MFA | 🟡 Pendiente: hay que configurarlo en Supabase Auth (ver abajo) |
| Continuidad (respaldos, PITR) | 🟡 Respaldos manuales; PITR depende del plan de Supabase |
| Controles de organización | 🔴 Fuera del software (ver pendientes) |

## Controles técnicos

### Acceso lógico — SOC 2 CC6.1–CC6.3 · ISO 27001 A.5.15, A.5.18, A.8.2, A.8.3, A.8.5

| Control | Implementación | Evidencia |
|---|---|---|
| Mínimo privilegio por rol | `admin` / `carga` / `inversor`; políticas RLS separadas por operación; `carga` nunca borra | `docs/04-seguridad.md`, `tests/seguridad/rls-roles.sql` |
| Sin acceso anónimo | `anon` sin permisos en `public`; sondeo en cada PR | `tests/seguridad/sondeo-anon.mjs` (CI) |
| Sin registro público | Altas solo desde el panel de Usuarios (admin) | Configuración de Auth, `gestionar-usuarios` |
| Alta, cambio de rol y baja trazados con autor | `gestionar-usuarios` registra en `auditoria` al administrador que actuó | Tabla `auditoria`, `tabla = 'usuarios'` |
| Revisión periódica de accesos | El panel de Usuarios muestra rol y último acceso de cada cuenta | Procedimiento en [Operación periódica](#operación-periódica) |
| Contraseñas de 12+ caracteres | Validado en la app y en la Edge Function | `tests/unit/seguridad-codigo.test.js` |
| Cierre por inactividad | La sesión se cierra a los 30 minutos sin actividad | `public/js/nucleo/inicio.js` (`vigilarInactividad`) |
| Validación de sesión en el servidor | Las Edge Functions usan `auth.getUser()` y el rol | `supabase/functions/*` |
| Enlaces de rendición | Token aleatorio de 192 bits, vencimiento, baja, contador de visitas; fotos firmadas por 10 minutos | `supabase/functions/rendicion` |

### Registro y monitoreo — SOC 2 CC7.2, CC7.3 · ISO 27001 A.8.15, A.8.16

| Control | Implementación | Evidencia |
|---|---|---|
| Historial de cambios de datos | Disparador `auditar` en todas las tablas de negocio, con antes y después | `registrar_cambio()` |
| Historial inmutable | `UPDATE`, `DELETE` y `TRUNCATE` sobre `auditoria` fallan para todos, incluida la clave de servicio | Migración `hardening_cumplimiento`, `tests/seguridad/integridad.sql` |
| Retención | 10 años; `purgar_auditoria()` solo borra lo anterior y deja constancia | Migración `hardening_cumplimiento` |
| Exportaciones de datos personales | Cada exportación queda en el historial (`accion = 'exportacion'`) | `exportar_datos_inversor()` |
| Accesos (inicios de sesión) | Los registra Supabase Auth (`auth.audit_log_entries` y logs del proyecto) | Panel de Supabase → Logs |

### Seguridad de la aplicación — SOC 2 CC6.6, CC6.7, CC8.1 · ISO 27001 A.8.9, A.8.23, A.8.25–A.8.28

| Control | Implementación | Evidencia |
|---|---|---|
| Content-Security-Policy | Solo scripts propios y de jsDelivr con SRI; conexiones solo a Supabase y dolarapi; sin `eval`, sin `object`, sin marcos | `vercel.json`, prueba e2e y unitaria |
| HSTS, COOP, nosniff, X-Frame-Options, Permissions-Policy | En todas las respuestas | `vercel.json` |
| La rendición no filtra el token | `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, `noindex` | `vercel.json` |
| CORS restringido | Las Edge Functions solo aceptan navegadores desde los dominios de la app; el resto recibe 403 | `supabase/functions/_shared/http.ts` |
| Respuestas sin caché | `Cache-Control: no-store` en todas las Edge Functions | `_shared/http.ts` |
| XSS | `esc()` obligatorio, nada de texto en `onclick` | `tests/unit/seguridad-codigo.test.js` |
| Integridad de librerías | Versión exacta + SRI o copia en `public/vendor` verificada | `tests/unit/vendor.test.js` |
| Mismo entorno de headers en local y en CI | `servidor-local.mjs` aplica los headers de `vercel.json` | e2e |

### Gestión de cambios — SOC 2 CC8.1 · ISO 27001 A.8.25, A.8.31, A.8.32

| Control | Implementación |
|---|---|
| Separación de entornos | Staging con datos ficticios; producción solo recibe lo probado (`AGENTS.md`) |
| Revisión antes de producción | Todo entra por pull request; prohibido el push directo a `main` |
| Pruebas automáticas obligatorias | CI: unitarias, sondeo de seguridad, e2e, dependencias y secretos |
| Cambios de base versionados | Migraciones en `supabase/migrations/`, huella de esquema comparada entre entornos |

> **Recomendado:** activar en GitHub la protección de la rama `main`
> (requerir PR, aprobación y CI en verde; bloquear force-push). Hoy la regla
> está escrita en `AGENTS.md`, pero GitHub no la hace cumplir.

### Vulnerabilidades — SOC 2 CC7.1 · ISO 27001 A.8.8, A.8.12

| Control | Implementación |
|---|---|
| Dependencias con vulnerabilidades | `npm audit --audit-level=high` en la CI |
| Secretos en el repositorio | gitleaks sobre todo el historial en la CI (`.gitleaks.toml`) |
| Actualizaciones | Dependabot semanal (npm) y mensual (GitHub Actions) |
| Reporte de vulnerabilidades | `SECURITY.md` |
| Auditorías | `docs/auditoria-2026-10.md` |

### Criptografía — SOC 2 CC6.1, CC6.7 · ISO 27001 A.8.24

- En tránsito: TLS en Vercel y Supabase; HSTS de 2 años en el sitio.
- En reposo: la base y el Storage de Supabase están cifrados (AES-256) por el proveedor.
- Claves secretas: solo como secretos de las Edge Functions; nunca en el
  repo ni en el navegador (`docs/04-seguridad.md`, prueba unitaria).

### Disponibilidad y continuidad — SOC 2 A1.2, A1.3 · ISO 27001 A.5.30, A.8.13, A.8.14

| Control | Estado |
|---|---|
| Respaldos de datos y archivos | Manuales, documentados en `docs/08-respaldos.md` |
| Prueba de restauración | `scripts/verificar-respaldo.html` |
| Backups automáticos / PITR | **Depende del plan de Supabase.** Con datos reales, usar plan Pro y considerar PITR |
| Aislamiento entre clientes | Un proyecto de Supabase por cliente (`docs/decisiones.md`) |

## Configuración que no vive en el repositorio

Estos controles se configuran en paneles. Revisarlos en **cada** proyecto de
Supabase (cada cliente y staging) y dejar constancia de la fecha:

| Dónde | Qué | Marco |
|---|---|---|
| Supabase → Auth → Providers | Registro público **desactivado** | CC6.2 · A.5.16 |
| Supabase → Auth → Password | Largo mínimo **12**; protección contra contraseñas filtradas (HaveIBeenPwned) activada | CC6.1 · A.5.17 |
| Supabase → Auth → MFA | Habilitar TOTP. **Exigirlo a los `admin`** (ver nota) | CC6.1 · A.8.5 |
| Supabase → Auth → Sessions | Duración máxima de sesión e inactividad (plan Pro) | CC6.1 · A.8.5 |
| Supabase → Auth → Rate limits | Revisar los límites de inicio de sesión y de correos | CC6.6 |
| Supabase → Database → Backups | Backups diarios / PITR (plan Pro) | A1.2 · A.8.13 |
| Supabase → Settings → Network | Forzar SSL en la base; restringir IPs si se usa conexión directa | CC6.6 · A.8.20 |
| Supabase → Edge Functions → Secrets | `ORIGENES_PERMITIDOS` en producción, sin `localhost` | CC6.6 |
| Supabase → Organization | MFA y mínimo de miembros con acceso al panel | CC6.2 · A.8.2 |
| Vercel → Team | MFA para todos; mínimo de miembros | CC6.2 · A.8.2 |
| GitHub → Repo | Privado; protección de `main`; MFA obligatorio en la organización | CC8.1 · A.8.4 |

> **MFA para administradores.** La base ya puede exigirlo: en las políticas
> de `es_admin()` se puede pedir `auth.jwt() ->> 'aal' = 'aal2'`. No se
> activó todavía porque la app no tiene la pantalla para enrolar el segundo
> factor y dejaría a los admins afuera. Es el próximo paso recomendado:
> pantalla de enrolamiento (`sb.auth.mfa.enroll`) → período de gracia →
> migración que exige `aal2` a los admin.

## Operación periódica

Para que un control cuente en una auditoría tiene que haber evidencia de que
se ejecuta. Llevar un registro (fecha, quién, resultado) de:

| Frecuencia | Tarea | Evidencia |
|---|---|---|
| Mensual | Respaldo de datos y verificación con `verificar-respaldo.html` | Archivo + captura de los totales |
| Trimestral | **Revisión de accesos:** en Usuarios, dar de baja cuentas sin uso y roles que no corresponden; dar de baja enlaces de rendición vencidos | Lista revisada y cambios hechos (quedan en `auditoria`) |
| Trimestral | Revisar la configuración de la tabla anterior en cada proyecto | Captura o nota con fecha |
| Semestral | Prueba de restauración completa en staging | Nota con el resultado |
| Anual | Auditoría de seguridad (como `auditoria-2026-10.md`) y revisión de este documento | Documento nuevo en `docs/` |
| Anual | Revisión de proveedores y sus certificaciones (`docs/11-privacidad.md`) | Lista actualizada |
| Ante un incidente | Seguir `docs/12-incidentes.md` | Registro del incidente |

## Pendientes de la organización

Controles que exigen los tres marcos y que no se resuelven con código.
Sin ellos no hay certificación posible:

- **Política de seguridad de la información** aprobada por la dirección (A.5.1 · CC1.1, CC5.3).
- **Análisis y tratamiento de riesgos** documentado y revisado una vez por año (cláusula 6.1 de 27001 · CC3.1–CC3.4).
- **Declaración de aplicabilidad** (SoA) de ISO 27001: puede partir de este documento.
- **Roles y responsabilidades:** responsable de seguridad y responsable de datos personales designados (A.5.2 · 27701 6.3.1.1).
- **Capacitación** en seguridad y privacidad para todo el que use la app con rol `admin` o `carga` (A.6.3 · CC1.4).
- **Acuerdos de confidencialidad** con personal y contratistas (A.6.6).
- **Gestión de proveedores:** revisar y archivar los informes SOC 2 / ISO de Supabase, Vercel, Anthropic y GitHub, y firmar sus DPA (A.5.19–A.5.22 · CC9.2 · 27701 7.5, 8.5).
- **Contratos con clientes** que definan quién es responsable y quién encargado del tratamiento (27701 7.2.6, 8.2.1).
- **Registro de la base de datos** ante la AAIP (Ley 25.326, art. 21).
- **Plan de continuidad** con objetivos de recuperación (RTO/RPO) acordados (A.5.29, A.5.30 · A1.3).
- **Gestión de dispositivos:** las computadoras y celulares que usan la app con rol `admin` o `carga` con bloqueo de pantalla, disco cifrado y sistema actualizado (A.8.1).
