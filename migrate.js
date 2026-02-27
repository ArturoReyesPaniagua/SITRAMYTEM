// db/migrate.js
// Crea todas las tablas necesarias para el sistema (PostgreSQL)

require('dotenv').config();
const { pool } = require('./pool');

const migrations = [

  // ─── ÁREAS ───────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS areas (
    id             SERIAL PRIMARY KEY,
    nombre         VARCHAR(255) UNIQUE NOT NULL,
    descripcion    TEXT,
    responsable    VARCHAR(255),
    email_area     VARCHAR(255),
    activo         BOOLEAN DEFAULT true,
    fecha_creacion TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_areas_activo ON areas(activo)`,

  // ─── USUARIOS ────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS usuarios (
    id                SERIAL PRIMARY KEY,
    username          VARCHAR(50)  UNIQUE NOT NULL,
    password_hash     VARCHAR(255) NOT NULL,
    nombre_completo   VARCHAR(255) NOT NULL,
    email             VARCHAR(255) UNIQUE NOT NULL,
    rol               VARCHAR(20)  NOT NULL CHECK (rol IN ('admin', 'usuario')),
    area_id           INT REFERENCES areas(id),
    activo            BOOLEAN  DEFAULT true,
    intentos_fallidos INT      DEFAULT 0,
    bloqueado_hasta   TIMESTAMPTZ,
    ultimo_acceso     TIMESTAMPTZ,
    fecha_creacion    TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_usuario_area CHECK (
      (rol = 'admin'   AND area_id IS NULL) OR
      (rol = 'usuario' AND area_id IS NOT NULL)
    )
  )`,
  `CREATE INDEX IF NOT EXISTS idx_usuarios_username ON usuarios(username)`,
  `CREATE INDEX IF NOT EXISTS idx_usuarios_rol      ON usuarios(rol)`,
  `CREATE INDEX IF NOT EXISTS idx_usuarios_area     ON usuarios(area_id)`,

  // ─── REFRESH TOKENS ──────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS refresh_tokens (
    id             SERIAL PRIMARY KEY,
    usuario_id     INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token_hash     VARCHAR(255) UNIQUE NOT NULL,
    ip_address     VARCHAR(50),
    user_agent     TEXT,
    expira_en      TIMESTAMPTZ NOT NULL,
    revocado       BOOLEAN DEFAULT false,
    fecha_creacion TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_usuario ON refresh_tokens(usuario_id)`,
  `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash    ON refresh_tokens(token_hash)`,

  // ─── PROYECTOS ───────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS proyectos (
    id             SERIAL PRIMARY KEY,
    nombre         VARCHAR(255) NOT NULL,
    descripcion    TEXT,
    area_id        INT NOT NULL REFERENCES areas(id),
    estado         VARCHAR(20) NOT NULL DEFAULT 'Activo'
                   CHECK (estado IN ('Activo', 'Finalizado', 'Cancelado')),
    creado_por     INT REFERENCES usuarios(id),
    fecha_creacion TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_proyectos_area   ON proyectos(area_id)`,
  `CREATE INDEX IF NOT EXISTS idx_proyectos_estado ON proyectos(estado)`,

  // ─── OFICIOS ─────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS oficios (
    id                SERIAL PRIMARY KEY,
    numero_oficio     VARCHAR(100) NOT NULL,
    tipo_proceso      VARCHAR(30) NOT NULL
                      CHECK (tipo_proceso IN ('recibido_externo', 'iniciado_interno', 'informativo')),
    prioridad         VARCHAR(20) NOT NULL
                      CHECK (prioridad IN ('urgente', 'normal', 'informativo')),
    estado            VARCHAR(30) NOT NULL
                      CHECK (estado IN ('recibido','asignado','en_proceso','respondido','en_espera_acuse','finalizado','cancelado')),
    area_asignada_id  INT NOT NULL REFERENCES areas(id),
    proyecto_id       INT REFERENCES proyectos(id),
    promovente        VARCHAR(255),
    destinatario      VARCHAR(255),
    asunto            TEXT NOT NULL,
    observaciones     TEXT,
    fecha_recepcion   DATE NOT NULL,
    fecha_asignacion  TIMESTAMPTZ,
    fecha_respuesta   TIMESTAMPTZ,
    fecha_finalizacion TIMESTAMPTZ,
    creado_por        INT REFERENCES usuarios(id),
    modificado_por    INT REFERENCES usuarios(id),
    fecha_modificacion TIMESTAMPTZ,
    fecha_creacion    TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_oficios_estado        ON oficios(estado)`,
  `CREATE INDEX IF NOT EXISTS idx_oficios_area          ON oficios(area_asignada_id)`,
  `CREATE INDEX IF NOT EXISTS idx_oficios_tipo          ON oficios(tipo_proceso)`,
  `CREATE INDEX IF NOT EXISTS idx_oficios_prioridad     ON oficios(prioridad)`,
  `CREATE INDEX IF NOT EXISTS idx_oficios_fecha         ON oficios(fecha_recepcion)`,
  `CREATE INDEX IF NOT EXISTS idx_oficios_proyecto      ON oficios(proyecto_id)`,
  `CREATE INDEX IF NOT EXISTS idx_oficios_estado_fecha  ON oficios(estado, fecha_recepcion)`,

  // ─── HISTORIAL DE ESTADO ─────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS historial_estado (
    id              SERIAL PRIMARY KEY,
    oficio_id       INT NOT NULL REFERENCES oficios(id),
    estado_anterior VARCHAR(30) NOT NULL,
    estado_nuevo    VARCHAR(30) NOT NULL,
    usuario_id      INT REFERENCES usuarios(id),
    motivo          TEXT,
    fecha_cambio    TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_historial_oficio ON historial_estado(oficio_id)`,
  `CREATE INDEX IF NOT EXISTS idx_historial_fecha  ON historial_estado(fecha_cambio)`,

  // ─── ARCHIVOS DE OFICIO ──────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS archivos_oficio (
    id                SERIAL PRIMARY KEY,
    oficio_id         INT NOT NULL REFERENCES oficios(id),
    tipo_archivo      VARCHAR(10) NOT NULL CHECK (tipo_archivo IN ('pdf', 'word', 'anexo')),
    categoria         VARCHAR(30) NOT NULL
                      CHECK (categoria IN (
                        'oficio_recibido',
                        'oficio_respuesta_word',
                        'oficio_respuesta_pdf',
                        'anexo',
                        'acuse'
                      )),
    nombre_archivo    VARCHAR(255) NOT NULL,
    ruta_archivo      VARCHAR(500) NOT NULL,
    tamano_bytes      BIGINT NOT NULL,
    version           INT DEFAULT 1,
    es_version_activa BOOLEAN DEFAULT true,
    subido_por        INT REFERENCES usuarios(id),
    fecha_subida      TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_archivos_oficio    ON archivos_oficio(oficio_id)`,
  `CREATE INDEX IF NOT EXISTS idx_archivos_categoria ON archivos_oficio(categoria)`,
  `CREATE INDEX IF NOT EXISTS idx_archivos_activo    ON archivos_oficio(es_version_activa)`,

  // ─── SEMÁFORO DE TIEMPO ──────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS semaforo_tiempo (
    id                   SERIAL PRIMARY KEY,
    oficio_id            INT UNIQUE NOT NULL REFERENCES oficios(id),
    estado_semaforo      VARCHAR(10) NOT NULL DEFAULT 'verde'
                         CHECK (estado_semaforo IN ('verde', 'amarillo', 'rojo')),
    dias_transcurridos   INT NOT NULL DEFAULT 0,
    dias_limite_amarillo INT NOT NULL DEFAULT 5,
    dias_limite_rojo     INT NOT NULL DEFAULT 15,
    alertas_enviadas     INT DEFAULT 0,
    fecha_alerta_enviada TIMESTAMPTZ,
    fecha_calculo        TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_semaforo_estado  ON semaforo_tiempo(estado_semaforo)`,
  `CREATE INDEX IF NOT EXISTS idx_semaforo_oficio  ON semaforo_tiempo(oficio_id)`,

  // ─── CONFIGURACIÓN DE SEMÁFORO ───────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS configuracion_semaforo (
    id        SERIAL PRIMARY KEY,
    prioridad VARCHAR(20) UNIQUE NOT NULL,
    dias_verde INT NOT NULL,   -- Umbral para pasar a amarillo
    dias_rojo  INT NOT NULL,   -- Umbral para pasar a rojo
    activo    BOOLEAN DEFAULT true
  )`,

  // Valores por defecto (idempotente)
  `INSERT INTO configuracion_semaforo (prioridad, dias_verde, dias_rojo)
   VALUES
     ('urgente',    2,  5),
     ('normal',     5, 15),
     ('informativo',10, 30)
   ON CONFLICT (prioridad) DO NOTHING`,

  // ─── LOGS DE SISTEMA ─────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS logs_sistema (
    id         SERIAL PRIMARY KEY,
    usuario_id INT REFERENCES usuarios(id),
    accion     VARCHAR(100) NOT NULL,
    entidad    VARCHAR(50),
    entidad_id INT,
    detalles   TEXT,
    ip_address VARCHAR(50),
    user_agent TEXT,
    fecha      TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_logs_usuario ON logs_sistema(usuario_id)`,
  `CREATE INDEX IF NOT EXISTS idx_logs_fecha   ON logs_sistema(fecha)`,

  // ─── USUARIO ADMIN POR DEFECTO (password: Admin1234!) ────────────────────
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
      const preview = migrations[i].trim().substring(0, 70).replace(/\s+/g, ' ');
      console.log(`  ✅ [${i + 1}/${migrations.length}] ${preview}...`);
    } catch (err) {
      console.error(`  ❌ [${i + 1}/${migrations.length}] Error:`, err.message);
      process.exit(1);
    }
  }

  console.log('\n✅ Migraciones completadas');
  console.log('👤 Admin → usuario: admin | password: Admin1234!\n');
  await pool.end();
}

runMigrations();
