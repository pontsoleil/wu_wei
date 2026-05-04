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
    if (typeof jQuery === 'undefined' || !jQuery.fn || typeof jQuery.fn.colorPalettePicker !== 'function') {
      return;
    }

    jQuery('#editTimelineAxisStrokeColorPalette').colorPalettePicker({
      lines: 4,
      bootstrap: 4,
      dropdownTitle: '標準色',
      buttonClass: 'btn btn-light btn-sm dropdown-toggle',
      onSelected: function (color) {
        var input = $('editTimelineAxisStrokeColor');
        if (input) {
          input.value = color;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });

    jQuery('#editTimelinePointColorPalette').colorPalettePicker({
      lines: 4,
      bootstrap: 4,
      dropdownTitle: '標準色',
      buttonClass: 'btn btn-light btn-sm dropdown-toggle',
      onSelected: function (color) {
        var input = $('editTimelinePointColor');
        if (input) {
          input.value = color;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });

    jQuery('#editTimelinePointFontColorPalette').colorPalettePicker({
      lines: 4,
      bootstrap: 4,
      dropdownTitle: '標準色',
      buttonClass: 'btn btn-light btn-sm dropdown-toggle',
      onSelected: function (color) {
        var input = $('editTimelinePointFontColor');
        if (input) {
          input.value = color;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });

    jQuery('#editTimelinePointOutlineColorPalette').colorPalettePicker({
      lines: 4,
      bootstrap: 4,
      dropdownTitle: '標準色',
      buttonClass: 'btn btn-light btn-sm dropdown-toggle',
      onSelected: function (color) {
        var input = $('editTimelinePointOutlineColor');
        if (input) {
          input.value = color;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });
  }

  function applyPointStyle(point) {
    if (!point) {
      return;
    }
    point.color = toHexColor(
      $('editTimelinePointColor') ? $('editTimelinePointColor').value : point.color,
      point.color || '#ffffff'
    );
    point.font = point.font || {};
    point.font.color = toHexColor(
      $('editTimelinePointFontColor') ? $('editTimelinePointFontColor').value : point.font.color,
      point.font.color || '#303030'
    );
    point.style = point.style || {};
    point.style.line = point.style.line || {};
    point.style.line.kind = point.style.line.kind || 'SOLID';
    point.style.line.color = toHexColor(
      $('editTimelinePointOutlineColor') ? $('editTimelinePointOutlineColor').value : (point.style.line.color || point.outline),
      point.style.line.color || point.outline || '#666666'
    );
    point.style.line.width = Math.max(0, Number(
      $('editTimelinePointOutlineWidth') ? $('editTimelinePointOutlineWidth').value : point.style.line.width
    ) || 0);
    point.outline = point.style.line.color;
    point.outlineWidth = point.style.line.width;
    point.changed = true;
  }

  function clonePlain(value) {
    return value && typeof value === 'object'
      ? JSON.parse(JSON.stringify(value))
      : value;
  }

  function applyPointStyleToGroup(sourcePoint) {
    var group = currentGroup;
    var members;
    if (!sourcePoint || !applyToTimelineGroup || !group) {
      return;
    }
    members = (group.members || []).map(function (member) {
      var id = typeof member === 'string' ? member : member && member.id;
      return id && model && typeof model.findNodeById === 'function'
        ? model.findNodeById(id)
        : null;
    }).filter(function (node) {
      return node && node.type === 'Segment';
    });
    members.forEach(function (node) {
      if (node.id === sourcePoint.id) {
        return;
      }
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

    if (mediaEnd < mediaStart) {
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

  function buildDescription(body) {
    return {
      format: 'plain/text',
      body: body || ''
    };
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
    $('editTimelinePointName').value = point.label || '';
    $('editTimelinePointValue').value = getDescriptionBody(point);
    if ($('editTimelinePointColor')) {
      $('editTimelinePointColor').value = toHexColor(point.color || '#ffffff', '#ffffff');
    }
    if ($('editTimelinePointFontColor')) {
      $('editTimelinePointFontColor').value = toHexColor(
        point.font && point.font.color ? point.font.color : '#303030',
        '#303030'
      );
    }
    if ($('editTimelinePointOutlineColor')) {
      $('editTimelinePointOutlineColor').value = toHexColor(
        (point.style && point.style.line && point.style.line.color) || point.outline || '#666666',
        '#666666'
      );
    }
    if ($('editTimelinePointOutlineWidth')) {
      $('editTimelinePointOutlineWidth').value = Number(
        (point.style && point.style.line && point.style.line.width) || point.outlineWidth || 1
      );
    }
    if ($('applyToTimelineGroup')) {
      $('applyToTimelineGroup').checked = !!applyToTimelineGroup;
    }

    $('edit-timeline-axis').style.display = 'none';
    $('edit-timeline-point').style.display = '';

    if (isEndpoint) {
      setFieldVisible('editTimelinePointMediaStartText', false);
      setFieldVisible('editTimelinePointMediaEndText', false);
      setFieldVisible('editTimelinePointDurationText', false);
      setDeleteVisible(false);

      var previewButtons = document.querySelector('.edit-timeline-capture-actions');
      if (previewButtons) {
        previewButtons.style.display = 'none';
      }
      var previewField = $('editTimelinePreviewHost');
      if (previewField && previewField.parentElement) {
        previewField.parentElement.style.display = 'none';
      }
      cleanupPreview();
      return;
    }

    setFieldVisible('editTimelinePointMediaStartText', true);
    setFieldVisible('editTimelinePointMediaEndText', true);
    setFieldVisible('editTimelinePointDurationText', true);
    setDeleteVisible(mode !== 'axis-add-segment');

    var previewButtons2 = document.querySelector('.edit-timeline-capture-actions');
    if (previewButtons2) {
      previewButtons2.style.display = '';
    }
    var previewField2 = $('editTimelinePreviewHost');
    if (previewField2 && previewField2.parentElement) {
      previewField2.parentElement.style.display = '';
    }

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
      description: buildDescription($('editTimelinePointValue').value || '')
    };
  }

  function bindTimelineShellEvents(host) {
    if (!host || host.dataset.timelineBound === '1') {
      return;
    }
    host.dataset.timelineBound = '1';

    host.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t) {
        return;
      }

      if (t.id === 'editTimelineAxisSave') {
        if (saveAxis()) {
          wuwei.log.storeLog({ operation: 'edit' });
        }
        ev.preventDefault();
        return;
      }

      if (t.id === 'editTimelinePointSave') {
        if (savePoint()) {
          wuwei.log.storeLog({ operation: 'edit' });
        }
        ev.preventDefault();
        return;
      }

      if (t.id === 'editTimelinePointDelete') {
        if (deletePoint()) {
          wuwei.log.storeLog({ operation: 'edit' });
        }
        ev.preventDefault();
        return;
      }

      if (t.id === 'editTimelineCaptureToStart') {
        capturePreviewTime('start');
        ev.preventDefault();
        return;
      }

      if (t.id === 'editTimelineCaptureToEnd') {
        capturePreviewTime('end');
        ev.preventDefault();
        return;
      }

      if (t.id === 'editTimelineCaptureThumbnail') {
        if (!capturePreviewThumbnailToCurrentPoint()) {
          window.alert('この preview からはサムネを作成できません。mp4 などの HTML5 動画で試してください。');
        }
        ev.preventDefault();
        return;
      }
    });

    host.addEventListener('change', function (ev) {
      var t = ev.target;
      if (!t) {
        return;
      }

      if (t.id === 'editTimelinePointMediaStartText') {
        onPointStartTextChanged();
        return;
      }
      if (t.id === 'editTimelinePointMediaEndText') {
        onPointEndTextChanged();
        return;
      }
      if (t.id === 'editTimelinePointDurationText') {
        onPointDurationTextChanged();
        return;
      }
      if (t.id === 'applyToTimelineGroup') {
        applyToTimelineGroup = !!t.checked;
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

  function openAxisProperties(group) {
    if (wuwei.edit && wuwei.edit.contents && typeof wuwei.edit.contents.close === 'function') {
      wuwei.edit.contents.close();
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
    return true;
  }

  function openSegmentProperties(point) {
    if (wuwei.edit && wuwei.edit.contents && typeof wuwei.edit.contents.close === 'function') {
      wuwei.edit.contents.close();
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

    host = $('edit-timeline') || editPane;

    host.innerHTML = wuwei.edit.timeline.markup.panelsHtml();

    bindTimelineShellEvents(host);
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
    var resource = (mediaNode && mediaNode.resource) || {};
    var resourceUri = resource.uri || resource.canonicalUri || '';
    host.innerHTML = '<div class="edit-timeline-preview-slot edit-timeline-preview-note">' +
      'この映像形式は埋め込み preview に未対応です。<br>' +
      (resourceUri
        ? '<a href="' + String(resourceUri).replace(/"/g, '&quot;') + '" target="_blank" rel="noopener">元の映像を開く</a>'
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
    if (wuwei.edit && wuwei.edit.contents && typeof wuwei.edit.contents.close === 'function') {
      wuwei.edit.contents.close();
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
    if (wuwei.edit && wuwei.edit.contents && typeof wuwei.edit.contents.close === 'function') {
      wuwei.edit.contents.close();
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
      menu.timeline.updateTimePoint(currentTarget, {
        label: $('editTimelinePointName').value || record.segment.label || '',
        description: buildDescription($('editTimelinePointValue').value || '')
      });
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
    var record = resolveSegment(currentTarget);

    if (!record) {
      return false;
    }
    if (record.segment.axisRole === 'start' || record.segment.axisRole === 'end') {
      window.alert('start / end は削除できません。');
      return false;
    }
    if (!window.confirm('この時刻点を削除しますか？')) {
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
      return openAxisProperties(target);
    }

    if (isTimelinePoint(target)) {
      if ('segment-player' === option.timelineMode) {
        return openSegmentFromPlayer(target);
      }
      return openSegmentProperties(target);
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
// wuwei.edit.timeline.js last modified 2026-04-16
