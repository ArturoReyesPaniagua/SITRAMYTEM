// routes/areas.routes.js

const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();

const ctrl = require('../controllers/areas.controller');
const { autenticar, soloAdmin } = require('../middlewares/auth.middleware');

// Todos los endpoints de áreas requieren estar autenticado
router.use(autenticar);

// ─── Validadores ─────────────────────────────────────────────────────────────

const validarId = param('id').isInt({ min: 1 }).withMessage('ID inválido');

const validarCrear = [
  body('nombre')
    .trim().notEmpty().withMessage('El nombre es requerido')
    .isLength({ max: 255 }).withMessage('Nombre demasiado largo'),

  body('email_area')
    .optional({ nullable: true })
    .isEmail().withMessage('Email inválido'),

  body('responsable')
    .optional({ nullable: true })
    .trim().isLength({ max: 255 }),
];

const validarEditar = [
  validarId,
  body('nombre')
    .optional()
    .trim().notEmpty().isLength({ max: 255 }),

  body('email_area')
    .optional({ nullable: true })
    .isEmail().withMessage('Email inválido'),
];

// ─── Rutas ───────────────────────────────────────────────────────────────────

// GET  /api/areas             → Lista todas las áreas (admin: todas, usuario: solo la suya)
// GET  /api/areas?todas=true  → Lista incluye inactivas (solo admin)
router.get('/', (req, res, next) => {
  // Usuario normal solo puede ver su propia área
  if (req.user.rol === 'usuario') {
    req.params.id = req.user.areaId;
    return ctrl.obtener(req, res);
  }
  next();
}, ctrl.listar);

// GET  /api/areas/:id         → Detalle de un área
router.get('/:id', validarId, ctrl.obtener);

// GET  /api/areas/:id/usuarios → Usuarios del área (solo admin)
router.get('/:id/usuarios', soloAdmin, validarId, ctrl.obtenerUsuarios);

// POST /api/areas             → Crear área (solo admin)
router.post('/', soloAdmin, validarCrear, ctrl.crear);

// PUT  /api/areas/:id         → Editar área (solo admin)
router.put('/:id', soloAdmin, validarEditar, ctrl.editar);

// PATCH /api/areas/:id/desactivar  → Desactivar (solo admin)
router.patch('/:id/desactivar', soloAdmin, validarId, ctrl.desactivar);

// PATCH /api/areas/:id/activar     → Activar (solo admin)
router.patch('/:id/activar', soloAdmin, validarId, ctrl.activar);

module.exports = router;
