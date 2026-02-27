// services/dashboard.service.js

const { query } = require('../db/pool');

// ─────────────────────────────────────────────────────────────────────────────
// RESUMEN EJECUTIVO (admin)
// ─────────────────────────────────────────────────────────────────────────────

const resumenEjecutivo = async () => {
  const [estados, prioridades, semaforos, tendencia, topAreas] = await Promise.all([

    // Conteo por estado
    query(
      `SELECT estado, COUNT(*) AS total
       FROM oficios
       GROUP BY estado
       ORDER BY total DESC`
    ),

    // Conteo por prioridad (solo activos)
    query(
      `SELECT prioridad, COUNT(*) AS total
       FROM oficios
       WHERE estado NOT IN ('finalizado', 'cancelado')
       GROUP BY prioridad`
    ),

    // Totales de semáforo
    query(
      `SELECT
         COUNT(*) FILTER (WHERE s.estado_semaforo = 'verde')    AS verdes,
         COUNT(*) FILTER (WHERE s.estado_semaforo = 'amarillo') AS amarillos,
         COUNT(*) FILTER (WHERE s.estado_semaforo = 'rojo')     AS rojos,
         COUNT(*) AS total_activos
       FROM semaforo_tiempo s
       INNER JOIN oficios o ON s.oficio_id = o.id
       WHERE o.estado NOT IN ('finalizado', 'cancelado')`
    ),

    // Tendencia últimos 30 días (oficios creados por día)
    query(
      `SELECT
         DATE(fecha_creacion) AS fecha,
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE tipo_proceso = 'recibido_externo')  AS externos,
         COUNT(*) FILTER (WHERE tipo_proceso = 'iniciado_interno')  AS internos,
         COUNT(*) FILTER (WHERE tipo_proceso = 'informativo')       AS informativos
       FROM oficios
       WHERE fecha_creacion >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(fecha_creacion)
       ORDER BY fecha ASC`
    ),

    // Top 5 áreas con más oficios activos
    query(
      `SELECT
         a.nombre AS area,
         COUNT(*) FILTER (WHERE o.estado NOT IN ('finalizado','cancelado')) AS activos,
         COUNT(*) FILTER (WHERE o.estado = 'finalizado')                    AS finalizados,
         ROUND(
           COUNT(*) FILTER (WHERE o.estado = 'finalizado') * 100.0
           / NULLIF(COUNT(*), 0), 1
         ) AS pct_completado
       FROM areas a
       LEFT JOIN oficios o ON a.id = o.area_asignada_id
       WHERE a.activo = true
       GROUP BY a.id, a.nombre
       ORDER BY activos DESC
       LIMIT 5`
    ),
  ]);

  return {
    por_estado:      estados.rows,
    por_prioridad:   prioridades.rows,
    semaforos:       semaforos.rows[0],
    tendencia_30dias: tendencia.rows,
    top_areas:       topAreas.rows,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// RESUMEN DE ÁREA (usuario de área)
// ─────────────────────────────────────────────────────────────────────────────

const resumenArea = async (areaId) => {
  const [estados, semaforos, recientes, vencidos] = await Promise.all([

    // Estados de oficios del área
    query(
      `SELECT estado, COUNT(*) AS total
       FROM oficios
       WHERE area_asignada_id = $1
       GROUP BY estado`,
      [areaId]
    ),

    // Semáforo del área
    query(
      `SELECT
         COUNT(*) FILTER (WHERE s.estado_semaforo = 'verde')    AS verdes,
         COUNT(*) FILTER (WHERE s.estado_semaforo = 'amarillo') AS amarillos,
         COUNT(*) FILTER (WHERE s.estado_semaforo = 'rojo')     AS rojos
       FROM semaforo_tiempo s
       INNER JOIN oficios o ON s.oficio_id = o.id
       WHERE o.area_asignada_id = $1
         AND o.estado NOT IN ('finalizado', 'cancelado')`,
      [areaId]
    ),

    // Últimos 5 oficios recientes del área
    query(
      `SELECT
         o.id, o.numero_oficio, o.asunto, o.estado,
         o.prioridad, o.fecha_recepcion,
         s.estado_semaforo, s.dias_transcurridos
       FROM oficios o
       LEFT JOIN semaforo_tiempo s ON o.id = s.oficio_id
       WHERE o.area_asignada_id = $1
         AND o.estado NOT IN ('finalizado', 'cancelado')
       ORDER BY
         CASE o.prioridad WHEN 'urgente' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
         o.fecha_recepcion ASC
       LIMIT 5`,
      [areaId]
    ),

    // Oficios vencidos (semáforo rojo) del área
    query(
      `SELECT
         o.id, o.numero_oficio, o.asunto,
         o.prioridad, s.dias_transcurridos
       FROM oficios o
       INNER JOIN semaforo_tiempo s ON o.id = s.oficio_id
       WHERE o.area_asignada_id = $1
         AND s.estado_semaforo = 'rojo'
         AND o.estado NOT IN ('finalizado', 'cancelado')
       ORDER BY s.dias_transcurridos DESC`,
      [areaId]
    ),
  ]);

  return {
    por_estado:       estados.rows,
    semaforos:        semaforos.rows[0],
    prioritarios:     recientes.rows,
    vencidos:         vencidos.rows,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// REPORTE DE CUMPLIMIENTO DE SLA
// ─────────────────────────────────────────────────────────────────────────────

const reporteSLA = async ({ areaId, desde, hasta } = {}) => {
  const condiciones = [`o.estado = 'finalizado'`];
  const params = [];
  let idx = 1;

  if (areaId) {
    condiciones.push(`o.area_asignada_id = $${idx++}`);
    params.push(areaId);
  }
  if (desde) {
    condiciones.push(`o.fecha_finalizacion >= $${idx++}`);
    params.push(desde);
  }
  if (hasta) {
    condiciones.push(`o.fecha_finalizacion <= $${idx++}`);
    params.push(hasta);
  }

  const where = `WHERE ${condiciones.join(' AND ')}`;

  const result = await query(
    `SELECT
       a.nombre AS area,
       o.prioridad,
       COUNT(*) AS total_finalizados,
       AVG(EXTRACT(DAY FROM o.fecha_finalizacion - o.fecha_recepcion))::NUMERIC(10,1) AS promedio_dias,
       MIN(EXTRACT(DAY FROM o.fecha_finalizacion - o.fecha_recepcion))::INT           AS minimo_dias,
       MAX(EXTRACT(DAY FROM o.fecha_finalizacion - o.fecha_recepcion))::INT           AS maximo_dias,
       COUNT(*) FILTER (
         WHERE EXTRACT(DAY FROM o.fecha_finalizacion - o.fecha_recepcion) <= c.dias_verde
       ) AS dentro_sla_verde,
       COUNT(*) FILTER (
         WHERE EXTRACT(DAY FROM o.fecha_finalizacion - o.fecha_recepcion) > c.dias_rojo
       ) AS fuera_sla_rojo
     FROM oficios o
     INNER JOIN areas a                 ON o.area_asignada_id = a.id
     INNER JOIN configuracion_semaforo c ON o.prioridad       = c.prioridad
     ${where}
     GROUP BY a.id, a.nombre, o.prioridad, c.dias_verde, c.dias_rojo
     ORDER BY a.nombre, o.prioridad`,
    params
  );

  return result.rows;
};

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVIDAD RECIENTE (últimas 24h)
// ─────────────────────────────────────────────────────────────────────────────

const actividadReciente = async (areaId = null) => {
  const whereArea = areaId ? `AND o.area_asignada_id = ${parseInt(areaId)}` : '';

  const result = await query(
    `SELECT
       h.fecha_cambio,
       h.estado_anterior,
       h.estado_nuevo,
       h.motivo,
       o.numero_oficio,
       o.asunto,
       u.nombre_completo AS usuario
     FROM historial_estado h
     INNER JOIN oficios o  ON h.oficio_id  = o.id
     INNER JOIN usuarios u ON h.usuario_id = u.id
     WHERE h.fecha_cambio >= NOW() - INTERVAL '24 hours'
       ${whereArea}
     ORDER BY h.fecha_cambio DESC
     LIMIT 20`
  );

  return result.rows;
};

module.exports = { resumenEjecutivo, resumenArea, reporteSLA, actividadReciente };
