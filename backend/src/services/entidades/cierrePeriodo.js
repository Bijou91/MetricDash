const { NivelSemaforo } = require('./proyecto');
const { MedicionMetrica } = require('./defecto');
const { TipoActividad } = require('./actividadSqa');

const OpcionResolucion = Object.freeze({ ARRASTRAR: 'ARRASTRAR', CANCELAR: 'CANCELAR', CERRAR: 'CERRAR' });

const TipoPendiente = Object.freeze({
  ACTIVIDAD_SQA: 'ACTIVIDAD_SQA',
  DEFECTO: 'DEFECTO',
  ACCION_CORRECTIVA: 'ACCION_CORRECTIVA',
  ALERTA_DETERIORO: 'ALERTA_DETERIORO',
});

const EstadoPeriodo = Object.freeze({ ABIERTO: 'ABIERTO', CERRADO: 'CERRADO' });

const OrigenDecision = Object.freeze({ RESOLUCION_PENDIENTE: 'RESOLUCION_PENDIENTE', RETROSPECTIVA: 'RETROSPECTIVA' });

// CU-07 v3: el desglose solo distingue impacto positivo, negativo o sin datos.
const ImpactoMetrica = Object.freeze({ POSITIVO: 'POSITIVO', NEGATIVO: 'NEGATIVO', SIN_DATOS: 'SIN_DATOS' });

// FN-03 (a)-(d): estado que toma el registro según su tipo y la opción elegida (valores del esquema).
const ESTADO_DESTINO = Object.freeze({
  [TipoPendiente.ACTIVIDAD_SQA]: { CERRAR: 'REALIZADA', CANCELAR: 'CANCELADA' },
  [TipoPendiente.DEFECTO]: { CERRAR: 'CERRADO', CANCELAR: 'DESCARTADO' },
  [TipoPendiente.ACCION_CORRECTIVA]: { CANCELAR: 'cancelada' },
  [TipoPendiente.ALERTA_DETERIORO]: { CANCELAR: 'DESCARTADA' },
});

class Pendiente {
  constructor({ tipo, registroId, descripcion, estadoActual, tipoActividad = null, evidencia = null }) {
    Object.assign(this, { tipo, registroId, descripcion, estadoActual, tipoActividad, evidencia });
  }

  // FN-03: CERRAR solo para defectos y para actividades de PRUEBAS/AUDITORIA con evidencia registrada.
  opcionesPermitidas() {
    const { ARRASTRAR, CANCELAR, CERRAR } = OpcionResolucion;
    const puedeCerrar = this.tipo === TipoPendiente.DEFECTO
      || (this.tipo === TipoPendiente.ACTIVIDAD_SQA
        && this.tipoActividad !== TipoActividad.REVISION_PARES
        && Boolean(this.evidencia));
    return puedeCerrar ? [ARRASTRAR, CANCELAR, CERRAR] : [ARRASTRAR, CANCELAR];
  }
}

class ResolucionPendiente {
  constructor({ id = null, tipo, registroId, descripcion = null, opcion, justificacion = null, periodoOrigenId }) {
    const just = typeof justificacion === 'string' ? justificacion.trim() : '';
    Object.assign(this, { id, tipo, registroId, descripcion, opcion, justificacion: just || null, periodoOrigenId });
  }

  requiereJustificacion() {
    return this.opcion === OpcionResolucion.CANCELAR || this.opcion === OpcionResolucion.CERRAR;
  }

  requiereEvidencia() {
    return this.tipo === TipoPendiente.ACTIVIDAD_SQA && this.opcion === OpcionResolucion.CERRAR;
  }

  esArrastre() {
    return this.opcion === OpcionResolucion.ARRASTRAR;
  }

  estadoDestino() {
    return ESTADO_DESTINO[this.tipo]?.[this.opcion] ?? null;
  }
}

const CAMPOS_RETROSPECTIVA = Object.freeze({
  queFuncionoBien: 'Qué funcionó bien',
  queDebeMejorar: 'Qué debe mejorar',
  leccionesAprendidas: 'Lecciones aprendidas',
  acuerdos: 'Acuerdos del equipo',
});

class Retrospectiva {
  constructor(datos = {}) {
    for (const campo of Object.keys(CAMPOS_RETROSPECTIVA)) {
      this[campo] = typeof datos?.[campo] === 'string' ? datos[campo].trim() : '';
    }
  }

  camposFaltantes() {
    return Object.keys(CAMPOS_RETROSPECTIVA).filter((c) => !this[c]);
  }

  estaCompleta() {
    return this.camposFaltantes().length === 0;
  }

  // FN-07: la retrospectiva va como notas ejecutivas del reporte final.
  comoNotasEjecutivas() {
    return Object.entries(CAMPOS_RETROSPECTIVA).map(([c, titulo]) => `${titulo}:\n${this[c]}`).join('\n\n');
  }
}

class MetricaCongelada {
  constructor({ tipoMetrica, valorFinal = null, estadoSemaforo = NivelSemaforo.SIN_DATOS, medicionOrigenId = null }) {
    Object.assign(this, { tipoMetrica, valorFinal, estadoSemaforo, medicionOrigenId });
    Object.freeze(this); // valor final de solo lectura
  }

  comoMedicion() {
    return new MedicionMetrica({
      tipoMetrica: this.tipoMetrica,
      valorCalculado: this.valorFinal,
      estadoSemaforo: this.estadoSemaforo,
    });
  }
}

module.exports = {
  OpcionResolucion,
  TipoPendiente,
  EstadoPeriodo,
  OrigenDecision,
  ImpactoMetrica,
  CAMPOS_RETROSPECTIVA,
  Pendiente,
  ResolucionPendiente,
  Retrospectiva,
  MetricaCongelada,
};
