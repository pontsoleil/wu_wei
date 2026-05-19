/**
 * edit.uploaded.js
 * edit.uploaded module
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2013-2019, 2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.edit = wuwei.edit || {};
wuwei.edit.uploaded = wuwei.edit.uploaded || {};

(function (ns) {

  function initColorPalettePicker(param) {
    if (!wuwei.edit.style || !wuwei.edit.style.markup ||
      typeof wuwei.edit.style.markup.initPalettes !== 'function') {
      return;
    }
    wuwei.edit.style.markup.initPalettes({
      target: param && param.node,
      fillPaletteId: 'style_fill_palette',
      fontPaletteId: 'style_font_color_palette'
    });
  }

  function open(param) {
    if ('undefined' == param.option) {
      param.option = {};
    }
    return new Promise((resolve, reject) => {
      const el = document.getElementById('edit-uploaded');
      if (el) {
        el.innerHTML = wuwei.edit.uploaded.markup.template(param);
        el.style.display = 'block';
      }
      initColorPalettePicker(param);
      resolve(el);
    });
  }

  function close() {
    const el = document.getElementById('edit-uploaded');
    if (el) {
      el.innerHTML = '';
      el.style.display = 'none';
    }
  }

  ns.open = open;
  ns.close = close;
})(wuwei.edit.uploaded);
// edit.uploaded.js las modified 2026-04-07
