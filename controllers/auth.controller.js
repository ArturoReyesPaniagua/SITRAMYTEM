// controllers/auth.controller.js
// Maneja las peticiones HTTP y delega lógica al servicio

const { validationResult } = require('express-validator');
const authService = require('../services/auth.service');
const { ok, badRequest, unauthorized, error } = require('../utils/response');

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 */
const login = async (req, res) => {
  // Validar inputs
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return badRequest(res, 'Datos de entrada inválidos', errors.array());
  }

  try {
    const { username, password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const resultado = await authService.login({ username, password, ipAddress, userAgent });

    // Enviar refresh token como cookie httpOnly (más seguro que el body)
    res.cookie('refreshToken', resultado.refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   7 * 24 * 60 * 60 * 1000, // 7 días
    });

    return ok(res, {
      accessToken: resultado.accessToken,
      usuario:     resultado.usuario,
    }, 'Inicio de sesión exitoso');

  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    console.error('Error en login:', err);
    return error(res);
  }
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/refresh
 * Renueva el access token usando el refresh token (desde cookie o body)
 */
const refresh = async (req, res) => {
  try {
    // Leer refresh token desde cookie (preferido) o body
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!refreshToken) {
      return unauthorized(res, 'Refresh token no proporcionado');
    }

    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const resultado = await authService.renovarToken({ refreshToken, ipAddress, userAgent });

    // Actualizar cookie con el nuevo refresh token
    res.cookie('refreshToken', resultado.refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   7 * 24 * 60 * 60 * 1000,
    });

    return ok(res, { accessToken: resultado.accessToken }, 'Token renovado');

  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    console.error('Error en refresh:', err);
    return error(res);
  }
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/logout
 */
const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    const todos        = req.body?.todos === true;
    const ipAddress    = req.ip || req.connection.remoteAddress;
    const userAgent    = req.headers['user-agent'];

    await authService.logout({
      refreshToken,
      usuarioId: req.user.userId,
      ipAddress,
      userAgent,
      todos,
    });

    // Limpiar cookie
    res.clearCookie('refreshToken');

    return ok(res, null, todos ? 'Sesión cerrada en todos los dispositivos' : 'Sesión cerrada exitosamente');

  } catch (err) {
    console.error('Error en logout:', err);
    return error(res);
  }
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/auth/me
 * Retorna el perfil del usuario autenticado
 */
const me = async (req, res) => {
  try {
    const perfil = await authService.obtenerPerfil(req.user.userId);
    return ok(res, perfil);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    return error(res);
  }
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * PUT /api/auth/password
 * Permite al usuario cambiar su propia contraseña
 */
const cambiarPassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return badRequest(res, 'Datos inválidos', errors.array());
  }

  try {
    const { passwordActual, passwordNuevo } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    await authService.cambiarPassword({
      usuarioId:     req.user.userId,
      passwordActual,
      passwordNuevo,
      ipAddress,
      userAgent,
    });

    // Limpiar cookie (se cerró la sesión en todos los dispositivos)
    res.clearCookie('refreshToken');

    return ok(res, null, 'Contraseña cambiada. Por favor inicie sesión nuevamente');

  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    return error(res);
  }
};

module.exports = { login, refresh, logout, me, cambiarPassword };
