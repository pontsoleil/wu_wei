/**
 * wuwei.js
 * Root namespace module

 *
 * WuWei is licensed under the MIT License
 * Copyright (c) 2013-2019, Nobuyuki SAMBUICHI
 *
 * WuWei is a free to use open source knowledge modeling tool.
 * More information on WuWei can be found on WuWei homepage.
 * https://wuwei.space/blog/ **/
var wuwei = (function() {
  'use strict';

  // ---------------------------------------------------------------------------
  // UUID v4 fallback
  // Some builds/pages (e.g. app2) may not load lib/uuid.js. In that case,
  // provide a compatible uuid.v4() using crypto.randomUUID() when available.
  // ---------------------------------------------------------------------------
  (function ensureUuidV4() {
    try {
      if (typeof window === 'undefined') { return; }
      window.uuid = window.uuid || {};
      if (typeof window.uuid.v4 === 'function') { return; }

      // Prefer native randomUUID().
      if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        window.uuid.v4 = function() { return window.crypto.randomUUID(); };
        return;
      }

      // Fallback: RFC4122 v4 using getRandomValues() when possible.
      window.uuid.v4 = function() {
        var rnds = new Uint8Array(16);
        if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
          window.crypto.getRandomValues(rnds);
        } else {
          for (var i = 0; i < 16; i++) { rnds[i] = Math.floor(Math.random() * 256); }
        }
        // Per RFC4122 section 4.4
        rnds[6] = (rnds[6] & 0x0f) | 0x40;
        rnds[8] = (rnds[8] & 0x3f) | 0x80;

        var hex = [];
        for (var j = 0; j < 256; j++) {
          hex[j] = (j + 0x100).toString(16).substr(1);
        }
        return (
          hex[rnds[0]] + hex[rnds[1]] + hex[rnds[2]] + hex[rnds[3]] + '-' +
          hex[rnds[4]] + hex[rnds[5]] + '-' +
          hex[rnds[6]] + hex[rnds[7]] + '-' +
          hex[rnds[8]] + hex[rnds[9]] + '-' +
          hex[rnds[10]] + hex[rnds[11]] + hex[rnds[12]] + hex[rnds[13]] + hex[rnds[14]] + hex[rnds[15]]
        );
      };
    } catch (e) {
      // If anything goes wrong, leave uuid undefined and let the caller fail loudly.
    }
  })();

  var initModule = async function(param) {
    console.log('START wuwei.initModule()');
    var noscript = document.getElementById('noscript');
    // run some checks first
    noscript.parentNode.removeChild(noscript);

    function unsupported () {
      // disable handlers and leave
      window.init = null;
      window.onbeforeunload = null;
      window.onunload = null;
      window.location = 'unsupported.html';
    }

    // Check for the various File API support.
    var id, el;
    if (window.File && window.FileReader) {
      // Great success! All the File APIs are supported.
      id = 'upload_popover';
      el = document.getElementById(id);
      if (el) {
        el.style.display = 'block';
      }
    } else {
      console.log('Warning: The File APIs are not fully supported in this browser.');
      id = 'upload_popover';
      el = document.getElementById(id);
      if (el) {
        el.style.display = 'none';
      }
      unsupported();
    }

    await wuwei.shell.initModule(param || '');
  };

  return {
    initModule : initModule
  };
})();
