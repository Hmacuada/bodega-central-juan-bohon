# PROPUESTA — Planificador académico para el CFT Juan Bohon

**Fecha:** 2026-11-21
**Base:** los tres documentos que recibe un docente al inicio del periodo (programa de asignatura, carga horaria y planificación didáctica de TLI-II “Gestión de Adquisiciones y Abastecimiento”) y las capturas de la intranet (Prismatic) y del campus virtual (Moodle).

---

## 1. Cómo funciona hoy (lo que muestran los documentos)

```
Programa de asignatura (.docx)        Carga horaria (.xls)               Planificación didáctica (.xlsx)
- código, semestre, 90 h              - calendario mensual por docente   - 30 clases C1..C30 × 3 h
- 25 h teóricas / 59 h prácticas / 6 h evaluación   - asignatura, carrera, desde/hasta   - unidad, RA, indicadores, contenidos
- unidades con horas, RA,             - bloques de 40 min                - FECHA (vacía, a mano)
  indicadores, contenidos             - feriados y recesos a mano        - inicio/desarrollo/cierre de cada clase
           │                                   │                                   │
           └──────── el docente lo cruza a mano ┴──── y después lo copia a ──────────┘
                                                         Intranet (horario, notas, asistencia, libro de clases)
                                                         Moodle (cursos tipo TLI2026S04C01)
```

Lo que se observa:
- **Los tres documentos describen la misma realidad desde ángulos distintos** (qué se enseña, cuándo y cómo) y **nadie los conecta**. Las fechas de la planificación quedan vacías y el docente debe calcularlas desde su carga horaria.
- **La carga horaria se arma a mano, docente por docente**, en un calendario Excel. Los bloques son de 40 minutos (vespertino 18:30–22:45 en 6 bloques; sábado 9:00–14:40 en 8 bloques). Feriados y recesos se marcan a mano.
- **Las asignaturas se dictan en módulos por ventana de fechas** (p. ej. 54 h del 3-ago al 11-sep, 3 h por día, lunes/miércoles/viernes), una tras otra.
- **Por eso hay choques**: cada carga horaria es un archivo separado. Nadie tiene la vista cruzada docente × día × bloque × sección × sala. Un choque se descubre cuando ya ocurrió.
- **Inconsistencias que ya aparecen en estos tres archivos** (a confirmar, pueden tener explicación):
  - El programa indica 90 h y la planificación tiene 30 clases × 3 h = 90 h, pero en la carga horaria la misma asignatura figura con 20 h (del 1 al 13 de octubre).
  - Esa asignatura y “Administración de Bodega e Inventarios” comparten exactamente las mismas fechas.
  - La suma de horas del calendario no coincide con la suma de horas por asignatura.

  Este tipo de diferencia es justamente lo que el sistema debe detectar solo.

---

## 2. La idea: un solo origen, todo lo demás se genera

En vez de mejorar cada planilla por separado, **los datos se ingresan una vez y los documentos y horarios salen solos**:

```
              ┌─────────────────────────── PLANIFICADOR ───────────────────────────┐
 Programas ──►│ Mallas y programas    Calendario académico    Docentes y          │
 (docx)       │ (unidades, horas,     (feriados, recesos,     disponibilidad      │
              │  RA, contenidos)      bloques por jornada)    Salas               │
              │                    ▼                                               │
              │      OFERTA DEL PERIODO: sección · asignatura · ventana · días ·   │
              │      bloques · docente · sala   ──►  MOTOR SIN CHOQUES             │
              └───────────────┬──────────────────────┬────────────────┬────────────┘
                              ▼                      ▼                ▼
                  Carga horaria por docente   Planificación didáctica   Exportes para
                  (mismo formato de hoy,      PRE-ARMADA: C1..Cn con    intranet y Moodle
                   sin errores)               fechas reales + borrador  (horarios, cursos,
                                              de cada clase             secciones)
```

### Qué lo hace mejor que “un Excel más ordenado”
1. **Choques imposibles, no solo detectados.** Un motor de restricciones valida en tiempo real docente, sección, sala y disponibilidad del docente. Un modo “proponer horario” arma la oferta completa del periodo cumpliendo todas las reglas: horas del programa, ventanas, bloques, feriados, carga máxima del docente y preferencias. La base sería un *solver* open source (p. ej. Google OR-Tools, Apache-2.0) o UniTime.
2. **La planificación didáctica llega pre-armada al docente.** Las clases C1..Cn ya vienen con su **fecha real** (calculada del horario, saltando feriados), su unidad, RA, indicadores y contenidos tomados del programa. Además incluye un **borrador generado con IA** del objetivo de la clase y de las secciones inicio/desarrollo/cierre, según la estrategia metodológica del modelo educativo. El docente revisa, ajusta y envía. Hoy escribe todo eso a mano para cada una de las 30 clases.
3. **Cambios que se propagan.** Si se suspende una clase o cambia un docente, el sistema recalcula fechas, avisa a los afectados, propone la recuperación y actualiza la carga horaria y la planificación.
4. **Revisión del jefe de carrera en un solo lugar**: estado de entrega de las planificaciones, coherencia horas del programa = horas planificadas = horas en carga horaria, y alertas de las inconsistencias de §1.
5. **Sin doble digitación**: exportes en el formato que piden la intranet y Moodle (al inicio por archivos; después por integración directa si Prismatic lo permite).
6. **Base para todo lo demás.** Con la planificación como única fuente, el siguiente paso natural es registrar si cada clase planificada se dictó (libro de clases y asistencia), y después las evaluaciones, que ya están definidas en la planificación con sus porcentajes.

La IA **redacta borradores**: no aprueba ni publica nada, y el docente siempre es el autor final.

### 2.1 Material de clase generado con IA (presentaciones por clase)
Una vez aprobada la planificación, el sistema ofrece **“Crear presentación”** en cada clase C1..Cn:
- **Insumos que ya tiene:** objetivo de la clase, contenidos, indicadores, estrategia metodológica (caso, ABP, colaborativo) y la secuencia inicio/desarrollo/cierre.
- **Resultado:** un `.pptx` editable con la **plantilla institucional** de Juan Bohon que incluye:
  - portada con asignatura, unidad y número de clase;
  - objetivo de la clase;
  - contenidos;
  - el caso o problema de la actividad;
  - instrucciones del trabajo en equipo;
  - una pregunta de cierre;
  - las notas del orador para el docente.
- **Extras opcionales por clase:** guía de trabajo para el estudiante, preguntas de evaluación formativa, pauta o rúbrica si la clase tiene evaluación.
- **Flujo:** generar → el docente revisa y edita → marca “lista” → queda adjunta a la clase y se publica en Moodle o donde corresponda.
- **Reglas:**
  - Usar la plantilla institucional.
  - No usar imágenes con derechos de autor; usar imágenes generadas o con licencia libre.
  - El contenido es un borrador revisado por el docente, con aviso de verificar datos técnicos y normativos.
  - Mostrar el costo de IA por presentación generada, para controlarlo en el plan de suscripción.
- **Publicación automática en Moodle** (campusvirtual.juanbohon.cl): cuando el docente marca una presentación como “lista”, el planificador la sube al curso de Moodle de esa sección (p. ej. `TLI2026S04C01`), en la sección de la unidad o semana que corresponde, con el nombre “Clase N – tema”. Puede quedar **oculta hasta la fecha de la clase** y hacerse visible sola ese día. Si el docente la edita, se reemplaza el archivo.
  - **Cómo se conecta:** con los Web Services REST de Moodle, usando un usuario de servicio con un token y permisos limitados solo a los cursos involucrados. La API estándar de Moodle permite subir archivos y leer cursos y secciones, pero **crear la actividad “Archivo” dentro de una sección puede no estar disponible de serie según la versión instalada [verificar]**. En ese caso hay dos caminos:
    - instalar un pequeño plugin local de Moodle (GPL) que exponga esa función;
    - publicar el material mediante LTI 1.3 *Deep Linking*, donde el planificador actúa como herramienta externa dentro del curso.
  - **Qué se necesita de Juan Bohon:** acceso de administrador de Moodle (o su equipo de TI) para crear el servicio y el token, la versión de Moodle, y la regla que vincula cada sección académica con su curso de Moodle (la nomenclatura `TLI2026S04C01` sugiere que ya existe una).
  - **Nada se publica sin aprobación del docente**, y cada subida queda registrada (qué, cuándo, quién aprobó).
- **Costo de IA y quién lo paga:**
  - Los planes de suscripción por usuario (Claude Team/Enterprise, ChatGPT Business/Enterprise) son para personas que usan el chat. **No incluyen uso de la API** por un software de terceros; la API se factura aparte, por uso [confirmar las condiciones vigentes con cada proveedor].
  - **Costo estimado por presentación vía API** (HIPÓTESIS: ~8 mil tokens de entrada y ~10 mil de salida; precios de lista de Anthropic a nov-2026, en US$ por millón de tokens):

    | Modelo | Precio de lista (entrada / salida) | Costo por presentación |
    |---|---|---|
    | Claude Haiku 5.5 | 0,10 / 0,50 | ≈ US$0,01 |
    | Claude Sonnet 5.5 | 2 / 10 | ≈ US$0,12 |
    | Claude Opus 5.5 | 4 / 20 | ≈ US$0,23 |

    Un semestre de 100 asignaturas × 30 clases (3.000 presentaciones) costaría ≈ US$30 / 360 / 700 según el modelo. El procesamiento por lotes (*batch*) cuesta un 50 % menos. Las imágenes generadas, si se usan, son un costo adicional de otro proveedor.
  - **Opciones de cobro:**
    - **(a, recomendada)** IA incluida en la suscripción del planificador, con una cuota por docente o semestre.
    - **(b)** El CFT contrata su propia cuenta de API y la conecta (“trae tu propia clave”), pagando el uso directo.
    - **(c)** Licencias de chat para docentes, solo como complemento: sirven para uso libre, pero no automatizan ni publican en Moodle.
- **Modelo “bolsa de IA” con tope (ejemplo: $1.000.000 CLP):**
  - **Supuestos (HIPÓTESIS):** tipo de cambio ≈ 950 CLP/US$ → ≈ US$1.050; se reserva ~20 % para regeneraciones, impuestos a servicios digitales extranjeros [verificar] y comisiones → ≈ US$840 útiles.
  - **Alcance:** con Sonnet 5.5 (≈ US$0,12) son ≈ 7.000 generaciones. Si cada docente regenera en promedio una vez, quedan ≈ 3.500 presentaciones finales, es decir unas **115 asignaturas de 30 clases**. Con Haiku 5.5 alcanza para mucho más; con Opus 5.5, para cerca de la mitad.
  - **Control:**
    - Tope duro en el planificador.
    - Cuota por docente o asignatura.
    - Alertas al 50 %, 80 % y 100 % de uso.
    - Límite de gasto también en la cuenta de la API, como segunda barrera.
    - Reporte de consumo por carrera.
  - **Cobro:**
    - **Anual por adelantado (recomendado):** la bolsa se paga antes de gastarse.
    - **Mensual:** nosotros financiamos el gasto inicial. Conviene cobrar la bolsa al inicio del semestre.
    - Agregar un margen por operación y soporte, y definir si el saldo no usado vence o pasa al periodo siguiente.
- **Valor:** convierte 30 clases planificadas en 30 presentaciones base en minutos, y las presentaciones quedan coherentes con el programa oficial (útil ante acreditación).

---

## 3. Qué construir primero (MVP del planificador)

| # | Funcionalidad | Valor inmediato |
|---|---|---|
| 1 | Importar programas de asignatura (.docx) → unidades, horas, RA, indicadores, contenidos | Sin redigitar |
| 2 | Calendario académico con feriados, recesos y bloques por jornada | Fechas correctas siempre |
| 3 | Oferta del periodo en una grilla visual (docente × semana × bloque) con **validación de choques en vivo** | Fin de los choques |
| 4 | Generar la **carga horaria** de cada docente en el formato actual | Lo mismo que hoy, sin errores y en minutos |
| 5 | Generar la **planificación didáctica pre-armada** (fechas + datos del programa + borrador IA) | Horas de trabajo docente ahorradas |
| 6 | Panel del jefe de carrera: coherencia de horas, planificaciones pendientes, alertas | Control antes de que empiece el semestre |
| 7 | Exportes CSV/Excel para intranet y Moodle | Cero doble digitación |
| Después | Propuesta automática de horario (*solver*), libro de clases conectado, asistencia, evaluaciones | Camino al sistema completo |

Quién lo usa: **coordinación académica** (arma la oferta), **jefes de carrera** (revisan) y **docentes** (reciben carga y planificación, ajustan y envían).

---

## 4. Cómo presentarlo en Juan Bohon
- **Problema que ya conocen:** choques de horario entre docentes y el trabajo de armar cargas y planificaciones a mano.
- **Demostración:** con los datos de una carrera (p. ej. Logística Industrial, TLI), mostrar en vivo:
  1. Un choque que el sistema bloquea.
  2. La carga horaria generada.
  3. La planificación didáctica de TLI-II con sus 30 clases fechadas y redactadas en borrador.
- **Piloto:** planificar el próximo periodo de una carrera con el planificador, en paralelo al proceso actual, y comparar choques, tiempo de armado y errores detectados.
- **No reemplaza nada el primer día:** la intranet y Moodle siguen funcionando. El planificador las alimenta.

## 5. Preguntas para validar antes de construir
1. ¿Quién arma hoy la carga horaria y con qué insumos (malla, disponibilidad docente, salas)?
2. ¿Los choques son entre docentes, entre salas, entre secciones o todos?
3. ¿Los docentes informan disponibilidad? ¿Hay docentes que hacen clases en varias carreras o sedes?
4. ¿Qué formato acepta la intranet Prismatic para cargar horarios? ¿Tiene API o importación?
5. ¿Cómo se crean hoy los cursos en Moodle (a mano o por archivo)?
6. ¿Quién revisa y aprueba las planificaciones didácticas, y en qué plazo?
7. ¿Por qué el programa dice 90 h y la carga horaria 20 h para la misma asignatura?
