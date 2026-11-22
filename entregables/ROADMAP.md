# ROADMAP

**Fecha:** 2026-11-21
**Supuesto de equipo (HIPÓTESIS):** 1 arquitecto/líder técnico, 3 desarrolladores full-stack, 1 PM/analista funcional con experiencia en gestión académica, QA a tiempo parcial, asesoría legal puntual. Con otro tamaño de equipo los plazos cambian casi proporcionalmente.
**Estrategia asumida:** la recomendada en [DECISION_FINAL](DECISION_FINAL.md): OpenEduCat solo como prototipo de descubrimiento y referencia; producto propio.

Las estimaciones son rangos con incertidumbre alta antes de la etapa 2; se re-estiman al cerrar cada etapa.

---

| # | Etapa | Duración | Esfuerzo aprox. | Depende de |
|---|---|---|---|---|
| 1 | Instalación y auditoría técnica dinámica | 2 semanas | 0,75 persona-mes | — |
| 2 | Pruebas funcionales y descubrimiento con CFT | 3–4 semanas | 2 p-m | 1 |
| 3 | Prototipo CFT (descubrimiento) + diseño del producto | 4–6 semanas | 4–5 p-m | 2 |
| 4 | Desarrollo del MVP (módulos propios) | 5–7 meses | 22–30 p-m | 3 |
| 5 | Piloto institucional | 1 semestre (~5 meses, solapa con 4 al final) | 8–10 p-m | 4 |
| 6 | Producto SaaS (endurecimiento y multi-tenant productivo) | 3–4 meses | 12–16 p-m | 5 |
| 7 | Escalamiento comercial | continuo desde mes ~16 | — | 6 |
| 8 | Inteligencia académica | 3–4 meses (iniciable en paralelo a 6) | 8–12 p-m | 4 (data mart), 6 |

Horizonte total hasta producto comercial: **≈ 16–20 meses**.

---

## Etapa 1 — Instalación y auditoría técnica dinámica
**Objetivo:** confirmar con pruebas lo que esta auditoría estática concluyó.
- Levantar Odoo 19 (y 20) Community + OpenEduCat con Docker y PostgreSQL, **sin datos demo** y con datos demo.
- Desactivar el cron de telemetría antes de cualquier dato real.
- Pruebas de seguridad: endpoint `/openeducat-attendance/take-attendance` sin sesión; usuario portal leyendo/escribiendo `op.assignment` y `op.assignment.sub.line` ajenos vía JSON-RPC; alcance real del rol “Manager”.
- Verificar restricciones de horario desactivadas por defecto; bloqueo (o no) de notas tras validar acta.
- Ejecutar los 213 tests incluidos.

**Entregables:** informe de pruebas con evidencia (capturas, scripts), actualización de la [MATRIZ_FUNCIONAL](MATRIZ_FUNCIONAL.md) con la columna PF. **Riesgo:** que una prueba refute una conclusión → se corrige el documento.

## Etapa 2 — Pruebas funcionales y descubrimiento
- Ejecutar el ciclo de 10 pasos con datos de un CFT ficticio en OpenEduCat (sin programar).
- Entrevistas con 5–10 CFT/IP: procesos reales, reglamentos de evaluación y asistencia, sistemas actuales, disposición de pago.
- Recopilar 3+ reglamentos académicos reales y formatos de acta/certificado.

**Entregables:** mapa de procesos “as-is”, catálogo de reglas de evaluación, lista priorizada de requisitos, hipótesis de precio revisada. **Riesgo:** acceso a instituciones → usar red de contactos y consultoras de acreditación.

## Etapa 3 — Prototipo CFT y diseño del producto
- Prototipo navegable (puede ser OpenEduCat configurado + maquetas de las pantallas que faltan: malla, secciones, motor de notas, leccionario, portal docente móvil).
- Modelo de dominio propio (malla versionada, sección, jornada, sede, leccionario, componente de evaluación, acta).
- Decisión final de stack y arquitectura ([ARQUITECTURA_SAAS](ARQUITECTURA_SAAS.md)).
- Validación con 2–3 socios de diseño.

**Entregables:** modelo de datos, prototipo validado, backlog del MVP, arquitectura aprobada, opinión legal inicial (licencias, marca, Ley 21.719). **Riesgo:** sobre-alcance → el MVP se limita a planificación, registro, asistencia, notas y actas.

## Etapa 4 — Desarrollo del MVP
Orden sugerido (incrementos de 2–3 semanas):
1. Plataforma: tenants, identidad, roles granulares, auditoría, RLS.
2. Núcleo académico: carreras, mallas, periodos, sedes, jornadas, secciones, matrícula, importadores.
3. Planificación: calendario con feriados, horarios por sección, conflictos, carga docente.
4. Registro: leccionario, asistencia móvil, recuperaciones, cumplimiento de horas.
5. Evaluación: motor configurable con simulador, actas con cierre y rectificación.
6. Portales estudiante/docente, certificados con folio/QR.
7. Integración Moodle (LTI 1.3 + WS) básica.

**Entregables:** MVP desplegado en entorno de pre-producción, documentación de usuario, pruebas automáticas (incluidas pruebas de aislamiento entre tenants). **Riesgos:** complejidad del motor de notas (mitigar con el catálogo de reglas de la etapa 2), rotación del equipo.

## Etapa 5 — Piloto institucional
- 1–2 instituciones, una carrera o sede, **un semestre completo** incluido el cierre.
- Corre en paralelo con el sistema actual las primeras semanas (doble registro mínimo acordado).
- Métricas: % de clases registradas, horas no ejecutadas detectadas, tiempo de cierre, errores de acta, satisfacción docente.

**Entregables:** informe de piloto, lista de correcciones, caso de éxito/referencia. **Riesgos:** resistencia docente (mitigar con app móvil simple y capacitación), fallas en periodo crítico (soporte reforzado).

## Etapa 6 — Producto SaaS
- Plano de control: alta de clientes, planes, facturación, aprovisionamiento, respaldos/restauración por tenant probados, monitoreo y alertas.
- Seguridad: pruebas de penetración externas, política de privacidad y contrato de encargo de tratamiento, registro de actividades de tratamiento.
- Perfiles de configuración Chile listos; preparación de un segundo perfil de país.

**Entregables:** producto vendible con SLA, documentación legal y técnica. **Riesgo:** costo de operación → medir costo por tenant desde el piloto.

## Etapa 7 — Escalamiento comercial
- Venta consultiva a CFT/IP; alianzas con consultoras Moodle/acreditación; implementación estandarizada.
- Primer país adicional con socio local.

**Entregables:** pipeline, playbook de implementación, perfiles por país. **Riesgo:** implementación artesanal no escalable → plantillas y herramientas de importación.

## Etapa 8 — Inteligencia académica
- Data mart de solo lectura alimentado por eventos.
- Alertas: clases no ejecutadas, inasistencia, rendimiento, conflictos, cumplimiento de planificación.
- Consultas en lenguaje natural con el alcance de permisos del usuario, citando fuentes, **sin capacidad de escritura**, con registro de consultas y evaluación de calidad.
- Revisión de privacidad: qué datos se envían a proveedores de modelos de IA y bajo qué contrato.

**Entregables:** tableros de Dirección, motor de alertas, asistente de consultas. **Riesgos:** respuestas incorrectas (mitigar con consultas estructuradas verificables y citas), exposición de datos (mitigar con permisos y minimización).

---

## Riesgos transversales
| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| Subestimar el motor de calificación y actas | Alta | Alto | Catálogo de reglamentos reales en etapa 2, simulador |
| Ciclo de venta largo en instituciones | Alta | Alto | Socios de diseño desde el inicio, piloto pagado |
| Cambios regulatorios (Ley 21.719 con vigencia prevista desde dic-2026 [verificar], normativa de educación superior) | Media | Alto | Asesoría legal, privacidad desde el diseño |
| Dependencia de Moodle para LMS | Media | Medio | Integración estándar (LTI), no acoplada |
| Equipo pequeño frente a alcance amplio | Alta | Alto | MVP acotado; no construir LMS ni ERP financiero |
