# DECISIÓN FINAL — ¿Utilizar, adaptar o descartar OpenEduCat?

**Fecha:** 2026-11-21 · **Base de evidencia:** auditoría estática del commit `ad47dbf8` (rama 19.0; hallazgos clave verificados también en 20.0), documentación y sitio del fabricante. **Sin pruebas dinámicas todavía** (etapa 1 del [ROADMAP](ROADMAP.md)).

---

## Recomendación

> **Descartar OpenEduCat Community como base del producto. Usarlo como referencia funcional y como herramienta de descubrimiento (prototipo rápido con usuarios), y construir un producto propio con un modelo de dominio diseñado para la educación técnico-profesional latinoamericana.**

No es un rechazo por licencia: **la LGPL-3 sí permitiría el negocio SaaS** ([AUDITORIA_LICENCIAS](AUDITORIA_LICENCIAS.md)). Es un rechazo por **encaje funcional, calidad de seguridad y dependencia estratégica**.

---

## Por qué (evidencia)

1. **Lo que necesitamos es justamente lo que falta.** Los diferenciadores del producto (malla curricular, secciones por asignatura, jornadas, sedes, recuperación de clases, horas planificadas vs. realizadas, notas 1,0–7,0 con ponderaciones, actas con cierre, avance curricular, portales, integración LMS) son **C (desarrollo propio) o D (Enterprise)** en la [MATRIZ_FUNCIONAL](MATRIZ_FUNCIONAL.md). En la simulación del ciclo de 10 pasos, solo 2 se completan sin desarrollo.
2. **El modelo de datos es plano y habría que rehacerlo**: curso↔asignatura como Many2many sin estructura, notas `Integer`, ponderación inexistente, periodo desconectado de lotes y sesiones, códigos únicos globales. Adaptarlo implica reemplazar los modelos centrales manteniendo compatibilidad con los originales: más trabajo y deuda que diseñarlos bien.
3. **Seguridad insuficiente para un SaaS con datos de estudiantes** (a confirmar dinámicamente): endpoint de asistencia sin autenticación con `sudo()`, rol académico “Manager” = administrador del sistema, ACL de portal sobre tareas sin reglas de registro, multiempresa incompleta.
4. **Telemetría oculta** que envía datos de la institución a un tercero y oculta el cron de la lista de acciones planificadas; contradice lo que declara el sitio del fabricante. Es corregible, pero es una señal sobre la gobernanza del proyecto.
5. **Community está diseñado como antesala de Enterprise**: ~80 interruptores de módulos Enterprise, redirecciones a rutas inexistentes, LMS/GPA/portal completos solo en Enterprise. Las mejoras sustantivas probablemente irán a Enterprise.
6. **Arrastre de dependencias y ciclo de versiones**: core requiere `website` y `hr`; Odoo publica una versión mayor por año y cada salto exige migrar módulos propios **y esperar** a que OpenEduCat migre los suyos (su rama 20.0 se creó el 2026-09-22; la fecha de publicación de Odoo 20 no se pudo verificar en esta auditoría).
7. **El valor real reutilizable es Odoo, no OpenEduCat**: ORM, vistas, reportes, i18n, mensajería. OpenEduCat aporta ~15 mil líneas Python de lógica académica mayormente genérica.

### Qué sí tiene valor de OpenEduCat
- Catálogo de entidades y flujos como **referencia** (no copiar código).
- Montar en 1–2 semanas un **prototipo de descubrimiento** para conversar con CFT reales.
- Ideas concretas: estados de sesión, estructura registro→hoja→línea de asistencia, validaciones de solapamiento de horario.

---

## Comparación de estrategias

| Criterio | Estrategia 1: Adaptar OpenEduCat + módulos propios | Estrategia 2: Producto independiente (OpenEduCat como referencia) |
|---|---|---|
| Tiempo hasta MVP | **≈ 5–6 meses** (HIPÓTESIS): arranque rápido en catálogos y backoffice, pero hay que rehacer malla, secciones, notas, actas, portales, seguridad y rebranding | **≈ 6–7 meses** (HIPÓTESIS) |
| Costo estimado MVP | ≈ 18–24 personas-mes | ≈ 22–30 personas-mes |
| Costo recurrente | **Alto**: migración anual Odoo + espera de OpenEduCat + parches de seguridad propios (≈ 1–3 p-m/año, HIPÓTESIS) | Medio: mantenimiento normal de dependencias |
| Complejidad | Alta: convivir con modelos originales que no encajan; dos modelos de verdad (lote vs. sección) | Media: dominio propio coherente |
| Dependencia tecnológica | Alta: Odoo (framework y su ciclo) + OpenEduCat (proveedor con incentivo Enterprise) | Baja: frameworks de uso general |
| Libertad de diseño | Limitada por el modelo y la UI de backoffice de Odoo | Total (UX móvil para docentes, portales) |
| Mantenimiento | Difícil: parches sobre código ajeno, ocultar Enterprise, rebranding | Normal |
| Riesgo de licencias | Bajo-medio (LGPL manejable; marca y contaminación con Enterprise a vigilar) | Muy bajo |
| Diferenciación comercial | Baja: se percibe como “OpenEduCat/Odoo personalizado”; competidores pueden instalar lo mismo gratis | Alta: producto y marca propios |

**Lectura honesta:** la Estrategia 1 ahorra quizá 1–2 meses al inicio, y esa ventaja desaparece con el primer ciclo de migración anual y con la deuda de adaptar un modelo que no encaja.

### Alternativa intermedia (plan B)
Si el equipo tiene **experiencia sólida en Odoo** y prefiere su framework: construir **módulos propios sobre Odoo Community, sin instalar OpenEduCat**, con un modelo académico propio, arquitectura BD-por-institución (Alternativa A de [ARQUITECTURA_SAAS](ARQUITECTURA_SAAS.md)) y portal propio. Conserva la productividad de Odoo, evita las debilidades de OpenEduCat, pero mantiene el costo de migración anual y la UX de backoffice.

---

## Adaptación Chile / Latinoamérica (resumen)
Debe desarrollarse como **configuración por país**, no como versiones distintas (detalle en [ARQUITECTURA_SAAS §4](ARQUITECTURA_SAAS.md)): escalas y redondeos, fórmulas de nota con ponderaciones, reglas de asistencia, actas y certificados con folio/QR, estructuras curriculares con créditos, calendarios con feriados, sedes y jornadas, identificadores nacionales (RUT, DNI, CC, CURP), reportería estatal (SIES en Chile, por investigar), privacidad (Ley 19.628 y Ley 21.719 en Chile) e integraciones (Moodle, SSO, finanzas). **Nada de esto existe hoy en OpenEduCat Community.**

---

## Qué está comprobado, qué es hipótesis y qué falta

| Tipo | Contenido |
|---|---|
| **Comprobado (código)** | Estructura de módulos, dependencias, modelos y campos, notas enteras, ausencia de ponderación/malla/secciones/jornadas/sedes, endpoint `auth='none'`, Manager ⇒ `group_system`, ACL portal en tareas, telemetría y cron oculto, interruptores Enterprise, ausencia de portal Community, licencias LGPL-3 en manifiestos |
| **Comprobado (fuentes del fabricante)** | LMS, GPA/gradebook, portal completo de apoderados y optimización de horarios son Enterprise (página de comparación de ediciones) |
| **Hipótesis** | Explotabilidad real de los problemas de seguridad; estimaciones de tiempo/costo; precios; umbrales de escalamiento; stack sugerido |
| **Pendiente** | Pruebas dinámicas (etapa 1); opinión jurídica (licencias, marca, Ley 21.719); confirmación de la edición de la integración Moodle; formatos SIES; validación de mercado y precios |

---

## Próximos pasos inmediatos (2–4 semanas)
1. Etapa 1: instalar OpenEduCat en Docker y **confirmar o refutar** los hallazgos de seguridad y funcionales.
2. Usar esa instalación como prototipo de descubrimiento con 3–5 CFT.
3. Recolectar reglamentos académicos reales (evaluación, asistencia, actas).
4. Consulta legal acotada (licencias, marca, protección de datos).
5. Con esa evidencia, confirmar esta decisión y el stack en la etapa 3.

**Condición que revertiría la recomendación:** que las pruebas dinámicas y el descubrimiento muestren que los CFT objetivo aceptan el modelo lote/curso de OpenEduCat sin malla, secciones ni ponderaciones (improbable dado el contexto chileno), o que el equipo tenga un plazo comercial que solo un backoffice Odoo pueda cumplir — en ese caso, aplicar el plan B, no la Estrategia 1.
