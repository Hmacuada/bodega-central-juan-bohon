import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { candidatePlans, moduleWeeks } from '../src/core/modules.js';
import { buildInitialState, ALL_SLOTS, migrateState } from '../src/core/initial.js';
import { DEFAULT_JORNADAS } from '../src/core/calendar.js';
import { solve } from '../src/core/solver.js';
import { suggestAssignments } from '../src/core/assign.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed/carreras_mallas.json', import.meta.url)));
const demo = JSON.parse(readFileSync(new URL('./fixtures/demo-15-docentes.json', import.meta.url)));

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

test('cada periodo dicta solo 2 semestres: impar I y III, par II y IV', () => {
  const state = buildInitialState(seed, demo);
  for (const n of [1, 2, 3, 4]) state.oferta.TLI[n] = { estudiantes: 20, secciones: 1 };
  state.periodo = { anio: 2027, paridad: 'impar', nombre: 'Otoño 2027' };
  let ids = solve(state, { seed: 5 }).secciones.map((s) => s.id).filter((x) => x.startsWith('TLI'));
  assert.deepEqual(ids.sort(), ['TLI-1-A', 'TLI-3-A']);
  state.periodo = { anio: 2027, paridad: 'par', nombre: 'Primavera 2027' };
  const res = solve(state, { seed: 5 });
  ids = res.secciones.map((s) => s.id).filter((x) => x.startsWith('TLI'));
  assert.deepEqual(ids.sort(), ['TLI-2-A', 'TLI-4-A']);
  const dias2 = new Set(res.sesiones.filter((x) => x.seccionId === 'TLI-2-A').map((x) => x.dia));
  assert.deepEqual([...dias2].sort(), ['Ju', 'Ma', 'Sa']);
});

test('la práctica (V semestre) es configurable y no ocupa bloques', () => {
  const state = buildInitialState(seed, demo);
  assert.equal(state.carreras.find((c) => c.codigo === 'TLI').practica.horas, 400);
  state.oferta.TLI.practica = { estudiantes: 12, supervisorId: 'd1' };
  const res = solve(state, { seed: 7 });
  assert.ok(!res.sesiones.some((x) => x.seccionId.startsWith('TLI-5')));
});

test('días mal configurados se informan con un mensaje claro', () => {
  const state = buildInitialState(seed, demo);
  state.jornadas.Vespertino.sems[1].dias = ['Ma', 'Ju'];
  assert.throws(() => solve(state, { seed: 1 }), /deben ser 3/);
});

test('el sábado solo admite bloques de mañana', () => {
  const state = buildInitialState(seed, demo);
  state.jornadas.Vespertino.sems[1].bloques.Sa[1].inicio = '15:00';
  assert.throws(() => solve(state, { seed: 1 }), /solo hay clases en la mañana/);
  delete state.jornadas.Vespertino.sems[1].bloques.Sa; // usaría los bloques de la noche
  assert.throws(() => solve(state, { seed: 1 }), /solo hay clases en la mañana/);
});

test('la disponibilidad no tiene sábado en la noche', () => {
  assert.ok(ALL_SLOTS.includes('Sa-M1'));
  assert.ok(!ALL_SLOTS.some((s) => s.startsWith('Sa-N')));
});

test('cada semestre tiene sus propios días y bloques', () => {
  const state = buildInitialState(seed, demo);
  state.oferta.TLI = { 1: { estudiantes: 30, secciones: 1 }, 3: { estudiantes: 30, secciones: 1 } };
  const s3 = state.jornadas.Vespertino.sems[3];
  s3.dias = ['Lu', 'Mi', 'Vi'];
  s3.bloques = { default: [{ id: 'B1', turno: 'N1', inicio: '19:00', fin: '21:00' }, { id: 'B2', turno: 'N2', inicio: '21:10', fin: '23:00' }] };
  const res = solve(state, { seed: 3 });
  const of = (id) => res.sesiones.filter((x) => x.seccionId.startsWith(id));
  assert.deepEqual([...new Set(of('TLI-1').map((x) => x.dia))].sort(), ['Ju', 'Ma', 'Sa']);
  assert.deepEqual([...new Set(of('TLI-3').map((x) => x.dia))].sort(), ['Lu', 'Mi', 'Vi']);
  assert.ok(of('TLI-3').every((x) => ['19:00', '21:10'].includes(x.inicio)));
});

test('un estado guardado con días por año se convierte a días por semestre', () => {
  const state = buildInitialState(seed, demo);
  state.jornadas.Vespertino = { confirmado: true, dias: { 1: ['Ma', 'Ju', 'Sa'], 2: ['Lu', 'Mi', 'Vi'] }, bloques: structuredClone(DEFAULT_JORNADAS.Vespertino.sems[1].bloques) };
  migrateState(state);
  assert.deepEqual(state.jornadas.Vespertino.sems[2].dias, ['Ma', 'Ju', 'Sa']);
  assert.deepEqual(state.jornadas.Vespertino.sems[3].dias, ['Lu', 'Mi', 'Vi']);
  assert.ok(!state.jornadas.Vespertino.dias);
});
