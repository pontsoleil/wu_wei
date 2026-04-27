/**
 * info.generic.js
 * info.generic module
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2013-2020,2023,2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 **/
wuwei.info = wuwei.info || {};
wuwei.info.generic = wuwei.info.generic || {};

(function (ns) {

  function setLabelWithBreaks(el, text) {
    var lines;

    if (!el) {
      return;
    }

    el.innerHTML = '';
    lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');

    lines.forEach(function (line, i) {
      if (i > 0) {
        el.appendChild(document.createElement('br'));
      }
      el.appendChild(document.createTextNode(line));
    });
  }

  function open(param) {
    var pane = document.getElementById('info-generic');
    var labelEl;
    var node;
    var label;

    if (!pane) {
      return;
    }

    pane.innerHTML = wuwei.info.generic.markup.template(param);
    pane.style.display = 'block';

    node = param && param.node ? param.node : null;
    label = node ? (node.label || '') : '';

    labelEl = document.getElementById('rName');
    if (labelEl) {
      setLabelWithBreaks(labelEl, label);
    }
  }

  function close() {
    var pane = document.getElementById('info-generic');
    if (!pane) {
      return;
    }
    pane.innerHTML = '';
    pane.style.display = 'none';
  }

  function initModule() {
  }

  ns.open = open;
  ns.close = close;
  ns.initModule = initModule;
})(wuwei.info.generic);
// info.generic.js last modified 2026-03-28
