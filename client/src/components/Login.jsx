import React, { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { api } from '../api'
import { useSesion } from '../App.jsx'

export default function Login () {
  const { usuario, setUsuario } = useSesion()
  const navegar = useNavigate()
  const [usuario_, setUsuario_] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  if (usuario) return <Navigate to="/" replace />

  async function entrar (e) {
    e.preventDefault()
    setEnviando(true)
    setError('')
    try {
      const yo = await api.post('/api/auth/login', { usuario: usuario_, contrasena })
      setUsuario(yo)
      navegar('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="pantalla-login">
      <form className="tarjeta-login" onSubmit={entrar}>
        <h1>🔐 Dashboard Ingesist</h1>
        <p className="subtitulo">Inicia sesión para continuar</p>
        <label>
          Usuario
          <input
            value={usuario_}
            onChange={e => setUsuario_(e.target.value)}
            autoFocus
            autoComplete="username"
          />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            value={contrasena}
            onChange={e => setContrasena(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error && <div className="error">{error}</div>}
        <button type="submit" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
