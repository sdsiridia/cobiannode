// Cifrado AES-256-GCM para las contraseñas que se guardan en la base de datos.
const crypto = require('crypto')

function clave () {
  // Derivamos una clave de 32 bytes a partir de ENC_KEY.
  return crypto.createHash('sha256')
    .update(process.env.ENC_KEY || 'clave-por-defecto')
    .digest()
}

function cifrar (texto) {
  if (texto === undefined || texto === null || texto === '') return ''
  const iv = crypto.randomBytes(12)
  const cifrador = crypto.createCipheriv('aes-256-gcm', clave(), iv)
  const datos = Buffer.concat([cifrador.update(String(texto), 'utf-8'), cifrador.final()])
  const etiqueta = cifrador.getAuthTag()
  return 'enc:' + iv.toString('base64') + ':' + etiqueta.toString('base64') + ':' + datos.toString('base64')
}

function descifrar (texto) {
  if (!texto || !texto.startsWith('enc:')) return texto || ''
  try {
    const [, ivB64, tagB64, datosB64] = texto.split(':')
    const descifrador = crypto.createDecipheriv('aes-256-gcm', clave(), Buffer.from(ivB64, 'base64'))
    descifrador.setAuthTag(Buffer.from(tagB64, 'base64'))
    return Buffer.concat([
      descifrador.update(Buffer.from(datosB64, 'base64')),
      descifrador.final()
    ]).toString('utf-8')
  } catch {
    return '' // clave cambiada o dato corrupto
  }
}

module.exports = { cifrar, descifrar }
