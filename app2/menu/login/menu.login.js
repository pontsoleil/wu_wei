/**
 * menu.login.js
 * menu.login module
 *
 *  WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2013-2020,2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 **/
wuwei.menu = wuwei.menu || {};
wuwei.menu.login = wuwei.menu.login || {};

(function (ns) {
  const
    util = wuwei.util,
    menu = wuwei.menu,
    common = wuwei.common,
    state = common.state;

  function open(cb) {
    refreshUserStatusMenu();

    const loginEl = document.getElementById('login');
    const tpl = menu?.login?.markup?.template; // guard
    if (!tpl) {
      menu.snackbar.open({ type: 'danger', message: 'ERROR: login markup not loaded.' });
      console.error('menu.login.markup.template is missing');
      return;
    }
    loginEl.innerHTML = tpl;
    loginEl.style.display = 'block';
    if (cb && typeof cb === 'function') cb();
  }

  function notify(type, message) {
    if (menu.snackbar && typeof menu.snackbar.open === 'function') {
      menu.snackbar.open({ type: type, message: message });
    } else {
      console.log(message);
    }
  }

  function login(form) {
    form.action = util.getServerUrl('login');
    form.method = 'post';

    AjaxSubmit(form)
      .then((responseText) => {
        const txt = (responseText ?? '').trim();

        // if CGI source leaked to stdout
        if (txt.includes('#!/bin/sh')) {
          throw new Error('ERROR: CGI output looks like script text (check shebang/exec).');
        }

        let response;
        try {
          response = JSON.parse(txt);
        } catch (e) {
          common.state.loggedIn = false;
          update({ login: null, user_id: null, name: null, role: null });
          close();
          notify('warning', txt || 'LOGIN FAILED');
          return;
        }

        // server-side error JSON
        if (response?.error || !util.isUUID(response?.user_id)) {
          common.state.loggedIn = false;
          update({ login: null, user_id: null, name: null, role: null });
          close();
          notify('warning', response?.error || 'LOGIN FAILED');
          return;
        }

        // Success
        const role = response.role;
        document.body.className = role || 'author';
        if (role === 'reader') common.graph.mode = 'view';

        update(response);

        const resultEl = document.querySelector('#login .ajax_result');
        if (resultEl) resultEl.innerText = 'Welcome ' + (response.name || '') + '.';

        notify('success', wuwei.nls.translate('You are logged in.'));
        document.getElementById('menu')?.classList.add('loggedIn');
        document.getElementById('user_status')?.classList.add('loggedIn');

        setTimeout(() => {
          const noteMenu = document.getElementById('noteMenu');
          if (noteMenu) noteMenu.style.display = 'none';
          close();
        }, 500);
      })
      .catch((e) => {
        console.log(e);
        // fall back to server-side session check
        check().catch(() => { });
      });
  }

  // IMPORTANT: do NOT read HttpOnly cookie in JS
  function check() {
    return new Promise(function (resolve, reject) {
      ajaxRequest(util.getServerUrl('is-login'), null, 'GET', 30000)
        .then(responseText => {
          const txt = (responseText ?? '').trim();
          let response;

          // is-login.cgi が ERROR を返す古い実装でも安全
          if (!txt || txt.indexOf('ERROR') >= 0) {
            if (common.isLocalGuestAllowed && common.isLocalGuestAllowed()) {
              update(common.createGuestCurrentUser());
              return resolve({ type: 'guest', message: 'Local guest mode.' });
            }
            common.state.loggedIn = false;
            update({ login: null, user_id: null, name: null, role: null });
            return resolve({ type: 'warning', message: 'Please login.' });
          }

          if (util.isUUID(txt)) {
            response = { user_id: txt, login: '', name: '', role: 'author' };
          } else {
            try {
              response = JSON.parse(txt);
            } catch (e) {
              console.log(e, txt);
              if (common.isLocalGuestAllowed && common.isLocalGuestAllowed()) {
                update(common.createGuestCurrentUser());
                return resolve({ type: 'guest', message: 'Local guest mode.' });
              }
              common.state.loggedIn = false;
              update({ login: null, user_id: null, name: null, role: null });
              return resolve({ type: 'warning', message: 'Please login.' });
            }
          }

          // ★ Cookie比較はしない（HttpOnlyのため）
          if (response?.user_id && util.isUUID(response.user_id)) {
            common.state.loggedIn = true;
            update(response);
            return resolve({ type: 'success', message: wuwei.nls.translate('You are logged in.') });
          }

          if (common.isLocalGuestAllowed && common.isLocalGuestAllowed()) {
            update(common.createGuestCurrentUser());
            return resolve({ type: 'guest', message: 'Local guest mode.' });
          }
          common.state.loggedIn = false;
          update({ login: null, user_id: null, name: null, role: null });
          return resolve({ type: 'warning', message: 'Please login.' });
        })
        .catch(error => {
          console.log(error);
          if (common.isLocalGuestAllowed && common.isLocalGuestAllowed()) {
            update(common.createGuestCurrentUser());
            return resolve({ type: 'guest', message: 'Local guest mode.' });
          }
          common.state.loggedIn = false;
          update({ login: null, user_id: null, name: null, role: null });
          resolve({ type: 'warning', message: 'Please login.' });
        });
    });
  }

  // HttpOnly cookie can't be deleted from JS; rely on server/logout.cgi
  function logout() {
    ajaxRequest(util.getServerUrl('logout'), null, 'GET', 30000)
      .then(() => {
        notify('info', wuwei.nls.translate('You are logged out.'));
        const noteMenu = document.getElementById('noteMenu');
        if (noteMenu) noteMenu.style.display = 'none';
      })
      .catch((error) => console.log(error))
      .finally(() => {
        update({ login: null, user_id: null, name: null, role: null });
        document.getElementById('menu')?.classList.remove('loggedIn');
        document.getElementById('user_status')?.classList.remove('loggedIn');
      });
  }


  function migratePageOwnership(oldOwnerId, newOwnerId) {
    var page = common && common.current ? common.current.page : null;
    if (!page || !oldOwnerId || !newOwnerId || oldOwnerId === newOwnerId) {
      return;
    }

    (page.nodes || []).forEach(function (node) {
      if (node && node.audit && node.audit.createdBy === oldOwnerId) {
        node.audit.createdBy = newOwnerId;
      }
    });

    (page.links || []).forEach(function (link) {
      if (link && link.audit && link.audit.createdBy === oldOwnerId) {
        link.audit.createdBy = newOwnerId;
      }
    });

    (page.groups || []).forEach(function (group) {
      if (group && group.audit && group.audit.createdBy === oldOwnerId) {
        group.audit.createdBy = newOwnerId;
      }
    });

    if (wuwei.model && typeof wuwei.model.setGraphFromCurrentPage === 'function') {
      wuwei.model.setGraphFromCurrentPage();
    }
  }

  function fallbackGuestUser() {
    if (common && typeof common.createGuestCurrentUser === 'function') {
      return common.createGuestCurrentUser();
    }
    return {
      login: 'guest',
      user_id: 'guest',
      name: 'Guest',
      role: 'author',
      token: null
    };
  }

  function getCurrentUser() {
    return (common && common.state && common.state.currentUser) || {};
  }

  function setUserStatusClass(status) {
    var menuEl = document.getElementById('menu');
    var userStatusEl = document.getElementById('user_status');
    var els = [menuEl, userStatusEl];

    els.forEach(function (el) {
      if (!el) { return; }
      el.classList.remove('loggedIn');
      el.classList.remove('guestUser');
      if (status) {
        el.classList.add(status);
      }
    });
  }

  function refreshUserStatusMenu() {
    var user = getCurrentUser();
    var loginEl = document.getElementById('loginUserLogin');
    var nameEl = document.getElementById('loginUserName');
    var roleEl = document.getElementById('loginUserRole');
    var tooltipEl = document.getElementById('userStatusTooltip');
    var statusEl = document.getElementById('user_status');
    var loginText = user.login || user.login_id || user.user || user.user_id || '';
    var nameText = user.name || user.userName || user.displayName || '';
    var roleText = user.role || '';
    var tooltipText = nameText || loginText || user.user_id || 'User';

    if (loginEl) {
      loginEl.textContent = loginText;
    }
    if (nameEl) {
      nameEl.textContent = nameText;
    }
    if (roleEl) {
      roleEl.textContent = roleText;
    }
    if (tooltipEl) {
      tooltipEl.textContent = tooltipText;
    }
    if (statusEl) {
      statusEl.setAttribute('aria-label', tooltipText);
    }

    return user;
  }

  function update(currentUser) {
    var oldOwnerId = common.state.currentUser && common.state.currentUser.user_id;
    var previousUser = common.state.currentUser || {};
    var baseUser;
    var nextUser;

    if (currentUser && wuwei.util.isUUID(currentUser.user_id)) {
      common.state.loggedIn = true;
      baseUser = previousUser.user_id === common.GUEST_USER_ID ? {} : previousUser;
      nextUser = Object.assign({}, baseUser, currentUser);
      nextUser.role = nextUser.role || 'author';
      common.state.currentUser = nextUser;
      if (oldOwnerId && common.isTemporaryOwnerId && common.isTemporaryOwnerId(oldOwnerId)) {
        migratePageOwnership(oldOwnerId, nextUser.user_id);
      }
      setUserStatusClass('loggedIn');
    } else if (currentUser && currentUser.user_id === common.GUEST_USER_ID) {
      common.state.loggedIn = false;
      nextUser = Object.assign({}, fallbackGuestUser(), currentUser);
      nextUser.role = nextUser.role || 'author';
      common.state.currentUser = nextUser;
      setUserStatusClass('guestUser');
    } else {
      common.state.loggedIn = false;
      nextUser = fallbackGuestUser();
      common.state.currentUser = nextUser;
      setUserStatusClass('guestUser');
    }
    refreshUserStatusMenu();
  }

  function close() {
    const loginEl = document.getElementById('login');
    loginEl.innerHTML = '';
    loginEl.style.display = 'none';
  }

  function initModule() {
    check().then(param => { console.log(param); })
      .catch(error => {
        console.log(error);
      });
  }

  ns.open = open;
  ns.login = login;
  ns.check = check;
  ns.update = update;
  ns.refreshUserStatusMenu = refreshUserStatusMenu;
  ns.logout = logout;
  ns.close = close;
  ns.initModule = initModule;
})(wuwei.menu.login);
// menu.login.js revised 2026-03-18
