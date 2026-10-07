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

## Frontend sin framework ni build

**Decisión:** HTML y JavaScript plano, publicado tal cual.

**Por qué:** es como se construyó, funciona, y no hay paso de compilación que
pueda fallar. Se puede revisar a futuro si `app.js` sigue creciendo.

## Los cálculos se hacen en el navegador

**Decisión:** totales, honorarios y participaciones se calculan en
`app.js` sobre los datos que el RLS deja ver. Las vistas `v_*` de la base
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
