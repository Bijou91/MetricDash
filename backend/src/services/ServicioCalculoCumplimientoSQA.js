const { MedicionMetrica } = require('./entidades/defecto');
const { TipoMetrica } = require('./entidades/metricas');

function calcularCumplimiento(realizadas, exigibles) {
  if (exigibles <= 0) {
    return 100;
  }
  const valor = (realizadas / exigibles) * 100;
  return Math.round(valor * 100) / 100;
}

function generarMedicionCumplimiento(realizadas, exigibles) {
  const valorCalculado = calcularCumplimiento(realizadas, exigibles);
  return new MedicionMetrica({
    tipoMetrica: TipoMetrica.CUMPLIMIENTO_SQA,
    valorCalculado,
    fechaMedicion: new Date(),
  });
}

module.exports = {
  calcularCumplimiento,
  generarMedicionCumplimiento,
};
