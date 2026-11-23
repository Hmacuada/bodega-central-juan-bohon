// Planificación a mano: el encargado pone cada asignatura de una sección en los bloques que quiera
// (cualquier día y hora de la grilla, salvo el sábado en la tarde/noche) y le elige sala.
// Cada asignatura dura las semanas que piden sus horas según cuántas sesiones tenga por semana,
// y empieza cuando sus bloques quedan libres (las del mismo bloque se dictan una tras otra).
//
// state.manual = { [seccionId]: { [codigoAsignatura]: { slots: [{ d, inicio, fin }], o: orden, salaId } } }
// (formato anterior aceptado: { b: 0|1, o, salaId } = el bloque b de los días configurados del semestre)
import { DAYS, DAY_NAMES, roman, toMinutes, SESSION_HOURS, SATURDAY_LAST_START } from './calendar.js';
import { buildProblem, secLabel } from './solver.js';
import { calendarOf, sesionesDe, weekOf, addDays, fmtFecha } from './fechas.js';

const overlap = (a, b) => a.day === b.day && a.s < b.e && b.s < a.e && Math.max(a.w0, b.w0) <= Math.min(a.w1, b.w1);

// Turno de disponibilidad del docente según la hora de inicio.
export function turnoAt(inicio) {
  const m = toMinutes(inicio);
  return m < 12 * 60 ? 'M1' : m < 17 * 60 ? 'M2' : m < 20 * 60 + 30 ? 'N1' : 'N2';
}

// El sábado solo hay clases en la mañana.
export const slotAllowed = (d, inicio) => d !== 'Sa' || toMinutes(inicio) < toMinutes(SATURDAY_LAST_START);

// Semanas que dura una asignatura con n sesiones por semana.
export const weeksFor = (horas, n) => Math.max(1, Math.ceil(horas / SESSION_HOURS / Math.max(1, n)));

// Bloques de una colocación (acepta el formato anterior por bloque).
function slotsOf(p, g) {
  if (Array.isArray(p.slots) && p.slots.length) return p.slots;
  return g.days.map((d, di) => { const bl = g.blocks[di][p.b || 0]; return bl && { d, inicio: bl.inicio, fin: bl.fin }; }).filter(Boolean);
}

// Ordena las asignaturas colocadas y les da semanas: cada una empieza cuando todos sus bloques quedan libres.
// Con calendario (`cal`), las fechas son reales: se cuentan las sesiones día a día (sábado 4 horas, los demás 3),
// saltando feriados y recesos, y cada asignatura empieza el día siguiente a que termina la anterior en esos bloques.
// Sin calendario se usan semanas abstractas (lo que usa el solver).
export function schedule(subjects, entries, cal = null) {
  if (cal) return scheduleFechas(subjects, entries, cal);
  const busy = []; // { day, s, e, w1 }
  return [...entries].sort((x, y) => (x[1].o || 0) - (y[1].o || 0)).map(([codigo, p]) => {
    const subj = subjects.find((x) => x.codigo === codigo);
    const slots = p.slots.map((x) => ({ ...x, s: toMinutes(x.inicio), e: toMinutes(x.fin) }));
    const dur = weeksFor(subj?.horas || 0, slots.length);
    // Si la clase trae su semana de inicio (propuesta del solver), se respeta; si no, empieza lo antes posible.
    const start = Number.isFinite(p.desde) ? p.desde : Math.max(1, ...busy.filter((b) => slots.some((x) => x.d === b.day && x.s < b.e && b.s < x.e)).map((b) => b.w1 + 1));
    const item = { codigo, slots, desde: start, hasta: start + dur - 1, salaId: p.salaId || null, sesiones: slots.length };
    for (const x of slots) busy.push({ day: x.d, s: x.s, e: x.e, w1: item.hasta });
    return item;
  });
}

function scheduleFechas(subjects, entries, cal) {
  const busy = []; // { day, s, e, fin }
  return [...entries].sort((x, y) => (x[1].o || 0) - (y[1].o || 0)).map(([codigo, p]) => {
    const subj = subjects.find((x) => x.codigo === codigo);
    const slots = p.slots.map((x) => ({ ...x, s: toMinutes(x.inicio), e: toMinutes(x.fin) }));
    const prev = busy.filter((b) => slots.some((x) => x.d === b.day && x.s < b.e && b.s < x.e)).map((b) => addDays(b.fin, 1));
    const desdeIso = prev.length ? prev.sort().at(-1) : cal.inicio;
    const { fechas, horas } = sesionesDe(cal, slots.map((x) => x.d), subj?.horas || 0, desdeIso);
    const first = fechas[0]?.fecha || desdeIso, last = fechas.at(-1)?.fecha || desdeIso;
    // Semanas por día: la primera y la última sesión de cada día de la semana.
    const porDia = {};
    for (const x of fechas) { const w = weekOf(cal, x.fecha); const r = (porDia[x.d] ||= [w, w]); r[0] = Math.min(r[0], w); r[1] = Math.max(r[1], w); }
    const item = { codigo, slots, desde: weekOf(cal, first), hasta: weekOf(cal, last), salaId: p.salaId || null, sesiones: slots.length,
      fechaInicio: first, fechaFin: last, horasDadas: horas, nSesiones: fechas.length, porDia };
    for (const x of slots) busy.push({ day: x.d, s: x.s, e: x.e, fin: last });
    return item;
  });
}

// Semanas que tendría una asignatura si se coloca (o se cambia) en esos bloques.
export function previewWeeks(state, sec, codigo, slots) {
  const g = sec.g;
  const others = Object.entries(state.manual?.[sec.id] || {})
    .filter(([c]) => c !== codigo && g.subjects.some((s) => s.codigo === c))
    .map(([c, p]) => [c, { ...p, slots: slotsOf(p, g) }]);
  const mine = state.manual?.[sec.id]?.[codigo];
  const o = mine ? mine.o : Math.max(0, ...others.map(([, p]) => p.o || 0)) + 1;
  const items = schedule(g.subjects, [...others, [codigo, { slots, o, salaId: null }]], calendarOf(state));
  const it = items.find((x) => x.codigo === codigo);
  return { w0: it.desde, w1: it.hasta };
}

export function buildManual(state) {
  const problem = buildProblem(state);
  const docentesById = Object.fromEntries((state.docentes || []).map((d) => [d.id, d]));
  const salasById = Object.fromEntries((state.salas || []).map((r) => [r.id, r]));
  const man = state.manual || {};
  const res = {
    manual: true, generadoEn: new Date().toISOString(), periodo: { ...state.periodo },
    secciones: [], sesiones: [], conflictos: [], avisos: [], cargaDocentes: {}, semanasMax: 0,
    resumen: { secciones: 0, sesionesSemana: 0, choquesDocente: 0, sinDocente: 0, salas: 0, disponibilidad: 0, tope: 0, asignadas: 0, total: 0 }
  };
  const pieces = [];
  let sesionesSemana = 0;
  const cal = calendarOf(state);
  res.calendario = cal;
  for (const sec of problem.sections) {
    const g = sec.g;
    const placed = Object.entries(man[sec.id] || {})
      .filter(([c]) => g.subjects.some((s) => s.codigo === c))
      .map(([c, p]) => [c, { ...p, slots: slotsOf(p, g) }]);
    const items = schedule(g.subjects, placed, cal);
    const semanas = Math.max(0, ...items.map((i) => i.hasta));
    res.semanasMax = Math.max(res.semanasMax, semanas);
    const salaCount = {};
    for (const it of items) {
      const teacher = state.asignaciones?.[it.codigo] || null;
      if (it.salaId) salaCount[it.salaId] = (salaCount[it.salaId] || 0) + 1;
      for (const x of it.slots) pieces.push({ sec, codigo: it.codigo, teacher, salaId: it.salaId, day: x.d, s: x.s, e: x.e, inicio: x.inicio, fin: x.fin, turno: turnoAt(x.inicio), w0: it.porDia?.[x.d]?.[0] ?? it.desde, w1: it.porDia?.[x.d]?.[1] ?? it.hasta });
    }
    sesionesSemana += items.filter((it) => it.desde === 1).reduce((t, it) => t + it.sesiones, 0);
    const mainSala = Object.entries(salaCount).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    res.secciones.push({
      id: sec.id, carrera: g.carrera.codigo, carreraNombre: g.carrera.nombre, sem: g.sem, letra: sec.letra, jornada: g.jornada,
      // dias: los configurados para el semestre (preferencia); diasUso: los que de verdad usan sus clases.
      dias: g.days, diasUso: DAYS.filter((d) => items.some((it) => it.slots.some((x) => x.d === d))), estudiantes: sec.size, salaId: mainSala, semanas,
      fechaFin: items.reduce((m, it) => (it.fechaFin && it.fechaFin > m ? it.fechaFin : m), '') || null,
      pendientes: g.subjects.filter((s) => !placed.some(([c]) => c === s.codigo)).map((s) => s.codigo),
      plan: items.map((it) => {
        const s = g.subjects.find((x) => x.codigo === it.codigo);
        return { codigo: it.codigo, desde: it.desde, hasta: it.hasta, salaId: it.salaId, sesiones: it.sesiones, carril: 0,
          fechaInicio: it.fechaInicio, fechaFin: it.fechaFin, horasDadas: it.horasDadas, nSesiones: it.nSesiones,
          slots: it.slots.map(({ d, inicio, fin }) => ({ d, inicio, fin })),
          nombre: s.nombre, horas: s.horas, transversal: s.transversal, docenteId: state.asignaciones?.[it.codigo] || null };
      }).sort((a, b) => a.desde - b.desde)
    });
    { const sx = res.secciones.at(-1); sx.pasaCierre = !!(sx.fechaFin && cal.fin && sx.fechaFin > cal.fin); if (sx.pasaCierre) res.avisos.push({ tipo: 'cierre', secciones: [sx.id], mensaje: `${secLabel(sec)} termina el ${fmtFecha(sx.fechaFin)} ${sx.fechaFin.slice(0, 4)}, después del cierre del periodo (${fmtFecha(cal.fin)} ${cal.fin.slice(0, 4)}).` }); }
    res.resumen.asignadas += placed.length;
    res.resumen.total += g.subjects.length;
  }

  const name = (id) => docentesById[id]?.nombre || 'Sin docente';
  const subjName = (p) => p.sec.g.subjects.find((s) => s.codigo === p.codigo)?.nombre || p.codigo;
  const where = (p) => `${secLabel(p.sec)} ${subjName(p)}`;
  const clashKeys = new Map();
  const addClash = (tipo, a, b, msg) => {
    const k = [tipo, a.sec.id, a.codigo, b.sec.id, b.codigo].join('|');
    if (clashKeys.has(k)) { clashKeys.get(k).dias.add(DAY_NAMES[a.day]); return; }
    clashKeys.set(k, { tipo, a, b, msg, dias: new Set([DAY_NAMES[a.day]]) });
  };
  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      const a = pieces[i], b = pieces[j];
      if (!overlap(a, b)) continue;
      if (a.sec === b.sec) { a.choque = b.choque = true; addClash('seccion', a, b, `${secLabel(a.sec)} tendría dos clases a la vez`); continue; }
      if (a.salaId && a.salaId === b.salaId) { a.choque = b.choque = true; addClash('sala', a, b, `${salasById[a.salaId]?.nombre || 'La sala'} tendría dos clases a la vez`); }
      if (a.teacher && a.teacher === b.teacher) { a.choque = b.choque = true; addClash('docente', a, b, `${name(a.teacher)} tendría dos clases a la vez`); }
    }
  }
  for (const c of clashKeys.values()) {
    const w0 = Math.max(c.a.w0, c.b.w0), w1 = Math.min(c.a.w1, c.b.w1);
    res.conflictos.push({
      tipo: c.tipo, docenteId: c.tipo === 'docente' ? c.a.teacher : undefined, salaId: c.tipo === 'sala' ? c.a.salaId : undefined,
      secciones: [c.a.sec.id, c.b.sec.id], semanas: [w0, w1],
      mensaje: `${c.msg}: ${where(c.a)} y ${where(c.b)} (${[...c.dias].join(', ')} ${c.a.inicio}, semanas ${w0}–${w1}).`
    });
  }
  // Capacidad, disponibilidad y sábado en la tarde: una vez por asignatura de cada sección.
  const once = new Set();
  for (const p of pieces) {
    const sala = salasById[p.salaId];
    const k = `${p.sec.id}|${p.codigo}`;
    if (sala && sala.capacidad < p.sec.size && !once.has('cap' + k)) {
      once.add('cap' + k);
      res.conflictos.push({ tipo: 'capacidad', secciones: [p.sec.id], mensaje: `${where(p)}: ${p.sec.size} estudiantes y ${sala.nombre} tiene ${sala.capacidad} puestos.` });
    }
    if (!slotAllowed(p.day, p.inicio)) {
      p.choque = true;
      if (!once.has('sab' + k)) { once.add('sab' + k); res.conflictos.push({ tipo: 'sabado', secciones: [p.sec.id], mensaje: `${where(p)}: el sábado solo hay clases en la mañana.` }); }
    }
    const doc = docentesById[p.teacher];
    if (doc && Array.isArray(doc.disponibilidad) && !doc.disponibilidad.includes(`${p.day}-${p.turno}`)) {
      p.noDisp = true;
      if (!once.has('disp' + k)) {
        once.add('disp' + k);
        res.conflictos.push({ tipo: 'disponibilidad', docenteId: p.teacher, secciones: [p.sec.id], mensaje: `${name(p.teacher)} no está disponible para ${where(p)} (${DAY_NAMES[p.day]} ${p.inicio}).` });
      }
    }
  }
  // Tope semanal por docente.
  const byTeacher = {};
  for (const p of pieces) if (p.teacher) (byTeacher[p.teacher] = byTeacher[p.teacher] || []).push(p);
  for (const [t, list] of Object.entries(byTeacher)) {
    const doc = docentesById[t];
    const weeks = new Array(60).fill(0);
    for (const p of list) for (let w = p.w0; w <= p.w1 && w < 60; w++) weeks[w] += 1;
    const otra = doc?.otraCarga || 0;
    const tope = doc?.tope ?? state.reglas?.tope ?? 12;
    const over = weeks.map((v, w) => (w > 0 && v + otra > tope ? w : 0)).filter(Boolean);
    if (over.length) res.conflictos.push({ tipo: 'tope', docenteId: t, secciones: [], semanas: [over[0], over[over.length - 1]], mensaje: `${name(t)} llega a ${Math.max(...weeks) + otra} sesiones por semana (semanas ${over[0]}–${over[over.length - 1]}) y su tope es ${tope}.` });
    res.cargaDocentes[t] = { porSemana: weeks.slice(1, 31), pico: Math.max(...weeks), otra, tope };
  }
  for (const g of problem.groups) {
    for (const s of g.subjects.filter((x) => !g.teacherOf(x.codigo))) {
      res.conflictos.push({ tipo: 'sin-docente', secciones: problem.sections.filter((x) => x.g === g).map((x) => x.id), mensaje: `${g.carrera.codigo} ${roman(g.sem)}: «${s.nombre}» no tiene docente asignado.` });
    }
  }

  // Semanas del periodo según el calendario (inicio a cierre), o más si algún curso pasa del cierre.
  res.semanasMax = Math.max(res.semanasMax, cal.fin ? weekOf(cal, cal.fin) : 0);
  for (const p of pieces) {
    res.sesiones.push({ seccionId: p.sec.id, codigo: p.codigo, nombre: subjName(p), docenteId: p.teacher, salaId: p.salaId, dia: p.day, turno: p.turno, inicio: p.inicio, fin: p.fin, desde: p.w0, hasta: p.w1, choque: !!p.choque, noDisp: !!p.noDisp });
  }
  res.sesiones.sort((a, b) => DAYS.indexOf(a.dia) - DAYS.indexOf(b.dia) || a.inicio.localeCompare(b.inicio));
  const count = (...t) => res.conflictos.filter((c) => t.includes(c.tipo)).length;
  Object.assign(res.resumen, {
    secciones: problem.sections.length,
    sesionesSemana,
    choquesDocente: count('docente'), disponibilidad: count('disponibilidad'), tope: count('tope'),
    salas: count('sala', 'capacidad'), sinDocente: count('sin-docente')
  });
  return res;
}

// Convierte un horario generado automáticamente en clases editables (con sus días y horas exactos).
export function manualFromSolved(H) {
  const out = {};
  for (const sec of H?.secciones || []) {
    for (const it of sec.plan || []) {
      const ses = (H.sesiones || []).filter((x) => x.seccionId === sec.id && x.codigo === it.codigo && x.desde === it.desde);
      const slots = ses.map((x) => ({ d: x.dia, inicio: x.inicio, fin: x.fin }));
      (out[sec.id] = out[sec.id] || {})[it.codigo] = { slots, o: it.desde * 10 + (ses[0] ? toMinutes(ses[0].inicio) / 10000 : 0), salaId: ses[0]?.salaId || sec.salaId || null };
    }
  }
  return out;
}
