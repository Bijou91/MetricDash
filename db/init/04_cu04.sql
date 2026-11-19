-- CU-04: Planear y registrar una actividad SQA
-- Idempotente: se puede ejecutar tanto en init como sobre bases de datos existentes:
--   docker exec sqa_db psql -U sqa_user -d sqa_dashboard -f /docker-entrypoint-initdb.d/04_cu04.sql

-- 1. Ampliación de campos de planificación y participantes en sqa_activities
ALTER TABLE sqa_activities
  ADD COLUMN IF NOT EXISTS artifact VARCHAR(100),
  ADD COLUMN IF NOT EXISTS responsible_member_id UUID REFERENCES project_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES project_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewer_ids JSONB DEFAULT '[]'::jsonb;

-- 2. Creación de la tabla formal de revisiones por pares (ER: peer_reviews)
CREATE TABLE IF NOT EXISTS peer_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL UNIQUE REFERENCES sqa_activities(id) ON DELETE CASCADE,
  work_product VARCHAR(50) NOT NULL CHECK (work_product IN ('VERSION', 'SGU', 'UI', 'PLAN')),
  author_id UUID REFERENCES project_members(id) ON DELETE SET NULL,
  review_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reviewer_role VARCHAR(100),
  reviewers JSONB NOT NULL DEFAULT '[]'::jsonb,
  verdict VARCHAR(30) NOT NULL CHECK (verdict IN ('APROBADO', 'CONDICIONAL', 'RECHAZADO', 'APPROVED', 'CONDITIONAL', 'REJECTED')),
  findings_summary TEXT NOT NULL,
  minutes_url VARCHAR(255),
  checklist_results JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_peer_reviews_activity ON peer_reviews (activity_id);

-- 3. Vincular clave foránea review_id en defects hacia peer_reviews si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_defects_peer_review'
  ) THEN
    ALTER TABLE defects
      ADD CONSTRAINT fk_defects_peer_review
      FOREIGN KEY (review_id) REFERENCES peer_reviews(id) ON DELETE SET NULL;
  END IF;
END $$;
