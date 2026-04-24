-- unidades y jornadas pasan a NUMERIC para admitir valores decimales (ej: 0.5 jornadas)
ALTER TABLE lineas_equipamiento
  ALTER COLUMN unidades TYPE NUMERIC(10,2),
  ALTER COLUMN jornadas TYPE NUMERIC(10,2);

ALTER TABLE lineas_personal_general
  ALTER COLUMN unidades TYPE NUMERIC(10,2),
  ALTER COLUMN jornadas TYPE NUMERIC(10,2);

ALTER TABLE lineas_logistica
  ALTER COLUMN unidades TYPE NUMERIC(10,2),
  ALTER COLUMN jornadas TYPE NUMERIC(10,2);

ALTER TABLE lineas_personal_contratado
  ALTER COLUMN jornadas TYPE NUMERIC(10,2);

ALTER TABLE lineas_personal_altas_bajas
  ALTER COLUMN jornadas TYPE NUMERIC(10,2);
