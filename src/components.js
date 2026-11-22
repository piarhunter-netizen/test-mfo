// Переиспользуемые блоки страниц
const { cfg, NBSP, esc, money, pct, pskText, yearRate, calc } = require('./lib');

const paths = {
  shield: '<path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  card: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 15h4"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  doc: '<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  percent: '<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10.5" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 018 0v3"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.5"/>',
  chat: '<path d="M4 5h16v11H9l-5 4V5z"/>',
  alert: '<path d="M12 3l9.5 17h-19L12 3z"/><path d="M12 10v4M12 17v.5"/>',
  wallet: '<path d="M4 7h14a2 2 0 012 2v9a2 2 0 01-2 2H5a1 1 0 01-1-1V7z"/><path d="M4 7l11-3v3M16 13.5h.5"/>',
  scale: '<path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a3 3 0 006 0L5 7zM19 7l-3 7a3 3 0 006 0l-3-7z"/>',
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1v-9z"/>',
};

const icon = (name, cls = '') =>
  `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || ''}</svg>`;

const L = cfg.loan;

// Блок с ПСК. По 353-ФЗ (ст. 5, 6) диапазон ПСК размещается в верхней части страницы
// шрифтом не меньше шрифта, которым указана процентная ставка, — поэтому ставка и ПСК
// выводятся в одном и том же стиле.
const pskBox = () => `
<div class="psk" role="note" aria-label="Стоимость займа">
  <div class="psk__item"><span class="psk__label">Ставка</span><span class="psk__value">${pct(L.dailyRate)} в день (${yearRate()} годовых)</span></div>
  <div class="psk__item"><span class="psk__label">Полная стоимость займа (ПСК)</span><span class="psk__value">${pskText()}</span></div>
</div>`;

const calculator = ({ id = 'calc', title = 'Рассчитайте займ', heading = 'h2' } = {}) => {
  const ex = calc(L.defaultAmount, L.defaultTerm);
  return `
<section class="calc" id="${id}" aria-labelledby="${id}-title" data-rate="${L.dailyRate}">
  <${heading} class="calc__title" id="${id}-title">${title}</${heading}>
  <div class="calc__field">
    <div class="calc__row">
      <label for="${id}-amount">Сумма займа</label>
      <output class="calc__out" data-out="amount" for="${id}-amount">${money(L.defaultAmount)}</output>
    </div>
    <input class="range" type="range" id="${id}-amount" name="amount" data-role="amount"
      min="${L.minAmount}" max="${L.maxAmount}" step="${L.step}" value="${L.defaultAmount}"
      aria-valuetext="${L.defaultAmount} рублей">
    <div class="calc__limits"><span>${money(L.minAmount)}</span><span>${money(L.maxAmount)}</span></div>
  </div>
  <div class="calc__field">
    <div class="calc__row">
      <label for="${id}-term">Срок</label>
      <output class="calc__out" data-out="term" for="${id}-term">${L.defaultTerm}${NBSP}дн.</output>
    </div>
    <input class="range" type="range" id="${id}-term" name="term" data-role="term"
      min="${L.minTerm}" max="${L.maxTerm}" step="1" value="${L.defaultTerm}"
      aria-valuetext="${L.defaultTerm} дней">
    <div class="calc__limits"><span>${L.minTerm}${NBSP}дней</span><span>${L.maxTerm}${NBSP}дней</span></div>
  </div>
  <dl class="calc__summary">
    <div><dt>Проценты за срок</dt><dd data-out="interest">${money(ex.interest)}</dd></div>
    <div><dt>Вернуть</dt><dd data-out="total" class="calc__total">${money(ex.total)}</dd></div>
    <div><dt>Дата возврата</dt><dd data-out="date">через ${L.defaultTerm}${NBSP}дн.</dd></div>
  </dl>
  <button class="btn btn--primary btn--lg btn--block" type="button" data-open-apply>Оформить заявку</button>
  <p class="calc__note">Ставка ${pct(L.dailyRate)} в день, ПСК ${pskText()}. Расчёт предварительный, при условии возврата в срок. Решение о выдаче принимается индивидуально после проверки анкеты.</p>
</section>`;
};

const faqBlock = (items, { title = 'Вопросы и ответы', id = 'faq', heading = 'h2' } = {}) => `
<section class="section" id="${id}" aria-labelledby="${id}-title">
  <${heading} class="section__title" id="${id}-title">${title}</${heading}>
  <div class="faq">
    ${items
      .map(
        (q, i) => `<details class="faq__item"${i === 0 ? ' open' : ''}>
      <summary>${esc(q.q)}</summary>
      <div class="faq__a">${q.a}</div>
    </details>`
      )
      .join('\n    ')}
  </div>
</section>`;

const faqSchema = (items) => ({
  '@type': 'FAQPage',
  mainEntity: items.map((q) => ({
    '@type': 'Question',
    name: q.q,
    acceptedAnswer: { '@type': 'Answer', text: q.a.replace(/<[^>]+>/g, '') },
  })),
});

const steps = (list, title = 'Как получить займ') => `
<section class="section" aria-labelledby="steps-title">
  <h2 class="section__title" id="steps-title">${title}</h2>
  <ol class="steps">
    ${list
      .map(
        (s, i) => `<li class="step"><span class="step__n">${i + 1}</span><h3 class="step__t">${s.t}</h3><p>${s.d}</p></li>`
      )
      .join('\n    ')}
  </ol>
</section>`;

const defaultSteps = [
  { t: 'Выберите сумму и срок', d: `От ${money(L.minAmount)} до ${money(L.maxAmount)} на ${L.minTerm}–${L.maxTerm} дней. Калькулятор сразу покажет сумму к возврату.` },
  { t: 'Заполните анкету', d: 'Паспортные данные, контакты и сведения о доходе. Обычно это занимает 5–10 минут.' },
  { t: 'Подпишите договор кодом из СМС', d: 'Перед подписанием вы видите индивидуальные условия с ПСК в рамке на первой странице.' },
  { t: 'Получите деньги', d: 'На банковскую карту или по номеру телефона через СБП — на счёт, открытый на ваше имя.' },
];

const features = (list) => `
<ul class="features">
  ${list
    .map((f) => `<li class="feature">${icon(f.i, 'feature__ico')}<h3 class="feature__t">${f.t}</h3><p>${f.d}</p></li>`)
    .join('\n  ')}
</ul>`;

const conditionsTable = () => {
  const ex = calc(L.defaultAmount, L.maxTerm);
  return `
<div class="table-wrap">
<table class="table">
  <caption class="sr-only">Основные условия займа</caption>
  <tbody>
    <tr><th scope="row">Сумма</th><td>от ${money(L.minAmount)} до ${money(L.maxAmount)}</td></tr>
    <tr><th scope="row">Срок</th><td>от ${L.minTerm} до ${L.maxTerm} дней</td></tr>
    <tr><th scope="row">Процентная ставка</th><td>${pct(L.dailyRate)} в день (${yearRate()} годовых)</td></tr>
    <tr><th scope="row">Полная стоимость займа</th><td>${pskText()}</td></tr>
    <tr><th scope="row">Порядок возврата</th><td>Единовременно в конце срока; досрочно — в любой день без комиссии с пересчётом процентов за фактические дни</td></tr>
    <tr><th scope="row">Неустойка при просрочке</th><td>не более ${L.penaltyRate}${NBSP}% годовых от суммы просроченного долга</td></tr>
    <tr><th scope="row">Предельная переплата</th><td>не более ${L.overpaymentCap}${NBSP}% от суммы займа (проценты, неустойка и платежи за услуги вместе)</td></tr>
    <tr><th scope="row">Платные дополнительные услуги</th><td>не навязываются; предлагаются только с вашего отдельного согласия</td></tr>
    <tr><th scope="row">Заёмщик</th><td>гражданин РФ от ${L.minAge} до ${L.maxAge} лет</td></tr>
    <tr><th scope="row">Пример</th><td>${money(L.defaultAmount)} на ${L.maxTerm} дней: проценты ${money(ex.interest)}, к возврату ${money(ex.total)}</td></tr>
  </tbody>
</table>
</div>`;
};

const requirements = () => `
<ul class="checklist">
  <li>${icon('check')}Гражданство РФ и постоянная регистрация</li>
  <li>${icon('check')}Возраст от ${L.minAge} до ${L.maxAge} лет</li>
  <li>${icon('check')}Действующий паспорт РФ</li>
  <li>${icon('check')}Мобильный телефон, оформленный на вас</li>
  <li>${icon('check')}Банковская карта или счёт на ваше имя</li>
  <li>${icon('check')}Отсутствие самозапрета на займы в кредитной истории</li>
</ul>`;

const cta = (title = 'Нужны деньги до зарплаты?', text = 'Рассчитайте займ и узнайте решение онлайн. Мы покажем полную стоимость до подписания договора.') => `
<section class="cta">
  <div>
    <h2 class="cta__t">${title}</h2>
    <p>${text}</p>
  </div>
  <button class="btn btn--light btn--lg" type="button" data-open-apply>Оформить заявку</button>
</section>`;

const riskNote = () => `
<aside class="note note--warn" role="note">
  ${icon('alert', 'note__ico')}
  <div><strong>Оцените свои возможности.</strong> Займ — это обязательство. Берите сумму, которую точно сможете вернуть в срок: при просрочке начисляется неустойка, информация передаётся в бюро кредитных историй, а долг может быть взыскан в судебном порядке. Если сомневаетесь — <a href="/blog/kak-ponyat-mozhno-li-brat-zaym/">прочитайте памятку</a>.</div>
</aside>`;

const articleCards = (articles) => `
<ul class="cards">
  ${articles
    .map(
      (a) => `<li class="card"><a class="card__link" href="${a.path}"><span class="card__tag">${a.tag}</span><h3 class="card__t">${a.h1}</h3><p>${a.description}</p><span class="card__more">Читать ${icon('arrow')}</span></a></li>`
    )
    .join('\n  ')}
</ul>`;

module.exports = {
  icon, pskBox, calculator, faqBlock, faqSchema, steps, defaultSteps, features,
  conditionsTable, requirements, cta, riskNote, articleCards,
};
