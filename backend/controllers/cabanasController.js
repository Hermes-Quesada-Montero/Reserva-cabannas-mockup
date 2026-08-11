/**
 * Controlador de Cabañas
 * GET público: listado, detalle, disponibilidad, tarifas
 */

const { dbAll, dbGet } = require('../database/db');

// ─── LISTAR TODAS LAS CABAÑAS ACTIVAS ────────────────────────────────────────
async function getCabanas(req, res) {
  try {
    const cabanas = await dbAll(
      `SELECT c.*,
              MIN(t.precio_noche) AS precio_desde,
              AVG(cm.calificacion) AS calificacion_promedio,
              COUNT(cm.id)        AS total_comentarios
       FROM cabanas c
       LEFT JOIN tarifas t ON t.cabana_id = c.id AND t.activa = 1
       LEFT JOIN comentarios cm ON cm.cabana_id = c.id AND cm.visible = 1 AND cm.aprobado = 1
       WHERE c.activa = 1
       GROUP BY c.id
       ORDER BY c.orden ASC`,
      []
    );
    res.json({ success: true, data: cabanas });
  } catch (err) {
    console.error('Error getCabanas:', err);
    res.status(500).json({ success: false, message: 'Error al obtener cabañas' });
  }
}

// ─── DETALLE DE UNA CABAÑA ───────────────────────────────────────────────────
async function getCabanaById(req, res) {
  try {
    const { id } = req.params;

    const cabana = await dbGet(
      `SELECT c.*,
              AVG(cm.calificacion) AS calificacion_promedio,
              COUNT(cm.id)        AS total_comentarios
       FROM cabanas c
       LEFT JOIN comentarios cm ON cm.cabana_id = c.id AND cm.visible = 1 AND cm.aprobado = 1
       WHERE c.id = ? AND c.activa = 1
       GROUP BY c.id`,
      [id]
    );

    if (!cabana) {
      return res.status(404).json({ success: false, message: 'Cabaña no encontrada' });
    }

    // Tarifas
    const tarifas = await dbAll(
      'SELECT * FROM tarifas WHERE cabana_id = ? AND activa = 1 ORDER BY num_personas ASC',
      [id]
    );

    // Galería
    const galeria = await dbAll(
      'SELECT * FROM galeria WHERE cabana_id = ? AND activa = 1 ORDER BY orden ASC',
      [id]
    );

    // Comentarios aprobados
    const comentarios = await dbAll(
      `SELECT cm.*, u.nombre AS usuario_nombre
       FROM comentarios cm
       LEFT JOIN usuarios u ON u.id = cm.usuario_id
       WHERE cm.cabana_id = ? AND cm.visible = 1 AND cm.aprobado = 1
       ORDER BY cm.creado_en DESC LIMIT 20`,
      [id]
    );

    res.json({
      success: true,
      data: { ...cabana, tarifas, galeria, comentarios }
    });
  } catch (err) {
    console.error('Error getCabanaById:', err);
    res.status(500).json({ success: false, message: 'Error al obtener cabaña' });
  }
}

// ─── DISPONIBILIDAD DE UNA CABAÑA ────────────────────────────────────────────
async function getDisponibilidad(req, res) {
  try {
    const { id } = req.params;
    const { mes, anio } = req.query;

    let sql = `
      SELECT fecha_inicio, fecha_fin, tipo
      FROM disponibilidad
      WHERE cabana_id = ?
    `;
    const params = [id];

    // Filtrar por mes/año si se proporcionan
    if (mes && anio) {
      sql += ` AND (
        (strftime('%Y', fecha_inicio) = ? AND strftime('%m', fecha_inicio) = ?)
        OR (strftime('%Y', fecha_fin) = ? AND strftime('%m', fecha_fin) = ?)
        OR (fecha_inicio <= ? AND fecha_fin >= ?)
      )`;
      const mesStr = mes.toString().padStart(2, '0');
      const inicio = `${anio}-${mesStr}-01`;
      const fin    = `${anio}-${mesStr}-31`;
      params.push(anio, mesStr, anio, mesStr, inicio, fin);
    }

    const bloqueadas = await dbAll(sql, params);
    res.json({ success: true, data: bloqueadas });
  } catch (err) {
    console.error('Error getDisponibilidad:', err);
    res.status(500).json({ success: false, message: 'Error al obtener disponibilidad' });
  }
}

// ─── VERIFICAR DISPONIBILIDAD PARA FECHAS ESPECÍFICAS ────────────────────────
async function verificarDisponibilidad(req, res) {
  try {
    const { cabana_id, fecha_entrada, fecha_salida } = req.query;

    if (!cabana_id || !fecha_entrada || !fecha_salida) {
      return res.status(400).json({ success: false, message: 'Parámetros incompletos' });
    }

    const conflicto = await dbGet(
      `SELECT id FROM disponibilidad
       WHERE cabana_id = ?
         AND fecha_inicio < ?
         AND fecha_fin > ?`,
      [cabana_id, fecha_salida, fecha_entrada]
    );

    res.json({
      success: true,
      disponible: !conflicto,
      message: conflicto ? 'Las fechas seleccionadas no están disponibles' : 'Fechas disponibles'
    });
  } catch (err) {
    console.error('Error verificarDisponibilidad:', err);
    res.status(500).json({ success: false, message: 'Error al verificar disponibilidad' });
  }
}

// ─── OBTENER TARIFA PARA N PERSONAS ─────────────────────────────────────────
async function getTarifa(req, res) {
  try {
    const { cabana_id, num_personas } = req.query;

    if (!cabana_id || !num_personas) {
      return res.status(400).json({ success: false, message: 'Parámetros incompletos' });
    }

    // Buscar tarifa exacta, o la más cercana hacia arriba
    let tarifa = await dbGet(
      'SELECT * FROM tarifas WHERE cabana_id = ? AND num_personas = ? AND activa = 1',
      [cabana_id, parseInt(num_personas)]
    );

    if (!tarifa) {
      tarifa = await dbGet(
        'SELECT * FROM tarifas WHERE cabana_id = ? AND num_personas >= ? AND activa = 1 ORDER BY num_personas ASC LIMIT 1',
        [cabana_id, parseInt(num_personas)]
      );
    }

    if (!tarifa) {
      return res.status(404).json({ success: false, message: 'No hay tarifa disponible para esa cantidad de personas' });
    }

    res.json({ success: true, data: tarifa });
  } catch (err) {
    console.error('Error getTarifa:', err);
    res.status(500).json({ success: false, message: 'Error al obtener tarifa' });
  }
}

module.exports = {
  getCabanas,
  getCabanaById,
  getDisponibilidad,
  verificarDisponibilidad,
  getTarifa
};
