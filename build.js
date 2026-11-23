#!/usr/bin/env node
// Сборка статического сайта в папку dist/. Без внешних зависимостей: node build.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

const { cfg, base, esc, absUrl, ruDate } = require('./src/lib');
const { render, orgId } = require('./src/layout');
const mainPages = require('./src/pages');
const legal = require('./src/legal');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'dist');

const pages = [...mainPages, ...legal];

// ---------- Проверки качества (SEO и юридические) ----------
const problems = [];
const seenTitles = new Map();
const seenDesc = new Map();
for (const p of pages) {
  if (p.noindex) continue;
  if (!p.title || p.title.length > 75) problems.push(`title ${p.path}: ${p.title.length} симв. (рекомендуется до 70)`);
  if (!p.description || p.description.length < 70 || p.description.length > 175) problems.push(`description ${p.path}: ${p.description.length} симв. (рекомендуется 70–170)`);
  if (seenTitles.has(p.title)) problems.push(`дубль title: ${p.path} и ${seenTitles.get(p.title)}`);
  if (seenDesc.has(p.description)) problems.push(`дубль description: ${p.path} и ${seenDesc.get(p.description)}`);
  seenTitles.set(p.title, p.path);
  seenDesc.set(p.description, p.path);
}
// Запрещённые/вводящие в заблуждение формулировки в рекламе финансовых услуг (38-ФЗ, базовый стандарт)
const banned = [/без отказа/i, /100\s*%\s*одобрени/i, /гарантир\w* одобрени/i, /одобряем всем/i, /без проверки кредитной/i];

// ---------- Ассеты ----------
const rm = (d) => fs.rmSync(d, { recursive: true, force: true });
const write = (rel, data) => {
  const f = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, data);
};
const copyDir = (from, to) => {
  if (!fs.existsSync(from)) return;
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, e.name);
    const d = path.join(to, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else {
      fs.mkdirSync(path.dirname(d), { recursive: true });
      fs.copyFileSync(s, d);
    }
  }
};
const hash = (f) => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex').slice(0, 8);

rm(OUT);
copyDir(path.join(ROOT, 'assets'), path.join(OUT, 'assets'));
copyDir(path.join(ROOT, 'static'), OUT);
const assets = { css: hash(path.join(ROOT, 'assets/styles.css')), js: hash(path.join(ROOT, 'assets/app.js')) };

// ---------- PNG без зависимостей (og-картинка и иконки) ----------
function png(w, h, pixel) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b] = pixel(x, y);
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};
// Логотип: скруглённый квадрат с галочкой, как в logo.svg (сетка 40×40)
const logoPixel = (lx, ly, bg) => {
  const brand = [11, 107, 88], white = [255, 255, 255];
  const r = 12, cx = Math.min(Math.max(lx, r), 40 - r), cy = Math.min(Math.max(ly, r), 40 - r);
  if (lx < 0 || ly < 0 || lx > 40 || ly > 40 || Math.hypot(lx - cx, ly - cy) > r) return bg;
  const d = Math.min(segDist(lx, ly, 11, 21.5, 17, 27.5), segDist(lx, ly, 17, 27.5, 29, 13.5));
  return d < 2 ? white : d < 2.6 ? mix(white, brand, (d - 2) / 0.6) : brand;
};
const og = png(1200, 630, (x, y) => {
  const bg = mix([232, 245, 240], [205, 236, 226], (x + y) / 1830);
  const s = 260 / 40; // логотип 260px по центру
  return logoPixel((x - 470) / s, (y - 185) / s, bg);
});
// Свою картинку положите в static/assets/og.png — тогда сгенерированная не используется
if (!fs.existsSync(path.join(ROOT, 'static/assets/og.png'))) write('assets/og.png', og);
write('assets/apple-touch-icon.png', png(180, 180, (x, y) => logoPixel(x / 4.5, y / 4.5, [11, 107, 88])));
write('assets/icon-512.png', png(512, 512, (x, y) => logoPixel(x / 12.8, y / 12.8, [11, 107, 88])));

// ---------- Страницы ----------
for (const p of pages) {
  // Корневые ссылки /path → /base/path, чтобы сайт работал и из подпапки
  const html = render(p, assets).replace(/(href|src|action)="\/(?!\/)/g, `$1="${base}/`);
  // Цитаты в «ёлочках» — это примеры недопустимых обещаний в предупреждениях, их не проверяем
  const text = html.replace(/<[^>]+>/g, ' ').replace(/«[^»]*»/g, '');
  for (const re of banned) if (re.test(text)) problems.push(`${p.path}: недопустимая формулировка ${re}`);
  if ((html.match(/<h1[\s>]/g) || []).length !== 1) problems.push(`${p.path}: должен быть ровно один h1`);
  write(p.file || path.join(p.path, 'index.html'), html);
}

// ---------- sitemap.xml, robots.txt, manifest ----------
const indexable = pages.filter((p) => !p.noindex && !p.noSitemap);
write(
  'sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${indexable
  .map((p) => `  <url><loc>${absUrl(p.path)}</loc><lastmod>${p.modified || cfg.updated}</lastmod><changefreq>${p.changefreq || 'monthly'}</changefreq><priority>${(p.priority ?? 0.5).toFixed(1)}</priority></url>`)
  .join('\n')}
</urlset>
`
);
write(
  'robots.txt',
  `User-agent: *
Allow: /
Disallow: /lk/
Disallow: /*?
Allow: /*?v=

User-agent: Yandex
Allow: /
Disallow: /lk/
Clean-param: utm_source&utm_medium&utm_campaign&utm_content&utm_term&yclid&gclid&from /

Sitemap: ${absUrl('/sitemap.xml')}
`
);
write(
  'manifest.webmanifest',
  JSON.stringify({
    name: `${cfg.brand} — ${cfg.slogan}`,
    short_name: cfg.brand,
    lang: 'ru',
    start_url: base + '/',
    display: 'browser',
    background_color: '#f5f8f7',
    theme_color: '#0b6b58',
    icons: [
      { src: base + '/assets/favicon.svg', type: 'image/svg+xml', sizes: 'any' },
      { src: base + '/assets/icon-512.png', type: 'image/png', sizes: '512x512' },
    ],
  }, null, 2)
);

// Отчёт
const placeholders = JSON.stringify(cfg).match(/\[[^\]]+\]|0{9,}/g) || [];
console.log(`✓ Собрано страниц: ${pages.length} → ${path.relative(ROOT, OUT)}/`);
if (placeholders.length) console.log(`! В site.config.js осталось заглушек: ${placeholders.length} — заполните реквизиты перед публикацией.`);
if (problems.length) {
  console.log('! Замечания:\n  - ' + problems.join('\n  - '));
  if (process.argv.includes('--strict')) process.exit(1);
}
