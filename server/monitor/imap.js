// Conexión IMAP con Gmail y procesamiento de correos no leídos.
// Puerto fiel de `procesar_correo()` en app.py:
//   - Lee los correos NO LEÍDOS de la bandeja de entrada.
//   - Cobian:   0 errores -> marca como leído; >0 -> queda no leído
//               (a menos que marcarLeidosConErrores sea true).
//   - Acronis:  OK -> marca como leído; error -> queda no leído.
//   - Sin informe de errores -> queda como no leído.
const { ImapFlow } = require('imapflow')
const { simpleParser } = require('mailparser')
const {
  extraerErrores, esAcronis, acronisOk
} = require('./parser')

const IMAP_HOST = 'imap.gmail.com'

function formatearFecha (fecha) {
  if (!fecha) return ''
  const d = new Date(fecha)
  if (isNaN(d.getTime())) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`
}

/**
 * Se conecta a Gmail y procesa los correos no leídos.
 *
 * @param {string} usuario      Correo de Gmail
 * @param {string} contrasena   Contraseña de aplicación
 * @param {object} opciones
 *   - marcarLeidosConErrores {boolean}
 *   - progreso {function(procesados, total)}
 * @returns {Promise<{resultados, acronis, estadisticas}>}
 */
async function procesarCorreo (usuario, contrasena, opciones = {}) {
  const marcarLeidosConErrores = !!opciones.marcarLeidosConErrores
  const progreso = opciones.progreso || (() => {})

  const client = new ImapFlow({
    host: IMAP_HOST,
    port: 993,
    secure: true,
    auth: { user: usuario, pass: contrasena },
    logger: false,
    // Tiempos límite para que un fallo de conexión se detecte rápido
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 120000
  })

  const resultados = []  // informes Cobian: { asunto, fecha, errores }
  const acronis = []     // notificaciones Acronis: { asunto, fecha, correcto }
  let leidos = 0
  let encontrados = 0
  let acronisOk_ = 0
  let acronisError = 0

  try {
    await client.connect()
    await client.mailboxOpen('INBOX')

    // Correos NO leídos (equivalente a SEARCH UNSEEN), por UID
    const lista = await client.search({ seen: false }, { uid: true })
    const uids = lista || []
    const total = uids.length
    progreso(0, total)

    for (let i = 0; i < uids.length; i++) {
      const uid = uids[i]
      // ImapFlow no marca \Seen al pedir el cuerpo (equivale a BODY.PEEK[])
      const mensaje = await client.fetchOne(uid, { envelope: true, source: true }, { uid: true })
      if (!mensaje) { progreso(i + 1, total); continue }

      const asunto = mensaje.envelope?.subject?.trim() || '(sin asunto)'
      const fecha = formatearFecha(mensaje.envelope?.date)

      let cuerpo = ''
      try {
        const parsed = await simpleParser(mensaje.source)
        cuerpo = parsed.text || ''
        if (!cuerpo && parsed.html) {
          const { htmlATexto } = require('./parser')
          cuerpo = htmlATexto(parsed.html)
        }
      } catch {
        cuerpo = ''
      }

      // ===== Notificaciones de Acronis True Image =====
      if (esAcronis(asunto, cuerpo)) {
        const correcto = acronisOk(cuerpo)
        acronis.push({ asunto, fecha, correcto })
        if (correcto) {
          acronisOk_++
          await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true })
          leidos++
        } else {
          acronisError++
          await client.messageFlagsRemove(uid, ['\\Seen'], { uid: true })
        }
        progreso(i + 1, total)
        continue
      }

      // ===== Informes Cobian =====
      const { encontrado, cantidad } = extraerErrores(cuerpo)
      if (!encontrado) {
        // No habla de errores -> queda como no leído.
        await client.messageFlagsRemove(uid, ['\\Seen'], { uid: true })
        progreso(i + 1, total)
        continue
      }

      encontrados++
      resultados.push({ asunto, fecha, errores: cantidad })

      if (cantidad === 0 || marcarLeidosConErrores) {
        await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true })
        leidos++
      } else {
        // Con errores -> se deja como no leído (por seguridad).
        await client.messageFlagsRemove(uid, ['\\Seen'], { uid: true })
      }

      progreso(i + 1, total)
    }

    return {
      resultados,
      acronis,
      estadisticas: {
        noLeidos: total,
        encontrados,
        leidos,
        acronisOk: acronisOk_,
        acronisError
      }
    }
  } finally {
    try { await client.logout() } catch { /* ya cerrada */ }
    try { client.close() } catch { /* ya cerrada */ }
  }
}

module.exports = { procesarCorreo }
