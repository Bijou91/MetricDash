-- Esquema idempotente: se ejecuta en cada arranque del API.
-- academic_periods y monitored_projects siguen el diagrama ER.
CREATE TABLE IF NOT EXISTS academic_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS monitored_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL UNIQUE REFERENCES academic_periods(id),
  name VARCHAR(150) NOT NULL,
  git_repo_url VARCHAR(255),
  description TEXT,
  technical_lead_role VARCHAR(100),
  qa_lead_role VARCHAR(100),
  pm_role VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Configuración versionada de metas y umbrales (CU-02). No está en el ER actual: agregarla al diagrama.
CREATE TABLE IF NOT EXISTS metric_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES monitored_projects(id),
  version INT NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (project_id, version)
);

-- Solo una configuración vigente por proyecto.
CREATE UNIQUE INDEX IF NOT EXISTS ux_metric_configurations_current
  ON metric_configurations (project_id) WHERE is_current;

CREATE TABLE IF NOT EXISTS metric_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  configuration_id UUID NOT NULL REFERENCES metric_configurations(id) ON DELETE CASCADE,
  metric_type VARCHAR(30) NOT NULL
    CHECK (metric_type IN ('DENSIDAD_DEFECTOS','COBERTURA_PRUEBAS','TASA_EXITO_PRUEBAS','CUMPLIMIENTO_SQA')),
  target_value DECIMAL NOT NULL,
  warning_threshold DECIMAL NOT NULL,
  critical_threshold DECIMAL NOT NULL,
  direction VARCHAR(20) NOT NULL CHECK (direction IN ('MAYOR_ES_MEJOR','MENOR_ES_MEJOR')),
  unit VARCHAR(20) NOT NULL,
  UNIQUE (configuration_id, metric_type)
);

-- shortcut: periodo y proyecto demo fijos mientras no exista CU-01; quitar al implementar el registro de proyectos.
INSERT INTO academic_periods (id, code, name, start_date, end_date, is_active)
VALUES ('00000000-0000-0000-0000-0000000000a1', 'DEMO', 'Periodo demo', '2026-08-01', '2026-12-31', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO monitored_projects (id, period_id, name)
VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'Proyecto demo')
ON CONFLICT (id) DO NOTHING;
