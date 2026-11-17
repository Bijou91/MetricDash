-- CU-04: Planear y registrar una actividad SQA.
-- Idempotente: se puede aplicar sobre volúmenes existentes con:
--   docker exec sqa_db psql -U sqa_user -d sqa_dashboard -f /docker-entrypoint-initdb.d/04_cu04.sql

-- 1. Ampliar sqa_activities para almacenar la planificación formal (FN-02 / FN-03) y ejecución (FN-04 a FN-09)
ALTER TABLE sqa_activities ADD COLUMN IF NOT EXISTS responsible_id UUID REFERENCES project_members(id) ON DELETE SET NULL;
ALTER TABLE sqa_activities ADD COLUMN IF NOT EXISTS artifact_name VARCHAR(200);
ALTER TABLE sqa_activities ADD COLUMN IF NOT EXISTS artifact_type VARCHAR(50);
ALTER TABLE sqa_activities ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES project_members(id) ON DELETE SET NULL;
ALTER TABLE sqa_activities ADD COLUMN IF NOT EXISTS reviewer_ids UUID[] DEFAULT '{}';
ALTER TABLE sqa_activities ADD COLUMN IF NOT EXISTS evidence_ref VARCHAR(255);

-- 2. Plantillas de checklist por tipo de artefacto (FN-03 / FN-04)
CREATE TABLE IF NOT EXISTS checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_type VARCHAR(50) NOT NULL UNIQUE CHECK (artifact_type IN ('VISION', 'SDS', 'UI', 'PLAN', 'CODIGO', 'CASOS_USO')),
  name VARCHAR(150) NOT NULL,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  item_order INT NOT NULL,
  description TEXT NOT NULL,
  UNIQUE (template_id, item_order)
);

-- 3. Revisiones por pares y actas formales (ER: peer_reviews 0..1 a 1 con sqa_activities)
CREATE TABLE IF NOT EXISTS peer_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL UNIQUE REFERENCES sqa_activities(id) ON DELETE CASCADE,
  work_product VARCHAR(50) NOT NULL,
  author_id UUID REFERENCES project_members(id) ON DELETE SET NULL,
  reviewer_ids UUID[] DEFAULT '{}',
  review_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reviewer_role VARCHAR(50),
  verdict VARCHAR(50) CHECK (verdict IN ('APPROVED', 'CONDITIONAL', 'REJECTED', 'APROBADO', 'APROBADO_CONDICIONADO', 'RECHAZADO')),
  findings_summary TEXT,
  checklist_results JSONB DEFAULT '[]'::jsonb,
  defect_folios TEXT[] DEFAULT '{}',
  minutes_url VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- 4. Semilla idempotente de plantillas e ítems de checklist ISO/IEC 29110 por tipo de artefacto
INSERT INTO checklist_templates (id, artifact_type, name, description)
VALUES
  ('00000000-0000-0000-0000-000000000401', 'VISION', 'Checklist de Visión y Alcance / Casos de Uso', 'Verificación de requerimientos, alcance y casos de uso según ISO/IEC 29110 Cl. 2.1.'),
  ('00000000-0000-0000-0000-000000000402', 'SDS', 'Checklist de Especificación de Arquitectura y Diseño (SDS)', 'Verificación de componentes, interfaces y trazabilidad de diseño según ISO/IEC 29110 Cl. 2.2.'),
  ('00000000-0000-0000-0000-000000000403', 'UI', 'Checklist de Modelo de Datos y Prototipos UI', 'Verificación de integridad relacional, restricciones y consistencia de interfaz de usuario.'),
  ('00000000-0000-0000-0000-000000000404', 'PLAN', 'Checklist de Código Fuente, Estándares y Plan SQA', 'Verificación de estándares de codificación, manejo de errores, transacciones y trazabilidad SQA.')
ON CONFLICT (artifact_type) DO NOTHING;

INSERT INTO checklist_items (id, template_id, item_order, description)
VALUES
  -- VISION (Análisis de Requerimientos / Casos de Uso)
  ('00000000-0000-0000-0000-000000004101', '00000000-0000-0000-0000-000000000401', 1, 'El propósito, alcance y restricciones del proyecto están definidos sin ambigüedades.'),
  ('00000000-0000-0000-0000-000000004102', '00000000-0000-0000-0000-000000000401', 2, 'Cada caso de uso especifica claramente precondiciones, flujo principal, flujos alternativos y de excepción.'),
  ('00000000-0000-0000-0000-000000004103', '00000000-0000-0000-0000-000000000401', 3, 'Los criterios de aceptación y postcondiciones son verificables y trazables a las métricas de calidad.'),
  ('00000000-0000-0000-0000-000000004104', '00000000-0000-0000-0000-000000000401', 4, 'Los actores y roles del equipo (QA, Técnico, Gestión de Proyecto) están correctamente identificados.'),
  -- SDS (Diseño de Componentes y Arquitectura)
  ('00000000-0000-0000-0000-000000004201', '00000000-0000-0000-0000-000000000402', 1, 'La arquitectura de 3 capas separa responsabilidades entre Vistas/Widgets, Controladores/Servicios y Repositorios.'),
  ('00000000-0000-0000-0000-000000004202', '00000000-0000-0000-0000-000000000402', 2, 'Los contratos de DTOs, entidades y firmas de métodos coinciden con el diagrama de clases y de secuencia.'),
  ('00000000-0000-0000-0000-000000004203', '00000000-0000-0000-0000-000000000402', 3, 'El manejo de transacciones atómicas y reversión ante fallos está contemplado en el diseño.'),
  ('00000000-0000-0000-0000-000000004204', '00000000-0000-0000-0000-000000000402', 4, 'Cada componente de software tiene trazabilidad directa con los requisitos funcionales del proyecto.'),
  -- UI (Modelo de Datos y Prototipos UI)
  ('00000000-0000-0000-0000-000000004301', '00000000-0000-0000-0000-000000000403', 1, 'Las tablas del modelo relacional definen llaves primarias, llaves foráneas y restricciones CHECK consistentes.'),
  ('00000000-0000-0000-0000-000000004302', '00000000-0000-0000-0000-000000000403', 2, 'Los formularios de interfaz validan campos obligatorios y resaltan visualmente los datos faltantes.'),
  ('00000000-0000-0000-0000-000000004303', '00000000-0000-0000-0000-000000000403', 3, 'Los indicadores y semáforos muestran claramente los estados Óptimo, Advertencia, Crítico y Sin Datos.'),
  ('00000000-0000-0000-0000-000000004304', '00000000-0000-0000-0000-000000000403', 4, 'Las alertas por umbral excedido o posible duplicado son visibles y comprensibles para el usuario.'),
  -- PLAN (Código Fuente / Estándares / Plan SQA)
  ('00000000-0000-0000-0000-000000004401', '00000000-0000-0000-0000-000000000404', 1, 'El código fuente cumple con la convención de nombres, modularidad y ausencia de valores hardcodeados.'),
  ('00000000-0000-0000-0000-000000004402', '00000000-0000-0000-0000-000000000404', 2, 'Las validaciones de negocio se ejecutan en el backend antes de abrir transacciones de base de datos.'),
  ('00000000-0000-0000-0000-000000004403', '00000000-0000-0000-0000-000000000404', 3, 'Las consultas SQL están parametrizadas y protegidas contra inyección y condiciones de carrera.'),
  ('00000000-0000-0000-0000-000000004404', '00000000-0000-0000-0000-000000000404', 4, 'Las evidencias de aseguramiento de calidad están vinculadas formalmente al plan base del proyecto.')
ON CONFLICT (template_id, item_order) DO NOTHING;

