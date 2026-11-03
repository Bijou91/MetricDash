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

  // Precondición 4: debe existir al menos una medición previa (Vn-1)
  const medicionPrevia = await configRepo.obtenerMedicionAnterior(proyectoId, tipoMetrica, tx);
  if (!medicionPrevia || medicionPrevia.valor == null) {
    return { deterioroDetectado: false, motivo: 'No existe medición previa registrada para comparar (primera medición).' };
  }

  const valorAnterior = Number(medicionPrevia.valor);

  // Evaluación de semáforos
  const estadoAnterior = evaluarMetricas.determinarEstadoSemaforo(valorAnterior, umbral);
  const estadoActual = evaluarMetricas.determinarEstadoSemaforo(valorActual, umbral);

  // Condición (a): Vn es peor que Vn-1 según SentidoMetrica
  const esPeorSegunSentido = umbral.sentido === SentidoMetrica.MAYOR_ES_MEJOR
    ? valorActual < valorAnterior
    : valorActual > valorAnterior;

  // Condición (b): Vn cruza un umbral (su estado de semáforo es peor que el de Vn-1)
  const pesoAnterior = PESO_SEMAFORO[estadoAnterior] || 0;
  const pesoActual = PESO_SEMAFORO[estadoActual] || 0;
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

  // Construir la tendencia asegurando que incluya Vn y hasta 3 puntos
  const tendenciaActual = [
    {
      valor: valorActual,
      estadoSemaforo: estadoActual,
      fecha: new Date(),
      nombreCorte: nuevaMedicion.nombreCorte || 'Medición actual',
    },
    ...ultimasMediciones.filter((m) => Math.abs(m.valor - valorActual) > 0.0001 || m.fecha !== ultimasMediciones[0]?.fecha),
  ].slice(0, 3).reverse();

  const nombre = NOMBRES_METRICA[tipoMetrica] || tipoMetrica;
  const unidad = umbral.unidad === '%' ? '%' : ` ${umbral.unidad}`;
  const motivos = [];
  if (esPeorSegunSentido) {
    motivos.push(`empeoró de ${valorAnterior}${unidad} a ${valorActual}${unidad}`);
  }
  if (cruzoUmbralPeor) {
    motivos.push(`cambió de semáforo ${estadoAnterior} a ${estadoActual}`);
  }

  const mensajeAlerta = `Deterioro detectado en ${nombre}: ${motivos.join(' y ')}.`;

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

  const alertaGuardada = await alertaRepo.guardar(alerta, tx);

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

