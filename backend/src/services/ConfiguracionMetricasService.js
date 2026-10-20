const validador = require('./ValidadorUmbrales');
const transacciones = require('../data/TransaccionManager');
const proyectoRepo = require('../repositories/ProyectoRepository');
const configRepo = require('../repositories/ConfiguracionMetricasRepository');
const { MetricaCalidad, ConfiguracionMetricas, SentidoMetrica, EstadoSemaforo } = require('../domain/metricas');

function errorConStatus(status, message) {
  return Object.assign(new Error(message), { status });
}

async function validar(proyectoId, dto) {
  if (!(await proyectoRepo.obtenerActivo(proyectoId))) throw errorConStatus(404, 'Proyecto no encontrado o inactivo.');

  const erroresCompletitud = validador.validarCompletitud(dto?.metricas);
  if (erroresCompletitud.length) return { valido: false, incompleto: true, errores: erroresCompletitud };

  const metricas = dto.metricas.map((m) => new MetricaCalidad(m));
  const errores = metricas.flatMap((m) => [...validador.validarCoherencia(m), ...validador.validarRango(m)]);
  return { valido: errores.length === 0, incompleto: false, errores, metricas };
}

// 3 rangos por métrica (12 en total), consistentes con MetricaCalidad.evaluarEstado.
function generarVistaPrevia(metricas) {
  const rangos = metricas.flatMap(({ tipo, sentido, umbralAdvertencia: adv, umbralCritico: crit }) =>
    sentido === SentidoMetrica.MAYOR_ES_MEJOR
      ? [
          { tipoMetrica: tipo, estado: EstadoSemaforo.VERDE, desde: adv, hasta: 100 },
          { tipoMetrica: tipo, estado: EstadoSemaforo.AMARILLO, desde: crit, hasta: adv },
          { tipoMetrica: tipo, estado: EstadoSemaforo.ROJO, desde: 0, hasta: crit },
        ]
      : [
          { tipoMetrica: tipo, estado: EstadoSemaforo.VERDE, desde: 0, hasta: adv },
          { tipoMetrica: tipo, estado: EstadoSemaforo.AMARILLO, desde: adv, hasta: crit },
          { tipoMetrica: tipo, estado: EstadoSemaforo.ROJO, desde: crit, hasta: null },
        ]);
  return { rangos };
}

async function guardarVersionada(proyectoId, dto, usuarioId) {
  const resultado = await validar(proyectoId, dto);
  if (!resultado.valido) throw Object.assign(new Error('Validación fallida'), { resultado });

  return transacciones.ejecutar(async (tx) => {
    const ultimaVersion = await configRepo.obtenerUltimaVersion(proyectoId, tx);
    await configRepo.desactivarVigente(proyectoId, tx);
    const nuevaConfig = new ConfiguracionMetricas({
      proyectoId,
      version: ultimaVersion + 1,
      vigente: true,
      creadoPor: usuarioId,
      metricas: resultado.metricas,
    });
    await configRepo.insertarVersion(nuevaConfig, tx);
    return nuevaConfig;
  });
}

module.exports = { validar, generarVistaPrevia, guardarVersionada };
