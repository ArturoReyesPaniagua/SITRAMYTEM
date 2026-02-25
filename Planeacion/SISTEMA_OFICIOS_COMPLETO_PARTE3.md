# 🔄 FLUJOS COMPLETOS Y ESPECIFICACIÓN TÉCNICA

## Parte 3: Casos de Uso, Flujos y Resumen Ejecutivo

---

## 10. CASOS DE USO DETALLADOS

### Caso 1: Oficio Recibido Externo - Flujo Completo

```
ACTOR: Usuario Admin

PASO 1: Recepción del Oficio
├─ 09:00 - Llega oficio físico a la institución
├─ Admin escanea documento principal
├─ Admin escanea 2 anexos
└─ Archivos: oficio.pdf + anexo1.pdf + anexo2.pdf

PASO 2: Registro en Sistema
├─ Admin hace login
├─ Navega a "Nuevo Oficio"
├─ Selecciona tipo: "Recibido Externo"
├─ Asigna prioridad: "Urgente"
├─ Llena datos:
│  ├─ Número: "EXT-2024-001"
│  ├─ Promovente: "Secretaría de Educación"
│  ├─ Destinatario: "Director General"
│  ├─ Asunto: "Solicitud de información estadística Q1 2024"
│  └─ Fecha recepción: 17/02/2024 09:00
├─ Sube archivos:
│  ├─ oficio.pdf (categoría: oficio_recibido)
│  ├─ anexo1.pdf (categoría: anexo)
│  └─ anexo2.pdf (categoría: anexo)
└─ Click "Guardar"

RESULTADO BD:
├─ INSERT INTO oficios (estado = 'recibido', tipo_proceso = 'recibido_externo')
├─ INSERT INTO archivos_oficio × 3
├─ INSERT INTO semaforo_tiempo (estado_semaforo = 'verde', dias_limite_rojo = 5)
└─ INSERT INTO historial_estado (estado_nuevo = 'recibido')

PASO 3: Asignación a Área
├─ Admin revisa oficio
├─ Click "Asignar"
├─ Selecciona área: "Dirección de Planeación"
├─ Click "Confirmar"

RESULTADO BD:
├─ UPDATE oficios SET estado = 'asignado', area_asignada_id = 3, fecha_asignacion = NOW
└─ INSERT INTO historial_estado (estado_anterior = 'recibido', estado_nuevo = 'asignado')

─────────────────────────────────────────────────────

ACTOR: Usuario de Área (Dirección de Planeación)

PASO 4: Área Recibe Notificación
├─ Email automático: "Nuevo oficio asignado: EXT-2024-001"
├─ Usuario hace login
├─ Dashboard muestra:
│  └─ 1 oficio nuevo (badge con número)

PASO 5: Área Trabaja en Respuesta
├─ Click en oficio "EXT-2024-001"
├─ Ve archivos adjuntos
├─ Descarga y revisa documentos
├─ Click "Iniciar Respuesta"
│  └─ Estado cambia a 'en_proceso'
├─ Trabaja offline en Word
│  └─ Genera respuesta.docx
├─ Solicita firma del Director
│  └─ Genera respuesta_firmada.pdf

PASO 6: Carga de Respuesta
├─ En sistema, click "Subir Respuesta"
├─ Sube archivos:
│  ├─ respuesta.docx (categoría: oficio_respuesta_word) ✓ Obligatorio
│  ├─ respuesta_firmada.pdf (categoría: oficio_respuesta_pdf) ✓ Obligatorio
│  └─ estadisticas.pdf (categoría: anexo)
├─ Click "Confirmar Respuesta"

RESULTADO BD:
├─ INSERT INTO archivos_oficio × 3
├─ UPDATE oficios SET estado = 'respondido', fecha_respuesta = NOW
└─ INSERT INTO historial_estado (estado_nuevo = 'respondido')

PASO 7: Envío Físico
├─ Área imprime oficio firmado
├─ Mensajería lleva documento físicamente
├─ Usuario marca en sistema:
│  └─ Click "Marcar como Enviado"

RESULTADO BD:
├─ UPDATE oficios SET estado = 'en_espera_acuse'
└─ INSERT INTO historial_estado (estado_nuevo = 'en_espera_acuse')

SEMÁFORO:
├─ DÍA 1-2: 🟢 Verde (todo normal)
├─ DÍA 3-5: 🟡 Amarillo (envía alerta a área)
├─ DÍA 5+: 🔴 Rojo (alerta a área + responsable + admin)

PASO 8: Recepción de Acuse
├─ 3 días después: Llega acuse firmado
├─ Área escanea acuse
├─ Sube en sistema:
│  └─ acuse.pdf (categoría: acuse)

RESULTADO BD (AUTOMÁTICO):
├─ INSERT INTO archivos_oficio (categoria = 'acuse')
├─ UPDATE oficios SET estado = 'finalizado', fecha_acuse = NOW, fecha_finalizacion = NOW
├─ INSERT INTO historial_estado (motivo = 'Acuse recibido automáticamente')
└─ UPDATE semaforo_tiempo (inactivo - oficio finalizado)

FIN DEL PROCESO
Tiempo total: 3 días
Estado final: ✓ Finalizado con acuse
```

---

### Caso 2: Oficio Iniciado Internamente

```
ACTOR: Usuario de Área (Departamento Legal)

PASO 1: Creación de Oficio Interno
├─ Usuario hace login
├─ Navega a "Nuevo Oficio"
├─ Selecciona tipo: "Iniciado Internamente"
├─ Selecciona prioridad: "Normal"
├─ Llena datos:
│  ├─ Número: "INT-LEGAL-2024-045"
│  ├─ Destinatario: "Juzgado Tercero Administrativo"
│  ├─ Asunto: "Contestación de demanda laboral exp. 123/2024"
│  └─ Fecha: 17/02/2024
└─ Click "Crear Borrador"

RESULTADO BD:
├─ INSERT INTO oficios (estado = 'en_proceso', tipo_proceso = 'iniciado_interno')
└─ INSERT INTO semaforo_tiempo (dias_limite_rojo = 15)

PASO 2: Elaboración de Oficio
├─ Área trabaja offline en Word
├─ Genera oficio.docx
├─ Solicita firma del titular
├─ Genera oficio_firmado.pdf
├─ Prepara anexos probatorios (pruebas.pdf)

PASO 3: Carga de Documentos
├─ Click "Subir Documentos"
├─ Sube:
│  ├─ oficio.docx (categoría: oficio_respuesta_word)
│  ├─ oficio_firmado.pdf (categoría: oficio_respuesta_pdf)
│  └─ pruebas.pdf (categoría: anexo)
├─ Click "Marcar como Listo"

RESULTADO BD:
├─ INSERT INTO archivos_oficio × 3
├─ UPDATE oficios SET estado = 'respondido'
└─ Estado: 'respondido' significa "listo para enviar"

PASO 4: Envío Físico
├─ Mensajería entrega en Juzgado
├─ Usuario marca:
│  └─ "Enviado Físicamente"

RESULTADO BD:
├─ UPDATE oficios SET estado = 'en_espera_acuse'
└─ Espera acuse del juzgado

PASO 5: Recepción de Acuse
├─ Juzgado devuelve acuse sellado
├─ Área escanea y sube acuse.pdf

RESULTADO BD (AUTOMÁTICO):
├─ INSERT INTO archivos_oficio (categoria = 'acuse')
├─ UPDATE oficios SET estado = 'finalizado'
└─ Proceso completado

FIN DEL PROCESO
```

---

### Caso 3: Oficio Informativo

```
ACTOR: Admin

PASO 1: Recepción
├─ Llega circular informativa en PDF
├─ Admin registra en sistema
├─ Tipo: "Informativo"
├─ Prioridad: "Informativo"
├─ Sube circular.pdf

PASO 2: Asignación (Opcional)
├─ Admin asigna a área para conocimiento
├─ Área: "Recursos Humanos"
├─ Estado: 'asignado'

PASO 3: Cierre
├─ No requiere respuesta
├─ Admin o Área marca:
│  └─ "Finalizar" (motivo: "Circular leída y archivada")

RESULTADO BD:
└─ UPDATE oficios SET estado = 'finalizado', motivo_finalizacion_manual = '...'

FIN (rápido)
```

---

## 11. MATRIZ DE PERMISOS

### Tabla de Permisos Detallada

| Acción | Admin | Usuario Área | Condición |
|--------|-------|--------------|-----------|
| **Ver oficios propios** | ✅ | ✅ | Usuario: solo su área |
| **Ver oficios de otras áreas** | ✅ | ❌ | - |
| **Ver todos los oficios** | ✅ | ❌ | - |
| **Crear oficio recibido externo** | ✅ | ❌ | - |
| **Crear oficio iniciado interno** | ✅ | ✅ | En su área |
| **Crear oficio informativo** | ✅ | ❌ | - |
| **Asignar oficio a área** | ✅ | ❌ | - |
| **Reasignar oficio** | ✅ | ❌ | - |
| **Cambiar prioridad** | ✅ | ❌ | - |
| **Cambiar estado a 'en_proceso'** | ✅ | ✅ | Si es de su área |
| **Subir respuesta** | ✅ | ✅ | Si es de su área |
| **Subir acuse** | ✅ | ✅ | Si es de su área |
| **Finalizar oficio (con acuse)** | AUTO | AUTO | Automático al subir acuse |
| **Finalizar oficio (manual sin acuse)** | ✅ | ✅ | Con motivo obligatorio |
| **Cancelar oficio** | ✅ | ✅ | Con motivo obligatorio |
| **Ver proyectos propios** | ✅ | ✅ | Usuario: solo su área |
| **Ver todos los proyectos** | ✅ | ❌ | - |
| **Crear proyecto** | ✅ | ✅ | En su área |
| **Editar proyecto** | ✅ | ✅ | Si es de su área |
| **Asignar oficio a proyecto** | ✅ | ✅ | Si ambos son de su área |
| **Ver semáforos** | ✅ | ✅ | Usuario: solo su área |
| **Configurar límites de semáforo** | ✅ | ❌ | - |
| **Ver dashboard completo** | ✅ | ❌ | - |
| **Ver dashboard de área** | ✅ | ✅ | Usuario: solo su área |
| **Gestionar usuarios** | ✅ | ❌ | - |
| **Gestionar áreas** | ✅ | ❌ | - |
| **Ver logs del sistema** | ✅ | ❌ | - |
| **Descargar archivos** | ✅ | ✅ | De oficios que puede ver |
| **Eliminar archivos** | ❌ | ❌ | Solo versionado |
| **Eliminar oficios** | ❌ | ❌ | Solo cancelar |

---

## 12. ENDPOINTS API REQUERIDOS

### Autenticación

```
POST   /api/auth/login
       Body: { username, password }
       Response: { token, user: { id, username, rol, area_id } }

POST   /api/auth/logout
       Header: Authorization: Bearer {token}
       
GET    /api/auth/me
       Header: Authorization: Bearer {token}
       Response: { user info }
```

### Oficios

```
GET    /api/oficios
       Query: ?tipo=, ?prioridad=, ?estado=, ?area=
       Header: Authorization
       Response: Lista filtrada según rol
       - Admin: todos
       - Usuario: solo su área

GET    /api/oficios/:id
       Validar: admin o área propia
       
POST   /api/oficios
       Body: { numero_oficio, tipo_proceso, prioridad, area_asignada_id, ... }
       Validar: permisos según tipo
       
PUT    /api/oficios/:id
       Body: { campos a actualizar }
       Validar: permisos
       
POST   /api/oficios/:id/asignar
       Body: { area_id }
       Solo admin
       
POST   /api/oficios/:id/cambiar-prioridad
       Body: { nueva_prioridad }
       Solo admin
       
POST   /api/oficios/:id/cambiar-estado
       Body: { nuevo_estado, motivo }
       Validar: transición permitida + permisos
       
POST   /api/oficios/:id/finalizar
       Body: { motivo }
       Validar: admin o área propia
       
POST   /api/oficios/:id/cancelar
       Body: { motivo }
       Validar: admin o área propia
```

### Archivos

```
POST   /api/oficios/:id/archivos
       FormData: { file, categoria }
       Validar: permisos + tipo de archivo según categoría
       
GET    /api/oficios/:id/archivos
       Response: Lista de archivos con versiones
       
GET    /api/archivos/:id/download
       Response: File download
       Validar: permisos para ver el oficio
```

### Proyectos

```
GET    /api/proyectos
       Query: ?area=
       Response: Filtrado por área si no es admin
       
POST   /api/proyectos
       Body: { nombre, descripcion, area_id }
       Validar: área propia o admin
       
PUT    /api/proyectos/:id
       Validar: área propia o admin
       
GET    /api/proyectos/:id/oficios
       Response: Oficios del proyecto
       Validar: permisos
```

### Semáforos

```
GET    /api/dashboard/semaforos
       Response: Estadísticas por área
       Filtrar: por área si no es admin
       
GET    /api/oficios/alertas
       Response: Oficios en amarillo/rojo
       Filtrar: por área si no es admin
       
GET    /api/configuracion/semaforo
       Solo admin
       
PUT    /api/configuracion/semaforo/:prioridad
       Body: { dias_verde, dias_amarillo, dias_rojo }
       Solo admin
```

### Áreas y Usuarios (Solo Admin)

```
GET    /api/areas
POST   /api/areas
PUT    /api/areas/:id

GET    /api/usuarios
POST   /api/usuarios
PUT    /api/usuarios/:id
DELETE /api/usuarios/:id (soft delete)
```

---

## 13. RESUMEN EJECUTIVO

### Especificaciones Clave

#### Base de Datos
- **Tablas:** 9 principales
- **Motor:** SQL Server
- **Características:**
  - Triggers para validación
  - Stored Procedures para lógica de negocio
  - Jobs programados para semáforos
  - Vistas para reportes
  - Auditoría completa con historial

#### Seguridad
- **Autenticación:** JWT con expiración de 8 horas
- **Autorización:** Basada en roles (admin/usuario)
- **Filtrado:** Por área a nivel de query
- **Validación:** En múltiples capas (BD, backend, frontend)

#### Flujos de Proceso
- **3 tipos de oficios:**
  1. Recibido Externo (7 estados posibles)
  2. Iniciado Interno (5 estados posibles)
  3. Informativo (3 estados posibles)
  
- **Estados terminales:** Finalizado, Cancelado (inmutables)
- **Auto-finalización:** Al subir acuse

#### Sistema de Semáforos
- **Cálculo:** Basado en días transcurridos desde recepción
- **Colores:**
  - 🟢 Verde: Dentro de tiempo normal
  - 🟡 Amarillo: Alerta temprana
  - 🔴 Rojo: Alerta crítica
  
- **Alertas automáticas:**
  - Amarillo: Email a área
  - Rojo: Email a área + responsable + admin
  
- **Actualización:** Job cada hora

#### Archivos
- **Versionado:** Automático con historial
- **No eliminación:** Solo marcar como inactivo
- **Validación:** Por tipo de proceso
- **Almacenamiento:** Local o Cloud (recomendado)

#### Proyectos
- **Visibilidad:** Por área
- **Relación:** 1 oficio = 1 proyecto (opcional)
- **Filtrado:** Admin ve todos, usuario solo su área

### Restricciones Importantes

1. ❌ **NO se pueden eliminar oficios**, solo cancelar
2. ❌ **NO se pueden eliminar archivos**, solo versionar
3. ❌ **NO se pueden cambiar estados terminales**
4. ❌ **Usuarios NO pueden ver oficios de otras áreas**
5. ✅ **Solo admin puede reasignar áreas**
6. ✅ **Solo admin puede cambiar prioridades**
7. ✅ **Finalización manual requiere motivo**
8. ✅ **Subir acuse = finalización automática**

### Riesgos Mitigados

| Riesgo | Mitigación |
|--------|------------|
| Acceso no autorizado | Validación en BD + middleware de auth |
| Cambios de estado ilegales | Triggers de validación |
| Archivos huérfanos | Soft delete + job de limpieza |
| Semáforo desactualizado | Función de cálculo en tiempo real |
| Concurrencia en archivos | Transacciones serializables |

### Métricas de Rendimiento Esperadas

- **Tiempo de respuesta API:** < 200ms (queries simples)
- **Carga de archivos:** < 5 segundos (50MB)
- **Actualización de semáforos:** < 1 minuto (todo el sistema)
- **Consulta de dashboard:** < 500ms

### Escalabilidad

- **Usuarios concurrentes:** 100+ sin degradación
- **Oficios en sistema:** 10,000+ sin impacto
- **Archivos:** Ilimitado (si se usa cloud storage)

---

## 14. PRÓXIMOS PASOS RECOMENDADOS

### Fase 1: Desarrollo (8 semanas)

```
Semana 1-2: Base de Datos
├─ Crear schema completo
├─ Stored procedures
├─ Triggers
├─ Datos de prueba
└─ Jobs de semáforo

Semana 3-4: Backend API
├─ Autenticación JWT
├─ Endpoints de oficios
├─ Endpoints de archivos
├─ Endpoints de proyectos
└─ Middleware de autorización

Semana 5-6: Frontend
├─ Componentes de autenticación
├─ Dashboard por rol
├─ Gestión de oficios
├─ Upload de archivos
└─ Visualización de semáforos

Semana 7: Integración
├─ Pruebas end-to-end
├─ Corrección de bugs
└─ Optimización

Semana 8: Despliegue
├─ Configuración de producción
├─ Migración de datos
├─ Capacitación de usuarios
└─ Go-live
```

### Fase 2: Post-Lanzamiento

- Monitoreo de logs
- Ajuste de límites de semáforo según uso real
- Recopilación de feedback
- Mejoras iterativas

---

**FIN DE ESPECIFICACIÓN TÉCNICA**

**Versión:** 1.0  
**Fecha:** Febrero 2025  
**Autor:** Sistema de Gestión de Oficios  
**Estado:** Listo para Desarrollo
