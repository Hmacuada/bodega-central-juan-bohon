// Planificación a mano: secuencia de semanas, choques de sala y docente, y conversión desde el generador automático.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildInitialState } from '../src/core/initial.js';
import { buildManual, manualFromSolved } from '../src/core/manual.js';
import { solve } from '../src/core/solver.js';
import { moduleWeeks } from '../src/core/modules.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed/carreras_mallas.json', import.meta.url)));
const demo = JSON.parse(readFileSync(new URL('./fixtures/demo-15-docentes.json', import.meta.url)));

test('sin clases asignadas, el horario tiene las secciones y ninguna sesión', () => {
  const state = buildInitialState(seed, demo);
  const H = buildManual(state);
  assert.ok(H.secciones.length > 0);
  assert.equal(H.sesiones.length, 0);
  assert.equal(H.resumen.asignadas, 0);
  assert.ok(H.secciones.every((s) => s.pendientes.length > 0));
});

test('las asignaturas de un mismo bloque se dictan una tras otra', () => {
  const state = buildInitialState(seed, demo);
  const sec = buildManual(state).secciones[0];
  const [a, b] = sec.pendientes;
  state.manual[sec.id] = { [a]: { b: 0, o: 1, salaId: 's1' }, [b]: { b: 0, o: 2, salaId: 's1' } };
  const H = buildManual(state);
  const plan = H.secciones.find((x) => x.id === sec.id).plan;
  // Fechas reales: la segunda empieza el día siguiente a la última sesión de la primera (sin cruzarse).
  const [pa, pb] = plan;
  assert.deepEqual(plan.map((x) => x.codigo), [a, b]);
  assert.equal(pa.desde, 1);
  assert.ok(pb.fechaInicio > pa.fechaFin);
  assert.ok(pa.horasDadas >= pa.horas && pb.horasDadas >= pb.horas);
  // 3 días × 2 asignaturas = 6 sesiones en el bloque 1, todas en Sala 1
  assert.equal(H.sesiones.length, 6);
  assert.ok(H.sesiones.every((x) => x.salaId === 's1'));
  assert.equal(H.resumen.asignadas, 2);
});

test('detecta dos clases en la misma sala a la misma hora', () => {
  const state = buildInitialState(seed, demo);
  const [s1, s2] = buildManual(state).secciones; // TLI I-A y TLI I-B: mismos días y bloques
  state.manual[s1.id] = { [s1.pendientes[0]]: { b: 0, o: 1, salaId: 's1' } };
  state.manual[s2.id] = { [s2.pendientes[1]]: { b: 0, o: 1, salaId: 's1' } };
  const H = buildManual(state);
  assert.ok(H.conflictos.some((c) => c.tipo === 'sala'));
  assert.ok(H.sesiones.every((x) => x.choque));
  // Con otra sala ya no hay choque de sala
  state.manual[s2.id][s2.pendientes[1]].salaId = 's2';
  assert.ok(!buildManual(state).conflictos.some((c) => c.tipo === 'sala'));
});

test('el horario automático se puede pasar a clases editables sin perder ni crear choques', () => {
  const state = buildInitialState(seed, demo);
  const auto = solve(state, { seed: 7 });
  state.manual = manualFromSolved(auto);
  const H = buildManual(state);
  assert.equal(H.sesiones.length, auto.sesiones.length);
  assert.equal(H.resumen.asignadas, H.resumen.total);
  assert.equal(H.conflictos.filter((c) => ['sala', 'docente'].includes(c.tipo)).length, 0, H.conflictos.map((c) => c.mensaje).join('\n'));
});

test('una clase puede ir en cualquier día y hora; con menos sesiones por semana dura más', () => {
  const state = buildInitialState(seed, demo);
  const sec = buildManual(state).secciones[0]; // TLI I-A: su configuración es martes, jueves y sábado
  const cod = sec.pendientes[0];
  const horas = seed.carreras.find((c) => c.codigo === 'TLI').semestres[0].asignaturas.find((a) => a.codigo === cod).horas;
  state.manual[sec.id] = { [cod]: { slots: [{ d: 'Lu', inicio: '09:00', fin: '11:40' }, { d: 'Mi', inicio: '09:00', fin: '11:40' }], o: 1, salaId: 's1' } };
  const H = buildManual(state);
  const it = H.secciones.find((x) => x.id === sec.id).plan[0];
  assert.deepEqual(H.sesiones.map((x) => x.dia), ['Lu', 'Mi']);
  assert.equal(it.hasta, Math.ceil(horas / 3 / 2));
  assert.ok(!H.conflictos.some((c) => c.tipo === 'sabado'));
});

test('el sábado en la tarde se marca: solo hay clases en la mañana', () => {
  const state = buildInitialState(seed, demo);
  const sec = buildManual(state).secciones[0];
  state.manual[sec.id] = { [sec.pendientes[0]]: { slots: [{ d: 'Sa', inicio: '15:00', fin: '17:00' }], o: 1, salaId: 's1' } };
  const H = buildManual(state);
  assert.ok(H.conflictos.some((c) => c.tipo === 'sabado'));
  assert.ok(H.sesiones[0].choque);
});
