-- Añade el campo semana (1-53) a la tabla presupuestos
ALTER TABLE presupuestos
  ADD COLUMN IF NOT EXISTS semana SMALLINT;
