const express = require('express');
const servicio = require('../services/ServicioCierrePeriodo');
const cierreRepo = require('../data/CierrePeriodoRepository');
const transacciones = require('../data/TransaccionManager');
const { ErrorPersistencia } = transacciones;
const { ErrorValidacion } = require('../services/entidades/proyecto');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ESTADO_POR_CAMPO = { periodo: 409, configuracion: 409, proyecto: 404 };

// ErrorValidacion: 400 (FA-05.01), 409 (FE-02 / precondición), 404 (sin proyecto); ErrorPersistencia: 500 (FE-01).
function manejarError(res, err) {
  if (err instanceof ErrorValidacion) {
    return res.status(ESTADO_POR_CAMPO[err.campo] ?? 400).json({ mensaje: err.mensaje, errores: err.errores ?? [err] });
  }
  if (err instanceof ErrorPersistencia) return res.status(500).json({ mensaje: err.message });
  console.error('[CierrePeriodoController]', err);
  return res.status(500).json({ mensaje: 'Error interno del servidor.' });
}

async function obtenerPendientes(req, res) {
  try {
    res.json(await servicio.obtenerPendientes(req.params.proyectoId));
  } catch (err) {
    manejarError(res, err);
  }
}

async function validarCierre(req, res) {
  try {
    res.json(await servicio.prepararResumen(req.params.proyectoId, req.body));
  } catch (err) {
    manejarError(res, err);
  }
}

// El controlador abre la transacción: FN-07 a FN-09 se confirman o se revierten como una sola unidad.
// shortcut: sin autenticación aún; quien cierra es el miembro elegido en la UI. Sustituir por el usuario de la sesión.
async function cerrarPeriodo(req, res) {
  try {
    const cierre = await transacciones.ejecutar((tx) =>
      servicio.cerrarPeriodo(req.params.proyectoId, req.body, req.body?.cerradoPor, tx));
    res.status(201).json({ cierreId: cierre.id });
  } catch (err) {
    manejarError(res, err);
  }
}

function enviarPDF(res, archivo) {
  res.set('Content-Type', archivo.mimeType);
  res.set('Content-Disposition', `attachment; filename="${archivo.nombreArchivo}"`);
  res.set('Access-Control-Expose-Headers', 'Content-Disposition'); // el cliente lee el nombre aunque la API esté en otro origen
  res.send(archivo.contenidoBytes);
}

async function descargarReporte(req, res) {
  try {
    const cierre = await cierreRepo.obtenerPorId(req.params.cierreId);
    if (!cierre) return res.status(404).json({ mensaje: 'Cierre no encontrado.' });
    enviarPDF(res, cierre.reporteFinalPdf);
  } catch (err) {
    manejarError(res, err);
  }
}

async function descargarBitacora(req, res) {
  try {
    const cierre = await cierreRepo.obtenerPorId(req.params.cierreId);
    if (!cierre) return res.status(404).json({ mensaje: 'Cierre no encontrado.' });
    enviarPDF(res, cierre.bitacora.archivoPdf);
  } catch (err) {
    manejarError(res, err);
  }
}

const router = express.Router();
const validarUUID = (nombre) => (req, res, next, id) =>
  (UUID.test(id) ? next() : res.status(400).json({ mensaje: `${nombre} inválido.` }));
router.param('proyectoId', validarUUID('proyectoId'));
router.param('cierreId', validarUUID('cierreId'));
router.get('/proyectos/:proyectoId/cierre/pendientes', obtenerPendientes);
router.post('/proyectos/:proyectoId/cierre/validacion', validarCierre);
router.post('/proyectos/:proyectoId/cierre', cerrarPeriodo);
router.get('/cierres/:cierreId/reporte.pdf', descargarReporte);
router.get('/cierres/:cierreId/bitacora.pdf', descargarBitacora);

module.exports = router;
