/**
 * wuwei.menu.js
 * menu module
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2013-2020,2023,2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.menu = wuwei.menu || {};

(function (ns) {
  var
    /** common */
    common = wuwei.common,
    setting = common.setting,
    graph = common.graph,
    Operations,
    OperationsList,
    /** current */
    current = common.current,
    note_id = current.note_id,
    pp = current.page.pp,
    /** state */
    state = common.state,
    currentUser = state.currentUser,
    /** model */
    model = wuwei.model,
    note = wuwei.note,
    timeline = wuwei.timeline,
    Node = model.Node,
    Link = model.Link,
    /** wuwei */
    draw = wuwei.draw,
    util = wuwei.util,
    log = wuwei.log,
    nls = wuwei.nls,
    /** edit, info conflict with variable names for menu icon defined following */
    /**
     *  menu
     **/
    /** constant */
    MENU_TIMEOUT = 1000,
    /** var */
    // menuTimer,
    canvasEl,
    menuEl,
    menuCMND,
    menuEDIT,
    // editingCircle,
    startCircle,
    menu,
    hovered, selected,
    pin,
    sel, cmnd, edit, info,
    hoveredNode,
    allNodes,
    supportedOperations,
    drawmode_n,
    d3node, d3link,
    node, link, resource,
    d3event, id,
    source_node, target_node,
    // body_resource, target_resource,
    // association, param, json,
    // _association,
    position,
    x, y,
    i,
    len,
    /** function */
    drawmodeIcon,
    menuDiv,
    drawIcon,
    settinIgcon,
    // shareIcon,
    settingPane,
    heading_menu,
    searchIcon,
    open_controls,
    controls,
    drawmode_n,
    drawmode,
    openContextMenu,
    closeContextMenu,
    closeContext,
    ContextMENU,
    ContextCMND,
    ContextEDIT,
    ContextINFO,
    getOpenUrl,
    getDownloadUrl,
    ContextOperate,
    contextUpdatePosition,
    mainClicked,
    /** note */
    noteClicked,
    closeNoteClicked,
    exportCanvasImage,
    /** page */
    pageClicked,
    closePageClicked,
    refreshPagenation,
    checkPage,
    /** new */
    newClicked,
    closeNewClicked,
    onInputChange,
    /** flock */
    flockClicked,
    closeFlockClicked,
    alignClicked,
    closeAlignClicked,
    /** timeline */
    timelineClicked,
    closeTimelineClicked,
    timelineCreateAxisClicked,
    timelineAddPointClicked,
    timelineEditPointClicked,
    timelineDeletePointClicked,
    /** filter */
    filterClicked,
    closeFilterClicked,
    /** search */
    searchClicked,
    closeSearchClicked,
    /** controls */
    openControlsClicked,
    zoomInClicked,
    resetViewClicked,
    zoomOutClicked,
    playPauseClicked,
    updateUndoRedoButton,
    undoClicked, redoClicked,
    /** miniature */
    openMiniatureClicked,
    /** user status */
    userStatusClicked,
    /** download url */
    isImageLikeNode,
    toAbsoluteUrl,
    /** init */
    initModule;

  isImageLikeNode = function (node) {
    const resource = getNodeResource(node);
    return !!(util.isDocumentKindByExtension(node, resource, '', 'image'));
  };

  function getCurrentOwnerId() {
    return common.getCurrentOwnerId() ||
      (state && state.currentUser && state.currentUser.user_id) ||
      '';
  }

  function assertNoLegacyRuntimeFields(record, kind) {
    if (!record || 'object' !== typeof record) {
      return;
    }
    if (Object.prototype.hasOwnProperty.call(record, 'hidden')) {
      throw new Error(kind + ' contains legacy runtime field: hidden');
    }
    if (Object.prototype.hasOwnProperty.call(record, 'owner')) {
      throw new Error(kind + ' contains legacy runtime field: owner');
    }
    if (Object.prototype.hasOwnProperty.call(record, 'owner_id')) {
      throw new Error(kind + ' contains legacy runtime field: owner_id');
    }
    if (Object.prototype.hasOwnProperty.call(record, 'ownerId')) {
      throw new Error(kind + ' contains legacy runtime field: ownerId');
    }
    if (Object.prototype.hasOwnProperty.call(record, 'uri')) {
      throw new Error(kind + ' contains legacy runtime field: uri');
    }
    if (Object.prototype.hasOwnProperty.call(record, 'url')) {
      throw new Error(kind + ' contains legacy runtime field: url');
    }
    if (Object.prototype.hasOwnProperty.call(record, 'format')) {
      throw new Error(kind + ' contains legacy runtime field: format');
    }
    if (Object.prototype.hasOwnProperty.call(record, 'download_url')) {
      throw new Error(kind + ' contains legacy runtime field: download_url');
    }
    if (Object.prototype.hasOwnProperty.call(record, 'media')) {
      throw new Error(kind + ' contains legacy runtime field: media');
    }
  }

  function getRecordOwnerId(record) {
    assertNoLegacyRuntimeFields(record, 'Runtime record');
    if (!record || 'object' !== typeof record) {
      return '';
    }
    if (!record.audit || 'object' !== typeof record.audit || !record.audit.createdBy) {
      throw new Error('Runtime record must provide audit.createdBy');
    }
    return String(record.audit.createdBy);
  }

  function isOwnedByCurrentUser(record) {
    var ownerId = getRecordOwnerId(record);
    var currentOwnerId = getCurrentOwnerId();
    if (ownerId === currentOwnerId) {
      return true;
    }
    if (common.isTemporaryOwnerId(ownerId) &&
      common.isTemporaryOwnerId(currentOwnerId)) {
      return true;
    }
    return false;
  }

  function getNodeResource(node) {
    if (!node || node.type !== 'Content') {
      return null;
    }
    if (Object.prototype.hasOwnProperty.call(node, 'uri') ||
      Object.prototype.hasOwnProperty.call(node, 'url') ||
      Object.prototype.hasOwnProperty.call(node, 'format') ||
      Object.prototype.hasOwnProperty.call(node, 'download_url') ||
      Object.prototype.hasOwnProperty.call(node, 'media')) {
      throw new Error('Content node contains legacy runtime fields; expected resource-based schema');
    }
    if (!node.resource || 'object' !== typeof node.resource) {
      throw new Error('Content node must provide resource');
    }
    return node.resource;
  }

  function isHostedVideoUrl(url) {
    var s = String(url || '').toLowerCase();
    return (
      /^https?:\/\/(www\.)?(youtube\.com|m\.youtube\.com|youtu\.be)\b/.test(s) ||
      /^https?:\/\/(www\.)?(vimeo\.com|player\.vimeo\.com)\b/.test(s)
    );
  }

  function isPlayableVideoNode(node) {
    var resource;
    var uri;
    var kind;
    var subtype;
    if (!node || node.type !== 'Content') {
      return false;
    }
    resource = getNodeResource(node);
    uri = String((resource.original && resource.original.url) || resource.uri || resource.canonicalUri || '').toLowerCase();
    kind = String(resource.kind || '').toLowerCase();
    subtype = String(resource.videoKind || '').toLowerCase();

    return (
      kind === 'video' ||
      subtype === 'youtube' ||
      subtype === 'vimeo' ||
      util.isDocumentKindByExtension(node, resource, uri, 'video') ||
      isHostedVideoUrl(uri)
    );
  }

  function isLocalTemporaryUser() {
    var ownerId = '';

    if (!(common.isLocalHost())) {
      return false;
    }

    ownerId = util.getCurrentUserId() || cmon.getCurrentOwnerId();

    return !state.loggedIn ||
      common.isTemporaryOwnerId(ownerId);
  }

  function getResourceFiles(resource) {
    var storage = resource && resource.storage;
    return (storage && Array.isArray(storage.files)) ? storage.files : [];
  }

  function getResourceOriginalPath(resource) {
    var files = getResourceFiles(resource);
    var file, i;

    for (i = 0; i < files.length; i += 1) {
      file = files[i] || {};
      if (String(file.role || '').toLowerCase() === 'original') {
        return String(file.path || file.uri || file.url || file.sourcePath || '').trim();
      }
    }

    return String(
      (resource && (
        resource.canonicalUri ||
        resource.uri
      )) || ''
    ).trim();
  }

  function isUploadedResource(resource) {
    var files = getResourceFiles(resource);
    var file, text, i;

    for (i = 0; i < files.length; i += 1) {
      file = files[i] || {};
      if (String(file.role || '').toLowerCase() !== 'original') {
        continue;
      }
      if (String(file.area || '').toLowerCase() === 'upload') {
        return true;
      }
      text = String(file.path || file.uri || file.url || '').replace(/\\/g, '/');
      if (/^(?:upload\/|\d{4}\/\d{2}\/\d{2}\/)/.test(text)) {
        return true;
      }
      if (/[?&]area=upload(?:&|$)/.test(text)) {
        return true;
      }
    }

    text = String(
      (resource && (
        resource.canonicalUri ||
        resource.uri
      )) || ''
    ).replace(/\\/g, '/');
    return /^(?:upload\/|\d{4}\/\d{2}\/\d{2}\/)/.test(text) ||
      /[?&]area=upload(?:&|$)/.test(text);
  }

  function isOfficeResource(resource) {
    var ref = getResourceOriginalPath(resource);
    return !!(util.isDocumentKindByExtension(null, resource, ref, 'office'));
  }

  function isUploadedContent(allNodes) {
    var target = getContextTarget(allNodes);
    var resource;

    if (!target || target.type !== 'Content') {
      return false;
    }
    if (target.option === 'upload') {
      return true;
    }

    resource = getNodeResource(target);
    return isUploadedResource(resource);
  }

  function isOfficeUploaded(allNodes) {
    var target = getContextTarget(allNodes);

    if (!util.isLocalHost()) {
      return false;
    }
    if (!isUploadedContent(allNodes)) {
      return false;
    }
    return isOfficeResource(getNodeResource(target));
  }

  toAbsoluteUrl = function (href) {
    if (!href) {
      return '';
    }
    if (/^(https?:|blob:|data:)/i.test(href)) {
      return href;
    }
    const base = location.href.substr(0, location.href.lastIndexOf('/') + 1);
    return base + String(href).replace(/^\//, '');
  };

  function refreshContextMenuState() {
    clearTimeout(state.menuTimer);
    // context menu を止める stale state を解除
    state.dragging = false;
    state.modal = false;
    state.hoveredNode = null;
    // Connecting は残すと選択操作中の意味が変わるので、
    // 必要時のみ解除する方針でもよいが、メニュー回復を優先するなら false にする
    // state.Connecting = false;
    closeContextMenu();
    d3.select('#Hovered').attr('opacity', 0).attr('class', '');
    d3.select('#Selected').attr('opacity', 0);
    d3.select('#Pointer').style('opacity', 0);

    draw.redraw();
  }

  closeContextMenu = function () {
    var menuEl = document.getElementById('ContextMenu');
    if (menuEl) {
      menuEl.classList.add('collapsed');
      menuEl.setAttribute('transform', 'translate(0,0)');
    }
    closeContext();
    if ('block' === d3.select('#edit').style('display')) {
      d3.select('#Editing').raise();
    }
  };

  function getCurrentPage() {
    var common = wuwei.common;
    return common && common.current ? common.current.page || null : null;
  }

  function isGroupedNode(node) {
    return !!(node && model.isNodeInAnyGroup(node.id));
  }

  function isTimelinePointNode(node) {
    if (!node) {
      return false;
    }

    return !!wuwei.menu.timeline.isTimelinePoint(node) ||
      ('Segment' === node.type) ||
      ('Topic' === node.type && 'timeline-point' === node.topicKind);
  }

  function isTimelineInfoTarget(node, link) {
    return !!(
      (node && wuwei.menu.timeline.getTimelineTargetSpec(node)) ||
      (link && wuwei.menu.timeline.getTimelineTargetSpec(link))
    );
  }

  function isViewpointInfoTarget(node, link) {
    return !!(
      (node && wuwei.viewpoint.getContentTargetSpec(node)) ||
      (link && wuwei.viewpoint.getContentTargetSpec(link))
    );
  }

  function isTimelinePlayableTarget(node) {
    return !!wuwei.menu.timeline.getTimelineTargetSpec(node);
  }

  function getTimelineResourceUrl(mediaNode, resource) {
    resource = resource || {};
    return String(
      (wuwei.video && typeof wuwei.video.getVideoSource === 'function' ? wuwei.video.getVideoSource(mediaNode) : '') ||
      (resource.original && (resource.original.url || resource.original.sourceUrl || resource.original.canonicalUrl)) ||
      (resource.origin && (resource.origin.sourceUrl || resource.origin.canonicalUrl)) ||
      resource.uri ||
      resource.canonicalUri ||
      (mediaNode && (mediaNode.uri || mediaNode.url)) ||
      ''
    );
  }

  function getVimeoEmbedUrlFromSource(rawUrl, startAt) {
    var h = '';
    var id = '';
    var m;
    var u;
    rawUrl = String(rawUrl || '');
    try {
      u = new URL(rawUrl, location.href);
      h = u.searchParams.get('h') || '';
      m = u.pathname.match(/\/(?:video\/)?([0-9]+)(?:\/([A-Za-z0-9_-]+))?/);
      if (m) {
        id = m[1];
        h = h || m[2] || '';
      }
    }
    catch (e) {
      m = rawUrl.match(/vimeo\.com\/(?:video\/)?([0-9]+)(?:\/([A-Za-z0-9_-]+))?/);
      if (m) {
        id = m[1];
        h = h || m[2] || '';
      }
    }
    if (!id) {
      return rawUrl;
    }
    return 'https://player.vimeo.com/video/' + encodeURIComponent(id) +
      '?autoplay=1&title=0&byline=0&portrait=0' +
      (h ? ('&h=' + encodeURIComponent(h)) : '') +
      (Number(startAt || 0) > 0 ? ('#t=' + Math.floor(Number(startAt || 0)) + 's') : '');
  }

  function buildTimelineMediaNode(spec) {
    var mediaNode;
    var fullMediaNode;

    if (!spec || !spec.mediaNode) {
      return null;
    }

    fullMediaNode = spec.mediaNode.id && model && typeof model.findNodeById === 'function'
      ? model.findNodeById(spec.mediaNode.id)
      : null;
    mediaNode = util.clone
      ? util.clone(fullMediaNode || spec.mediaNode)
      : Object.assign({}, fullMediaNode || spec.mediaNode);

    if (!mediaNode.resource && spec.mediaNode.resource) {
      mediaNode.resource = spec.mediaNode.resource;
    }
    mediaNode.timeRange = Object.assign({}, mediaNode.timeRange || {});
    mediaNode.timeRange.start = Number(spec.startAt || 0);

    if (spec.endAt != null && isFinite(spec.endAt)) {
      mediaNode.timeRange.end = Number(spec.endAt);
    }
    else if (Object.prototype.hasOwnProperty.call(mediaNode.timeRange, 'end')) {
      delete mediaNode.timeRange.end;
    }

    return mediaNode;
  }

  function openTimelineSpec(spec) {
    var mediaNode = buildTimelineMediaNode(spec);
    var opened = false;
    var option;

    if (!mediaNode) {
      return false;
    }

    option = {
      startSeconds: Number(spec && spec.startAt || 0),
      endSeconds: (spec && spec.endAt != null) ? Number(spec.endAt) : null
    };

    try {
      opened = wuwei.menu.video.open(mediaNode, option);
      return opened !== false;
    }
    catch (e) {
      console.error(e);
      return false;
    }
  }

  function buildTimelineOpenUrl(spec) {
    var mediaNode, resource, rawUrl, startAt, endAt, m, hash;
    if (!spec || !spec.mediaNode) {
      return '';
    }
    mediaNode = spec.mediaNode;
    resource = (mediaNode.resource && typeof mediaNode.resource === 'object') ? mediaNode.resource : {};
    rawUrl = getTimelineResourceUrl(mediaNode, resource);
    startAt = Math.max(0, Number(spec.startAt || 0));
    endAt = (spec.endAt != null && isFinite(spec.endAt)) ? Math.max(startAt, Number(spec.endAt)) : null;
    if (!rawUrl) {
      return '';
    }
    if (/^https?:\/\/(www\.)?(youtube\.com|m\.youtube\.com|youtu\.be)\b/i.test(rawUrl)) {
      m = rawUrl.match(/[?&]v=([A-Za-z0-9_-]{11})/) || rawUrl.match(/youtu\.be\/([A-Za-z0-9_-]{11})/) || rawUrl.match(/youtube\.com\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/);
      if (m && m[1]) {
        return 'https://www.youtube.com/embed/' + encodeURIComponent(m[1]) +
          '?playsinline=1&rel=0&start=' + Math.floor(startAt) +
          (endAt != null ? '&end=' + Math.floor(endAt) : '');
      }
    }
    if (/^https?:\/\/(www\.)?(vimeo\.com|player\.vimeo\.com)\b/i.test(rawUrl)) {
      var h = '', id = '';
      try {
        var u = new URL(rawUrl, location.href);
        h = u.searchParams.get('h') || '';
        m = u.pathname.match(/\/(?:video\/)?([0-9]+)(?:\/([A-Za-z0-9_-]+))?/);
        if (m) {
          id = m[1];
          h = h || m[2] || '';
        }
      } catch (e) {
        m = rawUrl.match(/vimeo\.com\/(?:video\/)?([0-9]+)(?:\/([A-Za-z0-9_-]+))?/);
        if (m) {
          id = m[1];
          h = h || m[2] || '';
        }
      }
      if (id) {
        return getVimeoEmbedUrlFromSource(rawUrl, startAt);
      }
    }
    return rawUrl;
  }

  function openTimelineSpecInNewTab(spec) {
    var url = buildTimelineOpenUrl(spec);
    if (!url) {
      return false;
    }
    window.open(url, '_blank', 'noopener');
    return true;
  }

  function openTimelineSpecInNewWindow(spec) {
    var url = buildTimelineOpenUrl(spec);
    if (!url) {
      return false;
    }
    wuwei.info.openWindow(url, null, 'width=900,height=680,noopener,resizable=yes,scrollbars=yes');
    return true;
  }

  function getTimelineEditSpec(target) {
    if (util.isEmpty(target) || state.Selecting || state.Connecting) {
      return null;
    }
    return wuwei.menu.timeline.getTimelineTargetSpec(target);
  }

  function isTimelineAxisSpec(spec) {
    return !!(spec && spec.group && !spec.point);
  }

  function isTimelineSegmentSpec(spec) {
    return !!(spec && spec.point);
  }

  function isTimelineMidSegmentSpec(spec) {
    return !!(
      spec &&
      spec.point &&
      spec.point.axisRole !== 'start' &&
      spec.point.axisRole !== 'end'
    );
  }


  openContextMenu = function (data) {
    if (state.dragging) {
      return;
    }

    function sanitizePoint(point) {
      if (!point) {
        return null;
      }
      var x = Number(point.x);
      var y = Number(point.y);
      return (Number.isFinite(x) && Number.isFinite(y)) ? { x: x, y: y } : null;
    }

    function parseTranslate(transformText) {
      if (!transformText) {
        return null;
      }
      const m = String(transformText).match(/translate\(\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*[, ]\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*\)/i);
      if (!m) {
        return null;
      }
      return sanitizePoint({ x: parseFloat(m[1]), y: parseFloat(m[2]) });
    }

    function getNodePosition(node, fallbackPosition) {
      if (!node) {
        return null;
      }

      const g = document.getElementById(node.id);
      var p = null;

      // simpleGroup pseudo node は実 node のような実座標を持たない。
      // この pseudo node は page.groups から生成した「操作入口」であり、
      // buildSimpleGroupPseudoNode() では x,y にダミー値(0,0)を入れている。
      //
      // そのため、通常 node と同じ順序で node.x / node.y を優先すると、
      // context menu の表示位置が group box の中心ではなく左上(0,0)寄りへずれる。
      //
      // simpleGroup の場合、renderSimpleGroupNode() 側で box 中心を
      // fallbackPosition として渡しているので、それを最優先で使う。
      // これにより、group の context menu は見た目上の group 枠の中央に出る。
      //
      // 通常 node では引き続き transform / translate / node.x,y を優先し、
      // simpleGroup pseudo node のときだけ fallbackPosition を優先する。
      var isPseudoGroupNode = !!(
        node &&
        node.type === 'Group' &&
        node.groupType === 'simple' &&
        node.groupRef
      );

      if (isPseudoGroupNode) {
        p = sanitizePoint(fallbackPosition);
        if (p) {
          return p;
        }
      }

      // ① 表示中の SVG transform の実値を最優先
      if (g && g.transform && g.transform.baseVal && g.transform.baseVal.numberOfItems > 0) {
        const consolidated = g.transform.baseVal.consolidate();
        if (consolidated && consolidated.matrix) {
          p = sanitizePoint({ x: consolidated.matrix.e, y: consolidated.matrix.f });
          if (p) {
            return p;
          }
        }
      }

      // ② transform 属性文字列の translate(...) も拾う
      if (g) {
        p = parseTranslate(g.getAttribute('transform'));
        if (p) {
          return p;
        }
      }

      // ③ node.x / node.y
      p = sanitizePoint({ x: node.x, y: node.y });
      if (p) {
        return p;
      }

      // ④ 呼び出し側から渡された position
      p = sanitizePoint(fallbackPosition);
      if (p) {
        return p;
      }

      return null;
    }

    function getLinkPosition(link, d3link, fallbackPosition) {
      var fallback = sanitizePoint(fallbackPosition);
      var p;

      if (d3link && !d3link.empty() && fallback) {
        const pathNode = d3link.select('.Path');
        if (!pathNode.empty()) {
          p = model.closestPoint(pathNode.node(), fallback);
          if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
            link._controlPoint = {
              x: p.x,
              y: p.y,
              source: 'mouse-link-intersection'
            };
            return { x: p.x, y: p.y };
          }
        }
      }

      if (fallback) {
        link._controlPoint = {
          x: fallback.x,
          y: fallback.y,
          source: 'mouse'
        };
        return fallback;
      }

      if (Number.isFinite(link?.x) && Number.isFinite(link?.y)) {
        link._controlPoint = {
          x: link.x,
          y: link.y,
          source: 'link'
        };
        return { x: link.x, y: link.y };
      }

      return null;
    }

    function getGroupOverlayPosition(groupOverlay) {
      if (!groupOverlay) {
        return null;
      }
      if (Number.isFinite(groupOverlay.cx) && Number.isFinite(groupOverlay.cy)) {
        return { x: groupOverlay.cx, y: groupOverlay.cy };
      }
      if (Number.isFinite(groupOverlay.x1) && Number.isFinite(groupOverlay.y1) && Number.isFinite(groupOverlay.x2) && Number.isFinite(groupOverlay.y2)) {
        return { x: (groupOverlay.x1 + groupOverlay.x2) / 2, y: (groupOverlay.y1 + groupOverlay.y2) / 2 };
      }
      if (Number.isFinite(groupOverlay.x) && Number.isFinite(groupOverlay.y) && Number.isFinite(groupOverlay.width) && Number.isFinite(groupOverlay.height)) {
        return { x: groupOverlay.x + groupOverlay.width / 2, y: groupOverlay.y + groupOverlay.height / 2 };
      }
      return null;
    }

    function bindMenuHover(menuSelection) {
      menuSelection
        .on('mouseover', function () {
          clearTimeout(state.menuTimer);
        })
        .on('mouseout', function () {
          clearTimeout(state.menuTimer);
          state.menuTimer = setTimeout(function () {
            closeContextMenu();
          }, MENU_TIMEOUT);
        });
    }

    function bindSubmenuHover(selector, closeName, timeout) {
      setTimeout(function () {
        const submenu = d3.select(selector);
        if (submenu.empty()) {
          return;
        }
        submenu
          .on('mouseover', function () {
            clearTimeout(state.menuTimer);
          })
          .on('mouseout', function () {
            clearTimeout(state.menuTimer);
            state.menuTimer = setTimeout(function () {
              closeContext(closeName);
              closeContextMenu();
            }, MENU_TIMEOUT);
          });
      }, timeout);
    }

    clearTimeout(state.menuTimer);

    const canvasEl = document.getElementById(state.canvasId);
    const menuEl = document.getElementById('ContextMenu');

    Promise.resolve(data)
      .then(function (ctx) {
        const node = ctx && ctx.node;
        const link = ctx && ctx.link;
        const groupOverlay = ctx && ctx.groupOverlay;
        const position = ctx && ctx.position;
        let d3node = null;
        let d3link = null;

        if (node) {
          node.checked = true;
          node.transparency = 1;
          const now = Date.now();
          const constants = common.constants || {};
          const timeout = constants?.FORCE?.TRANSPARENT?.TIMEOUT ?? 60000;
          node.expire = now + timeout;

          d3node = d3.select('g.node#' + node.id);
          if (!d3node.empty()) {
            d3node.style('opacity', 1.0);
          }
        }
        else if (link) {
          d3link = d3.select('g.link#' + link.id);
          if (!d3link.empty()) {
            d3link.style('opacity', 1.0);
          }
        }

        if (!menuEl || !canvasEl) {
          return ctx;
        }

        canvasEl.appendChild(menuEl);

        let anchor = null;

        if (node) {
          anchor = getNodePosition(node, position);
        }
        else if (link) {
          anchor = getLinkPosition(link, d3link, position);
        }
        else if (groupOverlay) {
          anchor = getGroupOverlayPosition(groupOverlay);
        }

        anchor = sanitizePoint(anchor);
        if (!anchor) {
          d3.select(menuEl).classed('collapsed', true);
          menuEl.setAttribute('transform', 'translate(0,0)');
          return ctx;
        }

        menuEl.setAttribute('transform', 'translate(' + anchor.x + ',' + anchor.y + ')');
        ctx.anchor = anchor;
        return ctx;
      })
      .then(function (ctx) {
        const node = ctx && ctx.node;
        const link = ctx && ctx.link;
        const groupOverlay = ctx && ctx.groupOverlay;
        const anchor = ctx && ctx.anchor;

        const sel = d3.select('#MenuSEL');
        const menu = d3.select('#ContextMenu');
        const cmnd = d3.select('#MenuCMND');
        const edit = d3.select('#MenuEDIT');
        const info = d3.select('#MenuINFO');
        const hovered = d3.select('#Hovered');
        const selected = d3.select('#Selected');

        sel.classed('collapsed', true);
        menu.classed('collapsed', false);
        cmnd.classed('collapsed', true);
        edit.classed('collapsed', true);
        info.classed('collapsed', true);

        bindMenuHover(menu);

        if (node) {
          hovered.attr('class', node.id).attr('opacity', 1);
        }
        else if (link) {
          hovered.attr('class', link.id);
          if (!state.Selecting && graph.mode !== 'view') {
            hovered.attr('opacity', 1);
          }
          else {
            hovered.attr('opacity', 0);
          }
        }
        else if (groupOverlay) {
          hovered.attr('opacity', 0);
        }

        if (node) {
          selected
            .attr('r', 32)
            .attr('fill', 'none')
            .attr('stroke', common.Color.outerHovered)
            .attr('stroke-width', 8)
            .attr('opacity', 1)
            .datum(node);
        }
        else if (link) {
          if (!state.Selecting && graph.mode !== 'view') {
            selected
              .attr('r', 8)
              .attr('fill', common.Color.innerHovered)
              .attr('stroke', 'none')
              .attr('opacity', 1)
              .datum(link)
              .call(
                d3.drag()
                  .on('start', Link.prototype.dragstarted)
                  .on('drag', Link.prototype.dragged)
                  .on('end', Link.prototype.dragended)
              );
          }
          else {
            selected.attr('opacity', 0);
          }
        }
        else if (groupOverlay) {
          var groupSelected = Array.isArray(state.selectedGroupIds) && state.selectedGroupIds.indexOf(groupOverlay.group) >= 0;
          selected
            .attr('r', 10)
            .attr('fill', 'none')
            .attr('stroke', common.Color.outerSelected)
            .attr('stroke-width', 4)
            .attr('opacity', groupSelected ? 1 : 0)
            .datum(groupOverlay);
        }

        const startCircle = document.getElementById('Start');
        const groupIdFromRepresentative = (node && isRepresentativeTopic(node) && node.groupRef) ? node.groupRef : null;
        const groupIdFromNode = (node && node.groupType === 'simple' && node.groupRef) ? node.groupRef : null;
        const groupIdFromLink = (link && link.groupRef && (
          link.groupType === 'horizontal' ||
          link.groupType === 'vertical' ||
          link.groupType === 'timelineAxis' ||
          link.groupType === 'viewpointAxis'
        )) ? link.groupRef : null;
        const selectableGroupId = groupIdFromRepresentative || groupIdFromNode || groupIdFromLink || null;
        const canShowSelect = graph.mode !== 'view' && (
          (!state.Selecting && node) ||
          (state.Selecting && (node || link || selectableGroupId))
        );

        if (canShowSelect) {
          sel
            .classed('collapsed', false)
            .on('mousedown', function () {
              const d3event = d3.event;
              d3event.stopPropagation();
              const targetNode = node && node.id
                ? (model.findNodeById(node.id) || node)
                : null;
              if (!state.Selecting) {
                if (!targetNode) {
                  return;
                }
                if (!state.Connecting) {
                  state.Connecting = true;
                  startCircle.style.opacity = '1';
                  startCircle.setAttribute('cx', '' + targetNode.x);
                  startCircle.setAttribute('cy', '' + targetNode.y);
                  state.startNode = targetNode;
                }
                else {
                  if (state.startNode && state.startNode.id) {
                    if (id === state.startNode.id) {
                      state.Connecting = false;
                      state.startNode = null;
                    }
                    else {
                      const sourceNode = state.startNode;
                      const result = model.connect(state.startNode, targetNode);
                      const newLink = result && result.param && result.param.link && result.param.link[0];
                      if (newLink) {
                        log.storeLog({ operation: 'connect' });
                      }
                      draw.redraw();
                    }
                  }
                  state.Connecting = false;
                  state.startNode = null;
                  startCircle.style.opacity = '0';
                }
              }
              else if (selectableGroupId) {
                if (!Array.isArray(state.selectedGroupIds)) {
                  state.selectedGroupIds = [];
                }
                if (state.selectedGroupIds.indexOf(selectableGroupId) >= 0) {
                  state.selectedGroupIds = state.selectedGroupIds.filter(function (gid) {
                    return gid !== selectableGroupId;
                  });
                }
                else {
                  state.selectedGroupIds.push(selectableGroupId);
                  if (!state.selectedGroupMarks || 'object' !== typeof state.selectedGroupMarks) {
                    state.selectedGroupMarks = {};
                  }
                  state.selectedGroupMarks[selectableGroupId] = {
                    x: Number((anchor && anchor.x) || (node && node.x) || (link && link.x) || (d3event && d3event.x) || 0),
                    y: Number((anchor && anchor.y) || (node && node.y) || (link && link.y) || (d3event && d3event.y) || 0)
                  };
                }
                draw.redraw();
              }
              else {
                const d3node = d3.select('g.node#' + targetNode.id);
                const selectedCircle = d3node.select('circle.selected');
                if (!selectedCircle.empty()) {
                  d3node.classed('selected', false);
                  selectedCircle.remove();
                }
                else {
                  d3node
                    .classed('selected', true)
                    .append('circle')
                    .attr('class', 'selected')
                    .attr('cx', 0)
                    .attr('cy', 0)
                    .attr('r', 32)
                    .attr('fill', 'none')
                    .attr('stroke', common.Color.outerSelected)
                    .attr('stroke-width', 2)
                    .datum(targetNode);
                }
                closeContextMenu();
              }
            });

          sel.raise();

          const selectedNodeIds = d3.selectAll('g.node.selected')
            .nodes()
            .map(function (el) { return el.id; });

          if (node && selectedNodeIds.includes(node.id)) {
            sel.text('\uf00c').attr('font-weight', '900');
          }
          else if (node && state.Connecting && state.startNode) {
            if (node.id === state.startNode.id) {
              sel.text('\uf00c');
              d3.select('#Start').raise();
            }
            else {
              sel.text('\uf0c1');
            }
            sel.attr('font-weight', '900');
          }
          else if (selectableGroupId) {
            if (Array.isArray(state.selectedGroupIds) && state.selectedGroupIds.indexOf(selectableGroupId) >= 0) {
              sel.text('\uf00c').attr('font-weight', '900');
            }
            else {
              sel.text('\uf0c8').attr('font-weight', '400');
            }
          }
          else {
            sel.text('\uf0c8').attr('font-weight', '400');
          }
        }

        if (!state.Connecting && !state.Selecting) {
          cmnd
            .text('\uf013')
            .attr('font-weight', '900')
            .classed('collapsed', false)
            .on('mousedown', function () {
              const ev = d3.event;
              ev.stopPropagation();
              closeContext('EDIT');
              closeContext('INFO');
              ContextCMND(node || link, ev);
            });
          cmnd.raise();
          bindSubmenuHover('#contextCMND', 'CMND', MENU_TIMEOUT);
        }

        if (!state.Connecting && !state.Selecting && graph.mode !== 'view') {
          edit
            .text('\uf044')
            .attr('font-weight', '900')
            .classed('collapsed', false)
            .on('mousedown', function () {
              const ev = d3.event;
              ev.stopPropagation();
              closeContext('CMND');
              closeContext('INFO');
              ContextEDIT(node || link, ev);
            })
            .raise();
          if (!(wuwei.menu.timeline.getTimelineTargetSpec(node || link))) {
            bindSubmenuHover('#contextEDIT', 'EDIT', 500);
          }
        }

        if (!state.Connecting && !state.Selecting) {
          var infoTarget = node || link;
          var infoOperations = infoTarget && Operations.getSupported([infoTarget], 'INFO') || [];
          if (infoOperations.length > 0) {
            info
              .text('\uf05a')
              .attr('font-weight', '900')
              .classed('collapsed', false)
              .on('mousedown', function () {
                const ev = d3.event;
                ev.stopPropagation();
                closeContext('CMND');
                closeContext('EDIT');
                ContextINFO(node || link, ev);
              });
            info.raise();
            bindSubmenuHover('#contextINFO', 'INFO', 500);
          }
          else {
            info.classed('collapsed', true);
          }
        }
        else {
          info.classed('collapsed', true);
        }
        menu.raise();
      });
  };


  closeContext = function (MENU) {
    if (MENU && 'string' === typeof MENU) {
      d3.select('#context' + MENU)
        .classed('collapsed', true);
    }
    else {
      d3.selectAll('.contextMenu') // both #contextCMND, #contextEDIT
        .classed('collapsed', true);
    }
  };


  function isImageNode(node) {
    const resource = getNodeResource(node);
    return !!(util.isDocumentKindByExtension(node, resource, '', 'image'));
  }


  function downloadNode(nodeId) {
    function t(str) {
      return wuwei.nls.translate(str);
    }

    if (graph.mode === 'view' || state.viewOnly || state.published) {
      return false;
    }
    const node = wuwei.model.getCurrent
      ? wuwei.model.getCurrent().nodes.find(n => n.id === nodeId)
      : null;

    const url = getDownloadUrl(node);
    if (!url) {
      wuwei.menu.snackbar.open({ type: 'warning', message: t('No download URL.') });
      return;
    }

    const a = document.createElement('a');
    a.href = url;
    a.download = getDownloadFilename(node, url);
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();

    wuwei.menu.closeContextMenu();
  }

  ContextMENU = function (MENU, hoveredNode, event) {
    var operator, iconClass, operation, html;

    allNodes = [hoveredNode];
    var supportedOperations = Operations.getSupported(allNodes, MENU);
    var contextMENU = document.getElementById('context' + MENU);

    /** operators */
    var operators = contextMENU.querySelector('.operators');
    operators.innerHTML = '';

    /*
     * Do not show an empty context menu icon/list.
     * Some targets can be recognised as axis/representative/pseudo targets,
     * but all edit/info operations can be filtered out by ownership or state.
     * In that case the small context-menu icon itself is misleading, so keep
     * the menu collapsed and return without positioning it.
     */
    if (!supportedOperations || supportedOperations.length === 0) {
      contextMENU.classList.add('collapsed');
      state.modal = false;
      return null;
    }

    supportedOperations.forEach(function (supportedOperation) {
      operation = supportedOperation[0];
      iconClass = supportedOperation[4];
      if (iconClass) {
        if (iconClass.match(/^xlink:href/)) {
          html =
            '<svg class="icon" width="24" height="24" aria-hidden="true" focusable="false">' +
            '<use ' + iconClass + ' fill="none" stroke="currentColor"></use>' +
            '</svg>';
        }
        else {
          if (iconClass instanceof Array) {
            html = `<span class="fa-stack fa-fw" aria-hidden="true">
                    <i class="${iconClass[0]}"></i>
                    <i class="${iconClass[1]}"></i>
                  </span>`;
          }
          else {
            html = `<i class="${iconClass}" aria-hidden="true"></i>`;
          }
        }
        html = `<div class="operator ${operation}">${html}${wuwei.nls.translate(supportedOperation[1])}</div>`;
      }
      else {
        html = `<div class="operator ${operation}">${wuwei.nls.translate(supportedOperation[1])}</div>`;
      }

      operators.insertAdjacentHTML('beforeend', html);
      operator = operators.querySelector('.' + operation);

      if ('danger' === supportedOperation[3]) {
        operator.classList.add('danger');
      }

      operator.addEventListener('click', function (event) {
        event.stopPropagation();
        var ops = event.currentTarget.className.split(' ');
        let op;
        for (op of ops) {
          if ('operator' !== op && 'danger' !== op) {
            break;
          }
        }
        ContextOperate(op);
      }, false);
    });

    contextMENU.classList.remove('collapsed');
    contextUpdatePosition(MENU, hoveredNode, event);
    return contextMENU;
  };

  ContextCMND = function (_hoveredNode, _event) {
    const event = _event;
    if (state.Connecting) {
      return null;
    }
    clearTimeout(state.menuTimer); // cancel #ContextMenu close timer
    state.hoveredNode = resolveContextTargetRecord(_hoveredNode);
    state.modal = true;
    closeContext();
    if (util.isNode(_hoveredNode)) {
      const hoveredNode = _hoveredNode;
      const resource = hoveredNode; // flattened: node carries option/name/uri
      if (resource && 'wikipedia' === resource.option) {
        hoveredNode.checked = true;
        hoveredNode.transparency = 1;
        wuwei.search.wikipedia.service.getRelated(resource.name)
          .then(relatedWikis => {
            const map = new Map();
            relatedWikis.forEach(wiki => {
              map.set(wiki.title, wiki);
            });
            model.addWikipedia({
              item: hoveredNode,
              map: map
            });
            return { h: hoveredNode, e: event };
          })
          .then((data) => {
            const
              hoveredNode_ = data.h,
              event_ = data.e;
            return ContextMENU('CMND', hoveredNode_, event_);
          });
      }
      else {
        return ContextMENU('CMND', hoveredNode, event);
      }
    }
    else if (util.isLink(_hoveredNode)) {
      const hoveredLink = state.hoveredNode || resolveContextTargetRecord(_hoveredNode) || _hoveredNode;
      return ContextMENU('CMND', hoveredLink, event);
    }
  };

  ContextEDIT = function (_hoveredNode, event) {
    // var timelineSpec, timelineEditTarget;
    if (state.Connecting || 'view' === graph.mode) {
      return null;
    }
    clearTimeout(state.menuTimer); // cancel #ContextMenu close timer

    state.hoveredNode = resolveContextTargetRecord(_hoveredNode);
    state.modal = true;
    closeContext();
    return ContextMENU('EDIT', state.hoveredNode || _hoveredNode, event);
  };

  ContextINFO = function (_hoveredNode, event) {
    var timelineSpec;
    if (state.Connecting) {
      return null;
    }
    clearTimeout(state.menuTimer);
    state.hoveredNode = resolveContextTargetRecord(_hoveredNode);
    state.modal = true;
    closeContext();
    node = state.hoveredNode;
    return ContextMENU('INFO', node, event);
  };

  checkPage = function () {
    var
      current_page = wuwei.common.current.page,
      pageNameEl = document.getElementById('page_name');
    let
      pp,
      name,
      description;

    if (current_page.pp) { pp = current_page.pp; }
    else { pp = ''; }
    pageNameEl.querySelector('.pp').innerHTML = `P.${pp}`;

    if (current_page.name) { name = current_page.name; }
    else { name = ''; }
    pageNameEl.querySelector('.name').innerHTML = name;

    if (current_page.description) { description = current_page.description; }
    else { description = ''; }
    pageNameEl.querySelector('.description').innerHTML = description;

    if (description.length > 0) {
      pageNameEl.querySelector('.description').classList.add('active');
    }
    else {
      pageNameEl.querySelector('.description').classList.remove('active');
    }
  }

  registerPagebuttonEvent = function () {
    const current = wuwei.common.current;
    const pagebuttons = document.querySelectorAll('#Pagination .pagination div[data-value]');

    pagebuttons.forEach(function (pagebutton) {
      pagebutton.addEventListener('mouseover', function (event) {
        event.stopPropagation();
        event.preventDefault();

        const button = event.currentTarget;
        const thumbnail = document.getElementById('pageThumbnail');

        if (!button || !thumbnail) {
          return false;
        }

        const pageId = String((button.dataset && button.dataset.value) || '');
        const pages = Array.isArray(current.pages) ? current.pages : [];
        const page = pages.find(function (item) { return item && item.id === pageId; });
        if (!page) {
          thumbnail.innerHTML = '';
          thumbnail.style.display = 'none';
          return false;
        }

        let iconHtml = page.thumbnail || '';

        if (!Array.isArray(page.nodes) || page.nodes.length === 0) {
          iconHtml = '<svg class="miniSvg"><g class="miniCanvas" transform="scale(0.5)"></g></svg>';
        }
        else if (!iconHtml) {
          try {
            iconHtml = wuwei.note.buildPageThumbnail(page) ||
              util.buildMiniatureSvgString({
                width: 200,
                height: 200,
                useDataOnly: true,
                showViewFrame: true,
                backgroundFill: '#ffffff',
                page: page,
                nodes: page.nodes || [],
                links: (util.getMiniatureLinks ? util.getMiniatureLinks(page) : (page.links || []))
              });
            page.thumbnail = iconHtml;
          } catch (e) {
            console.log(e);
            iconHtml = '';
          }
        }

        if (!iconHtml) {
          thumbnail.innerHTML = '';
          thumbnail.style.display = 'none';
          return false;
        }

        thumbnail.innerHTML = iconHtml;

        const miniSvg = thumbnail.querySelector('svg.miniSvg');
        if (miniSvg) {
          miniSvg.setAttribute('width', 200);
          miniSvg.setAttribute('height', 200);
        }

        thumbnail.style.display = 'block';

        if ('view' === graph.mode || state.control_width === 0) {
          thumbnail.style.left = event.clientX + 'px';
        } else {
          thumbnail.style.left = (event.clientX - thumbnail.offsetWidth / 2) + 'px';
        }

        const oldName = thumbnail.querySelector('text.name');
        if (oldName) {
          oldName.remove();
        }

        if (page.name) {
          d3.select('#pageThumbnail')
            .append('text')
            .attr('class', 'name')
            .text(page.name);
        }

        return false;
      });

      pagebutton.addEventListener('mouseout', function (event) {
        event.stopPropagation();
        event.preventDefault();

        const thumbnail = document.getElementById('pageThumbnail');
        if (thumbnail) {
          thumbnail.innerHTML = '';
          thumbnail.style.display = 'none';
        }
        return false;
      });
    });
  }

  refreshPagenation = function () {
    const current = wuwei.common.current;
    const pages = Array.isArray(current.pages) ? current.pages : [];
    const paginationEl = document.getElementById('Pagination');

    pages.forEach(function (page, index) {
      page.pp = index + 1;
    });

    if (!paginationEl) {
      return;
    }

    if (pages.length < 2) {
      let pagination = document.querySelector('#Pagination .pagination');
      if (pagination) {
        pagination.innerHTML = '';
      }
      paginationEl.style.display = 'none';
      return;
    }

    paginationEl.style.left = '1rem';

    const per_page = 5;
    const count = 1;
    const activePage = pages.find(function (page) { return page && page.id === current.currentPage; }) || current.page || pages[0];
    const currentIndex = Math.max(0, pages.indexOf(activePage));
    const current_page = 1 + Math.floor(currentIndex / per_page);

    const records = pages.map(function (page, index) {
      page.pp = index + 1;
      return {
        name: page.pp,
        value: page.id
      };
    });

    wuwei.menu.pagination.create(
      'Pagination',
      current_page,
      count,
      per_page,
      pages.length,
      function (pageId) {
        const opened = note.openPage(String(pageId || ''));
        if (!opened) {
          return;
        }
        draw.redraw();

        checkPage();

        var thumbnail = document.getElementById('pageThumbnail');
        if (thumbnail) {
          thumbnail.style.display = 'none';
        }

        setTimeout(registerPagebuttonEvent, 400);
      },
      records
    );

    registerPagebuttonEvent();
  }

  function getUrlWithoutParams(href) {
    return String(href || '').trim().replace(/[?#].*$/, '');
  }

  function getUrlForTypeCheck(href) {
    return String(href || '').trim().replace(/[?#].*$/, '').toLowerCase();
  }

  getOpenUrl = function (node) {
    var resource = getNodeResource(node);
    var href = getTextOriginalHref(node, resource) ||
      (resource && ((resource.original && resource.original.url) || resource.uri || resource.canonicalUri)) || '';
    var previewUrl = getOfficePreviewOpenUrl(node);
    var officeUrl = getOfficeViewerOpenUrl(node);
    var absoluteUrl;

    if (previewUrl) {
      return previewUrl;
    }
    if (officeUrl) {
      return officeUrl;
    }

    absoluteUrl = normaliseOpenHref(href);
    if (!absoluteUrl) {
      return '';
    }

    if (isHtmlDocumentReference(resource, absoluteUrl)) {
      return absoluteUrl;
    }

    if (isTextDocumentReference(resource, absoluteUrl)) {
      return getTextViewerOpenUrl(absoluteUrl);
    }

    return absoluteUrl;
  };

  function normaliseOpenHref(href) {
    var base;

    href = String(href || '').trim();
    if (!href) {
      return '';
    }

    // そのまま開けるURL
    if (/^(https?:|blob:|data:|mailto:|tel:)/i.test(href)) {
      return href;
    }

    // //example.com/path
    if (/^\/\//.test(href)) {
      return location.protocol + href;
    }

    // 相対URL・ルート相対URLを絶対URL化
    base = location.href.substr(0, location.href.lastIndexOf('/') + 1);
    return new URL(href, base).href;
  }

  function getOfficePreviewOpenUrl(node, pageNumber) {
    var resource = getNodeResource(node);
    var previewUri;

    if (!resource || !util.isLocalHost() || !isOfficeResource(resource)) {
      return '';
    }

    /*
     * On the local server, uploaded Office files cannot be displayed by
     * Office Viewer because view.officeapps.live.com cannot fetch
     * http://127.0.0.1/... or http://localhost/... .  Use the PDF created
     * during the OpenOffice/LibreOffice thumbnail-preview process instead.
     */
    previewUri = wuwei.util.getResourcePdfPreviewUri(node);
    if (previewUri) {
      return appendPdfPageForOpen(previewUri, pageNumber);
    }
    previewUri = wuwei.viewpoint.getContentTargetViewerUrl(node, pageNumber || 1);
    if (isPdfLikeOpenUri(previewUri)) {
      return previewUri;
    }
    previewUri = wuwei.util.getResourcePreviewUri(node);
    if (isPdfLikeOpenUri(previewUri)) {
      return appendPdfPageForOpen(previewUri, pageNumber);
    }
    return '';
  }

  function isPdfLikeOpenUri(uri) {
    var text = String(uri || '');
    var parsed, path;
    if (!text) { return false; }
    if (/\.pdf(?:[?#].*)?$/i.test(text)) { return true; }
    try {
      parsed = new URL(text, window.location.href);
      path = parsed.searchParams.get('path') || parsed.pathname || '';
      try { path = decodeURIComponent(path); } catch (e) { /* keep path */ }
      return /\.pdf$/i.test(String(path || '').split(/[?#]/)[0]);
    }
    catch (e2) {
      return false;
    }
  }

  function appendPdfPageForOpen(uri, pageNumber) {
    var page = Number(pageNumber || 0);
    var text = String(uri || '');
    if (!text || !Number.isFinite(page) || page < 1 || /#page=/i.test(text) || !isPdfLikeOpenUri(text)) {
      return text;
    }
    return text.replace(/#.*$/, '') + '#page=' + encodeURIComponent(Math.floor(page));
  }

  function getOfficeViewerOpenUrl(node) {
    var resource = getNodeResource(node);
    var href, fetchUrl;

    if (!resource || (util.isLocalHost() && isUploadedContent([node]) && isOfficeResource(resource))) {
      return '';
    }

    href = getOfficeOriginalHref(node, resource) || getDownloadUrl(node) || ((resource.original && resource.original.url) || resource.uri || resource.canonicalUri || '');
    if (!isOfficeDocumentReference(resource, href)) {
      return '';
    }

    fetchUrl = toOfficeViewerFetchUrl(href, node);
    if (!canOfficeViewerFetch(fetchUrl)) {
      return '';
    }

    return 'https://view.officeapps.live.com/op/embed.aspx?src=' + encodeURIComponent(fetchUrl);
  }

  function getTextOriginalHref(node, resource) {
    var uploadPath;

    uploadPath = wuwei.util.getResourceOriginalUri(node);
    if (uploadPath) {
      return uploadPath;
    }

    return '';
  }

  function getOfficeOriginalHref(node, resource) {
    var uploadPath;

    uploadPath = wuwei.util.getResourceOriginalUri(node);
    if (uploadPath) {
      return uploadPath;
    }

    return String(resource && ((resource.original && resource.original.url) || resource.uri || resource.canonicalUri || resource.url) || '').trim();
  }

  function isTextDocumentReference(resource, href) {
    return !isHtmlDocumentReference(resource, href) && !!util.isDocumentKindByExtension(null, resource, href, 'text');
  }

  function isPdfDocumentReference(resource, href) {
    return !!util.isDocumentKindByExtension(null, resource, href, 'pdf');
  }

  function isHtmlDocumentReference(resource, href) {
    var kind = String(resource && resource.kind || '').toLowerCase();
    var documentKind = String(resource && resource.documentKind || '').toLowerCase();
    var mimeType = String(resource && (resource.mimeType || resource.type) || '').toLowerCase();

    return !!(
      util.isDocumentKindByExtension(null, resource, href, 'html') ||
      documentKind === 'html' ||
      kind === 'html' ||
      kind === 'web' ||
      kind === 'webpage' ||
      mimeType.indexOf('text/html') === 0 ||
      mimeType.indexOf('application/xhtml+xml') === 0
    );
  }

  function getTextViewerOpenUrl(href) {
    var url = normaliseOpenHref(href);
    var viewerBase;

    if (!url) {
      return '';
    }
    if (/\/app2\/viewer\/text-viewer\.html(?:[?#]|$)/i.test(url)) {
      return url;
    }

    viewerBase = getAppBasePathForOpen() + 'app2/viewer/text-viewer.html';
    return new URL(viewerBase + '?file=' + encodeURIComponent(url), window.location.origin).href;
  }

  function isOfficeDocumentReference(resource, href) {
    return !!util.isDocumentKindByExtension(null, resource, href, 'office');
  }

  function canOfficeViewerFetch(href) {
    var parsed;
    if (!/^https?:\/\//i.test(String(href || ''))) {
      return false;
    }
    try {
      parsed = new URL(href, window.location.href);
      return !/^(?:localhost|127\.0\.0\.1|\[?::1\]?)$/i.test(parsed.hostname);
    }
    catch (e) {
      return false;
    }
  }

  function toOfficeViewerFetchUrl(href, node) {
    var parsed, area, path, uid, basePath, direct;
    var text = String(href || '').trim();

    if (wuwei.util && typeof wuwei.util.getResourceDirectFileUri === 'function') {
      direct = wuwei.util.getResourceDirectFileUri(getNodeResource(node), 'original', node);
      if (direct) {
        return new URL(direct, window.location.origin).href;
      }
    }

    try {
      parsed = new URL(text, window.location.href);
    }
    catch (e) {
      return text;
    }

    area = parsed.searchParams.get('area') || '';
    path = parsed.searchParams.get('path') || '';
    uid = parsed.searchParams.get('user_id') || getResourceOwnerIdForOpen(node);
    if (!path || area !== 'upload' || !/(?:^|\/)(?:cgi-bin|server)\/load-file\.(?:py|cgi)$/i.test(parsed.pathname)) {
      return parsed.href;
    }

    basePath = getAppBasePathForOpen();
    return new URL(basePath + 'data/' + encodeURIComponent(uid) + '/upload/' + encodeStoragePathForOpen(path), window.location.origin).href;
  }

  function getAppBasePathForOpen() {
    var path = (window.location && window.location.pathname) ? window.location.pathname : '/wu_wei2/';
    var marker = '/wu_wei2/';
    var idx = path.indexOf(marker);
    if (idx >= 0) {
      return path.slice(0, idx + marker.length);
    }
    return '/wu_wei2/';
  }

  function encodeStoragePathForOpen(path) {
    return String(path || '')
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .split('/')
      .map(function (part) { return encodeURIComponent(part); })
      .join('/');
  }

  function getResourceOwnerIdForOpen(node) {
    var resource = getNodeResource(node) || {};
    var audit = (resource.audit && 'object' === typeof resource.audit) ? resource.audit : {};
    var rights = (resource.rights && 'object' === typeof resource.rights) ? resource.rights : {};
    var nodeAudit = (node && node.audit && 'object' === typeof node.audit) ? node.audit : {};

    return String(
      audit.owner ||
      audit.createdBy ||
      rights.owner ||
      nodeAudit.owner ||
      nodeAudit.createdBy ||
      wuwei.util.getCurrentUserId() ||
      ''
    ).trim();
  }

  function basenameFromDownloadPath(value) {
    var text = String(value || '').trim();
    var url, queryPath;
    if (!text) { return ''; }
    try {
      url = new URL(text, window.location && window.location.href ? window.location.href : undefined);
      queryPath = url.searchParams.get('path');
      text = queryPath || url.pathname || text;
    } catch (e) {
      // Keep relative filesystem/data paths as-is.
    }
    text = text.replace(/\\/g, '/').replace(/[?#].*$/, '').replace(/\/+$/, '');
    try {
      text = decodeURIComponent(text);
    } catch (e) {
      // Leave undecodable paths unchanged.
    }
    return text.split('/').pop() || '';
  }

  function hasFileExtension(name) {
    return /\.[A-Za-z0-9]{1,12}$/.test(String(name || ''));
  }

  function getDownloadFilename(node, href) {
    var resource = node ? getNodeResource(node) : null;
    var file = null;
    var candidates = [];
    var fallback = '';
    var ext = '';

    if (resource) {
      file = wuwei.util.getResourceFile(resource, 'original');
    }
    if (file) {
      candidates.push(file.path, file.sourcePath, file.uri, file.url);
    }
    candidates.push(
      href,

      identity.title,
      node && node.label
    );

    for (var i = 0; i < candidates.length; i += 1) {
      var name = basenameFromDownloadPath(candidates[i]);
      if (hasFileExtension(name)) {
        return name;
      }
      if (!fallback && name) {
        fallback = name;
      }
    }

    fallback = fallback || String(identity.title || (node && node.label) || 'download');
    return fallback;
  }

  getDownloadUrl = function (node) {
    var resource = getNodeResource(node);
    var href = '';
    var base;

    if (resource) {
      href = wuwei.util.getResourceFileUri(resource, 'original', node);
    }
    if (!href) {
      href = (resource && ((resource.original && resource.original.url) || resource.uri || resource.canonicalUri)) || '';
    }

    href = String(href || '').trim();
    if (!href) {
      return '';
    }

    if (/^(https?:|blob:|data:)/i.test(href)) {
      return href;
    }

    if (/^\/\//.test(href)) {
      return location.protocol + href;
    }

    base = location.href.substr(0, location.href.lastIndexOf('/') + 1);
    return new URL(href, base).href;
  };

  function clearSelectionState() {
    state.selectedNodeIds = [];
    state.selectedGroupIds = [];
    state.selectedGroupMarks = {};
    d3.selectAll('g.node.selected circle.selected').remove();
    d3.selectAll('g.node.selected')
      .each(function () {
        d3.select(this).classed('selected', false);
      });
  }

  function getScreenSelectedNodes(fallbackNodes) {
    var page = getCurrentPage();
    var nodes = [];
    var seen = {};

    function findOperationNodeById(nodeId) {
      var node;
      if (!nodeId) {
        return null;
      }
      node = model.findNodeById(nodeId);
      if (node) {
        return node;
      }
      return (graph.nodes || []).find(function (candidate) {
        return candidate && candidate.id === nodeId;
      }) || null;
    }

    function addNode(node) {
      if (node && node.id) {
        node = findOperationNodeById(node.id) || node;
      }
      if (node && node.id && !seen[node.id]) {
        seen[node.id] = true;
        nodes.push(node);
      }
    }

    d3.selectAll('g.node.selected').each(function () {
      var nodeId = this && this.id;
      var node;
      if (!nodeId) {
        return;
      }
      node = findOperationNodeById(nodeId);
      if (node && isRepresentativeTopic(node) && node.groupRef) {
        if (!Array.isArray(state.selectedGroupIds)) {
          state.selectedGroupIds = [];
        }
        if (state.selectedGroupIds.indexOf(node.groupRef) < 0) {
          state.selectedGroupIds.push(node.groupRef);
        }
        return;
      }
      addNode(node);
    });

    d3.selectAll('circle.selected').each(function (d) {
      var nodeId;
      if (d && d.groupRef && (isRepresentativeTopic(d) || d.type === 'Group' || d.pseudo)) {
        if (!Array.isArray(state.selectedGroupIds)) {
          state.selectedGroupIds = [];
        }
        if (state.selectedGroupIds.indexOf(d.groupRef) < 0) {
          state.selectedGroupIds.push(d.groupRef);
        }
        return;
      }
      nodeId = d && d.id ? d.id : (this && this.parentNode && this.parentNode.id);
      addNode(findOperationNodeById(nodeId));
    });

    (Array.isArray(state.selectedNodeIds) ? state.selectedNodeIds : []).forEach(function (nodeId) {
      addNode(findOperationNodeById(nodeId));
    });

    if (Array.isArray(fallbackNodes)) {
      fallbackNodes.forEach(function (n) {
        if (n && n.id && isRepresentativeTopic(n) && n.groupRef) {
          if (!Array.isArray(state.selectedGroupIds)) {
            state.selectedGroupIds = [];
          }
          if (state.selectedGroupIds.indexOf(n.groupRef) < 0) {
            state.selectedGroupIds.push(n.groupRef);
          }
          return;
        }
        addNode(n);
      });
    }

    return nodes;
  }

  function notifyFlockError(message) {
    message = message || 'Alignment commands require two or more ungrouped nodes.';
    if (wuwei.menu && wuwei.menu.snackbar && typeof wuwei.menu.snackbar.open === 'function') {
      wuwei.menu.snackbar.open({
        type: 'warning',
        message: message
      });
    }
    else {
      window.alert(wuwei.nls && typeof wuwei.nls.translate === 'function'
        ? wuwei.nls.translate(message)
        : message);
    }
  }

  function collectAlignmentSelection() {
    var out = {
      ungroupedNodes: [],
      groupedNodes: [],
      groupIds: []
    };
    var seenNodes = {};
    var seenGroups = {};

    function findNode(nodeId) {
      if (!nodeId) {
        return null;
      }
      return (model.findNodeById && model.findNodeById(nodeId)) ||
        (graph.nodes || []).find(function (candidate) {
          return candidate && candidate.id === nodeId;
        }) ||
        null;
    }

    function addGroup(groupId) {
      if (!groupId || seenGroups[groupId]) {
        return;
      }
      seenGroups[groupId] = true;
      out.groupIds.push(groupId);
    }

    function addNode(node) {
      if (node && node.id) {
        node = findNode(node.id) || node;
      }
      if (!node || !node.id || seenNodes[node.id]) {
        return;
      }
      seenNodes[node.id] = true;
      if (node.groupRole === 'representative' && node.groupRef) {
        addGroup(node.groupRef);
        return;
      }
      if (model.isNodeInAnyGroup && model.isNodeInAnyGroup(node.id)) {
        out.groupedNodes.push(node);
      }
      else {
        out.ungroupedNodes.push(node);
      }
    }

    d3.selectAll('g.node.selected').each(function (d) {
      addNode(d && d.id ? d : findNode(this && this.id));
    });

    d3.selectAll('circle.selected').each(function (d) {
      var nodeId;
      if (d && d.groupRef && (isRepresentativeTopic(d) || d.type === 'Group' || d.pseudo)) {
        addGroup(d.groupRef);
        return;
      }
      nodeId = d && d.id ? d.id : (this && this.parentNode && this.parentNode.id);
      addNode(findNode(nodeId));
    });

    (Array.isArray(state.selectedNodeIds) ? state.selectedNodeIds : []).forEach(function (nodeId) {
      addNode(findNode(nodeId));
    });
    (Array.isArray(state.selectedGroupIds) ? state.selectedGroupIds : []).forEach(addGroup);

    return out;
  }

  function isUngroupedFlockNode(node) {
    if (!node || !node.id || (node.groupRole === 'representative' && node.groupRef)) {
      return false;
    }
    return !(model.isNodeInAnyGroup && model.isNodeInAnyGroup(node.id));
  }

  function isAlignableFlockSelection() {
    var selection = collectAlignmentSelection();

    return selection.groupIds.length === 0 &&
      selection.groupedNodes.length === 0 &&
      selection.ungroupedNodes.length >= 2 &&
      selection.ungroupedNodes.every(isUngroupedFlockNode);
  }

  function getEffectiveSelectedGroupIds(page, option) {
    var selectedGroupIds = Array.isArray(state.selectedGroupIds) ? state.selectedGroupIds.slice() : [];
    var allowedTypes = option && Array.isArray(option.types)
      ? option.types
      : ['simple', 'horizontal', 'vertical', 'timeline', 'viewpoint'];

    function normalizeGroupType(group) {
      if (!group) {
        return '';
      }
      if (group.type === 'simpleGroup') {
        return 'simple';
      }
      if (group.type === 'horizontalGroup') {
        return 'horizontal';
      }
      if (group.type === 'verticalGroup') {
        return 'vertical';
      }
      if (group.type === 'topicGroup') {
        return group.orientation === 'horizontal' ? 'horizontal' : 'vertical';
      }
      if ((group.type === 'Group' || group.type === 'topicGroup') && group.groupType === 'axis') {
        return 'timeline';
      }
      return group.type || group.groupType || '';
    }

    return selectedGroupIds.filter(function (gid, index, arr) {
      var group = model.findGroupById(gid);
      return arr.indexOf(gid) === index && !!group && allowedTypes.indexOf(normalizeGroupType(group)) >= 0;
    });
  }

  function isNormalRegroupGroup(group) {
    return !!(group && ['simple', 'horizontal', 'vertical'].indexOf(group.type) >= 0);
  }

  function getRepresentativeNodeForGroup(group) {
    var reps;
    if (!group) {
      return null;
    }
    reps = model.getGroupRepresentativeNodes(group) || [];
    return (reps && reps.length) ? reps[0] : null;
  }

  function descriptionBodyOf(node) {
    var description = node && node.description;
    if (description && 'object' === typeof description) {
      return String(description.body || '');
    }
    return String(description || '');
  }

  function buildRepresentativeMeta(selectedGroups) {
    var reps = [];
    var labels, bodies, firstFormat;

    (selectedGroups || []).forEach(function (group) {
      var rep = getRepresentativeNodeForGroup(group);
      if (rep) {
        reps.push(rep);
      }
    });

    if (!reps.length) {
      return null;
    }

    labels = reps.map(function (rep) {
      return String(rep.label || '').trim();
    }).filter(Boolean);

    bodies = reps.map(function (rep) {
      return descriptionBodyOf(rep).trim();
    }).filter(Boolean);

    firstFormat = (reps[0].description && reps[0].description.format) || 'asciidoc';

    return {
      name: labels.join('\n'),
      description: {
        format: firstFormat,
        body: bodies.join('\n')
      }
    };
  }

  function groupSpineDefaults(type, visible) {
    var defaults = model.groupStyleDefaults(type) || {};
    return {
      kind: defaults.kind,
      visible: visible,
      color: defaults.color,
      width: defaults.width,
      padding: defaults.padding,
      paddingTop: defaults.paddingTop,
      paddingRight: defaults.paddingRight,
      paddingBottom: defaults.paddingBottom,
      paddingLeft: defaults.paddingLeft
    };
  }


  function getGroupOperationNodes(group) {
    var nodes = [];
    var seen = {};

    if (!group || !group.id || !model) {
      return nodes;
    }

    function add(node) {
      if (!node || !node.id || seen[node.id]) {
        return;
      }
      seen[node.id] = true;
      nodes.push(node);
    }

    (model.findGroupNodes(group.id) || []).forEach(add);
    (model.getGroupRepresentativeNodes(group) || []).forEach(add);

    return nodes;
  }

  function operationHalfWidth(node) {
    var size = node && node.size ? node.size : {};
    var radius = Number(size.radius);
    var width = Number(size.width);

    if (Number.isFinite(radius) && radius > 0) {
      return radius;
    }
    if (Number.isFinite(width) && width > 0) {
      return width / 2;
    }
    return 0;
  }

  function operationHalfHeight(node) {
    var size = node && node.size ? node.size : {};
    var radius = Number(size.radius);
    var height = Number(size.height);

    if (Number.isFinite(radius) && radius > 0) {
      return radius;
    }
    if (Number.isFinite(height) && height > 0) {
      return height / 2;
    }
    return 0;
  }

  function getNodeOperationBounds(node) {
    var halfW;
    var halfH;

    if (!node || !Number.isFinite(Number(node.x)) || !Number.isFinite(Number(node.y))) {
      return null;
    }

    halfW = operationHalfWidth(node);
    halfH = operationHalfHeight(node);

    return {
      left: Number(node.x) - halfW,
      right: Number(node.x) + halfW,
      top: Number(node.y) - halfH,
      bottom: Number(node.y) + halfH,
      width: 2 * halfW,
      height: 2 * halfH,
      cx: Number(node.x),
      cy: Number(node.y)
    };
  }

  function getGroupOperationBounds(group) {
    var nodes = getGroupOperationNodes(group);
    var bounds = nodes.map(getNodeOperationBounds).filter(Boolean);
    var box;
    var spine;
    var strokeWidth;
    var left, right, top, bottom;

    if (group && group.type === 'simple' && model.resolveGroupBox) {
      box = model.resolveGroupBox(group.id);
      if (box) {
        left = Number(box.x);
        top = Number(box.y);
        right = left + Number(box.width);
        bottom = top + Number(box.height);
        return {
          left: left,
          right: right,
          top: top,
          bottom: bottom,
          width: right - left,
          height: bottom - top,
          cx: (left + right) / 2,
          cy: (top + bottom) / 2
        };
      }
    }

    if (group && (group.type === 'horizontal' || group.type === 'vertical') && model.resolveGroupSpine) {
      spine = model.resolveGroupSpine(group.id);
      if (spine) {
        strokeWidth = Number.isFinite(Number(spine.strokeWidth)) ? Number(spine.strokeWidth) : 0;
        left = Math.min(Number(spine.x1), Number(spine.x2)) - strokeWidth / 2;
        right = Math.max(Number(spine.x1), Number(spine.x2)) + strokeWidth / 2;
        top = Math.min(Number(spine.y1), Number(spine.y2)) - strokeWidth / 2;
        bottom = Math.max(Number(spine.y1), Number(spine.y2)) + strokeWidth / 2;
        return {
          left: left,
          right: right,
          top: top,
          bottom: bottom,
          width: right - left,
          height: bottom - top,
          cx: (left + right) / 2,
          cy: (top + bottom) / 2
        };
      }
    }

    if (!bounds.length) {
      return null;
    }

    left = Math.min.apply(null, bounds.map(function (b) { return b.left; }));
    right = Math.max.apply(null, bounds.map(function (b) { return b.right; }));
    top = Math.min.apply(null, bounds.map(function (b) { return b.top; }));
    bottom = Math.max.apply(null, bounds.map(function (b) { return b.bottom; }));

    return {
      left: left,
      right: right,
      top: top,
      bottom: bottom,
      width: right - left,
      height: bottom - top,
      cx: (left + right) / 2,
      cy: (top + bottom) / 2
    };
  }

  function buildGroupOperationTargets(selectedNodes) {
    var page = getCurrentPage();
    var targets = [];
    var coveredNodeIds = {};
    var selectedGroupIds = getEffectiveSelectedGroupIds(page);

    selectedGroupIds.forEach(function (gid) {
      var group = model.findGroupById(gid);
      var bounds;

      if (!group) {
        return;
      }

      bounds = getGroupOperationBounds(group);
      if (!bounds) {
        return;
      }

      getGroupOperationNodes(group).forEach(function (node) {
        if (node && node.id) {
          coveredNodeIds[node.id] = true;
        }
      });

      targets.push({
        kind: 'group',
        group: group,
        bounds: bounds,
        x: bounds.cx,
        y: bounds.cy
      });
    });

    (selectedNodes || []).forEach(function (node) {
      var bounds;

      if (!node || !node.id || coveredNodeIds[node.id]) {
        return;
      }

      bounds = getNodeOperationBounds(node);
      if (!bounds) {
        return;
      }

      targets.push({
        kind: 'node',
        node: node,
        bounds: bounds,
        x: bounds.cx,
        y: bounds.cy
      });
    });

    return targets;
  }

  function getUncoveredGroupedNodes(groupedNodes, groupIds) {
    var covered = {};

    (groupIds || []).forEach(function (gid) {
      var group = model.findGroupById ? model.findGroupById(gid) : null;
      getGroupOperationNodes(group).forEach(function (node) {
        if (node && node.id) {
          covered[node.id] = true;
        }
      });
    });

    return (groupedNodes || []).filter(function (node) {
      return !(node && node.id && covered[node.id]);
    });
  }

  function translateSelectedGroupMark(groupId, dx, dy) {
    var mark;
    if (!groupId || !state.selectedGroupMarks || 'object' !== typeof state.selectedGroupMarks) {
      return;
    }
    mark = state.selectedGroupMarks[groupId];
    if (!mark) {
      return;
    }
    if (Number.isFinite(Number(mark.x))) {
      mark.x = Number(mark.x) + dx;
    }
    if (Number.isFinite(Number(mark.y))) {
      mark.y = Number(mark.y) + dy;
    }
  }

  function moveNodeRecord(node, dx, dy) {
    if (!node) {
      return;
    }
    node.x = Number(node.x || 0) + dx;
    node.y = Number(node.y || 0) + dy;
    node.fx = null;
    node.fy = null;
    node.vx = 0;
    node.vy = 0;
    node.changed = true;
  }

  function applyOperationTargetTranslate(target, dx, dy) {
    var pageNode;
    if (!target) {
      return;
    }

    dx = Number(dx || 0);
    dy = Number(dy || 0);

    if (!Number.isFinite(dx) || !Number.isFinite(dy) || (0 === dx && 0 === dy)) {
      return;
    }

    if ('group' === target.kind && target.group) {
      if (model.translateGroupBy(target.group, dx, dy)) {
        translateSelectedGroupMark(target.group.id, dx, dy);
      }
      return;
    }

    if ('node' === target.kind && target.node) {
      pageNode = target.node.id && model.findNodeById ? model.findNodeById(target.node.id) : null;
      if (pageNode && pageNode !== target.node) {
        moveNodeRecord(pageNode, dx, dy);
      }
      moveNodeRecord(target.node, dx, dy);
    }
  }

  function moveOperationTargetCenter(target, x, y) {
    var dx;
    var dy;

    if (!target || !target.bounds) {
      return;
    }

    dx = Number.isFinite(Number(x)) ? Number(x) - target.bounds.cx : 0;
    dy = Number.isFinite(Number(y)) ? Number(y) - target.bounds.cy : 0;
    applyOperationTargetTranslate(target, dx, dy);
  }

  function getOperationTargetMetrics(targets) {
    var xMin;
    var xMax;
    var yMin;
    var yMax;
    var xSum;
    var ySum;
    var leftTarget;
    var rightTarget;
    var topTarget;
    var bottomTarget;

    targets = (targets || []).filter(function (target) { return !!(target && target.bounds); });
    if (!targets.length) {
      return null;
    }

    xMin = Number.MAX_VALUE;
    xMax = -Number.MAX_VALUE;
    yMin = Number.MAX_VALUE;
    yMax = -Number.MAX_VALUE;
    xSum = 0;
    ySum = 0;

    targets.forEach(function (target) {
      var b = target.bounds;

      if (b.left < xMin) { xMin = b.left; leftTarget = target; }
      if (b.right > xMax) { xMax = b.right; rightTarget = target; }
      if (b.top < yMin) { yMin = b.top; topTarget = target; }
      if (b.bottom > yMax) { yMax = b.bottom; bottomTarget = target; }
      xSum += b.cx;
      ySum += b.cy;
    });

    return {
      count: targets.length,
      xMin: xMin,
      xMax: xMax,
      yMin: yMin,
      yMax: yMax,
      xSum: xSum,
      ySum: ySum,
      leftTarget: leftTarget,
      rightTarget: rightTarget,
      topTarget: topTarget,
      bottomTarget: bottomTarget
    };
  }

  function distributeHorizontalGaps(targets) {
    var sorted;
    var totalWidth;
    var gap;
    var cursor;

    sorted = (targets || []).filter(function (target) {
      return !!(target && target.bounds);
    }).sort(function (a, b) {
      return a.bounds.left - b.bounds.left;
    });
    if (sorted.length < 3) {
      return;
    }

    totalWidth = sorted.reduce(function (sum, target) {
      return sum + target.bounds.width;
    }, 0);
    gap = (sorted[sorted.length - 1].bounds.right - sorted[0].bounds.left - totalWidth) / (sorted.length - 1);
    cursor = sorted[0].bounds.right + gap;

    for (let i = 1; i < sorted.length - 1; i++) {
      moveOperationTargetCenter(sorted[i], cursor + sorted[i].bounds.width / 2, sorted[i].bounds.cy);
      cursor += sorted[i].bounds.width + gap;
    }
  }

  function distributeVerticalGaps(targets) {
    var sorted;
    var totalHeight;
    var gap;
    var cursor;

    sorted = (targets || []).filter(function (target) {
      return !!(target && target.bounds);
    }).sort(function (a, b) {
      return a.bounds.top - b.bounds.top;
    });
    if (sorted.length < 3) {
      return;
    }

    totalHeight = sorted.reduce(function (sum, target) {
      return sum + target.bounds.height;
    }, 0);
    gap = (sorted[sorted.length - 1].bounds.bottom - sorted[0].bounds.top - totalHeight) / (sorted.length - 1);
    cursor = sorted[0].bounds.bottom + gap;

    for (let i = 1; i < sorted.length - 1; i++) {
      moveOperationTargetCenter(sorted[i], sorted[i].bounds.cx, cursor + sorted[i].bounds.height / 2);
      cursor += sorted[i].bounds.height + gap;
    }
  }

  function definePersistentGroup(kind, selectedNodes) {
    var page = getCurrentPage();
    var nodes;
    var requestedNodeIds;

    // ContextOperate() から渡された selectedNodes を先に id 化して保持する。
    // group 定義は common.current.page を正本として行うため、
    // 以後の member 解決は object 参照ではなく node id を正本にする。
    requestedNodeIds = Array.isArray(selectedNodes)
      ? selectedNodes
        .filter(function (n) { return n && !n.pseudo && n.id; })
        .map(function (n) { return n.id; })
      : [];

    // common.graph は common.current.page から展開した描画用データであり、
    // graph.nodes / graph.links から page.nodes / page.links へは戻さない。
    page = getCurrentPage();

    var isHorizontal = ('topicGroupHorizontal' === kind);
    var isVertical = ('topicGroupVertical' === kind);
    var selectedGroupIds;
    var requestedGroupIds = [];
    var selectedRepresentativeIds = [];
    var selectedGroups, preserveGroup, preserveMetaGroup, representativeMeta, nameBase, memberMap, existingItemByNodeId, members, avg, group, selectedNodeIds;
    var newType, preserveSpine;

    if (!page) {
      return null;
    }
    if (!Array.isArray(page.groups)) {
      page.groups = [];
    }

    nodes = getScreenSelectedNodes(Array.isArray(selectedNodes) ? selectedNodes.filter(Boolean) : []);

    // DOM 上の selected class が取りこぼされる場合でも、呼び出し時点の selectedNodes から
    // page 正本の node を再解決して 2 件以上の member 候補を確保する。
    if (requestedNodeIds.length > 0) {
      requestedNodeIds.forEach(function (nodeId) {
        var resolved = model.findNodeById(nodeId);
        if (resolved && isRepresentativeTopic(resolved) && resolved.groupRef) {
          if (requestedGroupIds.indexOf(resolved.groupRef) < 0) {
            requestedGroupIds.push(resolved.groupRef);
          }
          return;
        }
        if (resolved && !resolved.pseudo && !nodes.some(function (n) { return n && n.id === resolved.id; })) {
          nodes.push(resolved);
        }
      });
    }

    selectedGroupIds = getEffectiveSelectedGroupIds(page, { types: ['simple', 'horizontal', 'vertical'] });
    requestedGroupIds.forEach(function (gid) {
      var requestedGroup = model.findGroupById(gid);
      if (selectedGroupIds.indexOf(gid) < 0 && isNormalRegroupGroup(requestedGroup)) {
        selectedGroupIds.push(gid);
      }
    });
    selectedGroups = selectedGroupIds
      .map(function (gid) { return model.findGroupById(gid); })
      .filter(Boolean);
    preserveMetaGroup = (selectedGroups.length > 0) ? selectedGroups[0] : null;
    preserveGroup = (1 === selectedGroups.length) ? selectedGroups[0] : null;
    representativeMeta = buildRepresentativeMeta(selectedGroups);
    selectedGroups.forEach(function (selectedGroup) {
      var rep = getRepresentativeNodeForGroup(selectedGroup);
      if (rep && rep.id && selectedRepresentativeIds.indexOf(rep.id) < 0) {
        selectedRepresentativeIds.push(rep.id);
      }
    });
    // 単一 group の再定義時のみ id を引き継ぐ。
    // 複数 group をまとめる場合は、新しい group として作り直す。
    memberMap = {};
    existingItemByNodeId = {};

    page.groups.forEach(function (g) {
      if (!g) {
        return;
      }
      var groupMembers = model.getGroupMembers ? model.getGroupMembers(g) : ((g && g.members) || []);
      groupMembers.forEach(function (member) {
        var nodeId = member && member.nodeId;
        if (nodeId && !existingItemByNodeId[nodeId]) {
          existingItemByNodeId[nodeId] = util.clone(member);
        }
      });
    });

    nodes.forEach(function (n) {
      if (n && n.id) {
        memberMap[n.id] = n;
      }
    });

    selectedGroups.forEach(function (g) {
      model.findGroupNodes(g.id).forEach(function (n) {
        if (n && n.id) {
          memberMap[n.id] = n;
        }
      });
    });

    members = Object.keys(memberMap).map(function (id) { return memberMap[id]; }).filter(function (n) {
      return n && !n.pseudo && isFinite(n.x) && isFinite(n.y);
    });

    // group は常に real node 2 件以上で定義する。
    // pseudo timeline point / pseudo group node が混ざっても member に含めない。
    if (members.length < 2) {
      return null;
    }

    selectedNodeIds = nodes.filter(function (n) { return n && n.id; }).map(function (n) { return n.id; });

    // group が選択されている場合は group 全体を一旦削除し、そのメンバを新 group に再登録する
    page.groups = page.groups.filter(function (g) {
      return !g || selectedGroupIds.indexOf(g.id) < 0;
    });

    if (selectedRepresentativeIds.length > 0 && Array.isArray(page.nodes)) {
      page.nodes = page.nodes.filter(function (n) {
        return !n || selectedRepresentativeIds.indexOf(n.id) < 0;
      });
    }

    // 項目が選択されている場合は、元 group からその項目だけを解除する
    if (selectedNodeIds.length > 0) {
      page.groups.forEach(function (g) {
        if (!g || selectedGroupIds.indexOf(g.id) >= 0) {
          return;
        }
        if (Array.isArray(g.members)) {
          g.members = g.members.filter(function (it) {
            return it && selectedNodeIds.indexOf(it.nodeId) < 0;
          });
        }
      });
    }

    /*
     * Do not pre-align member coordinates here.  The model-layer
     * reflowGroupMembers() applies the canonical group-layout rules:
     *   vertical   : centre x, keep y
     *   horizontal : keep x, centre y
     *   simple     : keep x/y
     * and it also handles h<->v conversions without collapsing members.
     */

    newType = isHorizontal ? 'horizontal' : (isVertical ? 'vertical' : 'simple');
    preserveSpine = !!(preserveMetaGroup && preserveMetaGroup.spine && preserveMetaGroup.type === newType);
    nameBase = (isHorizontal || isVertical) ? 'Topic Group' : 'Simple Group';
    group = model.createGroup({
      id: preserveGroup ? preserveGroup.id : undefined,
      name: (representativeMeta && representativeMeta.name)
        ? representativeMeta.name
        : ((preserveMetaGroup && preserveMetaGroup.name && 1 === selectedGroups.length) ? preserveMetaGroup.name : (nameBase + ' ' + (page.groups.length + 1))),
      description: (representativeMeta && representativeMeta.description)
        ? representativeMeta.description
        : (preserveMetaGroup && preserveMetaGroup.description ? util.clone(preserveMetaGroup.description) : undefined),
      type: newType,
      enabled: preserveMetaGroup ? (false !== preserveMetaGroup.enabled) : true,
      moveTogether: preserveMetaGroup ? (false !== preserveMetaGroup.moveTogether) : true,
      orientation: isHorizontal ? 'horizontal' : (isVertical ? 'vertical' : 'auto'),
      spine: preserveSpine
        ? util.clone(preserveMetaGroup.spine)
        : groupSpineDefaults(newType, (isHorizontal || isVertical)),
      axis: undefined,
      members: members.map(function (n, index) {
        var existing = existingItemByNodeId[n.id] || {};
        return {
          nodeId: n.id,
          value: typeof existing.value === 'undefined' ? '' : existing.value,
          order: index + 1,
          offset: Number(existing.offset || 0),
          role: existing.role || 'member'
        };
      })
    });

    page.groups.push(group);
    model.setGraphFromCurrentPage();
    model.placeGroupRepresentative(group, { preserveAxisAnchor: false });
    model.reflowGroupMembers(group, newType, preserveMetaGroup ? preserveMetaGroup.type : '');
    model.setGraphFromCurrentPage();
    clearSelectionState();
    closeContextMenu();
    draw.redraw();
    return group;
  }

  ContextOperate = function (method) {
    var nodes = [],
      links = [];
    const current = wuwei.common.current;

    function hasNodeClipboard() {
      return (Array.isArray(state.copyingNodes) && state.copyingNodes.length > 0) ||
        (Array.isArray(state.copyingGroups) && state.copyingGroups.length > 0);
    }

    function updateClipboardMenu(method) {
      if (!['clipboard', 'paste'].includes(method)) {
        return;
      }
      // update menu
      let clipboardEls = document.querySelectorAll('.operator.Clipboard'),
        pasteEls = document.querySelectorAll('.operator.Paste'),
        cloneEls = document.querySelectorAll('.operator.Clone');
      if ('clipboard' === method) {
        for (let i = 0; i < clipboardEls.length; i++) {
          clipboardEls[i].style.display = 'none';
        }
        for (let i = 0; i < pasteEls.length; i++) {
          pasteEls[i].style.display = 'block';
        }
        for (let i = 0; i < cloneEls.length; i++) {
          cloneEls[i].style.display = 'block';
        }
      }
      else if ('paste' === method) {
        state.copyingNodes = null;
        state.copyingGroups = null;
        for (let i = 0; i < clipboardEls.length; i++) {
          clipboardEls[i].style.display = 'block';
        }
        for (let i = 0; i < pasteEls.length; i++) {
          pasteEls[i].style.display = 'none';
        }
        for (let i = 0; i < cloneEls.length; i++) {
          cloneEls[i].style.display = 'none';
        }
      }
    }

    if ('edit-flock' === method && state.Selecting) {
      wuwei.edit.open(null, { flock: true });
      return;
    }
    else if ('edit' === method) {
      node = resolveContextTargetRecord(state.hoveredNode);
      if (!node || !node.id) { return; }

      var editShapeOnly = isShapeOnlyEditForMenu(node);
      var editOption = {
        shapeOnly: editShapeOnly,
        editor: !editShapeOnly,
        citation: false,
        cc: false
      };

      var timelineSpecForEdit = wuwei.menu.timeline.getTimelineTargetSpec(node);
      var viewpointSpecForEdit = (wuwei.viewpoint &&
        typeof wuwei.viewpoint.getContentTargetSpec === 'function')
        ? wuwei.viewpoint.getContentTargetSpec(node)
        : null;
      var editGroup = null;

      if (timelineSpecForEdit && timelineSpecForEdit.point) {
        wuwei.edit.timeline.open(timelineSpecForEdit.point, editOption);
        closeContextMenu();
        return;
      }

      if (timelineSpecForEdit && timelineSpecForEdit.group) {
        wuwei.edit.timeline.open(timelineSpecForEdit.group, editOption);
        closeContextMenu();
        return;
      }

      if (isContextTimelineRepresentative([node])) {
        editGroup = node.groupRef && model.findGroupById ? model.findGroupById(node.groupRef) : null;
        if (editGroup && wuwei.edit.timeline && typeof wuwei.edit.timeline.open === 'function') {
          wuwei.edit.timeline.open(editGroup, editOption);
          closeContextMenu();
          return;
        }
      }

      if (viewpointSpecForEdit && viewpointSpecForEdit.point) {
        if (wuwei.edit.viewpoint && typeof wuwei.edit.viewpoint.openContentTarget === 'function') {
          wuwei.edit.viewpoint.openContentTarget({ node: viewpointSpecForEdit.point, option: editOption });
        }
        else {
          wuwei.edit.open(viewpointSpecForEdit.point, Object.assign({ forceNode: true }, editOption));
        }
        closeContextMenu();
        return;
      }

      if (viewpointSpecForEdit && viewpointSpecForEdit.group) {
        wuwei.edit.viewpoint.openAxisProperties(viewpointSpecForEdit.group, editOption);
        closeContextMenu();
        return;
      }

      if (isContextViewpointRepresentative([node])) {
        editGroup = node.groupRef && model.findGroupById ? model.findGroupById(node.groupRef) : null;
        if (editGroup && wuwei.edit.viewpoint && typeof wuwei.edit.viewpoint.openAxisProperties === 'function') {
          wuwei.edit.viewpoint.openAxisProperties(editGroup, editOption);
          closeContextMenu();
          return;
        }
      }

      if (node.type === 'Group' && node.groupRef && model.findGroupById(node.groupRef)) {
        wuwei.edit.open(model.findGroupById(node.groupRef), editOption);
      }
      else if (node.groupRef && model.findGroupById(node.groupRef)) {
        wuwei.edit.open(node, Object.assign({ forceNode: true }, editOption));
      }
      else if (util.isNode(node)) {
        if ('Topic' === node.type) {
          wuwei.edit.open(node, Object.assign({ forceNode: true }, editOption));
        }
        else {
          wuwei.edit.open(node, editOption);
        }
      }
      else if (util.isLink(node)) {
        link = node;
        wuwei.edit.open(link, editOption);
      }
      closeContextMenu();
      return;
    }
    else if ('editGroup' === method) {
      node = resolveContextTargetRecord(state.hoveredNode);
      if (!node) { return; }

      var groupForEdit = getContextGroupFromTarget(node, getContextTimelineSpec([node]), getContextViewpointSpec([node]));
      if (groupForEdit && ['simple', 'horizontal', 'vertical'].indexOf(groupForEdit.type) >= 0) {
        wuwei.edit.open(groupForEdit, {
          editor: false,
          citation: false,
          cc: false
        });
      }
      closeContextMenu();
      return;
    }
    else if ('createTimelineAxis' === method) {
      node = resolveContextTargetRecord(state.hoveredNode);
      if (!node) { return; }

      wuwei.menu.timeline.createAxisGroup('horizontal', node, { silent: true });

      closeContextMenu();
      return;
    }
    else if ('createViewpointAxis' === method) {
      node = resolveContextTargetRecord(state.hoveredNode);
      if (!node || !wuwei.viewpoint || typeof wuwei.viewpoint.createAxisGroup !== 'function') { return; }

      wuwei.viewpoint.createAxisGroup('horizontal', node, { silent: false });

      closeContextMenu();
      return;
    }
    else if ('editTimelineAxisProps' === method) {
      node = resolveContextTargetRecord(state.hoveredNode);
      if (!node) { return; }

      var axisSpec = wuwei.menu.timeline.getTimelineTargetSpec(node);
      if ((!axisSpec || !axisSpec.group) &&
        wuwei.viewpoint &&
        typeof wuwei.viewpoint.getContentTargetSpec === 'function') {
        axisSpec = wuwei.viewpoint.getContentTargetSpec(node);
      }
      if (!axisSpec || !axisSpec.group) {
        closeContextMenu();
        return;
      }

      if (axisSpec.group.type === 'viewpoint' &&
        wuwei.edit.viewpoint &&
        typeof wuwei.edit.viewpoint.openAxisProperties === 'function') {
        wuwei.edit.viewpoint.openAxisProperties(axisSpec.group);
      }
      else {
        wuwei.edit.timeline.openAxisProperties(axisSpec.group);
      }

      closeContextMenu();
      return;
    }
    else if ('addViewpointEntry' === method) {
      var entryDraft;
      node = resolveContextTargetRecord(state.hoveredNode);
      if (!node || !wuwei.viewpoint || typeof wuwei.viewpoint.createEntryDraft !== 'function') { return; }
      entryDraft = wuwei.viewpoint.createEntryDraft(node);
      closeContextMenu();
      if (entryDraft && wuwei.edit && typeof wuwei.edit.open === 'function') {
        wuwei.edit.open(entryDraft, { pendingViewpointEntry: true });
      }
      return;
    }
    else if ('copyViewpointTarget' === method) {
      node = resolveContextTargetRecord(state.hoveredNode);
      if (!node || !wuwei.viewpoint || typeof wuwei.viewpoint.copyTarget !== 'function') { return; }
      wuwei.log.savePrevious();
      if (wuwei.viewpoint.copyTarget(node)) {
        wuwei.log.storeLog({ operation: 'copy' });
      }
      closeContextMenu();
      return;
    }

    else if ('distributeViewpointPageMarkers' === method) {
      node = resolveContextTargetRecord(state.hoveredNode);
      if (!node || !wuwei.viewpoint || typeof wuwei.viewpoint.distributePageMarkers !== 'function') { return; }
      wuwei.log.savePrevious();
      if (wuwei.viewpoint.distributePageMarkers(node)) {
        wuwei.log.storeLog({ operation: 'distributeViewpointPageMarkers' });
      }
      closeContextMenu();
      return;
    }

    else if ('distributeTopicGroupMembers' === method) {
      node = resolveContextTargetRecord(state.hoveredNode);
      if (!node || !model || typeof model.distributeTopicGroupMembers !== 'function') { return; }
      wuwei.log.savePrevious();
      if (model.distributeTopicGroupMembers(node)) {
        wuwei.log.storeLog({ operation: 'distributeTopicGroupMembers' });
        draw.redraw();
      }
      closeContextMenu();
      return;
    }
    else if ('deleteViewpointTarget' === method) {
      node = resolveContextTargetRecord(state.hoveredNode);
      if (!node || !wuwei.viewpoint || typeof wuwei.viewpoint.deleteTarget !== 'function') { return; }
      wuwei.log.savePrevious();
      if (wuwei.viewpoint.deleteTarget(node)) {
        wuwei.log.storeLog({ operation: 'delete' });
      }
      closeContextMenu();
      return;
    }
    else if ('deleteGroup' === method) {
      node = resolveContextTargetRecord(state.hoveredNode);
      if (deleteGroupTarget(node)) {
        closeContextMenu();
        return;
      }
      closeContextMenu();
      return;
    }
    else if ('copy' === method &&
      isContextGroup([resolveContextTargetRecord(state.hoveredNode)])) {
      node = resolveContextTargetRecord(state.hoveredNode);
      if (!node) { return; }
      if (model && typeof model.copyGroup === 'function') {
        wuwei.log.savePrevious();
        var copiedGroupLog = model.copyGroup(node);
        if (copiedGroupLog) {
          wuwei.log.storeLog({ operation: 'copy' });
          draw.redraw();
        }
        closeContextMenu();
        return;
      }
    }
    else if ('erase' === method) {
      node = resolveContextTargetRecord(state.hoveredNode);
      if (!node) { return; }

      if (isWholeGroupEraseTarget(node) && model && typeof model.eraseGroup === 'function') {
        wuwei.log.savePrevious();
        if (model.eraseGroup(node)) {
          wuwei.log.storeLog({ operation: 'erase' });
          draw.redraw();
        }
        closeContextMenu();
        return;
      }

      var eraseTimelineSpec = wuwei.menu.timeline.getTimelineTargetSpec(node);
      if (eraseTimelineSpec && eraseTimelineSpec.group) {
        if (eraseTimelineSpec.point) {
          if (eraseTimelineSpec.point.axisRole === 'start' || eraseTimelineSpec.point.axisRole === 'end') {
            closeContextMenu();
            return;
          }
          wuwei.log.savePrevious();
          if (wuwei.menu.timeline.deleteTimePoint(eraseTimelineSpec.point)) {
            wuwei.log.storeLog({ operation: 'erase' });
          }
          closeContextMenu();
          return;
        }
        wuwei.log.savePrevious();
        if (wuwei.timeline && typeof wuwei.timeline.deleteAxisGroup === 'function' &&
          wuwei.timeline.deleteAxisGroup(eraseTimelineSpec.group)) {
          wuwei.log.storeLog({ operation: 'erase' });
        }
        closeContextMenu();
        return;
      }

      if (wuwei.viewpoint && typeof wuwei.viewpoint.getContentTargetSpec === 'function' &&
        typeof wuwei.viewpoint.deleteTarget === 'function') {
        var eraseViewpointSpec = wuwei.viewpoint.getContentTargetSpec(node);
        if (eraseViewpointSpec && eraseViewpointSpec.group) {
          wuwei.log.savePrevious();
          if (wuwei.viewpoint.deleteTarget(node)) {
            wuwei.log.storeLog({ operation: 'erase' });
          }
          closeContextMenu();
          return;
        }
      }

      if (model && typeof model.erase === 'function') {
        wuwei.log.savePrevious();
        if (model.erase([node])) {
          wuwei.log.storeLog({ operation: 'erase' });
          draw.redraw();
        }
        closeContextMenu();
        return;
      }
    }
    else if ('addTimelineSegmentFromPlayer' === method) {
      node = resolveContextTargetRecord(state.hoveredNode);
      if (!node) { return; }

      var addSpec = wuwei.menu.timeline.getTimelineTargetSpec(node);
      var addGroup = addSpec && addSpec.group;

      if (!addGroup && isContextTimelineRepresentative([node])) {
        addGroup = node.groupRef && model.findGroupById ? model.findGroupById(node.groupRef) : null;
      }

      if (!addGroup) {
        closeContextMenu();
        return;
      }

      wuwei.edit.timeline.openAddSegmentFromPlayer(addGroup);

      closeContextMenu();
      return;
    }
    else if ('editTimelineSegmentProps' === method) {
      node = resolveContextTargetRecord(state.hoveredNode);
      if (!node) { return; }

      var segSpec = wuwei.menu.timeline.getTimelineTargetSpec(node);
      if (!segSpec || !segSpec.point) {
        closeContextMenu();
        return;
      }

      wuwei.edit.timeline.openSegmentProperties(segSpec.point);

      closeContextMenu();
      return;
    }
    else if ('editTimelineSegmentFromPlayer' === method) {
      node = resolveContextTargetRecord(state.hoveredNode);
      if (!node) { return; }

      var playSpec = wuwei.menu.timeline.getTimelineTargetSpec(node);
      if (!playSpec || !playSpec.point ||
        playSpec.point.axisRole === 'start' ||
        playSpec.point.axisRole === 'end') {
        closeContextMenu();
        return;
      }

      wuwei.edit.timeline.openSegmentFromPlayer(playSpec.point);

      closeContextMenu();
      return;
    }
    else if ('deleteTimelineSegment' === method) {
      node = resolveContextTargetRecord(state.hoveredNode);
      if (!node) { return; }

      var delSpec = wuwei.menu.timeline.getTimelineTargetSpec(node);
      if (!delSpec || !delSpec.point ||
        delSpec.point.axisRole === 'start' ||
        delSpec.point.axisRole === 'end') {
        closeContextMenu();
        return;
      }

      if (!window.confirm(nls.translate('Delete this timeline segment?'))) {
        closeContextMenu();
        return;
      }

      wuwei.log.savePrevious();

      if (wuwei.menu.timeline.deleteTimePoint(delSpec.point)) {
        wuwei.log.storeLog({ operation: 'edit' });
      }

      closeContextMenu();
      return;
    }
    else if ('adminInfo' === method) {
      node = resolveContextTargetRecord(state.hoveredNode) ||
        state.hoveredNode ||
        (common && common.current && common.current.page) ||
        null;
      if (wuwei.info && typeof wuwei.info.openAdmin === 'function') {
        wuwei.info.openAdmin(node, {
          contextTarget: state.hoveredNode || null
        });
      }
      else if (wuwei.info && wuwei.info.admin && typeof wuwei.info.admin.open === 'function') {
        wuwei.info.admin.open(node, {
          contextTarget: state.hoveredNode || null
        });
      }
      else if (window.console && console.warn) {
        console.warn('Admin info pane is not loaded. Check index.html includes app2/info/admin/info.admin.js and info.admin.markup.js.');
      }
      closeContextMenu();
      return;
    }
    else if ('info' === method) {
      node = resolveContextTargetRecord(state.hoveredNode);
      if (!node || !node.id) { return; }
      if (wuwei.viewpoint &&
        typeof wuwei.viewpoint.isViewpointPageNode === 'function' &&
        wuwei.viewpoint.isViewpointPageNode(node)) {
        wuwei.menu.viewpoint.openContentTargetInInfo(node);
        closeContextMenu();
        return;
      }
      wuwei.info.open(node);
      closeContextMenu();
      return;
    }
    else if ('infoTimelineTarget' === method) {
      node = resolveContextTargetRecord(state.hoveredNode);
      if (!node || !node.id) { return; }
      var timelineSpecForInfo = wuwei.menu.timeline.getTimelineTargetSpec(node);
      var timelineInfoTarget = timelineSpecForInfo
        ? (timelineSpecForInfo.point || timelineSpecForInfo.group || node)
        : null;
      if (timelineInfoTarget) {

        wuwei.info.timeline.open(timelineInfoTarget);

        closeContextMenu();
        return;
      }
    }
    else if ('infoViewpointTarget' === method) {
      node = resolveContextTargetRecord(state.hoveredNode);
      if (!node || !node.id) { return; }

      var viewpointSpecForInfo = wuwei.viewpoint && typeof wuwei.viewpoint.getContentTargetSpec === 'function'
        ? wuwei.viewpoint.getContentTargetSpec(node)
        : null;
      if (viewpointSpecForInfo) {
        if (viewpointSpecForInfo.point &&
          wuwei.menu && wuwei.menu.viewpoint &&
          typeof wuwei.menu.viewpoint.openContentTargetInInfo === 'function') {
          wuwei.menu.viewpoint.openContentTargetInInfo(viewpointSpecForInfo.point);
        }
        else if (viewpointSpecForInfo.group &&
          wuwei.info && wuwei.info.viewpoint && typeof wuwei.info.viewpoint.openAxis === 'function') {
          wuwei.info.viewpoint.openAxis(viewpointSpecForInfo.group);
        }
        closeContextMenu();
        return;
      }
    }
    else if ('openPlayer' === method) {
      node = resolveContextTargetRecord(state.hoveredNode);
      if (!node || !node.id) { return; }

      function openPlayerError(message) {
        if (wuwei.menu && wuwei.menu.snackbar && typeof wuwei.menu.snackbar.open === 'function') {
          wuwei.menu.snackbar.open({
            type: 'error',
            message: message || 'Video player is not available.'
          });
        }
        else {
          window.alert(message || 'Video player is not available.');
        }
      }

      var timelineSpec = wuwei.menu.timeline.getTimelineTargetSpec(node);
      var opened = false;

      try {
        if (timelineSpec) {
          opened = openTimelineSpec(timelineSpec);
          if (!opened) {
            openPlayerError('Video player could not be opened.');
          }
          closeContextMenu();
          return;
        }

        if (window.wuwei && wuwei.menu && wuwei.menu.video && typeof wuwei.menu.video.open === 'function') {
          opened = wuwei.menu.video.open(node, {});
          if (opened === false) {
            openPlayerError('Video player could not be opened.');
          }
          closeContextMenu();
          return;
        }

        if (window.wuwei && wuwei.info && wuwei.info.video && typeof wuwei.info.video.openModal === 'function') {
          opened = wuwei.info.video.openModal(node, {});
          if (opened === false) {
            openPlayerError('Video player could not be opened.');
          }
          closeContextMenu();
          return;
        }
      }
      catch (e) {
        console.error(e);
        openPlayerError(e && e.message ? e.message : 'Video player could not be opened.');
        closeContextMenu();
        return;
      }

      openPlayerError('Video player is not available.');
      closeContextMenu();
      return;
    }
    else if ('openWindow' === method) {
      node = resolveContextTargetRecord(state.hoveredNode);
      if (!node || !node.id) { return; }

      var viewpointSpecForWindow = wuwei.viewpoint.getContentTargetSpec(node);
      if (viewpointSpecForWindow && viewpointSpecForWindow.group && wuwei.viewpoint) {
        var viewpointWindowTarget = viewpointSpecForWindow.point || node;
        var viewpointWindowUrl = wuwei.menu.viewpoint.getContentTargetOpenUrl(viewpointWindowTarget);
        if (viewpointWindowUrl) {
          wuwei.info.openWindow(viewpointWindowUrl, null, 'width=900,height=680,noopener,resizable=yes,scrollbars=yes');
        }
        closeContextMenu();
        return;
      }

      var timelineSpecForWindow = wuwei.menu.timeline.getTimelineTargetSpec(node);
      if (timelineSpecForWindow) {
        openTimelineSpecInNewWindow(timelineSpecForWindow);
        closeContextMenu();
        return;
      }

      const openUrl = getOpenUrl(node);
      if (!openUrl) {
        closeContextMenu();
        return;
      }

      wuwei.info.openWindow(openUrl);
      closeContextMenu();
      return;
    }
    else if ('closeWindow' === method) {
      wuwei.info.closeWindow();
      return;
    }
    else if ('openNewTab' === method) {
      node = resolveContextTargetRecord(state.hoveredNode);
      if (!node || !node.id) { return; }

      var viewpointSpecForTab = wuwei.viewpoint.getContentTargetSpec(node);
      if (viewpointSpecForTab && viewpointSpecForTab.group && wuwei.viewpoint) {
        var viewpointTabTarget = viewpointSpecForTab.point || node;
        var viewpointTabUrl = wuwei.menu.viewpoint.getContentTargetOpenUrl(viewpointTabTarget);
        if (viewpointTabUrl) {
          wuwei.info.openNewTab(viewpointTabUrl);
        }
        closeContextMenu();
        return;
      }

      var timelineSpecForTab = wuwei.menu.timeline.getTimelineTargetSpec(node);
      if (timelineSpecForTab) {
        openTimelineSpecInNewTab(timelineSpecForTab);
        closeContextMenu();
        return;
      }

      const openUrl = getOpenUrl(node);
      if (!openUrl) {
        closeContextMenu();
        return;
      }

      wuwei.info.openNewTab(openUrl);
      closeContextMenu();
      return;
    }
    else if ('download' === method) {
      node = resolveContextTargetRecord(state.hoveredNode);
      if (!node || !node.id) { return; }

      const href = getDownloadUrl(node);
      if (!href) {
        closeContextMenu();
        return;
      }

      const a = document.createElement('a');
      a.href = href;
      a.rel = 'noopener';
      a.setAttribute('download', getDownloadFilename(node, href));
      document.body.appendChild(a);
      a.click();
      a.remove();

      closeContextMenu();
      return;
    }
    else if ('horizontal' === method) {
      node = resolveContextTargetRecord(state.hoveredNode);
      if (!node) { return; }

      var viewpointHorizontalSpec = wuwei.viewpoint.getContentTargetSpec(node);
      if (viewpointHorizontalSpec && viewpointHorizontalSpec.group && wuwei.viewpoint &&
        typeof wuwei.viewpoint.updateAxisGroup === 'function') {
        wuwei.viewpoint.updateAxisGroup(viewpointHorizontalSpec.group, {
          orientation: 'horizontal'
        });
        closeContextMenu();
        return;
      }

      var horizontalSpec = wuwei.menu.timeline.getTimelineTargetSpec(node);
      if (horizontalSpec && horizontalSpec.group) {
        wuwei.timeline.updateAxisGroup(horizontalSpec.group, {
          orientation: 'horizontal'
        });
        closeContextMenu();
        return;
      }
    }
    else if ('vertical' === method) {
      node = resolveContextTargetRecord(state.hoveredNode);
      if (!node) { return; }

      var viewpointVerticalSpec = wuwei.viewpoint.getContentTargetSpec(node);
      if (viewpointVerticalSpec && viewpointVerticalSpec.group && wuwei.viewpoint &&
        typeof wuwei.viewpoint.updateAxisGroup === 'function') {
        wuwei.viewpoint.updateAxisGroup(viewpointVerticalSpec.group, {
          orientation: 'vertical'
        });
        closeContextMenu();
        return;
      }

      var verticalSpec = wuwei.menu.timeline.getTimelineTargetSpec(node);
      if (verticalSpec && verticalSpec.group) {
        wuwei.timeline.updateAxisGroup(verticalSpec.group, {
          orientation: 'vertical'
        });
        closeContextMenu();
        return;
      }
    }
    else if (['alignTop', 'alignHorizontal', 'alignBottom', 'alignLeft', 'alignVertical',
      'alignRight', 'horizontalEqual', 'verticalEqual', 'horizontalGapEqual', 'verticalGapEqual', 'clipboard', 'paste',
      'defineSimpleGroup', 'defineHorizontalGroup', 'defineVerticalGroup', 'ungroup',
      'deleteSelectedGroups'].includes(method) ||
      (state.Selecting && ('copy' === method || 'edit' === method))) {
      log.recordCurrent();
      let count, xMin, xMax, xSum, yMin, yMax, ySum,
        LeftNode, RightNode, TopNode, BottomNode,
        halfW, halfH;
      // set allNodes
      if ('clipboard' === method) {
        d3.selectAll('g.node.selected').each(function (d) {
          allNodes.push(d);
        });
      }
      else if ('paste' === method) {
        allNodes = state.copyingNodes;
      }
      else {
        allNodes = [];
        count = 0;
        xMin = Number.MAX_VALUE;
        xMax = Number.MIN_VALUE;
        xSum = 0;
        yMin = Number.MAX_VALUE;
        yMax = Number.MIN_VALUE;
        ySum = 0;
        d3.selectAll('g.node.selected')
          .each(function (d) {
            halfW = operationHalfWidth(d);
            halfH = operationHalfHeight(d);
            if (!d || !Number.isFinite(Number(d.x)) || !Number.isFinite(Number(d.y)) ||
              !Number.isFinite(Number(halfW)) || !Number.isFinite(Number(halfH))) {
              return;
            }
            allNodes.push(d);
            count++;
            if (d.x - halfW < xMin) { xMin = d.x - halfW; LeftNode = d; }
            if (d.x + halfW > xMax) { xMax = d.x + halfW; RightNode = d; }
            if (d.y - halfH < yMin) { yMin = d.y - halfH; TopNode = d; }
            if (d.y + halfH > yMax) { yMax = d.y + halfH; BottomNode = d; }
            xSum += d.x;
            ySum += d.y;
          });
        if (!allNodes.length) {
          allNodes = getScreenSelectedNodes([]);
          allNodes.forEach(function (d) {
            halfW = operationHalfWidth(d);
            halfH = operationHalfHeight(d);
            if (!d || !Number.isFinite(Number(d.x)) || !Number.isFinite(Number(d.y)) ||
              !Number.isFinite(Number(halfW)) || !Number.isFinite(Number(halfH))) {
              return;
            }
            count++;
            if (d.x - halfW < xMin) { xMin = d.x - halfW; LeftNode = d; }
            if (d.x + halfW > xMax) { xMax = d.x + halfW; RightNode = d; }
            if (d.y - halfH < yMin) { yMin = d.y - halfH; TopNode = d; }
            if (d.y + halfH > yMax) { yMax = d.y + halfH; BottomNode = d; }
            xSum += d.x;
            ySum += d.y;
          });
        }
        state.lastFlockSelectionCount = allNodes.length;
      }
      var operationTargets = null;
      var operationMetrics = null;
      var isGroupPositionOperation = ['alignTop', 'alignHorizontal', 'alignBottom', 'alignLeft',
        'alignVertical', 'alignRight', 'horizontalEqual', 'verticalEqual',
        'horizontalGapEqual', 'verticalGapEqual'].includes(method);

      if (isGroupPositionOperation) {
        var alignmentSelection = collectAlignmentSelection();
        var uncoveredGroupedNodes;
        if (alignmentSelection.groupIds.length === 1 &&
          alignmentSelection.groupedNodes.length === 0 &&
          alignmentSelection.ungroupedNodes.length === 0 &&
          model && typeof model.distributeTopicGroupMembers === 'function') {
          var selectedAxisGroup = model.findGroupById(alignmentSelection.groupIds[0]);
          var canDistributeAxisGroup =
            (selectedAxisGroup && selectedAxisGroup.type === 'horizontal' && 'horizontalEqual' === method) ||
            (selectedAxisGroup && selectedAxisGroup.type === 'vertical' && 'verticalEqual' === method);
          if (canDistributeAxisGroup && model.distributeTopicGroupMembers(selectedAxisGroup)) {
            state.lastFlockOperation = {
              method: method,
              selectedNodeIds: Array.isArray(state.selectedNodeIds) ? state.selectedNodeIds.slice() : [],
              selectedGroupIds: Array.isArray(state.selectedGroupIds) ? state.selectedGroupIds.slice() : [],
              targetCount: (model.findGroupNodes ? model.findGroupNodes(selectedAxisGroup.id) : []).length
            };
            log.storeLog({ operation: method });
            state.hoveredNode = undefined;
            draw.redraw();
            closeContextMenu();
            updateUndoRedoButton();
            updateClipboardMenu(method);
            return;
          }
        }
        operationTargets = buildGroupOperationTargets(alignmentSelection.ungroupedNodes);
        uncoveredGroupedNodes = getUncoveredGroupedNodes(alignmentSelection.groupedNodes, alignmentSelection.groupIds);
        if (uncoveredGroupedNodes.length > 0 || operationTargets.length < 2) {
          state.lastFlockOperation = {
            method: method,
            selectedNodeIds: Array.isArray(state.selectedNodeIds) ? state.selectedNodeIds.slice() : [],
            selectedGroupIds: Array.isArray(state.selectedGroupIds) ? state.selectedGroupIds.slice() : [],
            targetCount: 0,
            error: 'alignment-requires-targets'
          };
          notifyFlockError('Alignment commands require two or more nodes or groups.');
          return;
        }
        allNodes = alignmentSelection.ungroupedNodes;
        operationMetrics = getOperationTargetMetrics(operationTargets);
        if (!operationMetrics || operationMetrics.count < 1) {
          state.lastFlockOperation = {
            method: method,
            selectedNodeIds: Array.isArray(state.selectedNodeIds) ? state.selectedNodeIds.slice() : [],
            selectedGroupIds: Array.isArray(state.selectedGroupIds) ? state.selectedGroupIds.slice() : [],
            targetCount: 0
          };
          return;
        }
        state.lastFlockOperation = {
          method: method,
          selectedNodeIds: Array.isArray(state.selectedNodeIds) ? state.selectedNodeIds.slice() : [],
          selectedGroupIds: Array.isArray(state.selectedGroupIds) ? state.selectedGroupIds.slice() : [],
          targetCount: operationMetrics.count
        };
        count = operationMetrics.count;
        xMin = operationMetrics.xMin;
        xMax = operationMetrics.xMax;
        yMin = operationMetrics.yMin;
        yMax = operationMetrics.yMax;
        xSum = operationMetrics.xSum;
        ySum = operationMetrics.ySum;
        LeftNode = operationMetrics.leftTarget;
        RightNode = operationMetrics.rightTarget;
        TopNode = operationMetrics.topTarget;
        BottomNode = operationMetrics.bottomTarget;
      }

      let logData;
      if (['defineSimpleGroup', 'defineHorizontalGroup', 'defineVerticalGroup'].includes(method)) {
        if ('defineSimpleGroup' === method) {
          definePersistentGroup('simpleGroup', allNodes);
        }
        else if ('defineHorizontalGroup' === method) {
          definePersistentGroup('topicGroupHorizontal', allNodes);
        }
        else if ('defineVerticalGroup' === method) {
          definePersistentGroup('topicGroupVertical', allNodes);
        }
        logData = { command: method, param: { node: allNodes } };
      }
      else if ('ungroup' === method) {
        var page = getCurrentPage();
        var selectedIds = allNodes.map(function (n) { return n.id; });
        var selectedGroupIds = Array.isArray(state.selectedGroupIds) ? state.selectedGroupIds.slice() : [];
        if (page && Array.isArray(page.groups)) {
          if (selectedGroupIds.length > 0) {
            page.groups = page.groups.filter(function (g) {
              return selectedGroupIds.indexOf(g.id) < 0;
            });
          }
          if (selectedIds.length > 0 && page.groups.length > 0) {
            page.groups.forEach(function (g) {
              var groupMembers;
              if (!g || selectedGroupIds.indexOf(g.id) >= 0) {
                return;
              }
              groupMembers = model.getGroupMembers ? model.getGroupMembers(g) : (g.members || []);
              g.members = groupMembers.filter(function (member) {
                var nodeId = member && member.nodeId;
                return nodeId && selectedIds.indexOf(nodeId) < 0;
              });
            });
          }
          if (model && typeof model.pruneGroups === 'function') {
            model.pruneGroups();
          }
        }
        model.setGraphFromCurrentPage();
        clearSelectionState();
        closeContextMenu();
        draw.redraw();
        logData = { command: method, param: { node: allNodes } };
      }
      else if ('deleteSelectedGroups' === method) {
        if (deleteSelectedGroups()) {
          logData = { command: method, param: { group: (state.deletedGroupIds || []) } };
        }
      }
      else if (['clipboard', 'copy', 'paste', 'clone'].includes(method)) {
        logData = model[method](allNodes);
      }
      else {
        if ('alignTop' === method) {
          operationTargets.forEach(function (target) {
            moveOperationTargetCenter(target, target.bounds.cx, yMin + target.bounds.height / 2);
          });
        }
        else if ('alignHorizontal' === method) {
          var midY = ySum / count;
          operationTargets.forEach(function (target) {
            moveOperationTargetCenter(target, target.bounds.cx, midY);
          });
        }
        else if ('alignBottom' === method) {
          operationTargets.forEach(function (target) {
            moveOperationTargetCenter(target, target.bounds.cx, yMax - target.bounds.height / 2);
          });
        }
        else if ('alignLeft' === method) {
          operationTargets.forEach(function (target) {
            moveOperationTargetCenter(target, xMin + target.bounds.width / 2, target.bounds.cy);
          });
        }
        else if ('alignVertical' === method) {
          var centerX = xSum / count;
          operationTargets.forEach(function (target) {
            moveOperationTargetCenter(target, centerX, target.bounds.cy);
          });
        }
        else if ('alignRight' === method) {
          operationTargets.forEach(function (target) {
            moveOperationTargetCenter(target, xMax - target.bounds.width / 2, target.bounds.cy);
          });
        }
        else if ('horizontalEqual' === method) {
          if (count > 1) {
            let diff = (RightNode.bounds.cx - LeftNode.bounds.cx) / (count - 1);
            operationTargets = operationTargets.sort(function (a, b) {
              return a.bounds.cx - b.bounds.cx;
            });
            for (let i = 1; i < operationTargets.length - 1; i++) {
              moveOperationTargetCenter(operationTargets[i], LeftNode.bounds.cx + diff * i, operationTargets[i].bounds.cy);
            }
          }
        }
        else if ('horizontalGapEqual' === method) {
          distributeHorizontalGaps(operationTargets);
        }
        else if ('verticalEqual' === method) {
          if (count > 1) {
            let diff = (BottomNode.bounds.cy - TopNode.bounds.cy) / (count - 1);
            operationTargets = operationTargets.sort(function (a, b) {
              return a.bounds.cy - b.bounds.cy;
            });
            for (let i = 1; i < operationTargets.length - 1; i++) {
              moveOperationTargetCenter(operationTargets[i], operationTargets[i].bounds.cx, TopNode.bounds.cy + diff * i);
            }
          }
        }
        else if ('verticalGapEqual' === method) {
          distributeVerticalGaps(operationTargets);
        }
        // logData = { command: method, param: { node: allNodes } };
      }
      log.storeLog({ operation: method });

      state.hoveredNode = undefined;
      draw.redraw();

      if (['defineSimpleGroup', 'defineHorizontalGroup', 'defineVerticalGroup', 'ungroup'].includes(method)) {
        closeContextMenu();
        updateUndoRedoButton();
        updateClipboardMenu(method);
        allNodes = [];
        return;
      }
      // selected circle
      if (['copy', 'paste', 'clone'].includes(method)) {
        for (var i = 0; i < logData.param.node.length; i++) {
          var node = logData.param.node[i];
          d3.select('g.node#' + node.id)
            .classed('selected', true)
            .append('circle')
            .attr('class', 'selected')
            .attr('cx', 0)
            .attr('cy', 0)
            .attr('r', 32)
            .attr('fill', 'none')
            .attr('stroke', common.Color.outerSelected)
            .attr('stroke-width', 2)
            .datum(node);
        }
      }
      else {
        for (var i = 0; i < allNodes.length; i++) {
          var node = allNodes[i];
          d3.select('g.node#' + node.id)
            .classed('selected', true)
            .append('circle')
            .attr('class', 'selected')
            .attr('cx', 0)
            .attr('cy', 0)
            .attr('r', 32)
            .attr('fill', 'none')
            .attr('stroke', common.Color.outerSelected)
            .attr('stroke-width', 2)
            .datum(node);
        }
      }
      closeContextMenu();
      updateUndoRedoButton();
      updateClipboardMenu(method);
      allNodes = [];
      return;
    }

    if (note && typeof note[method] === 'function') {
      if ('namePage' === method) {
        note.namePage();
      }
      else if ('copyPage' === method) {
        note.copyPage();
        updateResetview('reset');
        draw.redraw();
        if (note && typeof note.updatePageThumbnail === 'function') {
          note.updatePageThumbnail();
        }
        refreshPagenation();
      }
      else if ('newPage' === method) {
        note.newPage();
        updateResetview('reset');
        draw.redraw();
        if (note && typeof note.updatePageThumbnail === 'function') {
          note.updatePageThumbnail();
        }
        refreshPagenation();
      }
      else if ('listPage' === method) {
        closePageClicked();
        note.listPage();
        return;
      }

      // current = wuwei.common.current;
      var pageNameEl = document.getElementById('page_name');
      var page = current && current.page;
      if (pageNameEl && page) {
        pageNameEl.querySelector('.pp').textContent = page.pp || '';
        pageNameEl.querySelector('.name').textContent = page.name || '';
        pageNameEl.querySelector('.description').textContent = page.description || '';
      }
      return;
    }

    if (model && typeof model[method] === 'function') {
      node = resolveContextTargetRecord(state.hoveredNode);
      var operationTargets = [];

      if (node) {
        if (util.isLink(node)) {
          operationTargets = [node];
        }
        else if (util.isNode(node)) {
          operationTargets = [node];
        }
      }
      else if (method.indexOf('addSimple') < 0 &&
        method.indexOf('align') < 0 &&
        !['paste', 'clone'].includes(method)) {
        return;
      }

      var targets = operationTargets.length ? operationTargets : allNodes;

      Promise.resolve({ method: method, allNodes: targets })
        .then(function (param) {
          var
            method = param.method,
            allNodes = param.allNodes,
            logData;
          log.savePrevious();
          logData = model[method](allNodes);
          log.storeLog({ operation: method });
          return logData;
        })
        .then(function (logData) {
          var _nodes, _links;
          if ([
            'addContent', 'addTopic', 'addMemo', 'addTable',
            'clipboard', 'paste', 'clone', 'addLink', 'connect'
          ].includes(method)) {
            _nodes = logData && logData.param && logData.param.node;

            _links = logData && logData.param && logData.param.link;
            if (_links && _links[0]) {
              for (var _link of _links) {
                model.renderLink(_link);
              }
            }
          }

          draw.redraw();
          state.hoveredNode = undefined;
          closeContextMenu();
          updateUndoRedoButton();
          updateClipboardMenu(method);
        });
    }
    else {
      console.log('Model does not have method ' + method, 'warning');
    }
  };

  contextUpdatePosition = function (MENU, hoveredNode, event) {
    var menu = document.getElementById('context' + MENU);
    if (!menu) {
      return;
    }
    menu.style.backgroundColor = '#ffffff';
    menu.style.boxShadow = '4px 8px 8px #808080';
    var
      thisWidth = menu.offsetWidth,
      thisHeight = menu.offsetHeight,
      windowWidth = window.innerWidth,
      windowHeight = window.innerHeight,
      xMax = windowWidth - thisWidth - 4,
      yMax = windowHeight - thisHeight - 4;
    var
      x = event.clientX - thisWidth / 2,
      y = event.clientY - thisHeight / 2;
    if (x > xMax) {
      x = xMax;
    }
    if (y > yMax) {
      y = yMax;
    }
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.classList.remove('collapsed');
  };

  menuOpen = function (menu) {
    var
      pulldown = document.getElementsByClassName('pulldown'),
      display = menu.getAttribute('style').match(/display:\s[a-z]+;/g)[0].match(/[\w\.\-]+/g)[1],
      menuId = menu.getAttribute('id'),
      keepSelecting = ('flockMenu' === menuId || 'alignMenu' === menuId || 'timelineMenu' === menuId),
      i, len = pulldown.length;
    state.hoveredNode = null;

    draw.redraw();

    for (i = 0; i < len; i++) {
      pulldown[i].style.display = 'none';
    }
    document.getElementById('edit').style.display = 'none';
    document.getElementById('info').style.display = 'none';

    if ('none' === display) {
      menu.style.display = 'block';

      if (keepSelecting) {
        common.state.Selecting = true;
        document.getElementById('wuwei').classList.add('flock-operation');
        draw.renderSelectionMarks();
      }
      else {
        common.state.Selecting = false;
        document.getElementById('wuwei').classList.remove('flock-operation');
        document.getElementById('edit').style.display = 'none';
        document.getElementById('info').style.display = 'none';

        var selected_g = document.querySelectorAll('g.selected');
        len = selected_g.length;
        for (i = 0; i < len; i++) {
          selected_g[i].classList.remove('selected');
          var selected_circle = selected_g[i].querySelector('circle.selected');
          if (selected_circle) {
            selected_g[i].removeChild(selected_circle);
          }
        }
        state.selectedNodeIds = [];
        state.selectedGroupIds = [];
        state.selectedGroupMarks = {};
      }
    }
    else {
      menu.style.display = 'none';
      if ('flockMenu' === menuId) {
        closeFlockClicked();
      }
      else if ('alignMenu' === menuId) {
        closeAlignClicked();
      }
      else if ('timelineMenu' === menuId) {
        closeTimelineClicked();
      }
    }
  };


  /** main */
  mainClicked = function () {
    var
      headingMenu = document.querySelector('.heading-menu'),
      searchIcon = document.getElementById('searchIcon'),
      drawMode = document.getElementById('draw_mode'),
      miniature = document.getElementById('open_miniature'),
      controlToggle = document.getElementById('open_controls'),
      setting = document.getElementById('setting');
    // shareMode = document.getElementById('share_mode');
    if (headingMenu.classList.contains('active')) {
      headingMenu.classList.remove('active');
      searchIcon.classList.remove('active');
      drawMode.classList.remove('active');
      miniature.classList.remove('active');
      controlToggle.classList.remove('active');
      updateSettingIconForMode();
      updateUtilityIndicatorsVisibility();
      // shareMode.style.display = 'none';
      wuwei.home.toggleHome();
      // location.replace("https://www.sambuichi.jp/");
    }
    else {
      headingMenu.classList.add('active');
      searchIcon.classList.add('active');
      drawMode.classList.add('active');
      miniature.classList.add('active');
      controlToggle.classList.add('active');
      updateSettingIconForMode();
      updateUtilityIndicatorsVisibility();
      // shareMode.style.display = 'block';
    }
    return false;
  };


  /** note */
  noteClicked = function () {
    var menu = document.getElementById('noteMenu');
    updateNoteMenuVisibility(menu);
    menuOpen(menu);
    return false;
  };

  function updateNoteMenuVisibility(menu) {
    if (!menu) { return; }
    const saveEl = menu.querySelector('.operators .operator.Save');
    const downloadEl = menu.querySelector('.operators .operator.Download');
    const exportCanvasEl = menu.querySelector('.operators .operator.ExportCanvasImage');
    const publishEl = menu.querySelector('.operators .operator.Publish');
    const hasContent = currentPageHasContent();
    const canModifyContent = !(state.viewOnly || state.published || !hasContent);
    if (saveEl) {
      saveEl.style.display = canModifyContent ? '' : 'none';
    }
    if (downloadEl) {
      downloadEl.style.display = canModifyContent ? '' : 'none';
    }
    if (exportCanvasEl) {
      exportCanvasEl.style.display = hasContent ? '' : 'none';
    }
    if (publishEl) {
      publishEl.style.display = canModifyContent ? '' : 'none';
    }
  }

  function currentPageHasContent() {
    const page = (common.current && common.current.page) || {};
    const nodes = Array.isArray(page.nodes) ? page.nodes : (Array.isArray(graph.nodes) ? graph.nodes : []);
    const links = Array.isArray(page.links) ? page.links : (Array.isArray(graph.links) ? graph.links : []);
    const groups = Array.isArray(page.groups) ? page.groups : (Array.isArray(graph.groups) ? graph.groups : []);
    return nodes.filter(Boolean).length > 0 ||
      links.filter(Boolean).length > 0 ||
      groups.filter(Boolean).length > 0;
  }

  function notifyMenu(type, message) {
    if (wuwei.menu && wuwei.menu.snackbar && typeof wuwei.menu.snackbar.open === 'function') {
      wuwei.menu.snackbar.open({ type: type || 'info', message: message });
    }
  }

  function canvasImageBaseName() {
    var current = common.current || {};
    var noteId = String(current.note_id || 'note').replace(/[\\/:*?"<>|]+/g, '_');
    var page = current.page || {};
    var pageName = String(page.name || page.pp || 'page').replace(/[\\/:*?"<>|]+/g, '_');
    return 'wuwei-canvas-' + noteId + '-' + pageName;
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 0);
  }

  function normalizeClonedCanvasForExport(clone) {
    if (!clone || !clone.querySelectorAll) {
      return clone;
    }
    clone.removeAttribute('transform');
    Array.prototype.slice.call(clone.querySelectorAll(
      '#ContextMenu,#Editing,#Start,#Pointer,.group-selection-marks,circle.selected,.axis'
    )).forEach(function (el) {
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    });
    Array.prototype.slice.call(clone.querySelectorAll('[style]')).forEach(function (el) {
      var style = el.getAttribute('style') || '';
      if (/opacity\s*:\s*0(?:[;\s]|$)/i.test(style) ||
          /display\s*:\s*none(?:[;\s]|$)/i.test(style)) {
        if (el.parentNode) {
          el.parentNode.removeChild(el);
        }
      }
    });
    Array.prototype.slice.call(clone.querySelectorAll('[href],[xlink\\:href]')).forEach(function (el) {
      var href = el.getAttribute('href') || el.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || '';
      if (href && href.charAt(0) !== '#') {
        try {
          el.setAttribute('href', new URL(href, window.location.href).href);
        } catch (e) {
          // Keep the original reference if URL normalisation is not possible.
        }
      }
    });
    return clone;
  }

  function buildCanvasExportSvg() {
    var SVG_NS = 'http://www.w3.org/2000/svg';
    var sourceSvg = document.getElementById(state.svgId || 'draw');
    var sourceCanvas = document.getElementById(state.canvasId || 'canvas');
    var scratchSvg, scratchCanvas, bbox, padding, width, height, exportSvg, defsRoot;

    if (!sourceSvg || !sourceCanvas) {
      throw new Error('ERROR canvas is not available');
    }

    scratchSvg = document.createElementNS(SVG_NS, 'svg');
    scratchSvg.setAttribute('xmlns', SVG_NS);
    scratchSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    scratchSvg.setAttribute('style', 'position:absolute;left:-100000px;top:-100000px;width:1px;height:1px;overflow:hidden;');
    scratchCanvas = normalizeClonedCanvasForExport(sourceCanvas.cloneNode(true));
    scratchSvg.appendChild(scratchCanvas);
    document.body.appendChild(scratchSvg);
    try {
      bbox = scratchCanvas.getBBox();
    } finally {
      scratchSvg.remove();
    }

    if (!bbox || !isFinite(bbox.x) || !isFinite(bbox.y) ||
        !isFinite(bbox.width) || !isFinite(bbox.height) ||
        bbox.width <= 0 || bbox.height <= 0) {
      throw new Error('ERROR canvas has no drawable content');
    }

    padding = 24;
    width = Math.ceil(bbox.width + padding * 2);
    height = Math.ceil(bbox.height + padding * 2);
    exportSvg = document.createElementNS(SVG_NS, 'svg');
    exportSvg.setAttribute('xmlns', SVG_NS);
    exportSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    exportSvg.setAttribute('width', String(width));
    exportSvg.setAttribute('height', String(height));
    exportSvg.setAttribute('viewBox', [
      bbox.x - padding,
      bbox.y - padding,
      bbox.width + padding * 2,
      bbox.height + padding * 2
    ].join(' '));
    exportSvg.setAttribute('class', 'wuwei-canvas-export');

    Array.prototype.slice.call(sourceSvg.children || []).forEach(function (child) {
      if (child !== sourceCanvas && child.tagName && child.tagName.toLowerCase() !== 'g') {
        exportSvg.appendChild(child.cloneNode(true));
      }
    });
    defsRoot = sourceSvg.querySelector('defs,.symbols');
    if (defsRoot && defsRoot.parentNode === sourceCanvas) {
      exportSvg.insertBefore(defsRoot.cloneNode(true), exportSvg.firstChild || null);
    }
    exportSvg.appendChild(normalizeClonedCanvasForExport(sourceCanvas.cloneNode(true)));

    return {
      svg: exportSvg,
      width: width,
      height: height,
      filenameBase: canvasImageBaseName()
    };
  }

  function serializeSvg(svg) {
    var text = new XMLSerializer().serializeToString(svg);
    if (!/^<svg[^>]+xmlns=/.test(text)) {
      text = text.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    if (!/^<svg[^>]+xmlns:xlink=/.test(text)) {
      text = text.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
    }
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + text;
  }

  function exportSvgAsPng(exportData) {
    return new Promise(function (resolve, reject) {
      var svgText = serializeSvg(exportData.svg);
      var svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
      var url = URL.createObjectURL(svgBlob);
      var image = new Image();
      image.onload = function () {
        var canvas = document.createElement('canvas');
        var ctx;
        URL.revokeObjectURL(url);
        canvas.width = exportData.width;
        canvas.height = exportData.height;
        ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        try {
          ctx.drawImage(image, 0, 0);
          canvas.toBlob(function (blob) {
            if (!blob) {
              reject(new Error('ERROR failed to create PNG'));
              return;
            }
            resolve(blob);
          }, 'image/png');
        } catch (e) {
          reject(e);
        }
      };
      image.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('ERROR failed to render SVG as PNG'));
      };
      image.src = url;
    });
  }

  exportCanvasImage = function () {
    var exportData;
    try {
      exportData = buildCanvasExportSvg();
    } catch (e) {
      notifyMenu('error', e && e.message ? e.message : 'ERROR failed to export canvas image');
      return;
    }

    exportSvgAsPng(exportData).then(function (blob) {
      downloadBlob(blob, exportData.filenameBase + '.png');
      notifyMenu('success', 'Canvas image exported');
    }).catch(function (e) {
      var svgText = serializeSvg(exportData.svg);
      downloadBlob(new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }), exportData.filenameBase + '.svg');
      notifyMenu('warning', (e && e.message ? e.message : 'PNG export failed') + '. SVG exported instead.');
    });
  };

  function closeNoteMenu() {
    var menu = document.getElementById('noteMenu');
    menu.style.display = 'none';
  }

  closeNoteClicked = function () {
    closeNoteMenu();
  };

  function closeUserMenu() {
    var menu = document.getElementById('userMenu');
    if (menu) {
      menu.style.display = 'none';
    }
  }

  closeUserClicked = function () {
    closeUserMenu();
  };

  /** page */
  pageClicked = function () {
    var menu = document.getElementById('pageMenu');
    menuOpen(menu);
    return false;
  };

  closePageClicked = function () {
    var menu = document.getElementById('pageMenu');
    menu.style.display = 'none';
  };

  /** new */
  function refreshNewMenuClipboardState(menu) {
    var pasteEl;
    var cloneEl;
    if (!menu) {
      return;
    }
    pasteEl = menu.querySelector('.operators .operator.Paste');
    cloneEl = menu.querySelector('.operators .operator.Clone');
    if (pasteEl) {
      pasteEl.style.display = (
        (Array.isArray(state.copyingNodes) && state.copyingNodes.length > 0) ||
        (Array.isArray(state.copyingGroups) && state.copyingGroups.length > 0)
      ) ? 'block' : 'none';
    }
    if (cloneEl) {
      cloneEl.style.display = 'none';
    }
  }

  newClicked = function () {
    var menu = document.getElementById('newMenu');
    refreshNewMenuClipboardState(menu);
    menuOpen(menu);
    // // 2023-06-12
    // if (common.state.loggedIn) {
    //   operatorUpload.style.display = 'block';
    // }
    // else {
    //   operatorUpload.style.display = 'none';
    // }
    return false;
  };

  closeNewClicked = function () {
    var menu = document.getElementById('newMenu');
    menu.style.display = 'none';
  };

  onInputChange = function (event) {
    var files = event.target.files;
    this.uploadFile = files[0];
  };

  /** flock */
  flockClicked = function () {
    state.Selecting = true;
    const menu = document.getElementById('flockMenu');
    menuOpen(menu);
    // draw.disableZoom();
    return false;
  };

  closeFlockClicked = function () {
    state.Selecting = false;
    clearSelectionState();
    var menu = document.getElementById('flockMenu');
    menu.style.display = 'none';
    closeContextMenu();
    draw.redraw();
    return false;
  };

  alignClicked = function () {
    state.Selecting = true;
    const menu = document.getElementById('alignMenu');
    menuOpen(menu);
    return false;
  };

  closeAlignClicked = function () {
    state.Selecting = false;
    clearSelectionState();
    var menu = document.getElementById('alignMenu');
    menu.style.display = 'none';
    closeContextMenu();
    draw.redraw();
    return false;
  };

  /** filter */
  filterClicked = function () {
    wuwei.filter.open();
    return false;
  };

  closeFilterClicked = function () {
    var menu = document.getElementById('filterMenu');
    menu.style.display = 'none';
  };

  /** search */
  searchClicked = function () {
    wuwei.search.open();
    return false;
  };

  closeSearchClicked = function () {
    var menu = document.getElementById('searchMenu');
    menu.style.display = 'none';
  };

  /** share */
  /*
  shareClicked = function() {
    wuwei.menu.chat.open();
    return false;
  };

  closeShareClicked = function() {
    var menu = document.getElementById('share_mode');
    menu.style.display = 'none';
  };
*/
  /** controls */
  openControlsClicked = function (event) {
    event.stopPropagation();
    var
      menu = document.getElementById('open_controls'),
      elem = document.getElementById('controls');
    if (elem.classList.contains('hidden')) {
      // show
      menu.innerHTML = '<span>&#9660</span>';
      elem.classList.remove('hidden');
      /** 2023-06-03 */
      setTimeout(function () {
        elem.style.display = 'flex';
      }, 0);
      state.control_width = 12;
    }
    else {
      // hide
      menu.innerHTML = '<span>&#9650</span>';
      elem.classList.add('hidden');
      state.control_width = 0;
      /** 2023-06-03 */
      setTimeout(function () {
        elem.style.display = 'none';
      }, 2000);
    }
    document.getElementById('Pagination').style.left = state.control_width + 'rem';
    return false;
  };

  /** zoom in/out/reset */
  updateResetview = function (scale) {
    const resetIcon = document.querySelector('.resetview.icon');
    const scaleEl = document.querySelector('.resetview.scale');

    if (!scaleEl) {
      return;
    }

    scale = Number(scale);

    if (!Number.isFinite(scale)) {
      scale = 1;
    }

    if (Math.abs(scale - 1) > 0.01) {
      scaleEl.textContent = util.precisionRound(scale, 2);
    }
    else {
      scaleEl.textContent = '=';
    }

    scaleEl.style.display = 'block';

    if (resetIcon) {
      resetIcon.style.display = 'none';
    }
  };


  zoomInClicked = function () {
    const scale = util.zoomin();
    updateResetview(scale);
  };


  resetViewClicked = function () {
    const scale = util.resetview();
    updateResetview(scale);
  };


  zoomOutClicked = function () {
    const scale = util.zoomout();
    updateResetview(scale);
  };
  /*
    updateResetview = function (zoom) {
      const current = wuwei.common.current;
      const resetIcon = document.querySelector('.resetview.icon');
      const scaleEl = document.querySelector('.resetview.scale');
      const scale = util.getPageTransform(current && current.page).scale;
  
      if (!resetIcon || !scaleEl) {
        return;
      }
  
      if (scale < 0.99 || 1.01 < scale) {
        scaleEl.innerHTML = util.precisionRound(scale, 2);
        scaleEl.style.display = 'block';
        resetIcon.style.display = 'none';
      }
      else {
        scaleEl.innerHTML = '';
        scaleEl.style.display = 'none';
        resetIcon.style.display = 'block';
      }
    }
  
    zoomInClicked = function () {
      util.zoomin();
      updateResetview('zoomin');
    };
  
    resetViewClicked = function () {
      util.resetview();
      updateResetview('reset');
    };
  
    zoomOutClicked = function () {
      util.zoomout();
      updateResetview('zoomout');
    };
  */
  /** undo / redo */
  updateUndoRedoButton = function () {
    var
      pp = wuwei.common.current.page.pp,
      create, modify, remove, data, operation,
      // --- undo
      undo_div = document.getElementById('undo'),
      undo_p = document.getElementById('p_undo'),
      undoJSON = log.logTop('undo', pp),
      undoRecord,
      // --- redo
      redo_div = document.getElementById('redo'),
      redo_p = document.getElementById('p_redo'),
      redoJSON = log.logTop('redo', pp),
      redoRecord;
    try {
      undoRecord = JSON.parse(undoJSON);
    }
    catch (e) { console.log(e); return; }
    if (undoRecord) {
      undo_div.classList.add('active');
      operation = undoRecord.operation;
      operation = nls.translate(operation);
      undo_p.innerHTML = operation;
    }
    else {
      undo_div.classList.remove('active');
      undo_p.innerHTML = '';
    }
    // --- redo
    try {
      redoRecord = JSON.parse(redoJSON);
    }
    catch (e) { console.log(e); return; }
    if (redoRecord) {
      operation = redoRecord.operation;
      operation = nls.translate(operation);
      redo_div.classList.add('active');
      redo_p.innerHTML = operation;
    }
    else {
      redo_div.classList.remove('active');
      redo_p.innerHTML = '';
    }
  };

  undoClicked = function () {
    var
      pp = wuwei.common.current.page.pp,
      undo_div = document.getElementById('undo');
    if (!undo_div.classList.contains('active')) {
      return;
    }
    if (!log.logTop('undo', pp)) {
      undo_div.classList.remove('active');
      menu.snackbar.open({
        message: 'Empty undo log, buffer depth is ' + common.MAX_LOG,
        type: 'warning'
      });
      return;
    }

    log.undoState();
    draw.redraw();

    undo_div.classList.add('active');
    updateUndoRedoButton();
  };

  redoClicked = function () {
    var
      pp = wuwei.common.current.page.pp,
      redo_div = document.getElementById('redo');
    if (!redo_div.classList.contains('active')) {
      return;
    }
    if (!log.logTop('redo', pp)) {
      redo_div.classList.remove('active');
      menu.snackbar.open({
        message: 'Empty redo log, buffer depth is ' + common.MAX_LOG,
        type: 'warning'
      });
      return;
    }

    log.redoState();
    draw.redraw();

    redo_div.classList.add('active');
    updateUndoRedoButton();
  };

  /** miniature */
  openMiniatureClicked = function (event) {
    event.stopPropagation();
    var
      menu = document.getElementById('open_miniature'),
      elem = document.getElementById('miniature');
    if (elem.classList.contains('hidden')) {
      menu.innerHTML = '<span>&#9650</span>';
      elem.classList.remove('hidden');
      util.drawMiniature();
      util.setupMiniature();
    }
    else {
      menu.innerHTML = '<span>&#9660</span>';
      elem.classList.add('hidden');
    }
    return false;
  };

  /** user status */
  userStatusClicked = function (event) {
    event.stopPropagation();
    var userMenu = document.getElementById('userMenu');

    if (wuwei.menu.login && typeof wuwei.menu.login.refreshUserStatusMenu === 'function') {
      wuwei.menu.login.refreshUserStatusMenu();
    }

    if (userMenu) {
      menuOpen(userMenu);
    }
    else {
      wuwei.menu.login.open();
    }
    return false;
  };

  function getCurrentUserRoleForMenu() {
    var candidates = [
      wuwei && wuwei.common && wuwei.common.state && wuwei.common.state.currentUser
    ];

    var user;
    var i;
    var role;

    for (i = 0; i < candidates.length; i += 1) {
      user = candidates[i];
      if (user && typeof user === 'object') {
        role = user.role || user.userRole || user.user_role || '';
        if (role) {
          return String(role).trim().toLowerCase();
        }
      }
    }
    return '';
  }

  function isAdminUserForMenu() {
    return getCurrentUserRoleForMenu() === 'admin';
  }

  function safeOperationValidator(validator, allNodes, operation, context, profile) {
    if (typeof validator !== 'function') {
      return true;
    }

    try {
      /*
       * Validators should primarily depend on allNodes/context.  The operation
       * name is passed as an explicit argument only for rare operation-specific
       * checks.  Validators and context helper functions must never refer to an
       * undeclared outer variable named `operation`.
       */
      return !!validator(allNodes, operation, context, profile);
    }
    catch (e) {
      if (window.console && console.error) {
        console.error('WuWei menu validator failed:', {
          operation: operation,
          context: context || '',
          message: e && e.message,
          error: e
        });
      }
      return false;
    }
  }


  Operations = {
    // operations are defined as 'method', 'display name', 'optional rule', 'style', 'icon'
    //
    // Context menus are intentionally grouped by target role.  Generic node/link
    // menus no longer carry Timeline / Viewpoint / group-specific commands.
    // The actual visibility of each command is still decided by OperationsList
    // validators, but this first-level classification keeps unrelated commands
    // out of the wrong menu bucket.
    type: {
      'Node': [
        'bloom',
        'showGroup',
        'wilt',
        'root',
        'forward',
        'backward',
        'hide'
      ],

      'Link': [
        'hide'
      ],

      'EditNode': [
        'edit',
        'createTimelineAxis',
        'createViewpointAxis',
        'addContent',
        'addTopic',
        'addMemo',
        'clone',
        'clipboard',
        'paste',
        'erase'
      ],

      'EditLink': [
        'edit',
        'reverse',
        'normal',
        'horizontal',
        'vertical',
        'horizontal2',
        'vertical2',
        'erase'
      ],

      'EditGroup': [
        'edit',
        'addTimelineSegmentFromPlayer',
        'addViewpointEntry',
        'deleteViewpointTarget',
        'horizontal',
        'vertical',
        'clone',
        'clipboard',
        'paste',
        'deleteGroup',
        'erase'
      ],

      'EditGroupMember': [
        'edit',
        'createTimelineAxis',
        'createViewpointAxis',
        'deleteTimelineSegment',
        'copyViewpointTarget',
        'deleteViewpointTarget',
        'addContent',
        'addTopic',
        'addMemo',
        'clone',
        'clipboard',
        'paste',
        'erase'
      ],

      'EditGroupRepresentative': [
        'edit',
        'editGroup',
        'addTimelineSegmentFromPlayer',
        'addViewpointEntry',
        'addContent',
        'addTopic',
        'addMemo',
        'copyViewpointTarget',
        'distributeViewpointPageMarkers',
        'distributeTopicGroupMembers',
        'deleteViewpointTarget',
        'horizontal',
        'vertical',
        'clone',
        'clipboard',
        'paste',
        'deleteGroup',
        'erase'
      ],

      'InfoNode': [
        'adminInfo',
        'info',
        'download',
        'openNewTab',
        'openWindow',
        'openPlayer'
      ],

      'InfoLink': [
        'adminInfo',
        'info'
      ],

      'InfoGroup': [
        'adminInfo',
        'infoTimelineTarget',
        'infoViewpointTarget',
        'info'
      ],

      'InfoGroupMember': [
        'adminInfo',
        'infoTimelineTarget',
        'infoViewpointTarget',
        'info',
        'download',
        'openNewTab',
        'openWindow',
        'openPlayer'
      ],

      'InfoGroupRepresentative': [
        'adminInfo',
        'infoViewpointTarget',
        'infoTimelineTarget',
        'openNewTab',
        'openWindow',
        'openPlayer'
      ]
    },

    isSupported: function (operation, nodes, context) {
      var operations, profile, i;
      if (util.isEmpty(nodes)) { return false; }

      for (i = 0; i < nodes.length; i += 1) {
        if (util.isEmpty(nodes[i])) {
          continue;
        }

        profile = resolveMenuContext([nodes[i]], context);
        if (!isOperationAllowedByOwnership(operation, profile, context)) {
          return false;
        }

        operations = this.type[profile.menuType];
        if (util.isEmpty(operations) || !util.contains(operations, operation)) {
          return false;
        }
      }
      return true;
    },

    getSupported: function (allNodes, context) {
      var
        self = this,
        supportedOperations = [],
        profile = resolveMenuContext(allNodes, context),
        operations = self.type[profile.menuType],
        i, len, operation, operationDef, operationList, validator;

      if (util.isEmpty(operations)) {
        return supportedOperations;
      }

      len = operations.length;
      for (i = 0; i < len; i++) {
        operation = operations[i];
        operationDef = OperationsList[operation];
        if (operationDef) {
          operationList = [];
          operationList[0] = operation;
          operationList[1] = operationDef[0];
          operationList[2] = operationDef[1];
          operationList[3] = operationDef[2] || null;
          operationList[4] = operationDef[3] || null;
          if (self.isSupported(operation, allNodes, context)) {
            validator = operationList[2];
            if (safeOperationValidator(validator, allNodes, operation, context, profile)) {
              supportedOperations.push(operationList);
            }
          }
        }
      }
      return supportedOperations;
    }
  };

  /**
   * Operations
   * key, label, isSupportedFunc(), style('danger' or null), icon
   */
  function resolveContextTargetRecord(target) {
    if (!target) {
      return null;
    }

    if (target.id) {
      if (util.isLink(target)) {
        return model.findLinkById(target.id);
      }
      else if (util.isNode(target)) {
        return model.findNodeById(target.id) || target;
      }
    }

    return target;
  }

  function getContextTarget(allNodes) {
    /*
     * Some old code accidentally called context helpers as
     * helper(operation, allNodes).  Context helpers must ignore operation and
     * use the array argument only.
     */
    if (!Array.isArray(allNodes) && Array.isArray(arguments[1])) {
      allNodes = arguments[1];
    }
    if (!Array.isArray(allNodes) || allNodes.length === 0) {
      return null;
    }
    return resolveContextTargetRecord(allNodes[0] || null);
  }

  function getContextTimelineSpec(allNodes) {
    var target;

    if (!Array.isArray(allNodes) && Array.isArray(arguments[1])) {
      allNodes = arguments[1];
    }

    target = getContextTarget(allNodes);
    if (util.isEmpty(target) ||
      !wuwei.menu ||
      !wuwei.menu.timeline ||
      typeof wuwei.menu.timeline.getTimelineTargetSpec !== 'function') {
      return null;
    }

    return wuwei.menu.timeline.getTimelineTargetSpec(target);
  }

  function getContextViewpointSpec(allNodes) {
    var target = getContextTarget(allNodes);
    if (util.isEmpty(target)) {
      return null;
    }

    return wuwei.viewpoint.getContentTargetSpec(target);
  }

  function isRepresentativeTopic(node) {
    /*
     * This classification helper must depend only on the target node.
     * It is called while menu candidates are being built, before a concrete
     * operation is selected.  Therefore it must never refer to an outer
     * variable named `operation`.
     */
    return !!(
      node &&
      node.groupRole === 'representative' &&
      node.groupRef
    );
  }

  function isContextGroup(allNodes) {
    var target = getContextTarget(allNodes);
    if (util.isEmpty(target)) {
      return false;
    }
    return !!('Group' === target.type && target.groupRef);
  }

  function isRepresentativeGroupEraseTarget(target) {
    return !!(
      target &&
      model.isRepresentativeTopic(target) &&
      target.groupRef
    );
  }

  function isGroupAxisOrOutlineEraseTarget(target) {
    if (!target || !target.groupRef) {
      return false;
    }

    if ('Group' === target.type) {
      return true;
    }

    return !!(
      util.isLink(target) &&
      (
        target.pseudo ||
        target.groupType === 'timelineAxis' ||
        target.groupType === 'viewpointAxis' ||
        target.groupType === 'horizontal' ||
        target.groupType === 'vertical' ||
        target.linkType === 'timeline-axis' ||
        target.linkType === 'viewpoint-axis'
      )
    );
  }

  function isWholeGroupEraseTarget(target) {
    return !!(
      isRepresentativeGroupEraseTarget(target) ||
      isGroupAxisOrOutlineEraseTarget(target)
    );
  }

  function deleteGroupTarget(target) {
    if (!target || !isWholeGroupEraseTarget(target)) {
      return false;
    }

    wuwei.log.savePrevious();
    if (model.eraseGroup(target)) {
      clearSelectionState();
      wuwei.log.storeLog({ operation: 'erase' });
      draw.redraw();
      return true;
    }
    return false;
  }

  function deleteSelectedGroups() {
    var page = getCurrentPage();
    var selectedGroupIds = getEffectiveSelectedGroupIds(page);
    var deletedIds = [];

    if (!selectedGroupIds.length) {
      state.deletedGroupIds = [];
      return false;
    }

    wuwei.log.savePrevious();
    selectedGroupIds.forEach(function (groupId) {
      var group = model.findGroupById ? model.findGroupById(groupId) : null;
      if (group && model.eraseGroup(group)) {
        deletedIds.push({ id: groupId, type: 'Group' });
      }
    });

    state.deletedGroupIds = deletedIds;
    if (!deletedIds.length) {
      return false;
    }

    clearSelectionState();
    closeContextMenu();
    draw.redraw();
    return true;
  }

  function isContextLink(allNodes) {
    var target = getContextTarget(allNodes);
    return !!(target && util.isLink(target));
  }

  function isContextNode(allNodes) {
    var target = getContextTarget(allNodes);
    return !!(target && util.isNode(target));
  }

  function isContextRegularContent(allNodes) {
    var target = getContextTarget(allNodes);
    return !!(
      target &&
      target.type === 'Content' &&
      !getContextTimelineSpec(allNodes) &&
      !getContextViewpointSpec(allNodes)
    );
  }

  function isContextDocumentLikeContent(allNodes) {
    var target = getContextTarget(allNodes);
    var resource;
    var href;

    if (!target || target.type !== 'Content' || getContextTimelineSpec(allNodes) ||
      isPlayableVideoNode(target)) {
      return false;
    }

    resource = getNodeResource(target);
    href = getTextOriginalHref(target, resource) ||
      getOfficeOriginalHref(target, resource) ||
      getDownloadUrl(target) ||
      (resource && ((resource.original && resource.original.url) || resource.uri || resource.canonicalUri)) ||
      '';

    return !!(
      isPdfDocumentReference(resource, href) ||
      isOfficeDocumentReference(resource, href) ||
      isHtmlDocumentReference(resource, href) ||
      isTextDocumentReference(resource, href)
    );
  }

  function isContextContentWithOpenUrl(allNodes) {
    var target = getContextTarget(allNodes);

    if (!target || target.type !== 'Content') {
      return false;
    }
    try {
      return !!getOpenUrl(target);
    }
    catch (e) {
      return false;
    }
  }

  function isContextOpenableTarget(allNodes) {
    return (
      isContextDocumentLikeContent(allNodes) ||
      isContextContentWithOpenUrl(allNodes) ||
      isContextTimelinePlayable(allNodes) ||
      isContextViewpointPage(allNodes) ||
      isContextViewpointRepresentative(allNodes)
    );
  }

  function isContextTimelineAxis(allNodes) {
    var spec = getContextTimelineSpec(allNodes);
    return !!(spec && isTimelineAxisSpec(spec));
  }

  function isContextTimelineSegment(allNodes) {
    var spec = getContextTimelineSpec(allNodes);
    return !!(spec && isTimelineSegmentSpec(spec));
  }

  function isContextTimelineMidSegment(allNodes) {
    var spec = getContextTimelineSpec(allNodes);
    return !!(spec && isTimelineMidSegmentSpec(spec));
  }

  function hasAttachedTimelineGroup(target) {
    return !!(
      target &&
      wuwei.timeline.hasAttachedTimelineGroup(target)
    );
  }

  function hasAttachedViewpointGroup(target) {
    return !!(
      target &&
      wuwei.viewpoint.hasAttachedViewpointGroup(target)
    );
  }

  function isContextVideoContent(allNodes) {
    var target = getContextTarget(allNodes);
    return !!(
      target &&
      target.type === 'Content' &&
      isPlayableVideoNode(target) &&
      !getContextTimelineSpec(allNodes)
    );
  }

  function isContextTimelineCreatableContent(allNodes) {
    return isContextVideoContent(allNodes);
  }

  function isContextTimelinePlayable(allNodes) {
    return !!getContextTimelineSpec(allNodes);
  }

  function isContextViewpointPage(allNodes) {
    var spec = getContextViewpointSpec(allNodes);
    return !!(spec && spec.point);
  }

  function isContextViewpointRepresentative(allNodes) {
    var target = getContextTarget(allNodes);
    return !!(
      target &&
      wuwei.viewpoint.isViewpointRepresentativeNode(target)
    );
  }

  function isContextTimelineRepresentative(allNodes) {
    var target = getContextTarget(allNodes);
    var group = null;

    if (!target || !isRepresentativeTopic(target)) {
      return false;
    }

    group = target.groupRef && model.findGroupById ? model.findGroupById(target.groupRef) : null;
    return !!(group && group.type === 'timeline');
  }

  function isContextViewpointAxis(allNodes) {
    var spec = getContextViewpointSpec(allNodes);
    return !!(spec && spec.group && !spec.point);
  }

  function isContextViewpointTarget(allNodes) {
    return !!getContextViewpointSpec(allNodes);
  }

  function getContextGroupFromTarget(target, timelineSpec, viewpointSpec) {
    var group;

    if (viewpointSpec && viewpointSpec.group) {
      return viewpointSpec.group;
    }
    if (timelineSpec && timelineSpec.group) {
      return timelineSpec.group;
    }
    if (!target) {
      return null;
    }
    if (target.type === 'Group' && target.groupRef) {
      return model.findGroupById(target.groupRef) || target;
    }
    if (target.groupRef) {
      group = model.findGroupById(target.groupRef);
      if (group) {
        return group;
      }
    }
    if (target.id) {
      group = model.findGroupsByNodeId(target.id)[0];
      if (group) {
        return group;
      }
    }
    return null;
  }

  function getContextGroupKind(group, timelineSpec, viewpointSpec) {
    if (viewpointSpec || (group && group.type === 'viewpoint')) {
      return 'viewpoint';
    }
    if (timelineSpec || (group && group.type === 'timeline')) {
      return 'timeline';
    }
    if (group) {
      return 'generic';
    }
    return null;
  }

  function getContextGroupShape(group) {
    if (!group) {
      return null;
    }
    if (group.type === 'simple' || group.type === 'horizontal' || group.type === 'vertical') {
      return group.type;
    }
    if (group.shape === 'simple' || group.shape === 'horizontal' || group.shape === 'vertical') {
      return group.shape;
    }
    if (group.orientation === 'horizontal' || group.orientation === 'vertical') {
      return group.orientation;
    }
    return null;
  }

  function isContextGroupAxisTarget(target, timelineSpec, viewpointSpec) {
    return !!(
      target &&
      util.isLink(target) &&
      target.groupRef &&
      (
        (timelineSpec && timelineSpec.group && !timelineSpec.point) ||
        (viewpointSpec && viewpointSpec.group && !viewpointSpec.point) ||
        target.groupType === 'timelineAxis' ||
        target.groupType === 'viewpointAxis' ||
        target.linkType === 'timeline-axis' ||
        target.linkType === 'viewpoint-axis' ||
        target.groupType === 'horizontal' ||
        target.groupType === 'vertical' ||
        target.pseudo
      )
    );
  }

  function resolveMenuContext(allNodes, context) {
    var target = getContextTarget(allNodes);
    var timelineSpec = target ? getContextTimelineSpec([target]) : null;
    var viewpointSpec = target ? getContextViewpointSpec([target]) : null;
    var group = getContextGroupFromTarget(target, timelineSpec, viewpointSpec);
    var profile = {
      context: context || '',
      target: target || null,
      targetType: 'none',
      role: 'normal',
      group: group || null,
      groupKind: getContextGroupKind(group, timelineSpec, viewpointSpec),
      groupShape: getContextGroupShape(group),
      timelineSpec: timelineSpec || null,
      viewpointSpec: viewpointSpec || null,
      menuType: ''
    };

    if (target) {
      if (util.isLink(target)) {
        profile.targetType = 'link';
      }
      else if (util.isNode(target)) {
        profile.targetType = 'node';
      }
      else if (target.type === 'Group') {
        profile.targetType = 'group';
      }
    }

    if (viewpointSpec && viewpointSpec.point) {
      profile.role = 'groupMember';
    }
    else if (timelineSpec && timelineSpec.point) {
      profile.role = 'groupMember';
    }
    else if (isContextViewpointRepresentative([target]) || isRepresentativeTopic(target)) {
      profile.role = 'groupRepresentative';
    }
    else if ((viewpointSpec && viewpointSpec.group && !viewpointSpec.point) ||
      (timelineSpec && timelineSpec.group && !timelineSpec.point) ||
      isContextGroupAxisTarget(target, timelineSpec, viewpointSpec) ||
      isContextGroup([target])) {
      profile.role = 'group';
    }
    else if (group && target && util.isNode(target)) {
      profile.role = 'groupMember';
    }

    if (context === 'CMND') {
      profile.menuType = (profile.targetType === 'link') ? 'Link' : 'Node';
    }
    else if (context === 'EDIT') {
      if (profile.role === 'groupRepresentative') {
        profile.menuType = 'EditGroupRepresentative';
      }
      else if (profile.role === 'groupMember') {
        profile.menuType = 'EditGroupMember';
      }
      else if (profile.role === 'group') {
        profile.menuType = 'EditGroup';
      }
      else if (profile.targetType === 'link') {
        profile.menuType = 'EditLink';
      }
      else {
        profile.menuType = 'EditNode';
      }
    }
    else if (context === 'INFO') {
      if (profile.role === 'groupRepresentative') {
        profile.menuType = 'InfoGroupRepresentative';
      }
      else if (profile.role === 'groupMember') {
        profile.menuType = 'InfoGroupMember';
      }
      else if (profile.role === 'group') {
        profile.menuType = 'InfoGroup';
      }
      else if (profile.targetType === 'link') {
        profile.menuType = 'InfoLink';
      }
      else {
        profile.menuType = 'InfoNode';
      }
    }

    return profile;
  }

  function isTeamJointNoteForMenu() {
    var current = (common && common.current) || {};
    var stateValue = String(current.jointNoteState || current.collabNoteState || '').toLowerCase();
    var scope = String(current.note_scope || '').toLowerCase();
    var origin = (current.origin && typeof current.origin === 'object') ? current.origin : {};
    var originType = String(origin.type || '').toLowerCase();
    var originSource = String(origin.source || '').toLowerCase();

    if (wuwei.joint && typeof wuwei.joint.isTeamNote === 'function') {
      try {
        return !!wuwei.joint.isTeamNote(current);
      }
      catch (e) {
        /* fall through to local detection */
      }
    }

    if (stateValue === 'team') {
      return true;
    }
    if (stateValue === 'own' || stateValue === 'imported') {
      return false;
    }
    if (originType === 'import' || originSource === 'export-package') {
      return false;
    }

    return !!(
      scope === 'team' ||
      (current.joint && current.joint.enabled === true) ||
      (current.collaboration && current.collaboration.enabled === true) ||
      originType === 'team' ||
      originSource === 'team-note' ||
      current.team_id
    );
  }

  function isShapeOnlyEditForMenu(record) {
    return !!(record && !isTeamJointNoteForMenu() && !isOwnedByCurrentUserForMenu(record));
  }

  function isOwnedByCurrentUserForMenu(record) {
    if (!record) {
      return true;
    }
    try {
      return isOwnedByCurrentUser(record);
    }
    catch (e) {
      /*
       * Legacy records or pseudo SVG targets can be missing audit.createdBy.
       * Do not break menu rendering for such records; ownership-specific
       * restrictions are applied when a saved page/group/node record is available.
       */
      return true;
    }
  }

  function getOwnershipRecordForMenu(profile) {
    if (!profile) {
      return null;
    }
    /*
     * For a group axis / outline / Viewpoint axis pseudo link, the saved owner is
     * the group, not the graph pseudo link. Use the group record when present.
     */
    return profile.group || profile.target || null;
  }

  function isNonOwnerAllowedEditOperation(operation, profile) {
    var op = String(operation || '');
    var commonAllowed = [
      'addContent',
      'addTopic',
      'addMemo',
      'addTimelineSegmentFromPlayer',
      'addViewpointEntry',
      'createTimelineAxis',
      'createViewpointAxis',
      'copy',
      'copyViewpointTarget'
    ];
    var nonTeamDisplayLayoutAllowed = [
      'edit',
      'editGroup',
      'horizontal',
      'vertical',
      'normal',
      'reverse',
      'horizontal2',
      'vertical2',
      'forward',
      'backward'
    ];

    if (commonAllowed.indexOf(op) >= 0) {
      return true;
    }

    /*
     * In ordinary personal/imported notes, another user's objects can be
     * adjusted for the current user's layout/display needs.  The edit pane
     * still protects non-display fields through wuwei.joint.canEditPath().
     *
     * In active team notes, another user's objects remain directly read-only;
     * users should add their own node/memo/comment instead of editing or moving
     * the other user's object.
     */
    if (!isTeamJointNoteForMenu() && nonTeamDisplayLayoutAllowed.indexOf(op) >= 0) {
      return true;
    }

    /*
     * Other users' Viewpoint axes / PageMarkers may still be used as an
     * attachment point for adding a PageMarker, or copied to create a new object
     * owned by the current user.  Structural deletion / direction / edit is not
     * allowed for non-owned Viewpoint targets in active team notes.
     */
    if (profile && profile.groupKind === 'viewpoint' &&
      ['addViewpointEntry', 'copyViewpointTarget'].indexOf(op) >= 0) {
      return true;
    }

    return false;
  }

  function isOperationAllowedByOwnership(operation, profile, context) {
    var ownershipRecord;

    if (context === 'INFO' || operation === 'adminInfo') {
      return true;
    }

    ownershipRecord = getOwnershipRecordForMenu(profile);
    if (isOwnedByCurrentUserForMenu(ownershipRecord)) {
      return true;
    }

    if (context === 'EDIT') {
      return isNonOwnerAllowedEditOperation(operation, profile);
    }

    if (context === 'CMND' && (state.published || state.viewOnly || !isTeamJointNoteForMenu())) {
      return true;
    }

    return false;
  }

  function hasContextDownloadUrl(allNodes) {
    var node = getContextTarget(allNodes);
    return !!getDownloadUrl(node);
  }

  OperationsList = {
    'adminInfo': ['Admin',
      function () {
        /*
         * Admin pane is an information-menu command for the current internal
         * state.  It should not depend on whether the clicked target resolves
         * to a normal node/link record, because Timeline/Viewpoint axes and
         * pseudo SVG targets can be lightweight context targets.
         */
        if (state.Selecting || state.Connecting) {
          return false;
        }
        /*
         * The menu decision should depend only on the logged-in user's role.
         * Do not depend on wuwei.info.admin being loaded here; otherwise the
         * command disappears when the info/admin module is loaded later or when
         * the menu is evaluated before that namespace is ready.
         */
        return isAdminUserForMenu();
      },
      null,
      'fas fa-tools fa-lg fa-fw'
    ],

    'info': ['Info',
      function (allNodes) {
        var node = getContextTarget(allNodes);
        if (state.Selecting || state.Connecting || util.isEmpty(node)) {
          return false;
        }

        // Timeline / Viewpoint targets have specialised info panes.
        // Suppress the generic [i] command for axis, representative and member
        // targets so the information menu does not show duplicate [i] entries.
        if (isContextTimelineAxis(allNodes) || isContextTimelineSegment(allNodes) ||
          isContextViewpointAxis(allNodes) || isContextViewpointRepresentative(allNodes) ||
          isContextViewpointPage(allNodes)) {
          return false;
        }

        return true;
      },
      null,
      'fas fa-info fa-lg fa-fw'
    ],

    'openWindow': ['OpenWindow',
      function (allNodes) {
        if (state.Selecting || state.Connecting) {
          return false;
        }

        /*
         * PDF / Office / HTML documents are openable regardless of whether
         * they are uploaded resources or network resources.  getOpenUrl()
         * resolves the appropriate direct URL, uploaded preview PDF, or
         * Office Online viewer URL as needed.
         */
        return isContextOpenableTarget(allNodes);
      },
      null,
      'fas fa-external-link-alt fa-lg fa-fw'
    ],

    'openPlayer': ['OpenPlayer',
      function (allNodes) {
        if (state.Selecting || state.Connecting) {
          return false;
        }
        return isContextVideoContent(allNodes) || isContextTimelinePlayable(allNodes);
      },
      null,
      'fas fa-play-circle fa-lg fa-fw'
    ],

    'closeWindow': ['CloseWindow',
      function (allNodes) {
        var node = getContextTarget(allNodes);
        if (state.Selecting || state.Connecting || util.isEmpty(node)) {
          return false;
        }
        return isContextVideoContent(allNodes);
      },
      null,
      'far fa-window-close fa-lg fa-fw'
    ],

    'openNewTab': ['OpenNewTab',
      function (allNodes) {
        if (state.Selecting || state.Connecting) {
          return false;
        }

        /*
         * Match OpenWindow: uploaded and network PDF / Office / HTML
         * documents must be available from the INFO context menu.
         */
        return isContextOpenableTarget(allNodes);
      },
      null,
      'fas fa-external-link-alt fa-lg fa-fw'
    ],

    'download': ['Download',
      function (allNodes) {
        var node = getContextTarget(allNodes);
        var ref, isImageOrPdf, isOffice;

        if (graph.mode === 'view' || state.viewOnly || state.published) {
          return false;
        }

        if (util.isEmpty(node) ||
          state.Selecting ||
          state.Connecting) {
          return false;
        }

        if (!isContextRegularContent(allNodes)) {
          return false;
        }

        if (!hasContextDownloadUrl(allNodes)) {
          return false;
        }

        var resource = getNodeResource(node);
        ref = String(getDownloadUrl(node) || (resource.original && resource.original.url) || resource.uri || resource.canonicalUri || '').toLowerCase();

        isImageOrPdf = !!(
          util.isDocumentKindByExtension(node, resource, ref, 'image') ||
          util.isDocumentKindByExtension(node, resource, ref, 'pdf')
        );

        isOffice = !!util.isDocumentKindByExtension(node, resource, ref, 'office');

        return isUploadedContent(allNodes) || isImageOrPdf || isOffice;
      },
      null,
      'fas fa-download fa-lg fa-fw'
    ],

    'edit': ['Edit',
      function (allNodes) {
        var node = getContextTarget(allNodes);
        if (graph.mode === 'view' || state.viewOnly || state.published ||
          state.Selecting || state.Connecting || util.isEmpty(node)) {
          return false;
        }

        /*
         * Timeline / Viewpoint axis and Timeline Segment have specialised
         * edit operations with the same "Edit" label.  Suppress the generic
         * edit item there so the context menu shows only one Edit command.
         *
         * Representative nodes and Viewpoint PageMarkers keep the generic edit
         * command because it opens their display/style edit pane.
         */
        return true;
      },
      null,
      'fas fa-pencil-alt fa-lg fa-fw'
    ],

    'editGroup': ['Edit group',
      function (allNodes) {
        var node = getContextTarget(allNodes);
        var group;

        if (graph.mode === 'view' || state.viewOnly || state.published ||
          state.Selecting || state.Connecting || util.isEmpty(node)) {
          return false;
        }

        group = getContextGroupFromTarget(node, getContextTimelineSpec([node]), getContextViewpointSpec([node]));
        return !!(group && ['simple', 'horizontal', 'vertical'].indexOf(group.type) >= 0);
      },
      null,
      'fas fa-object-group fa-lg fa-fw'
    ],

    'connect': ['Connect',
      function (allNodes) {
        var node = getContextTarget(allNodes);
        if (state.Connecting && !util.isEmpty(node)) {
          return true;
        }
        return false;
      },
      null,
      'far fa-check-square fa-lg fa-fw'
    ],

    'addContent': ['Add Content',
      function (allNodes) {
        var node = getContextTarget(allNodes);
        if (!state.Selecting &&
          !state.Connecting &&
          !util.isEmpty(node) &&
          !isContextTimelineAxis(allNodes) &&
          !isContextViewpointAxis(allNodes)) {
          return true;
        }
        return false;
      },
      null,
      'fa fa-th-large fa-lg fa-fw'
    ],

    'addTopic': ['Add Topic',
      function (allNodes) {
        var node = getContextTarget(allNodes);
        if (!state.Selecting &&
          !state.Connecting &&
          !util.isEmpty(node) &&
          !isContextTimelineAxis(allNodes) &&
          !isContextViewpointAxis(allNodes)) {
          return true;
        }
        return false;
      },
      null,
      'fa fa-tag fa-lg fa-fw'
    ],

    'addMemo': ['Add Memo',
      function (allNodes) {
        var node = getContextTarget(allNodes);
        if (!state.Selecting &&
          !state.Connecting &&
          !util.isEmpty(node) &&
          !isContextTimelineAxis(allNodes) &&
          !isContextViewpointAxis(allNodes)) {
          return true;
        }
        return false;
      },
      null,
      'far fa-sticky-note fa-lg fa-fw'
    ],

    'bloom': ['Bloom',
      function (allNodes) {
        var node = getContextTarget(allNodes);
        if (util.isEmpty(node) || state.Selecting || state.Connecting) { return false; }
        var links = model.findLinksByNode(node);
        if (util.isEmpty(links)) { return false; }
        var hiddens = links.hiddens.length;
        if (hiddens === 0) { return false; }
        if (allNodes.length === 1) { return true; }
        return false;
      },
      null,
      'fas fa-expand-arrows-alt fa-lg fa-fw'
    ],

    'showGroup': ['Show Group',
      function (allNodes) {
        var node = getContextTarget(allNodes);
        if (util.isEmpty(node) || state.Selecting || state.Connecting) {
          return false;
        }
        if (!model || typeof model.hasHiddenGroupNodes !== 'function') {
          return false;
        }
        return allNodes.length === 1 && model.hasHiddenGroupNodes(node);
      },
      null,
      'fas fa-eye fa-lg fa-fw'
    ],

    'root': ['Root',
      function (allNodes) {
        var node = getContextTarget(allNodes);
        var visibleNodes = graph.nodes.filter(function (node) {
          return util.isShown(node) && !node.filterout;
        });
        var visibleLinks = graph.links.filter(function (link) {
          return util.isShown(link) && !link.filterout;
        });
        if (util.isEmpty(node) ||
          (1 === visibleNodes.length && 0 === visibleLinks.length) ||
          state.Selecting ||
          state.Connecting) {
          return false;
        }
        if (allNodes.length === 1) {
          return true;
        }
        return false;
      },
      null,
      'fa fa-circle fa-lg fa-fw'
    ],

    'forward': ['Bring forward',
      function (allNodes) {
        var node = getContextTarget(allNodes);
        var visibleNodes = graph.nodes.filter(function (node) {
          return util.isShown(node) && !node.filterout;
        });
        var visibleLinks = graph.links.filter(function (link) {
          return util.isShown(link) && !link.filterout;
        });
        if (util.isEmpty(node) ||
          (1 === visibleNodes.length && 0 === visibleLinks.length) ||
          state.Selecting ||
          state.Connecting) {
          return false;
        }
        if (allNodes.length === 1) {
          return true;
        }
        return false;
      },
      null,
      'fas fa-arrow-up fa-lg fa-fw'
    ],

    'backward': ['Send backward',
      function (allNodes) {
        var node = getContextTarget(allNodes);
        var visibleNodes = graph.nodes.filter(function (node) {
          return util.isShown(node) && !node.filterout;
        });
        var visibleLinks = graph.links.filter(function (link) {
          return util.isShown(link) && !link.filterout;
        });
        if (util.isEmpty(node) ||
          (1 === visibleNodes.length && 0 === visibleLinks.length) ||
          state.Selecting ||
          state.Connecting) {
          return false;
        }
        if (allNodes.length === 1) {
          return true;
        }
        return false;
      },
      null,
      'fas fa-arrow-down fa-lg fa-fw'
    ],

    'wilt': ['Wilt',
      function (allNodes) {
        var node = getContextTarget(allNodes);
        if (util.isEmpty(node) ||
          state.Selecting ||
          state.Connecting) {
          return false;
        }
        var links = model.findLinksByNode(node);
        if (util.isEmpty(links)) { return false; }
        var count = links.links.length;
        var visibles = links.visibles.length;
        if (0 === count || 0 === visibles) { return false; }
        if (allNodes.length === 1) { return true; }
        return false;
      },
      null,
      'fas fa-compress fa-lg fa-fw'
    ],

    'hide': ['Hide',
      function (allNodes) {
        var node = getContextTarget(allNodes);
        if (util.isEmpty(node) ||
          state.Connecting ||
          state.Selecting) {
          return false;
        }
        return true;
      },
      null,
      'fas fa-minus-square fa-lg fa-fw'
    ],

    'copy': ['Copy',
      function (allNodes) {
        var node = getContextTarget(allNodes);
        if (util.isEmpty(node)) {
          return false;
        }
        if (isContextViewpointTarget(allNodes)) {
          return false;
        }
        return true;
      },
      null,
      'fa fa-clone fa-lg fa-fw'
    ],

    'clipboard': ['Copy',
      function (allNodes) {
        var node = getContextTarget(allNodes);
        if (graph.mode === 'view' || state.viewOnly || state.published ||
          state.Selecting || state.Connecting ||
          isContextViewpointTarget(allNodes)) {
          return false;
        }
        if (allNodes.length === 1 && util.notEmpty(node) &&
          (util.isNode(node) || isContextGroup(allNodes) || (util.isLink(node) && node.groupRef))) {
          return true;
        }
        return false;
      },
      null,
      'far fa-clipboard fa-lg fa-fw'
    ],

    'paste': ['Paste',
      function (allNodes) {
        if (graph.mode === 'view' || state.viewOnly || state.published ||
          state.Selecting || state.Connecting) {
          return false;
        }
        return hasNodeClipboard();
      },
      null,
      'fas fa-paste fa-lg fa-fw'
    ],

    'clone': ['Clone',
      function (allNodes) {
        var node = getContextTarget(allNodes);
        if (graph.mode === 'view' || state.viewOnly || state.published ||
          state.Selecting || state.Connecting ||
          isContextViewpointTarget(allNodes)) {
          return false;
        }
        if (allNodes.length === 1 && util.notEmpty(node) &&
          (util.isNode(node) || isContextGroup(allNodes) || (util.isLink(node) && node.groupRef))) {
          return true;
        }
        return false;
      },
      null,
      'fa fa-clone fa-lg fa-fw'
    ],

    'reverse': ['Reverse',
      function (allNodes) {
        if (isContextTimelineAxis(allNodes) || isContextViewpointTarget(allNodes)) { return false; }
        var node = getContextTarget(allNodes);
        if (allNodes.length === 1 &&
          util.notEmpty(node) &&
          !node.copying &&
          util.isLink(node)) {
          return true;
        }
        return false;
      },
      null,
      'fas fa-arrows-alt-h fa-lg fa-fw'
    ],

    'normal': ['NORMAL',
      function (allNodes) {
        if (isContextTimelineAxis(allNodes) || isContextViewpointTarget(allNodes)) { return false; }
        var node = getContextTarget(allNodes);
        if (allNodes.length === 1 &&
          util.notEmpty(node) &&
          'NORMAL' !== node.shape &&
          !node.copying &&
          util.isLink(node)) {
          return true;
        }
        return false;
      },
      null,
      'fas fa-arrow-left fa-lg fa-fw'
    ],

    'horizontal': ['HORIZONTAL',
      function (allNodes) {
        if (isContextTimelineAxis(allNodes)) {
          var timelineSpec = getContextTimelineSpec(allNodes);
          return !!(timelineSpec && timelineSpec.group && timelineSpec.group.orientation !== 'horizontal');
        }
        if (isContextViewpointAxis(allNodes)) {
          var viewpointSpec = getContextViewpointSpec(allNodes);
          return !!(viewpointSpec && viewpointSpec.group && viewpointSpec.group.orientation !== 'horizontal');
        }
        var node = getContextTarget(allNodes);
        if (allNodes.length === 1 &&
          util.notEmpty(node) &&
          'HORIZONTAL' !== node.shape &&
          !node.copying &&
          util.isLink(node)) {
          return true;
        }
        return false;
      },
      null,
      'xlink:href="#horizontal"'
    ],

    'vertical': ['VERTICAL',
      function (allNodes) {
        if (isContextTimelineAxis(allNodes)) {
          var timelineSpec = getContextTimelineSpec(allNodes);
          return !!(timelineSpec && timelineSpec.group && timelineSpec.group.orientation !== 'vertical');
        }
        if (isContextViewpointAxis(allNodes)) {
          var viewpointSpec = getContextViewpointSpec(allNodes);
          return !!(viewpointSpec && viewpointSpec.group && viewpointSpec.group.orientation !== 'vertical');
        }
        var node = getContextTarget(allNodes);
        if (allNodes.length === 1 &&
          util.notEmpty(node) &&
          'VERTICAL' !== node.shape &&
          !node.copying &&
          util.isLink(node)) {
          return true;
        }
        return false;
      },
      null,
      'xlink:href="#vertical"'
    ],

    'horizontal2': ['HORIZONTAL2',
      function (allNodes) {
        if (isContextTimelineAxis(allNodes) || isContextViewpointTarget(allNodes)) { return false; }
        var node = getContextTarget(allNodes);
        if (allNodes.length === 1 &&
          util.notEmpty(node) &&
          'HORIZONTAL2' !== node.shape &&
          !node.copying &&
          util.isLink(node)) {
          return true;
        }
        return false;
      },
      null,
      'xlink:href="#horizontal2"'
    ],

    'vertical2': ['VERTICAL2',
      function (allNodes) {
        if (isContextTimelineAxis(allNodes) || isContextViewpointTarget(allNodes)) { return false; }
        var node = getContextTarget(allNodes);
        if (allNodes.length === 1 &&
          util.notEmpty(node) &&
          'VERTICAL2' !== node.shape &&
          !node.copying &&
          util.isLink(node)) {
          return true;
        }
        return false;
      },
      null,
      'xlink:href="#vertical2"'
    ],

    'deleteGroup': ['Delete',
      function (allNodes) {
        var node = getContextTarget(allNodes);
        if (util.isEmpty(node) || node.copying) {
          return false;
        }
        /*
         * Viewpoint representative / axis / PageMarker targets have their own
         * managed Delete command.  Suppress the generic group Delete here so
         * the representative context menu does not show two Delete entries.
         */
        if (isContextViewpointTarget(allNodes)) {
          return false;
        }
        return isWholeGroupEraseTarget(node);
      },
      'danger',
      'far fa-trash-alt fa-lg fa-fw'
    ],

    'erase': ['Erase',
      function (allNodes) {
        var node = getContextTarget(allNodes);
        if (node.copying ||
          util.isEmpty(node) ||
          (allNodes.length === 1 && util.notEmpty(node) && node.copying)) {
          return false;
        }
        if (isWholeGroupEraseTarget(node)) {
          return false;
        }
        if (isContextTimelineSegment(allNodes) || isContextViewpointTarget(allNodes)) {
          return false;
        }
        return true;
      },
      'danger',
      'far fa-trash-alt fa-lg fa-fw'
    ],

    'addSimpleTopic': ['Add Topic',
      function () {
        if (!state.Selecting &&
          !state.Connecting) {
          return true;
        }
        return false;
      },
      null,
      'fa fa-tag fa-lg fa-fw'
    ],

    'addSimpleContent': ['Add Content',
      function () {
        if (!state.Selecting &&
          !state.Connecting) {
          return true;
        }
        return false;
      },
      null,
      'fa fa-th-large fa-lg fa-fw'
    ],

    'addSimpleMemo': ['Add Memo',
      function (allNodes) {
        if (!state.Selecting &&
          !state.Connecting) {
          return true;
        }
        return false;
      },
      null,
      'fa fa-sticky-note-o fa-lg fa-fw'
    ],

    'uploadFile': ['Upload File',
      function (allNodes) {
        if (!state.Selecting &&
          !state.Connecting) {
          return true;
        }
        return false;
      },
      null,
      'fa fa-cloud-upload fa-lg fa-fw'
    ],

    'showAll': ['Show All',
      function () {
        if (state.Extra) {
          return true;
        }
        return false;
      },
      null, null
    ],

    'clearScreen': ['Clear Screen',
      function () {
        if (state.chatMode.active) {
          return false;
        }
        if (state.Extra) {
          return true;
        }
        return false;
      },
      null,
      'fa fa-times-circle fa-lg fa-fw'
    ],

    'showAllMemo': ['Show All Memo',
      function (allNodes) {
        if (state.Extra) {
          return true;
        }
        return false;
      },
      null, null
    ],

    'hideAllMemo': ['Hide All Memo',
      function (allNodes) {
        if (state.Extra) {
          return true;
        }
        return false;
      },
      null,
      'fas fa-minus-square fa-lg fa-fw'
    ],

    'selectAll': ['SelectAll',
      function () {
        if (!state.Editing) {
          return false;
        }
        if (state.Selecting) {
          return true;
        }
        return false;
      },
      null,
      'far fa-check-square fa-lg fa-fw'
    ],

    'clearSelection': ['Clear Selection',
      function () {
        if (!state.Editing ||
          state.Connecting
        ) {
          return false;
        }
        return true;
      },
      null,
      ['far fa-check-square fa-stack-1x', 'fa fa-ban fa-text-gray fa-stack-2x']
    ],

    'newNote': ['New Note',
      function () {
        return true;
      },
      null,
      'fa fa-comment fa-lg fa-fw'
    ],

    'closeNote': ['Close Note',
      function () {
        if (state.loggedIn &&
          current.note_id &&
          util.notEmpty(current.note_name)) {
          return true;
        }
        return false;
      },
      "{'background-color': '#a0a0a0'}",
      null,
    ],

    'newPage': ['New Page',
      function () {
        const current = wuwei.common.current;
        if (Editing &&
          util.notEmpty(util.getNoteOwnerUserId(current)) &&
          auth.currentUser &&
          util.getNoteOwnerUserId(current) === (auth.currentUser.user_id || auth.currentUser._id)) {
          return true;
        }
        return false;
      },
      null,
      'fa fa-file-o fa-lg fa-fw'
    ],

    'notePage': ['Note Page',
      function () {
        const current = wuwei.common.current;
        if (Editing &&
          util.notEmpty(util.getNoteOwnerUserId(current)) &&
          auth.currentUser &&
          util.getNoteOwnerUserId(current) === (auth.currentUser.user_id || auth.currentUser._id)) {
          return true;
        }
        return false;
      },
      null, null
    ],

    'listPage': ['List Page',
      function () {
        return true;
      },
      null, null
    ],

    'createTimelineAxis': ['Add Axis',
      function (allNodes) {
        return !state.Selecting &&
          !state.Connecting &&
          isContextTimelineCreatableContent(allNodes);
      },
      null,
      'fas fa-stream fa-lg fa-fw'
    ],

    'createViewpointAxis': ['Add Axis',
      function (allNodes) {
        return !state.Selecting &&
          !state.Connecting &&
          isContextDocumentLikeContent(allNodes);
      },
      null,
      'fas fa-stream fa-lg fa-fw'
    ],

    'addViewpointEntry': ['Add Entry',
      function (allNodes) {
        return !state.Selecting &&
          !state.Connecting &&
          isContextViewpointTarget(allNodes);
      },
      null,
      'fas fa-plus-circle fa-lg fa-fw'
    ],

    'copyViewpointTarget': ['Copy',
      function (allNodes) {
        return !state.Selecting &&
          !state.Connecting &&
          (isContextViewpointAxis(allNodes) ||
            isContextViewpointPage(allNodes) ||
            isContextViewpointRepresentative(allNodes));
      },
      null,
      'fa fa-clone fa-lg fa-fw'
    ],


    'distributeViewpointPageMarkers': ['Distribute PageMarkers',
      function (allNodes) {
        return !state.Selecting &&
          !state.Connecting &&
          isContextViewpointRepresentative(allNodes);
      },
      null,
      'fas fa-arrows-alt-h fa-lg fa-fw'
    ],

    'distributeTopicGroupMembers': ['Distribute group members',
      function (allNodes) {
        var target = getContextTarget(allNodes);
        var group = target && target.groupRef && model.findGroupById
          ? model.findGroupById(target.groupRef)
          : null;
        return !!(
          !state.Selecting &&
          !state.Connecting &&
          target &&
          isRepresentativeTopic(target) &&
          group &&
          ('horizontal' === group.type || 'vertical' === group.type)
        );
      },
      null,
      'fas fa-arrows-alt-h fa-lg fa-fw'
    ],

    'deleteViewpointTarget': ['Delete',
      function (allNodes) {
        return !state.Selecting &&
          !state.Connecting &&
          isContextViewpointTarget(allNodes);
      },
      'danger',
      'far fa-trash-alt fa-lg fa-fw'
    ],

    'addTimelineSegmentFromPlayer': ['Add Segment',
      function (allNodes) {
        return !state.Selecting &&
          !state.Connecting &&
          (isContextTimelineAxis(allNodes) ||
            isContextTimelineRepresentative(allNodes));
      },
      null,
      'fas fa-plus-circle fa-lg fa-fw'
    ],

    'editTimelineSegmentFromPlayer': ['Edit from player',
      function () {
        return false;
      },
      null,
      'fas fa-play-circle fa-lg fa-fw'
    ],

    'deleteTimelineSegment': ['Delete',
      function (allNodes) {
        return !state.Selecting &&
          !state.Connecting &&
          isContextTimelineMidSegment(allNodes);
      },
      'danger',
      'far fa-trash-alt fa-lg fa-fw'
    ],

    'infoTimelineTarget': ['Info',
      function (allNodes) {
        return !state.Selecting &&
          !state.Connecting && (
            isContextTimelineAxis(allNodes) ||
            isContextTimelineSegment(allNodes));
      },
      null,
      'fas fa-info fa-lg fa-fw'
    ],

    'infoViewpointTarget': ['Info',
      function (allNodes) {
        return !state.Selecting &&
          !state.Connecting &&
          isContextViewpointTarget(allNodes);
      },
      null,
      'fas fa-info fa-lg fa-fw'
    ]
  };

  function updateSettingIconForMode() {
    if (!settinIgcon) {
      return;
    }
    if ('view' === graph.mode || !heading_menu || !heading_menu.classList.contains('active')) {
      settinIgcon.classList.remove('active');
      if (wuwei.menu.setting && 'function' === typeof wuwei.menu.setting.close) {
        wuwei.menu.setting.close();
      }
      return;
    }
    settinIgcon.classList.add('active');
    if (settingPane && !settingPane.classList.contains('hidden') &&
      wuwei.menu.setting && 'function' === typeof wuwei.menu.setting.open) {
      wuwei.menu.setting.open();
    }
  }

  function isNetworkAlertStatus(status) {
    return ['ioNG', 'connect_failed', 'disconnect', 'reconnect_failed'].indexOf(String(status || '')) >= 0;
  }

  function updateUtilityIndicatorsVisibility() {
    var open = heading_menu && heading_menu.classList.contains('active');
    var languageEl = document.getElementById('language');
    var stateEl = document.getElementById('state');
    if (languageEl) {
      languageEl.classList.toggle('active', !!open);
    }
    if (stateEl) {
      stateEl.classList.toggle('active', !!open);
      stateEl.classList.toggle('network-alert',
        !window.navigator.onLine || isNetworkAlertStatus(stateEl.dataset.socketStatus));
    }
  }

  function setNetworkStatusIndicator(status) {
    var stateEl = document.getElementById('state');
    var alert;
    if (!stateEl) {
      return;
    }
    if ('string' === typeof status && status) {
      stateEl.dataset.socketStatus = status;
    }
    alert = !window.navigator.onLine || isNetworkAlertStatus(stateEl.dataset.socketStatus);
    stateEl.classList.toggle('isOnline', !alert);
    stateEl.classList.toggle('network-alert', alert);
    updateUtilityIndicatorsVisibility();
  }

  function menuSocketStatus(status) {
    setNetworkStatusIndicator(status);
  }

  function bindNetworkStatusIndicator() {
    window.removeEventListener('online', setNetworkStatusIndicator, false);
    window.removeEventListener('offline', setNetworkStatusIndicator, false);
    window.addEventListener('online', setNetworkStatusIndicator, false);
    window.addEventListener('offline', setNetworkStatusIndicator, false);
    if (wuwei.data && wuwei.data.Events && 'function' === typeof wuwei.data.Events.subscribe) {
      try {
        wuwei.data.Events.unsubscribe('socket-status', 'menuSocketStatus');
      }
      catch (e) {
        // The first menu init has no previous subscriber.
      }
      try {
        wuwei.data.Events.subscribe('socket-status', menuSocketStatus);
      }
      catch (e) {
        if (window.console && console.warn) {
          console.warn('Failed to subscribe socket status indicator.', e);
        }
      }
    }
    setNetworkStatusIndicator();
  }

  drawmodeClicked = function () {
    drawmode_n = ++drawmode_n % 3;
    drawmode = state.Drawmode[drawmode_n];
    drawmodeIcon.classList.remove('draw');
    drawmodeIcon.classList.remove('simulation');
    drawmodeIcon.classList.remove('view');
    drawmodeIcon.classList.add(`${drawmode}`);
    menuDiv.classList.remove('draw');
    menuDiv.classList.remove('simulation');
    menuDiv.classList.remove('view');
    menuDiv.classList.add(`${drawmode}`);
    graph.mode = drawmode;
    switch (drawmode) {
      case 'draw':
        drawIcon.setAttribute('class', 'fas fa-pencil-ruler');
        searchIcon.classList.remove('simulation');
        updateSettingIconForMode();
        draw.refresh();
        break;
      case 'view':
        drawIcon.setAttribute('class', 'far fa-square');
        searchIcon.classList.remove('simulation');
        updateSettingIconForMode();
        draw.refresh();
        break;
      case 'simulation':
        drawIcon.setAttribute('class', 'fas fa-expand-arrows-alt');
        searchIcon.classList.add('simulation');
        updateSettingIconForMode();
        draw.restart();
        break;
    }
  }

  registerClick = function (selector, func) {
    var element = document.querySelector(selector);
    if (element) {
      element.addEventListener('click', func, false);
    }
  }

  initModule = function () {
    document.getElementById('menu').innerHTML = wuwei.menu.markup.template();

    pp = 1;

    menuDiv = document.getElementById('menu');
    drawmodeIcon = document.getElementById('draw_mode');
    drawIcon = drawmodeIcon.querySelector('i');
    settinIgcon = document.getElementById('setting');
    // shareIcon = document.getElementById('share_mode');
    settingPane = document.getElementById('settingPane');
    heading_menu = document.querySelector('.heading-menu');
    searchIcon = document.getElementById('searchIcon');
    open_controls = document.getElementById('open_controls');
    controls = document.getElementById('controls');
    drawmode_n = 0;
    drawmode = state.Drawmode[drawmode_n];


    // 初期表示ではメニューを閉じた状態（hamburger だけ）にする
    if (heading_menu) {
      heading_menu.classList.remove('active');
    }

    if (controls) { // hide
      open_controls.innerHTML = '<span>&#9650</span>';
      controls.classList.add('hidden');
      controls.style.display = 'none';
    }

    drawmodeIcon.className = `command ${drawmode}`;
    graph.mode = drawmode;
    drawIcon.setAttribute('class', 'fas fa-pencil-ruler');
    updateSettingIconForMode();
    // shareIcon.style.display = 'none';

    settinIgcon.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (settingPane.classList.contains('hidden')) {
        wuwei.menu.setting.open();
      }
      else {
        wuwei.menu.setting.close();
      }
    }, false);

    var togglerEDIT = document.querySelector('#contextEDIT .toggler');
    togglerEDIT.addEventListener('click', function (e) {
      closeContext('EDIT');
    }, false);

    var togglerCMND = document.querySelector('#contextCMND .toggler');
    togglerCMND.addEventListener('click', function (e) {
      closeContext('CMND');
    }, false);

    var togglerINFO = document.querySelector('#contextINFO .toggler');
    togglerINFO.addEventListener('click', function (e) {
      closeContext('INFO');
    }, false);

    var langSelect = document.getElementById('language');
    langSelect.addEventListener('change', function (e) {
      const lang = langSelect.value;
      common.nls.LANG = lang;
      localStorage.setItem('language', lang);
      document.getElementById('menu').innerHTML = wuwei.menu.markup.template(lang);
      initModule();
    }, false);
    bindNetworkStatusIndicator();
    updateUtilityIndicatorsVisibility();

    registerClick('#open_controls', openControlsClicked);
    registerClick('#draw_mode', drawmodeClicked);
    registerClick('#zoomin', zoomInClicked);
    registerClick('.resetview.icon', resetViewClicked);
    registerClick('.resetview.scale', resetViewClicked);
    registerClick('#zoomout', zoomOutClicked);
    registerClick('#open_miniature', openMiniatureClicked);
    registerClick('#user_status', userStatusClicked);
    registerClick('.pulldown.user .header i.fa-times', closeUserClicked);
    registerClick('.pulldown.user .operators .operator.Login', () => {
      wuwei.menu.login.open();
      closeUserMenu();
    });
    registerClick('.pulldown.user .operators .operator.Logout', () => {
      wuwei.menu.login.logout();
      closeUserMenu();
    });
    registerClick('#mainIcon', mainClicked);
    // noteIcon
    registerClick('#noteIcon', noteClicked);
    registerClick('.pulldown.note .header i.fa-times', closeNoteClicked);
    registerClick('.pulldown.note .operators .operator.Login', () => {
      wuwei.menu.login.open();
    });
    registerClick('.pulldown.note .operators .operator.Logout', () => {
      wuwei.menu.login.logout();
    });
    registerClick('.pulldown.note .operators .operator.New', () => {
      document.querySelector('#note_name .name').innerHTML = '';
      document.querySelector('#note_name .description').innerHTML = '';
      document.querySelector('#page_name .pp').innerHTML = '';
      document.querySelector('#page_name .name').innerHTML = '';
      document.querySelector('#page_name .description').innerHTML = '';
      // close pane
      document.getElementById('edit').style.display = 'none';
      document.getElementById('info').style.display = 'none';

      wuwei.note.newNote();
      refreshPagenation();

      closeNoteMenu();
      draw.redraw();
    });
    registerClick('.pulldown.note .operators .operator.OpenV0', () => {
      wuwei.menu.note.list(1, undefined, { note_format: 'ver0' });
      closeNoteMenu();
    });
    registerClick('.pulldown.note .operators .operator.OpenV1', () => {
      wuwei.menu.note.list(1, undefined, { note_format: 'ver1' });
      closeNoteMenu();
    });
    registerClick('.pulldown.note .operators .operator.Open', () => {
      wuwei.menu.note.list(1, undefined, { note_format: 'ver2' });
      closeNoteMenu();
    });
    registerClick('.pulldown.note .operators .operator.Save', () => {
      if (state.viewOnly || state.published) { return; }
      wuwei.menu.note.open();
      closeNoteMenu();
    });
    registerClick('.pulldown.note .operators .operator.Download', () => {
      if (state.viewOnly || state.published) { return; }
      wuwei.menu.note.downloadFile();
      closeNoteMenu();
    });
    registerClick('.pulldown.note .operators .operator.ExportCanvasImage', () => {
      exportCanvasImage();
      closeNoteMenu();
    });
    registerClick('.pulldown.note .operators .operator.Discard', () => {
      if (state.viewOnly || state.published) { return; }
      wuwei.menu.note.discard();
      closeNoteMenu();
    });
    registerClick('.pulldown.note .operators .operator.UploadNote', () => {
      if (state.viewOnly || state.published) { return; }
      wuwei.menu.note.openFile();
      closeNoteMenu();
    });
    registerClick('.pulldown.note .operators .operator.Publish', () => {
      if (state.viewOnly || state.published) { return; }
      wuwei.menu.publish.publish({ close: closeNoteMenu });
    });
    registerClick('.pulldown.note .operators .operator.UploadCSV', () => {
      wuwei.menu.uploadCSV.open();
    });
    registerClick('.pulldown.note .operators .operator.downloadCSV', () => {
      wuwei.menu.downloadCSV.open();
    });
    // pageIcon
    registerClick('#pageIcon', pageClicked);
    registerClick('.pulldown.page .header i.fa-times', closePageClicked);
    registerClick('.pulldown.page .operators .operator.List', () => {
      ContextOperate('listPage');
    });
    registerClick('.pulldown.page .operators .operator.Name', () => {
      ContextOperate('namePage');
    });
    registerClick('.pulldown.page .operators .operator.Copy', () => {
      ContextOperate('copyPage');
    });
    registerClick('.pulldown.page .operators .operator.New', () => {
      ContextOperate('newPage');
    });
    // newIcon
    registerClick('#newIcon', newClicked);
    registerClick('.pulldown.new .header i.fa-times', closeNewClicked);
    registerClick('.pulldown.new .operators .operator.Content', () => {
      ContextOperate('addSimpleContent');
    });
    registerClick('.pulldown.new .operators .operator.Topic', () => {
      ContextOperate('addSimpleTopic');
    });
    registerClick('.pulldown.new .operators .operator.Memo', () => {
      ContextOperate('addSimpleMemo');
    });
    registerClick('.pulldown.new .operators .operator.Upload', () => {
      wuwei.menu.upload.open();
    });
    registerClick('.pulldown.new .operators .operator.Paste', () => {
      ContextOperate('paste');
      closeNewClicked();
    });
    // flockIcon
    registerClick('#flockIcon', flockClicked);
    registerClick('.pulldown.flock .header i.fa-times', closeFlockClicked);
    registerClick('#alignIcon', alignClicked);
    registerClick('#alignMenu .header i.fa-times', closeAlignClicked);
    registerClick('.pulldown.flock .operators .operator.DeselectFlock', () => {
      common.state.selectedNodeIds = [];
      d3.selectAll('g.node.selected circle.selected').remove();
      d3.selectAll('g.node.selected').nodes().map(node => {
        d3.select(node).classed('selected', false);
      });
      common.state.selectedGroupIds = [];
      common.state.selectedGroupMarks = {};
      draw.redraw();
    });
    registerClick('#alignMenu .operators .operator.AlignTop', () => {
      ContextOperate('alignTop');
    });
    registerClick('#alignMenu .operators .operator.AlignHorizontal', () => {
      ContextOperate('alignHorizontal');
    });
    registerClick('#alignMenu .operators .operator.AlignBottom', () => {
      ContextOperate('alignBottom');
    });
    registerClick('#alignMenu .operators .operator.AlignLeft', () => {
      ContextOperate('alignLeft');
    });
    registerClick('#alignMenu .operators .operator.AlignVertical', () => {
      ContextOperate('alignVertical');
    });
    registerClick('#alignMenu .operators .operator.AlignRight', () => {
      ContextOperate('alignRight');
    });
    registerClick('#alignMenu .operators .operator.HorizontalEqual', () => {
      ContextOperate('horizontalEqual');
    });
    registerClick('#alignMenu .operators .operator.HorizontalGapEqual', () => {
      ContextOperate('horizontalGapEqual');
    });
    registerClick('#alignMenu .operators .operator.VerticalEqual', () => {
      ContextOperate('verticalEqual');
    });
    registerClick('#alignMenu .operators .operator.VerticalGapEqual', () => {
      ContextOperate('verticalGapEqual');
    });
    registerClick('.pulldown.flock .operators .operator.DefineSimpleGroup', () => {
      ContextOperate('defineSimpleGroup');
    });
    registerClick('.pulldown.flock .operators .operator.DefineHorizontalGroup', () => {
      ContextOperate('defineHorizontalGroup');
    });
    registerClick('.pulldown.flock .operators .operator.DefineVerticalGroup', () => {
      ContextOperate('defineVerticalGroup');
    });
    registerClick('.pulldown.flock .operators .operator.Ungroup', () => {
      ContextOperate('ungroup');
    });
    registerClick('.pulldown.flock .operators .operator.DeleteGroup', () => {
      ContextOperate('deleteSelectedGroups');
    });
    registerClick('.pulldown.flock .operators .operator.Copy', () => {
      ContextOperate('copy');
    });
    registerClick('.pulldown.flock .operators .operator.Clipboard', () => {
      ContextOperate('clipboard');
    });
    registerClick('.pulldown.flock .operators .operator.Paste', () => {
      ContextOperate('paste');
    });
    registerClick('.pulldown.flock .operators .operator.Clone', () => {
      ContextOperate('clone');
    });
    registerClick('.pulldown.flock .operators .operator.Edit', () => {
      ContextOperate('edit-flock');
    });
    // searchIcon
    registerClick('#searchIcon', searchClicked);
    // // share_mode
    // registerClick('#share_mode', shareClicked);

    if (wuwei.menu.login && typeof wuwei.menu.login.initModule === 'function') {
      wuwei.menu.login.initModule();
    }
    if (wuwei.menu.modal && typeof wuwei.menu.modal.initModule === 'function') {
      wuwei.menu.modal.initModule();
    }
    if (wuwei.menu.note && typeof wuwei.menu.note.initModule === 'function') {
      wuwei.menu.note.initModule();
    }
    if (wuwei.menu.page && typeof wuwei.menu.page.initModule === 'function') {
      wuwei.menu.page.initModule();
    }
    if (wuwei.menu.pagination && typeof wuwei.menu.pagination.initModule === 'function') {
      wuwei.menu.pagination.initModule();
    }
    if (wuwei.menu.setting && typeof wuwei.menu.setting.initModule === 'function') {
      wuwei.menu.setting.initModule();
    }
    if (wuwei.menu.timeline && typeof wuwei.menu.timeline.initModule === 'function') {
      wuwei.menu.timeline.initModule();
    }
    if (wuwei.menu.viewpoint && typeof wuwei.menu.viewpoint.initModule === 'function') {
      wuwei.menu.viewpoint.initModule();
    }
    if (wuwei.menu.upload && typeof wuwei.menu.upload.initModule === 'function') {
      wuwei.menu.upload.initModule();
    }
    if (wuwei.menu.video && typeof wuwei.menu.video.initModule === 'function') {
      wuwei.menu.video.initModule();
    }
  };

  /** context menu */
  ns.OperationsList = OperationsList;
  ns.getTextViewerOpenUrl = getTextViewerOpenUrl;
  ns.openContextMenu = openContextMenu;
  ns.closeContextMenu = closeContextMenu;
  ns.closeContext = closeContext;
  ns.ContextMENU = ContextMENU;
  ns.ContextCMND = ContextCMND;
  ns.ContextEDIT = ContextEDIT;
  ns.ContextINFO = ContextINFO;
  ns.ContextOperate = ContextOperate;
  ns.contextUpdatePosition = contextUpdatePosition;
  ns.resolveMenuContext = resolveMenuContext;
  ns.isContextGroup = isContextGroup;
  /** note */
  ns.noteClicked = noteClicked;
  ns.closeNoteClicked = closeNoteClicked;
  ns.exportCanvasImage = exportCanvasImage;
  /** page */
  ns.pageClicked = pageClicked;
  ns.closePageClicked = closePageClicked;
  ns.refreshPagenation = refreshPagenation;
  ns.checkPage = checkPage;
  ns.registerPagebuttonEvent = registerPagebuttonEvent;
  ns.registerPageButtonEvent = registerPagebuttonEvent;
  /** new */
  ns.newClicked = newClicked;
  ns.closeNewClicked = closeNewClicked;
  /** flock */
  ns.flockClicked = flockClicked;
  ns.closeFlockClicked = closeFlockClicked;
  ns.alignClicked = alignClicked;
  ns.closeAlignClicked = closeAlignClicked;
  /** timeline */
  ns.timelineClicked = timelineClicked;
  ns.closeTimelineClicked = closeTimelineClicked;
  ns.timelineCreateAxisClicked = timelineCreateAxisClicked;
  ns.timelineAddPointClicked = timelineAddPointClicked;
  ns.timelineEditPointClicked = timelineEditPointClicked;
  ns.timelineDeletePointClicked = timelineDeletePointClicked;
  /** filter */
  ns.filterClicked = filterClicked;
  ns.closeFilterClicked = closeFilterClicked;
  /** search */
  ns.searchClicked = searchClicked;
  ns.closeSearchClicked = closeSearchClicked;
  /** controls */
  ns.openControlsClicked = openControlsClicked;
  ns.zoomInClicked = zoomInClicked;
  ns.resetViewClicked = resetViewClicked;
  ns.zoomOutClicked = zoomOutClicked;
  ns.updateResetview = updateResetview;
  ns.updateUndoRedoButton = updateUndoRedoButton;
  ns.undoClicked = undoClicked;
  ns.redoClicked = redoClicked;
  /** miniature */
  ns.openMiniatureClicked = openMiniatureClicked;
  /** refresh */
  ns.refreshContextMenuState = refreshContextMenuState;
  /** init */
  ns.initModule = initModule;
})(wuwei.menu);
// wuwei.menu.js last modified 2026-05-11
