// Datos de prueba: simula varias carreras con matrícula, docentes y salas ficticios.
// Las mallas son las oficiales; todo lo demás es inventado y se marca como ejemplo.
import { suggestAssignments } from './assign.js';
import { ALL_SLOTS } from './initial.js';

const APELLIDOS = ['Rojas', 'Muñoz', 'Soto', 'Contreras', 'Silva', 'Martínez', 'Sepúlveda', 'Morales', 'Rodríguez', 'López',
  'Fuentes', 'Hernández', 'Torres', 'Araya', 'Flores', 'Espinoza', 'Valenzuela', 'Castillo', 'Tapia', 'Reyes',
  'Gutiérrez', 'Castro', 'Pizarro', 'Álvarez', 'Vásquez', 'Sánchez', 'Fernández', 'Ramírez', 'Carrasco', 'Gómez',
  'Cortés', 'Herrera', 'Núñez', 'Jara', 'Vergara', 'Rivera', 'Figueroa', 'Riquelme', 'García', 'Miranda'];
const INICIALES = 'ACDFGJLMPRSV';

// Pseudoaleatorio con semilla: los mismos datos cada vez que se cargan.
function rng(seed) {
  let x = seed >>> 0;
  return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 2 ** 32; };
}

// Carga los datos de prueba sobre un estado limpio (solo mallas).
export function cargarDemo(state, { porJornada = 3 } = {}) {
  const rand = rng(2027);
  const cupo = state.reglas?.cupo || 30;
  const elegidas = ['Vespertino', 'Diurno'].flatMap((j) => state.carreras.filter((c) => c.jornada === j).slice(0, porJornada));

  // Matrícula de los 4 semestres (así sirve en otoño y en primavera): 1 o 2 secciones por semestre.
  state.oferta = {};
  for (const c of elegidas) {
    state.oferta[c.codigo] = {};
    for (const sem of [1, 2, 3, 4]) {
      const est = sem <= 2 ? 24 + Math.floor(rand() * 34) : 18 + Math.floor(rand() * 26);
      state.oferta[c.codigo][sem] = { estudiantes: est, secciones: Math.max(1, Math.ceil(est / cupo)) };
    }
  }

  // Salas: 12 salas de clase, 2 laboratorios y 1 taller.
  state.salas = [
    ...Array.from({ length: 12 }, (_, i) => ({ id: 'dem-s' + (i + 1), nombre: 'Sala ' + (101 + i), capacidad: [30, 32, 35, 40][i % 4], tipo: 'Sala' })),
    { id: 'dem-l1', nombre: 'Laboratorio 1', capacidad: 30, tipo: 'Laboratorio' },
    { id: 'dem-l2', nombre: 'Laboratorio 2', capacidad: 30, tipo: 'Laboratorio' },
    { id: 'dem-t1', nombre: 'Taller 1', capacidad: 30, tipo: 'Taller' },
  ];

  // Docentes: las asignaturas compartidas entre carreras van a un equipo transversal; el resto, a docentes de cada carrera.
  const usos = {};
  for (const c of elegidas) for (const s of c.semestres) for (const a of s.asignaturas) (usos[a.nombre] ||= new Set()).add(c.codigo);
  const docentes = [];
  let k = 0;
  const nuevo = (especialidad) => {
    const d = { id: 'dem-d' + (docentes.length + 1), nombre: `${INICIALES[k % INICIALES.length]}. ${APELLIDOS[k % APELLIDOS.length]}`, especialidad, materias: [],
      disponibilidad: [...ALL_SLOTS], tope: null, otraCarga: 0, correo: '', telefono: '' };
    k += 7; // salta para no repetir nombres seguidos
    docentes.push(d);
    return d;
  };
  // Reparte asignaturas entre n docentes; cada asignatura queda con dos docentes que la pueden dictar.
  const repartir = (nombres, n, especialidad) => {
    const equipo = Array.from({ length: n }, () => nuevo(especialidad));
    nombres.forEach((nom, i) => {
      equipo[i % n].materias.push(nom);
      if (n > 1) equipo[(i + 1) % n].materias.push(nom);
    });
  };
  const compartidas = Object.keys(usos).filter((n) => usos[n].size > 1).sort();
  if (compartidas.length) repartir(compartidas, Math.max(2, Math.ceil(compartidas.length / 4)), 'Formación transversal');
  for (const c of elegidas) {
    const propias = [...new Set(c.semestres.flatMap((s) => s.asignaturas.map((a) => a.nombre)))].filter((n) => usos[n].size === 1);
    repartir(propias, Math.max(3, Math.ceil(propias.length / 6)), c.nombre);
  }
  state.docentes = docentes;

  state.asignaciones = {};
  state.horario = null;
  state.manual = {};
  state.salaSeccion = {};
  state.asignaciones = suggestAssignments(state).asignaciones;
  state.datosDeEjemplo = true;
  return { carreras: elegidas.map((c) => c.codigo), docentes: docentes.length, salas: state.salas.length };
}
