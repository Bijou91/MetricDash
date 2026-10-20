const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const pool = require('./db/pool');
const metricasRouter = require('./controllers/MetricasController');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    status: 'online',
    servicio: 'SQA Dashboard API',
    version: '0.1.0'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

app.use('/api', metricasRouter);

pool.query(fs.readFileSync(path.join(__dirname, 'db/schema.sql'), 'utf8'))
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[SQA Backend] Servidor ejecutándose en http://0.0.0.0:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[SQA Backend] No se pudo inicializar el esquema', err);
    process.exit(1);
  });
