// db/migrate.js — VERSIÓN FINAL (todas las tablas)

require('dotenv').config();
const { pool } = require('./pool');

const migrations = [

  // ─── ÁREAS ────────────────────────────────────────────────────────────────
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

  // ─── USUARIOS ─────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS usuarios (
    id                SERIAL PRIMARY KEY,
    username          VARCHAR(50)  UNIQUE NOT NULL,
    password_hash     VARCHAR(255) NOT NULL,
    nombre_completo   VARCHAR(255) NOT NULL,
    email             VARCHAR(255) UNIQUE NOT NULL,
    rol               VARCHAR(20)  NOT NULL CHECK (rol IN ('admin','usuario')),
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
  `CREATE INDEX IF NOT EXISTS idx_usuarios_area     ON usuarios(area_id)`,

  // ─── REFRESH TOKENS ───────────────────────────────────────────────────────
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
  `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash    ON refresh_tokens(token_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_usuario ON refresh_tokens(usuario_id)`,

  // ─── PROYECTOS ────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS proyectos (
    id             SERIAL PRIMARY KEY,
    nombre         VARCHAR(255) NOT NULL,
    descripcion    TEXT,
    area_id        INT NOT NULL REFERENCES areas(id),
    creado_por     INT NOT NULL REFERENCES usuarios(id),
    fecha_inicio   DATE,
    fecha_fin      DATE,
    estado         VARCHAR(20) DEFAULT 'Activo' CHECK (estado IN ('Activo','Finalizado','Cancelado')),
    activo         BOOLEAN DEFAULT true,
    fecha_creacion TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_proyectos_area   ON proyectos(area_id)`,
  `CREATE INDEX IF NOT EXISTS idx_proyectos_estado ON proyectos(estado)`,

  // ─── CONFIGURACIÓN DE SEMÁFOROS ───────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS configuracion_semaforo (
    id            SERIAL PRIMARY KEY,
    prioridad     VARCHAR(20) UNIQUE NOT NULL,
    dias_verde    INT NOT NULL,
    dias_amarillo INT NOT NULL,
    dias_rojo     INT NOT NULL,
    activo        BOOLEAN DEFAULT true
  )`,
  `INSERT INTO configuracion_semaforo (prioridad, dias_verde, dias_amarillo, dias_rojo)
   VALUES
     ('urgente',     2,  3,  5),
     ('normal',      5, 10, 15),
     ('informativo', 10, 20, 30)
   ON CONFLICT (prioridad) DO NOTHING`,

  // ─── OFICIOS ──────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS oficios (
    id               SERIAL PRIMARY KEY,
    numero_oficio    VARCHAR(100) UNIQUE NOT NULL,
    tipo_proceso     VARCHAR(50) NOT NULL
      CHECK (tipo_proceso IN ('recibido_externo','iniciado_interno','informativo')),
    prioridad        VARCHAR(20) NOT NULL
      CHECK (prioridad IN ('urgente','normal','informativo')),
    estado           VARCHAR(50) NOT NULL DEFAULT 'recibido'
      CHECK (estado IN ('recibido','asignado','en_proceso','respondido',
                        'en_espera_acuse','finalizado','cancelado')),
    proyecto_id          INT REFERENCES proyectos(id),
    area_asignada_id     INT NOT NULL REFERENCES areas(id),
    promovente           VARCHAR(500),
    destinatario         VARCHAR(500),
    asunto               TEXT NOT NULL,
    instruccion          TEXT,
    observaciones        TEXT,
    fecha_recepcion      TIMESTAMPTZ NOT NULL,
    fecha_asignacion     TIMESTAMPTZ,
    fecha_respuesta      TIMESTAMPTZ,
    fecha_acuse          TIMESTAMPTZ,
    fecha_finalizacion   TIMESTAMPTZ,
    motivo_finalizacion_manual TEXT,
    version_concurrencia INT NOT NULL DEFAULT 0,
    creado_por           INT NOT NULL REFERENCES usuarios(id),
    modificado_por       INT REFERENCES usuarios(id),
    fecha_creacion       TIMESTAMPTZ DEFAULT NOW(),
    fecha_modificacion   TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_oficios_estado     ON oficios(estado)`,
  `CREATE INDEX IF NOT EXISTS idx_oficios_area_estado ON oficios(area_asignada_id, estado)`,
  `CREATE INDEX IF NOT EXISTS idx_oficios_numero      ON oficios(numero_oficio)`,
  `CREATE INDEX IF NOT EXISTS idx_oficios_fecha       ON oficios(fecha_recepcion)`,

  // ─── ARCHIVOS DE OFICIO ───────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS archivos_oficio (
    id               SERIAL PRIMARY KEY,
    oficio_id        INT NOT NULL REFERENCES oficios(id),
    tipo_archivo     VARCHAR(20) NOT NULL CHECK (tipo_archivo IN ('pdf','word','anexo')),
    categoria        VARCHAR(50) NOT NULL
      CHECK (categoria IN ('oficio_recibido','oficio_respuesta_word',
                           'oficio_respuesta_pdf','acuse','anexo')),
    nombre_archivo   VARCHAR(255) NOT NULL,
    nombre_original  VARCHAR(255) NOT NULL,
    ruta_archivo     VARCHAR(500) NOT NULL,
    tamano_bytes     BIGINT NOT NULL,
    hash_sha256      VARCHAR(64),
    version          INT DEFAULT 1,
    es_version_activa BOOLEAN DEFAULT true,
    subido_por       INT NOT NULL REFERENCES usuarios(id),
    fecha_subida     TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_archivos_oficio   ON archivos_oficio(oficio_id)`,
  `CREATE INDEX IF NOT EXISTS idx_archivos_categoria ON archivos_oficio(oficio_id, categoria)`,

  // ─── HISTORIAL DE ESTADOS ─────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS historial_estado (
    id               SERIAL PRIMARY KEY,
    oficio_id        INT NOT NULL REFERENCES oficios(id),
    estado_anterior  VARCHAR(50) NOT NULL,
    estado_nuevo     VARCHAR(50) NOT NULL,
    usuario_id       INT NOT NULL REFERENCES usuarios(id),
    motivo           TEXT,
    fecha_cambio     TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_historial_oficio ON historial_estado(oficio_id)`,
  `CREATE INDEX IF NOT EXISTS idx_historial_fecha  ON historial_estado(fecha_cambio)`,

  // ─── SEMÁFORO DE TIEMPO ───────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS semaforo_tiempo (
    id                   SERIAL PRIMARY KEY,
    oficio_id            INT UNIQUE NOT NULL REFERENCES oficios(id),
    estado_semaforo      VARCHAR(20) NOT NULL CHECK (estado_semaforo IN ('verde','amarillo','rojo')),
    dias_transcurridos   INT NOT NULL DEFAULT 0,
    dias_limite_amarillo INT NOT NULL DEFAULT 5,
    dias_limite_rojo     INT NOT NULL DEFAULT 10,
    fecha_alerta_enviada TIMESTAMPTZ,
    alertas_enviadas     INT DEFAULT 0,
    fecha_calculo        TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_semaforo_estado ON semaforo_tiempo(estado_semaforo)`,

  // ─── LOGS DE SISTEMA ──────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS logs_sistema (
    id         SERIAL PRIMARY KEY,
    usuario_id INT REFERENCES usuarios(id),
    accion     VARCHAR(100) NOT NULL,
    entidad    VARCHAR(50),
    entidad_id VARCHAR(100),
    detalles   TEXT,
    ip_address VARCHAR(50),
    user_agent TEXT,
    fecha      TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_logs_usuario ON logs_sistema(usuario_id)`,
  `CREATE INDEX IF NOT EXISTS idx_logs_fecha   ON logs_sistema(fecha DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_logs_accion  ON logs_sistema(accion)`,

  // ─── USUARIO ADMIN POR DEFECTO ────────────────────────────────────────────
  // Password: Admin1234! — CAMBIAR EN PRODUCCIÓN
  `INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol)
   VALUES (
     'admin',
     '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/DUkgVB2',
     'Administrador del Sistema',
     'admin@sistema.gob.mx',
     'admin'
   ) ON CONFLICT (username) DO NOTHING`,
];

async function runMigrations() {
  console.log('\n🔄 Iniciando migraciones...\n');
  for (let i = 0; i < migrations.length; i++) {
    try {
      await pool.query(migrations[i]);
      const preview = migrations[i].trim().substring(0, 55).replace(/\s+/g, ' ');
      console.log(`  ✅ [${String(i + 1).padStart(2,'0')}/${migrations.length}] ${preview}...`);
    } catch (err) {
      console.error(`  ❌ [${i + 1}/${migrations.length}] Error:`, err.message);
      process.exit(1);
    }
  }
  console.log('\n✅ Todas las migraciones completadas');
  console.log('👤 Admin: usuario=admin | password=Admin1234! (cambiar en producción)\n');
  await pool.end();
}

runMigrations();
