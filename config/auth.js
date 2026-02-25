// config/auth.js
// Configuración centralizada de autenticación

module.exports = {
  jwt: {
    secret:         process.env.JWT_SECRET          || 'fallback_secret_inseguro',
    expiresIn:      process.env.JWT_EXPIRES_IN       || '8h',
    refreshSecret:  process.env.JWT_REFRESH_SECRET   || 'fallback_refresh_inseguro',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  bcrypt: {
    rounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
  },

  security: {
    maxLoginAttempts:    parseInt(process.env.MAX_LOGIN_ATTEMPTS)    || 3,
    lockoutTimeMinutes:  parseInt(process.env.LOCKOUT_TIME_MINUTES)  || 15,
  },

  rateLimit: {
    windowMs:    parseInt(process.env.RATE_LIMIT_WINDOW_MS)      || 15 * 60 * 1000,
    max:         parseInt(process.env.RATE_LIMIT_MAX_REQUESTS)   || 100,
    loginMax:    parseInt(process.env.LOGIN_RATE_LIMIT_MAX)      || 5,
  },
};
