// db/migrate.js
// Crea todas las tablas necesarias para el sistema

require('dotenv').config();
const { pool } = require('./pool');

const migrations = [
  // ─── ÁREAS ──────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS areas (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(255) UNIQUE NOT NULL,
    descripcion TEXT,
    responsable VARCHAR(255),
    email_area  VARCHAR(255),
    activo      BOOLEAN DEFAULT true,
    fecha_creacion TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_areas_activo ON areas(activo)`,

  // ─── USUARIOS ────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS usuarios (
    id               SERIAL PRIMARY KEY,
    username         VARCHAR(50)  UNIQUE NOT NULL,
    password_hash    VARCHAR(255) NOT NULL,
    nombre_completo  VARCHAR(255) NOT NULL,
    email            VARCHAR(255) UNIQUE NOT NULL,
    rol              VARCHAR(20)  NOT NULL CHECK (rol IN ('admin', 'usuario')),
    area_id          INT REFERENCES areas(id),
    activo           BOOLEAN  DEFAULT true,
    intentos_fallidos INT     DEFAULT 0,
    bloqueado_hasta  TIMESTAMPTZ,
    ultimo_acceso    TIMESTAMPTZ,
    fecha_creacion   TIMESTAMPTZ DEFAULT NOW(),

    -- Admin no tiene área, usuario sí debe tener
    CONSTRAINT chk_usuario_area CHECK (
      (rol = 'admin'   AND area_id IS NULL) OR
      (rol = 'usuario' AND area_id IS NOT NULL)
    )
  )`,

  `CREATE INDEX IF NOT EXISTS idx_usuarios_username ON usuarios(username)`,
  `CREATE INDEX IF NOT EXISTS idx_usuarios_rol      ON usuarios(rol)`,
  `CREATE INDEX IF NOT EXISTS idx_usuarios_area     ON usuarios(area_id)`,

  // ─── REFRESH TOKENS ──────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          SERIAL PRIMARY KEY,
    usuario_id  INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) UNIQUE NOT NULL,
    ip_address  VARCHAR(50),
    user_agent  TEXT,
    expira_en   TIMESTAMPTZ NOT NULL,
    revocado    BOOLEAN DEFAULT false,
    fecha_creacion TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_usuario ON refresh_tokens(usuario_id)`,
  `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash    ON refresh_tokens(token_hash)`,

  // ─── LOGS DE SISTEMA ──────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS logs_sistema (
    id          SERIAL PRIMARY KEY,
    usuario_id  INT REFERENCES usuarios(id),
    accion      VARCHAR(100) NOT NULL,
    entidad     VARCHAR(50),
    entidad_id  INT,
    detalles    TEXT,
    ip_address  VARCHAR(50),
    user_agent  TEXT,
    fecha       TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_logs_usuario ON logs_sistema(usuario_id)`,
  `CREATE INDEX IF NOT EXISTS idx_logs_fecha   ON logs_sistema(fecha)`,

  // ─── USUARIO ADMIN POR DEFECTO ───────────────────────────────────────
  // Password: Admin1234! (cambiar en producción)
  `INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol)
   VALUES (
     'admin',
     '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/DUkgVB2',
     'Administrador del Sistema',
     'admin@sistema.gob.mx',
     'admin'
   )
   ON CONFLICT (username) DO NOTHING`,
];

async function runMigrations() {
  console.log('🔄 Iniciando migraciones...\n');

  for (let i = 0; i < migrations.length; i++) {
    try {
      await pool.query(migrations[i]);
      const preview = migrations[i].trim().substring(0, 60).replace(/\s+/g, ' ');
      console.log(`  ✅ [${i + 1}/${migrations.length}] ${preview}...`);
    } catch (err) {
      console.error(`  ❌ [${i + 1}/${migrations.length}] Error:`, err.message);
      process.exit(1);
    }
  }

  console.log('\n✅ Migraciones completadas exitosamente');
  console.log('👤 Admin por defecto → usuario: admin | password: Admin1234!\n');
  await pool.end();
}

runMigrations();
