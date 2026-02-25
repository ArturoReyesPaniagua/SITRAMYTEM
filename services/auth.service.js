// services/auth.service.js
// Lógica de negocio de autenticación (separada del controlador)

const bcrypt = require('bcrypt');
const { query, withTransaction } = require('../db/pool');
const {
  generarAccessToken,
  generarRefreshToken,
  verificarRefreshToken,
  revocarRefreshToken,
  revocarTodosLosTokens,
} = require('../utils/jwt');
const { security } = require('../config/auth');

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────────────────────

const login = async ({ username, password, ipAddress, userAgent }) => {
  // 1. Buscar usuario
  const result = await query(
    `SELECT u.*, a.nombre as area_nombre
     FROM usuarios u
     LEFT JOIN areas a ON u.area_id = a.id
     WHERE u.username = $1`,
    [username]
  );

  if (result.rowCount === 0) {
    // No revelar si el usuario existe o no (seguridad)
    throw { status: 401, message: 'Credenciales inválidas' };
  }

  const usuario = result.rows[0];

  // 2. Verificar si está activo
  if (!usuario.activo) {
    throw { status: 401, message: 'Cuenta desactivada. Contacte al administrador' };
  }

  // 3. Verificar si está bloqueado por intentos fallidos
  if (usuario.bloqueado_hasta && new Date() < new Date(usuario.bloqueado_hasta)) {
    const minutosRestantes = Math.ceil(
      (new Date(usuario.bloqueado_hasta) - new Date()) / 60000
    );
    throw {
      status: 429,
      message: `Cuenta bloqueada. Intente de nuevo en ${minutosRestantes} minuto(s)`,
    };
  }

  // 4. Verificar contraseña
  const passwordValido = await bcrypt.compare(password, usuario.password_hash);

  if (!passwordValido) {
    await _registrarIntentoFallido(usuario.id);
    throw { status: 401, message: 'Credenciales inválidas' };
  }

  // 5. Login exitoso: resetear intentos y registrar acceso
  await _registrarLoginExitoso(usuario.id);

  // 6. Generar tokens
  const accessToken  = generarAccessToken(usuario);
  const refreshToken = await generarRefreshToken(usuario.id, ipAddress, userAgent);

  // 7. Registrar en logs
  await _registrarLog(usuario.id, 'LOGIN', 'usuarios', usuario.id, 'Inicio de sesión exitoso', ipAddress, userAgent);

  return {
    accessToken,
    refreshToken,
    usuario: _formatearUsuario(usuario),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// REFRESH TOKEN
// ─────────────────────────────────────────────────────────────────────────────

const renovarToken = async ({ refreshToken, ipAddress, userAgent }) => {
  const tokenData = await verificarRefreshToken(refreshToken);

  if (!tokenData) {
    throw { status: 401, message: 'Refresh token inválido o expirado' };
  }

  // Revocar el refresh token usado (rotación de tokens)
  await revocarRefreshToken(refreshToken);

  // Generar nuevos tokens
  const usuario = {
    id:              tokenData.usuario_id,
    username:        tokenData.username,
    rol:             tokenData.rol,
    area_id:         tokenData.area_id,
    nombre_completo: tokenData.nombre_completo,
  };

  const nuevoAccessToken  = generarAccessToken(usuario);
  const nuevoRefreshToken = await generarRefreshToken(usuario.id, ipAddress, userAgent);

  return {
    accessToken:  nuevoAccessToken,
    refreshToken: nuevoRefreshToken,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────────────────────────────────────

const logout = async ({ refreshToken, usuarioId, ipAddress, userAgent, todos = false }) => {
  if (todos) {
    await revocarTodosLosTokens(usuarioId);
  } else if (refreshToken) {
    await revocarRefreshToken(refreshToken);
  }

  await _registrarLog(
    usuarioId,
    todos ? 'LOGOUT_TODOS' : 'LOGOUT',
    'usuarios',
    usuarioId,
    todos ? 'Cierre de sesión en todos los dispositivos' : 'Cierre de sesión',
    ipAddress,
    userAgent
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// OBTENER PERFIL ACTUAL
// ─────────────────────────────────────────────────────────────────────────────

const obtenerPerfil = async (usuarioId) => {
  const result = await query(
    `SELECT u.id, u.username, u.nombre_completo, u.email, u.rol,
            u.area_id, u.activo, u.ultimo_acceso, u.fecha_creacion,
            a.nombre as area_nombre, a.email_area
     FROM usuarios u
     LEFT JOIN areas a ON u.area_id = a.id
     WHERE u.id = $1 AND u.activo = true`,
    [usuarioId]
  );

  if (result.rowCount === 0) {
    throw { status: 404, message: 'Usuario no encontrado' };
  }

  return result.rows[0];
};

// ─────────────────────────────────────────────────────────────────────────────
// CAMBIAR CONTRASEÑA
// ─────────────────────────────────────────────────────────────────────────────

const cambiarPassword = async ({ usuarioId, passwordActual, passwordNuevo, ipAddress, userAgent }) => {
  const result = await query(
    `SELECT id, password_hash FROM usuarios WHERE id = $1 AND activo = true`,
    [usuarioId]
  );

  if (result.rowCount === 0) {
    throw { status: 404, message: 'Usuario no encontrado' };
  }

  const usuario = result.rows[0];
  const passwordValido = await bcrypt.compare(passwordActual, usuario.password_hash);

  if (!passwordValido) {
    throw { status: 400, message: 'La contraseña actual es incorrecta' };
  }

  const { bcrypt: bcryptConfig } = require('../config/auth');
  const nuevoHash = await bcrypt.hash(passwordNuevo, bcryptConfig.rounds);

  await withTransaction(async (client) => {
    // Actualizar contraseña
    await client.query(
      `UPDATE usuarios SET password_hash = $1 WHERE id = $2`,
      [nuevoHash, usuarioId]
    );

    // Revocar todos los refresh tokens (forzar re-login en todos los dispositivos)
    await client.query(
      `UPDATE refresh_tokens SET revocado = true WHERE usuario_id = $1`,
      [usuarioId]
    );
  });

  await _registrarLog(usuarioId, 'CAMBIO_PASSWORD', 'usuarios', usuarioId, 'Contraseña cambiada', ipAddress, userAgent);
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS PRIVADOS
// ─────────────────────────────────────────────────────────────────────────────

const _registrarIntentoFallido = async (usuarioId) => {
  const result = await query(
    `UPDATE usuarios
     SET intentos_fallidos = intentos_fallidos + 1
     WHERE id = $1
     RETURNING intentos_fallidos`,
    [usuarioId]
  );

  const intentos = result.rows[0].intentos_fallidos;

  // Bloquear si supera el máximo
  if (intentos >= security.maxLoginAttempts) {
    const bloqueadoHasta = new Date(Date.now() + security.lockoutTimeMinutes * 60 * 1000);
    await query(
      `UPDATE usuarios SET bloqueado_hasta = $1 WHERE id = $2`,
      [bloqueadoHasta, usuarioId]
    );
  }
};

const _registrarLoginExitoso = async (usuarioId) => {
  await query(
    `UPDATE usuarios
     SET intentos_fallidos = 0,
         bloqueado_hasta   = NULL,
         ultimo_acceso     = NOW()
     WHERE id = $1`,
    [usuarioId]
  );
};

const _registrarLog = async (usuarioId, accion, entidad, entidadId, detalles, ip, ua) => {
  try {
    await query(
      `INSERT INTO logs_sistema (usuario_id, accion, entidad, entidad_id, detalles, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [usuarioId, accion, entidad, entidadId, detalles, ip, ua]
    );
  } catch (err) {
    // No fallar la operación principal por un error de log
    console.error('⚠️  Error al registrar log:', err.message);
  }
};

const _formatearUsuario = (usuario) => ({
  id:             usuario.id,
  username:       usuario.username,
  nombre_completo: usuario.nombre_completo,
  email:          usuario.email,
  rol:            usuario.rol,
  area_id:        usuario.area_id,
  area_nombre:    usuario.area_nombre || null,
});

module.exports = {
  login,
  renovarToken,
  logout,
  obtenerPerfil,
  cambiarPassword,
};
