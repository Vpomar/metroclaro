# Respaldos

Tres cosas distintas que se pierden por motivos distintos. Conviene cubrir las tres.

| Qué | Dónde vive | Si se pierde |
|---|---|---|
| Datos | Base de Supabase | Se pierde toda la contabilidad de las obras |
| Fotos | Storage de Supabase | Se pierden comprobantes y registro de avance |
| Código | Vercel y tu computadora | Se rehace, pero lleva trabajo |

---

## 1. Datos — desde la aplicación

Pestaña **Usuarios** → **Descargar datos**. Baja un archivo JSON con todas las tablas.

Hacelo una vez por mes y antes de cualquier cambio grande. Guardalo donde tengas el resto de los respaldos del estudio, no en la misma computadora.

Es el respaldo más simple y no requiere instalar nada. Sirve para reconstruir todo si algo sale mal, aunque restaurarlo pide trabajo manual.

### Comprobar que el respaldo sirve

Abrí `verificar-respaldo.html` con doble clic y arrastrale el archivo JSON. Te muestra
la fecha, cuántos registros tiene cada tabla, el ejecutado y los aportes de cada obra,
y si hay referencias que no cierran.

La prueba es simple: **esos números tienen que coincidir con el Panel de la aplicación.**
Si dan igual, el respaldo está completo. Hacelo cada tanto, no solo la primera vez.

## 2. Base completa — estructura + datos

Doble clic en `respaldo.bat`. Te pide la contraseña de la base tres veces
y deja una carpeta `respaldo-AAAA-MM-DD` con tres archivos:

- `1-estructura.sql` — tablas, políticas, funciones y vistas
- `2-datos.sql` — todo lo cargado
- `3-roles.sql` — roles y permisos

**Los tres hacen falta.** La estructura sola no recupera nada, y los datos
solos no se pueden cargar en ninguna parte. Para restaurar se corre primero
la estructura y después los datos.

Las fotos y los documentos no están ahí: se bajan aparte desde la pestaña
Usuarios, con "Descargar fotos".

### Lo mismo desde el panel de Supabase

En el proyecto, Settings → Database → Backups, hay un botón de descarga.
Sirve igual y no necesita la terminal.

## 2b. Datos — respaldo completo con la terminal

Más completo que el anterior: incluye la estructura, las políticas y las funciones, no solo los datos. Se restaura de una.

Abrí la terminal en `C:\obras\app-obras` y corré:

```
supabase db dump -f respaldo-completo.sql
```

Te pide la contraseña de la base. Genera un archivo que restaura el proyecto entero.

Para automatizarlo, en la misma carpeta está `respaldo.bat`: doble clic y te deja el archivo con la fecha en el nombre.

## 3. Fotos

Pestaña **Usuarios** → **Descargar fotos**. Abre una descarga por archivo.

Es incómodo si hay muchas, porque el navegador no puede armar un comprimido. Para volúmenes grandes conviene bajarlas desde el panel de Supabase, en Storage, seleccionando la carpeta de la obra.

## 4. Código

Hoy vive en tu computadora y en Vercel. Si perdés las dos, se pierde.

La solución de fondo es subirlo a un repositorio privado en GitHub. Además de respaldarlo, cada cambio queda versionado y podés volver atrás. Y de paso Vercel publica solo cada vez que subís algo, sin arrastrar carpetas.

---

## Backups automáticos de Supabase

El plan gratuito **no tiene backups automáticos**. Si la base se corrompe o alguien borra algo por error, no hay a dónde volver más que a tu último respaldo manual.

El plan Pro cuesta USD 25 por mes e incluye backups diarios con siete días de retención, más restauración a un punto en el tiempo.

Mi recomendación: mientras estén probando, alcanza con el respaldo manual mensual. **En cuanto haya movimientos reales de plata de inversores cargados, pasate a Pro.** Veinticinco dólares por mes es barato al lado de reconstruir la rendición de un fideicomiso a mano.

---

## Qué hacer si algo se rompe

**Borraste un movimiento por error** — cargalo de nuevo. Por eso el rol `carga` no puede eliminar.

**Se corrompió una tabla** — restaurá con el archivo del punto 2:
```
psql "cadena-de-conexion" < respaldo-completo.sql
```
La cadena de conexión está en Project Settings → Database.

**Perdiste el acceso al proyecto de Supabase** — sin backup no hay vuelta atrás. Es el motivo por el que conviene el punto 2 más que el punto 1.

---

## Ensayo de restauración

Un respaldo que nunca restauraste no es un respaldo. Vale la pena hacerlo una vez,
sobre un proyecto de prueba, para saber que funciona antes de necesitarlo.

1. Crear un proyecto nuevo en Supabase, llamarlo `obras-prueba`. Es gratis.
2. Abrir el archivo `respaldo-obras-fecha.sql` con el Bloc de notas, copiar todo.
3. Pegarlo en el SQL Editor del proyecto de prueba y ejecutar.
4. Copiar la carpeta de la aplicación a otra ubicación y, en esa copia, cambiar
   en `config.js` la URL y la clave por las del proyecto de prueba.
5. Abrirla con `python3 -m http.server 8000` y entrar.

Si ves tus obras con sus movimientos, el respaldo sirve. Después borrá el proyecto
de prueba para no dejar datos duplicados dando vueltas.

Si el archivo SQL es muy grande para el editor web, hace falta `psql`, que viene con
PostgreSQL. En ese caso avisame y lo vemos.

**La aplicación dejó de funcionar pero los datos están** — volvé a subir el ZIP a Vercel. Los datos no se tocan: viven en Supabase, no en la aplicación.
