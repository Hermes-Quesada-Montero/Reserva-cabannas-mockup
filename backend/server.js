/**
 * Servidor Principal - Cabañas Los Pinos
 * Sistema de Reservación Completo
 *
 * Para iniciar: npm start  o  npm run dev
 * URL: http://localhost:3001
 * Admin: http://localhost:3001/admin
 */

const express      = require('express');
const session      = require('express-session');
const helmet       = require('helmet');
const cors         = require('cors');
const rateLimit    = require('express-rate-limit');
const path         = require('path');
const fs           = require('fs');
require('dotenv').config();

// Importar inicializador de BD y middleware
const { initDatabase } = require('./database/init');
const { attachUser }   = require('./middleware/auth');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Seguridad ──────────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'", "'unsafe-inline'", 'https://js.stripe.com', 'https://cdn.jsdelivr.net'],
      scriptSrcAttr:  ["'unsafe-inline'"],
      styleSrc:       ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdn.jsdelivr.net'],
      fontSrc:        ["'self'", 'https://fonts.gstatic.com', 'https://cdn.jsdelivr.net'],
      imgSrc:         ["'self'", 'data:', 'blob:', 'https:', 'http:'],
      connectSrc:     ["'self'", 'https:', 'http:'],
      frameSrc:       ["'self'", 'https://js.stripe.com'],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Rate limiting — valor alto para ambiente de prueba/desarrollo
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10000,
  message: { success: false, message: 'Demasiadas solicitudes, intente más tarde' }
}));

app.use(cors({ origin: true, credentials: true }));

// ── Parsers ────────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Sesiones ───────────────────────────────────────────────────────────────────
app.use(session({
  secret:            process.env.SESSION_SECRET || 'cabanas-los-pinos-secret-2024',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   false, // true en producción con HTTPS
    httpOnly: true,
    maxAge:   24 * 60 * 60 * 1000, // 24 horas por defecto
    sameSite: 'lax'
  }
}));

// ── Archivos estáticos ─────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend/public'), {
  maxAge: '1h',
  etag: true
}));

// Adjuntar usuario a todas las respuestas
app.use(attachUser);

// ── Rutas API ──────────────────────────────────────────────────────────────────
const authRoutes         = require('./routes/auth');
const cabanasRoutes      = require('./routes/cabanas');
const reservacionesRoutes = require('./routes/reservaciones');
const clienteRoutes      = require('./routes/cliente');
const adminApiRoutes     = require('./routes/admin');

app.use('/api/auth',         authRoutes);
app.use('/api/cabanas',      cabanasRoutes);
app.use('/api/reservaciones', reservacionesRoutes);
app.use('/api',              clienteRoutes);
app.use('/api/admin',        adminApiRoutes);

// ── Rutas de páginas (SPA-style con HTML) ─────────────────────────────────────
const VIEWS = path.join(__dirname, '../frontend/views');

// Página principal
app.get('/', (req, res) => res.sendFile(path.join(VIEWS, 'index.html')));

// Páginas públicas
app.get('/cabanas',        (req, res) => res.sendFile(path.join(VIEWS, 'cabanas.html')));
app.get('/cabanas/:id',    (req, res) => res.sendFile(path.join(VIEWS, 'cabana-detalle.html')));
app.get('/reservar',       (req, res) => res.sendFile(path.join(VIEWS, 'reservar.html')));
app.get('/galeria',        (req, res) => res.sendFile(path.join(VIEWS, 'galeria.html')));
app.get('/contacto',       (req, res) => res.sendFile(path.join(VIEWS, 'contacto.html')));
app.get('/faq',            (req, res) => res.sendFile(path.join(VIEWS, 'faq.html')));
app.get('/politicas',      (req, res) => res.sendFile(path.join(VIEWS, 'politicas.html')));

// Autenticación cliente
app.get('/login',          (req, res) => res.sendFile(path.join(VIEWS, 'client', 'login.html')));
app.get('/registro',       (req, res) => res.sendFile(path.join(VIEWS, 'client', 'registro.html')));

// Área cliente (estas sí requieren login - se valida en el frontend)
app.get('/mi-cuenta',           (req, res) => res.sendFile(path.join(VIEWS, 'client', 'mi-cuenta.html')));
app.get('/mi-cuenta/reservaciones', (req, res) => res.sendFile(path.join(VIEWS, 'client', 'mis-reservaciones.html')));
app.get('/reservacion/:id',     (req, res) => res.sendFile(path.join(VIEWS, 'client', 'reservacion-detalle.html')));
app.get('/pago/:id',            (req, res) => res.sendFile(path.join(VIEWS, 'client', 'pago.html')));
app.get('/confirmacion/:id',    (req, res) => res.sendFile(path.join(VIEWS, 'client', 'confirmacion.html')));

// Admin login (URL independiente, NO vinculada en el sitio público)
app.get('/admin/login',         (req, res) => res.sendFile(path.join(VIEWS, 'admin', 'login.html')));
app.get('/views/admin/_sidebar.html', (req, res) => res.sendFile(path.join(VIEWS, 'admin', '_sidebar.html')));
app.get('/admin',               (req, res) => res.sendFile(path.join(VIEWS, 'admin', 'dashboard.html')));
app.get('/admin/dashboard',     (req, res) => res.sendFile(path.join(VIEWS, 'admin', 'dashboard.html')));
app.get('/admin/reservaciones', (req, res) => res.sendFile(path.join(VIEWS, 'admin', 'reservaciones.html')));
app.get('/admin/cabanas',       (req, res) => res.sendFile(path.join(VIEWS, 'admin', 'cabanas.html')));
app.get('/admin/usuarios',      (req, res) => res.sendFile(path.join(VIEWS, 'admin', 'usuarios.html')));
app.get('/admin/galeria',       (req, res) => res.sendFile(path.join(VIEWS, 'admin', 'galeria.html')));
app.get('/admin/comentarios',   (req, res) => res.sendFile(path.join(VIEWS, 'admin', 'comentarios.html')));
app.get('/admin/faqs',          (req, res) => res.sendFile(path.join(VIEWS, 'admin', 'faqs.html')));
app.get('/admin/cupones',       (req, res) => res.sendFile(path.join(VIEWS, 'admin', 'cupones.html')));
app.get('/admin/disponibilidad',(req, res) => res.sendFile(path.join(VIEWS, 'admin', 'disponibilidad.html')));
app.get('/admin/mensajes',      (req, res) => res.sendFile(path.join(VIEWS, 'admin', 'mensajes.html')));
app.get('/admin/configuracion', (req, res) => res.sendFile(path.join(VIEWS, 'admin', 'configuracion.html')));
app.get('/admin/banners',       (req, res) => res.sendFile(path.join(VIEWS, 'admin', 'banners.html')));
app.get('/admin/tarifas',       (req, res) => res.sendFile(path.join(VIEWS, 'admin', 'tarifas.html')));
app.get('/admin/contacto',      (req, res) => res.sendFile(path.join(VIEWS, 'admin', 'contacto.html')));

// ── Manejo de errores 404 ─────────────────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'Ruta no encontrada' });
  }
  res.status(404).sendFile(path.join(VIEWS, '404.html'));
});

// ── Manejo de errores globales ────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Error global:', err.stack);
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
  res.status(500).send('<h1>Error interno del servidor</h1>');
});

// ── Iniciar servidor ──────────────────────────────────────────────────────────
(async () => {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log('\n🌲 ══════════════════════════════════════════');
      console.log('🏠  CABAÑAS LOS PINOS - Sistema de Reservación');
      console.log('════════════════════════════════════════════');
      console.log(`🌐 Sitio web:   http://localhost:${PORT}`);
      console.log(`🔐 Admin:       http://localhost:${PORT}/admin`);
      console.log(`📊 API:         http://localhost:${PORT}/api`);
      console.log('────────────────────────────────────────────');
      console.log('👤 Admin user:  admin123');
      console.log('🔑 Admin pass:  1234qwer');
      console.log('════════════════════════════════════════════\n');
    });
  } catch (err) {
    console.error('❌ Error fatal al iniciar:', err);
    process.exit(1);
  }
})();

module.exports = app;
