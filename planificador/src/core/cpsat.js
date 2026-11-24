// Puente entre la app y el solver CP-SAT (solver/horario_cpsat.py).
// buildSolverInput: convierte el estado en la entrada del solver para una jornada.
// fromSolverResult: convierte la salida en propuestas con el formato de la sugerencia.
import { buildProblem } from './solver.js';
import { schedule, turnoAt, slotAllowed } from './manual.js';
import { cohortDays, blocksFor, DAYS_PER_LEVEL, toMinutes } from './calendar.js';
import { calendarOf, semanasHastaCierre } from './fechas.js';
export { semanasHastaCierre };


// Asignaturas que se dictan online: no ocupan sala. Lista editable (empieza con las 4 transversales).
export const ONLINE = ['Tecnologías de la Información', 'Comunicación Efectiva', 'Taller de Habilidades Sociales', 'Innovación y Creatividad'];

// Una asignatura dura 3 sesiones por semana en su pista: ceil(horas / 9) semanas.
// Las dos pistas deben sumar la malla; como las duraciones son pares, a veces el semestre necesita una semana más
// que la indicada. Esa tolerancia es un supuesto explícito, configurable aquí.
export const TOLERANCIA_SEMANAS = 2;
// Semestres cuya malla no indica semanas (APM, AED, EER, MME): se usa este tope. Supuesto explícito, editable
// (24 es lo que dura un semestre con semanas impresas, más la tolerancia).
export const SEMANAS_SIN_MALLA = 24;
export const weeksOf = (horas) => Math.max(1, Math.ceil((horas || 0) / 9));

// Días que puede elegir el solver cuando la jornada aún no tiene días confirmados.
const DIAS_LIBRES = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi'];
// Con `diasLibres`, cada sección elige sus 3 días de lunes a sábado; el sábado solo si hace falta.
const DIAS_SEMANA = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];

// Bloques del sábado de una jornada: los del semestre, o los de otro semestre de la misma jornada que los tenga
// (el sábado solo hay mañana; la noche de lunes a viernes no sirve el sábado).
function bloquesSabado(jornadas, jornada, sem) {
  const propios = jornadas?.[jornada]?.sems?.[sem]?.bloques?.Sa;
  if (propios) return propios;
  for (const x of Object.values(jornadas?.[jornada]?.sems || {})) if (x.bloques?.Sa) return x.bloques.Sa;
  return blocksFor(jornadas, jornada, 'Sa', sem);
}

// Entrada del solver para las secciones de una jornada.
// `fijadas`: clases ya decididas (fase anterior o asignadas a mano) que no se mueven.
export function buildSolverInput(state, { jornada, fijadas: extra = [], tiempoSeg = 45, poolSalas = null, capacidadPool = 30, diasLibres = false, salaPorCarrera = false, carrera = null, margen = 1 } = {}) {
  const problem = buildProblem(state);
  const docentes = Object.fromEntries((state.docentes || []).map((d) => [d.id, d]));
  const jn = state.jornadas?.[jornada];
  const secciones = [], fijadas = [...extra], sinLugar = [];
  const cierre = semanasHastaCierre(calendarOf(state));

  for (const sec of problem.sections) {
    if (jornada && sec.g.jornada !== jornada) continue;
    const g = sec.g;
    const manual = Object.entries(state.manual?.[sec.id] || {})
      .filter(([c, p]) => Array.isArray(p.slots) && g.subjects.some((s) => s.codigo === c));
    const pendientes = g.subjects.filter((s) => !manual.some(([c]) => c === s.codigo) && !extra.some((f) => f.secId === sec.id && f.codigo === s.codigo));

    // Clases ya asignadas a mano: se respetan tal como están.
    const fijadasSec = [];
    if (manual.length) {
      // Semanas reales (con feriados y recesos), como se ven en la app; el margen cubre el desfase entre las
      // semanas del solver y las fechas reales de las clases nuevas.
      const plan = schedule(g.subjects, manual.map(([c, p]) => [c, { slots: p.slots, o: p.o || 0, salaId: p.salaId || null, desde: p.desde }]), calendarOf(state));
      for (const it of plan) fijadasSec.push({ secId: sec.id, codigo: it.codigo, slots: it.slots, salaId: it.salaId, desde: it.desde, hasta: it.hasta, margen, docente: state.asignaciones?.[it.codigo] || null });
    }
    fijadas.push(...fijadasSec);
    // Planificar una sola carrera: las demás solo aportan lo que ya tienen asignado (queda fijo).
    if (carrera && g.carrera.codigo !== carrera) continue;

    // Días: confirmados (fijos) o libres para el solver (solo diurnas sin confirmar).
    // Las carreras marcadas en Configuración (reglas.diasFijos) conservan los días de su jornada.
    const elige = diasLibres && !(state.reglas?.diasFijos || []).includes(g.carrera.codigo);
    const libre = elige || (jn && !jn.confirmado && jornada === 'Diurno');
    const candidatos = elige ? DIAS_SEMANA : libre ? DIAS_LIBRES : (g.days || []);
    const fijos = libre ? null : g.days;

    // poolSalas: estimación con N salas virtuales de capacidad fija (para saber cuántas se necesitan).
    const listaSalas = poolSalas ? Array.from({ length: poolSalas }, (_, i) => ({ id: 'V' + (i + 1), capacidad: capacidadPool })) : (state.salas || []);
    let salas = listaSalas.filter((r) => r.capacidad >= sec.size).map((r) => r.id);
    // Sala elegida para la sección en el asistente (state.salaSeccion): se usa solo esa.
    const elegida = !poolSalas && state.salaSeccion?.[sec.id];
    if (elegida && salas.includes(elegida)) salas = [elegida];
    if (!salas.length) {
      for (const s of pendientes) sinLugar.push({ secId: sec.id, codigo: s.codigo, motivo: `ninguna sala tiene ${sec.size} puestos` });
      continue;
    }
    const asignaturas = pendientes.map((s) => {
      const docente = state.asignaciones?.[s.codigo] || null;
      const doc = docentes[docente];
      const pistas = [0, 1].map((bi) => ({
        slots: candidatos.map((d) => {
          const b = libre
            ? (d === 'Sa' ? bloquesSabado(state.jornadas, g.jornada, g.sem) : blocksFor(state.jornadas, g.jornada, d, g.sem))[bi]
            : g.blocks[g.days.indexOf(d)]?.[bi];
          if (!b) return null;
          const ok = slotAllowed(d, b.inicio)
            && (!doc || !Array.isArray(doc.disponibilidad) || doc.disponibilidad.includes(`${d}-${turnoAt(b.inicio)}`));
          return { d, inicio: b.inicio, fin: b.fin, ok };
        }).filter(Boolean),
      }));
      // Con sábado la pista da 10 horas por semana (3 + 3 + 4) en vez de 9: la asignatura termina antes.
      return { codigo: s.codigo, nombre: s.nombre, horas: s.horas || 0, dur: weeksOf(s.horas), durSa: Math.max(1, Math.ceil((s.horas || 0) / 10)), docente, online: ONLINE.includes(s.nombre), pistas };
    });
    secciones.push({
      id: sec.id, carrera: g.carrera.codigo, limite: g.semanasImpresas ? g.semanasImpresas + TOLERANCIA_SEMANAS : SEMANAS_SIN_MALLA, salas,
      salaElegida: elegida && salas.length === 1 ? elegida : null, cierre,
      diasCandidatos: candidatos, diasFijos: fijos, nDias: DAYS_PER_LEVEL, asignaturas, elige, jornada: g.jornada, diasPreferidos: g.days || [],
    });
  }
  // Cada sección puede tener su propia sala. Si los dos cursos de una carrera comparten sala (se eligió la misma,
  // o salaPorCarrera), van en días complementarios de lunes a sábado (3 y 3) para no cruzarse en ella.
  const porCarrera = {};
  for (const x of secciones) (porCarrera[x.carrera] ||= []).push(x);
  for (const grupo of Object.values(porCarrera)) {
    const misma = grupo.length === 2 && grupo[0].salaElegida && grupo[0].salaElegida === grupo[1].salaElegida;
    const comparte = salaPorCarrera || misma;
    const par = comparte && grupo.length === 2 && grupo.every((x) => x.elige);
    // En la pareja, el curso con más horas prefiere el sábado (vale 4 horas): termina antes.
    const horasDe = (x) => x.asignaturas.reduce((t, a) => t + (a.horas || 0), 0);
    const pesado = par ? [...grupo].sort((p, q) => horasDe(q) - horasDe(p))[0] : null;
    for (const x of grupo) {
      if (comparte) x.grupoSala = x.carrera;
      x.complementario = par;
      // Un curso sin pareja elige días de lunes a viernes; el sábado solo si hace falta.
      x.evitarSabado = x.elige && !x.complementario;
      x.prefiereSabado = !!pesado && x === pesado;
    }
  }
  asignarClaves(secciones, fijadas);
  return { input: { tiempoSeg, secciones, fijadas, minimizarSalas: !!poolSalas }, sinLugar };
}

// Clave de recurso por franja horaria. Dos bloques que se cruzan en el mismo día (p. ej. 12:00 y 12:10)
// comparten clave, así no se pueden usar la misma sala ni el mismo docente a la vez.
function asignarClaves(secciones, fijadas) {
  const ventanas = {}; // día -> [{s,e}]
  const todos = [];
  for (const sec of secciones) for (const a of sec.asignaturas) for (const p of a.pistas) for (const sl of p.slots) todos.push(sl);
  for (const f of fijadas) for (const sl of f.slots) todos.push(sl);
  for (const sl of todos) (ventanas[sl.d] ||= []).push({ s: toMinutes(sl.inicio), e: toMinutes(sl.fin) });
  // Agrupa por solapamiento (conservador: si hay cruce, misma clave).
  const grupo = {}; // día -> lista de {s,e,id}
  for (const d of Object.keys(ventanas)) {
    const ord = ventanas[d].sort((x, y) => x.s - y.s);
    let id = 0, fin = -1;
    for (const v of ord) { if (v.s >= fin) id++; fin = Math.max(fin, v.e); v.id = id; }
    grupo[d] = ord;
  }
  const claveDe = (sl) => {
    const s = toMinutes(sl.inicio), e = toMinutes(sl.fin);
    const v = (grupo[sl.d] || []).find((x) => x.s === s && x.e === e);
    return sl.d + "@" + (v ? v.id : sl.inicio);
  };
  for (const sec of secciones) for (const a of sec.asignaturas) for (const p of a.pistas) for (const sl of p.slots) sl.clave = claveDe(sl);
  for (const f of fijadas) for (const sl of f.slots) sl.clave = claveDe(sl);
}

// Salida del solver -> propuestas (mismo formato que la sugerencia voraz).
export function fromSolverResult(result, built) {
  const items = [], unplaced = [...built.sinLugar];
  const bySec = Object.fromEntries(built.input.secciones.map((s) => [s.id, s]));
  for (const a of result.asignaturas) {
    const sec = bySec[a.seccion];
    if (a.colocada) {
      const cod = sec.asignaturas.find((x) => x.codigo === a.codigo);
      const dias = result.dias?.[a.seccion] || sec.diasCandidatos;
      const slots = cod.pistas[a.pista].slots.filter((x) => dias.includes(x.d)).map(({ d, inicio, fin }) => ({ d, inicio, fin }));
      const salaId = cod.online ? null : (result.salas[a.seccion] || null);
      items.push({ secId: a.seccion, codigo: a.codigo, slots, salaId, o: a.desde, desde: a.desde, hasta: a.desde + a.dur - 1 });
    } else {
      unplaced.push({ secId: a.seccion, codigo: a.codigo, motivo: 'no hay sala libre en sus bloques durante todas las semanas del semestre' });
    }
  }
  return { items, unplaced, estado: result.estado, dias: result.dias || {} };
}
