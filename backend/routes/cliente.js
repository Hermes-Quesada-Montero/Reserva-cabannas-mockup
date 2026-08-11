/**
 * Rutas del Cliente (perfil, comentarios, contacto)
 */

const express = require('express');
const router  = express.Router();
const { requireAuth } = require('../middleware/auth');
const { dbAll }        = require('../database/db');
const { getPerfil, updatePerfil, crearComentario, enviarContacto, getMisMensajes } = require('../controllers/clienteController');

// Contacto es público
router.post('/contacto', enviarContacto);

// FAQ público
router.get('/faqs', async (req, res) => {
  try {
    const faqs = await dbAll('SELECT * FROM faqs WHERE activa = 1 ORDER BY orden ASC');
    res.json({ success: true, data: faqs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al obtener FAQs' });
  }
});

// Galería pública
router.get('/galeria', async (req, res) => {
  try {
    const { categoria, cabana_id } = req.query;
    let sql = 'SELECT * FROM galeria WHERE activa = 1';
    const params = [];
    if (categoria) { sql += ' AND categoria = ?'; params.push(categoria); }
    if (cabana_id) { sql += ' AND cabana_id = ?'; params.push(cabana_id); }
    sql += ' ORDER BY orden ASC';
    const galeria = await dbAll(sql, params);
    res.json({ success: true, data: galeria });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al obtener galería' });
  }
});

// Configuración pública del sitio
router.get('/site-config', async (req, res) => {
  try {
    const configs = await dbAll('SELECT clave, valor FROM configuracion');
    const obj = {};
    configs.forEach(c => { obj[c.clave] = c.valor; });
    res.json({ success: true, data: obj });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error' });
  }
});

// Comentarios públicos por cabaña
router.get('/comentarios/:cabana_id', async (req, res) => {
  try {
    const comentarios = await dbAll(
      `SELECT cm.calificacion, cm.comentario, cm.nombre_publico, cm.creado_en
       FROM comentarios cm
       WHERE cm.cabana_id = ? AND cm.visible = 1 AND cm.aprobado = 1
       ORDER BY cm.creado_en DESC LIMIT 20`,
      [req.params.cabana_id]
    );
    res.json({ success: true, data: comentarios });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error' });
  }
});

// Banners públicos
router.get('/banners', async (req, res) => {
  try {
    const banners = await dbAll('SELECT * FROM banners WHERE activo = 1 ORDER BY orden ASC');
    res.json({ success: true, data: banners });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error' });
  }
});

// Políticas públicas
router.get('/politicas', async (req, res) => {
  try {
    const politicas = await dbAll('SELECT titulo, contenido, tipo FROM politicas WHERE activa = 1 ORDER BY orden ASC');
    res.json({ success: true, data: politicas });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error' });
  }
});

// Contacto info público
router.get('/contacto-info', async (req, res) => {
  try {
    const contacto = await dbAll('SELECT * FROM contacto WHERE activo = 1 ORDER BY orden ASC');
    res.json({ success: true, data: contacto });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error' });
  }
});

// Rutas de perfil (requieren auth)
router.get('/perfil',           requireAuth, getPerfil);
router.put('/perfil',           requireAuth, updatePerfil);
router.post('/comentarios',     requireAuth, crearComentario);
router.get('/mis-mensajes',     requireAuth, getMisMensajes);

// ── Alias mis-reservaciones ──────────────────────────────────────────────────
// Usados por mis-reservaciones.html y reservacion-detalle.html
const { getMisReservaciones, getReservacionById, cancelarReservacion } = require('../controllers/reservacionesController');
router.get('/mis-reservaciones',      requireAuth, getMisReservaciones);
router.get('/mis-reservaciones/:id',  requireAuth, getReservacionById);
router.post('/reservaciones/:id/cancelar', requireAuth, cancelarReservacion);

module.exports = router;
