// Sugerencia de distribución: no toca lo asignado a mano y no genera choques.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildInitialState } from '../src/core/initial.js';
import { buildManual } from '../src/core/manual.js';
import { suggest } from '../src/core/suggest.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed/carreras_mallas.json', import.meta.url)));
const demo = JSON.parse(readFileSync(new URL('./fixtures/demo-15-docentes.json', import.meta.url)));

test('la sugerencia respeta lo asignado a mano y no genera choques', () => {
  const state = buildInitialState(seed, demo);
  const sec = buildManual(state).secciones[0];
  const [a] = sec.pendientes;
  state.manual[sec.id] = { [a]: { slots: [{ d: 'Lu', inicio: '09:00', fin: '11:40' }], o: 1, salaId: 's1' } };
  const antes = buildManual(state).resumen.asignadas;
  const res = suggest(state);
  assert.ok(res.items.length > 0);
  assert.ok(!res.items.some((x) => x.secId === sec.id && x.codigo === a));
  // Aplicar todas las sugerencias: ninguna choca con sala, sección ni docente.
  for (const it of res.items) (state.manual[it.secId] ||= {})[it.codigo] = { slots: it.slots, o: it.o, salaId: it.salaId };
  const H = buildManual(state);
  assert.equal(H.resumen.asignadas, antes + res.items.length);
  const choques = H.conflictos.filter((c) => ['seccion', 'sala', 'docente'].includes(c.tipo));
  assert.equal(choques.length, 0, choques.map((c) => c.mensaje).join('\n'));
});

test('la sugerencia no cambia el estado original', () => {
  const state = buildInitialState(seed, demo);
  const snapshot = JSON.stringify(state.manual);
  suggest(state);
  assert.equal(JSON.stringify(state.manual), snapshot);
});
