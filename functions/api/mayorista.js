// POST /api/mayorista — consulta por precio mayorista. Pide DNI (solo acá), guarda al cliente y la consulta en D1,
// avisa al dueño por WhatsApp (CallMeBot, si está configurado) y devuelve el mensaje listo para mandar
// al WhatsApp mayorista, para que el dueño lo conteste desde ahí.
import { json, notifyAdmin, money, SHOP } from "../../lib/shop.js";
import { getCatalog } from "../../lib/catalog-store.js";
import { dbCreateConsulta } from "../../lib/db.js";

export async function onRequestPost({ request, env, waitUntil }) {
  const body = await request.json().catch(() => null);
  if (!body || body.website) return json({ error: "Pedido inválido." }, 400); // campo trampa anti-bots
  const c = body.customer || {};
  const name = String(c.name || "").trim().replace(/\s+/g, " ").slice(0, 120);
  const [nombre, ...rest] = name.split(" ");
  const dni = String(c.dni || "").replace(/\D/g, "");
  const phone = String(c.phone || "").replace(/[^\d+]/g, "").slice(0, 20);
  const ciudad = String(c.ciudad || "").trim().slice(0, 80);
  const msg = String(body.message || "").trim().slice(0, 1000);
  if (name.length < 2 || !rest.length) return json({ error: "Escribí tu nombre y apellido." }, 400);
  if (!/^\d{7,8}$/.test(dni)) return json({ error: "Escribí tu DNI (7 u 8 números, sin puntos)." }, 400);
  if (phone.replace(/\D/g, "").length < 8) return json({ error: "Escribí un teléfono válido." }, 400);

  // Productos del carrito (opcional), con nombre y precio del catálogo guardado.
  let lines = [];
  const items = Array.isArray(body.items) ? body.items.slice(0, 30) : [];
  if (items.length) {
    const byId = new Map((await getCatalog(env)).products.map((p) => [p.id, p]));
    lines = items.map((it) => {
      const p = byId.get(String(it.id)); if (!p) return null;
      const qty = Math.max(1, Math.min(999, parseInt(it.qty, 10) || 1));
      const talle = it.talle ? String(it.talle).toUpperCase().slice(0, 5) : "";
      return `• ${qty}x ${p.name}${talle ? ` (talle ${talle})` : ""} — minorista ${money(p.price)}`;
    }).filter(Boolean);
  }
  if (!lines.length && msg.length < 3) return json({ error: "Contanos qué querés comprar y cuántas unidades." }, 400);

  const detalle = [lines.join("\n"), msg].filter(Boolean).join("\n");
  const cust = { dni, nombre: nombre.slice(0, 80), apellido: rest.join(" ").slice(0, 80), phone, ciudad };
  let id = null;
  if (env.DB) {
    try { id = "M-" + String(await dbCreateConsulta(env.DB, cust, detalle)).padStart(4, "0"); }
    catch (e) { console.error("consulta", e); return json({ error: "No se pudo registrar la consulta. Escribinos por WhatsApp." }, 500); }
  }
  const datos = `${name} · DNI ${dni} · ${phone}${ciudad ? ` · ${ciudad}` : ""}`;
  waitUntil(notifyAdmin(env, `📦 *Consulta mayorista* ${id || ""}\n${detalle}\nCliente: ${datos}`));
  const whatsappText = `Hola! Quiero precio mayorista${id ? ` (consulta ${id})` : ""}.\n${detalle}\n\nMis datos: ${datos}`;
  return json({ ok: true, id, whatsapp: SHOP.whatsappMayorista, whatsappText });
}
