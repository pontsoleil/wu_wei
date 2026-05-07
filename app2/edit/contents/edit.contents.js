/**
 * edit.contents.js
 * Contents axis and PageMarker editor
 */
wuwei.edit = wuwei.edit || {};
wuwei.edit.contents = wuwei.edit.contents || {};

(function (ns) {
  'use strict';

  var common = wuwei.common;
  var model = wuwei.model;
  var currentGroup = null;
  var currentPoint = null;
  var currentMode = '';
  var applyToContentsGroup = false;

  function $(id) {
    return document.getElementById(id);
  }

  function toHexColor(value, fallback) {
    var text = String(value || '').trim();
    var match;

    if (/^#[0-9a-f]{6}$/i.test(text)) {
      return text;
    }
    if (/^#[0-9a-f]{3}$/i.test(text)) {
      return '#' + text.charAt(1) + text.charAt(1) +
        text.charAt(2) + text.charAt(2) +
        text.charAt(3) + text.charAt(3);
    }
    match = text.match(/^rgb\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
    if (match) {
      return '#' + [match[1], match[2], match[3]].map(function (part) {
        var n = Math.max(0, Math.min(255, Number(part) || 0));
        return ('0' + n.toString(16)).slice(-2);
      }).join('');
    }
    return fallback || '#4c6b8a';
  }

  function getContentsAxisDefaultStyle() {
    var groupStyle = (common && common.defaultStyle && common.defaultStyle.group) || {};
    var contentsStyle = (groupStyle.contents && typeof groupStyle.contents === 'object') ? groupStyle.contents : {};

    return {
      color: contentsStyle.color || groupStyle.color || '#4c6b8a',
      width: Number(contentsStyle.width || groupStyle.width || 4)
    };
  }

  function applyDefaultAxisStyleToFields() {
    var style = getContentsAxisDefaultStyle();
    var widthEl = $('editContentsAxisStrokeWidth');
    var colorEl = $('editContentsAxisStrokeColor');

    if (widthEl) {
      widthEl.value = style.width;
    }
    if (colorEl) {
      colorEl.value = toHexColor(style.color, '#4c6b8a');
    }
  }

  function getAxisSpec(target) {
    if (!target || !wuwei.contents || typeof wuwei.contents.getPageTargetSpec !== 'function') {
      return null;
    }
    return wuwei.contents.getPageTargetSpec(target);
  }

  function isContentsAxisTarget(target) {
    var spec = getAxisSpec(target);
    return !!(spec && spec.group && !spec.point);
  }

  function isPageMarkerTarget(target) {
    var spec = getAxisSpec(target);
    return !!(spec && spec.group && spec.point);
  }

  function normalizeTarget(target) {
    var spec = getAxisSpec(target);
    return spec && spec.group && !spec.point ? spec.group : null;
  }

  function normalizePageMarkerTarget(target) {
    var spec = getAxisSpec(target);
    return spec && spec.group && spec.point ? spec.point : null;
  }

  function ensureShell() {
    var editPane = $('edit');
    var host;

    if (!editPane) {
      return false;
    }

    if (!editPane.innerHTML &&
      wuwei.edit &&
      wuwei.edit.markup &&
      typeof wuwei.edit.markup.template === 'function') {
      editPane.innerHTML = wuwei.edit.markup.template();
    }

    editPane.style.display = 'block';
    if (common && common.state) {
      common.state.Editing = true;
    }

    host = $('edit-contents');
    if (!host) {
      return false;
    }

    host.innerHTML = wuwei.edit.contents.markup.panelsHtml();

    bindEvents(host);
    initColorPalette();
    return true;
  }

  function initColorPalette() {
    if (!window.jQuery || !jQuery.fn || !jQuery.fn.colorPalettePicker) {
      return;
    }
    initPalette('editContentsAxisStrokeColorPalette', 'editContentsAxisStrokeColor');
    initPalette('editContentsPageFillPalette', 'style_fill');
    initPalette('editContentsPageOutlinePalette', 'style_line_color');
    initPalette('editContentsPageFontPalette', 'style_font_color');
  }

  function initPalette(paletteId, inputId) {
    var palette = $(paletteId);
    if (!palette || palette.dataset.initialized === '1') {
      return;
    }
    jQuery('#' + paletteId).colorPalettePicker({
      lines: 4,
      bootstrap: 4,
      dropdownTitle: '標準色',
      buttonClass: 'btn btn-light btn-sm dropdown-toggle',
      onSelected: function (color) {
        var input = $(inputId);
        if (input) {
          input.value = color;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });
    palette.dataset.initialized = '1';
  }

  function bindEvents(host) {
    if (!host || host.dataset.contentsBound === '1') {
      return;
    }
    host.dataset.contentsBound = '1';
    host.addEventListener('change', function (ev) {
      var target = ev.target;
      if (target && target.id === 'applyToContentsGroup') {
        applyToContentsGroup = !!target.checked;
        return;
      }
      if (target && target.id === 'editContentsAxisDirection') {
        applyDefaultAxisStyleToFields();
      }
      if (currentMode === 'axis' && currentGroup) {
        save();
      }
      else if (currentMode === 'page-marker' && currentPoint) {
        savePageMarker();
      }
    });
  }

  function getDescriptionBody(node) {
    return node && node.description && typeof node.description.body === 'string'
      ? node.description.body
      : '';
  }

  function clonePlain(value) {
    return value && typeof value === 'object'
      ? JSON.parse(JSON.stringify(value))
      : value;
  }

  function configureAxis(group) {
    $('editContentsAxisId').value = group.id || '';
    $('editContentsAxisDirection').value = group.orientation || 'horizontal';
    $('editContentsAxisLength').value = Number(group.length || 480);
    $('editContentsAxisStrokeWidth').value = Number(group.strokeWidth || (group.spine && group.spine.width) || 4);
    $('editContentsAxisStrokeColor').value = toHexColor(
      group.strokeColor || (group.spine && group.spine.color) || '#4c6b8a',
      '#4c6b8a'
    );
    $('edit-contents-axis').style.display = '';
    $('edit-contents-page-marker').style.display = 'none';
  }

  function configurePageMarker(point) {
    var style = point.style || {};
    var line = style.line || {};
    var font = style.font || point.font || {};

    $('editContentsPageMarkerId').value = point.id || '';
    $('label').value = point.label || '';
    $('description_body').value = getDescriptionBody(point);
    $('pageNumber').value = Number(point.pageNumber || 1);
    $('style_fill').value = toHexColor(style.fill || point.color || '#ffffff', '#ffffff');
    $('style_line_width').value = Number(
      Number.isFinite(Number(line.width)) ? line.width : (point.outlineWidth || 1)
    );
    $('style_line_color').value = toHexColor(line.color || point.outline || '#4c6b8a', '#4c6b8a');
    $('style_font_color').value = toHexColor(font.color || '#303030', '#303030');
    $('style_font_size').value = font.size || '12pt';
    if ($('applyToContentsGroup')) {
      $('applyToContentsGroup').checked = !!applyToContentsGroup;
    }
    $('edit-contents-axis').style.display = 'none';
    $('edit-contents-page-marker').style.display = '';
  }

  function open(target) {
    var group = normalizeTarget(target);
    if (!group || !ensureShell()) {
      return false;
    }
    currentGroup = group;
    currentPoint = null;
    currentMode = 'axis';
    if (common && common.state) {
      common.state.contentsEdit = { groupId: group.id };
    }
    configureAxis(group);
    return true;
  }

  function openPageMarker(param) {
    var target = param && param.node ? param.node : param;
    var point = normalizePageMarkerTarget(target) || target;
    if (!point || point.topicKind !== 'contents-page' || !ensureShell()) {
      return false;
    }
    currentPoint = point;
    currentGroup = model.findGroupById(point.contentsRef) || null;
    currentMode = 'page-marker';
    if (common && common.state) {
      common.state.contentsEdit = { groupId: point.contentsRef || '', pointId: point.id };
    }
    configurePageMarker(point);
    return $('edit-contents-page-marker');
  }

  function openAxisProperties(target) {
    var group = normalizeTarget(target);
    if (!group) {
      return false;
    }
    if (wuwei.edit && typeof wuwei.edit.resetForExternalEditor === 'function') {
      wuwei.edit.resetForExternalEditor();
    }
    return open(group);
  }

  function getCurrentGroup() {
    return currentGroup;
  }

  function openInfo(target) {
    var group = target || currentGroup;
    var opened = false;
    if (!group) {
      return false;
    }
    if (wuwei.menu && wuwei.menu.contents && typeof wuwei.menu.contents.openPageInInfo === 'function') {
      opened = wuwei.menu.contents.openPageInInfo(group);
    }
    return !!opened;
  }

  function save() {
    if (!currentGroup || !wuwei.contents || typeof wuwei.contents.updateAxisGroup !== 'function') {
      return false;
    }
    wuwei.contents.updateAxisGroup(currentGroup, {
      orientation: $('editContentsAxisDirection').value,
      length: Number($('editContentsAxisLength').value || currentGroup.length || 480),
      strokeWidth: Number($('editContentsAxisStrokeWidth').value || 4),
      strokeColor: $('editContentsAxisStrokeColor').value || '#4c6b8a'
    });
    return true;
  }

  function savePageMarker() {
    var pageNumberEl = $('pageNumber');
    if (!currentPoint) {
      return false;
    }
    if (!$('label') || !$('description_body') || !pageNumberEl ||
      !$('style_fill') || !$('style_line_color') || !$('style_line_width') ||
      !$('style_font_color') || !$('style_font_size')) {
      return false;
    }
    currentPoint.label = $('label').value || '';
    currentPoint.description = {
      format: 'plain/text',
      body: $('description_body').value || ''
    };
    if (String(pageNumberEl.value || '').trim()) {
      currentPoint.pageNumber = Math.max(1, Math.floor(Number(pageNumberEl.value || currentPoint.pageNumber || 1)));
    }
    currentPoint.style = currentPoint.style || {};
    currentPoint.style.fill = $('style_fill').value || '#ffffff';
    currentPoint.style.font = currentPoint.style.font || {};
    currentPoint.style.font.color = $('style_font_color').value || '#303030';
    currentPoint.style.font.size = $('style_font_size').value || currentPoint.style.font.size || '12pt';
    currentPoint.style.line = currentPoint.style.line || {};
    currentPoint.style.line.kind = currentPoint.style.line.kind || 'SOLID';
    currentPoint.style.line.color = $('style_line_color').value || '#4c6b8a';
    currentPoint.style.line.width = Math.max(0, Number($('style_line_width').value || 0));
    currentPoint.color = currentPoint.style.fill;
    currentPoint.outline = currentPoint.style.line.color;
    currentPoint.outlineWidth = currentPoint.style.line.width;
    currentPoint.font = currentPoint.font || {};
    currentPoint.font.color = currentPoint.style.font.color;
    currentPoint.font.size = currentPoint.style.font.size;
    currentPoint.changed = true;
    applyPageMarkerStyleToGroup(currentPoint);
    return true;
  }

  function applyPageMarkerStyleToGroup(sourcePoint) {
    var group = currentGroup;
    var members;
    var seen = {};
    if (!sourcePoint || !applyToContentsGroup || !group) {
      return;
    }
    members = (group.members || []).map(function (member) {
      var id = typeof member === 'string' ? member : (member && (member.nodeId || member.id));
      return id && model && typeof model.findNodeById === 'function'
        ? model.findNodeById(id)
        : null;
    }).filter(function (node) {
      return node && node.topicKind === 'contents-page';
    });
    if (common && common.current && common.current.page && Array.isArray(common.current.page.nodes)) {
      common.current.page.nodes.forEach(function (node) {
        if (node && node.topicKind === 'contents-page' && node.contentsRef === group.id) {
          members.push(node);
        }
      });
    }
    members.forEach(function (node) {
      if (!node || seen[node.id] || node.id === sourcePoint.id) {
        return;
      }
      seen[node.id] = true;
      node.color = sourcePoint.color;
      node.outline = sourcePoint.outline;
      node.outlineWidth = sourcePoint.outlineWidth;
      node.style = clonePlain(sourcePoint.style || {});
      node.font = clonePlain(sourcePoint.font || {});
      node.changed = true;
    });
    if (wuwei.draw && typeof wuwei.draw.refresh === 'function') {
      wuwei.draw.refresh();
    }
  }

  function commit() {
    var saved = currentMode === 'page-marker' ? savePageMarker() : save();
    if (saved && common && common.state) {
      common.state.contentsEdit = null;
    }
    return saved;
  }

  function close() {
    var panel = $('edit-contents-axis');
    if (panel) {
      panel.style.display = 'none';
    }
    panel = $('edit-contents-page-marker');
    if (panel) {
      panel.style.display = 'none';
    }
    currentGroup = null;
    currentPoint = null;
    currentMode = '';
    if (common && common.state) {
      common.state.contentsEdit = null;
    }
  }

  function isOpen() {
    return !!currentGroup || !!currentPoint ||
      !!($('edit-contents-axis') && $('edit-contents-axis').style.display !== 'none') ||
      !!($('edit-contents-page-marker') && $('edit-contents-page-marker').style.display !== 'none');
  }

  ns.canOpen = isContentsAxisTarget;
  ns.canOpenPageMarker = isPageMarkerTarget;
  ns.open = open;
  ns.openAxisProperties = openAxisProperties;
  ns.openPageMarker = openPageMarker;
  ns.getCurrentGroup = getCurrentGroup;
  ns.openInfo = openInfo;
  ns.save = save;
  ns.commit = commit;
  ns.close = close;
  ns.isOpen = isOpen;
})(wuwei.edit.contents);
