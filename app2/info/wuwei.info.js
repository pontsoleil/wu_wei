/**
 * wuwei.info.js
 * info module
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2013-2020,2023,2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.info = wuwei.info || {};

(function (ns) {
  'use strict';

  const
    common = wuwei.common,
    state = common.state,
    model = wuwei.model,
    util = wuwei.util,
    stateMap = {
      node: null,
      option: null,
      _window: new Map()
    };

  function isTimelinePointNode(node) {
    return !!(
      node &&
      (
        node.type === 'Segment' ||
        (node.type === 'Topic' && node.topicKind === 'timeline-point')
      )
    );
  }

  function isTimelineAxisLink(link) {
    return !!(
      link &&
      link.type === 'Link' &&
      (
        link.groupType === 'timelineAxis' ||
        link.linkType === 'timeline-axis'
      )
    );
  }

  function openTimelineInfo(target) {
    if (!target) {
      return false;
    }
    showInfoPane('info-timeline');
    if (wuwei.info.timeline && typeof wuwei.info.timeline.open === 'function') {
      wuwei.info.timeline.open(target, {
        startSeconds: target.startAt,
        endSeconds: target.endAt,
        autoplay: true
      });
      return true;
    }
    return false;
  }

  function isHostedYouTubeUrl(url) {
    var s = String(url || '').toLowerCase();
    return /^https?:\/\/(www\.)?(youtube\.com|m\.youtube\.com|youtu\.be)\b/.test(s);
  }

  function isHostedVimeoUrl(url) {
    var s = String(url || '').toLowerCase();
    return /^https?:\/\/(www\.)?(vimeo\.com|player\.vimeo\.com)\b/.test(s);
  }

  function isHostedVideoNode(node) {
    var fmt, uri, kind;

    if (!node) {
      return false;
    }

    var resource = util.getResource(node);
    fmt = String((resource && resource.mimeType) || '').toLowerCase();
    uri = String(util.getResourceUri(node) || '').toLowerCase();
    kind = String((resource && resource.kind) || '').toLowerCase();

    return (
      kind === 'video' ||
      fmt.indexOf('video/') === 0 ||
      /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/.test(uri) ||
      isHostedYouTubeUrl(uri) ||
      isHostedVimeoUrl(uri)
    );
  }

  function hideAllInfoPanes() {
    var ids = [
      'info-generic',
      'info-uploaded',
      'info-video',
      'info-asciidoc',
      'info-timeline'
    ];
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.style.display = 'none';
      }
    });
  }

  function showInfoPane(id) {
    var el;
    hideAllInfoPanes();
    el = document.getElementById(id);
    if (el) {
      el.style.display = 'block';
    }
  }

  function resolveTarget(target) {
    if (!target || !target.id) {
      return target || null;
    }
    if (util.isLink(target) && model && typeof model.findLinkById === 'function') {
      return model.findLinkById(target.id) || target;
    }
    if (model && typeof model.findNodeById === 'function') {
      return model.findNodeById(target.id) || target;
    }
    return target;
  }

  function getNodeById(node) {
    return resolveTarget(node);
  }

  function getNodeUri(node) {
    if (!node) {
      return '';
    }
    return util.getResourceUri(node);
  }

  function getNodeFormat(node) {
    var resource = util.getResource(node);
    if (!resource || !resource.mimeType) { return ''; }
    return String(resource.mimeType).toLowerCase();
  }

  function hidePane(id) {
    var pane = document.getElementById(id);
    if (!pane) {
      return;
    }
    pane.style.display = 'none';
    pane.innerHTML = '';
  }

  function hideInfoPanes() {
    hidePane('info-generic');
    hidePane('info-uploaded');
    hidePane('info-video');
    hidePane('info-asciidoc');
    hidePane('info-timeline');
  }

  function hasAsciiDocValue(node) {
    if (!node) {
      return false;
    }

    if (node.description &&
      'object' === typeof node.description &&
      'string' === typeof node.description.body &&
      node.description.body.trim()) {
      return true;
    }

    if ('string' !== typeof node.value) {
      return false;
    }
    if (!node.value.trim()) {
      return false;
    }

    // 明示指定があればそれを優先
    if ('asciidoc' === node.valueFormat) {
      return true;
    }

    // 現行設計: Memo / Content の value は AsciiDoc 本文
    return ['Memo', 'Content'].includes(node.type);
  }

  function isVideoNode(node) {
    var fmt = getNodeFormat(node);
    var uri = getNodeUri(node).toLowerCase();

    return (
      0 === fmt.indexOf('video/') ||
      /\.(mp4|webm|ogg|mov|m4v)$/.test(uri)
    );
  }

  function isUploadedNode(node) {
    var resource, origin, storage, files, uriText, kindText;
    if (!node) {
      return false;
    }
    if ('upload' === node.option) {
      return true;
    }
    resource = util.getResource(node);
    if (!resource || 'object' !== typeof resource) {
      return false;
    }
    origin = (resource.origin && 'object' === typeof resource.origin) ? resource.origin : {};
    storage = (resource.storage && 'object' === typeof resource.storage) ? resource.storage : {};
    files = Array.isArray(storage.files) ? storage.files : [];
    uriText = [
      resource.uri,
      resource.canonicalUri,
      resource.previewUri,
      node.thumbnailUri
    ].join(' ').replace(/\\/g, '/');
    kindText = [
      origin.type,
      origin.subtype,
      resource.kind,
      resource.media && resource.media.kind
    ].join(' ').toLowerCase();
    return (
      kindText.indexOf('upload') >= 0 ||
      files.some(function (file) {
        return file && String(file.area || '').toLowerCase() === 'upload';
      }) ||
      /(?:^|\/)upload\//.test(uriText)
    );
  }

  function hasGenericPreview(node) {
    if (!node) {
      return false;
    }
    if (isVideoNode(node) || isUploadedNode(node)) {
      return false;
    }
    return !!(
      (util.getResourceUri(node) && String(util.getResourceUri(node)).trim()) ||
      (util.getThumbnailUri(node) && String(util.getThumbnailUri(node)).trim()) ||
      node.label ||
      node.description ||
      node.type
    );
  }

  function shouldOpenGeneric(node, hasAdoc) {
    if (!node) {
      return false;
    }

    // Memo で本文が AsciiDoc の場合は generic を出さない
    if (node.type === 'Memo' && hasAdoc) {
      return false;
    }

    return hasGenericPreview(node);
  }

  function hasMeaningfulPaneContent(id) {
    var pane = document.getElementById(id);
    if (!pane) {
      return false;
    }

    if (pane.querySelector('img, iframe, video, audio, table, ul, ol, pre, blockquote')) {
      return true;
    }

    return !!String(pane.textContent || '').replace(/\s+/g, '');
  }

  function open(node, option) {
    var infoPane = document.getElementById('info');
    var resolvedNode;
    var hasAdoc;

    document.getElementById('edit').style.display = 'none';

    if (!infoPane) {
      return;
    }

    infoPane.innerHTML = wuwei.info.markup.template();
    infoPane.style.display = 'block';
    hideInfoPanes();
    stateMap._window.clear();

    resolvedNode = getNodeById(node);
    if (!resolvedNode) {
      stateMap.node = null;
      stateMap.option = null;
      return;
    }

    infoPane.dataset.node_id = resolvedNode.id || '';
    stateMap.node = resolvedNode;
    stateMap.option = option || resolvedNode.option || null;

    if (isTimelinePointNode(resolvedNode) || isTimelineAxisLink(resolvedNode)) {
      openTimelineInfo(resolvedNode);
      return;
    }

    hasAdoc = hasAsciiDocValue(resolvedNode);

    // preview 系
    if (isHostedVideoNode(resolvedNode)) {
      showInfoPane('info-video');

      if (wuwei.info.video && typeof wuwei.info.video.open === 'function') {
        wuwei.info.video.open({
          node: resolvedNode,
          option: stateMap.option
        });
      }
      return;
    }
    else if (isVideoNode(resolvedNode) &&
      wuwei.info.video &&
      'function' === typeof wuwei.info.video.open) {
      showInfoPane('info-video');
      wuwei.info.video.open({
        node: resolvedNode,
        option: stateMap.option
      });
    }
    else if (isUploadedNode(resolvedNode) &&
      wuwei.info.uploaded &&
      'function' === typeof wuwei.info.uploaded.open) {
      wuwei.info.uploaded.open({
        node: resolvedNode,
        option: stateMap.option
      });
    }

    else if (shouldOpenGeneric(resolvedNode, hasAdoc) &&
      wuwei.info.generic &&
      'function' === typeof wuwei.info.generic.open) {
      wuwei.info.generic.open({
        node: resolvedNode,
        option: stateMap.option
      });
    }

    // 本文系
    if (hasAdoc &&
      wuwei.info.asciidoc &&
      'function' === typeof wuwei.info.asciidoc.open) {
      wuwei.info.asciidoc.open({
        node: resolvedNode,
        option: stateMap.option
      });
    }

    if (!hasMeaningfulPaneContent('info-generic')) {
      hidePane('info-generic');
    }
  }

  function close() {
    var infoPane = document.getElementById('info');
    var editingCircle = document.getElementById('Editing');

    if (wuwei.info.asciidoc && 'function' === typeof wuwei.info.asciidoc.close) {
      wuwei.info.asciidoc.close();
    }
    if (wuwei.info.timeline && 'function' === typeof wuwei.info.timeline.close) {
      wuwei.info.timeline.close();
    }
    if (wuwei.info.video && 'function' === typeof wuwei.info.video.close) {
      wuwei.info.video.close();
    }
    if (wuwei.info.uploaded && 'function' === typeof wuwei.info.uploaded.close) {
      wuwei.info.uploaded.close();
    }
    if (wuwei.info.generic && 'function' === typeof wuwei.info.generic.close) {
      wuwei.info.generic.close();
    }
    if (wuwei.info.video && typeof wuwei.info.video.close === 'function') {
      wuwei.info.video.close();
    }

    hideInfoPanes();

    if (infoPane) {
      infoPane.innerHTML = '';
      infoPane.style.display = 'none';
      delete infoPane.dataset.node_id;
    }

    stateMap.node = null;
    stateMap.option = null;

    if (window.wuwei && wuwei.menu && 'function' === typeof wuwei.menu.closeContextMenu) {
      wuwei.menu.closeContextMenu();
    }

    if (editingCircle) {
      editingCircle.style.opacity = '0';
    }
  }

  function editOpen() {
    var editingNode = resolveTarget(stateMap.node);
    var editPane = document.getElementById('edit');
    var infoPane = document.getElementById('info');
    var editingNodeId;

    if (!editingNode && editPane) {
      editingNodeId = editPane.dataset.node_id;
      if (editingNodeId) {
        editingNode = model.findNodeById(editingNodeId);
      }
    }
    if (!editingNode && infoPane) {
      editingNodeId = infoPane.dataset.node_id;
      if (editingNodeId) {
        editingNode = model.findNodeById(editingNodeId);
      }
    }

    close();

    if (editingNode) {
      wuwei.edit.open(editingNode);
    }
  }

  function widen() {
    var infoPane = document.getElementById('info');
    if (!infoPane) {
      return;
    }
    infoPane.classList.toggle('widen');
  }

  function toOfficeViewerUrl(uri, base) {
    var absoluteUri = /^https?:\/\//i.test(uri)
      ? uri
      : window.location.origin + '/' + String(base || '') + String(uri || '').replace(/^\/+/, '');
    if (wuwei.util && typeof wuwei.util.isLocalHost === 'function' && wuwei.util.isLocalHost()) {
      return absoluteUri;
    }
    return 'https://view.officeapps.live.com/op/embed.aspx?src=' + encodeURIComponent(absoluteUri);
  }

  function isOfficeUri(uri) {
    return /\.(doc|docx|xls|xlsx|ppt|pptx)$/i.test(String(uri || '').split('#')[0].split('?')[0]);
  }

  function normalizeOpenUri(uri) {
    var match;
    var base = '';

    if (!uri) {
      return '';
    }

    if (/(?:^|\/)(?:cgi-bin|server)\/load-file\.(?:py|cgi)\?/i.test(uri)) {
      return uri;
    }

    if (!uri.match(/wikipedia/)) {
      uri = decodeURI(uri);
    }

    match = location.pathname.match(/^\/(.*)\/.+$/);
    if (match) {
      base = match[1] + '/';
    }

    if (!uri.match(/^http/) && uri.indexOf('pdf') > 0) {
      uri = '/' + base + uri;
    }
    else if (
      isOfficeUri(uri)
    ) {
      uri = toOfficeViewerUrl(uri, base);
    }

    return uri;
  }

  function openWindow(uri, name) {
    var features;
    var win;
    var match;
    var base = '';

    if (!uri) {
      return;
    }

    uri = normalizeOpenUri(uri);

    if (!name) {
      if (0 === uri.indexOf('http')) {
        name = uri.match(/http[s]*:\/\/([^\/]*)/)[1].replace(/\./g, '_');
      }
      else {
        name = 'wuwei';
        match = location.pathname.match(/^\/(.*)\/.+$/);
        if (match) {
          base = match[1] + '/';
        }
        if (!uri.match(/^http/) && uri.indexOf('pdf') > 0) {
          uri = '/' + base + uri;
        }
      }
    }

    features = 'menubar=no,location=no,resizable=yes,scrollbars=yes,status=no';
    win = window.open(uri, name, 'width=600,height=700,' + features);
    stateMap._window.set(name, win);
  }

  function closeWindow(name) {
    var win;
    if (name) {
      win = stateMap._window.get(name);
      if (win) {
        win.close();
      }
      return;
    }
    stateMap._window.forEach(function (openedWin) {
      openedWin.close();
    });
  }

  function openNewTab(uri) {
    var win;
    var match;
    var base = 'upload/';

    if (!uri) {
      return;
    }

    if (!uri.match(/wikipedia/)) {
      uri = decodeURI(uri);
    }

    match = location.pathname.match(/^\/(.*)\/.+$/);
    if (match) {
      base = match[1] + '/';
    }

    if (
      isOfficeUri(uri)
    ) {
      uri = toOfficeViewerUrl(uri, base);
    }

    win = window.open(uri, '_blank');
    if (win) {
      win.focus();
    }
  }

  function iframeError() {
    var frame = document.getElementById('infoFrame');
    var fallback = frame && frame.parentNode
      ? frame.parentNode.querySelector('.iframe-fallback')
      : null;

    if (frame) {
      frame.style.display = 'none';
    }
    if (fallback) {
      fallback.style.display = 'block';
    }
  }

  function renderAsciiDocInfo(node) {
    var pane = document.getElementById('info-asciidoc');
    var source;
    var html;

    if (!pane || !node) {
      return false;
    }

    source = util.getNodeAsciiDocSource(node);
    if (!source) {
      pane.innerHTML = '';
      pane.style.display = 'none';
      return false;
    }

    html = util.renderAsciiDoc(source, {
      showtitle: false,
      allowHtml: true
    });

    pane.innerHTML = html;
    pane.style.display = 'block';
    return true;
  }

  function initModule() {
    var infoPane = document.getElementById('info');
    if (!infoPane) {
      return;
    }

    infoPane.innerHTML = wuwei.info.markup.template();

    if (wuwei.info.asciidoc && typeof wuwei.info.asciidoc.initModule === 'function') {
      wuwei.info.asciidoc.initModule();
    }

    if (wuwei.info.generic && typeof wuwei.info.generic.initModule === 'function') {
      wuwei.info.generic.initModule();
    }

    if (wuwei.info.video && typeof wuwei.info.video.initModule === 'function') {
      wuwei.info.video.initModule();
    }

    if (wuwei.info.uploaded && typeof wuwei.info.uploaded.initModule === 'function') {
      wuwei.info.uploaded.initModule();
    }

    if (wuwei.info.timeline && typeof wuwei.info.timeline.initModule === 'function') {
      wuwei.info.timeline.initModule();
    }

    document.addEventListener('click', function (ev) {
      var dismissBtn = ev.target && ev.target.closest && ev.target.closest('#infoDismiss');
      if (dismissBtn) {
        ev.preventDefault();
        ev.stopPropagation();
        close();
        return;
      }

      var widenBtn = ev.target && ev.target.closest && ev.target.closest('#infoWiden');
      if (widenBtn) {
        ev.preventDefault();
        ev.stopPropagation();
        widen();
        return;
      }

      var editBtn = ev.target && ev.target.closest && ev.target.closest('#editOpen');
      if (editBtn) {
        ev.preventDefault();
        ev.stopPropagation();
        editOpen();
        return;
      }
    }, true);
  }

  ns.open = open;
  ns.close = close;
  ns.editOpen = editOpen;
  ns.widen = widen;
  ns.openWindow = openWindow;
  ns.closeWindow = closeWindow;
  ns.openNewTab = openNewTab;
  ns.iframeError = iframeError;
  ns.initModule = initModule;
  ns.hasAsciiDocValue = hasAsciiDocValue;
})(wuwei.info);
// wuwei.info.js last updated 2026-04-16
