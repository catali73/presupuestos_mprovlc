-- ============================================================
-- GESTIÓN PRESUPUESTOS - Schema inicial
-- ============================================================

-- Responsables (usuarios con acceso al sistema)
CREATE TABLE IF NOT EXISTS responsables (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  telefono VARCHAR(50),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clientes
CREATE TABLE IF NOT EXISTS clientes (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  razon_social VARCHAR(255),
  cif VARCHAR(50),
  direccion TEXT,
  tipologia VARCHAR(20) CHECK (tipologia IN ('GRUPO', 'EXTERNO')),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contactos por cliente (N por cliente)
CREATE TABLE IF NOT EXISTS contactos_cliente (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nombre VARCHAR(255) NOT NULL,
  telefono VARCHAR(50),
  email VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tarifas de equipos
CREATE TABLE IF NOT EXISTS tarifas_equipos (
  id SERIAL PRIMARY KEY,
  descripcion VARCHAR(500) NOT NULL,
  tarifa_montaje DECIMAL(10,2),
  tarifa_trabajo DECIMAL(10,2),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tarifa personas por posición
CREATE TABLE IF NOT EXISTS tarifa_personas (
  id SERIAL PRIMARY KEY,
  posicion VARCHAR(255) NOT NULL,
  tarifa_dia DECIMAL(10,2) NOT NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tarifa dietas
CREATE TABLE IF NOT EXISTS tarifa_dietas (
  id SERIAL PRIMARY KEY,
  tipo_dieta VARCHAR(255) NOT NULL,
  importe DECIMAL(10,2) NOT NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Presupuestos (cabecera)
CREATE TABLE IF NOT EXISTS presupuestos (
  id SERIAL PRIMARY KEY,
  numero VARCHAR(20) UNIQUE NOT NULL,           -- Formato: YYYYMMDDXXX (auto)
  fecha_presupuesto DATE DEFAULT CURRENT_DATE,  -- Automática
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('GENERAL', 'PERSONAL')),
  cliente_id INTEGER REFERENCES clientes(id),
  contacto_id INTEGER REFERENCES contactos_cliente(id),  -- Solicitado/Petición
  responsable_id INTEGER REFERENCES responsables(id),
  departamento VARCHAR(50) CHECK (departamento IN (
    'CAMARAS_ESPECIALES', 'PRODUCCIONES_VLC', 'INTERNACIONAL', 'VALENCIA_MEDIA'
  )),
  tipologia VARCHAR(50) CHECK (tipologia IN (
    'LIGA', 'CHAMPIONS', 'EVENTOS', 'PROGRAMAS'
  )),
  evento VARCHAR(500),
  competicion VARCHAR(500),   -- Solo tipo PERSONAL (ej: "EUROPEAN QUALIFYERS")
  localizacion VARCHAR(500),
  fecha_inicio DATE,
  fecha_fin DATE,
  status VARCHAR(30) DEFAULT 'PREPARADO' CHECK (status IN (
    'PREPARADO', 'ENVIADO', 'APROBADO', 'DESCARTADO', 'FACTURADO', 'PENDIENTE_FACTURAR'
  )),
  iva_porcentaje DECIMAL(5,2) DEFAULT 21.00,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LÍNEAS DEL PRESUPUESTO GENERAL
-- ============================================================

-- Líneas de equipamiento (tipo GENERAL)
CREATE TABLE IF NOT EXISTS lineas_equipamiento (
  id SERIAL PRIMARY KEY,
  presupuesto_id INTEGER NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,
  descripcion VARCHAR(500) NOT NULL,
  uds INTEGER DEFAULT 1,
  unidades INTEGER,
  jornadas INTEGER,
  coste_jornada DECIMAL(10,2),
  importe DECIMAL(10,2),
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Líneas de personal técnico (tipo GENERAL)
CREATE TABLE IF NOT EXISTS lineas_personal_general (
  id SERIAL PRIMARY KEY,
  presupuesto_id INTEGER NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,
  descripcion VARCHAR(500) NOT NULL,
  uds INTEGER DEFAULT 1,
  unidades INTEGER,
  jornadas INTEGER,
  coste_jornada DECIMAL(10,2),
  importe DECIMAL(10,2),
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Líneas de logística (AMBOS tipos — columnas distintas)
CREATE TABLE IF NOT EXISTS lineas_logistica (
  id SERIAL PRIMARY KEY,
  presupuesto_id INTEGER NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,
  descripcion VARCHAR(500) NOT NULL,
  -- Tipo GENERAL: uds + unidades + jornadas + coste_jornada
  uds INTEGER,
  unidades INTEGER,
  jornadas INTEGER,
  coste_jornada DECIMAL(10,2),
  -- Tipo PERSONAL: cantidad + precio
  cantidad INTEGER,
  precio DECIMAL(10,2),
  -- Común
  importe DECIMAL(10,2),
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LÍNEAS DEL PRESUPUESTO PERSONAL VALENCIA
-- ============================================================

-- Líneas de personal contratado (tipo PERSONAL)
CREATE TABLE IF NOT EXISTS lineas_personal_contratado (
  id SERIAL PRIMARY KEY,
  presupuesto_id INTEGER NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,
  descripcion VARCHAR(500) NOT NULL,   -- Posición / descripción del rol
  tarifa DECIMAL(10,2),
  jornadas INTEGER,
  num_pax INTEGER,
  dieta DECIMAL(10,2),
  num_dietas INTEGER,
  importe DECIMAL(10,2),
  es_especial BOOLEAN DEFAULT false,  -- Para "JORNADAS ESPECIALES" y "FESTIVO"
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Líneas de personal altas/bajas (tipo PERSONAL)
CREATE TABLE IF NOT EXISTS lineas_personal_altas_bajas (
  id SERIAL PRIMARY KEY,
  presupuesto_id INTEGER NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,
  descripcion VARCHAR(500) NOT NULL,
  tarifa DECIMAL(10,2),
  jornadas INTEGER,
  num_pax INTEGER,
  dieta DECIMAL(10,2),
  num_dietas INTEGER,
  importe DECIMAL(10,2),
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_presupuestos_status ON presupuestos(status);
CREATE INDEX IF NOT EXISTS idx_presupuestos_responsable ON presupuestos(responsable_id);
CREATE INDEX IF NOT EXISTS idx_presupuestos_cliente ON presupuestos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_presupuestos_departamento ON presupuestos(departamento);
CREATE INDEX IF NOT EXISTS idx_presupuestos_fecha_fin ON presupuestos(fecha_fin);
CREATE INDEX IF NOT EXISTS idx_contactos_cliente ON contactos_cliente(cliente_id);

-- ============================================================
-- TRIGGER: updated_at automático
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_responsables_updated_at
  BEFORE UPDATE ON responsables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_clientes_updated_at
  BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_tarifas_equipos_updated_at
  BEFORE UPDATE ON tarifas_equipos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_tarifa_personas_updated_at
  BEFORE UPDATE ON tarifa_personas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_tarifa_dietas_updated_at
  BEFORE UPDATE ON tarifa_dietas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_presupuestos_updated_at
  BEFORE UPDATE ON presupuestos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
