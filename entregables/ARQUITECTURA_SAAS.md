# ARQUITECTURA SAAS MULTIINSTITUCIÓN

**Fecha:** 2026-11-21

Este documento evalúa cómo convertir una base académica en un SaaS para muchas instituciones. Primero compara las tres alternativas pedidas **sobre Odoo/OpenEduCat**, y después propone la arquitectura objetivo, coherente con la recomendación de [DECISION_FINAL](DECISION_FINAL.md) (producto independiente, usando OpenEduCat como referencia).

---

## 1. Premisa: la multiempresa de Odoo NO es aislamiento SaaS

Hechos verificados en el código ([AUDITORIA_TECNICA §7.2](AUDITORIA_TECNICA.md)):
- `op.student`, `op.course`, `op.batch`, `op.subject`, `op.faculty`, `op.classroom`, `op.exam`, asistencia y notas **no tienen `company_id`**.
- Los códigos son `unique` **globales** (dos instituciones no podrían usar el código “ENF-101”).
- Solo 4 modelos tienen regla multiempresa.
- El rol “Manager” es `base.group_system`: un administrador de una institución podría ver/configurar todo el servidor.
- Usuarios, parámetros del sistema (`ir.config_parameter`), crons y adjuntos son compartidos.

Conclusión: **la Alternativa B es inviable sin reescribir la seguridad de todos los modelos**, y aun así un error en una regla expondría datos de menores de edad o de estudiantes de otra institución.

---

## 2. Comparación de alternativas (sobre Odoo)

| Criterio | A. Odoo + BD por institución | B. Odoo compartido, separación lógica | C. Híbrida: plano de control SaaS + motores académicos |
|---|---|---|---|
| Seguridad y aislamiento | **Alto**: BD separada, `dbfilter` por subdominio | **Bajo** con OpenEduCat (ver §1) | **Alto** (motores aislados) |
| Costo de infraestructura | Medio: un pool de workers Odoo puede servir varias BD; cada BD ocupa RAM de caché y crons | Bajo | Medio-alto al inicio; se optimiza a escala |
| Actualizaciones | Una por BD (scriptable); riesgo de migraciones fallidas por cliente | Una sola | Por motor, orquestadas desde el plano de control |
| Respaldos | Simples por cliente (`pg_dump` + filestore) y restauración individual | Difícil restaurar un solo cliente | Por cliente |
| Escalabilidad | Hasta decenas–pocas centenas de BD por clúster; luego sharding de servidores | Alta en teoría, limitada por contención | Alta |
| Mantenimiento | Medio: muchas BD que versionar | Alto (reglas de seguridad) | Medio, requiere equipo de plataforma |
| Rendimiento | Bueno por cliente; crons de muchas BD compiten | Riesgo de “vecino ruidoso” | Bueno |
| Administración de clientes | Requiere portal propio de aprovisionamiento (crear BD, módulos, dominio) | Simple | Nativa (es el propósito del plano de control) |
| Personalización por institución | **Alta** (módulos, configuración por BD) | Baja | Alta mediante configuración/feature flags |

**Si se usara Odoo/OpenEduCat, la recomendación sería A para comenzar** (con un pequeño plano de control propio: alta de cliente, creación de BD desde plantilla, subdominio, respaldos, monitoreo) y evolucionar hacia **C** al superar ~30–50 instituciones. [HIPÓTESIS de umbral; depende de tamaño de clientes]

---

## 3. Arquitectura objetivo recomendada (producto independiente)

### 3.1 Vista general

```
                 ┌─────────────────────────── Plano de control SaaS ────────────────────────────┐
                 │  Tenants · Planes y facturación · Identidad (OIDC/SSO) · Config por país      │
                 │  Feature flags · Auditoría · Observabilidad · Aprovisionamiento · Backups     │
                 └───────────────┬──────────────────────────────────────────────┬───────────────┘
                                 │                                              │
        ┌────────────────────────▼───────────────┐            ┌─────────────────▼────────────────┐
        │  Motor académico (monolito modular)    │            │ Capa de inteligencia académica   │
        │  Planificación · Gestión académica ·   │──eventos──▶│ Data mart (solo lectura) ·       │
        │  Asistencia · Calificaciones · Actas · │            │ Alertas · Consultas IA con       │
        │  Portales · API · Reportes             │            │ permisos del usuario · sin escritura│
        └───────┬───────────────────────┬────────┘            └──────────────────────────────────┘
                │                       │
      PostgreSQL (tenant_id + RLS)   Integraciones: Moodle (LTI 1.3 + WS), SSO, ERP/contabilidad,
      o BD dedicada (plan Grande)    reportería estatal, correo/SMS
```

### 3.2 Decisiones clave
1. **Monolito modular**, no microservicios, durante los primeros 2–3 años. Un equipo pequeño no puede operar 10 servicios.
2. **Aislamiento de datos en dos niveles**:
   - *Por defecto (planes Pequeño/Mediano):* una base PostgreSQL compartida con `tenant_id` en **todas** las tablas y **Row-Level Security** de PostgreSQL activada como segunda barrera (además del filtro de la aplicación). Pruebas automáticas que intenten leer datos de otro tenant.
   - *Plan Grande o exigencia contractual:* **base de datos dedicada** (mismo esquema, mismo código), seleccionada por el plano de control. Esto es la Alternativa A aplicada solo donde aporta valor.
3. **Configuración por país y por institución como datos, no como código** (ver §4).
4. **Registros oficiales inmutables con versionado**: notas, asistencia y actas se escriben como eventos auditados; una vez cerrada el acta, toda corrección es una “rectificación” con motivo, autor y aprobación.
5. **La IA solo lee**: la capa de inteligencia consume un data mart de solo lectura; ejecuta consultas con el **mismo alcance de permisos** del usuario que pregunta; no tiene credenciales de escritura sobre el motor académico. Toda respuesta cita los datos usados y queda registrada.
6. **No construir LMS en la primera versión**: integrar con Moodle (LTI 1.3 para lanzar actividades + Web Services para sincronizar matrículas y traer calificaciones). Se reevaluará un aula virtual propia cuando haya clientes que paguen por ella.

### 3.3 Stack sugerido (a validar con el equipo)
- **Backend:** Python + Django (ORM maduro, admin para back office, el equipo ya evaluó Python/Odoo) o equivalente que el equipo domine. **[RECOMENDACIÓN, no hecho]**
- **Base de datos:** PostgreSQL 16+ con RLS.
- **Frontend:** SPA/PWA responsiva (portal docente en móvil para pasar asistencia en sala).
- **Asincronía:** cola de tareas (alertas, reportes PDF, sincronización Moodle).
- **Infraestructura:** contenedores en un proveedor cloud con región en Sudamérica (o cumplir requisitos de transferencia internacional de la Ley 21.719 **[JURÍDICO]**), respaldos cifrados con retención por cliente, recuperación individual probada.

### 3.4 Respaldos, actualizaciones, escalamiento
| Tema | Diseño |
|---|---|
| Respaldos | PITR del clúster + export lógico diario por tenant (permite restaurar un cliente sin afectar a otros) |
| Actualizaciones | Despliegue continuo único; migraciones de esquema compatibles hacia atrás; feature flags para activar cambios por institución; ventanas fuera de cierres de semestre |
| Escalabilidad | Escalado horizontal de la app; réplicas de lectura para analítica; mover tenants grandes a BD dedicada sin cambiar código |
| Observabilidad | Métricas por tenant (latencia, errores, uso), auditoría de accesos a datos personales |

---

## 4. Diseño de configuración por país (sin versiones por mercado)

El núcleo modela conceptos universales; cada país y cada institución aportan **perfiles de configuración**:

| Concepto | Núcleo genérico | Perfil Chile (ejemplo) | Perfil Perú / Colombia / México (ejemplos a validar) |
|---|---|---|---|
| Escala de calificación | mín., máx., decimales, nota de aprobación, regla de redondeo, conversión desde % | 1,0–7,0; 1 decimal; aprobación 4,0; exigencia configurable (habitual 60 %) | 0–20 (aprob. 11 habitual) / 0,0–5,0 (aprob. 3,0 habitual) / 0–10 (aprob. 6 habitual) — **verificar por institución** |
| Fórmula de nota final | árbol de componentes con pesos, mínimos, eximición, examen, repetición | Nota presentación × % + examen × %; eximición con nota ≥ X | Configurable |
| Asistencia | % mínimo por asignatura/tipo, justificaciones, efecto sobre aprobación | Reglamento interno de cada CFT | Configurable |
| Periodos | semestre/trimestre/módulo intensivo; calendario con feriados por país/región | Feriados nacionales y regionales de Chile | Calendario oficial |
| Identificadores | tipo de documento con validador | RUT (módulo 11) | DNI / CC / CURP |
| Estructura curricular | plan versionado, niveles, créditos | Créditos SCT-Chile, semestres | Créditos locales |
| Documentos | plantillas de certificados/actas con folio y QR verificable | Alumno regular, concentración de notas, título | Configurables |
| Reportería estatal | conectores exportadores | SIES/Mineduc **[a investigar formatos]** | SUNEDU, SNIES, etc. **[a investigar]** |
| Privacidad | consentimientos, retención, derechos ARCO+ | Ley 19.628 → Ley 21.719 | Leyes locales |

Implementación: tablas de configuración versionadas + motor de reglas declarativo para notas y asistencia (fórmulas en un DSL seguro, no código arbitrario), con **simulador** para que la institución pruebe su reglamento antes de activarlo.

---

## 5. Recomendación

| Momento | Arquitectura |
|---|---|
| **Para comenzar** (piloto, 1–10 instituciones) | Monolito modular + PostgreSQL compartido con `tenant_id` y RLS + plano de control mínimo (alta de tenants, configuración, respaldos por tenant). Moodle integrado, no reemplazado. |
| **Para escalar** (>10–30 instituciones, clientes grandes) | Alternativa **C**: plano de control maduro; motores académicos en celdas (*cells*) por región/tamaño; BD dedicada para clientes grandes; data mart separado para analítica e IA. |

Si, contra la recomendación, se decidiera construir sobre Odoo/OpenEduCat: **Alternativa A** (BD por institución) desde el día uno, nunca B.
