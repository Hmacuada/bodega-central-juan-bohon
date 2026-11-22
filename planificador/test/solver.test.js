import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { candidatePlans, moduleWeeks } from '../src/core/modules.js';
import { buildInitialState } from '../src/core/initial.js';
import { solve } from '../src/core/solver.js';
import { suggestAssignments } from '../src/core/assign.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed/carreras_mallas.json', import.meta.url)));
const demo = JSON.parse(readFileSync(new URL('../data/seed/demo.json', import.meta.url)));

test('las mallas traen 15 carreras y 359 asignaturas', () => {
  assert.equal(seed.carreras.length, 15);
  assert.equal(seed.carreras.reduce((t, c) => t + c.semestres.reduce((u, s) => u + s.asignaturas.length, 0), 0), 359);
});

test('TLI III se reparte en dos carriles de 22 semanas', () => {
  const tli = seed.carreras.find((c) => c.codigo === 'TLI');
  const plans = candidatePlans(tli.semestres[2].asignaturas);
  assert.ok(plans.length > 0);
  assert.equal(plans[0].semanas, 22);
  assert.equal(moduleWeeks(90), 10);
});

test('el horario de ejemplo sale sin choques de docentes ni salas', () => {
  const state = buildInitialState(seed, demo);
  const res = solve(state, { seed: 7 });
  assert.equal(res.resumen.secciones, 8);
  assert.equal(res.resumen.sinDocente, 0, res.conflictos.map((c) => c.mensaje).join('\n'));
  assert.equal(res.resumen.choquesDocente, 0, res.conflictos.map((c) => c.mensaje).join('\n'));
  assert.equal(res.resumen.salas, 0, res.conflictos.map((c) => c.mensaje).join('\n'));
  assert.equal(res.resumen.disponibilidad, 0, res.conflictos.map((c) => c.mensaje).join('\n'));
  // Cada sección tiene 6 sesiones semanales por semana de clases: 3 días × 2 bloques.
  for (const s of res.secciones) {
    const ses = res.sesiones.filter((x) => x.seccionId === s.id && x.desde <= 1 && x.hasta >= 1);
    assert.equal(ses.length, 6, s.id);
  }
});

test('2º año vespertino va lunes, miércoles y viernes', () => {
  const state = buildInitialState(seed, demo);
  const res = solve(state, { seed: 3 });
  const dias = new Set(res.sesiones.filter((x) => x.seccionId.startsWith('TLI-3')).map((x) => x.dia));
  assert.deepEqual([...dias].sort(), ['Lu', 'Mi', 'Vi']);
});

test('detecta choques imposibles: un solo docente para 3 secciones', () => {
  const state = buildInitialState(seed, demo);
  state.oferta = { TLI: { 3: { estudiantes: 90, secciones: 3 } } };
  state.docentes = [{ id: 'x', nombre: 'Único', materias: seed.carreras[0].semestres[2].asignaturas.map((a) => a.nombre), disponibilidad: null, tope: 40 }];
  state.salas = [{ id: 'a', nombre: 'A', capacidad: 40 }, { id: 'b', nombre: 'B', capacidad: 40 }, { id: 'c', nombre: 'C', capacidad: 40 }];
  state.asignaciones = suggestAssignments(state, { overwrite: true }).asignaciones;
  const res = solve(state, { seed: 1, maxIter: 200, restarts: 1 });
  assert.ok(res.resumen.choquesDocente > 0);
});
