/**
 * Rutas de Reservaciones (requieren autenticación)
 */

const express = require('express');
const multer  = require('multer');
const path    = require('path');
const router  = express.Router();
const { requireAuth } = require('../middleware/auth');
const {
  crearReservacion, getMisReservaciones, getReservacionById,
  cancelarReservacion, procesarPago, subirComprobante,
  descargarPDF, descargarICS, validarCupon
} = require('../controllers/reservacionesController');

// Configuración de multer para comprobantes SINPE
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../frontend/public/uploads/comprobantes'));
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|pdf/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) cb(null, true);
    else cb(new Error('Solo se permiten imágenes y PDF'));
  }
});

// Validar cupón (no requiere autenticación)
router.post('/validar-cupon', validarCupon);

// Rutas protegidas
router.use(requireAuth);
router.post('/',                    crearReservacion);
router.get('/mis-reservaciones',    getMisReservaciones);
router.get('/:id',                  getReservacionById);
router.put('/:id/cancelar',         cancelarReservacion);
router.post('/:id/pago',            procesarPago);
router.post('/comprobante',         upload.single('comprobante'), subirComprobante);
router.get('/:id/pdf',              descargarPDF);
router.get('/:id/ics',              descargarICS);

module.exports = router;
