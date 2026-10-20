const { FaseProyecto, RolEquipo, EstadoActividad, TipoProyecto } = require('../domain/proyecto');

function generarPlanBase(tipoProyecto = TipoProyecto.DESARROLLO_NUEVO) {
  const actividadesComunes = [
    {
      title: 'Revisión por pares de Visión y Alcance',
      category: 'REVIEW',
      phase: FaseProyecto.ANALISIS_REQUERIMIENTOS,
      iso_practice_ref: 'ISO/IEC 29110-5-1-1 Cl. 2.1',
      responsible_role: RolEquipo.QA,
      status: EstadoActividad.PLANIFICADA,
    },
    {
      title: 'Revisión de Especificación de Casos de Uso',
      category: 'REVIEW',
      phase: FaseProyecto.ANALISIS_REQUERIMIENTOS,
      iso_practice_ref: 'ISO/IEC 29110-5-1-1 Cl. 2.1',
      responsible_role: RolEquipo.TECNICO,
      status: EstadoActividad.PLANIFICADA,
    },
    {
      title: 'Revisión formal de Arquitectura y Diseño (SDS)',
      category: 'REVIEW',
      phase: FaseProyecto.DISENO_COMPONENTES,
      iso_practice_ref: 'ISO/IEC 29110-5-1-1 Cl. 2.2',
      responsible_role: RolEquipo.TECNICO,
      status: EstadoActividad.PLANIFICADA,
    },
    {
      title: 'Revisión de Modelo de Datos y Prototipos UI',
      category: 'REVIEW',
      phase: FaseProyecto.DISENO_COMPONENTES,
      iso_practice_ref: 'ISO/IEC 29110-5-1-1 Cl. 2.2',
      responsible_role: RolEquipo.QA,
      status: EstadoActividad.PLANIFICADA,
    },
    {
      title: 'Revisión de Código Fuente y Estándares',
      category: 'REVIEW',
      phase: FaseProyecto.CONSTRUCCION_SOFTWARE,
      iso_practice_ref: 'ISO/IEC 29110-5-1-1 Cl. 2.3',
      responsible_role: RolEquipo.TECNICO,
      status: EstadoActividad.PLANIFICADA,
    },
    {
      title: 'Creación y Ejecución de Pruebas Unitarias',
      category: 'TEST',
      phase: FaseProyecto.CONSTRUCCION_SOFTWARE,
      iso_practice_ref: 'ISO/IEC 29110-5-1-1 Cl. 2.3',
      responsible_role: RolEquipo.QA,
      status: EstadoActividad.PLANIFICADA,
    },
    {
      title: 'Ejecución de Pruebas de Integración',
      category: 'TEST',
      phase: FaseProyecto.INTEGRACION_Y_PRUEBAS,
      iso_practice_ref: 'ISO/IEC 29110-5-1-1 Cl. 2.3',
      responsible_role: RolEquipo.QA,
      status: EstadoActividad.PLANIFICADA,
    },
    {
      title: 'Elaboración de Bitácora SQA y Dictamen Final',
      category: 'AUDIT',
      phase: FaseProyecto.INTEGRACION_Y_PRUEBAS,
      iso_practice_ref: 'ISO/IEC 29110-5-1-1 Cl. 2.4',
      responsible_role: RolEquipo.GESTION_PROYECTO,
      status: EstadoActividad.PLANIFICADA,
    },
  ];

  if (tipoProyecto === TipoProyecto.MANTENIMIENTO) {
    actividadesComunes.unshift({
      title: 'Análisis de Impacto y Diagnóstico de Regresión',
      category: 'AUDIT',
      phase: FaseProyecto.ANALISIS_REQUERIMIENTOS,
      iso_practice_ref: 'ISO/IEC 29110-5-1-1 Cl. 2.1',
      responsible_role: RolEquipo.TECNICO,
      status: EstadoActividad.PLANIFICADA,
    });
  } else if (tipoProyecto === TipoProyecto.MIGRACION) {
    actividadesComunes.push({
      title: 'Pruebas de Validación de Integridad de Datos Migrados',
      category: 'TEST',
      phase: FaseProyecto.INTEGRACION_Y_PRUEBAS,
      iso_practice_ref: 'ISO/IEC 29110-5-1-1 Cl. 2.4',
      responsible_role: RolEquipo.QA,
      status: EstadoActividad.PLANIFICADA,
    });
  }

  return {
    tipoProyecto,
    totalActividades: actividadesComunes.length,
    actividades: actividadesComunes,
  };
}

module.exports = {
  generarPlanBase,
};
