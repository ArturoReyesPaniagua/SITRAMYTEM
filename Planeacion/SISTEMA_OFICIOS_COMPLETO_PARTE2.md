# 📊 DIAGRAMAS DE ESTADO, RIESGOS Y RECOMENDACIONES

## Parte 2: Lógica de Estados y Arquitectura

---

## 5. DIAGRAMA LÓGICO DE ESTADOS

### Máquina de Estados: Oficio Recibido Externo

```
                    [INICIO]
                       │
                       ▼
                  ┌──────────┐
                  │ RECIBIDO │
                  └────┬─────┘
                       │
                       │ Admin asigna a área
                       │
                       ▼
                  ┌──────────┐
                  │ ASIGNADO │
                  └────┬─────┘
                       │
                       │ Área trabaja en respuesta
                       │
                       ▼
                  ┌────────────┐
                  │ EN PROCESO │
                  └────┬───────┘
                       │
                       │ Se carga respuesta (Word + PDF)
                       │
                       ▼
                  ┌────────────┐
                  │ RESPONDIDO │
                  └────┬───────┘
                       │
                       │ Se envía físicamente
                       │
                       ▼
              ┌──────────────────────┐
              │ EN ESPERA DE ACUSE  │
              └────┬────────┬────────┘
                   │        │
    ┌──────────────┘        └──────────────┐
    │                                      │
    │ Se carga acuse (PDF)                 │ Finalización manual
    │ AUTO: estado → finalizado            │ (requiere motivo)
    │                                      │
    ▼                                      ▼
┌─────────────┐                    ┌──────────────┐
│ FINALIZADO  │◄───────────────────│ FINALIZADO   │
│ (con acuse) │                    │ (manual)     │
└─────────────┘                    └──────────────┘

             [EN CUALQUIER MOMENTO]
                       │
                       │ Admin o Área cancela
                       ▼
                  ┌───────────┐
                  │ CANCELADO │
                  └───────────┘
```

### Máquina de Estados: Oficio Iniciado Interno

```
                    [INICIO]
                       │
                       │ Se crea internamente
                       │
                       ▼
                  ┌────────────┐
                  │ EN PROCESO │
                  └────┬───────┘
                       │
                       │ Se carga oficio (Word + PDF + anexos)
                       │
                       ▼
                  ┌────────────┐
                  │ RESPONDIDO │ (Listo para enviar)
                  └────┬───────┘
                       │
                       │ Se envía físicamente
                       │
                       ▼
              ┌──────────────────────┐
              │ EN ESPERA DE ACUSE  │
              └────┬────────┬────────┘
                   │        │
    ┌──────────────┘        └──────────────┐
    │                                      │
    │ Se carga acuse (PDF)                 │ Finalización manual
    │                                      │
    ▼                                      ▼
┌─────────────┐                    ┌──────────────┐
│ FINALIZADO  │                    │ FINALIZADO   │
└─────────────┘                    └──────────────┘
```

### Máquina de Estados: Oficio Informativo

```
                    [INICIO]
                       │
                       │ Se recibe PDF informativo
                       │
                       ▼
                  ┌──────────┐
                  │ RECIBIDO │
                  └────┬─────┘
                       │
                       │ Admin asigna (opcional)
                       │
                       ▼
                  ┌──────────┐
                  │ ASIGNADO │
                  └────┬─────┘
                       │
                       │ No requiere respuesta
                       │ Cierre manual por Admin o Área
                       │
                       ▼
                  ┌────────────┐
                  │ FINALIZADO │
                  └────────────┘
```

### Transiciones de Estado Permitidas

```
Estado Actual          → Estados Permitidos
─────────────────────────────────────────────
recibido              → asignado, cancelado
asignado              → en_proceso, cancelado
en_proceso            → respondido, cancelado
respondido            → en_espera_acuse, cancelado
en_espera_acuse       → finalizado, cancelado
finalizado            → (TERMINAL - no cambia)
cancelado             → (TERMINAL - no cambia)
```

---

## 6. SISTEMA DE SEMÁFOROS

### Lógica de Cálculo

```
Para cada Oficio NO finalizado:

1. Calcular días_transcurridos = DATEDIFF(fecha_recepcion, HOY)

2. Obtener límites según prioridad:
   
   Urgente:
   ├─ Verde: 0-2 días
   ├─ Amarillo: 3-5 días
   └─ Rojo: 5+ días
   
   Normal:
   ├─ Verde: 0-5 días
   ├─ Amarillo: 6-15 días
   └─ Rojo: 15+ días
   
   Informativo:
   ├─ Verde: 0-10 días
   ├─ Amarillo: 11-30 días
   └─ Rojo: 30+ días

3. Asignar color del semáforo:
   
   IF dias_transcurridos >= dias_limite_rojo:
      estado_semaforo = 'rojo'
   ELSE IF dias_transcurridos >= dias_limite_amarillo:
      estado_semaforo = 'amarillo'
   ELSE:
      estado_semaforo = 'verde'

4. Enviar alertas (si aplica):
   
   IF estado_semaforo = 'amarillo' AND alertas_enviadas = 0:
      Enviar email a área asignada
      alertas_enviadas = 1
      fecha_alerta_enviada = HOY
   
   IF estado_semaforo = 'rojo' AND alertas_enviadas = 1:
      Enviar email a área + responsable + admin
      alertas_enviadas = 2
      fecha_alerta_enviada = HOY
```

### Job Programado (SQL Server Agent)

```sql
-- Ejecutar cada hora
USE msdb;
GO

EXEC sp_add_job
    @job_name = N'Actualizar Semáforos Oficios';

EXEC sp_add_jobstep
    @job_name = N'Actualizar Semáforos Oficios',
    @step_name = N'Ejecutar SP',
    @subsystem = N'TSQL',
    @command = N'EXEC sp_actualizar_semaforos;',
    @database_name = N'SistemaOficios';

EXEC sp_add_schedule
    @schedule_name = N'Cada Hora',
    @freq_type = 4,  -- Daily
    @freq_interval = 1,
    @freq_subday_type = 8,  -- Hours
    @freq_subday_interval = 1;

EXEC sp_attach_schedule
    @job_name = N'Actualizar Semáforos Oficios',
    @schedule_name = N'Cada Hora';

EXEC sp_add_jobserver
    @job_name = N'Actualizar Semáforos Oficios';
```

### Vista Dashboard de Semáforos

```sql
CREATE VIEW v_dashboard_semaforos AS
SELECT 
    a.id as area_id,
    a.nombre as area_nombre,
    COUNT(CASE WHEN s.estado_semaforo = 'verde' THEN 1 END) as oficios_verdes,
    COUNT(CASE WHEN s.estado_semaforo = 'amarillo' THEN 1 END) as oficios_amarillos,
    COUNT(CASE WHEN s.estado_semaforo = 'rojo' THEN 1 END) as oficios_rojos,
    COUNT(*) as total_oficios_activos
FROM areas a
LEFT JOIN oficios o ON a.id = o.area_asignada_id
LEFT JOIN semaforo_tiempo s ON o.id = s.oficio_id
WHERE o.estado NOT IN ('finalizado', 'cancelado')
GROUP BY a.id, a.nombre;
```

---

## 7. REGLAS DE VALIDACIÓN COMPLETAS

### A) Validaciones de Autenticación y Permisos

```
1. Login:
   - Username único y activo
   - Password hasheado con bcrypt (min 12 rounds)
   - Registro de último_acceso
   - Máximo 3 intentos fallidos (implementar en app)

2. Permisos Admin:
   - Ver TODOS los oficios
   - Asignar/reasignar cualquier oficio
   - Cambiar prioridad
   - Finalizar cualquier proceso
   - Ver todos los proyectos
   - Gestionar usuarios y áreas

3. Permisos Usuario de Área:
   - Ver SOLO oficios de su área (WHERE area_asignada_id = usuario.area_id)
   - Crear respuestas solo en oficios asignados a su área
   - Finalizar solo procesos de su área
   - Ver SOLO proyectos de su área (WHERE proyecto.area_id = usuario.area_id)
   - Crear proyectos para su área
```

### B) Validaciones de Archivos

```
1. Oficios Recibidos Externos:
   ├─ SOLO PDF
   ├─ Mínimo 1 archivo (oficio principal)
   ├─ Anexos opcionales (todos PDF)
   └─ Tamaño máximo por archivo: 50MB

2. Respuestas (Externos o Internos):
   ├─ Word OBLIGATORIO (editable)
   ├─ PDF OBLIGATORIO (firmado)
   ├─ Anexos opcionales (todos PDF)
   └─ Sin Word o PDF → Error: "Falta archivo obligatorio"

3. Acuses:
   ├─ SOLO PDF
   ├─ Uno por oficio (versionado si se actualiza)
   └─ Trigger automático: estado → finalizado

4. Informativo:
   ├─ SOLO PDF
   └─ No requiere respuesta
```

### C) Validaciones de Estado

```
1. Transiciones Permitidas:
   
   FROM recibido:
   ├─ TO asignado (admin asigna área)
   └─ TO cancelado (admin o área)
   
   FROM asignado:
   ├─ TO en_proceso (área trabaja)
   └─ TO cancelado
   
   FROM en_proceso:
   ├─ TO respondido (archivos subidos)
   └─ TO cancelado
   
   FROM respondido:
   ├─ TO en_espera_acuse (envío físico)
   └─ TO cancelado
   
   FROM en_espera_acuse:
   ├─ TO finalizado (acuse recibido AUTO o manual)
   └─ TO cancelado

2. Estados Terminales:
   - finalizado: NO puede cambiar
   - cancelado: NO puede cambiar

3. Finalización Manual SIN Acuse:
   - REQUIERE motivo obligatorio
   - SOLO admin o área asignada
   - Se registra en historial_estado
```

### D) Validaciones de Proyectos

```
1. Un oficio solo puede pertenecer a UN proyecto
2. Un proyecto pertenece a UN área
3. Solo usuarios de esa área ven el proyecto
4. Admin ve todos los proyectos
5. Un oficio puede existir sin proyecto (proyecto_id NULL)
```

### E) Validaciones de Área

```
1. Usuario tipo 'usuario' DEBE tener area_id
2. Usuario tipo 'admin' NO debe tener area_id (es NULL)
3. Oficios SIEMPRE tienen area_asignada_id
4. Reasignación:
   - Solo admin puede cambiar area_asignada_id
   - Se registra en historial_estado
```

---

## 8. POSIBLES RIESGOS E INCONSISTENCIAS

### Riesgos Identificados

#### 1. **Riesgo: Acceso No Autorizado**

**Problema:**
- Usuario tipo 'usuario' modifica su area_id en memoria o BD
- Usuario accede a oficios de otra área mediante URL directa

**Mitigación:**
```sql
-- Siempre validar en queries
SELECT * FROM oficios 
WHERE id = @oficio_id 
  AND (
    -- Admin ve todo
    @rol_usuario = 'admin' 
    OR 
    -- Usuario solo su área
    area_asignada_id = @area_usuario
  );

-- Trigger para evitar cambios de área no autorizados
CREATE TRIGGER trg_usuarios_area_change
ON usuarios
AFTER UPDATE
AS
BEGIN
    IF UPDATE(area_id)
    BEGIN
        IF EXISTS (
            SELECT 1 FROM inserted i
            INNER JOIN deleted d ON i.id = d.id
            WHERE i.rol = 'usuario' AND i.area_id IS NULL
        )
        BEGIN
            RAISERROR('Usuario tipo usuario debe tener área asignada', 16, 1);
            ROLLBACK;
        END
    END
END;
```

#### 2. **Riesgo: Cambios de Estado Ilegales**

**Problema:**
- Saltar estados (recibido → finalizado directo)
- Cambiar estados terminales

**Mitigación:**
```sql
CREATE TRIGGER trg_validar_transicion_estado
ON oficios
AFTER UPDATE
AS
BEGIN
    DECLARE @estado_anterior NVARCHAR(50);
    DECLARE @estado_nuevo NVARCHAR(50);
    
    SELECT @estado_anterior = d.estado, @estado_nuevo = i.estado
    FROM inserted i
    INNER JOIN deleted d ON i.id = d.id;
    
    -- No permitir cambios de estados terminales
    IF @estado_anterior IN ('finalizado', 'cancelado') AND @estado_anterior != @estado_nuevo
    BEGIN
        RAISERROR('No se puede cambiar un estado terminal', 16, 1);
        ROLLBACK;
        RETURN;
    END
    
    -- Validar transiciones permitidas
    IF NOT EXISTS (
        SELECT 1 FROM (VALUES
            ('recibido', 'asignado'),
            ('recibido', 'cancelado'),
            ('asignado', 'en_proceso'),
            ('asignado', 'cancelado'),
            ('en_proceso', 'respondido'),
            ('en_proceso', 'cancelado'),
            ('respondido', 'en_espera_acuse'),
            ('respondido', 'cancelado'),
            ('en_espera_acuse', 'finalizado'),
            ('en_espera_acuse', 'cancelado')
        ) AS T(estado_ant, estado_nue)
        WHERE T.estado_ant = @estado_anterior AND T.estado_nue = @estado_nuevo
    )
    BEGIN
        RAISERROR('Transición de estado no permitida', 16, 1);
        ROLLBACK;
    END
END;
```

#### 3. **Riesgo: Archivos Huérfanos**

**Problema:**
- Se sube archivo pero no se asocia correctamente
- Se elimina oficio pero archivos quedan en disco

**Mitigación:**
```sql
-- Trigger para limpiar archivos físicos al cancelar
CREATE TRIGGER trg_limpiar_archivos_cancelado
ON oficios
AFTER UPDATE
AS
BEGIN
    IF UPDATE(estado)
    BEGIN
        DECLARE @oficio_id INT;
        DECLARE @estado_nuevo NVARCHAR(50);
        
        SELECT @oficio_id = id, @estado_nuevo = estado
        FROM inserted;
        
        IF @estado_nuevo = 'cancelado'
        BEGIN
            -- Marcar archivos como inactivos (no eliminar físicamente)
            UPDATE archivos_oficio
            SET es_version_activa = 0
            WHERE oficio_id = @oficio_id;
            
            -- Job separado hará limpieza física después de X días
        END
    END
END;
```

#### 4. **Riesgo: Semáforo Desactualizado**

**Problema:**
- Job de actualización falla
- Semáforo muestra estado incorrecto

**Mitigación:**
```sql
-- Calcular semáforo en tiempo real en consultas críticas
CREATE FUNCTION fn_calcular_semaforo_tiempo_real(@oficio_id INT)
RETURNS NVARCHAR(20)
AS
BEGIN
    DECLARE @estado_semaforo NVARCHAR(20);
    DECLARE @dias INT;
    DECLARE @prioridad NVARCHAR(20);
    
    SELECT 
        @dias = DATEDIFF(DAY, fecha_recepcion, GETDATE()),
        @prioridad = prioridad
    FROM oficios WHERE id = @oficio_id;
    
    DECLARE @limite_rojo INT;
    DECLARE @limite_amarillo INT;
    
    SELECT 
        @limite_rojo = dias_rojo,
        @limite_amarillo = dias_verde
    FROM configuracion_semaforo
    WHERE prioridad = @prioridad;
    
    IF @dias >= @limite_rojo
        SET @estado_semaforo = 'rojo';
    ELSE IF @dias >= @limite_amarillo
        SET @estado_semaforo = 'amarillo';
    ELSE
        SET @estado_semaforo = 'verde';
    
    RETURN @estado_semaforo;
END;
```

#### 5. **Riesgo: Concurrencia en Versionado**

**Problema:**
- Dos usuarios suben versión al mismo tiempo
- Versiones duplicadas o perdidas

**Mitigación:**
```sql
-- Usar transacciones con nivel de aislamiento apropiado
ALTER PROCEDURE sp_subir_archivo
    ...
AS
BEGIN
    SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
    BEGIN TRANSACTION;
    
    -- Resto del código...
    
    COMMIT TRANSACTION;
END;
```

---

## 9. RECOMENDACIONES DE ARQUITECTURA

### A) Arquitectura de 3 Capas

```
┌─────────────────────────────────────────┐
│         CAPA DE PRESENTACIÓN            │
│  (React + React Table + Tailwind)       │
│  - Autenticación JWT                    │
│  - Rutas protegidas por rol             │
│  - Componentes por rol                  │
└────────────┬────────────────────────────┘
             │ HTTPS
             │
┌────────────▼────────────────────────────┐
│         CAPA DE APLICACIÓN              │
│  (Node.js + Express)                    │
│  - Middleware de autenticación          │
│  - Middleware de autorización por rol   │
│  - Controladores                        │
│  - Servicios de negocio                 │
│  - Manejo de archivos (Multer)          │
└────────────┬────────────────────────────┘
             │ SQL
             │
┌────────────▼────────────────────────────┐
│         CAPA DE DATOS                   │
│  (SQL Server)                           │
│  - Stored Procedures                    │
│  - Triggers                             │
│  - Vistas                               │
│  - Jobs programados                     │
└─────────────────────────────────────────┘
```

### B) Seguridad

```javascript
// 1. JWT con roles
const payload = {
  userId: user.id,
  username: user.username,
  rol: user.rol,
  areaId: user.area_id
};

const token = jwt.sign(payload, SECRET_KEY, { expiresIn: '8h' });

// 2. Middleware de autenticación
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No autorizado' });
  
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token inválido' });
  }
}

// 3. Middleware de autorización
function requireRole(roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({ error: 'No tiene permisos' });
    }
    next();
  };
}

// 4. Middleware para validar área
function requireOwnArea(req, res, next) {
  const oficioId = req.params.id;
  
  // Si es admin, puede todo
  if (req.user.rol === 'admin') return next();
  
  // Si es usuario, validar que el oficio sea de su área
  db.query('SELECT area_asignada_id FROM oficios WHERE id = ?', [oficioId], (err, rows) => {
    if (rows[0].area_asignada_id !== req.user.areaId) {
      return res.status(403).json({ error: 'Oficio no pertenece a su área' });
    }
    next();
  });
}
```

### C) Almacenamiento de Archivos

```
Opción 1: Local con Estructura Organizada
/uploads
  /oficios
    /2024
      /02
        /area_1
          oficio-001.pdf
          oficio-001-v2.pdf
  /respuestas
    /2024
      /02
        /area_1
          respuesta-001.docx
          respuesta-001.pdf
  /acuses
    /2024
      /02
        acuse-001.pdf

Opción 2: Cloud Storage (Recomendado para producción)
- Azure Blob Storage
- AWS S3
- Google Cloud Storage

Ventajas Cloud:
✓ Escalabilidad
✓ Backup automático
✓ CDN integrado
✓ Versionado nativo
✓ No consume espacio en servidor
```

### D) Notificaciones por Email

```javascript
// Sistema de alertas de semáforo
async function enviarAlertaSemaforo(oficio) {
  const area = await getArea(oficio.area_asignada_id);
  
  if (oficio.semaforo === 'amarillo') {
    // Email a área
    await sendEmail({
      to: area.email_area,
      subject: `⚠️ Oficio ${oficio.numero_oficio} en estado AMARILLO`,
      body: `
        El oficio ${oficio.numero_oficio} lleva ${oficio.dias_transcurridos} días.
        Prioridad: ${oficio.prioridad}
        Estado: ${oficio.estado}
        
        Por favor atender a la brevedad.
      `
    });
  }
  
  if (oficio.semaforo === 'rojo') {
    // Email a área + responsable + admin
    await sendEmail({
      to: [area.email_area, area.responsable_email, 'admin@institucion.gob.mx'],
      subject: `🔴 URGENTE: Oficio ${oficio.numero_oficio} en estado ROJO`,
      body: `
        ALERTA: El oficio ${oficio.numero_oficio} lleva ${oficio.dias_transcurridos} días sin resolverse.
        
        Acción requerida inmediata.
      `
    });
  }
}
```

### E) Logging y Auditoría

```sql
-- Tabla de logs de sistema
CREATE TABLE logs_sistema (
    id INT PRIMARY KEY IDENTITY(1,1),
    usuario_id INT,
    accion NVARCHAR(100),
    entidad NVARCHAR(50),
    entidad_id INT,
    detalles NVARCHAR(MAX),
    ip_address NVARCHAR(50),
    user_agent NVARCHAR(500),
    fecha DATETIME DEFAULT GETDATE(),
    
    CONSTRAINT FK_logs_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- Ejemplos de log:
-- "Usuario juan.perez asignó oficio 123 a área Jurídico"
-- "Admin cambió prioridad de oficio 456 de Normal a Urgente"
-- "Usuario maria.lopez subió archivo respuesta-789.pdf para oficio 789"
```

---

Continúa en la última parte con Casos de Uso y Flujos Completos...
