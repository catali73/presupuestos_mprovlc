-- Tabla de tipologías dinámicas
CREATE TABLE IF NOT EXISTS tipologias (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL UNIQUE,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migrar los 4 valores actuales
INSERT INTO tipologias (nombre) VALUES
  ('LIGA'), ('CHAMPIONS'), ('EVENTOS'), ('PROGRAMAS')
ON CONFLICT (nombre) DO NOTHING;

-- Eliminar el CHECK constraint fijo de presupuestos
ALTER TABLE presupuestos DROP CONSTRAINT IF EXISTS presupuestos_tipologia_check;

-- Ampliar longitud de la columna por si las tipologías nuevas son más largas
ALTER TABLE presupuestos ALTER COLUMN tipologia TYPE VARCHAR(255);
