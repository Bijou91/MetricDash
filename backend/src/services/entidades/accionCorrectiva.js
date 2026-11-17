const EstadoAccionCorrectiva = Object.freeze({
  ABIERTA: 'abierta',
  CERRADA: 'cerrada',
  CANCELADA: 'cancelada',
});

const EstadoAlertaDeterioro = Object.freeze({
  ACTIVA: 'ACTIVA',
  EN_PROCESO: 'EN_PROCESO',
  RESUELTA: 'RESUELTA',
  DESCARTADA: 'DESCARTADA',
});

class AccionCorrectiva {
  constructor({
    id = null,
    alertaId,
    proyectoId,
    tipoMetrica,
    descripcion,
    causaAtendida,
    responsableId,
    responsableNombre = null,
    fechaCompromiso,
    estado = EstadoAccionCorrectiva.ABIERTA,
    esEficaz = null,
    creadoEn = new Date(),
    actualizadoEn = new Date(),
  }) {
    Object.assign(this, {
      id,
      alertaId,
      proyectoId,
      tipoMetrica,
      descripcion: descripcion ? String(descripcion).trim() : '',
      causaAtendida: causaAtendida ? String(causaAtendida).trim() : '',
      responsableId,
      responsableNombre,
      fechaCompromiso,
      estado,
      esEficaz,
      creadoEn,
      actualizadoEn,
    });
  }

  estaAbierta() {
    return this.estado === EstadoAccionCorrectiva.ABIERTA;
  }

  cerrarComoEficaz() {
    this.estado = EstadoAccionCorrectiva.CERRADA;
    this.esEficaz = true;
    this.actualizadoEn = new Date();
  }

  marcarNoEficaz() {
    this.estado = EstadoAccionCorrectiva.ABIERTA;
    this.esEficaz = false;
    this.actualizadoEn = new Date();
  }
}

class AlertaDeterioro {
  constructor({
    id = null,
    proyectoId,
    tipoMetrica,
    corteId = null,
    valorInicial,
    valorAnterior = null,
    valorActual,
    nivelSemaforo,
    mensaje,
    tendencia = [],
    posiblesCausas = [],
    estado = EstadoAlertaDeterioro.ACTIVA,
    creadoEn = new Date(),
    actualizadoEn = new Date(),
  }) {
    Object.assign(this, {
      id,
      proyectoId,
      tipoMetrica,
      corteId,
      valorInicial: Number(valorInicial),
      valorAnterior: valorAnterior != null ? Number(valorAnterior) : null,
      valorActual: Number(valorActual),
      nivelSemaforo,
      mensaje,
      tendencia: Array.isArray(tendencia) ? tendencia : [],
      posiblesCausas: Array.isArray(posiblesCausas) ? posiblesCausas : [],
      estado,
      creadoEn,
      actualizadoEn,
    });
  }

  vincularAccion() {
    this.estado = EstadoAlertaDeterioro.EN_PROCESO;
    this.actualizadoEn = new Date();
  }

  resolver() {
    this.estado = EstadoAlertaDeterioro.RESUELTA;
    this.actualizadoEn = new Date();
  }
}

class HistorialVerificacion {
  constructor({
    id = null,
    accionId,
    valorMedido,
    valorBase,
    esEficaz,
    notas = null,
    fechaVerificacion = new Date(),
  }) {
    Object.assign(this, {
      id,
      accionId,
      valorMedido: Number(valorMedido),
      valorBase: Number(valorBase),
      esEficaz: Boolean(esEficaz),
      notas,
      fechaVerificacion,
    });
  }
}

module.exports = {
  EstadoAccionCorrectiva,
  EstadoAlertaDeterioro,
  AccionCorrectiva,
  AlertaDeterioro,
  HistorialVerificacion,
};

