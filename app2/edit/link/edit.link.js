/**
 * edit.link.js
 * edit.link module
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2013-2020, 2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.edit = wuwei.edit || {};
wuwei.edit.link = wuwei.edit.link || {};

(function (ns) {

  function initColorPalettePicker(param) {
    if (!wuwei.edit.style || !wuwei.edit.style.markup ||
      typeof wuwei.edit.style.markup.initPalette !== 'function') {
      return;
    }
    wuwei.edit.style.markup.initPalette('style_line_color_palette', 'style_line_color');
    wuwei.edit.style.markup.initPalette('style_font_color_palette', 'style_font_color');
  }

  function open(param) {
    if (wuwei.edit && typeof wuwei.edit.closeInfoPaneForEdit === 'function') {
      wuwei.edit.closeInfoPaneForEdit();
    }
    if ('undefined'==param.option) {
      param.option = {};
    }
    // stateMap.param = param || {};
    return new Promise((resolve, reject) => {
      const el = document.getElementById('edit-link');
      if (el) {
        el.innerHTML = wuwei.edit.link.markup.template(param);
        el.style.display = 'block';
        if (wuwei.edit && typeof wuwei.edit.autoExpandTextareas === 'function') {
          wuwei.edit.autoExpandTextareas(el);
        }
      }
      initColorPalettePicker(param);
      resolve(el);
    });
  }

  function close() {
    const el = document.getElementById('edit-link');
    if (el) {
      el.innerHTML = '';
      el.style.display = 'none';
    }
  }

    ns.open = open;
  ns.close = close;
})(wuwei.edit.link);
// edit.link.js 2023-06-12
