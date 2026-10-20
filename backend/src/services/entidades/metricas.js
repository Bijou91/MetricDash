const TipoMetrica = Object.freeze({
  DENSIDAD_DEFECTOS: 'DENSIDAD_DEFECTOS',
  COBERTURA_PRUEBAS: 'COBERTURA_PRUEBAS',
  TASA_EXITO_PRUEBAS: 'TASA_EXITO_PRUEBAS',
  CUMPLIMIENTO_SQA: 'CUMPLIMIENTO_SQA',
});

const SentidoMetrica = Object.freeze({
  MAYOR_ES_MEJOR: 'MAYOR_ES_MEJOR',
  MENOR_ES_MEJOR: 'MENOR_ES_MEJOR',
});

const EstadoSemaforo = Object.freeze({ VERDE: 'VERDE', AMARILLO: 'AMARILLO', ROJO: 'ROJO' });

// Sentido y unidad los fija el sistema por tipo; el cliente no los decide.
const DEFINICION_METRICAS = Object.freeze({
  DENSIDAD_DEFECTOS: { sentido: SentidoMetrica.MENOR_ES_MEJOR, unidad: 'defectos/KLOC' },
  COBERTURA_PRUEBAS: { sentido: SentidoMetrica.MAYOR_ES_MEJOR, unidad: '%' },
  TASA_EXITO_PRUEBAS: { sentido: SentidoMetrica.MAYOR_ES_MEJOR, unidad: '%' },
  CUMPLIMIENTO_SQA: { sentido: SentidoMetrica.MAYOR_ES_MEJOR, unidad: '%' },
});

class MetricaCalidad {
  constructor({ tipo, meta, umbralAdvertencia, umbralCritico }) {
    Object.assign(this, { tipo, meta, umbralAdvertencia, umbralCritico }, DEFINICION_METRICAS[tipo]);
  }

  // Los umbrales son inclusivos del lado "mejor": alcanzar la advertencia aún es VERDE.
  evaluarEstado(valor) {
    const mejorOIgual = (v, u) => (this.sentido === SentidoMetrica.MAYOR_ES_MEJOR ? v >= u : v <= u);
    if (mejorOIgual(valor, this.umbralAdvertencia)) return EstadoSemaforo.VERDE;
    if (mejorOIgual(valor, this.umbralCritico)) return EstadoSemaforo.AMARILLO;
    return EstadoSemaforo.ROJO;
  }
}

class ConfiguracionMetricas {
  constructor({ id, proyectoId, version, vigente, creadoPor, fechaCreacion, metricas }) {
    Object.assign(this, { id, proyectoId, version, vigente, creadoPor, fechaCreacion });
    this.metricas = metricas.map((m) => new MetricaCalidad(m));
  }
}

class ErrorValidacion {
  constructor(tipoMetrica, campo, mensaje) {
    Object.assign(this, { tipoMetrica, campo, mensaje });
  }
}

module.exports = {
  TipoMetrica,
  SentidoMetrica,
  EstadoSemaforo,
  DEFINICION_METRICAS,
  MetricaCalidad,
  ConfiguracionMetricas,
  ErrorValidacion,
};
