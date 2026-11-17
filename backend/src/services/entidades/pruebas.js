const { NivelSemaforo } = require('./proyecto');

class RondaPruebas {
  constructor({
    id = null,
    corteId,
    version = '',
    pruebasPlaneadas,
    pruebasEjecutadas,
    pruebasExitosas,
    pruebasFallidas,
    notaExplicativa = null,
    registradoEn = new Date(),
  }) {
    Object.assign(this, {
      id,
      corteId,
      version,
      pruebasPlaneadas: Number(pruebasPlaneadas),
      pruebasEjecutadas: Number(pruebasEjecutadas),
      pruebasExitosas: Number(pruebasExitosas),
      pruebasFallidas: Number(pruebasFallidas),
      notaExplicativa: notaExplicativa ? String(notaExplicativa).trim() : null,
      registradoEn,
    });
  }

  // FN-04: Cobertura = (ejecutadas / planeadas) * 100 redondeado a 2 decimales
  calcularCobertura() {
    if (!this.pruebasPlaneadas || this.pruebasPlaneadas <= 0) return 0;
    return Math.round((this.pruebasEjecutadas / this.pruebasPlaneadas) * 10000) / 100;
  }

  // FN-04: Tasa de éxito = (exitosas / ejecutadas) * 100 redondeado a 2 decimales
  calcularTasaExito() {
    if (!this.pruebasEjecutadas || this.pruebasEjecutadas <= 0) return 0;
    return Math.round((this.pruebasExitosas / this.pruebasEjecutadas) * 10000) / 100;
  }
}

class TableroControl {
  constructor({
    proyectoId,
    healthStatus = NivelSemaforo.SIN_DATOS,
    ultimaAlerta = null,
    ultimaActualizacion = new Date(),
  }) {
    Object.assign(this, {
      proyectoId,
      healthStatus,
      ultimaAlerta,
      ultimaActualizacion,
      indicadores: [],
      alertas: [],
    });
  }

  actualizarIndicadores(mediciones = []) {
    this.indicadores = mediciones;
    this.ultimaActualizacion = new Date();
  }

  reflejarAlerta(alerta) {
    if (!alerta) return;
    if (Array.isArray(alerta)) {
      const validas = alerta.filter(Boolean);
      this.alertas.push(...validas);
      if (validas.length) {
        this.ultimaAlerta = validas.map((a) => a.mensajeAlerta).join(' | ');
      }
    } else {
      this.alertas.push(alerta);
      this.ultimaAlerta = alerta.mensajeAlerta;
    }
    this.ultimaActualizacion = new Date();
  }
}

class CorteEvaluacion {
  constructor({ id, proyectoId, numeroCorte, nombreCorte, fechaCorte, kloc, estadoSalud = NivelSemaforo.SIN_DATOS }) {
    Object.assign(this, { id, proyectoId, numeroCorte, nombreCorte, fechaCorte, kloc, estadoSalud });
  }
}

const resultadoRegistroPruebas = (campos = {}) => ({
  registroExitoso: false,
  coberturaPruebas: null,
  tasaExitoPruebas: null,
  estadoCobertura: null,
  estadoTasaExito: null,
  nivelSemaforoGlobal: null,
  requiereNota: false,
  camposFaltantes: [],
  errores: [],
  rondaRegistrada: null,
  alertaEmitida: null,
  alertasEmitidas: [],
  ...campos,
});

module.exports = {
  RondaPruebas,
  TableroControl,
  CorteEvaluacion,
  resultadoRegistroPruebas,
};

