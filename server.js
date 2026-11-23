#!/usr/bin/env node
/**
 * Сервер сайта, личного кабинета и админки. Без внешних зависимостей: node server.js
 *
 * Клиентское API:
 *   POST /api/register/start   {phone, consents}          → код в СМС
 *   POST /api/register/finish  {phone, code, password}    → аккаунт + вход
 *   POST /api/login            {phone, password}          → вход
 *   POST /api/logout
 *   POST /api/reset/start      {phone}                    → код в СМС
 *   POST /api/reset/finish     {phone, code, password}    → новый пароль
 *   GET  /api/me                                          → профиль и заявки
 *   POST /api/apply            {phone, amount, term, consents, ...} → заявка
 *
 * Админка (/admin/, API /api/admin/*): заявки и статусы, пользователи,
 * журнал действий, администраторы. Первый администратор создаётся по
 * одноразовой ссылке: токен лежит в DATA_DIR/admin-setup-token.
 *
 * Коды подтверждения: СМС (SMS_API_URL) или Telegram-бот (TG_BOT_TOKEN + TG_BOT_NAME):
 *   бот просит «Поделиться номером» и присылает код, только если номер совпадает.
 *
 * Данные — DATA_DIR/db.json (пароли — только хеш scrypt с солью).
 * Боевой режим: NODE_ENV=production, HTTPS через nginx, SMS_API_URL — шлюз СМС.
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
const SETUP_FILE = path.join(DATA_DIR, 'admin-setup-token');
const SESSION_DAYS = 7;
const ADMIN_SESSION_HOURS = 12;
const CODE_TTL_MIN = 10;
const STATUSES = ['На рассмотрении', 'Одобрена', 'Отказ', 'Выдана', 'Погашена', 'Отменена'];

// ---------- Хранилище ----------
fs.mkdirSync(DATA_DIR, { recursive: true });
let db = { users: [], sessions: {}, codes: {}, applications: [], admins: [], adminSessions: {}, audit: [] };
try { db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) }; } catch { /* новый файл */ }
let saveTimer = null;
const flush = () => {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db), { mode: 0o600 });
  fs.renameSync(tmp, DB_FILE);
};
const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(flush, 50); };
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { clearTimeout(saveTimer); try { flush(); } catch { /* */ } process.exit(0); });
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const now = () => new Date().toISOString();

// ---------- Пароли ----------
const SCRYPT = { N: 16384, r: 8, p: 1 };
const hashPassword = (password) => new Promise((resolve, reject) => {
  const salt = crypto.randomBytes(16);
  crypto.scrypt(password, salt, 64, SCRYPT, (err, key) =>
    err ? reject(err) : resolve(`scrypt$${salt.toString('hex')}$${key.toString('hex')}`));
});
const checkPassword = (password, stored) => new Promise((resolve) => {
  const [, saltHex, keyHex] = String(stored).split('$');
  const salt = saltHex ? Buffer.from(saltHex, 'hex') : crypto.randomBytes(16);
  crypto.scrypt(String(password), salt, 64, SCRYPT, (err, key) => {
    if (err || !keyHex) return resolve(false);
    const expected = Buffer.from(keyHex, 'hex');
    resolve(expected.length === key.length && crypto.timingSafeEqual(expected, key));
  });
});

// ---------- Ограничение частоты запросов ----------
const hits = new Map();
const limited = (key, max, windowMs) => {
  const t = Date.now();
  const list = (hits.get(key) || []).filter((x) => t - x < windowMs);
  list.push(t);
  hits.set(key, list);
  return list.length > max;
};
setInterval(() => {
  const t = Date.now();
  for (const [k, list] of hits) if (!list.some((x) => t - x < 3600e3)) hits.delete(k);
  let changed = false;
  for (const store of [db.sessions, db.adminSessions, db.codes]) {
    for (const [k, v] of Object.entries(store)) if (v.exp < t) { delete store[k]; changed = true; }
  }
  if (changed) save();
}, 600e3).unref();

// ---------- Telegram-бот для кодов подтверждения ----------
const TG_TOKEN = process.env.TG_BOT_TOKEN || '';
const TG_NAME = (process.env.TG_BOT_NAME || '').replace(/^@/, '');
const TG_ON = !!(TG_TOKEN && TG_NAME);
const tgPending = new Map(); // nonce → { phone, code, exp }
const tgChats = new Map();   // chatId → nonce
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tg = async (method, payload) => {
  const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(65000),
  });
  return r.json();
};
const tgSend = (chatId, text, extra = {}) => tg('sendMessage', { chat_id: chatId, text, ...extra }).catch((e) => console.error('tg send', e.message));
async function tgHandle(msg) {
  if (!msg || !msg.chat || msg.chat.type !== 'private') return;
  const chatId = msg.chat.id;
  const text = String(msg.text || '');
  if (text.startsWith('/start')) {
    const nonce = text.split(' ')[1] || '';
    const p = tgPending.get(nonce);
    if (!p || p.exp < Date.now()) return tgSend(chatId, `Ссылка устарела. Запросите код на сайте ${cfg.brand} ещё раз.`);
    tgChats.set(chatId, nonce);
    return tgSend(chatId, `Чтобы получить код для входа в ${cfg.brand}, подтвердите номер телефона кнопкой ниже.`, {
      reply_markup: { keyboard: [[{ text: '📱 Поделиться номером', request_contact: true }]], resize_keyboard: true, one_time_keyboard: true },
    });
  }
  if (msg.contact) {
    const nonce = tgChats.get(chatId);
    const p = nonce && tgPending.get(nonce);
    const remove = { reply_markup: { remove_keyboard: true } };
    if (!p || p.exp < Date.now()) return tgSend(chatId, 'Ссылка устарела. Запросите код на сайте ещё раз.', remove);
    if (!msg.from || msg.contact.user_id !== msg.from.id) return tgSend(chatId, 'Отправьте свой номер кнопкой «Поделиться номером».');
    if (normPhone(msg.contact.phone_number) !== p.phone) {
      tgPending.delete(nonce); tgChats.delete(chatId);
      return tgSend(chatId, 'Номер этого Telegram не совпадает с номером, указанным на сайте. Получите код по СМС или войдите в Telegram с нужным номером.', remove);
    }
    tgPending.delete(nonce); tgChats.delete(chatId);
    return tgSend(chatId, `Код подтверждения ${cfg.brand}: ${p.code}\nНикому его не сообщайте — даже сотрудникам компании.`, remove);
  }
  return tgSend(chatId, `Этот бот присылает коды подтверждения для сайта ${cfg.brand}. Начните со страницы входа на сайте.`);
}
async function tgLoop() {
  let offset = 0;
  await tg('deleteWebhook', {}).catch(() => {});
  for (;;) {
    try {
      const r = await tg('getUpdates', { offset, timeout: 50, allowed_updates: ['message'] });
      if (!r.ok) { console.error('tg', r.description); await sleep(5000); continue; }
      for (const u of r.result) { offset = u.update_id + 1; await tgHandle(u.message).catch((e) => console.error('tg handle', e.message)); }
    } catch (e) { await sleep(5000); }
  }
}
setInterval(() => { const t = Date.now(); for (const [k, v] of tgPending) if (v.exp < t) tgPending.delete(k); }, 60e3).unref();

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
  console.log(`[СМС → ${phone}] код выдан (тестовый режим)`);
  return { sent: false };
}
const issueCode = async (phone, purpose, channel) => {
  const code = String(crypto.randomInt(100000, 1000000));
  db.codes[`${purpose}:${phone}`] = { hash: sha(code), exp: Date.now() + CODE_TTL_MIN * 60e3, attempts: 0 };
  save();
  if (channel === 'tg' && TG_ON) {
    const nonce = crypto.randomBytes(16).toString('hex');
    tgPending.set(nonce, { phone, code, exp: Date.now() + CODE_TTL_MIN * 60e3 });
    return { tgLink: `https://t.me/${TG_NAME}?start=${nonce}` };
  }
  const res = await sendSms(phone, `${cfg.brand}: код подтверждения ${code}. Никому его не сообщайте.`);
  return res.sent ? {} : { devCode: code };
};
const useCode = (phone, purpose, code) => {
  const key = `${purpose}:${phone}`;
  const c = db.codes[key];
  if (!c || c.exp < Date.now()) return 'Код устарел. Запросите новый.';
  c.attempts += 1;
  if (c.attempts > 5) { delete db.codes[key]; save(); return 'Слишком много попыток. Запросите новый код.'; }
  const given = Buffer.from(sha(String(code || '').trim()));
  if (!crypto.timingSafeEqual(given, Buffer.from(c.hash))) { save(); return 'Неверный код.'; }
  delete db.codes[key];
  save();
  return null;
};

// ---------- Сессии ----------
const parseCookies = (req) => {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 1) continue;
    try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* битая cookie */ }
  }
  return out;
};
const isHttps = (req) => req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https';
const cookie = (req, name, value, { maxAge, path: p = '/', sameSite = 'Lax' }) =>
  `${name}=${value}; Path=${p}; HttpOnly; SameSite=${sameSite}; Max-Age=${maxAge}${isHttps(req) ? '; Secure' : ''}`;
const addCookie = (res, c) => {
  const prev = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', prev ? [].concat(prev, c) : c);
};
const startSession = (req, res, user) => {
  const token = crypto.randomBytes(32).toString('hex');
  db.sessions[sha(token)] = { userId: user.id, exp: Date.now() + SESSION_DAYS * 864e5 };
  save();
  addCookie(res, cookie(req, 'sid', token, { maxAge: SESSION_DAYS * 86400 }));
};
const currentUser = (req) => {
  const token = parseCookies(req).sid;
  const s = token && db.sessions[sha(token)];
  if (!s || s.exp < Date.now()) return null;
  const user = db.users.find((u) => u.id === s.userId);
  return user && !user.blocked ? user : null;
};
const dropUserSessions = (userId) => { for (const [t, s] of Object.entries(db.sessions)) if (s.userId === userId) delete db.sessions[t]; };

// ---------- Проверки ----------
const normPhone = (v) => {
  const d = String(v || '').replace(/\D/g, '').replace(/^8/, '7');
  return /^7\d{10}$/.test(d) ? '+' + d : null;
};
const badPassword = (p, min = 8) => (typeof p !== 'string' || p.length < min ? `Пароль должен быть не короче ${min} символов.` : p.length > 128 ? 'Слишком длинный пароль.' : null);
const findUser = (phone) => db.users.find((u) => u.phone === phone);
const cleanStr = (v, max = 200) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max);
const cleanUtm = (u) => {
  const out = {};
  if (u && typeof u === 'object') {
    for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'yclid']) if (u[k]) out[k] = cleanStr(u[k], 150);
  }
  return out;
};

// ---------- HTTP-утилиты ----------
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' https://mc.yandex.ru; img-src 'self' data: https://mc.yandex.ru; connect-src 'self' https://mc.yandex.ru; style-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
};
const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY_HEADERS });
  res.end(JSON.stringify(body));
};
const MAX_BODY = 16 * 1024;
const readBody = (req) => new Promise((resolve, reject) => {
  if (+req.headers['content-length'] > MAX_BODY) { req.resume(); return reject(new Error('too large')); }
  let size = 0, tooBig = false; const chunks = [];
  req.on('data', (c) => { size += c.length; if (size > MAX_BODY) tooBig = true; else chunks.push(c); });
  req.on('end', () => {
    if (tooBig) return reject(new Error('too large'));
    try {
      const v = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('bad json');
      resolve(v);
    } catch { reject(new Error('bad json')); }
  });
  req.on('error', reject);
});
const ip = (req) => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;

// ---------- Клиентские маршруты ----------
const routes = {
  'GET /api/config': async (req, res) => json(res, 200, { tg: TG_ON }),
  'POST /api/register/start': async (req, res, b) => {
    const phone = normPhone(b.phone);
    if (!phone) return json(res, 400, { error: 'Введите номер телефона полностью.' });
    if (!b.consents || b.consents.pd !== true || b.consents.asp !== true) return json(res, 400, { error: 'Нужно отметить обязательные согласия.' });
    if (limited('code:' + phone, 3, 10 * 60e3) || limited('codeip:' + ip(req), 10, 60 * 60e3)) return json(res, 429, { error: 'Слишком много запросов кода. Попробуйте через 10 минут.' });
    if (findUser(phone)) return json(res, 409, { error: 'Этот номер уже зарегистрирован. Войдите или восстановите пароль.' });
    db.codes[`consent:${phone}`] = { consents: { pd: true, asp: true }, at: now(), exp: Date.now() + CODE_TTL_MIN * 60e3 };
    json(res, 200, { ok: true, ...(await issueCode(phone, 'register', b.channel)) });
  },
  'POST /api/register/finish': async (req, res, b) => {
    const phone = normPhone(b.phone);
    if (!phone) return json(res, 400, { error: 'Введите номер телефона полностью.' });
    const pe = badPassword(b.password); if (pe) return json(res, 400, { error: pe });
    if (findUser(phone)) return json(res, 409, { error: 'Этот номер уже зарегистрирован.' });
    const ce = useCode(phone, 'register', b.code); if (ce) return json(res, 400, { error: ce });
    const consent = db.codes[`consent:${phone}`] || {};
    delete db.codes[`consent:${phone}`];
    const user = { id: crypto.randomUUID(), phone, pass: await hashPassword(b.password), createdAt: now(), blocked: false, consents: { ...consent.consents, at: consent.at, ip: ip(req) } };
    db.users.push(user);
    startSession(req, res, user);
    json(res, 200, { ok: true, redirect: '/lk/' });
  },
  'POST /api/login': async (req, res, b) => {
    const phone = normPhone(b.phone);
    if (limited('login:' + ip(req), 10, 15 * 60e3) || (phone && limited('loginp:' + phone, 10, 15 * 60e3))) return json(res, 429, { error: 'Слишком много попыток входа. Попробуйте через 15 минут.' });
    const user = phone && findUser(phone);
    const ok = await checkPassword(String(b.password || ''), user ? user.pass : '');
    if (!user || !ok) return json(res, 401, { error: 'Неверный телефон или пароль.' });
    if (user.blocked) return json(res, 403, { error: `Доступ к кабинету ограничен. Позвоните ${cfg.contacts.phone}.` });
    startSession(req, res, user);
    json(res, 200, { ok: true, redirect: '/lk/' });
  },
  'POST /api/logout': async (req, res) => {
    const token = parseCookies(req).sid;
    if (token) { delete db.sessions[sha(token)]; save(); }
    addCookie(res, cookie(req, 'sid', '', { maxAge: 0 }));
    json(res, 200, { ok: true, redirect: '/lk/login/' });
  },
  'POST /api/reset/start': async (req, res, b) => {
    const phone = normPhone(b.phone);
    if (!phone) return json(res, 400, { error: 'Введите номер телефона полностью.' });
    if (limited('code:' + phone, 3, 10 * 60e3) || limited('codeip:' + ip(req), 10, 60 * 60e3)) return json(res, 429, { error: 'Слишком много запросов кода. Попробуйте через 10 минут.' });
    // Одинаковый ответ, есть номер или нет, — чтобы нельзя было проверять чужие номера
    const user = findUser(phone);
    // Для несуществующего номера отдаём «пустую» ссылку на бота — ответ выглядит так же
    const extra = user && !user.blocked ? await issueCode(phone, 'reset', b.channel)
      : b.channel === 'tg' && TG_ON ? { tgLink: `https://t.me/${TG_NAME}?start=${crypto.randomBytes(16).toString('hex')}` } : {};
    json(res, 200, { ok: true, ...extra });
  },
  'POST /api/reset/finish': async (req, res, b) => {
    const phone = normPhone(b.phone);
    const pe = badPassword(b.password); if (pe) return json(res, 400, { error: pe });
    if (!phone) return json(res, 400, { error: 'Неверный код.' });
    const user = findUser(phone);
    const ce = useCode(phone, 'reset', b.code); if (ce || !user || user.blocked) return json(res, 400, { error: ce || 'Неверный код.' });
    user.pass = await hashPassword(b.password);
    dropUserSessions(user.id);
    save();
    json(res, 200, { ok: true });
  },
  'GET /api/me': async (req, res) => {
    const user = currentUser(req);
    if (!user) return json(res, 401, { error: 'Нужно войти.' });
    const apps = db.applications.filter((a) => a.phone === user.phone)
      .map(({ id, amount, term, createdAt, status }) => ({ id, amount, term, createdAt, status }));
    json(res, 200, { phone: user.phone, createdAt: user.createdAt, applications: apps.reverse() });
  },
  'POST /api/apply': async (req, res, b) => {
    const phone = normPhone(b.phone);
    const L = cfg.loan;
    const amount = Math.round(+b.amount), term = Math.round(+b.term);
    if (!phone) return json(res, 400, { error: 'Введите номер телефона полностью.' });
    if (!(amount >= L.minAmount && amount <= L.maxAmount && term >= L.minTerm && term <= L.maxTerm)) return json(res, 400, { error: 'Сумма или срок вне допустимых значений.' });
    const c = b.consents || {};
    if (c.docs !== true || c.pd !== true || c.bki !== true || c.asp !== true) return json(res, 400, { error: 'Нужно отметить обязательные согласия.' });
    if (limited('apply:' + ip(req), 10, 60 * 60e3) || limited('applyp:' + phone, 5, 24 * 3600e3)) return json(res, 429, { error: 'Слишком много заявок. Попробуйте позже.' });
    db.applications.push({
      id: crypto.randomUUID(), phone, amount, term, status: STATUSES[0], comment: '', createdAt: now(), updatedAt: now(),
      consents: { docs: true, pd: true, bki: true, asp: true, at: now() },
      utm: cleanUtm(b.utm), page: cleanStr(b.page), referrer: cleanStr(b.referrer, 300), ip: ip(req),
    });
    save();
    json(res, 200, { ok: true, registered: !!findUser(phone) });
  },
};

// ---------- Админка ----------
const adminByLogin = (login) => db.admins.find((a) => a.login === login);
const currentAdmin = (req) => {
  const token = parseCookies(req).asid;
  const s = token && db.adminSessions[sha(token)];
  if (!s || s.exp < Date.now()) return null;
  return db.admins.find((a) => a.id === s.adminId && !a.disabled) || null;
};
const audit = (admin, action, target, details) => {
  db.audit.push({ at: now(), admin: admin ? admin.login : '—', action, target: target || '', details: details || '' });
  if (db.audit.length > 5000) db.audit.splice(0, db.audit.length - 5000);
  save();
};
const ensureSetupToken = () => {
  if (db.admins.length) { try { fs.unlinkSync(SETUP_FILE); } catch { /* нет файла */ } return; }
  if (!fs.existsSync(SETUP_FILE)) fs.writeFileSync(SETUP_FILE, crypto.randomBytes(24).toString('hex'), { mode: 0o600 });
  console.log(`Администраторов нет. Создание первого: /admin/#setup=<токен из ${SETUP_FILE}>`);
};
const startAdminSession = (req, res, admin) => {
  const token = crypto.randomBytes(32).toString('hex');
  db.adminSessions[sha(token)] = { adminId: admin.id, exp: Date.now() + ADMIN_SESSION_HOURS * 3600e3, ip: ip(req) };
  admin.lastLoginAt = now();
  save();
  addCookie(res, cookie(req, 'asid', token, { maxAge: ADMIN_SESSION_HOURS * 3600, path: '/api/admin', sameSite: 'Strict' }));
};
const validLogin = (l) => typeof l === 'string' && /^[a-zA-Z0-9._-]{3,32}$/.test(l);
const publicApp = (a) => ({ ...a, registered: !!findUser(a.phone) });
const csvCell = (v) => {
  let s = String(v == null ? '' : v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // защита от формул в Excel
  return '"' + s.replace(/"/g, '""') + '"';
};

const adminRoutes = [
  ['GET', /^\/api\/admin\/state$/, async (req, res) => {
    const admin = currentAdmin(req);
    json(res, 200, { needSetup: db.admins.length === 0, admin: admin ? { login: admin.login, owner: !!admin.owner } : null });
  }, { public: true }],
  ['POST', /^\/api\/admin\/setup$/, async (req, res, b) => {
    if (db.admins.length) return json(res, 403, { error: 'Администратор уже создан.' });
    if (limited('asetup:' + ip(req), 5, 15 * 60e3)) return json(res, 429, { error: 'Слишком много попыток.' });
    let token = '';
    try { token = fs.readFileSync(SETUP_FILE, 'utf8').trim(); } catch { /* */ }
    const given = sha(String(b.token || ''));
    if (!token || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(sha(token)))) return json(res, 403, { error: 'Ссылка недействительна.' });
    if (!validLogin(b.login)) return json(res, 400, { error: 'Логин: 3–32 символа, латиница, цифры, точка, дефис.' });
    const pe = badPassword(b.password, 10); if (pe) return json(res, 400, { error: pe });
    const admin = { id: crypto.randomUUID(), login: b.login, pass: await hashPassword(b.password), owner: true, createdAt: now() };
    db.admins.push(admin);
    ensureSetupToken();
    audit(admin, 'Создан первый администратор', admin.login);
    startAdminSession(req, res, admin);
    json(res, 200, { ok: true });
  }, { public: true }],
  ['POST', /^\/api\/admin\/login$/, async (req, res, b) => {
    const login = String(b.login || '');
    if (limited('alogin:' + ip(req), 5, 15 * 60e3) || limited('aloginu:' + login, 5, 15 * 60e3)) return json(res, 429, { error: 'Слишком много попыток. Попробуйте через 15 минут.' });
    const admin = adminByLogin(login);
    const ok = await checkPassword(String(b.password || ''), admin ? admin.pass : '');
    if (!admin || !ok || admin.disabled) { audit(null, 'Неудачный вход в админку', login.slice(0, 32), ip(req)); return json(res, 401, { error: 'Неверный логин или пароль.' }); }
    startAdminSession(req, res, admin);
    audit(admin, 'Вход в админку', '', ip(req));
    json(res, 200, { ok: true });
  }, { public: true }],
  ['POST', /^\/api\/admin\/logout$/, async (req, res) => {
    const token = parseCookies(req).asid;
    if (token) { delete db.adminSessions[sha(token)]; save(); }
    addCookie(res, cookie(req, 'asid', '', { maxAge: 0, path: '/api/admin', sameSite: 'Strict' }));
    json(res, 200, { ok: true });
  }, { public: true }],

  ['GET', /^\/api\/admin\/stats$/, async (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    let sumIssued = 0;
    for (const a of db.applications) { byStatus[a.status] = (byStatus[a.status] || 0) + 1; if (a.status === 'Выдана' || a.status === 'Погашена') sumIssued += a.amount; }
    json(res, 200, {
      users: db.users.length,
      usersToday: db.users.filter((u) => u.createdAt.startsWith(today)).length,
      applications: db.applications.length,
      applicationsToday: db.applications.filter((a) => a.createdAt.startsWith(today)).length,
      byStatus, sumIssued, statuses: STATUSES,
    });
  }],
  ['GET', /^\/api\/admin\/applications$/, async (req, res, b, url) => {
    const status = url.searchParams.get('status') || '';
    const q = (url.searchParams.get('q') || '').replace(/\D/g, '');
    const page = Math.max(1, +url.searchParams.get('page') || 1);
    let list = db.applications.slice().reverse();
    if (status) list = list.filter((a) => a.status === status);
    if (q) list = list.filter((a) => a.phone.replace(/\D/g, '').includes(q));
    const per = 50;
    json(res, 200, { total: list.length, page, pages: Math.max(1, Math.ceil(list.length / per)), items: list.slice((page - 1) * per, page * per).map(publicApp), statuses: STATUSES });
  }],
  ['POST', /^\/api\/admin\/applications\/([0-9a-f-]{36})$/, async (req, res, b, url, m, admin) => {
    const app = db.applications.find((a) => a.id === m[1]);
    if (!app) return json(res, 404, { error: 'Заявка не найдена.' });
    const changes = [];
    if (b.status !== undefined) {
      if (!STATUSES.includes(b.status)) return json(res, 400, { error: 'Неизвестный статус.' });
      if (b.status !== app.status) { changes.push(`статус: ${app.status} → ${b.status}`); app.status = b.status; }
    }
    if (b.comment !== undefined) {
      const c = cleanStr(b.comment, 1000);
      if (c !== app.comment) { changes.push('комментарий изменён'); app.comment = c; }
    }
    if (changes.length) { app.updatedAt = now(); audit(admin, 'Изменена заявка', `${app.phone} · ${app.amount} ₽`, changes.join('; ')); }
    json(res, 200, { ok: true, item: publicApp(app) });
  }],
  ['GET', /^\/api\/admin\/applications\.csv$/, async (req, res, b, url, m, admin) => {
    const head = ['Дата', 'Телефон', 'Сумма', 'Срок, дн.', 'Статус', 'Комментарий', 'Зарегистрирован', 'utm_source', 'utm_medium', 'utm_campaign', 'IP'];
    const rows = db.applications.slice().reverse().map((a) => [
      new Date(a.createdAt).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }), a.phone, a.amount, a.term, a.status, a.comment,
      findUser(a.phone) ? 'да' : 'нет', (a.utm || {}).utm_source, (a.utm || {}).utm_medium, (a.utm || {}).utm_campaign, a.ip,
    ]);
    audit(admin, 'Выгрузка заявок в CSV', '', `${rows.length} строк`);
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="applications-${new Date().toISOString().slice(0, 10)}.csv"`, ...SECURITY_HEADERS,
    });
    res.end('﻿' + [head, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n'));
  }],
  ['GET', /^\/api\/admin\/users$/, async (req, res, b, url) => {
    const q = (url.searchParams.get('q') || '').replace(/\D/g, '');
    let list = db.users.slice().reverse();
    if (q) list = list.filter((u) => u.phone.replace(/\D/g, '').includes(q));
    json(res, 200, {
      total: list.length,
      items: list.slice(0, 200).map((u) => ({
        id: u.id, phone: u.phone, createdAt: u.createdAt, blocked: !!u.blocked,
        applications: db.applications.filter((a) => a.phone === u.phone).length,
        online: Object.values(db.sessions).some((s) => s.userId === u.id && s.exp > Date.now()),
      })),
    });
  }],
  ['POST', /^\/api\/admin\/users\/([0-9a-f-]{36})$/, async (req, res, b, url, m, admin) => {
    const user = db.users.find((u) => u.id === m[1]);
    if (!user) return json(res, 404, { error: 'Пользователь не найден.' });
    if (typeof b.blocked === 'boolean' && b.blocked !== !!user.blocked) {
      user.blocked = b.blocked;
      if (b.blocked) dropUserSessions(user.id);
      audit(admin, b.blocked ? 'Пользователь заблокирован' : 'Пользователь разблокирован', user.phone);
    }
    if (b.logout === true) { dropUserSessions(user.id); audit(admin, 'Завершены сеансы пользователя', user.phone); }
    save();
    json(res, 200, { ok: true });
  }],
  ['GET', /^\/api\/admin\/audit$/, async (req, res) => {
    json(res, 200, { items: db.audit.slice(-300).reverse() });
  }],
  ['GET', /^\/api\/admin\/admins$/, async (req, res) => {
    json(res, 200, { items: db.admins.map((a) => ({ id: a.id, login: a.login, owner: !!a.owner, disabled: !!a.disabled, createdAt: a.createdAt, lastLoginAt: a.lastLoginAt || null })) });
  }],
  ['POST', /^\/api\/admin\/admins$/, async (req, res, b, url, m, admin) => {
    if (!admin.owner) return json(res, 403, { error: 'Добавлять администраторов может только владелец.' });
    if (!validLogin(b.login)) return json(res, 400, { error: 'Логин: 3–32 символа, латиница, цифры, точка, дефис.' });
    if (adminByLogin(b.login)) return json(res, 409, { error: 'Такой логин уже есть.' });
    const pe = badPassword(b.password, 10); if (pe) return json(res, 400, { error: pe });
    db.admins.push({ id: crypto.randomUUID(), login: b.login, pass: await hashPassword(b.password), owner: false, createdAt: now() });
    audit(admin, 'Добавлен администратор', b.login);
    json(res, 200, { ok: true });
  }],
  ['POST', /^\/api\/admin\/admins\/([0-9a-f-]{36})$/, async (req, res, b, url, m, admin) => {
    if (!admin.owner) return json(res, 403, { error: 'Только владелец может менять администраторов.' });
    const target = db.admins.find((a) => a.id === m[1]);
    if (!target) return json(res, 404, { error: 'Не найден.' });
    if (target.owner) return json(res, 400, { error: 'Владельца отключить нельзя.' });
    target.disabled = !!b.disabled;
    if (target.disabled) for (const [t, s] of Object.entries(db.adminSessions)) if (s.adminId === target.id) delete db.adminSessions[t];
    audit(admin, target.disabled ? 'Администратор отключён' : 'Администратор включён', target.login);
    json(res, 200, { ok: true });
  }],
  ['POST', /^\/api\/admin\/password$/, async (req, res, b, url, m, admin) => {
    if (!(await checkPassword(String(b.current || ''), admin.pass))) return json(res, 400, { error: 'Текущий пароль неверный.' });
    const pe = badPassword(b.password, 10); if (pe) return json(res, 400, { error: pe });
    admin.pass = await hashPassword(b.password);
    const keep = sha(parseCookies(req).asid || '');
    for (const [t, s] of Object.entries(db.adminSessions)) if (s.adminId === admin.id && t !== keep) delete db.adminSessions[t];
    audit(admin, 'Изменён пароль администратора', admin.login);
    json(res, 200, { ok: true });
  }],
];

// ---------- Статика ----------
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json', '.pdf': 'application/pdf' };
const notFound = (res) => {
  res.writeHead(404, { 'Content-Type': types['.html'], ...SECURITY_HEADERS });
  fs.createReadStream(path.join(ROOT, '404.html')).on('error', () => res.end()).pipe(res);
};
const serveStatic = (req, res, pathname) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end(); }
  let p;
  try { p = decodeURIComponent(pathname); } catch { res.writeHead(400); return res.end(); }
  if (p.includes('\0') || p.split('/').some((seg) => seg.startsWith('.'))) return notFound(res);
  let f = path.normalize(path.join(ROOT, p));
  if (f !== ROOT && !f.startsWith(ROOT + path.sep)) return notFound(res);
  let st = null;
  try { st = fs.statSync(f); if (st.isDirectory()) { f = path.join(f, 'index.html'); st = fs.statSync(f); } } catch { st = null; }
  if (!st || !st.isFile()) return notFound(res);
  const ext = path.extname(f);
  res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400', ...SECURITY_HEADERS });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(f).pipe(res);
};

// ---------- Маршрутизация ----------
const server = http.createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url, 'http://x'); } catch { res.writeHead(400); return res.end(); }
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url.pathname);
  try {
    let handler = routes[`${req.method} ${url.pathname}`];
    let match = null, opts = {};
    if (!handler) {
      for (const [method, re, h, o] of adminRoutes) {
        const m = url.pathname.match(re);
        if (m && method === req.method) { handler = h; match = m; opts = o || {}; break; }
      }
    }
    if (!handler) return json(res, 404, { error: 'Не найдено' });
    let body = {};
    if (req.method === 'POST') {
      // Защита от подделки запросов с чужих сайтов: только JSON и только со своего адреса
      if (!/^application\/json/.test(req.headers['content-type'] || '')) return json(res, 415, { error: 'Ожидается JSON' });
      const origin = req.headers.origin;
      if (origin) {
        let host = '';
        try { host = new URL(origin).host; } catch { /* */ }
        if (host !== req.headers.host) return json(res, 403, { error: 'Запрещено' });
      }
      body = await readBody(req);
    }
    let admin = null;
    if (url.pathname.startsWith('/api/admin/') && !opts.public) {
      admin = currentAdmin(req);
      if (!admin) return json(res, 401, { error: 'Нужно войти в админку.' });
    }
    await handler(req, res, body, url, match, admin);
  } catch (e) {
    if (e.message === 'bad json') return json(res, 400, { error: 'Некорректный запрос' });
    if (e.message === 'too large') return json(res, 413, { error: 'Слишком большой запрос' });
    console.error(e);
    if (!res.headersSent) json(res, 500, { error: 'Ошибка сервера. Попробуйте позже.' });
  }
});
server.headersTimeout = 15000;
server.requestTimeout = 30000;
server.listen(PORT, HOST, () => {
  console.log(`Сайт и API: http://${HOST}:${PORT}`);
  if (SMS_DEMO && !process.env.SMS_API_URL) console.log('Тестовый режим: коды из СМС показываются на странице.');
  ensureSetupToken();
  if (TG_ON) { console.log(`Telegram-бот @${TG_NAME} подключён.`); tgLoop(); }
});
