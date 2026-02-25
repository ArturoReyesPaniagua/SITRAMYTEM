// controllers/oficios.controller.js

const { validationResult } = require('express-validator');
const oficiosService = require('../services/oficios.service');
const { ok, created, badRequest, error } = require('../utils/response');

const listar = async (req, res) => {
  try {
    const { tipo, prioridad, estado, proyecto_id, busqueda, pagina, limite } = req.query;

    // Usuarios solo ven oficios de su área
    const areaId = req.user.rol === 'usuario' ? req.user.areaId : req.query.area_id;

    const resultado = await oficiosService.listar({
      areaId:     areaId ? parseInt(areaId) : undefined,
      tipo, prioridad, estado,
      proyectoId: proyecto_id ? parseInt(proyecto_id) : undefined,
      busqueda,
      pagina:  pagina  ? parseInt(pagina)  : 1,
      limite:  limite  ? parseInt(limite)  : 20,
    });

    return ok(res, resultado);
  } catch (err) {
    return error(res);
  }
};

const obtener = async (req, res) => {
  try {
    const oficio = await oficiosService.obtenerPorId(req.params.id);
    return ok(res, oficio);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return error(res);
  }
};

const crear = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return badRequest(res, 'Datos inválidos', errors.array());

  try {
    // Usuarios solo pueden crear oficios en su área
    const area_asignada_id = req.user.rol === 'usuario'
      ? req.user.areaId
      : req.body.area_asignada_id;

    const oficio = await oficiosService.crear({
      ...req.body,
      area_asignada_id,
      usuarioId: req.user.userId,
    });

    return created(res, oficio, 'Oficio registrado exitosamente');
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return error(res);
  }
};

const editar = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return badRequest(res, 'Datos inválidos', errors.array());

  try {
    const oficio = await oficiosService.editar(req.params.id, req.body, req.user.userId);
    return ok(res, oficio, 'Oficio actualizado');
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return error(res);
  }
};

const cambiarEstado = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return badRequest(res, 'Datos inválidos', errors.array());

  try {
    const oficio = await oficiosService.cambiarEstado(
      req.params.id,
      req.body.estado,
      req.user.userId,
      req.body.motivo || null
    );
    return ok(res, oficio, `Estado cambiado a "${req.body.estado}"`);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return error(res);
  }
};

const asignar = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return badRequest(res, 'Datos inválidos', errors.array());

  try {
    const oficio = await oficiosService.asignar(
      req.params.id,
      req.body.area_id,
      req.user.userId
    );
    return ok(res, oficio, 'Oficio asignado exitosamente');
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return error(res);
  }
};

const cambiarPrioridad = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return badRequest(res, 'Datos inválidos', errors.array());

  try {
    const oficio = await oficiosService.cambiarPrioridad(
      req.params.id,
      req.body.prioridad,
      req.user.userId
    );
    return ok(res, oficio, `Prioridad cambiada a "${req.body.prioridad}"`);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return error(res);
  }
};

module.exports = { listar, obtener, crear, editar, cambiarEstado, asignar, cambiarPrioridad };
