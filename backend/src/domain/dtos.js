const { NivelSemaforo, ImpactoMetrica } = require('../domain/models');

class SolicitudReporteSaludDTO {
  constructor(proyectoId, notasEjecutivas) {
    this.proyectoId = proyectoId;
    this.notasEjecutivas_nullable = notasEjecutivas;
  }

  tieneNotasEjecutivas() {
    return Boolean(this.notasEjecutivas_nullable && this.notasEjecutivas_nullable.trim().length > 0);
  }

  normalizarNotasEjecutivas() {
    return this.tieneNotasEjecutivas() ? this.notasEjecutivas_nullable.trim() : null;
  }
}

class IndicadorMetricaDTO {
  constructor({ tipoMetrica, valorActual, unidad, nivelSemaforo, meta, advertencia, critico, sentido, fechaMedicion }) {
    this.tipoMetrica = tipoMetrica;
    this.valorActual = valorActual;
    this.unidad = unidad;
    this.nivelSemaforo = nivelSemaforo;
    this.meta = meta;
    this.advertencia = advertencia;
    this.critico = critico;
    this.sentido = sentido;
    this.fechaMedicion = fechaMedicion;
  }
}

class AlertaResumenDTO {
  constructor({ id, tipoMetrica, nivelSemaforo, mensaje, fechaDeteccion }) {
    this.id = id;
    this.tipoMetrica = tipoMetrica;
    this.nivelSemaforo = nivelSemaforo;
    this.mensaje = mensaje;
    this.fechaDeteccion = fechaDeteccion;
  }
}

class TableroSaludDTO {
  constructor({
    proyectoId,
    nombreProyecto,
    versionUmbrales,
    estadoSaludGlobal,
    estadoIndice,
    indiceSaludGeneral_nullable,
    indicadores = [],
    alertasActivas = []
  }) {
    this.proyectoId = proyectoId;
    this.nombreProyecto = nombreProyecto;
    this.versionUmbrales = versionUmbrales;
    this.estadoSaludGlobal = estadoSaludGlobal;
    this.estadoIndice = estadoIndice; // 'CALCULADO' | 'INSUFICIENTE' | 'SIN_DATOS'
    this.indiceSaludGeneral_nullable = indiceSaludGeneral_nullable;
    this.indicadores = indicadores;
    this.alertasActivas = alertasActivas;
    this.fechaConsulta = new Date().toISOString();
  }
}

class PrevisualizacionReporteDTO {
  constructor({
    proyectoId,
    versionReporteSiguiente,
    estadoSaludGlobal,
    estadoIndice,
    indiceSaludGeneral_nullable,
    medicionesCompletas,
    desgloseImpacto = [],
    habilitarEspacioNotas = true
  }) {
    this.proyectoId = proyectoId;
    this.versionReporteSiguiente = versionReporteSiguiente;
    this.estadoSaludGlobal = estadoSaludGlobal;
    this.estadoIndice = estadoIndice; // 'CALCULADO' | 'INSUFICIENTE' | 'SIN_DATOS'
    this.indiceSaludGeneral_nullable = indiceSaludGeneral_nullable;
    this.medicionesCompletas = medicionesCompletas;
    this.desgloseImpacto = desgloseImpacto;
    this.habilitarEspacioNotas = habilitarEspacioNotas;
  }
}

class ArchivoPDFDTO {
  constructor({ nombreArchivo, mimeType = 'application/pdf', contenidoBytes, tamanoBytes, base64 = null }) {
    this.nombreArchivo = nombreArchivo;
    this.mimeType = mimeType;
    this.contenidoBytes = contenidoBytes;
    this.tamanoBytes = tamanoBytes;
    this.base64 = base64;
  }
}

class ResultadoReporteSaludDTO {
  constructor({ exito, reporteRegistrado, archivoPDF, mensaje, urlDescargaPDF = null }) {
    this.exito = exito;
    this.reporteRegistrado = reporteRegistrado;
    this.archivoPDF = archivoPDF;
    this.mensaje = mensaje;
    this.urlDescargaPDF = urlDescargaPDF;
  }
}

module.exports = {
  SolicitudReporteSaludDTO,
  IndicadorMetricaDTO,
  AlertaResumenDTO,
  TableroSaludDTO,
  PrevisualizacionReporteDTO,
  ArchivoPDFDTO,
  ResultadoReporteSaludDTO
};
