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

  // ---------- Аналитика: цели Метрики (отправляются, только если пользователь разрешил cookie) ----------
  var goal = function (name, params) {
    var id = +body.getAttribute('data-metrika');
    if (id && window.ym) window.ym(id, 'reachGoal', name, params || {});
  };
  // Сохраняем UTM-метки первого визита, чтобы передать их вместе с заявкой (сквозная аналитика)
  var UTM = 'utm';
  try {
    var q = new URLSearchParams(location.search), u = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'yclid'].forEach(function (k) { if (q.get(k)) u[k] = q.get(k); });
    if (Object.keys(u).length) sessionStorage.setItem(UTM, JSON.stringify(u));
  } catch (e) { /* ignore */ }
  var readUtm = function () { try { return JSON.parse(sessionStorage.getItem(UTM) || '{}'); } catch (e) { return {}; } };

  // ---------- Маска телефона +7 (XXX) XXX-XX-XX для всех полей type=tel ----------
  document.querySelectorAll('input[type="tel"]').forEach(function (phone) {
    phone.addEventListener('input', function () {
      var d = phone.value.replace(/\D/g, '').replace(/^[78]/, '').slice(0, 10);
      var r = '+7';
      if (d.length) r += ' (' + d.slice(0, 3);
      if (d.length >= 3) r += ') ' + d.slice(3, 6);
      if (d.length >= 6) r += '-' + d.slice(6, 8);
      if (d.length >= 8) r += '-' + d.slice(8, 10);
      phone.value = d.length ? r : '';
      var f = phone.closest('.field'); if (f) f.classList.remove('is-invalid');
    });
  });
  var phoneDigits = function (input) { return input.value.replace(/\D/g, ''); };
  var postJson = function (url, data) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), credentials: 'include' })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw j; return j; }); });
  };

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
      var dateText = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
      var set = function (name, text) { var el = out(name); if (el) el.textContent = text; };
      set('amount', fmt(a));
      set('term', t + NB + plural(t, days));
      set('interest', fmt(interest));
      set('total', fmt(a + interest));
      set('date', 'до ' + dateText);
      set('dateonly', dateText);
      amount.setAttribute('aria-valuetext', a + ' рублей');
      term.setAttribute('aria-valuetext', t + ' ' + plural(t, days));
      fill(amount); fill(term);
      selection = { amount: a, term: t };
    }
    var touched = false;
    var onInput = function () { update(); if (!touched) { touched = true; goal('calc_use'); } };
    amount.addEventListener('input', onInput);
    term.addEventListener('input', onInput);
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

  // Маска телефона и отправка — для каждой формы заявки
  document.querySelectorAll('[data-apply-form]').forEach(function (form) {
    var next = form.querySelector('[data-next]');
    var step2 = form.querySelector('[data-step2]');
    if (next && step2) {
      next.addEventListener('click', function () {
        step2.hidden = false; next.hidden = true;
        goal('apply_open', { amount: +form.amount.value, term: +form.term.value });
        form.phone.focus();
      });
    }
    var phone = form.phone;
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
        consents: { docs: true, pd: true, bki: true, asp: true },
        consentedAt: new Date().toISOString(), page: location.pathname, utm: readUtm(), referrer: document.referrer,
      };
      var endpoint = body.getAttribute('data-endpoint');
      var show = function (html) { done.innerHTML = html; done.hidden = false; };
      goal('apply_submit', { amount: payload.amount, term: payload.term });

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
  });

  // ---------- Личный кабинет: вход и восстановление пароля ----------
  var loginForm = document.querySelector('[data-lk-login]');
  var resetForm = document.querySelector('[data-lk-reset]');
  if (loginForm && resetForm) {
    var msg = function (form, text, ok) {
      var m = form.querySelector('[data-msg]');
      m.textContent = text; m.hidden = false; m.classList.toggle('is-ok', !!ok);
    };
    var invalid = function (input, bad) { input.closest('.field').classList.toggle('is-invalid', bad); return bad; };
    var setMode = function (mode) {
      loginForm.hidden = mode !== 'login'; resetForm.hidden = mode !== 'reset';
      if (mode === 'reset' && loginForm.phone.value && !resetForm.phone.value) resetForm.phone.value = loginForm.phone.value;
      (mode === 'login' ? loginForm : resetForm).phone.focus();
    };
    document.querySelectorAll('[data-auth-mode]').forEach(function (b) {
      b.addEventListener('click', function () { setMode(b.getAttribute('data-auth-mode')); });
    });
    if (/reset_password=1/.test(location.search) || location.hash === '#reset') setMode('reset');

    document.querySelectorAll('[data-toggle-pass]').forEach(function (b) {
      b.addEventListener('click', function () {
        var input = b.parentNode.querySelector('input');
        var show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        b.setAttribute('aria-label', show ? 'Скрыть пароль' : 'Показать пароль');
        b.classList.toggle('is-on', show);
      });
    });

    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var badPhone = invalid(loginForm.phone, phoneDigits(loginForm.phone).length !== 11);
      var badPass = invalid(loginForm.password, loginForm.password.value.length < 1);
      if (badPhone || badPass) return;
      var url = body.getAttribute('data-lk-login-url');
      if (!url) { msg(loginForm, 'Демонстрационный режим: укажите lkLoginEndpoint в site.config.js, чтобы подключить вход.'); return; }
      var btn = loginForm.querySelector('[type="submit"]'); btn.disabled = true;
      postJson(url, { phone: '+' + phoneDigits(loginForm.phone), password: loginForm.password.value })
        .then(function (res) { goal('lk_login'); location.href = res.redirect || body.getAttribute('data-lk') || '/'; })
        .catch(function (err) { msg(loginForm, (err && err.error) || 'Неверный телефон или пароль.'); loginForm.password.value = ''; })
        .then(function () { btn.disabled = false; });
    });

    var step2 = resetForm.querySelector('[data-reset-step2]');
    var resetBtn = resetForm.querySelector('[data-reset-btn]');
    var toStep2 = function () { step2.hidden = false; resetBtn.textContent = 'Сохранить пароль'; resetForm.code.focus(); };
    resetForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (invalid(resetForm.phone, phoneDigits(resetForm.phone).length !== 11)) return;
      var url = body.getAttribute('data-lk-reset-url');
      var phone = '+' + phoneDigits(resetForm.phone);
      var second = !step2.hidden;
      if (second) {
        var badCode = invalid(resetForm.code, resetForm.code.value.trim().length < 4);
        var badPass = invalid(resetForm.password, resetForm.password.value.length < 8);
        if (badCode || badPass) return;
      }
      if (!url) {
        if (!second) toStep2();
        msg(resetForm, 'Демонстрационный режим: укажите lkResetEndpoint в site.config.js.');
        return;
      }
      resetBtn.disabled = true;
      var data = second ? { phone: phone, code: resetForm.code.value.trim(), password: resetForm.password.value } : { phone: phone };
      postJson(url, data)
        .then(function () {
          if (!second) { toStep2(); msg(resetForm, 'Код отправлен в СМС.', true); }
          else { msg(resetForm, 'Пароль изменён. Теперь можно войти.', true); setTimeout(function () { setMode('login'); }, 1200); }
        })
        .catch(function (err) { msg(resetForm, (err && err.error) || 'Не удалось выполнить запрос. Попробуйте позже.'); })
        .then(function () { resetBtn.disabled = false; });
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
