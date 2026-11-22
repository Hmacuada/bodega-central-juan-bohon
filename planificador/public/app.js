// Interfaz del planificador. Vistas: Horario, Carreras (con asistente de 5 pasos), Docentes, Salas, Respaldo.
import { solve } from '/src/core/solver.js';
import { suggestAssignments, qualifiedTeachers, canTeach, teacherNeeds, availableForLevel, estimatedLoad, neededSubjects } from '/src/core/assign.js';
import { activeSemesters, openSemesters, DAYS, DAY_NAMES, DAYS_PER_LEVEL, TURNOS, roman, cohortDays, toMinutes, levelOf } from '/src/core/calendar.js';
import { candidatePlans, moduleWeeks } from '/src/core/modules.js';
import { ALL_SLOTS, periodName, migrateState } from '/src/core/initial.js';

let S = null; // estado persistido
const ui = { steps: {}, mode: 'seccion', sel: null, week: 1, editDoc: null, docQuery: '', malla: null, generating: false, saveMsg: '', tabs: {}, pages: {}, rows: null, modal: null };
const app = document.getElementById('app');

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Paleta categórica validada (CVD y visión normal) para identificar asignaturas; el texto siempre va en tinta.
const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
let colorMap = {};
function buildColors() {
  colorMap = {};
  for (const c of S.carreras) for (const s of c.semestres) s.asignaturas.forEach((a, i) => { if (!(a.codigo in colorMap)) colorMap[a.codigo] = SERIES[i % SERIES.length]; });
}
const colorOf = (codigo) => colorMap[codigo] || SERIES[0];
const cvar = (codigo) => `--c:${colorOf(codigo)}`;
const initials = (name) => String(name || '?').replace(/^(Sr|Sra|Dr|Dra)\.?\s+/i, '').split(/[\s.]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
const avatar = (name, cls = '') => `<span class="avatar ${cls}" aria-hidden="true">${esc(initials(name))}</span>`;

// Iconos de trazo (24×24).
const ICONS = {
  calendar: '<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4M7.5 13.5h3M13.5 13.5h3M7.5 17h3"/>',
  cap: '<path d="M2.5 9 12 4.5 21.5 9 12 13.5z"/><path d="M6.5 11v5c0 1.4 2.5 3 5.5 3s5.5-1.6 5.5-3v-5M21.5 9v5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5"/><path d="M16 4.8a3.3 3.3 0 0 1 0 6.4M18 14.8c2 .6 3.2 2.4 3.5 5.2"/>',
  door: '<path d="M5 21V4.5A1.5 1.5 0 0 1 6.5 3h9A1.5 1.5 0 0 1 17 4.5V21M3 21h18"/><circle cx="13.5" cy="12" r=".9" fill="currentColor"/>',
  archive: '<rect x="3" y="3.5" width="18" height="5" rx="1.5"/><path d="M4.5 8.5V19a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V8.5M10 12.5h4"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" fill="currentColor" stroke="none"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  alert: '<path d="M12 8v5M12 16.5v.5"/><path d="M10.3 3.9 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5v.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c.8-4 3.8-6 7.5-6s6.7 2 7.5 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  download: '<path d="M12 3.5v12M7 11l5 5 5-5M4 20.5h16"/>',
  upload: '<path d="M12 16.5v-12M7 9l5-5 5 5M4 20.5h16"/>',
  reset: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3.5 4v4.5H8"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  printer: '<path d="M6.5 9V3.5h11V9M6.5 17.5h-2A1.5 1.5 0 0 1 3 16v-5.5A1.5 1.5 0 0 1 4.5 9h15a1.5 1.5 0 0 1 1.5 1.5V16a1.5 1.5 0 0 1-1.5 1.5h-2"/><rect x="6.5" y="14" width="11" height="7" rx="1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>'
};
const icon = (name, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
const docName = (id) => S.docentes.find((d) => d.id === id)?.nombre || 'Sin docente';
const salaName = (id) => S.salas.find((r) => r.id === id)?.nombre || 'Sin sala';
const career = (code) => S.carreras.find((c) => c.codigo === code);
const secLabel = (sec) => `${sec.carrera} ${roman(sec.sem)}-${sec.letra}`;

// ---------- Persistencia ----------
async function load() {
  const r = await fetch('/api/state');
  S = migrateState(await r.json());
  render();
}
let saveTimer = null;
function save() {
  
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const r = await fetch('/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(S) });
      ui.saveMsg = r.ok ? '' : 'No se pudo guardar';
    } catch { ui.saveMsg = 'Sin conexión con el servidor: no se guardó'; }
    paintSave();
  }, 350);
}
function paintSave() { const el = document.getElementById('savemsg'); if (el) el.textContent = ui.saveMsg; }
// Cambia datos: guarda y marca el horario como desactualizado.
function mutate(fn, { stale = true } = {}) {
  fn(S);
  if (stale && S.horario) S.horario.desactualizado = true;
  save();
  render();
}

// ---------- Rutas ----------
function route() {
  const h = location.hash.replace(/^#\/?/, '') || 'horario';
  const [view, arg] = h.split('/');
  return { view, arg };
}
window.addEventListener('hashchange', () => { ui.modal = null; ui.editDoc = null; ui.rows = null; render(); });
let resizeTimer = null;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { ui.rows = null; render(); }, 150); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ui.modal) closeModal(); });

// ---------- Una sola pantalla: pestañas, páginas y ventanas ----------
const desktop = () => window.innerWidth > 900;
function curTab(key, ids) {
  if (!ids.includes(ui.tabs[key])) ui.tabs[key] = ids[0];
  return ui.tabs[key];
}
function subtabs(key, items) {
  if (items.length < 2) return items.length ? `<span class="faint small">${esc(items[0][1])}</span>` : '';
  const cur = curTab(key, items.map((i) => i[0]));
  return `<div class="seg sm" role="tablist">${items.map(([v, l]) => `<button role="tab" data-act="tab" data-k="${key}" data-v="${v}" aria-selected="${cur === v}" aria-pressed="${cur === v}">${esc(l)}</button>`).join('')}</div>`;
}
// Filas por página: en escritorio se calculan para que la página no haga scroll.
const rowsPer = () => (desktop() ? ui.rows || 50 : 1000);
function pageNo(key, total) {
  const pages = Math.max(1, Math.ceil(total / rowsPer()));
  ui.pages[key] = Math.min(Math.max(1, ui.pages[key] || 1), pages);
  return ui.pages[key];
}
function page(key, list) {
  const p = pageNo(key, list.length);
  return list.slice((p - 1) * rowsPer(), p * rowsPer());
}
function pagerHtml(key, total) {
  const n = rowsPer();
  if (total <= n) return '';
  const p = pageNo(key, total);
  const pages = Math.ceil(total / n);
  return `<div class="pager"><span class="faint small">${(p - 1) * n + 1}–${Math.min(total, p * n)} de ${total}</span>
    <button class="sq" data-act="page" data-k="${key}" data-v="${p - 1}" ${p === 1 ? 'disabled' : ''} aria-label="Página anterior">‹</button>
    <span class="small">${p} / ${pages}</span>
    <button class="sq" data-act="page" data-k="${key}" data-v="${p + 1}" ${p === pages ? 'disabled' : ''} aria-label="Página siguiente">›</button></div>`;
}
function closeModal() {
  ui.modal = null;
  ui.editDoc = null;
  render();
}
function modalHtml() {
  const m = ui.modal;
  if (!m) return '';
  let title = '';
  let body = '';
  let wide = false;
  const H = S.horario;
  if (m.v === 'issues' && H) {
    const mine = m.k ? new Set(H.secciones.filter((s) => s.carrera === m.k).map((s) => s.id)) : null;
    const list = mine ? H.conflictos.filter((x) => x.secciones.some((id) => mine.has(id))) : H.conflictos;
    title = `${list.length} por revisar`;
    body = `<ul class="issues">${list.map((c) => `<li><span class="badge ${c.tipo === 'sin-docente' ? 'warn' : 'bad'}">${esc(tipoLabel(c.tipo))}</span><span>${esc(c.mensaje)}</span></li>`).join('') || '<li>Sin observaciones.</li>'}</ul>`;
  } else if (m.v === 'plan' && H) {
    const sec = H.secciones.find((s) => s.id === m.k);
    if (!sec) { ui.modal = null; return ''; }
    title = `Plan del semestre · ${secLabel(sec)}`;
    wide = true;
    body = `<p class="faint small">${sec.semanas} semanas · ${esc(salaName(sec.salaId))} · ${sec.dias.map((d) => DAY_NAMES[d]).join(', ')}</p><div class="tablewrap">${gantt(sec.plan, sec.semanas, (it) => docName(it.docenteId), route().view === 'horario' ? ui.week : null)}</div>`;
  } else if (m.v === 'doc') {
    const d = S.docentes.find((x) => x.id === ui.editDoc);
    if (!d) { ui.modal = null; return ''; }
    title = 'Ficha del docente';
    body = docForm(d);
  } else { ui.modal = null; return ''; }
  return `<div class="modal-back"><div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-head"><h2>${esc(title)}</h2><button class="sq" data-act="closeModal" aria-label="Cerrar">×</button></div>
    <div class="modal-body">${body}</div></div></div>`;
}
// Si la página no cabe, reduce las filas por página y vuelve a dibujar (solo escritorio).
function fitScreen() {
  const main = app.querySelector('main');
  const tb = main?.querySelector('table[data-pager] tbody, ul[data-pagerlist]');
  if (!desktop() || !main || !tb || !tb.children.length) return false;
  const over = main.scrollHeight - main.clientHeight;
  const rowH = tb.children[0].getBoundingClientRect().height + (tb.tagName === 'UL' ? 8 : 0) || 48;
  const shown = tb.children.length;
  if (over > 1 && shown > 3) { ui.rows = Math.max(3, shown - Math.ceil(over / rowH)); return true; }
  if (!ui.rows) ui.rows = Math.max(3, shown + Math.floor(-over / rowH));
  return false;
}

function render() {
  if (!S) return;
  buildColors();
  const { view, arg } = route();
  const body = rebuild(view, arg);
  const navView = view === 'carreras' ? 'carreras' : view;
  // Ancho de lectura según la página: las listas no se estiran a todo el monitor.
  const width = view === 'carreras' && arg ? 'medium' : ['carreras', 'salas', 'respaldo', 'docentes'].includes(view) ? 'narrow' : 'wide';
  app.innerHTML = `<div class="shell">${sidebar(navView)}<main class="${width}">${body}</main></div>${modalHtml()}`;
  bind();
  if (!render.fitting) { render.fitting = true; try { for (let i = 0; i < 3 && fitScreen(); i++) { app.querySelector('main').innerHTML = rebuild(view, arg); bind(); } } finally { render.fitting = false; } }
  const mf = app.querySelector('.modal [data-change], .modal input, .modal .sq');
  if (mf && !app.querySelector('.modal').contains(document.activeElement)) mf.focus({ preventScroll: true });
}

function rebuild(view, arg) {
  if (view === 'carreras' && arg) return viewWizard(arg);
  if (view === 'carreras') return viewCarreras();
  if (view === 'docentes') return viewDocentes();
  if (view === 'salas') return viewSalas();
  if (view === 'respaldo') return viewRespaldo();
  return viewHorario();
}

function sidebar(active) {
  const isHome = !['carreras', 'docentes', 'salas', 'respaldo'].includes(active);
  const link = (v, label, ic) => `<a href="#/${v}" ${active === v || (v === 'horario' && isHome) ? 'aria-current="page"' : ''}>${icon(ic)}${label}</a>`;
  const top = `<header class="topbar">
    <a class="brand" href="#/horario" aria-label="Planificador CFT Juan Bohon, inicio"><span class="logo"><img src="/public/logo.png" alt="CFT Juan Bohon"></span><b class="brand-name">Planificador</b></a>
    <div class="top-right">
      <span id="savemsg" aria-live="polite">${esc(ui.saveMsg)}</span>
      ${S.datosDeEjemplo ? `<a class="demo-tag" href="#/respaldo" title="Docentes, salas y matrícula son ficticios. Las mallas son las oficiales.">Ejemplo</a>` : ''}
      <select data-change="periodo" aria-label="Periodo">
        ${[2026, 2027, 2028].flatMap((y) => ['impar', 'par'].map((p) => `<option value="${y}|${p}" ${S.periodo.anio === y && S.periodo.paridad === p ? 'selected' : ''}>${periodName(y, p)}</option>`)).join('')}
      </select>
    </div></header>`;
  return top + `<nav class="side-nav" aria-label="Menú principal">
    ${link('horario', 'Horario', 'calendar')}${link('carreras', 'Carreras', 'cap')}${link('docentes', 'Docentes', 'person')}${link('salas', 'Salas', 'door')}
    <span class="side-sep"></span>${link('respaldo', 'Respaldo', 'archive')}
  </nav>`;
}

// Sin aviso en el contenido: la etiqueta «Ejemplo» de la barra superior basta.
function demoInline() { return ''; }

// ---------- Vista: Horario ----------
function needsChecklist() {
  const sems = activeSemesters(S.periodo.paridad);
  const offered = S.carreras.filter((c) => sems.some((s) => S.oferta?.[c.codigo]?.[s]?.secciones));
  const missing = neededSubjects(S).filter((n) => !S.asignaciones[n.asignatura.codigo]);
  return [
    ['Oferta de secciones', offered.length ? `${offered.length} de 15 carreras abren secciones` : 'Ninguna carrera tiene secciones', offered.length ? 'ok' : 'bad', '#/carreras'],
    ['Asignaturas y horas', '15 mallas cargadas · 359 asignaturas', 'ok', '#/carreras'],
    ['Docentes', missing.length ? `${missing.length} asignaturas sin docente` : `${S.docentes.length} docentes · todas las asignaturas cubiertas`, missing.length ? 'warn' : 'ok', '#/docentes'],
    ['Salas', S.salas.length ? `${S.salas.length} salas registradas` : 'No hay salas', S.salas.length ? 'ok' : 'bad', '#/salas']
  ];
}

function viewHorario() {
  const H = S.horario;
  const open = [...new Set(S.carreras.flatMap((c) => openSemesters(S, c.codigo)))].sort();
  const enPractica = S.carreras.reduce((t, c) => t + (S.oferta?.[c.codigo]?.practica?.estudiantes || 0), 0);
  const semTxt = open.length ? `semestres ${open.map(roman).join(', ').replace(/, ([^,]*)$/, ' y $1')}` : 'sin secciones abiertas';
  const head = `<div class="pagehead">
      <div><h1>Horario</h1><p class="muted">${esc(S.periodo.nombre)} · ${semTxt}${enPractica ? ` · ${enPractica} en práctica` : ''}</p></div>
      <div class="row">
        ${H ? `<button class="btnq" data-act="print" title="Imprimir la semana">${icon('printer')}<span class="sr">Imprimir</span></button><button class="btnq" data-act="csv" title="Descargar CSV">${icon('download')}<span class="sr">CSV</span></button>` : ''}
        <button class="btnp" data-act="generate" ${ui.generating ? 'disabled' : ''}>${ui.generating ? 'Generando…' : H ? 'Volver a generar' : 'Generar horario'}</button>
      </div></div>`;
  if (!H) {
    const checklist = needsChecklist();
    return head + `<div class="card" style="max-width:560px">
        <h2>Aún no hay horario</h2>
        <ol class="steps">${checklist.map(([t, d, k, href], i) => `<li><a href="${href}"><span class="n ${k === 'ok' ? 'ok' : ''}">${k === 'ok' ? icon('check') : i + 1}</span>
          <span><b>${t}</b><span class="muted small">${esc(d)}</span></span></a></li>`).join('')}</ol>
      </div>`;
  }
  const r = H.resumen;
  const conf = H.conflictos;
  const status = conf.length
    ? `<p class="status bad">${icon('alert')}${conf.length} por revisar · <button class="linkbtn" data-act="modal" data-v="issues">Ver detalle</button></p>`
    : `<p class="status ok">${icon('check')}Sin choques · ${r.secciones} secciones · ${r.sesionesSemana} sesiones por semana</p>`;
  return head + `
    ${H.desactualizado ? `<p class="status warn">${icon('alert')}Hay cambios sin incluir. Vuelve a generar.</p>` : status}
    ${viewer(H)}`;
}

function tipoLabel(t) {
  return { docente: 'Choque', 'sin-docente': 'Sin docente', disponibilidad: 'Disponibilidad', tope: 'Tope', sala: 'Sala', capacidad: 'Capacidad' }[t] || t;
}

function viewer(H) {
  const modes = [['seccion', 'Sección'], ['docente', 'Docente'], ['sala', 'Sala']];
  let options = [];
  if (ui.mode === 'seccion') options = H.secciones.map((s) => [s.id, `${secLabel(s)} · ${s.carreraNombre}`]);
  if (ui.mode === 'docente') options = [...new Set(H.sesiones.map((x) => x.docenteId).filter(Boolean))].map((id) => [id, docName(id)]).sort((a, b) => a[1].localeCompare(b[1]));
  if (ui.mode === 'sala') options = [...new Set(H.sesiones.map((x) => x.salaId).filter(Boolean))].map((id) => [id, salaName(id)]);
  if (!options.some((o) => o[0] === ui.sel)) ui.sel = options[0]?.[0] || null;
  const maxW = H.semanasMax || 22;
  ui.week = Math.min(Math.max(1, ui.week), maxW);
  const keyOf = (x) => (ui.mode === 'seccion' ? x.seccionId : ui.mode === 'docente' ? x.docenteId : x.salaId);
  const ses = H.sesiones.filter((x) => keyOf(x) === ui.sel && x.desde <= ui.week && x.hasta >= ui.week);
  const sec = ui.mode === 'seccion' ? H.secciones.find((s) => s.id === ui.sel) : null;
  const sub = sec ? `${sec.dias.map((d) => DAY_NAMES[d]).join(', ')} · ${esc(salaName(sec.salaId))} · ${sec.estudiantes} estudiantes` : `${ses.length} sesiones esta semana`;
  return `<section class="viewer" aria-label="Horario semanal">
    <div class="toolbar">
      <div class="row" style="gap:10px">
        <div class="seg" role="group" aria-label="Ver por">${modes.map(([m, l]) => `<button data-act="mode" data-v="${m}" aria-pressed="${ui.mode === m}">${l}</button>`).join('')}</div>
        <select data-change="sel" aria-label="Elegir">${options.map(([v, l]) => `<option value="${esc(v)}" ${v === ui.sel ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
      </div>
      <div class="weeknav"><button class="sq" data-act="week" data-v="-1" aria-label="Semana anterior">‹</button><span class="wk-label">Semana ${ui.week} <span class="faint">/ ${maxW}</span></span><button class="sq" data-act="week" data-v="1" aria-label="Semana siguiente">›</button></div>
    </div>
    <p class="muted small">${sub}${sec ? ` · <button class="linkbtn" data-act="modal" data-v="plan" data-k="${sec.id}">Plan del semestre</button>` : ''}</p>
    <div class="tablewrap week-scroll">${weekGrid(ses, H, sec)}</div>${agenda(ses, H)}
  </section>`;
}

// Filas: en una sección, «Bloque 1 / Bloque 2»; para docentes y salas, una fila por turno.
function weekGrid(ses, H, sec) {
  if (!ses.length) return '<p class="muted" style="padding:32px 0;text-align:center">Sin clases esta semana.</p>';
  const bySection = ui.mode === 'seccion';
  const rowOf = (x) => (bySection ? x.turno.slice(1) : x.turno);
  const ROWS = bySection ? [['1', 'Bloque 1'], ['2', 'Bloque 2']] : TURNOS.map((t) => [t.id, t.nombre]);
  const used = new Set(ses.map(rowOf));
  const rows = ROWS.filter(([id]) => used.has(id));
  const byKey = {};
  for (const x of ses) (byKey[`${x.dia}|${rowOf(x)}`] = byKey[`${x.dia}|${rowOf(x)}`] || []).push(x);
  const secById = Object.fromEntries(H.secciones.map((s) => [s.id, s]));
  const activeDays = new Set(sec ? sec.dias : ses.map((x) => x.dia));
  const rowTime = (id) => { const x = ses.find((s) => rowOf(s) === id && s.dia !== 'Sa') || ses.find((s) => rowOf(s) === id); return x ? x.inicio : ''; };
  let html = `<div class="week" style="grid-template-columns:64px repeat(6,minmax(0,1fr))"><div></div>${DAYS.map((d) => `<div class="dh ${activeDays.has(d) ? 'active' : ''}">${DAY_NAMES[d]}</div>`).join('')}`;
  for (const [id] of rows) {
    html += `<div class="th2">${rowTime(id)}</div>`;
    for (const d of DAYS) {
      const list = byKey[`${d}|${id}`] || [];
      if (!list.length) { html += `<div class="cell ${sec && !activeDays.has(d) ? 'off' : 'empty'}"></div>`; continue; }
      const x = list[0];
      const meta = ui.mode === 'seccion' ? docName(x.docenteId) : ui.mode === 'docente' ? `${secLabel(secById[x.seccionId])} · ${salaName(x.salaId)}` : `${secLabel(secById[x.seccionId])} · ${docName(x.docenteId)}`;
      html += `<div class="cell ${list.length > 1 ? 'clash' : ''}" style="${cvar(x.codigo)}" title="${esc(x.nombre)} · ${x.inicio}–${x.fin} · semanas ${x.desde}–${x.hasta}">
        <span class="s">${esc(x.nombre)}</span><span class="m">${esc(meta)}</span>${d === 'Sa' ? `<span class="t">${x.inicio}–${x.fin}</span>` : ''}
        ${list.length > 1 ? `<span class="badge bad">+${list.length - 1} a la misma hora</span>` : ''}</div>`;
    }
  }
  return html + '</div>';
}

// En el celular la semana se lee como agenda: un día debajo del otro.
function agenda(ses, H) {
  if (!ses.length) return '';
  const secById = Object.fromEntries(H.secciones.map((s) => [s.id, s]));
  const metaOf = (x) => (ui.mode === 'seccion' ? docName(x.docenteId) : ui.mode === 'docente' ? `${secLabel(secById[x.seccionId])} · ${salaName(x.salaId)}` : `${secLabel(secById[x.seccionId])} · ${docName(x.docenteId)}`);
  const days = DAYS.filter((d) => ses.some((x) => x.dia === d));
  return `<div class="agenda">${days.map((d) => `<div class="ag-day"><h3>${DAY_NAMES[d]}</h3>${ses.filter((x) => x.dia === d).sort((a, b) => a.inicio.localeCompare(b.inicio)).map((x) => `<div class="ag-item" style="${cvar(x.codigo)}"><span class="ag-t">${x.inicio}<br>${x.fin}</span><span><b>${esc(x.nombre)}</b><span class="faint small">${esc(metaOf(x))}</span></span></div>`).join('')}</div>`).join('')}</div>`;
}

function gantt(items, weeks, who, currentWeek = null) {
  const cols = `200px repeat(${weeks}, minmax(0,1fr))`;
  const stripe = currentWeek && currentWeek <= weeks ? `<div class="stripe" style="grid-column:${currentWeek + 1}"></div>` : '';
  let html = `<div class="gantt"><div class="gr head" style="grid-template-columns:${cols}"><div class="gname"></div>${Array.from({ length: weeks }, (_, i) => `<div class="wk ${currentWeek === i + 1 ? 'now' : ''}" style="grid-column:${i + 2}">${(i + 1) % 2 && i + 1 !== currentWeek ? '' : i + 1}</div>`).join('')}</div>`;
  for (const it of items) {
    const label = who ? esc(who(it)) : `${it.horas} h`;
    html += `<div class="gr" style="grid-template-columns:${cols};${cvar(it.codigo)}">${stripe}<div class="gname">${esc(it.nombre)}</div><div class="bar" title="${esc(it.nombre)} · semanas ${it.desde}–${it.hasta} · ${it.horas} h" style="grid-column:${it.desde + 1} / ${it.hasta + 2};${cvar(it.codigo)}">${label}</div></div>`;
  }
  return html + '</div>';
}

// ---------- Vista: Carreras ----------
function viewCarreras() {
  const sems = activeSemesters(S.periodo.paridad);
  const info = S.carreras.map((c) => {
    const secs = sems.reduce((t, s) => t + (S.oferta?.[c.codigo]?.[s]?.secciones || 0), 0);
    const missing = neededSubjects(S, c.codigo).filter((n) => !S.asignaciones[n.asignatura.codigo]).length;
    return { c, secs, missing, estado: !secs ? 'sin' : missing ? 'faltan' : 'lista' };
  });
  const f = ui.filter || 'all';
  const list = f === 'all' ? info : info.filter((x) => x.estado === f);
  const n = (k) => info.filter((x) => x.estado === k).length;
  const enPractica = S.carreras.filter((c) => S.oferta?.[c.codigo]?.practica?.estudiantes).length;
  const tab = (v, label, count) => `<button data-act="filter" data-v="${v}" aria-pressed="${f === v}">${label} <span class="count">${count}</span></button>`;
  const estado = ({ estado: e, missing }) => (e === 'lista' ? '<span class="badge ok">Lista</span>' : e === 'faltan' ? `<span class="badge warn">Faltan ${missing} docentes</span>` : '<span class="faint small">Sin oferta</span>');
  return `<div class="pagehead"><div><h1>Carreras</h1><p class="muted">${S.carreras.length} carreras · mallas oficiales${enPractica ? ` · ${enPractica} con estudiantes en práctica` : ''}</p></div></div>
    <div class="seg" role="group" aria-label="Filtrar">${tab('all', 'Todas', info.length)}${tab('lista', 'Listas', n('lista'))}${tab('faltan', 'Faltan docentes', n('faltan'))}${tab('sin', 'Sin oferta', n('sin'))}</div>
    <div class="card" style="padding:4px 8px"><div class="tablewrap"><table class="dtable" data-pager><thead><tr><th>Carrera</th><th>Secciones</th><th>Estado</th><th></th></tr></thead><tbody>
      ${page('carreras-' + f, list).map((x) => `<tr class="click" data-act="go" data-v="#/carreras/${x.c.codigo}">
        <td><span class="l1">${esc(x.c.nombre)}</span><span class="l2">${x.c.codigo} · ${esc(x.c.jornada)}</span></td>
        <td class="num">${x.secs || '<span class="faint">—</span>'}</td>
        <td>${estado(x)}</td>
        <td style="text-align:right;color:var(--ink-3)">${icon('arrow')}</td></tr>`).join('') || '<tr><td colspan="4" class="muted" style="padding:24px">Ninguna carrera en este filtro.</td></tr>'}
    </tbody></table></div>${pagerHtml('carreras-' + f, list.length)}</div>`;
}

function malla(c) {
  return `<div class="malla">${c.semestres.map((s) => `<div class="sem"><h3>Semestre ${roman(s.n)}<span>${s.horas} h</span></h3>${s.asignaturas.map((a) => `<div class="asg ${a.transversal ? 'tr' : ''}" style="${cvar(a.codigo)}"><span>${esc(a.nombre)}</span><b>${a.horas}</b></div>`).join('')}</div>`).join('')}</div>
    <p class="muted small" style="margin-top:10px">Fuente: <a href="${esc(c.fuente?.malla_pdf)}" target="_blank" rel="noopener">malla oficial (PDF)</a>. Fondo dorado: asignaturas transversales.</p>`;
}

// ---------- Vista: Asistente por carrera ----------
const STEP_LABELS = ['Oferta', 'Asignaturas', 'Docentes', 'Reglas y salas', 'Generar'];

function viewWizard(code) {
  const c = career(code);
  if (!c) return '<p>Carrera no encontrada. <a href="#/carreras">Volver</a></p>';
  const step = ui.steps[code] || 1;
  const sems = activeSemesters();
  const stepper = `<div class="stepper">${STEP_LABELS.map((l, i) => `<button data-act="step" data-v="${i + 1}" class="${i + 1 < step ? 'done' : ''}" ${i + 1 === step ? 'aria-current="step"' : ''}><span class="n">${i + 1 < step ? '✓' : i + 1}</span>${l}</button>`).join('')}</div>`;
  let body = '';
  if (step === 1) body = wizOferta(c, sems);
  if (step === 2) body = wizAsignaturas(c);
  if (step === 3) body = wizDocentes(c);
  if (step === 4) body = wizReglas(c);
  if (step === 5) body = wizGenerar(c);
  return `<div class="pagehead"><div><span class="kicker"><a href="#/carreras">Carreras</a> · ${c.codigo} · ${esc(c.jornada)} · ${esc(S.periodo.nombre)}</span><h1>${esc(c.nombre)}</h1></div></div>
    <nav aria-label="Pasos">${stepper}</nav><div class="card">${body}</div>
    <div class="wiz-foot"><button class="btn" data-act="step" data-v="${step - 1}" ${step === 1 ? 'disabled' : ''}>${icon('back')}Atrás</button>${step < 5 ? `<button class="btnp" data-act="step" data-v="${step + 1}">Siguiente: ${STEP_LABELS[step].toLowerCase()} ${icon('arrow')}</button>` : `<a class="btnp" href="#/horario">Ver horario de la sede ${icon('arrow')}</a>`}</div>`;
}

function ofertaOf(code, sem) {
  S.oferta[code] = S.oferta[code] || {};
  return S.oferta[code][sem] || { estudiantes: 0, secciones: 0 };
}

function practicaOf(code) {
  S.oferta[code] = S.oferta[code] || {};
  return S.oferta[code].practica || { estudiantes: 0, supervisorId: '' };
}

// Paso 1: los 4 semestres lectivos y la práctica. Cada periodo puede abrir cualquiera.
function wizOferta(c, sems) {
  const pr = practicaOf(c.codigo);
  const rows = sems.map((sem) => {
    const of = ofertaOf(c.codigo, sem);
    const sug = Math.max(of.estudiantes ? 1 : 0, Math.ceil((of.estudiantes || 0) / S.reglas.cupo));
    const days = cohortDays(S.jornadas, c.jornada, sem);
    const per = of.secciones ? Math.ceil(of.estudiantes / of.secciones) : 0;
    return `<div class="offer-row ${of.secciones ? 'open' : ''}">
      <div class="offer-sem"><b>Semestre ${roman(sem)}</b><span>${levelOf(sem)}º año · ${days.join(' ')}</span></div>
      <label class="field">Estudiantes<input type="number" min="0" value="${of.estudiantes || 0}" data-change="estudiantes" data-sem="${sem}" data-code="${c.codigo}"></label>
      <div class="field">Secciones<div class="counter sm"><button class="sq" data-act="secs" data-sem="${sem}" data-v="-1" aria-label="Menos secciones del semestre ${roman(sem)}">−</button><b>${of.secciones || 0}</b><button class="sq" data-act="secs" data-sem="${sem}" data-v="1" aria-label="Más secciones del semestre ${roman(sem)}">+</button></div></div>
      <div class="offer-note small">${of.secciones ? `≈ ${per} por sección${per > S.reglas.cupo ? ' <span class="badge warn">sobre el cupo</span>' : ''}` : '<span class="faint">No abre</span>'}${sug !== (of.secciones || 0) && of.estudiantes ? ` <span class="faint">· sugerido ${sug}</span>` : ''}</div>
    </div>`;
  }).join('');
  return `<div class="section-title"><h2>Oferta de ${esc(S.periodo.nombre)}</h2><span class="muted small">Cupo ${S.reglas.cupo} por sección</span></div>
    <div class="offer-list">${rows}
      <div class="offer-row practice ${pr.estudiantes ? 'open' : ''}">
        <div class="offer-sem"><b>Semestre V</b><span>Práctica laboral${c.practica?.examen ? ' y examen' : ''}</span></div>
        <label class="field">Estudiantes<input type="number" min="0" value="${pr.estudiantes || 0}" data-change="practicaEst" data-code="${c.codigo}"></label>
        <label class="field">Horas de práctica<input type="number" min="0" step="10" value="${c.practica?.horas ?? 400}" data-change="practicaHoras" data-code="${c.codigo}"></label>
        <div class="offer-note small">${pr.estudiantes ? 'Sin sala ni bloques. El supervisor se elige en Docentes.' : '<span class="faint">Nadie en práctica</span>'}</div>
      </div>
    </div>`;
}

const noOpen = '<p class="muted">Esta carrera no abre secciones en el periodo. Ábrelas en el paso Oferta.</p>';
const dotOf = (codigo) => `<i class="dot" style="${cvar(codigo)}"></i>`;

// Paso 2: una pestaña por semestre abierto; lista paginada o carta Gantt.
function wizAsignaturas(c) {
  const open = openSemesters(S, c.codigo);
  if (!open.length) return `<h2>Asignaturas</h2>${noOpen}`;
  const key = 'asg-' + c.codigo;
  const sem = Number(curTab(key, open.map(String)));
  const view = curTab('asgView', ['lista', 'gantt']);
  const s = c.semestres[sem - 1];
  const plan = candidatePlans(s.asignaturas, 1)[0];
  const items = plan.items.map((it) => ({ ...it, ...s.asignaturas.find((a) => a.codigo === it.codigo) })).sort((a, b) => a.desde - b.desde || a.carril - b.carril);
  const pk = key + sem;
  const body = view === 'lista'
    ? `<div class="tablewrap"><table class="dtable" data-pager><thead><tr><th>Asignatura</th><th class="num">Horas</th><th class="num">Semanas</th><th></th></tr></thead><tbody>${page(pk, s.asignaturas).map((a) => `<tr><td><span class="who" style="gap:8px">${dotOf(a.codigo)}${esc(a.nombre)}</span></td><td class="num">${a.horas}</td><td class="num">${moduleWeeks(a.horas)}</td><td>${a.transversal ? '<span class="faint small">transversal</span>' : ''}</td></tr>`).join('')}</tbody></table></div>${pagerHtml(pk, s.asignaturas.length)}`
    : `<div class="tablewrap">${gantt(items, plan.semanas, (it) => docName(S.asignaciones[it.codigo]))}</div>`;
  return `<div class="section-title"><div class="row" style="gap:14px"><h2>Asignaturas</h2>${subtabs(key, open.map((x) => [String(x), 'Semestre ' + roman(x)]))}</div>
      ${subtabs('asgView', [['lista', 'Lista'], ['gantt', 'Carta Gantt']])}</div>
    <p class="faint small">${s.horas} h · ${S.oferta[c.codigo][sem].secciones} ${S.oferta[c.codigo][sem].secciones === 1 ? 'sección' : 'secciones'} · ${plan.semanas} semanas</p>
    ${body}`;
}

// Paso 3: pestañas por semestre abierto y, si hay estudiantes en práctica, una para el supervisor.
function wizDocentes(c) {
  const open = openSemesters(S, c.codigo);
  const pr = practicaOf(c.codigo);
  const tabs = open.map((sem) => [String(sem), 'Semestre ' + roman(sem)]).concat(pr.estudiantes ? [['5', 'Práctica']] : []);
  if (!tabs.length) return `<h2>Docentes</h2>${noOpen}`;
  const key = 'doc-' + c.codigo;
  const cur = curTab(key, tabs.map((t) => t[0]));
  const head = `<div class="section-title"><div class="row" style="gap:14px"><h2>Docentes</h2>${subtabs(key, tabs)}</div>
      ${cur !== '5' ? '<div class="row"><button class="btn" data-act="suggest" data-v="missing">Sugerir los que faltan</button><button class="btnq" data-act="suggest" data-v="all">Rehacer todo</button></div>' : ''}</div>`;
  if (cur === '5') {
    return head + `<p class="faint small">${pr.estudiantes} estudiantes · ${c.practica?.horas ?? 400} h de práctica${c.practica?.examen ? ' y examen de competencias' : ''}</p>
      <label class="field" style="max-width:320px">Supervisor de práctica<select data-change="supervisor" data-code="${c.codigo}"><option value="">Sin asignar</option>${S.docentes.map((d) => `<option value="${d.id}" ${d.id === pr.supervisorId ? 'selected' : ''}>${esc(d.nombre)}</option>`).join('')}</select></label>`;
  }
  const sem = Number(cur);
  const s = c.semestres[sem - 1];
  const pk = key + sem;
  const rows = page(pk, s.asignaturas).map((a) => {
    const asg = S.asignaciones[a.codigo] || '';
    const qual = qualifiedTeachers(S, a.nombre);
    const others = S.docentes.filter((d) => !qual.includes(d));
    const doc = S.docentes.find((d) => d.id === asg);
    let warn = '';
    if (!asg) warn = qual.length ? '<span class="badge warn">Sin asignar</span>' : '<span class="badge bad">Nadie la dicta</span>';
    else if (!canTeach(doc, a.nombre)) warn = '<span class="badge warn">No está en sus asignaturas</span>';
    else if (!availableForLevel(S, doc, c, sem)) warn = '<span class="badge bad">No puede todos los días</span>';
    return `<tr><td><span class="who" style="gap:8px">${dotOf(a.codigo)}${esc(a.nombre)}</span></td><td><select style="min-width:200px" data-change="asignar" data-cod="${a.codigo}" aria-label="Docente de ${esc(a.nombre)}">
      <option value="">Sin asignar</option>
      ${qual.length ? `<optgroup label="Dictan esta asignatura">${qual.map((d) => `<option value="${d.id}" ${d.id === asg ? 'selected' : ''}>${esc(d.nombre)}</option>`).join('')}</optgroup>` : ''}
      ${others.length ? `<optgroup label="Otros docentes">${others.map((d) => `<option value="${d.id}" ${d.id === asg ? 'selected' : ''}>${esc(d.nombre)}</option>`).join('')}</optgroup>` : ''}
    </select></td><td>${warn}</td></tr>`;
  }).join('');
  return head + `<div class="tablewrap"><table class="dtable" data-pager><thead><tr><th>Asignatura</th><th>Docente</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>${pagerHtml(pk, s.asignaturas.length)}`;
}

// Paso 4: días de cada año y horario de los bloques (por jornada), cupo y tope. Todo editable.
function wizReglas(c) {
  const jn = c.jornada;
  const j = S.jornadas[jn];
  const same = S.carreras.filter((x) => x.jornada === jn).length;
  const t = curTab('rules', ['jornada', 'reglas']);
  const head = `<div class="section-title"><div class="row" style="gap:14px"><h2>Reglas</h2>${subtabs('rules', [['jornada', 'Jornada ' + jn.toLowerCase()], ['reglas', 'Cupo, tope y salas']])}</div></div>`;
  if (t === 'reglas') {
    const open = openSemesters(S, c.codigo);
    const secsMax = Math.max(0, ...open.map((s) => { const o = S.oferta[c.codigo][s]; return Math.ceil(o.estudiantes / o.secciones); }));
    const fit = S.salas.filter((r) => r.capacidad >= secsMax).length;
    return head + `<div class="rules">
      <div class="rule-row"><div class="rule-label"><b>Cupo por sección</b><span>Estudiantes</span></div><input type="number" min="5" value="${S.reglas.cupo}" data-change="cupo"></div>
      <div class="rule-row"><div class="rule-label"><b>Tope por docente</b><span>Sesiones por semana · se ajusta en cada docente</span></div><input type="number" min="1" max="12" value="${S.reglas.tope}" data-change="tope"></div>
      <div class="rule-row"><div class="rule-label"><b>Salas</b><span>${S.salas.length} salas · ${fit} con cupo para ${secsMax}</span></div><a class="btnq" href="#/salas">Editar salas ${icon('arrow')}</a></div>
    </div>`;
  }
  const usesSat = [1, 2].some((lv) => j.dias[lv].includes('Sa'));
  const dayRow = (lv) => {
    const n = j.dias[lv].length;
    return `<div class="rule-row"><div class="rule-label"><b>${lv}º año</b><span>Semestres ${lv === 1 ? 'I y II' : 'III y IV'}</span></div>
      <div class="row" style="gap:10px"><div class="daypick" role="group" aria-label="Días de ${lv}º año">${DAYS.map((d) => `<button data-act="dayToggle" data-lv="${lv}" data-v="${d}" aria-pressed="${j.dias[lv].includes(d)}" title="${DAY_NAMES[d]}">${d}</button>`).join('')}</div>
      ${n === DAYS_PER_LEVEL ? '' : `<span class="badge warn">Elige ${DAYS_PER_LEVEL} días (hay ${n})</span>`}</div></div>`;
  };
  const blockRow = (key, label) => {
    const own = key === 'default' || !!j.bloques[key];
    const list = j.bloques[key] || j.bloques.default;
    return `<div class="rule-row"><div class="rule-label"><b>${label}</b>${key === 'Sa' ? `<button class="linkbtn" data-act="${own ? 'satSame' : 'satOwn'}">${own ? 'Usar el de la semana' : 'Usar otro horario'}</button>` : '<span>Bloques de clase</span>'}</div>
      ${own ? `<div class="blocks">${list.map((b, i) => `<span class="blk"><span class="faint small">${i + 1}</span><input type="time" value="${b.inicio}" data-change="blockTime" data-k="${key}" data-i="${i}" data-f="inicio" aria-label="${label}, bloque ${i + 1}, inicio"><span class="faint">–</span><input type="time" value="${b.fin}" data-change="blockTime" data-k="${key}" data-i="${i}" data-f="fin" aria-label="${label}, bloque ${i + 1}, fin">${toMinutes(b.fin) <= toMinutes(b.inicio) ? '<span class="badge bad">Revisa</span>' : ''}</span>`).join('')}</div>`
        : '<span class="faint small">Mismo horario que de lunes a viernes</span>'}</div>`;
  };
  return head + `<p class="faint small">Afecta a las ${same} carreras de jornada ${esc(jn.toLowerCase())}.</p>
    <div class="rules">
      ${dayRow(1)}${dayRow(2)}
      ${blockRow('default', 'Lunes a viernes')}${usesSat ? blockRow('Sa', 'Sábado') : ''}
      <label class="check-line"><input type="checkbox" data-change="confirmado" ${j.confirmado ? 'checked' : ''}> Días y bloques confirmados por la coordinación</label>
    </div>`;
}

// Paso 5: resumen por sección; el plan de cada una se abre en una ventana.
function wizGenerar(c) {
  const H = S.horario;
  const mine = H ? H.secciones.filter((s) => s.carrera === c.codigo) : [];
  const ids = new Set(mine.map((s) => s.id));
  const conf = H ? H.conflictos.filter((x) => x.secciones.some((id) => ids.has(id)) || (x.tipo === 'tope' && mine.some((s) => s.plan.some((p) => p.docenteId === x.docenteId)))) : [];
  const head = `<div class="section-title"><h2>Generar</h2><button class="btnp" data-act="generate" ${ui.generating ? 'disabled' : ''}>${ui.generating ? 'Generando…' : H ? 'Volver a generar' : 'Generar horario'}</button></div>`;
  if (!H) return head + '<p class="muted">Todavía no hay horario para este periodo.</p>';
  const status = H.desactualizado ? `<p class="status warn">${icon('alert')}Hay cambios sin incluir. Vuelve a generar.</p>`
    : conf.length ? `<p class="status bad">${icon('alert')}${conf.length} por revisar · <button class="linkbtn" data-act="modal" data-v="issues" data-k="${c.codigo}">Ver</button></p>`
    : `<p class="status ok">${icon('check')}${mine.length ? `${mine.length} secciones sin choques` : 'Sin secciones en el periodo'}</p>`;
  return head + status + (mine.length ? `<div class="tablewrap"><table class="dtable" data-pager><thead><tr><th>Sección</th><th>Días</th><th>Sala</th><th></th></tr></thead><tbody>
    ${page('gen-' + c.codigo, mine).map((s) => `<tr><td><span class="l1">${secLabel(s)}</span><span class="l2">${s.estudiantes} estudiantes · ${s.semanas} semanas</span></td><td>${s.dias.join(' ')}</td><td>${esc(salaName(s.salaId))}</td><td><button class="linkbtn" data-act="modal" data-v="plan" data-k="${s.id}">Ver plan</button></td></tr>`).join('')}
    </tbody></table></div>${pagerHtml('gen-' + c.codigo, mine.length)}` : '');
}

// ---------- Vista: Docentes ----------
function viewDocentes() {
  const load = estimatedLoad(S, S.asignaciones);
  const q = ui.docQuery.toLowerCase();
  const limited = (d) => Array.isArray(d.disponibilidad) && d.disponibilidad.length < ALL_SLOTS.length;
  const f = ui.docFilter || 'all';
  const inF = (d) => f === 'all' || (f === 'carga' ? load[d.id] : !load[d.id]);
  const list = S.docentes
    .filter((d) => !q || d.nombre.toLowerCase().includes(q) || (d.especialidad || '').toLowerCase().includes(q) || d.materias.some((m) => m.toLowerCase().includes(q)))
    .filter(inF);
  const tab = (v, label, count) => `<button data-act="docFilter" data-v="${v}" aria-pressed="${f === v}">${label} <span class="count">${count}</span></button>`;
  return `<div class="pagehead"><div><h1>Docentes</h1><p class="muted">${S.docentes.length} docentes</p></div><button class="btnp" data-act="addDoc">${icon('plus')}Agregar</button></div>
    <div class="row between">
      <div class="seg" role="group" aria-label="Filtrar">${tab('all', 'Todos', S.docentes.length)}${tab('carga', 'Con carga', S.docentes.filter((d) => load[d.id]).length)}${tab('libre', 'Sin carga', S.docentes.filter((d) => !load[d.id]).length)}</div>
      <div class="search" style="flex:0 1 300px">${icon('search')}<input type="text" placeholder="Buscar" value="${esc(ui.docQuery)}" data-input="docQuery" aria-label="Buscar docente"></div>
    </div>
    <div class="card" style="padding:4px 8px">
      <div class="tablewrap"><table class="dtable" data-pager><thead><tr><th>Docente</th><th>Carga</th><th></th></tr></thead><tbody>
        ${page('docentes-' + f, list).map((d) => `<tr class="click ${d.id === ui.editDoc ? 'selected' : ''}" data-act="editDoc" data-v="${d.id}">
          <td><span class="who">${avatar(d.nombre, 'sm')}<span><span class="l1">${esc(d.nombre)}</span><span class="l2">${esc(d.especialidad || '')}</span></span></span></td>
          <td class="num">${load[d.id] ? `${load[d.id]} h` : '<span class="faint">—</span>'}</td>
          <td>${limited(d) ? '<span class="badge warn">Disponibilidad limitada</span>' : ''}</td></tr>`).join('') || '<tr><td colspan="3" class="muted" style="padding:24px">Sin resultados.</td></tr>'}
      </tbody></table></div>${pagerHtml('docentes-' + f, list.length)}</div>`;
}

function allSubjectNames() {
  return [...new Set(S.carreras.flatMap((c) => c.semestres.flatMap((s) => s.asignaturas.map((a) => a.nombre))))].sort((a, b) => a.localeCompare(b));
}

function docForm(d) {
  const avail = Array.isArray(d.disponibilidad) ? d.disponibilidad : ALL_SLOTS;
  return `<div class="doc-head">${avatar(d.nombre, 'lg')}<div><b>${esc(d.nombre || 'Nuevo docente')}</b><br><span class="faint small">${esc(d.especialidad || 'Sin especialidad')}</span></div></div>
    <label class="field">Nombre<input type="text" value="${esc(d.nombre)}" data-change="docField" data-f="nombre"></label>
    <label class="field">Especialidad<input type="text" value="${esc(d.especialidad)}" data-change="docField" data-f="especialidad"></label>
    <div class="row"><label class="field">Tope semanal (sesiones)<input type="number" min="1" max="12" placeholder="${S.reglas.tope}" value="${d.tope ?? ''}" data-change="docField" data-f="tope"></label>
      <label class="field">Sesiones en otros cursos<input type="number" min="0" max="12" value="${d.otraCarga || 0}" data-change="docField" data-f="otraCarga"></label></div>
    <div class="field">Asignaturas que puede dictar
      <div class="chips">${d.materias.map((m, i) => `<span class="chip">${esc(m)}<button data-act="rmMat" data-v="${i}" aria-label="Quitar ${esc(m)}">×</button></span>`).join('') || '<span class="muted">Ninguna todavía.</span>'}</div>
      <div class="row"><input type="text" list="subjects" placeholder="Escribe una asignatura" id="newMat" class="grow" aria-label="Agregar asignatura"><button class="btn" data-act="addMat">Agregar</button></div>
      <datalist id="subjects">${allSubjectNames().map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
    </div>
    <div class="field">Disponibilidad
      <div class="avail"><div></div>${DAYS.map((x) => `<span class="dh">${x}</span>`).join('')}
        ${TURNOS.map((t) => `<span class="lbl">${t.nombre}</span>${DAYS.map((x) => `<input type="checkbox" ${avail.includes(`${x}-${t.id}`) ? 'checked' : ''} data-change="avail" data-v="${x}-${t.id}" aria-label="${DAY_NAMES[x]}, ${t.nombre}">`).join('')}`).join('')}
      </div>
      <span class="muted small">Mañana: jornada diurna y sábado. Noche: jornada vespertina. Un módulo usa los 3 días del nivel: si falta un día, el docente no puede tomar asignaturas de ese nivel.</span>
    </div>
    <div class="row" style="justify-content:space-between"><button class="btn danger" data-act="delDoc">Eliminar docente</button><button class="btnp" data-act="closeModal">Listo</button></div>`;
}

// ---------- Vista: Salas ----------
function viewSalas() {
  const usedBy = {};
  for (const s of S.horario?.secciones || []) (usedBy[s.salaId] = usedBy[s.salaId] || []).push(s);
  const seats = S.salas.reduce((t, r) => t + (Number(r.capacidad) || 0), 0);
  const row = (r, i) => {
    const secs = usedBy[r.id] || [];
    const over = secs.some((s) => s.estudiantes > r.capacidad);
    if (ui.editSala === r.id) {
      return `<li class="room editing">
        <label class="field grow">Nombre<input type="text" value="${esc(r.nombre)}" data-change="sala" data-i="${i}" data-f="nombre"></label>
        <label class="field">Capacidad<input type="number" min="1" value="${r.capacidad}" data-change="sala" data-i="${i}" data-f="capacidad"></label>
        <label class="field">Tipo<select data-change="sala" data-i="${i}" data-f="tipo">${['Sala', 'Laboratorio', 'Taller'].map((t) => `<option ${r.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <div class="room-actions"><button class="btnq danger-q" data-act="delSala" data-v="${i}">Eliminar</button><button class="btn" data-act="editSala" data-v="">Listo</button></div>
      </li>`;
    }
    return `<li class="room" data-act="editSala" data-v="${r.id}" tabindex="0" role="button" aria-label="Editar ${esc(r.nombre)}">
      <span class="room-name"><b>${esc(r.nombre)}</b>${r.tipo && r.tipo !== 'Sala' ? `<span>${esc(r.tipo)}</span>` : ''}</span>
      <span class="room-cap num">${r.capacidad}<small>puestos</small></span>
      <span class="room-use">${secs.length ? secs.map((s) => `<span class="${s.estudiantes > r.capacidad ? 'over' : ''}">${esc(secLabel(s))}</span>`).join('') : '<span class="free">Libre</span>'}${over ? '<span class="badge bad">Excede capacidad</span>' : ''}</span>
    </li>`;
  };
  return `<div class="pagehead"><div><h1>Salas</h1><p class="muted">${S.salas.length} salas · ${seats} puestos</p></div><button class="btnp" data-act="addSala">${icon('plus')}Agregar</button></div>
    <ul class="rooms" data-pagerlist>${page('salas', S.salas.map((r, i) => [r, i])).map(([r, i]) => row(r, i)).join('') || '<li class="room empty-room">Aún no hay salas.</li>'}</ul>${pagerHtml('salas', S.salas.length)}
    <p class="faint small">Haz clic en una sala para editarla.${S.horario ? '' : ' Al generar el horario verás qué sección usa cada sala.'}</p>`;
}

function viewRespaldo() {
  return `<div class="pagehead"><div><h1>Respaldo</h1></div></div>
    <div class="grid-auto">
      <div class="card"><h2>Descargar respaldo</h2><p class="muted">Todo en un archivo JSON.</p><button class="btn" data-act="backup">Descargar</button></div>
      <div class="card"><h2>Cargar respaldo</h2><p class="muted">Reemplaza los datos actuales.</p><input type="file" accept="application/json,.json" data-change="restore" aria-label="Archivo de respaldo"></div>
      <div class="card"><h2>Empezar con datos reales</h2><p class="muted">Mantiene las mallas y borra el ejemplo.</p><button class="btn danger" data-act="reset" data-v="0">Empezar vacío</button></div>
      <div class="card"><h2>Volver al ejemplo</h2><p class="muted">Datos ficticios de TLI, APM y MME.</p><button class="btn" data-act="reset" data-v="1">Restaurar ejemplo</button></div>
    </div>
    `;
}

// Bloques que empiezan antes de las 17:00 se cruzan con la disponibilidad de mañana (M); el resto, con la de noche (N).
const turnoOf = (inicio, id) => (toMinutes(inicio) < 17 * 60 ? 'M' : 'N') + (id || 'B1').slice(1);

// ---------- Acciones ----------
const actions = {
  generate() {
    ui.generating = true;
    render();
    setTimeout(() => {
      try {
        const res = solve(S, { seed: (Date.now() % 100000) + 1 });
        S.horario = res;
        ui.week = 1;
        save();
      } catch (e) {
        alert('No se pudo generar el horario: ' + e.message);
      }
      ui.generating = false;
      render();
    }, 30);
  },
  csv() { downloadCsv(); },
  tab(el) { ui.tabs[el.dataset.k] = el.dataset.v; render(); },
  page(el) { ui.pages[el.dataset.k] = Number(el.dataset.v); render(); },
  modal(el) { ui.modal = { v: el.dataset.v, k: el.dataset.k }; render(); },
  closeModal() { closeModal(); },
  dayToggle(el) {
    const j = S.jornadas[career(route().arg).jornada];
    mutate(() => {
      const set = new Set(j.dias[el.dataset.lv]);
      if (set.has(el.dataset.v)) set.delete(el.dataset.v); else set.add(el.dataset.v);
      j.dias[el.dataset.lv] = DAYS.filter((d) => set.has(d));
    });
  },
  satOwn() {
    const j = S.jornadas[career(route().arg).jornada];
    mutate(() => { j.bloques.Sa = j.bloques.default.map((b) => ({ ...b, turno: turnoOf(b.inicio, b.id) })); });
  },
  satSame() { const j = S.jornadas[career(route().arg).jornada]; mutate(() => { delete j.bloques.Sa; }); },
  mode(el) { ui.mode = el.dataset.v; ui.sel = null; render(); },
  week(el) { ui.week += Number(el.dataset.v); render(); },
  goWeek(el) { ui.week = Number(el.dataset.v); render(); },
  print() { window.print(); },
  go(el) { location.hash = el.dataset.v; },
  filter(el) { ui.filter = ui.filter === el.dataset.v ? 'all' : el.dataset.v; render(); },
  docFilter(el) { ui.docFilter = ui.docFilter === el.dataset.v ? 'all' : el.dataset.v; render(); },
  viewsec(el) { ui.mode = 'seccion'; ui.sel = el.dataset.v; },
  malla(el) { ui.malla = ui.malla === el.dataset.v ? null : el.dataset.v; render(); },
  step(el) { const { arg } = route(); ui.steps[arg] = Math.min(5, Math.max(1, Number(el.dataset.v))); ui.rows = null; render(); },
  secs(el) {
    const { arg } = route();
    mutate(() => {
      const of = ofertaOf(arg, el.dataset.sem);
      of.secciones = Math.max(0, Math.min(8, (of.secciones || 0) + Number(el.dataset.v)));
      S.oferta[arg][el.dataset.sem] = of;
    });
  },
  suggest(el) {
    const { arg } = route();
    if (el.dataset.v === 'all' && !confirm('¿Rehacer la sugerencia de docentes de esta carrera? Se reemplazan las asignaciones actuales.')) return;
    mutate(() => { S.asignaciones = suggestAssignments(S, { careerCode: arg, overwrite: el.dataset.v === 'all' }).asignaciones; });
  },
  addDoc() {
    const id = 'd' + Date.now().toString(36);
    mutate(() => S.docentes.push({ id, nombre: 'Nuevo docente', especialidad: '', materias: [], disponibilidad: ALL_SLOTS.slice(), tope: null, otraCarga: 0 }));
    ui.editDoc = id;
    ui.modal = { v: 'doc' };
    render();
  },
  editDoc(el) {
    ui.editDoc = el.dataset.v || null;
    ui.modal = ui.editDoc ? { v: 'doc' } : null;
    render();
  },
  delDoc() {
    const d = S.docentes.find((x) => x.id === ui.editDoc);
    if (!d || !confirm(`¿Eliminar a ${d.nombre}? Sus asignaturas quedarán sin docente.`)) return;
    mutate(() => {
      S.docentes = S.docentes.filter((x) => x.id !== d.id);
      for (const k of Object.keys(S.asignaciones)) if (S.asignaciones[k] === d.id) delete S.asignaciones[k];
    });
    ui.editDoc = null;
    ui.modal = null;
    render();
  },
  addMat() {
    const input = document.getElementById('newMat');
    const v = input.value.trim();
    if (!v) return;
    mutate(() => { const d = S.docentes.find((x) => x.id === ui.editDoc); if (!d.materias.includes(v)) d.materias.push(v); });
  },
  rmMat(el) { mutate(() => { const d = S.docentes.find((x) => x.id === ui.editDoc); d.materias.splice(Number(el.dataset.v), 1); }); },
  addSala() { const id = 's' + Date.now().toString(36); ui.editSala = id; ui.pages.salas = 9999; mutate(() => S.salas.push({ id, nombre: `Sala ${S.salas.length + 1}`, capacidad: 30, tipo: 'Sala' })); },
  editSala(el) { ui.editSala = el.dataset.v || null; render(); const f = app.querySelector('.room.editing input'); if (f) f.focus(); },
  delSala(el) { const r = S.salas[Number(el.dataset.v)]; if (confirm(`¿Eliminar ${r.nombre}?`)) { ui.editSala = null; mutate(() => S.salas.splice(Number(el.dataset.v), 1)); } },
  backup() {
    const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
    download(blob, `planificador-respaldo-${new Date().toISOString().slice(0, 10)}.json`);
  },
  async reset(el) {
    const demo = el.dataset.v === '1';
    if (!confirm(demo ? '¿Reemplazar todo por los datos de ejemplo?' : '¿Borrar docentes, salas, matrícula y horario? Las mallas se mantienen. Descarga un respaldo antes si lo necesitas.')) return;
    const r = await fetch(`/api/reset?demo=${demo ? 1 : 0}`, { method: 'POST' });
    S = await r.json();
    ui.saveMsg = 'Datos reiniciados';
    location.hash = '#/horario';
    render();
  }
};

const changes = {
  periodo(el) {
    const [anio, paridad] = el.value.split('|');
    mutate(() => { S.periodo = { anio: Number(anio), paridad, nombre: periodName(Number(anio), paridad) }; S.horario = null; }, { stale: false });
  },
  sel(el) { ui.sel = el.value; render(); },
  estudiantes(el) {
    mutate(() => {
      const of = ofertaOf(el.dataset.code, el.dataset.sem);
      of.estudiantes = Math.max(0, Number(el.value) || 0);
      of.secciones = of.estudiantes ? Math.ceil(of.estudiantes / S.reglas.cupo) : 0;
      S.oferta[el.dataset.code][el.dataset.sem] = of;
    });
  },
  practicaEst(el) {
    mutate(() => { const pr = practicaOf(el.dataset.code); pr.estudiantes = Math.max(0, Number(el.value) || 0); S.oferta[el.dataset.code].practica = pr; }, { stale: false });
  },
  practicaHoras(el) { mutate(() => { career(el.dataset.code).practica.horas = Math.max(0, Number(el.value) || 0); }, { stale: false }); },
  supervisor(el) {
    mutate(() => { const pr = practicaOf(el.dataset.code); pr.supervisorId = el.value; S.oferta[el.dataset.code].practica = pr; }, { stale: false });
  },
  blockTime(el) {
    if (!/^\d{2}:\d{2}$/.test(el.value)) return render();
    const j = S.jornadas[career(route().arg).jornada];
    mutate(() => {
      const b = j.bloques[el.dataset.k][Number(el.dataset.i)];
      b[el.dataset.f] = el.value;
      b.turno = turnoOf(b.inicio, b.id);
    });
  },
  confirmado(el) { mutate(() => { S.jornadas[career(route().arg).jornada].confirmado = el.checked; }, { stale: false }); },
  asignar(el) { mutate(() => { if (el.value) S.asignaciones[el.dataset.cod] = el.value; else delete S.asignaciones[el.dataset.cod]; }); },
  cupo(el) { mutate(() => { S.reglas.cupo = Math.max(5, Number(el.value) || 30); }); },
  tope(el) { mutate(() => { S.reglas.tope = Math.max(1, Math.min(12, Number(el.value) || 12)); }); },
  docField(el) {
    mutate(() => {
      const d = S.docentes.find((x) => x.id === ui.editDoc);
      const f = el.dataset.f;
      if (f === 'tope') d.tope = el.value === '' ? null : Math.max(1, Math.min(12, Number(el.value)));
      else if (f === 'otraCarga') d.otraCarga = Math.max(0, Number(el.value) || 0);
      else d[f] = el.value;
    });
  },
  avail(el) {
    mutate(() => {
      const d = S.docentes.find((x) => x.id === ui.editDoc);
      const set = new Set(Array.isArray(d.disponibilidad) ? d.disponibilidad : ALL_SLOTS);
      if (el.checked) set.add(el.dataset.v); else set.delete(el.dataset.v);
      d.disponibilidad = ALL_SLOTS.filter((s) => set.has(s));
    });
  },
  // Edición de sala: guarda sin redibujar, para no perder el clic en «Listo» al salir del campo.
  sala(el) {
    const r = S.salas[Number(el.dataset.i)];
    r[el.dataset.f] = el.dataset.f === 'capacidad' ? Math.max(1, Number(el.value) || 1) : el.value;
    if (S.horario) S.horario.desactualizado = true;
    save();
  },
  async restore(el) {
    const file = el.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.carreras) || !data.periodo) throw new Error('El archivo no parece un respaldo del planificador.');
      if (!confirm('¿Reemplazar todos los datos por los del respaldo?')) return;
      S = data;
      save();
      location.hash = '#/horario';
      render();
    } catch (e) { alert('No se pudo cargar: ' + e.message); }
  }
};

function bind() {
  app.querySelectorAll('[data-act]').forEach((el) => el.addEventListener('click', (ev) => {
    const fn = actions[el.dataset.act];
    if (!fn) return;
    if (el.tagName !== 'A') ev.preventDefault();
    fn(el, ev);
  }));
  // Filas que actúan como botón (lista de salas): también con Enter o espacio.
  app.querySelectorAll('[role="button"][data-act]').forEach((el) => el.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); actions[el.dataset.act]?.(el, ev); }
  }));
  app.querySelectorAll('[data-change]').forEach((el) => el.addEventListener('change', () => changes[el.dataset.change]?.(el)));
  app.querySelectorAll('[data-input]').forEach((el) => el.addEventListener('input', () => {
    ui[el.dataset.input] = el.value;
    const pos = el.selectionStart;
    render();
    const again = app.querySelector(`[data-input="${el.dataset.input}"]`);
    if (again) { again.focus(); again.setSelectionRange(pos, pos); }
  }));
  const back = app.querySelector('.modal-back');
  if (back) back.addEventListener('mousedown', (e) => { if (e.target === back) closeModal(); });
  const nm = document.getElementById('newMat');
  if (nm) nm.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); actions.addMat(); } });
}

// ---------- Exportar ----------
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

function downloadCsv() {
  const H = S.horario;
  const secById = Object.fromEntries(H.secciones.map((s) => [s.id, s]));
  const rows = [['Carrera', 'Semestre', 'Sección', 'Asignatura', 'Docente', 'Sala', 'Día', 'Inicio', 'Fin', 'Semana desde', 'Semana hasta']];
  for (const x of H.sesiones) {
    const s = secById[x.seccionId];
    rows.push([s.carreraNombre, roman(s.sem), s.letra, x.nombre, docName(x.docenteId), salaName(x.salaId), DAY_NAMES[x.dia], x.inicio, x.fin, x.desde, x.hasta]);
  }
  const csv = '﻿' + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `horario-${S.periodo.nombre.replace(/\s+/g, '-').toLowerCase()}.csv`);
}

load().catch((e) => { app.innerHTML = `<main><div class="note bad">No se pudo conectar con el servidor del planificador (${esc(e.message)}). ¿Está corriendo «npm start»?</div></main>`; });
