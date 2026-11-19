// Portado del CU-07 (rama implCU07) al estilo de main. Reglas: VERDE=100, AMARILLO=50, ROJO=0; 25% por métrica.
const { NivelSemaforo } = require('./entidades/proyecto');
const { TipoMetrica } = require('./entidades/metricas');
const { ImpactoMetrica } = require('./entidades/cierrePeriodo');

const PUNTAJE = Object.freeze({
  [NivelSemaforo.VERDE_OPTIMO]: 100,
  [NivelSemaforo.AMARILLO_ADVERTENCIA]: 50,
  [NivelSemaforo.ROJO_CRITICO]: 0,
});

const ORDEN = Object.freeze({
  [NivelSemaforo.ROJO_CRITICO]: 1,
  [NivelSemaforo.AMARILLO_ADVERTENCIA]: 2,
  [NivelSemaforo.VERDE_OPTIMO]: 3,
});

const TIPOS = Object.values(TipoMetrica);

const conDatos = (mediciones) => mediciones.filter((m) => PUNTAJE[m.estadoSemaforo] !== undefined);

// Las 4 métricas presentes y ninguna en SIN_DATOS.
function verificarMedicionesCompletas(mediciones = []) {
  const tipos = new Set(conDatos(mediciones).map((m) => m.tipoMetrica));
  return TIPOS.every((t) => tipos.has(t));
}

function calcularIndiceSaludDeterminista(mediciones = []) {
  if (!verificarMedicionesCompletas(mediciones)) return null;
  const porTipo = new Map(mediciones.map((m) => [m.tipoMetrica, m]));
  const suma = TIPOS.reduce((acc, t) => acc + PUNTAJE[porTipo.get(t).estadoSemaforo], 0);
  return Math.round((suma / TIPOS.length) * 100) / 100;
}

function determinarEstadoSaludGlobal(mediciones = []) {
  const indice = calcularIndiceSaludDeterminista(mediciones);
  if (indice === null) return NivelSemaforo.SIN_DATOS;
  if (indice >= 80) return NivelSemaforo.VERDE_OPTIMO;
  if (indice >= 50) return NivelSemaforo.AMARILLO_ADVERTENCIA;
  return NivelSemaforo.ROJO_CRITICO;
}

// FA-04.01 (CU-07) / FA-07.01 (CU-08): "Sin datos" si ninguna tiene mediciones, "Insuficiente" si solo algunas.
function obtenerLeyendaIndice(mediciones = []) {
  if (verificarMedicionesCompletas(mediciones)) return null;
  return conDatos(mediciones).length === 0 ? 'Sin datos' : 'Insuficiente';
}

function generarDesgloseImpacto(mediciones = [], config) {
  const desglose = mediciones.map((m) => {
    const umbral = config?.metricas?.find((u) => u.tipo === m.tipoMetrica) ?? null;
    let impacto = ImpactoMetrica.SIN_DATOS;
    if (m.estadoSemaforo === NivelSemaforo.VERDE_OPTIMO) impacto = ImpactoMetrica.POSITIVO;
    else if (PUNTAJE[m.estadoSemaforo] !== undefined) impacto = ImpactoMetrica.NEGATIVO;
    return {
      tipoMetrica: m.tipoMetrica,
      valorMedido: m.valorCalculado ?? null,
      valorMeta: umbral?.meta ?? null,
      unidad: umbral?.unidad ?? '',
      nivelSemaforo: PUNTAJE[m.estadoSemaforo] !== undefined ? m.estadoSemaforo : NivelSemaforo.SIN_DATOS,
      impacto,
      ordenPrioridad: ORDEN[m.estadoSemaforo] ?? 4,
    };
  });
  return ordenarDesglosePorEstado(desglose);
}

// ROJO -> AMARILLO -> VERDE -> SIN_DATOS
function ordenarDesglosePorEstado(desglose = []) {
  return [...desglose].sort((a, b) => a.ordenPrioridad - b.ordenPrioridad);
}

module.exports = {
  verificarMedicionesCompletas,
  calcularIndiceSaludDeterminista,
  determinarEstadoSaludGlobal,
  obtenerLeyendaIndice,
  generarDesgloseImpacto,
  ordenarDesglosePorEstado,
};
