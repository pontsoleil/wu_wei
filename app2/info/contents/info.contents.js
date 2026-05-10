/**
 * info.contents.js
 * contents axis and PageMarker info controller
 */
wuwei.info = wuwei.info || {};
wuwei.info.contents = wuwei.info.contents || {};

(function (ns) {
  'use strict';

  var contents = wuwei.contents;
  var model = wuwei.model;
  var stateMap = { point: null, group: null };

  function ensurePane() {
    var infoPane = document.getElementById('info');
    var pane = document.getElementById('info-contents');
    if (pane) { return pane; }
    if (!infoPane || !wuwei.info.contents.markup) { return null; }
    infoPane.insertAdjacentHTML('beforeend', wuwei.info.contents.markup.paneTemplate());
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
    return contents && typeof contents.getPageTargetSpec === 'function'
      ? contents.getPageTargetSpec(target)
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
    stateMap.group = group;
    stateMap.point = null;

    pane.innerHTML = wuwei.info.contents.markup.axisTemplate({
      group: group,
      documentName: getDocumentName(spec),
      markerCount: Array.isArray(group.members) ? group.members.length : 0,
      pageCount: group.pageCount || (group.axis && group.axis.end) || ''
    });
    pane.style.display = 'block';
    return true;
  }

  function openMarker(pointOrTarget) {
    var spec = getSpec(pointOrTarget);
    var pane = ensurePane();

    if (!pane || !spec || !spec.point) { return false; }
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
    var point = option && (option.displayedPageMarker || option.contentsPoint);
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

  function openPageMarkerInInfo(point) {
    var infoPane = document.getElementById('info');
    var editPane = document.getElementById('edit');

    if (editPane) { editPane.style.display = 'none'; }
    if (wuwei.info && wuwei.info.markup && infoPane) {
      infoPane.innerHTML = wuwei.info.markup.template();
      infoPane.style.display = 'block';
    }
    return openMarker(point);
  }

  function openContentsAxisInInfo(group) {
    var infoPane = document.getElementById('info');
    var editPane = document.getElementById('edit');

    if (editPane) { editPane.style.display = 'none'; }
    if (wuwei.info && wuwei.info.markup && infoPane) {
      infoPane.innerHTML = wuwei.info.markup.template();
      infoPane.style.display = 'block';
    }
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
  ns.openPageMarkerInInfo = openPageMarkerInInfo;
  ns.openContentsAxisInInfo = openContentsAxisInInfo;
  wuwei.info.openPageMarkerInInfo = openPageMarkerInInfo;
  wuwei.info.openContentsAxisInInfo = openContentsAxisInInfo;
})(wuwei.info.contents);
