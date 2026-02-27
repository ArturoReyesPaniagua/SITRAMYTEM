// services/oficios.service.js

const { query, withTransaction } = require('../db/pool');

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transiciones válidas POR TIPO DE PROCESO.
 *
 * recibido_externo: 7 estados (recibido → asignado → en_proceso → respondido → en_espera_acuse → finalizado)
 * iniciado_interno: 5 estados (en_proceso → respondido → en_espera_acuse → finalizado)
 * informativo:      3 estados (recibido → asignado → finalizado)
 *
 * Cancelado siempre disponible desde cualquier estado no-terminal.
 */
const TRANSICIONES_VALIDAS = {
  recibido_externo: {
    recibido:        ['asignado', 'cancelado'],
    asignado:        ['en_proceso', 'cancelado'],
    en_proceso:      ['respondido', 'cancelado'],
    respondido:      ['en_espera_acuse', 'cancelado'],
    en_espera_acuse: ['finalizado', 'cancelado'],
    finalizado:      [],
    cancelado:       [],
  },
  iniciado_interno: {
    en_proceso:      ['respondido', 'cancelado'],
    respondido:      ['en_espera_acuse', 'cancelado'],
    en_espera_acuse: ['finalizado', 'cancelado'],
    finalizado:      [],
    cancelado:       [],
  },
  informativo: {
    recibido:        ['asignado', 'cancelado'],
    asignado:        ['finalizado', 'cancelado'],
    finalizado:      [],
    cancelado:       [],
  },
};

const ESTADO_INICIAL = {
  recibido_externo: 'recibido',
  iniciado_interno: 'en_proceso',
  informativo:      'recibido',
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS INTERNOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retorna la configuración del semáforo para una prioridad dada.
 * Si no existe en BD, usa valores por defecto seguros.
 */
const _obtenerConfigSemaforo = async (client, prioridad) => {
  const res = await client.query(
    `SELECT dias_verde, dias_rojo FROM configuracion_semaforo WHERE prioridad = $1`,
    [prioridad]
  );
  return res.rows[0] || { dias_verde: 5, dias_rojo: 15 };
};

/**
 * Inserta o actualiza el registro de semáforo para un oficio.
 * Siempre usa UPSERT para evitar errores si el registro ya existe.
 */
const _upsertSemaforo = async (client, oficioId, prioridad) => {
  const config = await _obtenerConfigSemaforo(client, prioridad);
  await client.query(
    `INSERT INTO semaforo_tiempo
       (oficio_id, estado_semaforo, dias_transcurridos, dias_limite_amarillo, dias_limite_rojo)
     VALUES ($1, 'verde', 0, $2, $3)
     ON CONFLICT (oficio_id)
     DO UPDATE SET dias_limite_amarillo = $2, dias_limite_rojo = $3`,
    [oficioId, config.dias_verde, config.dias_rojo]
  );
};

/**
 * Valida que la transición solicitada sea válida para el tipo de proceso del oficio.
 */
const _validarTransicion = (tipoProceso, estadoActual, nuevoEstado) => {
  const mapa = TRANSICIONES_VALIDAS[tipoProceso];
  if (!mapa) throw { status: 400, message: `Tipo de proceso desconocido: ${tipoProceso}` };

  const permitidos = mapa[estadoActual];
  if (!permitidos) throw { status: 409, message: `Estado actual inválido para este tipo de proceso: ${estadoActual}` };

  if (!permitidos.includes(nuevoEstado)) {
    throw {
      status: 409,
      message: `No se puede cambiar de "${estadoActual}" a "${nuevoEstado}" en un oficio de tipo "${tipoProceso}"`,
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// LISTAR
// ─────────────────────────────────────────────────────────────────────────────

const listar = async ({
  areaId, tipo, prioridad, estado, proyectoId,
  busqueda, pagina = 1, limite = 20,
} = {}) => {
  const condiciones = [];
  const params = [];
  let idx = 1;

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

  const [dataResult, countResult] = await Promise.all([
    query(
      `SELECT
         o.id, o.numero_oficio, o.tipo_proceso, o.prioridad, o.estado,
         o.asunto, o.promovente, o.destinatario,
         o.fecha_recepcion, o.fecha_asignacion, o.fecha_respuesta, o.fecha_finalizacion,
         o.proyecto_id,
         a.nombre  AS area_nombre,
         p.nombre  AS proyecto_nombre,
         s.estado_semaforo, s.dias_transcurridos
       FROM oficios o
       LEFT JOIN areas a           ON o.area_asignada_id = a.id
       LEFT JOIN proyectos p       ON o.proyecto_id      = p.id
       LEFT JOIN semaforo_tiempo s ON o.id               = s.oficio_id
       ${where}
       ORDER BY o.fecha_recepcion DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limite, offset]
    ),
    query(
      `SELECT COUNT(*) FROM oficios o ${where}`,
      params
    ),
  ]);

  return {
    data:       dataResult.rows,
    total:      parseInt(countResult.rows[0].count),
    pagina,
    limite,
    totalPaginas: Math.ceil(parseInt(countResult.rows[0].count) / limite),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// OBTENER POR ID
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
  numero_oficio, tipo_proceso, prioridad, area_asignada_id,
  proyecto_id, promovente, destinatario, asunto,
  fecha_recepcion, observaciones, usuarioId,
}) => {
  // Validar tipo
  if (!ESTADO_INICIAL[tipo_proceso]) {
    throw { status: 400, message: `tipo_proceso inválido: ${tipo_proceso}` };
  }

  const estadoInicial = ESTADO_INICIAL[tipo_proceso];

  const oficio = await withTransaction(async (client) => {
    const result = await client.query(
      `INSERT INTO oficios (
         numero_oficio, tipo_proceso, prioridad, estado,
         area_asignada_id, proyecto_id,
         promovente, destinatario, asunto,
         fecha_recepcion, observaciones, creado_por,
         fecha_asignacion
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
         CASE WHEN $2 = 'iniciado_interno' THEN NOW() ELSE NULL END
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

    // Historial inicial
    await client.query(
      `INSERT INTO historial_estado
         (oficio_id, estado_anterior, estado_nuevo, usuario_id, motivo)
       VALUES ($1, 'ninguno', $2, $3, 'Oficio creado')`,
      [nuevoOficio.id, estadoInicial, usuarioId]
    );

    // Semáforo — usa UPSERT para ser idempotente
    await _upsertSemaforo(client, nuevoOficio.id, prioridad);

    return nuevoOficio;
  });

  return obtenerPorId(oficio.id);
};

// ─────────────────────────────────────────────────────────────────────────────
// EDITAR
// ─────────────────────────────────────────────────────────────────────────────

const editar = async (id, { asunto, observaciones, proyecto_id }, usuarioId) => {
  const oficio = await obtenerPorId(id);

  if (['finalizado', 'cancelado'].includes(oficio.estado)) {
    throw { status: 409, message: 'No se puede editar un oficio en estado terminal' };
  }

  const result = await query(
    `UPDATE oficios
     SET asunto = COALESCE($1, asunto),
         observaciones = $2,
         proyecto_id = $3,
         modificado_por = $4,
         fecha_modificacion = NOW()
     WHERE id = $5
     RETURNING *`,
    [asunto || null, observaciones ?? oficio.observaciones, proyecto_id ?? oficio.proyecto_id, usuarioId, id]
  );

  return result.rows[0];
};

// ─────────────────────────────────────────────────────────────────────────────
// CAMBIAR ESTADO
// ─────────────────────────────────────────────────────────────────────────────

const cambiarEstado = async (id, nuevoEstado, usuarioId, motivo = null) => {
  const oficio = await obtenerPorId(id);
  const estadoActual = oficio.estado;

  // Validar transición según tipo de proceso
  _validarTransicion(oficio.tipo_proceso, estadoActual, nuevoEstado);

  // Finalización manual sin acuse requiere motivo
  if (nuevoEstado === 'finalizado' && oficio.tipo_proceso !== 'informativo') {
    if (!motivo || motivo.trim() === '') {
      const acuse = await query(
        `SELECT id FROM archivos_oficio
         WHERE oficio_id = $1 AND categoria = 'acuse' AND es_version_activa = true`,
        [id]
      );
      if (acuse.rowCount === 0) {
        throw { status: 400, message: 'Se requiere motivo para finalización manual sin acuse' };
      }
    }
  }

  // Cancelación siempre requiere motivo
  if (nuevoEstado === 'cancelado' && (!motivo || motivo.trim() === '')) {
    throw { status: 400, message: 'Se requiere motivo para cancelar un oficio' };
  }

  await withTransaction(async (client) => {
    // Fechas automáticas por estado
    const camposFecha = {
      asignado:        `fecha_asignacion   = NOW(),`,
      respondido:      `fecha_respuesta    = NOW(),`,
      en_espera_acuse: ``,
      en_proceso:      ``,
      finalizado:      `fecha_finalizacion = NOW(),`,
      cancelado:       `fecha_finalizacion = NOW(),`,
    };

    await client.query(
      `UPDATE oficios
       SET estado = $1,
           ${camposFecha[nuevoEstado] || ''}
           modificado_por = $2,
           fecha_modificacion = NOW()
       WHERE id = $3`,
      [nuevoEstado, usuarioId, id]
    );

    await client.query(
      `INSERT INTO historial_estado
         (oficio_id, estado_anterior, estado_nuevo, usuario_id, motivo)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, estadoActual, nuevoEstado, usuarioId, motivo]
    );

    // Si pasa a estado terminal, marcar semáforo como inactivo (no eliminar)
    if (['finalizado', 'cancelado'].includes(nuevoEstado)) {
      await client.query(
        `UPDATE semaforo_tiempo SET estado_semaforo = 'verde', dias_transcurridos = 0
         WHERE oficio_id = $1`,
        [id]
      );
    }
  });

  return obtenerPorId(id);
};

// ─────────────────────────────────────────────────────────────────────────────
// ASIGNAR ÁREA (solo admin)
// ─────────────────────────────────────────────────────────────────────────────

const asignar = async (id, areaId, usuarioId) => {
  const oficio = await obtenerPorId(id);

  if (['finalizado', 'cancelado'].includes(oficio.estado)) {
    throw { status: 409, message: 'No se puede reasignar un oficio en estado terminal' };
  }

  // Validar que el área existe y está activa
  const areaResult = await query(
    `SELECT id, nombre FROM areas WHERE id = $1 AND activo = true`,
    [areaId]
  );
  if (areaResult.rowCount === 0) {
    throw { status: 404, message: 'Área no encontrada o inactiva' };
  }

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE oficios
       SET area_asignada_id = $1, modificado_por = $2, fecha_modificacion = NOW()
       WHERE id = $3`,
      [areaId, usuarioId, id]
    );

    await client.query(
      `INSERT INTO historial_estado
         (oficio_id, estado_anterior, estado_nuevo, usuario_id, motivo)
       VALUES ($1, $2, $2, $3, $4)`,
      [id, oficio.estado, usuarioId, `Reasignado al área "${areaResult.rows[0].nombre}" (ID ${areaId})`]
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
    throw { status: 409, message: 'No se puede cambiar la prioridad de un oficio en estado terminal' };
  }

  await withTransaction(async (client) => {
    const prioridadAnterior = oficio.prioridad;

    await client.query(
      `UPDATE oficios
       SET prioridad = $1, modificado_por = $2, fecha_modificacion = NOW()
       WHERE id = $3`,
      [prioridad, usuarioId, id]
    );

    // Actualizar límites del semáforo. Usar UPSERT por si no existe el registro.
    await _upsertSemaforo(client, id, prioridad);

    // Registrar en historial como evento de auditoría (estado no cambia)
    await client.query(
      `INSERT INTO historial_estado
         (oficio_id, estado_anterior, estado_nuevo, usuario_id, motivo)
       VALUES ($1, $2, $2, $3, $4)`,
      [id, oficio.estado, usuarioId, `Prioridad cambiada de "${prioridadAnterior}" a "${prioridad}"`]
    );
  });

  return obtenerPorId(id);
};

// ─────────────────────────────────────────────────────────────────────────────
// ALERTAS (oficios en amarillo/rojo)
// ─────────────────────────────────────────────────────────────────────────────

const obtenerAlertas = async ({ areaId } = {}) => {
  const condiciones = [`s.estado_semaforo IN ('amarillo', 'rojo')`, `o.estado NOT IN ('finalizado', 'cancelado')`];
  const params = [];
  let idx = 1;

  if (areaId) {
    condiciones.push(`o.area_asignada_id = $${idx++}`);
    params.push(areaId);
  }

  const result = await query(
    `SELECT
       o.id, o.numero_oficio, o.tipo_proceso, o.prioridad, o.estado, o.asunto,
       o.fecha_recepcion,
       a.nombre AS area_nombre,
       s.estado_semaforo, s.dias_transcurridos,
       s.dias_limite_amarillo, s.dias_limite_rojo
     FROM oficios o
     JOIN areas a           ON o.area_asignada_id = a.id
     JOIN semaforo_tiempo s ON o.id = s.oficio_id
     WHERE ${condiciones.join(' AND ')}
     ORDER BY s.estado_semaforo DESC, s.dias_transcurridos DESC`,
    params
  );

  return result.rows;
};

module.exports = {
  listar,
  obtenerPorId,
  crear,
  editar,
  cambiarEstado,
  asignar,
  cambiarPrioridad,
  obtenerAlertas,
};
