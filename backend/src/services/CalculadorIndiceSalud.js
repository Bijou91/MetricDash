const {
  TipoMetrica,
  NivelSemaforo,
  SentidoMetrica,
  EstadoIndice,
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

  // Evalúa el semáforo de UNA métrica a partir de su valor y su umbral vigente (CU-02).
  // Los umbrales son inclusivos del lado "mejor": alcanzar la advertencia aún es verde.
  // Devuelve null si no hay valor o no hay umbral contra el cual evaluar.
  evaluarNivelSemaforo(valor, umbral) {
    if (valor === null || valor === undefined || !umbral) return null;
    const v = Number(valor);
    if (!Number.isFinite(v)) return null;
    const mejorOIgual = (a, b) => (umbral.sentido === SentidoMetrica.MENOR_ES_MEJOR ? a <= b : a >= b);
    if (mejorOIgual(v, umbral.umbralAdvertencia)) return NivelSemaforo.VERDE_OPTIMO;
    if (mejorOIgual(v, umbral.umbralCritico)) return NivelSemaforo.AMARILLO_ADVERTENCIA;
    return NivelSemaforo.ROJO_CRITICO;
  }

  // Cuántas de las 4 métricas tienen una medición utilizable (valor y semáforo válidos).
  contarMetricasConDatos(mediciones = []) {
    const mapa = new Map((mediciones || []).map(m => [m.tipoMetrica, m]));
    return this.METRICAS_REQUERIDAS.filter(tipo => {
      const med = mapa.get(tipo);
      return Boolean(med) && med.valorCalculado !== null && this.asignarPuntajeSemaforo(med.nivelSemaforo) !== null;
    }).length;
  }

  verificarMedicionesCompletas(mediciones = []) {
    return this.contarMetricasConDatos(mediciones) === this.METRICAS_REQUERIDAS.length;
  }

  // FA-04.01: "Sin datos" si ninguna métrica tiene mediciones, "Insuficiente" si solo algunas las tienen.
  determinarEstadoIndice(mediciones = []) {
    const conDatos = this.contarMetricasConDatos(mediciones);
    if (conDatos === 0) return EstadoIndice.SIN_DATOS;
    if (conDatos < this.METRICAS_REQUERIDAS.length) return EstadoIndice.INSUFICIENTE;
    return EstadoIndice.CALCULADO;
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

  // El desglose siempre incluye las 4 métricas: la que no tiene medición aparece como SIN_DATOS.
  generarDesgloseImpacto(mediciones = [], umbrales = []) {
    const mapaUmbrales = new Map();
    umbrales.forEach(u => mapaUmbrales.set(u.tipoMetrica, u));
    const mapaMediciones = new Map();
    (mediciones || []).forEach(m => mapaMediciones.set(m.tipoMetrica, m));

    const desgloses = [];

    for (const tipo of this.METRICAS_REQUERIDAS) {
      const med = mapaMediciones.get(tipo);
      const umbral = mapaUmbrales.get(tipo);
      const unidad = umbral ? umbral.unidad : '';
      const meta = umbral ? umbral.valorMeta : 'N/A';
      const puntaje = med ? this.asignarPuntajeSemaforo(med.nivelSemaforo) : null;
      const tieneDato = Boolean(med) && med.valorCalculado !== null && puntaje !== null;

      let impacto = ImpactoMetrica.SIN_DATOS;
      let justificacion = '';
      let ordenPrioridad = 5;
      let nivel = NivelSemaforo.SIN_DATOS;

      if (!tieneDato) {
        justificacion = 'No se cuenta con mediciones vigentes registradas.';
      } else if (med.nivelSemaforo === NivelSemaforo.ROJO_CRITICO) {
        nivel = med.nivelSemaforo;
        impacto = ImpactoMetrica.NEGATIVO;
        ordenPrioridad = 1; // Máxima atención requerida
        justificacion = `Estado crítico: valor de ${med.valorCalculado} ${unidad} no cumple el umbral aceptable (meta: ${meta}).`;
      } else if (med.nivelSemaforo === NivelSemaforo.AMARILLO_ADVERTENCIA) {
        nivel = med.nivelSemaforo;
        impacto = ImpactoMetrica.NEUTRO;
        ordenPrioridad = 2; // Atención preventiva
        justificacion = `Estado de advertencia: valor de ${med.valorCalculado} ${unidad} en rango de riesgo respecto a la meta de ${meta}.`;
      } else {
        nivel = med.nivelSemaforo;
        impacto = ImpactoMetrica.POSITIVO;
        ordenPrioridad = 3; // Favorable
        justificacion = `Estado óptimo: valor de ${med.valorCalculado} ${unidad} cumple satisfactoriamente la meta de calidad (${meta}).`;
      }

      desgloses.push(new DesgloseImpactoMetrica({
        tipoMetrica: tipo,
        valorMedido: tieneDato ? med.valorCalculado : null,
        valorMeta: umbral ? umbral.valorMeta : null,
        nivelSemaforo: nivel,
        puntajeAportado: tieneDato ? (puntaje * (this.PESO_EQUITATIVO_METRICA / 100.0)) : 0,
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
