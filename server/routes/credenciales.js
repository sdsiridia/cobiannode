// Rutas del gestor de credenciales (importación de KeePass CSV incluida).
const express = require('express')
const db = require('../db')
const { cifrar, descifrar } = require('../crypto')
const { requerirSesion } = require('../auth')
const { parse } = require('csv-parse/sync')

const router = express.Router()
router.use(requerirSesion)

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------
router.get('/', (req, res) => {
  const q = (req.query.q || '').trim()
  let sql = `SELECT id, titulo, usuario, contrasena, url, notas,
                    creado_en, actualizado_en
             FROM credenciales WHERE 1=1`
  const params = []
  if (q) {
    sql += ' AND (titulo LIKE ? OR usuario LIKE ? OR notas LIKE ? OR url LIKE ?)'
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`)
  }
  sql += ' ORDER BY titulo COLLATE NOCASE'
  const filas = db.prepare(sql).all(...params)
  // Desciframos las contraseñas para mostrarlas en la interfaz
  for (const f of filas) f.contrasena = descifrar(f.contrasena)
  res.json(filas)
})

router.post('/', (req, res) => {
  const { titulo, usuario, contrasena, url, notas } = req.body
  if (!(titulo || '').trim()) {
    return res.status(400).json({ error: 'El título es obligatorio' })
  }
  const info = db.prepare(`
    INSERT INTO credenciales (titulo, usuario, contrasena, url, notas)
    VALUES (?, ?, ?, ?, ?)
  `).run(titulo.trim(), usuario || '', cifrar(contrasena || ''), url || '', notas || '')
  res.json({ id: info.lastInsertRowid })
})

router.put('/:id', (req, res) => {
  const fila = db.prepare('SELECT * FROM credenciales WHERE id = ?').get(req.params.id)
  if (!fila) return res.status(404).json({ error: 'No existe esa credencial' })
  const { titulo, usuario, contrasena, url, notas } = req.body
  // Si la contraseña viene vacía se mantiene la que ya había
  const nuevaPass = contrasena === '' || contrasena === undefined
    ? fila.contrasena
    : cifrar(contrasena)
  db.prepare(`
    UPDATE credenciales
    SET titulo = ?, usuario = ?, contrasena = ?, url = ?, notas = ?,
        actualizado_en = datetime('now','localtime')
    WHERE id = ?
  `).run(
    (titulo ?? fila.titulo).trim(),
    usuario ?? fila.usuario,
    nuevaPass,
    url ?? fila.url,
    notas ?? fila.notas,
    req.params.id
  )
  res.json({ ok: true })
})

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM credenciales WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ---------------------------------------------------------------------------
// Importación del CSV de KeePass:
//   cabeceras: "Account","Login Name","Password","Web Site","Comments"
//   -> titulo, usuario, contrasena, url, notas
// El cliente envía el contenido del CSV como texto plano (body).
// ---------------------------------------------------------------------------
router.post('/importar', (req, res) => {
  const texto = req.body
  if (!texto || typeof texto !== 'string' || texto.trim() === '') {
    return res.status(400).json({ error: 'No se ha recibido ningún CSV' })
  }

  // KeePass escapa las comillas literales como \" en vez del \"\" estándar.
  // Lo normalizamos antes de parsear.
  const textoNormalizadoCsv = texto.split('\\"').join('""')
  let filas
  try {
    filas = parse(textoNormalizadoCsv, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      relax_quotes: true
    })
  } catch (err) {
    return res.status(400).json({ error: 'El CSV no es válido: ' + err.message })
  }

  const insertar = db.prepare(`
    INSERT INTO credenciales (titulo, usuario, contrasena, url, notas)
    VALUES (?, ?, ?, ?, ?)
  `)
  const tx = db.transaction(registros => {
    let n = 0
    for (const r of registros) {
      const titulo = (r['Account'] || r['account'] || '').trim()
      if (!titulo) continue // sin título no hay entrada
      const notas = [r['Comments'] || ''].join('')
      insertar.run(
        titulo,
        (r['Login Name'] || '').trim(),
        cifrar(r['Password'] || ''),
        (r['Web Site'] || '').trim(),
        notas
      )
      n++
    }
    return n
  })

  try {
    const n = tx(filas)
    const total = db.prepare('SELECT COUNT(*) AS n FROM credenciales').get().n
    res.json({ importadas: n, total })
  } catch (err) {
    res.status(500).json({ error: 'Error al importar: ' + err.message })
  }
})

// Exportar todas las credenciales al mismo formato de CSV
router.get('/export/csv', (req, res) => {
  const filas = db.prepare('SELECT * FROM credenciales ORDER BY titulo COLLATE NOCASE').all()
  const escapar = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lineas = ['"Account","Login Name","Password","Web Site","Comments"']
  for (const f of filas) {
    lineas.push([
      f.titulo, f.usuario, descifrar(f.contrasena), f.url, f.notas
    ].map(escapar).join(','))
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="credenciales.csv"')
  res.send('\uFEFF' + lineas.join('\r\n'))
})

module.exports = router
