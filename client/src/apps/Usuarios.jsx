import React, { useEffect, useState } from 'react'
import { api } from '../api'
import { useSesion } from '../App.jsx'

export default function Usuarios () {
  const { usuario: yo } = useSesion()
  const [filas, setFilas] = useState([])
  const [nuevo, setNuevo] = useState({ usuario: '', contrasena: '', rol: 'usuario' })
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  async function cargar () {
    setFilas(await api.get('/api/usuarios'))
  }
  useEffect(() => { cargar() }, [])

  async function crear (e) {
    e.preventDefault()
    setError('')
    try {
      await api.post('/api/usuarios', nuevo)
      setNuevo({ usuario: '', contrasena: '', rol: 'usuario' })
      setAviso('Usuario creado.')
      await cargar()
    } catch (err) { setError(err.message) }
  }

  async function cambiarRol (id, rol) {
    await api.put(`/api/usuarios/${id}`, { rol })
    await cargar()
  }

  async function cambiarPass (id) {
    const contrasena = prompt('Nueva contraseña:')
    if (!contrasena) return
    await api.put(`/api/usuarios/${id}`, { contrasena })
    setAviso('Contraseña actualizada.')
  }

  async function borrar (id) {
    if (!confirm('¿Borrar este usuario?')) return
    setError('')
    try {
      await api.del(`/api/usuarios/${id}`)
      await cargar()
    } catch (err) { setError(err.message) }
  }

  return (
    <div>
      <h1>👥 Usuarios del dashboard</h1>

      <section className="tarjeta">
        <form onSubmit={crear} className="form-usuario">
          <input id="usu-nuevo-usuario" name="usuario" placeholder="Usuario" value={nuevo.usuario}
            onChange={e => setNuevo({ ...nuevo, usuario: e.target.value })} autoComplete="off" />
          <input id="usu-nuevo-contrasena" name="contrasena" type="password" placeholder="Contraseña" value={nuevo.contrasena}
            onChange={e => setNuevo({ ...nuevo, contrasena: e.target.value })} autoComplete="new-password" />
          <select id="usu-nuevo-rol" name="rol" value={nuevo.rol} onChange={e => setNuevo({ ...nuevo, rol: e.target.value })}>
            <option value="usuario">Usuario</option>
            <option value="admin">Administrador</option>
          </select>
          <button type="submit">➕ Crear</button>
        </form>
        {aviso && <div className="aviso-msg">{aviso}</div>}
        {error && <div className="error">{error}</div>}
      </section>

      <section className="tarjeta">
        <table>
          <thead>
            <tr><th>Usuario</th><th>Rol</th><th>Creado</th><th /></tr>
          </thead>
          <tbody>
            {filas.map(f => (
              <tr key={f.id}>
                <td><strong>{f.usuario}</strong>{f.id === yo.id && <small> (tú)</small>}</td>
                <td>
                  <select id={`usu-rol-${f.id}`} name="rol-usuario" value={f.rol} onChange={e => cambiarRol(f.id, e.target.value)} aria-label={`Rol de ${f.usuario}`}>
                    <option value="usuario">Usuario</option>
                    <option value="admin">Administrador</option>
                  </select>
                </td>
                <td>{f.creado_en}</td>
                <td>
                  <button className="mini" onClick={() => cambiarPass(f.id)}>🔑 Cambiar contraseña</button>
                  {f.id !== yo.id && <button className="mini" onClick={() => borrar(f.id)}>🗑</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
