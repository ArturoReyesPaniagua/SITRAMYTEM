// services/areas.service.js

const { query } = require('../db/pool');

// ─────────────────────────────────────────────────────────────────────────────
// LISTAR
// ─────────────────────────────────────────────────────────────────────────────

const listar = async ({ soloActivas = true } = {}) => {
  const whereClause = soloActivas ? 'WHERE a.activo = true' : '';

  const result = await query(
    `SELECT
       a.id, a.nombre, a.descripcion, a.responsable,
       a.email_area, a.activo, a.fecha_creacion,
       COUNT(u.id) AS total_usuarios
     FROM areas a
     LEFT JOIN usuarios u ON u.area_id = a.id AND u.activo = true
     ${whereClause}
     GROUP BY a.id
     ORDER BY a.nombre ASC`
  );

  return result.rows;
};

// ─────────────────────────────────────────────────────────────────────────────
// OBTENER UNA
// ─────────────────────────────────────────────────────────────────────────────

const obtenerPorId = async (id) => {
  const result = await query(
    `SELECT
       a.id, a.nombre, a.descripcion, a.responsable,
       a.email_area, a.activo, a.fecha_creacion,
       COUNT(u.id) AS total_usuarios
     FROM areas a
     LEFT JOIN usuarios u ON u.area_id = a.id AND u.activo = true
     WHERE a.id = $1
     GROUP BY a.id`,
    [id]
  );

  if (result.rowCount === 0) {
    throw { status: 404, message: 'Área no encontrada' };
  }

  return result.rows[0];
};

// ─────────────────────────────────────────────────────────────────────────────
// CREAR
// ─────────────────────────────────────────────────────────────────────────────

const crear = async ({ nombre, descripcion, responsable, email_area }) => {
  // Verificar nombre único
  const existe = await query(
    `SELECT id FROM areas WHERE LOWER(nombre) = LOWER($1)`,
    [nombre]
  );

  if (existe.rowCount > 0) {
    throw { status: 409, message: `Ya existe un área con el nombre "${nombre}"` };
  }

  const result = await query(
    `INSERT INTO areas (nombre, descripcion, responsable, email_area)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [nombre, descripcion || null, responsable || null, email_area || null]
  );

  return result.rows[0];
};

// ─────────────────────────────────────────────────────────────────────────────
// EDITAR
// ─────────────────────────────────────────────────────────────────────────────

const editar = async (id, { nombre, descripcion, responsable, email_area }) => {
  // Verificar que existe
  await obtenerPorId(id);

  // Verificar nombre único (excluyendo la misma área)
  if (nombre) {
    const existe = await query(
      `SELECT id FROM areas WHERE LOWER(nombre) = LOWER($1) AND id != $2`,
      [nombre, id]
    );
    if (existe.rowCount > 0) {
      throw { status: 409, message: `Ya existe un área con el nombre "${nombre}"` };
    }
  }

  const result = await query(
    `UPDATE areas
     SET nombre      = COALESCE($1, nombre),
         descripcion = COALESCE($2, descripcion),
         responsable = COALESCE($3, responsable),
         email_area  = COALESCE($4, email_area)
     WHERE id = $5
     RETURNING *`,
    [nombre || null, descripcion || null, responsable || null, email_area || null, id]
  );

  return result.rows[0];
};

// ─────────────────────────────────────────────────────────────────────────────
// DESACTIVAR / ACTIVAR (soft delete)
// ─────────────────────────────────────────────────────────────────────────────

const cambiarEstado = async (id, activo) => {
  // Si se va a desactivar, verificar que no tenga usuarios activos
  if (!activo) {
    const usuariosActivos = await query(
      `SELECT COUNT(*) AS total FROM usuarios WHERE area_id = $1 AND activo = true`,
      [id]
    );

    if (parseInt(usuariosActivos.rows[0].total) > 0) {
      throw {
        status: 409,
        message: 'No se puede desactivar un área con usuarios activos. Reasigne o desactive los usuarios primero',
      };
    }
  }

  const result = await query(
    `UPDATE areas SET activo = $1 WHERE id = $2 RETURNING *`,
    [activo, id]
  );

  if (result.rowCount === 0) {
    throw { status: 404, message: 'Área no encontrada' };
  }

  return result.rows[0];
};

// ─────────────────────────────────────────────────────────────────────────────
// USUARIOS DEL ÁREA
// ─────────────────────────────────────────────────────────────────────────────

const obtenerUsuarios = async (areaId) => {
  await obtenerPorId(areaId); // Valida que el área existe

  const result = await query(
    `SELECT id, username, nombre_completo, email, activo, ultimo_acceso, fecha_creacion
     FROM usuarios
     WHERE area_id = $1
     ORDER BY nombre_completo ASC`,
    [areaId]
  );

  return result.rows;
};

module.exports = { listar, obtenerPorId, crear, editar, cambiarEstado, obtenerUsuarios };
