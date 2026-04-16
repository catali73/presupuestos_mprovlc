-- Añadir categoría a tarifa_dietas para diferenciar Contratado vs Altas/Bajas
ALTER TABLE tarifa_dietas
  ADD COLUMN IF NOT EXISTS categoria VARCHAR(50) NOT NULL DEFAULT 'CONTRATADO';

-- Las dietas existentes se asignan a CONTRATADO (valor por defecto)
-- El usuario deberá crear entradas nuevas para ALTAS_BAJAS con sus importes propios
