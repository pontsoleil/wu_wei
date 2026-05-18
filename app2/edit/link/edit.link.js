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
    $('#style_line_color_palette').colorPalettePicker({
      lines: 6,
      bootstrap: 4,
      dropdownTitle: wuwei.nls.translate('Standard colours'),
      buttonClass: 'btn btn-light btn-sm dropdown-toggle',
      buttonPreviewName: 'linkColorPaletteSelected',
      onSelected: function (color) {
        var input = document.getElementById('style_line_color');
        if (input) {
          input.value = color;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });
    $('#style_font_color_palette').colorPalettePicker({
      lines: 6,
      bootstrap: 4,
      dropdownTitle: wuwei.nls.translate('Standard colours'),
      buttonClass: 'btn btn-light btn-sm dropdown-toggle',
      buttonPreviewName: 'textColorPaletteSelected',
      onSelected: function (color) {
        var input = document.getElementById('style_font_color');
        if (input) {
          input.value = color;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });
  }

  function open(param) {
    if ('undefined'==param.option) {
      param.option = {};
    }
    // stateMap.param = param || {};
    return new Promise((resolve, reject) => {
      const el = document.getElementById('edit-link');
      if (el) {
        el.innerHTML = wuwei.edit.link.markup.template(param);
        el.style.display = 'block';

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
