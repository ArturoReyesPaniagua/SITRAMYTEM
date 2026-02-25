# 📊 MODELO ENTIDAD-RELACIÓN Y DISEÑO DE BASE DE DATOS

## Sistema de Gestión de Oficios con Autenticación y Flujos de Proceso

---

## 1. MODELO ENTIDAD-RELACIÓN

### Entidades Principales

```
┌─────────────────┐
│     USUARIO     │
├─────────────────┤
│ id (PK)         │
│ username        │
│ password_hash   │
│ nombre_completo │
│ email           │
│ rol             │ (admin / usuario)
│ area_id (FK)    │ (NULL si es admin)
│ activo          │
│ ultimo_acceso   │
│ fecha_creacion  │
└─────────────────┘
        │
        │ 1:1
        ▼
┌─────────────────┐
│      AREA       │
├─────────────────┤
│ id (PK)         │
│ nombre          │
│ descripcion     │
│ responsable     │
│ email_area      │
│ activo          │
└─────────────────┘
        │
        │ 1:N
        ▼
┌─────────────────┐
│    PROYECTO     │
├─────────────────┤
│ id (PK)         │
│ nombre          │
│ descripcion     │
│ area_id (FK)    │
│ creado_por (FK) │
│ fecha_inicio    │
│ fecha_fin       │
│ estado          │
│ activo          │
└─────────────────┘
        │
        │ 1:N
        ▼
┌─────────────────┐
│     OFICIO      │
├─────────────────┤
│ id (PK)         │
│ numero_oficio   │
│ tipo_proceso    │ (recibido_externo / iniciado_interno / informativo)
│ prioridad       │ (urgente / normal / informativo)
│ estado          │ (recibido / asignado / en_proceso / respondido / en_espera_acuse / finalizado / cancelado)
│ proyecto_id (FK)│ (NULL si no tiene)
│ area_asignada   │ (FK a AREA)
│ promovente      │
│ destinatario    │
│ asunto          │
│ fecha_recepcion │
│ fecha_asignacion│
│ fecha_respuesta │
│ fecha_acuse     │
│ fecha_finalizacion│
│ motivo_finalizacion_manual│
│ observaciones   │
│ creado_por (FK) │
│ modificado_por  │
│ fecha_creacion  │
│ fecha_modificacion│
└─────────────────┘
        │
        ├─────────────┐
        │ 1:N         │ 1:N
        ▼             ▼
┌─────────────────┐ ┌─────────────────┐
│ ARCHIVO_OFICIO  │ │ HISTORIAL_ESTADO│
├─────────────────┤ ├─────────────────┤
│ id (PK)         │ │ id (PK)         │
│ oficio_id (FK)  │ │ oficio_id (FK)  │
│ tipo_archivo    │ │ estado_anterior │
│ categoria       │ │ estado_nuevo    │
│ nombre_archivo  │ │ usuario_id (FK) │
│ ruta_archivo    │ │ motivo          │
│ tamano_bytes    │ │ fecha_cambio    │
│ version         │ └─────────────────┘
│ es_version_activa│
│ subido_por (FK) │
│ fecha_subida    │
└─────────────────┘
        │
        │ 1:1
        ▼
┌─────────────────┐
│ SEMAFORO_TIEMPO │
├─────────────────┤
│ id (PK)         │
│ oficio_id (FK)  │
│ estado_semaforo │ (verde / amarillo / rojo)
│ dias_transcurridos│
│ dias_limite_amarillo│
│ dias_limite_rojo│
│ fecha_alerta_enviada│
│ alertas_enviadas│
│ fecha_calculo   │
└─────────────────┘
```

### Relaciones

```
USUARIO (1) ──── (0:1) AREA
   │
   │ crea
   ▼
PROYECTO (N) ──── (1) AREA
   │
   │ agrupa
   ▼
OFICIO (N) ──── (1) AREA (asignada)
   │
   ├──── (N) ARCHIVO_OFICIO
   ├──── (N) HISTORIAL_ESTADO
   └──── (1) SEMAFORO_TIEMPO
```

---

## 2. DISEÑO DE BASE DE DATOS (SQL Server)

### Tabla: usuarios

```sql
CREATE TABLE usuarios (
    id INT PRIMARY KEY IDENTITY(1,1),
    username NVARCHAR(50) UNIQUE NOT NULL,
    password_hash NVARCHAR(255) NOT NULL,
    nombre_completo NVARCHAR(255) NOT NULL,
    email NVARCHAR(255) UNIQUE NOT NULL,
    rol NVARCHAR(20) NOT NULL CHECK (rol IN ('admin', 'usuario')),
    area_id INT NULL,  -- NULL si es admin
    activo BIT DEFAULT 1,
    ultimo_acceso DATETIME NULL,
    fecha_creacion DATETIME DEFAULT GETDATE(),
    
    CONSTRAINT FK_usuarios_area FOREIGN KEY (area_id) REFERENCES areas(id)
);

-- Índices
CREATE INDEX idx_usuarios_username ON usuarios(username);
CREATE INDEX idx_usuarios_rol ON usuarios(rol);
CREATE INDEX idx_usuarios_area ON usuarios(area_id);
```

### Tabla: areas

```sql
CREATE TABLE areas (
    id INT PRIMARY KEY IDENTITY(1,1),
    nombre NVARCHAR(255) UNIQUE NOT NULL,
    descripcion NVARCHAR(MAX),
    responsable NVARCHAR(255),
    email_area NVARCHAR(255),
    activo BIT DEFAULT 1,
    fecha_creacion DATETIME DEFAULT GETDATE()
);

-- Índices
CREATE INDEX idx_areas_nombre ON areas(nombre);
CREATE INDEX idx_areas_activo ON areas(activo);
```

### Tabla: proyectos

```sql
CREATE TABLE proyectos (
    id INT PRIMARY KEY IDENTITY(1,1),
    nombre NVARCHAR(255) NOT NULL,
    descripcion NVARCHAR(MAX),
    area_id INT NOT NULL,
    creado_por INT NOT NULL,
    fecha_inicio DATE,
    fecha_fin DATE,
    estado NVARCHAR(50) DEFAULT 'Activo' CHECK (estado IN ('Activo', 'Finalizado', 'Cancelado')),
    activo BIT DEFAULT 1,
    fecha_creacion DATETIME DEFAULT GETDATE(),
    
    CONSTRAINT FK_proyectos_area FOREIGN KEY (area_id) REFERENCES areas(id),
    CONSTRAINT FK_proyectos_usuario FOREIGN KEY (creado_por) REFERENCES usuarios(id)
);

-- Índices
CREATE INDEX idx_proyectos_area ON proyectos(area_id);
CREATE INDEX idx_proyectos_estado ON proyectos(estado);
CREATE INDEX idx_proyectos_creado_por ON proyectos(creado_por);
```

### Tabla: oficios

```sql
CREATE TABLE oficios (
    id INT PRIMARY KEY IDENTITY(1,1),
    numero_oficio NVARCHAR(100) UNIQUE NOT NULL,
    tipo_proceso NVARCHAR(50) NOT NULL 
        CHECK (tipo_proceso IN ('recibido_externo', 'iniciado_interno', 'informativo')),
    prioridad NVARCHAR(20) NOT NULL 
        CHECK (prioridad IN ('urgente', 'normal', 'informativo')),
    estado NVARCHAR(50) NOT NULL DEFAULT 'recibido'
        CHECK (estado IN ('recibido', 'asignado', 'en_proceso', 'respondido', 
                          'en_espera_acuse', 'finalizado', 'cancelado')),
    
    -- Relaciones
    proyecto_id INT NULL,
    area_asignada_id INT NOT NULL,
    
    -- Información del oficio
    promovente NVARCHAR(255),
    destinatario NVARCHAR(255),
    asunto NVARCHAR(MAX) NOT NULL,
    
    -- Fechas del proceso
    fecha_recepcion DATETIME NOT NULL,
    fecha_asignacion DATETIME NULL,
    fecha_respuesta DATETIME NULL,
    fecha_acuse DATETIME NULL,
    fecha_finalizacion DATETIME NULL,
    
    -- Finalización manual
    motivo_finalizacion_manual NVARCHAR(MAX) NULL,
    
    -- Observaciones
    observaciones NVARCHAR(MAX),
    
    -- Auditoría
    creado_por INT NOT NULL,
    modificado_por INT NULL,
    fecha_creacion DATETIME DEFAULT GETDATE(),
    fecha_modificacion DATETIME DEFAULT GETDATE(),
    
    CONSTRAINT FK_oficios_proyecto FOREIGN KEY (proyecto_id) REFERENCES proyectos(id),
    CONSTRAINT FK_oficios_area FOREIGN KEY (area_asignada_id) REFERENCES areas(id),
    CONSTRAINT FK_oficios_creado_por FOREIGN KEY (creado_por) REFERENCES usuarios(id),
    CONSTRAINT FK_oficios_modificado_por FOREIGN KEY (modificado_por) REFERENCES usuarios(id)
);

-- Índices para búsqueda y filtrado
CREATE INDEX idx_oficios_numero ON oficios(numero_oficio);
CREATE INDEX idx_oficios_tipo ON oficios(tipo_proceso);
CREATE INDEX idx_oficios_prioridad ON oficios(prioridad);
CREATE INDEX idx_oficios_estado ON oficios(estado);
CREATE INDEX idx_oficios_area ON oficios(area_asignada_id);
CREATE INDEX idx_oficios_proyecto ON oficios(proyecto_id);
CREATE INDEX idx_oficios_fecha_recepcion ON oficios(fecha_recepcion);
CREATE INDEX idx_oficios_creado_por ON oficios(creado_por);

-- Índice compuesto para semáforo
CREATE INDEX idx_oficios_estado_fecha ON oficios(estado, fecha_recepcion);
```

### Tabla: archivos_oficio

```sql
CREATE TABLE archivos_oficio (
    id INT PRIMARY KEY IDENTITY(1,1),
    oficio_id INT NOT NULL,
    
    -- Tipo de archivo
    tipo_archivo NVARCHAR(50) NOT NULL 
        CHECK (tipo_archivo IN ('pdf', 'word', 'anexo')),
    
    -- Categoría según el flujo
    categoria NVARCHAR(50) NOT NULL
        CHECK (categoria IN ('oficio_recibido', 'oficio_respuesta_word', 
                            'oficio_respuesta_pdf', 'anexo', 'acuse')),
    
    -- Información del archivo
    nombre_archivo NVARCHAR(255) NOT NULL,
    ruta_archivo NVARCHAR(500) NOT NULL,
    tamano_bytes BIGINT NOT NULL,
    
    -- Versionado
    version INT DEFAULT 1,
    es_version_activa BIT DEFAULT 1,
    
    -- Auditoría
    subido_por INT NOT NULL,
    fecha_subida DATETIME DEFAULT GETDATE(),
    
    CONSTRAINT FK_archivos_oficio FOREIGN KEY (oficio_id) REFERENCES oficios(id),
    CONSTRAINT FK_archivos_usuario FOREIGN KEY (subido_por) REFERENCES usuarios(id)
);

-- Índices
CREATE INDEX idx_archivos_oficio ON archivos_oficio(oficio_id);
CREATE INDEX idx_archivos_categoria ON archivos_oficio(categoria);
CREATE INDEX idx_archivos_version_activa ON archivos_oficio(es_version_activa);
```

### Tabla: historial_estado

```sql
CREATE TABLE historial_estado (
    id INT PRIMARY KEY IDENTITY(1,1),
    oficio_id INT NOT NULL,
    estado_anterior NVARCHAR(50) NOT NULL,
    estado_nuevo NVARCHAR(50) NOT NULL,
    usuario_id INT NOT NULL,
    motivo NVARCHAR(MAX),
    fecha_cambio DATETIME DEFAULT GETDATE(),
    
    CONSTRAINT FK_historial_oficio FOREIGN KEY (oficio_id) REFERENCES oficios(id),
    CONSTRAINT FK_historial_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- Índices
CREATE INDEX idx_historial_oficio ON historial_estado(oficio_id);
CREATE INDEX idx_historial_fecha ON historial_estado(fecha_cambio);
```

### Tabla: semaforo_tiempo

```sql
CREATE TABLE semaforo_tiempo (
    id INT PRIMARY KEY IDENTITY(1,1),
    oficio_id INT UNIQUE NOT NULL,
    
    -- Estado del semáforo
    estado_semaforo NVARCHAR(20) NOT NULL 
        CHECK (estado_semaforo IN ('verde', 'amarillo', 'rojo')),
    
    -- Cálculos de tiempo
    dias_transcurridos INT NOT NULL DEFAULT 0,
    dias_limite_amarillo INT NOT NULL DEFAULT 5,  -- Configurable por prioridad
    dias_limite_rojo INT NOT NULL DEFAULT 10,     -- Configurable por prioridad
    
    -- Alertas
    fecha_alerta_enviada DATETIME NULL,
    alertas_enviadas INT DEFAULT 0,
    
    -- Última actualización
    fecha_calculo DATETIME DEFAULT GETDATE(),
    
    CONSTRAINT FK_semaforo_oficio FOREIGN KEY (oficio_id) REFERENCES oficios(id)
);

-- Índices
CREATE INDEX idx_semaforo_estado ON semaforo_tiempo(estado_semaforo);
CREATE INDEX idx_semaforo_oficio ON semaforo_tiempo(oficio_id);
```

### Tabla: configuracion_semaforo

```sql
CREATE TABLE configuracion_semaforo (
    id INT PRIMARY KEY IDENTITY(1,1),
    prioridad NVARCHAR(20) UNIQUE NOT NULL,
    dias_verde INT NOT NULL,      -- Días en verde
    dias_amarillo INT NOT NULL,   -- Días adicionales para amarillo
    dias_rojo INT NOT NULL,       -- Total de días para rojo
    activo BIT DEFAULT 1
);

-- Valores por defecto
INSERT INTO configuracion_semaforo (prioridad, dias_verde, dias_amarillo, dias_rojo)
VALUES 
    ('urgente', 2, 3, 5),          -- Verde: 0-2, Amarillo: 3-5, Rojo: 5+
    ('normal', 5, 10, 15),         -- Verde: 0-5, Amarillo: 6-15, Rojo: 15+
    ('informativo', 10, 20, 30);   -- Verde: 0-10, Amarillo: 11-30, Rojo: 30+
```

---

## 3. VISTAS ÚTILES

### Vista: v_oficios_con_semaforo

```sql
CREATE VIEW v_oficios_con_semaforo AS
SELECT 
    o.id,
    o.numero_oficio,
    o.tipo_proceso,
    o.prioridad,
    o.estado,
    o.asunto,
    o.promovente,
    o.destinatario,
    o.fecha_recepcion,
    o.area_asignada_id,
    a.nombre as area_nombre,
    p.nombre as proyecto_nombre,
    s.estado_semaforo,
    s.dias_transcurridos,
    CASE 
        WHEN s.estado_semaforo = 'rojo' THEN '🔴'
        WHEN s.estado_semaforo = 'amarillo' THEN '🟡'
        ELSE '🟢'
    END as icono_semaforo,
    u.nombre_completo as creado_por_nombre
FROM oficios o
LEFT JOIN areas a ON o.area_asignada_id = a.id
LEFT JOIN proyectos p ON o.proyecto_id = p.id
LEFT JOIN semaforo_tiempo s ON o.id = s.oficio_id
LEFT JOIN usuarios u ON o.creado_por = u.id;
```

### Vista: v_oficios_por_area

```sql
CREATE VIEW v_oficios_por_area AS
SELECT 
    area_asignada_id,
    COUNT(*) as total_oficios,
    SUM(CASE WHEN estado = 'finalizado' THEN 1 ELSE 0 END) as finalizados,
    SUM(CASE WHEN estado IN ('recibido', 'asignado', 'en_proceso') THEN 1 ELSE 0 END) as en_proceso,
    SUM(CASE WHEN estado = 'en_espera_acuse' THEN 1 ELSE 0 END) as esperando_acuse
FROM oficios
GROUP BY area_asignada_id;
```

---

## 4. REGLAS DE VALIDACIÓN

### Validaciones a Nivel de Base de Datos

```sql
-- 1. Solo admin puede ver todos los oficios
-- Implementado en lógica de aplicación con filtros dinámicos

-- 2. No permitir eliminar oficios, solo cancelar
-- No existe DELETE, solo UPDATE estado = 'cancelado'

-- 3. Validar archivos según tipo de proceso
ALTER TABLE archivos_oficio
ADD CONSTRAINT CHK_archivos_categoria_tipo 
CHECK (
    (categoria = 'oficio_recibido' AND tipo_archivo = 'pdf') OR
    (categoria = 'oficio_respuesta_word' AND tipo_archivo = 'word') OR
    (categoria = 'oficio_respuesta_pdf' AND tipo_archivo = 'pdf') OR
    (categoria = 'anexo' AND tipo_archivo = 'pdf') OR
    (categoria = 'acuse' AND tipo_archivo = 'pdf')
);

-- 4. Validar que usuario de área tenga área asignada
ALTER TABLE usuarios
ADD CONSTRAINT CHK_usuario_area
CHECK (
    (rol = 'admin' AND area_id IS NULL) OR
    (rol = 'usuario' AND area_id IS NOT NULL)
);

-- 5. Solo una versión activa por archivo
CREATE UNIQUE INDEX idx_archivo_unico_activo 
ON archivos_oficio(oficio_id, categoria, tipo_archivo)
WHERE es_version_activa = 1;
```

### Stored Procedures para Lógica de Negocio

#### SP: Cambiar Estado de Oficio

```sql
CREATE PROCEDURE sp_cambiar_estado_oficio
    @oficio_id INT,
    @nuevo_estado NVARCHAR(50),
    @usuario_id INT,
    @motivo NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @estado_actual NVARCHAR(50);
    DECLARE @area_usuario INT;
    DECLARE @area_oficio INT;
    DECLARE @rol_usuario NVARCHAR(20);
    
    -- Obtener información actual
    SELECT @estado_actual = estado, @area_oficio = area_asignada_id
    FROM oficios WHERE id = @oficio_id;
    
    SELECT @rol_usuario = rol, @area_usuario = area_id
    FROM usuarios WHERE id = @usuario_id;
    
    -- Validar permisos
    IF @rol_usuario = 'usuario' AND @area_usuario != @area_oficio
    BEGIN
        RAISERROR('No tiene permisos para modificar este oficio', 16, 1);
        RETURN;
    END
    
    -- Validar transición de estado
    IF @nuevo_estado = 'finalizado' AND @motivo IS NULL AND 
       NOT EXISTS (SELECT 1 FROM archivos_oficio 
                   WHERE oficio_id = @oficio_id AND categoria = 'acuse')
    BEGIN
        RAISERROR('Se requiere motivo para finalización manual sin acuse', 16, 1);
        RETURN;
    END
    
    BEGIN TRANSACTION;
    
    -- Registrar en historial
    INSERT INTO historial_estado (oficio_id, estado_anterior, estado_nuevo, usuario_id, motivo)
    VALUES (@oficio_id, @estado_actual, @nuevo_estado, @usuario_id, @motivo);
    
    -- Actualizar oficio
    UPDATE oficios
    SET estado = @nuevo_estado,
        modificado_por = @usuario_id,
        fecha_modificacion = GETDATE(),
        fecha_finalizacion = CASE WHEN @nuevo_estado = 'finalizado' THEN GETDATE() ELSE fecha_finalizacion END,
        motivo_finalizacion_manual = CASE WHEN @nuevo_estado = 'finalizado' THEN @motivo ELSE motivo_finalizacion_manual END
    WHERE id = @oficio_id;
    
    COMMIT TRANSACTION;
END;
```

#### SP: Subir Archivo con Auto-cambio de Estado

```sql
CREATE PROCEDURE sp_subir_archivo
    @oficio_id INT,
    @categoria NVARCHAR(50),
    @tipo_archivo NVARCHAR(50),
    @nombre_archivo NVARCHAR(255),
    @ruta_archivo NVARCHAR(500),
    @tamano_bytes BIGINT,
    @usuario_id INT
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @estado_actual NVARCHAR(50);
    
    SELECT @estado_actual = estado FROM oficios WHERE id = @oficio_id;
    
    BEGIN TRANSACTION;
    
    -- Desactivar versión anterior si existe
    UPDATE archivos_oficio
    SET es_version_activa = 0
    WHERE oficio_id = @oficio_id 
      AND categoria = @categoria 
      AND tipo_archivo = @tipo_archivo
      AND es_version_activa = 1;
    
    -- Calcular nueva versión
    DECLARE @nueva_version INT = 1;
    SELECT @nueva_version = ISNULL(MAX(version), 0) + 1
    FROM archivos_oficio
    WHERE oficio_id = @oficio_id AND categoria = @categoria AND tipo_archivo = @tipo_archivo;
    
    -- Insertar nuevo archivo
    INSERT INTO archivos_oficio 
    (oficio_id, tipo_archivo, categoria, nombre_archivo, ruta_archivo, 
     tamano_bytes, version, es_version_activa, subido_por)
    VALUES 
    (@oficio_id, @tipo_archivo, @categoria, @nombre_archivo, @ruta_archivo,
     @tamano_bytes, @nueva_version, 1, @usuario_id);
    
    -- Auto-cambio de estado si es acuse
    IF @categoria = 'acuse' AND @estado_actual = 'en_espera_acuse'
    BEGIN
        EXEC sp_cambiar_estado_oficio 
            @oficio_id = @oficio_id,
            @nuevo_estado = 'finalizado',
            @usuario_id = @usuario_id,
            @motivo = 'Acuse recibido automáticamente';
    END
    
    COMMIT TRANSACTION;
END;
```

#### SP: Actualizar Semáforos (Job Programado)

```sql
CREATE PROCEDURE sp_actualizar_semaforos
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Actualizar semáforos para todos los oficios no finalizados
    UPDATE s
    SET 
        dias_transcurridos = DATEDIFF(DAY, o.fecha_recepcion, GETDATE()),
        estado_semaforo = CASE 
            WHEN DATEDIFF(DAY, o.fecha_recepcion, GETDATE()) >= c.dias_rojo THEN 'rojo'
            WHEN DATEDIFF(DAY, o.fecha_recepcion, GETDATE()) >= c.dias_verde THEN 'amarillo'
            ELSE 'verde'
        END,
        dias_limite_amarillo = c.dias_verde,
        dias_limite_rojo = c.dias_rojo,
        fecha_calculo = GETDATE()
    FROM semaforo_tiempo s
    INNER JOIN oficios o ON s.oficio_id = o.id
    INNER JOIN configuracion_semaforo c ON o.prioridad = c.prioridad
    WHERE o.estado NOT IN ('finalizado', 'cancelado');
    
    -- Crear semáforos para oficios nuevos
    INSERT INTO semaforo_tiempo (oficio_id, estado_semaforo, dias_transcurridos, dias_limite_amarillo, dias_limite_rojo)
    SELECT 
        o.id,
        'verde',
        0,
        c.dias_verde,
        c.dias_rojo
    FROM oficios o
    INNER JOIN configuracion_semaforo c ON o.prioridad = c.prioridad
    WHERE NOT EXISTS (SELECT 1 FROM semaforo_tiempo WHERE oficio_id = o.id)
      AND o.estado NOT IN ('finalizado', 'cancelado');
END;
```

---

Continúa en la siguiente parte con Diagramas de Estados, Riesgos y Recomendaciones...
