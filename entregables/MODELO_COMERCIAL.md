# MODELO COMERCIAL

**Fecha:** 2026-11-21
**Advertencia:** no se realizó investigación de mercado primaria. Las cifras de mercado y precios de este documento son **HIPÓTESIS** a validar con entrevistas y cotizaciones reales. El único precio con fuente es el publicado por OpenEduCat: Enterprise “desde US$79/año por módulo” más paquetes de usuarios, sin tarifa por estudiante (https://openeducat.org/pricing, consultado 2026-11-21; el configurador no muestra tabla completa).

---

## 1. Nombre conceptual

**“Lectiva”** — plataforma de operación académica para educación técnico-profesional.
(Nombre de trabajo. Antes de usarlo: búsqueda de marcas en INAPI y en las oficinas de los países objetivo, y de dominios. **[PENDIENTE]**)

## 2. Posicionamiento

> *Para CFT e institutos profesionales que hoy coordinan la docencia entre planillas, una intranet y Moodle, Lectiva es la plataforma que conecta lo que se planifica, lo que se dicta y lo que se evalúa, de modo que Dirección Académica sepa en todo momento qué clases se hicieron, quién está en riesgo y si se cumple el plan — sin reemplazar de golpe lo que ya funciona.*

No es “otro Moodle” ni un ERP genérico: es el **sistema de registro de la operación académica** (planificación ↔ ejecución ↔ evaluación) con una capa de análisis.

## 3. Cliente objetivo

| Segmento | Perfil (hipótesis) | Dolor principal | Prioridad |
|---|---|---|---|
| **Pequeño** | CFT/IP de 1 sede, < 1.500 estudiantes, equipo TI mínimo o externo | Planillas, errores en horarios y actas, trabajo manual en cierre de semestre | **1 (entrada)** |
| **Mediano** | 2–5 sedes, 1.500–8.000 estudiantes, jornadas diurna/vespertina | Coordinación entre sedes, cumplimiento de horas, evidencias para acreditación | **2** |
| **Grande** | Instituciones con muchas sedes, > 8.000 estudiantes, sistemas propios o ERP académico | Integración, analítica, reemplazo de sistemas legados | 3 (posterior) |
| Otros países | IES técnicas en Perú, Colombia, México | Mismo patrón, regulación distinta | Fase de escalamiento |

Compradores: Rector/a o Vicerrector/a Académico (decisor), Dirección Académica y jefes de carrera (usuarios con dolor), TI y Finanzas (influenciadores), Calidad/Acreditación (aliado).

**Tamaño de mercado:** número de CFT e IP vigentes y su matrícula deben tomarse de SIES/Mineduc **[PENDIENTE; no se estiman aquí]**.

## 4. Problema que resuelve

1. **Desconexión** entre lo planificado (Excel), lo registrado (intranet) y lo enseñado (Moodle) → nadie sabe con certeza qué clases se dictaron.
2. **Horas no ejecutadas** detectadas tarde (o en una auditoría/acreditación).
3. **Cierres de semestre** lentos y propensos a error (actas, ponderaciones, redondeos).
4. **Deserción** detectada tarde: inasistencia y bajo rendimiento no generan alertas tempranas.
5. **Informes para Dirección y acreditación** armados a mano.

## 5. Diferenciadores

1. **Planificado vs. realizado** como eje del producto (leccionario, recuperaciones, cumplimiento de horas por asignatura/sección/docente).
2. **Motor de calificación configurable con simulador** del reglamento institucional (escala chilena 1,0–7,0, ponderaciones, eximición, examen, redondeos).
3. **Convive con Moodle** (LTI 1.3 + sincronización de matrículas y notas) en vez de obligar a migrar contenidos.
4. **Inteligencia académica segura**: consultas en lenguaje natural y alertas con permisos del usuario, **sin escritura** en registros oficiales, con trazabilidad.
5. **Diseñado para técnico-profesional**: módulos, prácticas, jornadas, sedes, docentes por hora.
6. **Implementación en semanas**, plantillas de configuración por tipo de institución.

## 6. Módulos comerciales

| Módulo | Contenido | Plan |
|---|---|---|
| **Núcleo Académico** | Carreras, mallas, periodos, secciones, estudiantes, matrícula, docentes, salas, sedes, jornadas | Todos |
| **Planificación y Horarios** | Calendario, horarios por sección, conflictos, recuperaciones, carga docente | Todos |
| **Aula en Registro** | Leccionario, asistencia (móvil), cumplimiento de horas | Todos |
| **Evaluación y Actas** | Motor de notas, actas con cierre, rectificaciones, certificados con QR | Todos |
| **Portales** | Estudiante y docente (PWA), apoderados opcional | Todos |
| **Integración Moodle** | LTI 1.3, sincronización de cursos/matrículas/notas | Mediano+ (add-on en Pequeño) |
| **Inteligencia Académica** | Alertas tempranas, tableros de Dirección, consultas IA | Add-on / Grande |
| **Integraciones institucionales** | SSO, ERP/finanzas, exportes regulatorios | Grande / a medida |
| Aula virtual propia | Contenidos y actividades nativas | **Futuro**, solo si la demanda lo justifica |

## 7. Modelo de suscripción (HIPÓTESIS)

Estructura propuesta: **cargo base anual por institución + tarifa por estudiante activo por periodo**, con descuentos por volumen; implementación cobrada aparte.

| Plan | Para | Incluye | Precio (HIPÓTESIS a validar) |
|---|---|---|---|
| Esencial | Pequeño | Núcleo, Planificación, Registro, Evaluación, Portales; soporte estándar; BD compartida | Cargo base + X UF por estudiante activo/año |
| Profesional | Mediano | + Moodle, multi-sede, tableros, soporte prioritario | Cargo base mayor + tarifa por estudiante decreciente |
| Institucional | Grande | + BD dedicada, SSO, integraciones, IA, SLA contractual | Cotización |

Cómo fijar X: entrevistar al menos 10 instituciones sobre su gasto actual en intranet/licencias/horas de personal en cierre de semestre, y cotizar a 2–3 competidores locales. Usar precios en UF para contratos chilenos. **No se proponen montos concretos sin esa evidencia.**

## 8. Implementación y migración
- Paquete de implementación (cobrado): levantamiento del reglamento académico, configuración, importación desde planillas (plantillas CSV/Excel con validación), capacitación, acompañamiento del primer cierre de semestre.
- Migración de históricos: solo notas y actas cerradas en formato normalizado; los históricos completos pueden quedarse en el sistema anterior en modo consulta.
- Duración objetivo (hipótesis): Pequeño 4–6 semanas; Mediano 8–12 semanas.
- Puesta en marcha al inicio de un semestre, nunca a mitad.

## 9. Soporte
- Mesa de ayuda en español, horario hábil Chile; prioridad alta en periodos de cierre.
- Base de conocimiento y videos cortos por rol.
- SLA de disponibilidad por plan (p.ej. 99,5 % / 99,9 %) **[HIPÓTESIS]**.
- Gestor de cuenta para plan Institucional.

## 10. Integraciones
Moodle (prioridad 1), Google Workspace / Microsoft 365 (SSO y correo), sistemas de finanzas/aranceles existentes, exportes a reportería estatal (SIES u otros, formato por investigar), firma electrónica para actas y certificados, mensajería (correo/WhatsApp vía proveedor autorizado).

## 11. Estrategia de entrada al mercado
1. **Diseño con clientes (meses 0–4):** 3–5 CFT pequeños/medianos como socios de diseño; entrevistas, mapeo de procesos y reglamentos.
2. **Piloto pagado con descuento (meses 6–12):** 1–2 instituciones, una carrera o sede, un semestre completo, con métricas acordadas (horas ejecutadas detectadas, tiempo de cierre, satisfacción docente).
3. **Casos de éxito y referencias** → venta consultiva directa a CFT/IP chilenos; presencia en encuentros del sector técnico-profesional.
4. **Alianzas:** consultoras de acreditación y de Moodle (canal natural hacia instituciones que ya usan Moodle).
5. **Expansión LATAM:** primero un país con regulación similar y un socio local; perfiles de configuración por país.

## 12. Métricas de negocio a seguir
Instituciones activas, estudiantes activos facturados, % de docentes que registran asistencia en el sistema, tiempo de cierre de semestre, churn anual, costo de implementación por cliente vs. ingreso anual.
