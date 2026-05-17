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
/* 2023-06-12
    let link, source, source_position, target, target_position,
        table, tbody, rows, columns,
        rgx=/^([TRBL])([-+]?)(\d+)$/,
        rgxT=/^C(\d+)R(\d+)$/,
        position, col, row;
        document.getElementById('source_position').addEventListener('change', (event) => {
          event.stopPropagation();
          link = param.link;
          source = link.source;
          source_position = event.target.value;
          if (source_position.match(/^[\s]*$/)) {
            source_position = '';
          }
          else if ('Table' === source.type) {
            table = source.table;
            tbody = table.tbody;
            columns = tbody.tr[0].td.length;
            rows = tbody.tr.length;
            position = source_position.match(rgxT);
            if (!position) {
              alert('Invalid value. Enter CnRm or "".');
              resolve(null);
            }
            col = +position[1];
            row = +position[2];
            if (col < 0 || col >= columns ||
                row < 0 || row >= rows) {
              alert('Invalid value.');
              resolve(null);
            }
          } else {
            position = source_position.match(rgx);
            if (!position) {
              alert('Invalid value. Enter Tn, Rn, Bn, Ln or "".');
              resolve(null);
            }
          }
          const evt = {
            target: {
              id: 'lSource_position',
              value: source_position
            }
          };
          wuwei.edit.update(evt);
        });
      
        document.getElementById('target_position').addEventListener('change', (event) => {
          event.stopPropagation();
          link = param.link;
          target = link.target;
          target_position = event.target.value;
          if (target_position.match(/^[\s]*$/)) {
            target_position = '';
          }
          else if ('Table' === target.type) {
            table = target.table;
            tbody = table.tbody;
            columns = tbody.tr[0].td.length;
            rows = tbody.tr.length;
            position = target_position.match(rgxT);
            if (!position) {
              alert('Invalid value. Enter CnRm or "".');
              resolve(null);
            }
            col = +position[1];
            row = +position[2];
            if (col < 0 || col >= columns ||
                row < 0 || row >= rows) {
              alert('Invalid value.');
              resolve(null);
            }
          }
          else {
            position = target_position.match(rgx);
            if (!position) {
              alert('Invalid value. Enter Tn, Rn, Bn, Ln or "".');
              resolve(null);
            }
          }
          const evt = {
            target: {
              id: 'lTarget_position',
              value: target_position
            }
          };
          wuwei.edit.update(evt);
        });
*/
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
