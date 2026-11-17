const defectoRepo = require('../data/DefectoRepository');
const proyectoRepo = require('../data/ProyectoRepository');
const actividadRepo = require('../data/ActividadSqaRepository');
const { MedicionMetrica } = require('./entidades/defecto');
const { TipoMetrica } = require('./entidades/metricas');

// FN-05 (CU-03) / FN-08 (CU-04): densidad = defectos identificados del proyecto / tamaño estimado del producto (KLOC de CU-01).
async function recalcularDensidadDefectos(proyecto, tx) {
  const totalDefectos = await defectoRepo.contarDefectosProyecto(proyecto.id, tx);
  const kloc = Number(proyecto.estimated_kloc ?? proyecto.tamanoProductoKLOC ?? 1) || 1;
  const medicion = new MedicionMetrica({ tipoMetrica: TipoMetrica.DENSIDAD_DEFECTOS });
  medicion.calcularDensidad(totalDefectos, kloc);
  await proyectoRepo.actualizar(proyecto.id, tx);
  return Object.assign(medicion, { totalDefectos });
}

// FN-08 (CU-04): Cumplimiento de actividades SQA = (actividades realizadas / actividades exigibles) * 100,
// donde son exigibles las actividades cuya fecha planificada ya llegó o que ya fueron realizadas.
async function recalcularCumplimientoSQA(proyecto, tx, fechaActual = new Date()) {
  const [exigibles, realizadas] = await Promise.all([
    actividadRepo.contarExigibles(proyecto.id, fechaActual, tx),
    actividadRepo.contarRealizadas(proyecto.id, tx),
  ]);
  const valorCalculado = exigibles > 0
    ? Math.round((realizadas / exigibles) * 10000) / 100
    : 0;
  const medicion = new MedicionMetrica({
    tipoMetrica: TipoMetrica.CUMPLIMIENTO_SQA,
    valorCalculado,
  });
  await proyectoRepo.actualizar(proyecto.id, tx);
  return Object.assign(medicion, {
    actividadesExigibles: exigibles,
    actividadesRealizadas: realizadas,
  });
}

module.exports = {
  recalcularDensidadDefectos,
  recalcularCumplimientoSQA,
};
