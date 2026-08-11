/**
 * Middleware de autenticación y autorización
 * Protege rutas tanto del cliente como del administrador
 */

/**
 * Verifica que el usuario esté autenticado
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(401).json({ 
      success: false, 
      message: 'Debes iniciar sesión para continuar',
      requireLogin: true 
    });
  }
  res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
}

/**
 * Verifica que el usuario tenga rol de administrador
 */
function requireAdmin(req, res, next) {
  if (req.session && req.session.userId && req.session.userRole === 'admin') {
    return next();
  }
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(401).json({
      success: false,
      message: 'Sesión expirada. Inicia sesión nuevamente.',
      requireLogin: true
    });
  }
  res.redirect('/admin/login');
}

/**
 * Verifica que el usuario tenga rol de cliente
 */
function requireCliente(req, res, next) {
  if (req.session && req.session.userId && req.session.userRole === 'cliente') {
    return next();
  }
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(401).json({ 
      success: false, 
      message: 'Debes iniciar sesión para continuar',
      requireLogin: true
    });
  }
  res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
}

/**
 * Adjunta información del usuario a res.locals (para vistas)
 */
async function attachUser(req, res, next) {
  const { dbGet } = require('../database/db');
  res.locals.user = null;
  res.locals.isAdmin = false;
  res.locals.isLoggedIn = false;

  if (req.session && req.session.userId) {
    try {
      const user = await dbGet(
        'SELECT id, nombre, apellido, email, rol, foto_perfil FROM usuarios WHERE id = ? AND activo = 1',
        [req.session.userId]
      );
      if (user) {
        res.locals.user = user;
        res.locals.isAdmin = user.rol === 'admin';
        res.locals.isLoggedIn = true;
      }
    } catch (_) { /* silenciar error */ }
  }
  next();
}

module.exports = { requireAuth, requireAdmin, requireCliente, attachUser };
