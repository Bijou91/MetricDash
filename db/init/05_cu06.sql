-- CU-06: Detección de deterioro y gestión de acciones correctivas
-- Idempotente: también se aplica a volúmenes ya existentes:
--   docker exec sqa_db psql -U sqa_user -d sqa_dashboard -f /docker-entrypoint-initdb.d/05_cu06.sql

-- Registro de todas las mediciones para control de tendencia histórica y cálculo de Vn-1
CREATE TABLE IF NOT EXISTS metric_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES monitored_projects(id) ON DELETE CASCADE,
  cutoff_id UUID REFERENCES evaluation_cutoffs(id) ON DELETE SET NULL,
  metric_type VARCHAR(30) NOT NULL
    CHECK (metric_type IN ('DENSIDAD_DEFECTOS','COBERTURA_PRUEBAS','TASA_EXITO_PRUEBAS','CUMPLIMIENTO_SQA')),
  value DECIMAL NOT NULL,
  health_status VARCHAR(30) NOT NULL DEFAULT 'SIN_DATOS',
  recorded_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_metric_measurements_proj_type ON metric_measurements (project_id, metric_type, recorded_at DESC);

-- Alertas de calidad generadas por deterioro de métricas o cruce de umbral (FN-01, FN-02)
CREATE TABLE IF NOT EXISTS quality_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES monitored_projects(id) ON DELETE CASCADE,
  metric_type VARCHAR(30) NOT NULL
    CHECK (metric_type IN ('DENSIDAD_DEFECTOS','COBERTURA_PRUEBAS','TASA_EXITO_PRUEBAS','CUMPLIMIENTO_SQA')),
  cutoff_id UUID REFERENCES evaluation_cutoffs(id) ON DELETE SET NULL,
  initial_value DECIMAL NOT NULL, -- Vα: valor que originó la alerta (usado en FN-08 para eficacia)
  previous_value DECIMAL,         -- Vn-1: valor de la medición anterior
  current_value DECIMAL NOT NULL, -- Vn: valor que presentó deterioro
  severity_status VARCHAR(30) NOT NULL, -- NivelSemaforo (AMARILLO_ADVERTENCIA o ROJO_CRITICO)
  message TEXT NOT NULL,
  trend JSONB NOT NULL DEFAULT '[]'::jsonb,
  possible_causes JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVA'
    CHECK (status IN ('ACTIVA', 'EN_PROCESO', 'RESUELTA', 'DESCARTADA')),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_quality_alerts_project ON quality_alerts (project_id, status);

-- Acciones correctivas creadas por los usuarios para atender una alerta (FN-04, FN-05, FN-06)
CREATE TABLE IF NOT EXISTS corrective_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES quality_alerts(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES monitored_projects(id) ON DELETE CASCADE,
  metric_type VARCHAR(30) NOT NULL
    CHECK (metric_type IN ('DENSIDAD_DEFECTOS','COBERTURA_PRUEBAS','TASA_EXITO_PRUEBAS','CUMPLIMIENTO_SQA')),
  description TEXT NOT NULL,
  cause_addressed TEXT NOT NULL,
  assigned_to UUID NOT NULL REFERENCES project_members(id) ON DELETE RESTRICT,
  commitment_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'abierta'
    CHECK (status IN ('abierta', 'cerrada', 'cancelada')),
  is_effective BOOLEAN DEFAULT NULL, -- NULL: no evaluada aún; TRUE: eficaz (FN-08); FALSE: no eficaz (FA-07.01)
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_corrective_actions_project ON corrective_actions (project_id, status);

-- Historial de verificaciones de eficacia de cada acción correctiva (FN-08, FA-07.01)
CREATE TABLE IF NOT EXISTS verification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL REFERENCES corrective_actions(id) ON DELETE CASCADE,
  measured_value DECIMAL NOT NULL, -- Vn+1
  baseline_value DECIMAL NOT NULL, -- Vα
  is_effective BOOLEAN NOT NULL,
  notes TEXT,
  verified_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_verification_history_action ON verification_history (action_id, verified_at DESC);

