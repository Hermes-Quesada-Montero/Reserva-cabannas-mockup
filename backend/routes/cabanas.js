/**
 * Rutas públicas de Cabañas
 */

const express = require('express');
const router  = express.Router();
const {
  getCabanas, getCabanaById, getDisponibilidad,
  verificarDisponibilidad, getTarifa
} = require('../controllers/cabanasController');

router.get('/',                  getCabanas);
router.get('/tarifa',            getTarifa);
router.get('/disponibilidad',    verificarDisponibilidad);
router.get('/:id',               getCabanaById);
router.get('/:id/disponibilidad', getDisponibilidad);

module.exports = router;
