/* Админка: заявки, пользователи, журнал, администраторы. Без зависимостей. */
(function () {
  'use strict';
  var body = document.body;
  var API = (body.getAttribute('data-api') || '') + '/admin';
  var root = document.querySelector('[data-admin]');
  if (!root) return;
  var NB = ' ';
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var money = function (n) { return Math.round(n).toLocaleString('ru-RU').replace(/\s/g, NB) + NB + '₽'; };
  var dt = function (iso) { return iso ? new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'; };
  var phone = function (p) { var d = String(p).replace(/\D/g, ''); return '+7' + NB + '(' + d.slice(1, 4) + ')' + NB + d.slice(4, 7) + '-' + d.slice(7, 9) + '-' + d.slice(9, 11); };
  var statusCls = { 'На рассмотрении': 'st--wait', 'Одобрена': 'st--ok', 'Выдана': 'st--ok', 'Погашена': 'st--done', 'Отказ': 'st--bad', 'Отменена': 'st--done' };

  function req(path, data) {
    return fetch(API + path, {
      method: data === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: data === undefined ? undefined : JSON.stringify(data),
      credentials: 'same-origin',
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401 && path !== '/login') { showLogin(); throw { error: 'Сеанс завершён. Войдите снова.' }; }
        if (!r.ok) throw j;
        return j;
      });
    });
  }

  var me = null;
  var view = function (html) { root.innerHTML = html; };
  var errBox = function (form, text) { var m = form.querySelector('[data-msg]'); m.textContent = text || ''; m.hidden = !text; };

  // ---------- Вход и создание администратора ----------
  function authCard(title, sub, fields, button) {
    return '<div class="adm-auth"><form class="adm-auth__card" novalidate>' +
      '<div class="adm-auth__logo">Админка</div><h1>' + title + '</h1><p class="muted">' + sub + '</p>' + fields +
      '<button class="btn btn--primary btn--lg btn--block" type="submit">' + button + '</button>' +
      '<p class="adm-err" data-msg hidden></p></form></div>';
  }
  var inp = function (label, name, type, ac) {
    return '<label class="field"><span class="field__label">' + label + '</span><input class="input" name="' + name + '" type="' + type + '" autocomplete="' + ac + '" required></label>';
  };

  function showSetup(token) {
    view(authCard('Создание администратора', 'Это одноразовая ссылка. Придумайте логин и надёжный пароль — не короче 10 символов.',
      inp('Логин', 'login', 'text', 'username') + inp('Пароль', 'password', 'password', 'new-password') + inp('Повторите пароль', 'password2', 'password', 'new-password'),
      'Создать и войти'));
    var f = root.querySelector('form');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (f.password.value !== f.password2.value) return errBox(f, 'Пароли не совпадают.');
      req('/setup', { token: token, login: f.login.value.trim(), password: f.password.value })
        .then(function () { history.replaceState(null, '', location.pathname); start(); })
        .catch(function (err) { errBox(f, err.error || 'Ошибка'); });
    });
  }

  function showLogin() {
    me = null;
    view(authCard('Вход', 'Доступ только для сотрудников компании.',
      inp('Логин', 'login', 'text', 'username') + inp('Пароль', 'password', 'password', 'current-password'), 'Войти'));
    var f = root.querySelector('form');
    f.login.focus();
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      req('/login', { login: f.login.value.trim(), password: f.password.value })
        .then(start)
        .catch(function (err) { f.password.value = ''; errBox(f, err.error || 'Ошибка'); });
    });
  }

  // ---------- Оболочка ----------
  var tabs = [['overview', 'Обзор'], ['apps', 'Заявки'], ['users', 'Пользователи'], ['audit', 'Журнал'], ['admins', 'Администраторы'], ['account', 'Мой пароль']];
  function shell() {
    view('<div class="adm">' +
      '<aside class="adm__side"><div class="adm__brand">Админка</div><nav>' +
      tabs.map(function (t) { return '<a href="#' + t[0] + '" data-tab="' + t[0] + '">' + t[1] + '</a>'; }).join('') +
      '</nav><div class="adm__me"><span>' + esc(me.login) + (me.owner ? ' · владелец' : '') + '</span><button class="linklike" type="button" data-action="logout">Выйти</button></div></aside>' +
      '<main class="adm__main" data-main></main></div>');
    root.querySelector('[data-action="logout"]').addEventListener('click', function () {
      req('/logout', {}).then(showLogin, showLogin);
    });
  }
  var main = function () { return root.querySelector('[data-main]'); };
  function route() {
    if (!me) return;
    var tab = (location.hash || '#overview').slice(1).split('?')[0];
    if (!tabs.some(function (t) { return t[0] === tab; })) tab = 'overview';
    root.querySelectorAll('[data-tab]').forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('data-tab') === tab); });
    ({ overview: overview, apps: apps, users: users, audit: auditLog, admins: admins, account: account })[tab]();
  }
  window.addEventListener('hashchange', route);

  // ---------- Обзор ----------
  function overview() {
    main().innerHTML = '<h1 class="adm__h">Обзор</h1><p class="muted">Загрузка…</p>';
    req('/stats').then(function (s) {
      main().innerHTML = '<h1 class="adm__h">Обзор</h1>' +
        '<div class="adm-kpi">' +
        kpi('Заявок сегодня', s.applicationsToday) + kpi('Всего заявок', s.applications) +
        kpi('Регистраций сегодня', s.usersToday) + kpi('Пользователей', s.users) + kpi('Выдано, сумма', money(s.sumIssued)) +
        '</div><h2 class="adm__h2">Заявки по статусам</h2><div class="adm-bars">' +
        s.statuses.map(function (st) {
          var n = s.byStatus[st] || 0, pct = s.applications ? Math.round(n / s.applications * 100) : 0;
          return '<a class="adm-bar" href="#apps?status=' + encodeURIComponent(st) + '"><span>' + esc(st) + '</span><span class="adm-bar__track"><i data-w="' + pct + '"></i></span><b>' + n + '</b></a>';
        }).join('') + '</div>';
      // ширину полосок задаём через CSSOM (атрибут style запрещён политикой CSP)
      main().querySelectorAll('[data-w]').forEach(function (i) { i.style.width = i.getAttribute('data-w') + '%'; });
    }).catch(fail);
  }
  var kpi = function (label, value) { return '<div class="adm-kpi__item"><span>' + label + '</span><b>' + value + '</b></div>'; };
  var fail = function (err) { var m = main(); if (m) m.insertAdjacentHTML('beforeend', '<p class="adm-err">' + esc((err && err.error) || 'Ошибка загрузки') + '</p>'); };

  // ---------- Заявки ----------
  function apps() {
    var params = new URLSearchParams((location.hash.split('?')[1]) || '');
    var status = params.get('status') || '', q = params.get('q') || '', page = +params.get('page') || 1;
    main().innerHTML = '<div class="adm__top"><h1 class="adm__h">Заявки</h1><a class="btn btn--ghost" href="' + API + '/applications.csv" download>Выгрузить в Excel (CSV)</a></div>' +
      '<form class="adm-filter" data-filter><input class="input" name="q" placeholder="Поиск по телефону" value="' + esc(q) + '"><select class="input" name="status"><option value="">Все статусы</option></select><button class="btn btn--primary" type="submit">Найти</button></form>' +
      '<div data-list><p class="muted">Загрузка…</p></div>';
    var f = main().querySelector('[data-filter]');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var p = new URLSearchParams();
      if (f.q.value.trim()) p.set('q', f.q.value.trim());
      if (f.status.value) p.set('status', f.status.value);
      location.hash = 'apps' + (p.toString() ? '?' + p : '');
    });
    var qs = new URLSearchParams({ status: status, q: q, page: page });
    req('/applications?' + qs).then(function (d) {
      f.status.innerHTML = '<option value="">Все статусы</option>' + d.statuses.map(function (s) { return '<option' + (s === status ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('');
      var list = main().querySelector('[data-list]');
      if (!d.items.length) { list.innerHTML = '<p class="muted adm-empty">Заявок нет.</p>'; return; }
      list.innerHTML = '<p class="muted">Найдено: ' + d.total + '</p><div class="adm-table"><table><thead><tr><th>Дата</th><th>Телефон</th><th>Сумма / срок</th><th>Статус</th><th>Комментарий</th><th>Источник</th></tr></thead><tbody>' +
        d.items.map(function (a) {
          return '<tr data-id="' + esc(a.id) + '"><td>' + dt(a.createdAt) + '</td><td>' + phone(a.phone) + (a.registered ? ' <span class="tag">ЛК</span>' : '') + '</td>' +
            '<td><b>' + money(a.amount) + '</b><br><span class="muted">' + a.term + ' дн.</span></td>' +
            '<td><select class="input input--sm st ' + (statusCls[a.status] || '') + '" data-status>' + d.statuses.map(function (s) { return '<option' + (s === a.status ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select></td>' +
            '<td><textarea class="input input--sm" data-comment rows="2" maxlength="1000" placeholder="Заметка сотрудника">' + esc(a.comment) + '</textarea></td>' +
            '<td class="muted small">' + esc((a.utm && a.utm.utm_source) || 'прямой') + (a.utm && a.utm.utm_campaign ? '<br>' + esc(a.utm.utm_campaign) : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>' + pager(d.page, d.pages, status, q);
      list.querySelectorAll('tr[data-id]').forEach(function (tr) {
        var id = tr.getAttribute('data-id');
        var sel = tr.querySelector('[data-status]'), ta = tr.querySelector('[data-comment]');
        var saveIt = function (data, el) {
          el.classList.add('is-saving');
          req('/applications/' + id, data).then(function () {
            el.classList.remove('is-saving'); el.classList.add('is-saved');
            setTimeout(function () { el.classList.remove('is-saved'); }, 1200);
            if (data.status) sel.className = 'input input--sm st ' + (statusCls[data.status] || '');
          }).catch(function (err) { el.classList.remove('is-saving'); alert(err.error || 'Ошибка'); });
        };
        sel.addEventListener('change', function () { saveIt({ status: sel.value }, sel); });
        ta.addEventListener('change', function () { saveIt({ comment: ta.value }, ta); });
      });
    }).catch(fail);
  }
  function pager(page, pages, status, q) {
    if (pages < 2) return '';
    var link = function (p, t) { var s = new URLSearchParams({ status: status, q: q, page: p }); return '<a class="btn btn--ghost" href="#apps?' + s + '">' + t + '</a>'; };
    return '<div class="adm-pager">' + (page > 1 ? link(page - 1, '← Назад') : '') + '<span>Страница ' + page + ' из ' + pages + '</span>' + (page < pages ? link(page + 1, 'Вперёд →') : '') + '</div>';
  }

  // ---------- Пользователи ----------
  function users() {
    var q = new URLSearchParams((location.hash.split('?')[1]) || '').get('q') || '';
    main().innerHTML = '<h1 class="adm__h">Пользователи</h1><form class="adm-filter" data-filter><input class="input" name="q" placeholder="Поиск по телефону" value="' + esc(q) + '"><button class="btn btn--primary" type="submit">Найти</button></form><div data-list><p class="muted">Загрузка…</p></div>';
    var f = main().querySelector('[data-filter]');
    f.addEventListener('submit', function (e) { e.preventDefault(); location.hash = 'users' + (f.q.value.trim() ? '?q=' + encodeURIComponent(f.q.value.trim()) : ''); });
    req('/users?q=' + encodeURIComponent(q)).then(function (d) {
      var list = main().querySelector('[data-list]');
      if (!d.items.length) { list.innerHTML = '<p class="muted adm-empty">Пользователей нет.</p>'; return; }
      list.innerHTML = '<p class="muted">Найдено: ' + d.total + '</p><div class="adm-table"><table><thead><tr><th>Телефон</th><th>Регистрация</th><th>Заявок</th><th>Статус</th><th></th></tr></thead><tbody>' +
        d.items.map(function (u) {
          return '<tr data-id="' + esc(u.id) + '"><td>' + phone(u.phone) + '</td><td>' + dt(u.createdAt) + '</td><td><a href="#apps?q=' + encodeURIComponent(u.phone.replace(/\D/g, '')) + '">' + u.applications + '</a></td>' +
            '<td>' + (u.blocked ? '<span class="st st--bad">Заблокирован</span>' : u.online ? '<span class="st st--ok">В сети</span>' : '<span class="st st--done">Активен</span>') + '</td>' +
            '<td class="adm-actions"><button class="btn btn--ghost btn--sm" data-block="' + (u.blocked ? '0' : '1') + '">' + (u.blocked ? 'Разблокировать' : 'Заблокировать') + '</button>' +
            (u.online ? ' <button class="btn btn--ghost btn--sm" data-logout>Завершить сеансы</button>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
      list.querySelectorAll('tr[data-id]').forEach(function (tr) {
        var id = tr.getAttribute('data-id');
        var b = tr.querySelector('[data-block]'), lo = tr.querySelector('[data-logout]');
        b.addEventListener('click', function () {
          var block = b.getAttribute('data-block') === '1';
          if (block && !confirm('Заблокировать пользователя? Он не сможет войти в кабинет.')) return;
          req('/users/' + id, { blocked: block }).then(users).catch(function (err) { alert(err.error || 'Ошибка'); });
        });
        if (lo) lo.addEventListener('click', function () { req('/users/' + id, { logout: true }).then(users); });
      });
    }).catch(fail);
  }

  // ---------- Журнал ----------
  function auditLog() {
    main().innerHTML = '<h1 class="adm__h">Журнал действий</h1><p class="muted">Последние 300 событий: входы, изменения заявок, блокировки, выгрузки.</p><div data-list><p class="muted">Загрузка…</p></div>';
    req('/audit').then(function (d) {
      main().querySelector('[data-list]').innerHTML = d.items.length
        ? '<div class="adm-table"><table><thead><tr><th>Время</th><th>Сотрудник</th><th>Действие</th><th>Объект</th><th>Детали</th></tr></thead><tbody>' +
          d.items.map(function (e) { return '<tr><td>' + dt(e.at) + '</td><td>' + esc(e.admin) + '</td><td>' + esc(e.action) + '</td><td>' + esc(e.target) + '</td><td class="muted small">' + esc(e.details) + '</td></tr>'; }).join('') +
          '</tbody></table></div>'
        : '<p class="muted adm-empty">Событий пока нет.</p>';
    }).catch(fail);
  }

  // ---------- Администраторы ----------
  function admins() {
    main().innerHTML = '<h1 class="adm__h">Администраторы</h1><div data-list><p class="muted">Загрузка…</p></div>' +
      (me.owner ? '<h2 class="adm__h2">Добавить сотрудника</h2><form class="adm-form" data-add novalidate>' +
        inp('Логин', 'login', 'text', 'off') + inp('Временный пароль (от 10 символов)', 'password', 'password', 'new-password') +
        '<button class="btn btn--primary" type="submit">Добавить</button><p class="adm-err" data-msg hidden></p></form>' : '');
    req('/admins').then(function (d) {
      main().querySelector('[data-list]').innerHTML = '<div class="adm-table"><table><thead><tr><th>Логин</th><th>Роль</th><th>Создан</th><th>Последний вход</th><th></th></tr></thead><tbody>' +
        d.items.map(function (a) {
          return '<tr data-id="' + esc(a.id) + '"><td>' + esc(a.login) + '</td><td>' + (a.owner ? 'Владелец' : 'Сотрудник') + (a.disabled ? ' · <span class="st st--bad">отключён</span>' : '') + '</td><td>' + dt(a.createdAt) + '</td><td>' + dt(a.lastLoginAt) + '</td>' +
            '<td>' + (me.owner && !a.owner ? '<button class="btn btn--ghost btn--sm" data-toggle="' + (a.disabled ? '0' : '1') + '">' + (a.disabled ? 'Включить' : 'Отключить') + '</button>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
      main().querySelectorAll('[data-toggle]').forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.closest('tr').getAttribute('data-id');
          req('/admins/' + id, { disabled: b.getAttribute('data-toggle') === '1' }).then(admins).catch(function (err) { alert(err.error || 'Ошибка'); });
        });
      });
    }).catch(fail);
    var f = main().querySelector('[data-add]');
    if (f) f.addEventListener('submit', function (e) {
      e.preventDefault();
      req('/admins', { login: f.login.value.trim(), password: f.password.value }).then(admins).catch(function (err) { errBox(f, err.error || 'Ошибка'); });
    });
  }

  // ---------- Мой пароль ----------
  function account() {
    main().innerHTML = '<h1 class="adm__h">Мой пароль</h1><form class="adm-form" novalidate>' +
      inp('Текущий пароль', 'current', 'password', 'current-password') + inp('Новый пароль (от 10 символов)', 'password', 'password', 'new-password') + inp('Повторите новый пароль', 'password2', 'password', 'new-password') +
      '<button class="btn btn--primary" type="submit">Сменить пароль</button><p class="adm-err" data-msg hidden></p></form>';
    var f = main().querySelector('form');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (f.password.value !== f.password2.value) return errBox(f, 'Пароли не совпадают.');
      req('/password', { current: f.current.value, password: f.password.value })
        .then(function () { f.reset(); var m = f.querySelector('[data-msg]'); m.textContent = 'Пароль изменён. Другие сеансы завершены.'; m.hidden = false; m.classList.add('adm-ok'); })
        .catch(function (err) { errBox(f, err.error || 'Ошибка'); });
    });
  }

  // ---------- Старт ----------
  function start() {
    req('/state').then(function (s) {
      var token = (location.hash.match(/setup=([0-9a-f]+)/) || [])[1];
      if (s.needSetup) return token ? showSetup(token) : view(authCard('Админка не настроена', 'Откройте одноразовую ссылку создания администратора.', '', 'Обновить'));
      if (!s.admin) return showLogin();
      me = s.admin;
      if (token) history.replaceState(null, '', location.pathname);
      shell();
      route();
    }).catch(function () { view('<p class="adm-err">Админка работает только на сервере (node server.js).</p>'); });
  }
  if (!body.getAttribute('data-api')) { view('<div class="adm-auth"><div class="adm-auth__card"><h1>Админка</h1><p class="muted">Работает только на сервере (node server.js).</p></div></div>'); return; }
  start();
})();
