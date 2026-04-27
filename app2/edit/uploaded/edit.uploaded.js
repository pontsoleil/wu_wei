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
    $('#nodeColor').colorPalettePicker({
      lines: 4,
      bootstrap: 4,
      dropdownTitle: '標準色',
      buttonClass: 'btn btn-light btn-sm dropdown-toggle',
      buttonPreviewName: 'nodeColorPaletteSelected',
      onSelected: function (color) {
        var input = document.getElementById('nColor');
        if (input) {
          input.value = color;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });
    $('#nodeFont_color').colorPalettePicker({
      lines: 4,
      bootstrap: 4,
      dropdownTitle: '標準色',
      buttonClass: 'btn btn-light btn-sm dropdown-toggle',
      buttonPreviewName: 'textColorPaletteSelected',
      onSelected: function (color) {
        var input = document.getElementById('nFont_color');
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
