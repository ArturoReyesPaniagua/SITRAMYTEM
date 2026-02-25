// services/oficios.service.js

const { query, withTransaction } = require('../db/pool');

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

const TRANSICIONES_VALIDAS = {
  recibido:          ['asignado', 'cancelado'],
  asignado:          ['en_proceso', 'cancelado'],
  en_proceso:        ['respondido', 'cancelado'],
  respondido:        ['en_espera_acuse', 'cancelado'],
  en_espera_acuse:   ['finalizado', 'cancelado'],
  finalizado:        [],
  cancelado:         [],
};

// Oficios internos arrancan directamente en en_proceso
const ESTADO_INICIAL = {
  recibido_externo:   'recibido',
  iniciado_interno:   'en_proceso',
  informativo:        'recibido',
};

// ─────────────────────────────────────────────────────────────────────────────
// LISTAR
// ─────────────────────────────────────────────────────────────────────────────

const listar = async ({ areaId, tipo, prioridad, estado, proyectoId, busqueda, pagina = 1, limite = 20 } = {}) => {
  const condiciones = [];
  const params = [];
  let idx = 1;

  // Filtro por área (usuarios solo ven la suya)
  if (areaId) {
    condiciones.push(`o.area_asignada_id = $${idx++}`);
    params.push(areaId);
  }
  if (tipo) {
    condiciones.push(`o.tipo_proceso = $${idx++}`);
    params.push(tipo);
  }
  if (prioridad) {
    condiciones.push(`o.prioridad = $${idx++}`);
    params.push(prioridad);
  }
  if (estado) {
    condiciones.push(`o.estado = $${idx++}`);
    params.push(estado);
  }
  if (proyectoId) {
    condiciones.push(`o.proyecto_id = $${idx++}`);
    params.push(proyectoId);
  }
  if (busqueda) {
    condiciones.push(`(
      o.numero_oficio ILIKE $${idx} OR
      o.asunto        ILIKE $${idx} OR
      o.promovente    ILIKE $${idx} OR
      o.destinatario  ILIKE $${idx}
    )`);
    params.push(`%${busqueda}%`);
    idx++;
  }

  const where  = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const offset = (pagina - 1) * limite;

  // Query principal con paginación
  const [dataResult, countResult] = await Promise.all([
    query(
      `SELECT
         o.id, o.numero_oficio, o.tipo_proceso, o.prioridad, o.estado,
         o.asunto, o.promovente, o.destinatario,
         o.fecha_recepcion, o.fecha_asignacion, o.fecha_respuesta,
         o.fecha_acuse, o.fecha_finalizacion, o.fecha_creacion,
         o.area_asignada_id, a.nombre AS area_nombre,
         o.proyecto_id,      p.nombre AS proyecto_nombre,
         o.creado_por,       u.nombre_completo AS creado_por_nombre,
         s.estado_semaforo,  s.dias_transcurridos
       FROM oficios o
       LEFT JOIN areas a           ON o.area_asignada_id = a.id
       LEFT JOIN proyectos p       ON o.proyecto_id      = p.id
       LEFT JOIN usuarios u        ON o.creado_por       = u.id
       LEFT JOIN semaforo_tiempo s ON o.id               = s.oficio_id
       ${where}
       ORDER BY
         CASE o.prioridad WHEN 'urgente' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
         o.fecha_recepcion DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limite, offset]
    ),
    query(
      `SELECT COUNT(*) AS total FROM oficios o ${where}`,
      params
    ),
  ]);

  const total  = parseInt(countResult.rows[0].total);
  const paginas = Math.ceil(total / limite);

  return {
    data: dataResult.rows,
    paginacion: { total, pagina, limite, paginas },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// OBTENER UNO (con historial y archivos)
// ─────────────────────────────────────────────────────────────────────────────

const obtenerPorId = async (id) => {
  const [oficioResult, historialResult, archivosResult] = await Promise.all([
    query(
      `SELECT
         o.*,
         a.nombre  AS area_nombre,
         p.nombre  AS proyecto_nombre,
         u.nombre_completo AS creado_por_nombre,
         m.nombre_completo AS modificado_por_nombre,
         s.estado_semaforo, s.dias_transcurridos,
         s.dias_limite_amarillo, s.dias_limite_rojo
       FROM oficios o
       LEFT JOIN areas a           ON o.area_asignada_id = a.id
       LEFT JOIN proyectos p       ON o.proyecto_id      = p.id
       LEFT JOIN usuarios u        ON o.creado_por       = u.id
       LEFT JOIN usuarios m        ON o.modificado_por   = m.id
       LEFT JOIN semaforo_tiempo s ON o.id               = s.oficio_id
       WHERE o.id = $1`,
      [id]
    ),
    query(
      `SELECT
         h.id, h.estado_anterior, h.estado_nuevo,
         h.motivo, h.fecha_cambio,
         u.nombre_completo AS usuario_nombre
       FROM historial_estado h
       LEFT JOIN usuarios u ON h.usuario_id = u.id
       WHERE h.oficio_id = $1
       ORDER BY h.fecha_cambio ASC`,
      [id]
    ),
    query(
      `SELECT
         id, tipo_archivo, categoria, nombre_archivo,
         tamano_bytes, version, es_version_activa,
         subido_por, fecha_subida
       FROM archivos_oficio
       WHERE oficio_id = $1
       ORDER BY fecha_subida DESC`,
      [id]
    ),
  ]);

  if (oficioResult.rowCount === 0) {
    throw { status: 404, message: 'Oficio no encontrado' };
  }

  return {
    ...oficioResult.rows[0],
    historial: historialResult.rows,
    archivos:  archivosResult.rows,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// CREAR
// ─────────────────────────────────────────────────────────────────────────────

const crear = async ({
  numero_oficio, tipo_proceso, prioridad,
  area_asignada_id, proyecto_id,
  promovente, destinatario, asunto,
  fecha_recepcion, observaciones,
  usuarioId,
}) => {
  // Verificar número único
  const existe = await query(
    `SELECT id FROM oficios WHERE numero_oficio = $1`, [numero_oficio]
  );
  if (existe.rowCount > 0) {
    throw { status: 409, message: `El número de oficio "${numero_oficio}" ya existe` };
  }

  // Verificar área activa
  const area = await query(
    `SELECT id FROM areas WHERE id = $1 AND activo = true`, [area_asignada_id]
  );
  if (area.rowCount === 0) {
    throw { status: 404, message: 'Área asignada no encontrada o inactiva' };
  }

  // Verificar proyecto si se proporcionó
  if (proyecto_id) {
    const proyecto = await query(
      `SELECT id, area_id FROM proyectos WHERE id = $1 AND activo = true`, [proyecto_id]
    );
    if (proyecto.rowCount === 0) {
      throw { status: 404, message: 'Proyecto no encontrado o inactivo' };
    }
    // El proyecto debe pertenecer al mismo área
    if (proyecto.rows[0].area_id !== parseInt(area_asignada_id)) {
      throw { status: 400, message: 'El proyecto no pertenece al área asignada' };
    }
  }

  const estadoInicial = ESTADO_INICIAL[tipo_proceso];

  const oficio = await withTransaction(async (client) => {
    // Insertar oficio
    const result = await client.query(
      `INSERT INTO oficios (
         numero_oficio, tipo_proceso, prioridad, estado,
         area_asignada_id, proyecto_id,
         promovente, destinatario, asunto,
         fecha_recepcion, observaciones, creado_por,
         fecha_asignacion
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
         CASE WHEN $3 = 'iniciado_interno' THEN NOW() ELSE NULL END
       )
       RETURNING *`,
      [
        numero_oficio, tipo_proceso, prioridad, estadoInicial,
        area_asignada_id, proyecto_id || null,
        promovente || null, destinatario || null, asunto,
        fecha_recepcion, observaciones || null, usuarioId,
      ]
    );

    const nuevoOficio = result.rows[0];

    // Registrar en historial
    await client.query(
      `INSERT INTO historial_estado (oficio_id, estado_anterior, estado_nuevo, usuario_id, motivo)
       VALUES ($1, $2, $3, $4, $5)`,
      [nuevoOficio.id, 'ninguno', estadoInicial, usuarioId, 'Oficio creado']
    );

    // Crear semáforo
    const configSemaforo = await client.query(
      `SELECT dias_verde, dias_rojo FROM configuracion_semaforo WHERE prioridad = $1`,
      [prioridad]
    );
    const config = configSemaforo.rows[0] || { dias_verde: 5, dias_rojo: 15 };

    await client.query(
      `INSERT INTO semaforo_tiempo
         (oficio_id, estado_semaforo, dias_transcurridos, dias_limite_amarillo, dias_limite_rojo)
       VALUES ($1, 'verde', 0, $2, $3)`,
      [nuevoOficio.id, config.dias_verde, config.dias_rojo]
    );

    return nuevoOficio;
  });

  return oficio;
};

// ─────────────────────────────────────────────────────────────────────────────
// EDITAR (solo datos básicos, no estado)
// ─────────────────────────────────────────────────────────────────────────────

const editar = async (id, { asunto, promovente, destinatario, observaciones, proyecto_id }, usuarioId) => {
  const oficio = await obtenerPorId(id);

  if (['finalizado', 'cancelado'].includes(oficio.estado)) {
    throw { status: 409, message: 'No se puede editar un oficio finalizado o cancelado' };
  }

  // Validar proyecto si cambia
  if (proyecto_id !== undefined) {
    if (proyecto_id) {
      const proyecto = await query(
        `SELECT area_id FROM proyectos WHERE id = $1 AND activo = true`, [proyecto_id]
      );
      if (proyecto.rowCount === 0) throw { status: 404, message: 'Proyecto no encontrado' };
      if (proyecto.rows[0].area_id !== parseInt(oficio.area_asignada_id)) {
        throw { status: 400, message: 'El proyecto no pertenece al área del oficio' };
      }
    }
  }

  const result = await query(
    `UPDATE oficios
     SET asunto       = COALESCE($1, asunto),
         promovente   = COALESCE($2, promovente),
         destinatario = COALESCE($3, destinatario),
         observaciones = COALESCE($4, observaciones),
         proyecto_id  = CASE WHEN $5::INT IS NOT NULL THEN $5 ELSE proyecto_id END,
         modificado_por       = $6,
         fecha_modificacion   = NOW()
     WHERE id = $7
     RETURNING *`,
    [asunto || null, promovente || null, destinatario || null,
     observaciones || null, proyecto_id ?? null, usuarioId, id]
  );

  return result.rows[0];
};

// ─────────────────────────────────────────────────────────────────────────────
// CAMBIAR ESTADO
// ─────────────────────────────────────────────────────────────────────────────

const cambiarEstado = async (id, nuevoEstado, usuarioId, motivo = null) => {
  const oficio = await obtenerPorId(id);
  const estadoActual = oficio.estado;

  // Validar transición
  if (!TRANSICIONES_VALIDAS[estadoActual]?.includes(nuevoEstado)) {
    throw {
      status: 409,
      message: `No se puede cambiar de "${estadoActual}" a "${nuevoEstado}"`,
    };
  }

  // Finalización manual requiere motivo
  if (nuevoEstado === 'finalizado' && !motivo) {
    // Solo es obligatorio si no hay acuse subido
    const acuse = await query(
      `SELECT id FROM archivos_oficio
       WHERE oficio_id = $1 AND categoria = 'acuse' AND es_version_activa = true`,
      [id]
    );
    if (acuse.rowCount === 0) {
      throw { status: 400, message: 'Se requiere motivo para finalización manual sin acuse' };
    }
  }

  await withTransaction(async (client) => {
    // Registrar en historial
    await client.query(
      `INSERT INTO historial_estado (oficio_id, estado_anterior, estado_nuevo, usuario_id, motivo)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, estadoActual, nuevoEstado, usuarioId, motivo]
    );

    // Fechas automáticas según estado
    const fechasCampo = {
      asignado:        'fecha_asignacion   = NOW(),',
      respondido:      'fecha_respuesta    = NOW(),',
      en_espera_acuse: '',
      finalizado:      'fecha_finalizacion = NOW(),',
      cancelado:       'fecha_finalizacion = NOW(),',
    };

    const fechaExtra = fechasCampo[nuevoEstado] || '';

    await client.query(
      `UPDATE oficios
       SET estado    = $1,
           ${fechaExtra}
           motivo_finalizacion_manual = CASE WHEN $1 = 'finalizado' THEN $2 ELSE motivo_finalizacion_manual END,
           modificado_por     = $3,
           fecha_modificacion = NOW()
       WHERE id = $4`,
      [nuevoEstado, motivo, usuarioId, id]
    );
  });

  return obtenerPorId(id);
};

// ─────────────────────────────────────────────────────────────────────────────
// ASIGNAR A ÁREA (solo admin)
// ─────────────────────────────────────────────────────────────────────────────

const asignar = async (id, areaId, usuarioId) => {
  const oficio = await obtenerPorId(id);

  if (['finalizado', 'cancelado'].includes(oficio.estado)) {
    throw { status: 409, message: 'No se puede reasignar un oficio finalizado o cancelado' };
  }

  const area = await query(
    `SELECT id FROM areas WHERE id = $1 AND activo = true`, [areaId]
  );
  if (area.rowCount === 0) {
    throw { status: 404, message: 'Área no encontrada o inactiva' };
  }

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE oficios
       SET area_asignada_id  = $1,
           estado            = 'asignado',
           fecha_asignacion  = NOW(),
           modificado_por    = $2,
           fecha_modificacion = NOW()
       WHERE id = $3`,
      [areaId, usuarioId, id]
    );

    await client.query(
      `INSERT INTO historial_estado (oficio_id, estado_anterior, estado_nuevo, usuario_id, motivo)
       VALUES ($1, $2, 'asignado', $3, $4)`,
      [id, oficio.estado, usuarioId, `Asignado al área ID ${areaId}`]
    );
  });

  return obtenerPorId(id);
};

// ─────────────────────────────────────────────────────────────────────────────
// CAMBIAR PRIORIDAD (solo admin)
// ─────────────────────────────────────────────────────────────────────────────

const cambiarPrioridad = async (id, prioridad, usuarioId) => {
  const oficio = await obtenerPorId(id);

  if (['finalizado', 'cancelado'].includes(oficio.estado)) {
    throw { status: 409, message: 'No se puede cambiar la prioridad de un oficio finalizado' };
  }

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE oficios
       SET prioridad = $1, modificado_por = $2, fecha_modificacion = NOW()
       WHERE id = $3`,
      [prioridad, usuarioId, id]
    );

    // Actualizar límites del semáforo según nueva prioridad
    const config = await client.query(
      `SELECT dias_verde, dias_rojo FROM configuracion_semaforo WHERE prioridad = $1`,
      [prioridad]
    );
    if (config.rowCount > 0) {
      const { dias_verde, dias_rojo } = config.rows[0];
      await client.query(
        `UPDATE semaforo_tiempo
         SET dias_limite_amarillo = $1, dias_limite_rojo = $2
         WHERE oficio_id = $3`,
        [dias_verde, dias_rojo, id]
      );
    }

    await client.query(
      `INSERT INTO historial_estado (oficio_id, estado_anterior, estado_nuevo, usuario_id, motivo)
       VALUES ($1, $2, $2, $3, $4)`,
      [id, oficio.estado, usuarioId, `Prioridad cambiada a "${prioridad}"`]
    );
  });

  return obtenerPorId(id);
};

module.exports = {
  listar,
  obtenerPorId,
  crear,
  editar,
  cambiarEstado,
  asignar,
  cambiarPrioridad,
};
