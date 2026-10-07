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

## Lectura de comprobantes con IA

Al cargar un comprobante se puede subir la foto o el PDF: Claude completa los
campos. **Siempre revisar** antes de guardar, en especial el neto, el IVA y
las percepciones (si no suman el total, la app avisa). Cada lectura cuesta
centavos de dólar.

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
