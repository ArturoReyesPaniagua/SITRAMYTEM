// server.js

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const path       = require('path');

const { limpiarTokensExpirados } = require('./services/auth.service');
const { recalcularTodos }        = require('./services/semaforos.service');

const authRoutes      = require('./routes/auth.routes');
const areasRoutes     = require('./routes/areas.routes');
const usuariosRoutes  = require('./routes/usuarios.routes');
const proyectosRoutes = require('./routes/proyectos.routes');
const oficiosRoutes   = require('./routes/oficios.routes');
const archivosRoutes  = require('./routes/archivos.routes');
const semaforosRoutes = require('./routes/semaforos.routes');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Middlewares globales ─────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Servir archivos subidos estáticamente (solo en dev — en producción usar nginx/cloud)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rate limit general
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { success: false, message: 'Demasiadas solicitudes. Intente más tarde' },
}));

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'API en línea', timestamp: new Date().toISOString() });
});

// ─── Rutas ────────────────────────────────────────────────────────────────────

app.use('/api/auth',      authRoutes);
app.use('/api/areas',     areasRoutes);
app.use('/api/usuarios',  usuariosRoutes);
app.use('/api/proyectos', proyectosRoutes);
app.use('/api/oficios',   oficiosRoutes);
app.use('/api/archivos',  archivosRoutes);
app.use('/api/semaforos', semaforosRoutes);

// ─── Error handlers ───────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Ruta ${req.method} ${req.path} no encontrada` });
});

app.use((err, req, res, next) => {
  console.error('❌ Error no manejado:', err);
  res.status(500).json({ success: false, message: 'Error interno del servidor' });
});

// ─── Tareas programadas (reemplazan los SQL Server Agent Jobs) ────────────────

// Recalcular semáforos cada hora
setInterval(async () => {
  try {
    await recalcularTodos();
    console.log(`🚦 [${new Date().toISOString()}] Semáforos recalculados`);
  } catch (err) {
    console.error('⚠️  Error recalculando semáforos:', err.message);
  }
}, 60 * 60 * 1000); // cada 1 hora

// Limpiar refresh tokens expirados cada 24h
setInterval(async () => {
  try {
    const eliminados = await limpiarTokensExpirados();
    if (eliminados > 0) console.log(`🧹 ${eliminados} refresh tokens expirados eliminados`);
  } catch (err) {
    console.error('⚠️  Error en limpieza de tokens:', err.message);
  }
}, 24 * 60 * 60 * 1000);

// ─── Arranque ─────────────────────────────────────────────────────────────────

app.listen(PORT, async () => {
  console.log('\n================================');
  console.log(`🚀 Servidor en puerto ${PORT}`);
  console.log(`📋 Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log('================================\n');

  // Recalcular semáforos al arrancar
  try {
    await recalcularTodos();
    console.log('🚦 Semáforos inicializados al arrancar');
  } catch (err) {
    console.warn('⚠️  No se pudieron inicializar semáforos:', err.message);
  }
});

module.exports = app;
