const express = require('express');
const cors = require('cors');
const metricasRouter = require('./controllers/MetricasController');
const proyectoRouter = require('./controllers/ProyectoController');
const defectoRouter = require('./controllers/DefectoController');

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

app.use('/api', proyectoRouter);
app.use('/api', metricasRouter);
app.use('/api', defectoRouter);


app.listen(PORT, '0.0.0.0', () => {
  console.log(`[SQA Backend] Servidor ejecutándose en http://0.0.0.0:${PORT}`);
});
