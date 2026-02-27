// utils/semaforo.job.js
// Job que actualiza semáforos y envía alertas por email cada hora

const semaforosService = require('../services/semaforos.service');

// ─── SIMULACIÓN DE ENVÍO DE EMAIL ────────────────────────────────────────────
// Reemplazar con nodemailer, SendGrid o el proveedor de la institución

const enviarEmail = async ({ to, subject, body }) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`\n📧 [EMAIL SIMULADO]`);
    console.log(`   Para: ${Array.isArray(to) ? to.join(', ') : to}`);
    console.log(`   Asunto: ${subject}`);
    console.log(`   Cuerpo: ${body.substring(0, 100)}...\n`);
    return;
  }

  // TODO: Integrar con nodemailer o servicio de correo institucional
  // const transporter = nodemailer.createTransporter({ ... });
  // await transporter.sendMail({ from, to, subject, html: body });
};

// ─── GENERAR CUERPO DE ALERTA ─────────────────────────────────────────────────

const generarCuerpoAlerta = (oficio, nivel) => {
  const iconos = { amarillo: '🟡', rojo: '🔴' };

  return `
    ${iconos[nivel]} ALERTA ${nivel.toUpperCase()}: Oficio con tiempo vencido

    Número de Oficio : ${oficio.numero_oficio}
    Asunto          : ${oficio.asunto}
    Área Asignada   : ${oficio.area_nombre}
    Prioridad       : ${oficio.prioridad.toUpperCase()}
    Días Transcurridos: ${oficio.dias_transcurridos} días
    Estado Actual   : ${oficio.estado}

    ${nivel === 'rojo'
      ? 'ATENCIÓN INMEDIATA REQUERIDA: Este oficio ha superado el tiempo máximo de respuesta.'
      : 'Por favor atender a la brevedad para evitar incumplimiento de SLA.'
    }

    Acceder al sistema: ${process.env.FRONTEND_URL || 'http://sistema.gob.mx'}
  `.trim();
};

// ─── EJECUTAR JOB DE SEMÁFOROS ────────────────────────────────────────────────

const ejecutarJob = async () => {
  console.log(`\n🔄 [${new Date().toISOString()}] Iniciando job de semáforos...`);

  try {
    // 1. Actualizar todos los semáforos
    const actualizados = await semaforosService.actualizarTodos();
    console.log(`   ✅ ${actualizados.length} semáforos actualizados`);

    // 2. Obtener oficios que requieren alerta
    const oficiosAlertar = await semaforosService.obtenerOficiosParaAlertar();
    console.log(`   📢 ${oficiosAlertar.length} oficios requieren alerta`);

    // 3. Enviar alertas
    let alertasEnviadas = 0;

    for (const oficio of oficiosAlertar) {
      try {
        const nivel = oficio.estado_semaforo;

        // Determinar destinatarios según nivel
        const destinatarios = nivel === 'rojo'
          ? [
              oficio.email_area,
              process.env.EMAIL_ADMIN || 'admin@gobierno.gob.mx',
            ].filter(Boolean)
          : [oficio.email_area].filter(Boolean);

        if (destinatarios.length === 0) continue;

        await enviarEmail({
          to:      destinatarios,
          subject: `${nivel === 'rojo' ? '🔴 URGENTE' : '🟡 AVISO'}: Oficio ${oficio.numero_oficio} — ${oficio.dias_transcurridos} días sin atender`,
          body:    generarCuerpoAlerta(oficio, nivel),
        });

        await semaforosService.marcarAlertaEnviada(oficio.oficio_id);
        alertasEnviadas++;

      } catch (emailErr) {
        console.error(`   ⚠️  Error enviando alerta para oficio ${oficio.numero_oficio}:`, emailErr.message);
      }
    }

    console.log(`   ✉️  ${alertasEnviadas} alertas enviadas`);
    console.log(`✅ Job de semáforos completado\n`);

  } catch (err) {
    console.error('❌ Error en job de semáforos:', err.message);
  }
};

// ─── INICIAR JOB PERIÓDICO ────────────────────────────────────────────────────

const iniciarJob = () => {
  const intervaloMs = parseInt(process.env.SEMAFORO_INTERVALO_MS) || 60 * 60 * 1000; // 1 hora

  console.log(`⏰ Job de semáforos iniciado — intervalo: ${intervaloMs / 1000 / 60} minutos`);

  // Ejecutar inmediatamente al arrancar
  ejecutarJob();

  // Luego cada hora
  setInterval(ejecutarJob, intervaloMs);
};

module.exports = { iniciarJob, ejecutarJob };
