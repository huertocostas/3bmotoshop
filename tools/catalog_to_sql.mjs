// Pasa el catálogo de KV (JSON) a SQL para cargarlo en D1 una sola vez.
// Uso: node tools/catalog_to_sql.mjs catalogo-kv.json > carga.sql   (sin archivo usa lib/seed.js)
// Cada producto con talle queda como una fila de productos por talle (XS..XXL); los talles que figuraban
// "en stock" quedan con 1 unidad y el resto con 0. Los que no usan talle quedan en una fila 'Único' con 1 unidad.
import { readFileSync } from "node:fs";
import SEED from "../lib/seed.js";
import { normalizeKv, cleanCatalog, UNICO } from "../lib/catalog-store.js";

const raw = process.argv[2] ? JSON.parse(readFileSync(process.argv[2], "utf8").replace(/^﻿/, "")) : SEED;
const norm = normalizeKv(raw);
const cat = cleanCatalog({ brands: norm.brands, products: norm.products.map((p) => ({ ...p, stock: p.stock })) });

const q = (v) => (v === null || v === undefined ? "NULL" : typeof v === "number" ? String(v) : "'" + String(v).replace(/'/g, "''") + "'");
const out = ["-- Catálogo inicial de la tienda (generado por tools/catalog_to_sql.mjs).", "PRAGMA foreign_keys = ON;"];
for (const b of cat.brands) out.push(`INSERT OR IGNORE INTO marcas (nombre) VALUES (${q(b)});`);
for (const c of new Set(cat.products.map((p) => p.categoria))) out.push(`INSERT OR IGNORE INTO categorias (nombre) VALUES (${q(c)});`);
for (const p of cat.products) {
  out.push(`INSERT INTO web_modelos (modelo, descripcion, img, activo) VALUES (${q(p.id)}, ${q(p.desc)}, ${q(p.img)}, ${p.active ? 1 : 0});`);
  for (const [t, n] of Object.entries(p.stock)) {
    out.push(`INSERT INTO productos (codigo, nombre, id_marca, id_categoria, talle, precio_venta, stock) VALUES (${q(`${p.id}-${t === UNICO ? "U" : t}`)}, ${q(p.name)}, ` +
      `(SELECT id_marca FROM marcas WHERE nombre = ${q(p.brand)}), (SELECT id_categoria FROM categorias WHERE nombre = ${q(p.categoria)}), ${q(t)}, ${p.price}, ${n});`);
  }
}
out.push(`INSERT OR REPLACE INTO web_config (clave, valor) VALUES ('orden_marcas', ${q(JSON.stringify(cat.brands))});`);
if (raw.updatedAt) out.push(`INSERT OR REPLACE INTO web_config (clave, valor) VALUES ('actualizado', ${q(raw.updatedAt.slice(0, 19).replace("T", " "))});`);
process.stdout.write(out.join("\n") + "\n");
console.error(`${cat.products.length} modelos, ${cat.products.reduce((s, p) => s + Object.keys(p.stock).length, 0)} filas de productos, ${cat.brands.length} marcas`);
