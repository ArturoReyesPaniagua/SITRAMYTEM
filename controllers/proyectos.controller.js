// controllers/proyectos.controller.js

const { validationResult } = require('express-validator');
const proyectosService = require('../services/proyectos.service');
const { ok, created, badRequest, error } = require('../utils/response');

const listar = async (req, res) => {
  try {
    const { estado, todos } = req.query;

    // Usuario solo ve proyectos de su área
    const areaId = req.user.rol === 'usuario' ? req.user.areaId : req.query.area_id;

    const proyectos = await proyectosService.listar({
      areaId:     areaId ? parseInt(areaId) : undefined,
      estado,
      soloActivos: todos !== 'true',
    });

    return ok(res, proyectos);
  } catch (err) {
    return error(res);
  }
};

const obtener = async (req, res) => {
  try {
    const proyecto = await proyectosService.obtenerPorId(req.params.id);
    return ok(res, proyecto);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return error(res);
  }
};

const crear = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return badRequest(res, 'Datos inválidos', errors.array());

  try {
    // Usuario solo puede crear en su área
    const area_id = req.user.rol === 'usuario' ? req.user.areaId : req.body.area_id;

    const proyecto = await proyectosService.crear({
      ...req.body,
      area_id,
      usuarioId: req.user.userId,
    });

    return created(res, proyecto, 'Proyecto creado exitosamente');
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return error(res);
  }
};

const editar = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return badRequest(res, 'Datos inválidos', errors.array());

  try {
    const proyecto = await proyectosService.editar(req.params.id, req.body);
    return ok(res, proyecto, 'Proyecto actualizado');
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return error(res);
  }
};

const cambiarEstado = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return badRequest(res, 'Datos inválidos', errors.array());

  try {
    const proyecto = await proyectosService.cambiarEstado(req.params.id, req.body.estado);
    return ok(res, proyecto, `Proyecto marcado como ${req.body.estado}`);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return error(res);
  }
};

const obtenerOficios = async (req, res) => {
  try {
    const oficios = await proyectosService.obtenerOficios(req.params.id);
    return ok(res, oficios);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return error(res);
  }
};

module.exports = { listar, obtener, crear, editar, cambiarEstado, obtenerOficios };
