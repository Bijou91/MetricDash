-- CU-05: rondas de pruebas (test_suites) y estado global del tablero (dashboards).
-- Idempotente: también se aplica a volúmenes ya existentes:
--   docker exec sqa_db psql -U sqa_user -d sqa_dashboard -f /docker-entrypoint-initdb.d/03_cu05.sql

CREATE TABLE IF NOT EXISTS test_suites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cutoff_id UUID NOT NULL REFERENCES evaluation_cutoffs(id) ON DELETE CASCADE,
  version VARCHAR(100) NOT NULL,
  planned_cases INT NOT NULL CHECK (planned_cases > 0),
  executed_cases INT NOT NULL CHECK (executed_cases > 0 AND executed_cases <= planned_cases),
  passed_cases INT NOT NULL CHECK (passed_cases >= 0),
  failed_cases INT NOT NULL CHECK (failed_cases >= 0),
  coverage_pct DECIMAL NOT NULL,
  pass_rate_pct DECIMAL NOT NULL,
  explanatory_note TEXT,
  executed_at TIMESTAMP NOT NULL DEFAULT now(),
  CHECK (passed_cases + failed_cases = executed_cases)
);

CREATE INDEX IF NOT EXISTS ix_test_suites_cutoff ON test_suites (cutoff_id);

CREATE TABLE IF NOT EXISTS dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES monitored_projects(id) ON DELETE CASCADE,
  health_status VARCHAR(30) NOT NULL DEFAULT 'SIN_DATOS',
  last_alert_message TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Sincronización de constraints en volúmenes existentes (compatibilidad con rol DEVELOPER y estados de sqa_activities)
ALTER TABLE project_members DROP CONSTRAINT IF EXISTS project_members_role_check;
ALTER TABLE project_members ADD CONSTRAINT project_members_role_check
  CHECK (role IN ('QA', 'TECNICO', 'GESTION_PROYECTO', 'DEVELOPER'));

ALTER TABLE sqa_activities DROP CONSTRAINT IF EXISTS sqa_activities_status_check;
ALTER TABLE sqa_activities ADD CONSTRAINT sqa_activities_status_check
  CHECK (status IN ('PLANNED', 'IN_PROGRESS', 'DONE', 'PLANIFICADA', 'EN_CURSO', 'REALIZADA'));

-- Completar los 4 cortes del periodo (CP2, CP3, CP4) para proyectos ya existentes que solo tenían CP1
INSERT INTO evaluation_cutoffs (project_id, cutoff_number, cutoff_name, kloc, planned_sqa_acts, executed_sqa_acts, health_status, notes)
SELECT c1.project_id, v.num, v.name, c1.kloc, c1.planned_sqa_acts, c1.executed_sqa_acts, 'SIN_DATOS', v.notes
  FROM evaluation_cutoffs c1
  CROSS JOIN (VALUES
    (2, 'CP2-Diseño de Componentes', 'Segundo corte de evaluación del periodo.'),
    (3, 'CP3-Construcción de Software', 'Tercer corte de evaluación del periodo.'),
    (4, 'CP4-Integración y Pruebas (Final)', 'Corte final de evaluación del periodo.')
  ) AS v(num, name, notes)
 WHERE c1.cutoff_number = 1
   AND NOT EXISTS (
     SELECT 1 FROM evaluation_cutoffs cx
      WHERE cx.project_id = c1.project_id AND cx.cutoff_number = v.num
   );



