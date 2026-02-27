// controllers/dashboard.controller.js

const dashboardService = require('../services/dashboard.service');
const { ok, error } = require('../utils/response');

const resumen = async (req, res) => {
  try {
    // Admin ve resumen ejecutivo completo, usuario ve solo su área
    const datos = req.user.rol === 'admin'
      ? await dashboardService.resumenEjecutivo()
      : await dashboardService.resumenArea(req.user.areaId);

    return ok(res, datos);
  } catch (err) {
    console.error('Error en dashboard resumen:', err);
    return error(res);
  }
};

const sla = async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const areaId = req.user.rol === 'usuario' ? req.user.areaId : req.query.area_id;

    const reporte = await dashboardService.reporteSLA({
      areaId: areaId ? parseInt(areaId) : null,
      desde:  desde || null,
      hasta:  hasta || null,
    });

    return ok(res, reporte);
  } catch (err) {
    return error(res);
  }
};

const actividad = async (req, res) => {
  try {
    const areaId = req.user.rol === 'usuario' ? req.user.areaId : req.query.area_id;
    const datos  = await dashboardService.actividadReciente(areaId);
    return ok(res, datos);
  } catch (err) {
    return error(res);
  }
};

module.exports = { resumen, sla, actividad };
