const configRepo = require('../data/ConfiguracionMetricasRepository');
const { calcularNivelGlobal } = require('./ServicioEvaluarMetricas');
const { TipoMetrica } = require('./entidades/metricas');
const { MetricaCongelada } = require('./entidades/cierrePeriodo');

// FN-07: la última medición de cada métrica es su valor final; FA-07.01: sin mediciones => null y SIN_DATOS.
async function congelar(proyectoId, tx) {
  const metricas = [];
  for (const tipo of Object.values(TipoMetrica)) {
    const [ultima] = await configRepo.obtenerMedicionesHistoricas(proyectoId, tipo, 1, tx);
    metricas.push(new MetricaCongelada(ultima
      ? {
        tipoMetrica: tipo,
        valorFinal: ultima.valor,
        estadoSemaforo: calcularNivelGlobal(ultima.estadoSemaforo), // normaliza VERDE -> VERDE_OPTIMO, etc.
        medicionOrigenId: ultima.id ?? null,
      }
      : { tipoMetrica: tipo }));
  }
  return metricas;
}

module.exports = { congelar };
