// services/semaforos.service.js

const { query, withTransaction } = require('../db/pool');

// ─────────────────────────────────────────────────────────────────────────────
// RECALCULAR SEMÁFOROS (equivalente al SP de SQL Server)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recalcula el estado del semáforo para todos los oficios activos.
 * Se ejecuta periódicamente desde el cron configurado en server.js.
 */
const recalcularTodos = async () => {
  return withTransaction(async (client) => {
    // 1. Actualizar registros existentes
    await client.query(`
      UPDATE semaforo_tiempo st
      SET
        dias_transcurridos  = EXTRACT(DAY FROM NOW() - o.fecha_recepcion)::INT,
        estado_semaforo     = CASE
          WHEN EXTRACT(DAY FROM NOW() - o.fecha_recepcion)::INT >= cs.dias_rojo   THEN 'rojo'
          WHEN EXTRACT(DAY FROM NOW() - o.fecha_recepcion)::INT >= cs.dias_verde  THEN 'amarillo'
          ELSE 'verde'
        END,
        dias_limite_amarillo = cs.dias_verde,
        dias_limite_rojo     = cs.dias_rojo,
        fecha_calculo        = NOW()
      FROM oficios o
      JOIN configuracion_semaforo cs ON o.prioridad = cs.prioridad
      WHERE st.oficio_id = o.id
        AND o.estado NOT IN ('finalizado', 'cancelado')
    `);

    // 2. Crear registros faltantes para oficios activos sin semáforo
    await client.query(`
      INSERT INTO semaforo_tiempo
        (oficio_id, estado_semaforo, dias_transcurridos, dias_limite_amarillo, dias_limite_rojo, fecha_calculo)
      SELECT
        o.id,
        CASE
          WHEN EXTRACT(DAY FROM NOW() - o.fecha_recepcion)::INT >= cs.dias_rojo  THEN 'rojo'
          WHEN EXTRACT(DAY FROM NOW() - o.fecha_recepcion)::INT >= cs.dias_verde THEN 'amarillo'
          ELSE 'verde'
        END,
        EXTRACT(DAY FROM NOW() - o.fecha_recepcion)::INT,
        cs.dias_verde,
        cs.dias_rojo,
        NOW()
      FROM oficios o
      JOIN configuracion_semaforo cs ON o.prioridad = cs.prioridad
      WHERE NOT EXISTS (SELECT 1 FROM semaforo_tiempo WHERE oficio_id = o.id)
        AND o.estado NOT IN ('finalizado', 'cancelado')
      ON CONFLICT (oficio_id) DO NOTHING
    `);
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD DE SEMÁFOROS
// ─────────────────────────────────────────────────────────────────────────────

const obtenerDashboard = async ({ areaId } = {}) => {
  const condiciones = [`o.estado NOT IN ('finalizado', 'cancelado')`];
  const params = [];
  let idx = 1;

  if (areaId) {
    condiciones.push(`o.area_asignada_id = $${idx++}`);
    params.push(areaId);
  }

  const result = await query(
    `SELECT
       a.id   AS area_id,
       a.nombre AS area_nombre,
       COUNT(*)                                                        AS total_activos,
       COUNT(*) FILTER (WHERE s.estado_semaforo = 'verde')            AS verdes,
       COUNT(*) FILTER (WHERE s.estado_semaforo = 'amarillo')         AS amarillos,
       COUNT(*) FILTER (WHERE s.estado_semaforo = 'rojo')             AS rojos,
       COUNT(*) FILTER (WHERE o.prioridad = 'urgente')                AS urgentes,
       MAX(s.dias_transcurridos)                                      AS max_dias
     FROM oficios o
     JOIN areas a            ON o.area_asignada_id = a.id
     LEFT JOIN semaforo_tiempo s ON o.id = s.oficio_id
     WHERE ${condiciones.join(' AND ')}
     GROUP BY a.id, a.nombre
     ORDER BY rojos DESC, amarillos DESC`,
    params
  );

  // Totales globales
  const totalesResult = await query(
    `SELECT
       COUNT(*)                                             AS total,
       COUNT(*) FILTER (WHERE s.estado_semaforo = 'verde')    AS verdes,
       COUNT(*) FILTER (WHERE s.estado_semaforo = 'amarillo') AS amarillos,
       COUNT(*) FILTER (WHERE s.estado_semaforo = 'rojo')     AS rojos
     FROM oficios o
     LEFT JOIN semaforo_tiempo s ON o.id = s.oficio_id
     WHERE ${condiciones.join(' AND ')}`,
    params
  );

  return {
    por_area:  result.rows,
    totales:   totalesResult.rows[0],
    generado:  new Date().toISOString(),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN DE SEMÁFORO
// ─────────────────────────────────────────────────────────────────────────────

const obtenerConfiguracion = async () => {
  const result = await query(
    `SELECT prioridad, dias_verde, dias_rojo, activo
     FROM configuracion_semaforo
     ORDER BY CASE prioridad WHEN 'urgente' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END`
  );
  return result.rows;
};

const actualizarConfiguracion = async (prioridad, { dias_verde, dias_rojo }) => {
  if (dias_verde >= dias_rojo) {
    throw { status: 400, message: 'dias_verde debe ser menor que dias_rojo' };
  }
  if (dias_verde < 1 || dias_rojo < 2) {
    throw { status: 400, message: 'Los valores mínimos son: dias_verde=1, dias_rojo=2' };
  }

  const result = await query(
    `UPDATE configuracion_semaforo
     SET dias_verde = $1, dias_rojo = $2
     WHERE prioridad = $3
     RETURNING *`,
    [dias_verde, dias_rojo, prioridad]
  );

  if (result.rowCount === 0) {
    throw { status: 404, message: `Prioridad "${prioridad}" no encontrada en configuración` };
  }

  return result.rows[0];
};

module.exports = {
  recalcularTodos,
  obtenerDashboard,
  obtenerConfiguracion,
  actualizarConfiguracion,
};
