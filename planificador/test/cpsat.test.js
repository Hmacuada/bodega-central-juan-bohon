// Solver CP-SAT: todas las asignaturas colocadas, sin choques, y cada sección dentro de su malla.
// Se omite si Python con OR-Tools no está disponible.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildInitialState } from '../src/core/initial.js';
import { buildManual } from '../src/core/manual.js';
import { buildSolverInput, fromSolverResult } from '../src/core/cpsat.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed/carreras_mallas.json', import.meta.url)));
const demo = JSON.parse(readFileSync(new URL('./fixtures/demo-15-docentes.json', import.meta.url)));
const PY = process.env.PYTHON || 'C:/Users/Dell/AppData/Local/Programs/Python/Python311/python.exe';
const SOLVER = fileURLToPath(new URL('../solver/horario_cpsat.py', import.meta.url));
const disponible = existsSync(PY);

test('CP-SAT coloca todo sin choques y dentro de la malla', { skip: !disponible && 'sin Python con OR-Tools' }, () => {
  const state = buildInitialState(seed, demo);
  state.oferta.TLI = { 1: { estudiantes: 20, secciones: 1 }, 2: { estudiantes: 20, secciones: 1 } };
  const built = buildSolverInput(state, { tiempoSeg: 20 });
  const r = spawnSync(PY, [SOLVER], { input: JSON.stringify(built.input), encoding: 'utf8', maxBuffer: 50e6 });
  assert.equal(r.status, 0, r.stderr);
  const out = fromSolverResult(JSON.parse(r.stdout), built);
  assert.equal(out.unplaced.length, 0, out.unplaced.map((u) => u.motivo).join('\n'));
  const manual = {};
  for (const it of out.items) (manual[it.secId] ||= {})[it.codigo] = { slots: it.slots, o: it.o, salaId: it.salaId, desde: it.desde };
  state.manual = manual;
  const H = buildManual(state);
  const choques = H.conflictos.filter((c) => ['seccion', 'sala', 'docente', 'sabado'].includes(c.tipo));
  assert.equal(choques.length, 0, choques.map((c) => c.mensaje).join('\n'));
  // Cada sección cierra dentro de las semanas de su malla (si la malla las indica).
  const limite = { TLI: 22 };
  for (const s of H.secciones) if (limite[s.carrera]) assert.ok(s.semanas <= limite[s.carrera], `${s.id} dura ${s.semanas} semanas`);
});
