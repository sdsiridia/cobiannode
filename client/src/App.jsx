import React, { createContext, useContext, useEffect, useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { api } from './api'
import Login from './components/Login.jsx'
import Layout from './components/Layout.jsx'
import MonitorGmail from './apps/MonitorGmail.jsx'
import Credenciales from './apps/Credenciales.jsx'
import Usuarios from './apps/Usuarios.jsx'

const SesionCtx = createContext(null)
export const useSesion = () => useContext(SesionCtx)

function RutaPrivada ({ children }) {
  const { usuario } = useSesion()
  if (usuario === undefined) return <div className="cargando">Cargando…</div>
  if (!usuario) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

export default function App () {
  const [usuario, setUsuario] = useState(undefined) // undefined = comprobando
  const ubicacion = useLocation()

  useEffect(() => {
    api.get('/api/auth/yo')
      .then(yo => setUsuario(yo))
      .catch(() => setUsuario(null))
  }, [ubicacion.pathname])

  return (
    <SesionCtx.Provider value={{ usuario, setUsuario }}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RutaPrivada><MonitorGmail /></RutaPrivada>} />
        <Route path="/credenciales" element={<RutaPrivada><Credenciales /></RutaPrivada>} />
        <Route path="/usuarios" element={<RutaPrivada><Usuarios /></RutaPrivada>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SesionCtx.Provider>
  )
}
