// Каркас страницы: <head>, шапка, подвал, cookie-баннер (только если подключена Метрика)
const { cfg, esc, pct, pskText, yearRate, money, absUrl, ruDate } = require('./lib');
const { icon } = require('./components');

const C = cfg.company;
const K = cfg.contacts;
const L = cfg.loan;

const nav = [
  { name: 'Получить займ', path: '/#loan' },
  { name: 'Как оформить', path: '/#how' },
  { name: 'О сервисе', path: '/#about' },
  { name: 'Вопрос-ответ', path: '/#faq' },
  { name: 'Контакты', path: '/#contacts' },
];

const logo = () => `<a class="logo" href="/" aria-label="${esc(cfg.brand)} — на главную">
  <svg class="logo__mark" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="12" fill="var(--brand)"/><path d="M11 21.5l6 6 12-14" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>
  <span class="logo__text">${esc(cfg.brand)}</span>
</a>`;

const crumbsHtml = (crumbs, current) => {
  if (!crumbs) return '';
  const all = [{ name: 'Главная', path: '/' }, ...crumbs];
  return `<nav class="crumbs" aria-label="Хлебные крошки"><ol>
    ${all.map((c) => `<li><a href="${c.path}">${esc(c.name)}</a></li>`).join('')}
    <li aria-current="page">${esc(current)}</li>
  </ol></nav>`;
};

const crumbsSchema = (page) => {
  if (!page.crumbs) return null;
  const all = [{ name: 'Главная', path: '/' }, ...page.crumbs, { name: page.crumbName || page.h1, path: page.path }];
  return {
    '@type': 'BreadcrumbList',
    itemListElement: all.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: absUrl(c.path) })),
  };
};

const orgId = absUrl('/#organization');

const orgSchema = () => ({
  '@type': ['FinancialService', 'Organization'],
  '@id': orgId,
  name: C.shortName,
  legalName: C.fullName,
  alternateName: cfg.brand,
  url: absUrl('/'),
  logo: absUrl('/assets/logo.svg'),
  image: absUrl('/assets/logo.svg'),
  telephone: K.phoneHref,
  email: K.email,
  taxID: C.inn,
  address: { '@type': 'PostalAddress', streetAddress: C.officeAddress, addressCountry: 'RU' },
  openingHours: 'Mo-Su 09:00-21:00',
  areaServed: { '@type': 'Country', name: 'Россия' },
  priceRange: `${pct(L.dailyRate)} в день`,
});

const head = (page, assets) => {
  const url = absUrl(page.path);
  const schema = [crumbsSchema(page), ...(page.schema || [])].filter(Boolean);
  if (page.withOrg) schema.unshift(orgSchema());
  const graph = schema.length ? { '@context': 'https://schema.org', '@graph': schema } : null;
  const v = cfg.verification;
  return `<!doctype html>
<html lang="${cfg.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="${page.noindex ? 'noindex, follow' : 'index, follow, max-snippet:-1, max-image-preview:large'}">
<meta property="og:type" content="${page.ogType || 'website'}">
<meta property="og:site_name" content="${esc(cfg.brand)}">
<meta property="og:locale" content="ru_RU">
<meta property="og:title" content="${esc(page.ogTitle || page.title)}">
<meta property="og:description" content="${esc(page.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${absUrl('/assets/og.png')}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
${page.published ? `<meta property="article:published_time" content="${page.published}">\n<meta property="article:modified_time" content="${page.modified || page.published}">` : ''}
<meta name="theme-color" content="#0b6b58">
<meta name="format-detection" content="telephone=no">
${v.yandex ? `<meta name="yandex-verification" content="${v.yandex}">` : ''}
${v.google ? `<meta name="google-site-verification" content="${v.google}">` : ''}
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="stylesheet" href="/assets/styles.css?v=${assets.css}">
${graph ? `<script type="application/ld+json">${JSON.stringify(graph)}</script>` : ''}
</head>`;
};

const header = (page) => `
<header class="header">
  <div class="container header__in">
    ${logo()}
    <button class="burger" type="button" aria-expanded="false" aria-controls="site-nav" data-burger>
      <span class="sr-only">Меню</span><span class="burger__line"></span>
    </button>
    <nav class="nav" id="site-nav" aria-label="Основное меню">
      <ul>
        ${nav.map((n) => `<li><a href="${n.path}"${page.path === n.path ? ' aria-current="page"' : ''}>${n.name}</a></li>`).join('')}
      </ul>
      <div class="nav__extra">
        <a class="nav__phone" href="tel:${K.phoneHref}">${icon('phone')}${K.phone}</a>
        <a class="btn btn--primary" href="/lk/login/" rel="nofollow">${icon('user')}Войти</a>
      </div>
    </nav>
  </div>
</header>`;

const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

const footer = () => `
<footer class="footer" id="contacts">
  <div class="container">
    <div class="footer__top">
      <div class="footer__brand">
        ${logo()}
        <a class="footer__phone" href="tel:${K.phoneHref}">${K.phone}</a>
        <p class="muted">Звонок бесплатный. ${esc(K.hours)}.</p>
        <p><a href="mailto:${K.email}">${K.email}</a> — вопросы и личный кабинет<br><a href="mailto:${K.complaintsEmail}">${K.complaintsEmail}</a> — обращения и жалобы</p>
      </div>
      <div class="footer__col">
        <h2 class="footer__t">Документы</h2>
        <ul>
          <li><a href="/usloviya/">Информация об условиях займа</a></li>
          <li><a href="/dokumenty/">Правила и общие условия</a></li>
          <li><a href="/politika-konfidencialnosti/">Политика обработки персональных данных</a></li>
          <li><a href="/soglasie-na-obrabotku-pd/">Согласие на обработку персональных данных</a></li>
          <li><a href="/cookies/">Политика cookie</a></li>
        </ul>
      </div>
      <div class="footer__col">
        <h2 class="footer__t">Защита прав</h2>
        <ul>
          <li>${ext('https://www.cbr.ru/microfinance/registry/', 'Реестр МФО Банка России')}</li>
          <li>${ext('https://www.cbr.ru/reception/', 'Интернет-приёмная Банка России')}</li>
          <li>${ext('https://finombudsman.ru/', 'Финансовый уполномоченный')}</li>
          <li>${ext('https://www.cbr.ru/microfinance/', 'Базовые стандарты для МФО')}</li>
          <li>${ext(C.sroUrl, esc(C.sroName))}</li>
        </ul>
      </div>
    </div>
    <div class="footer__legal">
      <p>${esc(C.fullName)}, ИНН ${C.inn}, ОГРН ${C.ogrn}. Номер в государственном реестре МФО ${C.cbrRegNumber} от ${C.cbrRegDate}. Член ${esc(C.sroName)} с ${C.sroMemberSince}, № ${esc(C.sroMemberNumber)}. Адрес: ${esc(C.legalAddress)}. ${esc(C.branches)}.</p>
      <p>Сумма от ${money(L.minAmount)} до ${money(L.maxAmount)}, срок от ${L.minTerm} до ${L.maxTerm} дней, ставка ${pct(L.dailyRate)} в день (${yearRate()} годовых), ПСК ${pskText()}. Неустойка — не более ${L.penaltyRate}${'\u00a0'}% годовых. Переплата не может превышать ${L.overpaymentCap}${'\u00a0'}% от суммы займа. Решение о выдаче принимается индивидуально. Споры до 500${'\u00a0'}000${'\u00a0'}₽ рассматривает финансовый уполномоченный: 8 800 200-00-10.</p>
    </div>
    <div class="footer__bottom">
      <span>© ${new Date(cfg.updated).getFullYear()} ${esc(C.shortName)}</span>
      <span>Информация актуальна на ${ruDate(cfg.updated)}</span>
    </div>
  </div>
</footer>`;

const cookieBanner = () => `
<div class="cookie" data-cookie hidden role="region" aria-label="Уведомление о cookie">
  <p>Мы используем обязательные cookie для работы сайта. Аналитические cookie (Яндекс Метрика) включаются только с вашего согласия. <a href="/cookies/">Подробнее</a></p>
  <div class="cookie__btns">
    <button class="btn btn--ghost" type="button" data-cookie-choice="necessary">Только необходимые</button>
    <button class="btn btn--primary" type="button" data-cookie-choice="all">Принять все</button>
  </div>
</div>`;

const pageHeader = (page) =>
  page.customHero
    ? ''
    : `<div class="page-head"><div class="container">
  ${crumbsHtml(page.crumbs, page.crumbName || page.h1)}
  <h1 class="page-head__t">${page.h1}</h1>
  ${page.lead ? `<p class="page-head__lead">${page.lead}</p>` : ''}
  ${page.meta ? `<p class="page-head__meta">${page.meta}</p>` : ''}
</div></div>`;

const render = (page, assets) => `${head(page, assets)}
<body data-endpoint="${esc(cfg.formEndpoint)}" data-metrika="${esc(cfg.metrikaId)}" data-lk="${esc(cfg.lkUrl)}" data-lk-login-url="${esc(cfg.lkLoginEndpoint)}" data-lk-reset-url="${esc(cfg.lkResetEndpoint)}">
<a class="skip" href="#main">Перейти к содержанию</a>
${header(page)}
<main id="main">
${pageHeader(page)}
${page.body}
</main>
${footer()}
${cfg.metrikaId ? cookieBanner() : ''}
<script src="/assets/app.js?v=${assets.js}" defer></script>
</body>
</html>
`;

module.exports = { render, orgSchema, orgId, nav };
