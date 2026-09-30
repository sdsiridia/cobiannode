// Rutas de la app "Monitor de errores Gmail".
const express = require('express')
const db = require('../db')
const { cifrar, descifrar } = require('../crypto')
const { lanzarRevision, JOBS } = require('../monitor/jobs')
const { requerirSesion } = require('../auth')

const router = express.Router()
router.use(requerirSesion)

// ---------------------------------------------------------------------------
// Credenciales de Gmail (guardadas cifradas en la base de datos)
// ---------------------------------------------------------------------------
router.get('/credenciales', (req, res) => {
  const fila = db.prepare('SELECT * FROM gmail_credenciales WHERE id = 1').get()
  res.json({
    guardadas: !!fila,
    correo: fila ? fila.correo : '',
    actualizado: fila ? fila.actualizado_en : null
  })
})

router.post('/credenciales', (req, res) => {
  const correo = (req.body.correo || '').trim()
  const contrasena = req.body.contrasena || ''
  if (!correo || !contrasena) {
    return res.status(400).json({ error: 'Escribe el correo y la contraseña de aplicación.' })
  }
  db.prepare(`
    INSERT INTO gmail_credenciales (id, correo, contrasena, actualizado_en)
    VALUES (1, ?, ?, datetime('now','localtime'))
    ON CONFLICT(id) DO UPDATE SET
      correo = excluded.correo,
      contrasena = excluded.contrasena,
      actualizado_en = excluded.actualizado_en
  `).run(correo, cifrar(contrasena))
  res.json({ ok: true })
})

router.delete('/credenciales', (req, res) => {
  db.prepare('DELETE FROM gmail_credenciales WHERE id = 1').run()
  res.json({ ok: true })
})

// ---------------------------------------------------------------------------
// Revisión
// ---------------------------------------------------------------------------
router.post('/revisar', (req, res) => {
  const fila = db.prepare('SELECT * FROM gmail_credenciales WHERE id = 1').get()
  if (!fila) {
    return res.status(400).json({ error: 'Primero guarda tus credenciales de Gmail.' })
  }
  const contrasena = descifrar(fila.contrasena)
  const marcarLeidosConErrores = !!req.body.marcarLeidosConErrores
  const jobId = lanzarRevision(fila.correo, contrasena, marcarLeidosConErrores)
  res.json({ jobId })
})

router.get('/jobs/:id', (req, res) => {
  const job = JOBS.get(req.params.id)
  if (!job) return res.status(404).json({ error: 'Trabajo no encontrado' })
  const { resultados, acronis, estadisticas, ...resto } = job
  res.json(resto)
})

router.get('/resultados/:id', (req, res) => {
  const job = JOBS.get(req.params.id)
  if (!job) return res.status(404).json({ error: 'Trabajo no encontrado' })
  if (job.estado !== 'listo') {
    return res.status(400).json({ error: 'La revisión aún no ha terminado' })
  }
  res.json({
    resultados: job.resultados,
    acronis: job.acronis,
    estadisticas: job.estadisticas
  })
})

module.exports = router
