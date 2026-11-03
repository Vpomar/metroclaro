# 11 · Privacidad y datos personales

Cómo trata metroclaro los datos personales, según ISO 27701 y la Ley 25.326
de Protección de Datos Personales (Argentina). Complementa
[10 · Cumplimiento](10-cumplimiento.md).

## Roles

- **Responsable del tratamiento:** cada cliente (la desarrolladora o
  fiduciaria que administra las obras). Decide qué datos carga y para qué.
- **Encargado del tratamiento:** quien opera metroclaro, que procesa los
  datos por cuenta del cliente y solo para prestar el servicio.
- **Subencargados:** los proveedores de la tabla de abajo.

Esto tiene que quedar escrito en el contrato con cada cliente (ISO 27701
8.2.1).

## Inventario de datos personales

| Titular | Datos | Dónde | Finalidad | Base legal |
|---|---|---|---|---|
| Inversores | Nombre, CUIT, email, participación, aportes, unidades, ventas y cuotas | `inversores`, `participaciones`, `aportes`, `ventas`, `cuotas`, `documentos` | Administrar el fideicomiso y rendir cuentas | Contrato de fideicomiso; obligación legal contable |
| Usuarios de la app | Email, nombre, rol, último acceso | Supabase Auth, `perfiles` | Control de acceso | Relación contractual |
| Compradores | Nombre, CUIT, unidad, cuotas | `ventas`, `cuotas` | Cobranza | Contrato de compraventa |
| Proveedores (personas humanas) | Razón social, CUIT | `proveedores`, `comprobantes` | Registro de gastos | Obligación legal contable |
| Todos los anteriores | Copia de cada cambio | `auditoria` | Trazabilidad e integridad | Interés legítimo; obligación de conservar registros |

**No se tratan datos sensibles** (salud, origen, religión, etc.). Si algún
documento los trae (por ejemplo, un DNI escaneado), se guarda en el depósito
`documentos` marcado como reservado.

## Proveedores (subencargados)

| Proveedor | Qué recibe | Dónde | Para qué |
|---|---|---|---|
| Supabase | Toda la base y los archivos | Región del proyecto (ver panel) | Base de datos, Auth, Storage, Edge Functions |
| Vercel | Solo el sitio estático; no ve datos | Global (CDN) | Publicación del sitio |
| Anthropic | La imagen o PDF del comprobante y la descripción de la ficha de obra, solo cuando se usa la lectura con IA o el asistente | Estados Unidos | Lectura de comprobantes y redacción |
| GitHub | Código; nunca datos | Estados Unidos | Repositorio y CI |
| dolarapi.com | Nada personal (solo se consulta la cotización) | — | Cotización del dólar |

**Transferencia internacional:** Supabase (según la región) y Anthropic
procesan datos fuera de Argentina. Estados Unidos no tiene nivel adecuado
según la AAIP, así que hace falta un contrato con cláusulas modelo o el
consentimiento del titular (Ley 25.326, art. 12; Disposición AAIP 60/2016).
Acción: firmar los DPA de cada proveedor y archivarlos.

**Minimización con la IA:** la app primero lee el QR de ARCA y el texto
del comprobante en el navegador; solo llama a Anthropic si todavía falta
algo. Los comprobantes son de proveedores (gastos de obra), no de
inversores. La API de Anthropic no usa los datos para entrenar modelos.

## Retención

| Dato | Plazo | Cómo se aplica |
|---|---|---|
| Registros contables (aportes, comprobantes, ventas, cuotas) | 10 años desde el cierre del ejercicio (CCyC art. 328) | Se conservan en la base |
| Historial (`auditoria`) | 10 años | `purgar_auditoria()`; la base impide borrar antes |
| Usuarios de la app | Mientras tengan relación con el cliente | Baja en la revisión trimestral de accesos |
| Enlaces de rendición | Hasta su vencimiento; dar de baja los que ya no se usan | Revisión trimestral |
| Respaldos locales (`respaldos/`, JSON descargados) | Los últimos 12 mensuales | Borrado manual; guardar **cifrados** (BitLocker / FileVault o un archivo con contraseña) |
| Al terminar el contrato con un cliente | Entregar sus datos y borrar el proyecto de Supabase dentro de 90 días, salvo obligación legal | Procedimiento de baja de cliente |

## Derechos del titular (Ley 25.326, arts. 14 a 16)

El titular (normalmente un inversor) puede pedir **acceso**, **rectificación**,
**actualización** o **supresión** de sus datos. Plazos legales: 10 días
corridos para el acceso y 5 días hábiles para rectificar o suprimir.

1. **Recibir el pedido** y verificar la identidad del titular (por ejemplo,
   desde el email registrado en su ficha).
2. **Registrar** el pedido: fecha, titular, qué pide.
3. **Acceso:** un administrador ejecuta, con su sesión:

   ```js
   const { data } = await sb.rpc('exportar_datos_inversor', { p_inversor: '<id del inversor>' });
   ```

   Devuelve todo lo del inversor (ficha, usuario, participaciones, aportes,
   ventas, cuotas, documentos, enlaces sin el token e historial). La
   exportación queda registrada en `auditoria`. Entregar el resultado por un
   canal seguro.
4. **Rectificación:** corregir la ficha desde la app; el cambio queda en el
   historial.
5. **Supresión:** los movimientos contables **no se borran** mientras rija
   el plazo de conservación legal (art. 16: la supresión no procede cuando
   existe una obligación legal de conservar los datos). Sí se puede: dar de baja el usuario, los enlaces
   de rendición y los documentos no obligatorios. Responder al titular
   explicando qué se suprimió y qué se conserva y por qué.
6. **Cerrar** el registro con la fecha de respuesta.

## Privacidad desde el diseño (ISO 27701 7.4)

- Un inversor solo ve lo de sus obras; de los demás inversores, solo totales
  por clase (RLS y función `rendicion`).
- Los documentos reservados solo los ve su titular y el equipo.
- El portal de rendición no expone la base: una Edge Function arma solo lo
  necesario.
- Los enlaces de rendición vencen y se pueden dar de baja; las fotos se
  firman por 10 minutos; la página no se indexa ni guarda en caché.
- La sesión se cierra sola a los 30 minutos sin uso.
- Staging usa solo datos ficticios (`seed.sql`); nunca se copian datos
  reales a staging ni al repositorio.

## Incidentes con datos personales

Ver [12 · Incidentes](12-incidentes.md). Si se comprometieron datos
personales, evaluar la notificación a la AAIP y a los titulares afectados
(Resolución AAIP 47/2018 recomienda notificar los incidentes de seguridad).
