import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultCalendar, sesionesDe, sinClases, weekOf, dayCode } from '../src/core/fechas.js';
import { schedule } from '../src/core/manual.js';

// Casos tomados de una carga horaria real (agosto a diciembre de 2026).
const cal = defaultCalendar(2026, 'par');

test('el calendario referencial parte el primer lunes de agosto y tiene el receso de Fiestas Patrias', () => {
  assert.equal(cal.inicio, '2026-08-03');
  assert.equal(dayCode(cal.inicio), 'Lu');
  assert.ok(sinClases(cal, '2026-09-14'));
  assert.ok(sinClases(cal, '2026-10-12'));
  assert.equal(sinClases(cal, '2026-09-11'), null);
});

test('54 horas en Lu-Mi-Vi desde el 3 de agosto terminan el 11 de septiembre', () => {
  const r = sesionesDe(cal, ['Lu', 'Mi', 'Vi'], 54, '2026-08-03');
  assert.equal(r.fechas.length, 18);
  assert.equal(r.fechas.at(-1).fecha, '2026-09-11');
});

test('el sábado vale 4 horas: 20 horas en Ma-Ju-Sá desde el 1 de octubre terminan el 13', () => {
  const r = sesionesDe(cal, ['Ma', 'Ju', 'Sa'], 20, '2026-10-01');
  assert.deepEqual(r.fechas.map((x) => x.fecha), ['2026-10-01', '2026-10-03', '2026-10-06', '2026-10-08', '2026-10-10', '2026-10-13']);
  assert.equal(r.horas, 20);
});

test('90 horas en Lu-Mi-Vi desde el 21 de octubre terminan el 30 de diciembre (salta 8 y 25 de diciembre)', () => {
  const r = sesionesDe(cal, ['Lu', 'Mi', 'Vi'], 90, '2026-10-21');
  assert.equal(r.fechas.at(-1).fecha, '2026-12-30');
  assert.ok(!r.fechas.some((x) => ['2026-12-08', '2026-12-25'].includes(x.fecha)));
});

test('en el mismo bloque, la siguiente asignatura empieza al día siguiente de terminar la anterior', () => {
  const subjects = [{ codigo: 'A', horas: 54 }, { codigo: 'B', horas: 18 }];
  const slots = ['Lu', 'Mi', 'Vi'].map((d) => ({ d, inicio: '20:45', fin: '22:45' }));
  const [a, b] = schedule(subjects, [['A', { slots, o: 1 }], ['B', { slots, o: 2 }]], cal);
  assert.equal(a.fechaFin, '2026-09-11');
  // 14 al 19 de septiembre es receso: B empieza el lunes 21.
  assert.equal(b.fechaInicio, '2026-09-21');
  assert.equal(a.desde, 1);
  assert.equal(b.desde, weekOf(cal, '2026-09-21'));
});
