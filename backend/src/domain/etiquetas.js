// Etiquetas de negocio para mostrar al usuario (PDF y mensajes); nunca se muestran los enums internos.
const NOMBRES_METRICA = Object.freeze({
  DENSIDAD_DEFECTOS: 'Densidad de defectos',
  COBERTURA_PRUEBAS: 'Cobertura de pruebas',
  TASA_EXITO_PRUEBAS: 'Tasa de éxito de pruebas',
  CUMPLIMIENTO_SQA: 'Cumplimiento de actividades SQA'
});

const ETIQUETA_NIVEL = Object.freeze({
  VERDE_OPTIMO: 'Óptimo',
  AMARILLO_ADVERTENCIA: 'Advertencia',
  ROJO_CRITICO: 'Crítico',
  SIN_DATOS: 'Sin datos'
});

const ETIQUETA_IMPACTO = Object.freeze({
  POSITIVO: 'Positivo',
  NEUTRO: 'Neutro (riesgo)',
  NEGATIVO: 'Negativo',
  SIN_DATOS: 'Sin datos'
});

const ETIQUETA_ESTADO_INDICE = Object.freeze({
  SIN_DATOS: 'Sin datos',
  INSUFICIENTE: 'Insuficiente'
});

function textoIndice(estadoIndice, indice) {
  if (estadoIndice === 'CALCULADO' && indice !== null && indice !== undefined) {
    return `${Number(indice).toFixed(1)}%`;
  }
  return ETIQUETA_ESTADO_INDICE[estadoIndice] || 'Sin datos';
}

module.exports = { NOMBRES_METRICA, ETIQUETA_NIVEL, ETIQUETA_IMPACTO, ETIQUETA_ESTADO_INDICE, textoIndice };
