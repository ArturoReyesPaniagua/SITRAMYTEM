// services/usuarios.service.js

const bcrypt = require('bcrypt');
const { query, withTransaction } = require('../db/pool');
const { bcrypt: bcryptConfig } = require('../config/auth');

// ─────────────────────────────────────────────────────────────────────────────
// LISTAR
// ─────────────────────────────────────────────────────────────────────────────

const listar = async ({ rol, areaId, soloActivos = true } = {}) => {
  const condiciones = [];
  const params = [];
  let idx = 1;

  if (soloActivos) {
    condiciones.push(`u.activo = true`);
  }
  if (rol) {
    condiciones.push(`u.rol = $${idx++}`);
    params.push(rol);
  }
  if (areaId) {
    condiciones.push(`u.area_id = $${idx++}`);
    params.push(areaId);
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  const result = await query(
    `SELECT
       u.id, u.username, u.nombre_completo, u.email,
       u.rol, u.area_id, u.activo,
       u.ultimo_acceso, u.fecha_creacion,
       a.nombre AS area_nombre
     FROM usuarios u
     LEFT JOIN areas a ON u.area_id = a.id
     ${where}
     ORDER BY u.nombre_completo ASC`,
    params
  );

  return result.rows;
};

// ─────────────────────────────────────────────────────────────────────────────
// OBTENER UNO
// ─────────────────────────────────────────────────────────────────────────────

const obtenerPorId = async (id) => {
  const result = await query(
    `SELECT
       u.id, u.username, u.nombre_completo, u.email,
       u.rol, u.area_id, u.activo,
       u.intentos_fallidos, u.bloqueado_hasta,
       u.ultimo_acceso, u.fecha_creacion,
       a.nombre AS area_nombre
     FROM usuarios u
     LEFT JOIN areas a ON u.area_id = a.id
     WHERE u.id = $1`,
    [id]
  );

  if (result.rowCount === 0) {
    throw { status: 404, message: 'Usuario no encontrado' };
  }

  return result.rows[0];
};

// ─────────────────────────────────────────────────────────────────────────────
// CREAR
// ─────────────────────────────────────────────────────────────────────────────

const crear = async ({ username, password, nombre_completo, email, rol, area_id }) => {
  // Validar regla: admin sin área, usuario con área
  if (rol === 'admin' && area_id) {
    throw { status: 400, message: 'Un administrador no puede tener área asignada' };
  }
  if (rol === 'usuario' && !area_id) {
    throw { status: 400, message: 'Un usuario de área debe tener área asignada' };
  }

  // Verificar username único
  const existeUsername = await query(
    `SELECT id FROM usuarios WHERE username = $1`, [username]
  );
  if (existeUsername.rowCount > 0) {
    throw { status: 409, message: `El username "${username}" ya está en uso` };
  }

  // Verificar email único
  const existeEmail = await query(
    `SELECT id FROM usuarios WHERE email = $1`, [email]
  );
  if (existeEmail.rowCount > 0) {
    throw { status: 409, message: `El email "${email}" ya está registrado` };
  }

  // Verificar que el área existe y está activa
  if (area_id) {
    const area = await query(
      `SELECT id FROM areas WHERE id = $1 AND activo = true`, [area_id]
    );
    if (area.rowCount === 0) {
      throw { status: 404, message: 'Área no encontrada o inactiva' };
    }
  }

  const passwordHash = await bcrypt.hash(password, bcryptConfig.rounds);

  const result = await query(
    `INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol, area_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, username, nombre_completo, email, rol, area_id, activo, fecha_creacion`,
    [username, passwordHash, nombre_completo, email, rol, area_id || null]
  );

  return result.rows[0];
};

// ─────────────────────────────────────────────────────────────────────────────
// EDITAR
// ─────────────────────────────────────────────────────────────────────────────

const editar = async (id, { nombre_completo, email, area_id }) => {
  const usuario = await obtenerPorId(id);

  // Verificar email único si cambia
  if (email && email !== usuario.email) {
    const existeEmail = await query(
      `SELECT id FROM usuarios WHERE email = $1 AND id != $2`, [email, id]
    );
    if (existeEmail.rowCount > 0) {
      throw { status: 409, message: `El email "${email}" ya está en uso` };
    }
  }

  // Validar área si es usuario (no admin)
  if (area_id !== undefined && usuario.rol === 'admin') {
    throw { status: 400, message: 'No se puede asignar área a un administrador' };
  }

  if (area_id) {
    const area = await query(
      `SELECT id FROM areas WHERE id = $1 AND activo = true`, [area_id]
    );
    if (area.rowCount === 0) {
      throw { status: 404, message: 'Área no encontrada o inactiva' };
    }
  }

  const result = await query(
    `UPDATE usuarios
     SET nombre_completo = COALESCE($1, nombre_completo),
         email           = COALESCE($2, email),
         area_id         = COALESCE($3, area_id)
     WHERE id = $4
     RETURNING id, username, nombre_completo, email, rol, area_id, activo`,
    [nombre_completo || null, email || null, area_id || null, id]
  );

  return result.rows[0];
};

// ─────────────────────────────────────────────────────────────────────────────
// CAMBIAR ROL
// ─────────────────────────────────────────────────────────────────────────────

const cambiarRol = async (id, { rol, area_id }) => {
  if (rol === 'admin' && area_id) {
    throw { status: 400, message: 'Un administrador no puede tener área asignada' };
  }
  if (rol === 'usuario' && !area_id) {
    throw { status: 400, message: 'Debe especificar el área para un usuario' };
  }

  const result = await query(
    `UPDATE usuarios
     SET rol = $1, area_id = $2
     WHERE id = $3
     RETURNING id, username, nombre_completo, rol, area_id`,
    [rol, area_id || null, id]
  );

  if (result.rowCount === 0) {
    throw { status: 404, message: 'Usuario no encontrado' };
  }

  return result.rows[0];
};

// ─────────────────────────────────────────────────────────────────────────────
// RESETEAR CONTRASEÑA (admin)
// ─────────────────────────────────────────────────────────────────────────────

const resetearPassword = async (id, nuevaPassword) => {
  await obtenerPorId(id); // Valida que existe

  const passwordHash = await bcrypt.hash(nuevaPassword, bcryptConfig.rounds);

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE usuarios SET password_hash = $1 WHERE id = $2`,
      [passwordHash, id]
    );
    // Revocar todos sus refresh tokens
    await client.query(
      `UPDATE refresh_tokens SET revocado = true WHERE usuario_id = $1`,
      [id]
    );
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVAR / DESACTIVAR
// ─────────────────────────────────────────────────────────────────────────────

const cambiarEstado = async (id, activo) => {
  const result = await query(
    `UPDATE usuarios SET activo = $1 WHERE id = $2
     RETURNING id, username, nombre_completo, activo`,
    [activo, id]
  );

  if (result.rowCount === 0) {
    throw { status: 404, message: 'Usuario no encontrado' };
  }

  // Si se desactiva, revocar todos sus tokens
  if (!activo) {
    await query(
      `UPDATE refresh_tokens SET revocado = true WHERE usuario_id = $1`,
      [id]
    );
  }

  return result.rows[0];
};

// ─────────────────────────────────────────────────────────────────────────────
// DESBLOQUEAR (tras intentos fallidos)
// ─────────────────────────────────────────────────────────────────────────────

const desbloquear = async (id) => {
  const result = await query(
    `UPDATE usuarios
     SET intentos_fallidos = 0, bloqueado_hasta = NULL
     WHERE id = $1
     RETURNING id, username, nombre_completo`,
    [id]
  );

  if (result.rowCount === 0) {
    throw { status: 404, message: 'Usuario no encontrado' };
  }

  return result.rows[0];
};

module.exports = {
  listar,
  obtenerPorId,
  crear,
  editar,
  cambiarRol,
  resetearPassword,
  cambiarEstado,
  desbloquear,
};
