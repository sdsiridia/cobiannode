// Servidor principal del dashboard.
const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const express = require('express')
const cookieParser = require('cookie-parser')

const { router: authRouter, requerirSesion } = require('./auth')

const app = express()
app.use(express.json({ limit: '10mb' }))
app.use(express.text({ type: 'text/csv', limit: '10mb' }))
app.use(express.text({ type: 'text/plain', limit: '10mb' }))
app.use(cookieParser())

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
app.use('/api/auth', authRouter)
app.use('/api/monitor', require('./routes/monitor'))
app.use('/api/historial', require('./routes/historial'))
app.use('/api/credenciales', require('./routes/credenciales'))
app.use('/api/usuarios', require('./routes/usuarios'))

// Lista de apps del dashboard (para el menú lateral)
app.get('/api/apps', requerirSesion, (req, res) => {
  res.json([
    { id: 'monitor', nombre: 'Monitor de errores Gmail', icono: '📧', descripcion: 'Revisión de correos de respaldo (Cobian / Acronis)' },
    { id: 'credenciales', nombre: 'Credenciales', icono: '🔑', descripcion: 'Base de datos de accesos por empresa' },
    { id: 'usuarios', nombre: 'Usuarios', icono: '👥', descripcion: 'Gestión de usuarios del dashboard (admin)', soloAdmin: true }
  ])
})

// ---------------------------------------------------------------------------
// Cliente React compilado (client/dist)
// ---------------------------------------------------------------------------
const DIST = path.join(__dirname, '..', 'client', 'dist')
const INDEX_HTML = path.join(DIST, 'index.html')
if (fs.existsSync(INDEX_HTML)) {
  app.use(express.static(DIST))
  // Cualquier ruta que no sea /api devuelve el index.html (SPA)
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api/')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      return fs.createReadStream(INDEX_HTML).pipe(res)
    }
    next()
  })
}

// Manejo de errores
app.use((err, req, res, next) => {
  console.error('[error]', err.message)
  res.status(500).json({ error: err.message || 'Error interno' })
})

// Blindaje: un error no controlado (p. ej. de la librería IMAP) no debe
// tirar abajo el servidor entero.
process.on('unhandledRejection', err => {
  console.error('[promesa rechazada]', err?.message || err)
})
process.on('uncaughtException', err => {
  console.error('[excepción no capturada]', err?.message || err)
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Dashboard funcionando en http://localhost:${PORT}`)
})
