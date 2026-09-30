import React, { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useSesion } from '../App.jsx'

const APPS = [
  { id: 'monitor', ruta: '/', nombre: 'Monitor de errores Gmail', icono: '📧' },
  { id: 'credenciales', ruta: '/credenciales', nombre: 'Credenciales', icono: '🔑' },
  { id: 'usuarios', ruta: '/usuarios', nombre: 'Usuarios', icono: '👥', soloAdmin: true }
]

export default function Layout ({ children }) {
  const { usuario, setUsuario } = useSesion()
  const navegar = useNavigate()
  const [abierto, setAbierto] = useState(true)
  const [tema, setTema] = useState(() => localStorage.getItem('tema') || 'claro')

  // Aplicar el tema al <body> y recordarlo
  useEffect(() => {
    document.body.dataset.tema = tema
    localStorage.setItem('tema', tema)
  }, [tema])

  async function salir () {
    await api.post('/api/auth/logout', {})
    setUsuario(null)
    navegar('/login')
  }

  return (
    <div className="layout">
      <aside className={`sidebar ${abierto ? '' : 'cerrada'}`}>
        <div className="marca">
          <span className="logo">🦾</span>
          {abierto && <span>Dashboard</span>}
        </div>
        <nav>
          {APPS.filter(a => !a.soloAdmin || usuario?.rol === 'admin').map(a => (
            <NavLink key={a.id} to={a.ruta} end className={({ isActive }) => isActive ? 'activo' : ''}>
              <span className="icono">{a.icono}</span>
              {abierto && <span>{a.nombre}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="pie-sidebar">
          {abierto && usuario && (
            <div className="quien">
              <strong>{usuario.usuario}</strong>
              <small>{usuario.rol === 'admin' ? 'Administrador' : 'Usuario'}</small>
            </div>
          )}
          <div className="fila-pie">
            <button
              className="btn-tema"
              onClick={() => setTema(t => t === 'claro' ? 'oscuro' : 'claro')}
              title={tema === 'claro' ? 'Activar modo oscuro' : 'Activar modo claro'}
            >
              {tema === 'claro' ? '🌙' : '☀️'}{abierto && (tema === 'claro' ? ' Modo oscuro' : ' Modo claro')}
            </button>
            <button className="btn-salir" onClick={salir} title="Cerrar sesión">🚪{abierto && ' Salir'}</button>
          </div>
        </div>
      </aside>
      <main className="contenido">
        <button className="btn-menu" onClick={() => setAbierto(!abierto)}>☰</button>
        {children}
      </main>
    </div>
  )
}
