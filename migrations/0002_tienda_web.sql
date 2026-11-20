-- Lo que la página web necesita y el esquema de gestion_cascos no tiene. No se cambia ninguna tabla del esquema:
-- son tablas aparte, que se unen por clave.
PRAGMA foreign_keys = ON;

-- Un "modelo" de la web (una tarjeta del catálogo) agrupa varias filas de productos, una por talle.
-- productos.codigo = '<modelo>-<talle>' (por ejemplo '48d5c01b-M'); los que no usan talle llevan talle 'Único' y código '<modelo>-U'.
CREATE TABLE web_modelos (
  modelo      TEXT PRIMARY KEY CHECK (length(modelo) <= 24),
  descripcion TEXT NOT NULL DEFAULT '' CHECK (length(descripcion) <= 300),
  img         TEXT NOT NULL DEFAULT '',   -- foto: 'img/p/<id>' (estática) o 'media/<id>' (subida desde el panel, en KV)
  activo      INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
);

-- Datos de cada venta hecha en la web: forma de pago, entrega y número de pago de Mercado Pago.
CREATE TABLE web_ventas (
  id_venta INTEGER PRIMARY KEY,
  metodo   TEXT NOT NULL CHECK (metodo IN ('mp', 'efectivo')),
  entrega  TEXT NOT NULL CHECK (entrega IN ('retiro', 'envio')),
  pago_mp  TEXT,
  FOREIGN KEY (id_venta) REFERENCES ventas (id_venta) ON UPDATE CASCADE ON DELETE CASCADE
);

-- Ajustes del panel: versión del catálogo (para no pisar cambios), fecha y orden de las marcas.
CREATE TABLE web_config (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);
INSERT INTO web_config (clave, valor) VALUES ('version', '1'), ('actualizado', datetime('now')), ('orden_marcas', '[]');

-- Categorías del trabajo práctico, más Accesorios (antiparras, etc.).
INSERT INTO categorias (nombre, descripcion) VALUES
  ('Integral', 'cobertura completa, maxima proteccion y aerodinamica'),
  ('Modular', 'barbilla abatible, versatil para ciudad y viaje'),
  ('Cross', 'diseño para motocross, uso con gafas'),
  ('Accesorios', 'antiparras y otros accesorios');
