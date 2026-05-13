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
    if (!target || !wuwei.contents || typeof wuwei.contents.getContentTargetSpec !== 'function') {
      return null;
    }
    return wuwei.contents.getContentTargetSpec(target);
  }

  function isContentsAxisTarget(target) {
    var spec = getAxisSpec(target);
    return !!(spec && spec.group && !spec.point);
  }

  function isContentTargetTarget(target) {
    var spec = getAxisSpec(target);
    return !!(spec && spec.group && spec.point);
  }

  function normalizeTarget(target) {
    var spec = getAxisSpec(target);
    return spec && spec.group && !spec.point ? spec.group : null;
  }

  function normalizeContentTargetTarget(target) {
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
      dropdownTitle: wuwei.nls.translate('Standard colours'),
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
      else if (currentMode === 'content-target' && currentPoint) {
        saveContentTarget();
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

  function normalizeTextAlign(value) {
    var text = String(value || '').toLowerCase();
    if (text === 'start') { return 'left'; }
    if (text === 'end') { return 'right'; }
    return (text === 'left' || text === 'right') ? text : 'center';
  }

  function textAnchorForAlign(align) {
    if (align === 'left') { return 'start'; }
    if (align === 'right') { return 'end'; }
    return 'middle';
  }

  function normalizeAnchorHref(value) {
    var text = String(value || '').trim();
    var hashIndex;

    if (!text) {
      return '';
    }
    hashIndex = text.indexOf('#');
    if (hashIndex >= 0) {
      text = text.slice(hashIndex);
    }
    if (!text) {
      return '';
    }
    return text.charAt(0) === '#' ? text : ('#' + text);
  }

  function anchorToSectionId(anchorHref) {
    return String(anchorHref || '').replace(/^#/, '');
  }

  function isHtmlContentTarget(point) {
    var documentNode;

    if (!point) {
      return false;
    }
    if (point.anchorHref || point.contentsKind === 'html-toc') {
      return true;
    }
    documentNode = model && typeof model.findNodeById === 'function'
      ? model.findNodeById(point.documentRef || (currentGroup && currentGroup.documentRef))
      : null;
    return !!(documentNode && wuwei.contents &&
      typeof wuwei.contents.isHtmlResourceNode === 'function' &&
      wuwei.contents.isHtmlResourceNode(documentNode));
  }

  function setRowVisible(id, visible) {
    var row = $(id);
    if (row) {
      row.style.display = visible ? '' : 'none';
    }
  }

  function updateTargetHrefAnchor(point, anchorHref) {
    var targetHref;

    if (!point) {
      return;
    }
    targetHref = String(point.targetHref || '');
    if (targetHref) {
      point.targetHref = targetHref.replace(/#.*$/, '') + anchorHref;
    }
  }

  function alignForContentTarget(point, font) {
    font = font || {};
    return normalizeTextAlign(font.align || point.labelAlign || font['text-anchor']);
  }


  function defaultPageMarkerLabel(pageNumber) {
    return String(Math.max(1, Math.floor(Number(pageNumber || 1))));
  }

  function isAutoPageMarkerLabel(label, pageNumber) {
    var value = String(label || '').trim();
    var pageLabel = defaultPageMarkerLabel(pageNumber);
    return !value || value === pageLabel;
  }

  function getPageSequenceNumber(point, group) {
    var value;

    if (!point) {
      return 1;
    }
    value = Number(
      point.pageSequenceNumber ||
      point.sequenceNumber ||
      point.physicalPageNumber ||
      0
    );
    if (Number.isFinite(value) && value > 0) {
      return Math.max(1, Math.floor(value));
    }
    if (wuwei.contents && typeof wuwei.contents.toPhysicalPageNumber === 'function') {
      return wuwei.contents.toPhysicalPageNumber(group, point.pageNumber || 1);
    }
    return Math.max(1, Math.floor(Number(point.pageNumber || 1)));
  }

  function updateGroupFirstPageNumberFromMarker(group, pageNumber, sequenceNumber) {
    var first;

    if (!group || !Number.isFinite(Number(pageNumber)) || !Number.isFinite(Number(sequenceNumber))) {
      return;
    }
    if (wuwei.contents && typeof wuwei.contents.updatePageNumberMappingFromMarker === 'function') {
      wuwei.contents.updatePageNumberMappingFromMarker(group, pageNumber, sequenceNumber);
      return;
    }
    pageNumber = Math.max(1, Math.floor(Number(pageNumber)));
    sequenceNumber = Math.max(1, Math.floor(Number(sequenceNumber)));
    first = Math.max(1, pageNumber - sequenceNumber + 1);
    group.firstPageNumber = first;
    group.firstDisplayedPageNumber = first;
    group.documentFirstPageNumber = first;
    group.axis = group.axis || {};
    group.axis.start = first;
  }

  function configureAxis(group) {
    $('editContentsAxisId').value = group.id || '';
    $('editContentsAxisDirection').value = group.orientation || 'horizontal';
    $('editContentsAxisLength').value = Number(group.length || 480);
    if ($('editContentsFirstPageNumber')) {
      $('editContentsFirstPageNumber').value = Number(
        group.firstPageNumber ||
        group.firstDisplayedPageNumber ||
        group.documentFirstPageNumber ||
        group.axis && group.axis.start ||
        1
      );
    }
    $('editContentsAxisStrokeWidth').value = Number(group.strokeWidth || (group.spine && group.spine.width) || 4);
    $('editContentsAxisStrokeColor').value = toHexColor(
      group.strokeColor || (group.spine && group.spine.color) || '#4c6b8a',
      '#4c6b8a'
    );
    $('edit-contents-axis').style.display = '';
    $('edit-contents-page-marker').style.display = 'none';
  }

  function configureContentTarget(point) {
    var style = point.style || {};
    var line = style.line || {};
    var font = style.font || point.font || {};

    var htmlMarker = isHtmlContentTarget(point);
    var anchorHref = normalizeAnchorHref(point.anchorHref || '');

    $('editContentsPageMarkerId').value = point.id || '';
    $('label').value = point.label || '';
    $('description_body').value = getDescriptionBody(point);
    if ($('pageNumber')) {
      $('pageNumber').value = Number(point.pageNumber || 1);
    }
    if ($('pageSequenceNumber')) {
      $('pageSequenceNumber').value = getPageSequenceNumber(point, currentGroup);
    }
    if ($('anchorHref')) {
      $('anchorHref').value = anchorHref;
    }
    setRowVisible('pageNumberRow', !htmlMarker);
    setRowVisible('pageSequenceNumberRow', !htmlMarker);
    setRowVisible('anchorHrefRow', htmlMarker);
    $('style_fill').value = toHexColor(style.fill || point.color || '#ffffff', '#ffffff');
    $('style_line_width').value = Number(
      Number.isFinite(Number(line.width)) ? line.width : (point.outlineWidth || 1)
    );
    $('style_line_color').value = toHexColor(line.color || point.outline || '#4c6b8a', '#4c6b8a');
    $('style_font_color').value = toHexColor(font.color || '#303030', '#303030');
    $('style_font_size').value = font.size || '12pt';
    if ($('style_font_align')) {
      $('style_font_align').value = alignForContentTarget(point, font);
    }
    if ($('labelOffset')) {
      $('labelOffset').value = Number.isFinite(Number(point.labelOffset)) ? Number(point.labelOffset) : 6;
    }
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

  function openContentTarget(param) {
    var target = param && param.node ? param.node : param;
    var point = normalizeContentTargetTarget(target) || target;
    if (!point || point.topicKind !== 'contents-page' || !ensureShell()) {
      return false;
    }
    currentPoint = point;
    currentGroup = model.findGroupById(point.groupRef) || null;
    currentMode = 'content-target';
    if (common && common.state) {
      common.state.contentsEdit = { groupId: point.groupRef || '', pointId: point.id };
    }
    configureContentTarget(point);
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
    if (wuwei.menu && wuwei.menu.contents && typeof wuwei.menu.contents.openContentTargetInInfo === 'function') {
      opened = wuwei.menu.contents.openContentTargetInInfo(group);
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
      firstPageNumber: $('editContentsFirstPageNumber') ? Number($('editContentsFirstPageNumber').value || currentGroup.firstPageNumber || 1) : undefined,
      strokeWidth: Number($('editContentsAxisStrokeWidth').value || 4),
      strokeColor: $('editContentsAxisStrokeColor').value || '#4c6b8a'
    });
    return true;
  }

  function saveContentTarget() {
    function t(str) {
      return wuwei.nls.translate(str);
    }

    var pageNumberEl = $('pageNumber');
    var pageSequenceNumberEl = $('pageSequenceNumber');
    var anchorHrefEl = $('anchorHref');
    var htmlMarker = isHtmlContentTarget(currentPoint);
    var anchorHref;
    var oldLabel;
    var oldPageNumber;
    var oldSequenceNumber;
    var labelValue;
    var newPageNumber;
    var newSequenceNumber;
    var labelWasUnchanged;
    var labelWasAutomatic;

    if (!currentPoint) {
      return false;
    }
    if (!$('label') || !$('description_body') ||
      !$('style_fill') || !$('style_line_color') || !$('style_line_width') ||
      !$('style_font_color') || !$('style_font_size') ||
      !$('style_font_align') || !$('labelOffset')) {
      return false;
    }
    if (htmlMarker && !anchorHrefEl) {
      return false;
    }
    if (!htmlMarker && !pageNumberEl) {
      return false;
    }

    var align = normalizeTextAlign($('style_font_align').value);
    var labelOffset = Math.max(0, Number($('labelOffset').value || 0));
    oldLabel = currentPoint.label || '';
    oldPageNumber = Math.max(1, Math.floor(Number(currentPoint.pageNumber || 1)));
    oldSequenceNumber = getPageSequenceNumber(currentPoint, currentGroup);
    labelValue = $('label').value || '';
    labelWasUnchanged = labelValue === oldLabel;
    labelWasAutomatic = isAutoPageMarkerLabel(oldLabel, oldPageNumber);
    currentPoint.description = {
      format: 'plain/text',
      body: $('description_body').value || ''
    };
    if (htmlMarker) {
      anchorHref = normalizeAnchorHref(anchorHrefEl.value || '');
      if (!anchorHref) {
        window.alert(t('HTML PageMarker must specify anchorHref starting with #.'));
        return false;
      }
      currentPoint.anchorHref = anchorHref;
      currentPoint.href = anchorHref;
      currentPoint.sectionId = anchorToSectionId(anchorHref);
      currentPoint.contentsKind = 'html-toc';
      updateTargetHrefAnchor(currentPoint, anchorHref);
    }
    else if (String(pageNumberEl.value || '').trim()) {
      newPageNumber = Math.max(1, Math.floor(Number(pageNumberEl.value || currentPoint.pageNumber || 1)));
      newSequenceNumber = String(pageSequenceNumberEl && pageSequenceNumberEl.value || '').trim()
        ? Math.max(1, Math.floor(Number(pageSequenceNumberEl.value || oldSequenceNumber || 1)))
        : (wuwei.contents && typeof wuwei.contents.toPhysicalPageNumber === 'function'
          ? wuwei.contents.toPhysicalPageNumber(currentGroup, newPageNumber)
          : oldSequenceNumber);
      currentPoint.pageNumber = newPageNumber;
      currentPoint.pageSequenceNumber = newSequenceNumber;
      currentPoint.sequenceNumber = newSequenceNumber;
      currentPoint.physicalPageNumber = newSequenceNumber;
      updateGroupFirstPageNumberFromMarker(currentGroup, newPageNumber, newSequenceNumber);
    }
    if (!String(labelValue || '').trim()) {
      currentPoint.label = defaultPageMarkerLabel(currentPoint.pageNumber || oldPageNumber);
    }
    else if (labelWasAutomatic && labelWasUnchanged && currentPoint.pageNumber !== oldPageNumber) {
      currentPoint.label = defaultPageMarkerLabel(currentPoint.pageNumber || oldPageNumber);
    }
    else {
      currentPoint.label = labelValue;
    }
    currentPoint.style = currentPoint.style || {};
    currentPoint.style.fill = $('style_fill').value || '#ffffff';
    currentPoint.style.font = clonePlain(currentPoint.style.font || currentPoint.font || {});
    currentPoint.style.font.color = $('style_font_color').value || '#303030';
    currentPoint.style.font.size = $('style_font_size').value || currentPoint.style.font.size || '12pt';
    currentPoint.style.font.align = align;
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
    currentPoint.font.align = align;
    currentPoint.font['text-anchor'] = textAnchorForAlign(align);
    currentPoint.labelAlign = align;
    currentPoint.labelOffset = labelOffset;
    currentPoint.changed = true;
    applyContentTargetStyleToGroup(currentPoint);
    if (wuwei.contents && typeof wuwei.contents.updateEntryFromNode === 'function') {
      wuwei.contents.updateEntryFromNode(currentPoint);
    }
    else if (wuwei.draw && typeof wuwei.draw.refresh === 'function') {
      wuwei.draw.refresh();
    }
    return true;
  }

  function applyContentTargetStyleToGroup(sourcePoint) {
    var group = currentGroup;
    var members;
    var seen = {};
    if (!sourcePoint || !applyToContentsGroup || !group) {
      return;
    }
    members = (group.members || []).map(function (member) {
      return member && member.nodeId && model && typeof model.findNodeById === 'function'
        ? model.findNodeById(member.nodeId)
        : null;
    }).filter(function (node) {
      return node && node.type === 'PageMarker' && node.groupRef === group.id;
    });
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
      node.labelAlign = sourcePoint.labelAlign;
      node.labelOffset = sourcePoint.labelOffset;
      node.changed = true;
    });
    if (wuwei.draw && typeof wuwei.draw.refresh === 'function') {
      wuwei.draw.refresh();
    }
  }

  function commit() {
    var saved = currentMode === 'content-target' ? saveContentTarget() : save();
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
  ns.canOpenContentTarget = isContentTargetTarget;
  ns.open = open;
  ns.openAxisProperties = openAxisProperties;
  ns.openContentTarget = openContentTarget;
  ns.openPageMarker = openContentTarget;
  ns.getCurrentGroup = getCurrentGroup;
  ns.openInfo = openInfo;
  ns.save = save;
  ns.commit = commit;
  ns.close = close;
  ns.isOpen = isOpen;
})(wuwei.edit.contents);
// edit.contents.js last modified 2026-05-11
