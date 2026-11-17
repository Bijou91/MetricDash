const express = require('express');
const cors = require('cors');
const { inicializarEsquemaBD } = require('./db/pool');
const tableroRoutes = require('./routes/tableroReportesRoutes');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Rutas de API
app.use('/api', tableroRoutes);

app.get('/', (req, res) => {
  res.json({
    status: 'online',
    servicio: 'MetricDash SQA Backend API',
    version: '1.0.0',
    casoDeUso: 'CU-07: Consultar el tablero y generar el reporte de salud'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

async function iniciarServidor() {
  try {
    // Si la BD está disponible, inicializamos el esquema
    await inicializarEsquemaBD();
    console.log('[SQA Backend] Esquema de Base de Datos inicializado y verificado.');
  } catch (err) {
    console.warn('[SQA Backend] Advertencia al conectar con BD:', err.message);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SQA Backend] Servidor ejecutándose en http://0.0.0.0:${PORT}`);
  });
}

iniciarServidor();

module.exports = app;
