/**
 * Controlador de Perfil y Comentarios del Cliente
 */

const { dbRun, dbGet, dbAll } = require('../database/db');
const sanitizeHtml = require('sanitize-html');

// ─── OBTENER PERFIL ───────────────────────────────────────────────────────────
async function getPerfil(req, res) {
  try {
    const userId = req.session.userId;
    const user = await dbGet(
      `SELECT u.id, u.nombre, u.apellido, u.email, u.username, u.telefono,
              u.identificacion, u.fecha_nacimiento, u.sexo, u.nacionalidad, u.foto_perfil,
              cl.ciudad, cl.pais, cl.total_reservas, cl.total_gastado
       FROM usuarios u
       LEFT JOIN clientes cl ON cl.usuario_id = u.id
       WHERE u.id = ? AND u.activo = 1`,
      [userId]
    );
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    res.json({ success: true, data: user });
  } catch (err) {
    console.error('Error getPerfil:', err);
    res.status(500).json({ success: false, message: 'Error al obtener perfil' });
  }
}

// ─── ACTUALIZAR PERFIL ────────────────────────────────────────────────────────
async function updatePerfil(req, res) {
  try {
    const userId = req.session.userId;
    const { nombre, apellido, telefono, identificacion, fecha_nacimiento, sexo, nacionalidad, ciudad, pais } = req.body;

    await dbRun(
      `UPDATE usuarios SET nombre=?, apellido=?, telefono=?, identificacion=?, fecha_nacimiento=?,
       sexo=?, nacionalidad=?, actualizado_en=datetime('now') WHERE id=?`,
      [nombre, apellido, telefono || null, identificacion || null, fecha_nacimiento || null, sexo || null, nacionalidad || 'Costarricense', userId]
    );

    await dbRun(
      `UPDATE clientes SET ciudad=?, pais=? WHERE usuario_id=?`,
      [ciudad || null, pais || 'Costa Rica', userId]
    );

    res.json({ success: true, message: 'Perfil actualizado correctamente' });
  } catch (err) {
    console.error('Error updatePerfil:', err);
    res.status(500).json({ success: false, message: 'Error al actualizar perfil' });
  }
}

// ─── CREAR COMENTARIO ─────────────────────────────────────────────────────────
async function crearComentario(req, res) {
  try {
    const userId = req.session.userId;
    const { cabana_id, reservacion_id, calificacion, comentario, nombre_publico } = req.body;

    if (!calificacion || !comentario) {
      return res.status(400).json({ success: false, message: 'Calificación y comentario son requeridos' });
    }
    if (calificacion < 1 || calificacion > 5) {
      return res.status(400).json({ success: false, message: 'La calificación debe ser entre 1 y 5' });
    }

    const cleanComment = sanitizeHtml(comentario, { allowedTags: [], allowedAttributes: {} });

    const result = await dbRun(
      `INSERT INTO comentarios (usuario_id, cabana_id, reservacion_id, calificacion, comentario, nombre_publico, visible, aprobado)
       VALUES (?, ?, ?, ?, ?, ?, 1, 0)`,
      [userId, cabana_id || null, reservacion_id || null, calificacion, cleanComment, nombre_publico || 'Huésped anónimo']
    );

    res.status(201).json({
      success: true,
      message: 'Comentario enviado. Será visible una vez aprobado por el administrador.',
      id: result.lastID
    });
  } catch (err) {
    console.error('Error crearComentario:', err);
    res.status(500).json({ success: false, message: 'Error al enviar comentario' });
  }
}

// ─── ENVIAR MENSAJE DE CONTACTO (público) ────────────────────────────────────
async function enviarContacto(req, res) {
  try {
    const { nombre, email, telefono, asunto, mensaje } = req.body;
    if (!nombre || !email || !mensaje) {
      return res.status(400).json({ success: false, message: 'Nombre, email y mensaje son requeridos' });
    }

    const cleanMsg = sanitizeHtml(mensaje, { allowedTags: [], allowedAttributes: {} });
    
    // Si hay sesión activa, vincular el mensaje al usuario
    let usuario_id = req.session?.userId || null;

    // TRUCO: Auto-vincular el mensaje si la persona envió el formulario desde
    // la página pública de contacto pero ya estaba registrada con ese correo.
    if (!usuario_id) {
        const user = await dbGet('SELECT id FROM usuarios WHERE email = ?', [email.trim().toLowerCase()]);
        if (user) {
            usuario_id = user.id;
        }
    }

    await dbRun(
      'INSERT INTO mensajes_contacto (nombre, email, telefono, asunto, mensaje, usuario_id) VALUES (?,?,?,?,?,?)',
      [nombre.trim(), email.trim().toLowerCase(), telefono || null, asunto || 'Consulta general', cleanMsg, usuario_id]
    );

    res.json({ success: true, message: '¡Mensaje enviado! Nos pondremos en contacto pronto.' });
  } catch (err) {
    console.error('Error enviarContacto:', err);
    res.status(500).json({ success: false, message: 'Error al enviar mensaje' });
  }
}

// ─── MIS MENSAJES (cliente autenticado) ──────────────────────────────────────
async function getMisMensajes(req, res) {
  try {
    const usuario_id = req.session?.userId;
    if (!usuario_id) return res.status(401).json({ success: false, message: 'No autenticado' });

    const mensajes = await dbAll(
      `SELECT id, asunto, mensaje, estado, respuesta_admin, respondido_en, creado_en
       FROM mensajes_contacto
       WHERE usuario_id = ?
       ORDER BY creado_en DESC`,
      [usuario_id]
    );
    res.json({ success: true, data: mensajes });
  } catch (err) {
    console.error('Error getMisMensajes:', err);
    res.status(500).json({ success: false, message: 'Error al obtener mensajes' });
  }
}

module.exports = { getPerfil, updatePerfil, crearComentario, enviarContacto, getMisMensajes };