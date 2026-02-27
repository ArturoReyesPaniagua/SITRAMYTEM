// services/archivos.service.js

const path  = require('path');
const fs    = require('fs');
const { query, withTransaction } = require('../db/pool');
const { obtenerPorId: obtenerOficio, cambiarEstado } = require('./oficios.service');

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');

/**
 * Reglas de validación por categoría de archivo.
 *
 * categorias permitidas:
 *   oficio_recibido        → solo PDF  (tipo: recibido_externo)
 *   oficio_respuesta_word  → solo DOCX/DOC (tipo: externo o interno)
 *   oficio_respuesta_pdf   → solo PDF  (tipo: externo o interno)
 *   anexo                  → PDF      (cualquier tipo)
 *   acuse                  → solo PDF  → dispara auto-finalización
 *
 * Para un oficio de tipo informativo no se aceptan categorías de respuesta.
 */
const REGLAS_CATEGORIA = {
  oficio_recibido:       { tiposPermitidos: ['pdf'],       tiposProceso: ['recibido_externo'] },
  oficio_respuesta_word: { tiposPermitidos: ['doc', 'docx'], tiposProceso: ['recibido_externo', 'iniciado_interno'] },
  oficio_respuesta_pdf:  { tiposPermitidos: ['pdf'],       tiposProceso: ['recibido_externo', 'iniciado_interno'] },
  anexo:                 { tiposPermitidos: ['pdf'],       tiposProceso: ['recibido_externo', 'iniciado_interno', 'informativo'] },
  acuse:                 { tiposPermitidos: ['pdf'],       tiposProceso: ['recibido_externo', 'iniciado_interno'] },
};

// Extensiones → tipo_archivo canónico para guardar en BD
const EXT_A_TIPO = {
  pdf:  'pdf',
  doc:  'word',
  docx: 'word',
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const _ensureUploadsDir = () => {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
};

const _extDeArchivo = (nombreArchivo) =>
  path.extname(nombreArchivo).replace('.', '').toLowerCase();

/**
 * Valida que la categoría sea válida para el tipo de proceso del oficio
 * y que la extensión del archivo sea la permitida.
 */
const _validarCategoria = (categoria, tipoProceso, ext) => {
  const regla = REGLAS_CATEGORIA[categoria];
  if (!regla) {
    throw { status: 400, message: `Categoría inválida: ${categoria}` };
  }
  if (!regla.tiposProceso.includes(tipoProceso)) {
    throw {
      status: 400,
      message: `La categoría "${categoria}" no está permitida para oficios de tipo "${tipoProceso}"`,
    };
  }
  if (!regla.tiposPermitidos.includes(ext)) {
    throw {
      status: 400,
      message: `Extensión ".${ext}" no permitida para la categoría "${categoria}". Permitidas: ${regla.tiposPermitidos.join(', ')}`,
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// LISTAR ARCHIVOS DE UN OFICIO
// ─────────────────────────────────────────────────────────────────────────────

const listarPorOficio = async (oficioId) => {
  // Verificar que el oficio existe (lanza 404 si no)
  await obtenerOficio(oficioId);

  const result = await query(
    `SELECT
       a.id, a.tipo_archivo, a.categoria, a.nombre_archivo,
       a.tamano_bytes, a.version, a.es_version_activa,
       a.fecha_subida,
       u.nombre_completo AS subido_por_nombre
     FROM archivos_oficio a
     LEFT JOIN usuarios u ON a.subido_por = u.id
     WHERE a.oficio_id = $1
     ORDER BY a.categoria, a.version DESC`,
    [oficioId]
  );

  return result.rows;
};

// ─────────────────────────────────────────────────────────────────────────────
// SUBIR ARCHIVO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {number} oficioId
 * @param {string} categoria  - clave de REGLAS_CATEGORIA
 * @param {object} file       - objeto de multer { originalname, buffer, size }
 * @param {number} usuarioId
 */
const subirArchivo = async (oficioId, categoria, file, usuarioId) => {
  _ensureUploadsDir();

  const oficio = await obtenerOficio(oficioId);

  // No se pueden subir archivos a oficios terminales
  if (['finalizado', 'cancelado'].includes(oficio.estado)) {
    throw { status: 409, message: 'No se pueden subir archivos a un oficio en estado terminal' };
  }

  const ext        = _extDeArchivo(file.originalname);
  const tipoArchivo = EXT_A_TIPO[ext];
  if (!tipoArchivo) {
    throw { status: 400, message: `Extensión ".${ext}" no soportada por el sistema` };
  }

  // Validar reglas de categoría
  _validarCategoria(categoria, oficio.tipo_proceso, ext);

  // Calcular versión (versionar si ya existe un archivo activo de la misma categoría)
  const versionActualResult = await query(
    `SELECT COALESCE(MAX(version), 0) AS max_version
     FROM archivos_oficio
     WHERE oficio_id = $1 AND categoria = $2`,
    [oficioId, categoria]
  );
  const nuevaVersion = parseInt(versionActualResult.rows[0].max_version) + 1;

  // Nombre único en disco
  const nombreEnDisco = `${oficioId}_${categoria}_v${nuevaVersion}_${Date.now()}${path.extname(file.originalname)}`;
  const rutaCompleta  = path.join(UPLOADS_DIR, nombreEnDisco);

  const archivoRegistrado = await withTransaction(async (client) => {
    // Marcar versiones anteriores de la misma categoría como inactivas
    await client.query(
      `UPDATE archivos_oficio
       SET es_version_activa = false
       WHERE oficio_id = $1 AND categoria = $2`,
      [oficioId, categoria]
    );

    // Guardar archivo en disco
    fs.writeFileSync(rutaCompleta, file.buffer);

    // Registrar en BD
    const result = await client.query(
      `INSERT INTO archivos_oficio
         (oficio_id, tipo_archivo, categoria, nombre_archivo, ruta_archivo,
          tamano_bytes, version, es_version_activa, subido_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
       RETURNING *`,
      [
        oficioId, tipoArchivo, categoria,
        file.originalname, nombreEnDisco,
        file.size, nuevaVersion, usuarioId,
      ]
    );

    return result.rows[0];
  });

  // ── Auto-finalización al subir acuse ────────────────────────────────────────
  if (categoria === 'acuse') {
    // Solo si el oficio está en en_espera_acuse (puede estar en otro estado si se versionó)
    if (oficio.estado === 'en_espera_acuse') {
      await cambiarEstado(
        oficioId,
        'finalizado',
        usuarioId,
        'Acuse recibido — finalización automática'
      );
    }
  }

  return archivoRegistrado;
};

// ─────────────────────────────────────────────────────────────────────────────
// DESCARGAR ARCHIVO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retorna la ruta absoluta del archivo para enviarlo al cliente.
 * La validación de permisos sobre el oficio se hace en el middleware requireAreaOficio.
 */
const obtenerRutaDescarga = async (archivoId) => {
  const result = await query(
    `SELECT a.ruta_archivo, a.nombre_archivo, a.oficio_id
     FROM archivos_oficio a
     WHERE a.id = $1`,
    [archivoId]
  );

  if (result.rowCount === 0) {
    throw { status: 404, message: 'Archivo no encontrado' };
  }

  const { ruta_archivo, nombre_archivo } = result.rows[0];
  const rutaAbsoluta = path.join(UPLOADS_DIR, ruta_archivo);

  if (!fs.existsSync(rutaAbsoluta)) {
    throw { status: 404, message: 'El archivo físico no está disponible en el servidor' };
  }

  return { rutaAbsoluta, nombreOriginal: nombre_archivo, oficioId: result.rows[0].oficio_id };
};

module.exports = { listarPorOficio, subirArchivo, obtenerRutaDescarga };
