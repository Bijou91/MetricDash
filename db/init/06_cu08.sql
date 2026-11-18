-- CU-08: Cerrar el periodo y generar la bitácora de SQA
-- Idempotente: también se aplica a volúmenes ya existentes:
--   docker exec sqa_db psql -U sqa_user -d sqa_dashboard -f /docker-entrypoint-initdb.d/06_cu08.sql

-- Estado del periodo (isActive lo administra el CU-01; status lo cambia el CU-08).
ALTER TABLE academic_periods ADD COLUMN IF NOT EXISTS status VARCHAR(10) NOT NULL DEFAULT 'ABIERTO';
ALTER TABLE academic_periods DROP CONSTRAINT IF EXISTS academic_periods_status_check;
ALTER TABLE academic_periods ADD CONSTRAINT academic_periods_status_check CHECK (status IN ('ABIERTO', 'CERRADO'));

-- FN-03 (a): una actividad cancelada deja de ser exigible.
ALTER TABLE sqa_activities DROP CONSTRAINT IF EXISTS sqa_activities_status_check;
ALTER TABLE sqa_activities ADD CONSTRAINT sqa_activities_status_check
  CHECK (status IN ('PLANNED', 'IN_PROGRESS', 'DONE', 'PLANIFICADA', 'EN_CURSO', 'REALIZADA', 'CANCELADA'));

-- FN-09: cierre del periodo con el reporte final (PDF) y el corte donde quedó versionado.
CREATE TABLE IF NOT EXISTS period_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES monitored_projects(id) ON DELETE CASCADE,
  period_id UUID NOT NULL UNIQUE REFERENCES academic_periods(id),
  closed_at TIMESTAMP NOT NULL DEFAULT now(),
  closed_by UUID REFERENCES project_members(id) ON DELETE SET NULL,
  report_cutoff_id UUID REFERENCES evaluation_cutoffs(id) ON DELETE SET NULL,
  health_index DECIMAL,
  index_legend VARCHAR(30),
  final_report_filename VARCHAR(150) NOT NULL,
  final_report_pdf BYTEA NOT NULL
);

-- FN-03 / FN-09: resolución de cada pendiente; origin_period_id permite al CU-01 precargar los arrastrados.
CREATE TABLE IF NOT EXISTS pending_resolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closure_id UUID NOT NULL REFERENCES period_closures(id) ON DELETE CASCADE,
  pending_type VARCHAR(30) NOT NULL
    CHECK (pending_type IN ('ACTIVIDAD_SQA', 'DEFECTO', 'ACCION_CORRECTIVA', 'ALERTA_DETERIORO')),
  record_id UUID NOT NULL,
  description TEXT,
  resolution VARCHAR(20) NOT NULL CHECK (resolution IN ('ARRASTRAR', 'CANCELAR', 'CERRAR')),
  justification TEXT,
  origin_period_id UUID NOT NULL REFERENCES academic_periods(id)
);

CREATE INDEX IF NOT EXISTS ix_pending_resolutions_carry ON pending_resolutions (origin_period_id, resolution);

-- FN-04: retrospectiva; lessons_learned se precarga en el siguiente periodo (CU-01).
CREATE TABLE IF NOT EXISTS retrospectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closure_id UUID NOT NULL UNIQUE REFERENCES period_closures(id) ON DELETE CASCADE,
  went_well TEXT NOT NULL,
  to_improve TEXT NOT NULL,
  lessons_learned TEXT NOT NULL,
  agreements TEXT NOT NULL
);

-- FN-07 / FA-07.01: valor final de solo lectura de cada métrica (null + SIN_DATOS si no tuvo mediciones).
CREATE TABLE IF NOT EXISTS frozen_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closure_id UUID NOT NULL REFERENCES period_closures(id) ON DELETE CASCADE,
  metric_type VARCHAR(30) NOT NULL
    CHECK (metric_type IN ('DENSIDAD_DEFECTOS','COBERTURA_PRUEBAS','TASA_EXITO_PRUEBAS','CUMPLIMIENTO_SQA')),
  final_value DECIMAL,
  health_status VARCHAR(30) NOT NULL,
  source_measurement_id UUID REFERENCES metric_measurements(id) ON DELETE SET NULL,
  UNIQUE (closure_id, metric_type)
);

-- Solo se permite que source_measurement_id pase a NULL (ON DELETE SET NULL al borrar la medición o el proyecto);
-- el valor congelado no cambia nunca.
CREATE OR REPLACE FUNCTION frozen_metrics_solo_lectura() RETURNS trigger AS $$
BEGIN
  IF NEW.closure_id IS DISTINCT FROM OLD.closure_id
     OR NEW.metric_type IS DISTINCT FROM OLD.metric_type
     OR NEW.final_value IS DISTINCT FROM OLD.final_value
     OR NEW.health_status IS DISTINCT FROM OLD.health_status
     OR NEW.source_measurement_id IS NOT NULL AND NEW.source_measurement_id IS DISTINCT FROM OLD.source_measurement_id THEN
    RAISE EXCEPTION 'Las métricas congeladas son de solo lectura';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_frozen_metrics_solo_lectura ON frozen_metrics;
CREATE TRIGGER tr_frozen_metrics_solo_lectura BEFORE UPDATE ON frozen_metrics
  FOR EACH ROW EXECUTE FUNCTION frozen_metrics_solo_lectura();

-- FN-08: bitácora de SQA (contenido consolidado + PDF).
CREATE TABLE IF NOT EXISTS sqa_logbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closure_id UUID NOT NULL UNIQUE REFERENCES period_closures(id) ON DELETE CASCADE,
  content JSONB NOT NULL,
  filename VARCHAR(150) NOT NULL,
  pdf BYTEA NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
