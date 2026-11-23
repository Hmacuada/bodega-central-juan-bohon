// Servidor local del planificador: sirve la app y guarda el estado en data/state.json.
// Sin dependencias: node server.js  →  http://localhost:3030
import { createServer } from 'node:http';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, normalize, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildInitialState } from './src/core/initial.js';
import { buildSolverInput, fromSolverResult } from './src/core/cpsat.js';
import { buildManual } from './src/core/manual.js';
import { spawn } from 'node:child_process';

const ROOT = dirname(fileURLToPath(import.meta.url));
// En un servidor (Railway) el estado va en un volumen: STATE_FILE=/data/state.json.
const STATE = process.env.STATE_FILE || join(ROOT, 'data', 'state.json');
const PORT = Number(process.env.PORT || 3030);
const HOST = process.env.HOST || '127.0.0.1';
// Python con OR-Tools. Se puede indicar con la variable de entorno PYTHON.
const PYTHON_WIN = 'C:/Users/Dell/AppData/Local/Programs/Python/Python311/python.exe';
const PYTHON = process.env.PYTHON || (existsSync(PYTHON_WIN) ? PYTHON_WIN : 'python');

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
// Solo estas carpetas se sirven como archivos estáticos.
const STATIC_DIRS = ['public', 'src/core', 'data/seed'];

async function loadSeed() {
  const seed = JSON.parse(await readFile(join(ROOT, 'data/seed/carreras_mallas.json'), 'utf8'));
  const demo = JSON.parse(await readFile(join(ROOT, 'data/seed/demo.json'), 'utf8'));
  return { seed, demo };
}

async function readState() {
  if (existsSync(STATE)) return JSON.parse(await readFile(STATE, 'utf8'));
  const { seed, demo } = await loadSeed();
  // DEMO=0: el servidor parte vacío (solo las mallas), sin los datos de ejemplo.
  const state = buildInitialState(seed, demo, { withDemo: process.env.DEMO !== '0' });
  await saveState(state);
  return state;
}

async function saveState(state) {
  await mkdir(dirname(STATE), { recursive: true });
  const tmp = STATE + '.tmp';
  await writeFile(tmp, JSON.stringify(state, null, 1));
  await rename(tmp, STATE);
}

function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

async function readBody(req, limit = 20 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw new Error('El archivo es demasiado grande');
    chunks.push(c);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function validState(s) {
  return s && typeof s === 'object' && Array.isArray(s.carreras) && s.periodo && s.jornadas && typeof s.oferta === 'object';
}

// Ejecuta el solver CP-SAT: recibe la entrada por stdin y devuelve la solución en JSON.
function runSolver(input) {
  return new Promise((resolve, reject) => {
    const p = spawn(PYTHON, [join(ROOT, 'solver', 'horario_cpsat.py')]);
    let out = '', err = '';
    const timer = setTimeout(() => { p.kill(); reject(new Error('El solver tardó demasiado')); }, (input.tiempoSeg + 60) * 1000);
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', (e) => { clearTimeout(timer); reject(new Error('No se pudo ejecutar Python (' + e.code + '). Instálalo o define la variable PYTHON.')); });
    p.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error('El solver falló: ' + err.slice(0, 300)));
      try { resolve(JSON.parse(out)); } catch { reject(new Error('Respuesta inválida del solver')); }
    });
    p.stdin.end(JSON.stringify(input));
  });
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const path = decodeURIComponent(url.pathname);

    if (path === '/api/state' && req.method === 'GET') return send(res, 200, await readState());
    if (path === '/api/state' && req.method === 'PUT') {
      const body = JSON.parse(await readBody(req));
      if (!validState(body)) return send(res, 400, { error: 'Estado inválido' });
      await saveState(body);
      return send(res, 200, { ok: true, guardadoEn: new Date().toISOString() });
    }
    if (path === '/api/reset' && req.method === 'POST') {
      const { seed, demo } = await loadSeed();
      const state = buildInitialState(seed, demo, { withDemo: url.searchParams.get('demo') !== '0' });
      await saveState(state);
      return send(res, 200, state);
    }
    if (path === '/api/suggest' && req.method === 'POST') {
      const { state, carrera = null } = JSON.parse(await readBody(req));
      if (!validState(state)) return send(res, 400, { error: 'Estado inválido' });
      // Un solo cálculo para diurnas y vespertinas. Cada sección elige sus días (lunes a viernes en su jornada;
      // el sábado solo si hace falta), salvo las carreras marcadas con días fijos en Configuración (reglas.diasFijos).
      // Lo asignado a mano queda fijo: si ya tiene choques de sala o de sección, el solver no puede resolver.
      const choques = buildManual(state).conflictos.filter((c) => ['sala', 'seccion'].includes(c.tipo));
      if (choques.length) return send(res, 422, { error: 'Lo ya asignado tiene ' + choques.length + ' choques (p. ej.: ' + choques[0].mensaje + ') Corrígelos o quita esas clases antes de sugerir.' });
      const built = buildSolverInput(state, { jornada: null, diasLibres: true, carrera, tiempoSeg: carrera ? 60 : 600 });
      const r = await runSolver(built.input);
      if (!['OPTIMAL', 'FEASIBLE'].includes(r.estado)) return send(res, 422, { error: 'El solver no encontró distribución (' + r.estado + ')' });
      const p = fromSolverResult(r, built);
      return send(res, 200, { items: p.items, unplaced: p.unplaced, estado: r.estado, dias: p.dias });
    }
    if (path.startsWith('/api/')) return send(res, 404, { error: 'No existe' });

    // Archivos estáticos
    let rel = path === '/' ? 'public/index.html' : path.replace(/^\/+/, '');
    rel = normalize(rel).replace(/\\/g, '/');
    if (rel.includes('..') || !STATIC_DIRS.some((d) => rel.startsWith(d + '/'))) return send(res, 404, 'No encontrado', 'text/plain; charset=utf-8');
    const file = join(ROOT, rel);
    if (!existsSync(file)) return send(res, 404, 'No encontrado', 'text/plain; charset=utf-8');
    return send(res, 200, await readFile(file), TYPES[extname(file)] || 'application/octet-stream');
  } catch (err) {
    console.error(err);
    return send(res, 500, { error: err.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Planificador listo en http://localhost:${PORT}`);
});
