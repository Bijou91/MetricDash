const defectoRepo = require('../data/DefectoRepository');
const proyectoRepo = require('../data/ProyectoRepository');
const { MedicionMetrica } = require('./entidades/defecto');
const { TipoMetrica } = require('./entidades/metricas');

// FN-05: densidad = defectos identificados del proyecto / tamaño estimado del producto (KLOC de CU-01).
async function recalcularDensidadDefectos(proyecto, tx) {
  const totalDefectos = await defectoRepo.contarDefectosProyecto(proyecto.id, tx);
  const medicion = new MedicionMetrica({ tipoMetrica: TipoMetrica.DENSIDAD_DEFECTOS });
  medicion.calcularDensidad(totalDefectos, Number(proyecto.estimated_kloc));
  await proyectoRepo.actualizar(proyecto.id, tx);
  return Object.assign(medicion, { totalDefectos });
}

module.exports = { recalcularDensidadDefectos };
