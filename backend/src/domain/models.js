// Modelos y enumeraciones del dominio CU-07
const NivelSemaforo = Object.freeze({
  VERDE_OPTIMO: 'VERDE_OPTIMO',
  AMARILLO_ADVERTENCIA: 'AMARILLO_ADVERTENCIA',
  ROJO_CRITICO: 'ROJO_CRITICO',
  SIN_DATOS: 'SIN_DATOS'
});

const TipoMetrica = Object.freeze({
  DENSIDAD_DEFECTOS: 'DENSIDAD_DEFECTOS',
  COBERTURA_PRUEBAS: 'COBERTURA_PRUEBAS',
  TASA_EXITO_PRUEBAS: 'TASA_EXITO_PRUEBAS',
  CUMPLIMIENTO_SQA: 'CUMPLIMIENTO_SQA'
});

const SentidoMetrica = Object.freeze({
  MAYOR_ES_MEJOR: 'MAYOR_ES_MEJOR',
  MENOR_ES_MEJOR: 'MENOR_ES_MEJOR'
});

const ImpactoMetrica = Object.freeze({
  POSITIVO: 'POSITIVO',
  NEUTRO: 'NEUTRO',
  NEGATIVO: 'NEGATIVO',
  SIN_DATOS: 'SIN_DATOS'
});

class TableroControl {
  constructor({ proyectoId, estadoSaludGlobal, indiceSaludGeneral = null, fechaUltimaConsulta = new Date() }) {
    this.proyectoId = proyectoId;
    this.estadoSaludGlobal = estadoSaludGlobal;
    this.indiceSaludGeneral = indiceSaludGeneral;
    this.fechaUltimaConsulta = fechaUltimaConsulta;
  }

  actualizarVistaConsolidada(estado, indice) {
    this.estadoSaludGlobal = estado;
    this.indiceSaludGeneral = indice;
    this.fechaUltimaConsulta = new Date();
  }
}

class MedicionMetrica {
  constructor({ id, proyectoId, tipoMetrica, valorCalculado, nivelSemaforo, fechaMedicion }) {
    this.id = id;
    this.proyectoId = proyectoId;
    this.tipoMetrica = tipoMetrica;
    this.valorCalculado = valorCalculado !== null && valorCalculado !== undefined ? Number(valorCalculado) : null;
    this.nivelSemaforo = nivelSemaforo;
    this.fechaMedicion = fechaMedicion ? new Date(fechaMedicion) : new Date();
  }
}

class UmbralMetrica {
  constructor({ id, tipoMetrica, valorMeta, umbralAdvertencia, umbralCritico, sentido, unidad }) {
    this.id = id;
    this.tipoMetrica = tipoMetrica;
    this.valorMeta = Number(valorMeta);
    this.umbralAdvertencia = Number(umbralAdvertencia);
    this.umbralCritico = Number(umbralCritico);
    this.sentido = sentido;
    this.unidad = unidad;
  }
}

class AlertaCalidad {
  constructor({ id, proyectoId, tipoMetrica, nivelSemaforo, mensaje, resuelta, activa = true, fechaDeteccion }) {
    this.id = id;
    this.proyectoId = proyectoId;
    this.tipoMetrica = tipoMetrica;
    this.nivelSemaforo = nivelSemaforo;
    this.mensaje = mensaje;
    this.resuelta = Boolean(resuelta);
    this.activa = Boolean(activa);
    this.fechaDeteccion = fechaDeteccion ? new Date(fechaDeteccion) : new Date();
  }
}

class DesgloseImpactoMetrica {
  constructor({
    tipoMetrica,
    valorMedido,
    valorMeta,
    nivelSemaforo,
    puntajeAportado,
    impacto,
    ordenPrioridad,
    justificacionImpacto
  }) {
    this.tipoMetrica = tipoMetrica;
    this.valorMedido = valorMedido;
    this.valorMeta = valorMeta;
    this.nivelSemaforo = nivelSemaforo;
    this.puntajeAportado = puntajeAportado;
    this.impacto = impacto;
    this.ordenPrioridad = ordenPrioridad;
    this.justificacionImpacto = justificacionImpacto;
  }
}

class ReporteSalud {
  constructor({
    id,
    proyectoId,
    versionReporte,
    nombreVersion,
    fechaGeneracion = new Date(),
    klocActual = null,
    actividadesPlaneadas = null,
    actividadesEjecutadas = null,
    estadoSalud,
    indiceSaludGeneral = null,
    notasEjecutivas = null,
    desglose = []
  }) {
    this.id = id;
    this.proyectoId = proyectoId;
    this.versionReporte = versionReporte;
    this.nombreVersion = nombreVersion || `Reporte de Salud #${versionReporte}`;
    this.fechaGeneracion = fechaGeneracion;
    this.klocActual = klocActual !== null ? Number(klocActual) : null;
    this.actividadesPlaneadas = actividadesPlaneadas !== null ? Number(actividadesPlaneadas) : null;
    this.actividadesEjecutadas = actividadesEjecutadas !== null ? Number(actividadesEjecutadas) : null;
    this.estadoSalud = estadoSalud;
    this.indiceSaludGeneral = indiceSaludGeneral !== null ? Number(indiceSaludGeneral) : null;
    this.definirNotasEjecutivas(notasEjecutivas);
    this.desglose = desglose;
  }

  definirNotasEjecutivas(notas) {
    if (notas && typeof notas === 'string') {
      this.notasEjecutivas = notas.trim();
    } else {
      this.notasEjecutivas = null;
    }
  }

  esEstadoSinDatos() {
    return this.estadoSalud === NivelSemaforo.SIN_DATOS || this.indiceSaludGeneral === null;
  }
}

module.exports = {
  NivelSemaforo,
  TipoMetrica,
  SentidoMetrica,
  ImpactoMetrica,
  TableroControl,
  MedicionMetrica,
  UmbralMetrica,
  AlertaCalidad,
  DesgloseImpactoMetrica,
  ReporteSalud
};
