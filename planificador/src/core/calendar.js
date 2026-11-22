// Calendario académico: periodos, días por nivel y bloques horarios de cada jornada.

export const DAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];
export const DAY_NAMES = { Lu: 'Lunes', Ma: 'Martes', Mi: 'Miércoles', Ju: 'Jueves', Vi: 'Viernes', Sa: 'Sábado' };
export const SESSION_HOURS = 3; // horas pedagógicas por sesión
export const SESSIONS_PER_MODULE_WEEK = 3; // un módulo se dicta en 3 sesiones por semana

// Configuración por defecto de jornadas. Los datos "confirmado: false" son supuestos a validar con la coordinación.
export const DEFAULT_JORNADAS = {
  Vespertino: {
    confirmado: true,
    nota: 'Patrón actual de TLI: 1º año martes, jueves y sábado; 2º año lunes, miércoles y viernes.',
    dias: { 1: ['Ma', 'Ju', 'Sa'], 2: ['Lu', 'Mi', 'Vi'] },
    bloques: {
      default: [{ id: 'B1', turno: 'N1', inicio: '18:30', fin: '20:30' }, { id: 'B2', turno: 'N2', inicio: '20:50', fin: '22:50' }],
      Sa: [{ id: 'B1', turno: 'M1', inicio: '09:00', fin: '11:40' }, { id: 'B2', turno: 'M2', inicio: '12:00', fin: '14:50' }]
    }
  },
  Diurno: {
    confirmado: false,
    nota: '6 horas desde las 9:00 (confirmado). Los días por nivel y el corte entre bloques son supuestos.',
    dias: { 1: ['Lu', 'Mi', 'Vi'], 2: ['Ma', 'Ju', 'Vi'] },
    bloques: {
      default: [{ id: 'B1', turno: 'M1', inicio: '09:00', fin: '11:50' }, { id: 'B2', turno: 'M2', inicio: '12:10', fin: '15:00' }]
    }
  }
};

// Turnos para la disponibilidad del docente (filas de su grilla).
export const TURNOS = [
  { id: 'M1', nombre: 'Mañana, bloque 1' },
  { id: 'M2', nombre: 'Mañana, bloque 2' },
  { id: 'N1', nombre: 'Noche, bloque 1' },
  { id: 'N2', nombre: 'Noche, bloque 2' }
];

// Semestres lectivos que se pueden planificar en cualquier periodo. Cuáles se dictan lo decide la
// oferta (secciones > 0), no la paridad del periodo: puede haber ingreso en marzo y en agosto.
export const LECTIVE_SEMESTERS = [1, 2, 3, 4];
// V semestre: práctica laboral y examen de competencias (sin sala ni bloques).
export const PRACTICE_SEM = 5;
export const DAYS_PER_LEVEL = 3; // un módulo usa 3 sesiones semanales: 3 días × 2 bloques

export function activeSemesters() {
  return LECTIVE_SEMESTERS;
}

// Semestres con secciones abiertas en la oferta de una carrera.
export function openSemesters(state, code) {
  return LECTIVE_SEMESTERS.filter((s) => state.oferta?.[code]?.[s]?.secciones);
}

export function levelOf(sem) {
  return sem <= 2 ? 1 : 2;
}

export function cohortDays(jornadas, jornada, sem) {
  const j = jornadas[jornada];
  if (!j) throw new Error('Jornada desconocida: ' + jornada);
  return j.dias[levelOf(sem)];
}

export function blocksFor(jornadas, jornada, day) {
  const j = jornadas[jornada];
  return j.bloques[day] || j.bloques.default;
}

// El sábado solo hay clases en la mañana: cada bloque del sábado debe empezar antes de esta hora.
export const SATURDAY_LAST_START = '13:00';
export const isSaturdayOk = (b) => toMinutes(b.inicio) < toMinutes(SATURDAY_LAST_START);

// Devuelve un mensaje si la jornada usa el sábado con bloques que no son de mañana.
export function saturdayIssue(jornadas, jornada) {
  const j = jornadas[jornada];
  if (!j || ![1, 2].some((lv) => j.dias[lv]?.includes('Sa'))) return null;
  return blocksFor(jornadas, jornada, 'Sa').every(isSaturdayOk) ? null
    : `El sábado solo hay clases en la mañana: los bloques del sábado de la jornada ${jornada.toLowerCase()} deben empezar antes de las ${SATURDAY_LAST_START}.`;
}

export function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function roman(n) {
  return ['I', 'II', 'III', 'IV', 'V'][n - 1] || String(n);
}
