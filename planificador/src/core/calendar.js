// Calendario académico: periodos, días por nivel y bloques horarios de cada jornada.

export const DAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];
export const DAY_NAMES = { Lu: 'Lunes', Ma: 'Martes', Mi: 'Miércoles', Ju: 'Jueves', Vi: 'Viernes', Sa: 'Sábado' };
export const SESSION_HOURS = 3; // horas pedagógicas por sesión
export const SESSIONS_PER_MODULE_WEEK = 3; // un módulo se dicta en 3 sesiones por semana

// Bloques por defecto. El patrón de sábado (09:00–11:40 y 12:00–14:50) lo confirmó la coordinación.
const VESP_WEEK = [{ id: 'B1', turno: 'N1', inicio: '18:30', fin: '20:30' }, { id: 'B2', turno: 'N2', inicio: '20:50', fin: '22:50' }];
export const SATURDAY_DEFAULT_BLOCKS = [{ id: 'B1', turno: 'M1', inicio: '09:00', fin: '11:40' }, { id: 'B2', turno: 'M2', inicio: '12:00', fin: '14:50' }];
const DIUR_WEEK = [{ id: 'B1', turno: 'M1', inicio: '09:00', fin: '11:50' }, { id: 'B2', turno: 'M2', inicio: '12:10', fin: '15:00' }];

// Cada semestre lectivo tiene su propia configuración: días de clase y bloques (de lunes a viernes y, si asiste, del sábado).
function bySemester(diasPorAnio, bloques) {
  return Object.fromEntries([1, 2, 3, 4].map((s) => {
    const dias = [...diasPorAnio[levelOf(s)]];
    const b = { default: structuredClone(bloques.default) };
    if (bloques.Sa && dias.includes('Sa')) b.Sa = structuredClone(bloques.Sa);
    return [s, { dias, bloques: b }];
  }));
}

// Configuración por defecto de jornadas. Los datos "confirmado: false" son supuestos a validar con la coordinación.
export const DEFAULT_JORNADAS = {
  Vespertino: {
    confirmado: true,
    nota: 'Patrón actual de TLI: 1º año martes, jueves y sábado; 2º año lunes, miércoles y viernes.',
    sems: bySemester({ 1: ['Ma', 'Ju', 'Sa'], 2: ['Lu', 'Mi', 'Vi'] }, { default: VESP_WEEK, Sa: SATURDAY_DEFAULT_BLOCKS })
  },
  Diurno: {
    confirmado: true,
    nota: 'Patrón confirmado por coordinación: 1º año Ma-Ju-Sá (sábado en la mañana), 2º año Lu-Mi-Vi. Mismo patrón que las vespertinas.',
    sems: bySemester({ 1: ['Ma', 'Ju', 'Sa'], 2: ['Lu', 'Mi', 'Vi'] }, { default: DIUR_WEEK })
  }
};

// Convierte una jornada guardada con el formato anterior (días y bloques por año) al formato por semestre.
export function migrateJornada(j) {
  if (j.sems || !j.dias) return j;
  j.sems = bySemester(j.dias, j.bloques || { default: VESP_WEEK });
  delete j.dias;
  delete j.bloques;
  return j;
}

// Turnos para la disponibilidad del docente (filas de su grilla).
export const TURNOS = [
  { id: 'M1', nombre: 'Mañana, bloque 1' },
  { id: 'M2', nombre: 'Mañana, bloque 2' },
  { id: 'N1', nombre: 'Noche, bloque 1' },
  { id: 'N2', nombre: 'Noche, bloque 2' }
];

// Semestres lectivos. Hay un solo ingreso al año (marzo): en cada periodo se dictan solo 2 semestres por carrera,
// uno de 1º año y uno de 2º año. Periodo impar (marzo–julio): I y III. Periodo par (agosto–diciembre): II y IV.
// Así cada carrera tiene un curso por año y ambos pueden compartir sala (1º año Ma-Ju-Sá, 2º año Lu-Mi-Vi).
export const LECTIVE_SEMESTERS = [1, 2, 3, 4];
// V semestre: práctica laboral y examen de competencias (sin sala ni bloques).
export const PRACTICE_SEM = 5;
export const DAYS_PER_LEVEL = 3; // un módulo usa 3 sesiones semanales: 3 días × 2 bloques, en cada semestre

export function activeSemesters(paridad) {
  if (paridad === 'par') return [2, 4];
  if (paridad === 'impar') return [1, 3];
  return LECTIVE_SEMESTERS;
}

// Semestres con secciones abiertas en la oferta de una carrera.
export function openSemesters(state, code) {
  return activeSemesters(state.periodo?.paridad).filter((s) => state.oferta?.[code]?.[s]?.secciones);
}

export function levelOf(sem) {
  return sem <= 2 ? 1 : 2;
}

// Configuración de un semestre dentro de su jornada.
export function semConfig(jornadas, jornada, sem) {
  const j = jornadas[jornada];
  if (!j) throw new Error('Jornada desconocida: ' + jornada);
  const c = j.sems?.[sem];
  if (!c) throw new Error(`La jornada ${jornada} no tiene configurado el semestre ${roman(sem)}.`);
  return c;
}

export function cohortDays(jornadas, jornada, sem) {
  return semConfig(jornadas, jornada, sem).dias;
}

export function blocksFor(jornadas, jornada, day, sem) {
  const c = semConfig(jornadas, jornada, sem);
  return c.bloques[day] || c.bloques.default;
}

// El sábado solo hay clases en la mañana: cada bloque del sábado debe empezar antes de esta hora.
export const SATURDAY_LAST_START = '13:00';
export const isSaturdayOk = (b) => toMinutes(b.inicio) < toMinutes(SATURDAY_LAST_START);

// Devuelve un mensaje si el semestre asiste el sábado con bloques que no son de mañana.
export function saturdayIssue(jornadas, jornada, sem) {
  if (!cohortDays(jornadas, jornada, sem).includes('Sa')) return null;
  return blocksFor(jornadas, jornada, 'Sa', sem).every(isSaturdayOk) ? null
    : `El sábado solo hay clases en la mañana: los bloques del sábado del semestre ${roman(sem)} (jornada ${jornada.toLowerCase()}) deben empezar antes de las ${SATURDAY_LAST_START}.`;
}

export function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function roman(n) {
  return ['I', 'II', 'III', 'IV', 'V'][n - 1] || String(n);
}
