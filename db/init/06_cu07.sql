-- CU-07: Historial de reportes de salud versionados.
-- Los reportes viven en su propia tabla: antes se insertaban en evaluation_cutoffs, que es la tabla
-- de los cortes oficiales CP1-CP4 que consumen CU-01, CU-03, CU-04 y CU-05 (contaminaba sus selectores).
-- Idempotente: también se aplica a volúmenes ya existentes:
--   docker exec -i sqa_db psql -U sqa_user -d sqa_dashboard < db/init/06_cu07.sql

CREATE TABLE IF NOT EXISTS health_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES monitored_projects(id) ON DELETE CASCADE,
  version INT NOT NULL,
  generated_at TIMESTAMP NOT NULL DEFAULT now(),
  health_status VARCHAR(30) NOT NULL DEFAULT 'SIN_DATOS',
  index_status VARCHAR(20) NOT NULL DEFAULT 'SIN_DATOS'
    CHECK (index_status IN ('CALCULADO', 'INSUFICIENTE', 'SIN_DATOS')),
  health_index DECIMAL,
  executive_notes TEXT,
  breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (project_id, version)
);

CREATE INDEX IF NOT EXISTS ix_health_reports_project ON health_reports (project_id, version DESC);

-- Limpieza: mueve a health_reports los "cortes" que CU-07 había insertado por error en evaluation_cutoffs
-- y los elimina de ahí. Solo toca filas sin datos colgando (pruebas, defectos o métricas del corte).
WITH movidos AS (
  DELETE FROM evaluation_cutoffs ec
   WHERE ec.cutoff_name LIKE 'Corte de Evaluación SQA v%'
     AND NOT EXISTS (SELECT 1 FROM test_suites t WHERE t.cutoff_id = ec.id)
     AND NOT EXISTS (SELECT 1 FROM defects d WHERE d.cutoff_id = ec.id)
     AND NOT EXISTS (SELECT 1 FROM quality_metrics q WHERE q.cutoff_id = ec.id)
  RETURNING ec.project_id, ec.cutoff_number, ec.created_at, ec.health_status, ec.notes
)
INSERT INTO health_reports (project_id, version, generated_at, health_status, index_status, executive_notes)
SELECT project_id,
       ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY cutoff_number),
       created_at,
       health_status,
       CASE WHEN health_status = 'SIN_DATOS' THEN 'SIN_DATOS' ELSE 'CALCULADO' END,
       notes
  FROM movidos
ON CONFLICT (project_id, version) DO NOTHING;
