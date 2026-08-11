/**
 * Controlador de Autenticación
 * Maneja: login, registro, logout, recuperación de contraseña
 */

const bcrypt    = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { dbRun, dbGet } = require('../database/db');

// ─── LOGIN ────────────────────────────────────────────────────────────────────
async function login(req, res) {
  try {
    const { identifier, password, recordarme } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Correo/usuario y contraseña son requeridos' });
    }

    // Buscar por email O username
    const user = await dbGet(
      `SELECT * FROM usuarios WHERE (email = ? OR username = ?) AND activo = 1`,
      [identifier.trim(), identifier.trim()]
    );

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
    }

    // Crear sesión
    req.session.userId   = user.id;
    req.session.userRole = user.rol;
    req.session.userName = `${user.nombre} ${user.apellido}`;

    // "Recordarme" extiende la sesión a 30 días
    if (recordarme) {
      req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
    }

    // Log de actividad
    await dbRun(
      `INSERT INTO log_actividad (usuario_id, accion, detalles, ip) VALUES (?, 'login', ?, ?)`,
      [user.id, 'Inicio de sesión exitoso', req.ip]
    );

    return res.json({
      success: true,
      message: 'Bienvenido/a, ' + user.nombre,
      user: { id: user.id, nombre: user.nombre, apellido: user.apellido, email: user.email, rol: user.rol }
    });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// ─── REGISTRO ─────────────────────────────────────────────────────────────────
async function register(req, res) {
  try {
    const { nombre, apellido, email, password, confirmar_password, telefono } = req.body;

    // Validaciones
    if (!nombre || !apellido || !email || !password) {
      return res.status(400).json({ success: false, message: 'Todos los campos son requeridos' });
    }
    if (password !== confirmar_password) {
      return res.status(400).json({ success: false, message: 'Las contraseñas no coinciden' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Correo electrónico inválido' });
    }

    // Verificar email único
    const existing = await dbGet('SELECT id FROM usuarios WHERE email = ?', [email.trim().toLowerCase()]);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Este correo electrónico ya está registrado' });
    }

    // Cifrar contraseña
    const hashedPassword = await bcrypt.hash(password, 12);

    // Crear usuario
    const result = await dbRun(
      `INSERT INTO usuarios (nombre, apellido, email, password, telefono, rol, activo) VALUES (?, ?, ?, ?, ?, 'cliente', 1)`,
      [nombre.trim(), apellido.trim(), email.trim().toLowerCase(), hashedPassword, telefono || null]
    );

    // Crear perfil cliente
    await dbRun('INSERT INTO clientes (usuario_id) VALUES (?)', [result.lastID]);

    // Auto-login
    req.session.userId   = result.lastID;
    req.session.userRole = 'cliente';
    req.session.userName = `${nombre} ${apellido}`;

    await dbRun(
      `INSERT INTO log_actividad (usuario_id, accion, detalles, ip) VALUES (?, 'registro', ?, ?)`,
      [result.lastID, 'Nuevo cliente registrado', req.ip]
    );

    return res.status(201).json({
      success: true,
      message: '¡Cuenta creada exitosamente! Bienvenido/a.',
      user: { id: result.lastID, nombre, apellido, email: email.trim().toLowerCase(), rol: 'cliente' }
    });
  } catch (err) {
    console.error('Error en registro:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// ─── LOGOUT ───────────────────────────────────────────────────────────────────
function logout(req, res) {
  req.session.destroy((err) => {
    if (err) console.error('Error al cerrar sesión:', err);
    res.clearCookie('connect.sid');
    // Siempre responder JSON — la redirección la maneja el cliente
    res.json({ success: true, message: 'Sesión cerrada' });
  });
}

// ─── VERIFICAR SESIÓN ─────────────────────────────────────────────────────────
async function checkSession(req, res) {
  if (req.session && req.session.userId) {
    const user = await dbGet(
      'SELECT id, nombre, apellido, email, rol FROM usuarios WHERE id = ? AND activo = 1',
      [req.session.userId]
    );
    if (user) {
      return res.json({ success: true, loggedIn: true, user });
    }
  }
  res.json({ success: true, loggedIn: false });
}

// ─── CAMBIAR CONTRASEÑA ───────────────────────────────────────────────────────
async function changePassword(req, res) {
  try {
    const { password_actual, password_nuevo, confirmar_password } = req.body;
    const userId = req.session.userId;

    if (!password_actual || !password_nuevo) {
      return res.status(400).json({ success: false, message: 'Todos los campos son requeridos' });
    }
    if (password_nuevo !== confirmar_password) {
      return res.status(400).json({ success: false, message: 'Las contraseñas no coinciden' });
    }
    if (password_nuevo.length < 6) {
      return res.status(400).json({ success: false, message: 'La nueva contraseña debe tener al menos 6 caracteres' });
    }

    const user = await dbGet('SELECT * FROM usuarios WHERE id = ?', [userId]);
    if (!user || !(await bcrypt.compare(password_actual, user.password))) {
      return res.status(401).json({ success: false, message: 'La contraseña actual es incorrecta' });
    }

    const hashedNew = await bcrypt.hash(password_nuevo, 12);
    await dbRun('UPDATE usuarios SET password = ?, actualizado_en = datetime("now") WHERE id = ?', [hashedNew, userId]);

    res.json({ success: true, message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    console.error('Error al cambiar contraseña:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

module.exports = { login, register, logout, checkSession, changePassword };
