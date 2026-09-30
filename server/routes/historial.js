// Rutas del historial de errores (tabla historial).
const express = require('express')
const db = require('../db')
const { derivarEmpresa } = require('../monitor/parser')
const { requerirSesion } = require('../auth')

const router = express.Router()
router.use(requerirSesion)

// Lista con filtros opcionales: tipo, empresa, desde, hasta (fechas dd/mm/yyyy
// o texto libre sobre asunto en q)
router.get('/', (req, res) => {
  const { tipo, empresa, q, limite } = req.query
  let sql = 'SELECT * FROM historial WHERE 1=1'
  const params = []
  if (tipo) { sql += ' AND tipo = ?'; params.push(tipo) }
  if (empresa) { sql += ' AND empresa LIKE ?'; params.push(`%${empresa}%`) }
  if (q) { sql += ' AND (asunto LIKE ? OR empresa LIKE ?)'; params.push(`%${q}%`, `%${q}%`) }
  sql += ' ORDER BY id DESC'
  if (limite) { sql += ' LIMIT ?'; params.push(parseInt(limite, 10) || 500) }
  const filas = db.prepare(sql).all(...params)
  const total = db.prepare('SELECT COUNT(*) AS n FROM historial').get().n
  res.json({ filas, total })
})

router.get('/empresas', (req, res) => {
  const filas = db.prepare('SELECT DISTINCT empresa FROM historial ORDER BY empresa').all()
  res.json(filas.map(f => f.empresa))
})

// Resumen para el gráfico / tarjetas
router.get('/resumen', (req, res) => {
  const porDia = db.prepare(`
    SELECT substr(procesado, 1, 10) AS dia,
           SUM(CASE WHEN errores = 0 THEN 1 ELSE 0 END) AS ok,
           SUM(CASE WHEN errores > 0 THEN 1 ELSE 0 END) AS mal
    FROM historial GROUP BY dia ORDER BY dia DESC LIMIT 30
  `).all()
  const total = db.prepare('SELECT COUNT(*) AS n FROM historial').get().n
  const conErrores = db.prepare('SELECT COUNT(*) AS n FROM historial WHERE errores > 0').get().n
  const empresas = db.prepare(`
    SELECT empresa, COUNT(*) AS revisiones,
           SUM(CASE WHEN errores > 0 THEN 1 ELSE 0 END) AS con_errores
    FROM historial GROUP BY empresa ORDER BY con_errores DESC, empresa LIMIT 50
  `).all()
  res.json({ total, conErrores, porDia, empresas })
})

router.delete('/', (req, res) => {
  db.prepare('DELETE FROM historial').run()
  res.json({ ok: true })
})

// ---------------------------------------------------------------------------
// Exportaciones
// ---------------------------------------------------------------------------
function filasExport () {
  return db.prepare('SELECT * FROM historial ORDER BY id').all()
}

function cabecerasCsv () {
  return ['procesado', 'fecha_correo', 'asunto', 'empresa', 'errores', 'tipo', 'correcto']
}

router.get('/export/csv', (req, res) => {
  const filas = filasExport()
  const escapar = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lineas = [cabecerasCsv().join(';')]
  for (const f of filas) {
    lineas.push([
      f.procesado, f.fecha_correo, f.asunto, f.empresa,
      f.errores, f.tipo, f.correcto === null ? '' : f.correcto
    ].map(escapar).join(';'))
  }
  // BOM para que Excel respete los acentos
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="historial_errores.csv"')
  res.send('\uFEFF' + lineas.join('\r\n'))
})

router.get('/export/xlsx', async (req, res) => {
  const ExcelJS = require('exceljs')
  const libro = new ExcelJS.Workbook()

  // Hoja 1: historial completo
  const hoja = libro.addWorksheet('Historial')
  hoja.addRow(['Procesado', 'Fecha correo', 'Asunto', 'Empresa', 'Errores', 'Tipo', 'Correcto'])
  hoja.getRow(1).font = { bold: true }
  for (const f of filasExport()) {
    hoja.addRow([
      f.procesado, f.fecha_correo, f.asunto, f.empresa,
      f.errores, f.tipo, f.correcto === null ? '' : (f.correcto ? 'Sí' : 'No')
    ])
  }
  hoja.columns.forEach(c => { c.width = 24 })

  // Hoja 2: resumen por día (como en el original)
  const resumen = libro.addWorksheet('Resumen por día')
  resumen.addRow(['Día', 'Bien (0 errores)', 'Mal (con errores)'])
  resumen.getRow(1).font = { bold: true }
  const porDia = db.prepare(`
    SELECT substr(procesado, 1, 10) AS dia,
           SUM(CASE WHEN errores = 0 THEN 1 ELSE 0 END) AS ok,
           SUM(CASE WHEN errores > 0 THEN 1 ELSE 0 END) AS mal
    FROM historial GROUP BY dia ORDER BY dia
  `).all()
  for (const d of porDia) {
    const fila = resumen.addRow([d.dia, d.ok, d.mal])
    if (d.mal) fila.getCell(3).font = { bold: true, color: { argb: 'FFC62828' } }
  }
  resumen.columns.forEach(c => { c.width = 20 })

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', 'attachment; filename="historial_errores.xlsx"')
  await libro.xlsx.write(res)
  res.end()
})

module.exports = router
