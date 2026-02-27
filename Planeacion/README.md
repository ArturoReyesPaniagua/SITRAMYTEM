# 📋 Sistema de Gestión de Oficios — Backend API

**Versión:** 2.0.0 | **Motor de BD:** PostgreSQL | **Runtime:** Node.js + Express

---

## Estructura del proyecto

```
sistema-oficios-backend/
├── config/
│   └── auth.js                    # Configuración JWT, bcrypt, rate limit
├── controllers/
│   ├── auth.controller.js
│   ├── areas.controller.js
│   ├── usuarios.controller.js
│   ├── proyectos.controller.js
│   ├── oficios.controller.js      ← corregido
│   ├── archivos.controller.js     ← NUEVO
│   └── semaforos.controller.js    ← NUEVO
├── db/
│   ├── pool.js                    # Pool de conexiones PostgreSQL
│   └── migrate.js                 ← actualizado (todas las tablas)
├── middlewares/
│   └── auth.middleware.js
├── routes/
│   ├── auth.routes.js
│   ├── areas.routes.js
│   ├── usuarios.routes.js
│   ├── proyectos.routes.js
│   ├── oficios.routes.js          ← corregido
│   ├── archivos.routes.js         ← NUEVO (multer)
│   └── semaforos.routes.js        ← NUEVO
├── services/
│   ├── auth.service.js
│   ├── areas.service.js
│   ├── usuarios.service.js
│   ├── proyectos.service.js
│   ├── oficios.service.js         ← corregido (lógica por tipo de proceso)
│   ├── archivos.service.js        ← NUEVO (versionado + auto-finalización)
│   └── semaforos.service.js       ← NUEVO (cron en Node.js)
├── utils/
│   ├── jwt.js
│   └── response.js
├── uploads/                       # Archivos subidos (creado automáticamente)
├── .env.example
├── package.json                   ← multer agregado
└── server.js                      ← cron de semáforos integrado
```

---

## Instalación

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus datos

# 3. Crear tablas
node db/migrate.js

# 4. Arrancar
npm run dev      # desarrollo
npm start        # producción
```

## Variables de entorno

| Variable | Descripción | Ejemplo |
|---|---|---|
| `DB_HOST` | Host PostgreSQL | `localhost` |
| `DB_PORT` | Puerto PostgreSQL | `5432` |
| `DB_NAME` | Nombre BD | `sistema_oficios` |
| `DB_USER` | Usuario BD | `postgres` |
| `DB_PASSWORD` | Contraseña BD | `mipassword` |
| `JWT_SECRET` | Secreto access token (≥32 chars) | `...` |
| `JWT_REFRESH_SECRET` | Secreto refresh token | `...` |
| `UPLOADS_DIR` | Carpeta de archivos | `./uploads` |
| `FRONTEND_URL` | URL del frontend para CORS | `http://localhost:5173` |
| `PORT` | Puerto del servidor | `3000` |

---

## Endpoints API

### Autenticación

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Login con username/password |
| POST | `/api/auth/refresh` | Renovar access token |
| POST | `/api/auth/logout` | Cerrar sesión |
| GET  | `/api/auth/me` | Datos del usuario autenticado |
| PUT  | `/api/auth/password` | Cambiar contraseña propia |

### Áreas

| Método | Ruta | Descripción | Permisos |
|--------|------|-------------|----------|
| GET  | `/api/areas` | Listar áreas | Auth |
| GET  | `/api/areas/:id` | Detalle de área | Auth |
| GET  | `/api/areas/:id/usuarios` | Usuarios del área | Admin |
| POST | `/api/areas` | Crear área | Admin |
| PUT  | `/api/areas/:id` | Editar área | Admin |
| PATCH | `/api/areas/:id/desactivar` | Desactivar | Admin |
| PATCH | `/api/areas/:id/activar` | Activar | Admin |

### Usuarios

| Método | Ruta | Descripción | Permisos |
|--------|------|-------------|----------|
| GET  | `/api/usuarios` | Listar usuarios | Auth |
| GET  | `/api/usuarios/:id` | Detalle | Auth |
| POST | `/api/usuarios` | Crear usuario | Admin |
| PUT  | `/api/usuarios/:id` | Editar datos | Auth |
| PATCH | `/api/usuarios/:id/rol` | Cambiar rol | Admin |
| PATCH | `/api/usuarios/:id/password` | Reset password | Admin |
| PATCH | `/api/usuarios/:id/desactivar` | Desactivar | Admin |
| PATCH | `/api/usuarios/:id/activar` | Activar | Admin |
| PATCH | `/api/usuarios/:id/desbloquear` | Desbloquear | Admin |

### Proyectos

| Método | Ruta | Descripción | Permisos |
|--------|------|-------------|----------|
| GET  | `/api/proyectos` | Listar (filtrado por área) | Auth |
| GET  | `/api/proyectos/:id` | Detalle | Auth |
| GET  | `/api/proyectos/:id/oficios` | Oficios del proyecto | Auth |
| POST | `/api/proyectos` | Crear proyecto | Auth |
| PUT  | `/api/proyectos/:id` | Editar | Auth (área propia o Admin) |
| PATCH | `/api/proyectos/:id/estado` | Cambiar estado | Auth (área propia o Admin) |

### Oficios

| Método | Ruta | Descripción | Permisos |
|--------|------|-------------|----------|
| GET  | `/api/oficios` | Listar (filtrado por área) | Auth |
| GET  | `/api/oficios/alertas` | Oficios en amarillo/rojo | Auth |
| GET  | `/api/oficios/:id` | Detalle + historial + archivos | Auth + área propia |
| POST | `/api/oficios` | Crear oficio | Auth (ver reglas) |
| PUT  | `/api/oficios/:id` | Editar datos básicos | Auth + área propia |
| PATCH | `/api/oficios/:id/estado` | Cambiar estado | Auth + área propia |
| PATCH | `/api/oficios/:id/asignar` | Asignar a área | Admin |
| PATCH | `/api/oficios/:id/prioridad` | Cambiar prioridad | Admin |

**Query params disponibles en GET `/api/oficios`:**
- `tipo` → `recibido_externo | iniciado_interno | informativo`
- `prioridad` → `urgente | normal | informativo`
- `estado` → `recibido | asignado | en_proceso | respondido | en_espera_acuse | finalizado | cancelado`
- `area_id` → Solo Admin. Usuarios siempre ven su área.
- `proyecto_id`
- `busqueda` → Busca en número, asunto, promovente, destinatario
- `pagina` / `limite`

### Archivos

| Método | Ruta | Descripción | Permisos |
|--------|------|-------------|----------|
| GET  | `/api/archivos/oficio/:id` | Listar archivos de un oficio | Auth + área propia |
| POST | `/api/archivos/oficio/:id` | Subir archivo | Auth + área propia |
| GET  | `/api/archivos/:id/download` | Descargar archivo | Auth |

**POST `/api/archivos/oficio/:id`** — `multipart/form-data`:
- `file` — Archivo (PDF, DOC, DOCX — máx. 50 MB)
- `categoria` — Una de: `oficio_recibido`, `oficio_respuesta_word`, `oficio_respuesta_pdf`, `anexo`, `acuse`

### Semáforos

| Método | Ruta | Descripción | Permisos |
|--------|------|-------------|----------|
| GET  | `/api/semaforos/dashboard` | Estadísticas por área | Auth |
| GET  | `/api/semaforos/configuracion` | Leer configuración | Admin |
| PUT  | `/api/semaforos/configuracion/:prioridad` | Actualizar configuración | Admin |

---

## Flujos de proceso (máquinas de estado)

### recibido_externo

```
recibido → asignado → en_proceso → respondido → en_espera_acuse → finalizado
                                                                 ↗ (auto al subir acuse)
Cancelado disponible desde cualquier estado no-terminal.
```

### iniciado_interno

```
en_proceso → respondido → en_espera_acuse → finalizado
                                           ↗ (auto al subir acuse)
Cancelado disponible desde cualquier estado no-terminal.
```

### informativo

```
recibido → asignado → finalizado
Cancelado disponible desde cualquier estado no-terminal.
```

> **Nota:** El oficio informativo **no pasa por en_proceso ni por respuesta**. Su flujo termina directamente en finalizado desde asignado.

---

## Reglas de archivos por categoría

| Categoría | Extensiones | Tipos de proceso permitidos | Efecto especial |
|-----------|-------------|----------------------------|-----------------|
| `oficio_recibido` | PDF | `recibido_externo` | — |
| `oficio_respuesta_word` | DOC, DOCX | `recibido_externo`, `iniciado_interno` | — |
| `oficio_respuesta_pdf` | PDF | `recibido_externo`, `iniciado_interno` | — |
| `anexo` | PDF | Todos | — |
| `acuse` | PDF | `recibido_externo`, `iniciado_interno` | **Auto-finaliza si estado = en_espera_acuse** |

- Los archivos nunca se eliminan, solo se **versionan** (el registro anterior queda con `es_version_activa = false`).

---

## Reglas de permisos

| Acción | Admin | Usuario |
|--------|-------|---------|
| Ver todos los oficios | ✅ | ❌ (solo su área) |
| Crear oficio recibido_externo / informativo | ✅ | ❌ |
| Crear oficio iniciado_interno | ✅ | ✅ (en su área) |
| Asignar/reasignar área | ✅ | ❌ |
| Cambiar prioridad | ✅ | ❌ |
| Cambiar estado | ✅ | ✅ (si es de su área) |
| Subir archivos | ✅ | ✅ (si es de su área) |
| Ver dashboard completo | ✅ | ❌ (solo su área) |
| Configurar semáforos | ✅ | ❌ |
| Gestionar usuarios / áreas | ✅ | ❌ |

---

## Sistema de semáforos

El semáforo se recalcula automáticamente **cada hora** mediante un `setInterval` en `server.js` (reemplaza el SQL Server Agent Job de la especificación original, ya que la BD es PostgreSQL).

| Prioridad | Umbral amarillo | Umbral rojo |
|-----------|-----------------|-------------|
| urgente | 2 días | 5 días |
| normal | 5 días | 15 días |
| informativo | 10 días | 30 días |

Los umbrales son configurables por el admin desde `PUT /api/semaforos/configuracion/:prioridad`.

El semáforo también se recalcula al arrancar el servidor para sincronizar desde el primer momento.

---

## Seguridad

- Contraseñas con bcrypt (12 rounds)
- JWT access token (8h) + refresh token (7d) hasheado en BD
- Bloqueo por 3 intentos fallidos de login (15 min)
- Rate limiting global (300 req / 15 min)
- Filtrado de área a nivel de query — los usuarios no pueden manipular `area_id` por parámetros
- Validación de transiciones de estado por tipo de proceso en la capa de servicio

---

## Usuario por defecto

| Campo | Valor |
|---|---|
| username | `admin` |
| password | `Admin1234!` |
| rol | `admin` |

> ⚠️ Cambiar contraseña después de instalar.

---

## Correcciones respecto a v1.0

1. **Motor de BD**: La especificación mencionaba SQL Server pero el código usa PostgreSQL. Toda la documentación ahora refleja PostgreSQL correctamente.
2. **Máquinas de estado por tipo de proceso**: `TRANSICIONES_VALIDAS` ahora es un mapa diferenciado por `tipo_proceso`. El oficio informativo ya no pasa por en_proceso/respondido/en_espera_acuse.
3. **Filtro de área forzado en servidor**: El controller de oficios ignora `area_id` del query param cuando el usuario es de tipo `usuario`, forzando siempre `req.user.areaId`.
4. **UPSERT en semáforo**: Se usa `ON CONFLICT` para que la creación del semáforo sea idempotente.
5. **Auditoría de prioridad**: El historial ya no registra `estado_anterior === estado_nuevo` incorrectamente — el motivo describe el cambio de prioridad.
6. **Módulo de archivos**: Completamente nuevo. Incluye multer, versionado, validación por categoría/tipo y auto-finalización al subir acuse.
7. **Semáforos**: Reemplaza el SQL Server Agent Job por un `setInterval` en Node.js + queries PostgreSQL con `EXTRACT(DAY FROM NOW() - fecha_recepcion)`.
8. **Ruta `/alertas`**: Declarada antes de `/:id` para evitar colisión de parámetros en Express.
9. **Cancelación requiere motivo**: Validación añadida en `cambiarEstado`.
10. **Dependencia multer**: Agregada a `package.json`.
