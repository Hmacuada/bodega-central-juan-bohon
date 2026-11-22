# ALTERNATIVAS A OPENEDUCAT — Plataformas open source que se pueden clonar

**Fecha:** 2026-11-21
**Método:** metadatos de GitHub (licencia, actividad de los últimos 12 meses, estrellas) consultados vía API, y lectura del código de los finalistas (Frappe Education, UniTime, RosarioSIS, Gibbon). **No se instaló ni se probó ninguna plataforma.**
**“Clonar” aquí significa** hacer un *fork* legal de un proyecto open source y construir el producto encima, respetando su licencia. Un repositorio **sin licencia no se puede clonar para uso comercial** (todos los derechos reservados), aunque sea público.

---

## 1. Conclusión

1. **No existe ningún proyecto open source que cubra un CFT chileno “de fábrica”.** Lo específico (escala 1,0–7,0, actas con cierre, leccionario, horas planificadas vs. realizadas, recuperaciones, jornadas) habrá que desarrollarlo sobre cualquier base.
2. **El mejor candidato para clonar como núcleo académico es Frappe Education (v16 estable) sobre Frappe Framework + ERPNext.** Respecto de OpenEduCat tiene: notas decimales (`Float`), ponderación por criterio de evaluación, créditos, grupos por asignatura con cupo (≈ secciones), validación de choques que siempre está activa, portal de estudiante en Vue y, sobre todo, **multi-sitio nativo con una base de datos por institución**, que es la arquitectura SaaS recomendada.
3. **Para horarios, UniTime** (Apache-2.0, usado por universidades, mantenido por la Apereo Foundation) es muy superior a cualquier generador incluido en un SIS: tiene un optimizador (solver), currículos, salas, docentes, exámenes y API. Conviene como **motor integrado**, no como base del producto.
4. **Para el aula virtual, Moodle** (GPL-3) se integra, no se clona.
5. Las plataformas escolares (Gibbon, RosarioSIS, openSIS) son activas pero están pensadas para colegios y no encajan con educación superior técnica.

**Propuesta: Frappe Education v16 (núcleo) + UniTime (horarios) + Moodle (LMS)**, con módulos propios para Chile. Hay riesgos que se detallan en §4, y antes de comprometerse hace falta una prueba práctica de 2 semanas.

---

## 2. Candidatos evaluados

Actividad = commits en la rama por defecto entre 2025-11-21 y 2026-11-21.

| Plataforma | Tipo | Licencia | Stack | Actividad 12 m | Encaje con CFT | Veredicto |
|---|---|---|---|---|---|---|
| **Frappe Education** ([frappe/education](https://github.com/frappe/education)) | SIS / ERP académico | GPL-3 (app); Frappe Framework MIT; ERPNext GPL-3 | Python, MariaDB, Vue | 84 en `develop` (+ ramas v15/v16 con releases jun-2026) | **Medio-alto** | **Finalista: núcleo** |
| **UniTime** ([UniTime/unitime](https://github.com/UniTime/unitime)) | Horarios universitarios | Apache-2.0 | Java, GWT, Hibernate | 340 | Alto en planificación | **Finalista: motor de horarios** |
| **Moodle** | LMS | GPL-3 | PHP | muy alta (7,6 k ★) | Aula virtual | **Integrar** |
| **Chamilo** | LMS (fuerte presencia hispana) | GPL-3 | PHP/Symfony | 6.775 | Aula virtual | Alternativa a Moodle |
| **OpenOLAT** | LMS universitario | Apache-2.0 | Java | 3.895 | Aula virtual | Alternativa LMS permisiva |
| **Sakai** | LMS universitario | ECL-2.0 | Java | activa | Aula virtual | Alternativa LMS |
| **Ilios** ([ilios/ilios](https://github.com/ilios/ilios)) | Gestión curricular (ciencias de la salud) | MIT | PHP/Symfony + Ember | 1.116 | Referencia para mallas y competencias | **Referencia** |
| **etSIS** ([nomadicjosh/etsis](https://github.com/nomadicjosh/etsis)) | SIS de educación superior | MIT | PHP (CodefyPHP) | 342 | Alto en concepto | Descartar por ahora: **alfa**, un solo mantenedor, cambios de esquema esperados (según su README) |
| **FenixEdu Academic** | SIS universitario (IST Lisboa) | LGPL-3 | Java | **0** (último push 2023-06) | Alto en concepto | Referencia de modelo; sin mantenimiento |
| **RosarioSIS** | SIS escolar | GPL-2 | PHP | 430 | Bajo (colegio: niveles, periodos de marcas) | Descartar |
| **Gibbon** | SIS escolar | GPL-3 | PHP | 347 | Bajo (colegios internacionales) | Descartar |
| **openSIS Classic** | SIS escolar | GPL (según README; GitHub no la detecta) | PHP | 288 | Bajo; tiene versión comercial | Descartar |
| **Canvas LMS** | LMS | **AGPL-3** | Ruby | alta | LMS | Descartar como base: AGPL obliga a ofrecer el código a los usuarios del SaaS |
| **Open edX** | LMS / MOOC | **AGPL-3** | Python | alta | MOOC | Descartar (AGPL, complejidad) |
| **Frappe LMS** | LMS | **AGPL-3** | Python/Vue | 3.463 | LMS liviano | Solo si se acepta publicar las modificaciones |
| **Fedena** | SIS | sin licencia detectable en GitHub | Rails | último push 2020 | — | Descartar (abandonado) |
| Proyectos “College ERP / School Management” de GitHub | Demos/estudiantiles | muchos **sin licencia** | varios | variable | Bajo | Descartar (sin licencia o de juguete) |

---

## 3. Finalista núcleo: Frappe Education

### 3.1 Qué tiene (verificado en el código de la rama `version-16`, que es la estable)
| Necesidad CFT | Frappe Education v16 | Comparación con OpenEduCat |
|---|---|---|
| Carrera y malla | `Program` → `Program Course` (asignatura + `required`), `Course` con créditos | Mejor (obligatoriedad, créditos); **sin semestre de la malla ni prerrequisitos** |
| Periodos | `Academic Year`, `Academic Term` vinculados a grupos y evaluaciones | Mejor (el periodo sí se conecta) |
| Secciones | `Student Group` con `group_based_on` = Batch / **Course** / Activity, cupo `max_strength`, docentes | **Mucho mejor** (sección por asignatura) |
| Horarios y choques | `Course Schedule` + herramienta de programación; `validate_overlap` por grupo, **docente y sala** que se ejecuta siempre (`course_schedule.py#L87`) | Mejor (no depende de un parámetro apagado) |
| Asistencia | `Student Attendance` por sesión, con licencias | Equivalente |
| Evaluación | `Assessment Plan` + criterios con **ponderación** (`Course Assessment Criteria.weightage`) y puntajes `Float` | **Mucho mejor** (decimales y ponderación) |
| Escalas | `Grading Scale` por rangos de % | Similar; la escala 1,0–7,0 con exigencia habría que desarrollarla |
| Portal | Portal de estudiante (en `develop`: frontend Vue con asistencia, notas, horario, aranceles) | **Existe** (OpenEduCat Community no tiene) |
| SaaS | Frappe **multi-tenant nativo**: un *bench*, muchos *sites*, **una BD por sitio** | Más sólido de serie |
| Licencia | App GPL-3; framework MIT | Comparable (GPL-3 tampoco tiene cláusula de red) |

### 3.2 Riesgos (verificados)
1. **El modelo de datos está en plena reescritura.** La rama `develop` (v17-dev) va 60 commits por delante de `version-16`, con unos 55 doctypes nuevos (campus, `subject_schedule`, `grade_book`, `grade_template` con pesos, etc.). A la vez **elimina** `student_group`, `program_enrollment`, `instructor` y `course_schedule`. Si se clona v16, habrá que migrar a un modelo distinto. Si se clona `develop`, la base todavía no es estable.
2. **Depende de ERPNext** (`required_apps = ["erpnext"]`): un ERP completo con contabilidad, inventario, etc. Eso pesa en infraestructura, en actualizaciones y en la experiencia de usuario.
3. **Mismo origen conceptual que OpenEduCat:** en `develop` el `Course` tiene `evaluation_type` con las opciones *Normal/GPA/CWA/CCE*, idénticas a las de OpenEduCat, y usa terminología india (roll number, batch). Habrá que adaptarlo a la realidad chilena.
4. **Español:** la app solo trae traducción al árabe (`education/locale/ar.csv`); el framework sí está en español. Hay que traducir y localizar.
5. **Ciclo de versiones mayores anual** (como Odoo), con migraciones.
6. **Licencia GPL-3:** las apps propias sobre Frappe/ERPNext suelen considerarse obras derivadas. En un SaaS sin distribución no obliga a publicar el código, pero **si se entrega el software a un cliente (instalación local), nuestro código debería ir bajo GPL-3**. Es más restrictivo que la LGPL de Odoo/OpenEduCat en ese escenario **[confirmar con abogado]**. No usar Frappe LMS ni Helpdesk (AGPL) sin aceptar sus obligaciones.

---

## 4. Finalista de horarios: UniTime
- Apache-2.0 (permite uso comercial, modificar y no publicar cambios, con aviso NOTICE). Lo mantiene la Apereo Foundation y tiene 340 commits en el último año.
- Modela ofertas de cursos, secciones y subpartes, salas, edificios, docentes, **currículos** y exámenes. Tiene un **optimizador** de horarios y matrícula de estudiantes, y conectores API (`CurriculaConnector`, `RoomsConnector`, `InstructorsConnector`, `EnrollmentsConnector`, `ClassInfoConnector`…).
- Contras: Java/GWT, con una interfaz pensada para planificadores expertos y una curva de aprendizaje alta. Se usaría **en segundo plano**: el núcleo le envía la oferta y recibe el horario optimizado.
- Uso recomendado: módulo “Planificación avanzada” para clientes medianos y grandes. Los pequeños pueden usar la programación manual con validación de choques del núcleo.

---

## 5. Arquitectura resultante

```
 Plano de control SaaS (propio)  ──►  Frappe bench multi-sitio
                                       ├─ site: cft-a.lectiva.cl  (BD propia)
                                       ├─ site: cft-b.lectiva.cl  (BD propia)
                                       └─ apps: frappe (MIT) + erpnext (GPL) + education (GPL) + lectiva_cl (propia)
                                             │
                     ┌───────────────────────┼────────────────────────┐
                     ▼                       ▼                        ▼
              UniTime (Apache-2)       Moodle (GPL-3)          Capa IA de solo lectura
              optimización horarios    LTI 1.3 + Web Services  (data mart por tenant)
```

App propia `lectiva_cl` (desarrollo propio, en cualquier base): escala chilena y redondeos, fórmula de nota final (presentación/examen/eximición), actas con cierre y rectificación, leccionario y horas realizadas, recuperaciones, jornadas, malla por semestre con prerrequisitos, RUT, certificados con folio/QR, roles granulares, reportería para Dirección e integración con Moodle.

---

## 6. Cómo cambia la recomendación anterior

| Opción | Tiempo a MVP (HIPÓTESIS) | Riesgo principal |
|---|---|---|
| OpenEduCat + módulos propios | 5–6 meses | Modelo plano, seguridad, dependencia de un proveedor Enterprise |
| **Frappe Education v16 + UniTime + Moodle** | **≈ 4–5 meses** | Reescritura del modelo en v17, peso de ERPNext, GPL-3 si se distribuye |
| Producto propio (OpenEduCat/Frappe/UniTime como referencia) | 6–7 meses | Más desarrollo inicial |

Si la prioridad es **llegar rápido a un piloto con una base clonable**, Frappe Education es una opción mejor que OpenEduCat. Si la prioridad es **independencia y diferenciación a largo plazo**, el producto propio sigue siendo la opción más sólida, ahora con UniTime como motor de horarios reutilizable en ambos caminos.

## 7. Siguiente paso recomendado (2 semanas)
1. Levantar Frappe + ERPNext + Education **v16** en Docker y repetir el ciclo de 10 pasos del CFT ficticio.
2. Levantar `develop` en paralelo para medir cuánto cambia el modelo.
3. Levantar UniTime con datos de ejemplo y probar exportar e importar una oferta de una carrera.
4. Con esa evidencia, decidir entre “clonar Frappe Education” y “producto propio”.

---

## 8. Actualización: bases para el planificador (horarios + planificación + PPT IA + Moodle)

Verificado vía API de GitHub el 2026-11-21 (licencia, último push, commits del último año). **No se instaló ninguna.**

| Pieza | Candidato | Licencia | Actividad | Uso propuesto |
|---|---|---|---|---|
| Horarios sin choques | **Timefold Solver** ([TimefoldAI/timefold-solver](https://github.com/TimefoldAI/timefold-solver)) + quickstart *school-timetabling* | Apache-2.0 | push 2026-11-20, 1,9 k ★ | **Clonar el ejemplo de horario escolar** y adaptarlo: docentes, salas, secciones, bloques de 40 min, jornadas, disponibilidad |
| Horarios (alternativa completa) | UniTime | Apache-2.0 | push 2026-11-21 | Si se necesita un sistema universitario completo; más pesado (Java/GWT) |
| Generar PPT con IA | **Presenton** ([presenton/presenton](https://github.com/presenton/presenton)) | Apache-2.0 | 100+ commits en 12 meses, 12 k ★ | **Clonar y autoalojar** como servicio: según su README admite Anthropic, plantillas propias, API y exporta PPTX editable |
| PPT IA (alternativa) | ALLWEONE presentation-ai | MIT | último push 2026-06 | Respaldo si Presenton no encaja |
| Publicar en Moodle | Web Services REST de Moodle | — | — | Integrar; no se clona |
| Planificación didáctica con fechas | **No hay equivalente open source** | — | — | Desarrollo propio: es el diferenciador |
| Descartado | FET (horarios escolares) | **AGPL-3.0** | espejo en GitHub sin actividad desde 2017 | AGPL y escritorio |

**Pendiente de verificar:** que Presenton no tenga funciones limitadas a una edición comercial; su calidad con la plantilla del CFT; el rendimiento de Timefold con la oferta real de una sede.
