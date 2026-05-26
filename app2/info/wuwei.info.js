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

  function isViewpointTarget(target) {
    return !!(
      target &&
      wuwei.info.viewpoint &&
      typeof wuwei.info.viewpoint.canOpen === 'function' &&
      wuwei.info.viewpoint.canOpen(target)
    );
  }

  function openViewpointInfo(target, option, replace) {
    if (!target ||
      !wuwei.info.viewpoint ||
      typeof wuwei.info.viewpoint.open !== 'function') {
      return false;
    }
    if (replace) {
      showInfoPane('info-viewpoint');
    }
    return !!wuwei.info.viewpoint.open(target, option || {});
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
    var uri, kind, resource;

    if (!node) {
      return false;
    }

    resource = util.getResource(node);
    uri = String(util.getResourceUri(node) || '').toLowerCase();
    kind = String((resource && resource.kind) || '').toLowerCase();

    return (
      kind === 'video' ||
      (util.isDocumentKindByExtension && util.isDocumentKindByExtension(node, resource, uri, 'video')) ||
      isHostedYouTubeUrl(uri) ||
      isHostedVimeoUrl(uri)
    );
  }

  function closeEditPaneForInfo() {
    var editPane = document.getElementById('edit');
    if (!editPane || editPane.style.display === 'none') {
      return;
    }
    if (wuwei.edit && typeof wuwei.edit.close === 'function') {
      wuwei.edit.close();
      return;
    }
    editPane.innerHTML = '';
    editPane.style.display = 'none';
  }

  function hideAllInfoPanes() {
    var ids = [
      'info-generic',
      'info-group',
      'info-uploaded',
      'info-video',
      'info-audio',
      'info-image',
      'info-asciidoc',
      'info-timeline',
      'info-viewpoint',
      'info-admin'
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
    closeEditPaneForInfo();
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

  function getCurrentOwnerId() {
    return (common && typeof common.getCurrentOwnerId === 'function'
      ? common.getCurrentOwnerId()
      : '') ||
      (state && state.currentUser && state.currentUser.user_id) ||
      '';
  }

  function getRecordOwnerId(record) {
    if (!record || typeof record !== 'object') {
      return '';
    }
    if (record.audit && typeof record.audit === 'object' && record.audit.createdBy) {
      return String(record.audit.createdBy);
    }
    return '';
  }

  function isRecordOwnedByCurrentUser(record) {
    var ownerId = getRecordOwnerId(record);
    var currentOwnerId = getCurrentOwnerId();

    if (!ownerId || !currentOwnerId) {
      return false;
    }
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

  function isTeamJointNote() {
    var current = (common && common.current) || {};
    var noteState = String(current.jointNoteState || current.collabNoteState || '').toLowerCase();
    var noteScope = String(current.note_scope || '').toLowerCase();
    var origin = (current.origin && typeof current.origin === 'object') ? current.origin : {};
    var originType = String(origin.type || '').toLowerCase();
    var originSource = String(origin.source || '').toLowerCase();

    if (noteState === 'team') {
      return true;
    }
    if (noteState === 'imported' || noteState === 'own') {
      return false;
    }
    if (originType === 'import' || originSource === 'export-package') {
      return false;
    }
    if (noteScope === 'team') {
      return true;
    }
    if (originType === 'team' || originSource === 'team-note') {
      return true;
    }
    if (current.team_id) {
      return true;
    }

    return false;
  }

  function canOpenEditFromInfo(record) {
    if (!record ||
      !common.graph ||
      common.graph.mode === 'view' ||
      state.viewOnly ||
      state.published) {
      return false;
    }

    /*
     * Team Joint Note:
     *   another user's node is read-only, so hide the edit action.
     *
     * Imported / personal / ordinary note:
     *   another user's node may still allow display-style editing
     *   such as size, colour and font.  Therefore show the edit action.
     */
    if (isTeamJointNote() && !isRecordOwnedByCurrentUser(record)) {
      return false;
    }

    return true;
  }

  function updateHeaderEditAction(record) {
    var editBtn = document.getElementById('editOpen');
    var canEdit = canOpenEditFromInfo(record);

    if (!editBtn) {
      return;
    }

    editBtn.style.display = canEdit ? '' : 'none';
    editBtn.classList.toggle('is-visible', canEdit);
    editBtn.setAttribute('aria-hidden', canEdit ? 'false' : 'true');
    editBtn.setAttribute('tabindex', canEdit ? '0' : '-1');
  }

  function setInfoEditTarget(record, option) {
    var infoPane = document.getElementById('info');
    var target = resolveTarget(record) || record || null;

    stateMap.node = target;
    stateMap.editTarget = target;
    stateMap.option = option || stateMap.option || null;
    stateMap.displayedContentTarget = isContentTargetMarker(target) ? target : null;

    if (infoPane) {
      if (target && target.id) {
        infoPane.dataset.node_id = target.id;
        infoPane.dataset.edit_node_id = target.id;

        if (isContentTargetMarker(target)) {
          infoPane.dataset.content_target_id = target.id;
          infoPane.dataset.page_marker_id = target.id;
        }
        else {
          delete infoPane.dataset.content_target_id;
          delete infoPane.dataset.page_marker_id;
        }

        if (target.members || target.type === 'timeline' || target.type === 'viewpoint') {
          infoPane.dataset.group_id = target.id;
        }
        else {
          delete infoPane.dataset.group_id;
        }
      }
      else {
        delete infoPane.dataset.node_id;
        delete infoPane.dataset.edit_node_id;
        delete infoPane.dataset.content_target_id;
        delete infoPane.dataset.page_marker_id;
        delete infoPane.dataset.group_id;
      }
    }

    updateHeaderEditAction(target);
    return target;
  }

  function isContentTargetMarker(target) {
    return !!(
      target &&
      (
        target.type === 'PageMarker' ||
        target.nodeKind === 'PageMarker' ||
        target.kind === 'PageMarker' ||
        target.topicKind === 'viewpoint-page'
      )
    );
  }

  function resolveDisplayedContentTarget(option) {
    var point;

    if (!option || 'object' !== typeof option) {
      return null;
    }

    point = option.displayedContentTarget || option.contentTarget || option.contentTargetPoint || option.displayedPageMarker || option.viewpointPoint || null;
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
      ['Group', 'simple', 'horizontal', 'vertical', 'timeline', 'viewpoint'].indexOf(type) >= 0
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
    hidePane('info-audio');
    hidePane('info-image');
    hidePane('info-asciidoc');
    hidePane('info-timeline');
    hidePane('info-viewpoint');
    hidePane('info-admin');
  }

  function hasAsciiDocValue(node) {
    return !!(node && node.description &&
      'object' === typeof node.description &&
      'string' === typeof node.description.body &&
      node.description.body.trim() &&
      String(node.description.format || '').toLowerCase().indexOf('asciidoc') >= 0);
  }

  function isVideoNode(node) {
    var resource = util.getResource ? util.getResource(node) : (node && node.resource || {});
    var uri = getNodeUri(node).toLowerCase();

    return !!(util.isDocumentKindByExtension &&
      util.isDocumentKindByExtension(node, resource, uri, 'video'));
  }


  function isAudioNode(node) {
    return !!(
      node &&
      wuwei.audio &&
      typeof wuwei.audio.isAudioNode === 'function' &&
      wuwei.audio.isAudioNode(node)
    );
  }

  function isImageNode(node) {
    return !!(
      node &&
      wuwei.resource &&
      typeof wuwei.resource.isImage === 'function' &&
      wuwei.resource.isImage(node)
    );
  }

  function isUploadedNode(node) {
    var resource, storage, files, uriText;
    if (!node) {
      return false;
    }
    resource = util.getResource(node);
    if (!resource || 'object' !== typeof resource) {
      return false;
    }
    storage = (resource.storage && 'object' === typeof resource.storage) ? resource.storage : {};
    files = Array.isArray(storage.files) ? storage.files : [];
    uriText = [resource.uri, resource.canonicalUri].join(' ').replace(/\\/g, '/');
    return (
      resource.source === 'upload' ||
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
    if (isVideoNode(node) || isAudioNode(node) || isImageNode(node) || isUploadedNode(node)) {
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



  function setPaneTitle(iconClass, titleText) {
    var icon = document.getElementById('infoPaneTitleIcon');
    var text = document.getElementById('infoPaneTitleText');

    if (icon) {
      icon.className = iconClass || 'fas fa-info fa-lg fa-fw';
    }
    if (text) {
      text.textContent = titleText || '';
    }
  }

  function setInfoPaneTitle() {
    setPaneTitle('fas fa-info fa-lg fa-fw', '');
  }

  function openAdmin(target, option) {
    if (ns.admin && typeof ns.admin.open === 'function') {
      return ns.admin.open(target, option);
    }
    if (window.console && console.warn) {
      console.warn('info.admin.js is not loaded.');
    }
    return false;
  }

  function canOpenAdminPane() {
    return !!(ns.admin && typeof ns.admin.canOpen === 'function' && ns.admin.canOpen());
  }

  function open(node, option) {
    var infoPane = document.getElementById('info');
    var resolvedNode;
    var hasAdoc;

    closeEditPaneForInfo();

    if (!infoPane) {
      return;
    }

    infoPane.innerHTML = wuwei.info.markup.template();
    setInfoPaneTitle();
    updateHeaderEditAction(null);
    infoPane.style.display = 'block';
    hideInfoPanes();
    stateMap._window.clear();

    resolvedNode = getNodeById(node);
    if (!resolvedNode) {
      stateMap.node = null;
      stateMap.editTarget = null;
      stateMap.displayedContentTarget = null;
      stateMap.option = null;
      updateHeaderEditAction(null);
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

    updateHeaderEditAction(stateMap.editTarget || resolvedNode);

    showInformationMark(stateMap.displayedContentTarget || resolvedNode);

    if (isTimelinePointNode(resolvedNode) || isTimelineAxisLink(resolvedNode)) {
      openTimelineInfo(resolvedNode);
      return;
    }

    /*
     * A PageMarker represents a page/anchor inside its source Content.
     * Open it through the Viewpoint info pane, not through the generic/uploaded
     * resource pane, so the marker label, source document label and preview
     * are presented as one PageMarker view.
     */
    if (isContentTargetMarker(resolvedNode) &&
      !(stateMap.option && stateMap.option.contentTargetView) &&
      wuwei.menu && wuwei.menu.viewpoint &&
      typeof wuwei.menu.viewpoint.openContentTargetInInfo === 'function') {
      wuwei.menu.viewpoint.openContentTargetInInfo(resolvedNode);
      return;
    }

    if (isViewpointTarget(resolvedNode)) {
      openViewpointInfo(resolvedNode, stateMap.option, true);
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
    else if (isAudioNode(resolvedNode) &&
      wuwei.info.audio &&
      'function' === typeof wuwei.info.audio.open) {
      showInfoPane('info-audio');
      wuwei.info.audio.open({
        node: resolvedNode,
        option: stateMap.option
      });
    }
    else if (isImageNode(resolvedNode) &&
      wuwei.info.image &&
      'function' === typeof wuwei.info.image.open) {
      showInfoPane('info-image');
      wuwei.info.image.open({
        node: resolvedNode,
        option: stateMap.option
      });
    }
    else if (isUploadedNode(resolvedNode) &&
      wuwei.info.uploaded &&
      'function' === typeof wuwei.info.uploaded.open) {
      showInfoPane('info-uploaded');
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
     * PageMarker information is handled by info.viewpoint.  For other cases
     * where a displayedContentTarget is attached to a normal content preview,
     * optionally open the related Viewpoint details.
     */
    if (stateMap.displayedContentTarget &&
      !(stateMap.option && (stateMap.option.contentTargetView || stateMap.option.viewpointPage))) {
      openViewpointInfo(stateMap.displayedContentTarget, stateMap.option, false);
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
    if (wuwei.info.viewpoint && 'function' === typeof wuwei.info.viewpoint.close) {
      wuwei.info.viewpoint.close();
    }
    if (wuwei.info.video && 'function' === typeof wuwei.info.video.close) {
      wuwei.info.video.close();
    }
    if (wuwei.info.audio && 'function' === typeof wuwei.info.audio.close) {
      wuwei.info.audio.close();
    }
    if (wuwei.info.image && 'function' === typeof wuwei.info.image.close) {
      wuwei.info.image.close();
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
      delete infoPane.dataset.page_marker_id;
      delete infoPane.dataset.group_id;
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

    if (!canOpenEditFromInfo(editingNode)) {
      updateHeaderEditAction(editingNode);
      return false;
    }

    close();

    if (editingNode) {
      wuwei.edit.open(editingNode);
      return true;
    }
    return false;
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

  function encodeActionAttr(value) {
    if (wuwei.util && typeof wuwei.util.encodeHtml === 'function') {
      return wuwei.util.encodeHtml(value);
    }
    return String(value || '').replace(/[&<>"']/g, function (ch) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[ch];
    });
  }

  function openActionsHtml(uri, options) {
    var className;
    var features;
    var encodedUri;

    if (!uri) {
      return '';
    }
    options = options || {};
    className = options.className || 'info-open-actions';
    features = options.windowFeatures || 'width=600,height=400,resizable=yes,scrollbars=yes';
    encodedUri = encodeActionAttr(uri);

    return [
      '<div class="' + encodeActionAttr(className) + '">',
      '<span class="player info-open-tab" data-open-uri="' + encodedUri + '" ',
      'onclick="wuwei.info.openNewTab(this.getAttribute(\'data-open-uri\'))">',
      t('Click to open tab') + '<i class="fas fa-external-link-alt"></i>',
      '</span>',
      '<span class="info-open-separator"> / </span>',
      '<span class="player info-open-window" data-open-uri="' + encodedUri + '" ',
      'data-window-features="' + encodeActionAttr(features) + '" ',
      'onclick="wuwei.info.openWindow(this.getAttribute(\'data-open-uri\'), null, this.getAttribute(\'data-window-features\'))">',
      t('Click to open window') + '<i class="fas fa-external-link-alt"></i>',
      '</span>',
      '</div>'
    ].join('');
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

    if (wuwei.info.audio && typeof wuwei.info.audio.initModule === 'function') {
      wuwei.info.audio.initModule();
    }

    if (wuwei.info.image && typeof wuwei.info.image.initModule === 'function') {
      wuwei.info.image.initModule();
    }

    if (wuwei.info.uploaded && typeof wuwei.info.uploaded.initModule === 'function') {
      wuwei.info.uploaded.initModule();
    }

    if (wuwei.info.timeline && typeof wuwei.info.timeline.initModule === 'function') {
      wuwei.info.timeline.initModule();
    }

    if (wuwei.info.viewpoint && typeof wuwei.info.viewpoint.initModule === 'function') {
      wuwei.info.viewpoint.initModule();
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
        if (editBtn.classList.contains('is-visible') && editBtn.style.display !== 'none') {
          editOpen();
        }
        return;
      }
    }, true);
  }

  ns.open = open;
  ns.closeEditPaneForInfo = closeEditPaneForInfo;
  ns.showInfoPane = showInfoPane;
  ns.close = close;
  ns.hideInformationMark = hideInformationMark;
  ns.editOpen = editOpen;
  ns.setInfoEditTarget = setInfoEditTarget;
  ns.updateHeaderEditAction = updateHeaderEditAction;
  ns.openAdmin = openAdmin;
  ns.canOpenAdminPane = canOpenAdminPane;
  ns.getDisplayedContentTarget = function () {
    return stateMap.displayedContentTarget;
  };
  ns.getDisplayedPageMarker = ns.getDisplayedContentTarget
  ns.widen = widen;
  ns.openWindow = openWindow;
  ns.closeWindow = closeWindow;
  ns.openNewTab = openNewTab;
  ns.openActionsHtml = openActionsHtml;
  ns.iframeError = iframeError;
  ns.initModule = initModule;
  ns.hasAsciiDocValue = hasAsciiDocValue;
})(wuwei.info);
// wuwei.info.js last updated 2026-04-16
