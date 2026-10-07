# 09 · Operación y soporte

## Usuarios

Todo se hace desde la pestaña **Usuarios** (solo administradores):

- **Alta:** por invitación (recomendado: la persona elige su contraseña) o
  con una contraseña inicial que se le pasa por otro medio.
- **Rol:** admin, carga o inversor. El cambio vale la próxima vez que la
  persona entre o recargue.
- **Vincular un inversor:** un usuario con rol `inversor` tiene que estar
  vinculado a su ficha de inversor; si no, no ve ninguna obra.
- **Recuperar contraseña:** envía el mail de recuperación.
- **Baja:** elimina el usuario. La ficha del inversor se conserva.

Protecciones: nadie puede quitarse a sí mismo el rol de admin ni eliminar su
propio usuario, y la base impide quedarse sin ningún administrador.

## Cierre de período

Cuando se entrega una rendición, un administrador cierra la obra hasta esa
fecha (pestaña **Contador → Cerrar un período**). A partir de ahí no se pueden cargar, editar ni
borrar aportes, comprobantes, ventas ni cobros de cuotas con fecha anterior.
Para corregir algo hay que reabrir; la reapertura queda en el historial.

## Enlaces de rendición

Desde **Rendición → Generar enlace**: se elige el inversor y el vencimiento
(por defecto tres meses). El enlace se copia y se manda. Se puede dar de
baja en cualquier momento y deja de funcionar al instante. Cada enlace
cuenta sus visitas.

El inversor ve su capital integrado, su participación, lo que le falta
integrar, sus cuotas y el estado de la obra. De los demás inversores solo
recibe totales.

## Índice CAC

Una vez por mes, en **Índices**: se carga el nivel del índice o la variación
mensual (como lo publica cifrasonline.com.ar). Las cuotas ajustadas por CAC
se recalculan solas hasta que se cobran; al cobrarse, el importe queda fijo.

## Lectura de comprobantes

Al cargar un comprobante se puede sacar la foto o subir el PDF. La app prueba
en orden y se detiene apenas tiene todos los datos:

| Paso | Qué hace | Costo |
|---|---|---|
| 1. QR de ARCA | Toda factura electrónica lo trae: fecha, CUIT, tipo, número, total y moneda **exactos** | Gratis, instantáneo |
| 2. Texto | PDF digital: su propio texto. Foto o PDF escaneado: OCR en el teléfono. Aporta el desglose de IVA y la razón social | Gratis; el OCR tarda de 3 a 15 s (la primera vez descarga unos 6 MB) |
| 3. IA | Solo si todavía falta algo o los números no cierran. Recibe lo que ya se sabe | Centavos de dólar |

Además:

- Con el CUIT se busca el proveedor en el catálogo: se usan su nombre exacto
  y su rubro (así no aparecen variantes del mismo proveedor).
- Si el total es seguro (QR o PDF) y el desglose no cierra por un dígito mal
  leído, se corrige con la cuenta cuando el IVA da una alícuota real.
- Una Factura A sin IVA y sin importe exento no se da por leída.
- Avisa si el comprobante ya está cargado (mismo CUIT y número), en
  cualquier obra, y pide confirmar antes de guardarlo.
- La foto se guarda achicada en JPEG (las de iPhone en HEIC también).
- Si la IA no está disponible, lo dice y deja lo que leyeron el QR y el texto.

**Siempre revisar** los campos marcados en amarillo antes de guardar (al
pasar el mouse dice de dónde salió cada uno).

Para que la foto se lea bien: el comprobante entero, derecho o de costado,
con buena luz y el QR nítido. Los tiques térmicos arrugados o gastados
suelen necesitar la IA.

Para probar cambios en la lectura sin usar comprobantes reales:
`tests/e2e/lectura.spec.js` (factura ficticia con QR real) y
`tests/unit/lectura.test.js` (formatos de facturas y tiques).

## Problemas frecuentes

| Mensaje o síntoma | Causa y solución |
|---|---|
| "Tu usuario no tiene perfil cargado" | El usuario existe en Auth pero no en `perfiles`. Crearlo desde la pestaña Usuarios o revisar el disparador `al_crear_usuario` |
| "Tu sesión venció. Ingresá de nuevo." | Normal: volver a iniciar sesión |
| No aparece ninguna obra | El usuario es `inversor` y no está vinculado a una ficha, o la ficha no tiene participaciones |
| "No se hizo ningún cambio: tu usuario no tiene permiso…" | El rol no permite esa operación (por ejemplo, `carga` intentando borrar un comprobante) |
| "El período hasta el … está cerrado" | La fecha cae en un período cerrado: un admin tiene que reabrirlo |
| "La caja elegida no pertenece a la obra del movimiento" | Elegir una caja de la misma obra |
| "No se puede quitar al último administrador" | Primero hay que dar rol admin a otra persona |
| "No pude leer el comprobante" | Falta `ANTHROPIC_API_KEY` en la Edge Function, venció o se agotó el saldo |
| Error al subir un archivo | Solo se aceptan imágenes y PDF de hasta 15 MB |
| La cotización no se actualiza | dolarapi.com no respondió: cargarla a mano en el panel lateral |

## Monitoreo

- **Supabase → Advisors (Security y Performance):** revisarlos después de
  cada migración.
- **Supabase → Logs:** errores de la API, de Auth y de las Edge Functions.
- **console.anthropic.com:** consumo y límite de gasto de la clave de IA.
