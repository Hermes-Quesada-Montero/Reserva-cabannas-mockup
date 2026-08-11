/**
 * Servicio de generación de archivo ICS (iCalendar)
 * Para agregar reservaciones a Google Calendar, Outlook, Apple Calendar
 */

const path = require('path');
const fs   = require('fs');
const { dbGet } = require('../database/db');

const ICS_DIR = path.join(__dirname, '../../frontend/public/downloads/ics');
if (!fs.existsSync(ICS_DIR)) {
  fs.mkdirSync(ICS_DIR, { recursive: true });
}

/**
 * Genera contenido ICS válido manualmente (sin dependencias externas problemáticas)
 */
function formatDateICS(dateStr, time = '120000') {
  // dateStr = 'YYYY-MM-DD', time = 'HHMMSS'
  return dateStr.replace(/-/g, '') + 'T' + time;
}

/**
 * Genera un archivo .ics para la reservación
 * @param {number} reservacionId
 * @returns {string|null} Ruta pública del archivo ICS
 */
async function generarICS(reservacionId) {
  try {
    const reservacion = await dbGet(`
      SELECT r.*, c.nombre AS cabana_nombre, c.descripcion_corta,
             u.nombre AS cliente_nombre, u.apellido AS cliente_apellido, u.email AS cliente_email
      FROM reservaciones r
      JOIN cabanas c ON c.id = r.cabana_id
      JOIN usuarios u ON u.id = r.usuario_id
      WHERE r.id = ?
    `, [reservacionId]);

    if (!reservacion) return null;

    const filename   = `reservacion-${reservacion.numero_reserva}.ics`;
    const filePath   = path.join(ICS_DIR, filename);
    const publicPath = `/downloads/ics/${filename}`;

    // Fechas del evento: check-in a las 13:00, check-out a las 12:00
    const dtStart  = formatDateICS(reservacion.fecha_entrada, '130000');
    const dtEnd    = formatDateICS(reservacion.fecha_salida, '120000');
    const dtStamp  = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const uid      = `${reservacion.numero_reserva}@cabanaslospinos.com`;

    const summary     = `Reservación: ${reservacion.cabana_nombre}`;
    const description = `Reservación ${reservacion.numero_reserva}\\nCabaña: ${reservacion.cabana_nombre}\\nHuéspedes: ${reservacion.num_adultos} adulto(s)\\nTotal: $${reservacion.total}\\nCheck-in: 1:00 PM\\nCheck-out: 12:00 PM`;
    const location    = 'Sector Los Pinos\\, Monteverde\\, Puntarenas\\, Costa Rica';

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Cabañas Los Pinos//Reservación//ES',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART;TZID=America/Costa_Rica:${dtStart}`,
      `DTEND;TZID=America/Costa_Rica:${dtEnd}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${location}`,
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'BEGIN:VALARM',
      'TRIGGER:-PT24H',
      'ACTION:DISPLAY',
      'DESCRIPTION:Recordatorio: Check-in mañana a la 1:00 PM',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    fs.writeFileSync(filePath, icsContent, 'utf8');
    return publicPath;
  } catch (err) {
    console.error('Error generarICS:', err);
    return null;
  }
}

module.exports = { generarICS };
