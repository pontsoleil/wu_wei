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
    OperationsList,
    /** current */
    current = common.current,
    note_id = current.note_id,
    pp = current.page.pp,
    /** state */
    state = common.state,
    currentUser = state.currentUser,
    // user = currentUser.user,
    // user_id = currentUser.user_id,
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
    // mouseoverContext,
    // mouseoutContext,
    mainClicked,
    /** note */
    noteClicked,
    closeNoteClicked,
    /** page */
    pageClicked,
    closePageClicked,
    refreshPagenation,
    checkPage,
    /** new */
    newClicked,
    closeNewClicked,
    // topicClicked, contentClicked, memoClicked, uploadClicked,
    onInputChange,
    closenewClicked,
    /** flock */
    flockClicked,
    closeFlockClicked,
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
    const fmt = String((resource && resource.mimeType) || '').toLowerCase();
    const ref = String(
      (resource && (resource.canonicalUri || resource.uri)) || ''
    ).toLowerCase();

    return (
      fmt.indexOf('image/') === 0 ||
      /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/.test(ref)
    );
  };

  function getCurrentOwnerId() {
    return (common && typeof common.getCurrentOwnerId === 'function')
      ? common.getCurrentOwnerId()
      : ((state && state.currentUser && state.currentUser.user_id) || '');
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
    if (common &&
      typeof common.isTemporaryOwnerId === 'function' &&
      common.isTemporaryOwnerId(ownerId) &&
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
    if (!node || node.type !== 'Content') {
      return false;
    }
    resource = getNodeResource(node);

    var fmt = String(resource.mimeType || '').toLowerCase();
    var uri = String(resource.canonicalUri || resource.uri || '').toLowerCase();
    var kind = String(resource.kind || '').toLowerCase();

    return (
      kind === 'video' ||
      fmt.indexOf('video/') === 0 ||
      /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/.test(uri) ||
      isHostedVideoUrl(uri)
    );
  }

  function isLocalTemporaryUser() {
    var ownerId = '';

    if (!(common && typeof common.isLocalHost === 'function' && common.isLocalHost())) {
      return false;
    }

    if (util && typeof util.getCurrentUserId === 'function') {
      ownerId = util.getCurrentUserId();
    }
    if (!ownerId && common && typeof common.getCurrentOwnerId === 'function') {
      ownerId = common.getCurrentOwnerId();
    }

    return !state.loggedIn || (
      common &&
      typeof common.isTemporaryOwnerId === 'function' &&
      common.isTemporaryOwnerId(ownerId)
    );
  }

  function getResourceFilesForMenu(resource) {
    var storage = resource && resource.storage;
    return (storage && Array.isArray(storage.files)) ? storage.files : [];
  }

  function getResourceOriginalPathForMenu(resource) {
    var files = getResourceFilesForMenu(resource);
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
        resource.uri ||
        (resource.snapshotSources && resource.snapshotSources.originalUri)
      )) || ''
    ).trim();
  }

  function isUploadBackedResource(resource) {
    var files = getResourceFilesForMenu(resource);
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
        resource.uri ||
        (resource.snapshotSources && resource.snapshotSources.originalUri)
      )) || ''
    ).replace(/\\/g, '/');
    return /^(?:upload\/|\d{4}\/\d{2}\/\d{2}\/)/.test(text) ||
      /[?&]area=upload(?:&|$)/.test(text);
  }

  function isOfficeResourceForMenu(resource) {
    var fmt = String((resource && resource.mimeType) || '').toLowerCase();
    var kind = String((resource && resource.kind) || '').toLowerCase();
    var ref = getResourceOriginalPathForMenu(resource).toLowerCase();

    return (
      kind === 'office' ||
      (util && typeof util.isOfficeDocument === 'function' && util.isOfficeDocument(fmt)) ||
      /\.(doc|docx|xls|xlsx|ppt|pptx)(\?|#|$)/.test(ref)
    );
  }

  function isUploadBackedContent(allNodes) {
    var target = getContextTarget(allNodes);
    var resource;

    if (!target || target.type !== 'Content') {
      return false;
    }
    if (target.option === 'upload') {
      return true;
    }

    resource = getNodeResource(target);
    return isUploadBackedResource(resource);
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
    if (graph.mode === 'simulation' && draw && typeof draw.restart === 'function') {
      draw.restart();
    }
    else if (draw && typeof draw.reRender === 'function') {
      draw.reRender();
    }
    else if (draw && typeof draw.refresh === 'function') {
      draw.refresh();
    }
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
    if (wuwei.menu.timeline && typeof wuwei.menu.timeline.isTimelinePoint === 'function') {
      return !!wuwei.menu.timeline.isTimelinePoint(node);
    }
    return ('Segment' === node.type) || ('Topic' === node.type && 'timeline-point' === node.topicKind);
  }

  function isTimelineAxisLinkForMenu(link) {
    if (!link) {
      return false;
    }
    if (wuwei.menu.timeline && typeof wuwei.menu.timeline.isTimelineAxisLink === 'function') {
      return !!wuwei.menu.timeline.isTimelineAxisLink(link);
    }
    return !!(
      link &&
      link.type === 'Link' &&
      (
        link.groupType === 'timelineAxis' ||
        link.linkType === 'timeline-axis'
      )
    );
  }

  function getTimelineTargetSpecForMenu(target) {
    if (!target) {
      return null;
    }
    return wuwei.menu.timeline.getTimelineTargetSpec(target);
  }

  function isTimelineInfoTarget(node, link) {
    return !!(
      (node && getTimelineTargetSpecForMenu(node)) ||
      (link && getTimelineTargetSpecForMenu(link))
    );
  }

  function isTimelinePlayableTarget(node) {
    return !!getTimelineTargetSpecForMenu(node);
  }

  function buildTimelineMediaNodeForOpen(spec) {
    var mediaNode;

    if (!spec || !spec.mediaNode) {
      return null;
    }

    mediaNode = util.clone ? util.clone(spec.mediaNode) : Object.assign({}, spec.mediaNode);
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

  function openTimelineSpecInPlayer(spec) {
    var mediaNode = buildTimelineMediaNodeForOpen(spec);
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
      if (window.wuwei && wuwei.video && typeof wuwei.video.open === 'function') {
        opened = wuwei.video.open(mediaNode, option);
        return opened !== false;
      }

      if (window.wuwei && wuwei.info && wuwei.info.video && typeof wuwei.info.video.openModal === 'function') {
        opened = wuwei.info.video.openModal(mediaNode, option);
        return opened !== false;
      }
    }
    catch (e) {
      console.error(e);
      return false;
    }

    console.warn('Video player is not available');
    return false;
  }

  function buildTimelineOpenUrl(spec) {
    var mediaNode, resource, rawUrl, startAt, endAt, m, hash;
    if (!spec || !spec.mediaNode) {
      return '';
    }
    mediaNode = spec.mediaNode;
    resource = (mediaNode.resource && typeof mediaNode.resource === 'object') ? mediaNode.resource : {};
    rawUrl = String(resource.canonicalUri || resource.uri || '');
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
        m = u.pathname.match(/\/(?:video\/)?([0-9]+)/);
        if (m) { id = m[1]; }
      } catch (e) {
        m = rawUrl.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
        if (m) { id = m[1]; }
      }
      if (id) {
        hash = startAt > 0 ? ('#t=' + Math.floor(startAt) + 's') : '';
        return 'https://player.vimeo.com/video/' + encodeURIComponent(id) + (h ? ('?h=' + encodeURIComponent(h)) : '') + hash;
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
    window.open(url, 'timelineVideo', 'width=900,height=680,noopener,resizable=yes,scrollbars=yes');
    return true;
  }

  function getTimelineEditSpec(target) {
    if (util.isEmpty(target) || state.Selecting || state.Connecting) {
      return null;
    }
    return getTimelineTargetSpecForMenu(target);
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

        const menu = d3.select('#ContextMenu');
        const sel = d3.select('#MenuSEL');
        const cmnd = d3.select('#MenuCMND');
        const edit = d3.select('#MenuEDIT');
        const info = d3.select('#MenuINFO');
        const hovered = d3.select('#Hovered');
        const selected = d3.select('#Selected');

        menu.classed('collapsed', false);
        sel.classed('collapsed', true);
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
        const groupIdFromNode = (node && node.groupType === 'simple' && node.groupRef) ? node.groupRef : null;
        const groupIdFromLink = (link && link.groupRef && (link.groupType === 'horizontal' || link.groupType === 'vertical' || link.groupType === 'timelineAxis')) ? link.groupRef : null;
        const selectableGroupId = groupIdFromNode || groupIdFromLink || null;
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
                      draw.reRender();
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
                }
                restartCurrentDraw();
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
          if (!(getTimelineTargetSpecForMenu(node || link))) {
            bindSubmenuHover('#contextEDIT', 'EDIT', 500);
          }
        }

        if (!state.Connecting && !state.Selecting) {
          var hasNormalInfoTarget = !!(
            node &&
            (
              (node.type === 'Topic' && node.description) ||
              node.type === 'Content' ||
              node.type === 'Annotation' ||
              node.type === 'Citation' ||
              node.type === 'Memo'
            )
          );
          var hasTimelineInfoTarget = isTimelineInfoTarget(node, link);
          if (hasNormalInfoTarget || hasTimelineInfoTarget) {
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
    const fmt = String((resource && resource.mimeType) || '').toLowerCase();
    const uri = String((resource && (resource.canonicalUri || resource.uri)) || '').toLowerCase();
    return (
      fmt.indexOf('image/') === 0 ||
      /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/.test(uri)
    );
  }


  function downloadNode(nodeId) {
    if (graph.mode === 'view' || state.viewOnly || state.published) {
      return false;
    }
    const node = wuwei.model.getCurrent
      ? wuwei.model.getCurrent().nodes.find(n => n.id === nodeId)
      : null;

    const url = getDownloadUrl(node);
    if (!url) {
      wuwei.menu.snackbar.open({ type: 'warning', message: 'ダウンロードURLがありません' });
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
    var operator, iconClass, operation;

    allNodes = [hoveredNode];
    var supportedOperations = Operations.getSupported(allNodes, MENU);
    var contextMENU = document.getElementById('context' + MENU);

    /** operators */
    var operators = contextMENU.querySelector('.operators');
    operators.innerHTML = '';

    supportedOperations.forEach(function (supportedOperation) {
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
        operation = supportedOperation[0];
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

        const raw = button.dataset && button.dataset.value;
        const pp = Number(raw);

        if (!Number.isFinite(pp)) {
          thumbnail.innerHTML = '';
          thumbnail.style.display = 'none';
          return false;
        }

        const pages = Array.isArray(current.pages) ? current.pages : [];
        const page = pages[pp - 1] || pages.find(function (item) { return Number(item && item.pp) === pp; });
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
            iconHtml = (wuwei.note && typeof wuwei.note.buildPageThumbnail === 'function')
              ? wuwei.note.buildPageThumbnail(page)
              : util.buildMiniatureSvgString({
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
    const pageNos = pages.map(function (page, index) {
      page.pp = index + 1;
      return page.pp;
    });

    const total = pageNos.length;
    const paginationEl = document.getElementById('Pagination');

    if (!paginationEl) {
      return;
    }

    if (total < 2) {
      let pagination = document.querySelector('#Pagination .pagination');
      if (pagination) {
        pagination.innerHTML = '';
      }
      paginationEl.style.display = 'none';
      return;
    }

    paginationEl.style.left = '1rem';

    let count = 1,
      per_page = 5;

    const activePage = pages.find(function (page) { return page && page.id === current.currentPage; }) || current.page || pages[0];
    const currentPP = Number((activePage && activePage.pp) || pageNos[0]);
    const currentIndex = Math.max(0, pageNos.indexOf(currentPP));
    const current_page = 1 + Math.floor(currentIndex / per_page);

    const records = pageNos.map(pp => ({
      name: pp,
      value: pp
    }));

    wuwei.menu.pagination.create(
      'Pagination',
      current_page,
      count,
      per_page,
      total,
      function (pp) {
        note.openPage(+pp);
        restartCurrentDraw();

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
    var href = (resource && (resource.canonicalUri || resource.uri)) || '';
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
  };

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

  function extensionFromMimeType(mimeType) {
    var mime = String(mimeType || '').toLowerCase();
    if (mime === 'application/pdf') { return '.pdf'; }
    if (mime.indexOf('wordprocessingml.document') >= 0) { return '.docx'; }
    if (mime.indexOf('spreadsheetml.sheet') >= 0) { return '.xlsx'; }
    if (mime.indexOf('presentationml.presentation') >= 0) { return '.pptx'; }
    if (mime === 'application/msword') { return '.doc'; }
    if (mime === 'application/vnd.ms-excel') { return '.xls'; }
    if (mime === 'application/vnd.ms-powerpoint') { return '.ppt'; }
    if (mime.indexOf('image/jpeg') === 0) { return '.jpg'; }
    if (mime.indexOf('image/png') === 0) { return '.png'; }
    if (mime.indexOf('text/plain') === 0) { return '.txt'; }
    return '';
  }

  function getDownloadFilename(node, href) {
    var resource = node ? getNodeResource(node) : null;
    var file = null;
    var identity = (resource && resource.identity) || {};
    var candidates = [];
    var fallback = '';
    var ext = '';

    if (resource && wuwei.util && typeof wuwei.util.getResourceFile === 'function') {
      file = wuwei.util.getResourceFile(resource, 'original');
    }
    if (file) {
      candidates.push(file.path, file.sourcePath, file.uri, file.url);
    }
    candidates.push(
      href,
      resource && resource.title,
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

    fallback = fallback || String((resource && resource.title) || identity.title || (node && node.label) || 'download');
    ext = extensionFromMimeType((file && file.mimeType) || (resource && resource.mimeType) || '');
    return hasFileExtension(fallback) ? fallback : fallback + ext;
  }

  getDownloadUrl = function (node) {
    var resource = getNodeResource(node);
    var href = '';
    var base;

    if (resource && wuwei.util && typeof wuwei.util.getResourceFileUri === 'function') {
      href = wuwei.util.getResourceFileUri(resource, 'original', node);
    }
    if (!href) {
      href = (resource && (resource.canonicalUri || resource.uri)) || '';
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
    state.selectedGroupIds = [];
    d3.selectAll('g.node.selected circle.selected').remove();
    d3.selectAll('g.node.selected')
      .each(function () {
        d3.select(this).classed('selected', false);
      });
  }

  function getScreenSelectedNodes(fallbackNodes) {
    var page = getCurrentPage();
    var selectedIds = [];
    var nodes = [];
    var seen = {};

    d3.selectAll('g.node.selected').each(function () {
      var nodeId = this && this.id;
      var node;
      if (!nodeId) {
        return;
      }
      node = model.findNodeById(nodeId);
      if (node && !seen[node.id]) {
        seen[node.id] = true;
        nodes.push(node);
      }
    });

    if (nodes.length > 0) {
      return nodes;
    }

    if (Array.isArray(fallbackNodes)) {
      fallbackNodes.forEach(function (n) {
        if (n && n.id && !seen[n.id]) {
          seen[n.id] = true;
          nodes.push(n);
        }
      });
    }

    return nodes;
  }

  function getEffectiveSelectedGroupIds(page) {
    var selectedGroupIds = Array.isArray(state.selectedGroupIds) ? state.selectedGroupIds.slice() : [];
    return selectedGroupIds.filter(function (gid, index, arr) {
      var group = model.findGroupById(gid);
      return arr.indexOf(gid) === index && !!group && ['simple', 'horizontal', 'vertical', 'timeline'].includes(group.type);
    });
  }

  function definePersistentGroup(kind, selectedNodes) {
    var page = getCurrentPage();
    var nodes;
    var requestedNodeIds;

    // ContextOperate() から渡された selectedNodes を先に id 化して保持する。
    // syncPageFromGraph() の前後で node object 自体は差し替わり得るため、
    // 以後の member 解決は object 参照ではなく node id を正本にする。
    requestedNodeIds = Array.isArray(selectedNodes)
      ? selectedNodes
        .filter(function (n) { return n && !n.pseudo && n.id; })
        .map(function (n) { return n.id; })
      : [];

    // 画面上で作成済みだが未同期の real node を先に page.nodes へ戻す。
    // group 定義時に setGraphFromCurrentPage() が走るため、ここで同期しないと
    // 直前に追加した Topic / Content が page 正本に無く、消えたように見える。
    model.syncPageFromGraph();
    page = getCurrentPage();

    var isHorizontal = ('topicGroupHorizontal' === kind);
    var isVertical = ('topicGroupVertical' === kind);
    var selectedGroupIds;
    var selectedGroups, preserveGroup, preserveMetaGroup, nameBase, memberMap, existingItemByNodeId, members, avg, group, selectedNodeIds;

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
        if (resolved && !resolved.pseudo && !nodes.some(function (n) { return n && n.id === resolved.id; })) {
          nodes.push(resolved);
        }
      });
    }

    // 実 node が選択されている時は、その node 群を最優先して新 group を作る。
    // 以前に選択した group overlay の state.selectedGroupIds が残っていても、
    // node ベースの新規 group 定義を邪魔しないようにここでは無視する。
    selectedGroupIds = (nodes.length > 0) ? [] : getEffectiveSelectedGroupIds(page);
    selectedGroups = selectedGroupIds
      .map(function (gid) { return model.findGroupById(gid); })
      .filter(Boolean);
    preserveMetaGroup = (selectedGroups.length > 0) ? selectedGroups[0] : null;
    preserveGroup = (1 === selectedGroups.length) ? selectedGroups[0] : null;
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
        var nodeId = (typeof member === 'string') ? member : (member && member.nodeId);
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

    if (isHorizontal) {
      avg = members.reduce(function (sum, n) { return sum + n.y; }, 0) / members.length;
      members.forEach(function (n) { n.y = avg; });
      members.sort(function (a, b) { return a.x - b.x; });
    }
    else if (isVertical) {
      avg = members.reduce(function (sum, n) { return sum + n.x; }, 0) / members.length;
      members.forEach(function (n) { n.x = avg; });
      members.sort(function (a, b) { return a.y - b.y; });
    }

    nameBase = (isHorizontal || isVertical) ? 'Topic Group' : 'Simple Group';
    group = model.createGroup({
      id: preserveGroup ? preserveGroup.id : undefined,
      name: (preserveMetaGroup && preserveMetaGroup.name && 1 === selectedGroups.length) ? preserveMetaGroup.name : (nameBase + ' ' + (page.groups.length + 1)),
      type: isHorizontal ? 'horizontal' : (isVertical ? 'vertical' : 'simple'),
      enabled: preserveMetaGroup ? (false !== preserveMetaGroup.enabled) : true,
      moveTogether: preserveMetaGroup ? (false !== preserveMetaGroup.moveTogether) : true,
      orientation: isHorizontal ? 'horizontal' : (isVertical ? 'vertical' : 'auto'),
      spine: (isHorizontal || isVertical)
        ? {
          visible: true,
          color: (preserveMetaGroup && preserveMetaGroup.spine && preserveMetaGroup.spine.color) || '#888888',
          width: (preserveMetaGroup && preserveMetaGroup.spine && preserveMetaGroup.spine.width) || 6,
          padding: (preserveMetaGroup && preserveMetaGroup.spine && preserveMetaGroup.spine.padding) || 12
        }
        : {
          visible: false,
          color: (preserveMetaGroup && preserveMetaGroup.spine && preserveMetaGroup.spine.color) || '#888888',
          width: (preserveMetaGroup && preserveMetaGroup.spine && preserveMetaGroup.spine.width) || 6,
          padding: (preserveMetaGroup && preserveMetaGroup.spine && preserveMetaGroup.spine.padding) || 12
        },
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
    clearSelectionState();
    closeContextMenu();
    draw.reRender();
    return group;
  }



  ContextOperate = function (method) {
    var nodes = [],
      links = [];
    const current = wuwei.common.current;

    function updateClipboardMenu(method) {
      if (!['clipboard', 'paste', 'clone'].includes(method)) {
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
      else if (['paste', 'clone'].includes(method)) {
        state.copyingNodes = null;
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

    function halfW_(d) {
      if (!d || !d.size) {
        return null;
      }
      return d.size.radius || d.size.width / 2;
    }

    function halfH_(d) {
      if (!d || !d.size) {
        return null;
      }
      return d.size.radius || d.size.height / 2;
    }

    if ('edit-flock' === method && state.Selecting) {
      wuwei.edit.open(null, { flock: true });
      return;
    }
    else if ('edit' === method) {
      node = resolveContextTargetRecord(state.hoveredNode);
      if (!node || !node.id) { return; }

      var timelineSpecForEdit = getTimelineTargetSpecForMenu(node);
      var timelineEditTarget = timelineSpecForEdit
        ? (timelineSpecForEdit.point || timelineSpecForEdit.group || node)
        : null;

      if (timelineEditTarget) {
        wuwei.edit.open(timelineEditTarget, { editor: false, citation: false, cc: false });
        closeContextMenu();
        return;
      }

      if (util.isNode(node)) {
        if ('Topic' === node.type) {
          wuwei.edit.open(node, { editor: false, citation: false, cc: false });
        }
        else {
          wuwei.edit.open(node);
        }
      }
      else if (util.isLink(node)) {
        link = node;
        wuwei.edit.open(link, { editor: false, citation: false, cc: false });
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
    else if ('editTimelineAxisProps' === method) {
      node = resolveContextTargetRecord(state.hoveredNode);
      if (!node) { return; }

      var axisSpec = getTimelineTargetSpecForMenu(node);
      if (!axisSpec || !axisSpec.group) {
        closeContextMenu();
        return;
      }

      wuwei.edit.timeline.openAxisProperties(axisSpec.group);

      closeContextMenu();
      return;
    }
    else if ('addTimelineSegmentFromPlayer' === method) {
      node = resolveContextTargetRecord(state.hoveredNode);
      if (!node) { return; }

      var addSpec = getTimelineTargetSpecForMenu(node);
      if (!addSpec || !addSpec.group) {
        closeContextMenu();
        return;
      }

      wuwei.edit.timeline.openAddSegmentFromPlayer(addSpec.group);

      closeContextMenu();
      return;
    }
    else if ('editTimelineSegmentProps' === method) {
      node = resolveContextTargetRecord(state.hoveredNode);
      if (!node) { return; }

      var segSpec = getTimelineTargetSpecForMenu(node);
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

      var playSpec = getTimelineTargetSpecForMenu(node);
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

      var delSpec = getTimelineTargetSpecForMenu(node);
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
    else if ('info' === method) {
      node = resolveContextTargetRecord(state.hoveredNode);
      if (!node || !node.id) { return; }
      wuwei.info.open(node);
      closeContextMenu();
      return;
    }
    else if ('infoTimelineSegment' === method) {
      node = resolveContextTargetRecord(state.hoveredNode);
      if (!node || !node.id) { return; }
      var timelineSpecForInfo = getTimelineTargetSpecForMenu(node);
      var timelineInfoTarget = timelineSpecForInfo
        ? (timelineSpecForInfo.point || timelineSpecForInfo.group || node)
        : null;
      if (timelineInfoTarget) {

        wuwei.info.timeline.open(timelineInfoTarget);

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

      var timelineSpec = getTimelineTargetSpecForMenu(node);
      var opened = false;

      try {
        if (timelineSpec) {
          opened = openTimelineSpecInPlayer(timelineSpec);
          if (!opened) {
            openPlayerError('Video player could not be opened.');
          }
          closeContextMenu();
          return;
        }

        if (window.wuwei && wuwei.video && typeof wuwei.video.open === 'function') {
          opened = wuwei.video.open(node, {});
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

      var timelineSpecForWindow = getTimelineTargetSpecForMenu(node);
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

      var timelineSpecForTab = getTimelineTargetSpecForMenu(node);
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

      var horizontalSpec = getTimelineTargetSpecForMenu(node);
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

      var verticalSpec = getTimelineTargetSpecForMenu(node);
      if (verticalSpec && verticalSpec.group) {
        wuwei.timeline.updateAxisGroup(verticalSpec.group, {
          orientation: 'vertical'
        });
        closeContextMenu();
        return;
      }
    }
    else if (['alignTop', 'alignHorizontal', 'alignBottom', 'alignLeft', 'alignVertical',
      'alignRight', 'horizontalEqual', 'verticalEqual', 'clipboard', 'paste', 'clone',
      'defineSimpleGroup', 'defineHorizontalGroup', 'defineVerticalGroup', 'ungroup'].includes(method) ||
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
      else if (['paste', 'clone'].includes(method)) {
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
            allNodes.push(d);
            count++;
            halfW = halfW_(d);
            halfH = halfH_(d);
            if (d.x - halfW < xMin) { xMin = d.x - halfW; LeftNode = d; }
            if (d.x + halfW > xMax) { xMax = d.x + halfW; RightNode = d; }
            if (d.y - halfH < yMin) { yMin = d.y - halfH; TopNode = d; }
            if (d.y + halfH > yMax) { yMax = d.y + halfH; BottomNode = d; }
            xSum += d.x;
            ySum += d.y;
          });
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
                var nodeId = (typeof member === 'string') ? member : (member && member.nodeId);
                return nodeId && selectedIds.indexOf(nodeId) < 0;
              });
            });
          }
          page.groups = page.groups.filter(function (g) {
            return g && Array.isArray(g.members) && g.members.length >= 2;
          });
        }
        model.setGraphFromCurrentPage();
        clearSelectionState();
        closeContextMenu();
        draw.reRender();
        logData = { command: method, param: { node: allNodes } };
      }
      else if (['clipboard', 'copy', 'paste', 'clone'].includes(method)) {
        logData = model[method](allNodes);
      }
      else {
        if ('alignTop' === method) {
          for (var node of allNodes) {
            node.y = yMin + (node.size.radius || node.size.height / 2);
          }
        }
        else if ('alignHorizontal' === method) {
          var midY = ySum / count;
          for (var node of allNodes) {
            node.y = midY;
          }
        }
        else if ('alignBottom' === method) {
          for (var node of allNodes) {
            node.y = yMax - (node.size.radius || node.size.height / 2);
          }
        }
        else if ('alignLeft' === method) {
          for (var node of allNodes) {
            node.x = xMin + (node.size.radius || node.size.width / 2);
          }
        }
        else if ('alignVertical' === method) {
          var centerX = xSum / count;
          for (var node of allNodes) {
            node.x = centerX;
          }
        }
        else if ('alignRight' === method) {
          for (var node of allNodes) {
            node.x = xMax - (node.size.radius || node.size.width / 2);
          }
        }
        else if ('horizontalEqual' === method) {
          let diff = (xMax - halfW_(RightNode)) - (xMin + halfW_(LeftNode));
          diff = diff / (count - 1);
          allNodes = allNodes.sort(function (a, b) {
            return a.x - b.x;
          });
          for (let i = 1; i < allNodes.length - 1; i++) {
            let node = allNodes[i];
            node.x = xMin + halfW_(LeftNode) + diff * i;
          }
        }
        else if ('verticalEqual' === method) {
          let diff = (yMax - halfH_(BottomNode)) - (yMin + halfH_(TopNode));
          diff = diff / (count - 1);
          allNodes = allNodes.sort(function (a, b) {
            return a.y - b.y;
          });
          for (let i = 1; i < allNodes.length - 1; i++) {
            let node = allNodes[i];
            node.y = yMin + halfH_(TopNode) + diff * i;
          }
        }
        // logData = { command: method, param: { node: allNodes } };
      }
      log.storeLog({ operation: method });

      state.hoveredNode = undefined;
      draw.reRender();

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
        draw.reRender();
        if (note && typeof note.updatePageThumbnail === 'function') {
          note.updatePageThumbnail();
        }
        refreshPagenation();
      }
      else if ('newPage' === method) {
        note.newPage();
        updateResetview('reset');
        draw.reRender();
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

      current = common.current;
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

          draw.reRender();
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
      keepSelecting = ('flockMenu' === menuId || 'timelineMenu' === menuId),
      i, len = pulldown.length;
    state.hoveredNode = null;

    draw.reRender();

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
        state.selectedGroupIds = [];
      }
    }
    else {
      menu.style.display = 'none';
      if ('flockMenu' === menuId) {
        closeFlockClicked();
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
      filterIcon = document.getElementById('filterIcon'),
      drawMode = document.getElementById('draw_mode'),
      setting = document.getElementById('setting');
    // shareMode = document.getElementById('share_mode');
    if (headingMenu.classList.contains('active')) {
      headingMenu.classList.remove('active');
      searchIcon.classList.remove('active');
      filterIcon.classList.remove('active');
      drawMode.classList.remove('active');
      setting.classList.remove('active');
      // shareMode.style.display = 'none';
      wuwei.home.toggleHome();
      // location.replace("https://www.sambuichi.jp/");
    }
    else {
      headingMenu.classList.add('active');
      searchIcon.classList.add('active');
      filterIcon.classList.add('active');
      drawMode.classList.add('active');
      setting.classList.add('active');
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
    const publishEl = menu.querySelector('.operators .operator.Publish');
    const hasContent = currentPageHasContent();
    const canModifyContent = !(state.viewOnly || state.published || !hasContent);
    if (saveEl) {
      saveEl.style.display = canModifyContent ? '' : 'none';
    }
    if (downloadEl) {
      downloadEl.style.display = canModifyContent ? '' : 'none';
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

  function closeNoteMenu() {
    var menu = document.getElementById('noteMenu');
    menu.style.display = 'none';
  }

  closeNoteClicked = function () {
    closeNoteMenu();
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
  newClicked = function () {
    var menu = document.getElementById('newMenu');
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

  closenewClicked = function () {
    var menu = document.getElementById('newMenu');
    menu.setAttribute('style', 'display: none;');
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
    draw.reRender();
    return false;
  };

  /** timeline */
/*  timelineClicked = function () {
    state.Selecting = true;
    const menu = document.getElementById('timelineMenu');
    menuOpen(menu);
    return false;
  };

  closeTimelineClicked = function () {
    state.Selecting = false;
    var menu = document.getElementById('timelineMenu');
    if (menu) {
      menu.style.display = 'none';
    }
    closeContextMenu();
    draw.reRender();
    return false;
  };

  timelineCreateAxisClicked = function () {
    var group = wuwei.menu.timeline.createAxisGroup('horizontal');
    if (!group) {
      window.alert('video Content を 1 つ選択してください。');
      return false;
    }
    closeTimelineClicked();
    return false;
  };

  timelineAddPointClicked = function () {
    var point = wuwei.menu.timeline.addTimePoint();
    if (!point) {
      window.alert('axis group またはその時刻点を選択してください。');
      return false;
    }
    closeTimelineClicked();
    return false;
  };

  timelineEditPointClicked = function () {
    var opened = wuwei.menu.timeline.editSelected();
    if (!opened) {
      window.alert('axis group または時刻点を 1 つ選択してください。');
      return false;
    }

    closeTimelineClicked();
    return false;
  };

  timelineDeletePointClicked = function () {
    var deleted = wuwei.menu.timeline.deleteSelectedPoint();
    if (!deleted) {
      window.alert('削除できる時刻点を 1 つ選択してください。');
      return false;
    }
    closeTimelineClicked();
    return false;
  };
*/
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
  updateResetview = function (zoom) {
    const current = wuwei.common.current;
    const scale = util.getPageTransform(current.page).scale;
    const resetIcon = document.querySelector('.resetview.icon');
    const scaleEl = document.querySelector('.resetview.scale');
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
    draw.reRender();

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
    draw.reRender();

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
    var menu = document.getElementById('menu');
    if (menu.classList.contains('loggedIn')) {
      if (window.confirm(wuwei.nls.translate('Do you want to log out?'))) {
        wuwei.menu.login.logout();
      }
    }
    else {
      wuwei.menu.login.open();
    }
    return false;
  };

  Operations = {
    // operations are defined as 'method', 'display name', 'optional rule', 'style', 'icon'
    type: {
      'Node': [
        'bloom',
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
        'editTimelineAxisProps',
        'addTimelineSegmentFromPlayer',
        'editTimelineSegmentProps',
        'editTimelineSegmentFromPlayer',
        'deleteTimelineSegment',
        'addContent',
        'addTopic',
        'addMemo',
        // 'addTable',
        'copy',
        // 'clipboard',
        // 'mark',
        'erase'
      ],
      'EditLink': [
        'edit',
        'editTimelineAxisProps',
        'addTimelineSegmentFromPlayer',
        'reverse',
        'normal',
        'horizontal',
        'vertical',
        'horizontal2',
        'vertical2',
        'erase'
      ],
      'InfoNode': [
        'info',
        'infoTimelineSegment',
        'download',
        'openNewTab',
        'openWindow',
        'openPlayer'
      ],
      'InfoLink': [
        'infoTimelineSegment'
      ]
    },
    isSupported: function (operation, nodes, context) {
      var operations;
      if (util.isEmpty(nodes)) { return false; }
      for (var i = 0; i < nodes.length; i += 1) {
        if (util.notEmpty(nodes[i])) {
          // INFO operations are read-only; allow them even if not the owner.
          if ('INFO' !== context && !isOwnedByCurrentUser(nodes[i])) { return false; }
          var type = '';
          if ('INFO' === context) {
            if ('Link' === nodes[i].type) { type = 'InfoLink'; }
            else { type = 'InfoNode'; }
          }
          else if ('EDIT' === context) {
            if ('Link' === nodes[i].type) { type = 'EditLink'; }
            else { type = 'EditNode'; }
          }
          else {
            if ('Link' === nodes[i].type) { type = 'Link'; }
            else { type = 'Node'; }
          }
          operations = this.type[type];
          if (util.isEmpty(operations) || !util.contains(operations, operation)) {
            return false;
          }
        }
      }
      return true;
    },
    getSupported: function (allNodes, context) {
      var
        self = this,
        hoveredNode = allNodes[0],
        supportedOperations = [],
        i, len, operation;
      var operations;

      if ('CMND' === context) {
        if ('Link' === hoveredNode.type) { operations = self.type.Link; }
        else { operations = self.type.Node; }
      }
      else if ('EDIT' === context) {
        if ('Link' === hoveredNode.type) { operations = self.type.EditLink; }
        else { operations = self.type.EditNode; }
      }
      else if ('INFO' === context) {
        if ('Link' === hoveredNode.type) { operations = self.type.InfoLink; }
        else { operations = self.type.InfoNode; }
      }

      len = operations.length;
      for (i = 0; i < len; i++) {
        operation = operations[i];
        var _operation = OperationsList[operation];
        if (_operation) {
          var operationList = [];
          operationList[0] = operation;
          operationList[1] = _operation[0];
          operationList[2] = _operation[1];
          operationList[3] = _operation[2] || null;
          operationList[4] = _operation[3] || null;
          if (self.isSupported(operation, allNodes, context)) {
            var validator = operationList[2];
            if (validator) {
              if (validator(allNodes)) {
                supportedOperations.push(operationList);
              }
            }
            else {
              supportedOperations.push(operationList);
            }
          }
        }
      }
      // console.log(supportedOperations);
      return supportedOperations;
    }
  };

  /**
   * Operations
   * key, label, isSupporetdFunc(), style('danger' or null), icon
   */
  function resolveContextTargetRecord(target) {
    if (!target) {
      return null;
    }

    if (target.id) {
      if (util.isLink(target) && model && typeof model.findLinkById === 'function') {
        return model.findLinkById(target.id) || target;
      }
      if (util.isNode(target) && model && typeof model.findNodeById === 'function') {
        return model.findNodeById(target.id) || target;
      }
      if (model) {
        if (typeof model.findNodeById === 'function') {
          var foundNode = model.findNodeById(target.id);
          if (foundNode) {
            return foundNode;
          }
        }
        if (typeof model.findLinkById === 'function') {
          var foundLink = model.findLinkById(target.id);
          if (foundLink) {
            return foundLink;
          }
        }
      }
    }

    return target;
  }

  function getContextTarget(allNodes) {
    if (!Array.isArray(allNodes) || allNodes.length === 0) {
      return null;
    }
    return resolveContextTargetRecord(allNodes[0] || null);
  }

  function getContextTimelineSpec(allNodes) {
    var target = getContextTarget(allNodes);
    if (util.isEmpty(target)) {
      return null;
    }
    return getTimelineTargetSpecForMenu(target);
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
      !getContextTimelineSpec(allNodes)
    );
  }

  function isContextOpenableTarget(allNodes) {
    return (
      isContextRegularContent(allNodes) ||
      isContextTimelinePlayable(allNodes)
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

  function isContextVideoContent(allNodes) {
    var target = getContextTarget(allNodes);
    return !!(
      target &&
      target.type === 'Content' &&
      isPlayableVideoNode(target) &&
      !getContextTimelineSpec(allNodes)
    );
  }

  function isContextTimelinePlayable(allNodes) {
    return !!getContextTimelineSpec(allNodes);
  }

  function hasContextDownloadUrl(allNodes) {
    var node = getContextTarget(allNodes);
    return !!getDownloadUrl(node);
  }

  OperationsList = {
    'info': ['Info',
      function (allNodes) {
        var node = getContextTarget(allNodes);
        if (state.Selecting || state.Connecting || util.isEmpty(node)) {
          return false;
        }

        // timeline segment(start / mid / end) では通常の「情報」は出さない
        if (isContextTimelineSegment(allNodes)) {
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
        return isContextOpenableTarget(allNodes);
      },
      null,
      'fas fa-external-link-alt fa-lg fa-fw'
    ],

    'download': ['Download',
      function (allNodes) {
        var node = getContextTarget(allNodes);
        var fmt, ref, isImageOrPdf, isOffice;

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
        fmt = String(resource.mimeType || '').toLowerCase();
        ref = String(getDownloadUrl(node) || resource.canonicalUri || resource.uri || '').toLowerCase();

        isImageOrPdf =
          0 === fmt.indexOf('image/') ||
          /\.(png|jpe?g|gif|webp|svg|tiff|pdf)(\?|#|$)/.test(ref);

        isOffice =
          0 === fmt.indexOf('application/vnd.openxmlformats-officedocument.wordprocessingml') ||
          0 === fmt.indexOf('application/vnd.openxmlformats-officedocument.spreadsheetml') ||
          0 === fmt.indexOf('application/vnd.openxmlformats-officedocument.presentationml') ||
          0 === fmt.indexOf('application/msword') ||
          0 === fmt.indexOf('application/vnd.ms-excel') ||
          0 === fmt.indexOf('application/vnd.ms-powerpoint') ||
          /\.(doc|docx|xls|xlsx|ppt|pptx)(\?|#|$)/.test(ref);

        return isUploadBackedContent(allNodes) || isImageOrPdf || isOffice;
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

        // timeline axis / segment は個別メニューへ分離
        if (isContextTimelineAxis(allNodes) || isContextTimelineSegment(allNodes)) {
          return false;
        }

        return true;
      },
      null,
      'fas fa-edit fa-lg fa-fw'
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
          !isContextTimelineAxis(allNodes)) {
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
          !isContextTimelineAxis(allNodes)) {
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
          !isContextTimelineAxis(allNodes)) {
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
        return true;
      },
      null,
      'fa fa-clone fa-lg fa-fw'
    ],

    'clipboard': ['Clipboard',
      function (allNodes) {
        var node = getContextTarget(allNodes);
        if (allNodes.length === 1 && util.notEmpty(node)) {
          return true;
        }
        return false;
      },
      null,
      'far fa-clipboard fa-lg fa-fw'
    ],

    'paste': ['Paste',
      function (allNodes) {
        var node = getContextTarget(allNodes);
        if (allNodes.length === 1 && util.notEmpty(node)) {
          return true;
        }
        return false;
      },
      null,
      'fas fa-paste fa-lg fa-fw'
    ],

    'clone': ['Clone',
      function (allNodes) {
        var node = getContextTarget(allNodes);
        if (allNodes.length === 1 && util.notEmpty(node)) {
          return true;
        }
        return false;
      },
      null,
      'fa fa-clone fa-lg fa-fw'
    ],

    'reverse': ['Reverse',
      function (allNodes) {
        if (isContextTimelineAxis(allNodes)) { return false; }
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
        if (isContextTimelineAxis(allNodes)) { return false; }
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
        var node = getContextTarget(allNodes);
        if (allNodes.length === 1 &&
          util.notEmpty(node) &&
          'HORIZONTAL' !== node.shape &&
          !node.copying &&
          'draw' === graph.mode &&
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
        var node = getContextTarget(allNodes);
        if (allNodes.length === 1 &&
          util.notEmpty(node) &&
          'VERTICAL' !== node.shape &&
          'draw' === graph.mode &&
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
        if (isContextTimelineAxis(allNodes)) { return false; }
        var node = getContextTarget(allNodes);
        if (allNodes.length === 1 &&
          util.notEmpty(node) &&
          'HORIZONTAL2' !== node.shape &&
          !node.copying &&
          'draw' === graph.mode &&
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
        if (isContextTimelineAxis(allNodes)) { return false; }
        var node = getContextTarget(allNodes);
        if (allNodes.length === 1 &&
          util.notEmpty(node) &&
          'VERTICAL2' !== node.shape &&
          'draw' === graph.mode &&
          !node.copying &&
          util.isLink(node)) {
          return true;
        }
        return false;
      },
      null,
      'xlink:href="#vertical2"'
    ],

    'erase': ['Erase',
      function (allNodes) {
        var node = getContextTarget(allNodes);
        if (node.copying ||
          util.isEmpty(node) ||
          (allNodes.length === 1 && util.notEmpty(node) && node.copying)) {
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
      'fa fa-book fa-lg fa-fw'
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

    'timemachine': ['Timemachine',
      function () {
        if (state.loggedIn &&
          current.note_id &&
          util.notEmpty(current.note_name) &&
          util.notEmpty(util.getNoteOwnerUserId(current)) &&
          auth.currentUser &&
          util.getNoteOwnerUserId(current) === (auth.currentUser.user_id || auth.currentUser._id)) {
          return true;
        }
        return false;
      },
      null,
      'fa fa-history fa-lg fa-fw'
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

    'createTimelineAxis': ['Create timeline axis',
      function (allNodes) {
        return !state.Selecting &&
          !state.Connecting &&
          isContextVideoContent(allNodes);
      },
      null,
      'fas fa-stream fa-lg fa-fw'
    ],

    'editTimelineAxisProps': ['Axis properties',
      function (allNodes) {
        return !state.Selecting &&
          !state.Connecting &&
          isContextTimelineAxis(allNodes);
      },
      null,
      'fas fa-ruler-horizontal fa-lg fa-fw'
    ],

    'addTimelineSegmentFromPlayer': ['Add segment from player',
      function (allNodes) {
        return !state.Selecting &&
          !state.Connecting &&
          isContextTimelineAxis(allNodes);
      },
      null,
      'fas fa-plus-circle fa-lg fa-fw'
    ],

    'editTimelineSegmentProps': ['Segment properties',
      function (allNodes) {
        return !state.Selecting &&
          !state.Connecting &&
          isContextTimelineSegment(allNodes);
      },
      null,
      'fas fa-map-marker-alt fa-lg fa-fw'
    ],

    'editTimelineSegmentFromPlayer': ['Edit segment from player',
      function (allNodes) {
        return !state.Selecting &&
          !state.Connecting &&
          isContextTimelineMidSegment(allNodes);
      },
      null,
      'fas fa-play-circle fa-lg fa-fw'
    ],

    'deleteTimelineSegment': ['Delete segment',
      function (allNodes) {
        return !state.Selecting &&
          !state.Connecting &&
          isContextTimelineMidSegment(allNodes);
      },
      'danger',
      'far fa-trash-alt fa-lg fa-fw'
    ],

    'infoTimelineSegment': ['Info Timeline Segment',
      function (allNodes) {
        return !state.Selecting &&
          !state.Connecting && (
            isContextTimelineAxis(allNodes) ||
            isContextTimelineSegment(allNodes));
      },
      null,
      'fas fa-info fa-lg fa-fw'
    ]
  };

  drawmodeClicked = function () {
    drawmode_n = ++drawmode_n % 3;
    drawmode = state.Drawmode[drawmode_n];
    drawmodeIcon.classList.remove('draw');
    drawmodeIcon.classList.remove('simulation');
    drawmodeIcon.classList.add(`${drawmode}`);
    menuDiv.classList.remove('draw');
    menuDiv.classList.remove('simulation');
    menuDiv.classList.add(`${drawmode}`);
    graph.mode = drawmode;
    switch (drawmode) {
      case 'draw':
        drawIcon.setAttribute('class', 'fas fa-pencil-ruler');
        heading_menu.classList.add('active');
        searchIcon.classList.remove('simulation');
        filterIcon.classList.remove('simulation');
        settinIgcon.style.display = 'none';
        // shareIcon.style.display = 'block';
        wuwei.menu.setting.close();
        if (draw && typeof draw.refresh === 'function') {
          draw.refresh();
        }
        break;
      case 'view':
        drawIcon.setAttribute('class', 'far fa-square');
        heading_menu.classList.remove('active');
        searchIcon.classList.remove('simulation');
        filterIcon.classList.remove('simulation');
        settinIgcon.style.display = 'none';
        // shareIcon.style.display = 'none';
        if (draw && typeof draw.refresh === 'function') {
          draw.refresh();
        }
        break;
      case 'simulation':
        drawIcon.setAttribute('class', 'fas fa-expand-arrows-alt');
        heading_menu.classList.add('active');
        searchIcon.classList.add('simulation');
        filterIcon.classList.add('simulation');
        settinIgcon.style.display = 'block';
        // shareIcon.style.display = 'none';
        if (draw && typeof draw.restart === 'function') {
          draw.restart();
        }
        break;
    }
    filterIcon.style.display = 'none';
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
    filterIcon = document.getElementById('filterIcon');
    open_controls = document.getElementById('open_controls');
    controls = document.getElementById('controls');
    drawmode_n = 0;
    drawmode = state.Drawmode[drawmode_n];

    filterIcon.style.display = 'none';

    // 初期表示ではメニューを閉じた状態（hamburger だけ）にする
    if (heading_menu) {
      heading_menu.classList.remove('active');
    }

    if (controls) { // hide
      open_controls.innerHTML = '<span>&#9650</span>';
      controls.classList.add('hidden');
      controls.style.display = 'none';
    }

    drawmodeIcon.className = `${drawmode}`;
    graph.mode = drawmode;
    drawIcon.setAttribute('class', 'fas fa-pencil-ruler');
    settinIgcon.style.display = 'none';
    // shareIcon.style.display = 'none';

    settinIgcon.addEventListener('click', function (e) {
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

    registerClick('#open_controls', openControlsClicked);
    registerClick('#draw_mode', drawmodeClicked);
    registerClick('#zoomin', zoomInClicked);
    registerClick('.resetview.icon', resetViewClicked);
    registerClick('.resetview.scale', resetViewClicked);
    registerClick('#zoomout', zoomOutClicked);
    registerClick('#open_miniature', openMiniatureClicked);
    registerClick('#user_status', userStatusClicked);
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
      draw.reRender();
    });
    registerClick('.pulldown.note .operators .operator.Open', () => {
      wuwei.menu.note.list();
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
    // flockIcon
    registerClick('#flockIcon', flockClicked);
    registerClick('.pulldown.flock .header i.fa-times', closeFlockClicked);
    registerClick('.pulldown.flock .operators .operator.DeselectFlock', () => {
      d3.selectAll('g.node.selected circle.selected').remove();
      d3.selectAll('g.node.selected').nodes().map(node => {
        d3.select(node).classed('selected', false);
      });
      common.state.selectedGroupIds = [];
      draw.reRender();
    });
    registerClick('.pulldown.flock .operators .operator.AlignTop', () => {
      ContextOperate('alignTop');
    });
    registerClick('.pulldown.flock .operators .operator.AlignHorizontal', () => {
      ContextOperate('alignHorizontal');
    });
    registerClick('.pulldown.flock .operators .operator.AlignBottom', () => {
      ContextOperate('alignBottom');
    });
    registerClick('.pulldown.flock .operators .operator.AlignLeft', () => {
      ContextOperate('alignLeft');
    });
    registerClick('.pulldown.flock .operators .operator.AlignVertical', () => {
      ContextOperate('alignVertical');
    });
    registerClick('.pulldown.flock .operators .operator.AlignRight', () => {
      ContextOperate('alignRight');
    });
    registerClick('.pulldown.flock .operators .operator.HorizontalEqual', () => {
      ContextOperate('horizontalEqual');
    });
    registerClick('.pulldown.flock .operators .operator.VerticalEqual', () => {
      ContextOperate('verticalEqual');
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
    registerClick('.pulldown.flock .operators .operator.Copy', () => {
      ContextOperate('copy');
    });
    registerClick('.pulldown.flock .operators .operator.Clipboard', () => {
      ContextOperate('clipboard');
    });
    registerClick('.pulldown.flock .operators .operator.Paste', () => {
      ContextOperate('paste');
    });
    registerClick('.pulldown.flock .operators .operator.clone', () => {
      ContextOperate('clone');
    });
    registerClick('.pulldown.flock .operators .operator.Edit', () => {
      ContextOperate('edit-flock');
    });
    // filterIcon
    registerClick('#filterIcon', filterClicked);
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
    if (wuwei.menu.upload && typeof wuwei.menu.upload.initModule === 'function') {
      wuwei.menu.upload.initModule();
    }
    if (wuwei.menu.video && typeof wuwei.menu.video.initModule === 'function') {
      wuwei.menu.video.initModule();
    }
  };

  /** context menu */
  ns.OperationsList = OperationsList;
  ns.openContextMenu = openContextMenu;
  ns.closeContextMenu = closeContextMenu;
  ns.closeContext = closeContext;
  ns.ContextMENU = ContextMENU;
  ns.ContextCMND = ContextCMND;
  ns.ContextEDIT = ContextEDIT;
  ns.ContextINFO = ContextINFO;
  ns.ContextOperate = ContextOperate;
  ns.contextUpdatePosition = contextUpdatePosition;
  /** note */
  ns.noteClicked = noteClicked;
  ns.closeNoteClicked = closeNoteClicked;
  /** page */
  ns.pageClicked = pageClicked;
  ns.closePageClicked = closePageClicked;
  ns.refreshPagenation = refreshPagenation;
  ns.checkPage = checkPage;
  ns.registerPagebuttonEvent = registerPagebuttonEvent;
  /** new */
  ns.newClicked = newClicked;
  ns.closeNewClicked = closeNewClicked;
  ns.closenewClicked = closenewClicked;
  /** flock */
  ns.flockClicked = flockClicked;
  ns.closeFlockClicked = closeFlockClicked;
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
  // playPauseClicked: playPauseClicked,
  ns.updateUndoRedoButton = updateUndoRedoButton;
  ns.undoClicked = undoClicked;
  ns.redoClicked = redoClicked;
  /** miniature */
  ns.openMiniatureClicked = openMiniatureClicked;
  /** refresh */
  ns.refreshContextMenuState = refreshContextMenuState,
    /** init */
    ns.initModule = initModule;
})(wuwei.menu);
// wuwei.menu.js last updated 2026-04-16
