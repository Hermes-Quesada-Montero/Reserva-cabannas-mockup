/**
 * Controlador de Reservaciones
 * Crea, consulta, cancela y gestiona reservaciones con sus huéspedes
 */

const { dbRun, dbGet, dbAll } = require('../database/db');
const { v4: uuidv4 }          = require('uuid');
const { generarPDF }          = require('../services/pdfService');
const { generarQR }           = require('../services/qrService');
const { generarICS }          = require('../services/icsService');

// ─── GENERAR NÚMERO DE RESERVA ÚNICO ─────────────────────────────────────────
function generarNumeroReserva() {
  const now  = new Date();
  const year = now.getFullYear();
  const rand = Math.floor(Math.random() * 90000) + 10000;
  return `RES-${year}-${rand}`;
}

// ─── CREAR RESERVACIÓN ────────────────────────────────────────────────────────
async function crearReservacion(req, res) {
  try {
    const userId = req.session.userId;
    const {
      cabana_id, fecha_entrada, fecha_salida, num_noches,
      num_adultos, num_menores, notas_cliente, cupon_codigo,
      metodo_pago, huespedes
    } = req.body;

    // Validaciones básicas
    if (!cabana_id || !fecha_entrada || !fecha_salida || !num_adultos) {
      return res.status(400).json({ success: false, message: 'Datos de reservación incompletos' });
    }

    // Verificar disponibilidad
    const conflicto = await dbGet(
      `SELECT id FROM disponibilidad
       WHERE cabana_id = ? AND fecha_inicio < ? AND fecha_fin > ?`,
      [cabana_id, fecha_salida, fecha_entrada]
    );
    if (conflicto) {
      return res.status(409).json({ success: false, message: 'Las fechas seleccionadas no están disponibles para esta cabaña' });
    }

    // Obtener tarifa
    const totalPersonas = parseInt(num_adultos);
    let tarifa = await dbGet(
      'SELECT * FROM tarifas WHERE cabana_id = ? AND num_personas = ? AND activa = 1',
      [cabana_id, totalPersonas]
    );
    if (!tarifa) {
      tarifa = await dbGet(
        'SELECT * FROM tarifas WHERE cabana_id = ? AND num_personas >= ? AND activa = 1 ORDER BY num_personas ASC LIMIT 1',
        [cabana_id, totalPersonas]
      );
    }
    if (!tarifa) {
      return res.status(400).json({ success: false, message: 'No hay tarifa disponible para la cantidad de personas indicada' });
    }

    // Calcular totales
    const noches     = parseInt(num_noches);
    const subtotal   = tarifa.precio_noche * noches;
    let   descuento  = 0;

    // Aplicar cupón si existe
    if (cupon_codigo) {
      const cupon = await dbGet(
        `SELECT * FROM cupones WHERE codigo = ? AND activo = 1
         AND (fecha_inicio IS NULL OR fecha_inicio <= date('now'))
         AND (fecha_fin IS NULL OR fecha_fin >= date('now'))
         AND (maximo_usos = 0 OR usos_actuales < maximo_usos)`,
        [cupon_codigo.toUpperCase()]
      );
      if (cupon) {
        if (subtotal >= cupon.minimo_reserva) {
          descuento = cupon.tipo === 'porcentaje'
            ? (subtotal * cupon.valor / 100)
            : cupon.valor;
          await dbRun('UPDATE cupones SET usos_actuales = usos_actuales + 1 WHERE id = ?', [cupon.id]);
        }
      }
    }

    const total          = Math.max(0, subtotal - descuento);
    const numeroReserva  = generarNumeroReserva();

    // Insertar reservación
    const result = await dbRun(
      `INSERT INTO reservaciones
        (numero_reserva, usuario_id, cabana_id, fecha_entrada, fecha_salida, num_noches,
         num_adultos, num_menores, precio_noche, subtotal, descuento, total,
         estado, metodo_pago, estado_pago, cupon_codigo, notas_cliente)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?, 'pendiente', ?, ?)`,
      [
        numeroReserva, userId, cabana_id, fecha_entrada, fecha_salida, noches,
        num_adultos, num_menores || 0, tarifa.precio_noche, subtotal, descuento, total,
        metodo_pago || 'pendiente', cupon_codigo || null, notas_cliente || null
      ]
    );
    const reservacionId = result.lastID;

    // Bloquear disponibilidad
    await dbRun(
      "INSERT INTO disponibilidad (cabana_id, fecha_inicio, fecha_fin, tipo, reserva_id) VALUES (?, ?, ?, 'reservado', ?)",
      [cabana_id, fecha_entrada, fecha_salida, reservacionId]
    );

    // Registrar huéspedes
    if (huespedes && Array.isArray(huespedes)) {
      for (const h of huespedes) {
        await dbRun(
          `INSERT INTO huespedes
            (reservacion_id, nombre, apellido, identificacion, fecha_nacimiento, edad, sexo,
             nacionalidad, es_titular, es_menor, relacion_titular, email, telefono)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            reservacionId, h.nombre, h.apellido, h.identificacion || null,
            h.fecha_nacimiento || null, h.edad || null, h.sexo || null,
            h.nacionalidad || 'Costarricense', h.es_titular ? 1 : 0, h.es_menor ? 1 : 0,
            h.relacion_titular || null, h.email || null, h.telefono || null
          ]
        );
      }
    }

    // Generar QR con el número de reserva
    const qrData = await generarQR(numeroReserva, reservacionId);
    if (qrData) {
      await dbRun('UPDATE reservaciones SET codigo_qr = ? WHERE id = ?', [qrData, reservacionId]);
    }

    // Log
    await dbRun(
      "INSERT INTO log_actividad (usuario_id, accion, tabla, registro_id, ip) VALUES (?, 'crear_reservacion', 'reservaciones', ?, ?)",
      [userId, reservacionId, req.ip]
    );

    // Actualizar estadísticas del cliente
    await dbRun(
      `UPDATE clientes SET total_reservas = total_reservas + 1 WHERE usuario_id = ?`,
      [userId]
    );

    res.status(201).json({
      success: true,
      message: 'Reservación creada exitosamente',
      data: {
        id: reservacionId,
        numero_reserva: numeroReserva,
        total,
        subtotal,
        descuento,
        qr: qrData
      }
    });
  } catch (err) {
    console.error('Error crearReservacion:', err);
    res.status(500).json({ success: false, message: 'Error al crear la reservación' });
  }
}

// ─── MIS RESERVACIONES (cliente) ─────────────────────────────────────────────
async function getMisReservaciones(req, res) {
  try {
    const userId = req.session.userId;
    const { estado } = req.query;
    const params = [userId];
    let whereExtra = '';
    if (estado) { whereExtra = ' AND r.estado = ?'; params.push(estado); }
    const reservaciones = await dbAll(
      `SELECT r.*, c.nombre AS cabana_nombre, c.imagen_principal,
              CAST((julianday(r.fecha_salida) - julianday(r.fecha_entrada)) AS INTEGER) AS num_noches_calc
       FROM reservaciones r
       JOIN cabanas c ON c.id = r.cabana_id
       WHERE r.usuario_id = ?${whereExtra}
       ORDER BY r.creado_en DESC`,
      params
    );
    res.json({ success: true, data: reservaciones });
  } catch (err) {
    console.error('Error getMisReservaciones:', err);
    res.status(500).json({ success: false, message: 'Error al obtener reservaciones' });
  }
}

// ─── DETALLE DE RESERVACIÓN ───────────────────────────────────────────────────
async function getReservacionById(req, res) {
  try {
    const { id } = req.params;
    const userId = req.session.userId;
    const isAdmin = req.session.userRole === 'admin';

    const reservacion = await dbGet(
      `SELECT r.*, c.nombre AS cabana_nombre, c.imagen_principal, c.tiene_piscina,
              u.nombre AS usuario_nombre, u.apellido AS usuario_apellido, u.email AS usuario_email
       FROM reservaciones r
       JOIN cabanas c ON c.id = r.cabana_id
       JOIN usuarios u ON u.id = r.usuario_id
       WHERE r.id = ? ${isAdmin ? '' : 'AND r.usuario_id = ?'}`,
      isAdmin ? [id] : [id, userId]
    );

    if (!reservacion) {
      return res.status(404).json({ success: false, message: 'Reservación no encontrada' });
    }

    const huespedes = await dbAll(
      'SELECT * FROM huespedes WHERE reservacion_id = ? ORDER BY es_titular DESC',
      [id]
    );

    const pagos = await dbAll(
      'SELECT * FROM pagos WHERE reservacion_id = ? ORDER BY creado_en DESC',
      [id]
    );

    res.json({ success: true, data: { ...reservacion, huespedes, pagos } });
  } catch (err) {
    console.error('Error getReservacionById:', err);
    res.status(500).json({ success: false, message: 'Error al obtener reservación' });
  }
}

// ─── CANCELAR RESERVACIÓN ─────────────────────────────────────────────────────
async function cancelarReservacion(req, res) {
  try {
    const { id } = req.params;
    const userId  = req.session.userId;
    const isAdmin = req.session.userRole === 'admin';

    const reservacion = await dbGet(
      `SELECT * FROM reservaciones WHERE id = ? ${isAdmin ? '' : 'AND usuario_id = ?'}`,
      isAdmin ? [id] : [id, userId]
    );

    if (!reservacion) {
      return res.status(404).json({ success: false, message: 'Reservación no encontrada' });
    }
    if (['cancelada', 'completada'].includes(reservacion.estado)) {
      return res.status(400).json({ success: false, message: 'Esta reservación no puede cancelarse' });
    }

    await dbRun(
      `UPDATE reservaciones SET estado = 'cancelada', actualizado_en = datetime('now') WHERE id = ?`,
      [id]
    );

    // Liberar disponibilidad
    await dbRun('DELETE FROM disponibilidad WHERE reserva_id = ?', [id]);

    await dbRun(
      "INSERT INTO log_actividad (usuario_id, accion, tabla, registro_id, ip) VALUES (?, 'cancelar_reservacion', 'reservaciones', ?, ?)",
      [userId, id, req.ip]
    );

    res.json({ success: true, message: 'Reservación cancelada exitosamente' });
  } catch (err) {
    console.error('Error cancelarReservacion:', err);
    res.status(500).json({ success: false, message: 'Error al cancelar reservación' });
  }
}

// ─── PROCESAR PAGO ────────────────────────────────────────────────────────────
async function procesarPago(req, res) {
  try {
    const { reservacion_id, metodo, comprobante_path } = req.body;
    const userId = req.session.userId;

    const reservacion = await dbGet(
      'SELECT * FROM reservaciones WHERE id = ? AND usuario_id = ?',
      [reservacion_id, userId]
    );
    if (!reservacion) {
      return res.status(404).json({ success: false, message: 'Reservación no encontrada' });
    }

    // Registrar pago
    const pago = await dbRun(
      `INSERT INTO pagos (reservacion_id, metodo, monto, moneda, estado, comprobante_path)
       VALUES (?, ?, ?, 'USD', ?, ?)`,
      [
        reservacion_id, metodo, reservacion.total,
        metodo === 'efectivo' ? 'pendiente' : 'completado',
        comprobante_path || null
      ]
    );

    // Actualizar estado de reservación
    const nuevoEstado = metodo === 'efectivo' ? 'pendiente' : 'confirmada';
    const nuevoEstadoPago = metodo === 'efectivo' ? 'pendiente' : 'pagado';

    await dbRun(
      `UPDATE reservaciones SET metodo_pago = ?, estado = ?, estado_pago = ?, actualizado_en = datetime('now') WHERE id = ?`,
      [metodo, nuevoEstado, nuevoEstadoPago, reservacion_id]
    );

    // Actualizar gasto del cliente
    if (metodo !== 'efectivo') {
      await dbRun(
        'UPDATE clientes SET total_gastado = total_gastado + ? WHERE usuario_id = ?',
        [reservacion.total, userId]
      );
    }

    // Generar PDF de confirmación
    try {
      const pdfPath = await generarPDF(reservacion_id);
      if (pdfPath) {
        await dbRun('UPDATE reservaciones SET pdf_path = ? WHERE id = ?', [pdfPath, reservacion_id]);
      }
    } catch (pdfErr) {
      console.warn('PDF no generado:', pdfErr.message);
    }

    // Generar ICS
    try {
      const icsPath = await generarICS(reservacion_id);
      if (icsPath) {
        await dbRun('UPDATE reservaciones SET ics_path = ? WHERE id = ?', [icsPath, reservacion_id]);
      }
    } catch (icsErr) {
      console.warn('ICS no generado:', icsErr.message);
    }

    res.json({
      success: true,
      message: metodo === 'efectivo'
        ? 'Reservación registrada. El pago se realizará al llegar.'
        : 'Pago procesado y reservación confirmada.',
      data: { pago_id: pago.lastID, estado: nuevoEstado }
    });
  } catch (err) {
    console.error('Error procesarPago:', err);
    res.status(500).json({ success: false, message: 'Error al procesar el pago' });
  }
}

// ─── SUBIR COMPROBANTE SINPE ──────────────────────────────────────────────────
async function subirComprobante(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No se recibió ningún archivo' });
    }
    const filePath = '/uploads/comprobantes/' + req.file.filename;
    res.json({ success: true, message: 'Comprobante subido correctamente', path: filePath });
  } catch (err) {
    console.error('Error subirComprobante:', err);
    res.status(500).json({ success: false, message: 'Error al subir comprobante' });
  }
}

// ─── DESCARGAR PDF ────────────────────────────────────────────────────────────
async function descargarPDF(req, res) {
  try {
    const { id } = req.params;
    const userId  = req.session.userId;
    const isAdmin = req.session.userRole === 'admin';
    const path    = require('path');
    const fs      = require('fs');

    const reservacion = await dbGet(
      `SELECT * FROM reservaciones WHERE id = ? ${isAdmin ? '' : 'AND usuario_id = ?'}`,
      isAdmin ? [id] : [id, userId]
    );
    if (!reservacion) {
      return res.status(404).json({ success: false, message: 'Reservación no encontrada' });
    }

    // Regenerar si no existe
    let pdfPath = reservacion.pdf_path;
    if (!pdfPath || !fs.existsSync(path.join(__dirname, '../../frontend/public', pdfPath))) {
      pdfPath = await generarPDF(id);
      if (pdfPath) await dbRun('UPDATE reservaciones SET pdf_path = ? WHERE id = ?', [pdfPath, id]);
    }

    if (!pdfPath) {
      return res.status(404).json({ success: false, message: 'PDF no disponible' });
    }

    const fullPath = path.join(__dirname, '../../frontend/public', pdfPath);
    res.download(fullPath, `reservacion-${reservacion.numero_reserva}.pdf`);
  } catch (err) {
    console.error('Error descargarPDF:', err);
    res.status(500).json({ success: false, message: 'Error al descargar PDF' });
  }
}

// ─── DESCARGAR ICS ────────────────────────────────────────────────────────────
async function descargarICS(req, res) {
  try {
    const { id } = req.params;
    const userId  = req.session.userId;
    const isAdmin = req.session.userRole === 'admin';
    const path    = require('path');
    const fs      = require('fs');

    const reservacion = await dbGet(
      `SELECT * FROM reservaciones WHERE id = ? ${isAdmin ? '' : 'AND usuario_id = ?'}`,
      isAdmin ? [id] : [id, userId]
    );
    if (!reservacion) {
      return res.status(404).send('Reservación no encontrada');
    }

    let icsPath = reservacion.ics_path;
    if (!icsPath || !fs.existsSync(path.join(__dirname, '../../frontend/public', icsPath))) {
      icsPath = await generarICS(id);
      if (icsPath) await dbRun('UPDATE reservaciones SET ics_path = ? WHERE id = ?', [icsPath, id]);
    }

    if (!icsPath) {
      return res.status(404).send('Archivo de calendario no disponible');
    }

    const fullPath = path.join(__dirname, '../../frontend/public', icsPath);
    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader('Content-Disposition', `attachment; filename="reservacion-${reservacion.numero_reserva}.ics"`);
    res.sendFile(fullPath);
  } catch (err) {
    console.error('Error descargarICS:', err);
    res.status(500).send('Error al descargar calendario');
  }
}

// ─── VALIDAR CUPÓN ────────────────────────────────────────────────────────────
async function validarCupon(req, res) {
  try {
    const { codigo, subtotal } = req.body;
    if (!codigo) {
      return res.status(400).json({ success: false, message: 'Código requerido' });
    }

    const cupon = await dbGet(
      `SELECT * FROM cupones WHERE codigo = ? AND activo = 1
       AND (fecha_inicio IS NULL OR fecha_inicio <= date('now'))
       AND (fecha_fin IS NULL OR fecha_fin >= date('now'))
       AND (maximo_usos = 0 OR usos_actuales < maximo_usos)`,
      [codigo.toUpperCase().trim()]
    );

    if (!cupon) {
      return res.status(404).json({ success: false, message: 'Cupón inválido, expirado o agotado' });
    }

    const base = parseFloat(subtotal) || 0;
    if (base < cupon.minimo_reserva) {
      return res.status(400).json({
        success: false,
        message: `Este cupón requiere un mínimo de $${cupon.minimo_reserva}`
      });
    }

    const descuento = cupon.tipo === 'porcentaje'
      ? (base * cupon.valor / 100)
      : cupon.valor;

    res.json({
      success: true,
      message: '¡Cupón aplicado!',
      data: {
        codigo: cupon.codigo,
        tipo: cupon.tipo,
        valor: cupon.valor,
        descuento: Math.round(descuento * 100) / 100,
        descripcion: cupon.descripcion
      }
    });
  } catch (err) {
    console.error('Error validarCupon:', err);
    res.status(500).json({ success: false, message: 'Error al validar cupón' });
  }
}

module.exports = {
  crearReservacion,
  getMisReservaciones,
  getReservacionById,
  cancelarReservacion,
  procesarPago,
  subirComprobante,
  descargarPDF,
  descargarICS,
  validarCupon
};
