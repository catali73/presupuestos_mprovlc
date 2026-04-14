-- Añade el campo tipo_facturacion a la tabla presupuestos
ALTER TABLE presupuestos
  ADD COLUMN IF NOT EXISTS tipo_facturacion VARCHAR(20);
