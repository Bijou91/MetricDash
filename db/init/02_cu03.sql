-- CU-03: defectos y mediciones de calidad. Idempotente: también se aplica a volúmenes ya existentes
--   docker exec sqa_db psql -U sqa_user -d sqa_dashboard -f /docker-entrypoint-initdb.d/02_cu03.sql

-- ER: defects, ampliada con lo que pide el diagrama de clases de CU-03
-- (prioridad, fase de detección, asignado, reportado por, folio y confirmación de no duplicado).
CREATE TABLE IF NOT EXISTS defects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cutoff_id UUID NOT NULL REFERENCES evaluation_cutoffs(id) ON DELETE CASCADE,
  review_id UUID, -- FK a peer_reviews cuando exista esa tabla
  folio VARCHAR(20) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('BAJA', 'MEDIA', 'ALTA', 'CRITICA')),
  priority VARCHAR(20) NOT NULL CHECK (priority IN ('BAJA', 'MEDIA', 'ALTA', 'INMEDIATA')),
  detection_phase VARCHAR(50) NOT NULL CHECK (detection_phase IN ('ANALISIS_REQUERIMIENTOS', 'DISENO_COMPONENTES', 'CONSTRUCCION_SOFTWARE', 'INTEGRACION_Y_PRUEBAS')),
  origin_phase VARCHAR(50) NOT NULL CHECK (origin_phase IN ('ANALISIS_REQUERIMIENTOS', 'DISENO_COMPONENTES', 'CONSTRUCCION_SOFTWARE', 'INTEGRACION_Y_PRUEBAS')),
  status VARCHAR(20) NOT NULL DEFAULT 'REGISTRADO' CHECK (status IN ('REGISTRADO', 'ASIGNADO', 'EN_RESOLUCION', 'CERRADO', 'DESCARTADO')),
  assigned_to UUID REFERENCES project_members(id) ON DELETE SET NULL,
  reported_by UUID REFERENCES project_members(id) ON DELETE SET NULL,
  confirmed_not_duplicate BOOLEAN NOT NULL DEFAULT false,
  detected_date DATE NOT NULL DEFAULT CURRENT_DATE,
  resolved_date DATE,
  resolution_notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_defects_cutoff ON defects (cutoff_id);

-- ER: quality_metrics (1 a 1 con el corte: 4 KPIs y semáforo).
CREATE TABLE IF NOT EXISTS quality_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cutoff_id UUID NOT NULL UNIQUE REFERENCES evaluation_cutoffs(id) ON DELETE CASCADE,
  defect_density DECIMAL,
  test_coverage_pct DECIMAL,
  test_pass_rate_pct DECIMAL,
  sqa_compliance_pct DECIMAL,
  health_status VARCHAR(30) NOT NULL DEFAULT 'SIN_DATOS',
  calculated_at TIMESTAMP NOT NULL DEFAULT now()
);
