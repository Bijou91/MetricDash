const express = require('express');
const servicioDefectos = require('../services/ServicioGestionDefectos');
const servicioMetricas = require('../services/ServicioCalculoMetricas');
const servicioEvaluarMetricas = require('../services/ServicioEvaluarMetricas');
const transacciones = require('../data/TransaccionManager');
const proyectoRepo = require('../data/ProyectoRepository');
const defectoRepo = require('../data/DefectoRepository');
const configRepo = require('../data/ConfiguracionMetricasRepository');
const { TipoMetrica } = require('../services/entidades/metricas');
const { NivelSemaforo } = require('../services/entidades/proyecto');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const resultado = (campos) => ({
  registroExitoso: false,
  requiereConfirmacionDuplicado: false,
  coincidenciasDetectadas: [],
  defectoRegistrado: null,
  densidadDefectosActualizada: null,
  nivelSemaforo: null,
  alertaEmitida: null,
  camposFaltantes: [],
  ...campos,
});

// Precondiciones 2 y 3: proyecto activo del periodo y umbral de densidad configurado (CU-02).
async function cargarContexto(proyectoId) {
  const proyecto = await proyectoRepo.obtenerProyectoPeriodoActivo();
  if (!proyecto || proyecto.id !== proyectoId) {
    throw Object.assign(new Error('No hay un proyecto activo con ese identificador en el periodo en curso.'), { status: 404 });
  }
  const umbral = await configRepo.obtenerUmbralVigente(proyectoId, TipoMetrica.DENSIDAD_DEFECTOS);
  if (!umbral) {
    throw Object.assign(new Error('Primero configure las métricas de calidad y sus umbrales para poder registrar defectos.'), { status: 409 });
  }
  return { proyecto, umbral };
}

function manejarError(res, err) {
  if (err.status) return res.status(err.status).json({ mensaje: err.message });
  // FE-01: TransaccionManager ya revirtió la transacción.
  if (err instanceof transacciones.ErrorPersistencia) return res.status(500).json({ mensaje: err.message });
  console.error('[DefectoController]', err);
  return res.status(500).json({ mensaje: 'Error interno del servidor.' });
}

const FASE_A_CORTE = Object.freeze({
  ANALISIS_REQUERIMIENTOS: 1,
  DISENO_COMPONENTES: 2,
  CONSTRUCCION_SOFTWARE: 3,
  INTEGRACION_Y_PRUEBAS: 4,
});

async function resolverCortePorFase(proyectoId, fase, tx) {
  const numCorte = FASE_A_CORTE[fase] || 1;
  if (typeof proyectoRepo.listarCortes === 'function') {
    try {
      const cortes = await proyectoRepo.listarCortes(proyectoId, tx);
      const encontrado = Array.isArray(cortes)
        ? cortes.find((c) => Number(c.cutoff_number) === numCorte)
        : null;
      if (encontrado) return encontrado;
    } catch (_) {
      // Fallback a obtenerCorteActual
    }
  }
  return proyectoRepo.obtenerCorteActual(proyectoId, tx);
}

async function calcularSaludGlobalCorte(proyectoId, corteId, medicionDensidad, tx) {
  if (!tx || typeof tx.query !== 'function') return medicionDensidad.estadoSemaforo;
  const previa = await configRepo.obtenerMedicion(corteId, tx);
  if (!previa) return medicionDensidad.estadoSemaforo;
  const [uCob, uTasa, uCump] = await Promise.all([
    configRepo.obtenerUmbralVigente(proyectoId, TipoMetrica.COBERTURA_PRUEBAS),
    configRepo.obtenerUmbralVigente(proyectoId, TipoMetrica.TASA_EXITO_PRUEBAS),
    configRepo.obtenerUmbralVigente(proyectoId, TipoMetrica.CUMPLIMIENTO_SQA),
  ]);
  const estCob = (previa.test_coverage_pct != null && uCob)
    ? servicioEvaluarMetricas.determinarEstadoSemaforo(Number(previa.test_coverage_pct), uCob)
    : null;
  const estTasa = (previa.test_pass_rate_pct != null && uTasa)
    ? servicioEvaluarMetricas.determinarEstadoSemaforo(Number(previa.test_pass_rate_pct), uTasa)
    : null;
  const estCump = (previa.sqa_compliance_pct != null && uCump)
    ? servicioEvaluarMetricas.determinarEstadoSemaforo(Number(previa.sqa_compliance_pct), uCump)
    : null;
  return servicioEvaluarMetricas.calcularNivelGlobal(medicionDensidad.estadoSemaforo, estCob, estTasa, estCump);
}

// FN-02 a FN-07, FA-03.01, FA-03.02, FA-03.03 y FE-01.
async function registrarYClasificarDefecto(req, res) {
  try {
    const { proyectoId } = req.params;
    const dto = req.body ?? {};
    const { proyecto, umbral } = await cargarContexto(proyectoId);
    const miembros = await proyectoRepo.obtenerMiembros(proyectoId);

    const camposFaltantes = servicioDefectos.validarCamposObligatorios(dto, miembros);
    if (camposFaltantes.length) return res.status(400).json(resultado({ camposFaltantes }));

    if (dto.confirmarIncidenciaDistinta !== true) {
      const coincidencias = await servicioDefectos.buscarPosiblesDuplicados(proyectoId, dto);
      if (coincidencias.length) {
        return res.json(resultado({ requiereConfirmacionDuplicado: true, coincidenciasDetectadas: coincidencias }));
      }
    }

    const responsable = miembros.find((m) => m.id === dto.asignadoAId);
    const { defecto, medicion, alerta, estadoDensidad } = await transacciones.ejecutar(async (tx) => {
      const corte = await resolverCortePorFase(proyectoId, dto.faseDeteccion, tx);
      const defecto = await servicioDefectos.crearYAsignarDefecto(dto, responsable, corte, tx);
      const medicion = await servicioMetricas.recalcularDensidadDefectos(proyecto, tx);
      const alerta = servicioEvaluarMetricas.evaluarSeveridadYDensidad(defecto, medicion, umbral);
      const estadoDensidad = medicion.estadoSemaforo;
      medicion.estadoSemaforo = await calcularSaludGlobalCorte(proyectoId, corte.id, medicion, tx);
      await configRepo.guardarMedicion(corte.id, medicion, tx);
      return { defecto, medicion, alerta, estadoDensidad };
    });

    return res.status(201).json(resultado({
      registroExitoso: true,
      defectoRegistrado: { ...defecto, asignadoNombre: responsable.member_name },
      densidadDefectosActualizada: medicion.valorCalculado,
      totalDefectos: medicion.totalDefectos,
      nivelSemaforo: estadoDensidad,
      alertaEmitida: alerta,
    }));
  } catch (err) {
    return manejarError(res, err);
  }
}

// FA-03.01: el usuario descarta el registro; no se guarda nada.
function descartarRegistroDuplicado(req, res) {
  res.json({ descartado: true, mensaje: 'Registro descartado. No se guardó ningún defecto.' });
}

// FN-01: datos para la vista del tablero (miembros, defectos y última medición).
async function obtenerTablero(req, res) {
  try {
    const { proyectoId } = req.params;
    const proyecto = await proyectoRepo.obtenerProyectoPeriodoActivo();
    if (!proyecto || proyecto.id !== proyectoId) {
      return res.status(404).json({ mensaje: 'No hay un proyecto activo con ese identificador en el periodo en curso.' });
    }
    const [miembros, defectos, umbral, corte] = await Promise.all([
      proyectoRepo.obtenerMiembros(proyectoId),
      defectoRepo.listarPorProyecto(proyectoId),
      configRepo.obtenerUmbralVigente(proyectoId, TipoMetrica.DENSIDAD_DEFECTOS),
      proyectoRepo.obtenerCorteActual(proyectoId),
    ]);
    let medicion = corte && await configRepo.obtenerMedicion(corte.id);
    if ((!medicion || medicion.defect_density == null) && proyectoRepo.listarCortes) {
      const todosCortes = await proyectoRepo.listarCortes(proyectoId);
      for (let i = (todosCortes || []).length - 1; i >= 0; i -= 1) {
        const m = await configRepo.obtenerMedicion(todosCortes[i].id);
        if (m && m.defect_density != null) {
          medicion = m;
          break;
        }
      }
    }
    const densidadVal = medicion?.defect_density == null ? null : Number(medicion.defect_density);
    const nivelDensidad = (densidadVal != null && umbral)
      ? servicioEvaluarMetricas.determinarEstadoSemaforo(densidadVal, umbral)
      : (medicion?.health_status ?? NivelSemaforo.SIN_DATOS);

    return res.json({
      miembros: miembros.map((m) => ({ id: m.id, nombre: m.member_name, rol: m.role })),
      defectos,
      umbralesConfigurados: Boolean(umbral),
      umbral: umbral && { meta: umbral.meta, umbralAdvertencia: umbral.umbralAdvertencia, umbralCritico: umbral.umbralCritico, unidad: umbral.unidad },
      densidadDefectos: densidadVal,
      nivelSemaforo: nivelDensidad,
    });
  } catch (err) {
    return manejarError(res, err);
  }
}

// Actualizar defecto existente (descripción, severidad, prioridad, fase, asignación o estado)
async function actualizarDefecto(req, res) {
  try {
    const { proyectoId, defectoId } = req.params;
    if (!UUID.test(defectoId)) return res.status(400).json({ mensaje: 'defectoId inválido.' });

    const dto = req.body ?? {};
    const { proyecto, umbral } = await cargarContexto(proyectoId);
    const miembros = await proyectoRepo.obtenerMiembros(proyectoId);

    const errores = servicioDefectos.validarCamposEdicion(dto, miembros);
    if (errores.length) return res.status(400).json({ mensaje: 'Datos de edición inválidos.', camposInvalidos: errores });

    const defectoExistente = await defectoRepo.obtenerPorId(defectoId);
    if (!defectoExistente) return res.status(404).json({ mensaje: 'Defecto no encontrado.' });

    const { defecto, medicion, alerta, estadoDensidad } = await transacciones.ejecutar(async (tx) => {
      const corte = await proyectoRepo.obtenerCorteActual(proyectoId, tx);
      const defectoActualizado = await defectoRepo.actualizar(defectoId, dto, tx);
      const medicion = await servicioMetricas.recalcularDensidadDefectos(proyecto, tx);
      const alerta = servicioEvaluarMetricas.evaluarSeveridadYDensidad(defectoActualizado, medicion, umbral);
      const estadoDensidad = medicion.estadoSemaforo;
      medicion.estadoSemaforo = await calcularSaludGlobalCorte(proyectoId, corte.id, medicion, tx);
      await configRepo.guardarMedicion(corte.id, medicion, tx);
      return { defecto: defectoActualizado, medicion, alerta, estadoDensidad };
    });

    const miembroAsignado = miembros.find((m) => m.id === (defecto.asignadoAId || defectoExistente.asignadoAId));

    return res.status(200).json({
      actualizacionExitosa: true,
      defecto: { ...defecto, asignadoNombre: miembroAsignado?.member_name ?? null },
      densidadDefectosActualizada: medicion.valorCalculado,
      totalDefectos: medicion.totalDefectos,
      nivelSemaforo: estadoDensidad,
      alertaEmitida: alerta,
    });
  } catch (err) {
    return manejarError(res, err);
  }
}

// Actualizar únicamente el estado del defecto
async function actualizarEstadoDefecto(req, res) {
  try {
    const { proyectoId, defectoId } = req.params;
    if (!UUID.test(defectoId)) return res.status(400).json({ mensaje: 'defectoId inválido.' });

    const { estado, notasResolucion } = req.body ?? {};
    const { EstadoDefecto } = require('../services/entidades/defecto');
    if (!estado || !Object.values(EstadoDefecto).includes(estado)) {
      return res.status(400).json({ mensaje: `Estado inválido. Debe ser uno de: ${Object.values(EstadoDefecto).join(', ')}` });
    }

    const { proyecto, umbral } = await cargarContexto(proyectoId);
    const defectoExistente = await defectoRepo.obtenerPorId(defectoId);
    if (!defectoExistente) return res.status(404).json({ mensaje: 'Defecto no encontrado.' });

    const { defecto, medicion, alerta, estadoDensidad } = await transacciones.ejecutar(async (tx) => {
      const corte = await proyectoRepo.obtenerCorteActual(proyectoId, tx);
      const defectoActualizado = await defectoRepo.actualizarEstado(defectoId, estado, notasResolucion, tx);
      const medicion = await servicioMetricas.recalcularDensidadDefectos(proyecto, tx);
      const alerta = servicioEvaluarMetricas.evaluarSeveridadYDensidad(defectoActualizado, medicion, umbral);
      const estadoDensidad = medicion.estadoSemaforo;
      medicion.estadoSemaforo = await calcularSaludGlobalCorte(proyectoId, corte.id, medicion, tx);
      await configRepo.guardarMedicion(corte.id, medicion, tx);
      return { defecto: defectoActualizado, medicion, alerta, estadoDensidad };
    });

    return res.status(200).json({
      actualizacionExitosa: true,
      defecto: { ...defecto, asignadoNombre: defectoExistente.asignadoNombre },
      densidadDefectosActualizada: medicion.valorCalculado,
      totalDefectos: medicion.totalDefectos,
      nivelSemaforo: estadoDensidad,
      alertaEmitida: alerta,
    });
  } catch (err) {
    return manejarError(res, err);
  }
}

const router = express.Router();
router.param('proyectoId', (req, res, next, id) =>
  (UUID.test(id) ? next() : res.status(400).json({ mensaje: 'proyectoId inválido.' })));
router.get('/proyectos/:proyectoId/defectos', obtenerTablero);
router.post('/proyectos/:proyectoId/defectos', registrarYClasificarDefecto);
router.post('/proyectos/:proyectoId/defectos/descartar', descartarRegistroDuplicado);
router.put('/proyectos/:proyectoId/defectos/:defectoId', actualizarDefecto);
router.patch('/proyectos/:proyectoId/defectos/:defectoId/estado', actualizarEstadoDefecto);

module.exports = router;
