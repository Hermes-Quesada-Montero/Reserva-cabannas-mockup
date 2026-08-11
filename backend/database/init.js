/**
 * Inicializador de la base de datos
 * Crea el schema y carga los datos semilla en la primera ejecución
 */

const { dbExec, dbGet, dbRun, dbAll } = require('./db');
const SCHEMA_SQL = require('./schema');
const { seedDatabase } = require('./seed');

/**
 * Inicializa la base de datos: crea tablas y carga seed si está vacía
 */
async function initDatabase() {
  try {
    console.log('🗄️  Inicializando base de datos...');

    // Crear todas las tablas
    await dbExec(SCHEMA_SQL);
    console.log('✅ Tablas creadas / verificadas');

    // ── Migraciones (añadir columnas que puedan faltar en versiones antiguas) ──
    await runMigrations();

    // Verificar si ya tiene datos
    const existingAdmin = await dbGet("SELECT id FROM usuarios WHERE rol = 'admin' LIMIT 1");

    if (!existingAdmin) {
      console.log('📦 Cargando datos iniciales...');
      await seedDatabase(dbRun, dbGet, dbAll);
      console.log('✅ Datos iniciales cargados');
    } else {
      console.log('ℹ️  Base de datos ya tiene datos, omitiendo seed');
    }

    console.log('🎉 Base de datos lista');
  } catch (err) {
    console.error('❌ Error inicializando base de datos:', err);
    throw err;
  }
}

/**
 * Migraciones seguras: añade columnas que puedan no existir
 * SQLite ignora el error si la columna ya existe en "duplicate column name"
 */
async function runMigrations() {
  const migraciones = [
    // mensajes_contacto: agregar estado y nota_admin
    `ALTER TABLE mensajes_contacto ADD COLUMN estado TEXT NOT NULL DEFAULT 'nuevo'`,
    `ALTER TABLE mensajes_contacto ADD COLUMN nota_admin TEXT`,
    // mensajes_contacto: vincular con usuario y guardar respuesta del admin
    `ALTER TABLE mensajes_contacto ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id)`,
    `ALTER TABLE mensajes_contacto ADD COLUMN respuesta_admin TEXT`,
    `ALTER TABLE mensajes_contacto ADD COLUMN respondido_en TEXT`,
    // banners: normalizar nombre de columna (alias imagen_url)
    `ALTER TABLE banners ADD COLUMN imagen_url TEXT`,
    `ALTER TABLE banners ADD COLUMN btn_texto_1 TEXT`,
    `ALTER TABLE banners ADD COLUMN btn_texto_2 TEXT`,
    // usuarios: agregar campo nombre_completo y estado
    `ALTER TABLE usuarios ADD COLUMN nombre_completo TEXT`,
    `ALTER TABLE usuarios ADD COLUMN estado TEXT DEFAULT 'activo'`,
    // cabanas: agregar descripcion_corta y tiene_piscina
    `ALTER TABLE cabanas ADD COLUMN descripcion_corta TEXT`,
    `ALTER TABLE cabanas ADD COLUMN tiene_piscina INTEGER DEFAULT 0`,
    `ALTER TABLE cabanas ADD COLUMN servicios TEXT`,
    `ALTER TABLE cabanas ADD COLUMN reglas TEXT`,
    // cabanas: agregar estado ('disponible'|'mantenimiento'|'inactiva')
    `ALTER TABLE cabanas ADD COLUMN estado TEXT DEFAULT 'disponible'`,
    // politicas: agregar actualizado_en
    `ALTER TABLE politicas ADD COLUMN actualizado_en TEXT`,
    // reservaciones: agregar num_adultos, num_menores, codigo_reserva
    `ALTER TABLE reservaciones ADD COLUMN num_adultos INTEGER DEFAULT 1`,
    `ALTER TABLE reservaciones ADD COLUMN num_menores INTEGER DEFAULT 0`,
  ];

  for (const sql of migraciones) {
    try {
      await dbRun(sql);
    } catch (e) {
      // Ignorar "duplicate column name" — columna ya existe
      if (!e.message.includes('duplicate column name') && !e.message.includes('already exists')) {
        console.warn('⚠️  Migración omitida:', e.message.substring(0, 80));
      }
    }
  }

  // Migración especial: ampliar CHECK de tipo en disponibilidad
  // SQLite no soporta ALTER TABLE para modificar constraints, se recrea la tabla
  await migrateDisponibilidadCheck();

  console.log('✅ Migraciones aplicadas');

  // ── Actualizar imágenes locales que no existen por URLs de Unsplash ────────
  await fixImageUrls();
}

/**
 * Reemplaza rutas de imágenes locales (que no existen) por URLs externas de Unsplash.
 * Se ejecuta siempre que las rutas sean locales (/images/...).
 */
async function fixImageUrls() {
  try {
    // Mapeo de URLs locales → URLs externas para cabañas
    const cabanaImages = {
      '/images/cabanas/cabana1-hero.jpg': 'https://images.unsplash.com/photo-1542718610-a1d656d1884c?w=800&q=80',
      '/images/cabanas/cabana2-hero.jpg': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
      '/images/cabanas/cabana3-hero.jpg': 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800&q=80',
    };
    for (const [local, remote] of Object.entries(cabanaImages)) {
      await dbRun(`UPDATE cabanas SET imagen_principal = ? WHERE imagen_principal = ?`, [remote, local]);
    }

    // Banners
    const bannerImages = [
      ['https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=1920&q=80', 1],
      ['https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=1920&q=80', 2],
      ['https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1920&q=80', 3],
    ];
    for (const [url, orden] of bannerImages) {
      await dbRun(`UPDATE banners SET url_imagen = ? WHERE orden = ? AND url_imagen LIKE '/images/%'`, [url, orden]);
    }

    // Galería
    const galeriaImageMap = [
      ['https://images.unsplash.com/photo-1542718610-a1d656d1884c?w=600&q=80', 1],
      ['https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600&q=80', 2],
      ['https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&q=80', 3],
      ['https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80', 4],
      ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&q=80', 5],
      ['https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=600&q=80', 6],
      ['https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=600&q=80', 7],
      ['https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=600&q=80', 8],
      ['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80', 9],
      ['https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?w=600&q=80', 10],
      ['https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&q=80', 11],
      ['https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600&q=80', 12],
      ['https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80', 13],
      ['https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=600&q=80', 14],
      ['https://images.unsplash.com/photo-1533130061792-64b345e4a833?w=600&q=80', 15],
    ];
    for (const [url, orden] of galeriaImageMap) {
      await dbRun(`UPDATE galeria SET url_imagen = ? WHERE orden = ? AND url_imagen LIKE '/images/%'`, [url, orden]);
    }

    console.log('✅ URLs de imágenes actualizadas');
  } catch (err) {
    console.warn('⚠️  Error actualizando imágenes:', err.message);
  }
}

/**
 * Amplía el CHECK constraint de disponibilidad.tipo para aceptar más valores.
 * Solo recrea la tabla si el constraint original aún está activo.
 */
async function migrateDisponibilidadCheck() {
  try {
    // Probar si el constraint ya fue ampliado intentando un INSERT con 'limpieza'
    await dbRun(`INSERT INTO disponibilidad (cabana_id, fecha_inicio, fecha_fin, tipo) VALUES (0, '1970-01-01', '1970-01-01', 'limpieza')`);
    // Éxito → constraint ya ampliado, limpiar registro de prueba y salir
    await dbRun(`DELETE FROM disponibilidad WHERE cabana_id = 0`);
  } catch(e) {
    if (!e.message || !e.message.includes('CHECK constraint')) return;
    // Constraint viejo → recrear la tabla preservando los datos
    try {
      await dbRun(`BEGIN TRANSACTION`);
      await dbRun(`ALTER TABLE disponibilidad RENAME TO _disp_old`);
      await dbRun(`
        CREATE TABLE disponibilidad (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          cabana_id    INTEGER NOT NULL REFERENCES cabanas(id) ON DELETE CASCADE,
          fecha_inicio TEXT NOT NULL,
          fecha_fin    TEXT NOT NULL,
          tipo         TEXT NOT NULL DEFAULT 'reservado'
                         CHECK(tipo IN ('reservado','mantenimiento','bloqueado','limpieza','reparacion','reserva_interna','otro')),
          reserva_id   INTEGER REFERENCES reservaciones(id) ON DELETE SET NULL,
          notas        TEXT
        )
      `);
      await dbRun(`INSERT INTO disponibilidad SELECT id,cabana_id,fecha_inicio,fecha_fin,tipo,reserva_id,notas FROM _disp_old`);
      await dbRun(`DROP TABLE _disp_old`);
      await dbRun(`COMMIT`);
      console.log('✅ disponibilidad.tipo CHECK ampliado');
    } catch(err) {
      await dbRun(`ROLLBACK`).catch(() => {});
      console.warn('⚠️  Error migrando disponibilidad.tipo:', err.message);
    }
  }
}

module.exports = { initDatabase };
