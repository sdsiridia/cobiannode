// Base de datos SQLite (better-sqlite3).
// El esquema está pensado para poder migrar a MariaDB más adelante:
// solo se usan tipos simples y AUTOINCREMENT/PRIMARY KEY estándar.
const path = require('path')
const fs = require('fs')
const Database = require('better-sqlite3')
const bcrypt = require('bcryptjs')

const DATA_DIR = path.join(__dirname, '..', 'data')
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

const db = new Database(path.join(DATA_DIR, 'dashboard.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ---------------------------------------------------------------------------
// Esquema
// ---------------------------------------------------------------------------
db.exec(`
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario TEXT NOT NULL UNIQUE,
  pass_hash TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'usuario',   -- 'admin' | 'usuario'
  creado_en TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS credenciales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT NOT NULL,
  usuario TEXT DEFAULT '',
  contrasena TEXT DEFAULT '',           -- cifrada con AES (ver crypto.js)
  url TEXT DEFAULT '',
  notas TEXT DEFAULT '',
  creado_en TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS gmail_credenciales (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  correo TEXT NOT NULL DEFAULT '',
  contrasena TEXT NOT NULL DEFAULT '',  -- cifrada con AES (contraseña de aplicación)
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS historial (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  procesado TEXT NOT NULL,              -- fecha en que se revisó
  fecha_correo TEXT NOT NULL,           -- fecha del correo original
  asunto TEXT NOT NULL,
  empresa TEXT NOT NULL,
  errores INTEGER NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'cobian',  -- 'cobian' | 'acronis'
  correcto INTEGER                      -- solo acronis: 1 = OK, 0 = error
);
`)

// ---------------------------------------------------------------------------
// Usuario administrador inicial
// ---------------------------------------------------------------------------
function asegurarAdmin () {
  const total = db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n
  if (total === 0) {
    const usuario = process.env.ADMIN_USER || 'admin'
    const pass = process.env.ADMIN_PASS || 'admin123'
    const hash = bcrypt.hashSync(pass, 10)
    db.prepare('INSERT INTO usuarios (usuario, pass_hash, rol) VALUES (?, ?, ?)')
      .run(usuario, hash, 'admin')
    console.log(`[db] Usuario administrador creado: ${usuario} (cámbiale la contraseña)`)
  }
}

// ---------------------------------------------------------------------------
// Migración del historial.json del proyecto original (monitor-errores-gmail)
// ---------------------------------------------------------------------------
function migrarHistorialJson () {
  const yaMigrado = db.prepare('SELECT COUNT(*) AS n FROM historial').get().n
  if (yaMigrado > 0) return 0

  // Buscamos historial.json en la carpeta data/ y, si no, en la carpeta
  // del proyecto original que pasó el usuario.
  const candidatos = [
    path.join(DATA_DIR, 'historial.json'),
    path.join(__dirname, '..', '..', '..', '..', '89a3baf3-ccee-4c87-8acb-713b4be82c8c',
      'workspace', 'monitor-errores-gmail', 'historial.json')
  ]
  const origen = candidatos.find(p => fs.existsSync(p))
  if (!origen) return 0

  try {
    const filas = JSON.parse(fs.readFileSync(origen, 'utf-8'))
    if (!Array.isArray(filas) || filas.length === 0) return 0
    const insertar = db.prepare(`INSERT INTO historial
      (procesado, fecha_correo, asunto, empresa, errores, tipo, correcto)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
    const tx = db.transaction(registros => {
      for (const r of registros) {
        insertar.run(
          r.procesado || '',
          r.fecha_correo || '',
          r.asunto || '',
          r.empresa || '',
          Number(r.errores ?? 0),
          r.tipo || 'cobian',
          r.correcto === true ? 1 : (r.correcto === false ? 0 : null)
        )
      }
    })
    tx(filas)
    console.log(`[db] Historial migrado desde ${origen}: ${filas.length} registros`)
    return filas.length
  } catch (err) {
    console.warn('[db] No se pudo migrar historial.json:', err.message)
    return 0
  }
}

asegurarAdmin()
migrarHistorialJson()

module.exports = db
