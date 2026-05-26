/**
 * edit.video.js
 * edit.video module
 * 
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.edit = wuwei.edit || {};
wuwei.edit.video = wuwei.edit.video || {};

( function (ns) {
  const common = wuwei.common;
  const model = wuwei.model;
  const draw = wuwei.draw;

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


  function formatSeconds(sec) {
    sec = Math.max(0, Number(sec) || 0);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  function getResource(node, fallback) {
    return (node && node.resource && typeof node.resource === 'object')
      ? node.resource
      : (fallback || {});
  }

  function getMediaDuration(resource, node) {
    const res = getResource(node, resource);
    const media = res && res.media && typeof res.media === 'object' ? res.media : {};
    const values = [
      media.durationSeconds,
      media.duration,
      res && res.duration
    ];
    for (let i = 0; i < values.length; i += 1) {
      const duration = Number(values[i]);
      if (Number.isFinite(duration) && duration > 0) {
        return duration;
      }
    }
    return 0;
  }

  function setNodeMediaDuration(node, resource, duration) {
    const value = Number(duration);
    if (!Number.isFinite(value) || value <= 0) {
      return false;
    }
    resource = getResource(node, resource);
    if (node) {
      node.resource = resource;
    }
    resource.media = (resource.media && typeof resource.media === 'object') ? resource.media : {};
    resource.media.kind = resource.media.kind || 'video';
    resource.media.durationSeconds = value;
    resource.duration = value;
    if (node) {
      node.changed = true;
    }
    return true;
  }

  function syncDurationDisplayFromNode(node, resource) {
    const el = document.getElementById('editVideoDuration');
    var text = formatSeconds(getMediaDuration(resource, node));
    if (el) {
      el.textContent = text;
    }
    var row = document.getElementById('resource_media_duration');
    if (row) {
      row.value = text;
    }
  }

  function applyResolvedDurationToNodeAndPane(node, resource, duration) {
    if (setNodeMediaDuration(node, resource, duration)) {
      syncDurationDisplayFromNode(node, resource);
    }
  }

  function resolveDurationForDisplay(node, resource) {
    const current = getMediaDuration(resource, node);
    if (current > 0) {
      applyResolvedDurationToNodeAndPane(node, resource, current);
      return;
    }
    if (wuwei.timeline && typeof wuwei.timeline.resolveMediaDuration === 'function') {
      wuwei.timeline.resolveMediaDuration(node).then(function (duration) {
        applyResolvedDurationToNodeAndPane(node, resource, duration);
      }).catch(function () { });
    }
  }

  function open(param) {
    if (wuwei.edit && typeof wuwei.edit.closeInfoPaneForEdit === 'function') {
      wuwei.edit.closeInfoPaneForEdit();
    }
    if (param.option === undefined) param.option = {};
    return new Promise((resolve) => {
      const node = param.node;
      const resource = getResource(node, param.resource);
      const duration = getMediaDuration(resource, node);
      const el = document.getElementById('edit-video');
      el.innerHTML = wuwei.edit.video.markup.template(
        param = Object.assign(
          {},
          param,
          {
            resource: resource,
            durationStr: formatSeconds(duration)
          }
        )
      );
      el.style.display = 'block';
      initTabs(el);
      initColorPalettePicker(param);
      resolveDurationForDisplay(node, resource);
      resolve(el);
    });
  }
  function close() {
    const el = document.getElementById('edit-video');
    if (el) {
      el.innerHTML = ''; el.style.display = 'none';
    }
  }

  ns.open = open;
  ns.close = close;
})(wuwei.edit.video);
// edit.video.js last modified 2026-04-07
