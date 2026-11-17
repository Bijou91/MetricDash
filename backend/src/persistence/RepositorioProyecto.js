const pool = require('../data/pool');
const { ErrorPersistencia } = require('../domain/errors');

class RepositorioProyecto {
  constructor(customPool = pool) {
    this.pool = customPool;
  }

  async obtenerProyectoActivo(proyectoId) {
    try {
      const res = await this.pool.query(
        `SELECT p.*, a.code as period_code, a.name as period_name
           FROM monitored_projects p
           JOIN academic_periods a ON a.id = p.period_id
          WHERE p.id = $1 AND a.is_active = true`,
        [proyectoId]
      );
      if (res.rows.length === 0) {
        // Si no coincide con periodo académico activo pero existe el proyecto, devolverlo
        const resDirect = await this.pool.query(
          'SELECT * FROM monitored_projects WHERE id = $1',
          [proyectoId]
        );
        return resDirect.rows[0] ?? null;
      }
      return res.rows[0];
    } catch (err) {
      throw new ErrorPersistencia(`Error al obtener proyecto activo: ${proyectoId}`, 'SELECT_PROJECT', err);
    }
  }

  async listarProyectos() {
    try {
      const res = await this.pool.query('SELECT * FROM monitored_projects ORDER BY name ASC');
      return res.rows;
    } catch (err) {
      throw new ErrorPersistencia('Error al listar proyectos', 'SELECT_ALL_PROJECTS', err);
    }
  }
}

module.exports = RepositorioProyecto;
