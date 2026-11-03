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

