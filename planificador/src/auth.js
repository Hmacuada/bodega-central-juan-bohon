// Acceso con usuario y clave (sencillo): un solo usuario, definido en las variables de entorno APP_USER y APP_PASSWORD.
// Sin APP_PASSWORD el sistema queda abierto (uso local). La sesión es una cookie firmada que dura 12 horas.
import { createHmac, createHash, timingSafeEqual, randomBytes } from 'node:crypto';

const USUARIO = (process.env.APP_USER || 'admin').trim().toLowerCase();
const CLAVE = process.env.APP_PASSWORD || '';
// Si no hay SESSION_SECRET, se usa uno al azar: las sesiones se pierden al reiniciar el servidor.
const SECRETO = process.env.SESSION_SECRET || randomBytes(32).toString('hex');
const COOKIE = 'pl_sesion';
const DURACION_MS = 12 * 60 * 60 * 1000;
const intentos = new Map(); // ip -> { n, desde }

export const authActiva = () => !!CLAVE;

const firma = (txt) => createHmac('sha256', SECRETO).update(txt).digest('hex');
const hash = (txt) => createHash('sha256').update(String(txt)).digest();

function leerCookie(req, nombre) {
  for (const parte of (req.headers.cookie || '').split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nombre) return v.join('=');
  }
  return '';
}

export function sesionValida(req) {
  if (!CLAVE) return true;
  const [exp, sig] = leerCookie(req, COOKIE).split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const esperada = Buffer.from(firma(exp));
  const recibida = Buffer.from(sig);
  return esperada.length === recibida.length && timingSafeEqual(esperada, recibida);
}

const esHttps = (req) => (req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';

function cookieSesion(req) {
  const exp = String(Date.now() + DURACION_MS);
  return `${COOKIE}=${exp}.${firma(exp)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${DURACION_MS / 1000}${esHttps(req) ? '; Secure' : ''}`;
}

const ipDe = (req) => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';

// Revisa la clave. Tras 5 intentos fallidos desde la misma IP, espera 10 minutos.
export function intentarLogin(req, usuario, clave) {
  const ip = ipDe(req);
  const reg = intentos.get(ip);
  if (reg && reg.n >= 5 && Date.now() - reg.desde < 10 * 60 * 1000) return { ok: false, bloqueado: true };
  // Se comparan usuario y clave siempre, para no revelar cuál de los dos falló.
  const okUsuario = timingSafeEqual(hash(String(usuario).trim().toLowerCase()), hash(USUARIO));
  const okClave = timingSafeEqual(hash(clave), hash(CLAVE));
  const ok = !!CLAVE && okUsuario && okClave;
  if (ok) { intentos.delete(ip); return { ok: true, cookie: cookieSesion(req) }; }
  const nuevo = reg && Date.now() - reg.desde < 10 * 60 * 1000 ? { n: reg.n + 1, desde: reg.desde } : { n: 1, desde: Date.now() };
  intentos.set(ip, nuevo);
  return { ok: false };
}

export const cookieSalida = (req) => `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${esHttps(req) ? '; Secure' : ''}`;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function paginaLogin(error = '', usuario = '') {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ingresar · Planificador CFT Juan Bohon</title><link rel="icon" href="/public/logo.png">
<style>
  :root { --navy: #1b2f55; --ink: #18202c; --ink-3: #6b7484; --line: #dfe3ea; --bg: #f3f5f8; --bad: #c0352b; }
  * { box-sizing: border-box; }
  /* Fondo: azul institucional con luces suaves (dorado y celeste) y una trama fina de puntos. */
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; color: var(--ink);
    font: 15px/1.45 Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; padding: 16px;
    background-color: #142544;
    background-image:
      radial-gradient(circle at 1px 1px, rgba(255, 255, 255, .07) 1px, transparent 0),
      radial-gradient(60vw 60vw at 85% 10%, rgba(242, 183, 5, .22), transparent 60%),
      radial-gradient(70vw 70vw at 5% 95%, rgba(64, 140, 230, .35), transparent 60%),
      linear-gradient(135deg, #0f1d38 0%, #1b2f55 55%, #22407a 100%);
    background-size: 22px 22px, auto, auto, auto;
    background-attachment: fixed; }
  .wrap { width: 100%; max-width: 380px; display: grid; gap: 16px; }
  .box { width: 100%; background: #fff; border-radius: 18px; padding: 32px 28px; box-shadow: 0 24px 60px rgba(5, 12, 30, .45), 0 2px 6px rgba(5, 12, 30, .2); }
  .pie { margin: 0; text-align: center; color: rgba(255, 255, 255, .6); font-size: 12px; }
  .logo { display: block; width: 220px; max-width: 80%; height: auto; margin: 0 auto 18px; }
  h1 { margin: 0; font-size: 20px; text-align: center; }
  p.sub { margin: 4px 0 22px; text-align: center; color: var(--ink-3); font-size: 13.5px; }
  label { display: grid; gap: 6px; font-size: 13px; font-weight: 600; margin-bottom: 12px; }
  input { font: inherit; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; }
  input:focus { outline: 2px solid var(--navy); outline-offset: 1px; border-color: var(--navy); }
  button { margin-top: 6px; width: 100%; font: inherit; font-weight: 600; padding: 11px; border: 0; border-radius: 10px; background: var(--navy); color: #fff; cursor: pointer; }
  button:hover { filter: brightness(1.1); }
  .err { margin: 0 0 14px; padding: 9px 12px; border-radius: 10px; background: #fdecea; color: var(--bad); font-size: 13px; }
</style></head>
<body><div class="wrap"><main class="box">
  <img class="logo" src="/public/logo.png" alt="CFT Juan Bohon">
  <h1>Planificador académico</h1>
  <p class="sub">CFT Juan Bohon</p>
  ${error ? `<p class="err" role="alert">${esc(error)}</p>` : ''}
  <form method="post" action="/login">
    <label>Usuario<input type="text" name="usuario" value="${esc(usuario)}" autocomplete="username" autocapitalize="none" spellcheck="false" required ${usuario ? '' : 'autofocus'}></label>
    <label>Clave<input type="password" name="clave" autocomplete="current-password" required ${usuario ? 'autofocus' : ''}></label>
    <button type="submit">Ingresar</button>
  </form>
</main><p class="pie">Uso interno · Coordinación académica</p></div></body></html>`;
}
