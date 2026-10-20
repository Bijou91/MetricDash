const TipoProyecto = Object.freeze({
  DESARROLLO_NUEVO: 'DESARROLLO_NUEVO',
  MANTENIMIENTO: 'MANTENIMIENTO',
  MIGRACION: 'MIGRACION',
});

const RolEquipo = Object.freeze({
  QA: 'QA',
  TECNICO: 'TECNICO',
  GESTION_PROYECTO: 'GESTION_PROYECTO',
});

const FaseProyecto = Object.freeze({
  ANALISIS_REQUERIMIENTOS: 'ANALISIS_REQUERIMIENTOS',
  DISENO_COMPONENTES: 'DISENO_COMPONENTES',
  CONSTRUCCION_SOFTWARE: 'CONSTRUCCION_SOFTWARE',
  INTEGRACION_Y_PRUEBAS: 'INTEGRACION_Y_PRUEBAS',
});

const EstadoActividad = Object.freeze({
  PLANIFICADA: 'PLANIFICADA',
  EN_CURSO: 'EN_CURSO',
  REALIZADA: 'REALIZADA',
});

const NivelSemaforo = Object.freeze({
  VERDE_OPTIMO: 'VERDE_OPTIMO',
  AMARILLO_ADVERTENCIA: 'AMARILLO_ADVERTENCIA',
  ROJO_CRITICO: 'ROJO_CRITICO',
  SIN_DATOS: 'SIN_DATOS',
});

class ProyectoExistenteException extends Error {
  constructor(periodo) {
    super(`Ya existe un proyecto activo registrado para el periodo ${periodo}. Solo se permite un solo proyecto por periodo.`);
    this.name = 'ProyectoExistenteException';
    this.status = 409;
    this.periodo = periodo;
  }
}

class ErrorValidacion {
  constructor(campo, mensaje) {
    this.campo = campo;
    this.mensaje = mensaje;
  }
}

module.exports = {
  TipoProyecto,
  RolEquipo,
  FaseProyecto,
  EstadoActividad,
  NivelSemaforo,
  ProyectoExistenteException,
  ErrorValidacion,
};
