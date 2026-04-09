-- ============================================================
-- Migración 002: Añadir campo categoria a tarifa_personas
-- Ejecutar en Railway > Postgres > Data > Query
-- ============================================================

ALTER TABLE tarifa_personas
  ADD COLUMN IF NOT EXISTS categoria VARCHAR(50) DEFAULT 'CONTRATADO'
  CHECK (categoria IN ('CAMARAS_ESPECIALES', 'CONTRATADO', 'ALTAS_BAJAS'));

-- Actualizar registros existentes si los hay (se asignan a CONTRATADO por defecto)
-- Si ya tienes registros y sabes cuáles son de Cámaras, puedes actualizarlos:
-- UPDATE tarifa_personas SET categoria = 'CAMARAS_ESPECIALES' WHERE posicion IN ('Cámara A', 'Cámara B', ...);
