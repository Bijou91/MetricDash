const validador = require('./ValidadorRondaPruebas');
const calculoPruebas = require('./ServicioCalculoPruebas');
const evaluarMetricas = require('./ServicioEvaluarMetricas');
const pruebasRepo = require('../data/PruebasRepository');
const configRepo = require('../data/ConfiguracionMetricasRepository');
const proyectoRepo = require('../data/ProyectoRepository');
const tableroRepo = require('../data/TableroControlRepository');
const transacciones = require('../data/TransaccionManager');
const { RondaPruebas, CorteEvaluacion, resultadoRegistroPruebas } = require('./entidades/pruebas');
const { TipoMetrica, EstadoSemaforo } = require('./entidades/metricas');
const { ErrorValidacion, NivelSemaforo } = require('./entidades/proyecto');

function aCorteDTO(fila) {
  return new CorteEvaluacion({
    id: fila.id,
    proyectoId: fila.project_id,
    numeroCorte: fila.cutoff_number,
    nombreCorte: fila.cutoff_name,
    fechaCorte: fila.cutoff_date,
    kloc: Number(fila.kloc),
    estadoSalud: fila.health_status || NivelSemaforo.SIN_DATOS,
  });
}

// FA-06.01: Determina si alguna de las métricas evaluadas cayó en estado crítico (ROJO).
function requiereNotaExplicativa(estados = []) {
  const lista = Array.isArray(estados) ? estados : [estados];
  return lista.some((e) => e === NivelSemaforo.ROJO_CRITICO || e === EstadoSemaforo.ROJO);
}

// FN-01 / Precondiciones 2 y 3: verifica proyecto activo y carga cortes disponibles y umbrales vigentes.
async function cargarContexto(proyectoId) {
  const proyecto = await proyectoRepo.obtenerProyectoPeriodoActivo();
  if (!proyecto || proyecto.id !== proyectoId) {
    throw Object.assign(
      new Error('No hay un proyecto activo con ese identificador en el periodo en curso.'),
      { status: 404 },
    );
  }

  const [filasCortes, umbralCobertura, umbralTasaExito, umbralDensidad, rondasPrevias] = await Promise.all([
    proyectoRepo.listarCortes(proyectoId),
    configRepo.obtenerUmbralVigente(proyectoId, TipoMetrica.COBERTURA_PRUEBAS),
    configRepo.obtenerUmbralVigente(proyectoId, TipoMetrica.TASA_EXITO_PRUEBAS),
    configRepo.obtenerUmbralVigente(proyectoId, TipoMetrica.DENSIDAD_DEFECTOS),
    pruebasRepo.listarPorProyecto ? pruebasRepo.listarPorProyecto(proyectoId).catch(() => []) : Promise.resolve([]),
  ]);

  const cortesDisponibles = (filasCortes || []).map(aCorteDTO);
  // Buscar el último corte que ya tenga mediciones de pruebas, o en su defecto el corte inicial
  let medicionActual = null;
  let corteConMedicion = cortesDisponibles[0] || null;
  for (let i = cortesDisponibles.length - 1; i >= 0; i -= 1) {
    const m = await configRepo.obtenerMedicion(cortesDisponibles[i].id);
    if (m && (m.test_coverage_pct != null || m.test_pass_rate_pct != null || m.defect_density != null)) {
      medicionActual = m;
      corteConMedicion = cortesDisponibles[i];
      break;
    }
  }
  const corteActual = corteConMedicion;

  return {
    proyecto: {
      id: proyecto.id,
      nombre: proyecto.name,
      periodo: proyecto.period_code || proyecto.period_name || '',
    },
    corteActual,
    cortesDisponibles,
    umbralesConfigurados: Boolean(umbralCobertura && umbralTasaExito),
    umbrales: {
      coberturaPruebas: umbralCobertura && {
        meta: umbralCobertura.meta,
        umbralAdvertencia: umbralCobertura.umbralAdvertencia,
        umbralCritico: umbralCobertura.umbralCritico,
        unidad: umbralCobertura.unidad,
      },
      tasaExitoPruebas: umbralTasaExito && {
        meta: umbralTasaExito.meta,
        umbralAdvertencia: umbralTasaExito.umbralAdvertencia,
        umbralCritico: umbralTasaExito.umbralCritico,
        unidad: umbralTasaExito.unidad,
      },
      densidadDefectos: umbralDensidad && {
        meta: umbralDensidad.meta,
        umbralAdvertencia: umbralDensidad.umbralAdvertencia,
        umbralCritico: umbralDensidad.umbralCritico,
        unidad: umbralDensidad.unidad,
      },
    },
    ultimasMediciones: medicionActual && {
      coberturaPruebas: medicionActual.test_coverage_pct == null ? null : Number(medicionActual.test_coverage_pct),
      tasaExitoPruebas: medicionActual.test_pass_rate_pct == null ? null : Number(medicionActual.test_pass_rate_pct),
      densidadDefectos: medicionActual.defect_density == null ? null : Number(medicionActual.defect_density),
      estadoCobertura: (medicionActual.test_coverage_pct != null && umbralCobertura)
        ? evaluarMetricas.determinarEstadoSemaforo(Number(medicionActual.test_coverage_pct), umbralCobertura)
        : NivelSemaforo.SIN_DATOS,
      estadoTasaExito: (medicionActual.test_pass_rate_pct != null && umbralTasaExito)
        ? evaluarMetricas.determinarEstadoSemaforo(Number(medicionActual.test_pass_rate_pct), umbralTasaExito)
        : NivelSemaforo.SIN_DATOS,
      nivelSemaforoGlobal: evaluarMetricas.calcularNivelGlobal(
        (medicionActual.test_coverage_pct != null && umbralCobertura)
          ? evaluarMetricas.determinarEstadoSemaforo(Number(medicionActual.test_coverage_pct), umbralCobertura)
          : null,
        (medicionActual.test_pass_rate_pct != null && umbralTasaExito)
          ? evaluarMetricas.determinarEstadoSemaforo(Number(medicionActual.test_pass_rate_pct), umbralTasaExito)
          : null,
        (medicionActual.defect_density != null && umbralDensidad)
          ? evaluarMetricas.determinarEstadoSemaforo(Number(medicionActual.defect_density), umbralDensidad)
          : null,
      ),
    },
    rondas: rondasPrevias,
  };
}

// FN-03 a FN-07, FA-02.01, FA-03.01, FA-06.01 y FE-01.
async function registrar(proyectoId, dto = {}) {
  const proyecto = await proyectoRepo.obtenerProyectoPeriodoActivo();
  if (!proyecto || proyecto.id !== proyectoId) {
    throw Object.assign(
      new Error('No hay un proyecto activo con ese identificador en el periodo en curso.'),
      { status: 404 },
    );
  }

  // FN-03: Validación de completitud y consistencia numérica
  const validacion = validador.validar(dto);
  if (!validacion.esValido) {
    return {
      httpStatus: validacion.incompleto ? 400 : 422,
      resultado: resultadoRegistroPruebas({
        registroExitoso: false,
        camposFaltantes: validacion.camposFaltantes,
        errores: validacion.errores,
      }),
    };
  }

  // Precondición 3: umbrales vigentes de CU-02 para cobertura y tasa de éxito
  const [umbralCobertura, umbralTasaExito] = await Promise.all([
    configRepo.obtenerUmbralVigente(proyectoId, TipoMetrica.COBERTURA_PRUEBAS),
    configRepo.obtenerUmbralVigente(proyectoId, TipoMetrica.TASA_EXITO_PRUEBAS),
  ]);
  if (!umbralCobertura || !umbralTasaExito) {
    throw Object.assign(
      new Error('Primero configure las métricas de calidad y sus umbrales para poder registrar resultados de pruebas.'),
      { status: 409 },
    );
  }

  // Validar que el corte seleccionado pertenezca al proyecto (D3)
  const cortes = await proyectoRepo.listarCortes(proyectoId);
  const corteSeleccionado = (cortes || []).find((c) => c.id === dto.corteId);
  if (!corteSeleccionado) {
    const errorCorte = new ErrorValidacion('corteId', 'El corte seleccionado no pertenece al proyecto activo.');
    return {
      httpStatus: 422,
      resultado: resultadoRegistroPruebas({
        registroExitoso: false,
        errores: [errorCorte],
      }),
    };
  }

  // FN-04: Cálculo automático de cobertura y tasa de éxito
  const ronda = new RondaPruebas({
    corteId: corteSeleccionado.id,
    version: dto.version || corteSeleccionado.cutoff_name || `Corte ${corteSeleccionado.cutoff_number}`,
    pruebasPlaneadas: dto.pruebasPlaneadas,
    pruebasEjecutadas: dto.pruebasEjecutadas,
    pruebasExitosas: dto.pruebasExitosas,
    pruebasFallidas: dto.pruebasFallidas,
    notaExplicativa: dto.notaExplicativa,
  });

  const coberturaValor = ronda.calcularCobertura();
  const tasaExitoValor = ronda.calcularTasaExito();
  const mediciones = calculoPruebas.generarMediciones(ronda, corteSeleccionado.id);

  // FN-05: Evaluación contra los umbrales vigentes del CU-02
  const estadoCobertura = evaluarMetricas.determinarEstadoSemaforo(coberturaValor, umbralCobertura);
  const estadoTasaExito = evaluarMetricas.determinarEstadoSemaforo(tasaExitoValor, umbralTasaExito);
  const nivelSemaforoPruebas = evaluarMetricas.calcularNivelGlobal(estadoCobertura, estadoTasaExito);

  const umbralesPorTipo = {
    [TipoMetrica.COBERTURA_PRUEBAS]: umbralCobertura,
    [TipoMetrica.TASA_EXITO_PRUEBAS]: umbralTasaExito,
  };
  const alertasEmitidas = mediciones
    .map((m) => evaluarMetricas.evaluarMedicion(m, umbralesPorTipo[m.tipoMetrica]))
    .filter(Boolean);
  const alertaPrincipal = alertasEmitidas.find((a) => a.nivelSemaforo === NivelSemaforo.ROJO_CRITICO)
    || alertasEmitidas[0]
    || null;

  // FA-06.01: Alerta por estado crítico (ROJO) y nota explicativa obligatoria
  const necesitaNota = requiereNotaExplicativa([estadoCobertura, estadoTasaExito]);
  const errorNota = validador.validarNotaExplicativaObligatoria(dto, nivelSemaforoPruebas);
  if (necesitaNota && errorNota) {
    return {
      httpStatus: 200,
      resultado: resultadoRegistroPruebas({
        registroExitoso: false,
        requiereNota: true,
        coberturaPruebas: coberturaValor,
        tasaExitoPruebas: tasaExitoValor,
        estadoCobertura,
        estadoTasaExito,
        nivelSemaforoGlobal: nivelSemaforoPruebas,
        camposFaltantes: ['notaExplicativa'],
        errores: [errorNota],
        alertaEmitida: alertaPrincipal,
        alertasEmitidas,
      }),
    };
  }

  // D4-A: si ya existe densidad de defectos o cumplimiento SQA medido en el corte, considerar su estado para no degradar/sobrescribir un ROJO previo en el tablero.
  let estadoDensidadExistente = null;
  let estadoCumplimientoExistente = null;
  if (typeof configRepo.obtenerMedicion === 'function') {
    const medicionPrevia = await configRepo.obtenerMedicion(corteSeleccionado.id);
    if (medicionPrevia && medicionPrevia.defect_density != null) {
      const umbralDensidad = await configRepo.obtenerUmbralVigente(proyectoId, TipoMetrica.DENSIDAD_DEFECTOS);
      if (umbralDensidad) {
        estadoDensidadExistente = evaluarMetricas.determinarEstadoSemaforo(
          Number(medicionPrevia.defect_density),
          umbralDensidad,
        );
      }
    }
    if (medicionPrevia && medicionPrevia.sqa_compliance_pct != null) {
      const umbralCumplimiento = await configRepo.obtenerUmbralVigente(proyectoId, TipoMetrica.CUMPLIMIENTO_SQA);
      if (umbralCumplimiento) {
        estadoCumplimientoExistente = evaluarMetricas.determinarEstadoSemaforo(
          Number(medicionPrevia.sqa_compliance_pct),
          umbralCumplimiento,
        );
      }
    }
  }

  const nivelSemaforoTablero = evaluarMetricas.calcularNivelGlobal(
    estadoCobertura,
    estadoTasaExito,
    estadoDensidadExistente,
    estadoCumplimientoExistente,
  );

  // Actualizar estadoSemaforo que se persistirá en quality_metrics.health_status
  for (const m of mediciones) {
    m.estadoSemaforo = nivelSemaforoTablero;
  }

  // FN-06: Preparación del tablero y guardado atómico en transacción
  const tablero = await tableroRepo.obtenerPorProyecto(proyectoId);
  tablero.healthStatus = nivelSemaforoTablero;
  tablero.actualizarIndicadores(mediciones);
  if (alertasEmitidas.length) {
    tablero.reflejarAlerta(alertasEmitidas);
  }

  const ejecutarTx = transacciones.ejecutarEnTransaccion || transacciones.ejecutar;
  const rondaGuardada = await ejecutarTx(async (tx) => {
    const r = await pruebasRepo.guardar(ronda, tx);
    for (const medicion of mediciones) {
      await configRepo.guardarMedicion(corteSeleccionado.id, medicion, tx);
    }
    await tableroRepo.guardar(tablero, tx);
    return r;
  });

  // Restaurar estados individuales en las mediciones tras persistir
  mediciones[0].estadoSemaforo = estadoCobertura;
  mediciones[1].estadoSemaforo = estadoTasaExito;

  // FN-07: Confirmación del registro y tablero actualizado
  return {
    httpStatus: 201,
    resultado: resultadoRegistroPruebas({
      registroExitoso: true,
      requiereNota: false,
      coberturaPruebas: coberturaValor,
      tasaExitoPruebas: tasaExitoValor,
      estadoCobertura,
      estadoTasaExito,
      nivelSemaforoGlobal: nivelSemaforoTablero,
      rondaRegistrada: {
        ...rondaGuardada,
        coberturaPruebas: coberturaValor,
        tasaExitoPruebas: tasaExitoValor,
      },
      alertaEmitida: alertaPrincipal,
      alertasEmitidas,
    }),
  };
}

module.exports = {
  cargarContexto,
  requiereNotaExplicativa,
  registrar,
};

