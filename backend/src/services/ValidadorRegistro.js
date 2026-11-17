const { TipoProyecto, RolEquipo, ErrorValidacion } = require('./entidades/proyecto');

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
  const ROLES_VALIDOS = Object.values(RolEquipo);

  if (!Array.isArray(roles) || roles.length === 0) {
    errores.push(new ErrorValidacion('rolesEquipo', 'Se deben asignar los tres roles obligatorios del equipo (QA, Líder Técnico y Gestión de Proyecto).'));
    errores.push(new ErrorValidacion('rol_QA', 'Falta asignar a un integrante para el rol de QA.'));
    errores.push(new ErrorValidacion('rol_TECNICO', 'Falta asignar a un integrante para el rol de Líder Técnico.'));
    errores.push(new ErrorValidacion('rol_GESTION_PROYECTO', 'Falta asignar a un integrante para el rol de Gestión de Proyecto.'));
    return errores;
  }

  const conteoRoles = {
    [RolEquipo.QA]: 0,
    [RolEquipo.TECNICO]: 0,
    [RolEquipo.GESTION_PROYECTO]: 0,
    [RolEquipo.DEVELOPER]: 0,
  };

  for (const r of roles) {
    const rolNormalizado = (r.role || r.rol || '').toUpperCase();
    const nombreMiembro = (r.memberName || r.member_name || r.name || r.nombre || '').trim();

    if (!ROLES_VALIDOS.includes(rolNormalizado)) {
      errores.push(new ErrorValidacion('rolesEquipo', `Rol '${r.role}' no válido. Roles permitidos: ${ROLES_VALIDOS.join(', ')}.`));
      continue;
    }

    if (nombreMiembro) {
      conteoRoles[rolNormalizado] = (conteoRoles[rolNormalizado] || 0) + 1;
    }
  }

  for (const rolReq of ROLES_OBLIGATORIOS) {
    const cantidad = conteoRoles[rolReq] || 0;
    if (cantidad === 0) {
      errores.push(new ErrorValidacion(`rol_${rolReq}`, `Debe asignar a un integrante para el rol obligatorio de ${rolReq}.`));
    } else if (cantidad > 1) {
      errores.push(new ErrorValidacion(`rol_${rolReq}`, `Solo se permite un único integrante para el rol de ${rolReq}. El rol Desarrollador es el único que admite integrantes ilimitados.`));
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
