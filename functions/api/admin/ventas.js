// GET /api/admin/ventas — ventas, stock bajo y más vendidos (vistas de gestion_cascos).
// POST { id, estado } — marca una venta como 'pagada' (descuenta stock) o 'cancelada' (si estaba pagada, lo devuelve).
import { isAdmin, sameOrigin } from "../../../lib/auth.js";
import { json } from "../../../lib/shop.js";
import { dbAdminReport, dbSetSaleState } from "../../../lib/db.js";

export async function onRequestGet({ request, env }) {
  if (!(await isAdmin(request, env))) return json({ error: "Iniciá sesión." }, 401);
  if (!env.DB) return json({ error: "La base de datos todavía no está conectada." }, 503);
  return json(await dbAdminReport(env.DB));
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request) || !(await isAdmin(request, env))) return json({ error: "Iniciá sesión." }, 401);
  if (!env.DB) return json({ error: "La base de datos todavía no está conectada." }, 503);
  const body = await request.json().catch(() => ({}));
  const id = parseInt(body.id, 10);
  if (!id || !["pagada", "cancelada"].includes(body.estado)) return json({ error: "Pedido inválido." }, 400);
  const changed = await dbSetSaleState(env.DB, id, body.estado);
  return json({ ok: true, changed });
}
