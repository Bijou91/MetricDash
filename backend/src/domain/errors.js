class ErrorPersistencia extends Error {
  constructor(mensaje, operacionFallida = 'OPERACION_SQL', causa = null) {
    super(mensaje);
    this.name = 'ErrorPersistencia';
    this.codigoError = 'ERR_PERSISTENCIA_DB';
    this.operacionFallida = operacionFallida;
    this.mensajeTecnico = causa ? causa.message : mensaje;
  }
}

class ErrorGeneracionPDF extends Error {
  constructor(mensaje, detalleCompilacion = null) {
    super(mensaje);
    this.name = 'ErrorGeneracionPDF';
    this.codigoError = 'ERR_GENERACION_PDF';
    this.detalleCompilacion = detalleCompilacion || mensaje;
  }
}

module.exports = {
  ErrorPersistencia,
  ErrorGeneracionPDF
};
