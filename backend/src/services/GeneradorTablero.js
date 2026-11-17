const { NivelSemaforo } = require('./entidades/proyecto');

function crearTableroInicial(proyecto = {}, lineaBase = {}, planQA = {}) {
  return {
    cutoffNumber: 1,
    cutoffName: 'CP1-Línea Base Inicial',
    cutoffDate: lineaBase.approvalDate || new Date().toISOString().split('T')[0],
    kloc: Number(proyecto.estimatedKloc || proyecto.tamanoProductoKLOC || 1.0),
    plannedSqaActs: planQA.totalActividades || (planQA.actividades ? planQA.actividades.length : 0),
    executedSqaActs: 0,
    healthStatus: NivelSemaforo.SIN_DATOS,
    mensajeEstado: 'Línea base creada. Sistema listo para configurar métricas y registrar actividades SQA.',
    indicadores: {
      densidadDefectos: { valor: 0, estado: NivelSemaforo.SIN_DATOS, unidad: 'Defectos/KLOC' },
      coberturaPruebas: { valor: 0, estado: NivelSemaforo.SIN_DATOS, unidad: '%' },
      tasaExitoPruebas: { valor: 0, estado: NivelSemaforo.SIN_DATOS, unidad: '%' },
      cumplimientoSqa: { valor: 0, estado: NivelSemaforo.SIN_DATOS, unidad: '%' },
    },
  };
}

module.exports = {
  crearTableroInicial,
};
