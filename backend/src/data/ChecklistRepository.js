const pool = require('./pool');
const { ChecklistPlantilla, ItemChecklist, TipoArtefactoChecklist } = require('../services/entidades/actividadSqa');

// Plantillas en memoria de respaldo por si la BD aún no tiene la semilla o para pruebas unitarias sin conexión
const PLANTILLAS_RESPALDO = Object.freeze({
  [TipoArtefactoChecklist.VISION]: {
    id: '00000000-0000-0000-0000-000000000401',
    tipoArtefacto: TipoArtefactoChecklist.VISION,
    nombre: 'Checklist de Visión y Alcance / Casos de Uso',
    descripcion: 'Verificación de requerimientos, alcance y casos de uso según ISO/IEC 29110 Cl. 2.1.',
    items: [
      { id: '00000000-0000-0000-0000-000000004101', orden: 1, descripcion: 'El propósito, alcance y restricciones del proyecto están definidos sin ambigüedades.' },
      { id: '00000000-0000-0000-0000-000000004102', orden: 2, descripcion: 'Cada caso de uso especifica claramente precondiciones, flujo principal, flujos alternativos y de excepción.' },
      { id: '00000000-0000-0000-0000-000000004103', orden: 3, descripcion: 'Los criterios de aceptación y postcondiciones son verificables y trazables a las métricas de calidad.' },
      { id: '00000000-0000-0000-0000-000000004104', orden: 4, descripcion: 'Los actores y roles del equipo (QA, Técnico, Gestión de Proyecto) están correctamente identificados.' },
    ],
  },
  [TipoArtefactoChecklist.SDS]: {
    id: '00000000-0000-0000-0000-000000000402',
    tipoArtefacto: TipoArtefactoChecklist.SDS,
    nombre: 'Checklist de Especificación de Arquitectura y Diseño (SDS)',
    descripcion: 'Verificación de componentes, interfaces y trazabilidad de diseño según ISO/IEC 29110 Cl. 2.2.',
    items: [
      { id: '00000000-0000-0000-0000-000000004201', orden: 1, descripcion: 'La arquitectura de 3 capas separa responsabilidades entre Vistas/Widgets, Controladores/Servicios y Repositorios.' },
      { id: '00000000-0000-0000-0000-000000004202', orden: 2, descripcion: 'Los contratos de DTOs, entidades y firmas de métodos coinciden con el diagrama de clases y de secuencia.' },
      { id: '00000000-0000-0000-0000-000000004203', orden: 3, descripcion: 'El manejo de transacciones atómicas y reversión ante fallos está contemplado en el diseño.' },
      { id: '00000000-0000-0000-0000-000000004204', orden: 4, descripcion: 'Cada componente de software tiene trazabilidad directa con los requisitos funcionales del proyecto.' },
    ],
  },
  [TipoArtefactoChecklist.UI]: {
    id: '00000000-0000-0000-0000-000000000403',
    tipoArtefacto: TipoArtefactoChecklist.UI,
    nombre: 'Checklist de Modelo de Datos y Prototipos UI',
    descripcion: 'Verificación de integridad relacional, restricciones y consistencia de interfaz de usuario.',
    items: [
      { id: '00000000-0000-0000-0000-000000004301', orden: 1, descripcion: 'Las tablas del modelo relacional definen llaves primarias, llaves foráneas y restricciones CHECK consistentes.' },
      { id: '00000000-0000-0000-0000-000000004302', orden: 2, descripcion: 'Los formularios de interfaz validan campos obligatorios y resaltan visualmente los datos faltantes.' },
      { id: '00000000-0000-0000-0000-000000004303', orden: 3, descripcion: 'Los indicadores y semáforos muestran claramente los estados Óptimo, Advertencia, Crítico y Sin Datos.' },
      { id: '00000000-0000-0000-0000-000000004304', orden: 4, descripcion: 'Las alertas por umbral excedido o posible duplicado son visibles y comprensibles para el usuario.' },
    ],
  },
  [TipoArtefactoChecklist.PLAN]: {
    id: '00000000-0000-0000-0000-000000000404',
    tipoArtefacto: TipoArtefactoChecklist.PLAN,
    nombre: 'Checklist de Código Fuente, Estándares y Plan SQA',
    descripcion: 'Verificación de estándares de codificación, manejo de errores, transacciones y trazabilidad SQA.',
    items: [
      { id: '00000000-0000-0000-0000-000000004401', orden: 1, descripcion: 'El código fuente cumple con la convención de nombres, modularidad y ausencia de valores hardcodeados.' },
      { id: '00000000-0000-0000-0000-000000004402', orden: 2, descripcion: 'Las validaciones de negocio se ejecutan en el backend antes de abrir transacciones de base de datos.' },
      { id: '00000000-0000-0000-0000-000000004403', orden: 3, descripcion: 'Las consultas SQL están parametrizadas y protegidas contra inyección y condiciones de carrera.' },
      { id: '00000000-0000-0000-0000-000000004404', orden: 4, descripcion: 'Las evidencias de aseguramiento de calidad están vinculadas formalmente al plan base del proyecto.' },
    ],
  },
});

// FN-03 / FN-04: Obtiene la plantilla de checklist con sus ítems ordenados según el tipo de artefacto.
async function obtenerPorTipoArtefacto(tipo = TipoArtefactoChecklist.VISION, tx = pool) {
  const tipoNorm = PLANTILLAS_RESPALDO[tipo] ? tipo : TipoArtefactoChecklist.VISION;
  const client = tx && typeof tx.query === 'function' ? tx : pool;
  try {
    const { rows: tRows } = await client.query(
      'SELECT * FROM checklist_templates WHERE artifact_type = $1 LIMIT 1',
      [tipoNorm],
    );
    if (tRows.length > 0) {
      const tpl = tRows[0];
      const { rows: iRows } = await client.query(
        'SELECT * FROM checklist_items WHERE template_id = $1 ORDER BY item_order ASC',
        [tpl.id],
      );
      return new ChecklistPlantilla({
        id: tpl.id,
        tipoArtefacto: tpl.artifact_type,
        nombre: tpl.name,
        descripcion: tpl.description,
        items: iRows.map((it) => new ItemChecklist({
          id: it.id,
          descripcion: it.description,
          orden: it.item_order,
        })),
      });
    }
  } catch (_) {
    // Si la tabla aún no existe o estamos en test unitario, usamos la plantilla estándar
  }
  const respaldo = PLANTILLAS_RESPALDO[tipoNorm];
  return new ChecklistPlantilla(respaldo);
}

module.exports = {
  obtenerPorTipoArtefacto,
  PLANTILLAS_RESPALDO,
};

