const { MedicionMetrica } = require('./entidades/defecto');
const { TipoMetrica } = require('./entidades/metricas');

// FN-04: Genera las mediciones de Cobertura de pruebas y Tasa de éxito para la ronda evaluada.
function generarMediciones(ronda, corteId) {
  const cobertura = new MedicionMetrica({
    tipoMetrica: TipoMetrica.COBERTURA_PRUEBAS,
    valorCalculado: ronda.calcularCobertura(),
  });
  const tasaExito = new MedicionMetrica({
    tipoMetrica: TipoMetrica.TASA_EXITO_PRUEBAS,
    valorCalculado: ronda.calcularTasaExito(),
  });
  return [
    Object.assign(cobertura, { corteId }),
    Object.assign(tasaExito, { corteId }),
  ];
}

module.exports = { generarMediciones };

