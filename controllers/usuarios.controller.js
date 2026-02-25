// controllers/usuarios.controller.js

const { validationResult } = require('express-validator');
const usuariosService = require('../services/usuarios.service');
const { ok, created, badRequest, forbidden, error } = require('../utils/response');

const listar = async (req, res) => {
  try {
    // Usuario normal solo puede verse a sí mismo
    if (req.user.rol === 'usuario') {
      const usuario = await usuariosService.obtenerPorId(req.user.userId);
      return ok(res, [usuario]);
    }

    const { rol, area_id, todos } = req.query;
    const usuarios = await usuariosService.listar({
      rol,
      areaId:     area_id ? parseInt(area_id) : undefined,
      soloActivos: todos !== 'true',
    });
    return ok(res, usuarios);
  } catch (err) {
    return error(res);
  }
};

const obtener = async (req, res) => {
  try {
    // Usuario solo puede ver su propio perfil
    if (req.user.rol === 'usuario' && parseInt(req.params.id) !== req.user.userId) {
      return forbidden(res);
    }

    const usuario = await usuariosService.obtenerPorId(req.params.id);
    return ok(res, usuario);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return error(res);
  }
};

const crear = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return badRequest(res, 'Datos inválidos', errors.array());

  try {
    const usuario = await usuariosService.crear(req.body);
    return created(res, usuario, 'Usuario creado exitosamente');
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return error(res);
  }
};

const editar = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return badRequest(res, 'Datos inválidos', errors.array());

  try {
    // Usuario solo puede editar su propio perfil
    if (req.user.rol === 'usuario' && parseInt(req.params.id) !== req.user.userId) {
      return forbidden(res);
    }

    const usuario = await usuariosService.editar(req.params.id, req.body);
    return ok(res, usuario, 'Usuario actualizado');
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return error(res);
  }
};

const cambiarRol = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return badRequest(res, 'Datos inválidos', errors.array());

  try {
    const usuario = await usuariosService.cambiarRol(req.params.id, req.body);
    return ok(res, usuario, 'Rol actualizado');
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return error(res);
  }
};

const resetearPassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return badRequest(res, 'Datos inválidos', errors.array());

  try {
    await usuariosService.resetearPassword(req.params.id, req.body.nuevaPassword);
    return ok(res, null, 'Contraseña reseteada. El usuario deberá iniciar sesión nuevamente');
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return error(res);
  }
};

const desactivar = async (req, res) => {
  try {
    // No permitir desactivarse a sí mismo
    if (parseInt(req.params.id) === req.user.userId) {
      return badRequest(res, 'No puedes desactivar tu propia cuenta');
    }

    const usuario = await usuariosService.cambiarEstado(req.params.id, false);
    return ok(res, usuario, 'Usuario desactivado');
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return error(res);
  }
};

const activar = async (req, res) => {
  try {
    const usuario = await usuariosService.cambiarEstado(req.params.id, true);
    return ok(res, usuario, 'Usuario activado');
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return error(res);
  }
};

const desbloquear = async (req, res) => {
  try {
    const usuario = await usuariosService.desbloquear(req.params.id);
    return ok(res, usuario, 'Usuario desbloqueado');
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return error(res);
  }
};

module.exports = {
  listar, obtener, crear, editar,
  cambiarRol, resetearPassword,
  desactivar, activar, desbloquear,
};
