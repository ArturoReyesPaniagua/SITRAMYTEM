// utils/response.js
// Respuestas estandarizadas para toda la API

const ok = (res, data, message = 'OK', status = 200) => {
  return res.status(status).json({
    success: true,
    message,
    data,
  });
};

const created = (res, data, message = 'Recurso creado exitosamente') => {
  return ok(res, data, message, 201);
};

const error = (res, message = 'Error interno del servidor', status = 500, errors = null) => {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(status).json(body);
};

const unauthorized = (res, message = 'No autorizado') =>
  error(res, message, 401);

const forbidden = (res, message = 'No tiene permisos para esta acción') =>
  error(res, message, 403);

const notFound = (res, message = 'Recurso no encontrado') =>
  error(res, message, 404);

const badRequest = (res, message = 'Datos inválidos', errors = null) =>
  error(res, message, 400, errors);

module.exports = { ok, created, error, unauthorized, forbidden, notFound, badRequest };
