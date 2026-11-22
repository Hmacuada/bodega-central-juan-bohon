# PROPUESTA — Producto propio, sin Moodle, para ofrecer al CFT Juan Bohon

**Fecha:** 2026-11-21
**Supuestos:** producto propio (no clonado), **sin Moodle**, y sin repetir el patrón “planilla + intranet + aula virtual separada”. Primer cliente objetivo: CFT Juan Bohon.
**Fuentes:** búsquedas web del 2026-11-21 (ver §8). Lo que no tiene fuente se marca como **HIPÓTESIS**.

---

## 1. Qué hicieron otros para resolver este problema

| Patrón | Quién (con fuente) | Qué resolvió | Qué no resolvió / lección |
|---|---|---|---|
| **Comprar un ERP académico grande** | **Duoc UC**: implementó SAP desde 2006, opera la gestión académica sobre Banner Student y en 2026 eligió Ellucian Student para modernizarla. **U. Central**: SAP Cloud ERP (2026). | Registro académico robusto, finanzas, escala | Implementaciones largas, caras y con consultoras. Siguen necesitando un LMS y portales aparte. **Inalcanzable y sobredimensionado para un CFT mediano.** |
| **Construir una plataforma propia integrada** | **U. de Chile**: U-Cursos (fines de los 90) para material docente, luego **Ucampus** para lo administrativo. Hoy integran gestión académica (SIS) y aprendizaje (LMS), y se ofrecen a otras instituciones (p. ej. U. de Antofagasta). | Docente y estudiante en **un solo lugar**: curso, material, foros, notas y trámites. Altísima adopción. | Es la **prueba en Chile de que el modelo integrado funciona y se puede vender**. También es un **competidor**, enfocado en universidades. |
| **SaaS regional todo-en-uno** | **Q10** (Colombia): académico, financiero y aula virtual en la nube, para institutos, CFT y academias. Dice tener +3.000 instituciones (cifra comercial no verificada). | Un solo sistema, rápido de implementar, barato | Es genérico (sirve igual a una academia de idiomas). No está centrado en planificado vs. realizado. Presencia en Chile no verificada. **Competidor directo en precio.** |
| **Solución especializada encima del SIS** | **uPlanner** (Chile, 2012): SaaS con analítica e IA para planificación académica, asignación de docentes y salas, demanda y deserción. Oficinas en Chile, México y Colombia. | El problema más difícil: **planificar** | Su existencia muestra que **la planificación es un dolor caro y no resuelto por los SIS**. Se vende a universidades grandes. |
| **Lo que hoy tienen muchos CFT** | Excel + intranet + Moodle (contexto del proyecto) | Barato | Tres verdades distintas: nadie sabe qué clase se hizo realmente. |

**Lecciones para nuestro producto**
1. Integrar SIS y aula virtual en una sola experiencia **funciona** (U-Cursos/Ucampus). No es una idea arriesgada, es un modelo probado.
2. Lo que nadie resuelve bien para un CFT es **conectar lo planificado con lo ejecutado**. uPlanner ataca la planificación; Ucampus y Q10, el registro y el aula. **Nadie pone la clase dictada al centro.** Ese es el espacio a ocupar.
3. Los ERP grandes fracasan por tamaño, no por idea. Un CFT necesita algo que su equipo pueda operar sin consultora.
4. Q10 y Ucampus van a aparecer en la conversación de venta. Hay que diferenciarse por **especialización técnico-profesional y cumplimiento de horas**, no por “tener más módulos”.

---

## 2. Concepto: “la clase es la unidad del sistema”

En lugar de tres sistemas (planilla que planifica, intranet que registra, Moodle que enseña) unidos por integraciones, **todo cuelga de la sección y de cada una de sus clases**:

```
Carrera ─ Malla ─ Asignatura
                    └─ SECCIÓN (periodo · jornada · sede · docente · estudiantes)
                          ├─ Programa de la asignatura (unidades, horas, evaluaciones ponderadas)
                          └─ CLASE n (planificada: fecha, sala, horas, unidad)
                                ├─ Ejecución: dictada / suspendida / recuperada · contenido tratado · firma docente
                                ├─ Asistencia de esa clase
                                ├─ Material y actividad de esa clase  ← aquí vive el “aula virtual”
                                └─ Evaluación (si corresponde) → notas → acta
```

Consecuencias:
- **No hay “módulo LMS”.** El aula virtual **es la página de la sección**: el estudiante ve su horario, la clase de hoy, el material, las tareas, sus notas y su asistencia en el mismo lugar.
- El docente hace **una sola acción por clase** desde el celular: abre la clase, marca asistencia, registra el contenido tratado y sube el material o la actividad. Con eso quedan cubiertos el registro oficial, la evidencia y el aula.
- **Planificado vs. realizado sale solo**: cada clase planificada tiene un estado. Las horas no dictadas, sin recuperar o con un contenido atrasado respecto del programa se detectan en tiempo real.
- Las evaluaciones están **definidas en el programa de la sección** con sus ponderaciones. Las notas que se ingresan alimentan el acta directamente.
- La “inteligencia académica” lee este mismo modelo. No hay que integrar tres fuentes.

---

## 3. Qué construir primero (MVP en dos entregas)

El calendario manda: el semestre 2027-1 parte en marzo (≈ 3,5 meses). No alcanza para todo, así que el MVP se divide en dos entregas.

### Entrega 1 — “Clase registrada” (para piloto desde marzo 2027)
| Incluye | Detalle |
|---|---|
| Estructura mínima | Carrera, malla (asignaturas por semestre, horas), periodo, sede, jornada, sección, docentes, estudiantes (importados desde planilla) |
| Programación | Horario semanal por sección → genera las clases del semestre. Calendario con feriados. Choques de docente, sala y sección |
| Clase | Estados planificada/dictada/suspendida/recuperada, contenido tratado, firma del docente, reprogramación de recuperaciones |
| Asistencia | Por clase, desde el celular (PWA), con justificaciones |
| Aula mínima | Material y anuncios por clase o sección; tarea con entrega de archivo |
| Panel de Dirección | Horas planificadas vs. dictadas por carrera, sección y docente; clases sin registrar; inasistencia por estudiante |
| Portal estudiante | Horario, clases, material, tareas, asistencia |

### Entrega 2 — “Evaluación y cierre” (antes del cierre de 2027-1, idealmente para 2027-2)
- Programa de la asignatura con evaluaciones ponderadas, escala 1,0–7,0, exigencia, examen, eximición y redondeo, con un **simulador del reglamento**.
- Ingreso de notas, publicación al estudiante.
- Acta con cierre, firma y rectificación auditada. Concentración de notas y certificado de alumno regular con folio/QR.
- Alertas tempranas (asistencia y notas) para jefes de carrera.

### Fuera del MVP, a propósito
Admisión y aranceles/finanzas (se integran con lo que ya usa el CFT), biblioteca, cuestionarios en línea complejos, SCORM, foros, horario automático con optimizador y asistente IA en lenguaje natural (llega después, sobre datos ya limpios).

---

## 4. Cómo construirlo (propuesta técnica para empezar)

| Decisión | Propuesta | Por qué |
|---|---|---|
| Arquitectura | Monolito modular, multi-tenant con `tenant_id` + Row-Level Security en PostgreSQL | Simple de operar con un equipo chico; aislamiento real ([ARQUITECTURA_SAAS](ARQUITECTURA_SAAS.md)) |
| Backend | Python + Django (+ Django REST Framework) | Productividad; el admin de Django sirve de back office desde el día 1 |
| Frontend | PWA responsiva (React o Vue) pensada **primero para el celular del docente** | El registro de la clase ocurre en la sala |
| Archivos | Almacenamiento de objetos (tipo S3) con antivirus y cuotas por tenant | Material y entregas |
| Documentos | Plantillas HTML → PDF con folio y QR de verificación | Actas y certificados |
| Registros oficiales | Asistencia, notas y actas con historial inmutable (quién, cuándo, por qué) | Auditoría y acreditación |
| Equipo mínimo (HIPÓTESIS) | 1 líder técnico + 2 desarrolladores full-stack + 1 analista funcional con experiencia en CFT (puede ser parcial) | Entrega 1 en ~3,5 meses es ajustado pero posible con alcance cerrado |

---

## 5. Propuesta para el CFT Juan Bohon

### 5.1 Lo que sabemos (público) y lo que falta saber
- Carreras técnicas presenciales en la IV Región: Administración de Empresas, Cosmetología, Electricidad y Electrónica Industrial, Topografía, Técnico en Construcción (4 semestres), Instrumentación, Automatización y Control Industrial (folletos y fichas en juanbohon.cl).
- Tuvo un proceso de acreditación ante la CNA (resolución de 2014). **El estado vigente de su acreditación no se verificó.**
- **Falta saber** (para la primera reunión): número de estudiantes y docentes, sedes y jornadas, qué intranet/sistema usan hoy y quién la mantiene, si usan Moodle y para qué, cómo planifican hoy (Excel, quién lo arma), reglamento de evaluación y asistencia, cómo cierran actas, qué les pide la acreditación, y quién decide la compra.

### 5.2 Oferta en tres pasos (para reducir el riesgo de ambos)
| Paso | Qué | Duración | Resultado para el CFT |
|---|---|---|---|
| 1. Diagnóstico | Entrevistas con Dirección Académica, 2 jefes de carrera, 3–4 docentes y registro curricular; revisión de reglamentos y planillas reales | 2–3 semanas (dic-2026/ene-2027) | Mapa del proceso actual, **cuantificación de horas no dictadas o no registradas** en un semestre pasado (si los datos lo permiten) y prototipo navegable con sus datos |
| 2. Piloto “Clase registrada” | 1 carrera (p. ej. Técnico en Construcción) en 2027-1, todas sus secciones | 1 semestre | Horas planificadas vs. dictadas en tiempo real, asistencia móvil, material por clase, portal del estudiante |
| 3. Extensión | Evaluación y actas en la carrera piloto; luego todo el CFT | 2027-2 en adelante | Un solo sistema para planificar, dictar, evaluar y cerrar |

**Mensaje de venta (borrador):**
> “Hoy su CFT planifica en Excel, registra en la intranet y enseña en otra plataforma. Le proponemos un piloto en una carrera donde cada clase planificada se registra como dictada, con su asistencia y su material, desde el celular del docente. Al final del semestre Dirección Académica sabrá exactamente cuántas horas se dictaron, cuáles se recuperaron y qué estudiantes están en riesgo, sin armar un informe a mano.”

### 5.3 Condiciones a cuidar
- **Producto, no desarrollo a medida:** el contrato debe dejar claro que la propiedad intelectual es nuestra y que el CFT recibe una suscripción. Lo que pida Juan Bohon y no sirva a otros CFT se configura o queda fuera.
- **Precio del piloto:** con descuento, pero **no gratis**, para validar la disposición de pago. Monto por definir (HIPÓTESIS, sin referencia de mercado verificada).
- **Datos personales:** contrato de encargo de tratamiento; tener presente la Ley 21.719 **[confirmar con abogado]**.
- **Convivencia:** durante el piloto, su intranet sigue siendo el registro oficial de notas; nuestro sistema lo es de clases y asistencia de la carrera piloto. Exportes para no duplicar trabajo.
- **Riesgo de cliente único:** desde el diagnóstico, conversar en paralelo con 2–3 CFT más.

---

## 6. Diferenciación frente a quienes va a nombrar el cliente
| Si comparan con… | Nuestro argumento |
|---|---|
| Moodle | No es un aula aparte: el material vive en la clase que se registra, y la asistencia y las horas salen del mismo acto |
| Ucampus | Pensado para CFT: secciones técnicas, jornadas, docentes por hora y cumplimiento de horas como eje; implementación en semanas |
| Q10 | Especialización técnico-profesional chilena (escala, actas, reglamentos, evidencias para acreditación) en vez de un sistema genérico |
| uPlanner | Complementario: nosotros registramos la ejecución; la optimización avanzada puede venir después |
| Seguir con Excel + intranet | Cuantificamos en el diagnóstico cuánto les cuesta hoy no saber qué se dictó |

---

## 7. Próximos 30 días
1. Validar con Juan Bohon la reunión de diagnóstico (quién decide, quién opera).
2. Prototipo navegable de la **vista docente de la clase** (celular) y del **panel planificado vs. dictado**: es lo que se muestra en la primera reunión.
3. Modelo de datos detallado de sección, clase, ejecución y asistencia.
4. Definir el stack y montar el esqueleto multi-tenant.
5. Hablar con 2–3 CFT adicionales para no depender de un solo cliente.

---

## 8. Fuentes consultadas
- Ellucian: [Duoc UC impulsa un modelo educativo flexible con Ellucian Student](https://www.ellucian.com/es-mx/blog/duoc-uc-impulsa-un-modelo-educativo-flexible-con-ellucian-student)
- [Presentación Duoc UC HERUG 2014 (SAP)](https://www3.um.edu.uy/herug2014/presentaciones/Presentaci%C3%B3n%20Duoc%20UC%20HERUG%202014%20(Montevideo%20Uruguay)%20-%20Final%20(Sin%20DEMO).pdf)
- [Oferta laboral Especialista en Sistemas Académicos (Banner Student)](https://cazvid.com/en/job/especialista-en-sistemas-acad-micos-casa-central-e98208cf)
- [SAP: Universidad Central moderniza su gestión con SAP Cloud ERP](https://news.sap.com/latinamerica/2026/08/universidad-central-moderniza-su-gestion-academica-y-administrativa-con-sap-cloud-erp-private/)
- U. de Chile: [U-Cursos](https://uchile.cl/presentacion/vicerrectoria-de-asuntos-economicos-y-gestion-institucional/convenio-de-desempeno/sistemas-de-gestion/u-cursos), [CU aprobó la creación de U-Campus](https://www.uchile.cl/noticias/132042/cu-aprobo-la-creacion-de-u-campus), [Memoria Ucampus 2025](https://ucampus.cl/wp-content/uploads/2026/06/Memoria-Ucampus-2025.pdf), [Ucampus en Capterra](https://www.capterra.es/software/1013820/ucampus)
- Q10: [Capterra](https://www.capterra.es/software/1050359/q10), [Bit4learn](https://bit4learn.com/plataforma-q10/), [GetApp](https://www.getapp.com/education-childcare-software/a/q10/)
- uPlanner: [DF](https://www.df.cl/df-mas/punto-de-partida/la-ed-tech-que-cambio-el-excel-por-inteligencia-artificial), [El Dínamo](https://www.eldinamo.cl/educacion/2017/07/18/u-planner-software-planificacion-educacion-superior/), [Descubre.vc](https://www.descubre.vc/uplanner)
- CFT Juan Bohon: [Resolución CNA 278](https://cnachile.cl/res/inst/RES%20278%20CFT%20JUAN%20BOHON.pdf), [Técnico en Construcción](https://juanbohon.cl/wp-content/uploads/2025/10/Tecnico-en-Construccion.pdf), [Administración de Empresas](https://juanbohon.cl/wp-content/uploads/2025/10/Administracion-de-Empresas.pdf), [Reglamento de titulación](https://juanbohon.cl/wp-content/uploads/2025/08/REGLAMENTO-PROCESO-DE-TITULACION.pdf)
