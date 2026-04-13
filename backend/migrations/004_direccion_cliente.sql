-- Ampliar dirección del cliente con campos separados
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS codigo_postal VARCHAR(20),
  ADD COLUMN IF NOT EXISTS ciudad VARCHAR(255),
  ADD COLUMN IF NOT EXISTS pais VARCHAR(100) DEFAULT 'España';
