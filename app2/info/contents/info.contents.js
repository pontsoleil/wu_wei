/**
 * info.contents.js
 * Contents axis and PageMarker info controller
 */
wuwei.info = wuwei.info || {};
wuwei.info.contents = wuwei.info.contents || {};

(function (ns) {
  'use strict';

  var contents = wuwei.contents;
  var model = wuwei.model;
  var stateMap = { point: null, group: null };



  function ensureInfoRoot() {
    var infoPane = document.getElementById('info');
    var editPane = document.getElementById('edit');
    var hasHeader;

    if (editPane) {
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
     * Contents info can also be opened directly from the context-menu [i]
     * command.  Ensure the shared info header exists so edit / info / widen /
     * close controls are always available.
     */
    if (wuwei.info && wuwei.info.markup && typeof wuwei.info.markup.template === 'function') {
      if (!hasHeader || !document.getElementById('info-contents')) {
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
      'info-asciidoc',
      'info-timeline'
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

    if (target && (target.type === 'PageMarker') && target.id) {
      infoPane.dataset.node_id = target.id;
      infoPane.dataset.page_marker_id = target.id;
      infoPane.dataset.edit_node_id = target.id;
      return;
    }
    if (target && target.id) {
      infoPane.dataset.node_id = target.id;
      infoPane.dataset.group_id = target.id;
    }
  }

  function ensurePane() {
    var infoPane = ensureInfoRoot();
    var pane = document.getElementById('info-contents');
    if (pane) {
      hideSiblingPanes();
      return pane;
    }
    if (!infoPane || !wuwei.info.contents.markup) { return null; }
    infoPane.insertAdjacentHTML('beforeend', wuwei.info.contents.markup.paneTemplate());
    hideSiblingPanes();
    return document.getElementById('info-contents');
  }

  function close() {
    var pane = document.getElementById('info-contents');
    if (!pane) { return; }
    pane.innerHTML = '';
    pane.style.display = 'none';
    stateMap.point = null;
    stateMap.group = null;
  }

  function getSpec(target) {
    return contents && typeof contents.getContentTargetSpec === 'function'
      ? contents.getContentTargetSpec(target)
      : null;
  }

  function canOpen(target) {
    return !!getSpec(target);
  }

  function getDocumentName(spec) {
    var node = spec && spec.documentNode;
    return node ? (node.label || node.name || node.id || '') : '';
  }

  function openAxis(groupOrTarget) {
    var spec = getSpec(groupOrTarget);
    var pane = ensurePane();
    var group;

    if (!pane || !spec || !spec.group) { return false; }
    group = spec.group;
    setInfoDataset(group);
    stateMap.group = group;
    stateMap.point = null;

    pane.innerHTML = wuwei.info.contents.markup.axisTemplate({
      group: group,
      documentName: getDocumentName(spec),
      markerCount: Array.isArray(group.members) ? group.members.length : 0,
      pageCount: group.pageCount || (group.axis && group.axis.end) || '',
      pageOffset: wuwei.contents && typeof wuwei.contents.getPageNumberOffset === 'function'
        ? wuwei.contents.getPageNumberOffset(group)
        : 0
    });
    pane.style.display = 'block';
    return true;
  }

  function openMarker(pointOrTarget) {
    var spec = getSpec(pointOrTarget);
    var pane = ensurePane();

    if (!pane || !spec || !spec.point) { return false; }
    setInfoDataset(spec.point);
    stateMap.group = spec.group;
    stateMap.point = spec.point;

    pane.innerHTML = wuwei.info.contents.markup.markerTemplate({
      point: spec.point,
      axisName: spec.group ? (spec.group.name || spec.group.id) : '',
      documentName: getDocumentName(spec),
      pageNumber: spec.pageNumber
    });
    pane.style.display = 'block';
    return true;
  }

  function open(target, option) {
    var point = option && (option.displayedContentTarget || option.contentTarget || option.contentTargetPoint || option.displayedPageMarker || option.contentsPoint);
    var spec;

    if (point && openMarker(point)) {
      return true;
    }

    spec = getSpec(target);
    if (!spec) { return false; }
    if (spec.point) {
      return openMarker(spec.point);
    }
    return openAxis(spec.group);
  }

  function openContentTargetInInfo(point) {
    ensureInfoRoot();
    return openMarker(point);
  }

  function openContentsAxisInInfo(group) {
    ensureInfoRoot();
    return openAxis(group);
  }

  function getCurrentMarker() {
    return stateMap.point;
  }

  ns.open = open;
  ns.openAxis = openAxis;
  ns.openMarker = openMarker;
  ns.close = close;
  ns.canOpen = canOpen;
  ns.getCurrentMarker = getCurrentMarker;
  ns.openContentTargetInInfo = openContentTargetInInfo;
  ns.openPageMarkerInInfo = openContentTargetInInfo
  ns.openContentsAxisInInfo = openContentsAxisInInfo;
  wuwei.info.openContentTargetInInfo = openContentTargetInInfo;
  wuwei.info.openPageMarkerInInfo = openContentTargetInInfo
  wuwei.info.openContentsAxisInInfo = openContentsAxisInInfo;
})(wuwei.info.contents);
