# 🔐 Módulo de Autenticación — Sistema de Oficios

## Estructura del proyecto

```
auth-module/
├── config/
│   └── auth.js              # Configuración JWT, bcrypt, rate limit
├── controllers/
│   └── auth.controller.js   # Manejo de peticiones HTTP
├── db/
│   ├── pool.js              # Pool de conexiones PostgreSQL
│   └── migrate.js           # Script de migraciones
├── middlewares/
│   └── auth.middleware.js   # autenticar, requireRol, requireAreaOficio
├── routes/
│   └── auth.routes.js       # Definición de rutas + validaciones
├── services/
│   └── auth.service.js      # Lógica de negocio
├── utils/
│   ├── jwt.js               # Generación/verificación de tokens
│   └── response.js          # Respuestas estandarizadas
├── .env.example             # Variables de entorno requeridas
├── package.json
└── server.js                # Punto de entrada
```

---

## Instalación

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Edita .env con tus datos de PostgreSQL y secretos JWT

# 3. Crear tablas en la BD
node db/migrate.js

# 4. Arrancar servidor
npm run dev      # desarrollo (con nodemon)
npm start        # producción
```

---

## Variables de entorno requeridas

| Variable | Descripción | Ejemplo |
|---|---|---|
| `DB_HOST` | Host de PostgreSQL | `localhost` |
| `DB_PORT` | Puerto de PostgreSQL | `5432` |
| `DB_NAME` | Nombre de la base de datos | `sistema_oficios` |
| `DB_USER` | Usuario de PostgreSQL | `postgres` |
| `DB_PASSWORD` | Contraseña de PostgreSQL | `mipassword` |
| `JWT_SECRET` | Secreto para firmar access tokens (mín. 32 chars) | `cadena_muy_larga...` |
| `JWT_REFRESH_SECRET` | Secreto para refresh tokens | `otra_cadena_larga...` |

---

## Endpoints

### `POST /api/auth/login`

```json
// Request
{
  "username": "admin",
  "password": "Admin1234!"
}

// Response 200
{
  "success": true,
  "message": "Inicio de sesión exitoso",
  "data": {
    "accessToken": "eyJhbGc...",
    "usuario": {
      "id": 1,
      "username": "admin",
      "nombre_completo": "Administrador del Sistema",
      "rol": "admin",
      "area_id": null,
      "area_nombre": null
    }
  }
}
```

### `POST /api/auth/refresh`

Renueva el access token usando el refresh token (cookie automática o body).

```json
// Response 200
{
  "success": true,
  "data": { "accessToken": "eyJhbGc..." }
}
```

### `POST /api/auth/logout`

```json
// Request (opcional, para cerrar TODAS las sesiones)
{ "todos": true }

// Response 200
{
  "success": true,
  "message": "Sesión cerrada exitosamente"
}
```

### `GET /api/auth/me`

```
Authorization: Bearer {accessToken}
```

```json
// Response 200
{
  "success": true,
  "data": {
    "id": 1,
    "username": "admin",
    "nombre_completo": "Administrador del Sistema",
    "email": "admin@sistema.gob.mx",
    "rol": "admin",
    "area_id": null,
    "ultimo_acceso": "2024-02-17T15:30:00Z"
  }
}
```

### `PUT /api/auth/password`

```json
// Request
{
  "passwordActual": "Admin1234!",
  "passwordNuevo": "NuevoPass99!",
  "confirmPassword": "NuevoPass99!"
}
```

---

## Uso de middlewares en otros módulos

```javascript
const {
  autenticar,
  soloAdmin,
  requireRol,
  requireAreaOficio,
} = require('./middlewares/auth.middleware');

// Solo usuarios autenticados
router.get('/oficios', autenticar, controller.listar);

// Solo admin
router.post('/areas', autenticar, soloAdmin, controller.crear);

// Admin o usuario de área
router.put('/oficios/:id', autenticar, requireAreaOficio, controller.editar);

// Acceder a req.user en el controlador:
// req.user.userId   → ID del usuario
// req.user.rol      → 'admin' | 'usuario'
// req.user.areaId   → ID del área (null si es admin)
// req.user.username → username
```

---

## Seguridad implementada

- **Contraseñas:** bcrypt con 12 rounds
- **JWT:** Access token (8h) + Refresh token (7d)
- **Refresh tokens:** Hasheados en BD, rotación en cada renovación
- **Bloqueo:** 3 intentos fallidos → bloqueo de 15 minutos
- **Rate limiting:** 5 intentos de login por ventana de 15 min
- **Cookies:** httpOnly + SameSite=strict en producción
- **Logs:** Todos los eventos de autenticación se registran

---

## Usuario por defecto

| Campo | Valor |
|---|---|
| username | `admin` |
| password | `Admin1234!` |
| rol | `admin` |

> ⚠️ Cambia la contraseña inmediatamente después de instalar.
