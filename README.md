# 3B Moto Shop — sitio web

Sitio de una página para **3B Moto Shop**, casa de cascos certificados y accesorios para moto en Santiago del Estero (Av. Moreno Sur 652, mercado El Morterito).

- `public/` — sitio estático (HTML/CSS/JS, imágenes, video).
- `functions/api/` — funciones de Cloudflare Pages: `checkout` (Mercado Pago o reserva en efectivo) y `mp-webhook` (aviso de pagos aprobados).
- `lib/` — lógica compartida (horarios, precios del servidor, aviso por WhatsApp). `lib/catalog.js` se genera solo.
- `tools/` — `catalogo.json` + `build_catalog.py` para actualizar productos y precios: editar el JSON y correr `py tools/build_catalog.py`.

## Variables de entorno (Cloudflare Pages → Settings → Variables and Secrets)
- `MP_ACCESS_TOKEN` — Access Token de Mercado Pago (de prueba o de producción).
- `CALLMEBOT_PHONE`, `CALLMEBOT_APIKEY` — opcional, para recibir cada venta por WhatsApp.

## Desarrollo local
`npm install` y `npm run dev` (Wrangler). Variables locales en `.dev.vars`.

Publicado en https://3bmotoshop.pages.dev — cada push a `main` se publica solo.
