# MATRIZ FUNCIONAL — OpenEduCat Community vs. necesidades de CFT/IP chilenos

**Fecha:** 2026-11-21 · **Commit:** `ad47dbf8` (19.0)

**Clasificación**
- **A** Disponible y funcional · **B** Disponible, requiere adaptación · **C** Requiere desarrollo propio · **D** Solo Enterprise · **E** Sin evidencia suficiente

**Fuente de evidencia:** `COD` = código fuente leído · `DOC` = documentación/web del fabricante · `PF` = prueba funcional (**ninguna ejecutada aún**; todas las clasificaciones A/B deben confirmarse en la etapa 1).

Enlace base: `https://github.com/openeducat/openeducat_erp/blob/ad47dbf8c77b2884fe37629349898af9b31eee7d/`

---

## 1. Respuestas a las preguntas clave

| # | Pregunta | Clase | Respuesta y evidencia |
|---|---|---|---|
| 1 | ¿Gestiona carreras y mallas curriculares? | **B / C** | Carreras sí (`op.course`, `op.program`) **[COD]**. Malla **no**: `op.course.subject_ids` es un Many2many sin semestre, horas, créditos, prerrequisitos ni versión de plan ([course.py](https://github.com/openeducat/openeducat_erp/blob/ad47dbf8c77b2884fe37629349898af9b31eee7d/openeducat_core/models/course.py)). Malla = C. |
| 2 | ¿Períodos académicos y semestres? | **B** | `op.academic.year` / `op.academic.term` con generador de semestres/trimestres **[COD]**. El periodo no se vincula con lotes, sesiones ni exámenes (solo con `op.student.course`). Sin calendario de feriados. |
| 3 | ¿Jornadas y secciones? | **C** | No existe “jornada” (diurna/vespertina) en ningún modelo **[COD]**. “Sección” solo puede aproximarse con `op.batch` (cohorte a nivel de curso completo), no hay sección por asignatura con cupo. |
| 4 | ¿Docentes y asignaciones? | **B** | `op.faculty` con `faculty_subject_ids`; la asignación real ocurre por sesión (`op.session.faculty_id`) **[COD]**. Sin carga horaria, sin asignación docente-sección-periodo, sin contrato por horas. |
| 5 | ¿Cómo genera horarios? | **B** | Wizard `generate.time.table`: se define por día de semana docente/asignatura/sala/hora y se generan sesiones entre dos fechas ([generate_timetable.py](https://github.com/openeducat/openeducat_erp/blob/ad47dbf8c77b2884fe37629349898af9b31eee7d/openeducat_timetable/wizard/generate_timetable.py)) **[COD]**. Es **manual**, no optimiza, no excluye feriados. Optimización = **D** según el fabricante **[DOC]**. |
| 6 | ¿Evita conflictos de docentes y salas? | **B** | Sí existe validación de solapamiento de docente, sala y lote ([timetable.py#L245](https://github.com/openeducat/openeducat_erp/blob/ad47dbf8c77b2884fe37629349898af9b31eee7d/openeducat_timetable/models/timetable.py#L245)) **[COD]**, pero **desactivada por defecto** (los parámetros solo se crean en datos demo). Se activa en Ajustes. No detecta conflictos de estudiante con varias secciones. |
| 7 | ¿Cómo registra asistencia? | **A / B** | Registro → hoja por fecha/sesión → línea por estudiante (presente, ausente, justificado, atraso) **[COD]**. Funcional para registro manual. Falta: % mínimo por asignatura, alertas, cierre. Además, endpoint sin autenticación a corregir. Kiosco/reconocimiento facial = D **[DOC]**. |
| 8 | ¿Evaluaciones y notas? | **B / C** | Exámenes, asistentes con nota, plantillas de resultado y actas **[COD]**. **Notas enteras** (`fields.Integer`): la escala 1,0–7,0 con un decimal no es representable sin cambiar el modelo. Para Chile = **C**. |
| 9 | ¿Ponderaciones configurables? | **C** | No existe. `op.subject.grade_weightage` no se usa en ningún cálculo; el porcentaje del acta es suma simple **[COD]**. Gradebook central/GPA = D **[DOC]**. |
| 10 | ¿Cómo genera actas? | **B / C** | `op.marksheet.register` + reporte PDF “Marksheet” **[COD]**. Validar = cambio de estado, sin bloqueo de notas, firmas ni rectificación auditada. Acta oficial chilena = C. |
| 11 | ¿Recuperación de clases? | **C** | No hay concepto de clase suspendida/recuperada; solo estado `cancel` en `op.session` **[COD]**. Lesson plans = D **[DOC]**. |
| 12 | ¿Seguimiento curricular? | **C** | No hay avance curricular (asignaturas aprobadas vs. malla). Student progress = D **[DOC]**. |
| 13 | ¿Portal docente y estudiante? | **C / D** | En Community no hay páginas de portal; el controlador redirige a `/my/child`, ruta inexistente en Community **[COD]**. El portal completo es Enterprise **[DOC]**. Docentes usan el backend Odoo. |
| 14 | ¿LMS completo en Community? | **D** | No. El fabricante declara LMS “Not available” en Community **[DOC]**. Solo hay tareas/entregas básicas sin portal **[COD]**. |
| 15 | ¿Integración con Moodle? | **E** | Nada en el código Community **[COD]**. La documentación 19.0 tiene una sección “Moodle Integration” sin indicar edición **[DOC]**; por el patrón del producto se presume Enterprise, sin confirmar. |

---

## 2. Matriz detallada por capacidad

### 2.1 Planificación académica
| Capacidad | Clase | Evidencia / brecha |
|---|---|---|
| Carreras y programas | A | `op.program`, `op.program.level`, `op.course` [COD] |
| Mallas curriculares versionadas | C | Ver P1 |
| Asignaturas y módulos | B | `op.subject` (teórica/práctica, obligatoria/electiva); sin horas, créditos SCT, competencias |
| Secciones y paralelos | C | Ver P3 |
| Docentes | B | Ver P4 |
| Salas y recursos | B | `op.classroom` (capacidad), `op.facility`, `op.asset`; sin sede/campus |
| Horarios y jornadas | B / C | Horarios B; jornadas C |
| Calendario académico | C | Solo fechas de año/periodo; sin feriados, hitos, semanas lectivas |
| Recuperación de clases | C | Ver P11 |
| Horas planificadas vs. realizadas | C | Se pueden contar sesiones `done` vs. totales con un reporte, pero no hay horas por asignatura en la malla para comparar ni registro de contenido |

### 2.2 Gestión académica
| Capacidad | Clase | Evidencia / brecha |
|---|---|---|
| Estudiantes | A / B | `op.student` sobre `res.partner`; campos indios; sin RUT validado |
| Admisión y matrícula | B | `openeducat_admission` (postulación → matrícula, requiere aranceles/contabilidad) |
| Historial académico | C | `op.student.course` solo guarda curso/lote/estado |
| Asistencia | A / B | Ver P7 |
| Evaluaciones y notas | B / C | Ver P8 |
| Ponderaciones | C | Ver P9 |
| Actas y cierres | C | Ver P10 |
| Avance curricular | C | Ver P12 |
| Certificados y reportes | B | Carnet, certificado “Bonafide”, horario, asistencia, marksheet [COD]; formatos no chilenos |

### 2.3 Aula virtual
| Capacidad | Clase | Evidencia |
|---|---|---|
| Cursos y contenidos | D | LMS Enterprise [DOC] |
| Materiales y documentos | D / C | “subject material allocation” es Enterprise [DOC]; adjuntos por chatter [COD] |
| Tareas y actividades | B | `op.assignment` [COD]; entrega solo vía backend |
| Evaluaciones en línea (cuestionarios) | D | `openeducat_quiz` Enterprise (interruptor en Ajustes) [COD/DOC] |
| Entregas de estudiantes | B / C | `op.assignment.sub.line` existe; sin portal de entrega en Community |
| Comunicación docente–estudiante | B | Chatter/mensajería Odoo (`mail.thread`) en sesiones y tareas [COD] |

### 2.4 Inteligencia académica
| Capacidad | Clase | Evidencia |
|---|---|---|
| Consultas en lenguaje natural | C | Inexistente |
| Clases no ejecutadas | C | Se puede derivar de `op.session.state` + fecha; no hay proceso ni alerta |
| Alertas asistencia/rendimiento | C | Inexistente (dashboard KPI es Enterprise [COD: interruptor `openeducat_dashboard_kpi`]) |
| Conflictos de horario | B | Validación al guardar (desactivada por defecto) |
| Informes para Dirección | B / C | Vistas pivot/graph de Odoo; sin indicadores académicos definidos |
| Cumplimiento de planificación | C | Inexistente |

### 2.5 Transversales SaaS
| Capacidad | Clase | Evidencia |
|---|---|---|
| Multi-institución aislada | C | Sin `company_id` en la mayoría de modelos, `unique(code)` globales [COD] |
| Roles granulares | C | “Manager” = administrador del sistema [COD] |
| API para integraciones | B | RPC genérico de Odoo; sin API de dominio |
| Español | A | `es.po` ≈ 95–99 % traducido [COD]; terminología a adaptar |

---

## 3. Simulación del ciclo del prototipo (CFT ficticio)

Simulación **en papel** sobre el código (no ejecutada). “Sin modificación” = configurable desde la UI estándar.

| Paso | Cómo se haría en OpenEduCat Community | ¿Sin modificación? | Qué falta |
|---|---|---|---|
| 1. Crear carrera “Técnico en Enfermería” | Programa + Nivel + Curso | **Sí** | Código, título, mención, duración en semestres |
| 2. Configurar asignaturas | Crear `op.subject` y asociarlas al curso | **Parcial** | Semestre de la malla, horas teóricas/prácticas, prerrequisitos, créditos |
| 3. Crear período académico 2027-1 | Año 2027 “Two Semesters” → genera Semestre 1/2 | **Parcial** | Fechas reales (el generador divide el año por la mitad), feriados, vínculo con secciones |
| 4. Asignar docentes | Ficha docente + asignaturas | **Parcial** | Asignación por sección/periodo y carga horaria |
| 5. Programar horarios | Lote “TENS-2027-1-D” + wizard de generación; activar restricciones en Ajustes | **Parcial** | Jornada, feriados, plantilla por sección, sede |
| 6. Registrar una clase | Sesión → “Done” | **Parcial** | Leccionario (contenido, actividad, firma), horas realizadas |
| 7. Registrar asistencia | Registro → hoja de la sesión → líneas | **Sí** | Reglas de % mínimo; cerrar el endpoint inseguro |
| 8. Ingresar evaluaciones | Sesión de examen → examen → notas | **No para Chile** | Notas decimales 1,0–7,0, ponderaciones, nota de presentación/examen |
| 9. Consultar notas | Backend (staff) | **Solo staff** | Portal estudiante/docente |
| 10. Informe académico | Acta (marksheet) PDF, vistas pivot | **Parcial** | Concentración de notas, informe de rendimiento por sección |

**Resultado:** 2 de 10 pasos se completan sin desarrollo; 6 son parciales; 2 (notas chilenas y consulta por el estudiante) requieren desarrollo. El prototipo puede montarse en 1–2 semanas para **descubrimiento con usuarios**, pero no representa el producto.
