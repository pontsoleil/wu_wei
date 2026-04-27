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
    $('#style_fill_palette').colorPalettePicker({
      lines: 4,
      bootstrap: 4,
      dropdownTitle: '標準色',
      buttonClass: 'btn btn-light btn-sm dropdown-toggle',
      buttonPreviewName: 'styleFillPaletteSelected',
      onSelected: function (fill) {
        var input = document.getElementById('style_fill');
        if (input) {
          input.value = fill;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        else if (param && param.node) {
          param.node.fill = fill;
        }
      }
    });

    $('#style_font_color').colorPalettePicker({
      lines: 4,
      bootstrap: 4,
      dropdownTitle: '標準色',
      buttonClass: 'btn btn-light btn-sm dropdown-toggle',
      buttonPreviewName: 'styleFontColorPaletteSelected',
      onSelected: function (font_color) {
        var input = document.getElementById('nFont_color');
        if (input) {
          input.value = font_color;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        else if (param && param.node && param.node.font) {
          param.node.font.color = font_color;
        }
      }
    });
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
