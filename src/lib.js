// Общие утилиты и расчёты, которые используются и при сборке, и в шаблонах
const cfg = require('../site.config');

// Адрес можно переопределить при сборке: SITE_URL=https://user.github.io/repo node build.js
cfg.url = (process.env.SITE_URL || cfg.url).replace(/\/+$/, '');
// Подпапка, если сайт открывается не из корня домена (например, GitHub Pages: /repo)
const base = new URL(cfg.url).pathname.replace(/\/+$/, '');
// API_BASE= (пусто) — сборка без сервера, например для GitHub Pages
if (process.env.API_BASE !== undefined) cfg.apiBase = process.env.API_BASE;

const NBSP = ' ';

const esc = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const num = (n) => Math.round(n).toLocaleString('ru-RU').replace(/\s/g, NBSP);
const money = (n) => `${num(n)}${NBSP}₽`;
const pct = (n, digits = 1) =>
  Number(n).toFixed(digits).replace(/\.0+$/, '').replace('.', ',') + NBSP + '%';

// ПСК для займа с единовременным возвратом при постоянной дневной ставке:
// ПСК = ставка в день × 365 (ч. 2 ст. 6 353-ФЗ, базовый период — день). Три знака после запятой.
const pskFromRate = (daily) => (daily * 365).toFixed(3).replace('.', ',');

const psk = () => {
  if (cfg.loan.pskOverride) return cfg.loan.pskOverride;
  const v = pskFromRate(cfg.loan.dailyRate);
  return { min: v, max: v };
};

const pskText = () => {
  const p = psk();
  return p.min === p.max ? `${p.min}${NBSP}% годовых` : `от ${p.min} до ${p.max}${NBSP}% годовых`;
};

const yearRate = () => pct(cfg.loan.dailyRate * 365, 3).replace(/,000/, '');

// Пример расчёта: сумма, срок → переплата и сумма к возврату
const calc = (amount, days) => {
  const interest = Math.round((amount * cfg.loan.dailyRate * days) / 100);
  return { interest, total: amount + interest };
};

const absUrl = (p) => cfg.url + p;

const ruDate = (iso) => {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
};

module.exports = { cfg, base, NBSP, esc, num, money, pct, psk, pskText, yearRate, calc, absUrl, ruDate };
