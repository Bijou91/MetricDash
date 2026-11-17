const configRepo = require('../data/ConfiguracionMetricasRepository');
const servicioEvaluar = require('./ServicioEvaluarMetricas');
const { AlertaCalidad } = require('./entidades/defecto');
const { NivelSemaforo } = require('./entidades/proyecto');

// FN-09 / FA-09.01 (CU-04): Evalúa una medición (ej. cumplimiento SQA o densidad) contra su umbral vigente de CU-02
// y, en caso de existir algún defecto registrado, verifica si es crítico.
async function evaluarMedicion(proyectoIdOrMedicion, medicionOrDefecto = null, defectoOpcional = null) {
  let proyectoId = null;
  let medicion = null;
  let defecto = null;

  if (typeof proyectoIdOrMedicion === 'string') {
    proyectoId = proyectoIdOrMedicion;
    medicion = medicionOrDefecto;
    defecto = defectoOpcional;
  } else {
    medicion = proyectoIdOrMedicion;
    defecto = medicionOrDefecto;
    proyectoId = medicion?.proyectoId || null;
  }

  if (!medicion) return null;

  let umbral = medicion.umbral || null;
  if (!umbral && proyectoId) {
    umbral = await configRepo.obtenerUmbralVigente(proyectoId, medicion.tipoMetrica);
  }

  let alertaUmbral = null;
  if (umbral) {
    alertaUmbral = servicioEvaluar.evaluarMedicion(medicion, umbral);
  }

  const listaDefectos = Array.isArray(defecto) ? defecto : (defecto ? [defecto] : []);
  const criticos = listaDefectos.filter((d) => d && typeof d.esCritico === 'function' && d.esCritico());
  const porDefectoCritico = criticos.length > 0;
  const porUmbralExcedido = Boolean(alertaUmbral?.porUmbralExcedido);

  if (!porDefectoCritico && !porUmbralExcedido) {
    return null;
  }

  const motivos = [];
  if (porDefectoCritico) {
    const folios = criticos.map((d) => d.folio || 'nuevo').join(', ');
    motivos.push(`se registró al menos un defecto de severidad CRÍTICA (${folios})`);
  }
  if (alertaUmbral?.mensajeAlerta) {
    motivos.push(alertaUmbral.mensajeAlerta.replace(/^Alerta de calidad:\s*/i, '').replace(/\.$/, ''));
  }

  const nivelSemaforo = porDefectoCritico
    ? NivelSemaforo.ROJO_CRITICO
    : (medicion.estadoSemaforo || NivelSemaforo.AMARILLO_ADVERTENCIA);

  return new AlertaCalidad({
    porDefectoCritico,
    porUmbralExcedido,
    nivelSemaforo,
    mensajeAlerta: `Alerta de calidad: ${motivos.join(' y ')}.`,
  });
}

module.exports = { evaluarMedicion };

