/**
 * info.group.js
 * group information pane
 */
wuwei.info = wuwei.info || {};
wuwei.info.group = wuwei.info.group || {};

(function (ns) {
  'use strict';

  function resolveGroup(target) {
    if (!target) {
      return null;
    }
    if (wuwei.model && typeof wuwei.model.findGroupByTarget === 'function') {
      return wuwei.model.findGroupByTarget(target);
    }
    if (target.groupRef && wuwei.model && typeof wuwei.model.findGroupById === 'function') {
      return wuwei.model.findGroupById(target.groupRef);
    }
    if (target.id && wuwei.model && typeof wuwei.model.findGroupById === 'function') {
      return wuwei.model.findGroupById(target.id);
    }
    return null;
  }

  function canOpen(target) {
    return !!resolveGroup(target);
  }

  function open(param) {
    var pane = document.getElementById('info-group');
    var group = resolveGroup(param && param.node ? param.node : param);

    if (!pane || !group || !wuwei.info.group.markup) {
      return false;
    }

    pane.innerHTML = wuwei.info.group.markup.template({ group: group });
    pane.style.display = 'block';
    return true;
  }

  function close() {
    var pane = document.getElementById('info-group');
    if (pane) {
      pane.innerHTML = '';
      pane.style.display = 'none';
    }
  }

  function initModule() { }

  ns.canOpen = canOpen;
  ns.open = open;
  ns.close = close;
  ns.initModule = initModule;
})(wuwei.info.group);
