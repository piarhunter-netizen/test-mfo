// Основные страницы сайта
const fs = require('fs');
const path = require('path');
const { cfg, NBSP, esc, money, pct, pskText, yearRate, calc, absUrl, ruDate } = require('./lib');
const {
  icon, pskBox, calculator, faqBlock, faqSchema, steps, defaultSteps, features,
  conditionsTable, requirements, cta, riskNote, articleCards, keyNumbers, trustStrip, ctaButton, applyCard,
} = require('./components');
const { orgId } = require('./layout');
const articles = require('./blog');

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
      ${pskBox()}
      <ul class="hero__points">
        <li>${icon('check')}Без справок и поручителей</li>
        <li>${icon('check')}Деньги на карту или по СБП</li>
        <li>${icon('check')}Досрочно — без комиссий</li>
      </ul>
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
    <p class="about__reg">${icon('scale')}<span>${esc(C.shortName)} — в государственном реестре МФО Банка России, № ${C.cbrRegNumber}. Член ${esc(C.sroName)}.</span></p>
  </section>

  ${faqBlock(homeFaq, { title: 'Часто задаваемые вопросы' })}

  <section class="section" id="docs" aria-labelledby="docs-title">
    <h2 class="section__title" id="docs-title">Документы</h2>
    <ul class="docs docs--grid">
      <li class="doc">${icon('doc', 'doc__ico')}<a href="/usloviya/">Информация об условиях предоставления займа</a></li>
      <li class="doc">${icon('doc', 'doc__ico')}<a href="/dokumenty/">Правила предоставления займов</a></li>
      <li class="doc">${icon('doc', 'doc__ico')}<a href="/politika-konfidencialnosti/">Политика обработки персональных данных</a></li>
      <li class="doc">${icon('doc', 'doc__ico')}<a href="/dokumenty/">Все документы компании</a></li>
    </ul>
  </section>

  <section class="section" id="contacts" aria-labelledby="contacts-title">
    <h2 class="section__title" id="contacts-title">Контакты</h2>
    <ul class="contact-cards">
      <li>${icon('phone')}<span>Горячая линия</span><a href="tel:${K.phoneHref}">${K.phone}</a><small>${esc(K.hours)}. Звонок бесплатный.</small></li>
      <li>${icon('chat')}<span>Электронная почта</span><a href="mailto:${K.email}">${K.email}</a><small>Обращения: ${K.complaintsEmail}</small></li>
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

const landing = ({ path, crumb, title, description, h1, lead, intro, featuresList, faqList, extra = '' }) => ({
  path,
  title,
  description,
  h1,
  lead,
  crumbs: [],
  crumbName: crumb,
  priority: 0.9,
  changefreq: 'weekly',
  schema: [loanSchema(path, crumb), faqSchema(faqList)],
  body: `
<div class="container">
  <section class="landing">
    <div class="landing__text prose">
      ${pskBox()}
      ${intro}
    </div>
    <div class="landing__calc">${calculator({ title: 'Рассчитайте займ' })}</div>
  </section>
  <section class="section">${features(featuresList)}</section>
  ${steps(defaultSteps)}
  ${ctaButton()}
  ${extra}
  <section class="section" aria-labelledby="c-title">
    <h2 class="section__title" id="c-title">Условия</h2>
    ${keyNumbers()}
  </section>
  ${riskNote()}
  ${faqBlock(faqList)}
  ${cta()}
</div>`,
});

const landings = [
  landing({
    path: '/zaym-na-kartu/',
    crumb: 'Займ на карту',
    title: `Займ на карту онлайн до ${num(L.maxAmount)} ₽ — ${cfg.brand}`,
    description: `Займ на карту «Мир» любого банка: от ${num(L.minAmount)} до ${num(L.maxAmount)} ₽ на ${L.minTerm}–${L.maxTerm} дней. Ставка ${pct(L.dailyRate)} в день, ПСК ${pskText()}. Онлайн-заявка за 10 минут.`,
    h1: 'Займ на карту онлайн',
    lead: 'Деньги на именную карту «Мир» любого российского банка — без визита в офис и справок о доходе.',
    intro: `<p>Займ на карту — самый привычный способ получить деньги в МФО. Вы заполняете анкету на сайте, привязываете карту, оформленную на ваше имя, и после одобрения подписываете договор кодом из СМС. Деньги отправляются на карту сразу после подписания; срок зачисления зависит от банка-эмитента и обычно составляет несколько минут.</p>
<p>Принимаем карты платёжной системы «Мир» всех российских банков. Карта должна быть именной, действующей и принадлежать заёмщику — переводы на чужие карты мы не делаем, чтобы исключить мошенничество.</p>`,
    featuresList: [
      { i: 'card', t: 'Любой банк', d: 'Карты «Мир» всех российских банков, включая цифровые.' },
      { i: 'clock', t: 'Круглосуточно', d: 'Заявки принимаем 24/7, решение — автоматически.' },
      { i: 'shield', t: 'Только ваша карта', d: 'Сверяем владельца карты с заёмщиком.' },
    ],
    faqList: [faq.card, faq.time, faq.early, faq.hidden],
  }),
  landing({
    path: '/zaym-cherez-sbp/',
    crumb: 'Займ через СБП',
    title: `Займ через СБП по номеру телефона — ${cfg.brand}`,
    description: `Займ через Систему быстрых платежей на ваш счёт по номеру телефона. От ${num(L.minAmount)} до ${num(L.maxAmount)} ₽, ставка ${pct(L.dailyRate)} в день, ПСК ${pskText()}.`,
    h1: 'Займ через СБП по номеру телефона',
    lead: 'Не нужно вводить номер карты: деньги придут на счёт в вашем банке по номеру мобильного телефона.',
    intro: `<p>Система быстрых платежей (СБП) — сервис Банка России, который позволяет переводить деньги по номеру телефона. При получении займа через СБП вы выбираете свой банк из списка, а мы отправляем деньги на счёт, привязанный к номеру. Обычно перевод занимает несколько секунд.</p>
<p>Перед отправкой мы автоматически сверяем ФИО получателя с данными заёмщика. Если счёт оформлен на другого человека, перевод не будет выполнен — это защищает вас, если кто-то пытается оформить займ от вашего имени.</p>`,
    featuresList: [
      { i: 'bolt', t: 'Быстрый перевод', d: 'Как правило, деньги приходят за секунды.' },
      { i: 'phone', t: 'Только номер телефона', d: 'Не нужно вводить и хранить данные карты.' },
      { i: 'shield', t: 'Сверка получателя', d: 'Перевод только на счёт, открытый на ваше имя.' },
    ],
    faqList: [faq.sbp, faq.time, faq.safe, faq.repay],
  }),
  landing({
    path: '/zaym-onlajn/',
    crumb: 'Займ онлайн',
    title: `Займ онлайн без визита в офис — ${cfg.brand}`,
    description: `Онлайн-займ от ${num(L.minAmount)} до ${num(L.maxAmount)} ₽: заявка, договор и получение денег — дистанционно. Ставка ${pct(L.dailyRate)} в день, ПСК ${pskText()}.`,
    h1: 'Займ онлайн',
    lead: 'Все этапы — от заявки до получения денег — проходят на сайте. Нужны только паспорт, телефон и карта.',
    intro: `<p>Онлайн-займ оформляется полностью дистанционно. Договор подписывается простой электронной подписью — кодом из СМС, который приходит на ваш номер. Такая подпись имеет юридическую силу на основании соглашения об использовании АСП, с которым вы знакомитесь до подачи заявки.</p>
<p>Перед подписанием вы увидите индивидуальные условия договора: сумму, срок, ставку, сумму к возврату и полную стоимость займа в рамке в правом верхнем углу первой страницы. Если что-то непонятно, не подписывайте договор и позвоните нам по бесплатному номеру ${K.phone}.</p>`,
    featuresList: [
      { i: 'home', t: 'Без визита в офис', d: 'Всё оформление проходит на сайте.' },
      { i: 'doc', t: 'Договор онлайн', d: 'Подписание кодом из СМС, копия — в личном кабинете.' },
      { i: 'chat', t: 'Поддержка', d: `Отвечаем по телефону ${K.phone} и почте.` },
    ],
    faqList: [faq.who, faq.time, faq.safe, faq.hidden],
  }),
  landing({
    path: '/zaym-do-zarplaty/',
    crumb: 'Займ до зарплаты',
    title: `Займ до зарплаты на ${L.minTerm}–${L.maxTerm} дней — ${cfg.brand}`,
    description: `Краткосрочный займ до зарплаты: от ${num(L.minAmount)} до ${num(L.maxAmount)} ₽ на срок до ${L.maxTerm} дней. Досрочное погашение без комиссий. ПСК ${pskText()}.`,
    h1: 'Займ до зарплаты',
    lead: 'Короткий займ, чтобы закрыть непредвиденный расход до ближайшего поступления денег.',
    intro: `<p>Займ до зарплаты рассчитан на короткий срок — от ${L.minTerm} до ${L.maxTerm} дней. Выберите дату возврата так, чтобы она приходилась на день после поступления зарплаты: тогда вы погасите долг сразу и не переплатите.</p>
<p>Проценты начисляются за каждый день пользования деньгами. Если зарплата пришла раньше — верните займ досрочно, и проценты будут пересчитаны за фактический срок. Например, ${money(L.defaultAmount)} на 10 дней обойдутся в ${money(calc(L.defaultAmount, 10).interest)} процентов.</p>`,
    featuresList: [
      { i: 'calendar', t: 'Срок под вашу дату', d: `Любой срок от ${L.minTerm} до ${L.maxTerm} дней.` },
      { i: 'percent', t: 'Проценты за дни', d: 'Платите только за фактические дни пользования.' },
      { i: 'wallet', t: 'Досрочно без комиссий', d: 'Полностью или частично в любой день.' },
    ],
    faqList: [faq.early, faq.prolong, faq.late, faq.limit3],
  }),
  landing({
    path: '/zaym-s-plohoj-kreditnoj-istoriej/',
    crumb: 'Займ с плохой кредитной историей',
    title: `Займ с плохой кредитной историей: как повысить шансы — ${cfg.brand}`,
    description: 'Рассматриваем заявки заёмщиков с просрочками в прошлом. Объясняем, что влияет на решение и почему никто не может гарантировать одобрение.',
    h1: 'Займ с плохой кредитной историей',
    lead: 'Мы рассматриваем заявки заёмщиков с просрочками в прошлом. Рассказываем честно, от чего зависит решение.',
    intro: `<p>Кредитная история — важный, но не единственный фактор при оценке заявки. Мы смотрим на текущую долговую нагрузку, доход, давность прошлых просрочек и полноту анкеты. Поэтому даже при неидеальной истории шанс получить займ есть.</p>
<p>Гарантировать одобрение не может ни одна финансовая организация: МФО обязана оценить платёжеспособность заёмщика и не выдавать займ, если платежи станут непосильными. Объявления «займ без отказа» и «без проверки кредитной истории» — повод насторожиться.</p>
<h2>Как повысить шансы на одобрение</h2>
<ul><li>Укажите в анкете точные данные о доходе и месте работы.</li><li>Начните с небольшой суммы и короткого срока.</li><li>Закройте или уменьшите текущие просрочки.</li><li>Проверьте свою кредитную историю — дважды в год это бесплатно через Госуслуги.</li></ul>`,
    featuresList: [
      { i: 'user', t: 'Индивидуальная оценка', d: 'Учитываем не только прошлые просрочки.' },
      { i: 'scale', t: 'Честно о рисках', d: 'Не обещаем одобрение всем — это запрещено законом.' },
      { i: 'doc', t: 'Улучшение истории', d: 'Своевременный возврат займа отражается в БКИ.' },
    ],
    faqList: [faq.badCh, faq.limit3, faq.selfban, faq.late],
  }),
  landing({
    path: '/zaym-pensioneram/',
    crumb: 'Займ пенсионерам',
    title: `Займ пенсионерам до ${L.maxAge} лет онлайн — ${cfg.brand}`,
    description: `Онлайн-займ для пенсионеров до ${L.maxAge} лет: от ${num(L.minAmount)} до ${num(L.maxAmount)} ₽ на карту или через СБП. Ставка ${pct(L.dailyRate)} в день, ПСК ${pskText()}.`,
    h1: 'Займ пенсионерам',
    lead: `Выдаём займы гражданам до ${L.maxAge} лет, в том числе работающим и неработающим пенсионерам.`,
    intro: `<p>Пенсия — регулярный доход, который учитывается при оценке заявки. Достаточно указать её размер в анкете; справки из Социального фонда не требуются. Деньги можно получить на карту «Мир», на которую приходит пенсия, или через СБП.</p>
<p>Прежде чем брать займ, посчитайте, какая часть пенсии уйдёт на его возврат. Если сумма платежа больше трети ежемесячного дохода, стоит уменьшить сумму займа. Никогда не сообщайте коды из СМС людям, которые представляются сотрудниками банка, МФО или полиции и просят срочно оформить займ, — это мошенники.</p>`,
    featuresList: [
      { i: 'user', t: `До ${L.maxAge} лет`, d: 'Рассматриваем заявки работающих и неработающих пенсионеров.' },
      { i: 'card', t: 'На пенсионную карту', d: 'Можно получить на карту, куда приходит пенсия.' },
      { i: 'shield', t: 'Защита от мошенников', d: 'Сверяем владельца карты и номера телефона.' },
    ],
    faqList: [faq.pension, faq.who, faq.safe, faq.early],
  }),
];

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

// ---------- Как получить ----------
const kakPoluchit = {
  path: '/kak-poluchit/',
  title: `Как получить займ онлайн: пошаговая инструкция — ${cfg.brand}`,
  description: 'Пошаговая инструкция: как подать заявку на займ, какие нужны документы, как подписать договор и получить деньги на карту или через СБП.',
  h1: 'Как получить займ',
  lead: 'Четыре шага и около 10 минут. Рассказываем, что понадобится и как проходит проверка.',
  crumbs: [],
  priority: 0.8,
  schema: [
    {
      '@type': 'HowTo',
      name: 'Как получить займ онлайн',
      totalTime: 'PT10M',
      step: defaultSteps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.t, text: s.d })),
    },
  ],
  body: `
<div class="container">
  ${steps(defaultSteps, 'Пошагово')}
  <section class="section split">
    <div class="prose">
      <h2>Что понадобится</h2>
      ${requirements()}
      <h2>Как проходит проверка</h2>
      <p>После отправки анкеты мы проверяем паспортные данные, запрашиваем кредитную историю (с вашего согласия), проверяем наличие самозапрета и рассчитываем показатель долговой нагрузки. Обычно это занимает несколько минут.</p>
      <p>Мы можем попросить сделать фото с паспортом или подтвердить личность другим способом — это нужно, чтобы никто не смог оформить займ от вашего имени.</p>
      <h2>Подписание договора</h2>
      <p>Если решение положительное, вы увидите индивидуальные условия: сумму, срок, ставку, сумму к возврату и ПСК. Прочитайте их внимательно. Договор подписывается кодом из СМС; копия будет доступна в личном кабинете и придёт на почту.</p>
    </div>
    <div>${calculator({ title: 'Рассчитайте займ' })}</div>
  </section>
  ${riskNote()}
  ${cta()}
</div>`,
};

// ---------- Как погасить ----------
const repayMethods = [
  { i: 'card', t: 'Картой в личном кабинете', d: 'Без комиссии. Платёж зачисляется сразу. Можно погасить полностью или частично.' },
  { i: 'bolt', t: 'Через СБП', d: 'По QR-коду или ссылке из личного кабинета. Комиссию за перевод банк обычно не берёт.' },
  { i: 'doc', t: 'По реквизитам', d: 'Переводом из любого банка. Зачисление — до 3 рабочих дней, учитывайте это при выборе даты.' },
];
const kakPogasit = {
  path: '/kak-pogasit/',
  title: `Как погасить займ: способы оплаты и досрочное погашение — ${cfg.brand}`,
  description: 'Способы погашения займа: картой, через СБП или по реквизитам. Как погасить досрочно, продлить срок и что делать при просрочке.',
  h1: 'Как погасить займ',
  lead: 'Три способа оплаты, досрочное погашение без комиссий и помощь, если возникли трудности.',
  crumbs: [],
  priority: 0.8,
  body: `
<div class="container narrow">
  <section class="section">${features(repayMethods)}</section>
  <section class="section prose">
    <h2>Реквизиты для оплаты</h2>
    <div class="table-wrap"><table class="table"><tbody>
      <tr><th scope="row">Получатель</th><td>${esc(C.shortName)}</td></tr>
      <tr><th scope="row">ИНН / КПП</th><td>${C.inn} / ${C.kpp}</td></tr>
      <tr><th scope="row">Расчётный счёт</th><td>[номер счёта]</td></tr>
      <tr><th scope="row">Банк</th><td>[наименование банка], БИК [БИК], к/с [корр. счёт]</td></tr>
      <tr><th scope="row">Назначение платежа</th><td>Погашение по договору займа № …, ФИО заёмщика</td></tr>
    </tbody></table></div>
    <h2>Досрочное погашение</h2>
    <p>Вернуть займ можно полностью или частично в любой день без предварительного уведомления и комиссий. Проценты начисляются только за фактические дни пользования деньгами. При частичном погашении сумма сначала идёт на погашение процентов, затем — основного долга, в порядке, установленном ч. 20 ст. 5 353-ФЗ.</p>
    <h2>Если не получается заплатить вовремя</h2>
    <p>Напишите или позвоните нам до даты платежа — так проще найти решение: продлить срок, разбить долг на части или оформить кредитные каникулы, если у вас есть на них право. Подробнее — в статье <a href="/blog/chto-delat-esli-nechem-platit-zaym/">«Что делать, если нечем платить займ»</a>.</p>
    <aside class="note">${icon('shield', 'note__ico')}<div><strong>Осторожно, мошенники.</strong> Мы никогда не просим переводить деньги на карты физических лиц. Платите только способами, указанными на этой странице и в личном кабинете.</div></aside>
  </section>
</div>`,
};

// ---------- О компании ----------
const oKompanii = {
  path: '/o-kompanii/',
  title: `О компании ${C.shortName}: реестр ЦБ, СРО, реквизиты`,
  description: `${C.shortName} — микрокредитная компания в государственном реестре МФО Банка России № ${C.cbrRegNumber}. Сведения о членстве в СРО, руководстве и реквизиты.`,
  h1: 'О компании',
  lead: `${esc(C.shortName)} — микрокредитная компания, которая выдаёт онлайн-займы гражданам России.`,
  crumbs: [],
  withOrg: true,
  priority: 0.7,
  schema: [{ '@type': 'AboutPage', url: absUrl('/o-kompanii/'), about: { '@id': orgId } }],
  body: `
<div class="container narrow">
  <section class="section prose">
    <p>Мы работаем по правилам Федеральных законов № 151-ФЗ «О микрофинансовой деятельности и микрофинансовых организациях» и № 353-ФЗ «О потребительском кредите (займе)», базовых стандартов, утверждённых Банком России, и стандартов саморегулируемой организации, членом которой являемся.</p>
    <p>Наш принцип — прозрачность: стоимость займа видна до подачи заявки, а все условия отражены в договоре. Мы не навязываем услуги и не используем агрессивных методов взыскания.</p>
  </section>
  <section class="section">
    <h2 class="section__title">Сведения о компании</h2>
    <div class="table-wrap"><table class="table"><tbody>
      <tr><th scope="row">Полное наименование</th><td>${esc(C.fullName)}</td></tr>
      <tr><th scope="row">Сокращённое наименование</th><td>${esc(C.shortName)}</td></tr>
      <tr><th scope="row">ИНН / КПП</th><td>${C.inn} / ${C.kpp}</td></tr>
      <tr><th scope="row">ОГРН</th><td>${C.ogrn}</td></tr>
      <tr><th scope="row">Реестр МФО Банка России</th><td>Регистрационный номер ${C.cbrRegNumber}, дата внесения ${C.cbrRegDate} · <a href="https://www.cbr.ru/microfinance/registry/" target="_blank" rel="noopener">проверить в реестре</a></td></tr>
      <tr><th scope="row">Членство в СРО</th><td>${esc(C.sroName)}, с ${C.sroMemberSince}, № ${esc(C.sroMemberNumber)} · <a href="${C.sroUrl}" target="_blank" rel="noopener">сайт СРО</a></td></tr>
      <tr><th scope="row">Юридический адрес</th><td>${esc(C.legalAddress)}</td></tr>
      <tr><th scope="row">Адрес для корреспонденции</th><td>${esc(C.officeAddress)}</td></tr>
      <tr><th scope="row">Генеральный директор</th><td>${esc(C.director)}</td></tr>
      <tr><th scope="row">Обособленные подразделения</th><td>${esc(C.branches)}</td></tr>
      <tr><th scope="row">Оператор персональных данных</th><td>Реестр Роскомнадзора, № ${esc(C.rknNumber)}</td></tr>
      <tr><th scope="row">Режим работы</th><td>${esc(K.officeHours)}; заявки на сайте — круглосуточно</td></tr>
    </tbody></table></div>
    <p class="small muted">Информация о составе органов управления, лицах, контролирующих компанию, и иные сведения, раскрытие которых требует Банк России, опубликованы в разделе <a href="/dokumenty/">«Документы»</a>.</p>
  </section>
  <section class="section">
    <h2 class="section__title">Регуляторы и защита прав</h2>
    <ul class="links-grid">
      <li><a href="https://www.cbr.ru/" target="_blank" rel="noopener">${icon('scale')}<span><strong>Банк России</strong>Надзор за МФО</span></a></li>
      <li><a href="https://www.cbr.ru/reception/" target="_blank" rel="noopener">${icon('chat')}<span><strong>Интернет-приёмная ЦБ</strong>Жалобы на финансовые организации</span></a></li>
      <li><a href="https://finombudsman.ru/" target="_blank" rel="noopener">${icon('shield')}<span><strong>Финансовый уполномоченный</strong>Досудебное решение споров</span></a></li>
      <li><a href="https://fincult.info/" target="_blank" rel="noopener">${icon('info')}<span><strong>Финансовая культура</strong>Просветительский портал ЦБ</span></a></li>
    </ul>
  </section>
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

// ---------- Контакты ----------
const kontakty = {
  path: '/kontakty/',
  title: `Контакты ${cfg.brand}: телефон, почта, подача обращений`,
  description: `Бесплатный телефон ${K.phone}, электронная почта и адрес ${C.shortName}. Как направить обращение или жалобу и в какие сроки мы отвечаем.`,
  h1: 'Контакты',
  lead: 'Ответим на вопросы о займе, поможем с погашением и рассмотрим обращение.',
  crumbs: [],
  withOrg: true,
  priority: 0.7,
  schema: [{ '@type': 'ContactPage', url: absUrl('/kontakty/'), about: { '@id': orgId } }],
  body: `
<div class="container narrow">
  <ul class="contact-cards">
    <li>${icon('phone')}<span>Горячая линия</span><a href="tel:${K.phoneHref}">${K.phone}</a><small>${esc(K.hours)}. Звонок бесплатный.</small></li>
    <li>${icon('chat')}<span>Общие вопросы</span><a href="mailto:${K.email}">${K.email}</a><small>Ответ — в течение 1 рабочего дня.</small></li>
    <li>${icon('doc')}<span>Обращения и претензии</span><a href="mailto:${K.complaintsEmail}">${K.complaintsEmail}</a><small>Ответ — не позднее 15 рабочих дней.</small></li>
    <li>${icon('lock')}<span>Персональные данные</span><a href="mailto:${K.pdEmail}">${K.pdEmail}</a><small>Запросы и отзыв согласия.</small></li>
  </ul>
  <section class="section prose">
    <h2>Адрес</h2>
    <p>Юридический адрес: ${esc(C.legalAddress)}.<br>Адрес для корреспонденции: ${esc(C.officeAddress)}.<br>${esc(K.officeHours)}.</p>
    <h2>Как направить обращение</h2>
    <p>Обращение можно направить по электронной почте, почтой России по адресу для корреспонденции или через личный кабинет. Укажите ФИО, контактные данные, номер договора (если есть) и суть вопроса. Мы рассматриваем обращения в сроки, установленные базовым стандартом защиты прав получателей финансовых услуг, и отвечаем тем же способом, которым оно получено, если вы не указали иной.</p>
    <p>Если вы не согласны с ответом, вы вправе обратиться в <a href="https://www.cbr.ru/reception/" target="_blank" rel="noopener">Банк России</a>, к <a href="https://finombudsman.ru/" target="_blank" rel="noopener">финансовому уполномоченному</a> (по спорам до 500${NBSP}000${NBSP}₽; телефон 8 800 200-00-10), в ${esc(C.sroName)} или в суд.</p>
  </section>
</div>`,
};

// ---------- Вопросы и ответы ----------
const allFaq = [
  { title: 'Получение займа', items: [faq.who, faq.time, faq.badCh, faq.selfban, faq.limit3, faq.pension, faq.card, faq.sbp] },
  { title: 'Стоимость и условия', items: [faq.hidden, { q: 'Что такое ПСК?', a: `Полная стоимость займа в процентах годовых — показатель, который учитывает все платежи по договору. Наша ПСК — ${pskText()}. Подробнее — в статье <a href="/blog/chto-takoe-psk/">«Что такое ПСК»</a>.` }, faq.prolong] },
  { title: 'Погашение', items: [faq.repay, faq.early, faq.late] },
  { title: 'Безопасность', items: [faq.safe, { q: 'Мне позвонили и попросили оформить займ — что делать?', a: 'Положите трубку. Сотрудники банков, МФО, полиции и госорганов никогда не просят оформить займ, перевести деньги на «безопасный счёт» или назвать код из СМС. Если займ уже оформлен без вашего участия — сразу позвоните нам и обратитесь в полицию.' }] },
];
const voprosy = {
  path: '/voprosy-i-otvety/',
  title: `Вопросы и ответы о займах — ${cfg.brand}`,
  description: 'Ответы на частые вопросы: кто может получить займ, как быстро рассматривается заявка, как погасить досрочно, что будет при просрочке.',
  h1: 'Вопросы и ответы',
  lead: 'Не нашли ответ? Позвоните по бесплатному номеру ' + K.phone + '.',
  crumbs: [],
  priority: 0.7,
  schema: [faqSchema(allFaq.flatMap((g) => g.items))],
  body: `<div class="container narrow">${allFaq.map((g, i) => faqBlock(g.items, { title: g.title, id: 'faq-' + i })).join('')}${cta('Остались вопросы?', 'Позвоните нам или оформите заявку — расскажем об условиях до подписания договора.')}</div>`,
};

// ---------- Вход в личный кабинет ----------
const lkLogin = {
  path: '/lk/login/',
  title: `Вход в личный кабинет — ${cfg.brand}`,
  description: 'Вход в личный кабинет заёмщика: управление займом, погашение и продление, документы и история платежей.',
  h1: 'Вход в личный кабинет',
  customHero: true,
  noindex: true,
  noSitemap: true,
  body: `
<section class="auth">
  <div class="auth__card">
    <form class="auth__form" data-lk-login novalidate>
      <h1 class="auth__t">Вход в личный кабинет</h1>
      <p class="auth__sub">Управляйте займом, погашайте и продлевайте онлайн.</p>
      <label class="field">
        <span class="field__label">Телефон</span>
        <input class="input" type="tel" name="phone" inputmode="tel" autocomplete="username" placeholder="+7 (900) 000-00-00" required>
        <span class="field__err" data-err="phone">Введите номер полностью</span>
      </label>
      <label class="field">
        <span class="field__label">Пароль</span>
        <span class="pass">
          <input class="input" type="password" name="password" autocomplete="current-password" required minlength="6">
          <button class="pass__toggle" type="button" data-toggle-pass aria-label="Показать пароль">${icon('lock')}</button>
        </span>
        <span class="field__err" data-err="password">Введите пароль</span>
      </label>
      <button class="btn btn--primary btn--lg btn--block" type="submit">Войти</button>
      <p class="auth__links"><button class="linklike" type="button" data-auth-mode="reset">Забыли пароль?</button></p>
      <div class="auth__msg" data-msg hidden></div>
    </form>

    <form class="auth__form" data-lk-reset novalidate hidden>
      <h2 class="auth__t">Восстановление пароля</h2>
      <p class="auth__sub">Отправим код подтверждения в СМС на номер, указанный в договоре.</p>
      <label class="field">
        <span class="field__label">Телефон</span>
        <input class="input" type="tel" name="phone" inputmode="tel" autocomplete="username" placeholder="+7 (900) 000-00-00" required>
        <span class="field__err" data-err="phone">Введите номер полностью</span>
      </label>
      <div data-reset-step2 hidden>
        <label class="field">
          <span class="field__label">Код из СМС</span>
          <input class="input" type="text" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6">
          <span class="field__err" data-err="code">Введите код из СМС</span>
        </label>
        <label class="field">
          <span class="field__label">Новый пароль</span>
          <input class="input" type="password" name="password" autocomplete="new-password" minlength="8">
          <span class="field__err" data-err="password">Не короче 8 символов</span>
        </label>
      </div>
      <button class="btn btn--primary btn--lg btn--block" type="submit" data-reset-btn>Получить код</button>
      <p class="auth__links"><button class="linklike" type="button" data-auth-mode="login">Вернуться ко входу</button></p>
      <div class="auth__msg" data-msg hidden></div>
    </form>

    <p class="auth__new">Ещё нет кабинета? Он создаётся при оформлении первого займа. <a href="/#loan">Оформить займ</a></p>
  </div>
  <aside class="auth__safe">${icon('shield')}<p><strong>Берегите данные.</strong> Сотрудники ${esc(cfg.brand)} никогда не спрашивают пароль и коды из СМС. Вводите их только на этом сайте.</p></aside>
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
  body: `<div class="container narrow"><p class="btn-row"><a class="btn btn--primary" href="/">На главную</a><a class="btn btn--ghost" href="/usloviya/">Условия займа</a><a class="btn btn--ghost" href="/karta-sajta/">Карта сайта</a></p></div>`,
};

module.exports = [home, ...landings, usloviya, kakPoluchit, kakPogasit, oKompanii, dokumenty, kontakty, voprosy, lkLogin, notFound];
