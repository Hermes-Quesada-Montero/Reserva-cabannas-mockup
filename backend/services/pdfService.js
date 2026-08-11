/**
 * Servicio de generación de PDF
 * Crea comprobantes de reservación con PDFKit
 */

const PDFDocument = require('pdfkit');
const path        = require('path');
const fs          = require('fs');
const { dbGet, dbAll } = require('../database/db');

// Asegurar que exista el directorio de PDFs
const PDF_DIR = path.join(__dirname, '../../frontend/public/downloads/pdf');
if (!fs.existsSync(PDF_DIR)) {
  fs.mkdirSync(PDF_DIR, { recursive: true });
}

/**
 * Genera un PDF de confirmación de reservación
 * @param {number} reservacionId
 * @returns {string|null} Ruta relativa del PDF generado
 */
async function generarPDF(reservacionId) {
  try {
    const reservacion = await dbGet(`
      SELECT r.*, c.nombre AS cabana_nombre, c.descripcion_corta AS cabana_desc,
             u.nombre AS cliente_nombre, u.apellido AS cliente_apellido, u.email AS cliente_email,
             u.telefono AS cliente_telefono
      FROM reservaciones r
      JOIN cabanas c ON c.id = r.cabana_id
      JOIN usuarios u ON u.id = r.usuario_id
      WHERE r.id = ?
    `, [reservacionId]);

    if (!reservacion) return null;

    const huespedes = await dbAll(
      'SELECT * FROM huespedes WHERE reservacion_id = ? ORDER BY es_titular DESC',
      [reservacionId]
    );

    const filename  = `reservacion-${reservacion.numero_reserva}.pdf`;
    const filePath  = path.join(PDF_DIR, filename);
    const publicPath = `/downloads/pdf/${filename}`;

    await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // ── Encabezado ──────────────────────────────────────────
      doc.rect(0, 0, 612, 120).fill('#2D5016');
      doc.fillColor('white')
         .fontSize(24).font('Helvetica-Bold')
         .text('CABAÑAS LOS PINOS', 50, 30, { align: 'center' })
         .fontSize(12).font('Helvetica')
         .text('Confirmación de Reservación', 50, 62, { align: 'center' })
         .text('Sector Los Pinos, Monteverde, Costa Rica', 50, 82, { align: 'center' });

      // ── Número de reserva ────────────────────────────────────
      doc.fillColor('#2D5016')
         .rect(50, 135, 512, 50).stroke();
      doc.fillColor('#2D5016')
         .fontSize(18).font('Helvetica-Bold')
         .text(`Reservación: ${reservacion.numero_reserva}`, 60, 150);

      // ── Estado ───────────────────────────────────────────────
      const estadoColor = {
        confirmada: '#27ae60', pendiente: '#f39c12',
        cancelada: '#e74c3c', completada: '#3498db'
      }[reservacion.estado] || '#7f8c8d';
      doc.fillColor(estadoColor)
         .fontSize(12).font('Helvetica-Bold')
         .text(`Estado: ${reservacion.estado.toUpperCase()}`, 350, 150);

      doc.moveDown(3);

      // ── Información de la cabaña ──────────────────────────────
      doc.fillColor('#2D5016').fontSize(14).font('Helvetica-Bold').text('Información de la Estadía', 50, 205);
      doc.moveTo(50, 222).lineTo(562, 222).strokeColor('#2D5016').stroke();

      const infoItems = [
        ['Cabaña:', reservacion.cabana_nombre],
        ['Fecha de entrada:', `${reservacion.fecha_entrada} a las ${reservacion.hora_entrada || '1:00 PM'}`],
        ['Fecha de salida:', `${reservacion.fecha_salida} a las ${reservacion.hora_salida || '12:00 PM'}`],
        ['Número de noches:', reservacion.num_noches.toString()],
        ['Adultos:', reservacion.num_adultos.toString()],
        ['Menores:', reservacion.num_menores.toString()],
      ];

      let yPos = 235;
      infoItems.forEach(([label, value]) => {
        doc.fillColor('#555').fontSize(10).font('Helvetica').text(label, 60, yPos);
        doc.fillColor('#111').font('Helvetica-Bold').text(value, 200, yPos);
        yPos += 20;
      });

      // ── Resumen de pago ───────────────────────────────────────
      yPos += 10;
      doc.fillColor('#2D5016').fontSize(14).font('Helvetica-Bold').text('Resumen de Pago', 50, yPos);
      yPos += 18;
      doc.moveTo(50, yPos).lineTo(562, yPos).strokeColor('#2D5016').stroke();
      yPos += 10;

      doc.fillColor('#555').fontSize(10).font('Helvetica').text('Precio por noche:', 60, yPos);
      doc.fillColor('#111').font('Helvetica-Bold').text(`$${reservacion.precio_noche}`, 400, yPos, { align: 'right', width: 162 });
      yPos += 20;
      doc.fillColor('#555').font('Helvetica').text('Subtotal:', 60, yPos);
      doc.fillColor('#111').font('Helvetica-Bold').text(`$${reservacion.subtotal}`, 400, yPos, { align: 'right', width: 162 });
      yPos += 20;

      if (reservacion.descuento > 0) {
        doc.fillColor('#27ae60').font('Helvetica').text('Descuento:', 60, yPos);
        doc.fillColor('#27ae60').font('Helvetica-Bold').text(`-$${reservacion.descuento}`, 400, yPos, { align: 'right', width: 162 });
        yPos += 20;
      }

      doc.rect(50, yPos, 512, 30).fill('#2D5016');
      doc.fillColor('white').fontSize(13).font('Helvetica-Bold')
         .text('TOTAL:', 60, yPos + 8)
         .text(`$${reservacion.total} USD`, 400, yPos + 8, { align: 'right', width: 152 });
      yPos += 50;

      doc.fillColor('#555').fontSize(10).font('Helvetica').text('Método de pago:', 60, yPos);
      doc.fillColor('#111').font('Helvetica-Bold').text(reservacion.metodo_pago || 'Pendiente', 200, yPos);

      // ── Huéspedes ─────────────────────────────────────────────
      if (huespedes.length > 0) {
        yPos += 30;
        doc.fillColor('#2D5016').fontSize(14).font('Helvetica-Bold').text('Registro de Huéspedes', 50, yPos);
        yPos += 18;
        doc.moveTo(50, yPos).lineTo(562, yPos).strokeColor('#2D5016').stroke();
        yPos += 10;

        huespedes.forEach((h, idx) => {
          if (yPos > 700) { doc.addPage(); yPos = 50; }
          const tipo = h.es_titular ? ' (Titular)' : h.es_menor ? ' (Menor)' : '';
          doc.fillColor('#111').fontSize(10).font('Helvetica-Bold')
             .text(`${idx + 1}. ${h.nombre} ${h.apellido}${tipo}`, 60, yPos);
          yPos += 16;
          doc.fillColor('#666').font('Helvetica')
             .text(`   Identificación: ${h.identificacion || 'N/A'} | Edad: ${h.edad || 'N/A'} | Nacionalidad: ${h.nacionalidad || 'N/A'}`, 60, yPos);
          yPos += 20;
        });
      }

      // ── Pie de página ─────────────────────────────────────────
      const pageHeight = doc.page.height;
      doc.rect(0, pageHeight - 60, 612, 60).fill('#2D5016');
      doc.fillColor('white').fontSize(9).font('Helvetica')
         .text('Cabañas Los Pinos · info@cabanaslospinos.com · +506 2222-3333', 50, pageHeight - 45, { align: 'center' })
         .text('Este documento es válido como comprobante de reservación.', 50, pageHeight - 30, { align: 'center' });

      doc.end();
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    return publicPath;
  } catch (err) {
    console.error('Error generarPDF:', err);
    return null;
  }
}

module.exports = { generarPDF };
