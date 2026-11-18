// GET /api/admin/catalog — catálogo completo para editar. PUT — guarda el catálogo (con control de versión).
import { isAdmin, sameOrigin } from "../../../lib/auth.js";
import { getCatalog, saveCatalog } from "../../../lib/catalog-store.js";
import { json } from "../../../lib/shop.js";

export async function onRequestGet({ request, env }) {
  if (!(await isAdmin(request, env))) return json({ error: "Iniciá sesión." }, 401);
  const c = await getCatalog(env);
  return json({ ...c, version: c.version || 1 });
}

export async function onRequestPut({ request, env }) {
  if (!sameOrigin(request) || !(await isAdmin(request, env))) return json({ error: "Iniciá sesión." }, 401);
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: "Pedido inválido." }, 400);
  try {
    const saved = await saveCatalog(env, body.catalog, body.version);
    return json({ ok: true, version: saved.version, updatedAt: saved.updatedAt });
  } catch (e) {
    return json({ error: e.message }, e.status || 400);
  }
}
