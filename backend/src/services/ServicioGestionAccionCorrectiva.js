const accionRepo = require('../data/AccionCorrectivaRepository');
const alertaRepo = require('../data/AlertaDeterioroRepository');
const proyectoRepo = require('../data/ProyectoRepository');
const validador = require('./ValidadorAccionCorrectiva');
const servicioDeteccion = require('./ServicioDeteccionDeterioro');
const servicioVerificacion = require('./ServicioVerificacionEficacia');

// Coordinación según Diagrama de Secuencia:
// Evalúa si corresponde verificar eficacia (FN-07) o detectar deterioro (FN-01 / FA-01.01)
async function procesarNuevaMedicion(nuevaMedicion, tx) {
  const { proyectoId, tipoMetrica } = nuevaMedicion;

  // Buscar si ya existe una acción correctiva abierta para esta métrica
  const accionAbierta = await accionRepo.buscarAbiertaPorMetrica(proyectoId, tipoMetrica, tx);

  if (accionAbierta) {
    // Si existe acción abierta, la nueva medición se destina a verificar su eficacia (FN-07)
    // y evita duplicar la alerta según FA-01.01
    const resultadoVerificacion = await servicioVerificacion.verificarEficacia(nuevaMedicion, accionAbierta, tx);
    return {
      tipoFlujo: 'VERIFICACION_EFICACIA',
      accionAbiertaId: accionAbierta.id,
      ...resultadoVerificacion,
    };
  }

  // Si no hay acción abierta, se evalúa si hay deterioro respecto a la medición anterior (FN-01, FN-02)
  const resultadoDeteccion = await servicioDeteccion.evaluarNuevaMedicion(nuevaMedicion, tx);
  return {
    tipoFlujo: 'DETECCION_DETERIORO',
    ...resultadoDeteccion,
  };
}

// FN-05, FA-04.01, FA-05.01 y FA-07.01:
// Valida los datos y registra una nueva acción o actualiza una existente
async function registrarOActualizar(dto, tx) {
  // Cargar miembros del proyecto para validar pertenencia del responsable (FN-05 / FA-05.01)
  const miembros = await proyectoRepo.obtenerMiembros(dto.proyectoId);
  const validacion = validador.validar(dto, miembros);

  if (!validacion.esValido) {
    return {
      esValido: false,
      errores: validacion.errores,
    };
  }

  let accionGuardada;
  let esActualizacion = false;

  if (dto.id) {
    // FA-07.01: Actualización de acción existente tras replanteamiento
    esActualizacion = true;
    accionGuardada = await accionRepo.actualizar(
      dto.id,
      {
        descripcion: dto.descripcion,
        causaAtendida: dto.causaAtendida || dto.causa,
        responsableId: dto.responsableId,
        fechaCompromiso: dto.fechaCompromiso,
        estado: 'abierta',
        esEficaz: null, // reinicia el estado de eficacia para la próxima evaluación
      },
      tx,
    );
  } else {
    // FN-05: Creación de nueva acción correctiva vinculada a la alerta
    accionGuardada = await accionRepo.guardar(
      {
        alertaId: dto.alertaId || null,
        proyectoId: dto.proyectoId,
        tipoMetrica: dto.tipoMetrica,
        descripcion: dto.descripcion,
        causaAtendida: dto.causaAtendida || dto.causa,
        responsableId: dto.responsableId,
        fechaCompromiso: dto.fechaCompromiso,
        estado: 'abierta',
      },
      tx,
    );
  }

  // Vincular la alerta y marcarla en estado EN_PROCESO
  if (dto.alertaId) {
    await alertaRepo.actualizar(dto.alertaId, { estado: 'EN_PROCESO' }, tx);
  }

  const miembro = miembros.find((m) => m.id === accionGuardada.responsableId);
  if (miembro) {
    accionGuardada.responsableNombre = miembro.member_name;
  }

  return {
    esValido: true,
    esActualizacion,
    accion: accionGuardada,
  };
}

module.exports = {
  procesarNuevaMedicion,
  registrarOActualizar,
};

