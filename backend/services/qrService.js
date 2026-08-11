/**
 * Servicio de generación de código QR
 * Genera un QR con los datos de la reservación
 */

const QRCode = require('qrcode');
const path   = require('path');
const fs     = require('fs');

const QR_DIR = path.join(__dirname, '../../frontend/public/downloads/qr');
if (!fs.existsSync(QR_DIR)) {
  fs.mkdirSync(QR_DIR, { recursive: true });
}

/**
 * Genera un código QR para una reservación
 * @param {string} numeroReserva
 * @param {number} reservacionId
 * @returns {string|null} Ruta relativa del QR (PNG)
 */
async function generarQR(numeroReserva, reservacionId) {
  try {
    const filename   = `qr-${numeroReserva}.png`;
    const filePath   = path.join(QR_DIR, filename);
    const publicPath = `/downloads/qr/${filename}`;

    // El contenido del QR incluye datos de la reservación
    const qrContent = JSON.stringify({
      reserva: numeroReserva,
      id: reservacionId,
      sistema: 'Cabañas Los Pinos',
      verificar: `http://localhost:3000/reservacion/${reservacionId}`
    });

    await QRCode.toFile(filePath, qrContent, {
      color: { dark: '#2D5016', light: '#FFFFFF' },
      width: 300,
      margin: 2,
      errorCorrectionLevel: 'M'
    });

    return publicPath;
  } catch (err) {
    console.error('Error generarQR:', err);
    return null;
  }
}

/**
 * Genera QR como base64 (para incluir en respuesta JSON)
 * @param {string} texto
 * @returns {string|null} Data URL base64
 */
async function generarQRBase64(texto) {
  try {
    return await QRCode.toDataURL(texto, {
      color: { dark: '#2D5016', light: '#FFFFFF' },
      width: 200,
      margin: 1
    });
  } catch (err) {
    console.error('Error generarQRBase64:', err);
    return null;
  }
}

module.exports = { generarQR, generarQRBase64 };
