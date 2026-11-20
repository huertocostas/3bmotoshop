// Acceso a la base D1 con el esquema de gestion_cascos (migrations/0001) y las tablas de la web (migrations/0002).
// Cada modelo del catálogo web = una fila de web_modelos + una fila de productos por talle (codigo '<modelo>-<talle>').
// Las escrituras van en un solo batch de D1, que se aplica entero o nada (transacción).

const UNICO = "Único";
const talleCode = (t) => (t === UNICO ? "U" : t);
const modeloOf = (codigo) => codigo.slice(0, codigo.lastIndexOf("-"));
const TALLE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", UNICO];

export async function dbGetCatalog(db) {
  const [rows, modelos, cfg] = await db.batch([
    db.prepare(`SELECT p.id_producto, p.codigo, p.nombre, p.talle, p.precio_venta, p.stock, m.nombre AS marca, c.nombre AS categoria
                FROM productos p JOIN marcas m ON m.id_marca = p.id_marca JOIN categorias c ON c.id_categoria = p.id_categoria`),
    db.prepare("SELECT modelo, descripcion, img, activo FROM web_modelos"),
    db.prepare("SELECT clave, valor FROM web_config"),
  ]);
  const conf = Object.fromEntries(cfg.results.map((r) => [r.clave, r.valor]));
  const byModelo = new Map();
  for (const r of rows.results) {
    const k = modeloOf(r.codigo);
    if (!byModelo.has(k)) byModelo.set(k, []);
    byModelo.get(k).push(r);
  }
  const products = [];
  for (const m of modelos.results) {
    const rs = (byModelo.get(m.modelo) || []).sort((a, b) => TALLE_ORDER.indexOf(a.talle) - TALLE_ORDER.indexOf(b.talle));
    if (!rs.length) continue;
    const stock = {}, pid = {};
    for (const r of rs) { stock[r.talle] = r.stock; pid[r.talle] = r.id_producto; }
    const unico = UNICO in stock;
    products.push({
      id: m.modelo, brand: rs[0].marca, categoria: rs[0].categoria, name: rs[0].nombre, desc: m.descripcion, price: Number(rs[0].precio_venta),
      img: m.img, active: m.activo === 1, sizes: unico ? null : rs.filter((r) => r.stock > 0).map((r) => r.talle), stock, pid,
    });
  }
  let order = [];
  try { order = JSON.parse(conf.orden_marcas || "[]"); } catch {}
  const brands = [...new Set([...order, ...products.map((p) => p.brand)])].filter((b) => products.some((p) => p.brand === b));
  return { version: Number(conf.version || 1), updatedAt: conf.actualizado ? conf.actualizado.replace(" ", "T") + "Z" : null, brands, products };
}

/** Guarda el catálogo del panel. `clean` viene de cleanCatalog(); `current` es lo que había. */
export async function dbSaveCatalog(db, clean, current) {
  const modelos = clean.products.map((p) => ({ id: p.id, desc: p.desc, img: p.img, activo: p.active ? 1 : 0 }));
  const filas = clean.products.flatMap((p) => Object.entries(p.stock).map(([t, n]) => ({
    codigo: `${p.id}-${talleCode(t)}`, nombre: p.name, marca: p.brand, categoria: p.categoria, talle: t, precio: p.price, stock: n,
  })));
  const version = Number(current.version || 1) + 1;
  const now = new Date().toISOString();
  const J = (x) => JSON.stringify(x);
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO marcas (nombre) SELECT value FROM json_each(?1)").bind(J(clean.brands)),
    db.prepare("INSERT OR IGNORE INTO categorias (nombre) SELECT DISTINCT value FROM json_each(?1)").bind(J(clean.products.map((p) => p.categoria))),
    db.prepare(`INSERT INTO web_modelos (modelo, descripcion, img, activo)
                SELECT value->>'$.id', value->>'$.desc', value->>'$.img', value->>'$.activo' FROM json_each(?1) WHERE true
                ON CONFLICT (modelo) DO UPDATE SET descripcion = excluded.descripcion, img = excluded.img, activo = excluded.activo`).bind(J(modelos)),
    db.prepare("DELETE FROM web_modelos WHERE modelo NOT IN (SELECT value->>'$.id' FROM json_each(?1))").bind(J(modelos)),
    db.prepare(`INSERT INTO productos (codigo, nombre, id_marca, id_categoria, talle, precio_venta, stock)
                SELECT value->>'$.codigo', value->>'$.nombre',
                       (SELECT id_marca FROM marcas WHERE nombre = value->>'$.marca'),
                       (SELECT id_categoria FROM categorias WHERE nombre = value->>'$.categoria'),
                       value->>'$.talle', value->>'$.precio', value->>'$.stock'
                FROM json_each(?1) WHERE true
                ON CONFLICT (codigo) DO UPDATE SET nombre = excluded.nombre, id_marca = excluded.id_marca, id_categoria = excluded.id_categoria,
                  precio_venta = excluded.precio_venta, stock = excluded.stock`).bind(J(filas)),
    // Filas que ya no están en el catálogo: se borran, salvo las que tienen ventas (quedan con stock 0 para el historial).
    db.prepare(`DELETE FROM productos WHERE codigo NOT IN (SELECT value->>'$.codigo' FROM json_each(?1))
                AND id_producto NOT IN (SELECT id_producto FROM detalle_ventas)`).bind(J(filas)),
    db.prepare("UPDATE productos SET stock = 0 WHERE stock <> 0 AND codigo NOT IN (SELECT value->>'$.codigo' FROM json_each(?1))").bind(J(filas)),
    db.prepare("DELETE FROM marcas WHERE id_marca NOT IN (SELECT id_marca FROM productos)"),
    db.prepare("INSERT OR REPLACE INTO web_config (clave, valor) VALUES ('version', ?1), ('actualizado', ?2), ('orden_marcas', ?3)")
      .bind(String(version), now.slice(0, 19).replace("T", " "), J(clean.brands)),
  ]);
  return { version, updatedAt: now };
}

// ---------- Ventas ----------

export const saleCode = (id) => "3B-" + String(id).padStart(4, "0");
export const saleId = (code) => { const m = /^3B-(\d+)$/.exec(String(code || "")); return m ? Number(m[1]) : null; };

/** Registra la venta como 'pendiente' (cliente, venta y detalle juntos). Devuelve el id_venta. */
export async function dbCreateSale(db, order, metodo) {
  const c = order.customer;
  const det = order.lines.map((l) => ({ pid: l.pid, qty: l.qty, unit: l.unit }));
  const res = await db.batch([
    db.prepare(`INSERT INTO clientes (dni, nombre, apellido, telefono) VALUES (?1, ?2, ?3, ?4)
                ON CONFLICT (dni) DO UPDATE SET nombre = excluded.nombre, apellido = excluded.apellido, telefono = excluded.telefono`)
      .bind(c.dni, c.nombre, c.apellido, c.phone),
    db.prepare("INSERT INTO ventas (id_cliente, total, estado) VALUES ((SELECT id_cliente FROM clientes WHERE dni = ?1), ?2, 'pendiente')").bind(c.dni, order.total),
    db.prepare(`INSERT INTO detalle_ventas (id_venta, id_producto, cantidad, precio_unitario)
                SELECT (SELECT max(id_venta) FROM ventas), value->>'$.pid', value->>'$.qty', value->>'$.unit' FROM json_each(?1)`).bind(JSON.stringify(det)),
    db.prepare("INSERT INTO web_ventas (id_venta, metodo, entrega) VALUES ((SELECT max(id_venta) FROM ventas), ?1, ?2)").bind(metodo, order.delivery),
    db.prepare("SELECT max(id_venta) AS id FROM ventas"),
  ]);
  return res[4].results[0].id;
}

const bump = (db) => db.prepare("UPDATE web_config SET valor = CAST(valor AS INTEGER) + 1 WHERE clave = 'version'");
const qtyOf = "coalesce((SELECT sum(d.cantidad) FROM detalle_ventas d WHERE d.id_venta = ?1 AND d.id_producto = productos.id_producto), 0)";
const inSale = "id_producto IN (SELECT id_producto FROM detalle_ventas WHERE id_venta = ?1)";

/**
 * Cambia el estado de una venta. 'pagada' descuenta el stock; pasar de 'pagada' a 'cancelada' lo devuelve;
 * una venta pendiente que se cancela no toca el stock. Todo en un batch. Devuelve true si cambió algo.
 * onlyFromPending: para el webhook de Mercado Pago (un pago rechazado solo cancela si seguía pendiente).
 */
export async function dbSetSaleState(db, id, estado, { pagoMp = null, onlyFromPending = false } = {}) {
  let res;
  if (estado === "pagada") {
    res = await db.batch([
      db.prepare(`UPDATE productos SET stock = max(0, stock - ${qtyOf}) WHERE ${inSale}
                  AND (SELECT estado FROM ventas WHERE id_venta = ?1) <> 'pagada'`).bind(id),
      db.prepare("UPDATE ventas SET estado = 'pagada' WHERE id_venta = ?1 AND estado <> 'pagada'").bind(id),
      db.prepare("UPDATE web_ventas SET pago_mp = coalesce(?2, pago_mp) WHERE id_venta = ?1").bind(id, pagoMp),
      bump(db),
    ]);
  } else if (estado === "cancelada") {
    const from = onlyFromPending ? "('pendiente')" : "('pendiente', 'pagada')";
    res = await db.batch([
      db.prepare(`UPDATE productos SET stock = stock + ${qtyOf} WHERE ${inSale}
                  AND (SELECT estado FROM ventas WHERE id_venta = ?1) = 'pagada' AND ?2 = 0`).bind(id, onlyFromPending ? 1 : 0),
      db.prepare(`UPDATE ventas SET estado = 'cancelada' WHERE id_venta = ?1 AND estado IN ${from}`).bind(id),
      db.prepare("UPDATE web_ventas SET pago_mp = coalesce(?2, pago_mp) WHERE id_venta = ?1").bind(id, pagoMp),
      bump(db),
    ]);
  } else throw new Error("Estado inválido.");
  return res[1].meta.changes > 0;
}

export async function dbGetSale(db, id) {
  return db.prepare("SELECT id_venta, total, estado FROM ventas WHERE id_venta = ?1").bind(id).first();
}

/** Guarda una consulta mayorista (cliente con DNI + consulta). Devuelve el id_consulta. */
export async function dbCreateConsulta(db, c, detalle) {
  const res = await db.batch([
    db.prepare(`INSERT INTO clientes (dni, nombre, apellido, telefono, ciudad) VALUES (?1, ?2, ?3, ?4, ?5)
                ON CONFLICT (dni) DO UPDATE SET nombre = excluded.nombre, apellido = excluded.apellido, telefono = excluded.telefono,
                  ciudad = coalesce(excluded.ciudad, clientes.ciudad)`).bind(c.dni, c.nombre, c.apellido, c.phone, c.ciudad || null),
    db.prepare("INSERT INTO web_consultas (id_cliente, detalle) VALUES ((SELECT id_cliente FROM clientes WHERE dni = ?1), ?2)").bind(c.dni, detalle),
    db.prepare("SELECT max(id_consulta) AS id FROM web_consultas"),
  ]);
  return res[2].results[0].id;
}

export async function dbSetConsulta(db, id, estado) {
  const r = await db.prepare("UPDATE web_consultas SET estado = ?2 WHERE id_consulta = ?1").bind(id, estado).run();
  return r.meta.changes > 0;
}

/** Datos para la pestaña Ventas del panel: últimas ventas, stock bajo y más vendidos (vistas del esquema). */
export async function dbAdminReport(db) {
  const [consultas, ventas, items, bajo, top, clientes] = await db.batch([
    db.prepare(`SELECT q.id_consulta, q.fecha, q.detalle, q.estado, c.nombre || ' ' || c.apellido AS cliente, c.dni, c.telefono, c.ciudad
                FROM web_consultas q JOIN clientes c ON c.id_cliente = q.id_cliente ORDER BY q.id_consulta DESC LIMIT 50`),
    db.prepare(`SELECT v.id_venta, v.fecha_venta, v.total, v.estado, c.nombre || ' ' || c.apellido AS cliente, c.dni, c.telefono,
                       w.metodo, w.entrega, w.pago_mp
                FROM ventas v JOIN clientes c ON c.id_cliente = v.id_cliente LEFT JOIN web_ventas w ON w.id_venta = v.id_venta
                ORDER BY v.id_venta DESC LIMIT 100`),
    db.prepare(`SELECT d.id_venta, p.nombre, p.talle, d.cantidad, d.precio_unitario FROM detalle_ventas d
                JOIN productos p ON p.id_producto = d.id_producto
                WHERE d.id_venta IN (SELECT id_venta FROM ventas ORDER BY id_venta DESC LIMIT 100)`),
    db.prepare(`SELECT s.codigo, s.nombre, s.talle, s.stock FROM vw_stock_bajo s
                JOIN web_modelos w ON s.codigo LIKE w.modelo || '-%' AND w.activo = 1 WHERE s.stock <= 1`),
    // Igual que vw_top_cascos pero solo con ventas pagadas (la vista del esquema cuenta también pendientes y canceladas).
    db.prepare(`SELECT p.nombre AS casco, sum(d.cantidad) AS unidades_vendidas, sum(d.cantidad * d.precio_unitario) AS ingresos
                FROM detalle_ventas d JOIN ventas v ON v.id_venta = d.id_venta AND v.estado = 'pagada'
                JOIN productos p ON p.id_producto = d.id_producto
                GROUP BY p.nombre ORDER BY unidades_vendidas DESC LIMIT 10`),
    db.prepare("SELECT * FROM vw_clientes_frecuentes WHERE compras_realizadas > 0 LIMIT 10"),
  ]);
  const byVenta = {};
  for (const it of items.results) (byVenta[it.id_venta] ||= []).push(it);
  return {
    ventas: ventas.results.map((v) => ({ ...v, codigo: saleCode(v.id_venta), items: byVenta[v.id_venta] || [] })),
    stockBajo: bajo.results, top: top.results, clientes: clientes.results,
    consultas: consultas.results.map((q) => ({ ...q, codigo: "M-" + String(q.id_consulta).padStart(4, "0") })),
  };
}
