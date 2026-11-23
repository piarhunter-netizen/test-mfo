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
  var API = body.getAttribute('data-api') || '';
  var BASE = body.getAttribute('data-base') || '';
  var postJson = function (url, data) {
    return fetch(url, { method: data === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data), credentials: 'same-origin' })
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
      var show = function (html) { done.innerHTML = html; done.hidden = false; };
      goal('apply_submit', { amount: payload.amount, term: payload.term });
      if (!API) {
        show('<strong>Заявка сформирована.</strong> Демо-режим: заявки принимаются, когда сайт запущен на сервере (node server.js).');
        return;
      }
      btn.disabled = true; btn.textContent = 'Отправляем…';
      postJson(API + '/apply', payload)
        .then(function (res) {
          try { sessionStorage.setItem('lk-phone', payload.phone); } catch (e2) { /* ignore */ }
          show(res.registered
            ? '<strong>Заявка принята.</strong> Статус решения — в <a href="' + BASE + '/lk/">личном кабинете</a>.'
            : '<strong>Заявка принята.</strong> Чтобы следить за решением, <a href="' + BASE + '/lk/login/#register">создайте личный кабинет</a> — это займёт минуту.');
          form.querySelector('[data-step2]').hidden = true;
        })
        .catch(function (err) { show((err && err.error) || 'Не удалось отправить заявку. Попробуйте ещё раз или позвоните нам.'); })
        .then(function () { btn.disabled = false; btn.textContent = 'Продолжить'; });
    });
  });

  // ---------- Состояние входа: шапка, страница входа, подстановка телефона ----------
  var loggedIn = /(?:^|;\s*)lk_in=1/.test(document.cookie);
  var setHeader = function (me) {
    document.querySelectorAll('[data-lk-btn]').forEach(function (a) {
      a.href = BASE + '/lk/';
      a.classList.add('is-in');
      a.querySelector('[data-lk-label]').textContent = 'Мой кабинет';
      a.title = 'Вы вошли: ' + me.phone;
    });
  };
  var loginPage = document.querySelector('form[data-auth="login"]');
  var notice = document.querySelector('[data-auth-notice]');
  if (notice && /[?&]out=1/.test(location.search)) {
    notice.textContent = 'Вы вышли из личного кабинета.';
    notice.hidden = false;
    history.replaceState(null, '', location.pathname + location.hash);
  }
  if (API && loggedIn) {
    postJson(API + '/me').then(function (me) {
      setHeader(me);
      // уже вошёл, а открыл страницу входа — сразу в кабинет
      if (loginPage) { location.replace(BASE + '/lk/'); return; }
      var loan = document.getElementById('loan');
      if (loan && loan.phone && !loan.phone.value) { loan.phone.value = me.phone.slice(2); loan.phone.dispatchEvent(new Event('input')); }
    }).catch(function () { /* сессия истекла — шапка остаётся «Войти» */ });
  }

  // ---------- Личный кабинет ----------
  var authForms = {};
  document.querySelectorAll('form[data-auth]').forEach(function (f) { authForms[f.getAttribute('data-auth')] = f; });
  var msg = function (form, text, ok) {
    var m = form.querySelector('[data-msg]');
    if (!text) { m.hidden = true; return; }
    m.innerHTML = text; m.hidden = false; m.classList.toggle('is-ok', !!ok);
  };
  var invalid = function (input, bad) { input.closest('.field').classList.toggle('is-invalid', bad); return bad; };
  var noApi = 'Демо-режим: регистрация и вход работают, когда сайт запущен на сервере (node server.js).';
  var devNote = function (res) { return res && res.devCode ? ' Тестовый режим без СМС-шлюза: код <b>' + res.devCode + '</b>.' : ''; };

  document.querySelectorAll('[data-toggle-pass]').forEach(function (b) {
    b.addEventListener('click', function () {
      var input = b.parentNode.querySelector('input');
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      b.setAttribute('aria-label', show ? 'Скрыть пароль' : 'Показать пароль');
      b.classList.toggle('is-on', show);
    });
  });

  if (authForms.login) {
    var savedPhone = ''; try { savedPhone = sessionStorage.getItem('lk-phone') || ''; } catch (e) { /* ignore */ }
    var setMode = function (mode) {
      var from = Object.keys(authForms).filter(function (k) { return !authForms[k].hidden; })[0];
      Object.keys(authForms).forEach(function (k) { authForms[k].hidden = k !== mode; });
      document.querySelectorAll('.auth__tabs [data-auth-mode]').forEach(function (t) { t.setAttribute('aria-selected', t.getAttribute('data-auth-mode') === mode ? 'true' : 'false'); });
      var to = authForms[mode];
      var prev = from && authForms[from].phone.value;
      if (!to.phone.value && (prev || savedPhone)) { to.phone.value = prev || savedPhone; to.phone.dispatchEvent(new Event('input')); }
      to.phone.focus();
    };
    document.querySelectorAll('[data-auth-mode]').forEach(function (b) {
      b.addEventListener('click', function () { setMode(b.getAttribute('data-auth-mode')); });
    });
    var initial = location.hash === '#register' ? 'register' : (location.hash === '#reset' || /reset_password=1/.test(location.search)) ? 'reset' : 'login';
    setMode(initial);

    // Вход
    authForms.login.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = authForms.login;
      var bad = invalid(f.phone, phoneDigits(f.phone).length !== 11) | invalid(f.password, !f.password.value);
      if (bad) return;
      if (!API) return msg(f, noApi);
      var btn = f.querySelector('[type="submit"]'); btn.disabled = true; msg(f, '');
      postJson(API + '/login', { phone: '+' + phoneDigits(f.phone), password: f.password.value })
        .then(function (res) { goal('lk_login'); location.href = BASE + (res.redirect || '/lk/'); })
        .catch(function (err) { msg(f, (err && err.error) || 'Не удалось войти. Попробуйте позже.'); f.password.value = ''; })
        .then(function () { btn.disabled = false; });
    });

    // Регистрация и восстановление: шаг 1 — код по СМС или в Telegram, шаг 2 — код и пароль
    var codeFlow = function (f, path, step1Check, finish, done) {
      var step2 = f.querySelector('[data-step2]');
      var send = f.querySelector('[data-send]');
      var finishBtn = f.querySelector('[data-finish]');
      var resend = f.querySelector('[data-resend]');
      var resendBtn = f.querySelector('[data-resend-btn]');
      var timerEl = f.querySelector('[data-timer]');
      var channel = 'sms', timer = null;
      var countdown = function () {
        var left = 60; resendBtn.disabled = true; clearInterval(timer);
        var tick = function () { timerEl.textContent = left > 0 ? 'через ' + left + ' с' : ''; if (left-- <= 0) { clearInterval(timer); resendBtn.disabled = false; } };
        tick(); timer = setInterval(tick, 1000);
      };
      var requestCode = function (ch) {
        if (invalid(f.phone, phoneDigits(f.phone).length !== 11)) return;
        if (step1Check && !step1Check()) return;
        if (!API) return msg(f, noApi);
        channel = ch;
        var phone = '+' + phoneDigits(f.phone);
        var data = { phone: phone, channel: ch };
        if (step1Check) data.consents = { pd: true, asp: true };
        // окно для Telegram открываем сразу по клику, иначе браузер заблокирует всплывающее окно
        var win = ch === 'tg' ? window.open('', '_blank') : null;
        f.querySelectorAll('button').forEach(function (x) { x.disabled = true; });
        msg(f, '');
        postJson(API + path + '/start', data).then(function (res) {
          step2.hidden = false; f.phone.readOnly = true;
          send.hidden = true; finishBtn.hidden = false; resend.hidden = false;
          var s1 = f.querySelector('[data-step1]'); if (s1) s1.hidden = true;
          if (res.tgLink) {
            if (win) win.location.href = res.tgLink;
            msg(f, 'Откройте бота, нажмите <b>«Поделиться номером»</b> — код придёт в чат. <a href="' + res.tgLink + '" target="_blank" rel="noopener">Открыть Telegram</a>', true);
          } else {
            if (win) win.close();
            msg(f, 'Мы отправили код в СМС на ' + f.phone.value + '.' + devNote(res), true);
          }
          countdown();
          f.code.focus();
        })
          .catch(function (err) { if (win) win.close(); msg(f, (err && err.error) || 'Не удалось выполнить запрос. Попробуйте позже.'); })
          .then(function () { f.querySelectorAll('button').forEach(function (x) { if (x !== resendBtn) x.disabled = false; }); });
      };
      resendBtn.addEventListener('click', function () { requestCode(channel); });
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        if (step2.hidden) {
          var btn = e.submitter && e.submitter.getAttribute('data-channel');
          return requestCode(btn || 'sms');
        }
        var bad = invalid(f.code, f.code.value.trim().length !== 6) | invalid(f.password, f.password.value.length < 8);
        if (f.password2) bad |= invalid(f.password2, f.password2.value !== f.password.value);
        if (bad) return;
        finishBtn.disabled = true; msg(f, '');
        postJson(API + path + '/finish', finish('+' + phoneDigits(f.phone)))
          .then(function (res) { clearInterval(timer); done.ok(res); })
          .catch(function (err) { msg(f, (err && err.error) || 'Не удалось выполнить запрос. Попробуйте позже.'); })
          .then(function () { finishBtn.disabled = false; });
      });
    };

    // Показываем кнопку Telegram, если бот подключён на сервере
    if (API) postJson(API + '/config').then(function (c) {
      if (c.tg) document.querySelectorAll('[data-tg]').forEach(function (b) { b.hidden = false; });
    }).catch(function () { /* ignore */ });

    codeFlow(authForms.register, '/register', function () {
      var f = authForms.register;
      var ok = f.pd.checked && f.asp.checked;
      if (!ok) msg(f, 'Отметьте оба согласия, чтобы продолжить.');
      return ok;
    }, function (phone) {
      var f = authForms.register;
      return { phone: phone, code: f.code.value.trim(), password: f.password.value };
    }, {
      ok: function (res) { goal('lk_register'); location.href = BASE + (res.redirect || '/lk/'); },
    });

    codeFlow(authForms.reset, '/reset', null, function (phone) {
      var f = authForms.reset;
      return { phone: phone, code: f.code.value.trim(), password: f.password.value };
    }, {
      ok: function () {
        msg(authForms.reset, 'Пароль изменён. Теперь войдите с новым паролем.', true);
        setTimeout(function () { authForms.login.password.value = ''; setMode('login'); }, 1200);
      },
    });
  }

  // Страница кабинета
  var cab = document.querySelector('[data-cab]');
  if (cab) {
    var user = cab.querySelector('[data-cab-user]');
    var appsBox = cab.querySelector('[data-cab-apps]');
    var cabMsg = cab.querySelector('[data-msg]');
    var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    var fmtPhone = function (p) { var d = p.replace(/\D/g, ''); return '+7 (' + d.slice(1, 4) + ') ' + d.slice(4, 7) + '-' + d.slice(7, 9) + '-' + d.slice(9, 11); };
    if (!API) {
      user.textContent = '';
      appsBox.innerHTML = '';
      cabMsg.textContent = noApi; cabMsg.hidden = false;
    } else {
      postJson(API + '/me')
        .then(function (me) {
          user.innerHTML = '<span class="cab__dot"></span>Вы вошли как <b>' + fmtPhone(me.phone) + '</b> · в кабинете с ' + new Date(me.createdAt).toLocaleDateString('ru-RU');
          appsBox.innerHTML = me.applications.length
            ? '<ul class="apps">' + me.applications.map(function (a) {
              return '<li><div><strong>' + fmt(a.amount) + ' на ' + a.term + NB + plural(a.term, days) + '</strong><span>' + new Date(a.createdAt).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) + '</span></div><span class="apps__st">' + esc(a.status) + '</span></li>';
            }).join('') + '</ul>'
            : '<p class="muted">Заявок пока нет.</p>';
        })
        .catch(function () { location.replace(BASE + '/lk/login/'); });
    }
    var out = cab.querySelector('[data-logout]');
    out.addEventListener('click', function () {
      if (!API) { location.href = BASE + '/lk/login/'; return; }
      out.disabled = true;
      postJson(API + '/logout', {}).then(function () { location.href = BASE + '/lk/login/?out=1'; }, function () { location.href = BASE + '/lk/login/'; });
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
