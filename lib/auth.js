// Sesión del panel de administración: contraseña en el secreto ADMIN_PASSWORD y cookie firmada (HMAC).
const COOKIE = "3b_admin";
const DAYS = 30;
const enc = new TextEncoder();

async function key(env) {
  return crypto.subtle.importKey("raw", enc.encode("3b-session:" + env.ADMIN_PASSWORD), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export async function makeCookie(env) {
  const exp = Date.now() + DAYS * 86400000;
  const sig = b64(await crypto.subtle.sign("HMAC", await key(env), enc.encode(String(exp))));
  return `${COOKIE}=${exp}.${sig}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${DAYS * 86400}`;
}
export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

export async function isAdmin(request, env) {
  if (!env.ADMIN_PASSWORD) return false;
  const m = (request.headers.get("cookie") || "").match(new RegExp(`${COOKIE}=(\\d+)\\.([\\w-]+)`));
  if (!m || Number(m[1]) < Date.now()) return false;
  const expected = b64(await crypto.subtle.sign("HMAC", await key(env), enc.encode(m[1])));
  return timingSafeEqual(expected, m[2]);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function checkPassword(env, given) {
  if (!env.ADMIN_PASSWORD) return false;
  // Compara hashes para que el tiempo no dependa de cuántas letras coinciden.
  const h = async (s) => b64(await crypto.subtle.digest("SHA-256", enc.encode(String(s))));
  return timingSafeEqual(await h(given), await h(env.ADMIN_PASSWORD));
}

/** Limita intentos de login por IP: 8 cada 15 minutos. */
export async function tooManyAttempts(env, ip) {
  if (!env.DATA) return false;
  const k = `rl:${ip}`;
  const n = Number(await env.DATA.get(k)) || 0;
  if (n >= 8) return true;
  await env.DATA.put(k, String(n + 1), { expirationTtl: 900 });
  return false;
}

/** Las peticiones de escritura del panel deben venir de la misma página (header propio + cookie SameSite). */
export const sameOrigin = (request) => request.headers.get("x-admin") === "1";
