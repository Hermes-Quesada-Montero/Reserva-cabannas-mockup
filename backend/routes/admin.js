/**
 * Rutas del Panel Administrativo
 * Todas requieren rol 'admin'
 */

const express = require('express');
const multer  = require('multer');
const path    = require('path');
const router  = express.Router();
const { requireAdmin } = require('../middleware/auth');
const admin            = require('../controllers/adminController');
const { generarPDF }   = require('../services/pdfService');
const { dbGet, dbRun } = require('../database/db');

// Todas las rutas de admin requieren autenticación admin
router.use(requireAdmin);

// Multer para subida de imágenes en el admin
const imgStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../frontend/public/uploads')),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage: imgStorage, limits: { fileSize: 10 * 1024 * 1024 } });

// ── Dashboard ──────────────────────────────────────────────────────────────────
router.get('/dashboard',          admin.getDashboard);
router.get('/reporte-detallado',  admin.getReporteDetallado);

// ── Usuarios / Clientes (dos alias del mismo endpoint) ────────────────────────
router.get('/usuarios',         admin.getUsuarios);
router.post('/usuarios',        admin.createUsuario);
router.put('/usuarios/:id',     admin.updateUsuario);
router.delete('/usuarios/:id',  admin.deleteUsuario);

// Alias "clientes" — usado por la página admin/usuarios.html
// Forzamos rol=cliente para que no aparezcan admins
router.get('/clientes', (req, res, next) => {
  if (!req.query.rol) req.query.rol = 'cliente';
  next();
}, admin.getUsuarios);
router.get('/clientes/:id',     admin.getUsuarioById);
router.put('/clientes/:id',     admin.updateUsuario);
router.delete('/clientes/:id',  admin.deleteUsuario);

// ── Cabañas ────────────────────────────────────────────────────────────────────
router.get('/cabanas',          admin.getCabanasAdmin);
router.get('/cabanas/:id',      admin.getCabanaById);
router.post('/cabanas',         admin.createCabana);
router.put('/cabanas/:id',      admin.updateCabana);
router.delete('/cabanas/:id',   admin.deleteCabana);

// ── Tarifas ────────────────────────────────────────────────────────────────────
router.get('/tarifas',          admin.getTarifasAdmin);
router.post('/tarifas',         admin.saveTarifa);
router.put('/tarifas/:id',      admin.saveTarifa);
router.delete('/tarifas/:id',   admin.deleteTarifa);

// ── Reservaciones ──────────────────────────────────────────────────────────────
router.get('/reservaciones',            admin.getReservacionesAdmin);
router.put('/reservaciones/:id',        admin.updateReservacionAdmin);
router.delete('/reservaciones/:id',     async (req, res) => {
  try {
    await dbRun('DELETE FROM reservaciones WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Reservación eliminada' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al eliminar' });
  }
});
router.get('/reservaciones/:id/pdf',    async (req, res) => {
  const pdfPath = await generarPDF(req.params.id);
  if (!pdfPath) return res.status(404).json({ success: false, message: 'No se pudo generar PDF' });
  res.json({ success: true, path: pdfPath });
});

// ── Galería ────────────────────────────────────────────────────────────────────
router.get('/galeria',          admin.getGaleriaAdmin);
router.post('/galeria',         admin.saveGaleria);
router.put('/galeria/:id',      admin.saveGaleria);
router.delete('/galeria/:id',   admin.deleteGaleria);

// Subida de imagen
router.post('/upload-imagen', upload.single('imagen'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No se recibió imagen' });
  res.json({ success: true, path: '/uploads/' + req.file.filename });
});

// ── Comentarios ────────────────────────────────────────────────────────────────
router.get('/comentarios',          admin.getComentariosAdmin);
router.put('/comentarios/:id',      admin.updateComentario);
router.delete('/comentarios/:id',   admin.deleteComentario);

// ── FAQs ───────────────────────────────────────────────────────────────────────
router.get('/faqs',             admin.getFaqsAdmin);
router.post('/faqs',            admin.saveFaq);
router.put('/faqs/:id',         admin.saveFaq);
router.delete('/faqs/:id',      admin.deleteFaq);

// ── Cupones ────────────────────────────────────────────────────────────────────
router.get('/cupones',          admin.getCuponesAdmin);
router.post('/cupones',         admin.saveCupon);
router.put('/cupones/:id',      admin.saveCupon);
router.delete('/cupones/:id',   admin.deleteCupon);

// ── Disponibilidad / Bloqueos ──────────────────────────────────────────────────
router.get('/disponibilidad',           admin.getDisponibilidadAdmin);
router.post('/disponibilidad',          admin.saveBloqueo);
router.put('/disponibilidad/:id',       admin.saveBloqueo);
router.delete('/disponibilidad/:id',    admin.deleteBloqueo);

// Alias "bloqueos" — usado por la página admin/disponibilidad.html
router.get('/bloqueos',             admin.getDisponibilidadAdmin);
router.post('/bloqueos',            admin.saveBloqueo);
router.delete('/bloqueos/:id',      admin.deleteBloqueo);

// ── Mensajes de contacto ──────────────────────────────────────────────────────
router.get('/mensajes',             admin.getMensajes);
router.put('/mensajes/:id',         admin.updateMensaje);
router.put('/mensajes/:id/leer',    admin.marcarMensajeLeido);
router.delete('/mensajes/:id',      admin.deleteMensaje);

// ── Banners ────────────────────────────────────────────────────────────────────
router.get('/banners',          admin.getBannersAdmin);
router.post('/banners',         admin.saveBanner);
router.put('/banners/:id',      admin.saveBanner);
router.delete('/banners/:id',   admin.deleteBanner);

// ── Políticas ──────────────────────────────────────────────────────────────────
router.get('/politicas',        admin.getPoliticasAdmin);
router.post('/politicas',       admin.savePolitica);
router.put('/politicas',        admin.savePoliticaPorTipo);  // usado por admin/politicas.html (upsert por tipo)
router.put('/politicas/:id',    admin.savePolitica);
router.delete('/politicas/:id', admin.deletePolitica);

// ── Contacto / Redes sociales ──────────────────────────────────────────────────
router.get('/contacto',         admin.getContactoAdmin);
router.post('/contacto',        admin.saveContacto);
router.put('/contacto/:id',     admin.saveContacto);
router.delete('/contacto/:id',  admin.deleteContacto);

// ── Configuración del sitio ───────────────────────────────────────────────────
router.get('/configuracion',    admin.getConfiguracion);
router.put('/configuracion',    admin.updateConfiguracion);

module.exports = router;
