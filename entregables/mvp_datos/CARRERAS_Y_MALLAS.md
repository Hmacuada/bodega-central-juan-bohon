# CFT Juan Bohon: carreras y mallas para el MVP

Fuente: [juanbohon.cl/carreras](https://juanbohon.cl/carreras/), mallas de admisión en PDF enlazadas desde cada carrera. Revisado el 21-11-2026.
Datos completos en `carreras_mallas.json` (lo genera `build_seed.js`).

**Validación:** transcribí las 15 mallas a mano desde los PDF. En las 15, la suma de horas de cada semestre coincide con el total impreso en la malla. Aun así, conviene que alguien de la institución revise los nombres.

## 1. Oferta publicada

| Código* | Carrera | Jornada | Horas lectivas | S1 | S2 | S3 | S4 |
|---|---|---|---|---|---|---|---|
| TLI | Logística Industrial | Vespertino | 1.602 | 396 | 396 | 396 | 414 |
| APM | Administración de Procesos Mineros | Vespertino | 1.620 | 396 | 414 | 414 | 396 |
| EEI | Electricidad y Electrónica Industrial | Vespertino | 1.602 | 378 | 396 | 432 | 396 |
| EER | Electricidad y Energías Renovables | Vespertino | 1.620 | 396 | 432 | 414 | 378 |
| EME | Electromecánica | Vespertino | 1.602 | 414 | 396 | 414 | 378 |
| IAC | Instrumentación, Automatización y Control Industrial | Vespertino | 1.638 | 378 | 414 | 432 | 414 |
| MMI | Mantenimiento Mecánico Industrial | Vespertino | 1.620 | 432 | 378 | 414 | 396 |
| MMP | Mecánica en Maquinaria Pesada | Vespertino | 1.602 | 414 | 396 | 378 | 414 |
| MME | Minería y Metalurgia | Vespertino | 1.602 | 396 | 396 | 396 | 414 |
| TOP | Topografía | Vespertino | 1.602 | 396 | 396 | 396 | 414 |
| AED | Asistente de Educación Diferencial | Diurno | 1.602 | 396 | 414 | 396 | 396 |
| COS | Cosmetología | Diurno | 1.620 | 378 | 414 | 414 | 414 |
| ESI | Estética Integral | Diurno | 1.620 | 378 | 414 | 396 | 432 |
| GCI | Gastronomía y Cocina Internacional | Diurno | 1.620 | 414 | 378 | 396 | 432 |
| OMP | Operación y Mantención de Maquinaria Pesada | Diurno | 1.620 | 396 | 414 | 396 | 414 |

\* Los códigos son míos. Salen del nombre del PDF de cada malla, salvo APM: su PDF se llama `pmi_malla`.

**Estructura común a las 15 carreras:**
- 4 semestres lectivos, más un V semestre con 400 h de práctica laboral y examen de competencias.
- 24 asignaturas por carrera; solo Electromecánica tiene 23, porque su IV semestre trae 5.
- Asignaturas de 54, 72 o 90 h. Gastronomía tiene dos talleres de 108 h.
- Ingreso con licencia de enseñanza media.
- La web dice que todas tienen gratuidad.

## 2. Hallazgos que importan para el planificador

1. **El ritmo semanal es siempre de 18 horas.** Cada semestre dura entre 21 y 24 semanas y tiene entre 378 y 432 horas. En todos los casos, horas ÷ semanas = 18. Con sesiones de 3 h son **6 sesiones por semana**: 3 días × 2 bloques. Esto coincide con el patrón que me diste para TLI (1º año Ma-Ju-Sá, 2º año Lu-Mi-Vi).
2. **La duración del semestre cambia según la carrera y el semestre (21 a 24 semanas).** El calendario no puede ser fijo de 22 semanas: se calcula desde las horas de la malla.
3. **Hay 4 asignaturas transversales idénticas en las 15 carreras:**
   - Tecnologías de la Información
   - Comunicación Efectiva
   - Taller de Habilidades Sociales
   - Innovación y Creatividad

   Todas son de 54 h y suman 60 secciones al año si cada carrera abre una sola. El MVP las trata como un **pool de docentes transversales** compartido por toda la sede.
4. **Hay asignaturas repetidas con distinto número de horas.** Inglés Técnico aparece en 11 carreras y Matemática Básica en otras 11, unas veces con 54 h y otras con 72 h. Tienen el mismo nombre, pero son programas distintos: el sistema debe identificarlas por carrera y no solo por nombre.
5. **Hay familias de carreras que comparten especialidad, y por tanto docentes:**
   - Eléctrica (EEI, EER, IAC, EME): corriente continua y alterna, electrónica básica, física aplicada.
   - Maquinaria pesada (MMP, OMP): tribología, tren de fuerza, oleohidráulica, motores.
   - Minería (MME, APM): liderazgo, ética, control y monitoreo de procesos mineros.
   - Belleza (COS, ESI): asepsia, primeros auxilios, maquillaje, cejas y pestañas, epilación, asesoría de imagen.

   El asistente puede sugerir docentes desde la familia, no solo desde la carrera.
6. **Hay nombres casi iguales que conviene unificar**, por ejemplo «Prevención de Riesgos y Medio Ambiente» y «… y Medioambiente». Lo dejé tal como está en cada malla.

## 3. Jornadas que usará el generador

| Jornada | Bloque 1 | Bloque 2 | Días | Estado |
|---|---|---|---|---|
| Vespertino, Lu–Vi | 18:30–20:30 | 20:50–22:50 | 1º año: Ma-Ju-Sá · 2º año: Lu-Mi-Vi | Confirmado para TLI; el corte entre bloques es un supuesto |
| Vespertino, sábado (1º año) | 09:00–11:40 | 12:00–14:50 | Sá | Confirmado para TLI |
| Diurno | 09:00–11:50 | 12:10–15:00 | 3 días por nivel (supuesto) | Confirmado: 6 h desde las 9:00. El corte entre bloques y los días son supuestos |

Con 2 bloques al día, las dos jornadas dan 6 sesiones por semana en 3 días, que es justo lo que piden las mallas (18 h por semana). Así, el generador usa la misma regla para las 15 carreras y solo cambian el horario de los bloques y los días.

## 4. Lo que la web no dice y el MVP necesita

| Dato | Para qué se usa | Dónde conseguirlo |
|---|---|---|
| Días de la jornada diurna por nivel, y corte exacto entre bloques | Generar horarios de AED, COS, ESI, GCI, OMP | Coordinación académica |
| Confirmar el patrón Lu-Mi-Vi / Ma-Ju-Sá en todas las vespertinas | Reglas del generador | Coordinación académica |
| Matrícula por carrera y nivel, y número de secciones | Paso 1 «Oferta» | Prismatic / registro académico |
| Docentes, especialidad y carga actual | Paso 3 «Docentes» | Recursos humanos / Prismatic |
| Salas, capacidad y laboratorios (cocina, taller, eléctrico) | Asignar salas | Infraestructura |
| Programas de asignatura (resultados de aprendizaje, unidades) | Planificación didáctica y PPT con IA | Dirección académica |
| Sedes | Hoy solo aparece La Serena | Confirmar con el CFT |
| Calendario académico 2027 | Fechas reales de cada clase | Dirección académica |

**Carreras que aparecen en documentos de oferta pero no en el listado actual:** Técnico en Construcción y Prevención de Riesgos y Sustentabilidad. Habría que confirmar si se dictan.

## 5. Propuesta de alcance para el MVP

- **Datos:** cargar las 15 carreras con sus 359 asignaturas desde `carreras_mallas.json`.
- **Piloto de horarios:** las 15 carreras, con la misma regla de 3 días × 2 bloques. Se parte por TLI y las vespertinas, que tienen los días confirmados. Las 5 diurnas usan el bloque de 9:00 a 15:00 y quedan en borrador hasta que se confirme qué días va cada nivel.
- **Docentes:** un pool transversal para las 4 asignaturas comunes, más pools por familia de especialidad.
- **Planificación y PPT con IA:** partir con una sola carrera (TLI), porque requiere los programas de asignatura, que no son públicos.
