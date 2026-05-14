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
      editTarget: null,
      displayedContentTarget: null,
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

  function isContentsTarget(target) {
    return !!(
      target &&
      wuwei.info.contents &&
      typeof wuwei.info.contents.canOpen === 'function' &&
      wuwei.info.contents.canOpen(target)
    );
  }

  function openContentsInfo(target, option, replace) {
    if (!target ||
      !wuwei.info.contents ||
      typeof wuwei.info.contents.open !== 'function') {
      return false;
    }
    if (replace) {
      showInfoPane('info-contents');
    }
    return !!wuwei.info.contents.open(target, option || {});
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
      'info-group',
      'info-uploaded',
      'info-video',
      'info-asciidoc',
      'info-timeline',
      'info-contents'
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

  function isContentTargetMarker(target) {
    return !!(
      target &&
      (
        target.type === 'PageMarker' ||
        target.nodeKind === 'PageMarker' ||
        target.kind === 'PageMarker' ||
        target.topicKind === 'contents-page'
      )
    );
  }

  function resolveDisplayedContentTarget(option) {
    var point;

    if (!option || 'object' !== typeof option) {
      return null;
    }

    point = option.displayedContentTarget || option.contentTarget || option.contentTargetPoint || option.displayedPageMarker || option.contentsPoint || null;
    point = resolveTarget(point) || point;

    if (!point || !isContentTargetMarker(point)) {
      return null;
    }

    return point;
  }

  function findEditableTargetById(id) {
    if (!id || !model) {
      return null;
    }

    return (typeof model.findNodeById === 'function' ? model.findNodeById(id) : null) ||
      (typeof model.findLinkById === 'function' ? model.findLinkById(id) : null) ||
      (typeof model.findGroupById === 'function' ? model.findGroupById(id) : null);
  }

  function isGroupTarget(target) {
    return !!(target &&
      (('Group' === target.type && target.groupRef) ||
        ('representative' === target.groupRole && target.groupRef)) &&
      wuwei.info.group &&
      typeof wuwei.info.group.canOpen === 'function' &&
      wuwei.info.group.canOpen(target));
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


  function getInformationMarkColor() {
    if (common && common.actionColor && common.actionColor.info) {
      return common.actionColor.info.color || common.actionColor.info.background || '#8B008B';
    }
    return '#8B008B';
  }

  function getInformationCircle() {
    var circle = document.getElementById('Information');
    var canvas;

    if (circle) {
      return circle;
    }

    canvas = document.getElementById('canvas');
    if (!canvas || !document.createElementNS) {
      return null;
    }

    circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('id', 'Information');
    circle.setAttribute('r', '34');
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', getInformationMarkColor());
    circle.setAttribute('stroke-width', '4');
    circle.setAttribute('pointer-events', 'none');
    circle.style.opacity = '0';
    canvas.appendChild(circle);
    return circle;
  }

  function hideInformationMark() {
    var circle = document.getElementById('Information');
    if (!circle) {
      return;
    }
    circle.style.opacity = '0';
    delete circle.dataset.node_id;
    notifySearchInfoClosed();
  }

  function scheduleSearchMatchReapply() {
    if (wuwei.search && wuwei.search.this_note &&
      typeof wuwei.search.this_note.reapplySearchMatch === 'function') {
      window.setTimeout(wuwei.search.this_note.reapplySearchMatch, 0);
      window.setTimeout(wuwei.search.this_note.reapplySearchMatch, 80);
    }
  }

  function notifySearchInfoTarget(node) {
    if (wuwei.search && wuwei.search.this_note &&
      typeof wuwei.search.this_note.setInfoTarget === 'function') {
      wuwei.search.this_note.setInfoTarget(node);
    }
  }

  function notifySearchInfoClosed() {
    if (wuwei.search && wuwei.search.this_note &&
      typeof wuwei.search.this_note.clearInfoTarget === 'function') {
      wuwei.search.this_note.clearInfoTarget();
    }
  }

  function isGroupDefinitionTarget(target) {
    var type;
    if (!target) {
      return false;
    }
    type = String(target.type || '');
    return !!(
      Array.isArray(target.members) ||
      ['Group', 'simple', 'horizontal', 'vertical', 'timeline', 'contents'].indexOf(type) >= 0
    );
  }

  function resolveInformationMarkNode(target) {
    var candidate = resolveTarget(target);
    var group;
    var representative;

    if (candidate && candidate.groupRole === 'representative') {
      return candidate;
    }

    if (isGroupDefinitionTarget(candidate) && model && typeof model.findGroupByTarget === 'function') {
      group = model.findGroupByTarget(candidate);
      if (group) {
        representative = group.representativeNodeId &&
          typeof model.findNodeById === 'function'
          ? model.findNodeById(group.representativeNodeId)
          : null;
        if (!representative && typeof model.ensureGroupRepresentativeTopic === 'function') {
          representative = model.ensureGroupRepresentativeTopic(group);
        }
        if (representative) {
          return representative;
        }
      }
    }

    return candidate;
  }

  function showInformationMark(target) {
    var circle;
    var node;
    var canvas;
    var x;
    var y;

    node = resolveInformationMarkNode(target);
    if (!node || !node.id || !isFinite(node.x) || !isFinite(node.y)) {
      hideInformationMark();
      return;
    }

    circle = getInformationCircle();
    if (!circle) {
      return;
    }

    x = Number(node.x);
    y = Number(node.y);
    circle.dataset.node_id = node.id;
    circle.setAttribute('cx', String(x));
    circle.setAttribute('cy', String(y));
    circle.setAttribute('stroke', getInformationMarkColor());
    circle.style.opacity = '1';
    notifySearchInfoTarget(node);

    canvas = document.getElementById('canvas');
    if (canvas) {
      canvas.appendChild(circle);
    }
    scheduleSearchMatchReapply();
  }

  function hideInfoPanes() {
    hidePane('info-generic');
    hidePane('info-group');
    hidePane('info-uploaded');
    hidePane('info-video');
    hidePane('info-asciidoc');
    hidePane('info-timeline');
    hidePane('info-contents');
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

    if (wuwei.edit && typeof wuwei.edit.close === 'function') {
      var editPane = document.getElementById('edit');
      if (editPane && editPane.style.display !== 'none') {
        wuwei.edit.close();
      }
    }
    else {
      var fallbackEditPane = document.getElementById('edit');
      if (fallbackEditPane) { fallbackEditPane.style.display = 'none'; }
    }

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
      stateMap.editTarget = null;
      stateMap.displayedContentTarget = null;
      stateMap.option = null;
      hideInformationMark();
      return;
    }

    infoPane.dataset.node_id = resolvedNode.id || '';
    stateMap.node = resolvedNode;
    stateMap.option = option || resolvedNode.option || null;
    stateMap.displayedContentTarget = resolveDisplayedContentTarget(stateMap.option);
    stateMap.editTarget = stateMap.displayedContentTarget ||
      ((stateMap.option && stateMap.option.editTarget)
        ? resolveTarget(stateMap.option.editTarget) || stateMap.option.editTarget
        : resolvedNode);

    if (stateMap.displayedContentTarget && stateMap.displayedContentTarget.id) {
      infoPane.dataset.content_target_id = stateMap.displayedContentTarget.id;
    }
    else {
      delete infoPane.dataset.content_target_id;
    }

    if (stateMap.editTarget && stateMap.editTarget.id) {
      infoPane.dataset.edit_node_id = stateMap.editTarget.id;
    }
    else {
      delete infoPane.dataset.edit_node_id;
    }

    showInformationMark(stateMap.displayedContentTarget || resolvedNode);

    if (isTimelinePointNode(resolvedNode) || isTimelineAxisLink(resolvedNode)) {
      openTimelineInfo(resolvedNode);
      return;
    }

    /*
     * A PageMarker represents a page/anchor inside its source Content.
     * Opening Info for the marker should therefore open the source document
     * at the specified page in the info pane.  The marker's own metadata is
     * edited in the Contents edit panel, not shown as a standalone Info view.
     */
    if (isContentTargetMarker(resolvedNode) &&
      !(stateMap.option && stateMap.option.contentTargetView) &&
      wuwei.menu && wuwei.menu.contents &&
      typeof wuwei.menu.contents.openContentTargetInInfo === 'function') {
      wuwei.menu.contents.openContentTargetInInfo(resolvedNode);
      return;
    }

    if (isContentsTarget(resolvedNode)) {
      openContentsInfo(resolvedNode, stateMap.option, true);
      return;
    }

    if (isGroupTarget(resolvedNode)) {
      showInfoPane('info-group');
      wuwei.info.group.open({
        node: resolvedNode,
        option: stateMap.option
      });
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

    /*
     * PageMarker information opened through menu.contents.openContentTargetInInfo() is
     * primarily a content preview request. Do not open the contents marker
     * pane afterwards, because it can hide the generic iframe/viewer and the
     * selected content target is no longer visible.
     */
    if (stateMap.displayedContentTarget &&
      !(stateMap.option && (stateMap.option.contentTargetView || stateMap.option.contentsPage))) {
      openContentsInfo(stateMap.displayedContentTarget, stateMap.option, false);
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
    if (wuwei.info.contents && 'function' === typeof wuwei.info.contents.close) {
      wuwei.info.contents.close();
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
    if (wuwei.info.group && 'function' === typeof wuwei.info.group.close) {
      wuwei.info.group.close();
    }
    if (wuwei.info.video && typeof wuwei.info.video.close === 'function') {
      wuwei.info.video.close();
    }

    hideInfoPanes();
    hideInformationMark();

    if (infoPane) {
      infoPane.innerHTML = '';
      infoPane.style.display = 'none';
      delete infoPane.dataset.node_id;
      delete infoPane.dataset.edit_node_id;
      delete infoPane.dataset.content_target_id;
    }

    stateMap.node = null;
    stateMap.editTarget = null;
    stateMap.displayedContentTarget = null;
    stateMap.option = null;

    if (window.wuwei && wuwei.menu && 'function' === typeof wuwei.menu.closeContextMenu) {
      wuwei.menu.closeContextMenu();
    }

    if (editingCircle) {
      editingCircle.style.opacity = '0';
    }
  }

  function editOpen() {
    var editingNode = resolveTarget(stateMap.displayedContentTarget) ||
      resolveTarget(stateMap.editTarget) ||
      resolveTarget(stateMap.node);
    var editPane = document.getElementById('edit');
    var infoPane = document.getElementById('info');
    var editingNodeId;

    if (!editingNode && infoPane) {
      editingNodeId = infoPane.dataset.content_target_id ||
        infoPane.dataset.edit_node_id ||
        infoPane.dataset.node_id ||
        infoPane.dataset.group_id;
      editingNode = findEditableTargetById(editingNodeId);
    }
    if (!editingNode && editPane) {
      editingNodeId = editPane.dataset.content_target_id ||
        editPane.dataset.edit_node_id ||
        editPane.dataset.node_id ||
        editPane.dataset.group_id;
      editingNode = findEditableTargetById(editingNodeId);
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

  function decodeUriComponentSafe(value) {
    var s = String(value || '');
    try {
      return decodeURIComponent(s);
    }
    catch (e) {
      return s;
    }
  }

  function getNestedViewerUri(url) {
    var pathname;
    var host;
    var key;
    var params = ['src', 'file', 'url', 'uri', 'href', 'path'];
    var i;
    var value;

    if (!url || !url.searchParams) {
      return '';
    }

    host = String(url.hostname || '').toLowerCase();
    pathname = String(url.pathname || '').toLowerCase();

    if (host === 'view.officeapps.live.com') {
      value = url.searchParams.get('src');
      return value ? decodeUriComponentSafe(value) : '';
    }

    if (/(?:^|\/)(?:viewer\.html|text-viewer\.html)$/.test(pathname) ||
      /(?:^|\/)(?:load-file|proxy-file|proxy)\.(?:cgi|py)$/.test(pathname)) {
      for (i = 0; i < params.length; i += 1) {
        key = params[i];
        value = url.searchParams.get(key);
        if (value) {
          return decodeUriComponentSafe(value);
        }
      }
    }

    return '';
  }

  function getWindowReuseKey(uri) {
    var nested;
    var url;
    var s = String(uri || '').trim();

    if (!s) {
      return '';
    }

    try {
      url = new URL(s, location.href);
      nested = getNestedViewerUri(url);
      if (nested) {
        return getWindowReuseKey(nested);
      }
      url.search = '';
      url.hash = '';
      return url.href;
    }
    catch (e) {
      return s.split('#')[0].split('?')[0];
    }
  }

  function makeWindowName(key, fallbackName) {
    var hash = 0;
    var i;
    var chr;
    var s = String(key || fallbackName || 'wuwei');

    if (fallbackName && fallbackName !== 'wuwei') {
      return String(fallbackName).replace(/[^A-Za-z0-9_\-]/g, '_');
    }

    for (i = 0; i < s.length; i += 1) {
      chr = s.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }

    return 'wuwei_' + Math.abs(hash).toString(36);
  }

  function getOpenWindowRecord(key) {
    var record;
    var found = null;

    stateMap._window.forEach(function (value, mapKey) {
      var win = value && value.win ? value.win : value;
      if (!win || win.closed) {
        stateMap._window.delete(mapKey);
        return;
      }
      record = value && value.win ? value : {
        key: mapKey,
        name: mapKey,
        win: win
      };
      if (!found && record.key === key) {
        found = record;
      }
    });

    return found;
  }

  function normaliseWindowFeatures(features) {
    var list;

    if (!features) {
      return '';
    }

    list = String(features).split(',').map(function (item) {
      return item.trim();
    }).filter(function (item) {
      return item && !/^(?:noopener|noreferrer)(?:=|$)/i.test(item);
    });

    return list.join(',');
  }

  function openWindow(uri, name, windowFeatures) {
    var defaultFeatures;
    var features;
    var win;
    var record;
    var key;
    var windowName;
    var match;
    var base = '';

    if (!uri) {
      return;
    }

    uri = normalizeOpenUri(uri);
    key = getWindowReuseKey(uri);
    record = getOpenWindowRecord(key);
    windowName = record ? record.name : makeWindowName(key, name);

    if (!windowName) {
      if (0 === uri.indexOf('http')) {
        match = uri.match(/http[s]*:\/\/([^\/]*)/);
        windowName = match && match[1] ? match[1].replace(/\./g, '_') : 'wuwei';
      }
      else {
        windowName = 'wuwei';
        match = location.pathname.match(/^\/(.*)\/.+$/);
        if (match) {
          base = match[1] + '/';
        }
        if (!uri.match(/^http/) && uri.indexOf('pdf') > 0) {
          uri = '/' + base + uri;
        }
      }
    }

    defaultFeatures = 'width=600,height=700,menubar=no,location=no,resizable=yes,scrollbars=yes,status=no';
    features = normaliseWindowFeatures(windowFeatures) || defaultFeatures;
    win = window.open(uri, windowName, features);

    if (win) {
      try {
        win.focus();
      }
      catch (e) {
        // Ignore focus failures caused by browser settings.
      }
      stateMap._window.set(key || windowName, {
        key: key || windowName,
        name: windowName,
        url: uri,
        win: win
      });
    }
  }

  function closeWindow(name) {
    if (name) {
      stateMap._window.forEach(function (value, mapKey) {
        var win = value && value.win ? value.win : value;
        var recordName = value && value.name ? value.name : mapKey;
        if (mapKey === name || recordName === name) {
          if (win) {
            win.close();
          }
          stateMap._window.delete(mapKey);
        }
      });
      return;
    }
    stateMap._window.forEach(function (value, mapKey) {
      var openedWin = value && value.win ? value.win : value;
      if (openedWin) {
        openedWin.close();
      }
      stateMap._window.delete(mapKey);
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

    if (wuwei.info.group && typeof wuwei.info.group.initModule === 'function') {
      wuwei.info.group.initModule();
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

    if (wuwei.info.contents && typeof wuwei.info.contents.initModule === 'function') {
      wuwei.info.contents.initModule();
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
  ns.hideInformationMark = hideInformationMark;
  ns.editOpen = editOpen;
  ns.getDisplayedContentTarget = function () {
    return stateMap.displayedContentTarget;
  };
  ns.getDisplayedPageMarker = ns.getDisplayedContentTarget
  ns.widen = widen;
  ns.openWindow = openWindow;
  ns.closeWindow = closeWindow;
  ns.openNewTab = openNewTab;
  ns.iframeError = iframeError;
  ns.initModule = initModule;
  ns.hasAsciiDocValue = hasAsciiDocValue;
})(wuwei.info);
// wuwei.info.js last updated 2026-04-16
