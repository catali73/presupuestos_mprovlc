-- Número de factura SAP y PDF adjunto
ALTER TABLE presupuestos
  ADD COLUMN IF NOT EXISTS numero_factura VARCHAR(100),
  ADD COLUMN IF NOT EXISTS factura_pdf BYTEA,
  ADD COLUMN IF NOT EXISTS factura_pdf_nombre VARCHAR(255);
