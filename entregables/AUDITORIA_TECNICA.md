# AUDITORÍA TÉCNICA — OpenEduCat Community (rama 19.0)

**Fecha de auditoría:** 2026-11-21
**Repositorio:** https://github.com/openeducat/openeducat_erp
**Commit auditado:** [`ad47dbf8`](https://github.com/openeducat/openeducat_erp/commit/ad47dbf8c77b2884fe37629349898af9b31eee7d) (2026-11-16, rama `19.0`, que es la rama por defecto del repositorio)
**Método:** lectura directa del código fuente (modelos Python, vistas XML, reglas de seguridad, ACL, controladores, datos y crons). No se instaló Odoo: en el equipo de auditoría no hay Python ni el daemon de Docker en ejecución. **Ninguna afirmación de este documento proviene de una prueba funcional ejecutada**; las pruebas dinámicas quedan como tarea de la etapa 1 del [ROADMAP](ROADMAP.md).

> Convención: **[HECHO]** = verificado en el código; **[HIPÓTESIS]** = inferencia razonada, no verificada; **[PENDIENTE]** = requiere prueba dinámica o información externa.
> Los enlaces apuntan al commit auditado: `https://github.com/openeducat/openeducat_erp/blob/ad47dbf8c77b2884fe37629349898af9b31eee7d/<ruta>#L<línea>`. Abreviado aquí como `B/<ruta>`.

---

## 1. Resumen ejecutivo técnico

1. OpenEduCat Community es **un conjunto de 13 módulos Odoo + 1 tema** (~15.300 líneas Python, ~21.500 XML, <400 JS). Es un proyecto **pequeño**: buena parte del valor real proviene del framework Odoo, no de OpenEduCat.
2. El modelo de datos académico es **plano y genérico** (Curso → Lote/“Batch” → Asignaturas → Sesiones). No existen malla curricular, prerrequisitos, créditos, niveles/semestres por asignatura, secciones por asignatura, sedes, jornadas, recuperación de clases, horas planificadas vs. realizadas, actas con cierre ni ponderaciones.
3. Las notas son **números enteros** (`fields.Integer`) en exámenes y resultados: la escala chilena 1,0–7,0 con decimales **no es representable sin modificar el modelo**.
4. **No hay portal de estudiante ni docente funcional en Community**: el controlador redirige a `/my/child`, ruta que no existe en el repositorio Community.
5. **Hallazgos de seguridad relevantes** (estáticos, a confirmar dinámicamente):
   - Endpoint HTTP **sin autenticación** que crea registros de asistencia con `sudo()`.
   - El grupo “Manager” de OpenEduCat **implica `base.group_system`** (administrador técnico total de Odoo).
   - Usuarios portal tienen permisos de **lectura/escritura/creación sobre tareas** sin reglas de registro que los limiten.
   - Las restricciones anti-conflicto de horario están **desactivadas por defecto** (solo se activan con datos demo).
6. **Telemetría:** un cron diario (oculto en la lista de acciones planificadas) envía a `srv.openeducat.org` el nombre de la base de datos, URL, número de usuarios, apps instaladas y **nombre, email y teléfono de la empresa**.
7. El código contiene **~80 interruptores de módulos Enterprise** en Ajustes y comentarios que referencian comportamiento Enterprise: Community está diseñado como antesala comercial de Enterprise.
8. Existe una rama `20.0` (migración 2026-09-22, 11 commits propios) funcionalmente equivalente a 19.0; los hallazgos anteriores **persisten en 20.0** (verificado para telemetría, endpoint sin autenticación y notas enteras).

---

## 2. Versión y rama

| Elemento | Hallazgo | Tipo |
|---|---|---|
| Rama por defecto | `origin/HEAD -> origin/19.0` | HECHO |
| Último commit 19.0 | 2026-11-16 “redirect parent portal issue (#1081)” | HECHO |
| Rama 20.0 | Creada con “Migrated All modules in 20.0 (#1068)” el 2026-09-22; último commit 2026-11-02; 11 commits no presentes en 19.0 (traducciones, iconos, reportes) | HECHO |
| Versión de módulos | `19.0.1.0` (timetable `19.0.1.1.0`, con migración) | HECHO |
| Actividad | Commits regulares (aprox. 1–3 por mes en 2026), mayoritariamente de empleados de OpenEduCat Inc | HECHO |
| Requisitos Odoo 19 | Python ≥ 3.10, PostgreSQL ≥ 13 (según documentación oficial de Odoo, extraído vía resumen; verificar) | PENDIENTE |
| Rama `master` | Abandonada (último commit 2023-10-18, 16.0) | HECHO |

**Conclusión sobre la rama:** 19.0 es adecuada para auditar porque es la rama por defecto y la más mantenida. Para un proyecto que inicia a fines de 2026, cualquier base Odoo debería evaluarse sobre **20.0** (más vida útil). Como 20.0 es una migración casi literal, las conclusiones de este informe aplican a ambas.

---

## 3. Estructura del repositorio

```
openeducat_erp/
├── LICENSE                 (texto LGPL-3; anuncia GPL al final pero no la incluye; COPYRIGHT ausente)
├── README.md
├── openeducat_core         base: estudiantes, docentes, cursos, lotes, asignaturas, años/periodos, programas
├── openeducat_facility     instalaciones (catálogo simple)
├── openeducat_classroom    salas (depende de facility + product)
├── openeducat_timetable    sesiones/clases y generador de horario
├── openeducat_attendance   registros, hojas y líneas de asistencia
├── openeducat_exam         sesiones de examen, exámenes, resultados, actas de notas
├── openeducat_assignment   tareas y entregas
├── openeducat_admission    postulación y matrícula (depende de fees)
├── openeducat_fees         aranceles (depende de account/contabilidad)
├── openeducat_library      biblioteca
├── openeducat_activity     actividades del estudiante, migración de estudiantes
├── openeducat_parent       apoderados
├── openeducat_erp          meta-módulo que instala todo
└── theme_web_openeducat    tema de sitio web (marca OpenEduCat)
```

Tamaño: 1.345 archivos; 15.278 líneas `.py`; 21.485 líneas `.xml`; 399 líneas `.js`; 615 imágenes; 213 métodos de test.

---

## 4. Grafo de dependencias

```
board, hr, web, website, contacts (Odoo)
        └── openeducat_core
              ├── openeducat_facility ─┐
              │                        ├── openeducat_classroom (+ product)
              │                        │     ├── openeducat_timetable
              │                        │     │     └── openeducat_attendance
              │                        │     └── openeducat_exam
              ├── openeducat_assignment (+ base_automation)
              ├── openeducat_fees (+ account)
              │     └── openeducat_admission
              ├── openeducat_activity
              │     └── openeducat_library (+ account, base_automation)
              └── openeducat_parent
```

Observaciones:
- **Core depende de `website` y `hr`** ([manifest](https://github.com/openeducat/openeducat_erp/blob/ad47dbf8c77b2884fe37629349898af9b31eee7d/openeducat_core/__manifest__.py)). Instalar el núcleo académico arrastra el CMS web completo y RR.HH. de Odoo, lo que aumenta superficie de ataque, consumo de memoria y esfuerzo de actualización.
- **Exam depende de classroom**, no de timetable; **attendance depende de timetable**.
- Admisión depende de aranceles, que depende de contabilidad (`account`).
- Dependencias Python externas: solo `requests`, `pytz`, `dateutil` (todas incluidas con Odoo). No hay `external_dependencies` declaradas. **[HECHO]**

---

## 5. Inventario de modelos y relaciones

### 5.1 Núcleo académico (`openeducat_core`)

| Modelo | Propósito | Campos clave | Observaciones críticas |
|---|---|---|---|
| `op.program.level` | Nivel (ej. técnico, profesional) | `name` | |
| `op.program` | Programa | `code`, `program_level_id`, `department_id` | `code` único **global** |
| `op.course` | “Curso” ≈ carrera | `code`, `parent_id`, `evaluation_type` (normal/GPA/CWA/CCE), `subject_ids` (M2M), `program_id` | La relación con asignaturas es **M2M plana**: sin semestre, nivel, horas, créditos ni prerrequisitos. [course.py#L33](https://github.com/openeducat/openeducat_erp/blob/ad47dbf8c77b2884fe37629349898af9b31eee7d/openeducat_core/models/course.py#L33) |
| `op.batch` | Cohorte/lote del curso | `code`, `start_date`, `end_date`, `course_id` | No tiene jornada, sede ni periodo académico |
| `op.subject` | Asignatura | `code`, `type` (teórica/práctica), `subject_type` (obligatoria/electiva), `grade_weightage` | `grade_weightage` **no se usa en ningún cálculo** (solo aparece en la vista). [subject.py#L31](https://github.com/openeducat/openeducat_erp/blob/ad47dbf8c77b2884fe37629349898af9b31eee7d/openeducat_core/models/subject.py#L31) |
| `op.academic.year` | Año académico | `term_structure` (2 semestres, trimestres, etc.), `academic_term_ids` | `term_create()` divide fechas aritméticamente; no hay feriados ni calendario |
| `op.academic.term` | Periodo | fechas, `parent_term`, `company_id` | **No está vinculado a lotes, sesiones ni exámenes**; solo a `op.student.course` |
| `op.student` | Estudiante | `_inherits res.partner`; `gr_no`, `id_number`, `course_detail_ids` | Campos orientados a India (grupo sanguíneo, visa). No valida RUT |
| `op.student.course` | Matrícula del estudiante en curso/lote | `course_id`, `batch_id`, `roll_number`, `subject_ids`, `academic_term_id`, `state` (running/finished) | Es el único “historial académico”; sin situación académica (retiro, suspensión, egreso, titulación) |
| `op.subject.registration` | Inscripción de asignaturas | obligatorias/electivas, estados draft→approved | Sin validación de prerrequisitos ni cupos |
| `op.faculty` | Docente | `_inherits res.partner`; `faculty_subject_ids`, `emp_id` | Género solo male/female; sin carga horaria ni contrato |
| `op.department`, `op.category` | Organización | | |

### 5.2 Planificación (`openeducat_timetable`, `classroom`, `facility`)

| Modelo | Propósito | Observaciones |
|---|---|---|
| `op.classroom` | Sala | `capacity`, `course_id`, `batch_id`; **sin sede/campus** |
| `op.timing` | Bloque horario | horas 1–12 + AM/PM, minutos 00/15/30/45 |
| `op.session` | Clase/sesión concreta | `start/end_datetime`, `faculty_id`, `batch_id`, `subject_id`, `classroom_id`, `state` (draft/confirm/done/cancel), `student_ids` |
| `generate.time.table` (wizard) | Genera sesiones repetidas por día de semana entre dos fechas | **No excluye feriados**, no usa periodos académicos, **no optimiza** (no hay solver) |

Detección de conflictos: [`check_timetable_fields`](https://github.com/openeducat/openeducat_erp/blob/ad47dbf8c77b2884fe37629349898af9b31eee7d/openeducat_timetable/models/timetable.py#L245) valida solapamiento de docente, sala, lote y lote+asignatura, **pero cada validación depende de un `ir.config_parameter` que solo se crea en datos demo** ([demo](https://github.com/openeducat/openeducat_erp/blob/ad47dbf8c77b2884fe37629349898af9b31eee7d/openeducat_timetable/demo/op_timetable_demo.xml#L61)). En una instalación productiva sin demo, las restricciones están **apagadas** hasta activarlas en Ajustes. **[HECHO estático; PENDIENTE confirmar en UI]**

### 5.3 Asistencia (`openeducat_attendance`)

`op.attendance.register` (curso+lote+asignatura) → `op.attendance.sheet` (fecha, sesión opcional, estado) → `op.attendance.line` (estudiante, presente/ausente justificado/ausente/atraso, observación). Es funcional para registro manual. No hay: porcentaje mínimo de asistencia por asignatura, alertas, bloqueo de hoja tras cierre, ni vínculo obligatorio con la sesión planificada.

### 5.4 Evaluación (`openeducat_exam`)

`op.exam.session` (curso, lote, tipo, evaluación normal/grade) → `op.exam` (asignatura, `total_marks`, `min_marks` **enteros**) → `op.exam.attendees` (`marks` **entero**) ; `op.result.template` + `op.grade.configuration` (rangos de % → letra) → `op.marksheet.register` → `op.marksheet.line` → `op.result.line` (`marks` **entero**).

- Notas enteras: [exam_attendees.py#L34](https://github.com/openeducat/openeducat_erp/blob/ad47dbf8c77b2884fe37629349898af9b31eee7d/openeducat_exam/models/exam_attendees.py#L34), [result_line.py#L38](https://github.com/openeducat/openeducat_erp/blob/ad47dbf8c77b2884fe37629349898af9b31eee7d/openeducat_exam/models/result_line.py#L38), [exam.py#L54-L55](https://github.com/openeducat/openeducat_erp/blob/ad47dbf8c77b2884fe37629349898af9b31eee7d/openeducat_exam/models/exam.py#L54).
- El porcentaje del acta es **suma simple** de notas / suma de máximos ([marksheet_line.py](https://github.com/openeducat/openeducat_erp/blob/ad47dbf8c77b2884fe37629349898af9b31eee7d/openeducat_exam/models/marksheet_line.py)); **no existe ponderación** por evaluación.
- “Aprobado” = todas las líneas sobre `min_marks`; no hay regla de nota final ponderada, examen de repetición, eximición ni asistencia mínima como requisito.
- El acta (`marksheet.register`) se “valida” cambiando un estado; **no bloquea** la edición de notas subyacentes. **[HIPÓTESIS: requiere prueba de edición posterior]**

### 5.5 Tareas (`openeducat_assignment`)

`grading.assignment` (base) ← `_inherits` ← `op.assignment` (lote, puntaje, fechas, estudiantes asignados) → `op.assignment.sub.line` (entrega: descripción, nota, estados submit/accept/reject/change). Los archivos se adjuntan vía *chatter* de Odoo; no hay entrega desde un portal en Community. Automatizaciones `base.automation` de recordatorio por fecha.

### 5.6 Otros

Admisión (postulación → matrícula, con aranceles), aranceles (`account`), biblioteca, actividades, apoderados (vincula usuarios padre-hijo vía `res.users.child_ids`).

---

## 6. Controladores y APIs

Solo existen **dos** controladores HTTP en todo el repositorio:

| Ruta | Archivo | Auth | Observación |
|---|---|---|---|
| `/openeducat-attendance/take-attendance` (JSON-RPC, POST) | [attendance/controllers/app_main.py#L27-L52](https://github.com/openeducat/openeducat_erp/blob/ad47dbf8c77b2884fe37629349898af9b31eee7d/openeducat_attendance/controllers/app_main.py#L27) | **`auth='none'`, `csrf=False`** | Con `sudo()`, crea líneas “presente” para todos los estudiantes del lote que falten en la hoja indicada por `attendance_sheet_id`. **Cualquier cliente anónimo que alcance el servidor puede alterar registros oficiales de asistencia.** |
| Overrides de `/web` y `/web/login` | [core/controllers/app_main.py](https://github.com/openeducat/openeducat_erp/blob/ad47dbf8c77b2884fe37629349898af9b31eee7d/openeducat_core/controllers/app_main.py) | estándar | Redirige a apoderados a `/my/child` y a otros usuarios no internos a `/my`. **`/my/child` no está definido en Community** (portal de apoderados es Enterprise según la web del fabricante). |

No hay API REST propia. La integración externa dependería del XML-RPC/JSON-RPC genérico de Odoo (o de un módulo propio).

---

## 7. Seguridad y permisos

### 7.1 Grupos
| Grupo | Implica | Comentario |
|---|---|---|
| `openeducat_core.group_op_faculty` (“User”) | `base.group_user` | Docente / funcionario |
| `openeducat_core.group_op_back_office_admin` (“Manager”) | **`base.group_system`**, faculty, partner_manager | [op_security.xml#L45-L51](https://github.com/openeducat/openeducat_erp/blob/ad47dbf8c77b2884fe37629349898af9b31eee7d/openeducat_core/security/op_security.xml#L45). Un director académico con este rol es **administrador técnico total** (puede instalar módulos, ver parámetros del sistema, crear usuarios con cualquier permiso). Inaceptable en SaaS. |
| Grupos por módulo (assignment user/manager, exam, etc.) | | |
| `base.group_portal` | | Estudiantes/apoderados |

### 7.2 Reglas de registro (ir.rule) — hallazgos
- Docentes ven y pueden **modificar todos los estudiantes** (`[(1,'=',1)]` + ACL write) — no hay restricción por sección o asignatura dictada.
- La regla `student_login_rule` (`[('user_id','=',user.id)]`) está asignada al grupo **Manager**, no a estudiantes; como las reglas de grupo se combinan con OR y existe otra `1=1`, no restringe nada. Diseño confuso. [op_security.xml#L54](https://github.com/openeducat/openeducat_erp/blob/ad47dbf8c77b2884fe37629349898af9b31eee7d/openeducat_core/security/op_security.xml#L54)
- **Portal sobre tareas:** ACL concede a `base.group_portal` lectura, escritura y creación en `op.assignment`, `grading.assignment` y `op.assignment.sub.line` ([ir.model.access.csv#L7-L13](https://github.com/openeducat/openeducat_erp/blob/ad47dbf8c77b2884fe37629349898af9b31eee7d/openeducat_assignment/security/ir.model.access.csv#L7)), y las reglas de registro de esos modelos solo están definidas para los grupos user/manager. **[HIPÓTESIS de severidad alta]** un estudiante con login portal podría, vía RPC, leer y modificar tareas y entregas de otros (incluida la nota de su entrega). Debe confirmarse con una prueba dinámica antes de afirmarlo como vulnerabilidad.
- Multiempresa: solo 4 reglas de compañía (año, periodo, inscripción, categoría). **Estudiante, curso, lote, asignatura, docente, sala, examen y asistencia no tienen `company_id`**, y sus códigos son `unique` globales. → Odoo multiempresa **no** sirve para aislar instituciones (ver [ARQUITECTURA_SAAS](ARQUITECTURA_SAAS.md)).
- El menú técnico se oculta a docentes (override de `base.menu_management`).

### 7.3 Telemetría y cron oculto
- [`data/ir_cron_data.xml`](https://github.com/openeducat/openeducat_erp/blob/ad47dbf8c77b2884fe37629349898af9b31eee7d/openeducat_core/data/ir_cron_data.xml): cron diario “Publisher: Update Notification OpenEduCat” que ejecuta [`update.py`](https://github.com/openeducat/openeducat_erp/blob/ad47dbf8c77b2884fe37629349898af9b31eee7d/openeducat_core/models/update.py#L32) → `requests.post("https://srv.openeducat.org/publisher-warranty/")` con: `dbuuid`, **`dbname`** (L76), número de usuarios y usuarios activos, URL base, idioma, apps instaladas y **nombre, email y teléfono de la compañía** (L85).
- El mismo XML **modifica la acción estándar `base.ir_cron_act`** para **excluir de la lista de acciones planificadas** tanto este cron como el de Odoo. Un administrador no lo ve en la vista por defecto.
- `post_init_hook` llama además al aviso de Odoo al instalar.
- El sitio del fabricante declara que Community no tiene “license call-home”; el código sí envía datos de la instalación. La discrepancia debe tratarse como **riesgo de privacidad/cumplimiento** (datos de la institución cliente a un tercero) y el cron debe deshabilitarse o eliminarse en cualquier despliegue.

### 7.4 Otros defectos de calidad observados
- `raise Warning(...)` (excepción built-in de Python, no `UserError`) en entregas de tareas ([assignment_sub_line.py](https://github.com/openeducat/openeducat_erp/blob/ad47dbf8c77b2884fe37629349898af9b31eee7d/openeducat_assignment/models/assignment_sub_line.py)).
- `_check_email_unique` duplicado en `op.faculty`.
- `act_gen_time_table` hace `return` dentro del bucle (procesa solo el primer registro).
- `term_create` usa `search([])` sobre todos los periodos.
- Restricciones `unique(code)` globales en casi todos los catálogos.

---

## 8. Vistas y frontend

- Vistas backend Odoo estándar (form, list, kanban, calendar, pivot, graph) en XML. JS propio mínimo (399 líneas: widgets inline, aranceles).
- `theme_web_openeducat`: tema de sitio web con marca OpenEduCat (11 MB de estáticos).
- **No hay** plantillas de portal (`/my/...`) para estudiantes ni docentes en Community.
- Traducción española (`es.po`) prácticamente completa en core, exam, timetable, attendance (≥ 95 % de cadenas). **No hay `es_CL`/`es_419`**; terminología de India (“Batch”, “Roll Number”, “Bonafide”).

## 9. Informes y documentos (QWeb PDF)

Carnet de estudiante, certificado “Bonafide”, acta/marksheet, credenciales de examen (*hall ticket*), horario por estudiante y por docente, informe de asistencia, análisis de admisión, aranceles, credenciales/códigos de barra de biblioteca. Se agregaron “dynamic reports” en sep-2026 (#1066), que en la práctica son **reportes de admisión** rediseñados. No hay: concentración de notas, certificado de alumno regular chileno, acta de cierre con firmas, avance curricular, informe de cumplimiento horario.

## 10. Procesos automáticos

| Proceso | Tipo | Origen |
|---|---|---|
| Telemetría a OpenEduCat | `ir.cron` diario | core |
| Recordatorios de entrega de tarea (antes/después de fecha) | `base.automation` | assignment |
| Automatizaciones de biblioteca | `base.automation` | library |
| Backfill de `student_ids` en sesiones | acción de servidor/migración | timetable |

## 11. Mecanismos de extensión

Los propios de Odoo: herencia `_inherit`/`_inherits`, herencia de vistas XPath, `res.config.settings` con `module_*`, reportes QWeb, `ir.rule`. Esto es una **fortaleza real**: se puede extender sin modificar archivos originales (importante para la licencia LGPL, ver [AUDITORIA_LICENCIAS](AUDITORIA_LICENCIAS.md)). Pero extender un modelo plano para convertirlo en malla curricular implica reescribir más de lo que se reutiliza.

## 12. Señales de dependencia de Enterprise en el código Community

- [`res_config_setting.py`](https://github.com/openeducat/openeducat_erp/blob/ad47dbf8c77b2884fe37629349898af9b31eee7d/openeducat_core/models/res_config_setting.py) declara ~80 `module_openeducat_*` (LMS, quiz, GPA, gradebook, live, rubrics, face recognition, campus, timetable_enterprise, parent_enterprise, etc.). Activar uno intenta instalar un módulo que **no existe** en Community.
- Comentario en timetable: “Enterprise relaxes batch_id to required=False”.
- Comentario en el generador: sesiones sin estudiantes “are invisible on the enterprise portal”.
- Vista de admisión con icono “Openeducat Enterprise Module”.
- Redirección a `/my/child` inexistente en Community.

## 13. Requisitos de instalación (para la etapa 1)

- Odoo 19.0 Community (o 20.0 para la rama 20.0), Python ≥ 3.10, PostgreSQL ≥ 13 [PENDIENTE confirmar contra documentación oficial], wkhtmltopdf para PDF.
- Módulos Odoo requeridos: `board, hr, web, website, contacts, product, account, base_automation`.
- Recomendado: imagen Docker oficial `odoo:19` + `postgres:16`, montando el repositorio en `/mnt/extra-addons`.
- Tras instalar: **desactivar el cron de telemetría**, cerrar el endpoint `/openeducat-attendance/take-attendance` en el proxy y revisar grupos.

## 14. Inventario: existe / incompleto / a desarrollar

| Área | Existe y sirve | Incompleto | Habría que desarrollar |
|---|---|---|---|
| Estructura institucional | Departamentos, programas, niveles | Sin sedes, sin jornadas | Sede, jornada, escuela/facultad |
| Oferta académica | Curso, asignatura, lote | Curso↔asignatura plana | Malla (plan de estudios versionado, semestres, prerrequisitos, horas, créditos SCT) |
| Periodos | Año y periodo con generador | Periodo desconectado del resto | Calendario académico con feriados, hitos, cierre de periodo |
| Secciones | Lote (cohorte) | No hay sección por asignatura | Sección/paralelo por asignatura-periodo-jornada con cupo |
| Docentes | Ficha, asignaturas que dicta | Sin carga horaria | Asignación docente por sección, contrato por horas |
| Horarios | Sesiones, generador, conflictos | Conflictos apagados por defecto; sin feriados; sin optimización | Plantillas semanales por sección, recuperaciones, solver opcional |
| Ejecución de clases | Estado `done` de sesión | Sin leccionario | Registro de contenidos, firma docente, horas realizadas vs planificadas |
| Asistencia | Hojas y líneas | Sin % mínimo, sin cierre | Reglas de asistencia, alertas, justificaciones |
| Evaluaciones | Exámenes, actas, rangos de letra | Notas enteras, sin ponderación | Motor de calificación configurable (escala, decimales, ponderaciones, examen, eximición, redondeo) |
| Actas | Marksheet register | Sin bloqueo real ni firmas | Acta oficial con cierre, rectificación auditada |
| Historial / avance | `op.student.course` | Mínimo | Expediente académico, avance curricular, situación académica |
| Certificados | Carnet, “Bonafide” | Formato indio | Certificados chilenos con verificación (QR/folio) |
| Portales | — | Redirección a ruta inexistente | Portal estudiante y docente completos (móvil) |
| LMS | Tareas básicas | Sin contenidos, cursos, cuestionarios | Integración Moodle (LTI 1.3 / Web Services) o aula virtual propia |
| Analítica/IA | Vistas pivot/graph | — | Data mart, alertas, capa de consulta con permisos |
| SaaS | — | Multiempresa no aísla | Plano de control de tenants, aprovisionamiento, facturación |
