-- ============================================================
-- Migración 003: Orden de posiciones en tarifa_personas
-- Ejecutar en Railway > Postgres > Database > Data > Query
-- ============================================================

-- 1. Añadir columna orden
ALTER TABLE tarifa_personas ADD COLUMN IF NOT EXISTS orden INTEGER DEFAULT 0;

-- 2. Insertar/actualizar posiciones PERSONAL CONTRATADO en orden correcto
-- (Si ya existen con otro nombre exacto, actualiza el orden desde la UI de Tarifas)

INSERT INTO tarifa_personas (posicion, tarifa_dia, categoria, orden) VALUES
  ('AUXILIAR AUDIO/ VIDEO',      0, 'CONTRATADO', 1),
  ('RESPONSABLE MAT. AUDIO',     0, 'CONTRATADO', 2),
  ('OP. CAMARA MONTADOR',        0, 'CONTRATADO', 3),
  ('OP. CAMARA',                 0, 'CONTRATADO', 4),
  ('OP. CCU',                    0, 'CONTRATADO', 5),
  ('OP. EVS',                    0, 'CONTRATADO', 6),
  ('MIXER',                      0, 'CONTRATADO', 7),
  ('REALIZADOR',                 0, 'CONTRATADO', 8),
  ('PRODUCTOR',                  0, 'CONTRATADO', 9),
  ('TÉCNICO AUDIO',              0, 'CONTRATADO', 10),
  ('JEFE MONTAJE',               0, 'CONTRATADO', 11),
  ('TÉCNICO SONIDO',             0, 'CONTRATADO', 12),
  ('JORNADAS ESPECIALES',        0, 'CONTRATADO', 13)
ON CONFLICT DO NOTHING;

-- 3. Insertar posiciones PERSONAL ALTAS / BAJAS
INSERT INTO tarifa_personas (posicion, tarifa_dia, categoria, orden) VALUES
  ('AUXILIAR AUDIO/ VIDEO',      0, 'ALTAS_BAJAS', 1),
  ('OP. CAMARA MONTADOR',        0, 'ALTAS_BAJAS', 2),
  ('OP. CAMARA',                 0, 'ALTAS_BAJAS', 3),
  ('OP. CCU',                    0, 'ALTAS_BAJAS', 4),
  ('OP. EVS',                    0, 'ALTAS_BAJAS', 5),
  ('MIXER',                      0, 'ALTAS_BAJAS', 6),
  ('PRODUCTOR',                  0, 'ALTAS_BAJAS', 7)
ON CONFLICT DO NOTHING;

-- 4. Si tenías registros existentes con los mismos nombres, actualiza su orden:
-- (Ejecuta solo si necesitas actualizar registros duplicados)
-- UPDATE tarifa_personas SET orden=1  WHERE posicion='AUXILIAR AUDIO/ VIDEO' AND categoria='CONTRATADO' AND tarifa_dia > 0;
-- UPDATE tarifa_personas SET orden=3  WHERE posicion='OP. CAMARA MONTADOR'   AND categoria='CONTRATADO' AND tarifa_dia > 0;
-- ... etc. O usa la UI de Tarifas para editar el campo Orden de cada registro.
