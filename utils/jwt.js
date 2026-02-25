// utils/jwt.js
// Manejo completo de tokens JWT (access + refresh)

const jwt  = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('../db/pool');
const { jwt: jwtConfig } = require('../config/auth');

// ─────────────────────────────────────────────────────────────────────────────
// GENERACIÓN DE TOKENS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera el access token (corta duración, 8h)
 * Incluye rol y área en el payload para filtros de autorización
 */
const generarAccessToken = (usuario) => {
  const payload = {
    userId:   usuario.id,
    username: usuario.username,
    rol:      usuario.rol,
    areaId:   usuario.area_id,  // null si es admin
    nombre:   usuario.nombre_completo,
  };

  return jwt.sign(payload, jwtConfig.secret, {
    expiresIn: jwtConfig.expiresIn,
    issuer: 'sistema-oficios',
    audience: 'sistema-oficios-api',
  });
};

/**
 * Genera el refresh token (larga duración, 7d)
 * Se guarda hasheado en la BD para poder revocarlo
 */
const generarRefreshToken = async (usuarioId, ipAddress, userAgent) => {
  // Token aleatorio criptográficamente seguro
  const rawToken = crypto.randomBytes(64).toString('hex');

  // Guardar hash en BD (no el token en crudo)
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiraEn  = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días

  await query(
    `INSERT INTO refresh_tokens (usuario_id, token_hash, ip_address, user_agent, expira_en)
     VALUES ($1, $2, $3, $4, $5)`,
    [usuarioId, tokenHash, ipAddress, userAgent, expiraEn]
  );

  return rawToken;
};

// ─────────────────────────────────────────────────────────────────────────────
// VERIFICACIÓN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifica y decodifica un access token
 * Lanza error si es inválido o expirado
 */
const verificarAccessToken = (token) => {
  return jwt.verify(token, jwtConfig.secret, {
    issuer:   'sistema-oficios',
    audience: 'sistema-oficios-api',
  });
};

/**
 * Verifica un refresh token contra la BD
 * Retorna el usuario si es válido, null si no
 */
const verificarRefreshToken = async (rawToken) => {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const result = await query(
    `SELECT rt.*, u.id as usuario_id, u.username, u.rol,
            u.area_id, u.activo, u.nombre_completo
     FROM refresh_tokens rt
     INNER JOIN usuarios u ON rt.usuario_id = u.id
     WHERE rt.token_hash = $1
       AND rt.revocado   = false
       AND rt.expira_en  > NOW()`,
    [tokenHash]
  );

  if (result.rowCount === 0) return null;

  const tokenData = result.rows[0];

  // Verificar que el usuario siga activo
  if (!tokenData.activo) return null;

  return tokenData;
};

// ─────────────────────────────────────────────────────────────────────────────
// REVOCACIÓN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Revoca un refresh token específico (logout)
 */
const revocarRefreshToken = async (rawToken) => {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  await query(
    `UPDATE refresh_tokens SET revocado = true WHERE token_hash = $1`,
    [tokenHash]
  );
};

/**
 * Revoca todos los refresh tokens de un usuario (logout de todos los dispositivos)
 */
const revocarTodosLosTokens = async (usuarioId) => {
  await query(
    `UPDATE refresh_tokens SET revocado = true
     WHERE usuario_id = $1 AND revocado = false`,
    [usuarioId]
  );
};

/**
 * Limpieza de tokens expirados (llamar periódicamente)
 */
const limpiarTokensExpirados = async () => {
  const result = await query(
    `DELETE FROM refresh_tokens WHERE expira_en < NOW() OR revocado = true`
  );
  return result.rowCount;
};

module.exports = {
  generarAccessToken,
  generarRefreshToken,
  verificarAccessToken,
  verificarRefreshToken,
  revocarRefreshToken,
  revocarTodosLosTokens,
  limpiarTokensExpirados,
};
