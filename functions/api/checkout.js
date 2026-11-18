// POST /api/checkout — crea el pago en Mercado Pago o registra una reserva para pagar en efectivo.
import { priceOrder, orderId, nextOpening, notifyAdmin, summary, money, json, SHOP } from "../../lib/shop.js";
import { getCatalog } from "../../lib/catalog-store.js";

export async function onRequestPost({ request, env, waitUntil }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Pedido inválido." }, 400); }
  if (body.website) return json({ error: "Pedido inválido." }, 400); // campo trampa anti-bots

  let order;
  try { order = priceOrder(body, await getCatalog(env)); } catch (e) { return json({ error: e.message }, 400); }
  const id = orderId();
  const origin = new URL(request.url).origin;

  if (body.method === "efectivo") {
    const when = nextOpening();
    const text = `🛵 *Reserva para pagar en efectivo* ${id}\n${summary(order)}\n${when.text}`;
    waitUntil(notifyAdmin(env, text));
    return json({ ok: true, method: "efectivo", id, total: money(order.total), when: when.text, address: SHOP.address,
      whatsappText: `Hola! Hice la reserva ${id} en la web para pagar en efectivo.\n${summary(order)}` });
  }

  if (!env.MP_ACCESS_TOKEN) return json({ error: "El pago con Mercado Pago todavía no está configurado." }, 503);

  const pref = {
    items: order.lines.map((l) => ({ id: l.id, title: `${l.title}${l.talle ? ` · talle ${l.talle}` : ""}`.slice(0, 250),
      quantity: l.qty, unit_price: l.unit, currency_id: "ARS", category_id: "fashion",
      picture_url: l.img ? `${origin}/${l.img.replace(/^\//, "")}` : undefined })),
    payer: { name: order.customer.name },
    external_reference: id,
    statement_descriptor: "3B MOTO SHOP",
    back_urls: { success: `${origin}/?pago=ok&pedido=${id}`, pending: `${origin}/?pago=pendiente&pedido=${id}`, failure: `${origin}/?pago=error&pedido=${id}` },
    auto_return: "approved",
    notification_url: `${origin}/api/mp-webhook`,
    // Tarjeta de crédito/débito y dinero en cuenta de Mercado Pago. El efectivo se paga en el local, no en Rapipago/Pago Fácil.
    payment_methods: { excluded_payment_types: [{ id: "ticket" }, { id: "atm" }], installments: 12 },
    metadata: { order_id: id, customer_name: order.customer.name, customer_phone: order.customer.phone, delivery: order.delivery,
      lines: order.lines.map((l) => `${l.qty}x ${l.title}${l.talle ? ` (talle ${l.talle})` : ""} ${money(l.unit * l.qty)}`).join(" | ") },
  };

  const r = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: { authorization: `Bearer ${env.MP_ACCESS_TOKEN}`, "content-type": "application/json", "x-idempotency-key": id },
    body: JSON.stringify(pref),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return json({ error: "Mercado Pago no respondió. Probá de nuevo en un rato o escribinos por WhatsApp.", detail: data?.message }, 502);

  const url = env.MP_ACCESS_TOKEN.startsWith("TEST-") ? data.sandbox_init_point : data.init_point;
  return json({ ok: true, method: "mp", id, url });
}
