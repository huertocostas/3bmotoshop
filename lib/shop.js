// Lógica compartida de 3B Moto Shop para las funciones de Cloudflare Pages.
import { TALLES, UNICO, isSellable } from "./catalog-store.js";
export { TALLES };
const imgPath = (p) => `${p.img}-480.webp`;

export const SHOP = {
  name: "3B Moto Shop",
  address: "Av. Moreno Sur 652 (mercado El Morterito), Santiago del Estero",
  whatsapp: "543856229058",
  whatsappMayorista: "543854117240",
};

// Horario: lunes a sábado 9–13 y 18–22. Domingo cerrado. Hora de Argentina (UTC-3, sin horario de verano).
const SLOTS = [[9 * 60, 13 * 60], [18 * 60, 22 * 60]];
const OPEN_DAYS = [1, 2, 3, 4, 5, 6];
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function arNow(date = new Date()) {
  const t = new Date(date.getTime() - 3 * 3600 * 1000); // reloj de Argentina leído con getUTC*
  return { day: t.getUTCDay(), min: t.getUTCHours() * 60 + t.getUTCMinutes(), d: t };
}
const hhmm = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;

/** Devuelve si está abierto ahora o cuándo abre la próxima vez, con un texto listo para mostrar. */
export function nextOpening(date = new Date()) {
  const { day, min, d } = arNow(date);
  if (OPEN_DAYS.includes(day)) {
    for (const [a, b] of SLOTS) {
      // Abierto, salvo que falte menos de media hora para cerrar: ahí conviene ofrecer el próximo turno.
      if (min >= a && min < b && b - min >= 30) return { openNow: true, text: `Estamos abiertos ahora hasta las ${hhmm(b)} h.` };
      if (min < a) return { openNow: false, text: `Te esperamos hoy a partir de las ${hhmm(a)} h.` };
    }
  }
  for (let k = 1; k <= 7; k++) {
    const dd = (day + k) % 7;
    if (!OPEN_DAYS.includes(dd)) continue;
    const f = new Date(d.getTime() + k * 86400000);
    const fecha = `${f.getUTCDate()}/${f.getUTCMonth() + 1}`;
    const cuando = k === 1 ? `mañana ${DIAS[dd]} ${fecha}` : `el ${DIAS[dd]} ${fecha}`;
    return { openNow: false, text: `Te esperamos ${cuando} a partir de las ${hhmm(SLOTS[0][0])} h.` };
  }
}

export const money = (n) => "$ " + Math.round(n).toLocaleString("es-AR");

export function orderId() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const r = crypto.getRandomValues(new Uint8Array(6));
  return "3B-" + Array.from(r, (x) => a[x % a.length]).join("");
}

/** Valida el pedido contra el catálogo guardado (los precios del navegador nunca se usan). */
export function priceOrder(body, catalog) {
  const byId = new Map(catalog.products.map((p) => [p.id, p]));
  const items = Array.isArray(body?.items) ? body.items.slice(0, 20) : [];
  if (!items.length) throw new Error("El carrito está vacío.");
  const lines = items.map((it) => {
    const p = byId.get(String(it.id));
    if (!p) throw new Error("Un producto del carrito ya no está disponible. Actualizá la página.");
    if (!isSellable(p)) throw new Error(`"${p.name}" está sin stock. Sacalo del carrito.`);
    const qty = Math.max(1, Math.min(10, parseInt(it.qty, 10) || 1));
    let talle = null;
    if (p.sizes !== null) {
      talle = String(it.talle || "").toUpperCase();
      if (!TALLES.includes(talle)) throw new Error(`Elegí el talle de "${p.name}".`);
      if (!p.sizes.includes(talle)) throw new Error(`No hay talle ${talle} de "${p.name}". Elegí otro.`);
    }
    const key = talle || UNICO;
    return { id: p.id, pid: p.pid ? p.pid[key] : null, stock: p.stock ? p.stock[key] : null, title: p.name, brand: p.brand, unit: p.price, qty, talle, img: p.img ? imgPath(p) : "" };
  });
  // Mismo producto y talle en dos renglones: se suman para controlar el stock.
  const want = {};
  for (const l of lines) {
    const k = l.id + "|" + l.talle; want[k] = (want[k] || 0) + l.qty;
    if (l.stock != null && want[k] > l.stock) throw new Error(`De "${l.title}"${l.talle ? ` talle ${l.talle}` : ""} ${l.stock === 1 ? "queda 1" : `quedan ${l.stock}`}. Cambiá la cantidad.`);
  }
  const c = body?.customer || {};
  const name = String(c.name || "").trim().replace(/\s+/g, " ").slice(0, 120);
  const phone = String(c.phone || "").replace(/[^\d+]/g, "").slice(0, 20);
  const [nombre, ...rest] = name.split(" ");
  if (name.length < 2) throw new Error("Escribí tu nombre.");
  if (!rest.length) throw new Error("Escribí tu nombre y apellido.");
  // En la compra minorista no se pide DNI. clientes.dni es obligatorio y único, así que el cliente
  // minorista se identifica por teléfono: 'T' + números del teléfono (nunca coincide con un DNI real).
  const dni = "T" + phone.replace(/\D/g, "").slice(-14);
  if (phone.replace(/\D/g, "").length < 8) throw new Error("Escribí un teléfono válido.");
  const delivery = body?.delivery === "envio" ? "envio" : "retiro";
  const total = lines.reduce((s, l) => s + l.unit * l.qty, 0);
  return { lines, total, customer: { name, phone, dni, nombre: nombre.slice(0, 80), apellido: rest.join(" ").slice(0, 80) }, delivery };
}

export function summary(o) {
  const items = o.lines.map((l) => `• ${l.qty}x ${l.title}${l.talle ? ` (talle ${l.talle})` : ""} — ${money(l.unit * l.qty)}`).join("\n");
  const entrega = o.delivery === "envio" ? "Envío (coordinar costo)" : "Retiro en el local";
  return `${items}\n*Total: ${money(o.total)}*\nCliente: ${o.customer.name} · ${o.customer.phone}\nEntrega: ${entrega}`;
}

/** Aviso al administrador por WhatsApp (CallMeBot). Si no está configurado, no hace nada. */
export async function notifyAdmin(env, text) {
  if (!env.CALLMEBOT_PHONE || !env.CALLMEBOT_APIKEY) return false;
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(env.CALLMEBOT_PHONE)}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(env.CALLMEBOT_APIKEY)}`;
  try { const r = await fetch(url); return r.ok; } catch { return false; }
}

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
