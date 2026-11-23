// Estado inicial del planificador a partir de las mallas (semilla) y de los datos de ejemplo.
import { DEFAULT_JORNADAS, DAYS, TURNOS, migrateJornada } from './calendar.js';
import { suggestAssignments } from './assign.js';
import { manualFromSolved } from './manual.js';

// El sábado no hay turnos de noche: solo mañana.
export const ALL_SLOTS = DAYS.flatMap((d) => TURNOS.filter((t) => d !== 'Sa' || t.id.startsWith('M')).map((t) => `${d}-${t.id}`));

export function buildInitialState(seed, demo, { withDemo = true } = {}) {
  const state = {
    version: 1,
    institucion: seed.institucion,
    fuenteMallas: seed.fuente,
    periodo: { anio: 2027, paridad: 'impar', nombre: 'Otoño 2027' },
    jornadas: structuredClone(DEFAULT_JORNADAS),
    reglas: { cupo: 30, tope: 12, diasFijos: [] },
    carreras: seed.carreras.map((c) => ({
      codigo: c.codigo, nombre: c.nombre, jornada: c.jornada, fuente: c.fuente,
      practica: { horas: c.practica_laboral_horas || 400, examen: c.examen_competencias !== false },
      semestres: c.semestres.map((s) => ({ n: s.n, horas: s.horas, semanas_impresas: s.semanas_impresas, asignaturas: s.asignaturas }))
    })),
    oferta: {},
    docentes: [],
    salas: [],
    asignaciones: {},
    horario: null,
    manual: {},
    datosDeEjemplo: false
  };
  if (withDemo && demo) {
    state.oferta = structuredClone(demo.oferta);
    state.salas = structuredClone(demo.salas);
    state.docentes = demo.docentes.map((d) => ({
      id: d.id, nombre: d.nombre, especialidad: d.especialidad || '', materias: d.materias || [],
      disponibilidad: ALL_SLOTS.filter((s) => !(d.disponibilidad_excluye || []).includes(s)),
      tope: d.tope ?? null, otraCarga: d.otraCarga || 0
    }));
    state.asignaciones = suggestAssignments(state).asignaciones;
    state.datosDeEjemplo = true;
  }
  return state;
}

// Completa estados guardados con versiones anteriores (sin práctica configurable, por ejemplo).
export function migrateState(state, seed = null) {
  for (const c of state.carreras || []) {
    if (!c.practica) {
      const src = seed?.carreras?.find((x) => x.codigo === c.codigo);
      c.practica = { horas: src?.practica_laboral_horas || 400, examen: true };
    }
  }
  for (const d of state.docentes || []) if (Array.isArray(d.disponibilidad)) d.disponibilidad = d.disponibilidad.filter((s) => ALL_SLOTS.includes(s));
  for (const j of Object.values(state.jornadas || {})) migrateJornada(j);
  state.oferta = state.oferta || {};
  // Planificación a mano: si ya había un horario generado, se convierte para poder ajustarlo.
  if (!state.manual) state.manual = state.horario ? manualFromSolved(state.horario) : {};
  return state;
}

export function periodName(anio, paridad) {
  return `${paridad === 'par' ? 'Primavera' : 'Otoño'} ${anio}`;
}
