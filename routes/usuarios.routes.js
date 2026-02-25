// routes/usuarios.routes.js

const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();

const ctrl = require('../controllers/usuarios.controller');
const { autenticar, soloAdmin } = require('../middlewares/auth.middleware');

router.use(autenticar);

// ─── Validadores ─────────────────────────────────────────────────────────────

const validarId = param('id').isInt({ min: 1 }).withMessage('ID inválido');

const validarCrear = [
  body('username')
    .trim().notEmpty().withMessage('Username requerido')
    .isLength({ min: 3, max: 50 })
    .matches(/^[a-zA-Z0-9._-]+$/).withMessage('Username solo permite letras, números, puntos, guiones y guiones bajos'),

  body('password')
    .notEmpty().withMessage('Contraseña requerida')
    .isLength({ min: 8 }).withMessage('Mínimo 8 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Debe tener mayúscula, minúscula y número'),

  body('nombre_completo')
    .trim().notEmpty().withMessage('Nombre completo requerido')
    .isLength({ max: 255 }),

  body('email')
    .trim().notEmpty().withMessage('Email requerido')
    .isEmail().withMessage('Email inválido'),

  body('rol')
    .notEmpty().withMessage('Rol requerido')
    .isIn(['admin', 'usuario']).withMessage('Rol debe ser "admin" o "usuario"'),

  body('area_id')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('area_id debe ser un número entero positivo'),
];

const validarEditar = [
  validarId,
  body('nombre_completo').optional().trim().notEmpty().isLength({ max: 255 }),
  body('email').optional().isEmail().withMessage('Email inválido'),
  body('area_id').optional({ nullable: true }).isInt({ min: 1 }),
];

const validarCambiarRol = [
  validarId,
  body('rol').isIn(['admin', 'usuario']).withMessage('Rol inválido'),
  body('area_id').optional({ nullable: true }).isInt({ min: 1 }),
];

const validarResetPassword = [
  validarId,
  body('nuevaPassword')
    .notEmpty().withMessage('La nueva contraseña es requerida')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Debe tener mayúscula, minúscula y número'),
];

// ─── Rutas ───────────────────────────────────────────────────────────────────

// GET  /api/usuarios              → Lista (admin: todos, usuario: solo él)
router.get('/', ctrl.listar);

// GET  /api/usuarios/:id          → Detalle
router.get('/:id', validarId, ctrl.obtener);

// POST /api/usuarios              → Crear (solo admin)
router.post('/', soloAdmin, validarCrear, ctrl.crear);

// PUT  /api/usuarios/:id          → Editar datos básicos
router.put('/:id', validarEditar, ctrl.editar);

// PATCH /api/usuarios/:id/rol     → Cambiar rol (solo admin)
router.patch('/:id/rol', soloAdmin, validarCambiarRol, ctrl.cambiarRol);

// PATCH /api/usuarios/:id/password → Resetear contraseña (solo admin)
router.patch('/:id/password', soloAdmin, validarResetPassword, ctrl.resetearPassword);

// PATCH /api/usuarios/:id/desactivar → Desactivar (solo admin)
router.patch('/:id/desactivar', soloAdmin, validarId, ctrl.desactivar);

// PATCH /api/usuarios/:id/activar    → Activar (solo admin)
router.patch('/:id/activar', soloAdmin, validarId, ctrl.activar);

// PATCH /api/usuarios/:id/desbloquear → Desbloquear tras intentos fallidos (solo admin)
router.patch('/:id/desbloquear', soloAdmin, validarId, ctrl.desbloquear);

module.exports = router;
