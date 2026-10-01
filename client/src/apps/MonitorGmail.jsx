import React, { useEffect, useRef, useState } from 'react'
import { api } from '../api'

// ---------------------------------------------------------------------------
// Colores según la cantidad de errores (igual que el original)
// ---------------------------------------------------------------------------
function claseErrores (n) {
  if (n === 0) return 'ok'
  if (n <= 3) return 'aviso'
  return 'mal'
}

function colorFondo (n) {
  if (n === 0) return 'var(--verde-fondo)'
  if (n <= 3) return 'var(--amarillo-fondo)'
  return 'var(--rojo-fondo)'
}

// ---------------------------------------------------------------------------
// Pestaña: Credenciales de Gmail + Revisión
// ---------------------------------------------------------------------------
function Revision () {
  const [cred, setCred] = useState(null) // { guardadas, correo }
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [marcarTodos, setMarcarTodos] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  const [jobId, setJobId] = useState(null)
  const [progreso, setProgreso] = useState({ procesados: 0, total: 0 })
  const [estado, setEstado] = useState('') // en_curso | listo | error
  const [mensaje, setMensaje] = useState('')
  const [resultados, setResultados] = useState(null)
  const temporizador = useRef(null)

  async function cargarCred () {
    const c = await api.get('/api/monitor/credenciales')
    setCred(c)
  }
  useEffect(() => { cargarCred() }, [])

  // Encuesta de progreso
  useEffect(() => {
    if (!jobId) return
    temporizador.current = setInterval(async () => {
      try {
        const j = await api.get(`/api/monitor/jobs/${jobId}`)
        setProgreso({ procesados: j.procesados, total: j.total })
        setEstado(j.estado)
        setMensaje(j.mensaje)
        if (j.estado === 'listo') {
          clearInterval(temporizador.current)
          const r = await api.get(`/api/monitor/resultados/${jobId}`)
          setResultados(r)
        }
        if (j.estado === 'error') clearInterval(temporizador.current)
      } catch {
        clearInterval(temporizador.current)
      }
    }, 1000)
    return () => clearInterval(temporizador.current)
  }, [jobId])

  async function guardarCred (e) {
    e.preventDefault()
    setError(''); setAviso('')
    try {
      await api.post('/api/monitor/credenciales', { correo, contrasena })
      setContrasena('')
      setAviso('Credenciales guardadas.')
      await cargarCred()
    } catch (err) { setError(err.message) }
  }

  async function borrarCred () {
    if (!confirm('¿Borrar las credenciales de Gmail guardadas?')) return
    await api.del('/api/monitor/credenciales')
    await cargarCred()
    setAviso('Credenciales borradas.')
  }

  async function revisar () {
    setError(''); setAviso(''); setResultados(null); setEstado('en_curso')
    try {
      const { jobId: id } = await api.post('/api/monitor/revisar', { marcarLeidosConErrores: marcarTodos })
      setJobId(id)
    } catch (err) { setError(err.message); setEstado('') }
  }

  if (!cred) return <div className="cargando">Cargando…</div>

  const pct = progreso.total ? Math.round(progreso.procesados / progreso.total * 100) : 0

  return (
    <>
      <section className="tarjeta">
        <h2>Cuenta de Gmail</h2>
        {cred.guardadas
          ? (
            <div className="fila-cred">
              <span>📧 <strong>{cred.correo}</strong> <small>(guardada el {cred.actualizado})</small></span>
              <button className="secundario" onClick={borrarCred}>Borrar</button>
            </div>
            )
          : (
            <form onSubmit={guardarCred} className="form-cred">
              <label htmlFor="gmail-correo">
                Correo de Gmail
                <input id="gmail-correo" name="correo" value={correo} onChange={e => setCorreo(e.target.value)} placeholder="tucuenta@gmail.com" autoComplete="off" />
              </label>
              <label htmlFor="gmail-contrasena">
                Contraseña de aplicación (16 caracteres)
                <input id="gmail-contrasena" name="contrasena" type="password" value={contrasena} onChange={e => setContrasena(e.target.value)} autoComplete="new-password" />
              </label>
              <p className="nota">
                Gmail exige una <b>contraseña de aplicación</b>: activa la verificación en dos pasos y
                créala en <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">myaccount.google.com/apppasswords</a>.
                Además, IMAP debe estar activado en Gmail. Se guarda cifrada en la base de datos.
              </p>
              <button type="submit">Guardar credenciales</button>
            </form>
            )}
      </section>

      <section className="tarjeta">
        <div className="fila-revisar">
          <label className="casilla" htmlFor="rev-marcar-todos">
            <input id="rev-marcar-todos" name="marcarLeidosConErrores" type="checkbox" checked={marcarTodos} onChange={e => setMarcarTodos(e.target.checked)} />
            Marcar como leídos también los correos con errores
          </label>
          <button onClick={revisar} disabled={estado === 'en_curso'}>
            {estado === 'en_curso' ? 'Revisando…' : '▶ Revisar ahora'}
          </button>
        </div>

        {estado === 'en_curso' && (
          <div className="progreso">
            <div className="barra"><div className="relleno" style={{ width: `${pct}%` }} /></div>
            <small>Procesando {progreso.procesados} de {progreso.total || '…'} correos</small>
          </div>
        )}

        {estado === 'error' && <div className="error">Error: {mensaje}</div>}
        {aviso && <div className="aviso-msg">{aviso}</div>}
        {error && <div className="error">{error}</div>}

        {resultados && <Resultados datos={resultados} />}
      </section>
    </>
  )
}

// ---------------------------------------------------------------------------
// Tabla de resultados (Cobian + Acronis)
// ---------------------------------------------------------------------------
function Resultados ({ datos }) {
  const { resultados, acronis, estadisticas } = datos
  const bien = resultados.filter(r => r.errores === 0).length + (estadisticas?.acronisOk || 0)
  const mal = resultados.filter(r => r.errores > 0).length + (estadisticas?.acronisError || 0)

  return (
    <div className="resultados">
      <h3>Resultado de la revisión</h3>

      <div className="chips">
        <span className="chip">No leídos: <b>{estadisticas?.noLeidos}</b></span>
        <span className="chip">Informes Cobian: <b>{estadisticas?.encontrados}</b></span>
        <span className="chip">Marcados leídos: <b>{estadisticas?.leidos}</b></span>
        <span className="chip">Acronis OK: <b>{estadisticas?.acronisOk}</b></span>
        <span className="chip">Acronis error: <b>{estadisticas?.acronisError}</b></span>
      </div>

      <div className="grafico">
        <div className="barra-bien" style={{ flex: bien || 0.001 }}>
          ✅ Bien: {bien}
        </div>
        <div className="barra-mal" style={{ flex: mal || 0.001 }}>
          ❌ Mal: {mal}
        </div>
      </div>

      {resultados.length > 0 && (
        <table>
          <thead>
            <tr><th>Origen (asunto)</th><th>Fecha</th><th>Errores</th></tr>
          </thead>
          <tbody>
            {resultados.map((r, i) => (
              <tr key={i} style={{ background: colorFondo(r.errores) }}>
                <td>{r.asunto}</td>
                <td>{r.fecha}</td>
                <td className={`errores ${claseErrores(r.errores)}`}>{r.errores}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {acronis.length > 0 && (
        <>
          <h3>Notificaciones Acronis</h3>
          <table>
            <thead>
              <tr><th>Asunto</th><th>Fecha</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {acronis.map((r, i) => (
                <tr key={i} style={{ background: r.correcto ? 'var(--verde-fondo)' : 'var(--rojo-fondo)' }}>
                  <td>{r.asunto}</td>
                  <td>{r.fecha}</td>
                  <td>{r.correcto ? '✅ Correcto' : '❌ Error'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {resultados.length === 0 && acronis.length === 0 && (
        <p className="nota">No se ha encontrado ningún informe de respaldo en los correos no leídos.</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pestaña: Historial
// ---------------------------------------------------------------------------
function Historial () {
  const [datos, setDatos] = useState({ filas: [], total: 0 })
  const [resumen, setResumen] = useState(null)
  const [empresas, setEmpresas] = useState([])
  const [tipo, setTipo] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [q, setQ] = useState('')

  async function cargar () {
    const params = new URLSearchParams()
    if (tipo) params.set('tipo', tipo)
    if (empresa) params.set('empresa', empresa)
    if (q) params.set('q', q)
    params.set('limite', '500')
    const d = await api.get(`/api/historial?${params}`)
    setDatos(d)
  }

  useEffect(() => { cargar() }, [tipo, empresa, q])
  useEffect(() => {
    api.get('/api/historial/resumen').then(setResumen)
    api.get('/api/historial/empresas').then(setEmpresas)
  }, [])

  async function borrar () {
    if (!confirm('¿Borrar TODO el historial? Esta acción no se puede deshacer.')) return
    await api.del('/api/historial')
    await cargar()
    api.get('/api/historial/resumen').then(setResumen)
  }

  return (
    <>
      <section className="tarjeta">
        <div className="filtros">
          <input id="hist-buscador" name="buscador" placeholder="Buscar asunto o empresa…" value={q} onChange={e => setQ(e.target.value)} />
          <select id="hist-empresa" name="empresa" value={empresa} onChange={e => setEmpresa(e.target.value)} aria-label="Filtrar por empresa">
            <option value="">Todas las empresas</option>
            {empresas.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <select id="hist-tipo" name="tipo" value={tipo} onChange={e => setTipo(e.target.value)} aria-label="Filtrar por tipo">
            <option value="">Todos los tipos</option>
            <option value="cobian">Cobian</option>
            <option value="acronis">Acronis</option>
          </select>
          <a className="boton-enlace" href="/api/historial/export/csv">⬇ CSV</a>
          <a className="boton-enlace" href="/api/historial/export/xlsx">⬇ Excel</a>
          <button className="peligro" onClick={borrar}>🗑 Borrar historial</button>
        </div>
        <small>Total de registros: {datos.total} (mostrando {datos.filas.length})</small>
      </section>

      {resumen && (
        <section className="tarjeta">
          <h3>Resumen</h3>
          <div className="chips">
            <span className="chip">Total: <b>{resumen.total}</b></span>
            <span className="chip">Con errores: <b>{resumen.conErrores}</b></span>
          </div>
          {resumen.porDia?.length > 0 && (
            <div className="barras-dias">
              {resumen.porDia.slice().reverse().map(d => {
                const totalDia = d.ok + d.mal
                return (
                  <div key={d.dia} className="dia" title={`${d.dia}: ${d.ok} bien, ${d.mal} mal`}>
                    <div className="columna">
                      <div className="seg-mal" style={{ height: `${totalDia ? d.mal / totalDia * 100 : 0}%` }} />
                      <div className="seg-ok" style={{ height: `${totalDia ? d.ok / totalDia * 100 : 0}%` }} />
                    </div>
                    <small>{d.dia.slice(5)}</small>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      <section className="tarjeta">
        <table>
          <thead>
            <tr>
              <th>Procesado</th><th>Fecha correo</th><th>Empresa</th>
              <th>Asunto</th><th>Errores</th><th>Tipo</th>
            </tr>
          </thead>
          <tbody>
            {datos.filas.map(f => (
              <tr key={f.id} style={{ background: colorFondo(f.errores) }}>
                <td>{f.procesado}</td>
                <td>{f.fecha_correo}</td>
                <td>{f.empresa}</td>
                <td>{f.asunto}</td>
                <td className={`errores ${claseErrores(f.errores)}`}>{f.errores}{f.tipo === 'acronis' ? (f.correcto ? ' ✅' : ' ❌') : ''}</td>
                <td>{f.tipo === 'acronis' ? 'Acronis' : 'Cobian'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  )
}

// ---------------------------------------------------------------------------
export default function MonitorGmail () {
  const [pestana, setPestana] = useState('revision')
  return (
    <div>
      <h1>📧 Monitor de errores Gmail</h1>
      <div className="pestanas">
        <button className={pestana === 'revision' ? 'activa' : ''} onClick={() => setPestana('revision')}>
          Revisión
        </button>
        <button className={pestana === 'historial' ? 'activa' : ''} onClick={() => setPestana('historial')}>
          Historial
        </button>
      </div>
      {pestana === 'revision' ? <Revision /> : <Historial />}
    </div>
  )
}
