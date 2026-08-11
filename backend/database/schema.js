/**
 * Schema SQL para el Sistema de Reservación de Cabañas
 * Define todas las tablas con sus relaciones, índices y constraints
 */

const SCHEMA_SQL = `
-- ============================================================
-- USUARIOS Y AUTENTICACIÓN
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre      TEXT NOT NULL,
  apellido    TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  username    TEXT UNIQUE,
  password    TEXT NOT NULL,
  telefono    TEXT,
  identificacion TEXT,
  fecha_nacimiento TEXT,
  sexo        TEXT CHECK(sexo IN ('M','F','Otro')),
  nacionalidad TEXT DEFAULT 'Costarricense',
  rol         TEXT NOT NULL DEFAULT 'cliente' CHECK(rol IN ('admin','cliente')),
  activo      INTEGER NOT NULL DEFAULT 1,
  recordarme  INTEGER NOT NULL DEFAULT 0,
  foto_perfil TEXT,
  creado_en   TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- CONFIGURACIÓN DEL SITIO
-- ============================================================
CREATE TABLE IF NOT EXISTS configuracion (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  clave       TEXT UNIQUE NOT NULL,
  valor       TEXT,
  descripcion TEXT,
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- CABAÑAS
-- ============================================================
CREATE TABLE IF NOT EXISTS cabanas (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre        TEXT NOT NULL,
  descripcion   TEXT,
  descripcion_corta TEXT,
  num_habitaciones INTEGER NOT NULL DEFAULT 1,
  capacidad_max INTEGER NOT NULL DEFAULT 2,
  tiene_piscina INTEGER NOT NULL DEFAULT 0,
  servicios     TEXT,  -- JSON array
  reglas        TEXT,  -- JSON array
  imagen_principal TEXT,
  orden         INTEGER DEFAULT 0,
  activa        INTEGER NOT NULL DEFAULT 1,
  creado_en     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- TARIFAS POR CABAÑA Y NÚMERO DE PERSONAS
-- ============================================================
CREATE TABLE IF NOT EXISTS tarifas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  cabana_id   INTEGER NOT NULL REFERENCES cabanas(id) ON DELETE CASCADE,
  num_personas INTEGER NOT NULL,
  precio_noche REAL NOT NULL,
  descripcion TEXT,
  activa      INTEGER NOT NULL DEFAULT 1
);

-- ============================================================
-- GALERÍA DE IMÁGENES
-- ============================================================
CREATE TABLE IF NOT EXISTS galeria (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  cabana_id   INTEGER REFERENCES cabanas(id) ON DELETE SET NULL,
  titulo      TEXT,
  descripcion TEXT,
  url_imagen  TEXT NOT NULL,
  categoria   TEXT DEFAULT 'general',
  orden       INTEGER DEFAULT 0,
  activa      INTEGER NOT NULL DEFAULT 1,
  creado_en   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- DISPONIBILIDAD / BLOQUEOS DE FECHAS
-- ============================================================
CREATE TABLE IF NOT EXISTS disponibilidad (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  cabana_id   INTEGER NOT NULL REFERENCES cabanas(id) ON DELETE CASCADE,
  fecha_inicio TEXT NOT NULL,
  fecha_fin    TEXT NOT NULL,
  tipo         TEXT NOT NULL DEFAULT 'reservado' CHECK(tipo IN ('reservado','mantenimiento','bloqueado')),
  reserva_id   INTEGER REFERENCES reservaciones(id) ON DELETE SET NULL,
  notas        TEXT
);

-- ============================================================
-- CLIENTES (perfil extendido del usuario cliente)
-- ============================================================
CREATE TABLE IF NOT EXISTS clientes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id  INTEGER UNIQUE NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  direccion   TEXT,
  ciudad      TEXT,
  pais        TEXT DEFAULT 'Costa Rica',
  codigo_postal TEXT,
  notas_admin TEXT,
  total_reservas INTEGER DEFAULT 0,
  total_gastado  REAL DEFAULT 0,
  creado_en   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- RESERVACIONES
-- ============================================================
CREATE TABLE IF NOT EXISTS reservaciones (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  numero_reserva  TEXT UNIQUE NOT NULL,
  usuario_id      INTEGER NOT NULL REFERENCES usuarios(id),
  cabana_id       INTEGER NOT NULL REFERENCES cabanas(id),
  fecha_entrada   TEXT NOT NULL,
  fecha_salida    TEXT NOT NULL,
  num_noches      INTEGER NOT NULL,
  num_adultos     INTEGER NOT NULL DEFAULT 1,
  num_menores     INTEGER NOT NULL DEFAULT 0,
  precio_noche    REAL NOT NULL,
  subtotal        REAL NOT NULL,
  descuento       REAL DEFAULT 0,
  total           REAL NOT NULL,
  estado          TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','confirmada','cancelada','completada','no_show')),
  metodo_pago     TEXT CHECK(metodo_pago IN ('tarjeta','sinpe','efectivo','pendiente')),
  estado_pago     TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado_pago IN ('pendiente','pagado','reembolsado','fallido')),
  cupon_codigo    TEXT,
  notas_cliente   TEXT,
  notas_admin     TEXT,
  codigo_qr       TEXT,
  pdf_path        TEXT,
  ics_path        TEXT,
  hora_entrada    TEXT DEFAULT '13:00',
  hora_salida     TEXT DEFAULT '12:00',
  creado_en       TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- HUÉSPEDES (titular + acompañantes de cada reservación)
-- ============================================================
CREATE TABLE IF NOT EXISTS huespedes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  reservacion_id  INTEGER NOT NULL REFERENCES reservaciones(id) ON DELETE CASCADE,
  nombre          TEXT NOT NULL,
  apellido        TEXT NOT NULL,
  identificacion  TEXT,
  fecha_nacimiento TEXT,
  edad            INTEGER,
  sexo            TEXT CHECK(sexo IN ('M','F','Otro')),
  nacionalidad    TEXT DEFAULT 'Costarricense',
  es_titular      INTEGER NOT NULL DEFAULT 0,
  es_menor        INTEGER NOT NULL DEFAULT 0,
  relacion_titular TEXT,
  email           TEXT,
  telefono        TEXT
);

-- ============================================================
-- PAGOS
-- ============================================================
CREATE TABLE IF NOT EXISTS pagos (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  reservacion_id  INTEGER NOT NULL REFERENCES reservaciones(id) ON DELETE CASCADE,
  metodo          TEXT NOT NULL CHECK(metodo IN ('tarjeta','sinpe','efectivo')),
  monto           REAL NOT NULL,
  moneda          TEXT DEFAULT 'USD',
  estado          TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','procesando','completado','fallido','reembolsado')),
  referencia_externa TEXT,
  comprobante_path TEXT,
  stripe_payment_intent TEXT,
  notas           TEXT,
  creado_en       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- CUPONES Y PROMOCIONES
-- ============================================================
CREATE TABLE IF NOT EXISTS cupones (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo      TEXT UNIQUE NOT NULL,
  descripcion TEXT,
  tipo        TEXT NOT NULL CHECK(tipo IN ('porcentaje','monto_fijo')),
  valor       REAL NOT NULL,
  minimo_reserva REAL DEFAULT 0,
  maximo_usos INTEGER DEFAULT 100,
  usos_actuales INTEGER DEFAULT 0,
  fecha_inicio TEXT,
  fecha_fin    TEXT,
  activo      INTEGER NOT NULL DEFAULT 1,
  creado_en   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- MÉTODOS DE PAGO CONFIGURADOS
-- ============================================================
CREATE TABLE IF NOT EXISTS metodos_pago (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre      TEXT NOT NULL,
  tipo        TEXT NOT NULL CHECK(tipo IN ('tarjeta','sinpe','efectivo')),
  descripcion TEXT,
  instrucciones TEXT,
  activo      INTEGER NOT NULL DEFAULT 1,
  orden       INTEGER DEFAULT 0
);

-- ============================================================
-- COMENTARIOS Y RESEÑAS
-- ============================================================
CREATE TABLE IF NOT EXISTS comentarios (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id      INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  cabana_id       INTEGER REFERENCES cabanas(id) ON DELETE SET NULL,
  reservacion_id  INTEGER REFERENCES reservaciones(id) ON DELETE SET NULL,
  calificacion    INTEGER NOT NULL CHECK(calificacion BETWEEN 1 AND 5),
  comentario      TEXT NOT NULL,
  nombre_publico  TEXT,
  visible         INTEGER NOT NULL DEFAULT 1,
  aprobado        INTEGER NOT NULL DEFAULT 0,
  creado_en       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- PREGUNTAS FRECUENTES
-- ============================================================
CREATE TABLE IF NOT EXISTS faqs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  pregunta    TEXT NOT NULL,
  respuesta   TEXT NOT NULL,
  categoria   TEXT DEFAULT 'general',
  orden       INTEGER DEFAULT 0,
  activa      INTEGER NOT NULL DEFAULT 1
);

-- ============================================================
-- INFORMACIÓN DE CONTACTO Y REDES SOCIALES
-- ============================================================
CREATE TABLE IF NOT EXISTS contacto (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo        TEXT NOT NULL,
  valor       TEXT NOT NULL,
  descripcion TEXT,
  icono       TEXT,
  activo      INTEGER NOT NULL DEFAULT 1,
  orden       INTEGER DEFAULT 0
);

-- ============================================================
-- MENSAJES DE CONTACTO
-- ============================================================
CREATE TABLE IF NOT EXISTS mensajes_contacto (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre           TEXT NOT NULL,
  email            TEXT NOT NULL,
  telefono         TEXT,
  asunto           TEXT,
  mensaje          TEXT NOT NULL,
  leido            INTEGER NOT NULL DEFAULT 0,
  respondido       INTEGER NOT NULL DEFAULT 0,
  estado           TEXT NOT NULL DEFAULT 'nuevo',
  nota_admin       TEXT,
  usuario_id       INTEGER REFERENCES usuarios(id),
  respuesta_admin  TEXT,
  respondido_en    TEXT,
  creado_en        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- BANNERS / SLIDES DEL HERO
-- ============================================================
CREATE TABLE IF NOT EXISTS banners (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo      TEXT,
  subtitulo   TEXT,
  url_imagen  TEXT,
  url_video   TEXT,
  url_boton   TEXT,
  texto_boton TEXT,
  orden       INTEGER DEFAULT 0,
  activo      INTEGER NOT NULL DEFAULT 1
);

-- ============================================================
-- POLÍTICAS DEL HOTEL
-- ============================================================
CREATE TABLE IF NOT EXISTS politicas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo      TEXT NOT NULL,
  contenido   TEXT NOT NULL,
  tipo        TEXT DEFAULT 'general',
  orden       INTEGER DEFAULT 0,
  activa      INTEGER NOT NULL DEFAULT 1
);

-- ============================================================
-- LOG DE ACTIVIDAD ADMINISTRATIVA
-- ============================================================
CREATE TABLE IF NOT EXISTS log_actividad (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id  INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  accion      TEXT NOT NULL,
  tabla       TEXT,
  registro_id INTEGER,
  detalles    TEXT,
  ip          TEXT,
  creado_en   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Índices para optimizar consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_reservaciones_usuario ON reservaciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_reservaciones_cabana ON reservaciones(cabana_id);
CREATE INDEX IF NOT EXISTS idx_reservaciones_fechas ON reservaciones(fecha_entrada, fecha_salida);
CREATE INDEX IF NOT EXISTS idx_disponibilidad_cabana ON disponibilidad(cabana_id);
CREATE INDEX IF NOT EXISTS idx_huespedes_reservacion ON huespedes(reservacion_id);
CREATE INDEX IF NOT EXISTS idx_pagos_reservacion ON pagos(reservacion_id);
CREATE INDEX IF NOT EXISTS idx_galeria_cabana ON galeria(cabana_id);
CREATE INDEX IF NOT EXISTS idx_tarifas_cabana ON tarifas(cabana_id);
CREATE INDEX IF NOT EXISTS idx_comentarios_cabana ON comentarios(cabana_id);
`;

module.exports = SCHEMA_SQL;
