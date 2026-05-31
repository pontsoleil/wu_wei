/**
 * edit.audio.js
 * edit.audio module
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.edit = wuwei.edit || {};
wuwei.edit.audio = wuwei.edit.audio || {};

(function (ns) {
  'use strict';

  function getResource(node, fallback) {
    return (node && node.resource && typeof node.resource === 'object')
      ? node.resource
      : (fallback || {});
  }

  function formatSeconds(sec) {
    sec = Math.max(0, Number(sec) || 0);
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = Math.floor(sec % 60);
    return String(h).padStart(2, '0') + ':' +
      String(m).padStart(2, '0') + ':' +
      String(s).padStart(2, '0');
  }

  function getMediaDuration(resource, node) {
    var res = getResource(node, resource);
    var media = res && res.media && typeof res.media === 'object' ? res.media : {};
    var values = [
      media.durationSeconds,
      media.duration,
      res && res.duration
    ];
    var i;
    var duration;
    for (i = 0; i < values.length; i += 1) {
      duration = Number(values[i]);
      if (Number.isFinite(duration) && duration > 0) {
        return duration;
      }
    }
    return 0;
  }

  function setNodeMediaDuration(node, resource, duration) {
    var value = Number(duration);
    if (!node || !Number.isFinite(value) || value <= 0) {
      return false;
    }
    resource = getResource(node, resource);
    node.resource = resource;
    resource.media = (resource.media && typeof resource.media === 'object') ? resource.media : {};
    resource.media.kind = resource.media.kind || 'audio';
    resource.media.durationSeconds = value;
    resource.duration = value;
    node.changed = true;
    return true;
  }

  function syncDurationDisplayFromNode(node, resource) {
    var text = formatSeconds(getMediaDuration(resource, node));
    var label = document.getElementById('editAudioDuration');
    var row = document.getElementById('resource_media_duration');
    if (label) {
      label.textContent = text;
    }
    if (row) {
      row.value = text;
    }
  }

  function resolveDurationFromAudioElement(node, resource) {
    var player = document.getElementById('editAudioPlayer');
    if (!player) {
      return;
    }
    player.addEventListener('loadedmetadata', function () {
      if (setNodeMediaDuration(node, resource, player.duration)) {
        syncDurationDisplayFromNode(node, resource);
      }
    }, { once: true });
  }

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
        if (!pane || !tabId) {
          return;
        }
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
    return !!(node && wuwei.audio && typeof wuwei.audio.isAudioNode === 'function' && wuwei.audio.isAudioNode(node));
  }

  function open(param) {
    if (wuwei.edit && typeof wuwei.edit.closeInfoPaneForEdit === 'function') {
      wuwei.edit.closeInfoPaneForEdit();
    }
    param = param || {};
    param.option = param.option || {};
    return new Promise(function (resolve) {
      var node = param.node;
      var resource = getResource(node, param.resource);
      var duration = getMediaDuration(resource, node);
      var el = document.getElementById('edit-audio');
      if (el) {
        el.innerHTML = wuwei.edit.audio.markup.template(Object.assign({}, param, {
          resource: resource,
          durationStr: formatSeconds(duration)
        }));
        el.style.display = 'block';
        initTabs(el);
        initColorPalettePicker(param);
        resolveDurationFromAudioElement(node, resource);
      }
      resolve(el);
    });
  }

  function close() {
    var el = document.getElementById('edit-audio');
    if (el) {
      el.innerHTML = '';
      el.style.display = 'none';
    }
  }

  function initModule() { }

  ns.canOpen = canOpen;
  ns.open = open;
  ns.close = close;
  ns.initModule = initModule;
})(wuwei.edit.audio);
// edit.audio.js
