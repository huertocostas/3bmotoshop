-- Consultas por precio mayorista hechas desde la web. El cliente queda en clientes (con su DNI y ciudad).
PRAGMA foreign_keys = ON;

CREATE TABLE web_consultas (
  id_consulta INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha       TEXT NOT NULL DEFAULT (datetime('now')),
  id_cliente  INTEGER NOT NULL,
  detalle     TEXT NOT NULL CHECK (length(detalle) <= 2000),
  estado      TEXT NOT NULL DEFAULT 'nueva' CHECK (estado IN ('nueva', 'respondida')),
  FOREIGN KEY (id_cliente) REFERENCES clientes (id_cliente) ON UPDATE CASCADE ON DELETE RESTRICT
);
CREATE INDEX idx_consulta_fecha ON web_consultas (fecha);
