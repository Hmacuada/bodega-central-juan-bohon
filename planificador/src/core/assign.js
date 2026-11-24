// Asignación de docentes: quién puede dictar qué, sugerencia automática y estimación de docentes necesarios.
import { activeSemesters, roman, cohortDays, blocksFor } from './calendar.js';
import { calendarOf, semanasHastaCierre } from './fechas.js';

// Capacidad del docente en horas del periodo: su tope de sesiones por semana × 3 horas × semanas del periodo.
export function capacidadHoras(state, docente) {
  const tope = docente?.tope ?? state.reglas?.tope ?? 12;
  const otra = docente?.otraCarga || 0;
  return Math.max(0, (tope - otra) * 3 * (semanasHastaCierre(calendarOf(state)) || 20));
}
// ¿Le caben esas horas más? (sinContar: horas que ya tiene y no deben sumarse dos veces).
export function leCabe(state, docente, load, horas, sinContar = 0) {
  return (load[docente.id] || 0) - sinContar + horas <= capacidadHoras(state, docente);
}

// ¿El docente puede ir todos los días del nivel? Un módulo usa los 3 días, así que basta un día bloqueado para no poder dictarlo.
export function availableForLevel(state, docente, carrera, sem) {
  if (!Array.isArray(docente.disponibilidad)) return true;
  const days = cohortDays(state.jornadas, carrera.jornada, sem);
  return days.every((d) => blocksFor(state.jornadas, carrera.jornada, d, sem).some((b) => docente.disponibilidad.includes(`${d}-${b.turno}`)));
}

export function norm(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function canTeach(docente, nombreAsignatura) {
  const n = norm(nombreAsignatura);
  return (docente.materias || []).some((m) => norm(m) === n);
}

export function qualifiedTeachers(state, nombreAsignatura) {
  return (state.docentes || []).filter((d) => canTeach(d, nombreAsignatura));
}

// Asignaturas que se dictan en el periodo (carreras con secciones abiertas).
export function neededSubjects(state, careerCode = null) {
  const out = [];
  for (const c of state.carreras) {
    if (careerCode && c.codigo !== careerCode) continue;
    for (const sem of activeSemesters(state.periodo.paridad)) {
      const secs = state.oferta?.[c.codigo]?.[sem]?.secciones || 0;
      if (!secs) continue;
      for (const a of c.semestres[sem - 1].asignaturas) out.push({ carrera: c, sem, secs, asignatura: a });
    }
  }
  return out;
}

// Carga estimada en sesiones por semana mientras dura cada módulo (3 sesiones × secciones).
export function estimatedLoad(state, asignaciones) {
  const load = {};
  for (const n of neededSubjects(state)) {
    const t = asignaciones[n.asignatura.codigo];
    if (!t) continue;
    load[t] = (load[t] || 0) + n.asignatura.horas * n.secs;
  }
  return load; // horas totales del periodo
}

// Propone docentes para las asignaturas sin docente: primero las que tienen menos candidatos,
// y entre los candidatos el que lleva menos horas asignadas.
export function suggestAssignments(state, { careerCode = null, overwrite = false } = {}) {
  const asign = { ...(state.asignaciones || {}) };
  const items = neededSubjects(state, careerCode)
    .filter((n) => overwrite || !asign[n.asignatura.codigo])
    .map((n) => ({ ...n, cands: qualifiedTeachers(state, n.asignatura.nombre).filter((d) => availableForLevel(state, d, n.carrera, n.sem)) }))
    .sort((a, b) => a.cands.length - b.cands.length);
  if (overwrite) for (const n of items) delete asign[n.asignatura.codigo];
  const load = estimatedLoad(state, asign);
  const changed = [];
  for (const n of items) {
    // Solo docentes a los que aún les cabe la asignatura (no superan su capacidad del periodo).
    const cands = n.cands.filter((d) => leCabe(state, d, load, n.asignatura.horas * n.secs));
    if (!cands.length) continue;
    const best = [...cands].sort((a, b) => (load[a.id] || 0) - (load[b.id] || 0) || a.nombre.localeCompare(b.nombre))[0];
    asign[n.asignatura.codigo] = best.id;
    load[best.id] = (load[best.id] || 0) + n.asignatura.horas * n.secs;
    changed.push(n.asignatura.codigo);
  }
  return { asignaciones: asign, changed };
}

// Resumen por carrera-semestre: secciones, docentes distintos, asignaturas sin docente, mínimo teórico.
export function teacherNeeds(state, careerCode) {
  const res = [];
  const c = state.carreras.find((x) => x.codigo === careerCode);
  for (const sem of activeSemesters(state.periodo.paridad)) {
    const secs = state.oferta?.[careerCode]?.[sem]?.secciones || 0;
    if (!secs) continue;
    const subs = c.semestres[sem - 1].asignaturas;
    const assigned = subs.map((s) => state.asignaciones?.[s.codigo]).filter(Boolean);
    res.push({
      sem, nombre: `Semestre ${roman(sem)}`, secs,
      docentes: new Set(assigned).size,
      sinDocente: subs.filter((s) => !state.asignaciones?.[s.codigo]).map((s) => s.nombre),
      minimo: secs // 2 carriles × 3 sesiones × secciones ÷ 6 bloques de los días del nivel
    });
  }
  return res;
}
