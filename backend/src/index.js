const express = require('express');
const cors = require('cors');
const metricasRouter = require('./controllers/MetricasController');
const proyectoRouter = require('./controllers/ProyectoController');
const defectoRouter = require('./controllers/DefectoController');
const pruebasRouter = require('./controllers/PruebasController');
const accionCorrectivaRouter = require('./controllers/AccionCorrectivaController');
const actividadesSqaRouter = require('./controllers/ActividadesSqaController');
const actividadSQARouter = require('./controllers/ActividadSQAController');
const tableroReportesRouter = require('./routes/tableroReportesRoutes');
const cierrePeriodoRouter = require('./controllers/CierrePeriodoController');
const proyectoRepo = require('./data/ProyectoRepository');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    status: 'online',
    servicio: 'SQA Dashboard API',
    version: '1.0.0'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// CU-08 postcondición: un periodo CERRADO no admite nuevos registros (las rutas del CU-08 manejan su propio FE-02).
app.use('/api', async (req, res, next) => {
  if (req.method === 'GET' || /\/cierres?(\/|$)/.test(req.path)) return next();
  try {
    const periodo = await proyectoRepo.obtenerPeriodoActivo();
    if (periodo?.status === 'CERRADO') {
      return res.status(409).json({ mensaje: 'El periodo está cerrado y no admite nuevos registros.' });
    }
    return next();
  } catch (err) {
    return next(err);
  }
});

app.use('/api', cierrePeriodoRouter);
app.use('/api', proyectoRouter);
app.use('/api', metricasRouter);
app.use('/api', defectoRouter);
app.use('/api', pruebasRouter);
app.use('/api', accionCorrectivaRouter);
app.use('/api', actividadesSqaRouter);
app.use('/api', actividadSQARouter);
app.use('/api', tableroReportesRouter);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[SQA Backend] Servidor ejecutándose en http://0.0.0.0:${PORT}`);
});

module.exports = app;
