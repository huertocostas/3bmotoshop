// POST /api/admin/login { password } — inicia sesión en el panel. DELETE cierra sesión. GET dice si hay sesión.
import { checkPassword, makeCookie, clearCookie, isAdmin, tooManyAttempts, sameOrigin } from "../../../lib/auth.js";
import { json } from "../../../lib/shop.js";

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "Pedido inválido." }, 400);
  if (!env.ADMIN_PASSWORD) return json({ error: "Falta configurar ADMIN_PASSWORD en Cloudflare." }, 503);
  const ip = request.headers.get("cf-connecting-ip") || "local";
  if (await tooManyAttempts(env, ip)) return json({ error: "Demasiados intentos. Probá de nuevo en 15 minutos." }, 429);
  const body = await request.json().catch(() => ({}));
  if (!(await checkPassword(env, body.password))) return json({ error: "Contraseña incorrecta." }, 401);
  const res = json({ ok: true });
  res.headers.append("set-cookie", await makeCookie(env));
  return res;
}

export async function onRequestDelete({ request }) {
  if (!sameOrigin(request)) return json({ error: "Pedido inválido." }, 400);
  const res = json({ ok: true });
  res.headers.append("set-cookie", clearCookie());
  return res;
}

export async function onRequestGet({ request, env }) {
  return json({ admin: await isAdmin(request, env), configured: !!env.ADMIN_PASSWORD, storage: !!env.DATA });
}
