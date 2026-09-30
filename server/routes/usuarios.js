// Gestión de usuarios del dashboard (solo administrador).
const express = require('express')
const bcrypt = require('bcryptjs')
const db = require('../db')
const { requerirSesion, requerirAdmin } = require('../auth')

const router = express.Router()
router.use(requerirSesion, requerirAdmin)

router.get('/', (req, res) => {
  const filas = db.prepare('SELECT id, usuario, rol, creado_en FROM usuarios ORDER BY id').all()
  res.json(filas)
})

router.post('/', (req, res) => {
  const usuario = (req.body.usuario || '').trim()
  const contrasena = req.body.contrasena || ''
  const rol = req.body.rol === 'admin' ? 'admin' : 'usuario'
  if (!usuario || !contrasena) {
    return res.status(400).json({ error: 'Usuario y contraseña obligatorios' })
  }
  try {
    const info = db.prepare('INSERT INTO usuarios (usuario, pass_hash, rol) VALUES (?, ?, ?)')
      .run(usuario, bcrypt.hashSync(contrasena, 10), rol)
    res.json({ id: info.lastInsertRowid })
  } catch {
    res.status(400).json({ error: 'Ese usuario ya existe' })
  }
})

router.put('/:id', (req, res) => {
  const fila = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.params.id)
  if (!fila) return res.status(404).json({ error: 'No existe ese usuario' })
  const contrasena = req.body.contrasena || ''
  const rol = req.body.rol === 'admin' ? 'admin' : 'usuario'
  if (contrasena) {
    db.prepare('UPDATE usuarios SET pass_hash = ?, rol = ? WHERE id = ?')
      .run(bcrypt.hashSync(contrasena, 10), rol, req.params.id)
  } else {
    db.prepare('UPDATE usuarios SET rol = ? WHERE id = ?').run(rol, req.params.id)
  }
  res.json({ ok: true })
})

router.delete('/:id', (req, res) => {
  // No permitir borrarse a sí mismo ni quedarse sin administradores
  if (Number(req.params.id) === req.usuario.id) {
    return res.status(400).json({ error: 'No puedes borrar tu propio usuario' })
  }
  const admins = db.prepare("SELECT COUNT(*) AS n FROM usuarios WHERE rol = 'admin'").get().n
  const fila = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.params.id)
  if (fila?.rol === 'admin' && admins <= 1) {
    return res.status(400).json({ error: 'Debe quedar al menos un administrador' })
  }
  db.prepare('DELETE FROM usuarios WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

module.exports = router
