const pool = require('../db/pool');

// Un proyecto está activo si pertenece al periodo académico activo (ER: academic_periods.is_active).
async function obtenerActivo(proyectoId) {
  const { rows } = await pool.query(
    `SELECT p.*, a.code as period_code, a.name as period_name 
       FROM monitored_projects p
       JOIN academic_periods a ON a.id = p.period_id
      WHERE p.id = $1 AND a.is_active = true`,
    [proyectoId],
  );
  return rows[0] ?? null;
}

// Obtener el periodo académico actualmente activo
async function obtenerPeriodoActivo() {
  const { rows } = await pool.query(
    `SELECT * FROM academic_periods WHERE is_active = true ORDER BY created_at DESC LIMIT 1`,
  );
  return rows[0] ?? null;
}

// Obtener el proyecto monitoreado registrado en el periodo activo (Monoproyecto)
async function obtenerProyectoPeriodoActivo() {
  const { rows } = await pool.query(
    `SELECT p.*, a.code as period_code, a.name as period_name
       FROM monitored_projects p
       JOIN academic_periods a ON a.id = p.period_id
      WHERE a.is_active = true
      LIMIT 1`,
  );
  return rows[0] ?? null;
}

// FN-02 / FA-02.01: Valida si ya existe un proyecto registrado para el periodo dado
async function existeProyectoEnPeriodo(periodId) {
  const { rows } = await pool.query(
    `SELECT id FROM monitored_projects WHERE period_id = $1`,
    [periodId],
  );
  return rows.length > 0;
}

// Obtener miembros del equipo de un proyecto
async function obtenerMiembros(proyectoId) {
  const { rows } = await pool.query(
    `SELECT * FROM project_members WHERE project_id = $1 ORDER BY role ASC`,
    [proyectoId],
  );
  return rows;
}

// Obtener plan de actividades SQA de un proyecto
async function obtenerActividadesQA(proyectoId) {
  const { rows } = await pool.query(
    `SELECT * FROM sqa_activities WHERE project_id = $1 ORDER BY created_at ASC`,
    [proyectoId],
  );
  return rows;
}

// Obtener línea base de un proyecto
async function obtenerLineaBase(proyectoId) {
  const { rows } = await pool.query(
    `SELECT * FROM configuration_baselines WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [proyectoId],
  );
  return rows[0] ?? null;
}

// FN-04 / FE-01: Guardado atómico de proyecto, roles, actividades, línea base y corte inicial
async function guardarProyectoCompleto({ proyecto, roles, actividades, lineaBase, tablero }, tx) {
  const client = tx || pool;

  // 1. Insertar monitored_projects
  const { rows: pRows } = await client.query(
    `INSERT INTO monitored_projects 
       (period_id, name, git_repo_url, description, technical_lead_role, qa_lead_role, pm_role, project_type, estimated_kloc)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      proyecto.periodId,
      proyecto.name,
      proyecto.gitRepoUrl || null,
      proyecto.description || null,
      proyecto.technicalLeadRole,
      proyecto.qaLeadRole,
      proyecto.pmRole,
      proyecto.projectType,
      proyecto.estimatedKloc,
    ],
  );
  const nuevoProyecto = pRows[0];
  const proyectoId = nuevoProyecto.id;

  // 2. Insertar roles/miembros
  const miembrosGuardados = [];
  for (const m of roles) {
    const { rows: mRows } = await client.query(
      `INSERT INTO project_members (project_id, member_name, email, role)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [proyectoId, m.memberName, m.email || null, m.role],
    );
    miembrosGuardados.push(mRows[0]);
  }

  // 3. Insertar actividades SQA
  const actividadesGuardadas = [];
  for (const act of actividades) {
    const { rows: aRows } = await client.query(
      `INSERT INTO sqa_activities (project_id, title, category, iso_practice_ref, phase, responsible_role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [proyectoId, act.title, act.category, act.iso_practice_ref, act.phase, act.responsible_role, act.status],
    );
    actividadesGuardadas.push(aRows[0]);
  }

  // 4. Insertar configuration_baselines
  const { rows: lbRows } = await client.query(
    `INSERT INTO configuration_baselines (project_id, baseline_name, git_commit_hash, tag_name, dictamen_notes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      proyectoId,
      lineaBase.baselineName || 'LB-01 (Inicial)',
      lineaBase.gitCommitHash || null,
      lineaBase.tagName || 'v0.1.0',
      lineaBase.dictamenNotes || 'Línea base formal inicial aprobada para el periodo.',
    ],
  );
  const nuevaLineaBase = lbRows[0];

  // 5. Insertar evaluation_cutoffs (Corte CP1 / Tablero inicial)
  const { rows: cRows } = await client.query(
    `INSERT INTO evaluation_cutoffs (project_id, cutoff_number, cutoff_name, kloc, planned_sqa_acts, health_status, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      proyectoId,
      tablero.cutoffNumber || 1,
      tablero.cutoffName || 'CP1-Baseline',
      tablero.kloc || proyecto.estimatedKloc,
      tablero.plannedSqaActs || actividades.length,
      tablero.healthStatus || 'SIN_DATOS',
      tablero.mensajeEstado || 'Tablero inicial generado.',
    ],
  );
  const nuevoCorte = cRows[0];

  return {
    proyecto: nuevoProyecto,
    miembros: miembrosGuardados,
    actividades: actividadesGuardadas,
    lineaBase: nuevaLineaBase,
    corte: nuevoCorte,
  };
}

// Obtener el corte inicial (Tablero CP1) del proyecto
async function obtenerCorteInicial(proyectoId) {
  const { rows } = await pool.query(
    `SELECT * FROM evaluation_cutoffs WHERE project_id = $1 ORDER BY cutoff_number ASC LIMIT 1`,
    [proyectoId],
  );
  return rows[0] ?? null;
}

// Actualizar estado de una actividad SQA (PLANNED, IN_PROGRESS, DONE)
async function actualizarEstadoActividad(actividadId, status) {
  const { rows } = await pool.query(
    `UPDATE sqa_activities 
        SET status = $1, execution_date = CASE WHEN $1 = 'DONE' THEN CURRENT_DATE ELSE execution_date END
      WHERE id = $2 
      RETURNING *`,
    [status, actividadId],
  );
  if (rows[0]) {
    // Actualizar conteo de ejecutadas en evaluation_cutoffs
    await pool.query(
      `UPDATE evaluation_cutoffs
          SET executed_sqa_acts = (
            SELECT count(*) FROM sqa_activities WHERE project_id = $1 AND status = 'DONE'
          )
        WHERE project_id = $1`,
      [rows[0].project_id],
    );
  }
  return rows[0] ?? null;
}

// Eliminar proyecto y reiniciar para pruebas
async function eliminarProyecto(proyectoId) {
  await pool.query(`DELETE FROM metric_configurations WHERE project_id = $1`, [proyectoId]);
  const { rowCount } = await pool.query(`DELETE FROM monitored_projects WHERE id = $1`, [proyectoId]);
  return rowCount > 0;
}

module.exports = {
  obtenerActivo,
  obtenerPeriodoActivo,
  obtenerProyectoPeriodoActivo,
  existeProyectoEnPeriodo,
  obtenerMiembros,
  obtenerActividadesQA,
  obtenerLineaBase,
  obtenerCorteInicial,
  actualizarEstadoActividad,
  eliminarProyecto,
  guardarProyectoCompleto,
};

