// Interfaz del planificador. Vistas: Horario, Carreras (con asistente de 5 pasos), Docentes, Salas, Respaldo.
import { solve } from '/src/core/solver.js';
import { suggestAssignments, qualifiedTeachers, canTeach, teacherNeeds, availableForLevel, estimatedLoad, neededSubjects } from '/src/core/assign.js';
import { activeSemesters, DAYS, DAY_NAMES, TURNOS, roman, cohortDays, blocksFor, levelOf } from '/src/core/calendar.js';
import { candidatePlans, moduleWeeks } from '/src/core/modules.js';
import { ALL_SLOTS, periodName } from '/src/core/initial.js';

let S = null; // estado persistido
const ui = { steps: {}, mode: 'seccion', sel: null, week: 1, editDoc: null, docQuery: '', malla: null, generating: false, saveMsg: '', tab2: {}, showAllConf: false };
const app = document.getElementById('app');

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TONES = ['#DDEFF1', '#E7E6F4', '#EEECE6', '#E3EEE4', '#FCEBCF', '#F6E1DB', '#E2ECF7', '#F3E6EF'];
const docName = (id) => S.docentes.find((d) => d.id === id)?.nombre || 'Sin docente';
const salaName = (id) => S.salas.find((r) => r.id === id)?.nombre || 'Sin sala';
const career = (code) => S.carreras.find((c) => c.codigo === code);
const secLabel = (sec) => `${sec.carrera} ${roman(sec.sem)}-${sec.letra}`;

// ---------- Persistencia ----------
async function load() {
  const r = await fetch('/api/state');
  S = await r.json();
  render();
}
let saveTimer = null;
function save() {
  ui.saveMsg = 'Guardando…';
  paintSave();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const r = await fetch('/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(S) });
      ui.saveMsg = r.ok ? 'Cambios guardados' : 'No se pudo guardar';
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
window.addEventListener('hashchange', () => { window.scrollTo(0, 0); render(); });

function render() {
  if (!S) return;
  const { view, arg } = route();
  let body = '';
  if (view === 'carreras' && arg) body = viewWizard(arg);
  else if (view === 'carreras') body = viewCarreras();
  else if (view === 'docentes') body = viewDocentes();
  else if (view === 'salas') body = viewSalas();
  else if (view === 'respaldo') body = viewRespaldo();
  else body = viewHorario();
  const navView = view === 'carreras' ? 'carreras' : view;
  app.innerHTML = header(navView) + `<main>${S.datosDeEjemplo ? demoBanner() : ''}${body}</main>`;
  bind();
}

function header(active) {
  const link = (v, label) => `<a href="#/${v}" ${active === v || (v === 'horario' && !['carreras', 'docentes', 'salas', 'respaldo'].includes(active)) ? 'aria-current="page"' : ''}>${label}</a>`;
  return `<header class="top">
    <div class="brand"><b>Planificador</b><span>CFT Juan Bohon · ${esc(S.periodo.nombre)}</span></div>
    <nav class="nav" aria-label="Menú principal">${link('horario', 'Horario')}${link('carreras', 'Carreras')}${link('docentes', 'Docentes')}${link('salas', 'Salas')}${link('respaldo', 'Respaldo')}</nav>
    <div class="topright">
      <label class="row" style="gap:6px">Periodo
        <select data-change="periodo" aria-label="Periodo">
          ${[2026, 2027, 2028].flatMap((y) => ['impar', 'par'].map((p) => `<option value="${y}|${p}" ${S.periodo.anio === y && S.periodo.paridad === p ? 'selected' : ''}>${periodName(y, p)}</option>`)).join('')}
        </select></label>
      <span id="savemsg" aria-live="polite">${esc(ui.saveMsg)}</span>
    </div>
  </header>`;
}

function demoBanner() {
  return `<div class="banner"><span><b>Datos de ejemplo:</b> los docentes, salas y la matrícula son ficticios. Las mallas de las 15 carreras son las publicadas en juanbohon.cl.</span>
    <a class="btnq" href="#/respaldo">Empezar con datos reales →</a></div>`;
}

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
  const checklist = needsChecklist();
  const head = `<div class="pagehead">
      <div><div class="kicker">${esc(S.periodo.nombre)} · semestres ${activeSemesters(S.periodo.paridad).map(roman).join(' y ')}</div><h1>Horario sin choques</h1></div>
      <div class="row">
        ${H ? '<button class="btn" data-act="csv">Exportar CSV</button>' : ''}
        <button class="btnp" data-act="generate" ${ui.generating ? 'disabled' : ''}>${ui.generating ? 'Generando…' : H ? 'Volver a generar' : 'Generar horario'}</button>
      </div></div>`;
  if (!H) {
    return head + `<div class="card"><h2>Aún no hay horario para ${esc(S.periodo.nombre)}</h2>
      <p class="muted">El generador necesita estas cuatro cosas. Puedes avanzar por carrera: no hace falta tener toda la sede lista.</p>
      <div class="grid-auto">${checklist.map(([t, d, k, href], i) => `<a href="${href}" class="card" style="border:1px solid var(--line);text-decoration:none;color:inherit;gap:6px">
        <div class="row" style="justify-content:space-between"><b>${i + 1}. ${t}</b><span class="pill ${k}">${k === 'ok' ? 'Listo' : k === 'warn' ? 'Revisar' : 'Falta'}</span></div><span class="muted small">${esc(d)}</span></a>`).join('')}</div>
      <div class="row"><a class="btnp" href="#/carreras">Planificar una carrera →</a></div></div>`;
  }
  const r = H.resumen;
  const stat = (n, label, good) => `<div class="stat ${good ? 'okc' : 'badc'}"><b>${n}</b><span>${label}</span></div>`;
  const conf = H.conflictos;
  const shown = ui.showAllConf ? conf : conf.slice(0, 8);
  return head + `
    ${H.desactualizado ? '<div class="note warn">Cambiaste datos después de generar este horario. Vuelve a generarlo para incluir los cambios.</div>' : ''}
    <div class="stats">
      <div class="stat"><b>${r.secciones}</b><span>secciones · ${r.sesionesSemana} sesiones por semana</span></div>
      ${stat(r.choquesDocente, 'choques de docentes', !r.choquesDocente)}
      ${stat(r.sinDocente, 'asignaturas sin docente', !r.sinDocente)}
      ${stat(r.salas, 'problemas de salas', !r.salas)}
      ${stat(r.disponibilidad + r.tope, 'fuera de disponibilidad o tope', !(r.disponibilidad + r.tope))}
    </div>
    ${conf.length ? `<div class="card"><h2>Qué revisar (${conf.length})</h2><ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px">${shown.map((c) => `<li><span class="pill ${c.tipo === 'sin-docente' ? 'warn' : 'bad'}">${esc(tipoLabel(c.tipo))}</span> ${esc(c.mensaje)}</li>`).join('')}</ul>
      ${conf.length > 8 ? `<button class="btnq" data-act="toggleConf">${ui.showAllConf ? 'Ver menos' : `Ver los ${conf.length}`}</button>` : ''}</div>` : '<div class="note ok">Sin choques de docentes, secciones ni salas.</div>'}
    ${H.avisos.length ? `<div class="note warn">${H.avisos.map(esc).join('<br>')}</div>` : ''}
    ${viewer(H)}
    <p class="muted small">Generado el ${new Date(H.generadoEn).toLocaleString('es-CL')} · ${H.meta?.iteraciones ?? 0} iteraciones${H.meta?.ms ? ` en ${(H.meta.ms / 1000).toFixed(1)} s` : ''}.</p>`;
}

function tipoLabel(t) {
  return { docente: 'Choque', 'sin-docente': 'Sin docente', disponibilidad: 'Disponibilidad', tope: 'Tope', sala: 'Sala', capacidad: 'Capacidad' }[t] || t;
}

function viewer(H) {
  const modes = [['seccion', 'Por sección'], ['docente', 'Por docente'], ['sala', 'Por sala']];
  let options = [];
  if (ui.mode === 'seccion') options = H.secciones.map((s) => [s.id, `${secLabel(s)} · ${s.carreraNombre}`]);
  if (ui.mode === 'docente') options = [...new Set(H.sesiones.map((x) => x.docenteId).filter(Boolean))].map((id) => [id, docName(id)]).sort((a, b) => a[1].localeCompare(b[1]));
  if (ui.mode === 'sala') options = [...new Set(H.sesiones.map((x) => x.salaId).filter(Boolean))].map((id) => [id, salaName(id)]);
  if (!options.some((o) => o[0] === ui.sel)) ui.sel = options[0]?.[0] || null;
  const maxW = H.semanasMax || 22;
  ui.week = Math.min(Math.max(1, ui.week), maxW);
  const ses = H.sesiones.filter((x) => (ui.mode === 'seccion' ? x.seccionId : ui.mode === 'docente' ? x.docenteId : x.salaId) === ui.sel && x.desde <= ui.week && x.hasta >= ui.week);
  const sec = ui.mode === 'seccion' ? H.secciones.find((s) => s.id === ui.sel) : null;
  return `<div class="card">
    <div class="row" style="justify-content:space-between">
      <div class="seg" role="group" aria-label="Ver horario">${modes.map(([m, l]) => `<button data-act="mode" data-v="${m}" aria-pressed="${ui.mode === m}">${l}</button>`).join('')}</div>
      <div class="row">
        <select data-change="sel" aria-label="Elegir">${options.map(([v, l]) => `<option value="${esc(v)}" ${v === ui.sel ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
        <label class="row" style="gap:6px">Semana <button class="sq" data-act="week" data-v="-1" aria-label="Semana anterior">−</button><b style="min-width:28px;text-align:center">${ui.week}</b><button class="sq" data-act="week" data-v="1" aria-label="Semana siguiente">+</button><span class="muted small">de ${maxW}</span></label>
      </div>
    </div>
    ${sec ? `<p class="muted">${esc(sec.carreraNombre)} · semestre ${roman(sec.sem)} · ${esc(sec.jornada.toLowerCase())} · ${sec.dias.map((d) => DAY_NAMES[d]).join(', ')} · ${esc(salaName(sec.salaId))} · ${sec.estudiantes} estudiantes</p>` : ''}
    <div class="tablewrap">${weekGrid(ses, H)}</div>
    ${sec ? `<h3>Plan de módulos · ${sec.semanas} semanas</h3><div class="tablewrap">${gantt(sec.plan, sec.semanas, (it) => docName(it.docenteId), ui.week)}</div>` : ''}
    ${ui.mode === 'docente' && H.cargaDocentes[ui.sel] ? loadBars(H.cargaDocentes[ui.sel], maxW) : ''}
  </div>`;
}

// Filas: en una sección, «Bloque 1 / Bloque 2» (el sábado tiene otro horario y se muestra en la celda).
// Para docentes y salas, que pueden mezclar jornadas, una fila por turno (mañana o noche).
function weekGrid(ses, H) {
  if (!ses.length) return '<p class="muted">Sin clases esta semana.</p>';
  const bySection = ui.mode === 'seccion';
  const rowOf = (x) => (bySection ? x.turno.slice(1) : x.turno);
  const ROWS = bySection ? [['1', 'Bloque 1'], ['2', 'Bloque 2']] : TURNOS.map((t) => [t.id, t.nombre]);
  const used = new Set(ses.map(rowOf));
  const rows = ROWS.filter(([id]) => used.has(id));
  const byKey = {};
  for (const x of ses) {
    const k = `${x.dia}|${rowOf(x)}`;
    (byKey[k] = byKey[k] || []).push(x);
  }
  const secById = Object.fromEntries(H.secciones.map((s) => [s.id, s]));
  let html = `<div class="week" style="grid-template-columns:110px repeat(6,minmax(0,1fr))"><div></div>${DAYS.map((d) => `<div class="dh">${DAY_NAMES[d]}</div>`).join('')}`;
  for (const [id, label] of rows) {
    html += `<div class="th2"><b>${label}</b></div>`;
    for (const d of DAYS) {
      const list = byKey[`${d}|${id}`] || [];
      if (!list.length) { html += '<div class="cell empty"></div>'; continue; }
      const x = list[0];
      const sub = ui.mode === 'seccion' ? `${docName(x.docenteId)} · ${salaName(x.salaId)}` : ui.mode === 'docente' ? `${secLabel(secById[x.seccionId])} · ${salaName(x.salaId)}` : `${secLabel(secById[x.seccionId])} · ${docName(x.docenteId)}`;
      html += `<div class="cell ${list.length > 1 ? 'clash' : ''}" style="background:${tone(x.codigo)}"><span class="small muted">${x.inicio}–${x.fin}</span><b>${esc(x.nombre)}</b><span>${esc(sub)}</span>${list.length > 1 ? `<span class="pill bad">+${list.length - 1} a la misma hora</span>` : ''}</div>`;
    }
  }
  return html + '</div>';
}

function tone(codigo) {
  let h = 0;
  for (const c of codigo) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}

function gantt(items, weeks, who, currentWeek = null) {
  const cols = `220px repeat(${weeks}, minmax(0,1fr))`;
  let html = `<div class="gantt"><div class="gr" style="grid-template-columns:${cols};min-height:28px;border-bottom:1px solid #DCE6E8"><div class="gname muted small">Asignatura · semana →</div>${Array.from({ length: weeks }, (_, i) => `<div class="wk" style="${currentWeek === i + 1 ? 'font-weight:700;color:var(--ink)' : ''}">${i + 1}</div>`).join('')}</div>`;
  for (const it of items) {
    const label = `Sem. ${it.desde}–${it.hasta} · ${it.horas} h${who ? ' · ' + esc(who(it)) : ''}`;
    html += `<div class="gr" style="grid-template-columns:${cols}"><div class="gname">${esc(it.nombre)}</div><div class="bar" title="${esc(it.nombre)} · ${label}" style="grid-column:${it.desde + 1} / ${it.hasta + 2};background:${tone(it.codigo)}">${label}</div></div>`;
  }
  return html + '</div>';
}

function loadBars(c, maxW) {
  const tope = c.tope;
  const top = Math.max(tope, ...c.porSemana.map((v) => v + c.otra), 1);
  return `<div><h3>Sesiones por semana (incluye ${c.otra} de otros cursos) · tope ${tope}</h3>
    <div class="bars" role="img" aria-label="Carga semanal del docente">${c.porSemana.slice(0, maxW).map((v, i) => `<div class="${v + c.otra > tope ? 'over' : ''}" title="Semana ${i + 1}: ${v + c.otra} sesiones" style="height:${((v + c.otra) / top) * 100}%"></div>`).join('')}</div>
    <p class="muted small">Pico: ${c.pico + c.otra} sesiones en una semana.</p></div>`;
}

// ---------- Vista: Carreras ----------
function viewCarreras() {
  const sems = activeSemesters(S.periodo.paridad);
  const rows = S.carreras.map((c) => {
    const secs = sems.reduce((t, s) => t + (S.oferta?.[c.codigo]?.[s]?.secciones || 0), 0);
    const missing = neededSubjects(S, c.codigo).filter((n) => !S.asignaciones[n.asignatura.codigo]).length;
    const status = !secs ? ['Sin oferta', 'neutral'] : missing ? [`${missing} sin docente`, 'warn'] : ['Lista para generar', 'ok'];
    const conf = S.jornadas[c.jornada]?.confirmado;
    return `<tr>
      <td><b>${c.codigo}</b></td><td>${esc(c.nombre)}</td>
      <td>${c.jornada}${conf ? '' : ' <span class="pill warn" title="Días y bloques por confirmar">supuesto</span>'}</td>
      <td>${sems.map(roman).join(' y ')}</td><td>${secs}</td>
      <td><span class="pill ${status[1]}">${status[0]}</span></td>
      <td class="row" style="flex-wrap:nowrap"><button class="btnq" data-act="malla" data-v="${c.codigo}">${ui.malla === c.codigo ? 'Ocultar malla' : 'Ver malla'}</button><a class="btn" href="#/carreras/${c.codigo}">Planificar</a></td>
    </tr>${ui.malla === c.codigo ? `<tr><td colspan="7">${malla(c)}</td></tr>` : ''}`;
  }).join('');
  return `<div class="pagehead"><div><div class="kicker">${esc(S.periodo.nombre)}</div><h1>Carreras</h1><p class="muted">Las 15 carreras publicadas en juanbohon.cl, con sus mallas. En este periodo se dictan los semestres ${sems.map(roman).join(' y ')}.</p></div></div>
    <div class="card tablewrap"><table><thead><tr><th>Código</th><th>Carrera</th><th>Jornada</th><th>Semestres</th><th>Secciones</th><th>Estado</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function malla(c) {
  return `<div class="malla">${c.semestres.map((s) => `<div class="sem"><h3>Semestre ${roman(s.n)} · ${s.horas} h</h3>${s.asignaturas.map((a) => `<div class="asg ${a.transversal ? 'tr' : ''}"><span>${esc(a.nombre)}</span><b>${a.horas}</b></div>`).join('')}</div>`).join('')}</div>
    <p class="muted small" style="margin-top:8px">Fuente: <a href="${esc(c.fuente?.malla_pdf)}" target="_blank" rel="noopener">malla oficial (PDF)</a>. En amarillo, asignaturas transversales.</p>`;
}

// ---------- Vista: Asistente por carrera ----------
const STEP_LABELS = ['Oferta', 'Asignaturas', 'Docentes', 'Reglas y salas', 'Generar'];

function viewWizard(code) {
  const c = career(code);
  if (!c) return '<p>Carrera no encontrada. <a href="#/carreras">Volver</a></p>';
  const step = ui.steps[code] || 1;
  const sems = activeSemesters(S.periodo.paridad);
  const stepper = `<div class="stepper">${STEP_LABELS.map((l, i) => `<button data-act="step" data-v="${i + 1}" class="${i + 1 < step ? 'done' : ''}" ${i + 1 === step ? 'aria-current="step"' : ''}><span class="n">${i + 1 < step ? '✓' : i + 1}</span>${l}</button>`).join('')}</div>`;
  let body = '';
  if (step === 1) body = wizOferta(c, sems);
  if (step === 2) body = wizAsignaturas(c, sems);
  if (step === 3) body = wizDocentes(c, sems);
  if (step === 4) body = wizReglas(c, sems);
  if (step === 5) body = wizGenerar(c);
  return `<div class="pagehead"><div><div class="kicker"><a href="#/carreras">Carreras</a> · ${esc(S.periodo.nombre)}</div><h1>Planificar ${esc(c.nombre)}</h1></div></div>
    ${stepper}<div class="card">${body}</div>
    <div class="row" style="justify-content:space-between"><button class="btn" data-act="step" data-v="${step - 1}" ${step === 1 ? 'disabled' : ''}>← Atrás</button>${step < 5 ? `<button class="btnp" data-act="step" data-v="${step + 1}">Siguiente →</button>` : '<a class="btnp" href="#/horario">Ver horario de la sede</a>'}</div>`;
}

function ofertaOf(code, sem) {
  S.oferta[code] = S.oferta[code] || {};
  return S.oferta[code][sem] || { estudiantes: 0, secciones: 0 };
}

function wizOferta(c, sems) {
  return `<h2>¿Cuántas secciones abre ${esc(c.codigo)} en ${esc(S.periodo.nombre)}?</h2>
    <p class="muted">Con el cupo de ${S.reglas.cupo} estudiantes por sección el sistema sugiere cuántas abrir. Puedes ajustarlo.</p>
    <div class="grid-auto">${sems.map((sem) => {
      const of = ofertaOf(c.codigo, sem);
      const sug = Math.max(of.estudiantes ? 1 : 0, Math.ceil((of.estudiantes || 0) / S.reglas.cupo));
      const days = cohortDays(S.jornadas, c.jornada, sem);
      const per = of.secciones ? Math.ceil(of.estudiantes / of.secciones) : 0;
      return `<div class="card" style="border:1px solid var(--line)">
        <h3>Semestre ${roman(sem)} · ${levelOf(sem)}º año</h3>
        <p class="muted small">${esc(c.jornada)} · ${days.map((d) => DAY_NAMES[d]).join(', ')}</p>
        <label class="field">Estudiantes proyectados<input type="number" min="0" value="${of.estudiantes || 0}" data-change="estudiantes" data-sem="${sem}" data-code="${c.codigo}"></label>
        <div class="row"><span class="small" style="font-weight:600;color:var(--muted)">Secciones</span>
          <button class="sq" data-act="secs" data-sem="${sem}" data-v="-1" aria-label="Menos secciones">−</button>
          <b style="font-family:'Space Grotesk';font-size:26px;min-width:30px;text-align:center">${of.secciones || 0}</b>
          <button class="sq" data-act="secs" data-sem="${sem}" data-v="1" aria-label="Más secciones">+</button></div>
        <p class="small">${of.secciones ? `≈ ${per} estudiantes por sección.` : 'No abre en este periodo.'} ${sug !== (of.secciones || 0) ? `<span class="muted">Sugerido: ${sug}.</span>` : ''}</p>
      </div>`;
    }).join('')}</div>
    <div class="note neutral">Cada sección de ${esc(c.jornada.toLowerCase())} usa 3 días con 2 bloques: 6 sesiones por semana. Un docente puede dictar como máximo 6 sesiones por semana en un mismo nivel de una carrera.</div>`;
}

function wizAsignaturas(c, sems) {
  const tabKey = c.codigo;
  const tab = ui.tab2[tabKey] || 'lista';
  return `<h2>Asignaturas del periodo</h2>
    <p class="muted">Desde la malla oficial. Cada asignatura se dicta como un módulo de 3 sesiones por semana; dos módulos van en paralelo.</p>
    <div class="tabs" role="tablist"><button role="tab" data-act="tab2" data-v="lista" aria-selected="${tab === 'lista'}">Asignaturas</button><button role="tab" data-act="tab2" data-v="gantt" aria-selected="${tab === 'gantt'}">Carta Gantt</button></div>
    ${sems.map((sem) => {
      const s = c.semestres[sem - 1];
      const secs = S.oferta?.[c.codigo]?.[sem]?.secciones || 0;
      const plan = candidatePlans(s.asignaturas, 1)[0];
      const items = plan.items.map((it) => ({ ...it, ...s.asignaturas.find((a) => a.codigo === it.codigo) })).sort((a, b) => a.desde - b.desde || a.carril - b.carril);
      return `<h3 style="margin-top:6px">Semestre ${roman(sem)} · ${s.horas} h ${secs ? `· ${secs} sección(es)` : '<span class="pill neutral">no abre</span>'}</h3>
        ${tab === 'lista' ? `<div class="tablewrap"><table><thead><tr><th>Asignatura</th><th>Horas</th><th>Sesiones de 3 h</th><th>Módulo</th></tr></thead><tbody>${s.asignaturas.map((a) => `<tr><td><b>${esc(a.nombre)}</b> ${a.transversal ? '<span class="pill warn">transversal</span>' : ''}</td><td>${a.horas}</td><td>${a.sesiones}</td><td class="muted">${moduleWeeks(a.horas)} semanas</td></tr>`).join('')}</tbody></table></div>`
        : `<div class="tablewrap">${gantt(items, plan.semanas, (it) => docName(S.asignaciones[it.codigo]))}</div><p class="muted small">Orden de referencia: el generador lo reordena para evitar choques entre docentes.${s.semanas_impresas && plan.semanas > s.semanas_impresas ? ` Ocupa ${plan.semanas} semanas; la malla indica ${s.semanas_impresas}.` : ''}</p>`}`;
    }).join('')}`;
}

function wizDocentes(c, sems) {
  const needs = teacherNeeds(S, c.codigo);
  const load = estimatedLoad(S, S.asignaciones);
  const involved = new Set();
  const tables = sems.map((sem) => {
    const secs = S.oferta?.[c.codigo]?.[sem]?.secciones || 0;
    if (!secs) return `<p class="muted">Semestre ${roman(sem)}: no abre en este periodo.</p>`;
    const s = c.semestres[sem - 1];
    return `<h3>Semestre ${roman(sem)} · ${secs} sección(es)</h3><div class="tablewrap"><table><thead><tr><th>Asignatura</th><th>Horas</th><th>Docente</th><th>Aviso</th></tr></thead><tbody>${s.asignaturas.map((a) => {
      const cur = S.asignaciones[a.codigo] || '';
      if (cur) involved.add(cur);
      const qual = qualifiedTeachers(S, a.nombre);
      const others = S.docentes.filter((d) => !qual.includes(d));
      const doc = S.docentes.find((d) => d.id === cur);
      let warn = '';
      if (!cur) warn = qual.length ? '<span class="pill warn">Sin asignar</span>' : '<span class="pill bad">Nadie la tiene en sus asignaturas</span>';
      else if (!canTeach(doc, a.nombre)) warn = '<span class="pill warn">No está en sus asignaturas</span>';
      else if (!availableForLevel(S, doc, c, sem)) warn = '<span class="pill bad">No puede todos los días del nivel</span>';
      return `<tr><td><b>${esc(a.nombre)}</b></td><td>${a.horas}</td><td><select data-change="asignar" data-cod="${a.codigo}" aria-label="Docente de ${esc(a.nombre)}">
        <option value="">— Sin asignar —</option>
        ${qual.length ? `<optgroup label="Dictan esta asignatura">${qual.map((d) => `<option value="${d.id}" ${d.id === cur ? 'selected' : ''}>${esc(d.nombre)}</option>`).join('')}</optgroup>` : ''}
        ${others.length ? `<optgroup label="Otros docentes">${others.map((d) => `<option value="${d.id}" ${d.id === cur ? 'selected' : ''}>${esc(d.nombre)}</option>`).join('')}</optgroup>` : ''}
      </select></td><td>${warn}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  }).join('');
  const cards = [...involved].map((id) => {
    const d = S.docentes.find((x) => x.id === id);
    const mine = neededSubjects(S, c.codigo).filter((n) => S.asignaciones[n.asignatura.codigo] === id);
    return `<div class="card" style="border:1px solid var(--line);gap:6px"><b>${esc(d?.nombre)}</b><span class="muted small">${esc(d?.especialidad || '')}</span>
      <span class="small">${mine.map((n) => `• ${esc(n.asignatura.nombre)} (${roman(n.sem)})`).join('<br>')}</span>
      <span class="pill neutral">${load[id] || 0} h en el periodo (todas las carreras)</span></div>`;
  }).join('');
  return `<div class="row" style="justify-content:space-between"><div><h2>¿Quién dicta cada asignatura?</h2><p class="muted">Un docente puede sumar varias asignaturas. El generador revisa que no le choquen.</p></div>
      <div class="row"><button class="btn" data-act="suggest" data-v="missing">Sugerir los que faltan</button><button class="btnq" data-act="suggest" data-v="all">Rehacer toda la sugerencia</button></div></div>
    ${tables}
    <div class="note neutral">${needs.map((n) => `Semestre ${roman(n.sem)}: ${n.docentes} docentes asignados; mínimo posible ${n.minimo} (2 asignaturas en paralelo × ${n.secs} secciones ÷ 6 bloques del nivel).`).join('<br>')}</div>
    ${cards ? `<h3>Docentes de esta carrera</h3><div class="grid-auto">${cards}</div>` : ''}`;
}

function wizReglas(c, sems) {
  const j = S.jornadas[c.jornada];
  const secsMax = Math.max(0, ...sems.map((s) => { const o = S.oferta?.[c.codigo]?.[s]; return o?.secciones ? Math.ceil(o.estudiantes / o.secciones) : 0; }));
  const fit = S.salas.filter((r) => r.capacidad >= secsMax).length;
  const blocks = (day) => blocksFor(S.jornadas, c.jornada, day).map((b) => `${b.inicio}–${b.fin}`).join(' y ');
  return `<div class="cols"><div class="main" style="display:flex;flex-direction:column;gap:12px">
      <h2>Jornada ${esc(c.jornada.toLowerCase())}</h2>
      <p class="muted">${esc(j.nota)}</p>
      <div class="tablewrap"><table><thead><tr><th>Nivel</th><th>Días</th><th>Bloques</th></tr></thead><tbody>
        ${[1, 2].map((lv) => `<tr><td>${lv}º año (semestres ${lv === 1 ? 'I y II' : 'III y IV'})</td><td>${j.dias[lv].map((d) => DAY_NAMES[d]).join(', ')}</td><td>${[...new Set(j.dias[lv].map(blocks))].join(' · sábado ')}</td></tr>`).join('')}
      </tbody></table></div>
      ${j.confirmado ? '<span class="pill ok">Confirmado por la coordinación</span>' : '<span class="pill warn">Supuesto: confirmar días y bloques con la coordinación</span>'}
      <h2>Reglas</h2>
      <label class="field">Cupo por sección (estudiantes)<input type="number" min="5" value="${S.reglas.cupo}" data-change="cupo"></label>
      <label class="field">Tope semanal por docente (sesiones; se puede ajustar por docente)<input type="number" min="1" max="12" value="${S.reglas.tope}" data-change="tope"></label>
    </div>
    <div class="side" style="display:flex;flex-direction:column;gap:12px">
      <h2>Salas</h2>
      <p>${S.salas.length} salas registradas · ${fit} con capacidad para ${secsMax} estudiantes.</p>
      <p class="muted small">Cada sección queda en una sala fija; son los docentes los que cambian de sala.</p>
      <a class="btn" href="#/salas">Editar salas</a>
    </div></div>`;
}

function wizGenerar(c) {
  const H = S.horario;
  const mine = H ? H.secciones.filter((s) => s.carrera === c.codigo) : [];
  const ids = new Set(mine.map((s) => s.id));
  const conf = H ? H.conflictos.filter((x) => x.secciones.some((id) => ids.has(id)) || (x.tipo === 'tope' && mine.some((s) => s.plan.some((p) => p.docenteId === x.docenteId)))) : [];
  return `<div class="row" style="justify-content:space-between"><div><h2>Generar y revisar</h2><p class="muted">El generador arma el horario de toda la sede a la vez, para que los docentes compartidos entre carreras no choquen.</p></div>
      <button class="btnp" data-act="generate" ${ui.generating ? 'disabled' : ''}>${ui.generating ? 'Generando…' : H ? 'Volver a generar' : 'Generar horario'}</button></div>
    ${!H ? '<p class="muted">Todavía no se ha generado el horario de este periodo.</p>' : `
      ${H.desactualizado ? '<div class="note warn">Hay cambios posteriores a la última generación.</div>' : ''}
      ${conf.length ? `<div class="note bad">${conf.map((x) => esc(x.mensaje)).join('<br>')}</div>` : `<div class="note ok">${mine.length ? `${mine.length} secciones de ${esc(c.codigo)} sin choques.` : 'Esta carrera no tiene secciones en el periodo.'}</div>`}
      ${mine.map((s) => `<h3>${secLabel(s)} · ${esc(salaName(s.salaId))} · ${s.dias.map((d) => DAY_NAMES[d]).join(', ')}</h3><div class="tablewrap">${gantt(s.plan, s.semanas, (it) => docName(it.docenteId))}</div>`).join('')}
      <p><a href="#/horario" data-act="viewsec" data-v="${mine[0]?.id || ''}">Ver la grilla semanal en Horario →</a></p>`}`;
}

// ---------- Vista: Docentes ----------
function viewDocentes() {
  const load = estimatedLoad(S, S.asignaciones);
  const q = ui.docQuery.toLowerCase();
  const list = S.docentes.filter((d) => !q || d.nombre.toLowerCase().includes(q) || (d.especialidad || '').toLowerCase().includes(q) || d.materias.some((m) => m.toLowerCase().includes(q)));
  const editing = S.docentes.find((d) => d.id === ui.editDoc);
  return `<div class="pagehead"><div><h1>Docentes</h1><p class="muted">Qué asignaturas puede dictar cada docente y cuándo está disponible.</p></div><button class="btnp" data-act="addDoc">Agregar docente</button></div>
    <div class="cols"><div class="main card">
      <input type="text" placeholder="Buscar por nombre, especialidad o asignatura" value="${esc(ui.docQuery)}" data-input="docQuery" aria-label="Buscar docente">
      <div class="tablewrap"><table><thead><tr><th>Docente</th><th>Especialidad</th><th>Asignaturas que dicta</th><th>Asignado en el periodo</th></tr></thead><tbody>
        ${list.map((d) => `<tr class="click" data-act="editDoc" data-v="${d.id}" ${d.id === ui.editDoc ? 'style="background:#EEF6F7"' : ''}><td><b>${esc(d.nombre)}</b></td><td>${esc(d.especialidad)}</td><td>${d.materias.length}</td><td>${load[d.id] || 0} h</td></tr>`).join('') || '<tr><td colspan="4" class="muted">No hay docentes.</td></tr>'}
      </tbody></table></div></div>
      <div class="side card">${editing ? docForm(editing) : '<p class="muted">Elige un docente para editarlo.</p>'}</div></div>`;
}

function allSubjectNames() {
  return [...new Set(S.carreras.flatMap((c) => c.semestres.flatMap((s) => s.asignaturas.map((a) => a.nombre))))].sort((a, b) => a.localeCompare(b));
}

function docForm(d) {
  const avail = Array.isArray(d.disponibilidad) ? d.disponibilidad : ALL_SLOTS;
  return `<h2>${esc(d.nombre || 'Nuevo docente')}</h2>
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
      <div class="avail"><div></div>${DAYS.map((x) => `<b style="text-align:center">${x}</b>`).join('')}
        ${TURNOS.map((t) => `<span>${t.nombre}</span>${DAYS.map((x) => `<input type="checkbox" ${avail.includes(`${x}-${t.id}`) ? 'checked' : ''} data-change="avail" data-v="${x}-${t.id}" aria-label="${DAY_NAMES[x]}, ${t.nombre}">`).join('')}`).join('')}
      </div>
      <span class="muted small">Mañana: jornada diurna y sábado. Noche: jornada vespertina. Un módulo usa los 3 días del nivel: si falta un día, el docente no puede tomar asignaturas de ese nivel.</span>
    </div>
    <div class="row" style="justify-content:space-between"><button class="btn danger" data-act="delDoc">Eliminar docente</button><button class="btnq" data-act="editDoc" data-v="">Cerrar</button></div>`;
}

// ---------- Vista: Salas ----------
function viewSalas() {
  return `<div class="pagehead"><div><h1>Salas</h1><p class="muted">Cada sección queda en una sala fija durante el semestre. Dos secciones que comparten bloques no pueden usar la misma sala.</p></div><button class="btnp" data-act="addSala">Agregar sala</button></div>
    <div class="card tablewrap"><table><thead><tr><th>Nombre</th><th>Capacidad</th><th>Tipo</th><th></th></tr></thead><tbody>
      ${S.salas.map((r, i) => `<tr><td><input type="text" value="${esc(r.nombre)}" data-change="sala" data-i="${i}" data-f="nombre" aria-label="Nombre de la sala"></td>
        <td><input type="number" min="1" value="${r.capacidad}" data-change="sala" data-i="${i}" data-f="capacidad" aria-label="Capacidad"></td>
        <td><select data-change="sala" data-i="${i}" data-f="tipo" aria-label="Tipo">${['Sala', 'Laboratorio', 'Taller'].map((t) => `<option ${r.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
        <td><button class="btnq" data-act="delSala" data-v="${i}">Eliminar</button></td></tr>`).join('') || '<tr><td colspan="4" class="muted">No hay salas.</td></tr>'}
    </tbody></table></div>
    <p class="muted small">En esta versión el tipo de sala es informativo: todavía no se exige laboratorio o taller para asignaturas específicas.</p>`;
}

// ---------- Vista: Respaldo ----------
function viewRespaldo() {
  return `<div class="pagehead"><div><h1>Respaldo y datos</h1><p class="muted">Todo se guarda en el archivo data/state.json de este computador.</p></div></div>
    <div class="grid-auto">
      <div class="card"><h2>Descargar respaldo</h2><p class="muted">Un archivo JSON con carreras, oferta, docentes, salas, asignaciones y el último horario.</p><button class="btn" data-act="backup">Descargar</button></div>
      <div class="card"><h2>Cargar respaldo</h2><p class="muted">Reemplaza todos los datos actuales por los del archivo.</p><input type="file" accept="application/json,.json" data-change="restore" aria-label="Archivo de respaldo"></div>
      <div class="card"><h2>Empezar con datos reales</h2><p class="muted">Deja las 15 mallas y borra los docentes, salas y matrícula de ejemplo.</p><button class="btn danger" data-act="reset" data-v="0">Empezar vacío</button></div>
      <div class="card"><h2>Volver al ejemplo</h2><p class="muted">Restaura los datos ficticios de ejemplo (TLI, APM y MME).</p><button class="btn" data-act="reset" data-v="1">Restaurar ejemplo</button></div>
    </div>
    <div class="card"><h2>Fuente de las mallas</h2><p class="muted">${esc(S.fuenteMallas || '')}. Para actualizarlas, edita data/seed/build_seed.cjs, ejecuta «npm run seed» y luego «Empezar vacío» o «Restaurar ejemplo».</p></div>`;
}

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
  toggleConf() { ui.showAllConf = !ui.showAllConf; render(); },
  mode(el) { ui.mode = el.dataset.v; ui.sel = null; render(); },
  week(el) { ui.week += Number(el.dataset.v); render(); },
  viewsec(el) { ui.mode = 'seccion'; ui.sel = el.dataset.v; },
  malla(el) { ui.malla = ui.malla === el.dataset.v ? null : el.dataset.v; render(); },
  step(el) { const { arg } = route(); ui.steps[arg] = Math.min(5, Math.max(1, Number(el.dataset.v))); window.scrollTo(0, 0); render(); },
  tab2(el) { const { arg } = route(); ui.tab2[arg] = el.dataset.v; render(); },
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
    render();
  },
  editDoc(el) {
    ui.editDoc = el.dataset.v || null;
    render();
    // En pantallas angostas la ficha queda bajo la tabla: llevarla a la vista.
    const side = app.querySelector('.cols > .side');
    if (ui.editDoc && side && side.getBoundingClientRect().top > window.innerHeight * 0.6) side.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
  delDoc() {
    const d = S.docentes.find((x) => x.id === ui.editDoc);
    if (!d || !confirm(`¿Eliminar a ${d.nombre}? Sus asignaturas quedarán sin docente.`)) return;
    mutate(() => {
      S.docentes = S.docentes.filter((x) => x.id !== d.id);
      for (const k of Object.keys(S.asignaciones)) if (S.asignaciones[k] === d.id) delete S.asignaciones[k];
    });
    ui.editDoc = null;
    render();
  },
  addMat() {
    const input = document.getElementById('newMat');
    const v = input.value.trim();
    if (!v) return;
    mutate(() => { const d = S.docentes.find((x) => x.id === ui.editDoc); if (!d.materias.includes(v)) d.materias.push(v); });
  },
  rmMat(el) { mutate(() => { const d = S.docentes.find((x) => x.id === ui.editDoc); d.materias.splice(Number(el.dataset.v), 1); }); },
  addSala() { mutate(() => S.salas.push({ id: 's' + Date.now().toString(36), nombre: `Sala ${S.salas.length + 1}`, capacidad: 30, tipo: 'Sala' })); },
  delSala(el) { const r = S.salas[Number(el.dataset.v)]; if (confirm(`¿Eliminar ${r.nombre}?`)) mutate(() => S.salas.splice(Number(el.dataset.v), 1)); },
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
  sala(el) {
    mutate(() => {
      const r = S.salas[Number(el.dataset.i)];
      r[el.dataset.f] = el.dataset.f === 'capacidad' ? Math.max(1, Number(el.value) || 1) : el.value;
    });
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
  app.querySelectorAll('[data-change]').forEach((el) => el.addEventListener('change', () => changes[el.dataset.change]?.(el)));
  app.querySelectorAll('[data-input]').forEach((el) => el.addEventListener('input', () => {
    ui[el.dataset.input] = el.value;
    const pos = el.selectionStart;
    render();
    const again = app.querySelector(`[data-input="${el.dataset.input}"]`);
    if (again) { again.focus(); again.setSelectionRange(pos, pos); }
  }));
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
