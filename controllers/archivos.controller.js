// controllers/archivos.controller.js

const archivosService = require('../services/archivos.service');
const { ok, badRequest, error } = require('../utils/response');

// GET /api/oficios/:id/archivos
const listar = async (req, res) => {
  try {
    const archivos = await archivosService.listarPorOficio(req.params.id);
    return ok(res, archivos);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return error(res);
  }
};

// POST /api/oficios/:id/archivos
const subir = async (req, res) => {
  if (!req.file) return badRequest(res, 'No se recibió ningún archivo');

  const { categoria } = req.body;
  if (!categoria) return badRequest(res, 'El campo "categoria" es requerido');

  try {
    const archivo = await archivosService.subirArchivo(
      req.params.id,
      categoria,
      req.file,
      req.user.userId
    );
    return ok(res, archivo, 'Archivo subido exitosamente');
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return error(res);
  }
};

// GET /api/archivos/:id/download
const descargar = async (req, res) => {
  try {
    const { rutaAbsoluta, nombreOriginal } = await archivosService.obtenerRutaDescarga(req.params.id);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(nombreOriginal)}"`);
    return res.sendFile(rutaAbsoluta);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return error(res);
  }
};

module.exports = { listar, subir, descargar };
