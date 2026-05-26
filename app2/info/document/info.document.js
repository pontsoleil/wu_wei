/**
 * info.document.js
 * Document info pane controller.
 */
wuwei.info = wuwei.info || {};
wuwei.info.document = wuwei.info.document || {};

(function (ns) {
  'use strict';

  function canOpen(node) {
    return !!(node && node.type === 'Content' && wuwei.document &&
      typeof wuwei.document.isDocumentNode === 'function' &&
      wuwei.document.isDocumentNode(node));
  }

  function open(param) {
    var el = document.getElementById('info-document');
    if (el) {
      el.innerHTML = wuwei.info.document.markup.template(param || {});
      el.style.display = 'block';
    }
  }

  function close() {
    var el = document.getElementById('info-document');
    if (el) {
      el.innerHTML = '';
      el.style.display = 'none';
    }
  }

  ns.canOpen = canOpen;
  ns.open = open;
  ns.close = close;
  ns.initModule = function () { };
})(wuwei.info.document);
// info.document.js
