const { AlertaCalidad } = require('./entidades/defecto');
const { NivelSemaforo } = require('./entidades/proyecto');
const { EstadoSemaforo } = require('./entidades/metricas');

// El semáforo de CU-02 (VERDE/AMARILLO/ROJO) se traduce al nivel del tablero de CU-01.
const A_NIVEL = {
  [EstadoSemaforo.VERDE]: NivelSemaforo.VERDE_OPTIMO,
  [EstadoSemaforo.AMARILLO]: NivelSemaforo.AMARILLO_ADVERTENCIA,
  [EstadoSemaforo.ROJO]: NivelSemaforo.ROJO_CRITICO,
};

// umbral: MetricaCalidad vigente de CU-02 (reutiliza su evaluarEstado).
function determinarEstadoSemaforo(valor, umbral) {
  return A_NIVEL[umbral.evaluarEstado(valor)];
}

// FN-06 / FA-03.02: alerta si el defecto es crítico o si la densidad deja el verde.
function evaluarSeveridadYDensidad(defecto, medicion, umbral) {
  medicion.estadoSemaforo = determinarEstadoSemaforo(medicion.valorCalculado, umbral);
  const porDefectoCritico = defecto.esCritico();
  const porUmbralExcedido = medicion.estadoSemaforo !== NivelSemaforo.VERDE_OPTIMO;
  if (!porDefectoCritico && !porUmbralExcedido) return null;

  const motivos = [];
  if (porDefectoCritico) motivos.push(`el defecto ${defecto.folio} es de severidad CRÍTICA`);
  if (medicion.estadoSemaforo === NivelSemaforo.ROJO_CRITICO) {
    motivos.push(`la densidad de defectos (${medicion.valorCalculado}) superó el umbral crítico (${umbral.umbralCritico})`);
  } else if (porUmbralExcedido) {
    motivos.push(`la densidad de defectos (${medicion.valorCalculado}) superó el umbral de advertencia (${umbral.umbralAdvertencia})`);
  }
  return new AlertaCalidad({
    porDefectoCritico,
    porUmbralExcedido,
    nivelSemaforo: medicion.estadoSemaforo,
    mensajeAlerta: `Alerta de calidad: ${motivos.join(' y ')}.`,
  });
}

module.exports = { determinarEstadoSemaforo, evaluarSeveridadYDensidad };
