const {
  TipoMetrica,
  NivelSemaforo,
  ImpactoMetrica,
  DesgloseImpactoMetrica
} = require('../domain/models');

class CalculadorIndiceSalud {
  constructor() {
    this.PESO_EQUITATIVO_METRICA = 25.0; // 4 métricas = 25% cada una (100% total)
    this.PUNTAJE_VERDE = 100.0;
    this.PUNTAJE_AMARILLO = 50.0;
    this.PUNTAJE_ROJO = 0.0;

    this.METRICAS_REQUERIDAS = [
      TipoMetrica.DENSIDAD_DEFECTOS,
      TipoMetrica.COBERTURA_PRUEBAS,
      TipoMetrica.TASA_EXITO_PRUEBAS,
      TipoMetrica.CUMPLIMIENTO_SQA
    ];
  }

  verificarMedicionesCompletas(mediciones = []) {
    if (!mediciones || mediciones.length < 4) {
      return false;
    }
    const tiposPresentes = new Set(mediciones.map(m => m.tipoMetrica));
    return this.METRICAS_REQUERIDAS.every(tipo => tiposPresentes.has(tipo));
  }

  asignarPuntajeSemaforo(nivel) {
    switch (nivel) {
      case NivelSemaforo.VERDE_OPTIMO:
        return this.PUNTAJE_VERDE;
      case NivelSemaforo.AMARILLO_ADVERTENCIA:
        return this.PUNTAJE_AMARILLO;
      case NivelSemaforo.ROJO_CRITICO:
        return this.PUNTAJE_ROJO;
      default:
        return null;
    }
  }

  calcularIndiceSaludDeterminista(mediciones = []) {
    if (!this.verificarMedicionesCompletas(mediciones)) {
      return null;
    }

    const mapaMediciones = new Map();
    mediciones.forEach(m => mapaMediciones.set(m.tipoMetrica, m));

    let sumaPonderada = 0;
    for (const tipo of this.METRICAS_REQUERIDAS) {
      const med = mapaMediciones.get(tipo);
      const puntaje = this.asignarPuntajeSemaforo(med.nivelSemaforo);
      if (puntaje === null) {
        return null; // Si alguna está en SIN_DATOS
      }
      // Cada métrica aporta el 25% (puntaje * 0.25)
      sumaPonderada += (puntaje * (this.PESO_EQUITATIVO_METRICA / 100.0));
    }

    return Number(sumaPonderada.toFixed(2));
  }

  determinarEstadoSaludGlobal(mediciones = []) {
    if (!this.verificarMedicionesCompletas(mediciones)) {
      return NivelSemaforo.SIN_DATOS;
    }

    const indice = this.calcularIndiceSaludDeterminista(mediciones);
    if (indice === null) {
      return NivelSemaforo.SIN_DATOS;
    }

    if (indice >= 80.0) {
      return NivelSemaforo.VERDE_OPTIMO;
    } else if (indice >= 50.0) {
      return NivelSemaforo.AMARILLO_ADVERTENCIA;
    } else {
      return NivelSemaforo.ROJO_CRITICO;
    }
  }

  generarDesgloseImpacto(mediciones = [], umbrales = []) {
    const mapaUmbrales = new Map();
    umbrales.forEach(u => mapaUmbrales.set(u.tipoMetrica, u));

    const desgloses = [];

    for (const med of mediciones) {
      const umbral = mapaUmbrales.get(med.tipoMetrica);
      const puntaje = this.asignarPuntajeSemaforo(med.nivelSemaforo);

      let impacto = ImpactoMetrica.SIN_DATOS;
      let justificacion = '';
      let ordenPrioridad = 4;

      if (med.nivelSemaforo === NivelSemaforo.ROJO_CRITICO) {
        impacto = ImpactoMetrica.NEGATIVO;
        ordenPrioridad = 1; // Máxima atención requerida
        justificacion = `Estado crítico: Valor de ${med.valorCalculado} ${umbral ? umbral.unidad : ''} no cumple el umbral aceptable (Meta: ${umbral ? umbral.valorMeta : 'N/A'}).`;
      } else if (med.nivelSemaforo === NivelSemaforo.AMARILLO_ADVERTENCIA) {
        impacto = ImpactoMetrica.NEUTRO;
        ordenPrioridad = 2; // Atención preventiva
        justificacion = `Estado de advertencia: Valor de ${med.valorCalculado} ${umbral ? umbral.unidad : ''} en rango de riesgo respecto a la meta de ${umbral ? umbral.valorMeta : 'N/A'}.`;
      } else if (med.nivelSemaforo === NivelSemaforo.VERDE_OPTIMO) {
        impacto = ImpactoMetrica.POSITIVO;
        ordenPrioridad = 3; // Favorable
        justificacion = `Estado óptimo: Valor de ${med.valorCalculado} ${umbral ? umbral.unidad : ''} cumple satisfactoriamente la meta de calidad (${umbral ? umbral.valorMeta : 'N/A'}).`;
      } else {
        impacto = ImpactoMetrica.SIN_DATOS;
        ordenPrioridad = 5;
        justificacion = 'No se cuenta con mediciones vigentes registradas.';
      }

      desgloses.push(new DesgloseImpactoMetrica({
        tipoMetrica: med.tipoMetrica,
        valorMedido: med.valorCalculado,
        valorMeta: umbral ? umbral.valorMeta : null,
        nivelSemaforo: med.nivelSemaforo,
        puntajeAportado: puntaje !== null ? (puntaje * 0.25) : 0,
        impacto,
        ordenPrioridad,
        justificacionImpacto: justificacion
      }));
    }

    return this.ordenarDesglosePorEstado(desgloses);
  }

  ordenarDesglosePorEstado(desglose = []) {
    // Ordenar de mayor criticidad a menor: ROJO (1) -> AMARILLO (2) -> VERDE (3) -> SIN_DATOS (5)
    return [...desglose].sort((a, b) => a.ordenPrioridad - b.ordenPrioridad);
  }
}

module.exports = CalculadorIndiceSalud;
