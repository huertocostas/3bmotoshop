# 3B Moto Shop — sitio web

Sitio de una página para **3B Moto Shop**, casa de cascos certificados y accesorios para moto en Santiago del Estero (Av. Moreno Sur 652, mercado El Morterito).

- `public/` — sitio estático (HTML/CSS/JS, imágenes, video).
- `functions/api/` — funciones de Cloudflare Pages: `checkout` (Mercado Pago o reserva en efectivo) y `mp-webhook` (aviso de pagos aprobados).
- `lib/` — lógica compartida (horarios, precios del servidor, aviso por WhatsApp). `lib/catalog.js` se genera solo.
- `public/admin/` — **panel** en `/admin`: catálogo (precios, fotos, stock por talle, marcas, categorías) y **ventas** (marcar pagada/cancelada, stock bajo, más vendidos).
- `tools/` — catálogo inicial (`catalogo.json` + `build_catalog.py`), que genera `lib/seed.js` y la versión estática de respaldo. Solo se usa si el catálogo de KV está vacío.

## Variables de entorno (Cloudflare Pages → Settings → Variables and Secrets)
- `MP_ACCESS_TOKEN` — Access Token de Mercado Pago (de prueba o de producción).
- `ADMIN_PASSWORD` — contraseña del panel `/admin`. Cambiarla cierra todas las sesiones abiertas.
- `CALLMEBOT_PHONE`, `CALLMEBOT_APIKEY` — opcional, para recibir cada venta por WhatsApp.

Los bindings están en `wrangler.toml`: `DB` (D1) y `DATA` (KV, fotos subidas desde el panel y límite de intentos de login).

## Base de datos (Cloudflare D1, esquema gestion_cascos)
- `migrations/0001_gestion_cascos.sql` — el esquema de [gestion-cascos](https://github.com/huertocostas/gestion-cascos) pasado a SQLite: marcas, categorias, productos, clientes, ventas, detalle_ventas y las vistas vw_detalle_ventas, vw_stock_bajo, vw_clientes_frecuentes, vw_top_cascos. Sin los datos de ejemplo.
- `migrations/0002_tienda_web.sql` — tablas aparte para lo que la web necesita: `web_modelos` (descripción, foto y visible de cada tarjeta), `web_ventas` (forma de pago, entrega, n.º de pago MP) y `web_config` (versión del catálogo, orden de marcas).
- Cada tarjeta del catálogo es un **modelo**; en `productos` hay **una fila por talle** con su stock (`codigo` = `<modelo>-<talle>`, los que no usan talle: talle `Único`, código `<modelo>-U`).
- Cada compra crea cliente (por DNI), venta `pendiente` y su detalle. Mercado Pago aprobado → `pagada` y descuenta stock en un solo batch; rechazado → `cancelada` sin tocar stock. Las reservas en efectivo se marcan pagadas desde el panel.
- La compra minorista no pide DNI: el cliente se guarda con `dni` = `T` + su teléfono. El DNI real solo se pide en la **consulta mayorista** (`migrations/0003`, tabla `web_consultas`), que queda en el panel y se manda al WhatsApp mayorista para responderla.
- Sin el binding `DB` el sitio sigue funcionando con el catálogo de KV.
- Aplicar migraciones: `npx wrangler d1 migrations apply gestion_cascos --remote`. Carga inicial desde KV: `node tools/catalog_to_sql.mjs catalogo-kv.json > carga.sql`.

## Desarrollo local
`npm install` y `npm run dev` (Wrangler). Variables locales en `.dev.vars`.

Publicado en https://3bmotoshop.pages.dev — cada push a `main` se publica solo.
