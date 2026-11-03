const { ErrorValidacion, NivelSemaforo } = require('./entidades/proyecto');
const { EstadoSemaforo } = require('./entidades/metricas');

const CAMPOS_NUMERICO = [
  ['pruebasPlaneadas', 'Pruebas planeadas'],
  ['pruebasEjecutadas', 'Pruebas ejecutadas'],
  ['pruebasExitosas', 'Pruebas exitosas'],
  ['pruebasFallidas', 'Pruebas fallidas'],
];

const MAX_LONGITUD_NOTA = 1000;

function estaVacio(val) {
  return val === undefined || val === null || (typeof val === 'string' && val.trim() === '');
}

// FA-02.01: Maneja los campos obligatorios faltantes.
function validarCompletitud(dto = {}) {
  const errores = [];
  if (!dto || typeof dto !== 'object') {
    errores.push(new ErrorValidacion('corteId', 'Seleccione un corte o versión de evaluación.'));
    for (const [campo, etiqueta] of CAMPOS_NUMERICO) {
      errores.push(new ErrorValidacion(campo, `El campo "${etiqueta}" es obligatorio.`));
    }
    return errores;
  }

  if (estaVacio(dto.corteId)) {
    errores.push(new ErrorValidacion('corteId', 'Seleccione un corte o versión de evaluación.'));
  }

  for (const [campo, etiqueta] of CAMPOS_NUMERICO) {
    if (estaVacio(dto[campo])) {
      errores.push(new ErrorValidacion(campo, `El campo "${etiqueta}" es obligatorio.`));
    }
  }

  return errores;
}

function aEntero(val) {
  if (typeof val === 'boolean' || estaVacio(val)) return NaN;
  const n = Number(val);
  return Number.isInteger(n) ? n : NaN;
}

// FA-03.01: Enteros no negativos, planeadas > 0, ejecutadas > 0, ejecutadas <= planeadas, exitosas + fallidas = ejecutadas.
function validarConsistenciaNumerica(dto = {}) {
  const errores = [];
  const valores = {};

  for (const [campo, etiqueta] of CAMPOS_NUMERICO) {
    const n = aEntero(dto[campo]);
    if (Number.isNaN(n)) {
      errores.push(new ErrorValidacion(campo, `"${etiqueta}" debe ser un número entero válido.`));
    } else if (n < 0) {
      errores.push(new ErrorValidacion(campo, `"${etiqueta}" no puede ser un número negativo.`));
    } else {
      valores[campo] = n;
    }
  }

  if (valores.pruebasPlaneadas !== undefined && valores.pruebasPlaneadas <= 0) {
    errores.push(new ErrorValidacion('pruebasPlaneadas', 'Las pruebas planeadas deben ser mayores a cero.'));
  }

  if (valores.pruebasEjecutadas !== undefined && valores.pruebasEjecutadas <= 0) {
    errores.push(new ErrorValidacion('pruebasEjecutadas', 'Las pruebas ejecutadas deben ser mayores a cero.'));
  }

  if (
    valores.pruebasPlaneadas !== undefined &&
    valores.pruebasEjecutadas !== undefined &&
    valores.pruebasPlaneadas > 0 &&
    valores.pruebasEjecutadas > valores.pruebasPlaneadas
  ) {
    errores.push(new ErrorValidacion(
      'pruebasEjecutadas',
      `Las pruebas ejecutadas (${valores.pruebasEjecutadas}) no pueden superar a las pruebas planeadas (${valores.pruebasPlaneadas}).`,
    ));
  }

  if (
    valores.pruebasEjecutadas !== undefined &&
    valores.pruebasExitosas !== undefined &&
    valores.pruebasFallidas !== undefined &&
    valores.pruebasEjecutadas > 0 &&
    valores.pruebasExitosas + valores.pruebasFallidas !== valores.pruebasEjecutadas
  ) {
    errores.push(new ErrorValidacion(
      'pruebasFallidas',
      `La suma de pruebas exitosas (${valores.pruebasExitosas}) y fallidas (${valores.pruebasFallidas}) debe ser igual a las pruebas ejecutadas (${valores.pruebasEjecutadas}).`,
    ));
  }

  if (dto.notaExplicativa !== undefined && dto.notaExplicativa !== null) {
    if (typeof dto.notaExplicativa !== 'string') {
      errores.push(new ErrorValidacion('notaExplicativa', 'La nota explicativa debe ser texto válido.'));
    } else if (dto.notaExplicativa.trim().length > MAX_LONGITUD_NOTA) {
      errores.push(new ErrorValidacion('notaExplicativa', `La nota explicativa no puede exceder ${MAX_LONGITUD_NOTA} caracteres.`));
    }
  }

  return errores;
}

// FA-06.01: El guardado se bloquea hasta recibir la nota si el estado global calculado es rojo.
function validarNotaExplicativaObligatoria(dto = {}, estado) {
  const esRojo = estado === NivelSemaforo.ROJO_CRITICO || estado === EstadoSemaforo.ROJO;
  if (!esRojo) return null;

  const nota = typeof dto?.notaExplicativa === 'string' ? dto.notaExplicativa.trim() : '';
  if (!nota) {
    return new ErrorValidacion(
      'notaExplicativa',
      'Se requiere obligatoriamente una nota explicativa porque al menos una métrica cayó en estado crítico (rojo).',
    );
  }
  if (nota.length > MAX_LONGITUD_NOTA) {
    return new ErrorValidacion(
      'notaExplicativa',
      `La nota explicativa no puede exceder ${MAX_LONGITUD_NOTA} caracteres.`,
    );
  }
  return null;
}

// FN-03: Ejecuta completitud primero; si todo está presente, valida consistencia numérica.
function validar(dto = {}) {
  const erroresCompletitud = validarCompletitud(dto);
  if (erroresCompletitud.length > 0) {
    return {
      esValido: false,
      incompleto: true,
      camposFaltantes: erroresCompletitud.map((e) => e.campo),
      errores: erroresCompletitud,
    };
  }

  const erroresConsistencia = validarConsistenciaNumerica(dto);
  if (erroresConsistencia.length > 0) {
    return {
      esValido: false,
      incompleto: false,
      camposFaltantes: [],
      errores: erroresConsistencia,
    };
  }

  return {
    esValido: true,
    incompleto: false,
    camposFaltantes: [],
    errores: [],
  };
}

module.exports = {
  validarCompletitud,
  validarConsistenciaNumerica,
  validarNotaExplicativaObligatoria,
  validar,
};

