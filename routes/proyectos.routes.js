// routes/proyectos.routes.js

const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();

const ctrl = require('../controllers/proyectos.controller');
const { autenticar, requireAreaProyecto } = require('../middlewares/auth.middleware');

router.use(autenticar);

// ─── Validadores ─────────────────────────────────────────────────────────────

const validarId = param('id').isInt({ min: 1 }).withMessage('ID inválido');

const validarCrear = [
  body('nombre')
    .trim().notEmpty().withMessage('El nombre es requerido')
    .isLength({ max: 255 }),

  body('area_id')
    .optional()
    .isInt({ min: 1 }).withMessage('area_id inválido'),

  body('fecha_inicio')
    .optional({ nullable: true })
    .isDate().withMessage('Formato de fecha inválido (YYYY-MM-DD)'),

  body('fecha_fin')
    .optional({ nullable: true })
    .isDate().withMessage('Formato de fecha inválido (YYYY-MM-DD)')
    .custom((val, { req }) => {
      if (val && req.body.fecha_inicio && val < req.body.fecha_inicio) {
        throw new Error('La fecha de fin no puede ser anterior a la de inicio');
      }
      return true;
    }),
];

const validarEditar = [
  validarId,
  body('nombre').optional().trim().notEmpty().isLength({ max: 255 }),
  body('fecha_inicio').optional({ nullable: true }).isDate(),
  body('fecha_fin').optional({ nullable: true }).isDate(),
];

const validarEstado = [
  validarId,
  body('estado')
    .isIn(['Activo', 'Finalizado', 'Cancelado'])
    .withMessage('Estado inválido'),
];

// ─── Rutas ───────────────────────────────────────────────────────────────────

// GET  /api/proyectos               → Lista (filtrado por área si no es admin)
router.get('/', ctrl.listar);

// GET  /api/proyectos/:id           → Detalle
router.get('/:id', validarId, requireAreaProyecto, ctrl.obtener);

// GET  /api/proyectos/:id/oficios   → Oficios del proyecto
router.get('/:id/oficios', validarId, requireAreaProyecto, ctrl.obtenerOficios);

// POST /api/proyectos               → Crear
router.post('/', validarCrear, ctrl.crear);

// PUT  /api/proyectos/:id           → Editar
router.put('/:id', validarEditar, requireAreaProyecto, ctrl.editar);

// PATCH /api/proyectos/:id/estado   → Cambiar estado
router.patch('/:id/estado', validarEstado, requireAreaProyecto, ctrl.cambiarEstado);

module.exports = router;
