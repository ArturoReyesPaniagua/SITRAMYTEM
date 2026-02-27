// controllers/semaforos.controller.js

const semaforosService = require('../services/semaforos.service');
const { ok, badRequest, error } = require('../utils/response');
const { body, param, validationResult } = require('express-validator');

// GET /api/semaforos/dashboard
const dashboard = async (req, res) => {
  try {
    // Admin ve todo, usuario solo su área
    const areaId = req.user.rol === 'usuario' ? req.user.areaId : req.query.area_id || undefined;
    const data = await semaforosService.obtenerDashboard({ areaId: areaId ? parseInt(areaId) : undefined });
    return ok(res, data);
  } catch (err) {
    return error(res);
  }
};

// GET /api/semaforos/configuracion  (solo admin)
const obtenerConfiguracion = async (req, res) => {
  try {
    const config = await semaforosService.obtenerConfiguracion();
    return ok(res, config);
  } catch (err) {
    return error(res);
  }
};

// PUT /api/semaforos/configuracion/:prioridad  (solo admin)
const actualizarConfiguracion = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return badRequest(res, 'Datos inválidos', errors.array());

  try {
    const config = await semaforosService.actualizarConfiguracion(
      req.params.prioridad,
      { dias_verde: parseInt(req.body.dias_verde), dias_rojo: parseInt(req.body.dias_rojo) }
    );
    return ok(res, config, 'Configuración actualizada');
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return error(res);
  }
};

module.exports = { dashboard, obtenerConfiguracion, actualizarConfiguracion };
