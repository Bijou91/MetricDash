const { TipoMetrica, SentidoMetrica, ErrorValidacion } = require('../domain/metricas');

const CAMPOS = ['meta', 'umbralAdvertencia', 'umbralCritico'];

// FA-02.02: las 4 métricas obligatorias, sin repetir y sin campos vacíos o no numéricos.
function validarCompletitud(metricas) {
  if (!Array.isArray(metricas)) return [new ErrorValidacion(null, 'metricas', 'Debe enviar la lista de métricas.')];
  const errores = [];
  const vistos = new Set();
  for (const m of metricas) {
    if (!TipoMetrica[m?.tipo]) {
      errores.push(new ErrorValidacion(m?.tipo ?? null, 'tipo', 'Tipo de métrica desconocido.'));
      continue;
    }
    if (vistos.has(m.tipo)) errores.push(new ErrorValidacion(m.tipo, 'tipo', 'Métrica repetida.'));
    vistos.add(m.tipo);
    for (const campo of CAMPOS) {
      if (typeof m[campo] !== 'number' || !Number.isFinite(m[campo])) {
        errores.push(new ErrorValidacion(m.tipo, campo, 'Campo obligatorio y numérico.'));
      }
    }
  }
  for (const tipo of Object.keys(TipoMetrica)) {
    if (!vistos.has(tipo)) errores.push(new ErrorValidacion(tipo, 'tipo', 'Falta configurar esta métrica.'));
  }
  return errores;
}

// FA-02.01: MAYOR_ES_MEJOR → meta > advertencia > crítico; MENOR_ES_MEJOR → meta < advertencia < crítico.
function validarCoherencia(metrica) {
  const { tipo, sentido, meta, umbralAdvertencia: adv, umbralCritico: crit } = metrica;
  const mayor = sentido === SentidoMetrica.MAYOR_ES_MEJOR;
  const errores = [];
  if (mayor ? !(meta > adv) : !(meta < adv)) {
    errores.push(new ErrorValidacion(tipo, 'umbralAdvertencia',
      `La advertencia debe ser ${mayor ? 'menor' : 'mayor'} que la meta.`));
  }
  if (mayor ? !(adv > crit) : !(adv < crit)) {
    errores.push(new ErrorValidacion(tipo, 'umbralCritico',
      `El crítico debe ser ${mayor ? 'menor' : 'mayor'} que la advertencia.`));
  }
  return errores;
}

// Porcentajes en 0..100; densidad de defectos >= 0.
function validarRango(metrica) {
  const porcentaje = metrica.unidad === '%';
  return CAMPOS
    .filter((campo) => metrica[campo] < 0 || (porcentaje && metrica[campo] > 100))
    .map((campo) => new ErrorValidacion(metrica.tipo, campo,
      porcentaje ? 'Debe estar entre 0 y 100.' : 'Debe ser mayor o igual a 0.'));
}

module.exports = { validarCompletitud, validarCoherencia, validarRango };
