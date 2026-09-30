# Dashboard Ingesist

Dashboard web con login que agrupa varias aplicaciones:

1. **📧 Monitor de errores Gmail** — réplica en Node.js del proyecto
   *monitor-errores-gmail* (Flask/Python). Revisa los correos no leídos de
   una cuenta de Gmail por IMAP y detecta los informes de respaldo
   (Cobian y Acronis True Image), mostrando una tabla de resultados,
   estadísticas, historial y exportación a CSV/Excel.
2. **🔑 Credenciales** — base de datos de accesos (título, usuario,
   contraseña, URL, notas) con importación de CSV de KeePass.
3. **👥 Usuarios** — gestión de usuarios del dashboard (solo administrador).

## Tecnologías

- **Backend**: Node.js + Express, SQLite (better-sqlite3), ImapFlow + Mailparser,
  ExcelJS, JWT en cookie httpOnly, bcrypt y AES-256-GCM.
- **Frontend**: React 18 + Vite + React Router.

## Instalación

```bash
npm install                # dependencias del servidor
cd client && npm install   # dependencias del cliente
```

## Configuración (`.env`)

El archivo `.env` ya viene creado con valores de ejemplo:

| Variable | Descripción |
|---|---|
| `PORT` | Puerto del servidor (3000) |
| `JWT_SECRET` | Secreto para firmar las sesiones — **cámbialo** |
| `ENC_KEY` | Clave de cifrado de contraseñas — **cámbiala** |
| `ADMIN_USER` / `ADMIN_PASS` | Administrador inicial (solo si no hay usuarios) |

## Ejecución

```bash
# Opción 1: todo compilado (recomendada)
cd client && npm run build && cd ..
npm start                  # http://localhost:3000

# Opción 2: desarrollo (frontend con recarga en http://localhost:5173)
npm run dev:server         # terminal 1
npm run dev:client         # terminal 2
```

**Login inicial**: `admin` / `admin123` → cámbiala en la pestaña *Usuarios*.

## Primer arranque

- Si existe el `historial.json` del proyecto original (en su carpeta o en
  `data/historial.json`), se **migra automáticamente** a la base de datos
  la primera vez.
- La base de datos se crea en `data/dashboard.db`.

## La app "Monitor de errores Gmail"

1. Pestaña **Revisión**:
   - Guarda una vez las credenciales de Gmail (correo + **contraseña de
     aplicación** de 16 caracteres; Gmail no acepta la contraseña normal).
     Se guardan **cifradas** en la base de datos.
   - Pulsa *Revisar ahora*: se conecta por IMAP, procesa los correos no
     leídos con barra de progreso y muestra la tabla de resultados.
2. Reglas (idénticas al original):
   - Correo sin informe de errores → queda **no leído**.
   - Cobian con **0 errores** → marcado **leído**; con errores → sigue no
     leído (salvo que actives la casilla "marcar todos").
   - **Acronis** "La operación se ha efectuado/completado/realizado
     correctamente" → OK, marcado leído; cualquier otra cosa → error.
3. Pestaña **Historial**: filtros por empresa/tipo/búsqueda, resumen con
   gráfico por día, exportación **CSV** y **Excel**, y borrado completo.

## La app "Credenciales"

- Campos: **Título, Usuario, Contraseña, URL, Notas**.
- Las contraseñas se guardan **cifradas con AES-256-GCM**.
- **Importar CSV**: botón *📥 Importar CSV* acepta el export de KeePass con
  cabeceras `Account, Login Name, Password, Web Site, Comments`
  (incluye archivos con escapes no estándar de KeePass).
- Botones 📋 para copiar usuario/contraseña al portapapeles.

## Migración futura a MariaDB (VPS)

El esquema usa SQL estándar (INTEGER AUTOINCREMENT, TEXT, …). Para migrar:
exportar las tablas de SQLite y ajustar `db.js` al driver `mariadb`.
Las contraseñas cifradas no necesitan cambios (solo conservar `ENC_KEY`).

## Estructura

```
dashboard/
├── server/
│   ├── index.js            # Servidor Express + API + sirve client/dist
│   ├── auth.js             # Login del dashboard (JWT + bcrypt)
│   ├── db.js               # SQLite: esquema, admin inicial, migración historial
│   ├── crypto.js           # Cifrado AES de contraseñas
│   ├── monitor/
│   │   ├── parser.js       # Detección Cobian / Acronis (puerto de app.py)
│   │   ├── imap.js         # Conexión IMAP y procesado de correos
│   │   └── jobs.js         # Revisión en segundo plano + progreso
│   └── routes/
│       ├── monitor.js      # Credenciales Gmail + revisión + resultados
│       ├── historial.js    # Historial + export CSV/Excel
│       ├── credenciales.js # CRUD + importación/exportación CSV
│       └── usuarios.js     # Gestión de usuarios (admin)
├── client/                 # React (Vite)
│   └── src/
│       ├── apps/           # MonitorGmail, Credenciales, Usuarios
│       └── components/     # Login, Layout (menú lateral)
└── data/                   # dashboard.db (+ historial.json opcional)
```
