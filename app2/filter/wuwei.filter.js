/**
 * wuwei.filter.js
 * Display-state filter module.  The UI is provided by the Search pane.
 */
wuwei.filter = (function () {
  var graph;
  var model;
  var draw;
  var common;

  function getCurrentPage() {
    return common && common.current ? common.current.page || null : null;
  }

  function refresh() {
    if (!draw) { return; }
    if (graph && graph.mode === 'simulation' && typeof draw.restart === 'function') {
      draw.restart();
    }
    else if (typeof draw.refresh === 'function') {
      draw.refresh();
    }
    else if (typeof draw.reRender === 'function') {
      draw.reRender();
    }
  }

  function forEachPageObject(callback) {
    var page = getCurrentPage();
    if (!page || typeof callback !== 'function') { return; }
    (page.nodes || []).forEach(callback);
    (page.links || []).forEach(callback);
    (page.groups || []).forEach(callback);
  }

  function showAllPageData() {
    forEachPageObject(function (obj) {
      if (!obj) { return; }
      obj.visible = true;
      obj.filterout = false;
      obj.changed = true;
    });
    refresh();
  }

  function setLinkVisibilityFromNodes(page) {
    if (!page) { return; }
    (page.links || []).forEach(function (link) {
      var fromId = link.from;
      var toId = link.to;
      var fromNode = model && typeof model.findNodeById === 'function' ? model.findNodeById(fromId) : null;
      var toNode = model && typeof model.findNodeById === 'function' ? model.findNodeById(toId) : null;
      if (fromNode && fromNode.visible === false || toNode && toNode.visible === false) {
        link.visible = false;
      }
      link.changed = true;
    });
  }

  function showMatching(condition) {
    var page = getCurrentPage();
    var matcher = wuwei.search && wuwei.search.this_note && wuwei.search.this_note.matchesObject;
    if (!page || typeof matcher !== 'function') { return; }
    (page.nodes || []).forEach(function (node) {
      node.visible = !!matcher(node, condition || {});
      node.filterout = false;
      node.changed = true;
    });
    (page.groups || []).forEach(function (group) {
      group.visible = !!matcher(group, condition || {});
      group.filterout = false;
      group.changed = true;
    });
    (page.links || []).forEach(function (link) {
      link.visible = !!matcher(link, condition || {});
      link.filterout = false;
      link.changed = true;
    });
    setLinkVisibilityFromNodes(page);
    refresh();
  }

  function hideMatching(condition) {
    var page = getCurrentPage();
    var matcher = wuwei.search && wuwei.search.this_note && wuwei.search.this_note.matchesObject;
    if (!page || typeof matcher !== 'function') { return; }
    (page.nodes || []).forEach(function (node) {
      if (matcher(node, condition || {})) {
        node.visible = false;
        node.changed = true;
      }
    });
    (page.groups || []).forEach(function (group) {
      if (matcher(group, condition || {})) {
        group.visible = false;
        group.changed = true;
      }
    });
    (page.links || []).forEach(function (link) {
      if (matcher(link, condition || {})) {
        link.visible = false;
        link.changed = true;
      }
    });
    setLinkVisibilityFromNodes(page);
    refresh();
  }

  function hideAll() {
    forEachPageObject(function (obj) {
      obj.visible = false;
      obj.changed = true;
    });
    refresh();
  }

  function open() {
    if (wuwei.search && typeof wuwei.search.open === 'function') {
      wuwei.search.open('filter');
    }
  }

  function close() {
    var pane = document.getElementById('filter');
    if (pane) { pane.style.display = 'none'; }
  }

  function initModule() {
    graph = wuwei.common.graph;
    model = wuwei.model;
    draw = wuwei.draw;
    common = wuwei.common;
  }

  return {
    open: open,
    close: close,
    showAll: showAllPageData,
    showAllPageData: showAllPageData,
    showMatching: showMatching,
    hideMatching: hideMatching,
    hideAll: hideAll,
    filterRender: refresh,
    initModule: initModule
  };
})();
// wuwei.filter.js
