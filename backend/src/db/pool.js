const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://sqa_user:sqa_password@localhost:5432/sqa_dashboard'
});

async function inicializarEsquemaBD() {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');

    // Tabla de proyectos monitoreados (CU-01)
    await cliente.query(`
      CREATE TABLE IF NOT EXISTS monitored_projects (
        id UUID PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        active_period BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Tabla de configuraciones de métricas (CU-02)
    await cliente.query(`
      CREATE TABLE IF NOT EXISTS metric_configurations (
        id UUID PRIMARY KEY,
        project_id UUID NOT NULL REFERENCES monitored_projects(id) ON DELETE CASCADE,
        version INT NOT NULL DEFAULT 1,
        is_current BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Tabla de umbrales por configuración (CU-02)
    await cliente.query(`
      CREATE TABLE IF NOT EXISTS metric_thresholds (
        id UUID PRIMARY KEY,
        configuration_id UUID NOT NULL REFERENCES metric_configurations(id) ON DELETE CASCADE,
        metric_type VARCHAR(50) NOT NULL,
        target_value NUMERIC(10, 2) NOT NULL,
        warning_threshold NUMERIC(10, 2) NOT NULL,
        critical_threshold NUMERIC(10, 2) NOT NULL,
        direction VARCHAR(20) NOT NULL,
        unit VARCHAR(20) NOT NULL
      );
    `);

    // Tabla de mediciones de métricas (CU-03, CU-04, CU-05)
    await cliente.query(`
      CREATE TABLE IF NOT EXISTS metric_measurements (
        id UUID PRIMARY KEY,
        project_id UUID NOT NULL REFERENCES monitored_projects(id) ON DELETE CASCADE,
        metric_type VARCHAR(50) NOT NULL,
        calculated_value NUMERIC(10, 2) NOT NULL,
        semaphore_level VARCHAR(30) NOT NULL,
        measured_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Tabla de alertas de calidad (CU-06)
    await cliente.query(`
      CREATE TABLE IF NOT EXISTS quality_alerts (
        id UUID PRIMARY KEY,
        project_id UUID NOT NULL REFERENCES monitored_projects(id) ON DELETE CASCADE,
        metric_type VARCHAR(50) NOT NULL,
        nivel_semaforo VARCHAR(30) NOT NULL,
        mensaje TEXT NOT NULL,
        activa BOOLEAN DEFAULT TRUE,
        resuelta BOOLEAN DEFAULT FALSE,
        fecha_deteccion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Tabla evaluation_cutoffs para historial y reportes (CU-07)
    await cliente.query(`
      CREATE TABLE IF NOT EXISTS evaluation_cutoffs (
        id UUID PRIMARY KEY,
        project_id UUID NOT NULL REFERENCES monitored_projects(id) ON DELETE CASCADE,
        cutoff_number INT NOT NULL,
        cutoff_name VARCHAR(255) NOT NULL,
        cutoff_date DATE NOT NULL DEFAULT CURRENT_DATE,
        kloc NUMERIC(10, 2),
        planned_sqa_acts INT,
        executed_sqa_acts INT,
        health_status VARCHAR(50) NOT NULL,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_project_cutoff UNIQUE (project_id, cutoff_number)
      );
    `);

    // Cargar datos semilla si no existen proyectos
    const res = await cliente.query('SELECT COUNT(*) FROM monitored_projects');
    if (parseInt(res.rows[0].count, 10) === 0) {
      console.log('[DB] Insertando datos iniciales de prueba para MetricDash...');
      
      const proyectoId = '11111111-1111-1111-1111-111111111111';
      const configId = '22222222-2222-2222-2222-222222222222';

      await cliente.query(`
        INSERT INTO monitored_projects (id, name, description, active_period)
        VALUES ($1, 'Proyecto Alpha - Sistema Core Bancario', 'Monitoreo SQA para el release principal', true);
      `, [proyectoId]);

      await cliente.query(`
        INSERT INTO metric_configurations (id, project_id, version, is_current)
        VALUES ($1, $2, 1, true);
      `, [configId, proyectoId]);

      // 4 umbrales vigentes (CU-02)
      // 1. DENSIDAD_DEFECTOS (MENOR_ES_MEJOR): Meta <= 1.0, Advertencia 2.0, Crítico 3.5
      // 2. COBERTURA_PRUEBAS (MAYOR_ES_MEJOR): Meta >= 80%, Advertencia 70%, Crítico 60%
      // 3. TASA_EXITO_PRUEBAS (MAYOR_ES_MEJOR): Meta >= 95%, Advertencia 90%, Crítico 80%
      // 4. CUMPLIMIENTO_SQA (MAYOR_ES_MEJOR): Meta >= 90%, Advertencia 80%, Crítico 70%
      const umbrales = [
        ['33333333-1111-1111-1111-111111111111', configId, 'DENSIDAD_DEFECTOS', 1.0, 2.0, 3.5, 'MENOR_ES_MEJOR', 'def/KLOC'],
        ['33333333-2222-2222-2222-222222222222', configId, 'COBERTURA_PRUEBAS', 80.0, 70.0, 60.0, 'MAYOR_ES_MEJOR', '%'],
        ['33333333-3333-3333-3333-333333333333', configId, 'TASA_EXITO_PRUEBAS', 95.0, 90.0, 80.0, 'MAYOR_ES_MEJOR', '%'],
        ['33333333-4444-4444-4444-444444444444', configId, 'CUMPLIMIENTO_SQA', 90.0, 80.0, 70.0, 'MAYOR_ES_MEJOR', '%']
      ];

      for (const u of umbrales) {
        await cliente.query(`
          INSERT INTO metric_thresholds (id, configuration_id, metric_type, target_value, warning_threshold, critical_threshold, direction, unit)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
        `, u);
      }

      // 4 mediciones vigentes (CU-03, CU-04, CU-05)
      // Densidad: 0.85 -> VERDE
      // Cobertura: 72.50 -> AMARILLO
      // Tasa Exito: 98.00 -> VERDE
      // Cumplimiento SQA: 65.00 -> ROJO
      const mediciones = [
        ['44444444-1111-1111-1111-111111111111', proyectoId, 'DENSIDAD_DEFECTOS', 0.85, 'VERDE_OPTIMO'],
        ['44444444-2222-2222-2222-222222222222', proyectoId, 'COBERTURA_PRUEBAS', 72.50, 'AMARILLO_ADVERTENCIA'],
        ['44444444-3333-3333-3333-333333333333', proyectoId, 'TASA_EXITO_PRUEBAS', 98.00, 'VERDE_OPTIMO'],
        ['44444444-4444-4444-4444-444444444444', proyectoId, 'CUMPLIMIENTO_SQA', 65.00, 'ROJO_CRITICO']
      ];

      for (const m of mediciones) {
        await cliente.query(`
          INSERT INTO metric_measurements (id, project_id, metric_type, calculated_value, semaphore_level, measured_at)
          VALUES ($1, $2, $3, $4, $5, NOW() - interval '2 hours');
        `, m);
      }

      // Alertas activas de calidad (CU-06)
      await cliente.query(`
        INSERT INTO quality_alerts (id, project_id, metric_type, nivel_semaforo, mensaje, activa, resuelta, fecha_deteccion)
        VALUES 
          ('55555555-1111-1111-1111-111111111111', $1, 'CUMPLIMIENTO_SQA', 'ROJO_CRITICO', 'El cumplimiento de actividades SQA cayó al 65%, por debajo del umbral crítico (70%)', true, false, NOW() - interval '1 hour'),
          ('55555555-2222-2222-2222-222222222222', $1, 'COBERTURA_PRUEBAS', 'AMARILLO_ADVERTENCIA', 'La cobertura de pruebas (72.5%) descendió bajo la meta mínima del 80%', true, false, NOW() - interval '3 hours');
      `, [proyectoId]);

      // Segundo proyecto de prueba para probar caso FA-04.01 (Sin mediciones suficientes)
      const proyectoIdSinDatos = '99999999-9999-9999-9999-999999999999';
      await cliente.query(`
        INSERT INTO monitored_projects (id, name, description, active_period)
        VALUES ($1, 'Proyecto Beta - Nuevo Microservicio', 'Proyecto en fase inicial sin mediciones completas (FA-04.01)', true);
      `, [proyectoIdSinDatos]);

      const configIdBeta = '88888888-8888-8888-8888-888888888888';
      await cliente.query(`
        INSERT INTO metric_configurations (id, project_id, version, is_current)
        VALUES ($1, $2, 1, true);
      `, [configIdBeta, proyectoIdSinDatos]);

      for (const u of umbrales) {
        await cliente.query(`
          INSERT INTO metric_thresholds (id, configuration_id, metric_type, target_value, warning_threshold, critical_threshold, direction, unit)
          VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7);
        `, [configIdBeta, u[2], u[3], u[4], u[5], u[6], u[7]]);
      }

      console.log('[DB] Datos de semilla cargados con éxito.');
    }

    await cliente.query('COMMIT');
  } catch (err) {
    await cliente.query('ROLLBACK');
    console.error('[DB] Error al inicializar esquema de base de datos:', err);
    throw err;
  } finally {
    cliente.release();
  }
}

module.exports = {
  pool,
  inicializarEsquemaBD
};
