// utils/multer.config.js
// Configuración de Multer para subida segura de archivos

const multer = require('multer');
const path   = require('path');
const { BASE_DIR, MAX_SIZE_BYTES } = require('./archivos.util');

// Almacenamiento temporal antes de mover al destino final
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(BASE_DIR, 'temp'));
  },
  filename: (req, file, cb) => {
    // Nombre temporal con timestamp único
    cb(null, `tmp_${Date.now()}_${Math.random().toString(36).substring(7)}${path.extname(file.originalname)}`);
  },
});

// Filtro de archivos
const fileFilter = (req, file, cb) => {
  const mimesPermitidos = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ];

  if (mimesPermitidos.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize:  MAX_SIZE_BYTES,
    files:     5,       // máximo 5 archivos por request
    fieldSize: 1024,    // 1KB para campos de texto
  },
});

module.exports = upload;
