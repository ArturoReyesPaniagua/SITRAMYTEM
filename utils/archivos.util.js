// utils/archivos.util.js
// Manejo de rutas físicas, validación de tipos y limpieza de archivos

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

// ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────

const BASE_DIR     = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');
const MAX_SIZE_MB   = parseInt(process.env.MAX_FILE_SIZE_MB) || 50;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

// Tipos MIME permitidos por categoría
const MIME_PERMITIDOS = {
  oficio_recibido:      ['application/pdf'],
  oficio_respuesta_pdf: ['application/pdf'],
  oficio_respuesta_word:['application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                         'application/msword'],
  acuse:                ['application/pdf'],
  anexo:                ['application/pdf'],
};

// Extensiones permitidas por MIME
const EXTENSIONES = {
  'application/pdf':        '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/msword':     '.doc',
};

// ─── CREAR ESTRUCTURA DE DIRECTORIOS ─────────────────────────────────────────

const crearDirectorioSiNoExiste = (ruta) => {
  if (!fs.existsSync(ruta)) {
    fs.mkdirSync(ruta, { recursive: true });
  }
};

// Inicializar carpetas base al cargar el módulo
const CARPETAS = ['oficios', 'respuestas', 'acuses', 'anexos', 'temp'];
CARPETAS.forEach(c => crearDirectorioSiNoExiste(path.join(BASE_DIR, c)));

// ─── GENERAR RUTA ORGANIZADA ──────────────────────────────────────────────────

/**
 * Genera la ruta física del archivo con estructura:
 * /uploads/{categoria}/{año}/{mes}/{area_id}/
 */
const generarRutaArchivo = (categoria, areaId) => {
  const ahora  = new Date();
  const año    = ahora.getFullYear().toString();
  const mes    = String(ahora.getMonth() + 1).padStart(2, '0');

  const subcarpeta = {
    oficio_recibido:       'oficios',
    oficio_respuesta_pdf:  'respuestas',
    oficio_respuesta_word: 'respuestas',
    acuse:                 'acuses',
    anexo:                 'anexos',
  }[categoria] || 'temp';

  const dir = path.join(BASE_DIR, subcarpeta, año, mes, String(areaId));
  crearDirectorioSiNoExiste(dir);
  return dir;
};

/**
 * Genera nombre de archivo único: {timestamp}_{uuid8}_{nombre_sanitizado}{ext}
 */
const generarNombreArchivo = (nombreOriginal, mimeType) => {
  const ext       = EXTENSIONES[mimeType] || path.extname(nombreOriginal);
  const timestamp = Date.now();
  const uuid8     = crypto.randomBytes(4).toString('hex');
  const nombre    = path.basename(nombreOriginal, path.extname(nombreOriginal))
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .substring(0, 40);

  return `${timestamp}_${uuid8}_${nombre}${ext}`;
};

// ─── VALIDACIÓN ───────────────────────────────────────────────────────────────

const validarArchivo = (archivo, categoria) => {
  const errores = [];

  // Tamaño
  if (archivo.size > MAX_SIZE_BYTES) {
    errores.push(`El archivo excede el tamaño máximo de ${MAX_SIZE_MB}MB`);
  }

  // Tipo MIME
  const mimesPermitidos = MIME_PERMITIDOS[categoria];
  if (!mimesPermitidos) {
    errores.push(`Categoría de archivo no válida: ${categoria}`);
  } else if (!mimesPermitidos.includes(archivo.mimetype)) {
    errores.push(`Tipo de archivo no permitido para "${categoria}". Se permiten: ${mimesPermitidos.join(', ')}`);
  }

  return errores;
};

// ─── CALCULAR HASH SHA-256 ────────────────────────────────────────────────────

const calcularHash = (rutaArchivo) => {
  return new Promise((resolve, reject) => {
    const hash   = crypto.createHash('sha256');
    const stream = fs.createReadStream(rutaArchivo);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end',  ()    => resolve(hash.digest('hex')));
    stream.on('error', err  => reject(err));
  });
};

// ─── MOVER ARCHIVO DESDE TEMP ─────────────────────────────────────────────────

const moverArchivoADestino = (rutaTemp, rutaDestino) => {
  fs.renameSync(rutaTemp, rutaDestino);
};

// ─── ELIMINAR ARCHIVO FÍSICO ──────────────────────────────────────────────────

const eliminarArchivo = (rutaArchivo) => {
  try {
    if (fs.existsSync(rutaArchivo)) {
      fs.unlinkSync(rutaArchivo);
    }
  } catch (err) {
    console.error('⚠️  Error al eliminar archivo físico:', err.message);
  }
};

// ─── VERIFICAR INTEGRIDAD ─────────────────────────────────────────────────────

const verificarIntegridad = async (rutaArchivo, hashEsperado) => {
  try {
    const hashActual = await calcularHash(rutaArchivo);
    return hashActual === hashEsperado;
  } catch {
    return false;
  }
};

module.exports = {
  BASE_DIR,
  MAX_SIZE_BYTES,
  MIME_PERMITIDOS,
  generarRutaArchivo,
  generarNombreArchivo,
  validarArchivo,
  calcularHash,
  moverArchivoADestino,
  eliminarArchivo,
  verificarIntegridad,
};
