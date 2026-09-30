// Autenticación del dashboard: login con JWT en cookie httpOnly.
const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const db = require('./db')

const router = express.Router()
const COOKIE = 'token'

function firmar (usuario) {
  return jwt.sign(
    { id: usuario.id, usuario: usuario.usuario, rol: usuario.rol },
    process.env.JWT_SECRET || 'secreto',
    { expiresIn: '12h' }
  )
}

// Middleware: exige sesión válida y guarda req.usuario
function requerirSesion (req, res, next) {
  const token = req.cookies[COOKIE]
  if (!token) return res.status(401).json({ error: 'No has iniciado sesión' })
  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET || 'secreto')
    next()
  } catch {
    return res.status(401).json({ error: 'La sesión ha caducado' })
  }
}

// Middleware: exige rol admin
function requerirAdmin (req, res, next) {
  if (req.usuario?.rol !== 'admin') {
    return res.status(403).json({ error: 'Solo el administrador puede hacer esto' })
  }
  next()
}

router.post('/login', (req, res) => {
  const usuario = (req.body.usuario || '').trim()
  const contrasena = req.body.contrasena || ''
  const fila = db.prepare('SELECT * FROM usuarios WHERE usuario = ?').get(usuario)
  if (!fila || !bcrypt.compareSync(contrasena, fila.pass_hash)) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' })
  }
  res.cookie(COOKIE, firmar(fila), {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 12 * 60 * 60 * 1000
  })
  res.json({ usuario: fila.usuario, rol: fila.rol })
})

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE)
  res.json({ ok: true })
})

router.get('/yo', requerirSesion, (req, res) => {
  res.json({ usuario: req.usuario.usuario, rol: req.usuario.rol })
})

module.exports = { router, requerirSesion, requerirAdmin }
