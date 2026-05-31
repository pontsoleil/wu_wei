/**
 * edit.timeline.js
 * timeline editor controller
 *
 * Timeline edit modes:
 * - axis-properties
 * - axis-add-segment
 * - segment-properties
 * - segment-player
 *
 * Preview support:
 * - uploaded/local mp4/webm/mov -> HTML5 <video>
 * - YouTube -> IFrame Player API
 * - Vimeo -> Vimeo Player SDK
 * 
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.edit = wuwei.edit || {};
wuwei.edit.timeline = wuwei.edit.timeline || {};

(function (ns) {
  'use strict';

  var common = wuwei.common;
  var state = common.state;
  var model = wuwei.model;
  var menu = wuwei.menu;
  var info = wuwei.info;
  var util = wuwei.util;
  var timeline = wuwei.timeline;
  var applyToTimelineGroup = false;

  var currentTarget = null;
  var currentGroup = null;
  var currentMode = '';

  var bound = false;
  var previewSeq = 0;
  var previewState = {
    provider: '',
    html5Player: null,
    youtubePlayer: null,
    vimeoPlayer: null,
    youtubeReadyPromise: null,
    vimeoReadyPromise: null,
    timeWatchTimer: null,
    hostId: ''
  };

  function $(id) {
    return document.getElementById(id);
  }

  function pointField(id) {
    var root = $('edit-timeline-point');
    if (root && id) {
      return root.querySelector('[id="' + String(id).replace(/"/g, '\\"') + '"]');
    }
    return $(id);
  }

  function toNumber(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) ? n : (fallback || 0);
  }

  function clampSeconds(value) {
    var n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
      return 0;
    }
    return n;
  }

  function formatClockTime(value) {
    var seconds = Math.floor(clampSeconds(value));
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var s = seconds % 60;

    function pad2(n) {
      return String(n).padStart(2, '0');
    }

    return h < 1
      ? (pad2(m) + ':' + pad2(s))
      : (pad2(h) + ':' + pad2(m) + ':' + pad2(s));
  }

  function parseClockText(text) {
    var s = String(text == null ? '' : text).trim();
    var parts;
    var h = 0;
    var m = 0;
    var sec = 0;

    if (!s) {
      return NaN;
    }

    parts = s.split(':');

    if (parts.length === 2) {
      m = Number(parts[0]);
      sec = Number(parts[1]);
      if (!Number.isFinite(m) || !Number.isFinite(sec) || m < 0 || sec < 0 || sec >= 60) {
        return NaN;
      }
      return m * 60 + sec;
    }

    if (parts.length === 3) {
      h = Number(parts[0]);
      m = Number(parts[1]);
      sec = Number(parts[2]);
      if (!Number.isFinite(h) || !Number.isFinite(m) || !Number.isFinite(sec) ||
        h < 0 || m < 0 || sec < 0 || m >= 60 || sec >= 60) {
        return NaN;
      }
      return h * 3600 + m * 60 + sec;
    }

    return NaN;
  }

  function setInputValue(id, value) {
    var el = $(id);
    if (el) {
      el.value = value;
    }
  }

  function toHexColor(value, fallback) {
    var s = String(value || '').trim();
    var m, r, g, b;

    if (!s) {
      return fallback || '#888888';
    }
    if (/^#[0-9a-f]{6}$/i.test(s)) {
      return s;
    }
    if (/^#[0-9a-f]{3}$/i.test(s)) {
      return '#' + s.charAt(1) + s.charAt(1) + s.charAt(2) + s.charAt(2) + s.charAt(3) + s.charAt(3);
    }
    m = s.match(/^rgb\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
    if (m) {
      r = Math.max(0, Math.min(255, Number(m[1])));
      g = Math.max(0, Math.min(255, Number(m[2])));
      b = Math.max(0, Math.min(255, Number(m[3])));
      return '#' +
        r.toString(16).padStart(2, '0') +
        g.toString(16).padStart(2, '0') +
        b.toString(16).padStart(2, '0');
    }
    return fallback || '#888888';
  }

  function initColorPalettePicker() {
    if (!wuwei.edit.style || !wuwei.edit.style.markup ||
      typeof wuwei.edit.style.markup.initPalette !== 'function') {
      return;
    }

    wuwei.edit.style.markup.initPalette('editTimelineAxisStrokeColorPalette', 'editTimelineAxisStrokeColor');
    wuwei.edit.style.markup.initPaletteWithResolver('editTimelinePointColorPalette', function () {
      return pointField('style_fill');
    });
    wuwei.edit.style.markup.initPaletteWithResolver('editTimelinePointFontColorPalette', function () {
      return pointField('style_font_color');
    });
    wuwei.edit.style.markup.initPaletteWithResolver('editTimelinePointOutlineColorPalette', function () {
      return pointField('style_line_color');
    });
  }

  function applyPointStyle(point) {
    if (!point) {
      return;
    }
    point.color = toHexColor(
      pointField('style_fill') ? pointField('style_fill').value : point.color,
      point.color || '#ffffff'
    );
    point.font = point.font || {};
    point.font.color = toHexColor(
      pointField('style_font_color') ? pointField('style_font_color').value : point.font.color,
      point.font.color || '#303030'
    );
    point.style = point.style || {};
    point.style.line = point.style.line || {};
    point.style.line.kind = (pointField('style_line_kind') && pointField('style_line_kind').value) ||
      point.style.line.kind || 'SOLID';
    point.style.line.color = toHexColor(
      pointField('style_line_color') ? pointField('style_line_color').value : (point.style.line.color || point.outline),
      point.style.line.color || point.outline || '#666666'
    );
    point.style.line.width = Math.max(0, Number(
      pointField('style_line_width') ? pointField('style_line_width').value : point.style.line.width
    ) || 0);
    expandNodeRuntimeStyle(point);
    point.changed = true;
  }

  function clonePlain(value) {
    return value && typeof value === 'object'
      ? JSON.parse(JSON.stringify(value))
      : value;
  }

  function expandNodeRuntimeStyle(node) {
    if (wuwei && wuwei.style &&
        typeof wuwei.style.expandNodeRuntimeStyle === 'function') {
      wuwei.style.expandNodeRuntimeStyle(node);
    }
    else if (wuwei && wuwei.note && wuwei.note.v2 &&
        typeof wuwei.note.v2.expandNodeRuntimeStyle === 'function') {
      wuwei.note.v2.expandNodeRuntimeStyle(node);
    }
  }

  function applyPointStyleToGroup(sourcePoint) {
    var group = currentGroup;
    var members;
    if (!sourcePoint || !applyToTimelineGroup || !group) {
      return;
    }
    members = (group.members || []).map(function (member) {
      return member && member.nodeId && model && typeof model.findNodeById === 'function'
        ? model.findNodeById(member.nodeId)
        : null;
    }).filter(function (node) {
      return node && node.type === 'Segment' && node.groupRef === group.id;
    });
    members.forEach(function (node) {
      if (node.id === sourcePoint.id) {
        return;
      }
      node.style = clonePlain(sourcePoint.style || {});
      if (!node.style.fill && sourcePoint.color) { node.style.fill = sourcePoint.color; }
      node.style.line = node.style.line || {};
      node.style.line.color = node.style.line.color ||
        (sourcePoint.style && sourcePoint.style.line && sourcePoint.style.line.color) ||
        sourcePoint.outline;
      node.style.line.width = node.style.line.width ||
        (sourcePoint.style && sourcePoint.style.line && sourcePoint.style.line.width) ||
        sourcePoint.outlineWidth || 1;
      expandNodeRuntimeStyle(node);
      node.changed = true;
    });
    if (wuwei.draw && typeof wuwei.draw.refresh === 'function') {
      wuwei.draw.refresh();
    }
  }

  function getInputSeconds(hiddenId, fallback) {
    var el = $(hiddenId);
    return toNumber(el ? el.value : null, fallback || 0);
  }

  function setTimeText(id, seconds) {
    setInputValue(id, formatClockTime(clampSeconds(seconds)));
  }

  function refreshPointFields() {
    var mediaStart = getInputSeconds('editTimelinePointMediaStart', 0);
    var mediaEnd = getInputSeconds('editTimelinePointMediaEnd', mediaStart);
    var duration;

    if (mediaEnd < mediaStart) {
      mediaEnd = mediaStart;
      setInputValue('editTimelinePointMediaEnd', String(mediaEnd));
    }

    duration = Math.max(0, mediaEnd - mediaStart);
    setInputValue('editTimelinePointDuration', String(duration));

    setTimeText('editTimelinePointMediaStartText', mediaStart);
    setTimeText('editTimelinePointMediaEndText', mediaEnd);
    setTimeText('editTimelinePointDurationText', duration);
  }

  function applyPointStartSeconds(seconds) {
    var mediaStart = clampSeconds(seconds);
    var mediaEnd = getInputSeconds('editTimelinePointMediaEnd', mediaStart);

    if (currentTarget && currentTarget.axisRole === 'end') {
      mediaStart = Math.min(mediaStart, mediaEnd);
    }
    else if (mediaEnd < mediaStart) {
      mediaEnd = mediaStart;
    }

    setInputValue('editTimelinePointMediaStart', String(mediaStart));
    setInputValue('editTimelinePointMediaEnd', String(mediaEnd));
    setInputValue('editTimelinePointDuration', String(mediaEnd - mediaStart));
    refreshPointFields();
  }

  function applyPointEndSeconds(seconds) {
    var mediaStart = getInputSeconds('editTimelinePointMediaStart', 0);
    var mediaEnd = clampSeconds(seconds);

    if (mediaEnd < mediaStart) {
      mediaStart = mediaEnd;
    }

    setInputValue('editTimelinePointMediaStart', String(mediaStart));
    setInputValue('editTimelinePointMediaEnd', String(mediaEnd));
    setInputValue('editTimelinePointDuration', String(mediaEnd - mediaStart));
    refreshPointFields();
  }

  function applyPointDurationSeconds(seconds) {
    var mediaStart = getInputSeconds('editTimelinePointMediaStart', 0);
    var duration = clampSeconds(seconds);
    var mediaEnd = mediaStart + duration;

    setInputValue('editTimelinePointDuration', String(duration));
    setInputValue('editTimelinePointMediaEnd', String(mediaEnd));
    refreshPointFields();
  }

  function onPointStartTextChanged() {
    var sec = parseClockText($('editTimelinePointMediaStartText') ? $('editTimelinePointMediaStartText').value : '');
    if (!Number.isFinite(sec)) {
      refreshPointFields();
      return;
    }
    applyPointStartSeconds(sec);
  }

  function onPointEndTextChanged() {
    var sec = parseClockText($('editTimelinePointMediaEndText') ? $('editTimelinePointMediaEndText').value : '');
    if (!Number.isFinite(sec)) {
      refreshPointFields();
      return;
    }
    applyPointEndSeconds(sec);
  }

  function onPointDurationTextChanged() {
    var sec = parseClockText($('editTimelinePointDurationText') ? $('editTimelinePointDurationText').value : '');
    if (!Number.isFinite(sec)) {
      refreshPointFields();
      return;
    }
    applyPointDurationSeconds(sec);
  }

  function capturePreviewTime(targetField) {
    return getPreviewCurrentTime().then(function (now) {
      now = toNumber(now, 0);

      if (targetField === 'start') {
        applyPointStartSeconds(now);
      }
      else if (targetField === 'end') {
        applyPointEndSeconds(now);
      }

      return now;
    });
  }

  function getDescriptionBody(point) {
    if (point && point.description && typeof point.description === 'object') {
      return point.description.body || '';
    }
    return '';
  }

  function getDescriptionFormat(point) {
    if (point && point.description && typeof point.description === 'object' &&
      typeof point.description.format === 'string') {
      return point.description.format;
    }
    return 'plain/text';
  }

  function buildDescription(body, format) {
    return {
      format: format || 'plain/text',
      body: body || ''
    };
  }

  function setPointMediaDurationDisplay(group) {
    var el = $('editTimelinePointMediaDurationText');
    var mediaNode = getMediaNodeForGroup(group);
    var duration = mediaNode && wuwei.video && typeof wuwei.video.getDuration === 'function'
      ? wuwei.video.getDuration(mediaNode)
      : 0;

    function setValue(value) {
      if (el) {
        el.value = formatClockTime(value || 0);
      }
    }

    setValue(duration);
    if ((!duration || duration <= 0) && timeline &&
        typeof timeline.resolveMediaDuration === 'function' && mediaNode) {
      timeline.resolveMediaDuration(mediaNode).then(function (resolved) {
        if (Number.isFinite(Number(resolved)) && Number(resolved) > 0) {
          setValue(Number(resolved));
        }
      }).catch(function () { });
    }
  }

  function configurePointPanel(point, group, mode) {
    var isEndpoint = point && (point.axisRole === 'start' || point.axisRole === 'end');
    var mediaStart = Number(point.mediaStart != null ? point.mediaStart : 0);
    var duration = Number(point.playDuration != null ? point.playDuration : (group.defaultPlayDuration || 15));
    var mediaEnd = Number(point.mediaEnd != null ? point.mediaEnd : (mediaStart + duration));

    $('editTimelinePointId').value = point.id || '';
    setInputValue('editTimelinePointMediaStart', String(mediaStart));
    setInputValue('editTimelinePointMediaEnd', String(mediaEnd));
    setInputValue('editTimelinePointDuration', String(duration));
    $('editTimelinePointName').value = point.label ||
      (menu.timeline && typeof menu.timeline.formatTime === 'function'
        ? menu.timeline.formatTime(point.mediaStart || 0)
        : '');
    if (pointField('description_format')) {
      pointField('description_format').value = getDescriptionFormat(point);
    }
    if (pointField('description_body')) {
      pointField('description_body').value = getDescriptionBody(point);
    }
    if (pointField('style_fill')) {
      pointField('style_fill').value = toHexColor(point.color || '#ffffff', '#ffffff');
    }
    if (pointField('style_font_color')) {
      pointField('style_font_color').value = toHexColor(
        point.font && point.font.color ? point.font.color : '#303030',
        '#303030'
      );
    }
    if (pointField('style_line_color')) {
      pointField('style_line_color').value = toHexColor(
        (point.style && point.style.line && point.style.line.color) || point.outline || '#666666',
        '#666666'
      );
    }
    if (pointField('style_line_kind')) {
      pointField('style_line_kind').value =
        (point.style && point.style.line && point.style.line.kind) || 'SOLID';
    }
    if (pointField('style_line_width')) {
      pointField('style_line_width').value = Number(
        (point.style && point.style.line && point.style.line.width) || point.outlineWidth || 1
      );
    }
    if ($('applyToTimelineGroup')) {
      $('applyToTimelineGroup').checked = !!applyToTimelineGroup;
    }

    $('edit-timeline-axis').style.display = 'none';
    $('edit-timeline-point').style.display = '';

    setFieldVisible('editTimelinePointMediaStartText', true);
    setFieldVisible('editTimelinePointMediaEndText', true);
    setFieldVisible('editTimelinePointDurationText', true);
    setDeleteVisible(!isEndpoint && mode !== 'axis-add-segment');

    setFieldDisabled('editTimelinePointMediaStartText', point && point.axisRole === 'start');
    setFieldDisabled('editTimelinePointMediaEndText', point && point.axisRole === 'end');
    setFieldDisabled('editTimelinePointDurationText', isEndpoint);
    setButtonDisabled('editTimelineCaptureToStart', point && point.axisRole === 'start');
    setButtonDisabled('editTimelineCaptureToEnd', point && point.axisRole === 'end');

    var previewButtons = document.querySelector('.edit-timeline-capture-actions');
    if (previewButtons) {
      previewButtons.style.display = '';
    }
    var jumpButtons = document.querySelector('.edit-timeline-jump-actions');
    if (jumpButtons) {
      jumpButtons.style.display = '';
    }
    var previewField = $('editTimelinePreviewHost');
    if (previewField && previewField.parentElement) {
      previewField.parentElement.style.display = '';
    }

    setPointMediaDurationDisplay(group);
    refreshPointFields();

    renderPreview(group, {
      mediaStart: mediaStart,
      mediaEnd: mediaEnd,
      playDuration: duration,
      axisRole: point.axisRole || 'point'
    });
  }

  function buildPointPatch(group) {
    var mediaStart = getInputSeconds('editTimelinePointMediaStart', 0);
    var mediaEnd = getInputSeconds('editTimelinePointMediaEnd', mediaStart);
    var duration = Math.max(0, mediaEnd - mediaStart);

    return {
      mediaStart: mediaStart,
      mediaEnd: mediaEnd,
      playDuration: duration,
      label: $('editTimelinePointName').value ||
        (menu.timeline && typeof menu.timeline.formatTime === 'function'
          ? menu.timeline.formatTime(mediaStart)
          : ''),
      description: buildDescription(
        pointField('description_body') ? pointField('description_body').value || '' : '',
        pointField('description_format') ? pointField('description_format').value || 'plain/text' : 'plain/text'
      )
    };
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

  function applyTabMode(root, shapeOnly) {
    var host = root || document;
    var pane = host.querySelector ? host.querySelector('.edit-tabbed-pane') : null;
    var shapeButton;

    if (!pane) {
      return;
    }

    if (shapeOnly) {
      pane.querySelectorAll('[data-edit-tab="content"], [data-edit-tab-panel="content"]').forEach(function (el) {
        el.style.display = 'none';
      });
    }
    else {
      pane.querySelectorAll('[data-edit-tab="content"]').forEach(function (el) {
        el.style.display = '';
      });
    }

    shapeButton = pane.querySelector('[data-edit-tab="shape"]') ||
      pane.querySelector('[data-edit-tab="display"]');
    if (shapeButton) {
      shapeButton.click();
    }
  }

  function bindTimelineShellEvents(host) {
    function t(str) {
      return wuwei.nls.translate(str);
    }

    if (!host || host.dataset.timelineBound === '1') {
      return;
    }
    host.dataset.timelineBound = '1';

    host.addEventListener('click', function (ev) {
      var target = ev.target;
      if (!target) {
        return;
      }

      if (target.id === 'editTimelineAxisSave') {
        if (saveAxis()) {
          wuwei.log.storeLog({ operation: 'edit' });
        }
        ev.preventDefault();
        return;
      }

      if (target.id === 'editTimelinePointSave') {
        if (savePoint()) {
          wuwei.log.storeLog({ operation: 'edit' });
        }
        ev.preventDefault();
        return;
      }

      if (target.id === 'editTimelinePointDelete') {
        if (deletePoint()) {
          wuwei.log.storeLog({ operation: 'edit' });
        }
        ev.preventDefault();
        return;
      }

      if (target.id === 'editTimelineJumpToStart') {
        seekPreviewTo(getInputSeconds('editTimelinePointMediaStart', 0));
        ev.preventDefault();
        return;
      }

      if (target.id === 'editTimelineJumpToEnd') {
        seekPreviewTo(getInputSeconds('editTimelinePointMediaEnd', 0));
        ev.preventDefault();
        return;
      }

      if (target.id === 'editTimelineCaptureToStart') {
        if (!target.disabled) {
          capturePreviewTime('start');
        }
        ev.preventDefault();
        return;
      }

      if (target.id === 'editTimelineCaptureToEnd') {
        if (!target.disabled) {
          capturePreviewTime('end');
        }
        ev.preventDefault();
        return;
      }

      if (target.id === 'editTimelineCaptureThumbnail') {
        if (!capturePreviewThumbnailToCurrentPoint()) {
          window.alert(t('This preview cannot create a thumbnail. Please try an HTML5 video such as mp4.'));
        }
        ev.preventDefault();
        return;
      }
    });

    host.addEventListener('change', function (ev) {
      var target = ev.target;
      if (!target) {
        return;
      }

      if (target.id === 'editTimelinePointMediaStartText') {
        onPointStartTextChanged();
        return;
      }
      if (target.id === 'editTimelinePointMediaEndText') {
        onPointEndTextChanged();
        return;
      }
      if (target.id === 'editTimelinePointDurationText') {
        onPointDurationTextChanged();
        return;
      }
      if (target.id === 'applyToTimelineGroup') {
        applyToTimelineGroup = !!target.checked;
        return;
      }
    });
  }

  function getTimelineEditState() {
    return (common && common.state && common.state.timelineEdit)
      ? common.state.timelineEdit
      : null;
  }

  function getCurrentMode() {
    var s = getTimelineEditState();
    return s ? (s.mode || '') : '';
  }

  function getCurrentGroup() {
    var s = getTimelineEditState();
    if (!s || !s.groupId || !model || typeof model.findGroupById !== 'function') {
      return null;
    }
    return model.findGroupById(s.groupId);
  }

  function getCurrentTarget() {
    var s = getTimelineEditState();
    if (!s || !s.targetId) {
      return null;
    }

    if (s.pointId && model && typeof model.findNodeById === 'function') {
      return model.findNodeById(s.targetId);
    }
    if (s.groupId && model && typeof model.findGroupById === 'function') {
      return model.findGroupById(s.targetId);
    }
    return null;
  }

  function setTimelineEditState(patch) {
    common.state.timelineEdit = {
      mode: patch.mode || '',
      targetId: patch.targetId || '',
      groupId: patch.groupId || '',
      pointId: patch.pointId || ''
    };
  }

  function beginTimelineEditSession() {
    if (!state.timelineSnapshotTaken) {
      if (wuwei.log && typeof wuwei.log.savePrevious === 'function') {
        wuwei.log.savePrevious();
      }
      state.timelineSnapshotTaken = true;
    }
  }

  function openAxisProperties(group, option) {
    if (wuwei.edit && wuwei.edit.viewpoint && typeof wuwei.edit.viewpoint.close === 'function') {
      wuwei.edit.viewpoint.close();
    }
    if (!group || !isAxisGroup(group)) {
      return false;
    }
    if (!ensureEditShell()) {
      return false;
    }

    beginTimelineEditSession();

    currentTarget = group;
    currentGroup = group;
    currentMode = 'axis-properties';

    setTimelineEditState({
      mode: 'axis-properties',
      targetId: group.id,
      groupId: group.id,
      pointId: ''
    });

    configureAxisPanel(group);
    applyTabMode($('edit-timeline-axis'), option && option.shapeOnly);
    return true;
  }

  function openSegmentProperties(point, option) {
    if (wuwei.edit && wuwei.edit.viewpoint && typeof wuwei.edit.viewpoint.close === 'function') {
      wuwei.edit.viewpoint.close();
    }
    var record = resolveSegment(point);
    if (!record || !ensureEditShell()) {
      return false;
    }

    beginTimelineEditSession();

    currentTarget = record.segment;
    currentGroup = record.group;
    currentMode = 'segment-properties';

    setTimelineEditState({
      mode: 'segment-properties',
      targetId: record.segment.id,
      groupId: record.group.id,
      pointId: record.segment.id
    });

    configurePointPanel(record.segment, record.group, 'segment-properties');
    applyTabMode($('edit-timeline-point'), option && option.shapeOnly);
    return true;
  }

  function clearTimelineEditState() {
    if (common && common.state) {
      common.state.timelineEdit = null;
    }
  }

  function isAxisGroup(group) {
    return !!((menu && menu.timeline &&
      typeof menu.timeline.isAxisGroup === 'function' &&
      menu.timeline.isAxisGroup(group)));
  }

  function isTimelinePoint(node) {
    return !!(menu && menu.timeline &&
      typeof menu.timeline.isTimelinePoint === 'function' &&
      menu.timeline.isTimelinePoint(node));
  }

  function isTimelineAxisLink(link) {
    return !!(menu && menu.timeline &&
      typeof menu.timeline.isTimelineAxisLink === 'function' &&
      menu.timeline.isTimelineAxisLink(link));
  }

  function getTimelineSpec(target) {
    if (!target || !menu || !menu.timeline || typeof menu.timeline.getTimelineTargetSpec !== 'function') {
      return null;
    }
    return menu.timeline.getTimelineTargetSpec(target);
  }

  function normalizeTarget(target) {
    var spec = null;
    if (!target) {
      return null;
    }
    if (isTimelineAxisLink(target)) {
      spec = getTimelineSpec(target);
      return spec && spec.group ? spec.group : null;
    }
    return target;
  }

  function hidePanels() {
    if ($('edit-timeline-axis')) {
      $('edit-timeline-axis').style.display = 'none';
    }
    if ($('edit-timeline-point')) {
      $('edit-timeline-point').style.display = 'none';
    }
  }

  function ensureEditShell() {
    var editPane = $('edit');

    if (wuwei.edit && typeof wuwei.edit.closeInfoPaneForEdit === 'function') {
      wuwei.edit.closeInfoPaneForEdit();
    }
    var host;

    if (!editPane) {
      return null;
    }

    if (!editPane.innerHTML &&
      wuwei.edit &&
      wuwei.edit.markup &&
      typeof wuwei.edit.markup.template === 'function') {
      editPane.innerHTML = wuwei.edit.markup.template();
    }

    editPane.style.display = 'block';
    state.Editing = true;
    if (wuwei.edit && typeof wuwei.edit.showOnlyEditRoot === 'function') {
      wuwei.edit.showOnlyEditRoot('edit-timeline');
    }

    host = $('edit-timeline') || editPane;

    host.innerHTML = wuwei.edit.timeline.markup.panelsHtml();

    bindTimelineShellEvents(host);
    initTabs(host);
    initColorPalettePicker();

    return host;
  }

  function setFieldVisible(id, visible) {
    var el = $(id);
    var row = el && el.parentElement;
    if (row) {
      row.style.display = visible ? '' : 'none';
    }
  }

  function setFieldDisabled(id, disabled) {
    var el = $(id);
    if (el) {
      el.disabled = !!disabled;
      el.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    }
  }

  function setButtonDisabled(id, disabled) {
    var el = $(id);
    if (el) {
      el.disabled = !!disabled;
      el.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    }
  }

  function setDeleteVisible(visible) {
    var btn = $('editTimelinePointDelete');
    var box = btn && btn.parentElement;
    if (box) {
      box.style.display = visible ? '' : 'none';
    }
  }

  function getMediaNodeForGroup(group) {
    return timeline && typeof timeline.getMediaNodeForGroup === 'function'
      ? timeline.getMediaNodeForGroup(group)
      : (group && group.mediaRef && model && typeof model.findNodeById === 'function' ? model.findNodeById(group.mediaRef) : null);
  }

  function detectPreviewSource(node) {
    return (timeline && typeof timeline.detectMediaSource === 'function')
      ? timeline.detectMediaSource(node)
      : { provider: 'unknown', url: String(node && node.resource && (node.resource.uri || node.resource.canonicalUri) || '') };
  }

  function cleanupPreview() {
    if (wuwei.menu && wuwei.menu.timeline && typeof wuwei.menu.timeline.cleanupEmbeddedPreview === 'function') {
      wuwei.menu.timeline.cleanupEmbeddedPreview(previewState, $('editTimelinePreviewHost'));
      return;
    }
    if (previewState.timeWatchTimer) {
      clearInterval(previewState.timeWatchTimer);
      previewState.timeWatchTimer = null;
    }
  }

  function getPreviewCurrentTime() {
    if (previewState.html5Player) {
      return Promise.resolve(Number(previewState.html5Player.currentTime || 0));
    }
    if (previewState.youtubePlayer) {
      try {
        return Promise.resolve(Number(previewState.youtubePlayer.getCurrentTime() || 0));
      }
      catch (e) {
        return Promise.resolve(0);
      }
    }
    if (previewState.vimeoPlayer) {
      return previewState.vimeoPlayer.getCurrentTime().then(function (sec) {
        return Number(sec || 0);
      }).catch(function () {
        return 0;
      });
    }
    if (info && typeof info.getTimelineCurrentTime === 'function') {
      return Promise.resolve(Number(info.getTimelineCurrentTime() || 0));
    }
    if (info && info.timeline && typeof info.timeline.getTimelineCurrentTime === 'function') {
      return Promise.resolve(Number(info.timeline.getTimelineCurrentTime() || 0));
    }
    return Promise.resolve(0);
  }

  function seekPreviewTo(sec) {
    sec = Number(sec || 0);
    if (previewState.html5Player) {
      try { previewState.html5Player.currentTime = sec; } catch (e) { }
      return;
    }
    if (previewState.youtubePlayer) {
      try { previewState.youtubePlayer.seekTo(sec, true); } catch (e) { }
      return;
    }
    if (previewState.vimeoPlayer) {
      try { previewState.vimeoPlayer.setCurrentTime(sec); } catch (e) { }
    }
  }

  function renderUnknownPreview(host, mediaNode) {
    function t(str) {
      return wuwei.nls.translate(str);
    }

    var resource = (mediaNode && mediaNode.resource) || {};
    var resourceUri = resource.uri || resource.canonicalUri || '';
    host.innerHTML = '<div class="edit-timeline-preview-slot edit-timeline-preview-note">' +
      t('This video format is not supported in embedded preview.') + '<br>' +
      (resourceUri
        ? '<a href="' + String(resourceUri).replace(/"/g, '&quot;') + '" target="_blank" rel="noopener">' + t('Open source video') + '</a>'
        : '') +
      '</div>';
  }

  function renderHtml5Preview(host, source, startAt, endAt) {
    wuwei.menu.timeline.renderHtml5EmbeddedPreview(host, source, startAt, endAt, previewState);
  }

  function renderYouTubePreview(host, source, startAt, endAt) {
    wuwei.menu.timeline.renderYouTubeEmbeddedPreview(host, source, startAt, endAt, previewState).catch(function () {
      renderUnknownPreview(host, { resource: { uri: source && source.url } });
    });
  }

  function renderVimeoPreview(host, source, startAt, endAt) {
    wuwei.menu.timeline.renderVimeoEmbeddedPreview(host, source, startAt, endAt, previewState).catch(function () {
      renderUnknownPreview(host, { resource: { uri: source && source.url } });
    });
  }

  function renderPreview(group, point) {
    var host = $('editTimelinePreviewHost');
    var mediaNode = getMediaNodeForGroup(group);
    var source;
    var startAt;
    var endAt;

    cleanupPreview();

    if (!host) {
      return;
    }
    if (!mediaNode) {
      renderUnknownPreview(host, null);
      return;
    }

    source = detectPreviewSource(mediaNode);

    startAt = Number(
      point && point.mediaStart != null
        ? point.mediaStart
        : 0
    );

    endAt = Number(
      point && point.mediaEnd != null
        ? point.mediaEnd
        : (startAt + Number(point && point.playDuration != null
          ? point.playDuration
          : (group.defaultPlayDuration || 15)))
    );

    if (source.provider === 'html5') {
      renderHtml5Preview(host, source, startAt, endAt);
      return;
    }
    if (source.provider === 'youtube') {
      renderYouTubePreview(host, source, startAt, endAt);
      return;
    }
    if (source.provider === 'vimeo') {
      renderVimeoPreview(host, source, startAt, endAt);
      return;
    }
    renderUnknownPreview(host, mediaNode);
  }

  function syncEndFromDuration() {
    var startEl = $('editTimelinePointMediaStart');
    var durationEl = $('editTimelinePointDuration');
    var endEl = $('editTimelinePointMediaEnd');
    var start;
    var duration;
    if (!startEl || !durationEl || !endEl) {
      return;
    }
    start = Number(startEl.value || 0);
    duration = Number(durationEl.value || 0);
    if (Number.isFinite(start) && Number.isFinite(duration) && duration >= 0) {
      endEl.value = start + duration;
    }
  }

  function syncDurationFromEnd() {
    var startEl = $('editTimelinePointMediaStart');
    var endEl = $('editTimelinePointMediaEnd');
    var durationEl = $('editTimelinePointDuration');
    var start;
    var end;
    if (!startEl || !endEl || !durationEl) {
      return;
    }
    start = Number(startEl.value || 0);
    end = Number(endEl.value || 0);
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      durationEl.value = end - start;
    }
  }

  function configureAxisPanel(group) {
    var mediaNode = getMediaNodeForGroup(group);
    var resource = (mediaNode && mediaNode.resource) || {};
    var resourceUri = resource.uri || resource.canonicalUri || '';
    var axisEnd = Number(group.timeEnd || (group.axis && group.axis.end) || group.pageCount || 0);

    $('editTimelineAxisId').value = group.id || '';
    $('editTimelineAxisMedia').value = mediaNode ? (mediaNode.label || resourceUri || mediaNode.id) : '';
    $('editTimelineAxisDirection').value = group.orientation || 'horizontal';
    $('editTimelineAxisStart').value = Number(group.timeStart || 0);
    $('editTimelineAxisEnd').value = axisEnd;
    setTimeText('editTimelineAxisEndText', axisEnd);
    $('editTimelineAxisLength').value = Number(group.length || 480);
    $('editTimelineAxisDefaultDuration').value = Number(group.defaultPlayDuration || 15);
    $('editTimelineAxisStrokeWidth').value = Number(group.strokeWidth || (group.spine && group.spine.width) || 4);
    // $('editTimelineAxisStrokeColor').value = group.strokeColor || (group.spine && group.spine.color) || '#888888';
    $('editTimelineAxisStrokeColor').value = toHexColor(
      group.strokeColor || (group.spine && group.spine.color) || '#888888',
      '#888888'
    );

    cleanupPreview();
    $('edit-timeline-axis').style.display = '';
    $('edit-timeline-point').style.display = 'none';

    if (timeline &&
      typeof timeline.resolveMediaDuration === 'function' &&
      typeof timeline.applyResolvedDurationToAxis === 'function' &&
      mediaNode) {
      timeline.resolveMediaDuration(mediaNode).then(function (duration) {
        if (currentTarget !== group ||
          !Number.isFinite(Number(duration)) ||
          Number(duration) <= 0) {
          return;
        }
        timeline.applyResolvedDurationToAxis(group, Number(duration));
        $('editTimelineAxisEnd').value = Number(group.timeEnd || duration);
        setTimeText('editTimelineAxisEndText', Number(group.timeEnd || duration));
      });
    }
  }

  function openAddSegmentFromPlayer(group) {
    if (wuwei.edit && wuwei.edit.viewpoint && typeof wuwei.edit.viewpoint.close === 'function') {
      wuwei.edit.viewpoint.close();
    }
    var now;
    var draft;

    if (!group || !isAxisGroup(group)) {
      return false;
    }
    if (!ensureEditShell()) {
      return false;
    }

    beginTimelineEditSession();

    now = Number(group.timeStart || 0);

    draft = {
      id: '',
      axisRole: 'point',
      mediaStart: now,
      mediaEnd: now + Number(group.defaultPlayDuration || 15),
      playDuration: Number(group.defaultPlayDuration || 15),
      label: menu.timeline && typeof menu.timeline.formatTime === 'function'
        ? menu.timeline.formatTime(now)
        : '',
      description: buildDescription('')
    };

    currentTarget = group;
    currentGroup = group;
    currentMode = 'axis-add-segment';
    state.timelineEdit = {
      mode: 'axis-add-segment',
      targetId: group.id,
      groupId: group.id,
      pointId: '',
      mediaRef: group.mediaRef || ''
    };

    configurePointPanel(draft, group, currentMode);
    seekPreviewTo(now);
    return true;
  }

  function resolveSegment(target) {
    var node = target && target.id && model && typeof model.findNodeById === 'function'
      ? model.findNodeById(target.id)
      : null;
    var group = node && node.groupRef && model && typeof model.findGroupById === 'function'
      ? model.findGroupById(node.groupRef)
      : null;

    return (node && group) ? { group: group, point: node, segment: node } : null;
  }

  function openSegmentFromPlayer(point) {
    if (wuwei.edit && wuwei.edit.viewpoint && typeof wuwei.edit.viewpoint.close === 'function') {
      wuwei.edit.viewpoint.close();
    }
    var record = resolveSegment(point);
    var spec;
    if (!record || !ensureEditShell()) {
      return false;
    }

    beginTimelineEditSession();

    if (record.segment.axisRole === 'start' || record.segment.axisRole === 'end') {
      return openSegmentProperties(point);
    }

    spec = menu.timeline && typeof menu.timeline.getTimelinePlaybackSpec === 'function'
      ? menu.timeline.getTimelinePlaybackSpec(record.segment)
      : null;


    if (spec) {
      record.segment.mediaStart = Number(spec.startAt || record.segment.mediaStart || 0);
      record.segment.mediaEnd = Number(
        spec.endAt || (record.segment.mediaStart +
          Number(record.segment.playDuration || record.group.defaultPlayDuration || 15))
      );
      record.segment.playDuration = Math.max(0, record.segment.mediaEnd - record.segment.mediaStart);
    }

    currentTarget = record.segment;
    currentGroup = record.group;
    currentMode = 'segment-player';
    setTimelineEditState({ mode: 'segment-player', targetId: point.id, groupId: point.groupRef || '', pointId: point.id });
    configurePointPanel(record.segment, record.group, currentMode);
    seekPreviewTo(record.segment.mediaStart || 0);
    return true;
  }

  function saveAxis() {
    currentTarget = currentTarget || getCurrentTarget();
    currentGroup = currentGroup || getCurrentGroup();
    currentMode = currentMode || getCurrentMode();

    if (!currentTarget || !isAxisGroup(currentTarget)) {
      return false;
    }

    menu.timeline.updateAxisGroup(currentTarget, {
      orientation: $('editTimelineAxisDirection').value,
      timeStart: Number($('editTimelineAxisStart').value || 0),
      timeEnd: Number($('editTimelineAxisEnd').value || 0),
      length: Number($('editTimelineAxisLength').value || 480),
      defaultPlayDuration: Number($('editTimelineAxisDefaultDuration').value || 15),
      strokeWidth: Number($('editTimelineAxisStrokeWidth').value || 4),
      strokeColor: $('editTimelineAxisStrokeColor').value || '#888888'
    });

    return true;
  }

  function addPointToGroup(group, patch) {
    var backupGroupIds;
    var point = null;

    if (!group || !menu || !menu.timeline) {
      return null;
    }

    if (typeof menu.timeline.addTimePointToGroup === 'function') {
      return menu.timeline.addTimePointToGroup(group, patch);
    }

    if (typeof menu.timeline.addTimePoint === 'function') {
      backupGroupIds = Array.isArray(state.selectedGroupIds) ? state.selectedGroupIds.slice() : [];
      state.selectedGroupIds = [group.id];

      point = menu.timeline.addTimePoint();

      if (point && typeof menu.timeline.updateTimePoint === 'function') {
        point = menu.timeline.updateTimePoint(point, patch) || point;
      }

      state.selectedGroupIds = backupGroupIds;
      return point;
    }

    return null;
  }

  function saveNewPoint() {
    var group = currentGroup || currentTarget;
    var patch;
    var point;

    if (!group || !isAxisGroup(group)) {
      return false;
    }

    patch = buildPointPatch(group);
    point = addPointToGroup(group, patch);

    if (!point) {
      return false;
    }

    applyPointStyle(point);
    applyPointStyleToGroup(point);
    currentTarget = point;
    currentMode = 'segment-properties';
    return true;
  }

  function savePoint() {
    var record;
    var patch;

    currentTarget = currentTarget || getCurrentTarget();
    currentGroup = currentGroup || getCurrentGroup();
    currentMode = currentMode || getCurrentMode();

    if (!currentTarget || !isTimelinePoint(currentTarget)) {
      return false;
    }

    record = resolveSegment(currentTarget);
    if (!record) {
      return false;
    }

    if (record.segment.axisRole === 'start' || record.segment.axisRole === 'end') {
      patch = buildPointPatch(record.group);
      if (record.segment.axisRole === 'start') {
        patch.mediaStart = 0;
      }
      if (record.segment.axisRole === 'end') {
        patch.mediaEnd = Number(record.group.timeEnd || (record.group.axis && record.group.axis.end) || record.segment.mediaEnd || record.segment.mediaStart || 0);
      }
      menu.timeline.updateTimePoint(currentTarget, patch);
      applyPointStyle(record.segment);
      applyPointStyleToGroup(record.segment);
      return true;
    }

    patch = buildPointPatch(record.group);
    menu.timeline.updateTimePoint(currentTarget, patch);
    applyPointStyle(record.segment);
    applyPointStyleToGroup(record.segment);
    return true;
  }

  function deletePoint() {
    function t(str) {
      return wuwei.nls.translate(str);
    }

    var record = resolveSegment(currentTarget);

    if (!record) {
      return false;
    }
    if (record.segment.axisRole === 'start' || record.segment.axisRole === 'end') {
      window.alert(t('start / end cannot be deleted.'));
      return false;
    }
    if (!window.confirm(t('Delete this time point?'))) {
      return false;
    }

    menu.timeline.deleteTimePoint(currentTarget);
    currentTarget = null;
    cleanupPreview();
    hidePanels();
    return true;
  }

  function commit() {
    var s = wuwei.common && wuwei.common.state && wuwei.common.state.timelineEdit;
    var saved = false;
    var confirmed = true;
    var mode = getCurrentMode();
    var target = getCurrentTarget();

    if ('axis-properties' === mode) {
      saved = saveAxis();
    }
    else if ('axis-add-segment' === mode) {
      saved = saveNewPoint();
      target = getCurrentTarget() || getCurrentGroup();
    }
    else if ('segment-properties' === mode || 'segment-player' === mode) {
      saved = savePoint();
    }

    if (!saved) {
      return false;
    }

    if (menu.timeline &&
      typeof menu.timeline.confirmSavedRender === 'function' &&
      target) {
      confirmed = menu.timeline.confirmSavedRender(target);
    }

    return confirmed;
  }

  function canOpen(target) {
    target = normalizeTarget(target);
    return isAxisGroup(target) || isTimelinePoint(target);
  }

  function open(target, option) {
    option = option || {};
    target = normalizeTarget(target);

    if (!target) {
      cleanupPreview();
      hidePanels();
      currentTarget = null;
      currentGroup = null;
      currentMode = '';
      return false;
    }

    beginTimelineEditSession();

    if (isAxisGroup(target)) {
      if ('axis-add-segment' === option.timelineMode) {
        return openAddSegmentFromPlayer(target);
      }
      return openAxisProperties(target, option || {});
    }

    if (isTimelinePoint(target)) {
      if ('segment-player' === option.timelineMode) {
        return openSegmentFromPlayer(target);
      }
      return openSegmentProperties(target, option || {});
    }

    return false;
  }

  function isOpen() {
    return !!currentTarget ||
      (($('edit-timeline-axis') && $('edit-timeline-axis').style.display !== 'none') ||
        ($('edit-timeline-point') && $('edit-timeline-point').style.display !== 'none'));
  }

  function clearTimelineEditState() {
    if (wuwei.common && wuwei.common.state) {
      wuwei.common.state.timelineEdit = null;
    }
  }

  function close() {
    cleanupPreview();
    hidePanels();
    clearTimelineEditState()
    currentTarget = null;
    currentGroup = null;
    currentMode = '';
    state.timelineSnapshotTaken = false;
  }

  function capturePreviewThumbnailDataUrl() {
    var host = $('editTimelinePreviewHost');
    var video;
    var canvas;
    var ctx;
    var w;
    var h;

    if (!host) {
      return null;
    }

    // 表示中の preview から直接取得する
    video = host.querySelector('video');

    // HTML5 video が表示されていない場合は切り出せない
    if (!video) {
      return null;
    }
    if (!video.videoWidth || !video.videoHeight) {
      return null;
    }

    w = video.videoWidth;
    h = video.videoHeight;

    canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;

    ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, w, h);

    return canvas.toDataURL('image/jpeg', 0.85);
  }

  function capturePreviewThumbnailToCurrentPoint() {
    var dataUrl;
    var startSec;

    if (!currentTarget || !isTimelinePoint(currentTarget)) {
      return false;
    }

    dataUrl = capturePreviewThumbnailDataUrl();
    if (!dataUrl) {
      return false;
    }

    startSec = getTextSeconds('editTimelinePointMediaStart', 0);

    currentTarget.smallThumbnail = dataUrl;
    currentTarget.thumbnailTime = startSec;
    currentTarget.changed = true;
    return true;
  }

  function initModule() { }

  ns.initModule = initModule;
  ns.canOpen = canOpen;
  ns.open = open;
  ns.close = close;
  ns.isOpen = isOpen;
  ns.commit = commit;
  ns.openAxisProperties = openAxisProperties;
  ns.openAddSegmentFromPlayer = openAddSegmentFromPlayer;
  ns.openSegmentProperties = openSegmentProperties;
  ns.openSegmentFromPlayer = openSegmentFromPlayer;
})(wuwei.edit.timeline);
// edit.timeline.js last modified 2026-05-11
