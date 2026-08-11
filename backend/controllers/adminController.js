/**
 * Controlador Administrativo
 * CRUD completo para todas las entidades del sistema
 */

const { dbRun, dbGet, dbAll } = require('../database/db');
const bcrypt = require('bcryptjs');

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
async function getDashboard(req, res) {
  try {
    const { fechaInicio, fechaFin } = req.query;
    const useFiltro = fechaInicio && fechaFin;

    // Cláusula WHERE de fechas para aplicar a reservaciones
    const fechaWhere = useFiltro
      ? "AND DATE(creado_en) BETWEEN DATE(?) AND DATE(?)"
      : "";
    const fechaParams = useFiltro ? [fechaInicio, fechaFin] : [];

    const [
      totalReservas, reservasActivas, reservasCanceladas, reservasCompletadas,
      totalClientes, ingresosTotales, cabanaTop, metodoPagoTop,
      reservasRecientes, proximasReservas
    ] = await Promise.all([
      dbGet(`SELECT COUNT(*) AS total FROM reservaciones WHERE 1=1 ${fechaWhere}`, fechaParams),
      dbGet(`SELECT COUNT(*) AS total FROM reservaciones WHERE estado = 'confirmada' ${fechaWhere}`, fechaParams),
      dbGet(`SELECT COUNT(*) AS total FROM reservaciones WHERE estado = 'cancelada' ${fechaWhere}`, fechaParams),
      dbGet(`SELECT COUNT(*) AS total FROM reservaciones WHERE estado = 'completada' ${fechaWhere}`, fechaParams),
      dbGet(
        `SELECT COUNT(DISTINCT usuario_id) AS total FROM reservaciones WHERE 1=1 ${fechaWhere}`,
        fechaParams
      ),
      dbGet(
        `SELECT COALESCE(SUM(total),0) AS total FROM reservaciones WHERE estado IN ('confirmada','completada') ${fechaWhere}`,
        fechaParams
      ),
      dbGet(
        `SELECT c.nombre, COUNT(r.id) AS total_reservas
         FROM reservaciones r JOIN cabanas c ON c.id = r.cabana_id
         WHERE r.estado NOT IN ('cancelada') ${fechaWhere.replace(/AND DATE\(creado_en\)/g, 'AND DATE(r.creado_en)')}
         GROUP BY r.cabana_id ORDER BY total_reservas DESC LIMIT 1`,
        fechaParams
      ),
      dbGet(`
        SELECT metodo_pago, COUNT(*) AS total
        FROM reservaciones WHERE metodo_pago IS NOT NULL
        GROUP BY metodo_pago ORDER BY total DESC LIMIT 1
      `),
      dbAll(`
        SELECT r.*, c.nombre AS cabana_nombre, u.nombre AS cliente_nombre, u.apellido AS cliente_apellido
        FROM reservaciones r
        JOIN cabanas c ON c.id = r.cabana_id
        JOIN usuarios u ON u.id = r.usuario_id
        ORDER BY r.creado_en DESC LIMIT 10
      `),
      dbAll(`
        SELECT r.*, c.nombre AS cabana_nombre, u.nombre AS cliente_nombre, u.apellido AS cliente_apellido
        FROM reservaciones r
        JOIN cabanas c ON c.id = r.cabana_id
        JOIN usuarios u ON u.id = r.usuario_id
        WHERE r.fecha_entrada >= date('now') AND r.estado NOT IN ('cancelada')
        ORDER BY r.fecha_entrada ASC LIMIT 5
      `)
    ]);

    // Ingresos por mes (últimos 6 meses)
    const ingresosMes = await dbAll(`
      SELECT strftime('%Y-%m', creado_en) AS mes,
             COALESCE(SUM(total), 0) AS total
      FROM reservaciones
      WHERE estado_pago = 'pagado'
        AND creado_en >= date('now', '-6 months')
      GROUP BY mes ORDER BY mes ASC
    `);

    // Reservas por cabaña
    const reservasPorCabana = await dbAll(`
      SELECT c.nombre, COUNT(r.id) AS total
      FROM reservaciones r JOIN cabanas c ON c.id = r.cabana_id
      WHERE r.estado NOT IN ('cancelada')
      GROUP BY r.cabana_id ORDER BY total DESC
    `);

    // Mensajes no leídos
    const mensajesNuevos = await dbGet('SELECT COUNT(*) AS total FROM mensajes_contacto WHERE leido = 0');

    res.json({
      success: true,
      data: {
        stats: {
          totalReservas: totalReservas?.total || 0,
          reservasActivas: reservasActivas?.total || 0,
          reservasCanceladas: reservasCanceladas?.total || 0,
          reservasCompletadas: reservasCompletadas?.total || 0,
          totalClientes: totalClientes?.total || 0,
          ingresosTotales: ingresosTotales?.total || 0,
          cabanaTop: cabanaTop || null,
          metodoPagoTop: metodoPagoTop || null,
          mensajesNuevos: mensajesNuevos?.total || 0
        },
        reservasRecientes,
        proximasReservas,
        graficas: { ingresosMes, reservasPorCabana }
      }
    });
  } catch (err) {
    console.error('Error getDashboard:', err);
    res.status(500).json({ success: false, message: 'Error al obtener datos del dashboard' });
  }
}

// ─── REPORTE DETALLADO ────────────────────────────────────────────────────────
async function getReporteDetallado(req, res) {
  try {
    const { tipo = 'todas', fechaInicio, fechaFin } = req.query;

    const estadoMap = {
      confirmadas: "r.estado = 'confirmada'",
      canceladas:  "r.estado = 'cancelada'",
      ingresos:    "r.estado IN ('confirmada','completada')"
    };

    const condiciones = [];
    if (estadoMap[tipo]) condiciones.push(estadoMap[tipo]);

    const params = [];
    if (fechaInicio && fechaFin) {
      condiciones.push('DATE(r.creado_en) BETWEEN DATE(?) AND DATE(?)');
      params.push(fechaInicio, fechaFin);
    }

    const where = condiciones.length ? 'WHERE ' + condiciones.join(' AND ') : '';

    const filas = await dbAll(
      `SELECT r.numero_reserva, r.fecha_entrada, r.fecha_salida, r.total, r.estado,
              u.nombre AS cliente_nombre, u.apellido AS cliente_apellido,
              c.nombre AS cabana_nombre
       FROM reservaciones r
       JOIN usuarios u ON u.id = r.usuario_id
       JOIN cabanas  c ON c.id = r.cabana_id
       ${where}
       ORDER BY r.creado_en DESC`,
      params
    );

    res.json({ success: true, data: filas });
  } catch (err) {
    console.error('Error getReporteDetallado:', err);
    res.status(500).json({ success: false, message: 'Error al obtener el reporte' });
  }
}

// ─── CRUD USUARIOS ────────────────────────────────────────────────────────────
async function getUsuarios(req, res) {
  try {
    const buscar  = req.query.buscar || req.query.q || '';
    const rol     = req.query.rol || '';
    const estado  = req.query.estado || ''; 
    const page    = parseInt(req.query.page)     || 1;
    const limit   = parseInt(req.query.limit || req.query.per_page) || 20;
    const offset  = (page - 1) * limit;

    let sql = `
      SELECT u.id, u.nombre, u.apellido, u.email, u.telefono, u.rol, u.activo,
             u.identificacion, u.fecha_nacimiento, u.sexo, u.nacionalidad,
             u.creado_en, cl.total_reservas, cl.total_gastado,
             (u.nombre || ' ' || u.apellido) AS nombre_full
      FROM usuarios u
      LEFT JOIN clientes cl ON cl.usuario_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (buscar) {
      sql += ' AND (u.nombre LIKE ? OR u.apellido LIKE ? OR u.email LIKE ? OR u.telefono LIKE ?)';
      params.push(`%${buscar}%`, `%${buscar}%`, `%${buscar}%`, `%${buscar}%`);
    }
    if (rol)    { sql += ' AND u.rol = ?';    params.push(rol); }
    if (estado === 'activo')   { sql += ' AND u.activo = 1'; }
    if (estado === 'inactivo') { sql += ' AND u.activo = 0'; }

    const totalRow = await dbGet(`SELECT COUNT(*) AS total FROM (${sql})`, params);

    const statsActivos    = await dbGet("SELECT COUNT(*) AS n FROM usuarios WHERE activo = 1 AND rol = 'cliente'");
    const statsConReservas = await dbGet('SELECT COUNT(DISTINCT usuario_id) AS n FROM reservaciones');
    const statsMes        = await dbGet(`SELECT COUNT(*) AS n FROM usuarios WHERE rol='cliente' AND creado_en >= date('now','-30 days')`);

    sql += ` ORDER BY u.creado_en DESC LIMIT ${limit} OFFSET ${offset}`;
    const usuarios = await dbAll(sql, params);

    const data = usuarios.map(u => {
      delete u.password;
      return {
        ...u,
        estado:             u.activo === 1 ? 'activo' : 'inactivo',
        created_at:         u.creado_en,
        nombre_completo:    u.nombre_full || `${u.nombre} ${u.apellido}`,
        num_identificacion: u.identificacion,
        total_reservas:     u.total_reservas || 0,
      };
    });

    res.json({
      success: true,
      data,
      total: totalRow?.total || 0,
      stats: {
        total:        totalRow?.total || 0,
        activos:      statsActivos?.n || 0,
        con_reservas: statsConReservas?.n || 0,
        nuevos_mes:   statsMes?.n || 0
      }
    });
  } catch (err) {
    console.error('Error getUsuarios:', err);
    res.status(500).json({ success: false, message: 'Error al obtener usuarios' });
  }
}

async function createUsuario(req, res) {
  try {
    const { nombre, apellido, email, password, telefono, rol, activo } = req.body;
    if (!nombre || !apellido || !email || !password) {
      return res.status(400).json({ success: false, message: 'Campos requeridos: nombre, apellido, email, contraseña' });
    }
    const existing = await dbGet('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (existing) return res.status(409).json({ success: false, message: 'El email ya existe' });

    const hash = await bcrypt.hash(password, 12);
    const result = await dbRun(
      `INSERT INTO usuarios (nombre, apellido, email, password, telefono, rol, activo)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [nombre, apellido, email.toLowerCase(), hash, telefono || null, rol || 'cliente', activo !== false ? 1 : 0]
    );

    if ((rol || 'cliente') === 'cliente') {
      await dbRun('INSERT INTO clientes (usuario_id) VALUES (?)', [result.lastID]);
    }

    res.status(201).json({ success: true, message: 'Usuario creado', id: result.lastID });
  } catch (err) {
    console.error('Error createUsuario:', err);
    res.status(500).json({ success: false, message: 'Error al crear usuario' });
  }
}

async function updateUsuario(req, res) {
  try {
    const { id } = req.params;
    let { nombre, apellido, email, telefono, rol, activo, password, estado,
          nombre_completo, num_identificacion, fecha_nacimiento, sexo, nacionalidad } = req.body;

    if (nombre_completo && (!nombre || !apellido)) {
      const parts = nombre_completo.trim().split(' ');
      nombre   = parts.shift();
      apellido = parts.join(' ') || nombre;
    }

    if (estado !== undefined && activo === undefined) {
      activo = estado === 'activo' ? 1 : 0;
    }

    if (!email) {
      const updates = [];
      const p = [];
      if (activo !== undefined)  { updates.push("activo=?");  p.push(activo ? 1 : 0); }
      if (nombre)               { updates.push("nombre=?");   p.push(nombre); }
      if (apellido)             { updates.push("apellido=?"); p.push(apellido); }
      if (telefono !== undefined){ updates.push("telefono=?"); p.push(telefono || null); }
      updates.push("actualizado_en=datetime('now')");
      p.push(id);
      await dbRun(`UPDATE usuarios SET ${updates.join(',')} WHERE id=?`, p);
      return res.json({ success: true, message: 'Usuario actualizado' });
    }

    let sql = `UPDATE usuarios SET nombre=?, apellido=?, email=?, telefono=?, rol=?, activo=?,
               identificacion=?, fecha_nacimiento=?, sexo=?, nacionalidad=?,
               actualizado_en=datetime('now')`;
    const params = [
      nombre, apellido, email.toLowerCase(), telefono || null,
      rol || 'cliente', activo !== undefined ? (activo ? 1 : 0) : 1,
      num_identificacion || null, fecha_nacimiento || null, sexo || null, nacionalidad || null
    ];

    if (password && password.length >= 6) {
      sql += ', password=?';
      params.push(await bcrypt.hash(password, 12));
    }
    sql += ' WHERE id=?';
    params.push(id);

    await dbRun(sql, params);
    res.json({ success: true, message: 'Usuario actualizado' });
  } catch (err) {
    console.error('Error updateUsuario:', err);
    res.status(500).json({ success: false, message: 'Error al actualizar usuario' });
  }
}

async function deleteUsuario(req, res) {
  try {
    const { id } = req.params;
    const user = await dbGet('SELECT * FROM usuarios WHERE id = ?', [id]);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    if (user.username === 'admin123') return res.status(403).json({ success: false, message: 'No se puede eliminar el administrador principal' });

    await dbRun('UPDATE usuarios SET activo = 0 WHERE id = ?', [id]);
    res.json({ success: true, message: 'Usuario desactivado' });
  } catch (err) {
    console.error('Error deleteUsuario:', err);
    res.status(500).json({ success: false, message: 'Error al eliminar usuario' });
  }
}

// ─── CRUD CABAÑAS ─────────────────────────────────────────────────────────────
async function getCabanasAdmin(req, res) {
  try {
    const { incluir_inactivas } = req.query;
    const cabanas = await dbAll(`
      SELECT c.*, COUNT(r.id) AS total_reservas,
             COALESCE(SUM(CASE WHEN r.estado_pago='pagado' THEN r.total ELSE 0 END),0) AS ingresos
      FROM cabanas c
      LEFT JOIN reservaciones r ON r.cabana_id = c.id
      ${incluir_inactivas ? '' : 'WHERE c.activa = 1'}
      GROUP BY c.id ORDER BY c.orden ASC
    `);
    const data = cabanas.map(c => ({
      ...c,
      habitaciones:     c.num_habitaciones,
      capacidad_maxima: c.capacidad_max,
      estado:           c.estado || (c.activa ? 'disponible' : 'inactiva'),
    }));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al obtener cabañas' });
  }
}

async function createCabana(req, res) {
  try {
    const nombre           = req.body.nombre;
    const descripcion      = req.body.descripcion || '';
    const descripcion_corta= req.body.descripcion_corta || '';
    const num_habitaciones = req.body.num_habitaciones || req.body.habitaciones || 1;
    const capacidad_max    = req.body.capacidad_max || req.body.capacidad_maxima || 2;
    const tiene_piscina    = req.body.tiene_piscina ? 1 : 0;
    const servicios        = req.body.servicios;
    const reglas           = req.body.reglas;
    const imagen_principal = req.body.imagen_principal || '';
    const orden            = req.body.orden || 0;
    const estado           = req.body.estado || 'disponible';
    const result = await dbRun(
      `INSERT INTO cabanas (nombre, descripcion, descripcion_corta, num_habitaciones, capacidad_max, tiene_piscina, servicios, reglas, imagen_principal, orden, activa, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [nombre, descripcion, descripcion_corta, num_habitaciones, capacidad_max,
       tiene_piscina,
       typeof servicios === 'string' ? servicios : JSON.stringify(servicios || []),
       typeof reglas === 'string' ? reglas : JSON.stringify(reglas || []),
       imagen_principal, orden, estado]
    );
    res.status(201).json({ success: true, message: 'Cabaña creada', id: result.lastID });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error al crear cabaña' });
  }
}

async function updateCabana(req, res) {
  try {
    const { id } = req.params;
    const nombre           = req.body.nombre;
    const descripcion      = req.body.descripcion || '';
    const descripcion_corta= req.body.descripcion_corta || '';
    const num_habitaciones = req.body.num_habitaciones || req.body.habitaciones || 1;
    const capacidad_max    = req.body.capacidad_max || req.body.capacidad_maxima || 2;
    const tiene_piscina    = req.body.tiene_piscina ? 1 : 0;
    const servicios        = req.body.servicios;
    const reglas           = req.body.reglas;
    const imagen_principal = req.body.imagen_principal || '';
    const orden            = req.body.orden || 0;
    const estado           = req.body.estado || 'disponible';
    const activa = (estado === 'disponible' || estado === 'mantenimiento') ? 1 : 0;
    await dbRun(
      `UPDATE cabanas SET nombre=?, descripcion=?, descripcion_corta=?, num_habitaciones=?,
       capacidad_max=?, tiene_piscina=?, servicios=?, reglas=?, imagen_principal=?, orden=?, activa=?, estado=?
       WHERE id=?`,
      [nombre, descripcion, descripcion_corta, num_habitaciones, capacidad_max,
       tiene_piscina,
       typeof servicios === 'string' ? servicios : JSON.stringify(servicios || []),
       typeof reglas === 'string' ? reglas : JSON.stringify(reglas || []),
       imagen_principal, orden, activa, estado, id]
    );
    res.json({ success: true, message: 'Cabaña actualizada' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al actualizar cabaña' });
  }
}

async function deleteCabana(req, res) {
  try {
    const { id } = req.params;
    await dbRun('UPDATE cabanas SET activa = 0 WHERE id = ?', [id]);
    res.json({ success: true, message: 'Cabaña desactivada' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al eliminar cabaña' });
  }
}

// ─── CRUD TARIFAS ─────────────────────────────────────────────────────────────
async function getTarifasAdmin(req, res) {
  try {
    const { cabana_id } = req.query;
    let sql = `SELECT t.*, c.nombre AS cabana_nombre FROM tarifas t JOIN cabanas c ON c.id = t.cabana_id WHERE 1=1`;
    const params = [];
    if (cabana_id) { sql += ' AND t.cabana_id = ?'; params.push(cabana_id); }
    sql += ' ORDER BY t.cabana_id, t.num_personas ASC';
    const tarifas = await dbAll(sql, params);
    const data = tarifas.map(t => ({
      ...t,
      temporada:    t.temporada    || 'regular',
      valido_desde: t.valido_desde || null,
      valido_hasta: t.valido_hasta || null,
      estado:       t.activa ? 'activa' : 'inactiva',
    }));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al obtener tarifas' });
  }
}

async function saveTarifa(req, res) {
  try {
    const { id } = req.params;
    const { cabana_id, num_personas, precio_noche, descripcion } = req.body;
    let activa = req.body.activa;
    if (activa === undefined && req.body.estado !== undefined) {
      activa = req.body.estado === 'activa' ? 1 : 0;
    }
    activa = (activa !== false && activa !== 0 && activa !== '0') ? 1 : 0;
    if (id) {
      await dbRun(
        'UPDATE tarifas SET cabana_id=?, num_personas=?, precio_noche=?, descripcion=?, activa=? WHERE id=?',
        [cabana_id, num_personas, precio_noche, descripcion || null, activa, id]
      );
      res.json({ success: true, message: 'Tarifa actualizada' });
    } else {
      const result = await dbRun(
        'INSERT INTO tarifas (cabana_id, num_personas, precio_noche, descripcion, activa) VALUES (?,?,?,?,1)',
        [cabana_id, num_personas, precio_noche, descripcion || null]
      );
      res.status(201).json({ success: true, message: 'Tarifa creada', id: result.lastID });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al guardar tarifa' });
  }
}

async function deleteTarifa(req, res) {
  try {
    const { id } = req.params;
    await dbRun('DELETE FROM tarifas WHERE id = ?', [id]);
    res.json({ success: true, message: 'Tarifa eliminada' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al eliminar tarifa' });
  }
}

// ─── CRUD RESERVACIONES (ADMIN) ───────────────────────────────────────────────
async function getReservacionesAdmin(req, res) {
  try {
    const { estado, cabana_id, buscar, page = 1, limit = 20, desde, hasta } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let sql = `
      SELECT r.*, c.nombre AS cabana_nombre,
             u.nombre AS cliente_nombre, u.apellido AS cliente_apellido, u.email AS cliente_email
      FROM reservaciones r
      JOIN cabanas c ON c.id = r.cabana_id
      JOIN usuarios u ON u.id = r.usuario_id
      WHERE 1=1
    `;
    const params = [];

    if (estado)    { sql += ' AND r.estado = ?'; params.push(estado); }
    if (cabana_id) { sql += ' AND r.cabana_id = ?'; params.push(cabana_id); }
    if (desde)     { sql += ' AND r.fecha_entrada >= ?'; params.push(desde); }
    if (hasta)     { sql += ' AND r.fecha_salida <= ?'; params.push(hasta); }
    if (buscar) {
      sql += ' AND (r.numero_reserva LIKE ? OR u.nombre LIKE ? OR u.email LIKE ?)';
      params.push(`%${buscar}%`, `%${buscar}%`, `%${buscar}%`);
    }

    const totalRow = await dbGet(`SELECT COUNT(*) AS total FROM (${sql})`, params);
    sql += ` ORDER BY r.creado_en DESC LIMIT ${parseInt(limit)} OFFSET ${offset}`;
    const reservaciones = await dbAll(sql, params);

    res.json({ success: true, data: reservaciones, total: totalRow?.total || 0 });
  } catch (err) {
    console.error('Error getReservacionesAdmin:', err);
    res.status(500).json({ success: false, message: 'Error al obtener reservaciones' });
  }
}

async function updateReservacionAdmin(req, res) {
  try {
    const { id } = req.params;
    const { estado, estado_pago, metodo_pago, notas_admin } = req.body;
    await dbRun(
      `UPDATE reservaciones SET estado=?, estado_pago=?, metodo_pago=?, notas_admin=?, actualizado_en=datetime('now') WHERE id=?`,
      [estado, estado_pago, metodo_pago, notas_admin, id]
    );
    if (estado === 'confirmada' && estado_pago === 'pagado') {
      const res_ = await dbGet('SELECT * FROM reservaciones WHERE id = ?', [id]);
      if (res_) {
        await dbRun('UPDATE clientes SET total_gastado = total_gastado + ? WHERE usuario_id = ?', [res_.total, res_.usuario_id]);
      }
    }
    res.json({ success: true, message: 'Reservación actualizada' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al actualizar reservación' });
  }
}

// ─── CRUD GALERÍA ─────────────────────────────────────────────────────────────
async function getGaleriaAdmin(req, res) {
  try {
    const { categoria, cabana_id } = req.query;
    let sql = `
      SELECT g.*, c.nombre AS cabana_nombre
      FROM galeria g LEFT JOIN cabanas c ON c.id = g.cabana_id
      WHERE 1=1
    `;
    const params = [];
    if (categoria) { sql += ' AND g.categoria = ?'; params.push(categoria); }
    if (cabana_id) { sql += ' AND g.cabana_id = ?'; params.push(cabana_id); }
    sql += ' ORDER BY g.orden ASC';
    const galeria = await dbAll(sql, params);
    const data = galeria.map(g => ({ ...g, alt_text: g.alt_text || g.descripcion || '' }));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al obtener galería' });
  }
}

async function saveGaleria(req, res) {
  try {
    const { id } = req.params;
    const { cabana_id, titulo, descripcion, url_imagen, categoria, orden } = req.body;
    const desc = req.body.alt_text || descripcion;
    const activa = (req.body.activa === false || req.body.activa === 0 || req.body.activa === '0') ? 0 : 1;
    if (id) {
      await dbRun(
        'UPDATE galeria SET cabana_id=?, titulo=?, descripcion=?, url_imagen=?, categoria=?, orden=?, activa=? WHERE id=?',
        [cabana_id || null, titulo || null, desc, url_imagen, categoria || 'general', orden || 0, activa, id]
      );
      res.json({ success: true, message: 'Imagen actualizada' });
    } else {
      const result = await dbRun(
        'INSERT INTO galeria (cabana_id, titulo, descripcion, url_imagen, categoria, orden, activa) VALUES (?,?,?,?,?,?,1)',
        [cabana_id || null, titulo || null, desc, url_imagen, categoria || 'general', orden || 0]
      );
      res.status(201).json({ success: true, message: 'Imagen agregada', id: result.lastID });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al guardar imagen' });
  }
}

async function deleteGaleria(req, res) {
  try {
    const { id } = req.params;
    await dbRun('DELETE FROM galeria WHERE id = ?', [id]);
    res.json({ success: true, message: 'Imagen eliminada' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al eliminar imagen' });
  }
}

// ─── CRUD COMENTARIOS ─────────────────────────────────────────────────────────
async function getComentariosAdmin(req, res) {
  try {
    const page    = parseInt(req.query.page)  || 1;
    const limit   = parseInt(req.query.limit) || 20;
    const offset  = (page - 1) * limit;
    let sql = `
      SELECT cm.*, u.nombre AS usuario_nombre, u.email AS usuario_email,
             (u.nombre || ' ' || u.apellido) AS cliente_nombre,
             c.nombre AS cabana_nombre
      FROM comentarios cm
      LEFT JOIN usuarios u ON u.id = cm.usuario_id
      LEFT JOIN cabanas c ON c.id = cm.cabana_id
      WHERE 1=1
    `;
    const params = [];

    const estado = req.query.estado;
    if (estado === 'visible')   { sql += ' AND cm.visible = 1 AND cm.aprobado = 1'; }
    else if (estado === 'oculto')  { sql += ' AND cm.visible = 0'; }
    else if (estado === 'pendiente') { sql += ' AND cm.aprobado = 0 AND cm.visible = 1'; }

    if (req.query.aprobado !== undefined) { sql += ' AND cm.aprobado = ?'; params.push(req.query.aprobado); }
    if (req.query.visible  !== undefined && !estado) { sql += ' AND cm.visible = ?'; params.push(req.query.visible); }
    if (req.query.calificacion) { sql += ' AND cm.calificacion = ?'; params.push(parseInt(req.query.calificacion)); }
    if (req.query.cabana_id)    { sql += ' AND cm.cabana_id = ?'; params.push(req.query.cabana_id); }

    const totalRow = await dbGet(`SELECT COUNT(*) AS total FROM (${sql})`, params);

    const statsTotal    = await dbGet('SELECT COUNT(*) AS n FROM comentarios');
    const statsVisibles = await dbGet('SELECT COUNT(*) AS n FROM comentarios WHERE visible = 1 AND aprobado = 1');
    const statsOcultos  = await dbGet('SELECT COUNT(*) AS n FROM comentarios WHERE visible = 0');
    const statsProm     = await dbGet('SELECT AVG(calificacion) AS n FROM comentarios WHERE visible = 1');

    sql += ` ORDER BY cm.creado_en DESC LIMIT ${limit} OFFSET ${offset}`;
    const comentarios = await dbAll(sql, params);

    const data = comentarios.map(c => ({
      ...c,
      estado: (c.visible === 1 && c.aprobado === 1) ? 'visible' : 'oculto',
      cliente_nombre: c.cliente_nombre || c.usuario_nombre || 'Cliente anónimo',
    }));

    res.json({
      success: true,
      data,
      total: totalRow?.total || 0,
      stats: {
        total:    statsTotal?.n   || 0,
        visibles: statsVisibles?.n || 0,
        ocultos:  statsOcultos?.n  || 0,
        promedio: statsProm?.n     || null
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al obtener comentarios' });
  }
}

async function updateComentario(req, res) {
  try {
    const { id } = req.params;
    let { visible, aprobado, estado } = req.body;
    if (estado !== undefined) {
      visible  = estado === 'visible' ? 1 : 0;
      aprobado = estado === 'visible' ? 1 : 0;
    }
    await dbRun(
      'UPDATE comentarios SET visible=?, aprobado=? WHERE id=?',
      [visible ? 1 : 0, aprobado ? 1 : 0, id]
    );
    res.json({ success: true, message: 'Comentario actualizado' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al actualizar comentario' });
  }
}

async function deleteComentario(req, res) {
  try {
    const { id } = req.params;
    await dbRun('DELETE FROM comentarios WHERE id = ?', [id]);
    res.json({ success: true, message: 'Comentario eliminado' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al eliminar comentario' });
  }
}

// ─── CRUD FAQs ────────────────────────────────────────────────────────────────
async function getFaqsAdmin(req, res) {
  try {
    const faqs = await dbAll('SELECT * FROM faqs ORDER BY orden ASC');
    res.json({ success: true, data: faqs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al obtener FAQs' });
  }
}

async function saveFaq(req, res) {
  try {
    const { id } = req.params;
    const { pregunta, respuesta, categoria, orden } = req.body;
    const activa = (req.body.activa === false || req.body.activa === 0 || req.body.activa === '0') ? 0 : 1;
    if (id) {
      await dbRun('UPDATE faqs SET pregunta=?, respuesta=?, categoria=?, orden=?, activa=? WHERE id=?',
        [pregunta, respuesta, categoria || 'general', orden || 0, activa, id]);
      res.json({ success: true, message: 'FAQ actualizada' });
    } else {
      const result = await dbRun('INSERT INTO faqs (pregunta, respuesta, categoria, orden, activa) VALUES (?,?,?,?,1)',
        [pregunta, respuesta, categoria || 'general', orden || 0]);
      res.status(201).json({ success: true, message: 'FAQ creada', id: result.lastID });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al guardar FAQ' });
  }
}

async function deleteFaq(req, res) {
  try {
    await dbRun('DELETE FROM faqs WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'FAQ eliminada' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al eliminar FAQ' });
  }
}

// ─── CRUD CUPONES ─────────────────────────────────────────────────────────────
async function getCuponesAdmin(req, res) {
  try {
    const cupones = await dbAll('SELECT * FROM cupones ORDER BY creado_en DESC');
    const data = cupones.map(c => {
      const tipoNorm = c.tipo === 'monto_fijo' ? 'fijo' : (c.tipo || 'porcentaje');
      return {
        ...c,
        tipo_descuento:  tipoNorm,
        valor_descuento: c.valor,
        monto_minimo:    c.minimo_reserva,
        usos_maximos:    c.maximo_usos,
        valido_desde:    c.fecha_inicio,
        valido_hasta:    c.fecha_fin,
        estado:          c.activo ? 'activo' : 'inactivo'
      };
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al obtener cupones' });
  }
}

async function saveCupon(req, res) {
  try {
    const { id } = req.params;
    let activo = req.body.activo;
    if (activo === undefined && req.body.estado !== undefined) {
      activo = req.body.estado === 'activo' ? 1 : 0;
    }
    activo = (activo !== false && activo !== 0 && activo !== '0') ? 1 : 0;

    if (id && req.body.codigo === undefined) {
      await dbRun('UPDATE cupones SET activo=? WHERE id=?', [activo, id]);
      return res.json({ success: true, message: 'Estado del cupón actualizado' });
    }

    const codigo        = req.body.codigo;
    const descripcion   = req.body.descripcion;
    const tipoRaw = req.body.tipo || req.body.tipo_descuento;
    const tipo = tipoRaw === 'fijo' ? 'monto_fijo' : tipoRaw;
    const valor         = req.body.valor         !== undefined ? req.body.valor : req.body.valor_descuento;
    const minimo_reserva = req.body.minimo_reserva !== undefined ? req.body.minimo_reserva : (req.body.monto_minimo || 0);
    const usosRaw     = req.body.maximo_usos !== undefined ? req.body.maximo_usos : (req.body.usos_maximos !== undefined ? req.body.usos_maximos : 100);
    const maximo_usos = (usosRaw === -1 || usosRaw === '-1') ? 0 : (parseInt(usosRaw) || 0);
    const fecha_inicio  = req.body.fecha_inicio  || req.body.valido_desde || null;
    const fecha_fin     = req.body.fecha_fin     || req.body.valido_hasta  || null;

    if (id) {
      await dbRun(
        'UPDATE cupones SET codigo=?, descripcion=?, tipo=?, valor=?, minimo_reserva=?, maximo_usos=?, fecha_inicio=?, fecha_fin=?, activo=? WHERE id=?',
        [codigo?.toUpperCase(), descripcion, tipo, valor, minimo_reserva, maximo_usos, fecha_inicio, fecha_fin, activo, id]
      );
      res.json({ success: true, message: 'Cupón actualizado' });
    } else {
      const existing = await dbGet('SELECT id FROM cupones WHERE codigo = ?', [codigo?.toUpperCase()]);
      if (existing) return res.status(409).json({ success: false, message: 'El código ya existe' });
      const result = await dbRun(
        'INSERT INTO cupones (codigo, descripcion, tipo, valor, minimo_reserva, maximo_usos, fecha_inicio, fecha_fin, activo) VALUES (?,?,?,?,?,?,?,?,?)',
        [codigo?.toUpperCase(), descripcion, tipo, valor, minimo_reserva, maximo_usos, fecha_inicio, fecha_fin, activo]
      );
      res.status(201).json({ success: true, message: 'Cupón creado', id: result.lastID });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al guardar cupón' });
  }
}

async function deleteCupon(req, res) {
  try {
    await dbRun('DELETE FROM cupones WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Cupón eliminado' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al eliminar cupón' });
  }
}

// ─── CRUD CONFIGURACIÓN ───────────────────────────────────────────────────────
async function getConfiguracion(req, res) {
  try {
    const configs = await dbAll('SELECT * FROM configuracion ORDER BY clave ASC');
    const obj = {};
    configs.forEach(c => { obj[c.clave] = c.valor; });
    res.json({ success: true, data: obj, raw: configs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al obtener configuración' });
  }
}

async function updateConfiguracion(req, res) {
  try {
    const { configs } = req.body;
    for (const [clave, valor] of Object.entries(configs)) {
      await dbRun(
        `INSERT INTO configuracion (clave, valor, actualizado_en)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(clave) DO UPDATE SET valor=excluded.valor, actualizado_en=excluded.actualizado_en`,
        [clave, valor]
      );
    }
    res.json({ success: true, message: 'Configuración guardada' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al guardar configuración' });
  }
}

// ─── DISPONIBILIDAD ADMIN ─────────────────────────────────────────────────────
async function getDisponibilidadAdmin(req, res) {
  try {
    const { cabana_id, tipo, desde, hasta, year, month } = req.query;
    let sql = `
      SELECT d.*, c.nombre AS cabana_nombre, r.numero_reserva
      FROM disponibilidad d
      JOIN cabanas c ON c.id = d.cabana_id
      LEFT JOIN reservaciones r ON r.id = d.reserva_id
      WHERE 1=1
    `;
    const params = [];
    if (cabana_id) { sql += ' AND d.cabana_id = ?'; params.push(cabana_id); }
    if (tipo)      { sql += ' AND d.tipo = ?'; params.push(tipo); }
    if (desde)     { sql += ' AND d.fecha_fin >= ?'; params.push(desde); }
    if (hasta)     { sql += ' AND d.fecha_inicio <= ?'; params.push(hasta); }
    if (year && month) {
      const y = parseInt(year); const m = parseInt(month);
      const primerDia = `${y}-${String(m).padStart(2,'0')}-01`;
      const ultimoDia = new Date(y, m, 0).toISOString().split('T')[0];
      sql += ' AND d.fecha_inicio <= ? AND d.fecha_fin >= ?';
      params.push(ultimoDia, primerDia);
    }
    sql += ' ORDER BY d.fecha_inicio ASC';
    const disp = await dbAll(sql, params);
    res.json({ success: true, data: disp });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al obtener disponibilidad' });
  }
}

async function saveBloqueo(req, res) {
  try {
    const { id } = req.params;
    const { cabana_id, fecha_inicio, fecha_fin, tipo, notas } = req.body;
    if (id) {
      await dbRun(
        'UPDATE disponibilidad SET cabana_id=?, fecha_inicio=?, fecha_fin=?, tipo=?, notas=? WHERE id=?',
        [cabana_id, fecha_inicio, fecha_fin, tipo || 'bloqueado', notas, id]
      );
      res.json({ success: true, message: 'Bloqueo actualizado' });
    } else {
      const result = await dbRun(
        'INSERT INTO disponibilidad (cabana_id, fecha_inicio, fecha_fin, tipo, notas) VALUES (?,?,?,?,?)',
        [cabana_id, fecha_inicio, fecha_fin, tipo || 'bloqueado', notas]
      );
      res.status(201).json({ success: true, message: 'Bloqueo creado', id: result.lastID });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al guardar bloqueo' });
  }
}

async function deleteBloqueo(req, res) {
  try {
    await dbRun('DELETE FROM disponibilidad WHERE id = ? AND reserva_id IS NULL', [req.params.id]);
    res.json({ success: true, message: 'Bloqueo eliminado' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al eliminar bloqueo' });
  }
}

// ─── MENSAJES DE CONTACTO ─────────────────────────────────────────────────────
async function getMensajes(req, res) {
  try {
    const { q, estado, fechaInicio, fechaFin } = req.query;
    let sql = 'SELECT * FROM mensajes_contacto WHERE 1=1';
    const params = [];
    if (q)                   { sql += ' AND (nombre LIKE ? OR email LIKE ? OR asunto LIKE ? OR mensaje LIKE ?)'; params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }
    if (estado)              { sql += ' AND estado = ?'; params.push(estado); }
    if (fechaInicio && fechaFin) { sql += ' AND DATE(creado_en) BETWEEN DATE(?) AND DATE(?)'; params.push(fechaInicio, fechaFin); }
    sql += ' ORDER BY creado_en DESC';
    const mensajes = await dbAll(sql, params);

    const stats = {
      total:        (await dbGet('SELECT COUNT(*) AS n FROM mensajes_contacto'))?.n || 0,
      nuevos:       (await dbGet("SELECT COUNT(*) AS n FROM mensajes_contacto WHERE estado = 'nuevo'"))?.n || 0,
      respondidos:  (await dbGet("SELECT COUNT(*) AS n FROM mensajes_contacto WHERE estado = 'respondido'"))?.n || 0,
    };

    const data = mensajes.map(m => ({ ...m, created_at: m.creado_en }));
    res.json({ success: true, data, stats });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al obtener mensajes' });
  }
}

async function marcarMensajeLeido(req, res) {
  try {
    await dbRun('UPDATE mensajes_contacto SET leido = 1 WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Marcado como leído' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error' });
  }
}

async function deleteMensaje(req, res) {
  try {
    await dbRun('DELETE FROM mensajes_contacto WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Mensaje eliminado' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al eliminar mensaje' });
  }
}

// ─── CRUD BANNERS ─────────────────────────────────────────────────────────────
async function getBannersAdmin(req, res) {
  try {
    const banners = await dbAll('SELECT * FROM banners ORDER BY orden ASC');
    res.json({ success: true, data: banners });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al obtener banners' });
  }
}

async function saveBanner(req, res) {
  try {
    const { id } = req.params;
    const { titulo, subtitulo, url_imagen, url_boton, texto_boton, btn_texto_2, orden } = req.body;
    const activo = (req.body.activo === false || req.body.activo === 0 || req.body.activo === '0') ? 0 : 1;
    if (id) {
      await dbRun(
        'UPDATE banners SET titulo=?, subtitulo=?, url_imagen=?, url_boton=?, texto_boton=?, btn_texto_2=?, orden=?, activo=? WHERE id=?',
        [titulo, subtitulo, url_imagen, url_boton, texto_boton, btn_texto_2 || null, orden || 0, activo, id]
      );
      res.json({ success: true, message: 'Banner actualizado' });
    } else {
      const result = await dbRun(
        'INSERT INTO banners (titulo, subtitulo, url_imagen, url_boton, texto_boton, btn_texto_2, orden, activo) VALUES (?,?,?,?,?,?,?,1)',
        [titulo, subtitulo, url_imagen, url_boton, texto_boton, btn_texto_2 || null, orden || 0]
      );
      res.status(201).json({ success: true, message: 'Banner creado', id: result.lastID });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al guardar banner' });
  }
}

async function deleteBanner(req, res) {
  try {
    await dbRun('DELETE FROM banners WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Banner eliminado' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al eliminar banner' });
  }
}

// ─── CRUD POLÍTICAS ───────────────────────────────────────────────────────────
async function getPoliticasAdmin(req, res) {
  try {
    const politicas = await dbAll('SELECT * FROM politicas ORDER BY orden ASC');
    res.json({ success: true, data: politicas });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al obtener políticas' });
  }
}

async function savePolitica(req, res) {
  try {
    const { id } = req.params;
    const { titulo, contenido, tipo, orden, activa } = req.body;
    if (id) {
      await dbRun('UPDATE politicas SET titulo=?, contenido=?, tipo=?, orden=?, activa=? WHERE id=?',
        [titulo, contenido, tipo || 'general', orden || 0, activa !== false ? 1 : 0, id]);
      res.json({ success: true, message: 'Política actualizada' });
    } else {
      const result = await dbRun('INSERT INTO politicas (titulo, contenido, tipo, orden, activa) VALUES (?,?,?,?,1)',
        [titulo, contenido, tipo || 'general', orden || 0]);
      res.status(201).json({ success: true, message: 'Política creada', id: result.lastID });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al guardar política' });
  }
}

async function deletePolitica(req, res) {
  try {
    await dbRun('DELETE FROM politicas WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Política eliminada' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al eliminar política' });
  }
}

// ─── CRUD CONTACTO ────────────────────────────────────────────────────────────
async function getContactoAdmin(req, res) {
  try {
    const contacto = await dbAll('SELECT * FROM contacto ORDER BY orden ASC');
    res.json({ success: true, data: contacto });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al obtener contacto' });
  }
}

async function saveContacto(req, res) {
  try {
    const { id } = req.params;
    const { tipo, valor, descripcion, icono, activo, orden } = req.body;
    if (id) {
      await dbRun('UPDATE contacto SET tipo=?, valor=?, descripcion=?, icono=?, activo=?, orden=? WHERE id=?',
        [tipo, valor, descripcion, icono, activo !== false ? 1 : 0, orden || 0, id]);
      res.json({ success: true, message: 'Contacto actualizado' });
    } else {
      const result = await dbRun('INSERT INTO contacto (tipo, valor, descripcion, icono, activo, orden) VALUES (?,?,?,?,1,?)',
        [tipo, valor, descripcion, icono, orden || 0]);
      res.status(201).json({ success: true, message: 'Contacto creado', id: result.lastID });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al guardar contacto' });
  }
}

async function deleteContacto(req, res) {
  try {
    await dbRun('DELETE FROM contacto WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Contacto eliminado' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al eliminar contacto' });
  }
}

async function getUsuarioById(req, res) {
  try {
    const { id } = req.params;
    const u = await dbGet(`
      SELECT u.id, u.nombre, u.apellido, u.email, u.telefono, u.rol, u.activo,
             u.identificacion, u.fecha_nacimiento, u.sexo, u.nacionalidad,
             u.creado_en, cl.total_reservas, cl.total_gastado,
             (u.nombre || ' ' || u.apellido) AS nombre_completo
      FROM usuarios u
      LEFT JOIN clientes cl ON cl.usuario_id = u.id
      WHERE u.id = ?`, [id]);
    if (!u) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    const reservas = await dbAll(`
      SELECT r.id, r.numero_reserva, r.fecha_entrada, r.fecha_salida, r.total, r.estado, c.nombre AS cabana_nombre
      FROM reservaciones r JOIN cabanas c ON c.id = r.cabana_id
      WHERE r.usuario_id = ?
      ORDER BY r.fecha_entrada DESC LIMIT 10`, [id]);

    res.json({ success: true, data: {
      ...u,
      estado:           u.activo === 1 ? 'activo' : 'inactivo',
      num_identificacion: u.identificacion,
      reservas
    }});
  } catch(err) {
    res.status(500).json({ success: false, message: 'Error al obtener usuario' });
  }
}

async function getCabanaById(req, res) {
  try {
    const cabana = await dbGet('SELECT * FROM cabanas WHERE id = ?', [req.params.id]);
    if (!cabana) return res.status(404).json({ success: false, message: 'Cabaña no encontrada' });
    res.json({ success: true, data: {
      ...cabana,
      habitaciones:     cabana.num_habitaciones,
      capacidad_maxima: cabana.capacidad_max,
      estado:           cabana.estado || (cabana.activa ? 'disponible' : 'inactiva'),
      tiene_piscina:    cabana.tiene_piscina ? 1 : 0,
    }});
  } catch(err) {
    res.status(500).json({ success: false, message: 'Error al obtener cabaña' });
  }
}

// ── Función extra: actualizar mensaje (estado + nota + respuesta) ─────────────
async function updateMensaje(req, res) {
  try {
    const { id } = req.params;
    const { estado, nota_admin, respuesta_admin } = req.body;

    // Se obtiene el mensaje actual para no sobreescribir datos accidentalmente con null
    const msj = await dbGet('SELECT * FROM mensajes_contacto WHERE id = ?', [id]);
    if (!msj) return res.status(404).json({ success: false, message: 'Mensaje no encontrado' });

    let nuevoEstado = estado || msj.estado;
    const nuevaNota = nota_admin !== undefined ? nota_admin : msj.nota_admin;
    
    let nuevaRespuesta = msj.respuesta_admin;
    let nuevoRespondidoEn = msj.respondido_en;
    let nuevoRespondido = msj.respondido;

    // Lógica 100% segura para registrar la respuesta y cambiar a respondido
    if (respuesta_admin !== undefined && String(respuesta_admin).trim() !== '') {
        nuevaRespuesta = String(respuesta_admin).trim();
        nuevoRespondido = 1;
        nuevoEstado = 'respondido'; // Fuerza el estado a respondido visualmente
        if (!nuevoRespondidoEn) nuevoRespondidoEn = new Date().toISOString();
    } else if (nuevoEstado === 'respondido') {
        nuevoRespondido = 1;
    }

    await dbRun(
      `UPDATE mensajes_contacto 
       SET estado = ?, nota_admin = ?, respuesta_admin = ?, respondido_en = ?, respondido = ? 
       WHERE id = ?`,
      [nuevoEstado, nuevaNota, nuevaRespuesta, nuevoRespondidoEn, nuevoRespondido, id]
    );

    res.json({ success: true, message: 'Mensaje actualizado correctamente' });
  } catch(err) {
    console.error('Error updateMensaje:', err);
    res.status(500).json({ success: false, message: 'Error al actualizar mensaje' });
  }
}

async function savePoliticaPorTipo(req, res) {
  try {
    const { tipo, titulo, contenido, activa } = req.body;
    if (!tipo) return res.status(400).json({ success: false, message: 'El campo tipo es requerido' });

    const existing = await dbGet('SELECT id FROM politicas WHERE tipo = ?', [tipo]);
    if (existing) {
      await dbRun(
        `UPDATE politicas SET titulo = ?, contenido = ?, activa = ?, actualizado_en = datetime('now') WHERE tipo = ?`,
        [titulo, contenido, activa !== undefined ? activa : 1, tipo]
      );
    } else {
      await dbRun(
        `INSERT INTO politicas (tipo, titulo, contenido, activa) VALUES (?, ?, ?, ?)`,
        [tipo, titulo, contenido, activa !== undefined ? activa : 1]
      );
    }
    res.json({ success: true, message: 'Política guardada' });
  } catch(err) {
    res.status(500).json({ success: false, message: 'Error al guardar política' });
  }
}

module.exports = {
  getDashboard,
  getReporteDetallado,
  getUsuarios, createUsuario, updateUsuario, deleteUsuario,
  getUsuarioById,
  getCabanasAdmin, getCabanaById, createCabana, updateCabana, deleteCabana,
  getTarifasAdmin, saveTarifa, deleteTarifa,
  getReservacionesAdmin, updateReservacionAdmin,
  getGaleriaAdmin, saveGaleria, deleteGaleria,
  getComentariosAdmin, updateComentario, deleteComentario,
  getFaqsAdmin, saveFaq, deleteFaq,
  getCuponesAdmin, saveCupon, deleteCupon,
  getConfiguracion, updateConfiguracion,
  getDisponibilidadAdmin, saveBloqueo, deleteBloqueo,
  getMensajes, marcarMensajeLeido, updateMensaje, deleteMensaje,
  getBannersAdmin, saveBanner, deleteBanner,
  getPoliticasAdmin, savePolitica, savePoliticaPorTipo, deletePolitica,
  getContactoAdmin, saveContacto, deleteContacto
};