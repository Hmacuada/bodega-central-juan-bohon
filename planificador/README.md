# Planificador académico · CFT Juan Bohon (MVP)

Aplicación web local que arma el **horario sin choques** de las 15 carreras del CFT: oferta de secciones, docentes por asignatura, salas y generación automática. Todavía no incluye la planificación didáctica, las presentaciones con IA ni la publicación en Moodle; están en *Próximos pasos*.

## Cómo usarlo

Requiere Node.js 18 o más reciente. No hay dependencias que instalar.

```powershell
cd planificador
npm start
```

Abre http://localhost:3030 en el navegador.

```powershell
npm test
```

Flujo sugerido:

1. **Carreras** → elige una carrera → **Planificar** abre el asistente de 5 pasos:
   1. **Oferta:** estudiantes y secciones por semestre.
   2. **Asignaturas:** malla del semestre y su carta Gantt (módulos de 3 sesiones semanales en 2 carriles).
   3. **Docentes:** asigna quién dicta cada asignatura, a mano o con «Sugerir».
   4. **Reglas y salas:** jornada, cupo por sección y tope semanal de sesiones.
   5. **Generar:** calcula el horario de toda la sede y muestra los conflictos de esa carrera.
2. **Horario:** revisa el resultado por sección, docente o sala, semana a semana, y expórtalo a CSV.
3. **Docentes** y **Salas:** edita las fichas, la disponibilidad y la capacidad.
4. **Respaldo:** descarga o carga el estado en JSON, o reinícialo vacío o con los datos de ejemplo.

El estado se guarda en `data/state.json`, que no se versiona.

## Datos

| Origen | Contenido | Estado |
|---|---|---|
| `data/seed/carreras_mallas.json` | 15 carreras y 359 asignaturas con sus horas | Hecho: tomado de las mallas publicadas en juanbohon.cl |
| `data/seed/demo.json` | Docentes, salas y matrícula | **Ficticio**: solo sirve para probar |
| Jornada vespertina | 1º año Ma-Ju-Sá, 2º año Lu-Mi-Vi, 18:30–22:50 en 2 bloques; sábado 9:00–14:50 | Hecho: lo indicó la coordinación |
| Jornada diurna | 6 h desde las 9:00 (09:00–11:50 y 12:10–15:00) | Las horas son un dato; **los días (1º Lu-Mi-Vi, 2º Ma-Ju-Vi) son un supuesto** |

## Modelo

- Cada semestre suma 18 h semanales: 6 sesiones de 3 h, en 3 días con 2 bloques.
- Cada asignatura es un módulo de 3 sesiones por semana que dura `ceil(horas / 9)` semanas.
- Las asignaturas corren en 2 carriles paralelos, uno por bloque. El semestre dura lo que el carril más largo.
- Un docente puede tomar como máximo 6 sesiones por nivel. Entre años o carreras distintos puede llegar a 12 por semana; el tope se cambia en cada ficha y se suma la carga externa (`otraCarga`).
- Un docente que no está disponible en alguno de los 3 días del nivel no puede tomar asignaturas de ese nivel.
- Cada sección tiene una sala fija, asignada por capacidad. El tipo de sala (laboratorio, taller) es solo informativo por ahora.

### Generador (`src/core/solver.js`)

Búsqueda local *min-conflicts* con ruido y reinicios, con semilla fija, así que el mismo estado da el mismo resultado. Para cada carrera y semestre elige el orden de los módulos en los carriles, y para cada sección y día qué carril va en el bloque 1.

- **Restricciones duras:**
  - choque de docente;
  - disponibilidad;
  - tope semanal;
  - salas.
- **Preferencia blanda:** que cada asignatura quede en el mismo bloque los 3 días.

Prueba de carga (`node test/stress.mjs`): las 15 carreras, 45 secciones y 151 docentes sintéticos dan 0 conflictos en menos de 1 s.

## Estructura

```
server.js            servidor http sin dependencias (127.0.0.1:3030, API /api/state)
public/              interfaz (SPA en JS sin framework)
src/core/            lógica compartida: calendario, módulos, generador, sugerencias
data/seed/           mallas, datos de ejemplo y script que reconstruye el seed
test/                pruebas (node --test) y prueba de carga
```

## Próximos pasos

1. Cargar los docentes, las salas y la matrícula reales, y quitar los datos de ejemplo.
2. Confirmar los días de la jornada diurna.
3. Hacer que el tipo de sala sea una restricción, por ejemplo un laboratorio obligatorio para ciertas asignaturas.
4. Cuando haya un choque, sugerir docentes alternativos.
5. Planificación didáctica con fechas, a partir del horario.
6. Presentaciones por clase con IA. La clave de API la ingresa el usuario.
7. Publicación en Moodle.
