// Переиспользуемые блоки страниц
const { cfg, NBSP, esc, num, money, pct, pskText, yearRate, calc } = require('./lib');

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
  <div class="calc__result">
    <div class="calc__result-row">
      <span>Вернуть <span data-out="date">через ${L.defaultTerm}${NBSP}дн.</span></span>
      <strong class="calc__total" data-out="total">${money(ex.total)}</strong>
    </div>
    <div class="calc__result-sub">из них проценты — <span data-out="interest">${money(ex.interest)}</span></div>
  </div>
  <button class="btn btn--primary btn--lg btn--block" type="button" data-open-apply>Получить деньги</button>
  <p class="calc__note">Ставка ${pct(L.dailyRate)} в день, ПСК ${pskText()}. Расчёт предварительный, при возврате в срок. Решение принимается индивидуально.</p>
</section>`;
};

// Четыре главные цифры — компактная замена большой таблицы на главной и посадочных
const keyNumbers = () => `
<ul class="keynums">
  <li><span>Сумма</span><strong>${num(L.minAmount)}–${money(L.maxAmount)}</strong></li>
  <li><span>Срок</span><strong>${L.minTerm}–${L.maxTerm} дней</strong></li>
  <li><span>Ставка</span><strong>${pct(L.dailyRate)} в день</strong></li>
  <li><span>ПСК</span><strong>${pskText()}</strong></li>
</ul>
<p class="keynums__more">Неустойка за просрочку — не более ${L.penaltyRate}${NBSP}% годовых. Переплата ограничена ${L.overpaymentCap}${NBSP}% от суммы займа. <a href="/usloviya/">Все условия и пример расчёта</a></p>`;

const trustStrip = () => `
<ul class="trust">
  <li>${icon('scale')}<div><strong>В реестре Банка России</strong><span>№ ${cfg.company.cbrRegNumber}</span></div></li>
  <li>${icon('percent')}<div><strong>Без скрытых платежей</strong><span>Всё входит в ПСК</span></div></li>
  <li>${icon('calendar')}<div><strong>Досрочно без комиссий</strong><span>Проценты только за дни</span></div></li>
  <li>${icon('lock')}<div><strong>Данные под защитой</strong><span>Хранятся в России</span></div></li>
</ul>`;

const ctaButton = (text = 'Получить деньги') => `<p class="center cta-inline"><button class="btn btn--primary btn--lg" type="button" data-open-apply>${text}</button></p>`;

// Поля заявки: телефон и согласия. Каждое согласие — отдельная галочка, ни одна не отмечена заранее.
const phoneField = () => `
    <label class="field">
      <span class="field__label">Мобильный телефон</span>
      <input class="input" type="tel" name="phone" inputmode="tel" autocomplete="tel" placeholder="+7 (900) 000-00-00" required>
      <span class="field__err" data-err="phone">Введите номер полностью</span>
    </label>`;

const consentFields = () => `
    <fieldset class="consents">
      <legend class="consents__t">Чтобы продолжить, подтвердите:</legend>
      <label class="check"><input type="checkbox" name="docs" required><span>ознакомление с <a href="/dokumenty/" target="_blank">условиями и правилами</a> выдачи займов</span></label>
      <label class="check"><input type="checkbox" name="pd" required><span><a href="/soglasie-na-obrabotku-pd/" target="_blank">согласие на обработку персональных данных</a></span></label>
      <label class="check"><input type="checkbox" name="bki" required><span>согласие на запрос кредитной истории в БКИ</span></label>
      <label class="check"><input type="checkbox" name="asp" required><span><a href="/dokumenty/#asp" target="_blank">соглашение о простой электронной подписи</a></span></label>
      <label class="check check--optional"><input type="checkbox" name="ads"><span>хочу получать новости и предложения — необязательно</span></label>
    </fieldset>
    <p class="field__err" data-err="consents">Отметьте обязательные согласия</p>`;

// Калькулятор с заявкой в одной карточке (главная): шаг 1 — сумма и срок, шаг 2 — телефон и согласия
const applyCard = (id = 'loan') => {
  const ex = calc(L.defaultAmount, L.defaultTerm);
  return `
<form class="calc calc--apply" id="${id}" data-rate="${L.dailyRate}" data-apply-form novalidate aria-labelledby="${id}-title">
  <h2 class="calc__title" id="${id}-title">Получите деньги онлайн</h2>
  <div class="calc__field">
    <div class="calc__row">
      <label for="${id}-amount">Сумма</label>
      <output class="calc__out" data-out="amount" for="${id}-amount">${money(L.defaultAmount)}</output>
    </div>
    <input class="range" type="range" id="${id}-amount" name="amount" data-role="amount" min="${L.minAmount}" max="${L.maxAmount}" step="${L.step}" value="${L.defaultAmount}">
    <div class="calc__limits"><span>${money(L.minAmount)}</span><span>${money(L.maxAmount)}</span></div>
  </div>
  <div class="calc__field">
    <div class="calc__row">
      <label for="${id}-term">Срок</label>
      <output class="calc__out" data-out="term" for="${id}-term">${L.defaultTerm}${NBSP}дн.</output>
    </div>
    <input class="range" type="range" id="${id}-term" name="term" data-role="term" min="${L.minTerm}" max="${L.maxTerm}" step="1" value="${L.defaultTerm}">
    <div class="calc__limits"><span>${L.minTerm}${NBSP}дней</span><span>${L.maxTerm}${NBSP}дней</span></div>
  </div>
  <div class="calc__pair">
    <div><span>Возвращаете</span><strong data-out="total">${money(ex.total)}</strong></div>
    <div><span>Дата возврата</span><strong data-out="dateonly">через ${L.defaultTerm}${NBSP}дн.</strong></div>
  </div>
  <div class="calc__step2" data-step2 hidden>
    ${phoneField()}
    ${consentFields()}
    <button class="btn btn--primary btn--lg btn--block" type="submit">Продолжить</button>
  </div>
  <button class="btn btn--primary btn--lg btn--block" type="button" data-next>Получить деньги</button>
  <p class="calc__note">При возврате в срок. Ставка ${pct(L.dailyRate)} в день, ПСК ${pskText()}. Решение принимается индивидуально.</p>
  <div class="modal__done" data-apply-done hidden></div>
</form>`;
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
  { t: 'Выберите сумму и срок', d: 'Калькулятор сразу покажет, сколько вернуть.' },
  { t: 'Заполните анкету', d: 'Паспорт, телефон и доход — около 5 минут.' },
  { t: 'Подпишите договор', d: 'Кодом из СМС. Условия и ПСК — до подписи.' },
  { t: 'Получите деньги', d: 'На карту или по СБП на ваш счёт.' },
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
  <li>${icon('check')}Гражданин РФ от ${L.minAge} до ${L.maxAge} лет</li>
  <li>${icon('check')}Паспорт РФ и постоянная регистрация</li>
  <li>${icon('check')}Телефон и карта (счёт) на ваше имя</li>
  <li>${icon('check')}Нет самозапрета на займы</li>
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
  <div><strong>Берите столько, сколько точно вернёте в срок.</strong> При просрочке начисляется неустойка, а данные передаются в бюро кредитных историй. <a href="/blog/kak-ponyat-mozhno-li-brat-zaym/">Как оценить свои возможности</a></div>
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
  conditionsTable, requirements, cta, riskNote, articleCards, keyNumbers, trustStrip, ctaButton, phoneField, consentFields, applyCard,
};
