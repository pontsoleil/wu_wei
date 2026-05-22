/**
 * wuwei.init.registry.js
 * init registry module
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 **/
wuwei.init = wuwei.init || {};
wuwei.init.registry = (function () {
  'use strict';

  var
    getModules,
    getRequiredApis,
    assertRequiredApis,
    waitForElement,
    beforeModule,
    run,
    listNames;

  getModules = function () {
    return [
      { name: 'wuwei.util', target: function () { return wuwei.util; } },
      { name: 'wuwei.model', target: function () { return wuwei.model; } },
      { name: 'wuwei.data', target: function () { return wuwei.data; } },
      { name: 'wuwei.video', target: function () { return wuwei.video; } },
      { name: 'wuwei.log', target: function () { return wuwei.log; } },
      { name: 'wuwei.menu', target: function () { return wuwei.menu; } },
      { name: 'wuwei.draw', target: function () { return wuwei.draw; } },
      { name: 'wuwei.note', target: function () { return wuwei.note; } },
      { name: 'wuwei.edit', target: function () { return wuwei.edit; } },
      { name: 'wuwei.info', target: function () { return wuwei.info; } },
      { name: 'wuwei.filter', target: function () { return wuwei.filter; } },
      { name: 'wuwei.search', target: function () { return wuwei.search; } },
      { name: 'wuwei.home', target: function () { return wuwei.home; } }
    ];
  };


  getRequiredApis = function () {
    return [
      { name: 'wuwei.model.getCurrentPage', target: function () { return wuwei.model && wuwei.model.getCurrentPage; } },
      { name: 'wuwei.model.setGraphFromCurrentPage', target: function () { return wuwei.model && wuwei.model.setGraphFromCurrentPage; } },
      { name: 'wuwei.log.savePrevious', target: function () { return wuwei.log && wuwei.log.savePrevious; } },
      { name: 'wuwei.log.resumePrevious', target: function () { return wuwei.log && wuwei.log.resumePrevious; } },
      { name: 'wuwei.log.recordCurrent', target: function () { return wuwei.log && wuwei.log.recordCurrent; } },
      { name: 'wuwei.log.storeLog', target: function () { return wuwei.log && wuwei.log.storeLog; } }
    ];
  };

  assertRequiredApis = function () {
    var required = getRequiredApis();
    var missing = required.filter(function (item) {
      var target = item && item.target ? item.target() : null;
      return typeof target !== 'function';
    }).map(function (item) {
      return item.name;
    });

    if (missing.length) {
      throw new Error('Missing required API(s): ' + missing.join(', '));
    }
  };

  waitForElement = function (selector) {
    return new Promise(function (resolve) {
      var started = Date.now();
      var timer;
      var found = document.querySelector(selector);

      if (found) {
        resolve(found);
        return;
      }

      timer = window.setInterval(function () {
        found = document.querySelector(selector);
        if (found || Date.now() - started > 3000) {
          window.clearInterval(timer);
          resolve(found || null);
        }
      }, 20);
    });
  };

  beforeModule = async function (name) {
    if ('wuwei.menu' === name) {
      await waitForElement('#menu');
    }
    else if ('wuwei.draw' === name) {
      await waitForElement('svg#draw');
    }
    else if ('wuwei.note' === name) {
      await waitForElement('g#canvas');
    }
  };

  run = async function (param) {
    var modules = getModules();
    var i, item, mod;

    assertRequiredApis();

    for (i = 0; i < modules.length; i++) {
      item = modules[i];
      mod = item.target();

      if (mod && typeof mod.initModule === 'function') {
        await beforeModule(item.name);
        console.log('[init] ' + item.name);
        await Promise.resolve(mod.initModule(param || ''));
      }
    }
  };

  listNames = function () {
    return getModules()
      .filter(function (item) {
        var mod = item && item.target ? item.target() : null;
        return !!(mod && typeof mod.initModule === 'function');
      })
      .map(function (item) {
        return item.name;
      });
  };

  return {
    getModules: getModules,
    getRequiredApis: getRequiredApis,
    assertRequiredApis: assertRequiredApis,
    run: run,
    listNames: listNames
  };
})();
// wuwei.init.registry.js last modified 2026-05-11
