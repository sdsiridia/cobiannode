// Revisión en segundo plano con barra de progreso.
// Equivalente a los JOBS del original: cada revisión se lanza en un
// "trabajo" con estado que el frontend consulta por polling.
const { procesarCorreo } = require('./imap')
const db = require('../db')

const JOBS = new Map()

function lanzarRevision (usuario, contrasena, marcarLeidosConErrores) {
  const id = Math.random().toString(36).slice(2, 14)
  JOBS.set(id, {
    procesados: 0,
    total: 0,
    estado: 'en_curso', // en_curso | listo | error
    mensaje: '',
    resultados: null,
    acronis: null,
    estadisticas: null
  })

  // Ejecutar sin bloquear la respuesta HTTP
  setImmediate(() => trabajador(id, usuario, contrasena, marcarLeidosConErrores))
  return id
}

async function trabajador (id, usuario, contrasena, marcarLeidosConErrores) {
  const job = JOBS.get(id)
  const avisar = (procesados, total) => {
    job.procesados = procesados
    job.total = total
  }
  try {
    const { resultados, acronis, estadisticas } =
      await procesarCorreo(usuario, contrasena, {
        marcarLeidosConErrores,
        progreso: avisar
      })

    // Guardar en el historial (equivale a guardar_historial en app.py)
    const ahora = new Date()
    const momento = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')} ${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`
    const { derivarEmpresa } = require('./parser')
    const insertar = db.prepare(`INSERT INTO historial
      (procesado, fecha_correo, asunto, empresa, errores, tipo, correcto)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
    const tx = db.transaction(() => {
      for (const r of resultados) {
        insertar.run(momento, r.fecha, r.asunto, derivarEmpresa(r.asunto), r.errores, 'cobian', null)
      }
      for (const r of acronis) {
        insertar.run(momento, r.fecha, r.asunto, derivarEmpresa(r.asunto), r.correcto ? 0 : 1, 'acronis', r.correcto ? 1 : 0)
      }
    })
    tx()

    job.resultados = resultados
    job.acronis = acronis
    job.estadisticas = estadisticas
    job.estado = 'listo'
  } catch (err) {
    job.estado = 'error'
    job.mensaje = err.message || String(err)
  } finally {
    // Limpiamos el resultado de trabajos antiguos para no acumular memoria
    const hace15min = Date.now() - 15 * 60 * 1000
    for (const [idViejo, j] of JOBS) {
      if (j.fin && j.fin < hace15min) JOBS.delete(idViejo)
    }
    job.fin = Date.now()
  }
}

module.exports = { lanzarRevision, JOBS }
