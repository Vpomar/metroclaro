# Puesta en marcha

Ya tenés la base de datos creada. Faltan tres cosas: configurar la clave, desplegar la aplicación y desplegar la función que lee comprobantes.

Los pasos 1 y 2 alcanzan para tenerlo funcionando. El 3 es opcional y se puede hacer después.

---

## Paso 1 — Configurar la clave

Abrí `config.js` y reemplazá `PEGAR_ACA_LA_PUBLISHABLE_KEY` por tu Publishable key, la que empieza con `sb_publishable_`. La Project URL ya está puesta.

La Secret key no va acá ni en ningún otro archivo del proyecto.

Para probar antes de publicar, en la carpeta del proyecto:

```bash
python3 -m http.server 8000
```

Y abrí `http://localhost:8000` en el navegador. Abrir el `index.html` con doble clic no funciona: el navegador bloquea las peticiones desde `file://`.

---

## Paso 2 — Publicar en Vercel

**Con GitHub**, que es lo recomendable:

1. Crear un repositorio nuevo en github.com. Ponelo **privado**.
2. Subir los archivos (se pueden arrastrar desde la web de GitHub).
3. Entrar a vercel.com, registrarse con GitHub.
4. **Add New → Project**, elegir el repositorio, **Deploy**.
5. No hay que configurar nada: es un sitio estático.

Queda en una dirección tipo `https://obras-tuusuario.vercel.app`. Cada vez que subas un cambio a GitHub, se publica solo.

**Sin GitHub**, más rápido pero manual: entrá a vercel.com/new, buscá la opción de subir carpeta, y arrastrá los archivos. Cada cambio hay que volver a subirlo a mano.

### Instalarla en el celular

Abrí la dirección en Chrome, menú de tres puntos, **Agregar a pantalla de inicio**. Queda con ícono propio y la cámara funciona para sacar fotos de comprobantes y de avance.

---

## Paso 3 — La función que lee comprobantes

Sin esto la aplicación anda igual: la foto se guarda junto al asiento, pero los campos se completan a mano.

Necesitás Node instalado.

```bash
npm install -g supabase
supabase login
supabase link --project-ref gccbybrslcrecimfblwe
supabase secrets set ANTHROPIC_API_KEY=sk-ant-tu-clave-aca
supabase functions deploy leer-comprobante
supabase functions deploy gestionar-usuarios
```

La segunda función es la del panel de usuarios. No necesita clave: Supabase le
inyecta la suya. Sin ella, la pestaña Usuarios no lista nada y el alta hay que
seguir haciéndola desde el panel de Supabase.

La clave de Anthropic se saca en console.anthropic.com, sección API Keys. Queda guardada en el servidor de Supabase y nunca baja al navegador. Cada comprobante leído cuesta centavos de dólar.

---

## Roles

| Rol | Ve | Carga | Borra |
|---|---|---|---|
| `admin` | todo | sí | sí |
| `carga` | todo | sí | no |
| `inversor` | solo sus obras | no | no |

Todo esto se hace desde la pestaña **Usuarios**, visible solo para administradores:
alta con invitación por email o con contraseña inicial, cambio de rol, vinculación
de un usuario inversor con su ficha, envío de recuperación de contraseña y baja.

Dos protecciones: no podés quitarte a vos mismo el rol de administrador ni
eliminar tu propio usuario.

Un usuario con rol `inversor` que no esté vinculado a una ficha de inversor no ve
ninguna obra. La vinculación se hace en la misma tabla del panel.

---

## Las diez pestañas

**Resumen** — aportes, ejecutado, deuda, disponible neto y avance del presupuesto.

**Cajas** — efectivo, mutual y banco por obra. Saldo de cada una y listado de aportes. La caja se mueve solo con comprobantes pagados.

**Comprobantes** — carga con foto, estado de pago, edición y exportación.

**Rubros** — presupuesto por rubro. Honorarios de conducción y administración se calculan solos.

**Honorarios** — porcentajes y cuadro de proyectado, devengado, pagado y a pagar.

**Proveedores** — cuenta corriente por proveedor con antigüedad del saldo.

**Inversores** — clases de participación con coeficiente, y posición de cada uno.

**Avance** — fotos de obra y gráfico de avance físico contra financiero.

**Contador** — comprobantes A y C más impuestos, y aportes por clase y por mes.

**Ventas** — facturas emitidas por la venta de unidades, con CAE, comprador y unidad. El sistema no emite comprobantes ante ARCA: se registran los ya emitidos.

**Documentos** — legajo de la obra: contrato de fideicomiso, adhesiones, boletos, escrituras, planos y permisos. Un documento asignado a un inversor solo lo ve él y el equipo.

**Rendición** — informe para el inversor, listo para imprimir o mandar en PDF.

**Usuarios** — alta, roles y vinculaciones. Solo para administradores.

---

## Si algo falla

**"Tu usuario no tiene perfil cargado"** — falta correr el `update` que asigna el rol.

**No aparece ninguna obra** — tu perfil quedó como `inversor`. Revisalo con `select * from public.perfiles;`.

**Error al subir una foto** — faltan las políticas de storage. Se ejecutan al final del esquema; si dieron error de permisos, se crean desde Storage → Policies.

**"No pude leer el comprobante"** — falta el paso 3, o la clave de Anthropic venció.
