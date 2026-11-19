// Textos de negocio para el tablero y el reporte de salud: la interfaz nunca muestra enums internos.
export const NOMBRES_METRICA = {
  DENSIDAD_DEFECTOS: 'Densidad de Defectos',
  COBERTURA_PRUEBAS: 'Cobertura de Pruebas',
  TASA_EXITO_PRUEBAS: 'Tasa de Éxito de Pruebas',
  CUMPLIMIENTO_SQA: 'Cumplimiento Actividades SQA'
};

export const ETIQUETA_NIVEL = {
  VERDE_OPTIMO: 'Óptimo',
  AMARILLO_ADVERTENCIA: 'Advertencia',
  ROJO_CRITICO: 'Crítico',
  SIN_DATOS: 'Sin datos'
};

export const ETIQUETA_ESTADO_INDICE = {
  SIN_DATOS: 'Sin datos',
  INSUFICIENTE: 'Insuficiente'
};

// Clases Tailwind del badge; SIN_DATOS (y cualquier valor desconocido) usa estilo neutro, nunca rojo.
export const CLASE_BADGE_NIVEL = {
  VERDE_OPTIMO: 'bg-emerald-100 text-emerald-800',
  AMARILLO_ADVERTENCIA: 'bg-amber-100 text-amber-800',
  ROJO_CRITICO: 'bg-red-100 text-red-800'
};
export const CLASE_BADGE_NEUTRO = 'bg-slate-100 text-slate-700';

export const nombreMetrica = (tipo) => NOMBRES_METRICA[tipo] || tipo;

// Índice mostrado al usuario: porcentaje si se pudo calcular; si no, "Sin datos" o "Insuficiente".
export function textoIndice(estadoIndice, indice) {
  if (estadoIndice === 'CALCULADO' && indice !== null && indice !== undefined) return `${indice}%`;
  return ETIQUETA_ESTADO_INDICE[estadoIndice] || 'Sin datos';
}

// Estado global mostrado: si el índice no se calculó, el estado es "Sin datos" o "Insuficiente".
export function etiquetaEstadoGlobal(estadoIndice, nivel) {
  if (estadoIndice && estadoIndice !== 'CALCULADO') return ETIQUETA_ESTADO_INDICE[estadoIndice];
  return ETIQUETA_NIVEL[nivel] || ETIQUETA_NIVEL.SIN_DATOS;
}

export function claseBadgeEstadoGlobal(estadoIndice, nivel) {
  if (estadoIndice && estadoIndice !== 'CALCULADO') return CLASE_BADGE_NEUTRO;
  return CLASE_BADGE_NIVEL[nivel] || CLASE_BADGE_NEUTRO;
}
