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
    const mediciones = await this.obtenerMedicionesVigentes(proyectoId);
    const alertas = await this.repoAlerta.listarAlertasActivasPorProyecto(proyectoId);

    const indicadores = this.consolidarIndicadores(mediciones, umbrales);
    const estadoSaludGlobal = this.calculadorSalud.determinarEstadoSaludGlobal(mediciones);
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
      indiceSaludGeneral_nullable: indiceSalud,
      indicadores,
      alertasActivas: alertasDTO
    });
  }

  async consultarEstadoTablero(proyectoId) {
    return this.consultarTableroConsolidado(proyectoId);
  }

  async obtenerMedicionesVigentes(proyectoId) {
    return this.repoMedicion.obtenerUltimasMediciones(proyectoId);
  }

  async obtenerUmbralesVigentes(proyectoId) {
    return this.repoUmbral.obtenerUmbralesVigentes(proyectoId);
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
        unidad: u ? u.unidad : '',
        nivelSemaforo: m ? m.nivelSemaforo : NivelSemaforo.SIN_DATOS,
        meta: u ? u.valorMeta : null,
        advertencia: u ? u.umbralAdvertencia : null,
        critico: u ? u.umbralCritico : null,
        sentido: u ? u.sentido : null,
        fechaMedicion: m ? m.fechaMedicion : null
      });
    });
  }

  async consolidarIndicadoresVigentes(proyectoId) {
    const umbrales = await this.obtenerUmbralesVigentes(proyectoId);
    const mediciones = await this.obtenerMedicionesVigentes(proyectoId);
    return this.consolidarIndicadores(mediciones, umbrales);
  }
}

module.exports = ServicioTableroSalud;
