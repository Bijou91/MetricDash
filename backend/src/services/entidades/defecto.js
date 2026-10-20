const { NivelSemaforo } = require('./proyecto');

const SeveridadDefecto = Object.freeze({ BAJA: 'BAJA', MEDIA: 'MEDIA', ALTA: 'ALTA', CRITICA: 'CRITICA' });

const PrioridadDefecto = Object.freeze({ BAJA: 'BAJA', MEDIA: 'MEDIA', ALTA: 'ALTA', INMEDIATA: 'INMEDIATA' });

const EstadoDefecto = Object.freeze({
  REGISTRADO: 'REGISTRADO',
  ASIGNADO: 'ASIGNADO',
  EN_RESOLUCION: 'EN_RESOLUCION',
  CERRADO: 'CERRADO',
  DESCARTADO: 'DESCARTADO',
});

class Defecto {
  constructor({ id, folio, fechaRegistro, severidad, prioridad, faseDeteccion, faseOrigen,
    descripcionDetallada, estado = EstadoDefecto.REGISTRADO, confirmadoNoDuplicado = false,
    reportadoPorId, asignadoAId = null }) {
    Object.assign(this, { id, folio, fechaRegistro, severidad, prioridad, faseDeteccion, faseOrigen,
      descripcionDetallada, estado, confirmadoNoDuplicado, reportadoPorId, asignadoAId });
  }

  esCritico() {
    return this.severidad === SeveridadDefecto.CRITICA;
  }

  asignarResponsable(miembro) {
    this.asignadoAId = miembro.id;
    this.estado = EstadoDefecto.ASIGNADO;
  }
}

class MedicionMetrica {
  constructor({ tipoMetrica, valorCalculado = null, fechaMedicion = new Date(), estadoSemaforo = NivelSemaforo.SIN_DATOS }) {
    Object.assign(this, { tipoMetrica, valorCalculado, fechaMedicion, estadoSemaforo });
  }

  // Densidad = defectos / KLOC, redondeada a 2 decimales para mostrarla en el tablero.
  calcularDensidad(totalDefectos, tamanoKLOC) {
    this.valorCalculado = Math.round((totalDefectos / tamanoKLOC) * 100) / 100;
    return this.valorCalculado;
  }
}

class AlertaCalidad {
  constructor({ porDefectoCritico, porUmbralExcedido, nivelSemaforo, mensajeAlerta }) {
    Object.assign(this, { fechaEmision: new Date(), porDefectoCritico, porUmbralExcedido, nivelSemaforo, mensajeAlerta });
  }
}

module.exports = { SeveridadDefecto, PrioridadDefecto, EstadoDefecto, Defecto, MedicionMetrica, AlertaCalidad };
