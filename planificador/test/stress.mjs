// Prueba de carga: las 15 carreras con secciones, docentes sintéticos. Uso: node test/stress.mjs
import { readFileSync } from 'node:fs';
import { buildInitialState, ALL_SLOTS } from '../src/core/initial.js';
import { solve } from '../src/core/solver.js';
import { suggestAssignments } from '../src/core/assign.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed/carreras_mallas.json', import.meta.url)));
const s = buildInitialState(seed, null, { withDemo: false });
for (const c of s.carreras) s.oferta[c.codigo] = { 1: { estudiantes: 60, secciones: 2 }, 3: { estudiantes: 30, secciones: 1 } };
const used = s.carreras.flatMap((c) => [0, 2].flatMap((i) => c.semestres[i].asignaturas.map((a) => a.nombre)));
const names = [...new Set(used)];
let k = 0;
for (const n of names) {
  const reps = used.filter((x) => x === n).length;
  for (let j = 0; j < Math.max(1, Math.ceil(reps / 2)); j++) s.docentes.push({ id: 'x' + k++, nombre: `${n.slice(0, 14)} ${j + 1}`, materias: [n], disponibilidad: ALL_SLOTS, tope: 12, otraCarga: 0 });
}
for (let i = 0; i < 40; i++) s.salas.push({ id: 'r' + i, nombre: 'R' + i, capacidad: 35, tipo: 'Sala' });
s.asignaciones = suggestAssignments(s).asignaciones;
const t = Date.now();
const r = solve(s, { seed: 3 });
console.log('docentes', s.docentes.length, 'secciones', r.resumen.secciones, JSON.stringify(r.resumen), 'iteraciones', r.meta.iteraciones, `${Date.now() - t} ms`);
console.log(r.conflictos.slice(0, 5).map((c) => c.mensaje).join('\n'));
