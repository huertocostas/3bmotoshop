// Catálogo de la tienda. Si está la base D1 (binding DB, esquema gestion_cascos) se lee y guarda ahí;
// si no, en Cloudflare KV (binding DATA), como antes.
// Formato: { version, updatedAt, brands: [nombre...],
//            products: [{ id, brand, categoria, name, desc, price, img, active, sizes, stock, pid }] }
//   stock: { talle: unidades }  (los que no usan talle: { "Único": n } y sizes = null)
//   sizes: talles con stock, para la página (null si no usa talle)
//   pid:   { talle: id_producto } en D1
import SEED from "./seed.js";
import { dbGetCatalog, dbSaveCatalog } from "./db.js";

export const TALLES = ["XS", "S", "M", "L", "XL", "XXL"];
export const UNICO = "Único";
export const CATEGORIAS = ["Integral", "Modular", "Cross", "Accesorios"];
const KEY = "catalog";

// Fotos reemplazadas por otras nuevas del catálogo de Treinta. Las fotos se guardan en caché por un año,
// así que una foto nueva lleva otro nombre y acá se apunta la vieja a la nueva (también en lo guardado en KV).
const NEW_PHOTOS = {
  "img/p/48d5c01b": "img/p/96fdbd96", // LS2 casco blanco rosa (18/11/2026)
  "img/p/227ae9a3": "img/p/734215af", // LS2 Cosmos negro blanco (18/11/2026)
};
// Productos que salieron del catálogo de Treinta: quedan inactivos. Solo se aplica a catálogos guardados antes
// de esta fecha; el próximo guardado desde el panel ya los incluye inactivos y desde ahí se pueden reactivar.
const HIDDEN = new Set(["38e00d64", "5c37de10"]); // LS2 Cosmos negro azul, HRO rebatible violeta/rosa
const HIDDEN_BEFORE = "2026-11-18T18:56:00Z";

/** Categoría probable según el nombre (para productos que todavía no tienen una). */
export function guessCategoria(p) {
  if (p.brand === "Accesorios" || p.sizes === null) return "Accesorios";
  if (/rebatible|modular/i.test(p.name)) return "Modular";
  if (/cross/i.test(p.name)) return "Cross";
  return "Integral";
}

/** Completa stock, talles y categoría en un catálogo viejo de KV (que solo tenía "talles en stock"). */
export function normalizeKv(c) {
  const old = !(c.updatedAt && c.updatedAt >= HIDDEN_BEFORE);
  return { ...c, products: c.products.map((p) => {
    const q = { ...p, img: NEW_PHOTOS[p.img] || p.img };
    if (old && HIDDEN.has(q.id)) q.active = false;
    if (!q.stock) q.stock = q.sizes === null ? { [UNICO]: 1 } : Object.fromEntries((q.sizes || []).map((t) => [t, 1]));
    q.sizes = q.sizes === null ? null : TALLES.filter((t) => q.stock[t] > 0);
    if (!q.categoria) q.categoria = guessCategoria(q);
    return q;
  }) };
}

export async function getCatalog(env) {
  if (env.DB) return dbGetCatalog(env.DB);
  if (env.DATA) {
    const c = await env.DATA.get(KEY, "json");
    if (c && Array.isArray(c.products)) return normalizeKv(c);
  }
  return normalizeKv(SEED);
}

const int = (n) => Math.max(0, Math.min(9999, Math.round(Number(n) || 0)));

/** Valida y normaliza un catálogo que llega del panel. Tira Error con un mensaje para mostrar. */
export function cleanCatalog(input) {
  if (!input || !Array.isArray(input.products) || !Array.isArray(input.brands)) throw new Error("Catálogo inválido.");
  if (input.products.length > 1000) throw new Error("Demasiados productos.");
  const brands = [...new Set(input.brands.map((b) => String(b).trim().slice(0, 40)).filter(Boolean))];
  const ids = new Set();
  const products = input.products.map((p, i) => {
    const id = String(p.id || "").replace(/[^a-z0-9]/gi, "").slice(0, 24);
    if (!id || ids.has(id)) throw new Error(`Producto ${i + 1}: identificador inválido o repetido.`);
    ids.add(id);
    const name = String(p.name || "").trim().slice(0, 100);
    if (!name) throw new Error(`Producto ${i + 1}: falta el nombre.`);
    const brand = String(p.brand || "").trim().slice(0, 40);
    if (!brand) throw new Error(`"${name}": falta la marca.`);
    if (!brands.includes(brand)) brands.push(brand);
    const price = Math.round(Number(p.price));
    if (!Number.isFinite(price) || price <= 0 || price > 100000000) throw new Error(`"${name}": precio inválido.`);
    const img = String(p.img || "");
    if (img && !/^(img\/p|media)\/[a-z0-9-]+$/i.test(img)) throw new Error(`"${name}": foto inválida.`);
    const categoria = String(p.categoria || "").trim().slice(0, 60) || guessCategoria({ ...p, brand, name });
    const src = p.stock && typeof p.stock === "object" ? p.stock : null;
    let sizes, stock;
    if (p.sizes === null) {
      stock = { [UNICO]: int(src ? src[UNICO] : 1) }; sizes = null;
    } else {
      // Stock de cada talle (0 = no hay); si viene solo la lista de talles (formato viejo), 1 unidad de cada uno.
      stock = {}; for (const t of TALLES) stock[t] = src ? int(src[t]) : (Array.isArray(p.sizes) && p.sizes.includes(t) ? 1 : 0);
      sizes = TALLES.filter((t) => stock[t] > 0);
    }
    return { id, brand, categoria, name, desc: String(p.desc || "").trim().slice(0, 300), price, img, active: p.active !== false, sizes, stock };
  });
  const used = new Set(products.map((p) => p.brand));
  return { brands: brands.filter((b) => used.has(b)), products };
}

/** Guarda con control de versión: si otro lo modificó mientras tanto (o hubo una venta), avisa en vez de pisarlo. */
export async function saveCatalog(env, input, expectedVersion) {
  const current = await getCatalog(env);
  if (Number(expectedVersion) !== Number(current.version || 1)) {
    const e = new Error("El catálogo cambió mientras lo editabas (otra persona o una venta que descontó stock). Recargá la página para ver los cambios.");
    e.status = 409; throw e;
  }
  const clean = cleanCatalog(input);
  if (env.DB) return dbSaveCatalog(env.DB, clean, current);
  if (!env.DATA) throw new Error("Falta configurar el almacenamiento en Cloudflare.");
  const next = { version: Number(current.version || 1) + 1, updatedAt: new Date().toISOString(), ...clean };
  await env.DATA.put(KEY, JSON.stringify(next));
  return next;
}

/** Producto disponible para vender: activo y con stock (en algún talle, o sin talle). */
export const isSellable = (p) => p.active !== false && (p.sizes === null ? (p.stock?.[UNICO] ?? 1) > 0 : Array.isArray(p.sizes) && p.sizes.length > 0);
