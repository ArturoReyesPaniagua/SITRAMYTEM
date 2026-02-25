// server.js — actualizado con Fase 3 (Proyectos + Oficios)

require('dotenv').config();

const express      = require('express');
const cors         = require('cors');
const rateLimit    = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const authRoutes      = require('./routes/auth.routes');
const areasRoutes     = require('./routes/areas.routes');
const usuariosRoutes  = require('./routes/usuarios.routes');
const proyectosRoutes = require('./routes/proyectos.routes');  // ← NUEVO
const oficiosRoutes   = require('./routes/oficios.routes');    // ← NUEVO

const { rateLimit: rateLimitConfig } = require('./config/auth');
const { limpiarTokensExpirados }     = require('./utils/jwt');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Middlewares globales ─────────────────────────────────────────────────────

app.use(cors({
  origin:         process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials:    true,
  methods:        ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.disable('x-powered-by');

app.use(rateLimit({
  windowMs:        rateLimitConfig.windowMs,
  max:             rateLimitConfig.max,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { success: false, message: 'Demasiadas peticiones. Intente más tarde' },
}));

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'API en línea', timestamp: new Date().toISOString() });
});

// ─── Rutas ────────────────────────────────────────────────────────────────────

app.use('/api/auth',      authRoutes);
app.use('/api/areas',     areasRoutes);
app.use('/api/usuarios',  usuariosRoutes);
app.use('/api/proyectos', proyectosRoutes);   // ← NUEVO
app.use('/api/oficios',   oficiosRoutes);     // ← NUEVO

// Próximas fases:
// app.use('/api/archivos',  archivosRoutes);
// app.use('/api/semaforos', semaforosRoutes);
// app.use('/api/dashboard', dashboardRoutes);

// ─── Error handlers ───────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Ruta ${req.method} ${req.path} no encontrada` });
});

app.use((err, req, res, next) => {
  console.error('❌ Error no manejado:', err);
  res.status(500).json({ success: false, message: 'Error interno del servidor' });
});

// ─── Limpieza de tokens (cada 24h) ───────────────────────────────────────────

setInterval(async () => {
  try {
    const eliminados = await limpiarTokensExpirados();
    if (eliminados > 0) console.log(`🧹 ${eliminados} refresh tokens eliminados`);
  } catch (err) {
    console.error('⚠️  Error en limpieza:', err.message);
  }
}, 24 * 60 * 60 * 1000);

// ─── Arranque ─────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log('\n================================');
  console.log(`🚀 Servidor en puerto ${PORT}`);
  console.log(`📋 Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log('================================\n');
});

module.exports = app;
