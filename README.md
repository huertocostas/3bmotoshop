# 3B Moto Shop — sitio web

Sitio de una página para **3B Moto Shop**, casa de cascos certificados y accesorios para moto en Santiago del Estero (Av. Moreno Sur 652, mercado El Morterito).

- `public/` — sitio estático (HTML/CSS/JS, imágenes, video).
- `functions/api/` — funciones de Cloudflare Pages: `checkout` (Mercado Pago o reserva en efectivo) y `mp-webhook` (aviso de pagos aprobados).
- `lib/` — lógica compartida (horarios, precios del servidor, aviso por WhatsApp). `lib/catalog.js` se genera solo.
- `public/admin/` — **panel del catálogo** en `/admin`: productos, precios, fotos, talles en stock y marcas. Los cambios se guardan en Cloudflare KV y se ven al instante.
- `tools/` — catálogo inicial (`catalogo.json` + `build_catalog.py`), que genera `lib/seed.js` y la versión estática de respaldo. Solo se usa si el catálogo de KV está vacío.

## Variables de entorno (Cloudflare Pages → Settings → Variables and Secrets)
- `MP_ACCESS_TOKEN` — Access Token de Mercado Pago (de prueba o de producción).
- `ADMIN_PASSWORD` — contraseña del panel `/admin`. Cambiarla cierra todas las sesiones abiertas.
- `CALLMEBOT_PHONE`, `CALLMEBOT_APIKEY` — opcional, para recibir cada venta por WhatsApp.

El binding de KV (`DATA`) está en `wrangler.toml`.

## Desarrollo local
`npm install` y `npm run dev` (Wrangler). Variables locales en `.dev.vars`.

Publicado en https://3bmotoshop.pages.dev — cada push a `main` se publica solo.
