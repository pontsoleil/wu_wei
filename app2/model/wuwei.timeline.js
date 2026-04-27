/**
 * wuwei.timeline.js
 * timeline core model / helper module
 *
 * Responsibilities:
 * - axis group / segment node model operations
 * - duration resolution and caching
 * - timeline layout and playback spec
 * - create / update / delete / normalize / relayout
 *
 * Time meaning:
 * - axis start is always 0
 * - segment position on axis is mediaStart
 * - segment clip end is mediaEnd
 * - playDuration = mediaEnd - mediaStart
 */
wuwei.timeline = wuwei.timeline || {};

(function (ns) {
  'use strict';

  var common = wuwei.common;
  var state = common.state;
  var graph = common.graph;
  var draw = wuwei.draw;
  var model = wuwei.model;
  var util = wuwei.util;
  var info = wuwei.info;

  function getCurrentOwnerId() {
    return (common && typeof common.getCurrentOwnerId === 'function')
      ? common.getCurrentOwnerId()
      : ((state && state.currentUser && state.currentUser.user_id) || '');
  }

  function makeUuid() {
    return ((typeof uuid !== 'undefined' && uuid && typeof uuid.v4 === 'function')
      ? ('_' + uuid.v4())
      : ('_' + Date.now() + '_' + Math.random().toString(16).slice(2)));
  }


  function makeStablePseudoId(holder, key) {
    if (!holder) {
      return makeUuid();
    }
    if (!holder[key]) {
      holder[key] = makeUuid();
    }
    return holder[key];
  }

  // function reRender() {
  //   if ('simulation' === graph.mode) {
  //     draw.restart();
  //   }
  //   else {
  //     draw.refresh();
  //   }
  // }

  function getCurrentPage() {
    return common && common.current ? common.current.page || null : null;
  }

  function syncRealNodesFromGraph() {
    if (model && typeof model.syncPageFromGraph === 'function') {
      model.syncPageFromGraph();
    }
  }

  function ensurePageCollections(page) {
    if (!page.nodes) { page.nodes = []; }
    if (!page.links) { page.links = []; }
    if (!page.groups) { page.groups = []; }
  }

  function isHostedVideoUrl(url) {
    var s = String(url || '').toLowerCase();
    return (
      /^https?:\/\/(www\.)?(youtube\.com|m\.youtube\.com|youtu\.be)\b/.test(s) ||
      /^https?:\/\/(www\.)?(vimeo\.com|player\.vimeo\.com)\b/.test(s)
    );
  }

  function isVideoContent(node) {
    var resource;
    var format;
    var uri;
    var subtype;
    if (!node || node.type !== 'Content') {
      return false;
    }
    resource = node.resource || {};
    if (resource.kind === 'video') {
      return true;
    }
    format = String(resource.mimeType || '').toLowerCase();
    uri = String(resource.uri || resource.canonicalUri || '').toLowerCase();
    subtype = String(resource.subtype || '').toLowerCase();
    return (
      format.indexOf('video/') === 0 ||
      /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/.test(uri) ||
      subtype === 'youtube' ||
      subtype === 'vimeo' ||
      isHostedVideoUrl(uri)
    );
  }

  function formatTime(seconds) {
    var s = Math.max(0, Number(seconds) || 0);
    var hh = Math.floor(s / 3600);
    var mm = Math.floor((s % 3600) / 60);
    var ss = Math.floor(s % 60);
    if (s < 3600) {
      return [
        String(mm).padStart(2, '0'),
        String(ss).padStart(2, '0')
      ].join(':');
    }
    return [
      String(hh).padStart(2, '0'),
      String(mm).padStart(2, '0'),
      String(ss).padStart(2, '0')
    ].join(':');
  }

  function clearDomNodeSelection() {
    d3.selectAll('g.node.selected circle.selected').remove();
    d3.selectAll('g.node.selected').classed('selected', false);
  }

  function markNodeSelected(node) {
    if (!node || !node.id) {
      return;
    }
    clearDomNodeSelection();
    state.selectedGroupIds = [];
    var d3node = d3.select('g.node#' + node.id);
    if (!d3node.empty()) {
      d3node.classed('selected', true);
      if (d3node.select('circle.selected').empty()) {
        d3node.append('circle')
          .attr('class', 'selected')
          .attr('r', 28)
          .attr('fill', 'none')
          .attr('stroke', common.Color.outerSelected)
          .attr('stroke-width', 2)
          .datum(node);
      }
    }
  }

  function markGroupSelected(group) {
    clearDomNodeSelection();
    state.selectedGroupIds = group ? [group.id] : [];
  }

  function getSelectedItems() {
    var selectedNodes = [];
    var selectedGroups = [];
    var seenNodeIds = {};
    var seenGroupIds = {};
    var editPane = document.getElementById('edit');
    var infoPane = document.getElementById('info');

    function addNode(candidate) {
      var node = null;
      if (!candidate) {
        return null;
      }
      if ('string' === typeof candidate) {
        node = model.findNodeById(candidate);
      }
      else if (candidate.id) {
        node = model.findNodeById(candidate.id) || candidate;
      }
      if (!node || !node.id || seenNodeIds[node.id]) {
        return node || null;
      }
      seenNodeIds[node.id] = true;
      selectedNodes.push(node);
      return node;
    }

    function addGroup(candidate) {
      var group = null;
      if (!candidate) {
        return null;
      }
      if ('string' === typeof candidate) {
        group = model.findGroupById(candidate);
      }
      else if (candidate.id) {
        group = model.findGroupById(candidate.id) || candidate;
      }
      if (!group || !group.id || seenGroupIds[group.id]) {
        return group || null;
      }
      seenGroupIds[group.id] = true;
      selectedGroups.push(group);
      return group;
    }

    d3.selectAll('g.node.selected').each(function (d) {
      addNode(d && d.id ? d : this.id);
    });

    if (Array.isArray(state.selectedGroupIds)) {
      state.selectedGroupIds.forEach(function (gid) {
        addGroup(gid);
      });
    }

    if (!selectedNodes.length && editPane && editPane.dataset && editPane.dataset.node_id) {
      addNode(editPane.dataset.node_id);
    }
    if (!selectedNodes.length && infoPane && infoPane.dataset && infoPane.dataset.node_id) {
      addNode(infoPane.dataset.node_id);
    }
    if (!selectedNodes.length && state && state.hoveredNode) {
      if (util && typeof util.isNode === 'function' && util.isNode(state.hoveredNode)) {
        addNode(state.hoveredNode);
      }
    }

    if (!selectedGroups.length && state && state.hoveredNode) {
      if (isAxisGroup(state.hoveredNode)) {
        addGroup(state.hoveredNode);
      }
      else if (isTimelineAxisLink(state.hoveredNode) && state.hoveredNode.groupRef) {
        addGroup(state.hoveredNode.groupRef);
      }
    }

    return { nodes: selectedNodes, groups: selectedGroups };
  }

  function isAxisGroup(group) {
    return !!(group && group.type === 'timeline');
  }

  function isTimelinePoint(node) {
    return !!(node && node.type === 'Segment' && node.groupRef);
  }

  function isTimelineAxisLink(link) {
    return !!(link && link.type === 'Link' && (link.groupType === 'timelineAxis' || link.linkType === 'timeline-axis'));
  }

  function getMemberIds(group) {
    if (!group || !Array.isArray(group.members)) {
      return [];
    }
    return group.members.map(function (member) {
      return (member && member.nodeId) ? member.nodeId : member;
    }).filter(Boolean);
  }

  function setMemberIds(group, ids) {
    group.members = (ids || []).filter(Boolean).slice();
  }

  function getMediaNodeForGroup(group) {
    if (!group || !group.mediaRef) {
      return null;
    }
    return model.findNodeById(group.mediaRef);
  }

  function getStoredMediaDuration(videoNode) {
    if (!videoNode) {
      return null;
    }
    if (videoNode.resource && Number.isFinite(Number(videoNode.resource.duration)) && Number(videoNode.resource.duration) > 0) {
      return Number(videoNode.resource.duration);
    }
    if (videoNode.timeRange && Number.isFinite(Number(videoNode.timeRange.end)) && Number(videoNode.timeRange.end) > 0) {
      return Number(videoNode.timeRange.end);
    }
    return null;
  }

  function getMediaDuration(videoNode) {
    var stored = getStoredMediaDuration(videoNode);
    return stored != null ? stored : 60;
  }

  function toAbsUrl(url) {
    try {
      return new URL(String(url || ''), location.href).toString();
    }
    catch (e) {
      return String(url || '');
    }
  }

  function isHostedYouTube(url) {
    return /^https?:\/\/(www\.)?(youtube\.com|m\.youtube\.com|youtu\.be)(\/|$|\?)/i.test(String(url || '').trim());
  }

  function isHostedVimeo(url) {
    return /^https?:\/\/(www\.)?(vimeo\.com|player\.vimeo\.com)(\/|$|\?)/i.test(String(url || '').trim());
  }

  function extractYouTubeId(url) {
    var s = String(url || '').trim();
    var m = s.match(/[?&]v=([A-Za-z0-9_-]{11})/);
    if (m) { return m[1]; }
    m = s.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
    if (m) { return m[1]; }
    m = s.match(/youtube\.com\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/);
    return m ? m[1] : '';
  }

  function extractVimeoInfo(url) {
    var out = { id: '', h: '', url: String(url || '').trim() };
    var u;
    var m;
    try {
      u = new URL(out.url, location.href);
      out.h = u.searchParams.get('h') || '';
      m = u.pathname.match(/\/(?:video\/)?([0-9]+)/);
      if (m) {
        out.id = m[1];
      }
    }
    catch (e) {
      m = out.url.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
      if (m) {
        out.id = m[1];
      }
    }
    return out;
  }

  function detectMediaSource(videoNode) {
    var resource = (videoNode && videoNode.resource) || {};
    var url = String(resource.uri || resource.canonicalUri || '');
    var subtype = String(resource.subtype || '').toLowerCase();
    var format = String(resource.mimeType || '').toLowerCase();
    var vimeo;

    if (subtype === 'youtube' || isHostedYouTube(url)) {
      return { provider: 'youtube', id: extractYouTubeId(url), url: url };
    }
    if (subtype === 'vimeo' || isHostedVimeo(url)) {
      vimeo = extractVimeoInfo(url);
      return { provider: 'vimeo', id: vimeo.id, h: vimeo.h, url: vimeo.url };
    }
    if (format.indexOf('video/') === 0 || /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(url)) {
      return { provider: 'html5', src: toAbsUrl(url), url: url };
    }
    return { provider: 'unknown', url: url };
  }

  function loadScriptOnce(slot, src, test) {
    common._timelineScriptPromises = common._timelineScriptPromises || {};
    if (test()) {
      return Promise.resolve();
    }
    if (common._timelineScriptPromises[slot]) {
      return common._timelineScriptPromises[slot];
    }
    common._timelineScriptPromises[slot] = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return common._timelineScriptPromises[slot];
  }

  function loadHtml5Duration(src) {
    return new Promise(function (resolve) {
      var video = document.createElement('video');
      function done(value) {
        video.removeAttribute('src');
        try { video.load(); } catch (e) { }
        resolve(value);
      }
      video.preload = 'metadata';
      video.onloadedmetadata = function () {
        done(Number(video.duration || 0) || null);
      };
      video.onerror = function () {
        done(null);
      };
      video.src = src;
    });
  }

  function loadYouTubeDuration(videoId) {
    return loadScriptOnce('timeline-youtube', 'https://www.youtube.com/player_api', function () {
      return !!(window.YT && window.YT.Player);
    }).then(function () {
      return new Promise(function (resolve) {
        var holderId = 'timelineDurationYT_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
        var holder = document.createElement('div');
        holder.id = holderId;
        holder.style.position = 'absolute';
        holder.style.left = '-99999px';
        holder.style.width = '1px';
        holder.style.height = '1px';
        document.body.appendChild(holder);

        function cleanup(player, value) {
          try { if (player) { player.destroy(); } } catch (e) { }
          if (holder.parentNode) {
            holder.parentNode.removeChild(holder);
          }
          resolve(value);
        }

        function create() {
          var player = new YT.Player(holderId, {
            videoId: videoId,
            events: {
              onReady: function () {
                cleanup(player, Number(player.getDuration() || 0) || null);
              },
              onError: function () {
                cleanup(player, null);
              }
            }
          });
        }

        if (window.YT && window.YT.Player) {
          create();
        }
        else {
          window.onYouTubeIframeAPIReady = create;
        }
      });
    }).catch(function () {
      return null;
    });
  }

  function loadVimeoDuration(url) {
    return loadScriptOnce('timeline-vimeo', 'https://player.vimeo.com/api/player.js', function () {
      return !!(window.Vimeo && window.Vimeo.Player);
    }).then(function () {
      return new Promise(function (resolve) {
        var holder = document.createElement('div');
        holder.style.position = 'absolute';
        holder.style.left = '-99999px';
        holder.style.width = '1px';
        holder.style.height = '1px';
        document.body.appendChild(holder);

        var player = new window.Vimeo.Player(holder, {
          url: url,
          autoplay: false,
          responsive: false,
          title: false,
          byline: false,
          portrait: false
        });

        player.ready().then(function () {
          return player.getDuration();
        }).then(function (duration) {
          try { player.unload(); } catch (e) { }
          if (holder.parentNode) {
            holder.parentNode.removeChild(holder);
          }
          resolve(Number(duration || 0) || null);
        }).catch(function () {
          try { player.unload(); } catch (e) { }
          if (holder.parentNode) {
            holder.parentNode.removeChild(holder);
          }
          resolve(null);
        });
      });
    }).catch(function () {
      return null;
    });
  }

  function resolveMediaDuration(videoNode) {
    var stored = getStoredMediaDuration(videoNode);
    var source;

    if (stored != null) {
      return Promise.resolve(stored);
    }
    if (!videoNode) {
      return Promise.resolve(null);
    }

    source = detectMediaSource(videoNode);
    if (source.provider === 'html5') {
      return loadHtml5Duration(source.src);
    }
    if (source.provider === 'youtube' && source.id) {
      return loadYouTubeDuration(source.id);
    }
    if (source.provider === 'vimeo' && source.url) {
      return loadVimeoDuration(source.url);
    }
    return Promise.resolve(null);
  }

  function cacheResolvedDuration(videoNode, duration) {
    if (!videoNode || !Number.isFinite(Number(duration)) || Number(duration) <= 0) {
      return null;
    }
    videoNode.resource = videoNode.resource || {};
    videoNode.resource.duration = Number(duration);
    videoNode.timeRange = videoNode.timeRange || {};
    if (!Number.isFinite(Number(videoNode.timeRange.start))) {
      videoNode.timeRange.start = 0;
    }
    videoNode.timeRange.end = Number(duration);
    return Number(duration);
  }

  function syncAxisEndToStoredDuration(group) {
    var mediaNode = getMediaNodeForGroup(group);
    var stored = getStoredMediaDuration(mediaNode);
    if (group && Number.isFinite(Number(stored)) && Number(stored) > 0) {
      group.timeStart = 0;
      group.timeEnd = Number(stored);
      group.axis = group.axis || {};
      group.axis.start = 0;
      group.axis.end = Number(stored);
    }
    return group;
  }

  function applyResolvedDurationToAxis(group, duration) {
    var mediaNode = getMediaNodeForGroup(group);
    if (!group || !Number.isFinite(Number(duration)) || Number(duration) <= 0) {
      return null;
    }
    cacheResolvedDuration(mediaNode, duration);
    syncAxisEndToStoredDuration(group);
    normalizeAxisGroup(group);
    rebuildGraphAndRefresh();
    return group;
  }

  function createSegmentNode(group, param) {
    param = param || {};
    var mediaStart = Number.isFinite(Number(param.mediaStart)) ? Number(param.mediaStart) : Math.max(0, Number(param.startAt || 0));
    var playDuration = Math.max(0, Number(param.playDuration || group.defaultPlayDuration || 15));
    var mediaEnd = Number.isFinite(Number(param.mediaEnd)) ? Number(param.mediaEnd) : (mediaStart + playDuration);

    return {
      id: param.id || makeUuid(),
      type: 'Segment',
      audit: {
        owner: 'guest',
        createdBy: getCurrentOwnerId(),
        createdAt: new Date().toISOString(),
        lastModifiedBy: '',
        lastModifiedAt: ''
      },
      groupRef: group.id,
      topicKind: 'timeline-point',
      axisRole: param.axisRole || 'point',
      mediaStart: mediaStart,
      mediaEnd: Math.max(mediaStart, mediaEnd),
      playDuration: Math.max(0, Math.max(mediaStart, mediaEnd) - mediaStart),
      label: param.label || formatTime(mediaStart),
      value: (typeof param.value !== 'undefined') ? param.value : '',
      shape: 'CIRCLE',
      size: { radius: 20 },
      color: (param.axisRole === 'point') ? common.Color.nodeFill : '#fff8d8',
      outline: (param.axisRole === 'point') ? common.Color.nodeOutline : '#b08a00',
      font: common.defaultFont,
      visible: true,
      changed: true,
      x: Number.isFinite(Number(param.x)) ? Number(param.x) : 0,
      y: Number.isFinite(Number(param.y)) ? Number(param.y) : 0,
      fx: null,
      fy: null
    };
  }

  function ensureSegmentNodeDefaults(group, node, index) {
    node = node || {};
    node.id = node.id || makeUuid();
    node.type = 'Segment';
    node.audit = (node.audit && 'object' === typeof node.audit) ? node.audit : {};
    node.audit.owner = node.audit.owner || 'guest';
    node.audit.createdBy = node.audit.createdBy || getCurrentOwnerId();
    node.audit.createdAt = node.audit.createdAt || new Date().toISOString();
    node.audit.lastModifiedBy = node.audit.lastModifiedBy || '';
    node.audit.lastModifiedAt = node.audit.lastModifiedAt || '';
    node.groupRef = group.id;
    node.topicKind = 'timeline-point';
    node.axisRole = node.axisRole || 'point';
    node.mediaStart = Number.isFinite(Number(node.mediaStart)) ? Number(node.mediaStart) : 0;
    node.playDuration = Math.max(0, Number(node.playDuration || group.defaultPlayDuration || 15));
    node.mediaEnd = Number.isFinite(Number(node.mediaEnd)) ? Number(node.mediaEnd) : (node.mediaStart + node.playDuration);
    if (node.mediaEnd < node.mediaStart) {
      node.mediaEnd = node.mediaStart;
    }
    node.playDuration = Math.max(0, node.mediaEnd - node.mediaStart);
    node.label = node.label || formatTime(node.mediaStart);
    delete node.name;
    node.value = (typeof node.value !== 'undefined') ? node.value : '';
    node.shape = 'CIRCLE';
    node.size = { radius: Number((node.size && node.size.radius) || 20) };
    node.color = (node.axisRole === 'point') ? common.Color.nodeFill : '#fff8d8';
    node.outline = (node.axisRole === 'point') ? common.Color.nodeOutline : '#b08a00';
    node.font = node.font || common.defaultFont;
    node.visible = (false !== node.visible);
    node.changed = true;
    if (!Number.isFinite(Number(node.x))) { node.x = 0; }
    if (!Number.isFinite(Number(node.y))) { node.y = 0; }
    if (typeof node.order === 'undefined') {
      node.order = Number(index || 0) + 1;
    }
    return node;
  }

  function getTimelineMemberNodes(group) {
    return getMemberIds(group).map(function (id) {
      return model.findNodeById(id);
    }).filter(function (node) {
      return node && node.type === 'Segment';
    });
  }

  function sortTimelineMembers(group) {
    var nodes;
    if (!group) {
      return [];
    }
    nodes = getTimelineMemberNodes(group);
    nodes.sort(function (a, b) {
      var wa = a.axisRole === 'start' ? -1 : (a.axisRole === 'end' ? 1 : 0);
      var wb = b.axisRole === 'start' ? -1 : (b.axisRole === 'end' ? 1 : 0);
      var ta;
      var tb;
      if (wa !== wb) {
        return wa - wb;
      }
      ta = Number.isFinite(Number(a.mediaStart)) ? Number(a.mediaStart) : 0;
      tb = Number.isFinite(Number(b.mediaStart)) ? Number(b.mediaStart) : 0;
      if (ta !== tb) {
        return ta - tb;
      }
      return String(a.id).localeCompare(String(b.id));
    });
    nodes.forEach(function (node, index) {
      node.order = index + 1;
    });
    setMemberIds(group, nodes.map(function (node) { return node.id; }));
    return nodes;
  }

  function migrateLegacySegments(group) {
    var page = getCurrentPage();
    if (!page || !group || !Array.isArray(group.segments) || !group.segments.length) {
      return;
    }
    ensurePageCollections(page);
    if (!Array.isArray(group.members)) {
      group.members = [];
    }
    group.segments.forEach(function (segment) {
      var node = createSegmentNode(group, segment);
      page.nodes.push(node);
      group.members.push(node.id);
    });
    delete group.segments;
  }

  function layoutAxisGroup(group) {
    var axis, start, end, range, length, orientation, anchor, members;
    if (!group) {
      return null;
    }

    syncAxisEndToStoredDuration(group);

    axis = group.axis || {};
    start = 0;
    end = Number.isFinite(Number(group.timeEnd)) ? Number(group.timeEnd) : Number(axis.end || 0);
    end = Math.max(start, end);
    range = Math.max(end - start, 0.0001);
    length = Math.max(60, Number(group.length || 480));
    orientation = (group.orientation === 'vertical') ? 'vertical' : 'horizontal';
    anchor = {
      x: (axis.anchor && Number.isFinite(Number(axis.anchor.x))) ? Number(axis.anchor.x) : ((group.origin && Number.isFinite(Number(group.origin.x))) ? Number(group.origin.x) : 0),
      y: (axis.anchor && Number.isFinite(Number(axis.anchor.y))) ? Number(axis.anchor.y) : ((group.origin && Number.isFinite(Number(group.origin.y))) ? Number(group.origin.y) : 0)
    };

    group.axis = group.axis || {};
    group.axis.anchor = anchor;
    group.origin = { x: anchor.x, y: anchor.y };
    group.axis.start = 0;
    group.axis.end = end;
    group.timeStart = 0;
    group.timeEnd = end;
    group.length = length;

    members = sortTimelineMembers(group);
    members.forEach(function (node) {
      var mediaStart;
      var ratio;

      if (node.axisRole === 'start') {
        mediaStart = start;
        node.mediaStart = start;
        node.mediaEnd = Math.max(start, Number(node.mediaEnd || start));
      }
      else if (node.axisRole === 'end') {
        mediaStart = end;
        node.mediaStart = end;
        node.mediaEnd = end;
        node.playDuration = 0;
      }
      else {
        mediaStart = Number.isFinite(Number(node.mediaStart)) ? Number(node.mediaStart) : start;
        mediaStart = Math.max(start, Math.min(end, mediaStart));
        node.mediaStart = mediaStart;
      }

      if (node.axisRole !== 'end' &&
        (!Number.isFinite(Number(node.mediaEnd)) || Number(node.mediaEnd) < node.mediaStart)) {
        node.mediaEnd = node.mediaStart + Math.max(0, Number(node.playDuration || group.defaultPlayDuration || 15));
      }
      node.playDuration = Math.max(0, node.mediaEnd - node.mediaStart);

      ratio = (node.mediaStart - start) / range;
      node.x = (orientation === 'vertical') ? anchor.x : (anchor.x + (length * ratio));
      node.y = (orientation === 'vertical') ? (anchor.y + (length * ratio)) : anchor.y;
      node.fx = node.x;
      node.fy = node.y;

      ensureSegmentNodeDefaults(group, node, node.order || 0);
    });

    return group;
  }

  function normalizeAxisGroup(group) {
    var page = getCurrentPage();
    var allSegmentNodes;
    var startNode;
    var endNode;
    var sourceLink;
    if (!group) {
      return null;
    }

    ensurePageCollections(page);
    group.type = 'timeline';
    group.groupType = 'axis';
    if (!group.mediaRef && page && Array.isArray(page.links)) {
      sourceLink = page.links.find(function (link) {
        return link &&
          link.groupRef === group.id &&
          link.linkType === 'timeline-source';
      });
      if (sourceLink) {
        group.mediaRef = (sourceLink.source && sourceLink.source.id)
          ? sourceLink.source.id
          : sourceLink.source;
      }
    }
    group.enabled = (false !== group.enabled);
    group.orientation = (group.orientation === 'vertical') ? 'vertical' : 'horizontal';
    group.defaultPlayDuration = Math.max(1, Number(group.defaultPlayDuration || 15));
    group.timeline = group.timeline || {};
    group.timeline.unit = group.timeline.unit || 'second';
    group.timeline.start = Number.isFinite(Number(group.timeline.start)) ? Number(group.timeline.start) : 0;
    group.timeline.end = Number.isFinite(Number(group.timeline.end)) ? Number(group.timeline.end) : Number(group.timeEnd || 0);
    group.timeline.mediaRef = group.timeline.mediaRef || group.mediaRef || '';
    group.timeline.defaultPlayDuration = Number.isFinite(Number(group.timeline.defaultPlayDuration))
      ? Number(group.timeline.defaultPlayDuration)
      : group.defaultPlayDuration;
    group.length = Math.max(60, Number(group.length || 480));
    group.spine = group.spine || {};
    group.spine.visible = (false !== group.spine.visible);
    group.spine.color = group.spine.color || group.strokeColor || '#888888';
    group.spine.width = Math.max(1, Number(group.spine.width || group.strokeWidth || 4));
    group.spine.padding = Number(group.spine.padding || 12);
    group.strokeColor = group.spine.color;
    group.strokeWidth = group.spine.width;
    group.axisPseudoLinkId = group.axisPseudoLinkId || makeUuid();
    group.axis = group.axis || {};
    group.axis.mode = group.axis.mode || 'manual';
    group.axis.unit = group.axis.unit || 'seconds';
    group.axis.anchor = group.axis.anchor || {};
    if (!Number.isFinite(Number(group.axis.anchor.x))) {
      group.axis.anchor.x = Number.isFinite(Number(group.origin && group.origin.x)) ? Number(group.origin.x) : 0;
    }
    if (!Number.isFinite(Number(group.axis.anchor.y))) {
      group.axis.anchor.y = Number.isFinite(Number(group.origin && group.origin.y)) ? Number(group.origin.y) : 0;
    }
    group.origin = group.origin || { x: Number(group.axis.anchor.x || 0), y: Number(group.axis.anchor.y || 0) };

    migrateLegacySegments(group);
    if (!Array.isArray(group.members)) {
      group.members = [];
    }

    allSegmentNodes = (page.nodes || []).filter(function (node) {
      return node && node.type === 'Segment' && node.groupRef === group.id;
    });
    if (!group.members.length && allSegmentNodes.length) {
      setMemberIds(group, allSegmentNodes.map(function (node) { return node.id; }));
    }

    getTimelineMemberNodes(group).forEach(function (node, index) {
      ensureSegmentNodeDefaults(group, node, index);
    });

    syncAxisEndToStoredDuration(group);
    if (!Number.isFinite(Number(group.timeEnd))) {
      group.timeEnd = 60;
    }

    startNode = getTimelineMemberNodes(group).find(function (node) { return node.axisRole === 'start'; }) || null;
    endNode = getTimelineMemberNodes(group).find(function (node) { return node.axisRole === 'end'; }) || null;

    if (!startNode) {
      startNode = createSegmentNode(group, {
        axisRole: 'start',
        mediaStart: 0,
        mediaEnd: Math.max(1, Number(group.defaultPlayDuration || 15)),
        playDuration: group.defaultPlayDuration,
        label: formatTime(0)
      });
      page.nodes.push(startNode);
      group.members.push(startNode.id);
    }
    if (!endNode) {
      endNode = createSegmentNode(group, {
        axisRole: 'end',
        mediaStart: group.timeEnd,
        mediaEnd: group.timeEnd,
        playDuration: 0,
        label: formatTime(group.timeEnd)
      });
      page.nodes.push(endNode);
      group.members.push(endNode.id);
    }

    startNode.mediaStart = 0;
    startNode.mediaEnd = Math.max(startNode.mediaStart, Number(startNode.mediaEnd || startNode.mediaStart));
    startNode.label = formatTime(startNode.mediaStart);
    delete startNode.name;

    endNode.mediaStart = group.timeEnd;
    endNode.mediaEnd = endNode.mediaStart;
    endNode.playDuration = 0;
    endNode.label = formatTime(endNode.mediaStart);
    delete endNode.name;

    layoutAxisGroup(group);
    return group;
  }

  function normalizeAllAxisGroups(page) {
    ensurePageCollections(page);
    (page.groups || []).forEach(function (group) {
      if (isAxisGroup(group)) {
        normalizeAxisGroup(group);
      }
    });
  }

  function rebuildGraphAndRefresh() {
    var page = getCurrentPage();
    if (page) {
      normalizeAllAxisGroups(page);
    }
    model.setGraphFromCurrentPage();
    wuwei.draw.reRender();
  }

  function resolveSegmentRecord(pointOrId) {
    var point = pointOrId;
    var group;
    if (typeof pointOrId === 'string') {
      point = model.findNodeById(pointOrId) || (graph.nodes || []).find(function (node) {
        return node && node.id === pointOrId;
      }) || null;
    }
    if (!point || !isTimelinePoint(point)) {
      return null;
    }
    group = model.findGroupById(point.groupRef);
    if (!group) {
      return null;
    }
    normalizeAxisGroup(group);
    point = model.findNodeById(point.id) || point;
    return { point: point, group: group, segment: point };
  }

  function findAxisGroupFromSelection() {
    var selected = getSelectedItems();
    var group = selected.groups.find(function (item) { return isAxisGroup(item); }) || null;
    var nodeRecord;
    if (group) {
      normalizeAxisGroup(group);
      return group;
    }
    nodeRecord = selected.nodes.find(function (node) { return isTimelinePoint(node); });
    if (nodeRecord) {
      return model.findGroupById(nodeRecord.groupRef);
    }
    return null;
  }

  function getSelectedTimelinePoint() {
    return getSelectedItems().nodes.find(function (node) { return isTimelinePoint(node); }) || null;
  }

  function getSelectedVideoNode() {
    return getSelectedItems().nodes.find(function (node) {
      return !!model.findNodeById(node.id) && isVideoContent(model.findNodeById(node.id));
    }) || null;
  }

  function defaultAxisOrigin(videoNode) {
    var x = Number.isFinite(Number(videoNode && videoNode.x)) ? Number(videoNode.x) : 0;
    var y = Number.isFinite(Number(videoNode && videoNode.y)) ? Number(videoNode.y) : 0;
    var p = model.newPosition(x, y);
    if (p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y))) {
      return {
        x: Number(p.x),
        y: Number(p.y)
      };
    }
    return { x: x + 90, y: y + 90 };
  }

  function ensureVideoToTimelineStartLink(page, group, videoNode, startNode) {
    var existing;
    var result;
    var link;

    if (!page || !group || !videoNode || !startNode) {
      return null;
    }

    ensurePageCollections(page);

    existing = (page.links || []).find(function (item) {
      var sourceId = (item && item.source && item.source.id) ? item.source.id : item && item.source;
      var targetId = (item && item.target && item.target.id) ? item.target.id : item && item.target;
      return !!(
        item &&
        sourceId === videoNode.id &&
        targetId === startNode.id
      );
    });

    if (existing) {
      existing.visible = true;
      existing.changed = true;
      existing.linkType = existing.linkType || 'timeline-source';
      existing.groupRef = existing.groupRef || group.id;
      return existing;
    }

    result = model.connect(videoNode, startNode);
    link = result && result.param && result.param.link && result.param.link[0];

    if (link) {
      link.visible = true;
      link.changed = true;
      link.linkType = 'timeline-source';
      link.groupRef = group.id;
    }

    return link || null;
  }

  function createAxisGroup(axis, videoCandidate, option) {
    syncRealNodesFromGraph();
    var page = getCurrentPage();
    var videoNode, duration, origin, group, startNode, endNode;
    option = option || {};
    if (!page) {
      return null;
    }
    ensurePageCollections(page);
    videoNode = videoCandidate && videoCandidate.id
      ? (model.findNodeById(videoCandidate.id) || videoCandidate)
      : null;
    videoNode = videoNode || getSelectedVideoNode();
    if (!videoNode) {
      if (!option.silent) {
        window.alert('基準映像を 1 件選択してから timeline を作成してください。');
      }
      return null;
    }

    duration = getMediaDuration(videoNode);
    origin = defaultAxisOrigin(videoNode);//, axis === 'vertical' ? 'vertical' : 'horizontal');
    group = model.createGroup({
      id: makeUuid(),
      name: 'Timeline',
      type: 'timeline',
      groupType: 'axis',
      orientation: axis === 'vertical' ? 'vertical' : 'horizontal',
      mediaRef: videoNode.id,
      defaultPlayDuration: 15,
      spine: { visible: true, color: '#888888', width: 4, padding: 12 },
      axis: { mode: 'manual', unit: 'seconds', start: 0, end: duration, anchor: { x: origin.x, y: origin.y } },
      origin: origin,
      timeStart: 0,
      timeEnd: duration,
      length: 480,
      members: []
    });
    page.groups.push(group);

    startNode = createSegmentNode(group, {
      axisRole: 'start',
      mediaStart: 0,
      mediaEnd: Math.max(1, Number(group.defaultPlayDuration || 15)),
      playDuration: group.defaultPlayDuration,
      label: formatTime(0)
    });

    endNode = createSegmentNode(group, {
      axisRole: 'end',
      mediaStart: duration,
      mediaEnd: duration,
      playDuration: 0,
      label: formatTime(duration)
    });

    page.nodes.push(startNode, endNode);
    setMemberIds(group, [startNode.id, endNode.id]);

    // Video Content → timeline start の Link を作成
    ensureVideoToTimelineStartLink(page, group, videoNode, startNode);

    normalizeAxisGroup(group);
    rebuildGraphAndRefresh();
    markGroupSelected(group);

    resolveMediaDuration(videoNode).then(function (resolved) {
      if (Number.isFinite(Number(resolved)) && Number(resolved) > 0) {
        applyResolvedDurationToAxis(group, Number(resolved));
      }
    });

    return group;
  }

  function addTimePointToGroup(groupOrId, patch) {
    syncRealNodesFromGraph();
    var page = getCurrentPage();
    var group = typeof groupOrId === 'string' ? model.findGroupById(groupOrId) : groupOrId;
    var mediaNode, currentTime, provisionalEnd, mediaStart, segmentNode;
    if (!page || !group) {
      return null;
    }
    ensurePageCollections(page);
    normalizeAxisGroup(group);

    mediaNode = getMediaNodeForGroup(group);
    currentTime = (info && typeof info.getTimelineCurrentTime === 'function')
      ? Number(info.getTimelineCurrentTime() || 0)
      : (Number(group.timeEnd || 0) / 2);

    provisionalEnd = Math.max(Number(group.timeEnd || 0), currentTime);
    if (Number.isFinite(Number(getStoredMediaDuration(mediaNode)))) {
      provisionalEnd = Math.max(provisionalEnd, Number(getStoredMediaDuration(mediaNode)));
    }
    group.timeStart = 0;
    group.timeEnd = provisionalEnd;
    group.axis = group.axis || {};
    group.axis.start = 0;
    group.axis.end = provisionalEnd;

    mediaStart = (patch && Number.isFinite(Number(patch.mediaStart))) ? Number(patch.mediaStart) : currentTime;
    mediaStart = Math.max(0, Math.min(Number(group.timeEnd || 0), mediaStart));

    segmentNode = createSegmentNode(group, {
      axisRole: 'point',
      mediaStart: mediaStart,
      mediaEnd: (patch && Number.isFinite(Number(patch.mediaEnd))) ? Number(patch.mediaEnd) : (mediaStart + Number(group.defaultPlayDuration || 15)),
      playDuration: (patch && Number.isFinite(Number(patch.playDuration))) ? Number(patch.playDuration) : group.defaultPlayDuration,
      label: (patch && patch.label) || formatTime(mediaStart),
      value: patch && typeof patch.value !== 'undefined' ? patch.value : ''
    });

    page.nodes.push(segmentNode);
    group.members.push(segmentNode.id);
    normalizeAxisGroup(group);
    rebuildGraphAndRefresh();
    markNodeSelected(segmentNode);
    return model.findNodeById(segmentNode.id) || segmentNode;
  }

  function addTimePoint() {
    var group = findAxisGroupFromSelection();
    if (!group) {
      return null;
    }
    return addTimePointToGroup(group, null);
  }

  function relayoutAxisGroup(groupOrId) {
    var page = getCurrentPage();
    var group = typeof groupOrId === 'string' ? model.findGroupById(groupOrId) : groupOrId;
    if (!page || !group) {
      return null;
    }
    normalizeAxisGroup(group);
    rebuildGraphAndRefresh();
    return group;
  }

  function updateAxisGroup(groupOrId, patch) {
    var page = getCurrentPage();
    var group = typeof groupOrId === 'string' ? model.findGroupById(groupOrId) : groupOrId;
    var members, startNode, endNode;
    if (!page || !group) {
      return null;
    }
    normalizeAxisGroup(group);
    patch = patch || {};

    group.orientation = patch.orientation === 'vertical' ? 'vertical' : 'horizontal';
    syncAxisEndToStoredDuration(group);
    if (Number.isFinite(Number(patch.length))) {
      group.length = Math.max(60, Number(patch.length));
    }
    if (Number.isFinite(Number(patch.strokeWidth))) {
      group.spine.width = Math.max(1, Number(patch.strokeWidth));
      group.strokeWidth = group.spine.width;
    }
    if (patch.strokeColor) {
      group.spine.color = patch.strokeColor;
      group.strokeColor = patch.strokeColor;
    }
    if (Number.isFinite(Number(patch.defaultPlayDuration))) {
      group.defaultPlayDuration = Math.max(1, Number(patch.defaultPlayDuration));
    }
    group.axis.anchor = group.axis.anchor || {};
    if (Number.isFinite(Number(patch.anchorX))) {
      group.axis.anchor.x = Number(patch.anchorX);
      group.origin.x = Number(patch.anchorX);
    }
    if (Number.isFinite(Number(patch.anchorY))) {
      group.axis.anchor.y = Number(patch.anchorY);
      group.origin.y = Number(patch.anchorY);
    }

    members = getTimelineMemberNodes(group);
    startNode = members.find(function (node) { return node.axisRole === 'start'; }) || null;
    endNode = members.find(function (node) { return node.axisRole === 'end'; }) || null;
    if (startNode) {
      startNode.mediaStart = 0;
      startNode.label = formatTime(0);
      delete startNode.name;
    }
    if (endNode) {
      endNode.mediaStart = group.timeEnd;
      endNode.mediaEnd = group.timeEnd;
      endNode.playDuration = 0;
      endNode.label = formatTime(group.timeEnd);
      delete endNode.name;
    }

    normalizeAxisGroup(group);
    rebuildGraphAndRefresh();
    markGroupSelected(group);
    return group;
  }

  function updateTimePoint(pointOrId, patch) {
    var page = getCurrentPage();
    var record, segment, group;
    if (!page) {
      return null;
    }
    record = resolveSegmentRecord(pointOrId);
    if (!record) {
      return null;
    }
    patch = patch || {};
    segment = record.segment;
    group = record.group;

    if (Number.isFinite(Number(patch.mediaStart))) {
      segment.mediaStart = Math.max(0, Number(patch.mediaStart));
    }
    else if (!Number.isFinite(Number(segment.mediaStart))) {
      segment.mediaStart = 0;
    }

    if (Number.isFinite(Number(patch.mediaEnd))) {
      segment.mediaEnd = Math.max(segment.mediaStart, Number(patch.mediaEnd));
    }
    if (Number.isFinite(Number(patch.playDuration))) {
      segment.playDuration = Math.max(0, Number(patch.playDuration));
    }
    if (!Number.isFinite(Number(segment.mediaEnd))) {
      segment.mediaEnd = segment.mediaStart + Math.max(0, Number(segment.playDuration || group.defaultPlayDuration || 15));
    }
    if (segment.mediaEnd < segment.mediaStart) {
      segment.mediaEnd = segment.mediaStart;
    }
    segment.playDuration = Math.max(0, segment.mediaEnd - segment.mediaStart);

    if (typeof patch.label !== 'undefined') {
      segment.label = patch.label || formatTime(segment.mediaStart);
      delete segment.name;
    }
    if (typeof patch.value !== 'undefined') {
      segment.value = patch.value;
    }

    if (segment.axisRole === 'start') {
      segment.mediaStart = 0;
      group.timeStart = 0;
      group.axis.start = 0;
    }
    else if (segment.axisRole === 'end') {
      group.timeEnd = Math.max(0, segment.mediaStart);
      group.axis.end = group.timeEnd;
      segment.mediaStart = group.timeEnd;
      segment.mediaEnd = group.timeEnd;
      segment.playDuration = 0;
    }
    else if (segment.mediaStart > Number(group.timeEnd || 0)) {
      group.timeEnd = segment.mediaStart;
      group.axis = group.axis || {};
      group.axis.end = group.timeEnd;
    }

    normalizeAxisGroup(group);
    rebuildGraphAndRefresh();
    markNodeSelected(segment);
    return model.findNodeById(segment.id) || segment;
  }

  function deleteTimePoint(pointOrId) {
    var page = getCurrentPage();
    var record;
    if (!page) {
      return false;
    }
    record = resolveSegmentRecord(pointOrId);
    if (!record) {
      return false;
    }
    if (record.segment.axisRole === 'start' || record.segment.axisRole === 'end') {
      return false;
    }
    page.nodes = (page.nodes || []).filter(function (node) {
      return !(node && node.id === record.segment.id);
    });
    setMemberIds(record.group, getMemberIds(record.group).filter(function (id) { return id !== record.segment.id; }));
    normalizeAxisGroup(record.group);
    rebuildGraphAndRefresh();
    markGroupSelected(record.group);
    return true;
  }

  function getTimelinePlaybackSpec(point) {
    var page = getCurrentPage();
    var record, mediaNode, startAt, clipDuration, duration;
    if (!page) {
      return null;
    }
    record = resolveSegmentRecord(point);
    if (!record || !record.group.mediaRef) {
      return null;
    }
    mediaNode = model.findNodeById(record.group.mediaRef);
    if (!mediaNode) {
      return null;
    }
    startAt = Number.isFinite(Number(record.segment.mediaStart)) ? Number(record.segment.mediaStart) : 0;
    clipDuration = Math.max(0, Number(record.segment.playDuration || record.group.defaultPlayDuration || 15));
    duration = getMediaDuration(mediaNode);
    return {
      point: record.segment,
      group: record.group,
      segment: record.segment,
      mediaNode: mediaNode,
      startAt: startAt,
      endAt: Math.min(startAt + clipDuration, duration),
      clipDuration: clipDuration,
      freezeAtEnd: record.segment.axisRole === 'end'
    };
  }

  function getTimelineTargetSpec(target) {
    var page = getCurrentPage();
    var group = null;
    var point = null;
    var mediaNode, startAt, clipDuration, duration;
    if (!page || !target) {
      return null;
    }
    if (isTimelinePoint(target)) {
      point = model.findNodeById(target.id) || target;
      group = model.findGroupById(point.groupRef);
    }
    else if (isTimelineAxisLink(target)) {
      group = model.findGroupById(target.groupRef);
    }
    else if (isAxisGroup(target)) {
      group = target;
    }

    if (!group || !group.mediaRef) {
      return null;
    }

    normalizeAxisGroup(group);
    mediaNode = model.findNodeById(group.mediaRef);
    if (!mediaNode) {
      return null;
    }

    duration = getMediaDuration(mediaNode);
    if (point) {
      startAt = Number.isFinite(Number(point.mediaStart)) ? Number(point.mediaStart) : 0;
      clipDuration = Math.max(0, Number(point.playDuration || group.defaultPlayDuration || 15));
    }
    else {
      startAt = 0;
      clipDuration = Math.max(0, Number(group.defaultPlayDuration || 15));
    }
    
    return {
      target: target,
      point: point,
      group: group,
      mediaNode: mediaNode,
      startAt: startAt,
      endAt: Math.min(startAt + clipDuration, duration),
      clipDuration: clipDuration,
      freezeAtEnd: !!(point && point.axisRole === 'end')
    };
  }

  function confirmSavedRender(target) {
    var page = getCurrentPage();
    var group = null;
    var point = null;
    var axisLink = null;
    if (!page || !target) {
      return false;
    }

    if (isAxisGroup(target) || isTimelineAxisLink(target)) {
      group = isAxisGroup(target) ? target : model.findGroupById(target.groupRef);
      if (!group) {
        return false;
      }
      axisLink = (graph.links || []).find(function (link) {
        return link && link.groupRef === group.id && isTimelineAxisLink(link);
      }) || null;
      if (!axisLink) {
        rebuildGraphAndRefresh();
        axisLink = (graph.links || []).find(function (link) {
          return link && link.groupRef === group.id && isTimelineAxisLink(link);
        }) || null;
      }
      return !!axisLink;
    }

    if (isTimelinePoint(target)) {
      point = model.findNodeById(target.id) || target;
      if (!(graph.nodes || []).some(function (node) { return node && node.id === point.id; })) {
        rebuildGraphAndRefresh();
      }
      return !!(graph.nodes || []).some(function (node) { return node && node.id === point.id; });
    }

    return false;
  }



  function buildTimelineAxisPseudoLink(group) {
    if (!group || false === group.enabled) {
      return null;
    }
    if (!isAxisGroup(group)) {
      return null;
    }
    return {
      id: makeStablePseudoId(group, 'axisPseudoLinkId'),
      type: 'Link',
      pseudo: true,
      shape: (group.orientation === 'vertical') ? 'VERTICAL' : 'HORIZONTAL',
      linkType: 'timeline-axis',
      groupType: 'timelineAxis',
      groupRef: group.id,
      visible: true,
      color: (group.spine && group.spine.color) || group.strokeColor || '#888888',
      size: (group.spine && group.spine.width) || group.strokeWidth || 4,
      font: {
        size: '12pt',
        color: common.Color.linkText,
        family: 'Arial'
      },
      audit: {
        owner: 'guest',
        createdBy: getCurrentOwnerId(),
        createdAt: new Date().toISOString(),
        lastModifiedBy: '',
        lastModifiedAt: ''
      }
    };
  }

  function buildTimelinePseudoLinksForPage(page) {
    var result = [];
    ((page && page.groups) || []).forEach(function (group) {
      var link;
      if (!isAxisGroup(group)) {
        return;
      }
      normalizeAxisGroup(group);
      link = buildTimelineAxisPseudoLink(group);
      if (link) {
        result.push(link);
      }
    });
    return result;
  }

  function ensureYouTubeApi() {
    common._timelineApiPromises = common._timelineApiPromises || {};
    if (window.YT && window.YT.Player) {
      return Promise.resolve();
    }
    if (common._timelineApiPromises.youtube) {
      return common._timelineApiPromises.youtube;
    }
    common._timelineApiPromises.youtube = new Promise(function (resolve, reject) {
      var previousReady = window.onYouTubeIframeAPIReady;
      loadScriptOnce('timeline-youtube-iframe-api', 'https://www.youtube.com/iframe_api', function () {
        return !!(window.YT && window.YT.Player);
      }).then(function () {
        if (window.YT && window.YT.Player) {
          resolve();
          return;
        }
        window.onYouTubeIframeAPIReady = function () {
          if (typeof previousReady === 'function') {
            try { previousReady(); } catch (e) { }
          }
          resolve();
        };
      }).catch(reject);
    });
    return common._timelineApiPromises.youtube;
  }

  function ensureVimeoApi() {
    common._timelineApiPromises = common._timelineApiPromises || {};
    if (window.Vimeo && window.Vimeo.Player) {
      return Promise.resolve();
    }
    if (common._timelineApiPromises.vimeo) {
      return common._timelineApiPromises.vimeo;
    }
    common._timelineApiPromises.vimeo = loadScriptOnce('timeline-vimeo-iframe-api', 'https://player.vimeo.com/api/player.js', function () {
      return !!(window.Vimeo && window.Vimeo.Player);
    });
    return common._timelineApiPromises.vimeo;
  }

  function cleanupEmbeddedPreview(previewState, host) {
    var timer = previewState && (previewState.timer || previewState.timeWatchTimer);
    var kind = previewState && (previewState.kind || previewState.provider || '');
    var player = previewState && (previewState.player || previewState.html5Player || previewState.youtubePlayer || previewState.vimeoPlayer);
    if (timer) {
      clearInterval(timer);
    }
    if (player) {
      try {
        if (kind === 'html5') {
          player.pause();
          player.removeAttribute('src');
          player.load();
        }
        else if (kind === 'youtube') {
          player.destroy();
        }
        else if (kind === 'vimeo') {
          player.unload();
        }
      }
      catch (e) { }
    }
    if (previewState) {
      previewState.timer = null;
      previewState.timeWatchTimer = null;
      previewState.kind = '';
      previewState.provider = '';
      previewState.player = null;
      previewState.html5Player = null;
      previewState.youtubePlayer = null;
      previewState.vimeoPlayer = null;
      previewState.host = null;
      previewState.hostId = '';
    }
    if (host) {
      host.innerHTML = '';
    }
  }

  function startEmbeddedPreviewEndWatch(previewState, provider, api, endSec) {
    var key = (previewState && ('timeWatchTimer' in previewState)) ? 'timeWatchTimer' : 'timer';
    if (previewState && previewState[key]) {
      clearInterval(previewState[key]);
      previewState[key] = null;
    }
    endSec = Number(endSec);
    if (!Number.isFinite(endSec) || endSec <= 0 || !previewState) {
      return;
    }
    previewState[key] = window.setInterval(function () {
      if (!api) {
        clearInterval(previewState[key]);
        previewState[key] = null;
        return;
      }
      if (provider === 'html5') {
        if (Number(api.currentTime || 0) >= endSec) {
          api.pause();
        }
        return;
      }
      if (provider === 'youtube') {
        try {
          if (Number(api.getCurrentTime() || 0) >= endSec) {
            api.pauseVideo();
          }
        }
        catch (e) { }
        return;
      }
      if (provider === 'vimeo') {
        api.getCurrentTime().then(function (sec) {
          if (Number(sec || 0) >= endSec) {
            api.pause().catch(function () { });
          }
        }).catch(function () { });
      }
    }, 200);
  }

  function renderHtml5EmbeddedPreview(host, source, startAt, endAt, previewState) {
    var html = '<video controls playsinline preload="metadata" autoplay style="width:100%;height:auto;display:block;" src="' + String(source.src).replace(/"/g, '&quot;') + '"></video>';
    host.innerHTML = html;
    var video = host.querySelector('video');
    if (!previewState) { previewState = {}; }
    previewState.kind = previewState.provider = 'html5';
    previewState.player = previewState.html5Player = video;
    previewState.host = host;
    if (!video) {
      return video;
    }
    video.addEventListener('loadedmetadata', function onMeta() {
      var p;
      video.removeEventListener('loadedmetadata', onMeta);
      try { video.currentTime = Number(startAt || 0); } catch (e) { }
      startEmbeddedPreviewEndWatch(previewState, 'html5', video, endAt);
      p = video.play();
      if (p && typeof p.catch === 'function') {
        p.catch(function () { });
      }
    });
    return video;
  }

  function renderYouTubeEmbeddedPreview(host, source, startAt, endAt, previewState) {
    return ensureYouTubeApi().then(function () {
      var holderId = 'timelinePreviewYT_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
      host.innerHTML = '<div id="' + holderId + '" style="width:100%;aspect-ratio:16/9;"></div>';
      if (!previewState) { previewState = {}; }
      previewState.kind = previewState.provider = 'youtube';
      previewState.host = host;
      previewState.hostId = holderId;
      previewState.player = previewState.youtubePlayer = new YT.Player(holderId, {
        videoId: source.id,
        playerVars: {
          autoplay: 1,
          controls: 1,
          playsinline: 1,
          rel: 0,
          start: Math.floor(Number(startAt || 0)),
          end: Math.floor(Number(endAt || 0)),
          enablejsapi: 1,
          origin: location.origin
        },
        events: {
          onReady: function (ev) {
            try { ev.target.seekTo(Number(startAt || 0), true); } catch (e) { }
            try { ev.target.playVideo(); } catch (e) { }
            startEmbeddedPreviewEndWatch(previewState, 'youtube', ev.target, endAt);
          }
        }
      });
      return previewState.youtubePlayer;
    });
  }

  function renderVimeoEmbeddedPreview(host, source, startAt, endAt, previewState) {
    return ensureVimeoApi().then(function () {
      var player;
      host.innerHTML = '';
      player = new window.Vimeo.Player(host, {
        url: source.url,
        autoplay: true,
        controls: true,
        responsive: true,
        title: false,
        byline: false,
        portrait: false
      });
      if (!previewState) { previewState = {}; }
      previewState.kind = previewState.provider = 'vimeo';
      previewState.player = previewState.vimeoPlayer = player;
      previewState.host = host;
      player.ready().then(function () {
        return player.setCurrentTime(Number(startAt || 0));
      }).then(function () {
        return player.play();
      }).catch(function () { });
      player.on('timeupdate', function (data) {
        var current = Number(data && data.seconds || 0);
        if (current >= Number(endAt || 0)) {
          player.pause().catch(function () { });
        }
      });
      return player;
    });
  }

  function syncAxisEndToMediaDuration(group) {
    return syncAxisEndToStoredDuration(group);
  }

  function updateTimelineAxisGeometryByEndpointDrag(group, pageNode, x, y) {
    var axis, orientation, minLength;
    var startPos, endPos;
    var nextStartPos, nextEndPos;
    var nextLength;

    if (!group || !group.axis || !pageNode) {
      return false;
    }

    axis = group.axis;
    orientation = (group.orientation === 'vertical') ? 'vertical' : 'horizontal';
    minLength = 24;

    axis.anchor = axis.anchor || { x: 0, y: 0 };
    group.origin = group.origin || {
      x: Number(axis.anchor.x || 0),
      y: Number(axis.anchor.y || 0)
    };
    group.length = Math.max(60, Number(group.length || 480));

    if (orientation === 'horizontal') {
      startPos = Number(axis.anchor.x || 0);
      endPos = startPos + Number(group.length || 0);

      if (pageNode.axisRole === 'start') {
        nextStartPos = Math.min(Number(x || 0), endPos - minLength);
        nextLength = endPos - nextStartPos;

        axis.anchor.x = nextStartPos;
        group.origin.x = nextStartPos;
        group.length = Math.max(minLength, nextLength);
        return true;
      }

      if (pageNode.axisRole === 'end') {
        nextEndPos = Math.max(Number(x || 0), startPos + minLength);
        group.length = Math.max(minLength, nextEndPos - startPos);
        return true;
      }

      return false;
    }

    startPos = Number(axis.anchor.y || 0);
    endPos = startPos + Number(group.length || 0);

    if (pageNode.axisRole === 'start') {
      nextStartPos = Math.min(Number(y || 0), endPos - minLength);
      nextLength = endPos - nextStartPos;

      axis.anchor.y = nextStartPos;
      group.origin.y = nextStartPos;
      group.length = Math.max(minLength, nextLength);
      return true;
    }

    if (pageNode.axisRole === 'end') {
      nextEndPos = Math.max(Number(y || 0), startPos + minLength);
      group.length = Math.max(minLength, nextEndPos - startPos);
      return true;
    }

    return false;
  }

  function updateTimelineSegmentTimeFromPosition(group, pageNode, x, y) {
    var axis, orientation, axisStartTime, axisEndTime, axisLength, ratio, nextStart;
    if (!group || !group.axis || !pageNode) {
      return false;
    }
    axis = group.axis;
    orientation = group.orientation || 'horizontal';
    axisStartTime = 0;
    axisEndTime = Number(group.timeEnd || axis.end || 0);
    axisLength = Math.max(1, Number(group.length || 1));
    axis.anchor = axis.anchor || { x: 0, y: 0 };
    if (orientation === 'horizontal') {
      ratio = (x - Number(axis.anchor.x || 0)) / axisLength;
    }
    else {
      ratio = (y - Number(axis.anchor.y || 0)) / axisLength;
    }
    ratio = Math.max(0, Math.min(1, ratio));
    nextStart = axisStartTime + ((axisEndTime - axisStartTime) * ratio);
    pageNode.mediaStart = nextStart;
    if (!Number.isFinite(Number(pageNode.mediaEnd)) || Number(pageNode.mediaEnd) < nextStart) {
      pageNode.mediaEnd = nextStart + Math.max(0, Number(pageNode.playDuration || group.defaultPlayDuration || 15));
    }
    pageNode.playDuration = Math.max(0, Number(pageNode.mediaEnd) - nextStart);
    pageNode.label = pageNode.label || formatTime(nextStart);
    delete pageNode.name;
    return true;
  }

  function handleSegmentDrag(nodeOrId, eventX, eventY) {
    var pageNode = (typeof nodeOrId === 'string') ? model.findNodeById(nodeOrId) : (nodeOrId && nodeOrId.id ? (model.findNodeById(nodeOrId.id) || nodeOrId) : null);
    var group;
    var handled;
    if (!pageNode || !isTimelinePoint(pageNode)) {
      return false;
    }
    group = model.findGroupById(pageNode.groupRef);
    if (!group || !isAxisGroup(group)) {
      return false;
    }
    normalizeAxisGroup(group);
    if (pageNode.axisRole === 'start' || pageNode.axisRole === 'end') {
      handled = updateTimelineAxisGeometryByEndpointDrag(group, pageNode, Number(eventX || 0), Number(eventY || 0));
    }
    else {
      handled = updateTimelineSegmentTimeFromPosition(group, pageNode, Number(eventX || 0), Number(eventY || 0));
    }
    if (!handled) {
      return false;
    }
    if (model && typeof model.pruneGroups === 'function') {
      model.pruneGroups();
    }
    if (model && typeof model.setGraphFromCurrentPage === 'function') {
      model.setGraphFromCurrentPage();
    }
    return true;
  }


  ns.buildTimelineAxisPseudoLink = buildTimelineAxisPseudoLink;
  ns.buildTimelinePseudoLinksForPage = buildTimelinePseudoLinksForPage;
  ns.ensureYouTubeApi = ensureYouTubeApi;
  ns.ensureVimeoApi = ensureVimeoApi;
  ns.cleanupEmbeddedPreview = cleanupEmbeddedPreview;
  ns.startEmbeddedPreviewEndWatch = startEmbeddedPreviewEndWatch;
  ns.renderHtml5EmbeddedPreview = renderHtml5EmbeddedPreview;
  ns.renderYouTubeEmbeddedPreview = renderYouTubeEmbeddedPreview;
  ns.renderVimeoEmbeddedPreview = renderVimeoEmbeddedPreview;
  ns.syncAxisEndToMediaDuration = syncAxisEndToMediaDuration;
  ns.updateTimelineAxisGeometryByEndpointDrag = updateTimelineAxisGeometryByEndpointDrag;
  ns.updateTimelineSegmentTimeFromPosition = updateTimelineSegmentTimeFromPosition;
  ns.handleSegmentDrag = handleSegmentDrag;

  ns.toAbsUrl = toAbsUrl;
  ns.isHostedYouTube = isHostedYouTube;
  ns.isHostedVimeo = isHostedVimeo;
  ns.isHostedVideoUrl = isHostedVideoUrl;
  ns.extractYouTubeId = extractYouTubeId;
  ns.extractVimeoInfo = extractVimeoInfo;
  ns.detectMediaSource = detectMediaSource;
  ns.getCurrentPage = getCurrentPage;
  ns.ensurePageCollections = ensurePageCollections;
  ns.syncRealNodesFromGraph = syncRealNodesFromGraph;
  // ns.reRender = reRender;
  ns.formatTime = formatTime;
  ns.isAxisGroup = isAxisGroup;
  ns.isTimelinePoint = isTimelinePoint;
  ns.isTimelineAxisLink = isTimelineAxisLink;
  ns.getSelectedItems = getSelectedItems;
  ns.findAxisGroupFromSelection = findAxisGroupFromSelection;
  ns.getSelectedTimelinePoint = getSelectedTimelinePoint;
  ns.getSelectedVideoNode = getSelectedVideoNode;
  ns.getMediaNodeForGroup = getMediaNodeForGroup;
  ns.getStoredMediaDuration = getStoredMediaDuration;
  ns.getMediaDuration = getMediaDuration;
  ns.resolveMediaDuration = resolveMediaDuration;
  ns.applyResolvedDurationToAxis = applyResolvedDurationToAxis;
  ns.syncAxisEndToStoredDuration = syncAxisEndToStoredDuration;
  ns.createSegmentNode = createSegmentNode;
  ns.ensureSegmentNodeDefaults = ensureSegmentNodeDefaults;
  ns.sortTimelineMembers = sortTimelineMembers;
  ns.layoutAxisGroup = layoutAxisGroup;
  ns.normalizeAxisGroup = normalizeAxisGroup;
  ns.normalizeAllAxisGroups = normalizeAllAxisGroups;
  ns.rebuildGraphAndRefresh = rebuildGraphAndRefresh;
  ns.resolveSegmentRecord = resolveSegmentRecord;
  ns.createAxisGroup = createAxisGroup;
  ns.addTimePoint = addTimePoint;
  ns.addTimePointToGroup = addTimePointToGroup;
  ns.relayoutAxisGroup = relayoutAxisGroup;
  ns.updateAxisGroup = updateAxisGroup;
  ns.updateTimePoint = updateTimePoint;
  ns.deleteTimePoint = deleteTimePoint;
  ns.getTimelinePlaybackSpec = getTimelinePlaybackSpec;
  ns.getTimelineTargetSpec = getTimelineTargetSpec;
  ns.confirmSavedRender = confirmSavedRender;
})(wuwei.timeline);
// wuwei.timeline.js last modified 2026-04-18
