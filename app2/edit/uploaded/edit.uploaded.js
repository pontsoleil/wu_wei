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
    $('#style_fill_palette').colorPalettePicker({
      lines: 6,
      bootstrap: 4,
      dropdownTitle: wuwei.nls.translate('Standard colours'),
      buttonClass: 'btn btn-light btn-sm dropdown-toggle',
      buttonPreviewName: 'nodeColorPaletteSelected',
      onSelected: function (color) {
        var input = document.getElementById('style_fill');
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
    if ('undefined' == param.option) {
      param.option = {};
    }
    //    param = param || {};
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
