const defectoRepo = require('../data/DefectoRepository');
const { Defecto, SeveridadDefecto, PrioridadDefecto } = require('./entidades/defecto');
const { FaseProyecto } = require('./entidades/proyecto');

// FA-03.01: a partir de este porcentaje de palabras en común (misma fase de origen) se considera posible duplicado.
const UMBRAL_SIMILITUD_DUPLICADO = 60;

const ENUMS = {
  severidad: SeveridadDefecto,
  prioridad: PrioridadDefecto,
  faseDeteccion: FaseProyecto,
  faseOrigen: FaseProyecto,
};

// FA-03.03: regresa los campos faltantes o inválidos para resaltarlos en la vista.
function validarCamposObligatorios(dto = {}, miembros = []) {
  const idsMiembros = new Set(miembros.map((m) => m.id));
  const faltantes = Object.entries(ENUMS)
    .filter(([campo, valores]) => !Object.values(valores).includes(dto[campo]))
    .map(([campo]) => campo);
  for (const campo of ['reportadoPorId', 'asignadoAId']) {
    if (!idsMiembros.has(dto[campo])) faltantes.push(campo);
  }
  if (typeof dto.descripcionDetallada !== 'string' || !dto.descripcionDetallada.trim()) faltantes.push('descripcionDetallada');
  return faltantes;
}

const palabras = (texto) => new Set(
  texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/).filter((p) => p.length > 2),
);

// Porcentaje de palabras compartidas (Jaccard) entre dos descripciones.
function similitud(a, b) {
  const pa = palabras(a);
  const pb = palabras(b);
  if (!pa.size || !pb.size) return 0;
  const comunes = [...pa].filter((p) => pb.has(p)).length;
  return Math.round((comunes / (pa.size + pb.size - comunes)) * 100);
}

// FN-03: compara descripción y fase de origen contra los defectos del proyecto.
async function buscarPosiblesDuplicados(proyectoId, dto) {
  const previos = await defectoRepo.buscarSimilaresPorProyecto(proyectoId, dto.faseOrigen);
  return previos
    .map((d) => ({ defecto: d, porcentajeSimilitud: similitud(dto.descripcionDetallada, d.descripcionDetallada) }))
    .filter((c) => c.porcentajeSimilitud >= UMBRAL_SIMILITUD_DUPLICADO)
    .sort((x, y) => y.porcentajeSimilitud - x.porcentajeSimilitud)
    .map(({ defecto: d, porcentajeSimilitud }) => ({
      defectoExistenteId: d.id,
      folio: d.folio,
      descripcionResumen: d.descripcionDetallada.slice(0, 140),
      faseDeteccion: d.faseDeteccion,
      faseOrigen: d.faseOrigen,
      severidad: d.severidad,
      porcentajeSimilitud,
      fechaRegistro: d.fechaRegistro,
    }));
}

// FN-04: crea el defecto, lo asigna al responsable y lo guarda dentro de la transacción.
async function crearYAsignarDefecto(dto, responsable, corte, tx) {
  const defecto = new Defecto({
    severidad: dto.severidad,
    prioridad: dto.prioridad,
    faseDeteccion: dto.faseDeteccion,
    faseOrigen: dto.faseOrigen,
    descripcionDetallada: dto.descripcionDetallada.trim(),
    confirmadoNoDuplicado: dto.confirmarIncidenciaDistinta === true,
    reportadoPorId: dto.reportadoPorId,
  });
  defecto.asignarResponsable(responsable);
  return defectoRepo.guardar(defecto, corte, tx);
}

module.exports = {
  UMBRAL_SIMILITUD_DUPLICADO,
  validarCamposObligatorios,
  similitud,
  buscarPosiblesDuplicados,
  crearYAsignarDefecto,
};
