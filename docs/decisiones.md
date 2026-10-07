# Decisiones

Registro breve de por qué algunas cosas son como son. Cuando se toma una
decisión de diseño que no es obvia, se agrega acá.

## Un proyecto de Supabase por cliente

**Decisión:** cada cliente tiene su propio proyecto (base, usuarios y
archivos separados), en lugar de una base compartida con una columna de
cliente en cada tabla.

**Por qué:** se manejan datos financieros de inversores. Con proyectos
separados, un error en una política de seguridad nunca expone un cliente a
otro. El esquema actual ya estaba pensado así y no requiere cambios.

**Costo:** cada cambio de base se aplica en cada proyecto (por eso las
migraciones versionadas y la huella del esquema), y cada proyecto necesita
plan Pro.

## Un único proyecto de Vercel para todos los clientes

**Decisión (fase 7):** un solo proyecto de Vercel con un subdominio de
`metroclaro.com.ar` por cliente. Según el dominio, `vercel.json` entrega el
`config.js` de ese cliente (`public/clientes/<id>.js`), generado desde
`clientes.json`. Un dominio desconocido recibe staging.

**Por qué:** un proyecto de Vercel por cliente no ahorraba nada (Vercel no
cobra por proyecto) y multiplicaba la configuración manual (variables de
entorno por proyecto, donde un error apunta un cliente a la base de otro).
Con un solo proyecto, el registro de clientes está versionado, se revisa en
un pull request y lo cubren las pruebas. Dar de alta un cliente es una
entrada en `clientes.json` y un subdominio.

**Costo:** `clientes.json` lista a todos los clientes, por eso el repositorio
tiene que ser **privado**. Un merge a `main` llega a todos a la vez.

## Frontend sin framework ni build

**Decisión:** HTML y JavaScript plano, publicado tal cual.

**Por qué:** es como se construyó, funciona, y no hay paso de compilación que
pueda fallar.

## El frontend dividido en scripts clásicos, no en módulos ES

**Decisión (fase 6):** el antiguo `app.js` (3.900 líneas) se dividió en 27
archivos en `public/js/nucleo/`, `vistas/` y `formularios/`, que se cargan
como scripts clásicos en orden y comparten el ámbito global.

**Por qué:** la interfaz usa cientos de manejadores `onclick="funcion(…)"`
que buscan funciones globales. Con módulos ES habría que exportar cada una
a mano, con mucho riesgo de romper algo. Con scripts clásicos el
comportamiento es idéntico: el corte se hizo sin tocar una línea de código
y se verificó que cada archivo coincide exactamente con su tramo del
original. Lo único que cambió de lugar es el arranque, que pasó al final.

**Costo:** el ámbito es global, así que los nombres tienen que ser únicos y
el orden de carga importa (ver `public/js/README.md`). Dos pruebas
unitarias lo controlan. Si en el futuro se agrega un build (Vite, por
ejemplo), el paso natural es convertir estos archivos en módulos.

## Los cálculos se hacen en el navegador

**Decisión:** totales, honorarios y participaciones se calculan en el
navegador (`public/js/nucleo/calculos.js`) sobre los datos que el RLS deja ver. Las vistas `v_*` de la base
no se usan.

**Por qué:** así se escribió la aplicación. Las vistas quedaron con
`security_invoker` y sin acceso desde la API para que no sean una vía de
filtración. Si en el futuro se quieren usar (por ejemplo, para un Excel
conectado o un reporte), hay que darles permiso `select` solo a
`authenticated` y verificar que respeten el RLS.

## Staging con el mismo esquema y datos ficticios

**Decisión:** un proyecto `metroclaro-staging` con las mismas migraciones que
producción y datos de `seed.sql`.

**Por qué:** las pruebas de seguridad que escriben, las pruebas por rol y
cualquier cambio de base se hacen ahí primero. Producción solo recibe lo que
ya pasó por staging.

## Migración base reconstruida desde producción

**Decisión:** `20261007000000_esquema_base.sql` se armó leyendo el catálogo
de la base real, y reemplazó a `instalar-sistema.sql` y a las
migraciones 2 a 13.

**Por qué:** esos archivos no coincidían con la base real, y el instalador
producía una aplicación que no funcionaba. La reconstrucción se verificó
comparando huellas: staging quedó idéntico a producción en columnas,
constraints, índices, políticas, funciones, disparadores, vistas y buckets.

## Los cobros de cuotas no mueven el saldo de caja

**Estado actual:** el saldo de una caja suma aportes y resta comprobantes
pagados. Las ventas cobradas y las cuotas cobradas registran una caja pero
**no** entran en ese saldo. Si se decide que sí deben entrar, es un cambio en
`saldoCaja()` y en la documentación de cálculos.
