-- Esquema de gestion_cascos (huertocostas/gestion-cascos) pasado de MySQL a SQLite para Cloudflare D1.
-- Mismas tablas, columnas, restricciones y vistas. Cambios por el motor:
--   * INT auto_increment -> INTEGER PRIMARY KEY AUTOINCREMENT
--   * enum('pendiente','pagada','cancelada') -> TEXT con CHECK
--   * varchar(n) -> TEXT con CHECK de largo; decimal -> NUMERIC
--   * concat(a, ' ', b) -> a || ' ' || b; current_date / current_timestamp -> date('now') / datetime('now') (UTC)
-- D1 aplica las claves foráneas siempre (equivale a PRAGMA foreign_keys = ON).
-- No se cargan los clientes ni las ventas de ejemplo del trabajo práctico.
PRAGMA foreign_keys = ON;

-- Tabla marcas: las marcas y su país de origen
CREATE TABLE marcas (
  id_marca    INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre      TEXT NOT NULL UNIQUE CHECK (length(nombre) <= 80),
  pais_origen TEXT CHECK (pais_origen IS NULL OR length(pais_origen) <= 60)
);

-- Tabla categorias: tipo de cascos
CREATE TABLE categorias (
  id_categoria INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre       TEXT NOT NULL UNIQUE CHECK (length(nombre) <= 60),
  descripcion  TEXT CHECK (descripcion IS NULL OR length(descripcion) <= 255)
);

-- Tabla productos: los cascos que se venden (una fila por modelo y talle)
CREATE TABLE productos (
  id_producto  INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo       TEXT NOT NULL UNIQUE CHECK (length(codigo) <= 30),
  nombre       TEXT NOT NULL CHECK (length(nombre) <= 100),
  id_marca     INTEGER NOT NULL,
  id_categoria INTEGER NOT NULL,
  talle        TEXT NOT NULL CHECK (length(talle) <= 10),
  color        TEXT CHECK (color IS NULL OR length(color) <= 40),
  precio_venta NUMERIC NOT NULL CHECK (precio_venta > 0),
  stock        INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  FOREIGN KEY (id_marca) REFERENCES marcas (id_marca) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (id_categoria) REFERENCES categorias (id_categoria) ON UPDATE CASCADE ON DELETE RESTRICT
);

-- Tabla clientes: personas que compran cascos
CREATE TABLE clientes (
  id_cliente     INTEGER PRIMARY KEY AUTOINCREMENT,
  dni            TEXT NOT NULL UNIQUE CHECK (length(dni) <= 15),
  nombre         TEXT NOT NULL CHECK (length(nombre) <= 80),
  apellido       TEXT NOT NULL CHECK (length(apellido) <= 80),
  telefono       TEXT CHECK (telefono IS NULL OR length(telefono) <= 20),
  email          TEXT UNIQUE CHECK (email IS NULL OR length(email) <= 120),
  ciudad         TEXT CHECK (ciudad IS NULL OR length(ciudad) <= 80),
  fecha_registro TEXT NOT NULL DEFAULT (date('now'))
);

-- Tabla ventas: cada compra realizada
CREATE TABLE ventas (
  id_venta    INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha_venta TEXT NOT NULL DEFAULT (datetime('now')),
  id_cliente  INTEGER NOT NULL,
  total       NUMERIC NOT NULL DEFAULT 0,
  estado      TEXT NOT NULL DEFAULT 'pagada' CHECK (estado IN ('pendiente', 'pagada', 'cancelada')),
  FOREIGN KEY (id_cliente) REFERENCES clientes (id_cliente) ON UPDATE CASCADE ON DELETE RESTRICT
);

-- Tabla detalle_ventas: qué cascos, cuántos y a qué precio
CREATE TABLE detalle_ventas (
  id_detalle      INTEGER PRIMARY KEY AUTOINCREMENT,
  id_venta        INTEGER NOT NULL,
  id_producto     INTEGER NOT NULL,
  cantidad        INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC NOT NULL,
  FOREIGN KEY (id_venta) REFERENCES ventas (id_venta) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (id_producto) REFERENCES productos (id_producto) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX idx_producto_nombre ON productos (nombre);
CREATE INDEX idx_venta_fecha ON ventas (fecha_venta);

-- Vista 1: detalle completo de cada venta
CREATE VIEW vw_detalle_ventas AS
SELECT v.id_venta, v.fecha_venta, c.nombre || ' ' || c.apellido AS cliente, p.nombre AS casco, m.nombre AS marca,
       d.cantidad, d.precio_unitario, (d.cantidad * d.precio_unitario) AS subtotal, v.estado
FROM ventas v
JOIN clientes c       ON c.id_cliente  = v.id_cliente
JOIN detalle_ventas d ON d.id_venta    = v.id_venta
JOIN productos p      ON p.id_producto = d.id_producto
JOIN marcas m         ON m.id_marca    = p.id_marca;

-- Vista 2: cascos con stock bajo (menos de 5 unidades)
CREATE VIEW vw_stock_bajo AS
SELECT codigo, nombre, talle, stock, precio_venta
FROM productos
WHERE stock < 5
ORDER BY stock ASC;

-- Vista 3: total gastado por cada cliente
CREATE VIEW vw_clientes_frecuentes AS
SELECT c.dni, c.nombre || ' ' || c.apellido AS cliente, count(v.id_venta) AS compras_realizadas,
       coalesce(sum(v.total), 0) AS total_gastado
FROM clientes c
LEFT JOIN ventas v ON v.id_cliente = c.id_cliente AND v.estado = 'pagada'
GROUP BY c.id_cliente, c.dni, c.nombre, c.apellido
ORDER BY total_gastado DESC;

-- Vista 4: cascos más vendidos
CREATE VIEW vw_top_cascos AS
SELECT p.codigo, p.nombre AS casco, m.nombre AS marca, sum(d.cantidad) AS unidades_vendidas,
       sum(d.cantidad * d.precio_unitario) AS ingresos
FROM detalle_ventas d
JOIN productos p ON p.id_producto = d.id_producto
JOIN marcas m    ON m.id_marca    = p.id_marca
GROUP BY p.id_producto, p.codigo, p.nombre, m.nombre
ORDER BY unidades_vendidas DESC;
