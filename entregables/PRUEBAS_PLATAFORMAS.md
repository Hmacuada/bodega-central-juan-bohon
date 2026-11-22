# PRUEBAS DE PLATAFORMAS — Timefold y Presenton

**Fecha:** 2026-11-21 · **Equipo de prueba:** notebook local, Docker Desktop 29.8 (8 CPU, 3,8 GB RAM para Docker).

---

## 1. Timefold (horarios sin choques) — PROBADO

### Qué se probó
- Repositorio [TimefoldAI/timefold-quickstarts](https://github.com/TimefoldAI/timefold-quickstarts), commit `6ff62a1` (2026-11-03), ejemplo `use-cases/school-timetabling` **sin modificar el código**.
- Compilado con Maven en Docker y ejecutado como servicio REST (Quarkus) con un límite de 20 s por corrida.
- Datos **ficticios** de una sede con 4 carreras (TLI-II, TLI-IV, PMI-II, PMI-IV), usando los bloques reales de la carga horaria:
  - **De lunes a viernes:** 18:30–20:30 y 20:45–22:45.
  - **Sábado:** 9:00–11:40 y 12:00–14:40.
  - En total, **12 bloques de clase por semana**.
- Un docente transversal (como en la carga real) dicta en TLI-II, TLI-IV y PMI-II.
- Además del puntaje del motor, un script propio **verificó de forma independiente** que no hubiera choques.

### Resultados
| Escenario | Sesiones/semana | Secciones | Docentes | Salas | Primera solución sin choques | Choques (verificación propia) |
|---|---|---|---|---|---|---|
| Piloto | 31 | 4 | 15 | 4 | 2,8 s | 0 |
| Sede | 124 | 16 | 34 | 14 | 1,2 s | 0 |
| Grande | 310 | 40 | 68 | 34 | 2,2 s | 0 |
| Saturada (pocas salas, docentes con 4 secciones) | 124 | 16 | 17 | 11 | 1,1 s | 0 |
| **Imposible** (108 cupos sala-bloque para 124 sesiones) | 124 | 16 | 17 | 9 | nunca | **16 de sala**: exactamente las que no caben |

- **Memoria del servicio:** unos 300 MB. La parte de preferencias del puntaje (soft) sigue mejorando hasta el límite de tiempo; los choques (hard) se eliminan en 1 a 3 s.
- **Cuando el horario es imposible**, el motor no lo oculta: indica cuántos choques quedan y de qué tipo. Eso sirve para que el planificador diga “faltan 2 salas el jueves” en vez de fallar.

### Qué le falta al ejemplo (hay que desarrollarlo; son restricciones nuevas sobre el mismo motor)
1. **Disponibilidad de cada docente** (días y horas en que puede hacer clases). Es lo más urgente.
2. **Tipo y capacidad de sala:** laboratorio, taller, número de estudiantes.
3. **Jornadas y sedes:** diurna, vespertina y sábado.
4. **Calendario real:** feriados, recesos y fechas de inicio y fin por asignatura, como en la carga horaria.
5. **Duraciones distintas:** el sábado los bloques son de 4 horas pedagógicas y en la semana de 3.
6. **Fijar** a mano algunas clases y que el motor respete el resto.
7. **Explicar** cada choque con su causa, en lenguaje de la coordinación académica.

### Licencia y edición
- Apache-2.0: permite uso comercial y modificar el código sin publicarlo.
- **Existe Timefold Enterprise**, de pago. Su configuración muestra que el uso de varios núcleos por corrida es solo Enterprise (`%enterprise.quarkus.timefold.solver.move-thread-count`). Para el tamaño de un CFT no hizo falta: 310 sesiones se resolvieron sin choques en 2 s con un solo hilo.

**Conclusión:** sirve como motor de horarios. Se recomienda clonar el ejemplo como punto de partida y agregar las restricciones 1 a 7.

---

## 2. Presenton (PPT con IA) — NO PROBADO TODAVÍA

### Qué se verificó sin instalar (README del repositorio)
- Apache-2.0. Se autoaloja con Docker, admite Anthropic (`LLM=anthropic`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`) y Ollama local, tiene una API de generación y exporta **PPTX editable** con plantillas propias.
- **Telemetría anónima activada por defecto.** Se apaga con `DISABLE_ANONYMOUS_TRACKING=true` y `PRESENTON_COMMUNITY_ENABLED=false`. Hay que apagarla antes de usar datos de la institución.
- **Existe Presenton Enterprise**, de pago: Helm, registros de auditoría, consola de administración, SSO y SCIM. La versión abierta no trae esas funciones; las cubriría nuestra propia aplicación, que llamaría a Presenton por API.
- El modelo de Anthropic por defecto en su documentación es antiguo (`claude-3-5-sonnet-20241022`). Habría que configurarlo con uno actual.

### Por qué no se probó
- La imagen pesa unos 3,5 GB comprimidos, cerca de 8 GB instalada, y el disco C: tiene **7,9 GB libres**.
- Para medir calidad y costo reales hace falta una clave de API de Claude. La debe ingresar el usuario, no el asistente.
- El único modelo local disponible (qwen2.5:3b, en Ollama) solo sirve para probar el funcionamiento, no la calidad.

### Prueba pendiente (cuando haya espacio)
1. Liberar espacio o usar otro disco para Docker.
2. Levantar Presenton con la telemetría apagada.
3. Generar la clase C3 de TLI-II con la plantilla del CFT, primero con Ollama (funcionamiento) y luego con Claude (calidad y costo real por presentación).
4. Comparar con la muestra C2 hecha a mano.
