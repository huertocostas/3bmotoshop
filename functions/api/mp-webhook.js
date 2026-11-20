// POST /api/mp-webhook — Mercado Pago avisa acá cada pago. Se consulta el pago a la API de MP
// (con nuestro token) antes de creer nada. Aprobado: la venta pasa a 'pagada' y se descuenta el stock
// (en un solo batch de D1). Rechazado o cancelado: la venta pendiente pasa a 'cancelada' sin tocar el stock.
import { notifyAdmin, money } from "../../lib/shop.js";
import { dbSetSaleState, dbGetSale, saleId } from "../../lib/db.js";

export async function onRequestPost({ request, env, waitUntil }) {
  const url = new URL(request.url);
  const body = await request.json().catch(() => ({}));
  const type = body.type || body.topic || url.searchParams.get("type") || url.searchParams.get("topic");
  const id = body?.data?.id || url.searchParams.get("data.id") || url.searchParams.get("id");
  if (type !== "payment" || !id || !env.MP_ACCESS_TOKEN) return new Response("ignored", { status: 200 });

  waitUntil((async () => {
    const r = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(id)}`, {
      headers: { authorization: `Bearer ${env.MP_ACCESS_TOKEN}` },
    });
    if (!r.ok) return;
    const p = await r.json();
    const m = p.metadata || {};
    const vid = env.DB ? saleId(p.external_reference || m.order_id) : null;
    const venta = vid ? await dbGetSale(env.DB, vid) : null;

    if (p.status === "rejected" || p.status === "cancelled") {
      if (venta) await dbSetSaleState(env.DB, vid, "cancelada", { pagoMp: String(p.id), onlyFromPending: true });
      return;
    }
    if (p.status !== "approved") return;

    let nota = "";
    if (venta) {
      if (Number(p.transaction_amount) + 1 < Number(venta.total)) {
        nota = `\n⚠️ El monto pagado no cubre el total de la venta (${money(venta.total)}). No se marcó como pagada.`;
      } else {
        const changed = await dbSetSaleState(env.DB, vid, "pagada", { pagoMp: String(p.id) });
        if (!changed) return; // aviso repetido de MP: ya estaba pagada
      }
    }
    const tipo = { credit_card: "tarjeta de crédito", debit_card: "tarjeta de débito", account_money: "dinero en cuenta MP" }[p.payment_type_id] || p.payment_type_id;
    const cuotas = p.installments > 1 ? ` en ${p.installments} cuotas` : "";
    const items = String(m.lines || "").split(" | ").filter(Boolean).map((s) => `• ${s}`).join("\n");
    const text = `✅ *Venta pagada con Mercado Pago* ${p.external_reference || m.order_id || ""}\n${items}\n*Total: ${money(p.transaction_amount)}* (${tipo}${cuotas})\nCliente: ${m.customer_name || ""} · ${m.customer_phone || ""}\nEntrega: ${m.delivery === "envio" ? "Envío (coordinar costo)" : "Retiro en el local"}\nPago MP #${p.id}${nota}`;
    await notifyAdmin(env, text);
  })());

  return new Response("ok", { status: 200 });
}

export const onRequestGet = () => new Response("ok", { status: 200 });
