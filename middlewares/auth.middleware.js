// middlewares/auth.middleware.js
// Middlewares de autenticación y autorización

const { verificarAccessToken } = require('../utils/jwt');
const { query } = require('../db/pool');
const { unauthorized, forbidden } = require('../utils/response');

// ─────────────────────────────────────────────────────────────────────────────
// AUTENTICACIÓN: Verificar JWT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Middleware principal: verifica que el access token sea válido.
 * Agrega req.user con los datos del payload.
 */
const autenticar = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return unauthorized(res, 'Token de acceso requerido');
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verificarAccessToken(token);
    req.user = decoded; // { userId, username, rol, areaId, nombre }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return unauthorized(res, 'Token expirado. Renueve su sesión');
    }
    return unauthorized(res, 'Token inválido');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// AUTORIZACIÓN: Por rol
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fábrica de middleware para validar rol(es).
 *
 * @example
 * router.delete('/usuario/:id', autenticar, requireRol('admin'), controller)
 * router.get('/oficios',        autenticar, requireRol(['admin', 'usuario']), controller)
 */
const requireRol = (roles) => {
  const rolesPermitidos = Array.isArray(roles) ? roles : [roles];

  return (req, res, next) => {
    if (!req.user) {
      return unauthorized(res);
    }

    if (!rolesPermitidos.includes(req.user.rol)) {
      return forbidden(res, `Rol requerido: ${rolesPermitidos.join(' o ')}`);
    }

    next();
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// AUTORIZACIÓN: Solo admin
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shortcut: permite solo a admins
 *
 * @example
 * router.post('/areas', autenticar, soloAdmin, controller)
 */
const soloAdmin = requireRol('admin');

// ─────────────────────────────────────────────────────────────────────────────
// AUTORIZACIÓN: Validar área del oficio
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valida que el usuario tenga acceso al oficio indicado en req.params.id.
 * Admin: puede ver cualquier oficio.
 * Usuario: solo puede ver oficios de su área.
 *
 * Requiere: autenticar ejecutado antes.
 */
const requireAreaOficio = async (req, res, next) => {
  if (!req.user) return unauthorized(res);

  // Admin puede acceder a cualquier oficio
  if (req.user.rol === 'admin') return next();

  const oficioId = req.params.id;

  if (!oficioId) {
    return forbidden(res, 'ID de oficio no proporcionado');
  }

  try {
    const result = await query(
      `SELECT area_asignada_id FROM oficios WHERE id = $1`,
      [oficioId]
    );

    if (result.rowCount === 0) {
      const { notFound } = require('../utils/response');
      return notFound(res, 'Oficio no encontrado');
    }

    const oficio = result.rows[0];

    if (oficio.area_asignada_id !== req.user.areaId) {
      return forbidden(res, 'Este oficio no pertenece a su área');
    }

    next();
  } catch (err) {
    console.error('Error en requireAreaOficio:', err);
    const { error } = require('../utils/response');
    return error(res);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// AUTORIZACIÓN: Validar área del proyecto
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valida que el usuario tenga acceso al proyecto indicado en req.params.id.
 */
const requireAreaProyecto = async (req, res, next) => {
  if (!req.user) return unauthorized(res);
  if (req.user.rol === 'admin') return next();

  const proyectoId = req.params.id;

  try {
    const result = await query(
      `SELECT area_id FROM proyectos WHERE id = $1 AND activo = true`,
      [proyectoId]
    );

    if (result.rowCount === 0) {
      const { notFound } = require('../utils/response');
      return notFound(res, 'Proyecto no encontrado');
    }

    if (result.rows[0].area_id !== req.user.areaId) {
      return forbidden(res, 'Este proyecto no pertenece a su área');
    }

    next();
  } catch (err) {
    console.error('Error en requireAreaProyecto:', err);
    const { error } = require('../utils/response');
    return error(res);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// OPCIONAL: Autenticar sin fallar (para rutas semi-públicas)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Intenta autenticar pero no falla si no hay token.
 * Útil para rutas que muestran contenido diferente según si está logueado.
 */
const autenticarOpcional = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  try {
    req.user = verificarAccessToken(authHeader.split(' ')[1]);
  } catch {
    req.user = null;
  }

  next();
};

module.exports = {
  autenticar,
  requireRol,
  soloAdmin,
  requireAreaOficio,
  requireAreaProyecto,
  autenticarOpcional,
};
