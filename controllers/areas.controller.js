// controllers/areas.controller.js

const { validationResult } = require('express-validator');
const areasService = require('../services/areas.service');
const { ok, created, badRequest, error } = require('../utils/response');

const listar = async (req, res) => {
  try {
    const soloActivas = req.query.todas !== 'true'; // ?todas=true para ver inactivas
    const areas = await areasService.listar({ soloActivas });
    return ok(res, areas);
  } catch (err) {
    return error(res);
  }
};

const obtener = async (req, res) => {
  try {
    const area = await areasService.obtenerPorId(req.params.id);
    return ok(res, area);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return error(res);
  }
};

const crear = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return badRequest(res, 'Datos inválidos', errors.array());

  try {
    const area = await areasService.crear(req.body);
    return created(res, area, 'Área creada exitosamente');
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return error(res);
  }
};

const editar = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return badRequest(res, 'Datos inválidos', errors.array());

  try {
    const area = await areasService.editar(req.params.id, req.body);
    return ok(res, area, 'Área actualizada exitosamente');
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return error(res);
  }
};

const desactivar = async (req, res) => {
  try {
    const area = await areasService.cambiarEstado(req.params.id, false);
    return ok(res, area, 'Área desactivada');
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return error(res);
  }
};

const activar = async (req, res) => {
  try {
    const area = await areasService.cambiarEstado(req.params.id, true);
    return ok(res, area, 'Área activada');
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return error(res);
  }
};

const obtenerUsuarios = async (req, res) => {
  try {
    const usuarios = await areasService.obtenerUsuarios(req.params.id);
    return ok(res, usuarios);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return error(res);
  }
};

module.exports = { listar, obtener, crear, editar, desactivar, activar, obtenerUsuarios };
