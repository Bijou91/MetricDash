const AYUDA_MENOR = 'Menos es mejor: el crítico es el valor más alto (meta < advertencia < crítico).';
const AYUDA_MAYOR = 'Más es mejor: el crítico es el valor más bajo (meta > advertencia > crítico), entre 0 y 100.';

export const ETIQUETAS = {
  DENSIDAD_DEFECTOS: { nombre: 'Densidad de defectos', unidad: 'defectos/KLOC', ayuda: AYUDA_MENOR },
  COBERTURA_PRUEBAS: { nombre: 'Cobertura de pruebas', unidad: '%', ayuda: AYUDA_MAYOR },
  TASA_EXITO_PRUEBAS: { nombre: 'Tasa de éxito de pruebas', unidad: '%', ayuda: AYUDA_MAYOR },
  CUMPLIMIENTO_SQA: { nombre: 'Cumplimiento de actividades SQA', unidad: '%', ayuda: AYUDA_MAYOR },
};

export const CAMPOS = [
  ['meta', 'Meta'],
  ['umbralAdvertencia', 'Advertencia'],
  ['umbralCritico', 'Crítico'],
];
