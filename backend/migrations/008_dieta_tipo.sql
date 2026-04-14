-- Añade columna dieta_tipo a las tablas de personal para guardar el tipo de dieta seleccionado
ALTER TABLE lineas_personal_contratado
  ADD COLUMN IF NOT EXISTS dieta_tipo VARCHAR(255);

ALTER TABLE lineas_personal_altas_bajas
  ADD COLUMN IF NOT EXISTS dieta_tipo VARCHAR(255);
