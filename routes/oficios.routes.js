// routes/oficios.routes.js

const express = require('express');
const { body, param, query } = require('express-validator');
const router = express.Router();

const ctrl = require('../controllers/oficios.controller');
const { autenticar, soloAdmin, requireAreaOficio } = require('../middlewares/auth.middleware');

router.use(autenticar);

// ─── Validadores ─────────────────────────────────────────────────────────────

const validarId = param('id').isInt({ min: 1 }).withMessage('ID inválido');

const validarCrear = [
  body('numero_oficio')
    .trim().notEmpty().withMessage('El número de oficio es requerido')
    .isLength({ max: 100 }),

  body('tipo_proceso')
    .isIn(['recibido_externo', 'iniciado_interno', 'informativo'])
    .withMessage('tipo_proceso inválido'),

  body('prioridad')
    .isIn(['urgente', 'normal', 'informativo'])
    .withMessage('prioridad inválida'),

  body('area_asignada_id')
    .optional()
    .isInt({ min: 1 }).withMessage('area_asignada_id inválido'),

  body('asunto')
    .trim().notEmpty().withMessage('El asunto es requerido'),

  body('fecha_recepcion')
    .notEmpty().withMessage('La fecha de recepción es requerida')
    .isISO8601().withMessage('Formato de fecha inválido'),

  body('proyecto_id')
    .optional({ nullable: true })
    .isInt({ min: 1 }),
];

const validarEditar = [
  validarId,
  body('asunto').optional().trim().notEmpty(),
  body('observaciones').optional({ nullable: true }),
  body('proyecto_id').optional({ nullable: true }).isInt({ min: 1 }),
];

const validarCambiarEstado = [
  validarId,
  body('estado')
    .isIn(['asignado', 'en_proceso', 'respondido', 'en_espera_acuse', 'finalizado', 'cancelado'])
    .withMessage('Estado inválido'),
  body('motivo')
    .optional({ nullable: true })
    .isString(),
];

const validarAsignar = [
  validarId,
  body('area_id').isInt({ min: 1 }).withMessage('area_id requerido'),
];

const validarPrioridad = [
  validarId,
  body('prioridad')
    .isIn(['urgente', 'normal', 'informativo'])
    .withMessage('Prioridad inválida'),
];

// ─── Rutas ───────────────────────────────────────────────────────────────────

// GET  /api/oficios
//   ?tipo=recibido_externo
//   ?prioridad=urgente
//   ?estado=en_proceso
//   ?area_id=1          (solo admin)
//   ?proyecto_id=1
//   ?busqueda=texto
//   ?pagina=1&limite=20
router.get('/', ctrl.listar);

// GET /api/oficios/:id  → Detalle completo con historial y archivos
router.get('/:id', validarId, requireAreaOficio, ctrl.obtener);

// POST /api/oficios → Crear oficio
//   Admin: puede crear cualquier tipo y asignar a cualquier área
//   Usuario: solo iniciado_interno en su área
router.post('/', validarCrear, ctrl.crear);

// PUT /api/oficios/:id → Editar datos básicos
router.put('/:id', validarEditar, requireAreaOficio, ctrl.editar);

// PATCH /api/oficios/:id/estado → Cambiar estado (con validación de transición)
router.patch('/:id/estado', validarCambiarEstado, requireAreaOficio, ctrl.cambiarEstado);

// PATCH /api/oficios/:id/asignar → Asignar a área (solo admin)
router.patch('/:id/asignar', soloAdmin, validarAsignar, ctrl.asignar);

// PATCH /api/oficios/:id/prioridad → Cambiar prioridad (solo admin)
router.patch('/:id/prioridad', soloAdmin, validarPrioridad, ctrl.cambiarPrioridad);

module.exports = router;
