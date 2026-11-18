// Catálogo editable guardado en Cloudflare KV (binding DATA).
// Formato: { version, updatedAt, brands: [nombre...], products: [{ id, brand, name, desc, price, img, sizes, active }] }
import SEED from "./seed.js";

export const TALLES = ["XS", "S", "M", "L", "XL", "XXL"];
const KEY = "catalog";

// Fotos reemplazadas por otras nuevas del catálogo de Treinta. Las fotos se guardan en caché por un año,
// así que una foto nueva lleva otro nombre y acá se apunta la vieja a la nueva (también en lo guardado en KV).
const NEW_PHOTOS = {
  "img/p/48d5c01b": "img/p/96fdbd96", // LS2 casco blanco rosa (18/11/2026)
  "img/p/227ae9a3": "img/p/734215af", // LS2 Cosmos negro blanco (18/11/2026)
};
const withNewPhotos = (c) => ({ ...c, products: c.products.map((p) => (NEW_PHOTOS[p.img] ? { ...p, img: NEW_PHOTOS[p.img] } : p)) });

export async function getCatalog(env) {
  if (env.DATA) {
    const c = await env.DATA.get(KEY, "json");
    if (c && Array.isArray(c.products)) return withNewPhotos(c);
  }
  return withNewPhotos(SEED);
}

/** Valida y normaliza un catálogo que llega del panel. Tira Error con un mensaje para mostrar. */
export function cleanCatalog(input) {
  if (!input || !Array.isArray(input.products) || !Array.isArray(input.brands)) throw new Error("Catálogo inválido.");
  if (input.products.length > 1000) throw new Error("Demasiados productos.");
  const brands = [...new Set(input.brands.map((b) => String(b).trim().slice(0, 40)).filter(Boolean))];
  const ids = new Set();
  const products = input.products.map((p, i) => {
    const id = String(p.id || "").replace(/[^a-z0-9-]/gi, "").slice(0, 40);
    if (!id || ids.has(id)) throw new Error(`Producto ${i + 1}: identificador inválido o repetido.`);
    ids.add(id);
    const name = String(p.name || "").trim().slice(0, 120);
    if (!name) throw new Error(`Producto ${i + 1}: falta el nombre.`);
    const brand = String(p.brand || "").trim().slice(0, 40);
    if (!brand) throw new Error(`"${name}": falta la marca.`);
    if (!brands.includes(brand)) brands.push(brand);
    const price = Math.round(Number(p.price));
    if (!Number.isFinite(price) || price < 0 || price > 100000000) throw new Error(`"${name}": precio inválido.`);
    const img = String(p.img || "");
    if (img && !/^(img\/p|media)\/[a-z0-9-]+$/i.test(img)) throw new Error(`"${name}": foto inválida.`);
    const sizes = p.sizes === null ? null : (Array.isArray(p.sizes) ? TALLES.filter((t) => p.sizes.includes(t)) : TALLES.slice());
    return { id, brand, name, desc: String(p.desc || "").trim().slice(0, 300), price, img, sizes, active: p.active !== false };
  });
  const used = new Set(products.map((p) => p.brand));
  return { brands: brands.filter((b) => used.has(b)), products };
}

/** Guarda con control de versión: si otro lo modificó mientras tanto, avisa en vez de pisarlo. */
export async function saveCatalog(env, input, expectedVersion) {
  if (!env.DATA) throw new Error("Falta configurar el almacenamiento (KV) en Cloudflare.");
  const current = await getCatalog(env);
  if (Number(expectedVersion) !== Number(current.version || 1)) {
    const e = new Error("Otra persona modificó el catálogo mientras lo editabas. Recargá la página para ver los cambios.");
    e.status = 409; throw e;
  }
  const clean = cleanCatalog(input);
  const next = { version: Number(current.version || 1) + 1, updatedAt: new Date().toISOString(), ...clean };
  await env.DATA.put(KEY, JSON.stringify(next));
  return next;
}

/** Producto disponible para vender: activo y, si usa talle, con al menos un talle en stock. */
export const isSellable = (p) => p.active !== false && (p.sizes === null || (Array.isArray(p.sizes) && p.sizes.length > 0));
