/**
 * info.timeline.js
 * timeline info controller
 *
 * Time meaning used here:
 * - Start = mediaStart
 * - End   = mediaEnd
 * - Duration = mediaEnd - mediaStart
 */
wuwei.info = wuwei.info || {};
wuwei.info.timeline = wuwei.info.timeline || {};

(function (ns) {
  'use strict';

  var model = wuwei.model;
  var timeline = wuwei.timeline;
  var menu = wuwei.menu;
  var stateMap = { point: null, group: null };
  var pointPreviewState = {
    kind: '',
    player: null,
    timer: null,
    host: null
  };

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
    function pad2(n) { return String(n).padStart(2, '0'); }
    return h < 1 ? (pad2(m) + ':' + pad2(s)) : (pad2(h) + ':' + pad2(m) + ':' + pad2(s));
  }

  function getResourceUrl(node) {
    var resource = node && node.resource ? node.resource : {};
    if (resource.uri) { return resource.uri; }
    if (resource.original && resource.original.url) { return resource.original.url; }
    if (resource.original && resource.original.sourceUrl) { return resource.original.sourceUrl; }
    if (resource.original && resource.original.canonicalUrl) { return resource.original.canonicalUrl; }
    if (resource.origin && resource.origin.sourceUrl) { return resource.origin.sourceUrl; }
    if (resource.origin && resource.origin.canonicalUrl) { return resource.origin.canonicalUrl; }
    if (node && node.uri) { return node.uri; }
    if (node && node.url) { return node.url; }
    return '';
  }

  function getVimeoUrl(mediaNode, source) {
    var url = source && (source.url || source.src || source.embedUrl);
    var id = source && source.id;
    if (!url) {
      url = getResourceUrl(mediaNode);
    }
    if (!url && id) {
      url = 'https://vimeo.com/' + id;
    }
    return url || '';
  }



  function ensureInfoRoot() {
    var infoPane = document.getElementById('info');
    var editPane = document.getElementById('edit');
    var hasHeader;

    if (wuwei.info && typeof wuwei.info.closeEditPaneForInfo === 'function') {
      wuwei.info.closeEditPaneForInfo();
    }
    else if (editPane) {
      editPane.innerHTML = '';
      editPane.style.display = 'none';
    }
    if (!infoPane) {
      return null;
    }

    hasHeader = !!(
      infoPane.querySelector('header') &&
      infoPane.querySelector('#infoDismiss') &&
      infoPane.querySelector('#infoWiden')
    );

    /*
     * Timeline info may be opened directly from the context-menu [i] command,
     * without going through wuwei.info.open().  In that route the common info
     * header can be missing, so rebuild the full info template unless both the
     * shared header controls and the timeline pane placeholder already exist.
     */
    if (wuwei.info && wuwei.info.markup && typeof wuwei.info.markup.template === 'function') {
      if (!hasHeader || !document.getElementById('info-timeline')) {
        infoPane.innerHTML = wuwei.info.markup.template();
      }
    }
    infoPane.style.display = 'block';
    return infoPane;
  }

  function hideSiblingPanes() {
    [
      'info-generic',
      'info-group',
      'info-uploaded',
      'info-video',
      'info-audio',
      'info-image',
      'info-asciidoc',
      'info-viewpoint'
    ].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) { el.style.display = 'none'; }
    });
  }

  function setInfoDataset(target) {
    var infoPane = document.getElementById('info');
    if (!infoPane) { return; }
    delete infoPane.dataset.page_marker_id;
    delete infoPane.dataset.edit_node_id;
    delete infoPane.dataset.group_id;

    if (target && target.type === 'Segment' && target.id) {
      infoPane.dataset.node_id = target.id;
      infoPane.dataset.edit_node_id = target.id;
      if (wuwei.info && typeof wuwei.info.setInfoEditTarget === 'function') {
        wuwei.info.setInfoEditTarget(target);
      }
      return;
    }
    if (target && target.id) {
      infoPane.dataset.node_id = target.id;
      infoPane.dataset.edit_node_id = target.id;
      infoPane.dataset.group_id = target.id;
      if (wuwei.info && typeof wuwei.info.setInfoEditTarget === 'function') {
        wuwei.info.setInfoEditTarget(target);
      }
    }
  }

  function ensurePane() {
    var infoPane = ensureInfoRoot();
    var pane = document.getElementById('info-timeline');
    if (pane) {
      hideSiblingPanes();
      return pane;
    }
    if (!infoPane) { return null; }
    infoPane.insertAdjacentHTML('beforeend', wuwei.info.timeline.markup.paneTemplate());
    hideSiblingPanes();
    return document.getElementById('info-timeline');
  }

  function close() {
    if (menu.timeline && typeof menu.timeline.cleanupEmbeddedPreview === 'function') {
      menu.timeline.cleanupEmbeddedPreview(pointPreviewState, document.getElementById('infoTimelinePreviewHost'));
    }
    var pane = document.getElementById('info-timeline');
    if (!pane) { return; }
    pane.innerHTML = '';
    pane.style.display = 'none';
    stateMap.point = null;
    stateMap.group = null;
  }

  function isTimelinePoint(node) { return !!timeline.isTimelinePoint(node); }
  function isAxisGroup(group) { return !!timeline.isAxisGroup(group); }
  function getMediaNodeForGroup(group) { return timeline.getMediaNodeForGroup(group); }
  function getMediaName(group) {
    var mediaNode = getMediaNodeForGroup(group);
    return mediaNode ? (mediaNode.label || mediaNode.uri || mediaNode.id) : '';
  }

  function getMediaBasicInfo(mediaNode) {
    var resource = mediaNode && mediaNode.resource ? mediaNode.resource : {};
    var source = mediaNode && timeline && typeof timeline.detectMediaSource === 'function'
      ? timeline.detectMediaSource(mediaNode)
      : {};
    var duration = mediaNode && wuwei.video && typeof wuwei.video.getDuration === 'function'
      ? wuwei.video.getDuration(mediaNode)
      : (timeline && typeof timeline.getMediaDuration === 'function' ? timeline.getMediaDuration(mediaNode) : 0);

    return {
      title: mediaNode ? (mediaNode.label ||  mediaNode.name || mediaNode.id || '') : '',
      kind: resource.kind || (mediaNode && mediaNode.kind) || 'video',
      videoKind: resource.videoKind || (mediaNode && mediaNode.videoKind) || '',
      provider: (source && source.provider) || resource.provider || resource.videoKind || '',
      durationText: formatClockTime(duration || 0)
    };
  }

  function buildSegmentList(group) {
    var members = timeline && typeof timeline.sortTimelineMembers === 'function'
      ? timeline.sortTimelineMembers(group)
      : [];

    return members.filter(function (node) {
      return node && node.type === 'Segment';
    }).map(function (node) {
      var timing = getSegmentTiming(node, group);
      return {
        label: node.label || '',
        startText: formatClockTime(timing.startAt)
      };
    });
  }

  function resolveSegment(point) { return timeline.resolveSegmentRecord(point); }

  function getSegmentTiming(segment, group) {
    var startAt = toNumber(segment && segment.mediaStart, 0);
    var endAt = toNumber(segment && segment.mediaEnd, startAt);
    var duration;
    var spec;
    if (!Number.isFinite(endAt)) {
      duration = toNumber(segment && segment.playDuration, toNumber(group && group.defaultPlayDuration, 15));
      endAt = startAt + duration;
    }
    spec = menu.timeline.getTimelinePlaybackSpec(segment);
    if ((!Number.isFinite(endAt) || endAt <= startAt) && spec && spec.endAt != null) {
      endAt = toNumber(spec.endAt, startAt);
    }
    if (!Number.isFinite(endAt) || endAt < startAt) {
      endAt = startAt;
    }
    duration = Math.max(0, endAt - startAt);
    return { startAt: startAt, endAt: endAt, duration: duration };
  }

  function openAxis(group) {
    var pane = ensurePane();
    var mediaNode;
    var previewHost;
    var startAt;
    var endAt;
    if (!pane || !group) { return; }
    setInfoDataset(group);
    stateMap.group = group;
    stateMap.point = null;
    mediaNode = getMediaNodeForGroup(group);
    startAt = toNumber(group.timeStart || (group.axis && group.axis.start), 0);
    endAt = toNumber(group.timeEnd || (group.axis && group.axis.end), startAt);
    pane.innerHTML = wuwei.info.timeline.markup.axisTemplate({
      group: group,
      mediaName: getMediaName(group),
      mediaInfo: getMediaBasicInfo(mediaNode),
      segments: buildSegmentList(group),
      segmentCount: Array.isArray(group.members) ? group.members.length : 0,
      defaultPlayDuration: group.defaultPlayDuration || 0,
      endText: formatClockTime(group.timeEnd || 0)
    });
    pane.style.display = 'block';
    previewHost = document.getElementById('infoTimelinePreviewHost');
    renderPointPreview(previewHost, mediaNode, {
      startAt: startAt,
      endAt: endAt
    });
  }

  function renderPointPreview(host, mediaNode, timing) {
    function t(str) {
      return wuwei.nls.translate(str);
    }

    var source, startAt, endAt;
    if (menu.timeline && typeof menu.timeline.cleanupEmbeddedPreview === 'function') {
      menu.timeline.cleanupEmbeddedPreview(pointPreviewState, host);
    }
    if (!host || !mediaNode) { return; }
    source = timeline.detectMediaSource(mediaNode);
    startAt = Math.max(0, Number(timing && timing.startAt || 0));
    endAt = Math.max(startAt, Number(timing && timing.endAt || startAt));
    if (source.provider === 'html5') {
      menu.timeline.renderHtml5EmbeddedPreview(host, source, startAt, endAt, pointPreviewState);
      return;
    }
    if (source.provider === 'youtube' && source.id) {
      menu.timeline.renderYouTubeEmbeddedPreview(host, source, startAt, endAt, pointPreviewState).catch(function () {
        host.innerHTML = '<div class="timeline-preview-note">YouTube preview could not be loaded.</div>';
      });
      return;
    }
    if (source.provider === 'vimeo') {
      var vimeoUrl = getVimeoUrl(mediaNode, source);
      if (vimeoUrl) {
        source = Object.assign({}, source, { url: vimeoUrl });
        menu.timeline.renderVimeoEmbeddedPreview(host, source, startAt, endAt, pointPreviewState).catch(function () {
          host.innerHTML = '<div class="timeline-preview-note">Vimeo preview could not be loaded.</div>';
        });
        return;
      }
    }
    host.innerHTML = '<div class="timeline-preview-note">' + t('Please use Open player / Open in new tab.') + '</div>';
  }

  function openPoint(point) {
    var record = resolveSegment(point);
    var mediaNode;
    var timing;
    var pane;
    var segmentView;
    var previewHost;
    if (!record) { return; }
    ensureInfoRoot();
    mediaNode = getMediaNodeForGroup(record.group);
    timing = getSegmentTiming(record.segment, record.group);
    pane = ensurePane();
    if (!pane) { return; }
    setInfoDataset(record.segment);
    stateMap.group = record.group;
    stateMap.point = record.segment;
    segmentView = Object.assign({}, record.segment, {
      mediaStart: timing.startAt,
      mediaEnd: timing.endAt,
      playDuration: timing.duration
    });
    pane.innerHTML = wuwei.info.timeline.markup.pointTemplate({
      point: record.segment,
      segment: segmentView,
      axisName: record.group ? (record.group.name || record.group.id) : '',
      memo: record.segment ? record.segment.value : '',
      startText: formatClockTime(timing.startAt),
      endText: formatClockTime(timing.endAt),
      durationText: formatClockTime(timing.duration)
    });
    pane.style.display = 'block';
    previewHost = document.getElementById('infoTimelinePreviewHost');
    renderPointPreview(previewHost, mediaNode, timing);
  }

  function open(target) {
    if (!target) { return; }
    if (isTimelinePoint(target)) { openPoint(target); return; }
    if (isAxisGroup(target)) { openAxis(target); return; }
    if (timeline.isTimelineAxisLink(target)) {
      var spec = timeline.getTimelineTargetSpec(target);
      if (spec && spec.group) { openAxis(spec.group); }
    }
  }

  function openTimelinePointInInfo(node) { openPoint(node); }

  function openTimelineAxisInInfo(group) {
    ensureInfoRoot();
    openAxis(group);
  }

  function getTimelineCurrentTime() {
    if (pointPreviewState.kind === 'html5' && pointPreviewState.player) {
      return Number(pointPreviewState.player.currentTime || 0);
    }
    if (pointPreviewState.kind === 'youtube' && pointPreviewState.player) {
      try { return Number(pointPreviewState.player.getCurrentTime() || 0); } catch (e) { return 0; }
    }
    if (pointPreviewState.kind === 'vimeo' && pointPreviewState.player && typeof pointPreviewState.player.getCurrentTime === 'function') {
      return 0;
    }
    var video = document.getElementById('infoVideoPlayer') || document.querySelector('#info video');
    return video ? Number(video.currentTime || 0) : 0;
  }

  ns.open = open;
  ns.openAxis = openAxis;
  ns.openPoint = openPoint;
  ns.close = close;
  ns.getTimelineCurrentTime = getTimelineCurrentTime;
  ns.openTimelinePointInInfo = openTimelinePointInInfo;
  ns.openTimelineAxisInInfo = openTimelineAxisInInfo;
  ns.isTimelinePoint = isTimelinePoint;
  ns.isAxisGroup = isAxisGroup;
  wuwei.info.openTimelinePointInInfo = openTimelinePointInInfo;
  wuwei.info.openTimelineAxisInInfo = openTimelineAxisInInfo;
})(wuwei.info.timeline);
