# 01 · Qué es y para qué sirve

metroclaro administra la parte económica de obras en construcción, en
especial las que se desarrollan bajo un **fideicomiso** con varios
inversores. Responde preguntas como:

- ¿Cuánto aportó cada inversor y qué porcentaje de la obra le corresponde?
- ¿Cuánto se gastó, en qué rubro y contra qué presupuesto?
- ¿Cuánto se le debe a cada proveedor y desde cuándo?
- ¿Cuánta plata hay en cada caja (efectivo, mutual, banco)?
- ¿Cuánto se devengó de honorarios de conducción, administración y desarrollo?
- ¿Qué unidades se vendieron, en cuántas cuotas y cuánto falta cobrar?
- ¿Qué se le muestra a cada inversor en su rendición de cuentas?

## Usuarios y roles

| Rol | Quién es | Ve | Carga y edita | Borra | Gestiona usuarios |
|---|---|---|---|---|---|
| `admin` | El estudio / administrador del fideicomiso | Todo | Sí | Sí | Sí |
| `carga` | Personal que carga movimientos | Todo | Sí | No | No |
| `inversor` | Inversor con usuario propio | Solo las obras donde participa, y de ellas solo lo que le corresponde | No | No | No |
| Sin usuario | Inversor con un enlace de rendición | Solo su rendición de esa obra | No | No | No |

Detalle de qué ve un inversor:

- Las obras donde tiene una participación.
- Sus propios aportes (no los de los demás).
- Los comprobantes, presupuestos, avance y documentos de esas obras.
- Los documentos *reservados* solo si están asignados a él.
- No ve el historial de cambios, los enlaces ni la gestión de usuarios.

Un usuario con rol `inversor` que no esté vinculado a una ficha de inversor
no ve ninguna obra.

## Pantallas

### Panel general
Todas las obras juntas: aportes, ejecutado, deuda y disponible de cada una.

### Por obra

| Pestaña | Qué muestra |
|---|---|
| **Resumen** | Aportes, ejecutado, deuda, disponible neto y avance contra el presupuesto |
| **Cajas** | Efectivo, mutual y banco: saldo de cada una y sus aportes. La caja se mueve solo con comprobantes pagados |
| **Comprobantes** | Carga de gastos con foto o PDF (la IA puede leer el comprobante), estado de pago, edición y exportación |
| **Rubros** | Presupuesto por rubro contra lo ejecutado |
| **Honorarios** | Porcentajes de conducción, administración y desarrolladora; proyectado, devengado, pagado y saldo |
| **Proveedores** | Cuenta corriente por proveedor con antigüedad de la deuda |
| **Análisis** | Anteproyecto: superficies por nivel, costo por m² y costo total del emprendimiento |
| **Unidades** | Departamentos, cocheras y locales con su superficie, coeficiente, porcentual y estado |
| **Inversores** | Participaciones por clase (A/B), capital suscripto e integrado de cada uno |
| **Ventas** | Facturas de venta de unidades (se registran, no se emiten ante ARCA), ventas en cuotas en dólares o ajustadas por CAC |
| **Avance** | Fotos de obra y avance físico contra financiero |
| **Documentos** | Legajo: contrato de fideicomiso, adhesiones, boletos, planos, permisos. Pueden ser reservados para un inversor |
| **Contador** | Comprobantes con IVA discriminado, aportes por clase y por mes, ventas del período y cierre de período |
| **Rendición** | Informe para el inversor, listo para imprimir o guardar en PDF; enlaces de rendición |
| **Historial** | Cada alta, cambio y baja con quién la hizo (solo admin y carga) |

### Del panel

| Pestaña | Quién | Qué hace |
|---|---|---|
| **Índices** | admin y carga | Carga mensual del índice CAC (nivel o variación) |
| **Usuarios** | admin | Alta por invitación o con contraseña, roles, vinculación con la ficha de inversor, recuperación, baja, respaldo de datos y de archivos |

## Funciones transversales

- **Cotización del dólar:** se toma el oficial de dolarapi.com (compra,
  venta o promedio, a elección) y se puede cargar a mano. Cada movimiento
  en pesos guarda la cotización de su fecha y su valor en dólares queda fijo.
- **Cierre de período:** el administrador cierra una obra hasta una fecha.
  Desde ese momento no se pueden cargar, editar ni borrar movimientos con
  fecha anterior (aportes, comprobantes, ventas ni cobros de cuotas). Solo
  un administrador puede reabrir, y la reapertura queda en el historial.
- **Enlaces de rendición:** un enlace con vencimiento que el inversor abre
  sin usuario. Se puede revocar en cualquier momento.
- **Lectura de comprobantes con IA:** se sube la foto o el PDF y Claude
  completa fecha, proveedor, CUIT, importes e IVA. Siempre se revisa antes
  de guardar.
- **Aplicación instalable (PWA):** se puede agregar a la pantalla de inicio
  del celular y usar la cámara para sacar fotos de comprobantes.
