let pg;
try {
  pg = require('pg');
} catch (_) {
  pg = {
    Pool: class {
      query() {
        throw new Error('Módulo pg no disponible en este entorno.');
      }
    },
  };
}

module.exports = new pg.Pool({ connectionString: process.env.DATABASE_URL });
