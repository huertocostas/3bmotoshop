// Arma el HTML de la sección #catalogo a partir del catálogo guardado (mismo marcado que tools/build_catalog.py).
import { isSellable } from "./catalog-store.js";

const WA = "543856229058";
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const money = (n) => "$ " + Math.round(n).toLocaleString("es-AR");
const slug = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const WA_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z"/></svg>';

export const imgUrl = (p, w) => (p.img ? `${p.img.startsWith("media/") ? "/" : ""}${p.img}-${w}.webp` : "");

export function renderCatalog(cat, siteUrl) {
  const sellable = cat.products.filter(isSellable);
  const blocks = [], ld = [];
  for (const brand of cat.brands) {
    const items = sellable.filter((p) => p.brand === brand).sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));
    if (!items.length) continue;
    const s = slug(brand);
    const cards = items.map((p) => {
      const msg = `Hola! Me interesa el ${p.name} (${money(p.price)}) que vi en la web. ¿Hay stock?`;
      const wa = `https://wa.me/${WA}?text=${encodeURIComponent(msg)}`;
      const img = p.img
        ? `<img src="${imgUrl(p, 480)}" srcset="${imgUrl(p, 320)} 320w, ${imgUrl(p, 480)} 480w" sizes="(max-width:700px) 46vw, (max-width:1020px) 30vw, 280px" width="480" height="600" loading="lazy" decoding="async" alt="${esc(p.name)}">`
        : "";
      ld.push({ "@type": "Product", name: p.name, brand: { "@type": "Brand", name: brand === "Accesorios" ? "3B Moto Shop" : brand.split(" ")[0] },
        image: p.img ? `${siteUrl}/${imgUrl(p, 480).replace(/^\//, "")}` : undefined, description: p.desc || undefined,
        offers: { "@type": "Offer", price: p.price, priceCurrency: "ARS", availability: "https://schema.org/InStock" } });
      return `<article class="prod"><div class="prod__img">${img}</div><div class="prod__body"><h4>${esc(p.name)}</h4>${p.desc ? `<p>${esc(p.desc)}</p>` : ""}` +
        (p.sizes && p.sizes.length ? `<ul class="sz" aria-label="Talles disponibles">${p.sizes.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : "") +
        `<div class="prod__foot"><span class="price">${money(p.price)}</span><div class="prod__act">` +
        `<button class="add" type="button" data-id="${esc(p.id)}" data-sizes="${p.sizes === null ? "" : p.sizes.join(",")}">Agregar</button>` +
        `<a class="ask" href="${esc(wa)}" target="_blank" rel="noopener" aria-label="Consultar por WhatsApp: ${esc(p.name)}" title="Consultar por WhatsApp">${WA_ICON}</a></div></div></div></article>`;
    }).join("");
    const n = items.length;
    blocks.push(`<details class="brand" id="m-${s}"><summary class="brand__head"><h3>${esc(brand)}</h3><p class="mono">${n} ${n === 1 ? "modelo" : "modelos"} · desde ${money(items[0].price)}</p><span class="chev" aria-hidden="true"></span></summary><div class="grid">${cards}</div></details>`);
  }
  const fecha = cat.updatedAt ? new Date(cat.updatedAt).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Cordoba" }) : null;
  const ldjson = JSON.stringify({ "@context": "https://schema.org", "@type": "ItemList", name: "Catálogo 3B Moto Shop",
    itemListElement: ld.map((item, i) => ({ "@type": "ListItem", position: i + 1, item })) }).replace(/</g, "\\u003c");
  return `<section class="sec" id="catalogo" style="padding-top:0">
  <div class="wrap">
    <div class="sec__head rv">
      <p class="mono kicker">Catálogo y precios</p>
      <h2>Elegí por marca</h2>
    </div>
    <p class="cat-hint">${sellable.length} productos en ${blocks.length} categorías. Tocá una marca para ver modelos y precios.</p>
    <div class="brands-list">${blocks.join("")}</div>
    <p class="cat-note">Precios${fecha ? ` actualizados al ${fecha}` : ""}. Pueden cambiar sin aviso: consultá stock y talle por WhatsApp antes de comprar.</p>
  </div>
  <script type="application/ld+json">${ldjson}</script>
</section>`;
}
