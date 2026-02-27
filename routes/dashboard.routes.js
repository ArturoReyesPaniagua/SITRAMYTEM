// routes/dashboard.routes.js

const express = require('express');
const router  = express.Router();

const ctrl = require('../controllers/dashboard.controller');
const { autenticar } = require('../middlewares/auth.middleware');

router.use(autenticar);

// GET /api/dashboard          → Resumen (admin: ejecutivo | usuario: su área)
router.get('/', ctrl.resumen);

// GET /api/dashboard/sla      → Reporte de cumplimiento SLA
// ?desde=2024-01-01&hasta=2024-12-31&area_id=1
router.get('/sla', ctrl.sla);

// GET /api/dashboard/actividad → Últimas 24h de cambios de estado
router.get('/actividad', ctrl.actividad);

module.exports = router;
