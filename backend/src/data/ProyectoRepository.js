const pool = require('./pool');

function normalizarEstadoActividad(st) {
  if (!st) return 'PLANNED';
  const val = String(st).toUpperCase();
  if (val === 'REALIZADA' || val === 'DONE') return 'DONE';
  if (val === 'EN_CURSO' || val === 'IN_PROGRESS') return 'IN_PROGRESS';
  return 'PLANNED';
}

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
    const statusNorm = normalizarEstadoActividad(act.status);
    const { rows: aRows } = await client.query(
      `INSERT INTO sqa_activities (project_id, title, category, iso_practice_ref, phase, responsible_role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [proyectoId, act.title, act.category, act.iso_practice_ref, act.phase, act.responsible_role, statusNorm],
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

  // 5. Insertar evaluation_cutoffs (Los 4 cortes de evaluación del periodo: CP1 a CP4 según ER)
  const klocProyecto = tablero.kloc || proyecto.estimatedKloc;
  const totalActs = tablero.plannedSqaActs || actividades.length;
  const contarPorFase = (fase) =>
    actividades.filter((a) => (a.phase || a.fase) === fase).length;
  const definicionCortes = [
    {
      num: tablero.cutoffNumber || 1,
      name: tablero.cutoffName || 'CP1-Línea Base Inicial',
      notes: tablero.mensajeEstado || 'Tablero inicial generado.',
      plannedActs: contarPorFase('ANALISIS_REQUERIMIENTOS') || totalActs,
    },
    {
      num: 2,
      name: 'CP2-Diseño de Componentes',
      notes: 'Segundo corte de evaluación del periodo.',
      plannedActs: contarPorFase('DISENO_COMPONENTES') || totalActs,
    },
    {
      num: 3,
      name: 'CP3-Construcción de Software',
      notes: 'Tercer corte de evaluación del periodo.',
      plannedActs: contarPorFase('CONSTRUCCION_SOFTWARE') || totalActs,
    },
    {
      num: 4,
      name: 'CP4-Integración y Pruebas (Final)',
      notes: 'Corte final de evaluación del periodo.',
      plannedActs: contarPorFase('INTEGRACION_Y_PRUEBAS') || totalActs,
    },
  ];

  const cortesGuardados = [];
  for (const def of definicionCortes) {
    const { rows: cRows } = await client.query(
      `INSERT INTO evaluation_cutoffs (project_id, cutoff_number, cutoff_name, kloc, planned_sqa_acts, health_status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        proyectoId,
        def.num,
        def.name,
        klocProyecto,
        def.plannedActs,
        tablero.healthStatus || 'SIN_DATOS',
        def.notes,
      ],
    );
    cortesGuardados.push(cRows[0]);
  }
  const nuevoCorte = cortesGuardados[0];

  return {
    proyecto: nuevoProyecto,
    miembros: miembrosGuardados,
    actividades: actividadesGuardadas,
    lineaBase: nuevaLineaBase,
    corte: nuevoCorte,
    cortes: cortesGuardados,
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

const FASE_A_NUMERO_CORTE = {
  ANALISIS_REQUERIMIENTOS: 1,
  DISENO_COMPONENTES: 2,
  CONSTRUCCION_SOFTWARE: 3,
  INTEGRACION_Y_PRUEBAS: 4,
};

// Actualizar estado de una actividad SQA (PLANNED, IN_PROGRESS, DONE) y recalcular el cumplimiento del corte de su fase
async function actualizarEstadoActividad(actividadId, status) {
  const statusNorm = normalizarEstadoActividad(status);
  const { rows } = await pool.query(
    `UPDATE sqa_activities 
        SET status = $1::varchar, execution_date = CASE WHEN $1::varchar = 'DONE' THEN CURRENT_DATE ELSE execution_date END
      WHERE id = $2 
      RETURNING *`,
    [statusNorm, actividadId],
  );
  if (rows[0]) {
    const { project_id: proyectoId, phase: faseActividad } = rows[0];
    const cutoffNumber = FASE_A_NUMERO_CORTE[faseActividad] || 1;

    // Recalcular actividades planeadas y ejecutadas específicamente para la fase correspondiente a este corte
    const { rows: [conteoFase] } = await pool.query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE status = 'DONE')::int AS ejecutadas
         FROM sqa_activities
        WHERE project_id = $1 AND phase = $2`,
      [proyectoId, faseActividad],
    );
    const ejecutadasFase = conteoFase?.ejecutadas ?? 0;
    const totalFase = conteoFase?.total ?? 0;
    const cumplimientoFasePct = totalFase > 0 ? Math.round((ejecutadasFase / totalFase) * 10000) / 100 : 0;

    const { rows: [corteFase] } = await pool.query(
      `UPDATE evaluation_cutoffs
          SET planned_sqa_acts = $3,
              executed_sqa_acts = $4
        WHERE project_id = $1 AND cutoff_number = $2
        RETURNING *`,
      [proyectoId, cutoffNumber, totalFase, ejecutadasFase],
    );

    if (corteFase) {
      await pool.query(
        `INSERT INTO quality_metrics (cutoff_id, sqa_compliance_pct, calculated_at)
         VALUES ($1, $2, now())
         ON CONFLICT (cutoff_id) DO UPDATE
           SET sqa_compliance_pct = $2, calculated_at = now()`,
        [corteFase.id, ejecutadasFase > 0 ? cumplimientoFasePct : null],
      );
    }
  }
  return rows[0] ?? null;
}

// Eliminar proyecto y reiniciar para pruebas
async function eliminarProyecto(proyectoId) {
  await pool.query(`DELETE FROM metric_configurations WHERE project_id = $1`, [proyectoId]);
  const { rowCount } = await pool.query(`DELETE FROM monitored_projects WHERE id = $1`, [proyectoId]);
  return rowCount > 0;
}

// CU-03: corte vigente donde se registran los defectos (el último con mediciones o el corte inicial).
async function obtenerCorteActual(proyectoId, tx = pool) {
  const { rows } = await tx.query(
    `SELECT ec.*
       FROM evaluation_cutoffs ec
       LEFT JOIN quality_metrics qm ON qm.cutoff_id = ec.id
      WHERE ec.project_id = $1
      ORDER BY (qm.id IS NOT NULL) DESC,
               CASE WHEN qm.id IS NOT NULL THEN ec.cutoff_number ELSE 0 END DESC,
               ec.cutoff_number ASC
      LIMIT 1`,
    [proyectoId],
  );
  return rows[0] ?? null;
}

// CU-05 FN-01: lista todos los cortes de evaluación del proyecto ordenados por número de corte.
async function listarCortes(proyectoId, tx = pool) {
  const { rows } = await tx.query(
    `SELECT * FROM evaluation_cutoffs WHERE project_id = $1 ORDER BY cutoff_number ASC`,
    [proyectoId],
  );
  return rows;
}

// CU-03 FN-05: marca el proyecto como actualizado tras recalcular sus indicadores.
async function actualizar(proyectoId, tx = pool) {
  await tx.query('UPDATE monitored_projects SET updated_at = now() WHERE id = $1', [proyectoId]);
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
  obtenerCorteActual,
  listarCortes,
  actualizar,
};
