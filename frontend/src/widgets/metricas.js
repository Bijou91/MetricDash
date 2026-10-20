export const ETIQUETAS = {
  DENSIDAD_DEFECTOS: { nombre: 'Densidad de defectos', unidad: 'defectos/KLOC', ayuda: 'Menor es mejor: meta < advertencia < crítico' },
  COBERTURA_PRUEBAS: { nombre: 'Cobertura de pruebas', unidad: '%', ayuda: 'Mayor es mejor: meta > advertencia > crítico (0-100)' },
  TASA_EXITO_PRUEBAS: { nombre: 'Tasa de éxito de pruebas', unidad: '%', ayuda: 'Mayor es mejor: meta > advertencia > crítico (0-100)' },
  CUMPLIMIENTO_SQA: { nombre: 'Cumplimiento de actividades SQA', unidad: '%', ayuda: 'Mayor es mejor: meta > advertencia > crítico (0-100)' },
};

export const CAMPOS = [
  ['meta', 'Meta'],
  ['umbralAdvertencia', 'Advertencia'],
  ['umbralCritico', 'Crítico'],
];
