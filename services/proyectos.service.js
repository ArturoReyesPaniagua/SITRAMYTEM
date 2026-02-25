// services/proyectos.service.js

const { query } = require('../db/pool');

// ─────────────────────────────────────────────────────────────────────────────
// LISTAR
// ─────────────────────────────────────────────────────────────────────────────

const listar = async ({ areaId, estado, soloActivos = true } = {}) => {
  const condiciones = [];
  const params = [];
  let idx = 1;

  if (soloActivos) {
    condiciones.push(`p.activo = true`);
  }
  // Usuario solo ve proyectos de su área
  if (areaId) {
    condiciones.push(`p.area_id = $${idx++}`);
    params.push(areaId);
  }
  if (estado) {
    condiciones.push(`p.estado = $${idx++}`);
    params.push(estado);
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  const result = await query(
    `SELECT
       p.id, p.nombre, p.descripcion, p.estado,
       p.fecha_inicio, p.fecha_fin, p.activo, p.fecha_creacion,
       p.area_id, a.nombre AS area_nombre,
       p.creado_por, u.nombre_completo AS creado_por_nombre,
       COUNT(o.id) AS total_oficios,
       COUNT(CASE WHEN o.estado NOT IN ('finalizado','cancelado') THEN 1 END) AS oficios_activos
     FROM proyectos p
     LEFT JOIN areas a        ON p.area_id    = a.id
     LEFT JOIN usuarios u     ON p.creado_por = u.id
     LEFT JOIN oficios o      ON o.proyecto_id = p.id
     ${where}
     GROUP BY p.id, a.nombre, u.nombre_completo
     ORDER BY p.fecha_creacion DESC`,
    params
  );

  return result.rows;
};

// ─────────────────────────────────────────────────────────────────────────────
// OBTENER UNO
// ─────────────────────────────────────────────────────────────────────────────

const obtenerPorId = async (id) => {
  const result = await query(
    `SELECT
       p.id, p.nombre, p.descripcion, p.estado,
       p.fecha_inicio, p.fecha_fin, p.activo, p.fecha_creacion,
       p.area_id, a.nombre AS area_nombre,
       p.creado_por, u.nombre_completo AS creado_por_nombre,
       COUNT(o.id) AS total_oficios,
       COUNT(CASE WHEN o.estado NOT IN ('finalizado','cancelado') THEN 1 END) AS oficios_activos
     FROM proyectos p
     LEFT JOIN areas a    ON p.area_id    = a.id
     LEFT JOIN usuarios u ON p.creado_por = u.id
     LEFT JOIN oficios o  ON o.proyecto_id = p.id
     WHERE p.id = $1
     GROUP BY p.id, a.nombre, u.nombre_completo`,
    [id]
  );

  if (result.rowCount === 0) {
    throw { status: 404, message: 'Proyecto no encontrado' };
  }

  return result.rows[0];
};

// ─────────────────────────────────────────────────────────────────────────────
// CREAR
// ─────────────────────────────────────────────────────────────────────────────

const crear = async ({ nombre, descripcion, area_id, fecha_inicio, fecha_fin, usuarioId }) => {
  // Verificar que el área existe
  const area = await query(
    `SELECT id FROM areas WHERE id = $1 AND activo = true`, [area_id]
  );
  if (area.rowCount === 0) {
    throw { status: 404, message: 'Área no encontrada o inactiva' };
  }

  // Verificar nombre único dentro del área
  const existe = await query(
    `SELECT id FROM proyectos WHERE LOWER(nombre) = LOWER($1) AND area_id = $2 AND activo = true`,
    [nombre, area_id]
  );
  if (existe.rowCount > 0) {
    throw { status: 409, message: `Ya existe un proyecto con ese nombre en esta área` };
  }

  const result = await query(
    `INSERT INTO proyectos (nombre, descripcion, area_id, creado_por, fecha_inicio, fecha_fin)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [nombre, descripcion || null, area_id, usuarioId, fecha_inicio || null, fecha_fin || null]
  );

  return result.rows[0];
};

// ─────────────────────────────────────────────────────────────────────────────
// EDITAR
// ─────────────────────────────────────────────────────────────────────────────

const editar = async (id, { nombre, descripcion, fecha_inicio, fecha_fin }) => {
  const proyecto = await obtenerPorId(id);

  if (proyecto.estado === 'Cancelado') {
    throw { status: 409, message: 'No se puede editar un proyecto cancelado' };
  }

  const result = await query(
    `UPDATE proyectos
     SET nombre      = COALESCE($1, nombre),
         descripcion = COALESCE($2, descripcion),
         fecha_inicio = COALESCE($3, fecha_inicio),
         fecha_fin    = COALESCE($4, fecha_fin)
     WHERE id = $5
     RETURNING *`,
    [nombre || null, descripcion || null, fecha_inicio || null, fecha_fin || null, id]
  );

  return result.rows[0];
};

// ─────────────────────────────────────────────────────────────────────────────
// CAMBIAR ESTADO
// ─────────────────────────────────────────────────────────────────────────────

const cambiarEstado = async (id, estado) => {
  const proyecto = await obtenerPorId(id);

  // No permitir reactivar un proyecto cancelado
  if (proyecto.estado === 'Cancelado' && estado !== 'Activo') {
    throw { status: 409, message: 'No se puede cambiar el estado de un proyecto cancelado' };
  }

  // Validar transiciones
  const transicionesValidas = {
    Activo:     ['Finalizado', 'Cancelado'],
    Finalizado: ['Activo'],
    Cancelado:  [],
  };

  if (!transicionesValidas[proyecto.estado]?.includes(estado)) {
    throw { status: 409, message: `No se puede cambiar de "${proyecto.estado}" a "${estado}"` };
  }

  const result = await query(
    `UPDATE proyectos SET estado = $1 WHERE id = $2 RETURNING *`,
    [estado, id]
  );

  return result.rows[0];
};

// ─────────────────────────────────────────────────────────────────────────────
// OFICIOS DEL PROYECTO
// ─────────────────────────────────────────────────────────────────────────────

const obtenerOficios = async (proyectoId) => {
  await obtenerPorId(proyectoId);

  const result = await query(
    `SELECT
       o.id, o.numero_oficio, o.tipo_proceso, o.prioridad,
       o.estado, o.asunto, o.fecha_recepcion,
       a.nombre AS area_nombre,
       s.estado_semaforo, s.dias_transcurridos
     FROM oficios o
     LEFT JOIN areas a           ON o.area_asignada_id = a.id
     LEFT JOIN semaforo_tiempo s ON o.id = s.oficio_id
     WHERE o.proyecto_id = $1
     ORDER BY o.fecha_recepcion DESC`,
    [proyectoId]
  );

  return result.rows;
};

module.exports = { listar, obtenerPorId, crear, editar, cambiarEstado, obtenerOficios };
