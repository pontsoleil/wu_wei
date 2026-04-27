/**
 * wuwei.shell.js
 * initializing module
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2013-2020,2023,2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.shell = (function () {
  'use strict';
  var
    common = wuwei.common,
    state = common.state,
    util = wuwei.util,

    configMap = {
      resize_interval: 200,
      main_html: String()
    },
    stateMap = {
      initialised: false
    },
    /** function */
    detectDevice,
    listener,
    exit,
    openSnackbar,
    refreshCurrentDraw,
    restartCurrentDraw,
    initModule;
  //----------------- END MODULE SCOPE VARIABLES ---------------

  //------------------- BEGIN UTILITY METHODS ------------------
  detectDevice = function () {
    if (!configMap.Global) { return; }
    var
      min480 = window.matchMedia('screen and (min-width: 480px)'),
      min768_max1024 = window.matchMedia('screen and (min-width:768px) and (max-width:1024px)'),
      min1024 = window.matchMedia('screen and (min-width: 1024px)'),
      portrait = window.matchMedia('screen and (orientation: portrait)'),
      landscape = window.matchMedia('screen and (orientation: landscape)'),
      device,
      orientation;

    configMap.Global.IS_TOUCH = !!('ontouchstart' in window);

    if (configMap.Global.IS_TOUCH) {
      device = 'iphone';
      if (min480.matches) {
        device = 'iphone';
      }
      if (min768_max1024.matches) {
        device = 'ipad';
      }
    } else {
      device = 'pc';
    }
    if (min1024.matches) {
      device = 'pc';
    }
    if ('pc' === device) {
      $('#wuwei').addClass('pc');
    } else {
      $('#wuwei').removeClass('pc');
    }

    if (portrait.matches) {
      orientation = 'portrait';
      $('#wuwei').addClass('portrait');
    }
    if (landscape.matches) {
      orientation = 'landscape';
      $('#wuwei').removeClass('portrait');
    }

    setSize(configMap.Global.FONT_SIZE);
    configMap.Global.DEVICE = {
      'device': device,
      'orientation': orientation
    };
    return configMap.Global.DEVICE;
  };

  openSnackbar = function (param) {
    if (wuwei.menu && wuwei.menu.snackbar && typeof wuwei.menu.snackbar.open === 'function') {
      wuwei.menu.snackbar.open(param);
    }
    else if (param && param.message) {
      window.alert(param.message);
    }
  };

  refreshCurrentDraw = function () {
    if (wuwei.draw && typeof wuwei.draw.refresh === 'function') {
      wuwei.draw.refresh();
    }
  };

  restartCurrentDraw = function () {
    if (wuwei.draw && typeof wuwei.draw.restart === 'function') {
      wuwei.draw.restart();
    }
  };

  listener = function (request) {
    if (!request) {
      return;
    }
    console.log('-*- listener', request);
    const graph = wuwei.common.graph,
      model = wuwei.model,
      data = request.data;
    if (data && data.type) {
      const message_type = data.type;
      if (
        message_type === 'FROM_CEXT' ||
        message_type === 'FROM_SFEX' ||
        message_type === 'NEW_OCCURRENCE'
      ) {
        console.log(data);
        const logData = model.addCext(data);
        wuwei.log.storeLog(logData);
        if ('draw' === graph.mode) {
          refreshCurrentDraw();
        } else if ('simulation' === graph.mode) {
          restartCurrentDraw();
        }
      }
      return;
    }
  };

  initModule = async function (param) {
    state.isOnline = window.navigator.onLine;
    state.browser = util.whichBrowser();

    if (wuwei.init &&
      wuwei.init.registry &&
      typeof wuwei.init.registry.run === 'function') {
      await wuwei.init.registry.run(param || '');
    }
    else {
      console.warn('wuwei.init.registry.run is not available');
    }

    stateMap.initialised = true;

    var params = String(param || '').split('&');
    var match, note_id, u;
    for (var p of params) {
      match = p.match(/^note=(.*)$/);
      if (match) {
        note_id = match[1];
      }
      match = p.match(/^u=(.*)$/);
      if (match) {
        u = match[1];
      }
    }

    if (note_id) {
      wuwei.common.state.currentUser = null;
      wuwei.common.graph.mode = 'view';
      wuwei.common.state.viewOnly = true;
      wuwei.common.state.published = true;
      for (var pub of common.PUBLIC) {
        wuwei.common.state.currentUser = {
          user: pub.user,
          user_id: pub.user_id
        };
        break;
      }
      if (wuwei.common.state.currentUser) {
        wuwei.note.loadNote(note_id)
          .then(function (responseText) {
            if (responseText.trim().match(/^ERROR/)) {
              openSnackbar({ type: 'error', message: responseText });
            } else if (responseText.match(/^#! \/bin\/sh/)) {
              responseText = 'ERROR Cannnot execute bin/sh';
              openSnackbar({ type: 'error', message: responseText });
            } else {
              if (!responseText) {
                return;
              }
              const decodedText = decodeURIComponent(responseText).trim();
              var noteJson;
              try {
                noteJson = JSON.parse(decodedText);
              } catch (e) {
                console.log(e);
                openSnackbar({ message: responseText, type: 'warning' });
                return;
              }

              wuwei.note.updateNote(noteJson);
              if (wuwei.draw) {
                wuwei.draw.mode = 'view';
              }

              var wuweiDiv = document.getElementById('wuwei');
              wuweiDiv.style.display = 'flex';

              setTimeout(function () {
                var settingEl = document.getElementById('setting');
                var drawModeEl = document.getElementById('draw_mode');
                var mainIconEl = document.getElementById('mainIcon');
                var noteIconEl = document.getElementById('noteIcon');
                var pageIconEl = document.getElementById('pageIcon');
                var newIconEl = document.getElementById('newIcon');
                var flockIconEl = document.getElementById('flockIcon');
                if (settingEl) { settingEl.classList.remove('active'); }
                if (drawModeEl) { drawModeEl.classList.remove('active'); }
                if (mainIconEl) { mainIconEl.style.display = 'none'; }
                if (noteIconEl) { noteIconEl.style.display = 'none'; }
                if (pageIconEl) { pageIconEl.style.display = 'none'; }
                if (newIconEl) { newIconEl.style.display = 'none'; }
                if (flockIconEl) { flockIconEl.style.display = 'none'; }

                if (document.querySelector('#note_name .name')) {
                  document.querySelector('#note_name .name').innerHTML = common.current.note_name || '';
                }
                if (document.querySelector('#note_name .description')) {
                  document.querySelector('#note_name .description').innerHTML = common.current.description || '';
                }

                if (Object.keys(wuwei.common.current.pages).length > 1) {
                  wuwei.menu.refreshPagenation();
                }
                refreshCurrentDraw();
              }, 500);
            }
          })
          .catch(function (err) {
            console.log(err);
          });
        return;
      }
    }
    else if (!String(param || '').match(/force-login/)) {
      const user_id = util.getCookie('wuwei_user_id');
      if (wuwei.menu && wuwei.menu.login) {
        wuwei.menu.login.update({
          user_id: user_id
        });
        wuwei.menu.login.initModule();
      }
    }

    const language = localStorage.getItem('language');
    if (language) {
      wuwei.common.nls.LANG = language;
    }

/*    window.addEventListener('message', function (request) {
      console.log('Message from the background script:');
      listener(request);
    });*/

    window.addEventListener('resize', function () {
      console.log('Window resize');
      let width = window.innerWidth,
        height = window.innerHeight,
        svg_draw = document.getElementById('draw'),
        viewBox = svg_draw ? svg_draw.getAttribute('viewBox') : null,
        vb = viewBox && viewBox.match(/(-?\d+\.?\d*) (-?\d+\.?\d*) (\d+\.?\d*) (\d+\.?\d*)/);
      if (!svg_draw || !vb) {
        return;
      }
      viewBox = `${vb[1]} ${vb[2]} ${width} ${height}`;
      svg_draw.setAttribute('width', width);
      svg_draw.setAttribute('height', height);
      svg_draw.setAttribute('viewBox', viewBox);
    });

    stateMap.initialised = true;
  };

  return {
    initModule: initModule
  };
})();
