/* ЯсноЗайм — клиентский скрипт: калькулятор, меню, заявка, cookie. Без зависимостей. */
(function () {
  'use strict';
  var NB = ' ';
  var body = document.body;
  var fmt = function (n) { return Math.round(n).toLocaleString('ru-RU').replace(/\s/g, NB) + NB + '₽'; };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* приватный режим */ } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };
  var plural = function (n, f) { var a = n % 10, b = n % 100; return f[a === 1 && b !== 11 ? 0 : a >= 2 && a <= 4 && (b < 10 || b >= 20) ? 1 : 2]; };
  var days = ['день', 'дня', 'дней'];

  // ---------- Калькулятор ----------
  var selection = null;
  document.querySelectorAll('.calc').forEach(function (calc) {
    var rate = parseFloat(calc.getAttribute('data-rate')) / 100;
    var amount = calc.querySelector('[data-role="amount"]');
    var term = calc.querySelector('[data-role="term"]');
    var out = function (name) { return calc.querySelector('[data-out="' + name + '"]'); };
    var fill = function (el) { el.style.setProperty('--p', ((el.value - el.min) / (el.max - el.min)) * 100 + '%'); };

    function update() {
      var a = +amount.value, t = +term.value;
      var interest = Math.round(a * rate * t);
      var date = new Date(); date.setDate(date.getDate() + t);
      out('amount').textContent = fmt(a);
      out('term').textContent = t + NB + plural(t, days);
      out('interest').textContent = fmt(interest);
      out('total').textContent = fmt(a + interest);
      out('date').textContent = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
      amount.setAttribute('aria-valuetext', a + ' рублей');
      term.setAttribute('aria-valuetext', t + ' ' + plural(t, days));
      fill(amount); fill(term);
      selection = { amount: a, term: t };
    }
    amount.addEventListener('input', update);
    term.addEventListener('input', update);
    update();
  });

  // ---------- Мобильное меню ----------
  var burger = document.querySelector('[data-burger]');
  var nav = document.getElementById('site-nav');
  if (burger && nav) {
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // ---------- Заявка ----------
  var dialog = document.getElementById('apply');
  var form = dialog && dialog.querySelector('[data-apply-form]');
  function openApply(e) {
    if (!dialog) return;
    var calc = e && e.currentTarget.closest('.calc');
    if (calc) {
      selection = { amount: +calc.querySelector('[data-role="amount"]').value, term: +calc.querySelector('[data-role="term"]').value };
    }
    if (selection) {
      form.amount.value = selection.amount;
      form.term.value = selection.term;
      dialog.querySelector('[data-apply-sum]').textContent = fmt(selection.amount) + ' на ' + selection.term + NB + plural(selection.term, days);
    }
    if (nav) { nav.classList.remove('is-open'); burger && burger.setAttribute('aria-expanded', 'false'); }
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
    setTimeout(function () { form.phone.focus(); }, 50);
  }
  document.querySelectorAll('[data-open-apply]').forEach(function (b) { b.addEventListener('click', openApply); });
  if (dialog) {
    dialog.querySelector('[data-close]').addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
  }

  // Маска телефона +7 (XXX) XXX-XX-XX
  if (form) {
    var phone = form.phone;
    phone.addEventListener('input', function () {
      var d = phone.value.replace(/\D/g, '').replace(/^[78]/, '').slice(0, 10);
      var r = '+7';
      if (d.length) r += ' (' + d.slice(0, 3);
      if (d.length >= 3) r += ') ' + d.slice(3, 6);
      if (d.length >= 6) r += '-' + d.slice(6, 8);
      if (d.length >= 8) r += '-' + d.slice(8, 10);
      phone.value = d.length ? r : '';
      phone.closest('.field').classList.remove('is-invalid');
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var digits = phone.value.replace(/\D/g, '');
      var okPhone = digits.length === 11;
      var required = ['docs', 'pd', 'bki', 'asp'];
      var okConsents = required.every(function (n) { return form[n].checked; });
      phone.closest('.field').classList.toggle('is-invalid', !okPhone);
      form.querySelector('[data-err="consents"]').classList.toggle('is-shown', !okConsents);
      if (!okPhone) { phone.focus(); return; }
      if (!okConsents) return;

      var done = form.querySelector('[data-apply-done]');
      var btn = form.querySelector('[type="submit"]');
      var payload = {
        phone: '+' + digits, amount: +form.amount.value, term: +form.term.value,
        consents: { docs: true, pd: true, bki: true, asp: true, ads: form.ads.checked },
        consentedAt: new Date().toISOString(), page: location.pathname,
      };
      var endpoint = body.getAttribute('data-endpoint');
      var show = function (html) { done.innerHTML = html; done.hidden = false; };

      if (!endpoint) {
        show('<strong>Заявка сформирована.</strong> Это демонстрационный режим: подключите обработчик заявок (formEndpoint в site.config.js), чтобы передавать данные в личный кабинет.');
        return;
      }
      btn.disabled = true; btn.textContent = 'Отправляем…';
      fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'include' })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json().catch(function () { return {}; }); })
        .then(function (res) {
          if (res && res.redirect) { location.href = res.redirect; return; }
          show('<strong>Спасибо!</strong> Мы отправили СМС со ссылкой на продолжение анкеты.');
        })
        .catch(function () { show('Не удалось отправить заявку. Попробуйте ещё раз или позвоните нам.'); })
        .then(function () { btn.disabled = false; btn.textContent = 'Продолжить'; });
    });
  }

  // ---------- Cookie и аналитика ----------
  var KEY = 'cookie-consent';
  var banner = document.querySelector('[data-cookie]');
  function loadMetrika() {
    var id = body.getAttribute('data-metrika');
    if (!id || window.ym) return;
    (function (m, e, t, r, i, k, a) {
      m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
      m[i].l = 1 * new Date();
      k = e.createElement(t); a = e.getElementsByTagName(t)[0]; k.async = 1; k.src = r; a.parentNode.insertBefore(k, a);
    })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');
    window.ym(+id, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true });
  }
  function readConsent() {
    var raw = store.get(KEY);
    if (!raw) return null;
    try {
      var v = JSON.parse(raw);
      if (Date.now() - v.t > 365 * 864e5) return null; // согласие хранится 12 месяцев
      return v.c;
    } catch (e) { return null; }
  }
  var consent = readConsent();
  if (consent === 'all') loadMetrika();
  if (!consent && banner) banner.hidden = false;
  document.querySelectorAll('[data-cookie-choice]').forEach(function (b) {
    b.addEventListener('click', function () {
      var c = b.getAttribute('data-cookie-choice');
      store.set(KEY, JSON.stringify({ c: c, t: Date.now() }));
      banner.hidden = true;
      if (c === 'all') loadMetrika();
    });
  });
  document.querySelectorAll('[data-cookie-reset]').forEach(function (b) {
    b.addEventListener('click', function () { store.del(KEY); if (banner) banner.hidden = false; });
  });
})();
