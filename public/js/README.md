# public/js — código de la aplicación

La aplicación son **scripts clásicos** (no módulos ES) que comparten el
ámbito global: una función definida en un archivo se puede usar desde
cualquier otro, y desde los `onclick="…"` del HTML. No hay build: el
navegador carga los archivos tal cual, en el orden de `index.html`.

## Mapa

| Archivo | Contenido |
|---|---|
| **nucleo/** | |
| `nucleo/base.js` | Cliente de Supabase (`sb`), estado global (`perfil`, `D`, `obraActiva`, `vista`, filtros), formatos (`fmtUsd`, `fecha`), fechas (`fechaLocal`, `hoy`, `sumarMeses`), `esc`, `puedeEditar`, `esAdmin`, `aviso` |
| `nucleo/datos.js` | `todo(tabla)` (lectura paginada) y `cargarDatos()` |
| `nucleo/calculos.js` | Consultas sobre `D` (`gastosDe`, `aportesDe`, `rubro`, …) y todos los cálculos: unidades, CAC y cuotas, análisis, superficies, cierre, honorarios, participación, totales, cajas, proveedores |
| `nucleo/cotizacion.js` | Dólar de referencia (dolarapi.com) |
| `nucleo/render.js` | `render()`, `dibujar()`, pestañas y navegación (`verObra`, `verTab`); `envolverTablas()` y el menú plegable de celular (`tglMenu`) |
| `nucleo/escritura.js` | `guardar()`, `borrar()` y cambios directos; verifican las filas afectadas |
| `nucleo/exportar.js` | Exportaciones a Excel |
| `nucleo/inicio.js` | Arranque: login, sesión, `iniciar()`, registro de manejadores en `window` y tecla Escape. **Se carga último** |
| **vistas/** | Una o más pestañas por archivo: funciones `v<Nombre>(obra)` que devuelven HTML |
| `vistas/panel-resumen.js` | Panel general, Resumen, ficha técnica y costo por metro |
| `vistas/unidades.js` | Unidades |
| `vistas/analisis.js` | Análisis económico |
| `vistas/cajas-comprobantes.js` | Cajas y Comprobantes |
| `vistas/rubros-honorarios-proveedores.js` | Rubros, Honorarios y Proveedores |
| `vistas/inversores.js` | Inversores y calculador de aportes |
| `vistas/avance.js` | Avance |
| `vistas/control.js` | Historial, cierre de período y enlaces de rendición |
| `vistas/ventas.js` | Ventas, planes de cuotas y cobros |
| `vistas/documentos.js` | Documentos |
| `vistas/contador-rendicion.js` | Contador y Rendición |
| `vistas/indices.js` | Índices CAC |
| `vistas/usuarios.js` | Usuarios y respaldos |
| **formularios/** | Ventanas para crear y editar |
| `formularios/base.js` | `modal()`, `cerrar()`, `val()`, `opciones()` |
| `formularios/comprobante.js` | Comprobante |
| `formularios/aporte.js` | Aporte |
| `formularios/fichas.js` | Inversor, participación, caja, rubro y obra |
| `formularios/avance-archivos.js` | Avance, subida y apertura de archivos |
| `formularios/lectura-ia.js` | Lectura de comprobantes con IA |

## Orden de carga

Lo define `index.html` y **importa**:

1. `nucleo/base.js` primero: declara `sb` y el estado que usa todo lo demás.
2. Después, núcleo, vistas, escritura, formularios y exportaciones. Entre
   ellos el orden casi no importa, porque solo declaran funciones que se
   usan cuando el usuario interactúa.
3. `nucleo/inicio.js` **último**: es el único que ejecuta código al cargar
   (inicia la sesión, llama a `cargarDatos()`, registra los manejadores).
   Si se ejecutara antes, podría llamar a funciones todavía no definidas.

Regla: **ningún archivo, salvo `inicio.js`, ejecuta código al cargar** que
use funciones de otro archivo. Solo declara funciones, constantes y estado.

## Cómo agregar código

- **Una pestaña nueva:** un archivo en `vistas/` con su función `vNombre(o)`;
  agregarla al mapa de `dibujar()` en `nucleo/render.js` y a la lista `TABS`.
- **Un formulario nuevo:** un archivo en `formularios/` (o en el de su tema).
- **Un cálculo nuevo:** en `nucleo/calculos.js`, con su prueba en
  `tests/unit/calculos.test.js` (exponerlo en `EXPORTAR` de
  `tests/unit/cargar-app.js`).
- **Un archivo nuevo:** agregar su `<script>` en `index.html` antes de
  `nucleo/inicio.js`. La prueba "index.html carga todos los archivos de
  js/" falla si se olvida.
- Nombres únicos: como el ámbito es global, dos funciones con el mismo nombre
  en archivos distintos se pisan. La prueba "cada función se define una sola
  vez" lo detecta.

Convenciones de seguridad y de código: ver `AGENTS.md`.
