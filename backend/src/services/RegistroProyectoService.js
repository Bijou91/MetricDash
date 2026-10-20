const proyectoRepo = require('../data/ProyectoRepository');
const validador = require('./ValidadorRegistro');
const generadorPlan = require('./GeneradorPlanQA');
const generadorTablero = require('./GeneradorTablero');
const txManager = require('../data/TransaccionManager');
const { ProyectoExistenteException, RolEquipo, TipoProyecto } = require('./entidades/proyecto');

async function registrarProyecto(dto = {}) {
  // 1. FA-02.02: Validación de completitud de datos generales y roles obligatorios
  const validacion = validador.validarRegistro(dto);
  if (!validacion.valido) {
    const error = new Error('Datos o roles incompletos.');
    error.status = 400;
    error.resultado = validacion;
    throw error;
  }

  // 2. Determinar y validar estrictamente el periodo académico activo en PostgreSQL
  const periodoActivo = await proyectoRepo.obtenerPeriodoActivo();
  if (!periodoActivo) {
    const err = new Error('No existe un ciclo escolar / periodo académico activo configurado.');
    err.status = 400;
    throw err;
  }

  const pIdEntrante = dto.periodId || dto.periodoId;
  if (pIdEntrante && String(pIdEntrante).trim() !== String(periodoActivo.id).trim()) {
    const err = new Error(
      `El periodo académico especificado ('${pIdEntrante}') no es válido o no corresponde al periodo activo actual ('${periodoActivo.id}').`
    );
    err.status = 400;
    throw err;
  }

  const periodo = periodoActivo;

  // 3. FN-02 / FA-02.01: Regla monoproyecto (un solo proyecto por periodo)
  const yaExiste = await proyectoRepo.existeProyectoEnPeriodo(periodo.id);
  if (yaExiste) {
    throw new ProyectoExistenteException(periodo.code || periodo.name);
  }

  // Extraer roles asignados
  const rolesRaw = dto.members || dto.rolesEquipo || dto.teamRoles || dto.roles || [];
  let techLead = dto.technicalLeadRole || '';
  let qaLead = dto.qaLeadRole || '';
  let pmLead = dto.pmRole || '';

  const listaMiembros = [];
  for (const r of rolesRaw) {
    const rolNorm = (r.role || r.rol || '').toUpperCase();
    const nombre = (r.memberName || r.member_name || r.nombre || '').trim();
    const email = (r.email || r.correo || '').trim();
    if (rolNorm === RolEquipo.TECNICO && !techLead) techLead = nombre;
    if (rolNorm === RolEquipo.QA && !qaLead) qaLead = nombre;
    if (rolNorm === RolEquipo.GESTION_PROYECTO && !pmLead) pmLead = nombre;
    listaMiembros.push({ memberName: nombre, email, role: rolNorm });
  }

  const tipoProyecto = dto.projectType || dto.tipoProyecto || TipoProyecto.DESARROLLO_NUEVO;
  const kloc = Number(dto.estimatedKloc ?? dto.tamanoProductoKLOC ?? 1.0);

  const datosProyecto = {
    periodId: periodo.id,
    name: (dto.name || dto.nombre || '').trim(),
    gitRepoUrl: (dto.gitRepoUrl || dto.git_repo_url || '').trim(),
    description: (dto.description || dto.descripcion || '').trim(),
    technicalLeadRole: techLead,
    qaLeadRole: qaLead,
    pmRole: pmLead,
    projectType: tipoProyecto,
    estimatedKloc: kloc,
  };

  // 4. FN-03: Propuesta automática del plan base de QA
  const planQA = generadorPlan.generarPlanBase(tipoProyecto);

  // 5. FN-04: Línea base y tablero de control inicial
  const lineaBase = {
    baselineName: `LB-01 Inicial (${periodo.code || '2026'})`,
    gitCommitHash: dto.gitCommitHash || null,
    tagName: 'v0.1.0',
    dictamenNotes: `Línea base formal aprobada para ${datosProyecto.name}. Plan de ${planQA.totalActividades} actividades de SQA programadas.`,
  };

  const tableroInicial = generadorTablero.crearTableroInicial(datosProyecto, lineaBase, planQA);

  // 6. FN-04 / FE-01: Persistencia atómica de todas las entidades con rollback ante fallos
  const persistido = await txManager.ejecutar(async (tx) => {
    return await proyectoRepo.guardarProyectoCompleto({
      proyecto: datosProyecto,
      roles: listaMiembros,
      actividades: planQA.actividades,
      lineaBase,
      tablero: tableroInicial,
    }, tx);
  });

  // 7. FN-05: Confirmación de éxito
  return {
    registroExitoso: true,
    proyectoId: persistido.proyecto.id,
    periodo: {
      id: periodo.id,
      code: periodo.code,
      name: periodo.name,
    },
    proyecto: {
      id: persistido.proyecto.id,
      name: persistido.proyecto.name,
      projectType: persistido.proyecto.project_type,
      estimatedKloc: Number(persistido.proyecto.estimated_kloc),
      technicalLeadRole: persistido.proyecto.technical_lead_role,
      qaLeadRole: persistido.proyecto.qa_lead_role,
      pmRole: persistido.proyecto.pm_role,
    },
    roles: persistido.miembros,
    plan: {
      tipoProyecto: planQA.tipoProyecto,
      totalActividades: persistido.actividades.length,
      actividades: persistido.actividades,
    },
    planQA: {
      tipoProyecto: planQA.tipoProyecto,
      totalActividades: persistido.actividades.length,
      actividades: persistido.actividades,
    },
    lineaBase: persistido.lineaBase,
    tablero: tableroInicial,
    tableroInicial: persistido.corte || tableroInicial,
    mensaje: 'Proyecto registrado exitosamente con su plan base de QA y línea base inicial creada.',
  };
}

module.exports = {
  registrarProyecto,
};
