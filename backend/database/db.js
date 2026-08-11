/**
 * Capa de acceso a la base de datos — better-sqlite3
 *
 * better-sqlite3 es síncrono. Para mantener compatibilidad con el código
 * async/await existente en los controladores, se exportan wrappers que
 * devuelven Promises resueltas inmediatamente (no hay I/O asíncrono real).
 *
 * Archivo de base de datos: data/cabanas.db  (relativo a la raíz del proyecto)
 */

const BetterSQLite = require('better-sqlite3');
const path         = require('path');
const fs           = require('fs');

// ── Ruta del archivo .db ──────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, '../../data');
const DB_PATH  = path.join(DATA_DIR, 'cabanas.db');

// Crear carpeta data/ si no existe
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ── Instancia global (singleton) ───────────────────────────────────────────────
let _db = null;

function getDB() {
  if (!_db) {
    _db = new BetterSQLite(DB_PATH);
    // Activar claves foráneas y modo WAL para mejor rendimiento
    _db.pragma('foreign_keys = ON');
    _db.pragma('journal_mode = WAL');
  }
  return _db;
}

// ── Helpers con interfaz Promise (compatibilidad con código async existente) ────

/**
 * Ejecutar SQL sin retorno (INSERT, UPDATE, DELETE, CREATE TABLE…)
 * Retorna el objeto RunResult de better-sqlite3: { lastInsertRowid, changes }
 */
function dbRun(sql, params = []) {
  try {
    const stmt   = getDB().prepare(sql);
    const result = stmt.run(...(Array.isArray(params) ? params : [params]));
    return Promise.resolve({ lastID: result.lastInsertRowid, changes: result.changes });
  } catch (err) {
    return Promise.reject(err);
  }
}

/**
 * Obtener una sola fila
 */
function dbGet(sql, params = []) {
  try {
    const stmt = getDB().prepare(sql);
    const row  = stmt.get(...(Array.isArray(params) ? params : [params]));
    return Promise.resolve(row || null);
  } catch (err) {
    return Promise.reject(err);
  }
}

/**
 * Obtener múltiples filas
 */
function dbAll(sql, params = []) {
  try {
    const stmt = getDB().prepare(sql);
    const rows = stmt.all(...(Array.isArray(params) ? params : [params]));
    return Promise.resolve(rows);
  } catch (err) {
    return Promise.reject(err);
  }
}

/**
 * Ejecutar un bloque SQL con múltiples sentencias (para el schema completo)
 * better-sqlite3 usa db.exec() para esto
 */
function dbExec(sql) {
  try {
    getDB().exec(sql);
    return Promise.resolve();
  } catch (err) {
    return Promise.reject(err);
  }
}

/**
 * Ejecutar múltiples operaciones en una sola transacción
 * @param {Function} fn  función que recibe el objeto db y ejecuta operaciones
 */
function dbTransaction(fn) {
  try {
    const result = getDB().transaction(fn)();
    return Promise.resolve(result);
  } catch (err) {
    return Promise.reject(err);
  }
}

module.exports = { getDB, dbRun, dbGet, dbAll, dbExec, dbTransaction };
