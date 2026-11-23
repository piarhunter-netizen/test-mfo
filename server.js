#!/usr/bin/env node
/**
 * Сервер сайта и личного кабинета. Без внешних зависимостей: node server.js
 *
 * Раздаёт собранный сайт из dist/ и API:
 *   POST /api/register/start   {phone, consents}          → код в СМС
 *   POST /api/register/finish  {phone, code, password}    → аккаунт + вход
 *   POST /api/login            {phone, password}          → вход
 *   POST /api/logout
 *   POST /api/reset/start      {phone}                    → код в СМС
 *   POST /api/reset/finish     {phone, code, password}    → новый пароль
 *   GET  /api/me                                          → профиль и заявки
 *   POST /api/apply            {phone, amount, term, consents, ...} → заявка
 *
 * Данные хранятся в data/db.json (пароли — только хеш scrypt с солью).
 * Для боевого режима: NODE_ENV=production, HTTPS через nginx/прокси,
 * SMS_API_URL — адрес шлюза СМС. Без шлюза в режиме разработки код
 * подтверждения пишется в консоль и показывается на странице.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const cfg = require('./site.config');
const PORT = +process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const PROD = process.env.NODE_ENV === 'production';
// SMS_DEMO=1 — временный тестовый режим без СМС-шлюза: код показывается на странице.
// Только для проверки! Любой сможет зарегистрировать чужой номер.
const SMS_DEMO = !PROD || process.env.SMS_DEMO === '1';
const ROOT = path.join(__dirname, 'dist');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const SESSION_DAYS = 7;
const CODE_TTL_MIN = 10;

// ---------- Хранилище ----------
fs.mkdirSync(DATA_DIR, { recursive: true });
let db = { users: [], sessions: {}, codes: {}, applications: [] };
try { db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) }; } catch { /* новый файл */ }
let saveTimer = null;
const save = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 1), { mode: 0o600 });
    fs.renameSync(tmp, DB_FILE);
  }, 50);
};
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

// ---------- Пароли ----------
const hashPassword = (password) => new Promise((resolve, reject) => {
  const salt = crypto.randomBytes(16);
  crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, key) =>
    err ? reject(err) : resolve(`scrypt$${salt.toString('hex')}$${key.toString('hex')}`));
});
const checkPassword = (password, stored) => new Promise((resolve) => {
  const [, saltHex, keyHex] = String(stored).split('$');
  if (!saltHex || !keyHex) return resolve(false);
  crypto.scrypt(password, Buffer.from(saltHex, 'hex'), 64, { N: 16384, r: 8, p: 1 }, (err, key) => {
    if (err) return resolve(false);
    const expected = Buffer.from(keyHex, 'hex');
    resolve(expected.length === key.length && crypto.timingSafeEqual(expected, key));
  });
});
// Пустышка для выравнивания времени ответа, когда пользователя нет
let DUMMY_HASH = '';
hashPassword(crypto.randomBytes(8).toString('hex')).then((h) => { DUMMY_HASH = h; });

// ---------- Ограничение частоты запросов ----------
const hits = new Map();
const limited = (key, max, windowMs) => {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  return list.length > max;
};
setInterval(() => {
  const now = Date.now();
  for (const [k, list] of hits) if (!list.some((t) => now - t < 3600e3)) hits.delete(k);
  for (const [t, s] of Object.entries(db.sessions)) if (s.exp < now) delete db.sessions[t];
  for (const [k, c] of Object.entries(db.codes)) if (c.exp < now) delete db.codes[k];
}, 600e3).unref();

// ---------- СМС ----------
async function sendSms(phone, text) {
  if (process.env.SMS_API_URL) {
    const r = await fetch(process.env.SMS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.SMS_API_TOKEN || ''}` },
      body: JSON.stringify({ phone, text }),
    });
    if (!r.ok) throw new Error('sms gateway ' + r.status);
    return { sent: true };
  }
  if (!SMS_DEMO) throw new Error('SMS gateway is not configured');
  console.log(`[СМС → ${phone}] ${text}`);
  return { sent: false };
}

const issueCode = async (phone, purpose) => {
  const code = String(crypto.randomInt(100000, 1000000));
  db.codes[`${purpose}:${phone}`] = { hash: sha(code), exp: Date.now() + CODE_TTL_MIN * 60e3, attempts: 0 };
  save();
  const res = await sendSms(phone, `${cfg.brand}: код подтверждения ${code}. Никому его не сообщайте.`);
  return res.sent ? {} : { devCode: code };
};
const useCode = (phone, purpose, code) => {
  const key = `${purpose}:${phone}`;
  const c = db.codes[key];
  if (!c || c.exp < Date.now()) return 'Код устарел. Запросите новый.';
  c.attempts += 1;
  if (c.attempts > 5) { delete db.codes[key]; save(); return 'Слишком много попыток. Запросите новый код.'; }
  if (sha(String(code).trim()) !== c.hash) { save(); return 'Неверный код.'; }
  delete db.codes[key];
  save();
  return null;
};

// ---------- Сессии ----------
const parseCookies = (req) => Object.fromEntries((req.headers.cookie || '').split(';').map((p) => p.trim().split('=').map(decodeURIComponent)).filter((p) => p[0]));
const isHttps = (req) => req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https';
const startSession = (req, res, user) => {
  const token = crypto.randomBytes(32).toString('hex');
  db.sessions[sha(token)] = { userId: user.id, exp: Date.now() + SESSION_DAYS * 864e5 };
  save();
  res.setHeader('Set-Cookie', `sid=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${isHttps(req) ? '; Secure' : ''}`);
};
const currentUser = (req) => {
  const token = parseCookies(req).sid;
  if (!token) return null;
  const s = db.sessions[sha(token)];
  if (!s || s.exp < Date.now()) return null;
  return db.users.find((u) => u.id === s.userId) || null;
};

// ---------- Проверки ----------
const normPhone = (v) => {
  const d = String(v || '').replace(/\D/g, '').replace(/^8/, '7');
  return /^7\d{10}$/.test(d) ? '+' + d : null;
};
const badPassword = (p) => (typeof p !== 'string' || p.length < 8 ? 'Пароль должен быть не короче 8 символов.' : p.length > 128 ? 'Слишком длинный пароль.' : null);
const findUser = (phone) => db.users.find((u) => u.phone === phone);

// ---------- HTTP ----------
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' https://mc.yandex.ru; img-src 'self' data: https://mc.yandex.ru; connect-src 'self' https://mc.yandex.ru; style-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};
const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY_HEADERS });
  res.end(JSON.stringify(body));
};
const readBody = (req) => new Promise((resolve, reject) => {
  let size = 0; const chunks = [];
  req.on('data', (c) => { size += c.length; if (size > 16 * 1024) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
  req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { reject(new Error('bad json')); } });
  req.on('error', reject);
});
const ip = (req) => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;

const routes = {
  'POST /api/register/start': async (req, res, b) => {
    const phone = normPhone(b.phone);
    if (!phone) return json(res, 400, { error: 'Введите номер телефона полностью.' });
    if (!b.consents || !b.consents.pd || !b.consents.asp) return json(res, 400, { error: 'Нужно отметить обязательные согласия.' });
    if (findUser(phone)) return json(res, 409, { error: 'Этот номер уже зарегистрирован. Войдите или восстановите пароль.' });
    if (limited('code:' + phone, 3, 10 * 60e3) || limited('codeip:' + ip(req), 10, 60 * 60e3)) return json(res, 429, { error: 'Слишком много запросов кода. Попробуйте через 10 минут.' });
    db.codes[`consent:${phone}`] = { consents: { pd: true, asp: true }, at: new Date().toISOString(), exp: Date.now() + CODE_TTL_MIN * 60e3 };
    json(res, 200, { ok: true, ...(await issueCode(phone, 'register')) });
  },
  'POST /api/register/finish': async (req, res, b) => {
    const phone = normPhone(b.phone);
    if (!phone) return json(res, 400, { error: 'Введите номер телефона полностью.' });
    const pe = badPassword(b.password); if (pe) return json(res, 400, { error: pe });
    if (findUser(phone)) return json(res, 409, { error: 'Этот номер уже зарегистрирован.' });
    const ce = useCode(phone, 'register', b.code); if (ce) return json(res, 400, { error: ce });
    const consent = db.codes[`consent:${phone}`] || {};
    delete db.codes[`consent:${phone}`];
    const user = { id: crypto.randomUUID(), phone, pass: await hashPassword(b.password), createdAt: new Date().toISOString(), consents: { ...consent.consents, at: consent.at } };
    db.users.push(user);
    startSession(req, res, user);
    json(res, 200, { ok: true, redirect: '/lk/' });
  },
  'POST /api/login': async (req, res, b) => {
    const phone = normPhone(b.phone);
    if (limited('login:' + ip(req), 10, 15 * 60e3) || (phone && limited('loginp:' + phone, 10, 15 * 60e3))) return json(res, 429, { error: 'Слишком много попыток входа. Попробуйте через 15 минут.' });
    const user = phone && findUser(phone);
    const ok = await checkPassword(String(b.password || ''), user ? user.pass : DUMMY_HASH);
    if (!user || !ok) return json(res, 401, { error: 'Неверный телефон или пароль.' });
    startSession(req, res, user);
    json(res, 200, { ok: true, redirect: '/lk/' });
  },
  'POST /api/logout': async (req, res) => {
    const token = parseCookies(req).sid;
    if (token) { delete db.sessions[sha(token)]; save(); }
    res.setHeader('Set-Cookie', 'sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
    json(res, 200, { ok: true, redirect: '/lk/login/' });
  },
  'POST /api/reset/start': async (req, res, b) => {
    const phone = normPhone(b.phone);
    if (!phone) return json(res, 400, { error: 'Введите номер телефона полностью.' });
    if (limited('code:' + phone, 3, 10 * 60e3) || limited('codeip:' + ip(req), 10, 60 * 60e3)) return json(res, 429, { error: 'Слишком много запросов кода. Попробуйте через 10 минут.' });
    // Одинаковый ответ, есть номер или нет, — чтобы нельзя было проверять чужие номера
    const extra = findUser(phone) ? await issueCode(phone, 'reset') : {};
    json(res, 200, { ok: true, ...extra });
  },
  'POST /api/reset/finish': async (req, res, b) => {
    const phone = normPhone(b.phone);
    const pe = badPassword(b.password); if (pe) return json(res, 400, { error: pe });
    const user = phone && findUser(phone);
    const ce = useCode(phone, 'reset', b.code); if (ce || !user) return json(res, 400, { error: ce || 'Неверный код.' });
    user.pass = await hashPassword(b.password);
    for (const [t, s] of Object.entries(db.sessions)) if (s.userId === user.id) delete db.sessions[t];
    save();
    json(res, 200, { ok: true });
  },
  'GET /api/me': async (req, res) => {
    const user = currentUser(req);
    if (!user) return json(res, 401, { error: 'Нужно войти.' });
    const apps = db.applications.filter((a) => a.phone === user.phone).map(({ id, amount, term, createdAt, status }) => ({ id, amount, term, createdAt, status }));
    json(res, 200, { phone: user.phone, createdAt: user.createdAt, applications: apps.reverse() });
  },
  'POST /api/apply': async (req, res, b) => {
    const phone = normPhone(b.phone);
    const L = cfg.loan;
    const amount = Math.round(+b.amount), term = Math.round(+b.term);
    if (!phone) return json(res, 400, { error: 'Введите номер телефона полностью.' });
    if (!(amount >= L.minAmount && amount <= L.maxAmount && term >= L.minTerm && term <= L.maxTerm)) return json(res, 400, { error: 'Сумма или срок вне допустимых значений.' });
    const c = b.consents || {};
    if (!c.docs || !c.pd || !c.bki || !c.asp) return json(res, 400, { error: 'Нужно отметить обязательные согласия.' });
    if (limited('apply:' + ip(req), 10, 60 * 60e3)) return json(res, 429, { error: 'Слишком много заявок. Попробуйте позже.' });
    db.applications.push({
      id: crypto.randomUUID(), phone, amount, term, status: 'На рассмотрении', createdAt: new Date().toISOString(),
      consents: { docs: true, pd: true, bki: true, asp: true, at: new Date().toISOString() },
      utm: typeof b.utm === 'object' ? b.utm : {}, page: String(b.page || '').slice(0, 200), ip: ip(req),
    });
    save();
    json(res, 200, { ok: true, registered: !!findUser(phone) });
  },
};

// ---------- Статика ----------
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json', '.pdf': 'application/pdf' };
const serveStatic = (req, res) => {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end(); }
  let f = path.normalize(path.join(ROOT, p));
  if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) {
    res.writeHead(404, { 'Content-Type': types['.html'], ...SECURITY_HEADERS });
    return fs.createReadStream(path.join(ROOT, '404.html')).pipe(res);
  }
  const ext = path.extname(f);
  res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400', ...SECURITY_HEADERS });
  fs.createReadStream(f).pipe(res);
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res);
  const handler = routes[`${req.method} ${url.pathname}`];
  if (!handler) return json(res, 404, { error: 'Не найдено' });
  try {
    let body = {};
    if (req.method === 'POST') {
      // Защита от подделки запросов с чужих сайтов: только JSON и только со своего адреса
      if (!/^application\/json/.test(req.headers['content-type'] || '')) return json(res, 415, { error: 'Ожидается JSON' });
      const origin = req.headers.origin;
      if (origin && new URL(origin).host !== req.headers.host) return json(res, 403, { error: 'Запрещено' });
      body = await readBody(req);
    }
    await handler(req, res, body);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) json(res, e.message === 'too large' ? 413 : 500, { error: 'Ошибка сервера. Попробуйте позже.' });
  }
}).listen(PORT, HOST, () => {
  console.log(`Сайт и API: http://${HOST}:${PORT}`);
  if (SMS_DEMO && !process.env.SMS_API_URL) console.log('Тестовый режим: коды из СМС выводятся в консоль и на страницу.');
});
