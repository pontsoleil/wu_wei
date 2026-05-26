/**
 * edit.pageMarker.js
 * PageMarker edit entry point.
 *
 * PageMarker-specific editing is routed here.  The concrete panel remains the
 * Contents PageMarker panel, while document page calculations are delegated to
 * wuwei.document through wuwei.contents.
 */
wuwei.edit = wuwei.edit || {};
wuwei.edit.pageMarker = wuwei.edit.pageMarker || {};

(function (ns) {
  'use strict';

  function canOpen(node) {
    return !!(node && (node.type === 'PageMarker' || node.topicKind === 'contents-page'));
  }

  function open(param) {
    if (wuwei.edit.contents && typeof wuwei.edit.contents.openPageMarker === 'function') {
      return wuwei.edit.contents.openPageMarker(param || {});
    }
    return Promise.resolve(null);
  }

  function close() {
    if (wuwei.edit.contents && typeof wuwei.edit.contents.close === 'function') {
      wuwei.edit.contents.close();
    }
  }

  ns.canOpen = canOpen;
  ns.open = open;
  ns.close = close;
  ns.initModule = function () { };
})(wuwei.edit.pageMarker);
// edit.pageMarker.js
