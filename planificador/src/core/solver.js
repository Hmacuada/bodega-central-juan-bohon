// Generador de horarios sin choques.
// Variables por sección: plan de módulos (compartido por las secciones de una misma carrera-semestre)
// y orientación por día (qué carril va en el bloque 1). Se busca con min-conflicts + ruido + reinicios.
import { activeSemesters, cohortDays, blocksFor, toMinutes, DAY_NAMES, DAYS, roman, DAYS_PER_LEVEL, saturdayIssue } from './calendar.js';
import { candidatePlans } from './modules.js';

export function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LETTERS = 'ABCDEFGH';

export function buildProblem(state) {
  const sems = activeSemesters(state.periodo.paridad);
  const groups = [];
  const sections = [];
  for (const c of state.carreras) {
    for (const sem of sems) {
      const of = state.oferta?.[c.codigo]?.[sem];
      const n = of?.secciones || 0;
      if (!n) continue;
      const semObj = c.semestres[sem - 1];
      const days = cohortDays(state.jornadas, c.jornada, sem);
      if (days.length !== DAYS_PER_LEVEL) {
        throw new Error(`El semestre ${roman(sem)} de la jornada ${c.jornada.toLowerCase()} tiene ${days.length} días de clase; deben ser ${DAYS_PER_LEVEL}. Corrígelo en Configuración.`);
      }
      const sat = saturdayIssue(state.jornadas, c.jornada, sem);
      if (sat) throw new Error(sat + ' Corrígelo en Configuración.');
      const blocks = days.map((d) => blocksFor(state.jornadas, c.jornada, d, sem).map((b) => ({ ...b, s: toMinutes(b.inicio), e: toMinutes(b.fin) })));
      const subjects = semObj.asignaturas;
      const g = {
        key: `${c.codigo}-${sem}`, carrera: c, sem, jornada: c.jornada, days, blocks, subjects,
        plans: candidatePlans(subjects),
        semanasImpresas: semObj.semanas_impresas,
        estudiantes: of.estudiantes || 0, secciones: n,
        teacherOf: (codigo) => state.asignaciones?.[codigo] || null
      };
      groups.push(g);
      for (let i = 0; i < n; i++) {
        sections.push({ id: `${g.key}-${LETTERS[i]}`, g, letra: LETTERS[i], idx: i, size: Math.ceil((g.estudiantes || 0) / n) });
      }
    }
  }
  return { groups, sections };
}

function piecesFor(sec, plan, orient) {
  const g = sec.g;
  const out = [];
  for (const item of plan.items) {
    const teacher = g.teacherOf(item.codigo);
    g.days.forEach((day, di) => {
      const blk = g.blocks[di][item.carril ^ orient[di]];
      out.push({ sec, codigo: item.codigo, teacher, day, s: blk.s, e: blk.e, inicio: blk.inicio, fin: blk.fin, turno: blk.turno, w0: item.desde, w1: item.hasta });
    });
  }
  return out;
}

export function evaluate(problem, assign, docentesById, reglas, detail = false) {
  const pieces = [];
  for (const sec of problem.sections) {
    const plan = sec.g.plans[assign.plan[sec.g.key]];
    pieces.push(...piecesFor(sec, plan, assign.orient[sec.id]));
  }
  const byTeacher = new Map();
  for (const p of pieces) {
    if (!p.teacher) continue;
    if (!byTeacher.has(p.teacher)) byTeacher.set(p.teacher, []);
    byTeacher.get(p.teacher).push(p);
  }
  let clash = 0, avail = 0, overload = 0;
  const involved = new Set();
  const clashes = [], availIssues = [], overloadIssues = [];
  const carga = {};
  for (const [t, list] of byTeacher) {
    const doc = docentesById[t];
    // Choques: misma persona, mismo día, horas que se cruzan, semanas que se cruzan.
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (a.day !== b.day || a.s >= b.e || b.s >= a.e) continue;
        const w0 = Math.max(a.w0, b.w0), w1 = Math.min(a.w1, b.w1);
        if (w0 > w1) continue;
        clash += w1 - w0 + 1;
        involved.add(a.sec.id); involved.add(b.sec.id);
        if (detail) clashes.push({ t, a, b, w0, w1 });
      }
      if (doc && Array.isArray(doc.disponibilidad) && !doc.disponibilidad.includes(`${a.day}-${a.turno}`)) {
        avail += a.w1 - a.w0 + 1;
        involved.add(a.sec.id);
        if (detail) availIssues.push({ t, a });
      }
    }
    // Tope semanal: sesiones de la semana + carga en otros cursos.
    const weeks = new Array(30).fill(0);
    for (const p of list) for (let w = p.w0; w <= p.w1; w++) weeks[w] += 1;
    const otra = doc?.otraCarga || 0;
    const tope = doc?.tope ?? reglas?.tope ?? 12;
    const over = [];
    weeks.forEach((v, w) => { if (w > 0 && v + otra > tope) { overload += v + otra - tope; over.push(w); } });
    if (over.length) { list.forEach((p) => { if (p.w0 <= over[over.length - 1] && p.w1 >= over[0]) involved.add(p.sec.id); }); if (detail) overloadIssues.push({ t, over, pico: Math.max(...weeks) + otra, tope }); }
    carga[t] = { porSemana: weeks.slice(1), pico: Math.max(...weeks), otra, tope };
  }
  // Preferencia suave: que cada asignatura quede en el mismo bloque los 3 días (más fácil de recordar para el curso).
  let mixed = 0;
  for (const sec of problem.sections) {
    const o = assign.orient[sec.id];
    if (o.some((v) => v !== o[0])) { mixed += 1; involved.add(sec.id); }
  }
  const hard = clash * 10 + avail * 5 + overload * 3;
  const cost = hard * 100 + mixed;
  return { cost, hard, mixed, clash, avail, overload, involved, pieces, clashes, availIssues, overloadIssues, carga };
}

function pick(arr, rnd) { return arr[Math.floor(rnd() * arr.length)]; }

const ORIENTS = [0, 1, 2, 3, 4, 5, 6, 7].map((m) => [m & 1, (m >> 1) & 1, (m >> 2) & 1]);

export function solve(state, opts = {}) {
  const { seed = 1, maxIter = 1500, restarts = 4, planSample = 24, timeLimitMs = 8000 } = opts;
  const problem = buildProblem(state);
  const docentesById = Object.fromEntries((state.docentes || []).map((d) => [d.id, d]));
  const rnd = makeRng(seed);
  const t0 = Date.now();
  let best = null;
  if (!problem.sections.length) return buildResult(state, problem, null, docentesById, { iteraciones: 0 });

  let iterTotal = 0;
  for (let r = 0; r < restarts; r++) {
    const assign = { plan: {}, orient: {} };
    for (const g of problem.groups) assign.plan[g.key] = r === 0 ? 0 : Math.floor(rnd() * g.plans.length);
    for (const sec of problem.sections) {
      const base = sec.idx % 2;
      assign.orient[sec.id] = r === 0 ? [base, base, base] : pick(ORIENTS, rnd).slice();
    }
    let cur = evaluate(problem, assign, docentesById, state.reglas);
    if (!best || cur.cost < best.ev.cost) best = { assign: clone(assign), ev: cur };
    let sinceBest = 0;
    for (let it = 0; it < maxIter && cur.cost > 0; it++, iterTotal++) {
      if (Date.now() - t0 > timeLimitMs) break;
      // Sin choques y sin mejoras recientes: lo que queda es solo preferencia, se acepta.
      if (best.ev.hard === 0 && sinceBest > 60) break;
      const inv = [...cur.involved];
      const targetId = inv.length ? pick(inv, rnd) : null;
      const sec = targetId ? problem.sections.find((s) => s.id === targetId) : pick(problem.sections, rnd);
      const options = [];
      if (rnd() < 0.55) {
        for (const o of ORIENTS) options.push(() => { assign.orient[sec.id] = o.slice(); });
      } else {
        const g = sec.g;
        const n = g.plans.length;
        const idxs = new Set();
        while (idxs.size < Math.min(planSample, n)) idxs.add(Math.floor(rnd() * n));
        for (const k of idxs) options.push(() => { assign.plan[g.key] = k; });
      }
      const snapshot = { plan: assign.plan[sec.g.key], orient: assign.orient[sec.id] };
      let bestOpt = null;
      const tried = [];
      for (const apply of options) {
        apply();
        const ev = evaluate(problem, assign, docentesById, state.reglas);
        tried.push({ apply, ev });
        if (!bestOpt || ev.cost < bestOpt.ev.cost || (ev.cost === bestOpt.ev.cost && rnd() < 0.5)) bestOpt = { apply, ev };
        assign.plan[sec.g.key] = snapshot.plan; assign.orient[sec.id] = snapshot.orient;
      }
      let chosen = bestOpt;
      if (bestOpt.ev.cost >= cur.cost && rnd() < 0.2) chosen = pick(tried, rnd); // ruido para salir de mínimos locales
      chosen.apply();
      cur = chosen.ev;
      if (cur.cost < best.ev.cost) { best = { assign: clone(assign), ev: cur }; sinceBest = 0; } else sinceBest++;
    }
    if (best.ev.hard === 0) break;
  }
  return buildResult(state, problem, best.assign, docentesById, { iteraciones: iterTotal, ms: Date.now() - t0 });
}

function clone(a) {
  return { plan: { ...a.plan }, orient: Object.fromEntries(Object.entries(a.orient).map(([k, v]) => [k, v.slice()])) };
}

// Salas: cada sección tiene una sala propia durante el semestre. Dos secciones que comparten algún bloque no pueden compartir sala.
export function assignRooms(problem, salas) {
  const slotKeys = (sec) => {
    const out = [];
    sec.g.days.forEach((d, di) => sec.g.blocks[di].forEach((b) => out.push({ d, s: b.s, e: b.e })));
    return out;
  };
  const overlaps = (a, b) => a.some((x) => b.some((y) => x.d === y.d && x.s < y.e && y.s < x.e));
  const slots = Object.fromEntries(problem.sections.map((s) => [s.id, slotKeys(s)]));
  const rooms = [...(salas || [])].filter((r) => r.tipo !== 'Laboratorio' || true).sort((a, b) => a.capacidad - b.capacidad);
  const used = {}; // salaId -> [secIds]
  const result = {};
  const issues = [];
  const order = [...problem.sections].sort((a, b) => b.size - a.size);
  for (const sec of order) {
    const free = rooms.filter((r) => !(used[r.id] || []).some((other) => overlaps(slots[other], slots[sec.id])));
    let room = free.find((r) => r.capacidad >= sec.size) || null;
    if (!room && free.length) {
      room = free[free.length - 1];
      issues.push({ tipo: 'capacidad', secId: sec.id, salaId: room.id, mensaje: `${secLabel(sec)}: ${sec.size} estudiantes y la sala más grande libre (${room.nombre}) tiene ${room.capacidad} puestos.` });
    }
    if (!room) {
      issues.push({ tipo: 'sala', secId: sec.id, mensaje: `${secLabel(sec)}: no queda ninguna sala libre en sus bloques.` });
    } else {
      (used[room.id] = used[room.id] || []).push(sec.id);
    }
    result[sec.id] = room ? room.id : null;
  }
  return { rooms: result, issues };
}

export function secLabel(sec) {
  return `${sec.g.carrera.codigo} ${roman(sec.sem ?? sec.g.sem)}-${sec.letra}`;
}

function buildResult(state, problem, assign, docentesById, meta) {
  const res = {
    generadoEn: new Date().toISOString(),
    periodo: { ...state.periodo },
    meta,
    secciones: [], sesiones: [], conflictos: [], avisos: [], cargaDocentes: {}, semanasMax: 0,
    resumen: { secciones: 0, sesionesSemana: 0, choquesDocente: 0, sinDocente: 0, salas: 0, disponibilidad: 0, tope: 0 }
  };
  if (!assign) return res;
  const ev = evaluate(problem, assign, docentesById, state.reglas, true);
  const roomsRes = assignRooms(problem, state.salas);
  const name = (id) => docentesById[id]?.nombre || 'Sin docente';
  const subjName = (g, codigo) => g.subjects.find((s) => s.codigo === codigo)?.nombre || codigo;

  for (const sec of problem.sections) {
    const g = sec.g;
    const plan = g.plans[assign.plan[g.key]];
    res.semanasMax = Math.max(res.semanasMax, plan.semanas);
    res.secciones.push({
      id: sec.id, carrera: g.carrera.codigo, carreraNombre: g.carrera.nombre, sem: g.sem, letra: sec.letra, jornada: g.jornada,
      dias: g.days, estudiantes: sec.size, salaId: roomsRes.rooms[sec.id], semanas: plan.semanas,
      plan: plan.items.map((it) => {
        const s = g.subjects.find((x) => x.codigo === it.codigo);
        return { ...it, nombre: s.nombre, horas: s.horas, transversal: s.transversal, docenteId: g.teacherOf(it.codigo) };
      }).sort((a, b) => a.desde - b.desde || a.carril - b.carril)
    });
  }
  for (const p of ev.pieces) {
    res.sesiones.push({ seccionId: p.sec.id, codigo: p.codigo, nombre: subjName(p.sec.g, p.codigo), docenteId: p.teacher, salaId: roomsRes.rooms[p.sec.id], dia: p.day, turno: p.turno, inicio: p.inicio, fin: p.fin, desde: p.w0, hasta: p.w1 });
  }
  res.sesiones.sort((a, b) => DAYS.indexOf(a.dia) - DAYS.indexOf(b.dia) || a.inicio.localeCompare(b.inicio));

  // Conflictos legibles (agrupados).
  const seen = new Map();
  for (const c of ev.clashes) {
    const k = [c.t, c.a.sec.id, c.a.codigo, c.b.sec.id, c.b.codigo].join('|');
    const prev = seen.get(k);
    if (prev) { prev.w0 = Math.min(prev.w0, c.w0); prev.w1 = Math.max(prev.w1, c.w1); prev.dias.add(c.a.day); continue; }
    seen.set(k, { ...c, dias: new Set([c.a.day]) });
  }
  for (const c of seen.values()) {
    res.conflictos.push({
      tipo: 'docente', docenteId: c.t, secciones: [c.a.sec.id, c.b.sec.id], semanas: [c.w0, c.w1],
      mensaje: `${name(c.t)} tendría dos clases a la vez: ${secLabel(c.a.sec)} ${subjName(c.a.sec.g, c.a.codigo)} y ${secLabel(c.b.sec)} ${subjName(c.b.sec.g, c.b.codigo)} (${[...c.dias].map((d) => DAY_NAMES[d]).join(', ')} ${c.a.inicio}, semanas ${c.w0}–${c.w1}).`
    });
  }
  const av = new Map();
  for (const x of ev.availIssues) {
    const k = [x.t, x.a.sec.id, x.a.codigo].join('|');
    if (!av.has(k)) av.set(k, { ...x, dias: new Set() });
    av.get(k).dias.add(`${DAY_NAMES[x.a.day]} ${x.a.inicio}`);
  }
  for (const x of av.values()) {
    res.conflictos.push({ tipo: 'disponibilidad', docenteId: x.t, secciones: [x.a.sec.id], mensaje: `${name(x.t)} no está disponible para ${secLabel(x.a.sec)} ${subjName(x.a.sec.g, x.a.codigo)}: ${[...x.dias].join(', ')}.` });
  }
  for (const x of ev.overloadIssues) {
    res.conflictos.push({ tipo: 'tope', docenteId: x.t, secciones: [], semanas: [x.over[0], x.over[x.over.length - 1]], mensaje: `${name(x.t)} llega a ${x.pico} sesiones por semana (semanas ${x.over[0]}–${x.over[x.over.length - 1]}) y su tope es ${x.tope}.` });
  }
  for (const i of roomsRes.issues) res.conflictos.push({ tipo: i.tipo, secciones: [i.secId], mensaje: i.mensaje });
  for (const g of problem.groups) {
    const missing = g.subjects.filter((s) => !g.teacherOf(s.codigo));
    for (const s of missing) res.conflictos.push({ tipo: 'sin-docente', secciones: problem.sections.filter((x) => x.g === g).map((x) => x.id), mensaje: `${g.carrera.codigo} ${roman(g.sem)}: «${s.nombre}» no tiene docente asignado.` });
    const plan = g.plans[assign.plan[g.key]];
    if (g.semanasImpresas && plan.semanas > g.semanasImpresas) {
      res.avisos.push(`${g.carrera.nombre}, semestre ${roman(g.sem)}: con módulos de 3 sesiones por semana el plan ocupa ${plan.semanas} semanas; la malla indica ${g.semanasImpresas}.`);
    }
  }
  res.cargaDocentes = ev.carga;
  res.resumen = {
    secciones: problem.sections.length,
    sesionesSemana: problem.sections.length * 6,
    choquesDocente: res.conflictos.filter((c) => c.tipo === 'docente').length,
    disponibilidad: res.conflictos.filter((c) => c.tipo === 'disponibilidad').length,
    tope: res.conflictos.filter((c) => c.tipo === 'tope').length,
    salas: res.conflictos.filter((c) => c.tipo === 'sala' || c.tipo === 'capacidad').length,
    sinDocente: res.conflictos.filter((c) => c.tipo === 'sin-docente').length
  };
  return res;
}
