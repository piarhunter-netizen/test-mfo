// Основные страницы сайта
const fs = require('fs');
const path = require('path');
const { cfg, NBSP, esc, money, pct, pskText, yearRate, calc, absUrl, ruDate } = require('./lib');
const { icon, pskBox, faqBlock, faqSchema, features, conditionsTable, cta, riskNote, applyCard } = require('./components');
const { orgId } = require('./layout');

const C = cfg.company;
const K = cfg.contacts;
const L = cfg.loan;
const maxM = money(L.maxAmount);
const ex = calc(L.defaultAmount, L.maxTerm);

// ---------- Вопросы и ответы (общий пул) ----------
const faq = {
  who: { q: 'Кто может получить займ?', a: `Гражданин России в возрасте от ${L.minAge} до ${L.maxAge} лет с действующим паспортом, постоянной регистрацией, мобильным телефоном и банковской картой или счётом на своё имя. Справки о доходе и поручители не нужны.` },
  time: { q: 'Как быстро рассматривается заявка?', a: 'Обычно решение принимается автоматически за несколько минут после заполнения анкеты. Иногда нужна дополнительная проверка — тогда мы сообщим об этом по СМС. Период охлаждения (от 4 до 48 часов) закон устанавливает для займов от 50 000 ₽, наши займы — меньше этой суммы. При этом выдача может быть приостановлена, если операция имеет признаки мошенничества.' },
  badCh: { q: 'Можно ли получить займ с плохой кредитной историей?', a: 'Мы рассматриваем каждую заявку, и кредитная история — лишь один из факторов. Учитываются текущая долговая нагрузка, доход и другие данные анкеты. Гарантировать одобрение не может ни одна МФО — будьте осторожны с теми, кто это обещает.' },
  repay: { q: 'Как погасить займ?', a: 'Банковской картой в личном кабинете, по СБП или переводом по реквизитам компании. Подробные инструкции — на странице <a href="/kak-pogasit/">«Как погасить займ»</a>.' },
  early: { q: 'Можно ли вернуть займ досрочно?', a: 'Да, полностью или частично в любой день без комиссий и предварительного уведомления. Проценты начисляются только за фактические дни пользования деньгами.' },
  late: { q: 'Что будет, если не получится вернуть вовремя?', a: `Начисляется неустойка — не более ${L.penaltyRate}${NBSP}% годовых от просроченной суммы, сведения о просрочке передаются в бюро кредитных историй. Общая сумма процентов, неустойки и платежей не может превысить ${L.overpaymentCap}${NBSP}% от суммы займа. Если вы понимаете, что не успеваете, свяжитесь с нами до даты платежа: можно обсудить продление или реструктуризацию. Также у вас есть право на кредитные каникулы в случаях, предусмотренных ст. 6.1-1 Федерального закона № 353-ФЗ.` },
  hidden: { q: 'Есть ли скрытые комиссии и платные услуги?', a: 'Нет. Всё, что вы заплатите, указано в индивидуальных условиях договора и включено в ПСК. Дополнительные услуги не обязательны для получения займа и подключаются только с вашего отдельного согласия; от платной услуги можно отказаться в течение 30 дней и вернуть деньги за неё.' },
  safe: { q: 'Безопасно ли оформлять займ онлайн?', a: 'Данные передаются по защищённому соединению и хранятся на серверах в России. Сотрудники компании никогда не спрашивают коды из СМС, пароли и данные карты по телефону. Проверьте, что адрес сайта в браузере совпадает с нашим, а компания есть в реестре МФО Банка России.' },
  selfban: { q: 'Выдадите ли займ, если у меня установлен самозапрет?', a: 'Нет. С 1 марта 2025 года МФО обязаны проверять самозапрет в кредитной истории и не вправе выдавать займ при его наличии. Снять самозапрет можно на Госуслугах.' },
  limit3: { q: 'Почему могут отказать, если у меня уже есть займы?', a: 'С 1 октября 2026 года МФО не вправе выдать заём с ПСК выше 200 % годовых, если у заёмщика уже есть два действующих таких займа. Кроме того, мы обязаны оценить показатель долговой нагрузки и не выдавать деньги, если платежи по долгам становятся слишком высокими относительно дохода.' },
  prolong: { q: 'Можно ли продлить займ?', a: 'Да, по дополнительному соглашению до даты платежа. При продлении проценты продолжают начисляться по той же ставке, но общая переплата всё равно ограничена законом. Обычно выгоднее вернуть хотя бы часть долга досрочно.' },
  pension: { q: 'Нужно ли пенсионеру подтверждать доход?', a: 'Достаточно указать размер пенсии в анкете. Мы вправе запросить сведения для оценки долговой нагрузки — это защищает от займа, который будет сложно вернуть.' },
  sbp: { q: 'Что нужно, чтобы получить деньги через СБП?', a: 'Номер телефона, привязанный к вашему счёту в банке — участнике Системы быстрых платежей. Перевод возможен только на счёт, открытый на имя заёмщика: мы сверяем ФИО получателя.' },
  card: { q: 'На какие карты можно получить займ?', a: 'На именные карты «Мир» российских банков, оформленные на заёмщика. Карту нужно привязать в анкете: для проверки на ней может быть временно заблокирована и сразу возвращена небольшая сумма.' },
};

const homeFaq = [faq.who, faq.time, faq.badCh, faq.early, faq.late, faq.hidden];


// ---------- Главная ----------
const home = {
  path: '/',
  title: `Займ на карту до ${num(L.maxAmount)} ₽ онлайн — ${cfg.brand}`,
  description: `Займ онлайн на карту или через СБП от ${num(L.minAmount)} до ${num(L.maxAmount)} ₽ на срок до ${L.maxTerm} дней. Ставка ${pct(L.dailyRate)} в день, ПСК ${pskText()}. МКК в реестре Банка России.`,
  h1: `Займ на карту до ${maxM}`,
  customHero: true,
  withOrg: true,
  priority: 1.0,
  changefreq: 'weekly',
  schema: [
    { '@type': 'WebSite', '@id': absUrl('/#website'), url: absUrl('/'), name: cfg.brand, inLanguage: 'ru-RU', publisher: { '@id': orgId } },
    loanSchema('/', 'Онлайн-займ на карту'),
    faqSchema(homeFaq),
  ],
  body: `
<section class="hero hero--one">
  <div class="container hero__in">
    <div class="hero__text">
      <h1 class="hero__t">Займ до${NBSP}${maxM} на${NBSP}карту</h1>
      <p class="hero__lead">Оформление онлайн за 10 минут. Сумму к возврату и полную стоимость вы видите до подписания договора.</p>
    </div>
    <div class="hero__calc">${applyCard('loan')}</div>
  </div>
</section>

<div class="container">
  <section class="section" id="how" aria-labelledby="how-title">
    <h2 class="section__title" id="how-title">Как оформить займ?</h2>
    <ol class="steps">
      ${[
        ['Выберите сумму и срок', 'Передвиньте ползунки — сразу увидите, сколько вернуть.'],
        ['Заполните анкету', 'Паспорт, телефон и доход. Около 5 минут.'],
        ['Подпишите договор', 'Кодом из СМС. Условия и ПСК — до подписи.'],
        ['Получите деньги', 'На карту или по СБП на счёт на ваше имя.'],
      ].map(([t, d], i) => `<li class="step"><span class="step__n">${i + 1}</span><h3 class="step__t">${t}</h3><p>${d}</p></li>`).join('')}
    </ol>
  </section>

  <section class="section" id="about" aria-labelledby="about-title">
    <h2 class="section__title" id="about-title">Надёжный партнёр в финансовых решениях</h2>
    ${features([
      { i: 'percent', t: 'Прозрачные условия', d: `Ставка ${pct(L.dailyRate)} в день и ПСК ${pskText()}. Никаких скрытых платежей.` },
      { i: 'bolt', t: 'Быстрое решение', d: 'Решение обычно за несколько минут, деньги — сразу после подписания.' },
      { i: 'user', t: 'Рассматриваем каждого', d: 'Даже если в кредитной истории были просрочки.' },
      { i: 'lock', t: 'Защита данных', d: 'Шифрование и хранение данных на серверах в России.' },
    ])}
  </section>

  ${faqBlock(homeFaq, { title: 'Часто задаваемые вопросы' })}
  <p class="hotline">${icon('phone')}<span>Остались вопросы? Звоните <a href="tel:${K.phoneHref}">${K.phone}</a> — бесплатно, ${esc(K.hours.toLowerCase())}.</span></p>

  <section class="section" id="docs" aria-labelledby="docs-title">
    <h2 class="section__title" id="docs-title">Документы</h2>
    <ul class="docs docs--grid">
      <li class="doc">${icon('doc', 'doc__ico')}<a href="/usloviya/">Информация об условиях предоставления займа</a></li>
      <li class="doc">${icon('doc', 'doc__ico')}<a href="/dokumenty/">Правила предоставления займов</a></li>
      <li class="doc">${icon('doc', 'doc__ico')}<a href="/politika-konfidencialnosti/">Политика обработки персональных данных</a></li>
      <li class="doc">${icon('doc', 'doc__ico')}<a href="/dokumenty/">Все документы компании</a></li>
    </ul>
  </section>

</div>`,
};

// ---------- Посадочные страницы продуктов ----------
function loanSchema(p, name) {
  return {
    '@type': 'LoanOrCredit',
    '@id': absUrl(p + '#loan'),
    name,
    provider: { '@id': orgId },
    loanTerm: { '@type': 'QuantitativeValue', minValue: L.minTerm, maxValue: L.maxTerm, unitCode: 'DAY' },
    amount: { '@type': 'MonetaryAmount', minValue: L.minAmount, maxValue: L.maxAmount, currency: 'RUB' },
    interestRate: { '@type': 'QuantitativeValue', value: L.dailyRate, unitText: '% в день' },
    annualPercentageRate: Number((L.dailyRate * 365).toFixed(3)),
    currency: 'RUB',
    areaServed: 'RU',
    loanRepaymentForm: 'Единовременный платёж в конце срока',
    feesAndCommissionsSpecification: absUrl('/usloviya/'),
  };
}

function num(n) {
  return Math.round(n).toLocaleString('ru-RU').replace(/\s/g, NBSP);
}

// ---------- Условия ----------
const usloviya = {
  path: '/usloviya/',
  title: `Условия и тарифы займа: ставка, ПСК, пример расчёта — ${cfg.brand}`,
  description: `Условия займа ${C.shortName}: сумма ${num(L.minAmount)}–${num(L.maxAmount)} ₽, срок ${L.minTerm}–${L.maxTerm} дней, ставка ${pct(L.dailyRate)} в день, ПСК ${pskText()}, неустойка, предельная переплата.`,
  h1: 'Условия и тарифы',
  lead: 'Всё, что влияет на стоимость займа, — на одной странице.',
  crumbs: [],
  priority: 0.9,
  schema: [loanSchema('/usloviya/', 'Онлайн-займ')],
  body: `
<div class="container narrow">
  ${pskBox()}
  <section class="section">
    <h2 class="section__title">Основные условия</h2>
    ${conditionsTable()}
  </section>
  <section class="section prose">
    <h2>Пример расчёта</h2>
    <p>Займ ${money(L.defaultAmount)} на ${L.maxTerm} дней по ставке ${pct(L.dailyRate)} в день:</p>
    <ul>
      <li>проценты: ${money(L.defaultAmount)} × ${pct(L.dailyRate)} × ${L.maxTerm} дней = ${money(ex.interest)};</li>
      <li>сумма к возврату: ${money(ex.total)};</li>
      <li>при досрочном возврате на 10-й день: ${money(calc(L.defaultAmount, 10).total)}.</li>
    </ul>
    <h2>Полная стоимость займа</h2>
    <p>Полная стоимость займа (ПСК) — ${pskText()}. Она рассчитывается по формуле ст. 6 Федерального закона № 353-ФЗ «О потребительском кредите (займе)» и включает все платежи заёмщика по договору. Банк России ежеквартально публикует среднерыночные и предельные значения ПСК; наша ПСК не превышает предельного значения для соответствующей категории займов.</p>
    <h2>Ответственность за просрочку</h2>
    <p>За неисполнение обязательств начисляется неустойка не более ${L.penaltyRate}${NBSP}% годовых от суммы просроченной задолженности — при этом проценты за пользование займом продолжают начисляться. После того как сумма процентов, неустойки, иных мер ответственности и платежей за услуги достигнет ${L.overpaymentCap}${NBSP}% от суммы займа, начисление прекращается (ч. 24 ст. 5 353-ФЗ; для договоров, заключённых до 01.04.2026, — 130${NBSP}%).</p>
    <h2>Дополнительные услуги</h2>
    <p>Получение займа не зависит от покупки дополнительных услуг. Если вы решите подключить услугу, мы заранее покажем её стоимость, поставщика и порядок отказа. Согласие на услугу даётся отдельно и никогда не проставляется за вас. Отказаться от платной услуги и вернуть деньги можно в течение 30 календарных дней.</p>
    <h2>Изменение условий</h2>
    <p>Компания не вправе в одностороннем порядке ухудшать условия уже заключённого договора. Актуальные редакции общих условий и правил предоставления займов опубликованы в разделе <a href="/dokumenty/">«Документы»</a>.</p>
  </section>
  ${riskNote()}
  ${cta()}
</div>`,
};

// ---------- Документы ----------
const docs = [
  ['Информация об условиях предоставления, использования и возврата займа', 'informaciya-ob-usloviyah'],
  ['Общие условия договора потребительского займа', 'obshchie-usloviya'],
  ['Правила предоставления микрозаймов', 'pravila-predostavleniya'],
  ['Соглашение об использовании аналога собственноручной подписи', 'soglashenie-asp', 'asp'],
  ['Политика обработки персональных данных', null, null, '/politika-konfidencialnosti/'],
  ['Согласие на обработку персональных данных', null, null, '/soglasie-na-obrabotku-pd/'],
  ['Согласие на получение кредитного отчёта из БКИ', 'soglasie-bki'],
  ['Согласие на получение рекламы', 'soglasie-reklama'],
  ['Политика по противодействию легализации доходов (выписка)', 'pod-ft'],
  ['Порядок рассмотрения обращений получателей финансовых услуг', 'poryadok-obrashcheniy'],
  ['Сведения о составе органов управления', 'organy-upravleniya'],
  ['Сведения о лицах, контролирующих компанию', 'kontroliruyushchie-lica'],
  ['Свидетельство о членстве в СРО', 'svidetelstvo-sro'],
  ['Информация о рисках, связанных с заключением договора', 'informaciya-o-riskah'],
  ['Памятка Банка России для заёмщиков МФО', 'pamyatka-cb'],
  ['Информация о праве обращения к финансовому уполномоченному', 'finomb'],
];
const dokumenty = {
  path: '/dokumenty/',
  title: `Документы ${C.shortName}: правила, общие условия, политики`,
  description: 'Правила предоставления займов, общие условия договора, информация об условиях, политика обработки персональных данных и другие документы компании.',
  h1: 'Документы',
  lead: 'Правила, общие условия и иные документы, которые компания раскрывает в соответствии с требованиями Банка России.',
  crumbs: [],
  priority: 0.6,
  body: `
<div class="container narrow">
  <ul class="docs">
    ${docs
      .map(([name, file, anchor, href]) => {
        const id = anchor ? ` id="${anchor}"` : '';
        if (href) return `<li class="doc"${id}>${icon('doc', 'doc__ico')}<a href="${href}">${name}</a><span class="doc__meta">HTML</span></li>`;
        // PDF показываем ссылкой, только если файл реально лежит в static/docs — без битых ссылок
        const exists = fs.existsSync(path.join(__dirname, '..', 'static', 'docs', file + '.pdf'));
        return exists
          ? `<li class="doc"${id}>${icon('doc', 'doc__ico')}<a href="/docs/${file}.pdf" target="_blank" rel="noopener">${name}</a><span class="doc__meta">PDF</span></li>`
          : `<li class="doc doc--missing"${id}>${icon('doc', 'doc__ico')}<span>${name}</span><span class="doc__meta">добавьте static/docs/${file}.pdf</span></li>`;
      })
      .join('\n    ')}
  </ul>
  <p class="small muted">Архив предыдущих редакций документов предоставляется по запросу на ${K.email}. </p>
</div>`,
};

// ---------- Вход и регистрация в личном кабинете ----------
const field = (label, input, err) => `
      <label class="field">
        <span class="field__label">${label}</span>
        ${input}
        <span class="field__err">${err}</span>
      </label>`;
const phoneInput = '<input class="input" type="tel" name="phone" inputmode="tel" autocomplete="tel" placeholder="+7 (900) 000-00-00" required>';
const passInput = (name, ac) => `<span class="pass"><input class="input" type="password" name="${name}" autocomplete="${ac}" minlength="8"><button class="pass__toggle" type="button" data-toggle-pass aria-label="Показать пароль">${icon('lock')}</button></span>`;

const lkLogin = {
  path: '/lk/login/',
  title: `Вход в личный кабинет — ${cfg.brand}`,
  description: 'Вход и регистрация в личном кабинете заёмщика: заявки, займы, погашение и документы.',
  h1: 'Личный кабинет',
  customHero: true,
  noindex: true,
  noSitemap: true,
  body: `
<section class="auth">
  <div class="auth__card">
    <h1 class="auth__t">Личный кабинет</h1>
    <div class="auth__tabs" role="tablist">
      <button type="button" role="tab" data-auth-mode="login" aria-selected="true">Вход</button>
      <button type="button" role="tab" data-auth-mode="register" aria-selected="false">Регистрация</button>
    </div>

    <form class="auth__form" data-auth="login" novalidate>
      ${field('Телефон', phoneInput, 'Введите номер полностью')}
      ${field('Пароль', passInput('password', 'current-password'), 'Введите пароль')}
      <button class="btn btn--primary btn--lg btn--block" type="submit">Войти</button>
      <p class="auth__links"><button class="linklike" type="button" data-auth-mode="reset">Забыли пароль?</button></p>
      <div class="auth__msg" data-msg hidden></div>
    </form>

    <form class="auth__form" data-auth="register" novalidate hidden>
      ${field('Телефон', phoneInput, 'Введите номер полностью')}
      <fieldset class="consents" data-step1>
        <label class="check"><input type="checkbox" name="pd" required><span><a href="/soglasie-na-obrabotku-pd/" target="_blank">согласие на обработку персональных данных</a></span></label>
        <label class="check"><input type="checkbox" name="asp" required><span><a href="/dokumenty/#asp" target="_blank">соглашение о простой электронной подписи</a></span></label>
      </fieldset>
      <div data-step2 hidden>
        ${field('Код из СМС', '<input class="input" type="text" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6">', 'Введите код из СМС')}
        ${field('Придумайте пароль', passInput('password', 'new-password'), 'Не короче 8 символов')}
        ${field('Повторите пароль', passInput('password2', 'new-password'), 'Пароли не совпадают')}
      </div>
      <button class="btn btn--primary btn--lg btn--block" type="submit" data-submit>Получить код</button>
      <div class="auth__msg" data-msg hidden></div>
    </form>

    <form class="auth__form" data-auth="reset" novalidate hidden>
      <p class="auth__sub">Отправим код в СМС на номер, указанный при регистрации.</p>
      ${field('Телефон', phoneInput, 'Введите номер полностью')}
      <div data-step2 hidden>
        ${field('Код из СМС', '<input class="input" type="text" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6">', 'Введите код из СМС')}
        ${field('Новый пароль', passInput('password', 'new-password'), 'Не короче 8 символов')}
      </div>
      <button class="btn btn--primary btn--lg btn--block" type="submit" data-submit>Получить код</button>
      <p class="auth__links"><button class="linklike" type="button" data-auth-mode="login">Вернуться ко входу</button></p>
      <div class="auth__msg" data-msg hidden></div>
    </form>
  </div>
  <aside class="auth__safe">${icon('shield')}<p><strong>Берегите данные.</strong> Сотрудники ${esc(cfg.brand)} никогда не спрашивают пароль и коды из СМС.</p></aside>
</section>`,
};

const lkCabinet = {
  path: '/lk/',
  title: `Личный кабинет — ${cfg.brand}`,
  description: 'Личный кабинет заёмщика: заявки, статус решения, документы.',
  h1: 'Личный кабинет',
  customHero: true,
  noindex: true,
  noSitemap: true,
  body: `
<section class="cab container" data-cab>
  <div class="cab__head">
    <div>
      <h1 class="cab__t">Личный кабинет</h1>
      <p class="muted" data-cab-user>Загрузка…</p>
    </div>
    <button class="btn btn--ghost" type="button" data-logout>Выйти</button>
  </div>
  <div class="cab__grid">
    <section class="cab__card">
      <h2 class="cab__h">Мои заявки</h2>
      <div data-cab-apps><p class="muted">Загрузка…</p></div>
      <a class="btn btn--primary" href="/#loan">Новая заявка</a>
    </section>
    <section class="cab__card">
      <h2 class="cab__h">Документы</h2>
      <ul class="cab__links">
        <li><a href="/usloviya/">Информация об условиях займа</a></li>
        <li><a href="/dokumenty/">Правила и общие условия</a></li>
        <li><a href="/politika-konfidencialnosti/">Политика обработки персональных данных</a></li>
      </ul>
      <h2 class="cab__h">Поддержка</h2>
      <p><a href="tel:${K.phoneHref}">${K.phone}</a><br><span class="muted">${esc(K.hours)}</span></p>
    </section>
  </div>
  <div class="auth__msg" data-msg hidden></div>
</section>`,
};

// ---------- 404 ----------
const notFound = {
  path: '/404.html',
  file: '404.html',
  title: 'Страница не найдена — ' + cfg.brand,
  description: 'Такой страницы нет. Перейдите на главную или в раздел условий займа.',
  h1: 'Страница не найдена',
  lead: 'Возможно, она была удалена или вы ошиблись в адресе.',
  noindex: true,
  noSitemap: true,
  body: `<div class="container narrow"><p class="btn-row"><a class="btn btn--primary" href="/">На главную</a><a class="btn btn--ghost" href="/lk/login/">Личный кабинет</a></p></div>`,
};

module.exports = [home, usloviya, dokumenty, lkLogin, lkCabinet, notFound];
