// routes/archivos.routes.js

const express = require('express');
const multer  = require('multer');
const router  = express.Router();

const ctrl = require('../controllers/archivos.controller');
const { autenticar, requireAreaOficio } = require('../middlewares/auth.middleware');

// Multer en memoria (los archivos se guardan en disco desde el service)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.split('.').pop().toLowerCase();
    const permitidas = ['pdf', 'doc', 'docx'];
    if (!permitidas.includes(ext)) {
      return cb(new Error(`Extensión ".${ext}" no permitida. Solo se aceptan: ${permitidas.join(', ')}`));
    }
    cb(null, true);
  },
});

router.use(autenticar);

// GET  /api/archivos/oficio/:id   → Listar archivos de un oficio
router.get('/oficio/:id', requireAreaOficio, ctrl.listar);

// POST /api/archivos/oficio/:id   → Subir archivo a un oficio
router.post('/oficio/:id', requireAreaOficio, upload.single('file'), ctrl.subir);

// GET  /api/archivos/:id/download → Descargar archivo por ID
// (requireAreaOficio se aplica via oficioId que retorna el service)
router.get('/:id/download', ctrl.descargar);

// Manejo de error de multer (tamaño o tipo)
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next(err);
});

module.exports = router;
