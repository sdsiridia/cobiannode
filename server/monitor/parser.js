// Parser de correos — puerto fiel de app.py (monitor-errores-gmail).
// Detecta informes Cobian ("Número de errores: N", "Errores: N",
// "sin errores") y notificaciones de Acronis True Image.
const { htmlToText } = require('html-to-text')

// ---------------------------------------------------------------------------
// Normalización de texto
// ---------------------------------------------------------------------------
function sinTildes (texto) {
  return (texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function textoNormalizado (texto) {
  return sinTildes(texto).replace(/\s+/g, ' ').trim()
}

// ---------------------------------------------------------------------------
// Patrones (idénticos a los del original en Python)
// ---------------------------------------------------------------------------
const PATRON_NUMERO_ERRORES = /n[uú]mero\s+de\s+errores\s*:?\s*\.?\s*(\d+)/i
const PATRON_ERRORES = /errores\s*:?\s*\.?\s*(\d+)/i
const PATRON_SIN_ERRORES = /sin\s+errores/i

// Frase de éxito de Acronis, tolerante a variantes:
//   "La operación se ha efectuado/completado/realizado correctamente"
//   "... con éxito"
const PATRON_OK_ACRONIS = /la\s+operaci[oó]n\s+se\s+ha\s+(?:efectuado|completado|realizado|ejecutado)\s+(?:correctamente|con\s+[eé]xito\b|sin\s+errores\b)/i

// ---------------------------------------------------------------------------
// HTML -> texto plano
// ---------------------------------------------------------------------------
function htmlATexto (contenidoHtml) {
  try {
    return htmlToText(contenidoHtml, { wordwrap: false })
  } catch {
    return contenidoHtml
  }
}

/**
 * Busca la cantidad de errores en el cuerpo.
 * Devuelve { encontrado, cantidad }:
 *   - encontrado: true si el cuerpo habla de errores.
 *   - cantidad: número de errores (0 si no hay).
 */
function extraerErrores (cuerpo) {
  let m = PATRON_NUMERO_ERRORES.exec(cuerpo)
  if (m) return { encontrado: true, cantidad: parseInt(m[1], 10) }
  m = PATRON_ERRORES.exec(cuerpo)
  if (m) return { encontrado: true, cantidad: parseInt(m[1], 10) }
  if (PATRON_SIN_ERRORES.test(cuerpo)) return { encontrado: true, cantidad: 0 }
  return { encontrado: false, cantidad: null }
}

/** Detecta si el mensaje es una notificación de Acronis True Image. */
function esAcronis (asunto, cuerpo) {
  const cuerpoNorm = textoNormalizado(cuerpo)
  return (
    sinTildes(asunto).includes('acronis') ||
    sinTildes(asunto).includes('true image') ||
    cuerpoNorm.includes('acronis')
  )
}

/** ¿La notificación Acronis indica éxito? */
function acronisOk (cuerpo) {
  return PATRON_OK_ACRONIS.test(textoNormalizado(cuerpo))
}

// ---------------------------------------------------------------------------
// Empresa a partir del asunto
// ---------------------------------------------------------------------------
// Los asuntos suelen terminar con la fecha, ej:
//   "CRUZILA TRABAJOS Mon, 28 Sep 2026 17:31:17 +0200"
const PATRON_FECHA_EN_ASUNTO = /\s*\b(?:lun|mar|mi[eé]|jue|vie|s[aá]b|dom|mon|tue|wed|thu|fri|sat|sun)\b\s*,?\s*\d{1,2}\b.*$/i

function derivarEmpresa (asunto) {
  let texto = (asunto || '').trim()
  texto = texto.replace(PATRON_FECHA_EN_ASUNTO, '').replace(/^[\s\-–:|,]+|[\s\-–:|,]+$/g, '')
  for (const separador of [' - ', '–', '|']) {
    if (texto.includes(separador)) {
      const parte = texto.split(separador)[0].trim()
      if (parte) return parte
    }
  }
  return texto || '(sin asunto)'
}

module.exports = {
  sinTildes,
  textoNormalizado,
  htmlATexto,
  extraerErrores,
  esAcronis,
  acronisOk,
  derivarEmpresa
}
