// POST /api/admin/image — recibe la foto ya achicada en el navegador (dos WebP: 480 y 320 de ancho) y la guarda en KV.
import { isAdmin, sameOrigin } from "../../../lib/auth.js";
import { json } from "../../../lib/shop.js";

const MAX = 400 * 1024;
// Acepta WebP o JPEG (Safari no genera WebP desde el navegador).
function kind(b) {
  const u = new Uint8Array(b, 0, Math.min(12, b.byteLength));
  if (u.length >= 12 && String.fromCharCode(...u.slice(8, 12)) === "WEBP") return "image/webp";
  if (u[0] === 0xff && u[1] === 0xd8) return "image/jpeg";
  return null;
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request) || !(await isAdmin(request, env))) return json({ error: "Iniciá sesión." }, 401);
  if (!env.DATA) return json({ error: "Falta configurar el almacenamiento (KV)." }, 503);
  const form = await request.formData().catch(() => null);
  const big = form && form.get("w480"), small = form && form.get("w320");
  if (!big || !small) return json({ error: "Faltan las imágenes." }, 400);
  const [b, s] = await Promise.all([big.arrayBuffer(), small.arrayBuffer()]);
  const tb = kind(b), ts = kind(s);
  if (b.byteLength > MAX || s.byteLength > MAX || !tb || !ts) return json({ error: "La foto no es válida o es muy pesada." }, 400);
  const id = "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await Promise.all([env.DATA.put(`media:${id}-480.webp`, b, { metadata: { type: tb } }), env.DATA.put(`media:${id}-320.webp`, s, { metadata: { type: ts } })]);
  return json({ ok: true, img: `media/${id}` });
}
