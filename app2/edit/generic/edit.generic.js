/**
 * edit.generic.js
 * edit.generic module
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2013-2020,2023,2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.edit = wuwei.edit || {};
wuwei.edit.generic = wuwei.edit.generic || {};

(function (ns) {

  function initColorPalettePicker(param) {
    if (wuwei.edit.style && wuwei.edit.style.markup &&
      typeof wuwei.edit.style.markup.initPalettes === 'function') {
      wuwei.edit.style.markup.initPalettes({
        target: param && param.node,
        fillPaletteId: 'style_fill_palette',
        fontPaletteId: 'style_font_color_palette'
      });
    }
  }
        
  function open(param) {
    if (!param) {
      param = {}
    }
    if ('undefined'==param.option) {
      param.option = {};
    }
    return new Promise((resolve, reject) => {
      const el = document.getElementById('edit-generic');
      if (el) {
        el.innerHTML = wuwei.edit.generic.markup.template(param);
        el.style.display = 'block';
      }
      initColorPalettePicker(param);
      resolve(el);
    });
  }

  function close() {
    const el = document.getElementById('edit-generic');
    if (el) {
      el.innerHTML = '';
      el.style.display = 'none';
    }
  }

  ns.open = open;
  ns.close = close;
})(wuwei.edit.generic);
// edit.generic.js last modified 2026-04-28
