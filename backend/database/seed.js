/**
 * Seed Data - Datos iniciales para el sistema de cabañas
 * Incluye: admin, clientes ficticios, cabañas, tarifas, galería,
 * reservaciones, comentarios, FAQs, configuración y más.
 */

const bcrypt = require('bcryptjs');

async function getSeedData() {
  const adminPass    = await bcrypt.hash('1234qwer', 12);
  const clientPass1  = await bcrypt.hash('cliente123', 10);
  const clientPass2  = await bcrypt.hash('cliente123', 10);
  const clientPass3  = await bcrypt.hash('cliente123', 10);

  return {
    adminPass,
    clientPass1,
    clientPass2,
    clientPass3,
  };
}

/**
 * Inserta todos los datos iniciales en la base de datos
 * @param {Function} dbRun   - función promisificada run
 * @param {Function} dbGet   - función promisificada get
 * @param {Function} dbAll   - función promisificada all
 */
async function seedDatabase(dbRun, dbGet) {
  const { adminPass, clientPass1, clientPass2, clientPass3 } = await getSeedData();

  // ── 1. Configuración del sitio ─────────────────────────────────
  const configs = [
    ['nombre_sitio',        'Cabañas Los Pinos',            'Nombre del resort'],
    ['slogan',              'Un refugio de paz en la naturaleza', 'Eslogan principal'],
    ['logo_url',            '/images/logo.svg',             'URL del logo'],
    ['favicon_url',         '/images/favicon.ico',          'URL del favicon'],
    ['color_primario',      '#2D5016',                      'Color primario (verde bosque)'],
    ['color_secundario',    '#8B6914',                      'Color secundario (dorado)'],
    ['color_acento',        '#C8A951',                      'Color de acento'],
    ['email_contacto',      'info@cabanaslospinos.com',      'Email de contacto'],
    ['telefono_contacto',   '+506 2222-3333',               'Teléfono principal'],
    ['direccion',           'Sector Los Pinos, Monteverde, Puntarenas, Costa Rica', 'Dirección del resort'],
    ['politica_cancelacion','Cancelación gratuita hasta 48 horas antes del check-in.', 'Política de cancelación'],
    ['hora_checkin',        '13:00',                        'Hora estándar de entrada'],
    ['hora_checkout',       '12:00',                        'Hora estándar de salida'],
    ['moneda',              'USD',                          'Moneda principal'],
    ['sinpe_numero',        '8888-8888',                    'Número SINPE Móvil'],
    ['sinpe_nombre',        'Cabañas Los Pinos S.A.',       'Nombre SINPE'],
    ['stripe_publishable_key','pk_test_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', 'Clave pública Stripe (reemplazar)'],
    ['maps_embed_url',      'https://maps.google.com/maps?q=Monteverde+Costa+Rica&output=embed', 'URL mapa embed'],
    ['whatsapp',            '50688888888',                  'WhatsApp de contacto'],
    ['instagram',           'cabanaslospinos',              'Instagram handle'],
    ['facebook',            'cabanaslospinos',              'Facebook page'],
    ['descripcion_seo',     'Resort de cabañas en Monteverde Costa Rica. Reservaciones en línea, piscina privada y naturaleza.', 'Meta description'],
    ['meta_keywords',       'cabañas, monteverde, costa rica, resort, hospedaje, piscina', 'Meta keywords'],
  ];
  for (const [clave, valor, descripcion] of configs) {
    await dbRun(
      `INSERT OR IGNORE INTO configuracion (clave, valor, descripcion) VALUES (?, ?, ?)`,
      [clave, valor, descripcion]
    );
  }

  // ── 2. Usuarios ────────────────────────────────────────────────
  await dbRun(`
    INSERT OR IGNORE INTO usuarios
      (nombre, apellido, email, username, password, rol, telefono, nacionalidad, activo)
    VALUES
      ('Administrador', 'Sistema', 'admin@cabanaslospinos.com', 'admin123', ?, 'admin', '+506 2222-3333', 'Costarricense', 1)
  `, [adminPass]);

  await dbRun(`
    INSERT OR IGNORE INTO usuarios
      (nombre, apellido, email, username, password, rol, telefono, identificacion, fecha_nacimiento, sexo, nacionalidad, activo)
    VALUES
      ('María', 'González', 'maria@example.com', 'mariag', ?, 'cliente', '+506 8111-2222', '1-0456-0789', '1990-04-15', 'F', 'Costarricense', 1)
  `, [clientPass1]);

  await dbRun(`
    INSERT OR IGNORE INTO usuarios
      (nombre, apellido, email, username, password, rol, telefono, identificacion, fecha_nacimiento, sexo, nacionalidad, activo)
    VALUES
      ('Carlos', 'Rodríguez', 'carlos@example.com', 'carlosr', ?, 'cliente', '+506 8333-4444', '1-0567-0890', '1985-08-22', 'M', 'Costarricense', 1)
  `, [clientPass2]);

  await dbRun(`
    INSERT OR IGNORE INTO usuarios
      (nombre, apellido, email, username, password, rol, telefono, identificacion, fecha_nacimiento, sexo, nacionalidad, activo)
    VALUES
      ('Ana', 'Martínez', 'ana@example.com', 'anam', ?, 'cliente', '+506 8555-6666', '1-0678-0901', '1995-12-03', 'F', 'Mexicana', 1)
  `, [clientPass3]);

  // ── 3. Perfiles de clientes ───────────────────────────────────
  const userMaria  = await dbGet('SELECT id FROM usuarios WHERE email = ?', ['maria@example.com']);
  const userCarlos = await dbGet('SELECT id FROM usuarios WHERE email = ?', ['carlos@example.com']);
  const userAna    = await dbGet('SELECT id FROM usuarios WHERE email = ?', ['ana@example.com']);

  if (userMaria)  await dbRun('INSERT OR IGNORE INTO clientes (usuario_id, ciudad, pais) VALUES (?, ?, ?)', [userMaria.id, 'San José', 'Costa Rica']);
  if (userCarlos) await dbRun('INSERT OR IGNORE INTO clientes (usuario_id, ciudad, pais) VALUES (?, ?, ?)', [userCarlos.id, 'Cartago', 'Costa Rica']);
  if (userAna)    await dbRun('INSERT OR IGNORE INTO clientes (usuario_id, ciudad, pais) VALUES (?, ?, ?)', [userAna.id, 'Ciudad de México', 'México']);

  // ── 4. Cabañas ────────────────────────────────────────────────
  const serviciosBase = JSON.stringify(['Wi-Fi gratis', 'Aire acondicionado', 'TV Smart', 'Cocina equipada', 'Agua caliente', 'Estacionamiento', 'Seguridad 24h', 'Área de fogata']);
  const serviciosPiscina = JSON.stringify(['Wi-Fi gratis', 'Aire acondicionado', 'TV Smart', 'Cocina equipada', 'Agua caliente', 'Estacionamiento', 'Seguridad 24h', 'Piscina privada', 'Área de fogata', 'Jacuzzi exterior', 'Deck con vista']);
  const reglas = JSON.stringify(['No fumar dentro de la cabaña', 'No se permiten mascotas', 'Silencio a partir de las 10pm', 'Máximo de huéspedes según capacidad', 'Cuidar las instalaciones']);

  await dbRun(`
    INSERT OR IGNORE INTO cabanas
      (id, nombre, descripcion, descripcion_corta, num_habitaciones, capacidad_max, tiene_piscina, servicios, reglas, imagen_principal, orden)
    VALUES
      (1, 'Cabaña El Roble', 'Perfecta para escapadas románticas o viajes en solitario. Nuestra Cabaña El Roble ofrece una habitación acogedora rodeada de naturaleza, con todos los servicios necesarios para una estadía cómoda e íntima. Disfrute del sonido de los pájaros y la tranquilidad del bosque.', 'Refugio íntimo de 1 habitación en el corazón del bosque', 1, 2, 0, ?, ?, '/images/cabanas/cabana1-hero.jpg', 1)
  `, [serviciosBase, reglas]);

  await dbRun(`
    INSERT OR IGNORE INTO cabanas
      (id, nombre, descripcion, descripcion_corta, num_habitaciones, capacidad_max, tiene_piscina, servicios, reglas, imagen_principal, orden)
    VALUES
      (2, 'Cabaña Los Pinos', 'Ideal para familias y grupos pequeños. Con 2 amplias habitaciones, sala de estar y cocina completa, nuestra Cabaña Los Pinos brinda el espacio y la comodidad que necesita para una estadía memorable. Rodeada de imponentes pinos y senderos naturales.', 'Espacio familiar de 2 habitaciones rodeado de pinos', 2, 3, 0, ?, ?, '/images/cabanas/cabana2-hero.jpg', 2)
  `, [serviciosBase, reglas]);

  await dbRun(`
    INSERT OR IGNORE INTO cabanas
      (id, nombre, descripcion, descripcion_corta, num_habitaciones, capacidad_max, tiene_piscina, servicios, reglas, imagen_principal, orden)
    VALUES
      (3, 'Cabaña Villa Esmeralda', 'Nuestra joya premium: Villa Esmeralda combina lujo y naturaleza en perfecta armonía. Con 2 habitaciones, piscina privada climatizada, jacuzzi exterior y deck panorámico, esta cabaña fue diseñada para quienes buscan la experiencia más exclusiva en medio del bosque nuboso costarricense.', 'Experiencia premium con piscina privada y vista al bosque', 2, 3, 1, ?, ?, '/images/cabanas/cabana3-hero.jpg', 3)
  `, [serviciosPiscina, reglas]);

  // ── 5. Tarifas ────────────────────────────────────────────────
  // Cabaña 1
  await dbRun('INSERT OR IGNORE INTO tarifas (cabana_id, num_personas, precio_noche) VALUES (1, 1, 50)', []);
  await dbRun('INSERT OR IGNORE INTO tarifas (cabana_id, num_personas, precio_noche) VALUES (1, 2, 75)', []);
  // Cabaña 2
  await dbRun('INSERT OR IGNORE INTO tarifas (cabana_id, num_personas, precio_noche) VALUES (2, 1, 100)', []);
  await dbRun('INSERT OR IGNORE INTO tarifas (cabana_id, num_personas, precio_noche) VALUES (2, 2, 150)', []);
  await dbRun('INSERT OR IGNORE INTO tarifas (cabana_id, num_personas, precio_noche) VALUES (2, 3, 175)', []);
  // Cabaña 3
  await dbRun('INSERT OR IGNORE INTO tarifas (cabana_id, num_personas, precio_noche) VALUES (3, 1, 140)', []);
  await dbRun('INSERT OR IGNORE INTO tarifas (cabana_id, num_personas, precio_noche) VALUES (3, 2, 190)', []);
  await dbRun('INSERT OR IGNORE INTO tarifas (cabana_id, num_personas, precio_noche) VALUES (3, 3, 215)', []);

  // ── 6. Galería ────────────────────────────────────────────────
  const galeriaItems = [
    // Cabaña 1
    [1, 'Exterior Cabaña El Roble', 'Vista frontal con jardín', '/images/gallery/cabana1-exterior.jpg', 'exterior', 1],
    [1, 'Habitación Principal', 'Cama king con vista al bosque', '/images/gallery/cabana1-habitacion.jpg', 'habitacion', 2],
    [1, 'Sala y Cocina', 'Cocina totalmente equipada', '/images/gallery/cabana1-sala.jpg', 'interior', 3],
    // Cabaña 2
    [2, 'Exterior Cabaña Los Pinos', 'Deck privado entre los pinos', '/images/gallery/cabana2-exterior.jpg', 'exterior', 4],
    [2, 'Habitación 1', 'Suite principal con cama matrimonial', '/images/gallery/cabana2-hab1.jpg', 'habitacion', 5],
    [2, 'Habitación 2', 'Habitación secundaria con dos camas', '/images/gallery/cabana2-hab2.jpg', 'habitacion', 6],
    // Cabaña 3
    [3, 'Piscina Privada', 'Piscina climatizada exclusiva', '/images/gallery/cabana3-piscina.jpg', 'piscina', 7],
    [3, 'Jacuzzi Exterior', 'Jacuzzi con vista al bosque nuboso', '/images/gallery/cabana3-jacuzzi.jpg', 'piscina', 8],
    [3, 'Villa Esmeralda - Sala', 'Sala de estar premium', '/images/gallery/cabana3-sala.jpg', 'interior', 9],
    [3, 'Deck Panorámico', 'Vista al bosque desde el deck', '/images/gallery/cabana3-deck.jpg', 'exterior', 10],
    // General
    [null, 'Fogata Comunitaria', 'Área de fogata para todos los huéspedes', '/images/gallery/fogata.jpg', 'actividades', 11],
    [null, 'Sendero Natural', 'Senderos en medio del bosque', '/images/gallery/sendero.jpg', 'naturaleza', 12],
    [null, 'Restaurante', 'Restaurante con cocina costarricense', '/images/gallery/restaurante.jpg', 'restaurante', 13],
    [null, 'Amanecer en el bosque', 'Vista del amanecer desde Los Pinos', '/images/gallery/amanecer.jpg', 'naturaleza', 14],
    [null, 'Actividades', 'Canopy y tour de naturaleza', '/images/gallery/actividades.jpg', 'actividades', 15],
  ];
  for (const [cid, titulo, desc, url, cat, orden] of galeriaItems) {
    await dbRun(
      `INSERT OR IGNORE INTO galeria (cabana_id, titulo, descripcion, url_imagen, categoria, orden, activa) VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [cid, titulo, desc, url, cat, orden]
    );
  }

  // ── 7. FAQs ──────────────────────────────────────────────────
  const faqs = [
    ['¿Cuál es la hora de check-in y check-out?', 'El check-in es a partir de la 1:00 PM y el check-out hasta las 12:00 PM del medio día. Si necesita horarios especiales, contáctenos con anticipación.', 'politicas', 1],
    ['¿Se permiten mascotas?', 'Lo sentimos, por el momento no aceptamos mascotas en nuestras instalaciones para garantizar la comodidad de todos nuestros huéspedes.', 'politicas', 2],
    ['¿Las cabañas tienen Wi-Fi?', 'Sí, todas nuestras cabañas cuentan con Wi-Fi de alta velocidad completamente gratuito. Le proporcionaremos las credenciales al momento del check-in.', 'servicios', 3],
    ['¿Cómo cancelo mi reservación?', 'Puede cancelar su reservación desde su perfil de cliente hasta 48 horas antes de la fecha de entrada sin cargo. Cancalaciones tardías pueden tener penalidad.', 'reservaciones', 4],
    ['¿Los menores de edad pueden hospedarse?', 'Sí, damos la bienvenida a familias con niños. Los menores de 10 años no generan costo adicional, pero deben registrarse por motivos de seguridad.', 'reservaciones', 5],
    ['¿Cuál es la capacidad máxima de cada cabaña?', 'Cabaña El Roble: máximo 2 personas. Cabaña Los Pinos: máximo 3 personas. Villa Esmeralda: máximo 3 personas adultas.', 'general', 6],
    ['¿La piscina está disponible todo el año?', 'La piscina privada de Villa Esmeralda está disponible durante todo el año ya que es climatizada. El horario de uso es de 7:00 AM a 10:00 PM.', 'servicios', 7],
    ['¿Qué métodos de pago aceptan?', 'Aceptamos tarjetas de crédito/débito, SINPE Móvil y pago en efectivo al llegar. Para reservaciones por temporada alta recomendamos pago anticipado.', 'pagos', 8],
    ['¿Hay restaurante en el resort?', 'Contamos con un restaurante que sirve desayunos y cenas. Todas las cabañas tienen cocina equipada para quienes prefieren cocinar por su cuenta.', 'servicios', 9],
    ['¿Cómo llego al resort?', 'Estamos ubicados en Monteverde, Puntarenas. A 3 horas de San José por la ruta 1. Ofrecemos servicio de traslado desde San José con costo adicional.', 'general', 10],
  ];
  for (const [pregunta, respuesta, categoria, orden] of faqs) {
    await dbRun(
      `INSERT OR IGNORE INTO faqs (pregunta, respuesta, categoria, orden, activa) VALUES (?, ?, ?, ?, 1)`,
      [pregunta, respuesta, categoria, orden]
    );
  }

  // ── 8. Contacto y redes sociales ──────────────────────────────
  const contactos = [
    ['telefono',    '+506 2222-3333', 'Teléfono principal', 'phone', 1],
    ['whatsapp',    '+506 8888-8888', 'WhatsApp', 'whatsapp', 2],
    ['email',       'info@cabanaslospinos.com', 'Correo electrónico', 'email', 3],
    ['direccion',   'Sector Los Pinos, Monteverde, Puntarenas, Costa Rica', 'Dirección', 'map-pin', 4],
    ['instagram',   'https://instagram.com/cabanaslospinos', 'Instagram', 'instagram', 5],
    ['facebook',    'https://facebook.com/cabanaslospinos', 'Facebook', 'facebook', 6],
    ['tiktok',      'https://tiktok.com/@cabanaslospinos', 'TikTok', 'music', 7],
  ];
  for (const [tipo, valor, descripcion, icono, orden] of contactos) {
    await dbRun(
      `INSERT OR IGNORE INTO contacto (tipo, valor, descripcion, icono, activo, orden) VALUES (?, ?, ?, ?, 1, ?)`,
      [tipo, valor, descripcion, icono, orden]
    );
  }

  // ── 9. Métodos de pago ────────────────────────────────────────
  await dbRun(`INSERT OR IGNORE INTO metodos_pago (nombre, tipo, descripcion, instrucciones, activo, orden) VALUES
    ('Tarjeta de Crédito / Débito', 'tarjeta', 'Visa, Mastercard, American Express', 'Ingrese los datos de su tarjeta de forma segura a través de Stripe', 1, 1)`, []);
  await dbRun(`INSERT OR IGNORE INTO metodos_pago (nombre, tipo, descripcion, instrucciones, activo, orden) VALUES
    ('SINPE Móvil', 'sinpe', 'Transferencia instantánea', 'Realice el pago al número 8888-8888 a nombre de Cabañas Los Pinos S.A. y suba el comprobante', 1, 2)`, []);
  await dbRun(`INSERT OR IGNORE INTO metodos_pago (nombre, tipo, descripcion, instrucciones, activo, orden) VALUES
    ('Pago al Llegar', 'efectivo', 'Efectivo en recepción', 'Su reservación quedará en estado pendiente. El pago se realiza al momento del check-in.', 1, 3)`, []);

  // ── 10. Cupones de ejemplo ────────────────────────────────────
  await dbRun(`INSERT OR IGNORE INTO cupones (codigo, descripcion, tipo, valor, minimo_reserva, maximo_usos, fecha_fin, activo) VALUES
    ('BIENVENIDO10', 'Descuento de bienvenida 10%', 'porcentaje', 10, 100, 50, '2026-12-31', 1)`, []);
  await dbRun(`INSERT OR IGNORE INTO cupones (codigo, descripcion, tipo, valor, minimo_reserva, maximo_usos, fecha_fin, activo) VALUES
    ('VERANO25', 'Descuento de temporada $25', 'monto_fijo', 25, 200, 30, '2026-08-31', 1)`, []);

  // ── 11. Banners del hero ──────────────────────────────────────
  await dbRun(`INSERT OR IGNORE INTO banners (titulo, subtitulo, url_imagen, url_boton, texto_boton, orden, activo) VALUES
    ('Un Refugio en la Naturaleza', 'Descubra la magia del bosque nuboso costarricense', '/images/banners/hero1.jpg', '/cabanas', 'Explorar Cabañas', 1, 1)`, []);
  await dbRun(`INSERT OR IGNORE INTO banners (titulo, subtitulo, url_imagen, url_boton, texto_boton, orden, activo) VALUES
    ('Villa Esmeralda con Piscina Privada', 'Lujo y naturaleza en perfecta armonía', '/images/banners/hero2.jpg', '/cabanas/3', 'Reservar Ahora', 2, 1)`, []);
  await dbRun(`INSERT OR IGNORE INTO banners (titulo, subtitulo, url_imagen, url_boton, texto_boton, orden, activo) VALUES
    ('Momentos Inolvidables', 'Cree recuerdos que duran toda la vida en Los Pinos', '/images/banners/hero3.jpg', '/reservar', 'Ver Disponibilidad', 3, 1)`, []);

  // ── 12. Políticas ─────────────────────────────────────────────
  await dbRun(`INSERT OR IGNORE INTO politicas (titulo, contenido, tipo, orden, activa) VALUES
    ('Política de Cancelación', 'Las cancelaciones realizadas con más de 48 horas de anticipación son totalmente gratuitas. Cancelaciones entre 24 y 48 horas antes del check-in tendrán un cargo equivalente a 1 noche. Cancelaciones con menos de 24 horas o no-shows se cobrarán el 100% de la reservación.', 'cancelacion', 1, 1)`, []);
  await dbRun(`INSERT OR IGNORE INTO politicas (titulo, contenido, tipo, orden, activa) VALUES
    ('Política de Mascotas', 'Por el bienestar de todos nuestros huéspedes y la preservación del entorno natural, no se permiten animales de ningún tipo en las instalaciones del resort.', 'mascotas', 2, 1)`, []);
  await dbRun(`INSERT OR IGNORE INTO politicas (titulo, contenido, tipo, orden, activa) VALUES
    ('Reglamento General', 'El silencio nocturno debe respetarse a partir de las 10:00 PM. Está prohibido fumar dentro de las cabañas. El uso de la piscina es exclusivo para huéspedes registrados. Se prohíbe el uso de equipos de sonido que perturben el descanso de otros huéspedes.', 'general', 3, 1)`, []);

  // ── 13. Reservaciones ficticias ───────────────────────────────
  if (userMaria) {
    const res = await dbRun(`
      INSERT OR IGNORE INTO reservaciones
        (numero_reserva, usuario_id, cabana_id, fecha_entrada, fecha_salida, num_noches, num_adultos, num_menores,
         precio_noche, subtotal, total, estado, metodo_pago, estado_pago, notas_cliente)
      VALUES
        ('RES-2025-001', ?, 1, '2025-07-15', '2025-07-18', 3, 2, 0, 75, 225, 225, 'completada', 'sinpe', 'pagado', 'Fue una estadía maravillosa, muy tranquila.')
    `, [userMaria.id]);

    if (res.lastID) {
      await dbRun(`INSERT OR IGNORE INTO disponibilidad (cabana_id, fecha_inicio, fecha_fin, tipo, reserva_id) VALUES (1, '2025-07-15', '2025-07-18', 'reservado', ?)`, [res.lastID]);
      await dbRun(`INSERT OR IGNORE INTO huespedes (reservacion_id, nombre, apellido, identificacion, edad, sexo, nacionalidad, es_titular, es_menor, email, telefono) VALUES (?, 'María', 'González', '1-0456-0789', 35, 'F', 'Costarricense', 1, 0, 'maria@example.com', '+506 8111-2222')`, [res.lastID]);
      await dbRun(`INSERT OR IGNORE INTO huespedes (reservacion_id, nombre, apellido, identificacion, edad, sexo, nacionalidad, es_titular, es_menor) VALUES (?, 'Andrés', 'González', '1-0555-0000', 37, 'M', 'Costarricense', 0, 0)`, [res.lastID]);
    }
  }

  if (userCarlos) {
    const res2 = await dbRun(`
      INSERT OR IGNORE INTO reservaciones
        (numero_reserva, usuario_id, cabana_id, fecha_entrada, fecha_salida, num_noches, num_adultos, num_menores,
         precio_noche, subtotal, total, estado, metodo_pago, estado_pago)
      VALUES
        ('RES-2025-002', ?, 3, '2025-08-10', '2025-08-14', 4, 2, 1, 190, 760, 760, 'completada', 'tarjeta', 'pagado')
    `, [userCarlos.id]);

    if (res2.lastID) {
      await dbRun(`INSERT OR IGNORE INTO disponibilidad (cabana_id, fecha_inicio, fecha_fin, tipo, reserva_id) VALUES (3, '2025-08-10', '2025-08-14', 'reservado', ?)`, [res2.lastID]);
      await dbRun(`INSERT OR IGNORE INTO huespedes (reservacion_id, nombre, apellido, identificacion, edad, sexo, nacionalidad, es_titular, es_menor, email, telefono) VALUES (?, 'Carlos', 'Rodríguez', '1-0567-0890', 40, 'M', 'Costarricense', 1, 0, 'carlos@example.com', '+506 8333-4444')`, [res2.lastID]);
      await dbRun(`INSERT OR IGNORE INTO huespedes (reservacion_id, nombre, apellido, identificacion, edad, sexo, nacionalidad, es_titular, es_menor) VALUES (?, 'Laura', 'Rodríguez', '1-0600-0001', 38, 'F', 'Costarricense', 0, 0)`, [res2.lastID]);
      await dbRun(`INSERT OR IGNORE INTO huespedes (reservacion_id, nombre, apellido, fecha_nacimiento, edad, sexo, nacionalidad, es_titular, es_menor, relacion_titular) VALUES (?, 'Sofía', 'Rodríguez', '2019-03-20', 6, 'F', 'Costarricense', 0, 1, 'Hija')`, [res2.lastID]);
    }
  }

  if (userAna) {
    // Reservación futura confirmada
    const res3 = await dbRun(`
      INSERT OR IGNORE INTO reservaciones
        (numero_reserva, usuario_id, cabana_id, fecha_entrada, fecha_salida, num_noches, num_adultos, num_menores,
         precio_noche, subtotal, total, estado, metodo_pago, estado_pago)
      VALUES
        ('RES-2026-003', ?, 2, date('now', '+15 days'), date('now', '+18 days'), 3, 3, 0, 175, 525, 525, 'confirmada', 'sinpe', 'pagado')
    `, [userAna.id]);
    if (res3.lastID) {
      await dbRun(`INSERT OR IGNORE INTO disponibilidad (cabana_id, fecha_inicio, fecha_fin, tipo, reserva_id) VALUES (2, date('now', '+15 days'), date('now', '+18 days'), 'reservado', ?)`, [res3.lastID]);
    }

    // Reservación pendiente
    const res4 = await dbRun(`
      INSERT OR IGNORE INTO reservaciones
        (numero_reserva, usuario_id, cabana_id, fecha_entrada, fecha_salida, num_noches, num_adultos, num_menores,
         precio_noche, subtotal, total, estado, metodo_pago, estado_pago)
      VALUES
        ('RES-2026-004', ?, 1, date('now', '+30 days'), date('now', '+33 days'), 3, 1, 0, 50, 150, 150, 'pendiente', 'efectivo', 'pendiente')
    `, [userAna.id]);
    if (res4.lastID) {
      await dbRun(`INSERT OR IGNORE INTO disponibilidad (cabana_id, fecha_inicio, fecha_fin, tipo, reserva_id) VALUES (1, date('now', '+30 days'), date('now', '+33 days'), 'reservado', ?)`, [res4.lastID]);
    }
  }

  // ── 14. Bloqueo de mantenimiento ──────────────────────────────
  await dbRun(`INSERT OR IGNORE INTO disponibilidad (cabana_id, fecha_inicio, fecha_fin, tipo, notas) VALUES (2, date('now', '+5 days'), date('now', '+7 days'), 'mantenimiento', 'Mantenimiento preventivo anual')`, []);

  // ── 15. Comentarios ficticios ─────────────────────────────────
  const comentarios = [
    [userMaria?.id, 1, 5, 'Experiencia increíble. La cabaña estaba limpia, el entorno es mágico. Definitivamente regresaremos.', 'María G.', 1, 1],
    [userCarlos?.id, 3, 5, 'Villa Esmeralda superó todas nuestras expectativas. La piscina privada en medio del bosque es simplemente espectacular.', 'Carlos R.', 1, 1],
    [null, 2, 4, 'Muy buena estadía. Las cabañas son cómodas y el personal muy atento. Recomendado para familias.', 'Ana M.', 1, 1],
    [null, 1, 5, 'Lugar perfecto para desconectarse. Silencio absoluto, naturaleza pura y una cabaña acogedora. 10/10.', 'Roberto P.', 1, 1],
    [null, 3, 5, 'Celebramos nuestro aniversario en Villa Esmeralda y fue el viaje más romántico de nuestra vida. Gracias!', 'Pareja Díaz', 1, 1],
    [null, 2, 4, 'Llegamos con los niños y todo estuvo perfecto. Los senderos cercanos son ideales para caminatas matutinas.', 'Familia Vargas', 1, 1],
  ];
  for (const [uid, cid, cal, com, nombre, vis, apr] of comentarios) {
    if (uid || nombre) {
      await dbRun(
        `INSERT OR IGNORE INTO comentarios (usuario_id, cabana_id, calificacion, comentario, nombre_publico, visible, aprobado) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uid, cid, cal, com, nombre, vis, apr]
      );
    }
  }

  console.log('✅ Seed completado con todos los datos iniciales');
}

module.exports = { seedDatabase };
