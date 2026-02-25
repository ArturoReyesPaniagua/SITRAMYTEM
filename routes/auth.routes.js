// routes/auth.routes.js
// Definición de rutas de autenticación con validaciones y rate limiting

const express    = require('express');
const rateLimit  = require('express-rate-limit');
const { body }   = require('express-validator');
const router     = express.Router();

const authController = require('../controllers/auth.controller');
const { autenticar } = require('../middlewares/auth.middleware');
const { rateLimit: rateLimitConfig } = require('../config/auth');

// ─────────────────────────────────────────────────────────────────────────────
// RATE LIMITERS
// ─────────────────────────────────────────────────────────────────────────────

// Límite estricto para login (evitar fuerza bruta)
const loginLimiter = rateLimit({
  windowMs:        rateLimitConfig.windowMs,
  max:             rateLimitConfig.loginMax,
  message:         { success: false, message: 'Demasiados intentos. Espere e intente de nuevo' },
  standardHeaders: true,
  legacyHeaders:   false,
});

// Límite general para otras rutas de auth
const authLimiter = rateLimit({
  windowMs:        rateLimitConfig.windowMs,
  max:             rateLimitConfig.max,
  message:         { success: false, message: 'Demasiadas peticiones' },
  standardHeaders: true,
  legacyHeaders:   false,
});

// ─────────────────────────────────────────────────────────────────────────────
// VALIDADORES
// ─────────────────────────────────────────────────────────────────────────────

const validarLogin = [
  body('username')
    .trim()
    .notEmpty().withMessage('El username es requerido')
    .isLength({ min: 3, max: 50 }).withMessage('Username debe tener entre 3 y 50 caracteres')
    .matches(/^[a-zA-Z0-9._-]+$/).withMessage('Username solo permite letras, números, puntos, guiones y guiones bajos'),

  body('password')
    .notEmpty().withMessage('La contraseña es requerida')
    .isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres'),
];

const validarCambioPassword = [
  body('passwordActual')
    .notEmpty().withMessage('La contraseña actual es requerida'),

  body('passwordNuevo')
    .notEmpty().withMessage('La nueva contraseña es requerida')
    .isLength({ min: 8 }).withMessage('La nueva contraseña debe tener al menos 8 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('La contraseña debe contener al menos una mayúscula, una minúscula y un número'),

  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.passwordNuevo) {
        throw new Error('Las contraseñas no coinciden');
      }
      return true;
    }),
];

// ─────────────────────────────────────────────────────────────────────────────
// RUTAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 * Pública - Rate limit estricto
 */
router.post('/login', loginLimiter, validarLogin, authController.login);

/**
 * POST /api/auth/refresh
 * Semi-pública - Solo necesita refresh token válido
 */
router.post('/refresh', authLimiter, authController.refresh);

/**
 * POST /api/auth/logout
 * Protegida - Requiere access token
 * Body opcional: { todos: true } para cerrar todas las sesiones
 */
router.post('/logout', autenticar, authController.logout);

/**
 * GET /api/auth/me
 * Protegida - Retorna perfil del usuario autenticado
 */
router.get('/me', autenticar, authController.me);

/**
 * PUT /api/auth/password
 * Protegida - Cambia la contraseña del usuario autenticado
 */
router.put('/password', autenticar, authLimiter, validarCambioPassword, authController.cambiarPassword);

module.exports = router;
