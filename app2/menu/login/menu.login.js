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
          menu.snackbar.open({ type: 'warning', message: txt || 'LOGIN FAILED' });
          return;
        }

        // server-side error JSON
        if (response?.error || !util.isUUID(response?.user_id)) {
          common.state.loggedIn = false;
          update({ login: null, user_id: null, name: null, role: null });
          close();
          menu.snackbar.open({ type: 'warning', message: response?.error || 'LOGIN FAILED' });
          return;
        }

        // Success
        const role = response.role;
        document.body.className = role || 'author';
        if (role === 'reader') common.graph.mode = 'view';

        update(response);

        const resultEl = document.querySelector('#login .ajax_result');
        if (resultEl) resultEl.innerText = 'Welcome ' + (response.name || '') + '.';

        menu.snackbar.open({ type: 'success', message: wuwei.nls.translate('You are logged in.') });
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
        menu.snackbar.open({ type: 'info', message: wuwei.nls.translate('You are logged out.') });
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

  function update(currentUser) {
    var oldOwnerId = common.state.currentUser && common.state.currentUser.user_id;
    var previousUser = common.state.currentUser || {};
    var nextUser;

    if (currentUser && wuwei.util.isUUID(currentUser.user_id)) {
      common.state.loggedIn = true;
      nextUser = Object.assign({}, previousUser, currentUser);
      nextUser.role = nextUser.role || 'author';
      common.state.currentUser = nextUser;
      if (oldOwnerId && common.isTemporaryOwnerId && common.isTemporaryOwnerId(oldOwnerId)) {
        migratePageOwnership(oldOwnerId, nextUser.user_id);
      }
      document.getElementById('menu')?.classList.add('loggedIn');
      document.getElementById('user_status')?.classList.add('loggedIn');
    } else if (currentUser && currentUser.user_id === common.GUEST_USER_ID) {
      common.state.loggedIn = false;
      nextUser = Object.assign({}, fallbackGuestUser(), currentUser);
      nextUser.role = nextUser.role || 'author';
      common.state.currentUser = nextUser;
      document.getElementById('menu')?.classList.remove('loggedIn');
      document.getElementById('user_status')?.classList.remove('loggedIn');
    } else {
      common.state.loggedIn = false;
      nextUser = fallbackGuestUser();
      common.state.currentUser = nextUser;
      document.getElementById('menu')?.classList.remove('loggedIn');
      document.getElementById('user_status')?.classList.remove('loggedIn');
    }
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
  ns.logout = logout;
  ns.close = close;
  ns.initModule = initModule;
})(wuwei.menu.login);
// menu.login.js revised 2026-03-18
