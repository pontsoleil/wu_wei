/**
 * edit.style.js
 * Shared style edit behavior.
 */
wuwei.edit = wuwei.edit || {};
wuwei.edit.style = wuwei.edit.style || {};

(function (ns) {
  'use strict';

  function initPalettes(param) {
    if (ns.markup && typeof ns.markup.initPalettes === 'function') {
      ns.markup.initPalettes(param || {});
    }
  }

  function initPalette(paletteId, inputId, fallbackTarget, fallbackPath) {
    if (ns.markup && typeof ns.markup.initPalette === 'function') {
      ns.markup.initPalette(paletteId, inputId, fallbackTarget, fallbackPath);
    }
  }

  ns.initPalette = initPalette;
  ns.initPalettes = initPalettes;
})(wuwei.edit.style);
