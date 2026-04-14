-- num_dietas pasa a NUMERIC para admitir valores decimales (ej: 1.5 dietas)
ALTER TABLE lineas_personal_contratado
  ALTER COLUMN num_dietas TYPE NUMERIC(10,2);

ALTER TABLE lineas_personal_altas_bajas
  ALTER COLUMN num_dietas TYPE NUMERIC(10,2);
