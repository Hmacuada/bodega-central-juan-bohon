// Sugerencia de distribución: completa lo que falta sin tocar las clases que ya se asignaron a mano.
// Cada sección tiene dos bloques en paralelo (bloque 1 y 2 de sus días). Para cada asignatura pendiente,
// elige el bloque donde termina antes y una sala libre (de menor a mayor capacidad que alcance para la sección),
// sin choques de sección, sala ni docente. Nunca propone clases que pasen de las semanas de la malla.
// Es una propuesta: no modifica el estado; quien planifica la acepta o la descarta.
import { buildProblem } from './solver.js';
import { buildManual, schedule, turnoAt, slotAllowed } from './manual.js';
import { toMinutes } from './calendar.js';

export function suggest(state) {
  const problem = buildProblem(state);
  const docentes = Object.fromEntries((state.docentes || []).map((d) => [d.id, d]));
  const salas = [...(state.salas || [])].sort((a, b) => a.capacidad - b.capacidad);
  // Solo se consideran las clases en formato de horas (slots); el formato anterior por bloque no se sugiere sobre él.
  const working = {};
  for (const [sid, m] of Object.entries(state.manual || {})) {
    working[sid] = Object.fromEntries(Object.entries(m).filter(([, p]) => Array.isArray(p.slots)));
  }
  let sesiones = buildManual({ ...state, manual: working }).sesiones;
  const items = [], unplaced = [];

  // ¿La clase candidata choca con una sesión existente (misma sección, sala o docente, mismo día y hora, semanas que se cruzan)?
  const clashes = (c) => sesiones.some((x) => x.dia === c.d
    && toMinutes(x.inicio) < toMinutes(c.fin) && toMinutes(c.inicio) < toMinutes(x.fin)
    && x.desde <= c.hasta && x.hasta >= c.desde
    && (x.seccionId === c.secId || x.salaId === c.salaId || (c.docenteId && x.docenteId === c.docenteId)));

  for (const sec of problem.sections) {
    const g = sec.g;
    const limite = g.semanasImpresas || 99;
    const maxB = Math.max(0, ...g.blocks.map((b) => b.length));
    // Las más largas primero: así los dos bloques quedan parejos (método de reparto LPT).
    const pend = g.subjects.filter((s) => !(working[sec.id] || {})[s.codigo]).sort((a, b) => (b.horas || 0) - (a.horas || 0));
    for (const subj of pend) {
      const teacher = state.asignaciones?.[subj.codigo] || null;
      const doc = docentes[teacher];
      // Mejor opción: la que termina antes (bloque + sala).
      let best = null;
      for (let bi = 0; bi < maxB; bi++) {
        const slots = g.days.map((d, di) => { const b = g.blocks[di][bi]; return b && { d, inicio: b.inicio, fin: b.fin }; }).filter(Boolean);
        if (!slots.length || !slots.every((x) => slotAllowed(x.d, x.inicio))) continue;
        if (doc && Array.isArray(doc.disponibilidad) && !slots.every((x) => doc.disponibilidad.includes(`${x.d}-${turnoAt(x.inicio)}`))) continue;
        const current = Object.entries(working[sec.id] || {});
        const o = Math.max(0, ...current.map(([, p]) => p.o || 0)) + 1;
        const plan = schedule(g.subjects, [...current, [subj.codigo, { slots, o, salaId: null }]]);
        const it = plan.find((x) => x.codigo === subj.codigo);
        if (!it || it.hasta > limite) continue;
        if (best && it.hasta >= best.hasta) continue;
        for (const sala of salas) {
          if (sala.capacidad < sec.size) continue;
          const pieces = slots.map((x) => ({ ...x, secId: sec.id, salaId: sala.id, docenteId: teacher, desde: it.desde, hasta: it.hasta }));
          if (pieces.some(clashes)) continue;
          best = { bi, slots, o, sala, desde: it.desde, hasta: it.hasta };
          break;
        }
      }
      if (best) {
        working[sec.id] = { ...(working[sec.id] || {}), [subj.codigo]: { slots: best.slots, o: best.o, salaId: best.sala.id } };
        items.push({ secId: sec.id, codigo: subj.codigo, slots: best.slots, salaId: best.sala.id, o: best.o, desde: best.desde, hasta: best.hasta });
        sesiones = buildManual({ ...state, manual: working }).sesiones;
      } else {
        let motivo = 'no hay bloque con sala libre y docente disponible sin choques';
        if (!salas.some((s) => s.capacidad >= sec.size)) motivo = `ninguna sala tiene ${sec.size} puestos`;
        else if (limite < 99) motivo = `no cabe en las ${limite} semanas del semestre con los bloques libres`;
        unplaced.push({ secId: sec.id, codigo: subj.codigo, motivo });
      }
    }
  }
  return { items, unplaced };
}
