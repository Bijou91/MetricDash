const { pool } = require('../db/pool');
const { ErrorPersistencia } = require('../domain/errors');

class RepositorioProyecto {
  constructor(customPool = pool) {
    this.pool = customPool;
  }

  async obtenerProyectoActivo(proyectoId) {
    try {
      const res = await this.pool.query(
        'SELECT * FROM monitored_projects WHERE id = $1 AND active_period = TRUE',
        [proyectoId]
      );
      if (res.rows.length === 0) {
        return null;
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
