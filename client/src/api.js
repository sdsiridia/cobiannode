// Pequeño cliente HTTP para la API
async function pedir (url, opciones = {}) {
  const res = await fetch(url, {
    credentials: 'include',
    headers: opciones.body instanceof FormData
      ? undefined
      : { 'Content-Type': 'application/json' },
    ...opciones,
    body: opciones.body instanceof FormData
      ? opciones.body
      : (opciones.body ? JSON.stringify(opciones.body) : undefined)
  })
  if (res.status === 401 && !window.location.pathname.startsWith('/login')) {
    // Sesión caducada: volvemos al login (pero no en la propia pantalla de
    // login, donde causaría un bucle de recargas)
    window.location.href = '/login'
    throw new Error('Sesión caducada')
  }
  const tipo = res.headers.get('content-type') || ''
  const datos = tipo.includes('json') ? await res.json() : await res.text()
  if (!res.ok) throw new Error(datos?.error || `Error ${res.status}`)
  return datos
}

export const api = {
  get: url => pedir(url),
  post: (url, body) => pedir(url, { method: 'POST', body }),
  put: (url, body) => pedir(url, { method: 'PUT', body }),
  del: url => pedir(url, { method: 'DELETE' }),
  texto: (url, texto) => pedir(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: texto
  })
}
