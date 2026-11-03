const { AlertaCalidad } = require('./entidades/defecto');
const { NivelSemaforo } = require('./entidades/proyecto');
const { EstadoSemaforo, TipoMetrica } = require('./entidades/metricas');

// El semáforo de CU-02 (VERDE/AMARILLO/ROJO) se traduce al nivel del tablero de CU-01.
const A_NIVEL = {
  [EstadoSemaforo.VERDE]: NivelSemaforo.VERDE_OPTIMO,
  [EstadoSemaforo.AMARILLO]: NivelSemaforo.AMARILLO_ADVERTENCIA,
  [EstadoSemaforo.ROJO]: NivelSemaforo.ROJO_CRITICO,
  [NivelSemaforo.VERDE_OPTIMO]: NivelSemaforo.VERDE_OPTIMO,
  [NivelSemaforo.AMARILLO_ADVERTENCIA]: NivelSemaforo.AMARILLO_ADVERTENCIA,
  [NivelSemaforo.ROJO_CRITICO]: NivelSemaforo.ROJO_CRITICO,
};

const NOMBRES_METRICA = {
  [TipoMetrica.DENSIDAD_DEFECTOS]: 'la densidad de defectos',
  [TipoMetrica.COBERTURA_PRUEBAS]: 'la cobertura de pruebas',
  [TipoMetrica.TASA_EXITO_PRUEBAS]: 'la tasa de éxito de pruebas',
  [TipoMetrica.CUMPLIMIENTO_SQA]: 'el cumplimiento de actividades SQA',
};

const PRIORIDAD_SEMAFORO = {
  [NivelSemaforo.ROJO_CRITICO]: 3,
  [EstadoSemaforo.ROJO]: 3,
  [NivelSemaforo.AMARILLO_ADVERTENCIA]: 2,
  [EstadoSemaforo.AMARILLO]: 2,
  [NivelSemaforo.VERDE_OPTIMO]: 1,
  [EstadoSemaforo.VERDE]: 1,
};

// umbral: MetricaCalidad vigente de CU-02 (reutiliza su evaluarEstado).
function determinarEstadoSemaforo(valor, umbral) {
  return A_NIVEL[umbral.evaluarEstado(valor)];
}

// FN-05 (CU-05): evalúa una medición individual contra su umbral vigente y genera AlertaCalidad si sale de verde.
function evaluarMedicion(medicion, umbral) {
  medicion.estadoSemaforo = determinarEstadoSemaforo(medicion.valorCalculado, umbral);
  const porUmbralExcedido = medicion.estadoSemaforo !== NivelSemaforo.VERDE_OPTIMO;
  if (!porUmbralExcedido) return null;

  const nombre = NOMBRES_METRICA[medicion.tipoMetrica] || medicion.tipoMetrica;
  const unidad = umbral.unidad === '%' ? '%' : ` ${umbral.unidad}`;
  const motivo = medicion.estadoSemaforo === NivelSemaforo.ROJO_CRITICO
    ? `${nombre} (${medicion.valorCalculado}${unidad}) cayó en nivel crítico (umbral: ${umbral.umbralCritico}${unidad})`
    : `${nombre} (${medicion.valorCalculado}${unidad}) cayó en nivel de advertencia (umbral: ${umbral.umbralAdvertencia}${unidad})`;

  return new AlertaCalidad({
    porDefectoCritico: false,
    porUmbralExcedido: true,
    nivelSemaforo: medicion.estadoSemaforo,
    mensajeAlerta: `Alerta de calidad: ${motivo}.`,
  });
}

// FN-05 (CU-05): calcula el peor estado entre los recibidos (ROJO > AMARILLO > VERDE), ignorando SIN_DATOS/null.
function calcularNivelGlobal(...estados) {
  const lista = estados.flat().filter((e) => e && PRIORIDAD_SEMAFORO[e]);
  if (lista.length === 0) return NivelSemaforo.SIN_DATOS;
  let peor = lista[0];
  for (const est of lista.slice(1)) {
    if (PRIORIDAD_SEMAFORO[est] > PRIORIDAD_SEMAFORO[peor]) {
      peor = est;
    }
  }
  return A_NIVEL[peor] || peor;
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

module.exports = {
  determinarEstadoSemaforo,
  evaluarMedicion,
  calcularNivelGlobal,
  evaluarSeveridadYDensidad,
};
