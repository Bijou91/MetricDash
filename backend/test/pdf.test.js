const assert = require('assert');
const ExportadorReportePDF = require('../src/services/ExportadorReportePDF');
const CalculadorIndiceSalud = require('../src/services/CalculadorIndiceSalud');
const { ReporteSalud, MedicionMetrica, UmbralMetrica, NivelSemaforo, TipoMetrica } = require('../src/domain/models');

console.log('🧪 Iniciando prueba de ExportadorReportePDF...');

async function testExportadorPDF() {
  const exportador = new ExportadorReportePDF();
  const calculador = new CalculadorIndiceSalud();

  const mediciones = [
    new MedicionMetrica({ id: '1', proyectoId: 'p1', tipoMetrica: TipoMetrica.DENSIDAD_DEFECTOS, valorCalculado: 0.8, nivelSemaforo: NivelSemaforo.VERDE_OPTIMO }),
    new MedicionMetrica({ id: '2', proyectoId: 'p1', tipoMetrica: TipoMetrica.COBERTURA_PRUEBAS, valorCalculado: 72, nivelSemaforo: NivelSemaforo.AMARILLO_ADVERTENCIA }),
    new MedicionMetrica({ id: '3', proyectoId: 'p1', tipoMetrica: TipoMetrica.TASA_EXITO_PRUEBAS, valorCalculado: 98, nivelSemaforo: NivelSemaforo.VERDE_OPTIMO }),
    new MedicionMetrica({ id: '4', proyectoId: 'p1', tipoMetrica: TipoMetrica.CUMPLIMIENTO_SQA, valorCalculado: 60, nivelSemaforo: NivelSemaforo.ROJO_CRITICO })
  ];

  const umbrales = [
    new UmbralMetrica({ id: 'u1', tipoMetrica: TipoMetrica.DENSIDAD_DEFECTOS, valorMeta: 1.0, umbralAdvertencia: 2.0, umbralCritico: 3.5, sentido: 'MENOR_ES_MEJOR', unidad: 'def/KLOC' }),
    new UmbralMetrica({ id: 'u2', tipoMetrica: TipoMetrica.COBERTURA_PRUEBAS, valorMeta: 80, umbralAdvertencia: 70, umbralCritico: 60, sentido: 'MAYOR_ES_MEJOR', unidad: '%' }),
    new UmbralMetrica({ id: 'u3', tipoMetrica: TipoMetrica.TASA_EXITO_PRUEBAS, valorMeta: 95, umbralAdvertencia: 90, umbralCritico: 80, sentido: 'MAYOR_ES_MEJOR', unidad: '%' }),
    new UmbralMetrica({ id: 'u4', tipoMetrica: TipoMetrica.CUMPLIMIENTO_SQA, valorMeta: 90, umbralAdvertencia: 80, umbralCritico: 70, sentido: 'MAYOR_ES_MEJOR', unidad: '%' })
  ];

  const desglose = calculador.generarDesgloseImpacto(mediciones, umbrales);

  const reporte = new ReporteSalud({
    id: '11111111-1111-1111-1111-111111111111',
    proyectoId: '22222222-2222-2222-2222-222222222222',
    versionReporte: 1,
    estadoSalud: NivelSemaforo.AMARILLO_ADVERTENCIA,
    indiceSaludGeneral: 62.5,
    notasEjecutivas: 'Plan de acción para recuperar actividades SQA la próxima iteración.',
    desglose
  });

  const archivo = await exportador.compilarPDF(reporte, desglose);
  assert(archivo, 'El archivo DTO debe existir');
  assert(archivo.contenidoBytes.length > 500, 'El archivo debe contener bytes');
  assert(exportador.validarIntegridadPDF(archivo), 'Debe pasar la validación de cabecera %PDF');
  assert(archivo.base64.length > 0, 'Debe incluir base64');
  console.log('✅ Archivo PDF generado con éxito, tamaño en bytes:', archivo.tamanoBytes);
}

testExportadorPDF().catch(err => {
  console.error('❌ Error en prueba de PDF:', err);
  process.exit(1);
});
