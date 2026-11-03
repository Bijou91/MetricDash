const configRepo = require('../data/ConfiguracionMetricasRepository');
const servicioGestion = require('./ServicioGestionAccionCorrectiva');

// SRM: Servicio de registro y orquestación de nuevas mediciones de métricas
async function registrarMedicion(dto = {}, tx) {
  const { proyectoId, corteId, tipoMetrica, estadoSemaforo } = dto;
  const valor = Number(dto.valorCalculado ?? dto.valor);

  // 1. Guardar medición en el historial para consultas posteriores y cálculo de Vn-1
  if (configRepo.guardarMedicionHistorica) {
    await configRepo.guardarMedicionHistorica(
      {
        proyectoId,
        corteId,
        tipoMetrica,
        valor,
        estadoSemaforo: estadoSemaforo || 'SIN_DATOS',
      },
      tx,
    );
  }

  // 2. Coordinar con el servicio de gestión de acciones correctivas (Detección vs Verificación)
  const resultado = await servicioGestion.procesarNuevaMedicion(
    {
      proyectoId,
      corteId,
      tipoMetrica,
      valorCalculado: valor,
      estadoSemaforo,
      nombreCorte: dto.nombreCorte,
    },
    tx,
  );

  return resultado;
}

module.exports = {
  registrarMedicion,
};

