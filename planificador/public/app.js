// Interfaz del planificador. Vistas: Horario, Carreras (con asistente de 5 pasos), Docentes, Salas, Configuración.
import { solve } from '/src/core/solver.js';
import { suggestAssignments, qualifiedTeachers, canTeach, teacherNeeds, availableForLevel, estimatedLoad, neededSubjects, capacidadHoras, leCabe } from '/src/core/assign.js';
import { activeSemesters, openSemesters, DAYS, DAY_NAMES, DAYS_PER_LEVEL, TURNOS, roman, cohortDays, blocksFor, toMinutes, levelOf, isSaturdayOk, saturdayIssue, SATURDAY_LAST_START, SATURDAY_DEFAULT_BLOCKS } from '/src/core/calendar.js';
import { candidatePlans, moduleWeeks } from '/src/core/modules.js';
import { ALL_SLOTS, periodName, migrateState } from '/src/core/initial.js';
import { buildManual, manualFromSolved, previewWeeks, slotAllowed } from '/src/core/manual.js';
import { suggest } from '/src/core/suggest.js';
import { calendarOf, calendarKey, defaultCalendar, weekMonday, addDays, fmtFecha, sinClases, dayCode } from '/src/core/fechas.js';

// Sesión vencida: el servidor responde 401 y se vuelve a la página de ingreso.
const fetchOriginal = window.fetch.bind(window);
window.fetch = async (...args) => {
  const r = await fetchOriginal(...args);
  if (r.status === 401) { location.href = '/login'; throw new Error('Sesión expirada'); }
  return r;
};

let S = null; // estado persistido
const ui = { sugg: null, hmode: 'salas', hc: '', hy: 1, hs: 1, hl: 'A', steps: {}, mode: 'seccion', sel: null, week: 1, editDoc: null, docQuery: '', malla: null, generating: false, saveMsg: '', tabs: {}, pages: {}, rows: null, modal: null };
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
// Avatares divertidos: animal y color de fondo; el docente puede cambiarlo cuando quiera.
const FUN = [['🦉', '#E8EEF8'], ['🦊', '#FCE9DD'], ['🐼', '#EEF1F5'], ['🐨', '#E6EEF2'], ['🦁', '#FBF0D6'], ['🐯', '#FDE8D7'], ['🐸', '#E3F4EA'], ['🐧', '#E5EDFA'],
  ['🐙', '#FBE4EE'], ['🦄', '#EFE8FB'], ['🐝', '#FBF3D3'], ['🐢', '#E4F2E6'], ['🐬', '#E1F0F8'], ['🦜', '#E6F5EC'], ['🐻', '#F3EAE2'], ['🐱', '#FBEEDF']];
const avatarOf = (d, cls = '') => (d?.fun != null && FUN[d.fun] ? `<span class="avatar fun ${cls}" style="background:${FUN[d.fun][1]}" aria-hidden="true">${FUN[d.fun][0]}</span>` : avatar(d?.nombre, cls, d?.foto));
const avatar = (name, cls = '', foto = '') => `<span class="avatar ${cls}" aria-hidden="true">${foto ? `<img src="${esc(foto)}" alt="">` : esc(initials(name))}</span>`;

// Iconos de trazo (24×24).
const ICONS = {
  calendar: '<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4M7.5 13.5h3M13.5 13.5h3M7.5 17h3"/>',
  cap: '<path d="M2.5 9 12 4.5 21.5 9 12 13.5z"/><path d="M6.5 11v5c0 1.4 2.5 3 5.5 3s5.5-1.6 5.5-3v-5M21.5 9v5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5"/><path d="M16 4.8a3.3 3.3 0 0 1 0 6.4M18 14.8c2 .6 3.2 2.4 3.5 5.2"/>',
  grid: '<rect x="3" y="3.5" width="18" height="17" rx="2"/><path d="M3 9h18M3 14.5h18M9 3.5v17M15 3.5v17"/>',
  door: '<path d="M5 21V4.5A1.5 1.5 0 0 1 6.5 3h9A1.5 1.5 0 0 1 17 4.5V21M3 21h18"/><circle cx="13.5" cy="12" r=".9" fill="currentColor"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
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
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  camera: '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="12.5" r="3.2"/>'
};
const icon = (name, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
const docName = (id) => S.docentes.find((d) => d.id === id)?.nombre || 'Sin docente';
const salaName = (id) => S.salas.find((r) => r.id === id)?.nombre || 'Sin sala';
const career = (code) => S.carreras.find((c) => c.codigo === code);
// Color fijo de cada carrera (el mismo en Carreras y en Ocupación).
const careerColor = (code) => { const i = S.carreras.findIndex((c) => c.codigo === code); return i < 0 ? 'var(--navy-500)' : SERIES[i % SERIES.length]; };
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
  ui.sugg = null;
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
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && ui.pick && !ui.modal) { ui.pick = null; render(); return; }
  if (e.key !== 'Escape' || !ui.modal) return;
  if (ui.pickAv) { ui.pickAv = false; render(); } else closeModal();
});

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
function pageNo(key, total, n = rowsPer()) {
  const pages = Math.max(1, Math.ceil(total / n));
  ui.pages[key] = Math.min(Math.max(1, ui.pages[key] || 1), pages);
  return ui.pages[key];
}
function page(key, list, n = rowsPer()) {
  const p = pageNo(key, list.length, n);
  return list.slice((p - 1) * n, p * n);
}
function pagerHtml(key, total, n = rowsPer()) {
  if (total <= n) return '';
  const p = pageNo(key, total, n);
  const pages = Math.ceil(total / n);
  return `<div class="pager"><span class="faint small">${(p - 1) * n + 1}–${Math.min(total, p * n)} de ${total}</span>
    <button class="sq" data-act="page" data-k="${key}" data-v="${p - 1}" ${p === 1 ? 'disabled' : ''} aria-label="Página anterior">‹</button>
    <span class="small">${p} / ${pages}</span>
    <button class="sq" data-act="page" data-k="${key}" data-v="${p + 1}" ${p === pages ? 'disabled' : ''} aria-label="Página siguiente">›</button></div>`;
}
function closeModal() {
  ui.modal = null;
  ui.pickAv = false;
  ui.editDoc = null;
  render();
}
function modalHtml() {
  const m = ui.modal;
  if (!m) return '';
  let title = '';
  let body = '';
  let wide = false;
  let cls = '';
  let headHtml = '';
  let foot = '';
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
    body = `<p class="faint small">${sec.semanas} semanas · ${esc(salaName(sec.salaId))} · ${(sec.diasUso?.length ? sec.diasUso : sec.dias).map((d) => DAY_NAMES[d]).join(', ')}${sec.diasUso?.length ? '' : ' (preferidos)'}</p><div class="tablewrap">${gantt(sec.plan, sec.semanas, (it) => docName(it.docenteId), route().view === 'horario' ? ui.week : null)}</div>`;
  } else if (m.v === 'doc') {
    const d = S.docentes.find((x) => x.id === ui.editDoc);
    if (!d) { ui.modal = null; return ''; }
    const h = estimatedLoad(S, S.asignaciones)[d.id] || 0;
    title = d.nombre || 'Nuevo docente';
    cls = 'doc';
    headHtml = `<div class="who"><div class="av-wrap"><button class="avatar-up" data-act="pickAv" aria-expanded="${!!ui.pickAv}" title="Cambiar avatar">${avatarOf(d, 'lg')}<span class="cam">${icon('camera')}</span><span class="sr">Cambiar avatar</span></button>
      ${ui.pickAv ? `<div class="av-pick" role="dialog" aria-label="Elegir avatar"><div class="av-grid">${FUN.map(([e, bg], i) => `<button data-act="setFun" data-v="${i}" style="background:${bg}" aria-pressed="${d.fun === i}" aria-label="Avatar ${i + 1}">${e}</button>`).join('')}</div>
        <div class="av-opts"><label class="btn sm">${icon('upload')}Subir foto<input type="file" accept="image/*" class="sr" data-change="foto"></label><button class="btnq sm" data-act="rmFoto">Usar iniciales</button></div></div>` : ''}</div>
      <div><h2>${esc(title)}</h2><span class="faint small">${esc(d.especialidad || 'Sin especialidad')} · ${h ? `${h} h en el periodo` : 'sin carga en el periodo'}</span></div></div>`;
    body = docForm(d);
    foot = '<button class="btnq danger-q" data-act="delDoc">Eliminar docente</button><button class="btnp" data-act="closeModal">Listo</button>';
  } else if (m.v === 'sala') {
    const i = S.salas.findIndex((x) => x.id === m.k);
    const rm = S.salas[i];
    if (!rm) { ui.modal = null; return ''; }
    const grupos = [...(usoSalas()[rm.id]?.keys() || [])];
    title = rm.nombre || 'Sala';
    body = `<div class="sala-form">
      <label class="field">Nombre<input type="text" value="${esc(rm.nombre)}" data-change="sala" data-i="${i}" data-f="nombre"></label>
      <label class="field">Capacidad (puestos)<input type="number" min="1" value="${rm.capacidad}" data-change="sala" data-i="${i}" data-f="capacidad"></label>
      <label class="field">Tipo<select data-change="sala" data-i="${i}" data-f="tipo">${['Sala', 'Laboratorio', 'Taller'].map((t) => `<option ${(rm.tipo || 'Sala') === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <p class="faint small">${grupos.length ? `La usan: ${grupos.join(', ')}.` : 'Libre en este periodo.'}</p></div>`;
    foot = `<button class="btnq danger-q" data-act="delSala" data-v="${i}">Eliminar sala</button><button class="btnp" data-act="closeModal">Listo</button>`;
  } else if (m.v === 'wizard' && career(m.k)) {
    const w = wizardParts(m.k, true);
    title = 'Planificar ' + w.c.nombre;
    wide = true;
    cls = 'wiz-modal';
    headHtml = `<div><span class="kicker">${w.c.codigo} · ${esc(w.c.jornada)} · ${esc(S.periodo.nombre)}</span><h2>${esc(w.c.nombre)}</h2></div>`;
    body = `<nav aria-label="Pasos">${w.stepper}</nav><div class="wiz-body">${w.body}</div>`;
    foot = `<div class="wiz-foot">${w.foot}</div>`;
  } else { ui.modal = null; return ''; }
  return `<div class="modal-back"><div class="modal ${wide ? 'wide' : ''} ${cls}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-head">${headHtml || `<h2>${esc(title)}</h2>`}<button class="sq" data-act="closeModal" aria-label="Cerrar">×</button></div>
    <div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}</div></div>`;
}
// Si la página no cabe, reduce las filas por página y vuelve a dibujar (solo escritorio).
function fitScreen() {
  const main = app.querySelector('main');
  const tb = main?.querySelector('table[data-pager] tbody, ul[data-pagerlist]');
  if (!desktop() || !main || !tb || !tb.children.length) return false;
  const over = main.scrollHeight - main.clientHeight;
  const rowH = tb.children[0].getBoundingClientRect().height + (tb.tagName === 'UL' ? 8 : 0) || 48;
  const shown = tb.children.length;
  if (over > 0 && shown > 2) { ui.rows = Math.max(2, shown - Math.ceil(over / rowH)); return true; }
  if (!ui.rows) ui.rows = Math.max(3, shown + Math.floor(-over / rowH));
  return false;
}

// Aplica sugerencias aceptadas. Las que quedan siguen propuestas (son compatibles entre sí).
function applySugg(list) {
  for (const it of list) {
    const m = (S.manual[it.secId] = S.manual[it.secId] || {});
    const o = Number.isFinite(it.desde) ? it.desde : Math.max(0, ...Object.values(m).map((x) => x.o || 0)) + 1;
    m[it.codigo] = { slots: it.slots.map((x) => ({ d: x.d, inicio: x.inicio, fin: x.fin })), o, salaId: it.salaId, desde: it.desde };
  }
  const aceptados = new Set(list);
  if (ui.sugg) ui.sugg = { items: ui.sugg.items.filter((x) => !aceptados.has(x)), unplaced: ui.sugg.unplaced };
  if (ui.sugg && !ui.sugg.items.length) ui.sugg = null;
  save();
  render();
}

// El horario se arma en vivo desde las clases asignadas: cada cambio se ve al instante.
function syncHorario() {
  if (!S.manual) S.manual = {};
  try { S.horario = buildManual(S); ui.planError = ''; } catch (e) { S.horario = null; ui.planError = e.message; }
}

function render() {
  if (!S) return;
  syncHorario();
  buildColors();
  const { view, arg } = route();
  const body = rebuild(view, arg);
  const navView = view === 'carreras' ? 'carreras' : view;
  // Ancho de lectura según la página: las listas no se estiran a todo el monitor.
  const width = view === 'carreras' && arg ? 'medium' : ['respaldo', 'docentes'].includes(view) ? 'narrow' : 'wide';
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
  if (view === 'configuracion') return viewConfig();
  if (view === 'ocupacion') return viewOcupacion();
  return viewHorario();
}

function sidebar(active) {
  const isHome = !['carreras', 'docentes', 'salas', 'configuracion', 'ocupacion'].includes(active);
  const link = (v, label, ic) => `<a href="#/${v}" ${active === v || (v === 'horario' && isHome) ? 'aria-current="page"' : ''}>${icon(ic)}${label}</a>`;
  const top = `<header class="topbar">
    <a class="brand" href="#/horario" aria-label="Planificador CFT Juan Bohon, inicio"><span class="logo"><img src="/public/logo.png" alt="CFT Juan Bohon"></span><b class="brand-name">Planificador</b></a>
    <div class="top-right">
      <span id="savemsg" aria-live="polite">${esc(ui.saveMsg)}</span>
      ${S.datosDeEjemplo ? `<a class="demo-tag" href="#/configuracion" title="Docentes, salas y matrícula son ficticios. Las mallas son las oficiales.">Ejemplo</a>` : ''}
      <select data-change="periodo" aria-label="Periodo">
        ${[2026, 2027, 2028].flatMap((y) => ['impar', 'par'].map((p) => `<option value="${y}|${p}" ${S.periodo.anio === y && S.periodo.paridad === p ? 'selected' : ''}>${periodName(y, p)}</option>`)).join('')}
      </select>
    </div></header>`;
  return top + `<nav class="side-nav" aria-label="Menú principal">
    ${link('horario', 'Horario', 'calendar')}${link('ocupacion', 'Ocupación de salas', 'grid')}${link('carreras', 'Carreras', 'cap')}${link('docentes', 'Docentes', 'person')}${link('salas', 'Salas', 'door')}
    <span class="side-sep"></span>${link('configuracion', 'Configuración', 'settings')}<a class="side-out" href="/logout">${icon('back')}<span>Salir</span></a>
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
    ['Oferta de secciones', offered.length ? `${offered.length} de ${S.carreras.length} carreras abren secciones` : 'Ninguna carrera tiene secciones', offered.length ? 'ok' : 'bad', '#/carreras'],
    ['Asignaturas y horas', `${S.carreras.length} mallas cargadas · ${S.carreras.reduce((t, c) => t + c.semestres.reduce((u, s) => u + s.asignaturas.length, 0), 0)} asignaturas`, 'ok', '#/carreras'],
    ['Docentes', missing.length ? `${missing.length} asignaturas sin docente` : `${S.docentes.length} docentes · todas las asignaturas cubiertas`, missing.length ? 'warn' : 'ok', '#/docentes'],
    ['Salas', S.salas.length ? `${S.salas.length} salas registradas` : 'No hay salas', S.salas.length ? 'ok' : 'bad', '#/salas']
  ];
}

function viewHorario() {
  const H = S.horario;
  const open = [...new Set(S.carreras.flatMap((c) => openSemesters(S, c.codigo)))].sort();
  const enPractica = S.carreras.reduce((t, c) => t + (S.oferta?.[c.codigo]?.practica?.estudiantes || 0), 0);
  const semTxt = open.length ? `semestres ${open.map(roman).join(', ').replace(/, ([^,]*)$/, ' y $1')}` : 'sin secciones abiertas';
  const body = courseViewer(H);
  const head = `<div class="pagehead">
      <div><h1>Horario</h1><p class="muted">${ui.hsub || `${esc(S.periodo.nombre)} · ${semTxt}${enPractica ? ` · ${enPractica} en práctica` : ''}`}</p></div>
      <div class="row">
        ${H ? `<button class="btnq" data-act="print" title="Imprimir la semana de la sección elegida">${icon('printer')}<span class="sr">Imprimir</span></button><button class="btnq" data-act="csv" title="Descargar todas las clases del periodo (se abre en Excel)">${icon('download')}<span class="sr">Excel</span></button>` : ''}
        <a class="btnq" href="#/ocupacion">${icon('grid')}Ocupación de salas</a>
        <button class="btnp" data-act="modal" data-v="wizard" data-k="${ui.hc}" ${ui.hc ? '' : 'disabled title="Elige una carrera"'}>${icon('sparkle')}Planificar carrera</button>
      </div></div>`;
  if (!H) return head + notice(`err-${ui.planError}`, 'alert', 'No se puede armar el horario', `${esc(ui.planError)} <a href="#/configuracion">Ir a Configuración</a>`) + body;
  if (!H.resumen.asignadas) {
    const missing = needsChecklist().find(([, , k]) => k !== 'ok');
    return head + notice(`empty-${S.periodo.nombre}-${missing?.[1] || ''}`, 'info', 'Aún no hay clases asignadas',
      `Elige una carrera y usa <b>Planificar carrera</b>; sus clases se suman a Ocupación de salas.${missing ? ` Falta: <a href="${missing[3]}">${esc(missing[1])}</a>.` : ''}`) + body;
  }
  return head + body;
}

// ---------- Vista: Ocupación de salas ----------
// Matriz de salas por día y hora, con la sugerencia automática y la asignación sala por sala.
function viewOcupacion() {
  const H = S.horario;
  const head = `<div class="pagehead">
      <div><h1>Ocupación de salas</h1><p class="muted">${esc(S.periodo.nombre)} · una columna por sala; debajo del nombre, la carrera que la usa${H?.avisos?.length ? ` · <span class="bad-t" title="${esc(H.avisos.map((x) => x.mensaje).join(" "))}">${H.avisos.length} ${H.avisos.length === 1 ? "curso termina" : "cursos terminan"} después del cierre</span>` : ""}</p></div></div>`;
  if (!H) return head + notice(`err-${ui.planError}`, 'alert', 'No se puede armar el horario', `${esc(ui.planError)} <a href="#/configuracion">Ir a Configuración</a>`);
  return head + matrixViewer(H);
}

// Aviso flotante que se puede cerrar. Vuelve a aparecer si cambia su contenido (otra clave).
function notice(key, ic, title, text) {
  if (ui.notesOff?.[key]) return '';
  return `<div class="toast" role="status"><span class="toast-i">${icon(ic)}</span>
    <div class="toast-b"><b>${title}</b><span>${text}</span></div>
    <button class="toast-x" data-act="closeNotice" data-v="${esc(key)}" aria-label="Cerrar aviso">×</button></div>`;
}

function courseViewer(H) {
  const c = ui.hc ? career(ui.hc) : null;
  if (!c) ui.hc = '';
  const activos = activeSemesters(S.periodo.paridad);
  // Cada año tiene 2 semestres (1º año: I y II; 2º año: III y IV). En un periodo se dictan solo los impares o los pares.
  if (![1, 2, 3, 4].includes(ui.hs)) ui.hs = activos[0];
  ui.hy = ui.hs <= 2 ? 1 : 2;
  const yrSems = ui.hy === 1 ? [1, 2] : [3, 4];
  const sem = ui.hs;
  const fueraPeriodo = !activos.includes(sem);
  const secs = H && c ? H.secciones.filter((x) => x.carrera === c.codigo && x.sem === sem) : [];
  if (!secs.some((x) => x.letra === ui.hl)) ui.hl = secs[0]?.letra || 'A';
  const sec = secs.find((x) => x.letra === ui.hl) || null;
  ui.curSec = sec?.id || null;
  if (ui.pick && (ui.pick.roomMode || ui.pick.secId !== ui.curSec)) ui.pick = null;
  const maxW = H?.semanasMax || 22;
  ui.week = Math.min(Math.max(1, ui.week), maxW);
  const ses = sec ? H.sesiones.filter((x) => x.seccionId === sec.id && x.desde <= ui.week && x.hasta >= ui.week) : [];
  const seg = (act, items, cur) => `<div class="seg sm" role="group">${items.map(([v, l]) => `<button data-act="${act}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${l}</button>`).join('')}</div>`;
  const filters = `<div class="hfilters">
      <label class="hf"><span>Carrera</span><select data-change="hc" aria-label="Carrera"><option value="">Elige una carrera</option>${S.carreras.map((x) => `<option value="${x.codigo}" ${x.codigo === ui.hc ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select></label>
      <div class="hf"><span>Año</span>${seg('hy', [[1, '1º año'], [2, '2º año']], ui.hy)}</div>
      <div class="hf" title="En ${esc(S.periodo.nombre)} se dictan los semestres ${activos.map(roman).join(' y ')}"><span>Semestre</span>${seg('hs', yrSems.map((n) => [n, roman(n)]), sem)}</div>
      ${secs.length > 1 ? `<div class="hf"><span>Sección</span>${seg('hl', secs.map((x) => [x.letra, x.letra]), ui.hl)}</div>` : ''}
      <div class="hf hf-end">${H ? weekNav(maxW) : ''}</div>
    </div>`;
  ui.hsub = c ? `${esc(S.periodo.nombre)} · ` : '';
  const total = sec ? sec.plan.length + sec.pendientes.length : 0;
  const sub = !c ? 'Elige una carrera y un semestre para ver su horario.'
    : !H ? `${esc(c.nombre)} · semestre ${roman(sem)}`
    : fueraPeriodo ? `${esc(c.nombre)} · el semestre ${roman(sem)} no se dicta en ${esc(S.periodo.nombre)}. Para verlo, cambia el periodo arriba (${sem % 2 ? 'otoño' : 'primavera'}).`
    : !sec ? `${esc(c.nombre)} · el semestre ${roman(sem)} no tiene secciones en ${esc(S.periodo.nombre)}.`
    : `${secLabel(sec)} · ${sec.estudiantes} estudiantes · <b>${sec.plan.length} de ${total}</b> asignaturas asignadas${sec.fechaFin ? ` · <span class="${sec.pasaCierre ? "bad-t" : ""}" title="${sec.pasaCierre ? "Pasa del cierre del periodo (Configuración → Calendario)" : ""}">termina el ${fmtFecha(sec.fechaFin)}${sec.pasaCierre ? " (después del cierre)" : ""}</span>` : ""} · <button class="linkbtn" data-act="modal" data-v="plan" data-k="${sec.id}">Plan del semestre</button>`;
  if (c) ui.hsub += sub;
  // Al imprimir, en vez de los selectores va un título con carrera, semestre, sección y semana.
  const printHead = c && sec ? `<p class="print-only print-head"><b>${esc(c.nombre)}</b> · Semestre ${roman(sem)} · Sección ${sec.letra} · ${esc(S.periodo.nombre)} · Semana ${ui.week} (${esc(weekRange(ui.week))})</p>` : '';
  return `<section class="viewer" aria-label="Horario semanal">${printHead}${filters}
    ${c ? '' : `<p class="muted small">${sub}</p>`}
    <div class="plan-wrap"><div class="tablewrap week-scroll">${courseGrid(c, sem, ses, sec)}</div>${H && ui.pick && sec ? pickPanel(H, sec, ui.pick) : ""}</div>
    ${sec ? agenda(ses, H) : ''}
  </section>`;
}

// Grilla de un semestre: columnas lunes a sábado; una fila por cada hora de inicio de los bloques.
// Sin carrera elegida se dibuja en blanco con los bloques de la jornada más usada.
// Con una sección elegida, cualquier bloque libre tiene «+» para asignar una clase (el sábado, solo en la mañana).
function courseGrid(c, sem, ses, sec) {
  let jn = c?.jornada;
  if (!jn) {
    const count = {};
    for (const x of S.carreras) count[x.jornada] = (count[x.jornada] || 0) + 1;
    jn = Object.keys(S.jornadas).sort((p, q) => (count[q] || 0) - (count[p] || 0))[0];
  }
  let days = [];
  try { days = cohortDays(S.jornadas, jn, sem); } catch { days = []; }
  // Cada fila es una hora de inicio; si todos sus bloques terminan a la misma hora, también se muestra el término
  const ends = {};
  const add = (i, f) => (ends[i] = ends[i] || new Set()).add(f);
  ses.forEach((x) => add(x.inicio, x.fin));
  // Filas: los horarios de la jornada en todos sus semestres, para poder poner una clase a cualquier hora de la jornada
  for (const n of [1, 2, 3, 4]) {
    let ds = [];
    try { ds = cohortDays(S.jornadas, jn, n); } catch { ds = []; }
    for (const d of ds) blocksFor(S.jornadas, jn, d, n).forEach((bl) => add(bl.inicio, bl.fin));
  }
  for (const sl of ui.pick?.slots || []) add(sl.inicio, sl.fin);
  const rows = Object.keys(ends).sort((p, q) => toMinutes(p) - toMinutes(q));
  const pick = ui.pick;
  const inPick = (d, t) => pick?.slots?.some((x) => x.d === d && x.inicio === t);
  let html = `<div class="week course" style="grid-template-columns:52px repeat(6,minmax(0,1fr));grid-template-rows:auto repeat(${rows.length},minmax(68px,max-content))"><div></div>${DAYS.map((d) => { const iso = dateOfDay(d); const off = sinClases(calendarOf(S), iso); return `<div class="dh${off ? ' dh-off' : ''}" title="${off ? esc(off) + ': sin clases' : ''}">${DAY_NAMES[d]} <span class="dh-date">${fmtFecha(iso)}</span>${off ? `<small class="dh-fer">${esc(off)}</small>` : ''}</div>`; }).join('')}`;
  for (const t of rows) {
    const fin = [...ends[t]][0];
    html += `<div class="th2"><b>${t}</b>${ends[t].size === 1 ? `<span>${fin}</span>` : ''}</div>`;
    for (const d of DAYS) {
      const x = ses.find((y) => y.dia === d && y.inicio === t);
      if (!x) {
        html += `<div class="cell empty${sec && slotAllowed(d, t) ? ' free' : ''}"></div>`;
        continue;
      }
      const on = pick && pick.codigo === x.codigo;
      const warn = x.choque ? 'Choque de horario, sala o docente' : x.noDisp ? 'El docente no está disponible a esta hora' : '';
      html += `<div class="cell ${x.choque ? 'clash' : ''} ${on ? 'on' : ''}" style="${cvar(x.codigo)}" title="${esc(x.nombre)} · ${x.inicio}–${x.fin} · semanas ${x.desde}–${x.hasta}${warn ? ' · ' + warn : ''}">
        <span class="s">${esc(x.nombre)}</span>
        <span class="m">${esc(salaName(x.salaId))} · ${esc(docName(x.docenteId))}</span>
        ${ends[t].size > 1 ? `<span class="m">${x.inicio}–${x.fin}</span>` : ''}
        ${warn ? `<span class="cell-warn">${icon('alert')}${x.choque ? 'Choque' : 'No disponible'}</span>` : ''}</div>`;
    }
  }
  return html + '</div>';
}

// Asignaturas de la sección (de su malla), con las semanas que dura cada una.
function secSubjects(sec) {
  return career(sec.carrera)?.semestres?.[sec.sem - 1]?.asignaturas || [];
}

// Horarios de clase de cada día que usan las secciones del periodo (para el panel de salas).
function roomSlots(H) {
  const by = {};
  for (const sec of H.secciones) {
    for (const d of sec.dias) {
      for (const bl of blocksFor(S.jornadas, sec.jornada, d, sec.sem)) {
        const list = (by[d] = by[d] || []);
        if (!list.some((x) => x.inicio === bl.inicio)) list.push({ inicio: bl.inicio, fin: bl.fin, s: toMinutes(bl.inicio), e: toMinutes(bl.fin) });
      }
    }
  }
  for (const d of Object.keys(by)) by[d].sort((p, q) => p.s - q.s);
  return by;
}

// Datos de la sección como los usa el núcleo (asignaturas, días y bloques configurados).
function secCore(sec) {
  return { id: sec.id, g: { subjects: secSubjects(sec), days: sec.dias, blocks: sec.dias.map((d) => blocksFor(S.jornadas, sec.jornada, d, sec.sem)) } };
}

// Clase candidata (sección, asignatura, bloques elegidos): semanas que dura y qué otras clases caen a la misma hora.
function candidate(H, sec, codigo, slots) {
  const subj = secSubjects(sec).find((x) => x.codigo === codigo);
  const { w0, w1 } = slots.length ? previewWeeks(S, secCore(sec), codigo, slots) : { w0: 1, w1: 1 };
  const tm = slots.map((x) => ({ d: x.d, s: toMinutes(x.inicio), e: toMinutes(x.fin) }));
  const others = H.sesiones.filter((x) => !(x.seccionId === sec.id && x.codigo === codigo) && x.desde <= w1 && x.hasta >= w0
    && tm.some((sl) => sl.d === x.dia && toMinutes(x.inicio) < sl.e && sl.s < toMinutes(x.fin)));
  return { subj, w0, w1, others };
}

const secById = (H, id) => H.secciones.find((x) => x.id === id);
const shortDays = (days) => days.map((d) => DAY_NAMES[d].slice(0, 2)).join(', ');

// Panel lateral: ocupación de todas las salas en la semana, o elegir sala para la clase que se está asignando.
function roomPanel(H, sec) {
  const pick = ui.pick;
  if (pick && sec) return pickPanel(H, sec, pick);
  const slots = roomSlots(H);
  const days = DAYS.filter((d) => slots[d]?.length);
  const wk = ui.week;
  const cells = (r) => days.map((d) => `<span class="rp-day">${slots[d].map((sl) => {
    const x = H.sesiones.find((y) => y.salaId === r.id && y.dia === d && y.desde <= wk && y.hasta >= wk && toMinutes(y.inicio) < sl.e && sl.s < toMinutes(y.fin));
    if (!x) return `<i class="rp-s" title="${esc(r.nombre)} · ${DAY_NAMES[d]} ${sl.inicio} · libre"></i>`;
    const owner = secById(H, x.seccionId);
    return `<i class="rp-s full ${sec && x.seccionId === sec.id ? 'mine' : ''} ${x.choque ? 'bad' : ''}" style="${cvar(x.codigo)}" title="${esc(r.nombre)} · ${DAY_NAMES[d]} ${sl.inicio} · ${owner ? secLabel(owner) : ''} ${esc(x.nombre)}"></i>`;
  }).join('')}</span>`).join('');
  const pct = (r) => {
    let used = 0, all = 0;
    for (const d of days) for (const sl of slots[d]) { all++; if (H.sesiones.some((y) => y.salaId === r.id && y.dia === d && y.desde <= wk && y.hasta >= wk && toMinutes(y.inicio) < sl.e && sl.s < toMinutes(y.fin))) used++; }
    return all ? Math.round((used / all) * 100) : 0;
  };
  const rows = S.salas.map((r) => { const p = pct(r); return `<div class="rp-row"><span class="rp-name" title="${esc(r.nombre)} · ${r.capacidad} puestos">${esc(r.nombre)}<small>${r.capacidad}</small></span>${cells(r)}<span class="rp-pct ${p ? '' : 'zero'}">${p}%</span></div>`; }).join('');
  return `<aside class="rooms" aria-label="Ocupación de salas" style="--rp-days:${days.length || 6}">
    <div class="rooms-head"><b>Ocupación de salas</b><span class="faint small">Semana ${wk}</span></div>
    ${days.length && S.salas.length ? `<div class="rp-row rp-head"><span></span>${days.map((d) => `<span class="rp-day">${DAY_NAMES[d].slice(0, 2)}</span>`).join('')}<span></span></div><div class="rp-rows">${rows}</div>
    <p class="rp-legend"><i class="rp-s full"></i>ocupada <i class="rp-s full mine"></i>esta sección <i class="rp-s"></i>libre</p>`
      : `<p class="faint small">${S.salas.length ? 'Abre secciones en Carreras para ver la ocupación.' : 'No hay salas registradas.'}</p>`}
    ${sec ? '' : '<p class="faint small">Elige carrera y semestre para asignar clases.</p>'}
  </aside>`;
}

function pickPanel(H, sec, pick) {
  const subjects = secSubjects(sec);
  const pend = subjects.filter((x) => sec.pendientes.includes(x.codigo));
  if (!pick.edit && !pick.codigo) pick.codigo = pend[0]?.codigo || null;
  const head = (t) => `<div class="rooms-head"><b>${t}</b><button class="toast-x" data-act="cancelPick" aria-label="Cerrar">×</button></div>`;
  if (!pick.codigo) {
    return `<aside class="rooms picking">${head('Asignar clase')}<p class="small">Todas las asignaturas de ${secLabel(sec)} ya están asignadas.</p>
      <button class="btnq" data-act="cancelPick">Volver</button></aside>`;
  }
  const cand = candidate(H, sec, pick.codigo, pick.slots);
  const placed = sec.plan.find((x) => x.codigo === pick.codigo);
  const teacher = S.asignaciones?.[pick.codigo] || null;
  const busy = teacher ? cand.others.find((x) => x.docenteId === teacher) : null;
  const own = cand.others.find((x) => x.seccionId === sec.id);
  // Días de la clase: cualquiera, a la hora del bloque elegido (el sábado, solo en la mañana)
  const dayBtns = DAYS.map((d) => {
    const sl = pick.slots.find((x) => x.d === d);
    const ok = sl || slotAllowed(d, pick.row.inicio);
    return `<button data-act="toggleDay" data-v="${d}" aria-pressed="${!!sl}" ${ok ? '' : 'disabled'} title="${DAY_NAMES[d]} ${sl ? sl.inicio : pick.row.inicio}${ok ? '' : ' · el sábado solo hay clases en la mañana'}">${DAY_NAMES[d].slice(0, 2)}<small>${sl ? sl.inicio : ''}</small></button>`;
  }).join('');
  const subjField = pick.edit
    ? `<p class="pk-subj" title="${esc(cand.subj?.nombre || pick.codigo)}"><b>${esc(cand.subj?.nombre || pick.codigo)}</b></p>`
    : `<label class="pk-field"><select data-change="pickSubject" aria-label="Asignatura">${pend.map((x) => `<option value="${x.codigo}" ${x.codigo === pick.codigo ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select></label>`;
  const rooms = S.salas.map((r) => {
    const occ = cand.others.find((x) => x.salaId === r.id);
    const small = r.capacidad < sec.estudiantes;
    const current = placed && placed.salaId === r.id;
    const [cls, st] = current ? ['cur', 'Actual']
      : occ ? ['busy', `Ocupada · ${esc(secLabel(secById(H, occ.seccionId)))}`]
      : small ? ['small', `Chica para ${sec.estudiantes}`] : ['free', 'Libre'];
    return `<button class="pk-room ${cls}" data-act="placeIn" data-v="${r.id}" title="${esc(r.nombre)} · ${r.capacidad} puestos · ${st}" ${current ? 'aria-current="true"' : ''}><b>${esc(r.nombre)}</b><small>${cls === 'busy' ? esc(secLabel(secById(H, occ.seccionId))) : r.capacidad}</small></button>`;
  }).join('');
  const n = pick.slots.length;
  return `<aside class="rooms picking" aria-label="Asignar clase">
    ${head(pick.edit ? 'Editar clase' : 'Asignar clase')}
    ${subjField}
    <div class="pk-days" role="group" aria-label="Días de la clase">${dayBtns}</div>
    <p class="pk-info"><span>Semanas ${cand.w0}–${cand.w1} · ${n} ${n === 1 ? 'sesión' : 'sesiones'} por semana · ${teacher ? esc(docName(teacher)) : '<span class="bad-t">Sin docente</span>'}</span>${pick.edit ? '<button class="linkbtn danger" data-act="removeClass">Quitar clase</button>' : ''}</p>
    ${own ? `<p class="pk-warn">${icon('alert')}Este curso ya tiene ${esc(own.nombre)} el ${DAY_NAMES[own.dia]} a las ${own.inicio}.</p>` : busy ? `<p class="pk-warn">${icon('alert')}${esc(docName(teacher))} ya tiene clase a esa hora: ${esc(secLabel(secById(H, busy.seccionId)))} ${esc(busy.nombre)}.</p>` : ''}
    <span class="pk-label">${pick.edit ? 'Sala' : 'Elige la sala'} <span class="pk-key"><i class="k-free"></i>libre <i class="k-busy"></i>ocupada <i class="k-small"></i>chica</span></span>
    <div class="pk-rooms">${rooms}</div>
  </aside>`;
}

// ---------- Vista de salas: todas las carreras; filas = día y hora, columnas = salas ----------
function hmodeSeg() {
  return `<div class="seg sm" role="group" aria-label="Vista">${[['salas', 'Salas'], ['curso', 'Por sección']].map(([v, l]) => `<button data-act="hmode" data-v="${v}" aria-pressed="${ui.hmode === v}">${l}</button>`).join('')}</div>`;
}

// Fecha de un día de la semana elegida (según el calendario del periodo).
const DAY_OFFSET = { Lu: 0, Ma: 1, Mi: 2, Ju: 3, Vi: 4, Sa: 5 };
function dateOfDay(d, w = ui.week) { return addDays(weekMonday(calendarOf(S), w), DAY_OFFSET[d] || 0); }
function weekRange(w = ui.week) { const a = dateOfDay('Lu', w), b = dateOfDay('Sa', w); return `${fmtFecha(a).split(' ')[0]}${a.slice(5, 7) === b.slice(5, 7) ? '' : ' ' + fmtFecha(a).split(' ')[1]}–${fmtFecha(b)}`; }
function weekNav(maxW) {
  return `<div class="weeknav"><button class="sq" data-act="week" data-v="-1" aria-label="Semana anterior">‹</button><span class="wk-label">Semana ${ui.week} <span class="faint">/ ${maxW} · ${weekRange()}</span></span><button class="sq" data-act="week" data-v="1" aria-label="Semana siguiente">›</button></div>`;
}

// Horas de inicio de todos los bloques (todas las jornadas y semestres) más las de las clases: una fila por hora.
function roomTimes(H) {
  const map = new Map();
  // Solo las jornadas que usan las carreras: así no aparecen filas de horarios que nadie usa.
  const usadas = new Set(S.carreras.map((c) => c.jornada));
  for (const jn of Object.keys(S.jornadas).filter((j) => usadas.has(j))) for (const n of [1, 2, 3, 4]) {
    let ds = [];
    try { ds = cohortDays(S.jornadas, jn, n); } catch { ds = []; }
    for (const d of ds) for (const b of blocksFor(S.jornadas, jn, d, n)) if (!map.has(b.inicio)) map.set(b.inicio, b.fin);
  }
  for (const x of H.sesiones) if (!map.has(x.inicio)) map.set(x.inicio, x.fin);
  return [...map].map(([inicio, fin]) => ({ inicio, fin })).sort((a, b) => toMinutes(a.inicio) - toMinutes(b.inicio));
}

// Horas de cada día: los días de semana no muestran las del sábado y viceversa.
function roomTimesByDay(H, jor) {
  const all = roomTimes(H);
  const usadas = new Set(S.carreras.map((c) => c.jornada).filter((j) => !jor || j === jor));
  const deJor = new Set(H.secciones.filter((x) => !jor || x.jornada === jor).map((x) => x.id));
  const porDia = {};
  for (const d of DAYS) {
    const set = new Set();
    for (const jn of Object.keys(S.jornadas).filter((j) => usadas.has(j))) for (const n of [1, 2, 3, 4]) {
      const bl = d === 'Sa' ? (S.jornadas[jn]?.sems?.[n]?.bloques?.Sa || []) : blocksFor(S.jornadas, jn, d, n);
      for (const b of bl) if (slotAllowed(d, b.inicio)) set.add(b.inicio);
    }
    for (const x of H.sesiones) if (x.dia === d && deJor.has(x.seccionId)) set.add(x.inicio);
    porDia[d] = all.filter((t) => set.has(t.inicio));
  }
  return (d) => porDia[d] || [];
}

// Matriz: una fila por día y hora, una columna por sala. Muestra lo que ocupa cada sala en la semana elegida.
function matrixViewer(H) {
  // Pestañas por jornada: cada una muestra sus salas y solo sus horarios (no sobrecarga la página).
  const jornadas = Object.keys(S.jornadas).filter((j) => S.carreras.some((c) => c.jornada === j)).sort((a, b) => (a === 'Diurno' ? -1 : b === 'Diurno' ? 1 : 0));
  const jor = curTab('mxJor', jornadas);
  const timesOf = roomTimesByDay(H, jor);
  // Vista por día (una sola fila de días: menos confusa) o la semana completa en su propia pestaña.
  const vista = curTab('mxVista', [...DAYS, 'sem']);
  const dias = vista === 'sem' ? DAYS : [vista];
  const porDia = vista !== 'sem';
  const maxW = H.semanasMax || 22;
  ui.week = Math.min(Math.max(1, ui.week), maxW);
  const wk = ui.week;
  const pick = ui.pick;
  // Carrera que usa cada sala (la más frecuente en el periodo, contando también la sugerencia)
  const usoSala = {};
  const cuenta = (salaId, car) => { if (salaId && car) { const u = (usoSala[salaId] ||= {}); u[car] = (u[car] || 0) + 1; } };
  for (const x of H.sesiones) cuenta(x.salaId, secById(H, x.seccionId)?.carrera);
  for (const it of ui.sugg?.items || []) cuenta(it.salaId, secById(H, it.secId)?.carrera);
  const carreraDe = (r) => Object.entries(usoSala[r.id] || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  const usoSem = {};
  for (const x of H.sesiones) { const sc = secById(H, x.seccionId); if (x.salaId && sc) { const u = (usoSem[x.salaId] ||= {}); const k = `${sc.carrera} ${roman(sc.sem)}`; u[k] = (u[k] || 0) + 1; } }
  const semDe = (r) => Object.entries(usoSem[r.id] || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || carreraDe(r);
  // Orden: salas de carreras vespertinas, luego diurnas (cada grupo por carrera); las salas sin uso al final y ocultas
  // salvo que se pidan, o que haya una asignación sala por sala en curso.
  const jorDe = (code) => career(code)?.jornada || '';
  const orden = (r) => { const c = carreraDe(r); return c ? (jorDe(c) === 'Vespertino' ? '0' : '1') + c : '2'; };
  const usadas = S.salas.filter((r) => carreraDe(r) && jorDe(carreraDe(r)) === jor).sort((a, b) => orden(a).localeCompare(orden(b)));
  const libres = S.salas.filter((r) => !carreraDe(r));
  // Salas de la otra jornada que también se usan en esta (p. ej. una diurna con clases de noche): se muestran.
  for (const r of S.salas) if (carreraDe(r) && !usadas.includes(r) && H.sesiones.some((x) => x.salaId === r.id && secById(H, x.seccionId)?.jornada === jor)) usadas.push(r);
  // Todas las salas: primero las de esta jornada, luego las de otras carreras y al final las libres.
  const rooms = [...usadas, ...S.salas.filter((r) => !usadas.includes(r) && carreraDe(r)), ...libres];
  // Color fijo por carrera (según su orden en la lista de carreras).
  // Color por carrera y semestre: el tono es de la carrera; cada semestre, un poco más oscuro (I, III, V…).
  const semsAct = activeSemesters(S.periodo.paridad);
  const carColor = (sec) => {
    const base = careerColor(sec?.carrera);
    const k = Math.max(0, semsAct.indexOf(sec?.sem));
    return k ? `color-mix(in srgb, ${base} ${100 - 28 * k}%, #000)` : base;
  };
  const carSem = (sec) => (sec ? `${sec.carrera} ${roman(sec.sem)}` : '');
  const visibles = new Map();
  for (const x of H.sesiones) {
    const sec = secById(H, x.seccionId);
    if (sec && x.salaId && x.desde <= wk && x.hasta >= wk && (!porDia || x.dia === vista) && sec.jornada === jor) visibles.set(carSem(sec), sec);
  }
  const leyenda = visibles.size ? `<div class="mx-leyenda" aria-label="Colores por carrera y semestre">${[...visibles.entries()].sort((a, b) => a[0].localeCompare(b[0]) || a[1].sem - b[1].sem).map(([k, sec]) => `<span title="${esc(career(sec.carrera)?.nombre || sec.carrera)} · ${roman(sec.sem)} semestre"><i style="background:${carColor(sec)}"></i>${k}</span>`).join('')}</div>` : '';
  const short =(n) => n.replace(/^Sala /, 'S').replace(/^Laboratorio.*$/, 'Lab.');
  const cell = (r, d, t) => {
    const list = H.sesiones.filter((x) => x.salaId === r.id && x.dia === d && x.inicio === t.inicio && x.desde <= wk && x.hasta >= wk);
    if (list.length) {
      const x = list[0];
      const sec = secById(H, x.seccionId);
      const on = pick && !pick.roomMode && pick.codigo === x.codigo && pick.secId === x.seccionId;
      return `<div class="mx-busy${list.length > 1 ? ' clash' : ''}${on ? ' on' : ''}" style="--c:${carColor(sec)}" title="${esc(sec ? secLabel(sec) : '')} · ${esc(x.nombre)} · ${x.inicio}–${x.fin} · semanas ${x.desde}–${x.hasta}${list.length > 1 ? ' · ¡choque!' : ''}"><b>${esc(sec ? (porDia ? secLabel(sec) : carSem(sec)) : '')}</b>${porDia ? `<span class="mx-subj">${esc(x.nombre)}</span><span class="mx-hrs">${x.inicio}–${x.fin}</span>` : ''}</div>`;
    }
    const sg = ui.sugg ? ui.sugg.items.findIndex((it) => it.salaId === r.id && wk >= it.desde && wk <= it.hasta && it.slots.some((x) => x.d === d && x.inicio === t.inicio)) : -1;
    if (sg >= 0) {
      const it = ui.sugg.items[sg];
      const sec = secById(H, it.secId);
      return `<button class="mx-sugg" data-act="acceptSugg" data-i="${sg}" title="Sugerencia: ${esc(sec ? secLabel(sec) : '')} · ${esc(subjName(it.secId, it.codigo))} · semanas ${it.desde}–${it.hasta}. Pulsa para aceptar" aria-label="Aceptar sugerencia ${esc(sec ? secLabel(sec) : '')}"><b>${esc(sec ? secLabel(sec) : '')}</b></button>`;
    }
    if (!slotAllowed(d, t.inicio)) return '<span class="mx-na"></span>';
    const on = pick?.roomMode && pick.salaId === r.id && pick.slots?.some((s) => s.d === d && s.inicio === t.inicio);
    return `<span class="mx-free${on ? ' on' : ''}" title="${esc(r.nombre)} · ${DAY_NAMES[d]} ${t.inicio} · libre"></span>`;
  };
  const head =`<div class="mx-corner"></div>${rooms.map((r) => `<div class="mx-room" title="${esc(r.nombre)} · ${r.capacidad} puestos"><b>${esc(short(r.nombre))}</b><small>${carreraDe(r) ? `<span class="mx-car">${semDe(r)}</span>` : r.capacidad}</small></div>`).join('')}`;
  const nRows = dias.reduce((t, d) => t + timesOf(d).length, 0);
  const body = dias.map((d) => timesOf(d).map((t, i) => `<div class="mx-time${i === 0 ? ' mx-first' : ''}">${i === 0 ? `<b${sinClases(calendarOf(S), dateOfDay(d)) ? ` class="mx-off" title="${esc(sinClases(calendarOf(S), dateOfDay(d)))}: sin clases"` : ''}>${DAY_NAMES[d].slice(0, 3)} ${fmtFecha(dateOfDay(d)).split(' ')[0]}</b>` : ''}<span>${t.inicio}</span></div>${rooms.map((r) => cell(r, d, t)).join('')}`).join('')).join('');
  // Salas como cuadros pequeños de tamaño fijo (en el día, algo más anchos para leer la asignatura).
  const grid = `<div class="mx-grid mx-sq${porDia ? ' mx-dia' : ''}" style="row-gap:0;column-gap:3px;grid-template-columns:100px repeat(${rooms.length},${porDia ? '104px' : '42px'});grid-template-rows:auto repeat(${nRows},${porDia ? 'minmax(64px,auto)' : '30px'})">${head}${body}</div>`;
  const fer = (d) => sinClases(calendarOf(S), dateOfDay(d));
  const diaTabs = `<div class="seg sm mx-dias" role="tablist" aria-label="Día">${[...DAYS, 'sem'].map((d) => { const lbl = d === 'sem' ? 'Semana' : `${DAY_NAMES[d].slice(0, 3)} ${fmtFecha(dateOfDay(d)).split(' ')[0]}`; return `<button role="tab" data-act="tab" data-k="mxVista" data-v="${d}" aria-selected="${vista === d}" aria-pressed="${vista === d}"${d !== 'sem' && fer(d) ? ` class="mx-tab-off" title="${esc(fer(d))}: sin clases"` : ''}>${lbl}</button>`; }).join('')}</div>`;
  const avisoDia = porDia && fer(vista) ? `<p class="status warn">${icon('alert')}${DAY_NAMES[vista]} ${fmtFecha(dateOfDay(vista))}: ${esc(fer(vista))}, sin clases.</p>` : '';
  const pend = activeSemesters(S.periodo.paridad).map((n) => {
    const v = H.secciones.filter((x) => x.sem === n && x.jornada === jor).reduce((t, x) => t + x.pendientes.length, 0);
    return `<span class="mx-pend${v ? '' : ' done'}" title="Asignaciones de asignatura a sección del ${roman(n)} semestre que aún no tienen día, hora y sala (cada sección cuenta por separado)">${roman(n)} <b>${v}</b></span>`;
  }).join('');
  const sec = pick && !pick.roomMode ? secById(H, pick.secId) : null;
  const side = pick?.roomMode ? roomPickPanel(H, pick) : sec ? pickPanel(H, sec, pick) : ui.sugg ? suggPanel(H) : '';
  return `<section class="viewer" aria-label="Ocupación de salas por día y hora">
    <div class="hfilters"><div class="hf">${subtabs('mxJor', jornadas.map((j) => [j, j === 'Diurno' ? 'Diurno' : j]))}</div><div class="hf mx-pendline"><span>Por ubicar</span>${pend}</div><div class="hf hf-end">${weekNav(maxW)}</div></div>
    <div class="hfilters mx-diarow">${diaTabs}</div>${avisoDia}${leyenda}
    <div class="plan-wrap${side ? ' has-side' : ''}"><div class="mx-scroll">${grid}</div>${side}</div>
  </section>`;
}

// Nombre de una asignatura de una sección (de su malla).
function subjName(secId, codigo) {
  const sec = S.horario?.secciones.find((x) => x.id === secId);
  return (sec ? secSubjects(sec).find((x) => x.codigo === codigo)?.nombre : null) || codigo;
}

// Panel de la sugerencia: cuántas clases propone, cuáles no tienen lugar y cómo aceptarlas.
function suggPanel(H) {
  const s = ui.sugg;
  const rows = s.unplaced.slice(0, 8).map((u) => {
    const sec = secById(H, u.secId);
    return `<li><b>${esc(sec ? secLabel(sec) : '')}</b> ${esc(subjName(u.secId, u.codigo))}<span class="faint small"> · ${esc(u.motivo)}</span></li>`;
  }).join('');
  return `<aside class="rooms picking" aria-label="Sugerencia de distribución">
    <div class="rooms-head"><b>Sugerencia</b><button class="toast-x" data-act="discardSugg" aria-label="Descartar">×</button></div>
    <p class="small"><b>${s.items.length}</b> clases propuestas · <b>${s.unplaced.length}</b> sin lugar</p>
    <p class="faint small">Las celdas punteadas son propuestas. Pulsa una para aceptarla, o acepta todas. Lo que ya asignaste a mano no se toca.</p>
    <button class="btnp pk-go" data-act="acceptAllSugg" ${s.items.length ? '' : 'disabled'}>Aceptar ${s.items.length} ${s.items.length === 1 ? 'clase' : 'clases'}</button>
    <button class="btnq pk-go" data-act="discardSugg">Descartar</button>
    ${s.unplaced.length ? `<p class="pk-label">Sin lugar</p><ul class="sg-list">${rows}${s.unplaced.length > 8 ? `<li class="faint">y ${s.unplaced.length - 8} más</li>` : ''}</ul>` : ''}
  </aside>`;
}

// Panel para asignar una clase en la sala y hora que se eligió en la matriz.
function roomPickPanel(H, pick) {
  const room = S.salas.find((r) => r.id === pick.salaId);
  const head = `<div class="rooms-head"><b>Asignar en ${esc(room?.nombre || 'sala')}</b><button class="toast-x" data-act="cancelPick" aria-label="Cerrar">×</button></div>`;
  const carreras = S.carreras.filter((c) => H.secciones.some((s) => s.carrera === c.codigo));
  const cur = secById(H, pick.secId);
  const car = pick.car && carreras.some((c) => c.codigo === pick.car) ? pick.car : (cur?.carrera || carreras[0]?.codigo);
  const semsOf = [1, 2, 3, 4].filter((n) => H.secciones.some((s) => s.carrera === car && s.sem === n));
  const sem = semsOf.includes(pick.sem) ? pick.sem : (cur && semsOf.includes(cur.sem) ? cur.sem : semsOf[0]);
  pick.car = car; pick.sem = sem;
  const secs = H.secciones.filter((s) => s.carrera === car && s.sem === sem);
  if (!secs.some((s) => s.id === pick.secId)) pick.secId = secs[0]?.id || null;
  const sec = secById(H, pick.secId);
  if (sec && (!pick.codigo || !sec.pendientes.includes(pick.codigo))) pick.codigo = sec.pendientes[0] || null;
  const seg = (inner) => `<div class="seg sm" role="group">${inner}</div>`;
  const carSel = `<label class="pk-field"><select data-change="pickCar" aria-label="Carrera">${carreras.map((c) => `<option value="${c.codigo}" ${c.codigo === car ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></label>`;
  const semBtns = seg(semsOf.map((n) => `<button data-act="pickSem" data-v="${n}" aria-pressed="${n === sem}">${roman(n)}</button>`).join(''));
  if (!sec) return `<aside class="rooms picking" aria-label="Asignar en sala">${head}${carSel}${semBtns}<p class="small">No hay secciones abiertas para esta carrera.</p></aside>`;
  const secBtns = secs.length > 1 ? seg(secs.map((s) => `<button data-act="pickSecBtn" data-v="${s.id}" aria-pressed="${s.id === sec.id}">${s.letra}</button>`).join('')) : '';
  const subs = secSubjects(sec).filter((x) => sec.pendientes.includes(x.codigo));
  if (!subs.length) return `<aside class="rooms picking" aria-label="Asignar en sala">${head}${carSel}${semBtns}${secBtns}<p class="small">${esc(secLabel(sec))} ya tiene todas sus asignaturas ubicadas.</p></aside>`;
  const subField = `<label class="pk-field"><select data-change="pickSubject" aria-label="Asignatura">${subs.map((x) => `<option value="${x.codigo}" ${x.codigo === pick.codigo ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select></label>`;
  const days = DAYS.map((d) => {
    const sl = pick.slots.find((x) => x.d === d);
    const ok = !!sl || slotAllowed(d, pick.row.inicio);
    return `<button data-act="toggleDay" data-v="${d}" aria-pressed="${!!sl}" ${ok ? '' : 'disabled'} title="${DAY_NAMES[d]}${ok ? '' : ' · el sábado solo hay clases en la mañana'}">${DAY_NAMES[d].slice(0, 2)}<small>${sl ? sl.inicio : ''}</small></button>`;
  }).join('');
  const cand = candidate(H, sec, pick.codigo, pick.slots);
  const teacher = S.asignaciones?.[pick.codigo] || null;
  const sameRoom = cand.others.find((x) => x.salaId === pick.salaId);
  const busyT = teacher ? cand.others.find((x) => x.docenteId === teacher) : null;
  const own = cand.others.find((x) => x.seccionId === sec.id);
  const problems = [];
  if (!pick.slots.length) problems.push('Elige al menos un día.');
  if (sameRoom) problems.push(`${esc(room?.nombre || 'La sala')} ya tiene ${esc(sameRoom.nombre)} de ${esc(secLabel(secById(H, sameRoom.seccionId)))} en esas semanas.`);
  if (busyT) problems.push(`${esc(docName(teacher))} ya tiene ${esc(busyT.nombre)} de ${esc(secLabel(secById(H, busyT.seccionId)))} a esa hora.`);
  if (own) problems.push(`${esc(secLabel(sec))} ya tiene ${esc(own.nombre)} a esa hora.`);
  const cap = room && room.capacidad < sec.estudiantes ? `${esc(room.nombre)} tiene ${room.capacidad} puestos y la sección ${sec.estudiantes}.` : '';
  const n = pick.slots.length;
  return `<aside class="rooms picking" aria-label="Asignar en sala">${head}
    ${carSel}${semBtns}${secBtns}${subField}
    <div class="pk-days" role="group" aria-label="Días de la clase">${days}</div>
    <p class="pk-info"><span>Semanas ${cand.w0}–${cand.w1} · ${n} ${n === 1 ? 'sesión' : 'sesiones'} por semana · ${teacher ? esc(docName(teacher)) : '<span class="bad-t">Sin docente</span>'}</span></p>
    ${cap ? `<p class="pk-warn">${icon('alert')}${cap}</p>` : ''}
    ${problems.map((p) => `<p class="pk-warn">${icon('alert')}${p}</p>`).join('')}
    <button class="btnp pk-go" data-act="confirmRoom" ${problems.length ? 'disabled' : ''}>Asignar aquí</button>
  </aside>`;
}

function tipoLabel(t) {
  return { docente: 'Choque', 'sin-docente': 'Sin docente', disponibilidad: 'Disponibilidad', tope: 'Tope', sala: 'Sala', capacidad: 'Capacidad' }[t] || t;
}

function agenda(ses, H) {
  if (!ses.length) return '';
  const metaOf = (x) => `${docName(x.docenteId)} · ${salaName(x.salaId)}`;
  const days = DAYS.filter((d) => ses.some((x) => x.dia === d));
  return `<div class="agenda">${days.map((d) => `<div class="ag-day"><h3>${DAY_NAMES[d]}</h3>${ses.filter((x) => x.dia === d).sort((a, b) => a.inicio.localeCompare(b.inicio)).map((x) => `<div class="ag-item" style="${cvar(x.codigo)}"><span class="ag-t">${x.inicio}<br>${x.fin}</span><span><b>${esc(x.nombre)}</b><span class="faint small">${esc(metaOf(x))}</span></span></div>`).join('')}</div>`).join('')}</div>`;
}

function gantt(items, weeks, who, currentWeek = null) {
  const cols = `200px repeat(${weeks}, minmax(0,1fr))`;
  const stripe = currentWeek && currentWeek <= weeks ? `<div class="stripe" style="grid-column:${currentWeek + 1}"></div>` : '';
  let html = `<div class="gantt"><div class="gr head" style="grid-template-columns:${cols}"><div class="gname"></div>${Array.from({ length: weeks }, (_, i) => `<div class="wk ${currentWeek === i + 1 ? 'now' : ''}" style="grid-column:${i + 2}">${(i + 1) % 2 && i + 1 !== currentWeek ? '' : i + 1}</div>`).join('')}</div>`;
  for (const it of items) {
    const label = who ? esc(who(it)) : `${it.horas} h`;
    html += `<div class="gr" style="grid-template-columns:${cols};${cvar(it.codigo)}">${stripe}<div class="gname">${esc(it.nombre)}</div><div class="bar" title="${esc(it.nombre)} · ${it.fechaInicio ? `${fmtFecha(it.fechaInicio)} al ${fmtFecha(it.fechaFin)} · ` : ""}semanas ${it.desde}–${it.hasta} · ${it.horas} h${it.horasDadas && it.horasDadas !== it.horas ? ` (se dictan ${it.horasDadas})` : ""}" style="grid-column:${it.desde + 1} / ${it.hasta + 2};${cvar(it.codigo)}">${label}</div></div>`;
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
    <div class="car-bar"><div class="seg" role="group" aria-label="Filtrar">${tab('all', 'Todas', info.length)}${tab('lista', 'Listas', n('lista'))}${tab('sin', 'Sin oferta', n('sin'))}${tab('faltan', 'Faltan docentes', n('faltan'))}</div>
    <div class="car-modo" aria-label="Forma de ver las carreras">${subtabs('carVista', [['tarjetas', 'Tarjetas'], ['lista', 'Lista']])}</div></div>
    ${ui.tabs.carVista === 'lista' ? `<div class="card" style="padding:4px 8px;margin-top:10px"><div class="tablewrap"><table class="dtable car-tabla" data-pager><thead><tr><th>Carrera</th><th>Secciones</th><th>Estado</th><th></th></tr></thead><tbody>
      ${page('carreras-' + f, list).map((x) => `<tr class="click" data-act="go" data-v="#/carreras/${x.c.codigo}">
        <td><span class="l1">${esc(x.c.nombre)}</span><span class="l2">${x.c.codigo} · ${esc(x.c.jornada)}</span></td>
        <td class="num">${x.secs || '<span class="faint">—</span>'}</td>
        <td>${estado(x)}</td>
        <td style="text-align:right;color:var(--ink-3)">${icon('arrow')}</td></tr>`).join('') || '<tr><td colspan="4" class="muted" style="padding:24px">Ninguna carrera en este filtro.</td></tr>'}
    </tbody></table></div>${pagerHtml('carreras-' + f, list.length)}</div>` : `<div class="car-grid">
      ${list.map((x) => `<a class="car-card ${x.estado}" href="#/carreras/${x.c.codigo}" style="--c:${careerColor(x.c.codigo)}" title="Abrir ${esc(x.c.nombre)} para editar">
        <span class="car-top"><b>${x.c.codigo}</b><small>${esc(x.c.jornada)}</small></span>
        <span class="car-name">${esc(x.c.nombre)}</span>
        <span class="car-foot"><span>${x.secs ? `${x.secs} secc.` : 'Sin secc.'}</span>${x.estado === 'faltan' ? `<span class="badge warn" title="Faltan ${x.missing} docentes">Faltan ${x.missing} doc.</span>` : estado(x)}</span>
      </a>`).join('') || '<p class="muted" style="padding:24px">Ninguna carrera en este filtro.</p>'}
    </div>`}`;
}

function malla(c) {
  return `<div class="malla">${c.semestres.map((s) => `<div class="sem"><h3>Semestre ${roman(s.n)}<span>${s.horas} h</span></h3>${s.asignaturas.map((a) => `<div class="asg ${a.transversal ? 'tr' : ''}" style="${cvar(a.codigo)}"><span>${esc(a.nombre)}</span><b>${a.horas}</b></div>`).join('')}</div>`).join('')}</div>
    <p class="muted small" style="margin-top:10px">Fuente: <a href="${esc(c.fuente?.malla_pdf)}" target="_blank" rel="noopener">malla oficial (PDF)</a>. Fondo dorado: asignaturas transversales.</p>`;
}

// ---------- Vista: Asistente por carrera ----------
const STEP_LABELS = ['Oferta', 'Asignaturas', 'Docentes', 'Salas', 'Vista previa', 'Confirmar'];
const wizBody = (c, step, sems) => [wizOferta, wizAsignaturas, wizDocentes, wizSalas, wizPrevia, wizConfirmar][step - 1](c, sems);
// Último paso: confirmar (si hay vista previa).
const wizLast = (c) => `<button class="btnp" data-act="confirmPlan" ${ui.preview?.code === c.codigo && !ui.generating ? '' : 'disabled'}>Confirmar y asignar</button>`;

// Carrera del asistente: la de la ventana abierta desde Horario, o la de la página Carreras.
function wizCode() { return ui.modal?.v === 'wizard' ? ui.modal.k : route().arg; }

function wizardParts(code, enModal) {
  const c = career(code);
  const step = Math.min(ui.steps[code] || 1, STEP_LABELS.length);
  const sems = activeSemesters(S.periodo.paridad);
  const stepper = `<div class="stepper">${STEP_LABELS.map((l, i) => `<button data-act="step" data-v="${i + 1}" class="${i + 1 < step ? 'done' : ''}" ${i + 1 === step ? 'aria-current="step"' : ''}><span class="n">${i + 1 < step ? '✓' : i + 1}</span>${l}</button>`).join('')}</div>`;
  const body = wizBody(c, step, sems);
  const last = wizLast(c);
  const foot = `<button class="btn" data-act="step" data-v="${step - 1}" ${step === 1 ? 'disabled' : ''}>${icon('back')}Atrás</button>${step < STEP_LABELS.length ? `<button class="btnp" data-act="step" data-v="${step + 1}">Siguiente: ${STEP_LABELS[step].toLowerCase()} ${icon('arrow')}</button>` : last}`;
  return { c, step, stepper, body, foot };
}

function viewWizard(code) {
  const c = career(code);
  if (!c) return '<p>Carrera no encontrada. <a href="#/carreras">Volver</a></p>';
  const step = Math.min(ui.steps[code] || 1, STEP_LABELS.length);
  const sems = activeSemesters(S.periodo.paridad);
  const stepper = `<div class="stepper">${STEP_LABELS.map((l, i) => `<button data-act="step" data-v="${i + 1}" class="${i + 1 < step ? 'done' : ''}" ${i + 1 === step ? 'aria-current="step"' : ''}><span class="n">${i + 1 < step ? '✓' : i + 1}</span>${l}</button>`).join('')}</div>`;
  const body = wizBody(c, step, sems);
  return `<div class="pagehead"><div><span class="kicker"><a href="#/carreras">Carreras</a> · ${c.codigo} · ${esc(c.jornada)} · ${esc(S.periodo.nombre)}</span><h1>${esc(c.nombre)}</h1></div></div>
    <nav aria-label="Pasos">${stepper}</nav><div class="card">${body}</div>
    <div class="wiz-foot"><button class="btn" data-act="step" data-v="${step - 1}" ${step === 1 ? 'disabled' : ''}>${icon('back')}Atrás</button>${step < STEP_LABELS.length ? `<button class="btnp" data-act="step" data-v="${step + 1}">Siguiente: ${STEP_LABELS[step].toLowerCase()} ${icon('arrow')}</button>` : wizLast(c)}</div>`;
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
    const usados = S.horario?.secciones.filter((x) => x.carrera === c.codigo && x.sem === sem).flatMap((x) => x.diasUso || []) || [];
    const days = usados.length ? DAYS.filter((d) => usados.includes(d)) : cohortDays(S.jornadas, c.jornada, sem);
    const diasTxt = usados.length ? days.join(' ') : `${days.join(' ')}${(S.reglas.diasFijos || []).includes(c.codigo) ? '' : ' <span class="faint">(preferidos)</span>'}`;
    const per = of.secciones ? Math.ceil(of.estudiantes / of.secciones) : 0;
    return `<div class="offer-row ${of.secciones ? 'open' : ''}">
      <div class="offer-sem"><b>Semestre ${roman(sem)}</b><span>${diasTxt}</span></div>
      <input type="number" min="0" value="${of.estudiantes || 0}" data-change="estudiantes" data-sem="${sem}" data-code="${c.codigo}" aria-label="Estudiantes del semestre ${roman(sem)}">
      <div class="counter sm"><button class="sq" data-act="secs" data-sem="${sem}" data-v="-1" aria-label="Menos secciones del semestre ${roman(sem)}">−</button><b>${of.secciones || 0}</b><button class="sq" data-act="secs" data-sem="${sem}" data-v="1" aria-label="Más secciones del semestre ${roman(sem)}">+</button></div>
      <div class="offer-note small">${of.secciones ? `≈ ${per} por sección${per > S.reglas.cupo ? ' <span class="badge warn">sobre el cupo</span>' : ''}` : '<span class="faint">No abre</span>'}${sug !== (of.secciones || 0) && of.estudiantes ? ` <span class="faint">· sugerido ${sug}</span>` : ''}</div>
    </div>`;
  }).join('');
  return `<div class="section-title"><h2>Oferta de ${esc(S.periodo.nombre)}</h2><span class="muted small">Cupo ${S.reglas.cupo} por sección</span></div>
    <div class="offer-list">
      <div class="offer-row offer-headrow" aria-hidden="true"><span>Semestre</span><span>Estudiantes</span><span>Secciones</span><span></span></div>
      ${rows}
      <div class="offer-row practice ${pr.estudiantes ? 'open' : ''}">
        <div class="offer-sem"><b>Semestre V</b><span>Práctica laboral${c.practica?.examen ? ' y examen' : ''}</span></div>
        <input type="number" min="0" value="${pr.estudiantes || 0}" data-change="practicaEst" data-code="${c.codigo}" aria-label="Estudiantes en práctica">
        <label class="hours"><input type="number" min="0" step="10" value="${c.practica?.horas ?? 400}" data-change="practicaHoras" data-code="${c.codigo}" aria-label="Horas de práctica"><span class="faint small">horas</span></label>
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
    : `<div class="tablewrap">${gantt(items, plan.semanas, null)}</div>`;
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
  const load = estimatedLoad(S, S.asignaciones);
  const secsN = S.oferta?.[c.codigo]?.[sem]?.secciones || 1;
  // Todas las asignaturas del semestre, sin paginar.
  const rows = s.asignaturas.map((a) => {
    const asg = S.asignaciones[a.codigo] || '';
    const h = a.horas * secsN;
    // Solo docentes con capacidad para esta asignatura (el ya asignado siempre aparece).
    const cabe = (d) => d.id === asg || leCabe(S, d, load, h);
    const libreH = (d) => Math.max(0, capacidadHoras(S, d) - (load[d.id] || 0));
    const qual = qualifiedTeachers(S, a.nombre).filter(cabe);
    const others = S.docentes.filter((d) => !qual.includes(d) && !canTeach(d, a.nombre) && cabe(d));
    const llenos = S.docentes.filter((d) => !cabe(d)).length;
    const doc = S.docentes.find((d) => d.id === asg);
    let warn = '';
    if (!asg) warn = qual.length ? '<span class="badge warn">Sin asignar</span>' : '<span class="badge bad">Nadie la dicta</span>';
    else if (!canTeach(doc, a.nombre)) warn = '<span class="badge warn">No está en sus asignaturas</span>';
    else if (!availableForLevel(S, doc, c, sem)) warn = '<span class="badge bad">No puede todos los días</span>';
    return `<tr><td><span class="who" style="gap:8px">${dotOf(a.codigo)}${esc(a.nombre)}</span></td><td><select style="min-width:200px" data-change="asignar" data-cod="${a.codigo}" aria-label="Docente de ${esc(a.nombre)}">
      <option value="">Sin asignar</option>
      ${qual.length ? `<optgroup label="Dictan esta asignatura">${qual.map((d) => `<option value="${d.id}" ${d.id === asg ? 'selected' : ''}>${esc(d.nombre)} · ${libreH(d)} h libres</option>`).join('')}</optgroup>` : ''}
      ${others.length ? `<optgroup label="Otros docentes">${others.map((d) => `<option value="${d.id}" ${d.id === asg ? 'selected' : ''}>${esc(d.nombre)} · ${libreH(d)} h libres</option>`).join('')}</optgroup>` : ''}
    </select>${llenos ? `<span class="faint small" title="Docentes que ya llegaron a su capacidad del periodo"> ${llenos} sin capacidad</span>` : ''}</td><td>${warn}</td></tr>`;
  }).join('');
  return head + `<div class="tablewrap"><table class="dtable"><thead><tr><th>Asignatura</th><th>Docente</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><p class="faint small" style="margin-top:8px">${s.asignaturas.length} asignaturas del ${roman(sem)} semestre</p>`;
}

// ---------- Vista: Configuración ----------
// Jornadas, cupo y tope: se definen una vez y valen para todos los periodos.
// Cada semestre (I a IV) tiene sus propios días y bloques; se edita uno a la vez y se ve cómo queda su semana.
const dayList = (days) => days.map((d) => DAY_NAMES[d].toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' y $1');
// Calendario del periodo elegido: inicio y cierre, horas por sesión, feriados y recesos.
function calendarConfig() {
  const cal = calendarOf(S);
  const fer = (cal.feriados || []).slice().sort((a, b) => a.fecha.localeCompare(b.fecha));
  const rec = (cal.recesos || []).slice().sort((a, b) => a.desde.localeCompare(b.desde));
  const dn = (iso) => DAY_NAMES[dayCode(iso)] || (dayCode(iso) === 'Do' ? 'Domingo' : '');
  const card = (title, help, body) => `<section class="card cal-card"><div class="cal-h"><h2>${title}</h2><span class="faint small">${help}</span></div>${body}</section>`;
  const quitar = (k, v, n) => `<button class="btnq sm" data-act="calDel" data-k="${k}" data-v="${v}" aria-label="Quitar ${esc(n)}">Quitar</button>`;
  return `<div class="cal-cfg2">
    ${cal.referencial ? `<p class="faint small cal-nota">${icon('info')}Calendario de referencia. Revísalo con el calendario académico del CFT.</p>` : ''}
    <div class="cal-grid">
      ${card('Inicio y cierre', 'Las clases parten el primer día y no deberían pasar del cierre', `<div class="cal-fields">
        <label class="field">Inicio<input type="date" value="${cal.inicio}" data-change="calField" data-k="inicio"></label>
        <label class="field">Cierre<input type="date" value="${cal.fin}" data-change="calField" data-k="fin"></label></div>`)}
      ${card('Horas por sesión', 'Horas pedagógicas de cada bloque (40 min cada una)', `<div class="cal-fields">
        <label class="field">Lunes a viernes<input type="number" min="1" max="8" value="${cal.horasSemana}" data-change="calField" data-k="horasSemana"></label>
        <label class="field">Sábado<input type="number" min="1" max="8" value="${cal.horasSabado}" data-change="calField" data-k="horasSabado"></label></div>`)}
      ${card(`Feriados <span class="count">${fer.length}</span>`, 'Días sin clases', `<ul class="cal-list2">${fer.map((x) => `<li><b>${dn(x.fecha).slice(0, 3)} ${fmtFecha(x.fecha)}</b><span class="faint">${esc(x.nombre || '')}</span>${quitar('feriados', x.fecha, x.nombre || x.fecha)}</li>`).join('') || '<li class="faint">Sin feriados</li>'}</ul>
        <div class="cal-add"><input type="date" id="fer-fecha" aria-label="Fecha del feriado"><input type="text" id="fer-nombre" placeholder="Nombre (opcional)" aria-label="Nombre del feriado"><button class="btn sm" data-act="calAdd" data-k="feriados">${icon('plus')}Agregar</button></div>`)}
      ${card(`Recesos <span class="count">${rec.length}</span>`, 'Semanas o días sin clases (vacaciones, Fiestas Patrias)', `<ul class="cal-list2">${rec.map((x) => `<li><b>${fmtFecha(x.desde)} – ${fmtFecha(x.hasta)}</b><span class="faint">${esc(x.nombre || '')}</span>${quitar('recesos', x.desde, x.nombre || x.desde)}</li>`).join('') || '<li class="faint">Sin recesos</li>'}</ul>
        <div class="cal-add"><input type="date" id="rec-desde" aria-label="Desde"><input type="date" id="rec-hasta" aria-label="Hasta"><input type="text" id="rec-nombre" placeholder="Nombre (opcional)" aria-label="Nombre del receso"><button class="btn sm" data-act="calAdd" data-k="recesos">${icon('plus')}Agregar</button></div>`)}
    </div>
    ${!cal.referencial ? `<p class="faint small cal-reset">¿Quieres descartar los cambios de este periodo? <button class="linkbtn" data-act="calReset">Volver al calendario referencial</button></p>` : ''}
  </div>`;
}

// Copia editable del calendario del periodo (al primer cambio deja de ser referencial).
function editCal(fn) {
  mutate(() => {
    const key = calendarKey(S.periodo);
    S.calendarios = S.calendarios || {};
    if (!S.calendarios[key]) { S.calendarios[key] = structuredClone(calendarOf(S)); }
    delete S.calendarios[key].referencial;
    fn(S.calendarios[key]);
  });
}

function viewConfig() {
  const names = Object.keys(S.jornadas);
  const t = curTab('cfg', [...names, 'calendario', 'reglas', 'demo']);
  const head = `<div class="pagehead"><div><h1>Configuración</h1><p class="muted">Se define una vez y vale para todos los periodos.</p></div>
    ${subtabs('cfg', names.map((n) => [n, 'Jornada ' + n.toLowerCase()]).concat([['calendario', 'Calendario'], ['reglas', 'Cupo y tope'], ['demo', 'Demo']]))}</div>`;
  if (t === 'calendario') return head + calendarConfig();
  if (t === 'demo') {
    const n = { docentes: S.docentes.length, salas: S.salas.length, carreras: Object.keys(S.oferta || {}).length };
    return head + `<div class="cal-grid" style="max-width:1000px">
      <section class="card cal-card"><div class="cal-h"><h2>Cargar datos de prueba</h2><span class="faint small">Para practicar con el planificador.</span></div>
        <p class="small">Carga 6 carreras (3 diurnas y 3 vespertinas) con matrícula en los 4 semestres, 23 docentes que cubren sus asignaturas y 15 salas. Docentes, salas y matrícula son ficticios; las mallas son las oficiales.</p>
        <p class="status warn">${icon('alert')}Reemplaza todos los datos actuales.</p>
        <div><button class="btnp" data-act="reset" data-v="varias">Cargar datos de prueba</button></div></section>
      <section class="card cal-card"><div class="cal-h"><h2>Limpiar datos</h2><span class="faint small">Deja el sistema en cero.</span></div>
        <p class="small">Borra docentes, salas, matrícula, asignaciones y horarios. Se mantienen las mallas de las carreras y la configuración de jornadas.</p>
        <p class="faint small">Hoy hay ${n.carreras} carreras con matrícula, ${n.docentes} docentes y ${n.salas} salas.</p>
        <div><button class="btnq danger-q" data-act="reset" data-v="0">Limpiar todos los datos</button></div></section>
    </div>`;
  }
  if (t === 'reglas') {
    return head + `<div class="rules" style="max-width:720px">
      <div class="rule-row"><div class="rule-label"><b>Cupo por sección</b><span>Máximo de estudiantes en una sección</span></div><input type="number" min="5" value="${S.reglas.cupo}" data-change="cupo"></div>
      <div class="rule-row"><div class="rule-label"><b>Tope por docente</b><span>Sesiones por semana · se puede ajustar en cada docente</span></div><input type="number" min="1" max="12" value="${S.reglas.tope}" data-change="tope"></div>
      <div class="rule-row"><div class="rule-label"><b>Días de clase</b><span>Marcadas: usan los días de su jornada. Sin marcar: el sistema elige 3 días de lunes a viernes, repartidos parejo; el sábado solo si falta espacio.</span></div>
        <div class="dias-fijos">${S.carreras.map((c) => `<label class="chk"><input type="checkbox" data-change="diasFijos" data-v="${c.codigo}" ${(S.reglas.diasFijos || []).includes(c.codigo) ? 'checked' : ''}> ${c.codigo}</label>`).join('')}</div></div>
      <div class="rule-row"><div class="rule-label"><b>Salas</b><span>${S.salas.length} salas registradas</span></div><a class="btnq" href="#/salas">Editar salas ${icon('arrow')}</a></div>
    </div>`;
  }
  return head + jornadaConfig(t);
}

// Horario del sábado de la jornada: el propio del semestre I, o uno de mañana si el de la semana no lo es.
function satDeJornada(jn) {
  const c = S.jornadas[jn].sems[1];
  if (c.bloques.Sa) return c.bloques.Sa;
  return c.bloques.default.every(isSaturdayOk) ? c.bloques.default : satBlocks(c);
}

// Jornada: un horario para todos sus semestres y los días preferidos de cada semestre.
function jornadaConfig(jn) {
  const j = S.jornadas[jn];
  const semana = j.sems[1].bloques.default;
  const sabado = satDeJornada(jn);
  const dispares = [2, 3, 4].some((n) => JSON.stringify(j.sems[n].bloques.default) !== JSON.stringify(semana));
  const fila = (key, list) => list.map((bl, i) => `<div class="jor-blk"><span class="faint small">Bloque ${i + 1}</span>
      <input type="time" value="${bl.inicio}" data-change="jorBlock" data-j="${esc(jn)}" data-k="${key}" data-i="${i}" data-f="inicio" ${key === 'Sa' ? 'max="12:59"' : ''} aria-label="${key === 'Sa' ? 'Sábado' : 'Lunes a viernes'}, bloque ${i + 1}, inicio">
      <span class="faint">a</span>
      <input type="time" value="${bl.fin}" data-change="jorBlock" data-j="${esc(jn)}" data-k="${key}" data-i="${i}" data-f="fin" aria-label="${key === 'Sa' ? 'Sábado' : 'Lunes a viernes'}, bloque ${i + 1}, fin">
      ${toMinutes(bl.fin) <= toMinutes(bl.inicio) ? '<span class="badge bad">Revisa</span>' : key === 'Sa' && !isSaturdayOk(bl) ? `<span class="badge bad">Antes de las ${SATURDAY_LAST_START}</span>` : ''}</div>`).join('');
  const diasSem = (n) => {
    const days = j.sems[n].dias;
    const D = `data-j="${esc(jn)}" data-s="${n}"`;
    return `<tr><td><b>Semestre ${roman(n)}</b></td>
      <td><div class="daypick sm" role="group" aria-label="Días preferidos del semestre ${roman(n)}">${DAYS.map((d) => `<button data-act="dayToggle" ${D} data-v="${d}" aria-pressed="${days.includes(d)}" title="${DAY_NAMES[d]}">${d}</button>`).join('')}</div></td>
      <td>${days.length === DAYS_PER_LEVEL ? `<span class="cfg-ok">${icon('check')}3 días</span>` : `<span class="badge warn">Elige 3 (hay ${days.length})</span>`}</td></tr>`;
  };
  return `<div class="jor-cfg">
    <section class="card jor-card">
      <h2>Horario de la jornada ${esc(jn.toLowerCase())}</h2>
      <p class="faint small">Cada día de clase tiene 2 bloques. Vale para todos los semestres de la jornada.</p>
      <div class="jor-horario">
        <div><h3 class="sub">Lunes a viernes</h3>${fila('default', semana)}</div>
        <div><h3 class="sub">Sábado <span class="faint small">solo mañana</span></h3>${fila('Sa', sabado)}</div>
      </div>
      ${dispares ? '<p class="status warn">' + icon('alert') + 'Los semestres tenían horarios distintos; al cambiar una hora se iguala en todos.</p>' : ''}
    </section>
    <section class="card jor-card">
      <h2>Días preferidos de cada semestre</h2>
      <p class="faint small">Cada semestre asiste 3 días a la semana. Estos días son una <b>preferencia</b>: al planificar, el sistema los usa si puede y elige otros si faltan salas o docentes. Para que una carrera los use siempre, márcala en <button class="linkbtn" data-act="tab" data-k="cfg" data-v="reglas">Cupo y tope → Días de clase</button>.</p>
      <table class="dtable jor-dias"><tbody>${[1, 2, 3, 4].map(diasSem).join('')}</tbody></table>
    </section>
  </div>`;
}

// Resumen de los días de los semestres abiertos de una carrera, con enlace a Configuración.
function jornadaLine(c) {
  const open = openSemesters(S, c.codigo);
  const parts = (open.length ? open : [1, 2, 3, 4]).map((n) => `${roman(n)}: ${cohortDays(S.jornadas, c.jornada, n).join(' ')}`);
  const pref = (S.reglas.diasFijos || []).includes(c.codigo) ? 'días fijos' : 'días preferidos';
  return `Jornada ${esc(c.jornada.toLowerCase())} · ${pref} ${parts.join(' · ')} · <a href="#/configuracion">Configuración</a>`;
}


// Paso 4: sala de cada sección (o automática).
function wizSalas(c) {
  const H = S.horario;
  const mine = H ? H.secciones.filter((s) => s.carrera === c.codigo) : [];
  const head = `<div class="section-title"><div><h2>Salas</h2><p class="faint small">${jornadaLine(c)}</p></div></div>`;
  if (!H) return head + '<p class="muted">Todavía no hay horario para este periodo.</p>';
  if (!mine.length) return head + noOpen;
  // Salas ocupadas por otras carreras de la misma jornada (con clases o elegidas para una de sus secciones).
  const ocupada = {};
  const marca = (salaId, sec2) => { if (salaId && sec2 && sec2.carrera !== c.codigo && sec2.jornada === c.jornada) (ocupada[salaId] ||= new Set()).add(sec2.carrera); };
  for (const x of H.sesiones) marca(x.salaId, secById(H, x.seccionId));
  for (const [sid, salaId] of Object.entries(S.salaSeccion || {})) marca(salaId, secById(H, sid));
  const salaSel = (s) => {
    const el = S.salaSeccion?.[s.id] || '';
    const libres = S.salas.filter((r) => (!ocupada[r.id] && r.capacidad >= s.estudiantes) || r.id === el);
    return `<select class="sala-sec" data-change="salaSeccion" data-k="${s.id}" aria-label="Sala de ${secLabel(s)}">
      <option value="">Automática${!el && s.salaId ? ` (hoy ${esc(salaName(s.salaId))})` : ''}</option>
      ${libres.map((r) => `<option value="${r.id}" ${r.id === el ? 'selected' : ''}>${esc(r.nombre)} · ${r.capacidad} puestos${ocupada[r.id] ? ` · ocupada por ${[...ocupada[r.id]].join(', ')}` : ''}</option>`).join('')}
    </select><span class="faint small sala-n">${libres.filter((r) => !ocupada[r.id]).length} disponibles</span>`;
  };
  return head + `<p class="faint small">Elige la sala de cada sección o deja «Automática» para que la elija el planificador. Solo aparecen las salas disponibles: con capacidad suficiente y sin otra carrera ${esc(c.jornada.toLowerCase())}.</p>
    <div class="tablewrap"><table class="dtable"><thead><tr><th>Sección</th><th>Días</th><th>Sala</th></tr></thead><tbody>
    ${mine.map((s) => `<tr><td><span class="l1">${secLabel(s)}</span><span class="l2">${s.estudiantes} estudiantes</span></td><td>${s.diasUso?.length ? s.diasUso.join(' ') : `<span class="faint" title="Días preferidos; se fijan al planificar">${s.dias.join(' ')}</span>`}</td><td>${salaSel(s)}</td></tr>`).join('')}
    </tbody></table></div>`;
}

// Paso 5: vista previa (se calcula al entrar; no guarda nada).
function wizPrevia(c) {
  const pv = ui.preview?.code === c.codigo ? ui.preview : null;
  const head = `<div class="section-title"><div><h2>Vista previa</h2><p class="faint small">Así quedarían las secciones. Aún no se guarda nada.</p></div>
    ${pv && !ui.generating ? `<button class="btnq" data-act="planCareer" data-k="${c.codigo}">Recalcular</button>` : ''}</div>`;
  if (ui.generating) return head + `<div class="plp-wait"><span class="spin" aria-hidden="true"></span><div><b>Calculando la propuesta…</b><p class="faint small">Puede tardar hasta un minuto. Se respeta lo ya asignado a las otras carreras.</p></div></div>`;
  if (ui.previewErr?.code === c.codigo) return head + `<p class="status bad">${icon('alert')}${esc(ui.previewErr.msg)}</p><button class="btnp" data-act="planCareer" data-k="${c.codigo}">Reintentar</button>`;
  if (!pv) return head + `<button class="btnp" data-act="planCareer" data-k="${c.codigo}">Calcular vista previa</button>`;
  return head + previewHtml(c, pv);
}

// Paso 6: confirmar (resumen de lo que se va a guardar).
function wizConfirmar(c) {
  const pv = ui.preview?.code === c.codigo ? ui.preview : null;
  const head = `<div class="section-title"><div><h2>Confirmar</h2></div></div>`;
  if (!pv) return head + `<p class="muted">Primero revisa la vista previa.</p><button class="btn" data-act="step" data-v="5">${icon('back')}Ir a la vista previa</button>`;
  const secs = pv.H.secciones.filter((s) => s.carrera === c.codigo);
  const tiene = Object.keys(S.manual || {}).some((id) => id.startsWith(c.codigo + '-') && Object.keys(S.manual[id]).length);
  const salasDe = (s) => [...new Set(s.plan.map((p) => p.salaId).filter(Boolean))].map((id) => esc(salaName(id))).join(', ') || 'Sin sala';
  return head + `<p>Se guardarán <b>${pv.items.length}</b> clases de <b>${esc(c.nombre)}</b> y se sumarán a la ocupación de salas.${pv.unplaced.length ? ` <span class="bad-t">${pv.unplaced.length} asignaturas quedan sin lugar.</span>` : ''}</p>
    ${tiene ? `<p class="status warn">${icon('alert')}La carrera ya tenía clases asignadas: se reemplazan por esta propuesta.</p>` : ''}
    <div class="tablewrap"><table class="dtable"><thead><tr><th>Sección</th><th>Días</th><th>Sala</th><th>Termina</th></tr></thead><tbody>
    ${secs.map((s) => `<tr><td><span class="l1">${secLabel(s)}</span></td><td>${(s.diasUso || []).join(' ')}</td><td>${salasDe(s)}</td><td class="${s.pasaCierre ? 'bad-t' : ''}">${s.fechaFin ? fmtFecha(s.fechaFin) : '—'}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="row" style="margin-top:14px"><button class="btnq" data-act="discardPlan">Descartar</button><button class="btnp" data-act="confirmPlan">Confirmar y asignar</button></div>`;
}

// Pone las clases propuestas en un objeto manual ({ secId: { codigo: clase } }).
function putItems(manual, items) {
  for (const it of items) {
    const m = (manual[it.secId] = manual[it.secId] || {});
    const o = Number.isFinite(it.desde) ? it.desde : Math.max(0, ...Object.values(m).map((x) => x.o || 0)) + 1;
    m[it.codigo] = { slots: it.slots.map((x) => ({ d: x.d, inicio: x.inicio, fin: x.fin })), o, salaId: it.salaId, desde: it.desde };
  }
}

// Detalle de la vista previa: cada sección con sus días, sala y asignaturas con fechas.
function previewHtml(c, pv) {
  const PH = pv.H;
  const secs = PH.secciones.filter((s) => s.carrera === c.codigo);
  const ids = new Set(secs.map((s) => s.id));
  const choques = PH.conflictos.filter((x) => ['sala', 'seccion', 'docente', 'capacidad', 'sabado'].includes(x.tipo) && x.secciones.some((id) => ids.has(id)));
  const salasDe = (s) => [...new Set(s.plan.map((p) => p.salaId).filter(Boolean))];
  const dh = (p) => { const by = {}; for (const x of p.slots) (by[x.inicio + '–' + x.fin] ||= []).push(x.d); return Object.entries(by).map(([h, ds]) => `${ds.join(' ')} ${h}`).join(' · '); };
  const fechas = (p) => (p.fechaInicio ? `${fmtFecha(p.fechaInicio)} – ${fmtFecha(p.fechaFin)}` : `semanas ${p.desde}–${p.hasta}`);
  const bloque = (s) => {
    const sinLugar = pv.unplaced.filter((u) => u.secId === s.id);
    return `<div class="plp-sec">
      <div class="plp-head"><b>${secLabel(s)}</b><span>${(s.diasUso || []).map((d) => DAY_NAMES[d]).join(', ') || 'sin días'}</span><span>${salasDe(s).map((id) => esc(salaName(id))).join(', ') || 'Sin sala'}</span><span class="${s.pasaCierre ? 'bad-t' : 'faint'}">${s.fechaFin ? `termina el ${fmtFecha(s.fechaFin)}${s.pasaCierre ? ' (después del cierre)' : ''}` : ''}</span></div>
      <table class="dtable plp-tab"><thead><tr><th>Asignatura</th><th>Días y hora</th><th>Fechas</th><th>Sala</th></tr></thead><tbody>
      ${s.plan.map((p) => `<tr><td><span class="who" style="gap:8px">${dotOf(p.codigo)}${esc(p.nombre)}</span></td><td class="small">${dh(p)}</td><td class="small">${fechas(p)}</td><td class="small">${p.salaId ? esc(salaName(p.salaId)) : '<span class="faint">Online</span>'}</td></tr>`).join('')}
      ${sinLugar.map((u) => `<tr class="plp-miss"><td>${esc(subjName(u.secId, u.codigo))}</td><td colspan="3" class="small">Sin lugar: ${esc(u.motivo)}</td></tr>`).join('')}
      </tbody></table></div>`;
  };
  return `<div class="plp">
    ${choques.length ? `<p class="status bad">${icon('alert')}${choques.length} choques: ${esc(choques[0].mensaje)}</p>` : `<p class="status ok">${icon('check')}Sin choques con lo ya asignado${pv.unplaced.length ? ` · ${pv.unplaced.length} asignaturas sin lugar` : ''}</p>`}
    ${secs.map(bloque).join('')}
  </div>`;
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
          <td><span class="who">${avatarOf(d, 'sm')}<span><span class="l1">${esc(d.nombre)}</span><span class="l2">${esc(d.especialidad || '')}</span></span></span></td>
          <td class="num">${load[d.id] ? `${load[d.id]} h` : '<span class="faint">—</span>'} <span class="faint small">/ ${capacidadHoras(S, d)} h</span>${load[d.id] >= capacidadHoras(S, d) ? ' <span class="badge warn">Completo</span>' : ''}</td>
          <td>${limited(d) ? '<span class="badge warn">Disponibilidad limitada</span>' : ''}</td></tr>`).join('') || '<tr><td colspan="3" class="muted" style="padding:24px">Sin resultados.</td></tr>'}
      </tbody></table></div>${pagerHtml('docentes-' + f, list.length)}</div>`;
}

function allSubjectNames() {
  return [...new Set(S.carreras.flatMap((c) => c.semestres.flatMap((s) => s.asignaturas.map((a) => a.nombre))))].sort((a, b) => a.localeCompare(b));
}

// Asignaturas del docente: las que puede dictar y las que tiene asignadas este periodo.
function docHistory(d) {
  const careersOf = {};
  for (const c of S.carreras) for (const sm of c.semestres) for (const a of sm.asignaturas) (careersOf[a.nombre] = careersOf[a.nombre] || new Set()).add(c.codigo);
  const now = {};
  for (const n of neededSubjects(S)) if (S.asignaciones[n.asignatura.codigo] === d.id) (now[n.asignatura.nombre] = now[n.asignatura.nombre] || []).push(`${n.carrera.codigo} ${roman(n.sem)}`);
  const rows = d.materias.map((m, i) => ({ nombre: m, i, now: now[m] || null, carreras: [...(careersOf[m] || [])] }));
  for (const m of Object.keys(now)) if (!d.materias.includes(m)) rows.push({ nombre: m, i: -1, now: now[m], carreras: [...(careersOf[m] || [])] });
  return rows.sort((x, y) => (!!y.now - !!x.now) || x.nombre.localeCompare(y.nombre));
}

const HIST_ROWS = 7;
function docForm(d) {
  const hist = docHistory(d);
  const nowCount = hist.filter((r) => r.now).length;
  const tab = curTab('docTab', ['ficha', 'hist']);
  const tabs = `<div class="seg sm" role="tablist">${[['ficha', 'Ficha'], ['hist', `Historial docente <span class="count">${hist.length}</span>`]].map(([v, l]) => `<button role="tab" data-act="tab" data-k="docTab" data-v="${v}" aria-selected="${tab === v}" aria-pressed="${tab === v}">${l}</button>`).join('')}</div>`;
  if (tab === 'hist') {
    const pk = 'hist-' + d.id;
    return tabs + `<div class="hist-top"><div class="add-mat"><input type="text" list="subjects" placeholder="Agregar asignatura que puede dictar" id="newMat" aria-label="Agregar asignatura"><button class="btn" data-act="addMat">${icon('plus')}Agregar</button></div>
      <span class="faint small">${nowCount} asignada${nowCount === 1 ? '' : 's'} en ${esc(S.periodo.nombre)}</span></div>
      <datalist id="subjects">${allSubjectNames().map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
      ${hist.length ? `<table class="dtable hist"><thead><tr><th>Asignatura</th><th>Carreras</th><th>${esc(S.periodo.nombre)}</th><th></th></tr></thead><tbody>
        ${page(pk, hist, HIST_ROWS).map((r) => `<tr><td><span class="l1">${esc(r.nombre)}</span></td><td class="faint small">${r.carreras.join(', ') || '—'}</td>
          <td>${r.now ? `<span class="badge ok">${esc(r.now.join(' · '))}</span>` : '<span class="faint small">—</span>'}${r.i < 0 ? ' <span class="badge warn">No está en su lista</span>' : ''}</td>
          <td><button class="sq xs" data-act="rmHist" data-v="${esc(r.nombre)}" aria-label="Quitar ${esc(r.nombre)}" title="${r.now ? 'Quitar de su lista y de su asignación en el periodo' : 'Quitar de su lista'}">×</button></td></tr>`).join('')}
      </tbody></table>${pagerHtml(pk, hist.length, HIST_ROWS)}` : '<p class="faint">Aún no tiene asignaturas. Agrega las que puede dictar.</p>'}`;
  }
  const avail = Array.isArray(d.disponibilidad) ? d.disponibilidad : ALL_SLOTS;
  return tabs + `<div class="doc-grid">
    <section class="doc-col">
      <h3 class="sub">Datos</h3>
      <div class="form2">
        <label class="field">Nombre<input type="text" value="${esc(d.nombre)}" data-change="docField" data-f="nombre"></label>
        <label class="field">Especialidad<input type="text" value="${esc(d.especialidad)}" data-change="docField" data-f="especialidad"></label>
        <label class="field">Correo<input type="email" value="${esc(d.correo)}" placeholder="nombre@ejemplo.cl" autocomplete="off" data-change="docField" data-f="correo"></label>
        <label class="field">Teléfono<input type="tel" value="${esc(d.telefono)}" placeholder="+56 9 1234 5678" autocomplete="off" data-change="docField" data-f="telefono"></label>
        <label class="field">Tope semanal (sesiones)<input type="number" min="1" max="12" placeholder="${S.reglas.tope} (general)" value="${d.tope ?? ''}" data-change="docField" data-f="tope"></label>
      </div>
      <h3 class="sub">Asignaturas</h3>
      <div class="hist-sum"><div><b>${d.materias.length}</b><span>puede dictar</span></div><div><b>${nowCount}</b><span>asignadas en ${esc(S.periodo.nombre)}</span></div>
        <button class="linkbtn" data-act="tab" data-k="docTab" data-v="hist">Ver historial ${icon('arrow')}</button></div>
    </section>
    <section class="doc-col">
      <h3 class="sub">Disponibilidad <span class="count">${avail.length} de ${ALL_SLOTS.length}</span></h3>
      <div class="avail"><div></div>${DAYS.map((x) => `<span class="dh">${x}</span>`).join('')}
        ${TURNOS.map((t, i) => `${i === 2 ? '<span class="avail-sep"></span>' : ''}<span class="lbl">${i % 2 ? '' : `<b>${t.id[0] === 'M' ? 'Mañana' : 'Noche'}</b>`}Bloque ${t.id[1]}</span>${DAYS.map((x) => x === 'Sa' && t.id[0] === 'N' ? '<span class="na" title="El sábado solo hay clases en la mañana"></span>' : `<input type="checkbox" ${avail.includes(`${x}-${t.id}`) ? 'checked' : ''} data-change="avail" data-v="${x}-${t.id}" aria-label="${DAY_NAMES[x]}, ${t.nombre}">`).join('')}`).join('')}
      </div>
      <p class="faint small">Mañana: jornada diurna y sábado. Noche: vespertina; el sábado no tiene noche. Si falta uno de los 3 días de un nivel, no puede tomar asignaturas de ese nivel.</p>
    </section>
  </div>`;
}

// ---------- Vista: Salas ----------
// Uso de cada sala en el periodo: grupos (carrera y semestre) con clases o elegidos para una sección.
function usoSalas() {
  const H = S.horario;
  const uso = {};
  const add = (salaId, sec) => { if (!salaId || !sec) return; const u = (uso[salaId] ||= new Map()); u.set(`${sec.carrera} ${roman(sec.sem)}`, sec); };
  for (const x of H?.sesiones || []) add(x.salaId, secById(H, x.seccionId));
  for (const sec of H?.secciones || []) add(sec.salaId, sec);
  for (const [sid, salaId] of Object.entries(S.salaSeccion || {})) add(salaId, H && secById(H, sid));
  return uso;
}

function viewSalas() {
  const uso = usoSalas();
  const seats = S.salas.reduce((t, r) => t + (Number(r.capacidad) || 0), 0);
  const info = S.salas.map((r, i) => {
    const grupos = [...(uso[r.id]?.entries() || [])].sort((x, y) => x[0].localeCompare(y[0]));
    const over = grupos.some(([, sec]) => sec.estudiantes > r.capacidad);
    return { r, i, grupos, over, estado: grupos.length ? 'ocupada' : 'libre' };
  });
  const f = ui.salaFilter || 'all';
  const list = f === 'all' ? info : info.filter((x) => x.estado === f);
  const n = (k) => info.filter((x) => x.estado === k).length;
  const tab = (v, label, count) => `<button data-act="salaFilter" data-v="${v}" aria-pressed="${f === v}">${label} <span class="count">${count}</span></button>`;
  const chips = (x) => x.grupos.map(([k, sec]) => `<span class="sala-chip" style="--c:${careerColor(sec.carrera)}" title="${esc(secLabel(sec))} · ${sec.estudiantes} estudiantes">${k}</span>`).join('');
  const acciones = (x) => `<span class="sala-acc"><button class="btnq sm" data-act="editSala" data-v="${x.r.id}" aria-label="Editar ${esc(x.r.nombre)}">Editar</button><button class="btnq sm danger-q" data-act="delSala" data-v="${x.i}" aria-label="Eliminar ${esc(x.r.nombre)}">Eliminar</button></span>`;
  const tipo = (r) => esc(r.tipo || 'Sala');
  const vacia = '<p class="muted" style="padding:24px">Ninguna sala en este filtro.</p>';
  const cuerpo = `<div class="card" style="padding:4px 8px;margin-top:10px"><div class="tablewrap"><table class="dtable car-tabla" data-pager><thead><tr><th>Sala</th><th>Tipo</th><th class="num">Puestos</th><th>Uso</th><th></th></tr></thead><tbody>
      ${page('salas-' + f, list).map((x) => `<tr>
        <td><span class="l1">${esc(x.r.nombre)}</span></td><td class="small">${tipo(x.r)}</td><td class="num">${x.r.capacidad}</td>
        <td>${x.grupos.length ? `<span class="sala-chips">${chips(x)}</span>` : '<span class="faint small">Libre</span>'}${x.over ? ' <span class="badge bad">Excede capacidad</span>' : ''}</td>
        <td style="text-align:right">${acciones(x)}</td></tr>`).join('') || `<tr><td colspan="5">${vacia}</td></tr>`}
      </tbody></table></div>${pagerHtml('salas-' + f, list.length)}</div>`;
  return `<div class="pagehead"><div><h1>Salas</h1><p class="muted">${S.salas.length} salas · ${seats} puestos</p></div><button class="btnp" data-act="addSala">${icon('plus')}Agregar</button></div>
    <div class="car-bar"><div class="seg" role="group" aria-label="Filtrar">${tab('all', 'Todas', info.length)}${tab('ocupada', 'Ocupadas', n('ocupada'))}${tab('libre', 'Libres', n('libre'))}</div>
</div>
    ${cuerpo}`;
}

// Bloques que empiezan antes de las 17:00 se cruzan con la disponibilidad de mañana (M); el resto, con la de noche (N).
const turnoOf = (inicio, id) => (toMinutes(inicio) < 17 * 60 ? 'M' : 'N') + (id || 'B1').slice(1);
// Bloques de sábado (siempre de mañana): los de la semana si ya son de mañana; si no, los del patrón vespertino actual de TLI.
const satBlocks = (c) => structuredClone(c.bloques.default.every(isSaturdayOk) ? c.bloques.default : SATURDAY_DEFAULT_BLOCKS).map((b) => ({ ...b, turno: 'M' + b.id.slice(1) }));
const semOf = (el) => S.jornadas[el.dataset.j].sems[el.dataset.s];

// ---------- Acciones ----------
const actions = {
  calAdd(el) {
    const v = (id) => document.getElementById(id)?.value?.trim() || '';
    if (el.dataset.k === 'feriados') {
      const fecha = v('fer-fecha');
      if (!fecha) return alert('Elige la fecha del feriado.');
      editCal((c) => { c.feriados = [...(c.feriados || []).filter((x) => x.fecha !== fecha), { fecha, nombre: v('fer-nombre') || 'Feriado' }]; });
    } else {
      const desde = v('rec-desde'), hasta = v('rec-hasta') || desde;
      if (!desde || hasta < desde) return alert('Elige las fechas del receso (desde y hasta).');
      editCal((c) => { c.recesos = [...(c.recesos || []), { desde, hasta, nombre: v('rec-nombre') || 'Receso' }]; });
    }
  },
  calDel(el) {
    const k = el.dataset.k, v = el.dataset.v;
    editCal((c) => { c[k] = (c[k] || []).filter((x) => (k === 'feriados' ? x.fecha : x.desde) !== v); });
  },
  calReset() {
    if (!confirm('¿Volver al calendario referencial de este periodo? Se pierden los cambios.')) return;
    mutate(() => { delete S.calendarios?.[calendarKey(S.periodo)]; });
  },
  async generate() {
    // Propuesta con CP-SAT (servidor). Si el solver no responde, se usa la sugerencia local.
    ui.generating = true; ui.pick = null; render();
    try {
      const r = await fetch('/api/suggest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state: S }) });
      const body = await r.json();
      // 422: el solver respondió pero no hay solución (o lo ya asignado tiene choques). No se usa la local: se explica.
      if (r.status === 422) { alert(body.error); ui.generating = false; render(); return; }
      if (!r.ok) throw new Error(body.error || 'Error del solver');
      ui.sugg = { items: body.items, unplaced: body.unplaced, motor: 'CP-SAT' };
      // La propuesta se ve en Ocupación de salas (también si se pidió desde el asistente).
      ui.modal = null;
      if (route().view !== 'ocupacion') location.hash = '#/ocupacion';
      if (body.aviso) alert(body.aviso);
    } catch (e) {
      try { ui.sugg = { ...suggest(S), motor: 'local' }; alert('El solver no respondió (' + e.message + '). Usé la sugerencia local, menos completa.'); }
      catch (e2) { alert('No se pudo sugerir la distribución: ' + e2.message); }
    }
    ui.generating = false;
    render();
  },
  // Planifica una carrera (sus secciones del periodo) con el solver, respetando lo ya asignado a las demás,
  // y suma sus clases a la ocupación de salas. Si la carrera ya tenía clases, se reemplazan.
  async planCareer(el) {
    const code = el.dataset.k;
    const c = career(code);
    if (!c || ui.generating) return;
    const mias = (id) => id.startsWith(code + '-');
    const tiene = Object.keys(S.manual || {}).some((id) => mias(id) && Object.keys(S.manual[id]).length);
    void tiene;
    ui.generating = true; ui.preview = null; ui.previewErr = null; render();
    try {
      const copia = structuredClone(S);
      for (const id of Object.keys(copia.manual || {})) if (mias(id)) delete copia.manual[id];
      const r = await fetch('/api/suggest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state: copia, carrera: code }) });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || 'Error del solver');
      // Vista previa: el horario como quedaría, calculado sobre una copia (no se guarda hasta confirmar).
      putItems(copia.manual, body.items);
      ui.preview = { code, items: body.items, unplaced: body.unplaced || [], H: buildManual(copia) };
      ui.generating = false;
      render();
    } catch (e) {
      ui.generating = false;
      ui.previewErr = { code, msg: 'No se pudo calcular la propuesta: ' + e.message };
      render();
    }
  },
  confirmPlan() {
    const pv = ui.preview;
    const c = pv && career(pv.code);
    if (!c) return;
    const tiene = Object.keys(S.manual || {}).some((id) => id.startsWith(pv.code + '-') && Object.keys(S.manual[id]).length);
    if (tiene && !confirm(`${c.nombre} ya tenía clases asignadas: se reemplazan por esta propuesta. ¿Continuar?`)) return;
    for (const id of Object.keys(S.manual || {})) if (id.startsWith(pv.code + '-')) delete S.manual[id];
    ui.preview = null; ui.sugg = null; ui.modal = null;
    ui.tabs.mxJor = c.jornada;
    applySugg(pv.items);
    location.hash = '#/ocupacion';
  },
  discardPlan() { const k = ui.preview?.code; ui.preview = null; if (k) ui.steps[k] = 4; render(); },
  acceptSugg(el) {
    const it = ui.sugg?.items[Number(el.dataset.i)];
    if (!it) return;
    applySugg([it]);
  },
  acceptAllSugg() { if (ui.sugg?.items.length) applySugg(ui.sugg.items); },
  discardSugg() { ui.sugg = null; render(); },
  csv() { downloadCsv(); },
  tab(el) { ui.tabs[el.dataset.k] = el.dataset.v; render(); },
  page(el) { ui.pages[el.dataset.k] = Number(el.dataset.v); render(); },
  modal(el) { ui.modal = { v: el.dataset.v, k: el.dataset.k }; render(); },
  closeModal() { closeModal(); },
  pickSlot(el) {
    const sec = S.horario?.secciones.find((x) => x.id === ui.curSec);
    if (!sec) return;
    const d = el.dataset.d, row = { inicio: el.dataset.t, fin: el.dataset.f };
    // Si el bloque es uno de los configurados del semestre, se proponen sus mismos días; si no, solo ese día. Se puede cambiar.
    const bi = sec.dias.includes(d) ? blocksFor(S.jornadas, sec.jornada, d, sec.sem).findIndex((bl) => bl.inicio === row.inicio) : -1;
    const slots = bi < 0 ? [{ d, ...row }]
      : sec.dias.map((dd) => { const bl = blocksFor(S.jornadas, sec.jornada, dd, sec.sem)[bi]; return bl && { d: dd, inicio: bl.inicio, fin: bl.fin }; }).filter(Boolean);
    ui.pick = { secId: sec.id, codigo: null, slots, row };
    render();
  },
  editClass(el) {
    const sec0 = S.horario?.secciones.find((x) => x.id === (el.dataset.sec || ui.curSec)); const it = sec0?.plan.find((x) => x.codigo === el.dataset.v);
    if (!it) return;
    ui.pick = { secId: sec0.id, codigo: it.codigo, edit: true, slots: it.slots.map((x) => ({ ...x })), row: { inicio: it.slots[0].inicio, fin: it.slots[0].fin } };
    render();
  },
  toggleDay(el) {
    const p = ui.pick;
    if (!p) return;
    const d = el.dataset.v;
    const has = p.slots.some((x) => x.d === d);
    if (has && p.slots.length === 1) return; // al menos un día
    p.slots = has ? p.slots.filter((x) => x.d !== d) : [...p.slots, { d, ...p.row }].sort((a, b) => DAYS.indexOf(a.d) - DAYS.indexOf(b.d));
    // Al editar, el cambio de días se guarda al tiro
    if (p.edit) mutate(() => { const m = S.manual[p.secId]?.[p.codigo]; if (m) { m.slots = p.slots.map((x) => ({ ...x })); delete m.b; } }, { stale: false });
    else render();
  },
  cancelPick() { ui.pick = null; render(); },
  placeIn(el) {
    const p = ui.pick;
    if (!p?.codigo) return;
    ui.pick = null;
    mutate(() => {
      const m = (S.manual[p.secId] = S.manual[p.secId] || {});
      const slots = p.slots.map((x) => ({ ...x }));
      if (p.edit && m[p.codigo]) { Object.assign(m[p.codigo], { salaId: el.dataset.v, slots }); delete m[p.codigo].b; return; }
      const o = Math.max(0, ...Object.values(m).map((x) => x.o || 0)) + 1;
      m[p.codigo] = { slots, o, salaId: el.dataset.v };
    }, { stale: false });
  },
  removeClass() {
    const p = ui.pick;
    if (!p) return;
    ui.pick = null;
    mutate(() => { delete S.manual[p.secId]?.[p.codigo]; }, { stale: false });
  },
  hmode(el) { ui.hmode = el.dataset.v; ui.pick = null; render(); },

  roomSlot(el) {
    const row = { inicio: el.dataset.t, fin: el.dataset.f };
    ui.pick = { roomMode: true, salaId: el.dataset.v, secId: null, codigo: null, car: null, sem: null, slots: [{ d: el.dataset.d, ...row }], row };
    render();
  },
  pickSem(el) { if (ui.pick) { ui.pick.sem = Number(el.dataset.v); ui.pick.secId = null; ui.pick.codigo = null; } render(); },
  pickSecBtn(el) { if (ui.pick) { ui.pick.secId = el.dataset.v; ui.pick.codigo = null; } render(); },
  confirmRoom() {
    const p = ui.pick;
    if (!p?.roomMode || !p.secId || !p.codigo) return;
    ui.pick = null;
    mutate(() => {
      const m = (S.manual[p.secId] = S.manual[p.secId] || {});
      const o = Math.max(0, ...Object.values(m).map((x) => x.o || 0)) + 1;
      m[p.codigo] = { slots: p.slots.map((x) => ({ d: x.d, inicio: x.inicio, fin: x.fin })), o, salaId: p.salaId };
    }, { stale: false });
  },
  closeNotice(el) { (ui.notesOff ||= {})[el.dataset.v] = true; render(); },
  dayToggle(el) {
    const c = semOf(el);
    mutate(() => {
      const set = new Set(c.dias);
      if (set.has(el.dataset.v)) set.delete(el.dataset.v); else set.add(el.dataset.v);
      c.dias = DAYS.filter((d) => set.has(d));
      if (set.has('Sa') && !c.bloques.Sa && !c.bloques.default.every(isSaturdayOk)) c.bloques.Sa = satBlocks(c);
    });
  },
  satOwn(el) {
    const c = semOf(el);
    mutate(() => { c.bloques.Sa = satBlocks(c); });
  },
  satSame(el) { const c = semOf(el); mutate(() => { delete c.bloques.Sa; }); },
  // Copia días y bloques de un semestre a otro (o a todos) dentro de la misma jornada.
  copySem(el) {
    const j = S.jornadas[el.dataset.j];
    const from = Number(el.dataset.s);
    const to = el.dataset.to === 'all' ? [1, 2, 3, 4].filter((n) => n !== from) : [Number(el.dataset.to)];
    if (!confirm(`¿Copiar los días y bloques del semestre ${roman(from)} al ${to.length > 1 ? 'resto de los semestres' : 'semestre ' + roman(to[0])}? Se reemplaza lo que tengan.`)) return;
    mutate(() => { for (const n of to) j.sems[n] = structuredClone(j.sems[from]); });
  },
  hy(el) { ui.hy = Number(el.dataset.v); ui.hs = (ui.hy === 2 ? [3, 4] : [1, 2]).find((n) => activeSemesters(S.periodo.paridad).includes(n)) || (ui.hy === 2 ? 3 : 1); ui.week = 1; render(); },
  hs(el) { ui.hs = Number(el.dataset.v); ui.week = 1; render(); },
  hl(el) { ui.hl = el.dataset.v; render(); },
  week(el) { ui.week += Number(el.dataset.v); render(); },
  goWeek(el) { ui.week = Number(el.dataset.v); render(); },
  print() { window.print(); },
  go(el) { location.hash = el.dataset.v; },
  filter(el) { ui.filter = ui.filter === el.dataset.v ? 'all' : el.dataset.v; render(); },
  docFilter(el) { ui.docFilter = ui.docFilter === el.dataset.v ? 'all' : el.dataset.v; render(); },
  viewsec(el) {
    const sec = S.horario?.secciones.find((x) => x.id === el.dataset.v);
    ui.mode = 'seccion';
    if (sec) { ui.hc = sec.carrera; ui.hs = sec.sem; ui.hy = sec.sem <= 2 ? 1 : 2; ui.hl = sec.letra; }
  },
  malla(el) { ui.malla = ui.malla === el.dataset.v ? null : el.dataset.v; render(); },
  step(el) {
    const arg = wizCode();
    ui.steps[arg] = Math.min(STEP_LABELS.length, Math.max(1, Number(el.dataset.v)));
    ui.rows = null;
    if (ui.steps[arg] === 5 && ui.preview?.code !== arg && !ui.generating) return actions.planCareer({ dataset: { k: arg } });
    render();
  },
  secs(el) {
    const arg = wizCode();
    mutate(() => {
      const of = ofertaOf(arg, el.dataset.sem);
      of.secciones = Math.max(0, Math.min(8, (of.secciones || 0) + Number(el.dataset.v)));
      S.oferta[arg][el.dataset.sem] = of;
    });
  },
  suggest(el) {
    const arg = wizCode();
    if (el.dataset.v === 'all' && !confirm('¿Rehacer la sugerencia de docentes de esta carrera? Se reemplazan las asignaciones actuales.')) return;
    mutate(() => { S.asignaciones = suggestAssignments(S, { careerCode: arg, overwrite: el.dataset.v === 'all' }).asignaciones; });
  },
  addDoc() {
    const id = 'd' + Date.now().toString(36);
    mutate(() => S.docentes.push({ id, nombre: 'Nuevo docente', especialidad: '', materias: [], disponibilidad: ALL_SLOTS.slice(), tope: null, otraCarga: 0, correo: '', telefono: '' }));
    ui.editDoc = id;
    ui.modal = { v: 'doc' };
    render();
  },
  editDoc(el) {
    ui.editDoc = el.dataset.v || null;
    ui.modal = ui.editDoc ? { v: 'doc' } : null;
    ui.tabs.docTab = 'ficha';
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
  pickAv() { ui.pickAv = !ui.pickAv; render(); },
  setFun(el) { ui.pickAv = false; mutate(() => { const d = S.docentes.find((x) => x.id === ui.editDoc); d.fun = Number(el.dataset.v); delete d.foto; }, { stale: false }); },
  rmFoto() { ui.pickAv = false; mutate(() => { const d = S.docentes.find((x) => x.id === ui.editDoc); delete d.foto; delete d.fun; }, { stale: false }); },
  // Quitar una asignatura del historial: sale de su lista y, si la tenía asignada, también de la asignación.
  rmHist(el) {
    const d = S.docentes.find((x) => x.id === ui.editDoc);
    const name = el.dataset.v;
    const codes = S.carreras.flatMap((c) => c.semestres.flatMap((s) => s.asignaturas)).filter((a) => a.nombre === name && S.asignaciones[a.codigo] === d.id).map((a) => a.codigo);
    if (codes.length && !confirm(`¿Quitar «${name}» a ${d.nombre}? También queda sin docente en ${S.periodo.nombre} y habrá que volver a generar el horario.`)) return;
    mutate(() => {
      d.materias = d.materias.filter((m) => m !== name);
      for (const k of codes) delete S.asignaciones[k];
    }, { stale: codes.length > 0 });
  },
  addSala() { const id = 's' + Date.now().toString(36); ui.modal = { v: 'sala', k: id }; mutate(() => S.salas.push({ id, nombre: `Sala ${S.salas.length + 1}`, capacidad: 30, tipo: 'Sala' })); },
  editSala(el) { ui.modal = { v: 'sala', k: el.dataset.v }; render(); app.querySelector('.modal input')?.focus(); },
  salaFilter(el) { ui.salaFilter = el.dataset.v; ui.rows = null; render(); },
  // Eliminar una sala: avisa si la usa alguna sección; se quita también de las salas elegidas por sección.
  delSala(el) {
    const rm = S.salas[Number(el.dataset.v)];
    if (!rm) return;
    const grupos = [...(usoSalas()[rm.id]?.keys() || [])];
    if (!confirm(`¿Eliminar ${rm.nombre}?${grupos.length ? `\n\nLa usan ${grupos.join(', ')}: esas clases quedarán sin sala hasta volver a planificar.` : ''}\n\nEsta acción no se puede deshacer.`)) return;
    ui.modal = null;
    mutate(() => {
      S.salas = S.salas.filter((x) => x.id !== rm.id);
      for (const [sid, salaId] of Object.entries(S.salaSeccion || {})) if (salaId === rm.id) delete S.salaSeccion[sid];
    });
  },
  backup() {
    const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
    download(blob, `planificador-respaldo-${new Date().toISOString().slice(0, 10)}.json`);
  },
  async reset(el) {
    const v = el.dataset.v === '0' ? '0' : el.dataset.v === 'varias' ? 'varias' : '1';
    if (!confirm(v === '0' ? '¿Borrar docentes, salas, matrícula, asignaciones y horarios? Las mallas se mantienen.\n\nEsta acción no se puede deshacer.' : '¿Reemplazar todos los datos por los datos de prueba?\n\nLos datos actuales se pierden.')) return;
    const r = await fetch(`/api/reset?demo=${v}`, { method: 'POST' });
    if (!r.ok) return alert('No se pudo completar: ' + r.status);
    S = await r.json();
    ui.preview = null; ui.sugg = null; ui.pick = null;
    ui.saveMsg = v === '0' ? 'Datos limpiados' : 'Datos de prueba cargados';
    location.hash = '#/horario';
    render();
  }
};

const changes = {
  salaSeccion(el) { ui.preview = null; mutate(() => { S.salaSeccion = S.salaSeccion || {}; if (el.value) S.salaSeccion[el.dataset.k] = el.value; else delete S.salaSeccion[el.dataset.k]; }, { stale: false }); },
  calField(el) {
    const k = el.dataset.k;
    if (['horasSemana', 'horasSabado'].includes(k)) { const v = Math.max(1, Math.min(8, Number(el.value) || 3)); editCal((c) => { c[k] = v; }); }
    else if (el.value) editCal((c) => { c[k] = el.value; });
  },
  periodo(el) {
    const [anio, paridad] = el.value.split('|');
    if (!Number(anio) || !['par', 'impar'].includes(paridad)) { render(); return; }
    const n = S.horario?.resumen?.asignadas || 0;
    if (n && !confirm(`Al cambiar a ${periodName(Number(anio), paridad)} se borran las ${n} clases asignadas en ${S.periodo.nombre}. ¿Continuar?`)) { render(); return; }
    mutate(() => { S.periodo = { anio: Number(anio), paridad, nombre: periodName(Number(anio), paridad) }; S.horario = null; S.manual = {}; }, { stale: false });
  },
  pickCar(el) { if (ui.pick) { ui.pick.car = el.value; ui.pick.secId = null; ui.pick.codigo = null; } render(); },
  sel(el) { ui.sel = el.value; render(); },
  pickSubject(el) { if (ui.pick) ui.pick.codigo = el.value; render(); },
  hc(el) { ui.hc = el.value; ui.week = 1; render(); },
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
    const c = semOf(el);
    mutate(() => {
      const b = c.bloques[el.dataset.k][Number(el.dataset.i)];
      b[el.dataset.f] = el.value;
      b.turno = el.dataset.k === 'Sa' ? 'M' + b.id.slice(1) : turnoOf(b.inicio, b.id);
    });
  },
  confirmado(el) { mutate(() => { S.jornadas[el.dataset.j].confirmado = el.checked; }, { stale: false }); },
  jorBlock(el) {
    if (!/^\d{2}:\d{2}$/.test(el.value)) return render();
    const jn = el.dataset.j, k = el.dataset.k, i = Number(el.dataset.i);
    const base = structuredClone(k === 'Sa' ? satDeJornada(jn) : S.jornadas[jn].sems[1].bloques.default);
    base[i][el.dataset.f] = el.value;
    for (const b of base) b.turno = k === 'Sa' ? 'M' + b.id.slice(1) : turnoOf(b.inicio, b.id);
    mutate(() => { for (const n of [1, 2, 3, 4]) S.jornadas[jn].sems[n].bloques[k] = structuredClone(base); });
  },
  asignar(el) { mutate(() => { if (el.value) S.asignaciones[el.dataset.cod] = el.value; else delete S.asignaciones[el.dataset.cod]; }); },
  cupo(el) { mutate(() => { S.reglas.cupo = Math.max(5, Number(el.value) || 30); }); },
  diasFijos(el) { mutate(() => { const set = new Set(S.reglas.diasFijos || []); if (el.checked) set.add(el.dataset.v); else set.delete(el.dataset.v); S.reglas.diasFijos = [...set]; }, { stale: false }); },
  tope(el) { mutate(() => { S.reglas.tope = Math.max(1, Math.min(12, Number(el.value) || 12)); }); },
  docField(el) {
    const f = el.dataset.f;
    // Los datos de contacto no cambian el horario: no lo marcan como desactualizado.
    const contact = f === 'correo' || f === 'telefono';
    mutate(() => {
      const d = S.docentes.find((x) => x.id === ui.editDoc);
      if (f === 'tope') d.tope = el.value === '' ? null : Math.max(1, Math.min(12, Number(el.value)));
      else if (f === 'otraCarga') d.otraCarga = Math.max(0, Number(el.value) || 0);
      else d[f] = el.value.trim();
    }, { stale: !contact });
  },
  // Foto de perfil: se recorta al centro y se reduce a 192 px (JPEG) para que el respaldo siga liviano.
  async foto(el) {
    const file = el.files?.[0];
    if (!file) return;
    try {
      if (!file.type.startsWith('image/')) throw new Error('Elige un archivo de imagen.');
      const img = await createImageBitmap(file);
      const side = Math.min(img.width, img.height);
      const cv = document.createElement('canvas');
      cv.width = cv.height = 192;
      cv.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 192, 192);
      const url = cv.toDataURL('image/jpeg', 0.85);
      ui.pickAv = false;
      mutate(() => { const d = S.docentes.find((x) => x.id === ui.editDoc); d.foto = url; delete d.fun; }, { stale: false });
    } catch (e) { alert('No se pudo cargar la foto: ' + e.message); }
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
      S = migrateState(data);
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
  const sinSala = (id) => (id ? salaName(id) : 'Sin sala');
  for (const x of H.sesiones) {
    const s = secById[x.seccionId];
    rows.push([s.carreraNombre, roman(s.sem), s.letra, x.nombre, docName(x.docenteId), sinSala(x.salaId), DAY_NAMES[x.dia], x.inicio, x.fin, x.desde, x.hasta]);
  }
  const csv = '﻿' + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `horario-${S.periodo.nombre.replace(/\s+/g, '-').toLowerCase()}.csv`);
}

load().catch((e) => { app.innerHTML = `<main><div class="note bad">No se pudo conectar con el servidor del planificador (${esc(e.message)}). ¿Está corriendo «npm start»?</div></main>`; });
