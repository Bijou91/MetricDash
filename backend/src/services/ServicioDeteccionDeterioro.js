const configRepo = require('../data/ConfiguracionMetricasRepository');
const alertaRepo = require('../data/AlertaDeterioroRepository');
const causasRepo = require('../data/CausasRepository');
const evaluarMetricas = require('./ServicioEvaluarMetricas');
const { SentidoMetrica, TipoMetrica } = require('./entidades/metricas');
const { NivelSemaforo } = require('./entidades/proyecto');
const { AlertaDeterioro } = require('./entidades/accionCorrectiva');

const PESO_SEMAFORO = {
  [NivelSemaforo.VERDE_OPTIMO]: 1,
  VERDE: 1,
  [NivelSemaforo.AMARILLO_ADVERTENCIA]: 2,
  AMARILLO: 2,
  [NivelSemaforo.ROJO_CRITICO]: 3,
  ROJO: 3,
};

const NOMBRES_METRICA = {
  [TipoMetrica.DENSIDAD_DEFECTOS]: 'Densidad de defectos',
  [TipoMetrica.COBERTURA_PRUEBAS]: 'Cobertura de pruebas',
  [TipoMetrica.TASA_EXITO_PRUEBAS]: 'Tasa de éxito de pruebas',
  [TipoMetrica.CUMPLIMIENTO_SQA]: 'Cumplimiento de actividades SQA',
};

// FN-01: Detecta deterioro al registrar una nueva medición (Vn) contra la inmediata anterior (Vn-1) y umbrales
async function evaluarNuevaMedicion(nuevaMedicion, tx) {
  const { proyectoId, tipoMetrica, corteId } = nuevaMedicion;
  const valorActual = Number(nuevaMedicion.valorCalculado ?? nuevaMedicion.valor);

  // Precondición 3: umbral vigente
  const umbral = await configRepo.obtenerUmbralVigente(proyectoId, tipoMetrica);
  if (!umbral) {
    return { deterioroDetectado: false, motivo: 'Métrica sin umbrales configurados.' };
  }

  const estadoActual = evaluarMetricas.determinarEstadoSemaforo(valorActual, umbral);
  const pesoActual = PESO_SEMAFORO[estadoActual] || 0;

  // Obtener medición previa (Vn-1). Si es la primera medición pero ya cayó en AMARILLO o ROJO,
  // se evalúa el cruce de umbral respecto a la meta configurada (VERDE_OPTIMO).
  const medicionPrevia = await configRepo.obtenerMedicionAnterior(proyectoId, tipoMetrica, tx);
  const tieneMedicionPrevia = medicionPrevia && medicionPrevia.valor != null;

  if (!tieneMedicionPrevia && pesoActual <= 1) {
    return {
      deterioroDetectado: false,
      motivo: 'Primera medición registrada en estado óptimo (VERDE).',
    };
  }

  const valorAnterior = tieneMedicionPrevia
    ? Number(medicionPrevia.valor)
    : Number(umbral.meta);

  const estadoAnterior = tieneMedicionPrevia
    ? evaluarMetricas.determinarEstadoSemaforo(valorAnterior, umbral)
    : NivelSemaforo.VERDE_OPTIMO;

  // Condición (a): Vn es peor que Vn-1 según SentidoMetrica
  const esPeorSegunSentido = umbral.sentido === SentidoMetrica.MAYOR_ES_MEJOR
    ? valorActual < valorAnterior
    : valorActual > valorAnterior;

  // Condición (b): Vn cruza un umbral (su estado de semáforo es peor que el de Vn-1)
  const pesoAnterior = PESO_SEMAFORO[estadoAnterior] || 0;
  const cruzoUmbralPeor = pesoActual > pesoAnterior;

  const hayDeterioro = esPeorSegunSentido || cruzoUmbralPeor;

  if (!hayDeterioro) {
    return {
      deterioroDetectado: false,
      motivo: 'La métrica se mantuvo estable o mejoró.',
      valorAnterior,
      valorActual,
      estadoAnterior,
      estadoActual,
    };
  }

  // FN-02: Obtener causas y tendencia de las últimas mediciones
  const posiblesCausas = await causasRepo.obtenerPosiblesCausas(proyectoId, tipoMetrica, tx);
  const ultimasMediciones = await configRepo.obtenerMedicionesHistoricas(proyectoId, tipoMetrica, 3, tx);

  // Construir la tendencia asegurando orden cronológico y hasta 3 puntos
  let tendenciaActual;
  if (ultimasMediciones.length >= 2) {
    tendenciaActual = ultimasMediciones.slice(0, 3).reverse();
    tendenciaActual[tendenciaActual.length - 1] = {
      ...tendenciaActual[tendenciaActual.length - 1],
      valor: valorActual,
      estadoSemaforo: estadoActual,
      nombreCorte: nuevaMedicion.nombreCorte || tendenciaActual[tendenciaActual.length - 1].nombreCorte || 'Medición actual',
    };
  } else {
    tendenciaActual = [
      {
        valor: valorAnterior,
        estadoSemaforo: estadoAnterior,
        fecha: new Date(),
        nombreCorte: tieneMedicionPrevia ? (medicionPrevia.nombreCorte || 'Medición previa') : 'Meta configurada',
      },
      {
        valor: valorActual,
        estadoSemaforo: estadoActual,
        fecha: new Date(),
        nombreCorte: nuevaMedicion.nombreCorte || ultimasMediciones[0]?.nombreCorte || 'Medición actual',
      },
    ];
  }

  const nombre = NOMBRES_METRICA[tipoMetrica] || tipoMetrica;
  const unidad = umbral.unidad === '%' ? '%' : ` ${umbral.unidad}`;
  const motivos = [];
  if (esPeorSegunSentido) {
    const etiquetaPrev = tieneMedicionPrevia ? `${valorAnterior}${unidad}` : `meta de ${valorAnterior}${unidad}`;
    motivos.push(`cayó de ${etiquetaPrev} a ${valorActual}${unidad}`);
  }
  if (cruzoUmbralPeor) {
    motivos.push(`pasó a semáforo ${estadoActual}`);
  }

  const mensajeAlerta = `Deterioro detectado en ${nombre}: ${motivos.join(' y ')}.`;

  // Evitar duplicar alertas activas para la misma métrica (FA-01.01)
  const alertaExistente = await alertaRepo.obtenerAlertaActivaPorMetrica(proyectoId, tipoMetrica, tx);
  let alertaGuardada;

  if (alertaExistente) {
    alertaGuardada = await alertaRepo.actualizar(
      alertaExistente.id,
      {
        valorAnterior,
        valorActual,
        nivelSemaforo: estadoActual,
        mensaje: mensajeAlerta,
        tendencia: tendenciaActual,
        posiblesCausas,
      },
      tx,
    );
  } else {
    const alerta = new AlertaDeterioro({
      proyectoId,
      tipoMetrica,
      corteId,
      valorInicial: valorActual, // Vα para verificación de eficacia futura
      valorAnterior,
      valorActual,
      nivelSemaforo: estadoActual,
      mensaje: mensajeAlerta,
      tendencia: tendenciaActual,
      posiblesCausas,
      estado: 'ACTIVA',
    });
    alertaGuardada = await alertaRepo.guardar(alerta, tx);
  }

  return {
    deterioroDetectado: true,
    alerta: alertaGuardada,
    condicionA: esPeorSegunSentido,
    condicionB: cruzoUmbralPeor,
    valorAnterior,
    valorActual,
  };
}

module.exports = {
  evaluarNuevaMedicion,
};

