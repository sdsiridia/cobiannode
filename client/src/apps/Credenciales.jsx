import React, { useEffect, useRef, useState } from 'react'
import { api } from '../api'

const VACIA = { titulo: '', usuario: '', contrasena: '', url: '', notas: '' }

// ---------------------------------------------------------------------------
// Celda editable en línea: clic para editar, Intro/clic fuera guarda,
// Esc cancela.
// ---------------------------------------------------------------------------
function CeldaEditable ({ id, campo, valor, mostrar, onGuardado, placeholderVacio }) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState('')
  const inputRef = useRef(null)

  // Campo contraseña: si no se escribe nada, no se cambia (el servidor
  // mantiene la anterior cuando recibe '' en contrasena).
  const esPassword = campo === 'contrasena'
  const multilinea = campo === 'notas'

  function empezar () {
    // Si la contraseña está oculta, el campo empieza vacío para no filtrarla
    setTexto(esPassword && !mostrar ? '' : valor || '')
    setEditando(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  async function guardar () {
    setEditando(false)
    if (campo === 'titulo' && !texto.trim()) return // el título no puede quedar vacío
    if (texto === (valor || '')) return // sin cambios
    try {
      await api.put(`/api/credenciales/${id}`, { [campo]: texto })
      onGuardado()
    } catch (err) {
      alert('No se pudo guardar: ' + err.message)
    }
  }

  if (!editando) {
    const visible = esPassword ? (mostrar ? valor : '••••••••') : valor
    return (
      <span
        className={`celda-editable ${multilinea ? 'celda-notas' : ''}`}
        title={(valor || '(vacío)') + ' — clic para editar'}
        onClick={empezar}
      >
        {visible || <i className="celda-vacia">{placeholderVacio || '—'}</i>}
      </span>
    )
  }

  // Las notas se editan en un cuadro multilínea; el resto, en una línea.
  if (campo === 'notas') {
    return (
      <textarea
        ref={inputRef}
        className="celda-textarea"
        rows={4}
        value={texto}
        onChange={e => setTexto(e.target.value)}
        onBlur={guardar}
        onKeyDown={e => {
          if (e.key === 'Escape') setEditando(false)
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) e.target.blur() // Ctrl+Intro guarda
        }}
      />
    )
  }

  return (
    <input
      ref={inputRef}
      className="celda-input"
      value={texto}
      placeholder={esPassword && !mostrar ? '(dejar igual si no escribes nada)' : ''}
      onChange={e => setTexto(e.target.value)}
      onBlur={guardar}
      onKeyDown={e => {
        if (e.key === 'Enter') e.target.blur()
        if (e.key === 'Escape') setEditando(false)
      }}
    />
  )
}

// ---------------------------------------------------------------------------
export default function Credenciales () {
  const [filas, setFilas] = useState([])
  const [q, setQ] = useState('')
  const [mostrarPass, setMostrarPass] = useState(false)
  const [editando, setEditando] = useState(null) // null | {id?, ...campos}
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const fichero = useRef(null)

  async function cargar () {
    const f = await api.get(`/api/credenciales?q=${encodeURIComponent(q)}`)
    setFilas(f)
  }
  useEffect(() => { cargar() }, [q])

  const recargar = () => { cargar().catch(() => {}) }

  async function guardar (e) {
    e.preventDefault()
    setError('')
    try {
      if (editando.id) {
        await api.put(`/api/credenciales/${editando.id}`, editando)
      } else {
        await api.post('/api/credenciales', editando)
      }
      setEditando(null)
      await cargar()
    } catch (err) { setError(err.message) }
  }

  async function borrar (id) {
    if (!confirm('¿Borrar esta credencial?')) return
    await api.del(`/api/credenciales/${id}`)
    await cargar()
  }

  async function importar (e) {
    const archivo = e.target.files[0]
    if (!archivo) return
    setError(''); setAviso('')
    try {
      const texto = await archivo.text()
      const r = await api.texto('/api/credenciales/importar', texto)
      setAviso(`Importadas ${r.importadas} credenciales (total: ${r.total}).`)
      await cargar()
    } catch (err) {
      setError(err.message)
    } finally {
      e.target.value = ''
    }
  }

  function copiar (texto) {
    navigator.clipboard.writeText(texto)
    setAviso('Copiado al portapapeles.')
    setTimeout(() => setAviso(''), 1500)
  }

  return (
    <div>
      <h1>🔑 Credenciales</h1>

      <section className="tarjeta">
        <div className="filtros">
          <input
            placeholder="Buscar por título, usuario, URL o notas…"
            value={q}
            onChange={e => setQ(e.target.value)}
            className="crece"
          />
          <label className="casilla">
            <input type="checkbox" checked={mostrarPass} onChange={e => setMostrarPass(e.target.checked)} />
            Mostrar contraseñas
          </label>
          <button onClick={() => setEditando({ ...VACIA })}>➕ Nueva</button>
          <input
            type="file" accept=".csv,text/csv" ref={fichero}
            style={{ display: 'none' }} onChange={importar}
          />
          <button className="secundario" onClick={() => fichero.current?.click()}>📥 Importar CSV</button>
          <a className="boton-enlace" href="/api/credenciales/export/csv">⬇ Exportar CSV</a>
        </div>
        {aviso && <div className="aviso-msg">{aviso}</div>}
        {error && <div className="error">{error}</div>}
        <small>{filas.length} credenciales — <span className="pista">haz clic en cualquier celda para editarla</span></small>
      </section>

      <section className="tarjeta">
        <table>
          <thead>
            <tr><th>Título</th><th>Usuario</th><th>Contraseña</th><th>URL</th><th>Notas</th><th /></tr>
          </thead>
          <tbody>
            {filas.map(f => (
              <tr key={f.id}>
                <td>
                  <CeldaEditable id={f.id} campo="titulo" valor={f.titulo} mostrar onGuardado={recargar} />
                </td>
                <td>
                  <CeldaEditable id={f.id} campo="usuario" valor={f.usuario} mostrar onGuardado={recargar} placeholderVacio="(sin usuario)" />
                  {f.usuario && <button className="mini" onClick={() => copiar(f.usuario)} title="Copiar usuario">📋</button>}
                </td>
                <td>
                  <CeldaEditable id={f.id} campo="contrasena" valor={f.contrasena} mostrar={mostrarPass} onGuardado={recargar} placeholderVacio="(vacía)" />
                  {f.contrasena && <button className="mini" onClick={() => copiar(f.contrasena)} title="Copiar contraseña">📋</button>}
                </td>
                <td>
                  <CeldaEditable id={f.id} campo="url" valor={f.url} mostrar onGuardado={recargar} placeholderVacio="(sin URL)" />
                </td>
                <td className="notas">
                  <CeldaEditable id={f.id} campo="notas" valor={f.notas} mostrar onGuardado={recargar} placeholderVacio="(sin notas)" />
                </td>
                <td>
                  <button className="mini" onClick={() => setEditando({ ...f })} title="Editar en ventana">✏️</button>
                  <button className="mini" onClick={() => borrar(f.id)} title="Borrar">🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {editando && (
        <div className="modal-fondo" onClick={() => setEditando(null)}>
          <form className="modal" onClick={e => e.stopPropagation()} onSubmit={guardar}>
            <h2>{editando.id ? 'Editar credencial' : 'Nueva credencial'}</h2>
            <label>Título
              <input value={editando.titulo} onChange={e => setEditando({ ...editando, titulo: e.target.value })} autoFocus />
            </label>
            <label>Usuario
              <input value={editando.usuario} onChange={e => setEditando({ ...editando, usuario: e.target.value })} />
            </label>
            <label>Contraseña
              <input value={editando.contrasena} onChange={e => setEditando({ ...editando, contrasena: e.target.value })} />
            </label>
            <label>URL
              <input value={editando.url} onChange={e => setEditando({ ...editando, url: e.target.value })} />
            </label>
            <label>Notas
              <textarea rows={4} value={editando.notas} onChange={e => setEditando({ ...editando, notas: e.target.value })} />
            </label>
            <div className="modal-botones">
              <button type="button" className="secundario" onClick={() => setEditando(null)}>Cancelar</button>
              <button type="submit">Guardar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
