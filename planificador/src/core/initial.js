// Estado inicial del planificador a partir de las mallas (semilla) y de los datos de ejemplo.
import { DEFAULT_JORNADAS, DAYS, TURNOS } from './calendar.js';
import { suggestAssignments } from './assign.js';

export const ALL_SLOTS = DAYS.flatMap((d) => TURNOS.map((t) => `${d}-${t.id}`));

export function buildInitialState(seed, demo, { withDemo = true } = {}) {
  const state = {
    version: 1,
    institucion: seed.institucion,
    fuenteMallas: seed.fuente,
    periodo: { anio: 2027, paridad: 'impar', nombre: 'Otoño 2027' },
    jornadas: structuredClone(DEFAULT_JORNADAS),
    reglas: { cupo: 30, tope: 12 },
    carreras: seed.carreras.map((c) => ({
      codigo: c.codigo, nombre: c.nombre, jornada: c.jornada, fuente: c.fuente,
      semestres: c.semestres.map((s) => ({ n: s.n, horas: s.horas, semanas_impresas: s.semanas_impresas, asignaturas: s.asignaturas }))
    })),
    oferta: {},
    docentes: [],
    salas: [],
    asignaciones: {},
    horario: null,
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

export function periodName(anio, paridad) {
  return `${paridad === 'par' ? 'Primavera' : 'Otoño'} ${anio}`;
}
