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
  project_type VARCHAR(50) DEFAULT 'DESARROLLO_NUEVO',
  estimated_kloc DECIMAL DEFAULT 1.0,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Miembros del equipo del proyecto (CU-01 / ER)
CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES monitored_projects(id) ON DELETE CASCADE,
  member_name VARCHAR(150) NOT NULL,
  email VARCHAR(150),
  role VARCHAR(50) NOT NULL CHECK (role IN ('QA', 'TECNICO', 'GESTION_PROYECTO')),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Actividades planificadas del plan base de QA (CU-01 / ER: sqa_activities)
CREATE TABLE IF NOT EXISTS sqa_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES monitored_projects(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('REVIEW', 'TEST', 'DEFECT', 'AUDIT')),
  iso_practice_ref VARCHAR(100),
  phase VARCHAR(50) NOT NULL CHECK (phase IN ('ANALISIS_REQUERIMIENTOS', 'DISENO_COMPONENTES', 'CONSTRUCCION_SOFTWARE', 'INTEGRACION_Y_PRUEBAS')),
  planned_date DATE,
  execution_date DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'IN_PROGRESS', 'DONE')),
  responsible_role VARCHAR(50) NOT NULL CHECK (responsible_role IN ('QA', 'TECNICO', 'GESTION_PROYECTO')),
  evidence_url VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Líneas base de configuración (CU-01 / ER: configuration_baselines)
CREATE TABLE IF NOT EXISTS configuration_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES monitored_projects(id) ON DELETE CASCADE,
  baseline_name VARCHAR(100) NOT NULL,
  git_commit_hash VARCHAR(100),
  tag_name VARCHAR(50),
  approval_date DATE NOT NULL DEFAULT CURRENT_DATE,
  dictamen_notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Cortes de evaluación / Tablero de control inicial (CU-01 / ER: evaluation_cutoffs)
CREATE TABLE IF NOT EXISTS evaluation_cutoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES monitored_projects(id) ON DELETE CASCADE,
  cutoff_number INT NOT NULL DEFAULT 1,
  cutoff_name VARCHAR(50) NOT NULL DEFAULT 'CP1-Baseline',
  cutoff_date DATE NOT NULL DEFAULT CURRENT_DATE,
  kloc DECIMAL NOT NULL DEFAULT 1.0,
  planned_sqa_acts INT DEFAULT 0,
  executed_sqa_acts INT DEFAULT 0,
  health_status VARCHAR(50) NOT NULL DEFAULT 'SIN_DATOS',
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
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

-- Periodo académico activo oficial del ciclo escolar
INSERT INTO academic_periods (id, code, name, start_date, end_date, is_active)
VALUES ('00000000-0000-0000-0000-0000000000a1', 'AGO-DIC-2026', 'Ciclo Escolar Agosto-Diciembre 2026', '2026-08-15', '2026-12-19', true)
ON CONFLICT (id) DO UPDATE SET is_active = true;

