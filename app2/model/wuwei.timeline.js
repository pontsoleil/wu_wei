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
 * Time meaning and layout:
 * - axis start is always 0
 * - mediaStart/mediaEnd are semantic playback values
 * - axisPos is the editable position on the visual axis
 * - drag updates axisPos, not mediaStart/mediaEnd
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


  function expandNodeRuntimeStyle(node) {
    if (wuwei && wuwei.style &&
        typeof wuwei.style.expandNodeRuntimeStyle === 'function') {
      wuwei.style.expandNodeRuntimeStyle(node);
    }
    else if (wuwei && wuwei.note && wuwei.note.v2 &&
        typeof wuwei.note.v2.expandNodeRuntimeStyle === 'function') {
      wuwei.note.v2.expandNodeRuntimeStyle(node);
    }
    return node;
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


  function isGenericGroup(group) {
    return !!(group && (
      group.type === 'simple' ||
      group.type === 'horizontal' ||
      group.type === 'vertical'
    ));
  }

  function getParentGenericGroupIdForNode(nodeId) {
    var groups;
    if (!nodeId || !model || typeof model.findGroupsByNodeId !== 'function') {
      return '';
    }
    groups = model.findGroupsByNodeId(nodeId).filter(isGenericGroup);
    return groups.length ? groups[0].id : '';
  }

  function getTimelineGroupTargetNodeId(group) {
    if (!group) { return ''; }
    return group.targetNodeId || group.mediaRef || (group.timeline && group.timeline.mediaRef) || '';
  }

  function getAttachedTimelineGroupsForNode(nodeOrId) {
    var nodeId = (typeof nodeOrId === 'string') ? nodeOrId : (nodeOrId && nodeOrId.id);
    var page = getCurrentPage();
    if (!nodeId || !page || !Array.isArray(page.groups)) {
      return [];
    }
    return page.groups.filter(function (group) {
      return group && group.type === 'timeline' && getTimelineGroupTargetNodeId(group) === nodeId;
    });
  }

  function hasAttachedTimelineGroup(nodeOrId) {
    return getAttachedTimelineGroupsForNode(nodeOrId).length > 0;
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
    var uri;
    var subtype;
    if (!node || node.type !== 'Content') {
      return false;
    }
    resource = node.resource || {};
    if (resource.kind === 'video') {
      return true;
    }
    uri = getMediaSourceUrl(node).toLowerCase();
    subtype = String(resource.videoKind || '').toLowerCase();
    return (
      (util && typeof util.isDocumentKindByExtension === 'function' &&
        util.isDocumentKindByExtension(node, resource, uri, 'video')) ||
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

  function clearSelectionState() {
    clearDomNodeSelection();
    state.selectedNodeIds = [];
    state.selectedGroupIds = [];
    state.selectedGroupMarks = {};
    if (draw && typeof draw.renderSelectionMarks === 'function') {
      draw.renderSelectionMarks();
    }
  }

  function hasEditableSegments(group) {
    return getTimelineMemberNodes(group).some(function (node) {
      return node && node.axisRole !== 'start' && node.axisRole !== 'end';
    });
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

  function makeGroupMember(nodeId, index, role) {
    return {
      nodeId: nodeId,
      order: index + 1,
      role: role || 'member'
    };
  }

  function getMemberIds(group) {
    if (!group || !Array.isArray(group.members)) {
      return [];
    }
    return group.members.map(function (member) {
      return member && member.nodeId;
    }).filter(Boolean);
  }

  function setMemberIds(group, ids) {
    group.members = (ids || []).filter(Boolean).map(function (id, index) {
      return makeGroupMember(id, index, 'member');
    });
  }

  function appendMember(group, nodeId, role) {
    if (!group || !nodeId) { return; }
    if (!Array.isArray(group.members)) { group.members = []; }
    if (getMemberIds(group).indexOf(nodeId) < 0) {
      group.members.push(makeGroupMember(nodeId, group.members.length, role || 'member'));
    }
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
      m = u.pathname.match(/\/(?:video\/)?([0-9]+)(?:\/([A-Za-z0-9_-]+))?/);
      if (m) {
        out.id = m[1];
        out.h = out.h || m[2] || '';
      }
    }
    catch (e) {
      m = out.url.match(/vimeo\.com\/(?:video\/)?([0-9]+)(?:\/([A-Za-z0-9_-]+))?/);
      if (m) {
        out.id = m[1];
        out.h = out.h || m[2] || '';
      }
    }
    return out;
  }

  function getMediaSourceUrl(videoNode) {
    var resource = (videoNode && videoNode.resource) || {};
    return String((resource.original && resource.original.url) || (resource.original && resource.original.url) || resource.uri || resource.canonicalUri || '');
  }

  function detectMediaSource(videoNode) {
    var resource = (videoNode && videoNode.resource) || {};
    var source;
    var url = getMediaSourceUrl(videoNode);
    var subtype = String(resource.videoKind || '').toLowerCase();
    var vimeo;

    if (wuwei.video && typeof wuwei.video.detectSource === 'function') {
      source = wuwei.video.detectSource(videoNode);
      if (source && source.provider && source.provider !== 'unknown') {
        return source;
      }
    }
    if (subtype === 'youtube' || isHostedYouTube(url)) {
      return { provider: 'youtube', id: extractYouTubeId(url), url: url };
    }
    if (subtype === 'vimeo' || isHostedVimeo(url)) {
      vimeo = extractVimeoInfo(url);
      return { provider: 'vimeo', id: vimeo.id, h: vimeo.h, url: vimeo.url };
    }
    if (util && typeof util.isDocumentKindByExtension === 'function' &&
      util.isDocumentKindByExtension(videoNode, resource, url, 'video')) {
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

  function getDefaultPlayDuration(group) {
    var value = group && Number(group.defaultPlayDuration);
    if (!Number.isFinite(value) && group && group.timeline) {
      value = Number(group.timeline.defaultPlayDuration);
    }
    return Math.max(1, Number.isFinite(value) ? value : 15);
  }

  function getDefaultEndSegmentStart(group, fixedEnd) {
    fixedEnd = Math.max(0, Number(fixedEnd || 0));
    return Math.max(0, fixedEnd - getDefaultPlayDuration(group));
  }

  function resolveEndSegmentStart(group, node, fixedEnd) {
    var mediaStart;
    var playDuration;
    fixedEnd = Math.max(0, Number(fixedEnd || 0));
    mediaStart = Number(node && node.mediaStart);
    playDuration = Number(node && node.playDuration);

    if (!Number.isFinite(mediaStart) || mediaStart < 0 || mediaStart > fixedEnd) {
      return getDefaultEndSegmentStart(group, fixedEnd);
    }

    /*
     * The end Segment has a fixed end time, but its start time represents
     * the clip start.  Old data and earlier implementations stored both
     * mediaStart and mediaEnd at the media end, resulting in a zero-length
     * final Segment.  Treat that case as missing and restore the default
     * start at (media end - defaultPlayDuration).
     */
    if (mediaStart >= fixedEnd && (!Number.isFinite(playDuration) || playDuration <= 0)) {
      return getDefaultEndSegmentStart(group, fixedEnd);
    }

    return Math.max(0, Math.min(fixedEnd, mediaStart));
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
      description: (param.description && typeof param.description === 'object')
        ? util.clone(param.description)
        : { format: 'plain/text', body: '' },
      shape: 'CIRCLE',
      size: { radius: 20 },
      color: (param.axisRole === 'point') ? common.Color.nodeFill : '#fff8d8',
      outline: (param.axisRole === 'point') ? common.Color.nodeOutline : '#b08a00',
      style: {
        font: common.defaultFont,
        line: {
          kind: 'SOLID',
          color: (param.axisRole === 'point') ? common.Color.nodeOutline : '#b08a00',
          width: 1
        }
      },
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
    node.description = (node.description && typeof node.description === 'object')
      ? node.description
      : { format: 'plain/text', body: '' };
    node.shape = 'CIRCLE';
    node.size = { radius: Number((node.size && node.size.radius) || 20) };
    node.style = (node.style && 'object' === typeof node.style) ? node.style : {};
    node.style.fill = node.style.fill || node.color || ((node.axisRole === 'point') ? common.Color.nodeFill : '#fff8d8');
    node.style.font = node.style.font || common.defaultFont;
    node.style.line = (node.style.line && 'object' === typeof node.style.line) ? node.style.line : {};
    node.style.line.kind = node.style.line.kind || 'SOLID';
    node.style.line.color = node.style.line.color || node.outline || ((node.axisRole === 'point') ? common.Color.nodeOutline : '#b08a00');
    node.style.line.width = Math.max(0, Number(node.style.line.width || node.outlineWidth || 1));
    expandNodeRuntimeStyle(node);
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
    return;
  }

  function axisOrientation(group) {
    return (group && group.orientation === 'vertical') ? 'vertical' : 'horizontal';
  }

  function finiteNumber(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function axisAnchor(group) {
    var axis = (group && group.axis) || {};
    return {
      x: (axis.anchor && Number.isFinite(Number(axis.anchor.x))) ? Number(axis.anchor.x) : ((group && group.origin && Number.isFinite(Number(group.origin.x))) ? Number(group.origin.x) : 0),
      y: (axis.anchor && Number.isFinite(Number(axis.anchor.y))) ? Number(axis.anchor.y) : ((group && group.origin && Number.isFinite(Number(group.origin.y))) ? Number(group.origin.y) : 0)
    };
  }

  function representativeAxisAnchor(group) {
    var representative = getTimelineRepresentativeNode(group);
    var fallback = axisAnchor(group);

    if (representative &&
      Number.isFinite(Number(representative.x)) &&
      Number.isFinite(Number(representative.y))) {
      return { x: Number(representative.x), y: Number(representative.y) };
    }
    return fallback;
  }

  function setAxisAnchor(group, anchor) {
    anchor = anchor || axisAnchor(group);
    group.axis = group.axis || {};
    group.axis.anchor = {
      x: finiteNumber(anchor.x, 0),
      y: finiteNumber(anchor.y, 0)
    };
    group.origin = {
      x: group.axis.anchor.x,
      y: group.axis.anchor.y
    };
    return group.axis.anchor;
  }

  function axisScalarForOrientation(orientation, node, fallback) {
    if (Number.isFinite(Number(node && node.axisPos))) {
      return Number(node.axisPos);
    }
    if (orientation === 'vertical') {
      return finiteNumber(node && node.y, fallback);
    }
    return finiteNumber(node && node.x, fallback);
  }

  function syncAxisStartToRepresentative(group) {
    var oldAnchor;
    var anchor;
    var orientation;
    var oldAnchorPos;
    var newAnchorPos;
    var delta;

    if (!group) {
      return null;
    }

    oldAnchor = axisAnchor(group);
    anchor = representativeAxisAnchor(group);
    orientation = axisOrientation(group);
    oldAnchorPos = orientation === 'vertical' ? finiteNumber(oldAnchor.y, 0) : finiteNumber(oldAnchor.x, 0);
    newAnchorPos = orientation === 'vertical' ? finiteNumber(anchor.y, 0) : finiteNumber(anchor.x, 0);
    delta = newAnchorPos - oldAnchorPos;

    if (Number.isFinite(delta) && Math.abs(delta) > 0.0001) {
      getTimelineMemberNodes(group).forEach(function (node) {
        if (!node) { return; }
        if (Number.isFinite(Number(node.axisPos))) {
          node.axisPos = Number(node.axisPos) + delta;
        }
        else if (orientation === 'vertical' && Number.isFinite(Number(node.y))) {
          node.axisPos = Number(node.y) + delta;
        }
        else if (orientation === 'horizontal' && Number.isFinite(Number(node.x))) {
          node.axisPos = Number(node.x) + delta;
        }
      });
    }

    setAxisAnchor(group, anchor);
    return anchor;
  }

  function rotateTimelineMembersToOrientation(group, previousOrientation, nextOrientation, previousAnchor, nextAnchor) {
    var oldAnchorPos;
    var newAnchorPos;

    if (!group || previousOrientation === nextOrientation) {
      return false;
    }

    previousOrientation = previousOrientation === 'vertical' ? 'vertical' : 'horizontal';
    nextOrientation = nextOrientation === 'vertical' ? 'vertical' : 'horizontal';
    previousAnchor = previousAnchor || axisAnchor(group);
    nextAnchor = nextAnchor || representativeAxisAnchor(group);
    oldAnchorPos = previousOrientation === 'vertical' ? finiteNumber(previousAnchor.y, 0) : finiteNumber(previousAnchor.x, 0);
    newAnchorPos = nextOrientation === 'vertical' ? finiteNumber(nextAnchor.y, 0) : finiteNumber(nextAnchor.x, 0);

    group.orientation = nextOrientation;
    setAxisAnchor(group, nextAnchor);

    getTimelineMemberNodes(group).forEach(function (node) {
      var oldPos;
      var delta;

      oldPos = axisScalarForOrientation(previousOrientation, node, oldAnchorPos);
      delta = Number.isFinite(Number(oldPos)) ? (Number(oldPos) - oldAnchorPos) : 0;
      if (node.axisRole === 'start') {
        delta = 0;
      }
      setNodeOnAxis(group, node, newAnchorPos + delta);
    });
    return true;
  }

  function axisScalar(group, x, y) {
    return axisOrientation(group) === 'vertical' ? Number(y || 0) : Number(x || 0);
  }

  function getAxisPos(group, node) {
    var value = Number(node && node.axisPos);
    if (Number.isFinite(value)) {
      return value;
    }
    return axisOrientation(group) === 'vertical' ? Number(node && node.y || 0) : Number(node && node.x || 0);
  }

  function setNodeOnAxis(group, node, axisPos) {
    var anchor = axisAnchor(group);
    axisPos = Number(axisPos);
    if (!Number.isFinite(axisPos)) {
      axisPos = axisOrientation(group) === 'vertical' ? anchor.y : anchor.x;
    }
    node.axisPos = axisPos;
    if (axisOrientation(group) === 'vertical') {
      node.x = anchor.x;
      node.y = axisPos;
    }
    else {
      node.x = axisPos;
      node.y = anchor.y;
    }
    node.fx = node.x;
    node.fy = node.y;
    node.vx = 0;
    node.vy = 0;
    node.changed = true;
  }

  function timelineRatio(group, node, start, end) {
    var range = Math.max(end - start, 0.0001);
    var mediaStart;
    if (node.axisRole === 'start') {
      return 0;
    }
    if (node.axisRole === 'end') {
      return 1;
    }
    mediaStart = Number.isFinite(Number(node.mediaStart)) ? Number(node.mediaStart) : start;
    return Math.max(0, Math.min(1, (mediaStart - start) / range));
  }

  function assignMissingAxisPositions(group, members, start, end) {
    var anchor = axisAnchor(group);
    var anchorPos = axisOrientation(group) === 'vertical' ? anchor.y : anchor.x;
    var length = Math.max(60, Number(group.length || 480));
    var gap = Math.max(40, Number(group.axisGap || 80));
    var anyPositioned = members.some(function (node) {
      return Number.isFinite(Number(node.axisPos));
    });

    if (!anyPositioned) {
      members.forEach(function (node) {
        node.axisPos = anchorPos + (length * timelineRatio(group, node, start, end));
      });
      return;
    }

    members.forEach(function (node, index) {
      var prev, next, i;
      if (Number.isFinite(Number(node.axisPos))) {
        node.axisPos = Number(node.axisPos);
        return;
      }
      for (i = index - 1; i >= 0; i -= 1) {
        if (Number.isFinite(Number(members[i].axisPos))) {
          prev = members[i];
          break;
        }
      }
      for (i = index + 1; i < members.length; i += 1) {
        if (Number.isFinite(Number(members[i].axisPos))) {
          next = members[i];
          break;
        }
      }
      if (prev && next) {
        node.axisPos = (Number(prev.axisPos) + Number(next.axisPos)) / 2;
      }
      else if (prev) {
        node.axisPos = Number(prev.axisPos) + gap;
      }
      else if (next) {
        node.axisPos = Number(next.axisPos) - gap;
      }
      else {
        node.axisPos = anchorPos + (length * timelineRatio(group, node, start, end));
      }
    });
  }

  function updateAxisBoundsFromPositions(group) {
    var members, orientation, anchor, anchorPos, positions, maxPos, minLength, startNode;
    var startPos;
    if (!group) {
      return false;
    }
    group.axis = group.axis || {};
    anchor = axisAnchor(group);
    members = getTimelineMemberNodes(group);
    orientation = axisOrientation(group);
    anchorPos = orientation === 'vertical' ? finiteNumber(anchor.y, 0) : finiteNumber(anchor.x, 0);
    startNode = members.find(function (node) { return node && node.axisRole === 'start'; }) || null;

    /*
     * The representative topic is independent from the axis.  The axis start is
     * independent as well: dragging the start endpoint moves the axis anchor and
     * recalculates the stored axis length from the remaining endpoint/member
     * positions.  Dragging the end endpoint keeps the anchor and only changes
     * the stored length.
     */
    if (startNode) {
      startPos = getAxisPos(group, startNode);
      if (Number.isFinite(Number(startPos)) && Math.abs(Number(startPos) - anchorPos) > 0.0001) {
        if (orientation === 'vertical') {
          anchor.y = Number(startPos);
        }
        else {
          anchor.x = Number(startPos);
        }
        setAxisAnchor(group, anchor);
        anchorPos = Number(startPos);
        startNode.axisPos = anchorPos;
      }
    }

    positions = members.map(function (node) {
      if (!node) {
        return null;
      }
      if (node.axisRole === 'start') {
        return anchorPos;
      }
      if (Number.isFinite(Number(node.axisPos))) {
        return Number(node.axisPos);
      }
      return orientation === 'vertical' ? Number(node.y) : Number(node.x);
    }).filter(function (value) {
      return Number.isFinite(value);
    });

    if (!positions.length) {
      group.length = Math.max(60, Number(group.length || 480));
      return false;
    }

    maxPos = Math.max.apply(null, positions.concat([anchorPos]));
    minLength = Math.max(60, Number(group.minAxisLength || 60));
    group.length = Math.max(minLength, maxPos - anchorPos);
    return true;
  }

  function layoutAxisGroup(group) {
    var axis, start, end, length, anchor, members;
    if (!group) {
      return null;
    }

    syncAxisEndToStoredDuration(group);

    axis = group.axis || {};
    start = 0;
    end = Number.isFinite(Number(group.timeEnd)) ? Number(group.timeEnd) : Number(axis.end || 0);
    end = Math.max(start, end);
    length = Math.max(60, Number(group.length || 480));
    anchor = axisAnchor(group);

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

      ensureSegmentNodeDefaults(group, node, node.order || 0);
      if (node.axisRole === 'start') {
        node.mediaStart = start;
        node.mediaEnd = Math.max(start, Number(node.mediaEnd || start));
        node.axisPos = axisOrientation(group) === 'vertical' ? anchor.y : anchor.x;
      }
      else if (node.axisRole === 'end') {
        mediaStart = resolveEndSegmentStart(group, node, end);
        node.mediaStart = Math.max(start, Math.min(end, mediaStart));
        node.mediaEnd = end;
        node.playDuration = Math.max(0, node.mediaEnd - node.mediaStart);
        node.axisPos = (axisOrientation(group) === 'vertical' ? anchor.y : anchor.x) + length;
      }
      else {
        mediaStart = Number.isFinite(Number(node.mediaStart)) ? Number(node.mediaStart) : start;
        node.mediaStart = Math.max(start, Math.min(end, mediaStart));
      }

      if (node.axisRole !== 'end' &&
        (!Number.isFinite(Number(node.mediaEnd)) || Number(node.mediaEnd) < node.mediaStart)) {
        node.mediaEnd = node.mediaStart + Math.max(0, Number(node.playDuration || group.defaultPlayDuration || 15));
      }
      node.playDuration = Math.max(0, node.mediaEnd - node.mediaStart);
    });

    assignMissingAxisPositions(group, members, start, end);
    members.forEach(function (node) {
      setNodeOnAxis(group, node, getAxisPos(group, node));
    });

    return group;
  }

  function normalizeAxisGroup(group) {
    var page = getCurrentPage();
    var allSegmentNodes;
    var startNode;
    var endNode;
    var sourceLink;
    var mediaNode;
    if (!group) {
      return null;
    }

    ensurePageCollections(page);
    group.type = 'timeline';
    group.groupType = 'axis';
    group.targetNodeId = group.targetNodeId || group.mediaRef || (group.timeline && group.timeline.mediaRef) || '';
    if (!group.mediaRef && group.targetNodeId) {
      group.mediaRef = group.targetNodeId;
    }
    if (!group.parentGroupId && group.targetNodeId) {
      group.parentGroupId = getParentGenericGroupIdForNode(group.targetNodeId);
    }
    group.hierarchical = true;
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
    group.targetNodeId = group.targetNodeId || group.mediaRef || '';
    if (!group.parentGroupId && group.targetNodeId) {
      group.parentGroupId = getParentGenericGroupIdForNode(group.targetNodeId);
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
    group.axis.mode = 'video';
    group.axis.unit = group.axis.unit || 'seconds';
    group.axis.anchor = group.axis.anchor || {};
    if (!Number.isFinite(Number(group.axis.anchor.x))) {
      group.axis.anchor.x = Number.isFinite(Number(group.origin && group.origin.x)) ? Number(group.origin.x) : 0;
    }
    if (!Number.isFinite(Number(group.axis.anchor.y))) {
      group.axis.anchor.y = Number.isFinite(Number(group.origin && group.origin.y)) ? Number(group.origin.y) : 0;
    }
    group.origin = group.origin || { x: Number(group.axis.anchor.x || 0), y: Number(group.axis.anchor.y || 0) };
    if (model && typeof model.ensureGroupRepresentativeTopic === 'function') {
      model.ensureGroupRepresentativeTopic(group, {
        topicKind: 'timeline-representative',
        label: group.name || 'Timeline'
      });
    }
    mediaNode = getMediaNodeForGroup(group);
    if (mediaNode) {
      ensureVideoToTimelineRepresentativeLink(page, group, mediaNode);
    }

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
      appendMember(group, startNode.id, 'member');
    }
    if (!endNode) {
      endNode = createSegmentNode(group, {
        axisRole: 'end',
        mediaStart: getDefaultEndSegmentStart(group, group.timeEnd),
        mediaEnd: group.timeEnd,
        playDuration: Math.max(0, Number(group.timeEnd || 0) - getDefaultEndSegmentStart(group, group.timeEnd)),
        label: formatTime(group.timeEnd)
      });
      page.nodes.push(endNode);
      appendMember(group, endNode.id, 'member');
    }

    startNode.mediaStart = 0;
    startNode.mediaEnd = Math.max(startNode.mediaStart, Number(startNode.mediaEnd || startNode.mediaStart));
    startNode.label = formatTime(startNode.mediaStart);
    delete startNode.name;

    endNode.mediaStart = resolveEndSegmentStart(group, endNode, group.timeEnd);
    endNode.mediaEnd = group.timeEnd;
    endNode.playDuration = Math.max(0, endNode.mediaEnd - endNode.mediaStart);
    endNode.label = endNode.label || formatTime(group.timeEnd);
    delete endNode.name;

    ensureTimelineRepresentativeEntryLink(page, group);

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

  function getTimelineRepresentativeNode(group) {
    var representative;
    if (!group) {
      return null;
    }
    representative = group.representativeNodeId ? model.findNodeById(group.representativeNodeId) : null;
    if (!representative && model && typeof model.ensureGroupRepresentativeTopic === 'function') {
      representative = model.ensureGroupRepresentativeTopic(group, {
        topicKind: 'timeline-representative',
        label: group.name || 'Timeline'
      });
    }
    return representative || null;
  }

  function getLinkSourceId(link) {
    if (!link) { return ''; }
    return link.from ? ((link.from && link.from.id) ? link.from.id : link.from) : '';
  }

  function getLinkTargetId(link) {
    if (!link) { return ''; }
    return link.to ? ((link.to && link.to.id) ? link.to.id : link.to) : '';
  }

  function setLinkTargetId(link, id) {
    if (!link || !id) { return; }
    link.to = id;

  }

  function isTimelineSourceLinkForGroup(link, group, videoNode) {
    var sourceId;
    if (!link || !group || !videoNode) {
      return false;
    }
    sourceId = getLinkSourceId(link);
    return !!(
      sourceId === videoNode.id &&
      (
        link.groupRef === group.id ||
        link.linkType === 'timeline-source' ||
        link.relation === 'timeline'
      )
    );
  }


  function makeTimelineRepresentativeEntryLink(group, representative, entryNode) {
    return {
      id: makeUuid(),
      type: 'Link',
      from: representative.id,
      to: entryNode.id,
      relation: 'timeline',
      label: '',
      description: { format: 'plain', body: '' },
      shape: 'NORMAL',
      visible: true,
      changed: true,
      style: {
        font: common.defaultFont,
        line: { kind: 'SOLID', color: '#c0c0c0', width: 2 }
      },
      color: '#c0c0c0',
      size: 2,
      groupRef: group.id,
      linkRole: 'viewpoint-first-entry',
      linkType: 'viewpoint-first-entry',
      audit: {
        owner: 'guest',
        createdBy: getCurrentOwnerId(),
        createdAt: new Date().toISOString(),
        lastModifiedBy: '',
        lastModifiedAt: ''
      }
    };
  }

  function ensureTimelineRepresentativeEntryLink(page, group) {
    var representative;
    var firstNode;
    var existing;
    var link;

    if (!page || !group) {
      return null;
    }
    ensurePageCollections(page);
    representative = getTimelineRepresentativeNode(group);
    firstNode = sortTimelineMembers(group)[0] || null;
    if (!representative || !firstNode) {
      return null;
    }

    existing = null;
    page.links = (page.links || []).filter(function (item) {
      if (!item || item.groupRef !== group.id ||
          (item.linkRole !== 'viewpoint-first-entry' && item.linkRole !== 'timeline-entry')) {
        return true;
      }
      if (getLinkSourceId(item) === representative.id && getLinkTargetId(item) === firstNode.id) {
        if (!existing) {
          existing = item;
          return true;
        }
        return false;
      }
      return false;
    });

    if (existing) {
      existing.visible = true;
      existing.changed = true;
      existing.relation = existing.relation || 'timeline';
      existing.linkRole = 'viewpoint-first-entry';
      existing.linkType = 'viewpoint-first-entry';
      setLinkTargetId(existing, firstNode.id);
      existing.from = representative.id;
      if (undefined !== existing.source) {
        existing.source = representative.id;
      }
      return existing;
    }

    link = makeTimelineRepresentativeEntryLink(group, representative, firstNode);
    page.links.push(link);
    return link;
  }

  function ensureVideoToTimelineRepresentativeLink(page, group, videoNode) {
    var representative;
    var memberIds;
    var existing;
    var result;
    var link;

    if (!page || !group || !videoNode) {
      return null;
    }

    ensurePageCollections(page);
    representative = getTimelineRepresentativeNode(group);
    if (!representative) {
      return null;
    }

    memberIds = getMemberIds(group);

    /*
     * The source Content represents the whole timeline.  Therefore the durable
     * source link must point to the representative topic, not to the first
     * Segment.  Existing links to start/end/point segments are migrated here.
     */
    existing = null;
    page.links = (page.links || []).filter(function (item) {
      var targetId;
      if (!isTimelineSourceLinkForGroup(item, group, videoNode)) {
        return true;
      }
      targetId = getLinkTargetId(item);
      if (targetId === representative.id) {
        if (!existing) {
          existing = item;
          return true;
        }
        return false;
      }
      if (memberIds.indexOf(targetId) >= 0) {
        if (!existing) {
          setLinkTargetId(item, representative.id);
          item.visible = true;
          item.changed = true;
          item.linkType = 'timeline-source';
          item.groupRef = group.id;
          existing = item;
          return true;
        }
        return false;
      }
      return true;
    });

    if (existing) {
      existing.visible = true;
      existing.changed = true;
      existing.linkType = 'timeline-source';
      existing.groupRef = group.id;
      setLinkTargetId(existing, representative.id);
      return existing;
    }

    result = model.connect(videoNode, representative);
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
    var page = getCurrentPage();
    var videoNode, duration, origin, group, startNode, endNode, parentGroupId;
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
        window.alert(t('Select one base video before creating timeline.'));
      }
      return null;
    }

    parentGroupId = getParentGenericGroupIdForNode(videoNode.id);
    duration = getMediaDuration(videoNode);
    origin = defaultAxisOrigin(videoNode);//, axis === 'vertical' ? 'vertical' : 'horizontal');
    group = model.createGroup({
      id: makeUuid(),
      name: 'Timeline',
      type: 'timeline',
      groupType: 'axis',
      orientation: axis === 'vertical' ? 'vertical' : 'horizontal',
      targetNodeId: videoNode.id,
      parentGroupId: parentGroupId,
      hierarchical: true,
      mediaRef: videoNode.id,
      defaultPlayDuration: 15,
      spine: { visible: true, color: '#888888', width: 4, padding: 12 },
      axis: { mode: 'video', unit: 'seconds', start: 0, end: duration, anchor: { x: origin.x, y: origin.y } },
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
      mediaStart: getDefaultEndSegmentStart(group, duration),
      mediaEnd: duration,
      playDuration: Math.max(0, Number(duration || 0) - getDefaultEndSegmentStart(group, duration)),
      label: formatTime(duration)
    });

    page.nodes.push(startNode, endNode);
    setMemberIds(group, [startNode.id, endNode.id]);

    // Video Content → timeline representative の Link を作成
    ensureVideoToTimelineRepresentativeLink(page, group, videoNode);
    ensureTimelineRepresentativeEntryLink(page, group);

    normalizeAxisGroup(group);
    rebuildGraphAndRefresh();
    clearSelectionState();

    resolveMediaDuration(videoNode).then(function (resolved) {
      if (Number.isFinite(Number(resolved)) && Number(resolved) > 0) {
        applyResolvedDurationToAxis(group, Number(resolved));
      }
    });

    return group;
  }

  function addTimePointToGroup(groupOrId, patch) {
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
      description: patch && patch.description && typeof patch.description === 'object'
        ? patch.description
        : { format: 'plain/text', body: '' }
    });

    page.nodes.push(segmentNode);
    appendMember(group, segmentNode.id, 'member');
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
    var previousOrientation;
    var nextOrientation;
    var previousAnchor;
    var nextAnchor;
    var orientationChanged;
    var anchorPos;

    if (!page || !group) {
      return null;
    }

    previousOrientation = axisOrientation(group);
    previousAnchor = axisAnchor(group);
    normalizeAxisGroup(group);
    previousOrientation = axisOrientation(group);
    previousAnchor = axisAnchor(group);
    patch = patch || {};

    nextOrientation = (patch.orientation === 'vertical' || patch.orientation === 'horizontal')
      ? patch.orientation
      : previousOrientation;
    orientationChanged = previousOrientation !== nextOrientation;
    nextAnchor = orientationChanged ? representativeAxisAnchor(group) : axisAnchor(group);

    group.orientation = nextOrientation;
    syncAxisEndToStoredDuration(group);
    if (Number.isFinite(Number(patch.timeEnd)) && Number(patch.timeEnd) > 0) {
      group.timeEnd = Number(patch.timeEnd);
      group.axis = group.axis || {};
      group.axis.end = group.timeEnd;
    }
    group.timeStart = 0;
    if (group.axis) {
      group.axis.start = 0;
    }
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
    if (!orientationChanged && Number.isFinite(Number(patch.anchorX))) {
      nextAnchor.x = Number(patch.anchorX);
    }
    if (!orientationChanged && Number.isFinite(Number(patch.anchorY))) {
      nextAnchor.y = Number(patch.anchorY);
    }
    setAxisAnchor(group, nextAnchor);

    if (orientationChanged) {
      /*
       * Representative topics are independent while they are dragged.
       * On an h/v switch, however, the axis start is first moved to the
       * representative centre, then members are projected to the new axis.
       */
      rotateTimelineMembersToOrientation(group, previousOrientation, nextOrientation, nextAnchor, nextAnchor);
    }

    members = getTimelineMemberNodes(group);
    startNode = members.find(function (node) { return node.axisRole === 'start'; }) || null;
    endNode = members.find(function (node) { return node.axisRole === 'end'; }) || null;
    anchorPos = nextOrientation === 'vertical' ? finiteNumber(nextAnchor.y, 0) : finiteNumber(nextAnchor.x, 0);

    if (startNode) {
      startNode.mediaStart = 0;
      startNode.axisPos = anchorPos;
      startNode.label = formatTime(0);
      delete startNode.name;
    }
    if (endNode) {
      endNode.mediaStart = resolveEndSegmentStart(group, endNode, group.timeEnd);
      endNode.mediaEnd = group.timeEnd;
      endNode.playDuration = Math.max(0, endNode.mediaEnd - endNode.mediaStart);
      endNode.axisPos = anchorPos + Math.max(60, Number(group.length || 480));
      endNode.label = endNode.label || formatTime(group.timeEnd);
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
    group.axis = group.axis || {};

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
    if (patch.description && typeof patch.description === 'object') {
      segment.description = util.clone(patch.description);
      delete segment.value;
    }

    if (segment.axisRole === 'start') {
      segment.mediaStart = 0;
      group.timeStart = 0;
      group.axis.start = 0;
    }
    else if (segment.axisRole === 'end') {
      var fixedEnd = Math.max(0, Number(
        group.timeEnd != null ? group.timeEnd :
          (group.axis && group.axis.end != null ? group.axis.end :
            (segment.mediaEnd != null ? segment.mediaEnd : segment.mediaStart))
      ) || 0);
      segment.mediaStart = resolveEndSegmentStart(group, segment, fixedEnd);
      segment.mediaEnd = fixedEnd;
      segment.playDuration = Math.max(0, segment.mediaEnd - segment.mediaStart);
      group.timeEnd = fixedEnd;
      group.axis.end = fixedEnd;
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
    if (hasEditableSegments(record.group)) {
      markGroupSelected(record.group);
    }
    else {
      clearSelectionState();
    }
    return true;
  }

  function deleteAxisGroup(groupOrLink) {
    var page = getCurrentPage();
    var group = isAxisGroup(groupOrLink)
      ? groupOrLink
      : (isTimelineAxisLink(groupOrLink) ? model.findGroupById(groupOrLink.groupRef) : null);
    var memberIds;

    if (!page || !group || !isAxisGroup(group)) {
      return false;
    }

    memberIds = getMemberIds(group);
    page.links = (page.links || []).filter(function (link) {
      return !(link && link.groupRef === group.id);
    });
    page.nodes = (page.nodes || []).filter(function (node) {
      return !(node && memberIds.indexOf(node.id) >= 0);
    });
    page.groups = (page.groups || []).filter(function (item) {
      return item && item.id !== group.id;
    });
    rebuildGraphAndRefresh();
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
    else if (model && typeof model.isRepresentativeTopic === 'function' &&
      model.isRepresentativeTopic(target) && target.groupRef) {
      group = model.findGroupById(target.groupRef);
      if (group && !isAxisGroup(group)) {
        group = null;
      }
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

  function syncAxisEndToMediaDuration(group) {
    return syncAxisEndToStoredDuration(group);
  }

  function getDragBounds(group, pageNode) {
    var members = sortTimelineMembers(group);
    var index = members.findIndex(function (node) { return node && node.id === pageNode.id; });
    var gap = Math.max(4, Number(group.minAxisGap || 8));
    var prev = index > 0 ? members[index - 1] : null;
    var next = (index >= 0 && index < members.length - 1) ? members[index + 1] : null;
    return {
      min: prev ? (getAxisPos(group, prev) + gap) : -Infinity,
      max: next ? (getAxisPos(group, next) - gap) : Infinity
    };
  }

  function clampAxisPosition(value, bounds) {
    value = Number(value || 0);
    if (bounds && Number.isFinite(bounds.min)) {
      value = Math.max(bounds.min, value);
    }
    if (bounds && Number.isFinite(bounds.max)) {
      value = Math.min(bounds.max, value);
    }
    return value;
  }

  function updateTimelineAxisGeometryByEndpointDrag(group, pageNode, x, y) {
    return updateTimelineSegmentAxisPosition(group, pageNode, x, y);
  }

  function updateTimelineSegmentTimeFromPosition(group, pageNode, x, y) {
    return updateTimelineSegmentAxisPosition(group, pageNode, x, y);
  }

  function updateTimelineSegmentAxisPosition(group, pageNode, x, y) {
    var pos;
    if (!group || !group.axis || !pageNode) {
      return false;
    }
    normalizeAxisGroup(group);
    pageNode = model.findNodeById(pageNode.id) || pageNode;
    pos = clampAxisPosition(axisScalar(group, x, y), getDragBounds(group, pageNode));
    setNodeOnAxis(group, pageNode, pos);
    updateAxisBoundsFromPositions(group);
    return true;
  }

  function handleSegmentDrag(nodeOrId, eventX, eventY) {
    var pageNode = (typeof nodeOrId === 'string') ? model.findNodeById(nodeOrId) : (nodeOrId && nodeOrId.id ? (model.findNodeById(nodeOrId.id) || nodeOrId) : null);
    if (!pageNode || !isTimelinePoint(pageNode)) {
      return false;
    }
    var group = model.findGroupById(pageNode.groupRef);
    if (!group || !isAxisGroup(group)) {
      return false;
    }
    if (!updateTimelineSegmentAxisPosition(group, pageNode, Number(eventX || 0), Number(eventY || 0))) {
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
  ns.syncAxisEndToMediaDuration = syncAxisEndToMediaDuration;
  ns.updateTimelineAxisGeometryByEndpointDrag = updateTimelineAxisGeometryByEndpointDrag;
  ns.updateTimelineSegmentTimeFromPosition = updateTimelineSegmentTimeFromPosition;
  ns.updateTimelineSegmentAxisPosition = updateTimelineSegmentAxisPosition;
  ns.updateAxisBoundsFromPositions = updateAxisBoundsFromPositions;
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
  // ns.reRender = reRender;
  ns.formatTime = formatTime;
  ns.isAxisGroup = isAxisGroup;
  ns.getAttachedTimelineGroupsForNode = getAttachedTimelineGroupsForNode;
  ns.hasAttachedTimelineGroup = hasAttachedTimelineGroup;
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
  ns.deleteAxisGroup = deleteAxisGroup;
  ns.getTimelinePlaybackSpec = getTimelinePlaybackSpec;
  ns.getTimelineTargetSpec = getTimelineTargetSpec;
  ns.confirmSavedRender = confirmSavedRender;
})(wuwei.timeline);
// wuwei.timeline.js last modified 2026-05-11
