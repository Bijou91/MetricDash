const RepositorioMedicionMetrica = require('../persistence/RepositorioMedicionMetrica');
const RepositorioConfiguracionMetrica = require('../persistence/RepositorioConfiguracionMetrica');
const RepositorioAlertaCalidad = require('../persistence/RepositorioAlertaCalidad');
const RepositorioProyecto = require('../persistence/RepositorioProyecto');
const CalculadorIndiceSalud = require('./CalculadorIndiceSalud');
const { TableroSaludDTO, IndicadorMetricaDTO, AlertaResumenDTO } = require('../domain/dtos');
const { TableroControl, NivelSemaforo } = require('../domain/models');

class ServicioTableroSalud {
  constructor(
    repoMedicion = new RepositorioMedicionMetrica(),
    repoUmbral = new RepositorioConfiguracionMetrica(),
    repoAlerta = new RepositorioAlertaCalidad(),
    repoProyecto = new RepositorioProyecto(),
    calculadorSalud = new CalculadorIndiceSalud()
  ) {
    this.repoMedicion = repoMedicion;
    this.repoUmbral = repoUmbral;
    this.repoAlerta = repoAlerta;
    this.repoProyecto = repoProyecto;
    this.calculadorSalud = calculadorSalud;
  }

  async consultarTableroConsolidado(proyectoId) {
    const proyecto = await this.repoProyecto.obtenerProyectoActivo(proyectoId);
    if (!proyecto) {
      throw new Error(`Proyecto activo no encontrado con ID: ${proyectoId}`);
    }

    const umbrales = await this.obtenerUmbralesVigentes(proyectoId);
    const mediciones = await this.obtenerMedicionesVigentes(proyectoId, umbrales);
    const alertas = await this.repoAlerta.listarAlertasActivasPorProyecto(proyectoId);

    const indicadores = this.consolidarIndicadores(mediciones, umbrales);
    const estadoSaludGlobal = this.calculadorSalud.determinarEstadoSaludGlobal(mediciones);
    const estadoIndice = this.calculadorSalud.determinarEstadoIndice(mediciones);
    const indiceSalud = this.calculadorSalud.calcularIndiceSaludDeterminista(mediciones);

    const alertasDTO = alertas.map(a => new AlertaResumenDTO({
      id: a.id,
      tipoMetrica: a.tipoMetrica,
      nivelSemaforo: a.nivelSemaforo,
      mensaje: a.mensaje,
      fechaDeteccion: a.fechaDeteccion
    }));

    return new TableroSaludDTO({
      proyectoId,
      nombreProyecto: proyecto.name,
      versionUmbrales: 1,
      estadoSaludGlobal,
      estadoIndice,
      indiceSaludGeneral_nullable: indiceSalud,
      indicadores,
      alertasActivas: alertasDTO
    });
  }

  async consultarEstadoTablero(proyectoId) {
    return this.consultarTableroConsolidado(proyectoId);
  }

  // El semáforo de cada métrica se evalúa aquí contra su umbral vigente (CU-02) a partir del valor medido.
  // No se confía en health_status guardado en metric_measurements: algunos módulos persisten ahí el estado
  // global del corte en lugar del propio de la métrica, y eso contradecía lo que muestran las demás pantallas.
  async obtenerMedicionesVigentes(proyectoId, umbrales = null) {
    try {
      const mediciones = await this.repoMedicion.obtenerUltimasMediciones(proyectoId);
      const vigentes = umbrales || await this.obtenerUmbralesVigentes(proyectoId);
      return this.reevaluarSemaforo(mediciones, vigentes);
    } catch (e) {
      console.warn('[ServicioTableroSalud] Error al obtener mediciones:', e.message);
      return [];
    }
  }

  async obtenerUmbralesVigentes(proyectoId) {
    try {
      return await this.repoUmbral.obtenerUmbralesVigentes(proyectoId);
    } catch (e) {
      console.warn('[ServicioTableroSalud] Error al obtener umbrales:', e.message);
      return [];
    }
  }

  reevaluarSemaforo(mediciones = [], umbrales = []) {
    const mapaUmbrales = new Map(umbrales.map(u => [u.tipoMetrica, u]));
    return mediciones.map((m) => {
      const nivel = this.calculadorSalud.evaluarNivelSemaforo(m.valorCalculado, mapaUmbrales.get(m.tipoMetrica));
      if (nivel) m.nivelSemaforo = nivel;
      return m;
    });
  }

  consolidarIndicadores(mediciones = [], umbrales = []) {
    const mapaUmbrales = new Map();
    umbrales.forEach(u => mapaUmbrales.set(u.tipoMetrica, u));

    const mapaMediciones = new Map();
    mediciones.forEach(m => mapaMediciones.set(m.tipoMetrica, m));

    // Consolidar para las 4 métricas estándar
    const tipos = [
      'DENSIDAD_DEFECTOS',
      'COBERTURA_PRUEBAS',
      'TASA_EXITO_PRUEBAS',
      'CUMPLIMIENTO_SQA'
    ];

    return tipos.map(tipo => {
      const u = mapaUmbrales.get(tipo);
      const m = mapaMediciones.get(tipo);

      return new IndicadorMetricaDTO({
        tipoMetrica: tipo,
        valorActual: m ? m.valorCalculado : null,
        unidad: u ? u.unidad : (tipo === 'DENSIDAD_DEFECTOS' ? 'defectos/KLOC' : '%'),
        nivelSemaforo: m ? m.nivelSemaforo : NivelSemaforo.SIN_DATOS,
        meta: u ? u.valorMeta : null,
        advertencia: u ? u.umbralAdvertencia : null,
        critico: u ? u.umbralCritico : null,
        sentido: u ? u.sentido : (tipo === 'DENSIDAD_DEFECTOS' ? 'MENOR_ES_MEJOR' : 'MAYOR_ES_MEJOR'),
        fechaMedicion: m ? m.fechaMedicion : null
      });
    });
  }

  async consolidarIndicadoresVigentes(proyectoId) {
    const umbrales = await this.obtenerUmbralesVigentes(proyectoId);
    const mediciones = await this.obtenerMedicionesVigentes(proyectoId, umbrales);
    return this.consolidarIndicadores(mediciones, umbrales);
  }
}

module.exports = ServicioTableroSalud;
