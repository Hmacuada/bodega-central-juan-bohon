// Calendario real del periodo: fecha de inicio y cierre, feriados y recesos, y horas por sesión
// (lunes a viernes 3 horas pedagógicas por bloque; sábado 4). Con esto cada asignatura tiene fechas reales:
// sus sesiones se cuentan día a día, saltando feriados y recesos, hasta completar sus horas.
//
// state.calendarios = { 'AAAA-par' | 'AAAA-impar': { inicio, fin, horasSemana, horasSabado, feriados: [{ fecha, nombre }], recesos: [{ desde, hasta, nombre }] } }
// Si el periodo no tiene calendario guardado se usa uno referencial (defaultCalendar), que el encargado debe revisar.

const DIA_JS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa']; // getUTCDay() -> código de día
export const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// Fechas como texto 'AAAA-MM-DD' (sin horas ni zona horaria).
export const toDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
export const toIso = (dt) => dt.toISOString().slice(0, 10);
export const addDays = (iso, n) => { const dt = toDate(iso); dt.setUTCDate(dt.getUTCDate() + n); return toIso(dt); };
export const dayCode = (iso) => DIA_JS[toDate(iso).getUTCDay()];
export const fmtFecha = (iso) => { const dt = toDate(iso); return `${dt.getUTCDate()} ${MESES[dt.getUTCMonth()]}`; };

// Lunes de la semana de una fecha.
export function mondayOf(iso) {
  const dt = toDate(iso);
  const back = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - back);
  return toIso(dt);
}

// Domingo de Pascua (algoritmo de Meeus/Jones/Butcher), para Viernes y Sábado Santo.
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const firstMonday = (y, m) => { let iso = `${y}-${String(m).padStart(2, '0')}-01`; while (dayCode(iso) !== 'Lu') iso = addDays(iso, 1); return iso; };

// Calendario referencial: feriados nacionales de fecha fija (algunos se trasladan por ley: revisar cada año)
// y el receso de Fiestas Patrias (la semana del 18 de septiembre). Periodo impar: marzo a julio; par: agosto a diciembre.
export function defaultCalendar(anio, paridad) {
  if (paridad === 'par') {
    const fp = mondayOf(`${anio}-09-18`);
    return {
      // Las clases de agosto a diciembre siguen en enero (unas 400 horas por semestre no caben antes).
      inicio: firstMonday(anio, 8), fin: `${anio + 1}-01-31`, horasSemana: 3, horasSabado: 4, referencial: true,
      feriados: [
        { fecha: `${anio}-08-15`, nombre: 'Asunción de la Virgen' },
        { fecha: `${anio}-10-12`, nombre: 'Encuentro de Dos Mundos' },
        { fecha: `${anio}-10-31`, nombre: 'Iglesias Evangélicas y Protestantes' },
        { fecha: `${anio}-11-01`, nombre: 'Todos los Santos' },
        { fecha: `${anio}-12-08`, nombre: 'Inmaculada Concepción' },
        { fecha: `${anio}-12-25`, nombre: 'Navidad' },
        { fecha: `${anio + 1}-01-01`, nombre: 'Año Nuevo' },
      ],
      recesos: [{ desde: fp, hasta: addDays(fp, 5), nombre: 'Receso Fiestas Patrias' }],
    };
  }
  const pascua = easter(anio);
  return {
    inicio: firstMonday(anio, 3), fin: `${anio}-07-31`, horasSemana: 3, horasSabado: 4, referencial: true,
    feriados: [
      { fecha: addDays(pascua, -2), nombre: 'Viernes Santo' },
      { fecha: addDays(pascua, -1), nombre: 'Sábado Santo' },
      { fecha: `${anio}-05-01`, nombre: 'Día del Trabajo' },
      { fecha: `${anio}-05-21`, nombre: 'Glorias Navales' },
      { fecha: `${anio}-06-29`, nombre: 'San Pedro y San Pablo' },
      { fecha: `${anio}-07-16`, nombre: 'Virgen del Carmen' },
    ],
    recesos: [],
  };
}

export const calendarKey = (periodo) => `${periodo.anio}-${periodo.paridad}`;

export function calendarOf(state) {
  return state.calendarios?.[calendarKey(state.periodo)] || defaultCalendar(state.periodo.anio, state.periodo.paridad);
}

// Motivo por el que no hay clases ese día (feriado o receso), o null.
export function sinClases(cal, iso) {
  const f = (cal.feriados || []).find((x) => x.fecha === iso);
  if (f) return f.nombre || 'Feriado';
  const r = (cal.recesos || []).find((x) => x.desde <= iso && iso <= x.hasta);
  return r ? (r.nombre || 'Receso') : null;
}

export const horasDe = (cal, d) => (d === 'Sa' ? cal.horasSabado || 4 : cal.horasSemana || 3);

// Semana del periodo (1 = la semana de la fecha de inicio) de una fecha.
export function weekOf(cal, iso) {
  const w0 = toDate(mondayOf(cal.inicio)).getTime();
  return Math.floor((toDate(iso).getTime() - w0) / (7 * 864e5)) + 1;
}

// Lunes de la semana w del periodo.
export const weekMonday = (cal, w) => addDays(mondayOf(cal.inicio), (w - 1) * 7);

// Sesiones de una asignatura: desde `desdeIso`, en los días de sus bloques, saltando feriados y recesos,
// hasta completar `horas`. Devuelve las fechas por día y el total de horas dadas.
export function sesionesDe(cal, dias, horas, desdeIso) {
  const out = [];
  let dadas = 0, iso = desdeIso < cal.inicio ? cal.inicio : desdeIso;
  const set = new Set(dias);
  if (!set.size || horas <= 0) return { fechas: out, horas: 0 };
  for (let guard = 0; dadas < horas && guard < 800; guard++, iso = addDays(iso, 1)) {
    const d = dayCode(iso);
    if (!set.has(d) || sinClases(cal, iso)) continue;
    out.push({ fecha: iso, d });
    dadas += horasDe(cal, d);
  }
  return { fechas: out, horas: dadas };
}

// Semanas de clase reales del periodo (de inicio a cierre), descontando feriados y recesos:
// cada sección usa 3 de los 6 días, así que en promedio cada 6 días sin clases son una semana menos.
export function semanasHastaCierre(cal) {
  if (!cal?.inicio || !cal?.fin) return null;
  let perdidos = 0;
  for (let iso = cal.inicio; iso <= cal.fin; iso = addDays(iso, 1)) if (dayCode(iso) !== 'Do' && sinClases(cal, iso)) perdidos++;
  return Math.max(1, weekOf(cal, cal.fin) - Math.ceil(perdidos / 6));
}
