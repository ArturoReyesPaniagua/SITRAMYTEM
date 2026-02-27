// routes/semaforos.routes.js

const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();

const ctrl = require('../controllers/semaforos.controller');
const { autenticar, soloAdmin } = require('../middlewares/auth.middleware');

router.use(autenticar);

const validarPrioridad = param('prioridad')
  .isIn(['urgente', 'normal', 'informativo'])
  .withMessage('Prioridad inválida');

const validarConfig = [
  validarPrioridad,
  body('dias_verde').isInt({ min: 1 }).withMessage('dias_verde debe ser entero >= 1'),
  body('dias_rojo').isInt({ min: 2 }).withMessage('dias_rojo debe ser entero >= 2'),
];

// GET  /api/semaforos/dashboard           → Estadísticas por área
router.get('/dashboard', ctrl.dashboard);

// GET  /api/semaforos/configuracion       → Leer config (solo admin)
router.get('/configuracion', soloAdmin, ctrl.obtenerConfiguracion);

// PUT  /api/semaforos/configuracion/:prioridad → Actualizar config (solo admin)
router.put('/configuracion/:prioridad', soloAdmin, validarConfig, ctrl.actualizarConfiguracion);

module.exports = router;
