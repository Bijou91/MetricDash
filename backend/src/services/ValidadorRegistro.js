const { TipoProyecto, RolEquipo, ErrorValidacion } = require('../domain/proyecto');

function validarDatosGenerales(dto = {}) {
  const errores = [];

  const nombre = (dto.name || dto.nombre || '').trim();
  if (!nombre) {
    errores.push(new ErrorValidacion('nombre', 'El nombre del proyecto es obligatorio.'));
  } else if (nombre.length < 3) {
    errores.push(new ErrorValidacion('nombre', 'El nombre del proyecto debe tener al menos 3 caracteres.'));
  }

  const klocRaw = dto.estimatedKloc ?? dto.tamanoProductoKLOC ?? dto.kloc;
  const kloc = Number(klocRaw);
  if (klocRaw === undefined || klocRaw === null || klocRaw === '' || Number.isNaN(kloc)) {
    errores.push(new ErrorValidacion('tamanoProductoKLOC', 'El tamaño estimado del producto (KLOC) es obligatorio.'));
  } else if (kloc <= 0) {
    errores.push(new ErrorValidacion('tamanoProductoKLOC', 'El tamaño estimado debe ser un valor numérico mayor a 0 KLOC.'));
  }

  const tipo = dto.projectType || dto.tipoProyecto || TipoProyecto.DESARROLLO_NUEVO;
  if (!Object.values(TipoProyecto).includes(tipo)) {
    errores.push(new ErrorValidacion('tipoProyecto', `Tipo de proyecto inválido. Debe ser: ${Object.values(TipoProyecto).join(', ')}.`));
  }

  return errores;
}

function validarRolesRequeridos(roles = []) {
  const errores = [];
  const ROLES_OBLIGATORIOS = [RolEquipo.QA, RolEquipo.TECNICO, RolEquipo.GESTION_PROYECTO];

  if (!Array.isArray(roles) || roles.length === 0) {
    errores.push(new ErrorValidacion('rolesEquipo', 'Se deben asignar los tres roles obligatorios del equipo (QA, Líder Técnico y Gestión de Proyecto).'));
    errores.push(new ErrorValidacion('rol_QA', 'Falta asignar a un integrante para el rol de QA.'));
    errores.push(new ErrorValidacion('rol_TECNICO', 'Falta asignar a un integrante para el rol de Líder Técnico.'));
    errores.push(new ErrorValidacion('rol_GESTION_PROYECTO', 'Falta asignar a un integrante para el rol de Gestión de Proyecto.'));
    return errores;
  }

  const rolesAsignados = new Map();
  for (const r of roles) {
    const rolNormalizado = (r.role || r.rol || '').toUpperCase();
    const nombreMiembro = (r.memberName || r.member_name || r.name || r.nombre || '').trim();
    if (rolNormalizado && nombreMiembro) {
      rolesAsignados.set(rolNormalizado, nombreMiembro);
    }
  }

  for (const rolReq of ROLES_OBLIGATORIOS) {
    if (!rolesAsignados.has(rolReq)) {
      errores.push(new ErrorValidacion(`rol_${rolReq}`, `Debe asignar a un integrante para el rol obligatorio de ${rolReq}.`));
    }
  }

  return errores;
}

function validarRegistro(dto = {}) {
  const erroresGenerales = validarDatosGenerales(dto);
  const roles = dto.members || dto.rolesEquipo || dto.teamRoles || dto.roles || [
    dto.technicalLeadRole ? { role: RolEquipo.TECNICO, memberName: dto.technicalLeadRole } : null,
    dto.qaLeadRole ? { role: RolEquipo.QA, memberName: dto.qaLeadRole } : null,
    dto.pmRole ? { role: RolEquipo.GESTION_PROYECTO, memberName: dto.pmRole } : null,
  ].filter(Boolean);

  const erroresRoles = validarRolesRequeridos(roles);
  const todos = [...erroresGenerales, ...erroresRoles];

  return {
    valido: todos.length === 0,
    errores: todos,
    incompleto: todos.length > 0,
  };
}

module.exports = {
  validarDatosGenerales,
  validarRolesRequeridos,
  validarRegistro,
};
