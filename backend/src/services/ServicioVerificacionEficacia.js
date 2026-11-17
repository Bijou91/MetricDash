const configRepo = require('../data/ConfiguracionMetricasRepository');
const alertaRepo = require('../data/AlertaDeterioroRepository');
const accionRepo = require('../data/AccionCorrectivaRepository');
const evaluarMetricas = require('./ServicioEvaluarMetricas');
const { SentidoMetrica } = require('./entidades/metricas');
const { NivelSemaforo } = require('./entidades/proyecto');

// FN-07, FN-08, FN-09 y FA-07.01:
// Al registrarse la siguiente medición (Vn+1), verifica la eficacia de la acción abierta
async function verificarEficacia(nuevaMedicion, accionAbierta, tx) {
  const { proyectoId, tipoMetrica } = accionAbierta;
  const valorActual = Number(nuevaMedicion.valorCalculado ?? nuevaMedicion.valor);

  // 1. Obtener la alerta vinculada para conocer Vα (valor inicial que originó la alerta)
  let alerta = null;
  if (accionAbierta.alertaId) {
    alerta = await alertaRepo.obtenerPorId(accionAbierta.alertaId, tx);
  }
  if (!alerta) {
    alerta = await alertaRepo.obtenerAlertaActivaPorMetrica(proyectoId, tipoMetrica, tx);
  }

  const valorBase = alerta ? Number(alerta.valorInicial) : Number(accionAbierta.valorInicial ?? valorActual);

  // 2. Umbral vigente
  const umbral = await configRepo.obtenerUmbralVigente(proyectoId, tipoMetrica);
  if (!umbral) {
    throw new Error('No hay umbrales vigentes configurados para verificar la eficacia.');
  }

  const estadoActual = evaluarMetricas.determinarEstadoSemaforo(valorActual, umbral);

  // 3. Criterio de eficacia (FN-08):
  // Condición (a): Vn+1 es mejor que Vα según SentidoMetrica
  const esMejorSegunSentido = umbral.sentido === SentidoMetrica.MAYOR_ES_MEJOR
    ? valorActual > valorBase
    : valorActual < valorBase;

  // Condición (b): el estado de semáforo de Vn+1 no es ROJO (crítico)
  const noEsCritico = estadoActual !== NivelSemaforo.ROJO_CRITICO && estadoActual !== 'ROJO';

  const esEficaz = esMejorSegunSentido && noEsCritico;

  if (esEficaz) {
    // FN-08 y FN-09: Acción EFICAZ -> Cierre de acción y registro de resultado
    const accionActualizada = await accionRepo.actualizar(
      accionAbierta.id,
      {
        estado: 'cerrada',
        esEficaz: true,
      },
      tx,
    );

    const notaEficaz = `Acción eficaz: el valor mejoró de ${valorBase} a ${valorActual} (${umbral.unidad}) y el estado de semáforo es ${estadoActual}.`;
    await accionRepo.registrarVerificacion(
      {
        accionId: accionAbierta.id,
        valorMedido: valorActual,
        valorBase,
        esEficaz: true,
        notes: notaEficaz,
      },
      tx,
    );

    if (alerta) {
      await alertaRepo.actualizar(
        alerta.id,
        {
          estado: 'RESUELTA',
          valorActual,
          nivelSemaforo: estadoActual,
        },
        tx,
      );
    }

    return {
      eficaz: true,
      accionCerrada: true,
      accion: accionActualizada,
      alertaId: alerta?.id,
      valorBase,
      valorActual,
      estadoSemaforo: estadoActual,
      mensaje: 'La acción correctiva demostró eficacia y ha sido cerrada exitosamente.',
    };
  }

  // FA-07.01: Acción NO EFICAZ -> Mantener abierta, registrar resultado y solicitar replanteamiento
  const accionActualizada = await accionRepo.actualizar(
    accionAbierta.id,
    {
      estado: 'abierta',
      esEficaz: false,
    },
    tx,
  );

  const razonesFallo = [];
  if (!esMejorSegunSentido) {
    razonesFallo.push(`el valor actual (${valorActual}) no superó el valor base inicial (${valorBase})`);
  }
  if (!noEsCritico) {
    razonesFallo.push('el semáforo permanece en estado crítico (ROJO)');
  }
  const notaNoEficaz = `Acción no eficaz: ${razonesFallo.join(' y ')}. Se requiere replantear la acción correctiva.`;

  await accionRepo.registrarVerificacion(
    {
      accionId: accionAbierta.id,
      valorMedido: valorActual,
      valorBase,
      esEficaz: false,
      notes: notaNoEficaz,
    },
    tx,
  );

  if (alerta) {
    const nuevaTendencia = [
      ...(alerta.tendencia || []),
      {
        valor: valorActual,
        estadoSemaforo: estadoActual,
        fecha: new Date(),
        nombreCorte: nuevaMedicion.nombreCorte || 'Verificación eficacia',
      },
    ].slice(-3);

    await alertaRepo.actualizar(
      alerta.id,
      {
        tendencia: nuevaTendencia,
        valorActual,
        nivelSemaforo: estadoActual,
      },
      tx,
    );
  }

  return {
    eficaz: false,
    requiereReplantear: true,
    accion: accionActualizada,
    alertaId: alerta?.id,
    valorBase,
    valorActual,
    estadoSemaforo: estadoActual,
    mensaje: `La acción correctiva no fue eficaz (${razonesFallo.join(' y ')}). Se solicita al usuario replantear la acción.`,
  };
}

module.exports = {
  verificarEficacia,
};

