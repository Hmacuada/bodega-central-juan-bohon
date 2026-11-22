// Plan de módulos de un semestre.
// Las asignaturas se dictan en módulos de 3 sesiones semanales, uno tras otro, en dos "carriles" paralelos
// (bloque 1 y bloque 2 de los 3 días del nivel). Así una sección tiene 6 sesiones por semana = 18 h.
import { SESSION_HOURS, SESSIONS_PER_MODULE_WEEK } from './calendar.js';

export function moduleWeeks(hours) {
  return Math.ceil(hours / SESSION_HOURS / SESSIONS_PER_MODULE_WEEK);
}

function permutations(arr) {
  if (arr.length <= 1) return [arr.slice()];
  const out = [];
  arr.forEach((x, i) => {
    for (const p of permutations([...arr.slice(0, i), ...arr.slice(i + 1)])) out.push([x, ...p]);
  });
  return out;
}

// Devuelve planes candidatos: reparto de asignaturas en 2 carriles lo más parejo posible y todos los órdenes.
// Cada plan: { semanas, items: [{ codigo, carril, desde, hasta }] }
export function candidatePlans(subjects, maxPlans = 400) {
  const n = subjects.length;
  const w = subjects.map((s) => moduleWeeks(s.horas));
  const total = w.reduce((a, b) => a + b, 0);
  let best = Infinity;
  const parts = [];
  // El bit 0 siempre en el carril 0 para no repetir particiones espejo.
  for (let mask = 1; mask < (1 << n); mask += 2) {
    if (mask === (1 << n) - 1 && n > 1) continue;
    let a = 0;
    for (let i = 0; i < n; i++) if (mask & (1 << i)) a += w[i];
    const diff = Math.abs(total - 2 * a);
    if (diff < best) { best = diff; parts.length = 0; }
    if (diff === best) parts.push(mask);
  }
  const plans = [];
  for (const mask of parts) {
    const t0 = [], t1 = [];
    for (let i = 0; i < n; i++) (mask & (1 << i) ? t0 : t1).push(i);
    for (const p0 of permutations(t0)) {
      for (const p1 of permutations(t1)) {
        const items = [];
        let semanas = 0;
        [p0, p1].forEach((track, carril) => {
          let wk = 1;
          for (const i of track) {
            items.push({ codigo: subjects[i].codigo, carril, desde: wk, hasta: wk + w[i] - 1 });
            wk += w[i];
          }
          semanas = Math.max(semanas, wk - 1);
        });
        plans.push({ semanas, items });
        if (plans.length >= maxPlans) return plans;
      }
    }
  }
  return plans;
}
