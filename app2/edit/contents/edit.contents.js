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
    if (!wuwei.edit.style || !wuwei.edit.style.markup ||
      typeof wuwei.edit.style.markup.initPalette !== 'function') {
      return;
    }
    wuwei.edit.style.markup.initPalette('editContentsAxisStrokeColorPalette', 'editContentsAxisStrokeColor');
    wuwei.edit.style.markup.initPalette('editContentsPageFillPalette', 'style_fill');
    wuwei.edit.style.markup.initPalette('editContentsPageOutlinePalette', 'style_line_color');
    wuwei.edit.style.markup.initPalette('editContentsPageFontPalette', 'style_font_color');
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
      if (target && target.id === 'editContentsRepShape') {
        updateShapeControlsFromSelection(
          'editContentsRep',
          getGroupRepresentativeNode(currentGroup),
          getDefaultRepresentativeSize(),
          'RECTANGLE'
        );
      }
      if (target && target.id === 'editContentsPageMarkerShape') {
        updateShapeControlsFromSelection(
          'editContentsPageMarker',
          currentPoint,
          getDefaultPageMarkerSize(),
          'CIRCLE'
        );
      }
      if (currentMode === 'axis' && currentGroup) {
        save();
      }
      else if (currentMode === 'content-target' && currentPoint) {
        if (target && target.id === 'htmlAnchorHref') {
          saveHtmlAnchorHref();
          return;
        }
        if (target && target.id === 'pageNumber') {
          saveDocumentPageNumber();
        }
        saveContentTarget(target);
      }
    });
    host.addEventListener('click', function (ev) {
      var target = ev.target;
      if (!target || !(target.classList && target.classList.contains('font_text-anchor'))) {
        return;
      }
      ev.preventDefault();
      ev.stopPropagation();
      if (target.classList.contains('start')) {
        setLabelAlignIcons('left');
      }
      else if (target.classList.contains('end')) {
        setLabelAlignIcons('right');
      }
      else {
        setLabelAlignIcons('center');
      }
      if (currentMode === 'content-target' && currentPoint) {
        saveContentTarget(target);
      }
    });
  }

  function getDescriptionBody(node) {
    return node && node.description && typeof node.description.body === 'string'
      ? node.description.body
      : '';
  }

  function getDescriptionFormat(node) {
    return node && node.description && typeof node.description.format === 'string'
      ? node.description.format
      : 'plain/text';
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

  function setLabelAlignIcons(align) {
    var value = normalizeTextAlign(align || 'center');
    document.querySelectorAll('#edit-contents-page-marker i.font_text-anchor').forEach(function (el) {
      el.classList.remove('checked');
      if ((value === 'left' && el.classList.contains('start')) ||
        (value === 'center' && el.classList.contains('middle')) ||
        (value === 'right' && el.classList.contains('end'))) {
        el.classList.add('checked');
      }
    });
  }

  function getLabelAlignFromIcons() {
    var checked = document.querySelector('#edit-contents-page-marker i.font_text-anchor.checked');
    if (!checked) {
      return 'center';
    }
    if (checked.classList.contains('start')) {
      return 'left';
    }
    if (checked.classList.contains('end')) {
      return 'right';
    }
    return 'center';
  }


  function getLabelStyle(point) {
    return point && point.style && point.style.label && 'object' === typeof point.style.label
      ? point.style.label
      : {};
  }

  function getLabelStyleNumber(point, key, fallback) {
    var style = getLabelStyle(point);
    var offset = style.offset || {};
    var value;
    if ('offset.x' === key) {
      value = Number(offset.x);
    }
    else if ('offset.y' === key) {
      value = Number(offset.y);
    }
    else {
      value = Number(style[key]);
    }
    return Number.isFinite(value) ? value : fallback;
  }

  function getDefaultLabelStyle() {
    return (common && common.defaultStyle && common.defaultStyle.label) || {};
  }

  function getDefaultLabelWidth(point) {
    var labelStyle = getDefaultLabelStyle();
    var width = Number(labelStyle.width);
    if (Number.isFinite(width) && width > 0) {
      return width;
    }
    return point && point.size && Number(point.size.width) > 0 ? Number(point.size.width) : 120;
  }

  function getDefaultLabelLines() {
    var lines = Number(getDefaultLabelStyle().lines);
    return Number.isFinite(lines) && lines > 0 ? Math.floor(lines) : 1;
  }

  function getDefaultLabelOffsetX() {
    var offset = getDefaultLabelStyle().offset || {};
    var x = Number(offset.x);
    return Number.isFinite(x) ? x : 0;
  }

  function getDefaultLabelOffsetY() {
    var offset = getDefaultLabelStyle().offset || {};
    var y = Number(offset.y);
    return Number.isFinite(y) ? y : 0;
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

  function getPageMarkerDocumentNode(point) {
    var documentRef = point && point.documentRef;
    if (!documentRef && currentGroup) {
      documentRef = currentGroup.documentRef || currentGroup.contentRef || currentGroup.sourceRef;
    }
    return model && typeof model.findNodeById === 'function'
      ? model.findNodeById(documentRef)
      : null;
  }

  function isHtmlContentTarget(point) {
    var documentNode;
    var hrefText;
    var hashIndex;
    var hashText;

    if (!point) {
      return false;
    }

    // The source content type decides the PageMarker editor type.
    // PDF / Office / uploaded documents are document PageMarkers, even if
    // obsolete anchorHref / href fields remain in the data.
    documentNode = getPageMarkerDocumentNode(point);
    if (documentNode && wuwei.contents &&
      typeof wuwei.contents.isHtmlResourceNode === 'function') {
      return !!wuwei.contents.isHtmlResourceNode(documentNode);
    }

    return !!(point.anchorHref || point.htmlAnchorHref);
  }

  function setRowVisible(id, visible) {
    var row = $(id);
    if (row) {
      row.style.display = visible ? '' : 'none';
    }
  }

  function isFullHref(value) {
    return /^(https?:|blob:|data:|\/)/i.test(String(value || '').trim());
  }

  function getPageMarkerDocumentHref(point) {
    var documentNode = getPageMarkerDocumentNode(point);
    if (!documentNode || !wuwei.util) {
      return '';
    }
    if (wuwei.contents && typeof wuwei.contents.isHtmlResourceNode === 'function' &&
      wuwei.contents.isHtmlResourceNode(documentNode)) {
      if (typeof wuwei.util.getResourceOriginalUri === 'function') {
        return wuwei.util.getResourceOriginalUri(documentNode) || '';
      }
      if (typeof wuwei.util.getResourceUri === 'function') {
        return wuwei.util.getResourceUri(documentNode) || '';
      }
    }
    if (typeof wuwei.util.getResourcePreviewUri === 'function') {
      return wuwei.util.getResourcePreviewUri(documentNode) || '';
    }
    if (typeof wuwei.util.getResourceOriginalUri === 'function') {
      return wuwei.util.getResourceOriginalUri(documentNode) || '';
    }
    if (typeof wuwei.util.getResourceUri === 'function') {
      return wuwei.util.getResourceUri(documentNode) || '';
    }
    return '';
  }

  function updateTargetHrefAnchor(point, anchorHref, rawHref) {
    if (!point) { return; }
    point.anchorHref = normalizeAnchorHref(anchorHref || rawHref || point.anchorHref || '');
    point.htmlAnchorHref = point.anchorHref;
  }

  function alignForContentTarget(point, font) {
    font = font || {};
    return normalizeTextAlign(font.align || 'center');
  }

  function normalizeFontSizeValue(value) {
    if (value == null || value === '' || Number(value) === 14) {
      return '12pt';
    }
    if ('number' === typeof value || /^\d+(\.\d+)?$/.test(String(value))) {
      return String(value) + 'pt';
    }
    return String(value);
  }

  function toPositiveInteger(value, defaultValue) {
    var n = Math.floor(Number(value));
    if (!Number.isFinite(n) || n < 1) {
      return Math.max(1, Math.floor(Number(defaultValue || 1)));
    }
    return n;
  }


  function normalizeNodeShape(value, fallback) {
    var shape = String(value || fallback || '').toUpperCase();
    var allowed = (common && Array.isArray(common.shapes) ? common.shapes : []).some(function (item) {
      return item && item.value === shape && shape !== 'THUMBNAIL';
    });
    return allowed ? shape : (fallback || 'RECTANGLE');
  }

  function getDefaultRepresentativeSize() {
    var defaults = common.defaultSize || {};
    return {
      radius: Math.max(1, Number(defaults.radius || 20)),
      width: Math.max(1, Number(defaults.width || 120)),
      height: Math.max(1, Number(defaults.height || 32))
    };
  }

  function getDefaultPageMarkerSize() {
    return { radius: 18, width: 36, height: 36 };
  }

  function positiveNumber(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  function normalizeShapeSize(shape, size, defaults) {
    var out = {};
    var width;
    var height;
    var radius;

    size = (size && 'object' === typeof size) ? size : {};
    defaults = defaults || getDefaultRepresentativeSize();

    if ('CIRCLE' === shape) {
      radius = positiveNumber(size.radius, null);
      if (!radius) {
        width = positiveNumber(size.width, defaults.width);
        height = positiveNumber(size.height, defaults.height);
        radius = Math.max(1, Math.round(Math.sqrt((width * height) / Math.PI)));
      }
      out.radius = radius;
      return out;
    }

    radius = positiveNumber(size.radius, null);
    out.width = positiveNumber(size.width, radius ? radius * 2 : defaults.width);
    out.height = positiveNumber(size.height, radius ? radius * 2 : defaults.height);
    return out;
  }

  function setShapeSizeRowVisibility(prefix, shape) {
    var radiusRow = $(prefix + 'SizeRadiusRow');
    var widthHeightRow = $(prefix + 'SizeWidthHeightRow');
    if (radiusRow) {
      radiusRow.style.display = ('CIRCLE' === shape) ? '' : 'none';
    }
    if (widthHeightRow) {
      widthHeightRow.style.display = ('CIRCLE' === shape) ? 'none' : '';
    }
  }

  function setShapeSizeControls(prefix, shape, size, defaults) {
    var shapeEl = $(prefix + 'Shape');
    var radiusEl = $(prefix + 'SizeRadius');
    var widthEl = $(prefix + 'SizeWidth');
    var heightEl = $(prefix + 'SizeHeight');
    var normalized;

    shape = normalizeNodeShape(shape, 'editContentsPageMarker' === prefix ? 'CIRCLE' : 'RECTANGLE');
    normalized = normalizeShapeSize(shape, size, defaults);

    if (shapeEl) {
      shapeEl.value = shape;
    }
    setShapeSizeRowVisibility(prefix, shape);
    if (radiusEl) {
      radiusEl.value = normalized.radius || '';
    }
    if (widthEl) {
      widthEl.value = normalized.width || '';
    }
    if (heightEl) {
      heightEl.value = normalized.height || '';
    }
  }

  function readShapeSizeControls(prefix, shape, currentSize, defaults) {
    var radiusEl = $(prefix + 'SizeRadius');
    var widthEl = $(prefix + 'SizeWidth');
    var heightEl = $(prefix + 'SizeHeight');
    var raw = {};

    shape = normalizeNodeShape(shape, 'editContentsPageMarker' === prefix ? 'CIRCLE' : 'RECTANGLE');
    if ('CIRCLE' === shape) {
      raw.radius = radiusEl ? Number(radiusEl.value) : undefined;
    }
    else {
      raw.width = widthEl ? Number(widthEl.value) : undefined;
      raw.height = heightEl ? Number(heightEl.value) : undefined;
    }
    return normalizeShapeSize(shape, raw, defaults || normalizeShapeSize(shape, currentSize, defaults));
  }

  function updateShapeControlsFromSelection(prefix, node, defaults, fallbackShape) {
    var shapeEl = $(prefix + 'Shape');
    var shape;
    if (!shapeEl) {
      return;
    }
    shape = normalizeNodeShape(shapeEl.value, fallbackShape);
    setShapeSizeControls(prefix, shape, node && node.size, defaults);
  }

  function applyShapeSizeFromControls(node, prefix, defaults, fallbackShape) {
    var shapeEl = $(prefix + 'Shape');
    var shape;
    if (!node || !shapeEl) {
      return;
    }
    shape = normalizeNodeShape(shapeEl.value, fallbackShape);
    node.shape = shape;
    node.size = readShapeSizeControls(prefix, shape, node.size, defaults);
  }

  function defaultPageMarkerLabel(pageNumber) {
    return String(Math.max(1, Math.floor(Number(pageNumber || 1))));
  }

  function isAutoPageMarkerLabel(label, pageNumber) {
    var value = String(label || '').trim();
    var pageLabel = defaultPageMarkerLabel(pageNumber);
    return !value || value === pageLabel;
  }

  function getPageNumberRange(group) {
    if (wuwei.contents && typeof wuwei.contents.getPageMarkerPageNumberRange === 'function') {
      return wuwei.contents.getPageMarkerPageNumberRange(group);
    }
    return { hasPageCount: false, min: 1, max: null, pageOffset: 0, pageCount: 0 };
  }
  function clampPageNumberForEdit(value, group) {
    if (wuwei.contents && typeof wuwei.contents.clampPageMarkerPageNumber === 'function') {
      return wuwei.contents.clampPageMarkerPageNumber(group, value);
    }
    return Math.max(1, Math.floor(Number(value || 1)));
  }

  function warnPageNumberCorrected(inputValue, correctedValue, group) {
    var range = getPageNumberRange(group);
    var inputNumber = Math.floor(Number(inputValue || 1));
    var message;

    if (!range.hasPageCount || inputNumber === correctedValue) {
      return;
    }
    if (inputNumber < range.min) {
      message = wuwei.nls.translate('Page number is below the valid range.') + '\n' +
        wuwei.nls.translate('Corrected to minimum page number') + ': ' + correctedValue;
    }
    else if (inputNumber > range.max) {
      message = wuwei.nls.translate('Page number is above the valid range.') + '\n' +
        wuwei.nls.translate('Corrected to maximum page number') + ': ' + correctedValue;
    }
    if (message) {
      window.alert(message);
    }
  }

  function getGroupRepresentativeNode(group) {
    var node;
    if (!group || !wuwei.model || typeof wuwei.model.findNodeById !== 'function') {
      return null;
    }
    node = group.representativeNodeId ? wuwei.model.findNodeById(group.representativeNodeId) : null;
    if (!node && typeof wuwei.model.ensureGroupRepresentativeTopic === 'function') {
      node = wuwei.model.ensureGroupRepresentativeTopic(group, {
        topicKind: 'contents-representative',
        label: group.name || group.label || 'Contents'
      });
    }
    return node || null;
  }

  function getContentsAxisLabel(group) {
    var representative = getGroupRepresentativeNode(group);
    return (representative && representative.label) || group.label || group.name || 'Contents';
  }

  function configureAxis(group) {
    var representative = getGroupRepresentativeNode(group);

    $('editContentsAxisId').value = group.id || '';
    if ($('editContentsAxisLabel')) {
      $('editContentsAxisLabel').value = getContentsAxisLabel(group);
    }
    setShapeSizeControls(
      'editContentsRep',
      representative && representative.shape || 'RECTANGLE',
      representative && representative.size,
      getDefaultRepresentativeSize()
    );
    $('editContentsAxisDirection').value = group.orientation || 'horizontal';
    $('editContentsAxisLength').value = Number(group.length || 480);
    if ($('editContentsPageOffset')) {
      $('editContentsPageOffset').value = Number(
        wuwei.contents && typeof wuwei.contents.getPageNumberOffset === 'function'
          ? wuwei.contents.getPageNumberOffset(group)
          : 0
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
    var font = style.font || {};

    var htmlMarker = isHtmlContentTarget(point);
    var anchorHref = htmlMarker ? normalizeAnchorHref(point.anchorHref || point.htmlAnchorHref || '') : '';
    $('editContentsPageMarkerId').value = point.id || '';
    $('label').value = point.label || '';
    if ($('description_format')) {
      $('description_format').value = getDescriptionFormat(point);
    }
    $('description_body').value = getDescriptionBody(point);
    if ($('pageNumber')) {
      $('pageNumber').value = toPositiveInteger(point.pageNumber, 1);
    }
    if ($('htmlAnchorHref')) {
      $('htmlAnchorHref').value = anchorHref;
    }
    setRowVisible('documentPageMarkerFields', !htmlMarker);
    setRowVisible('htmlPageMarkerFields', htmlMarker);
    setShapeSizeControls('editContentsPageMarker', point.shape || 'CIRCLE', point.size, getDefaultPageMarkerSize());
    $('style_fill').value = toHexColor(style.fill || '#ffffff', '#ffffff');
    $('style_line_width').value = Number(
      Number.isFinite(Number(line.width)) ? line.width : 1
    );
    $('style_line_color').value = toHexColor(line.color || '#4c6b8a', '#4c6b8a');
    $('style_font_color').value = toHexColor(font.color || '#303030', '#303030');
    $('style_font_size').value = normalizeFontSizeValue(font.size || '12pt');
    var align = alignForContentTarget(point, font);
    if ($('style_font_align')) {
      $('style_font_align').value = align;
    }
    setLabelAlignIcons(align);
    if ($('style_label_width')) {
      $('style_label_width').value = getLabelStyleNumber(point, 'width', getDefaultLabelWidth(point));
    }
    if ($('style_label_lines')) {
      $('style_label_lines').value = getLabelStyleNumber(point, 'lines', getDefaultLabelLines());
    }
    if ($('style_label_offset_x')) {
      $('style_label_offset_x').value = getLabelStyleNumber(point, 'offset.x', getDefaultLabelOffsetX());
    }
    if ($('style_label_offset_y')) {
      $('style_label_offset_y').value = getLabelStyleNumber(point, 'offset.y', getDefaultLabelOffsetY());
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
    var axisProps;
    var labelEl;

    if (!currentGroup || !wuwei.contents || typeof wuwei.contents.updateAxisGroup !== 'function') {
      return false;
    }

    axisProps = {
      orientation: $('editContentsAxisDirection').value,
      length: Number($('editContentsAxisLength').value || currentGroup.length || 480),
      pageOffset: $('editContentsPageOffset') ? Number($('editContentsPageOffset').value || 0) : undefined,
      strokeWidth: Number($('editContentsAxisStrokeWidth').value || 4),
      strokeColor: $('editContentsAxisStrokeColor').value || '#4c6b8a',
      representativeShape: $('editContentsRepShape') ? $('editContentsRepShape').value : undefined,
      representativeSize: $('editContentsRepShape')
        ? readShapeSizeControls(
          'editContentsRep',
          $('editContentsRepShape').value,
          getGroupRepresentativeNode(currentGroup) && getGroupRepresentativeNode(currentGroup).size,
          getDefaultRepresentativeSize()
        )
        : undefined
    };
    labelEl = $('editContentsAxisLabel');
    if (labelEl) {
      axisProps.label = labelEl.value;
    }

    wuwei.contents.updateAxisGroup(currentGroup, axisProps);
    return true;
  }

  function isCurrentHtmlPageMarker() {
    return isHtmlContentTarget(currentPoint);
  }

  function saveHtmlAnchorHref() {
    var anchorHrefEl = $('htmlAnchorHref');
    var anchorHref;
    var rawHref;

    if (!currentPoint || !isCurrentHtmlPageMarker()) {
      return false;
    }
    if (!anchorHrefEl) {
      return false;
    }
    rawHref = anchorHrefEl.value || '';
    anchorHref = normalizeAnchorHref(rawHref);
    if (!anchorHref) {
      window.alert(wuwei.nls.translate('HTML PageMarker must specify anchorHref starting with #.'));
      return false;
    }
    currentPoint.anchorHref = anchorHref;
    currentPoint.htmlAnchorHref = anchorHref;
    updateTargetHrefAnchor(currentPoint, anchorHref, rawHref);
    anchorHrefEl.value = anchorHref;
    currentPoint.changed = true;
    if (wuwei.contents && typeof wuwei.contents.updateEntryFromNode === 'function') {
      wuwei.contents.updateEntryFromNode(currentPoint);
    }
    else if (wuwei.draw && typeof wuwei.draw.refresh === 'function') {
      wuwei.draw.refresh();
    }
    return true;
  }

  function saveDocumentPageNumber() {
    var pageNumberEl = $('pageNumber');
    var oldLabel;
    var oldPageNumber;
    var labelValue;
    var labelWasUnchanged;
    var labelWasAutomatic;
    var newPageNumber;

    if (!currentPoint || isCurrentHtmlPageMarker()) {
      return false;
    }
    if (!pageNumberEl || !String(pageNumberEl.value || '').trim()) {
      return false;
    }
    oldLabel = currentPoint.label || '';
    oldPageNumber = Math.max(1, Math.floor(Number(currentPoint.pageNumber || 1)));
    labelValue = $('label') ? ($('label').value || '') : '';
    labelWasUnchanged = labelValue === oldLabel;
    labelWasAutomatic = isAutoPageMarkerLabel(oldLabel, oldPageNumber);
    delete currentPoint.anchorHref;
    delete currentPoint.htmlAnchorHref;
    newPageNumber = clampPageNumberForEdit(
      pageNumberEl.value || currentPoint.pageNumber || 1,
      currentGroup
    );
    warnPageNumberCorrected(pageNumberEl.value, newPageNumber, currentGroup);
    currentPoint.pageNumber = newPageNumber;
    pageNumberEl.value = String(newPageNumber);
    if (!String(labelValue || '').trim()) {
      currentPoint.label = defaultPageMarkerLabel(newPageNumber);
      if ($('label')) {
        $('label').value = currentPoint.label;
      }
    }
    else if (labelWasAutomatic && labelWasUnchanged && newPageNumber !== oldPageNumber) {
      currentPoint.label = defaultPageMarkerLabel(newPageNumber);
      if ($('label')) {
        $('label').value = currentPoint.label;
      }
    }
    currentPoint.changed = true;
    return true;
  }

  function saveContentTarget(changedElement) {
    var labelValue;
    var align;

    if (!currentPoint) {
      return false;
    }
    if (!$('label') || !$('description_body') ||
      !$('style_fill') || !$('style_line_color') || !$('style_line_width') ||
      !$('style_font_color') || !$('style_font_size')) {
      return false;
    }

    align = $('style_font_align')
      ? normalizeTextAlign($('style_font_align').value)
      : getLabelAlignFromIcons();
    labelValue = $('label').value || '';
    currentPoint.description = {
      format: $('description_format') ? ($('description_format').value || 'plain/text') : 'plain/text',
      body: $('description_body').value || ''
    };
    if (!String(labelValue || '').trim() && !isCurrentHtmlPageMarker()) {
      currentPoint.label = defaultPageMarkerLabel(currentPoint.pageNumber || 1);
      $('label').value = currentPoint.label;
    }
    else {
      currentPoint.label = labelValue;
    }
    applyShapeSizeFromControls(currentPoint, 'editContentsPageMarker', getDefaultPageMarkerSize(), 'CIRCLE');
    currentPoint.style = currentPoint.style || {};
    currentPoint.style.fill = $('style_fill').value || '#ffffff';
    currentPoint.style.font = clonePlain(currentPoint.style.font || currentPoint.font || {});
    currentPoint.style.font.color = $('style_font_color').value || '#303030';
    currentPoint.style.font.size = $('style_font_size').value || currentPoint.style.font.size || '12pt';
    currentPoint.style.font.align = align;
    currentPoint.style.label = currentPoint.style.label || {};
    if ($('style_label_width') && String($('style_label_width').value || '').trim()) {
      currentPoint.style.label.width = Math.max(1, Number($('style_label_width').value || 1));
    }
    else {
      delete currentPoint.style.label.width;
    }
    if ($('style_label_lines') && String($('style_label_lines').value || '').trim()) {
      currentPoint.style.label.lines = Math.max(1, Math.floor(Number($('style_label_lines').value || getDefaultLabelLines())));
    }
    else {
      currentPoint.style.label.lines = getDefaultLabelLines();
    }
    currentPoint.style.label.offset = currentPoint.style.label.offset || {};
    if ($('style_label_offset_x') && String($('style_label_offset_x').value || '').trim()) {
      currentPoint.style.label.offset.x = Number($('style_label_offset_x').value || 0);
    }
    else {
      delete currentPoint.style.label.offset.x;
    }
    if ($('style_label_offset_y') && String($('style_label_offset_y').value || '').trim()) {
      currentPoint.style.label.offset.y = Number($('style_label_offset_y').value || 0);
    }
    else {
      delete currentPoint.style.label.offset.y;
    }
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
      node.shape = sourcePoint.shape;
      node.size = clonePlain(sourcePoint.size || {});
      node.style = clonePlain(sourcePoint.style || {});
      if (node.style && node.style.fill) { node.color = node.style.fill; }
      if (node.style && node.style.line) {
        node.outline = node.style.line.color;
        node.outlineWidth = node.style.line.width;
      }
      if (node.style && node.style.font) { node.font = clonePlain(node.style.font); }
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
