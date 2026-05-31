/**
 * edit.document.js
 * Document edit pane controller.
 */
wuwei.edit = wuwei.edit || {};
wuwei.edit.document = wuwei.edit.document || {};

(function (ns) {
  'use strict';

  function initColorPalettePicker(param) {
    if (!wuwei.edit.style || !wuwei.edit.style.markup ||
      typeof wuwei.edit.style.markup.initPalettes !== 'function') {
      return;
    }
    wuwei.edit.style.markup.initPalettes({
      target: param && param.node,
      fillPaletteId: 'style_fill_palette',
      linePaletteId: 'style_line_color_palette',
      fontPaletteId: 'style_font_color_palette'
    });
  }

  function initTabs(root) {
    var host = root || document;
    var buttons = host.querySelectorAll ? host.querySelectorAll('[data-edit-tab]') : [];
    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        var tabId = button.getAttribute('data-edit-tab');
        var pane = button.closest('.edit-tabbed-pane');
        if (!pane || !tabId) { return; }
        pane.querySelectorAll('[data-edit-tab]').forEach(function (item) {
          item.classList.toggle('active', item === button);
          item.classList.toggle('w3-blue', item === button);
        });
        pane.querySelectorAll('[data-edit-tab-panel]').forEach(function (panel) {
          panel.style.display = (panel.getAttribute('data-edit-tab-panel') === tabId) ? 'block' : 'none';
        });
      });
    });
  }

  function canOpen(node) {
    return !!(node && node.type === 'Content' && wuwei.document &&
      typeof wuwei.document.isDocumentNode === 'function' &&
      wuwei.document.isDocumentNode(node));
  }

  function open(param) {
    if (wuwei.edit && typeof wuwei.edit.closeInfoPaneForEdit === 'function') {
      wuwei.edit.closeInfoPaneForEdit();
    }
    param = param || {};
    param.option = param.option || {};
    return new Promise(function (resolve) {
      var el = document.getElementById('edit-document');
      if (el) {
        el.innerHTML = wuwei.edit.document.markup.template(param);
        el.style.display = 'block';
        initTabs(el);
      }
      initColorPalettePicker(param);
      resolve(el);
    });
  }

  function close() {
    var el = document.getElementById('edit-document');
    if (el) {
      el.innerHTML = '';
      el.style.display = 'none';
    }
  }

  ns.canOpen = canOpen;
  ns.open = open;
  ns.close = close;
  ns.initModule = function () { };
})(wuwei.edit.document);
// edit.document.js
