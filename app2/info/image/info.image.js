/**
 * info.image.js
 * info.image module
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.info = wuwei.info || {};
wuwei.info.image = wuwei.info.image || {};

(function (ns) {
  'use strict';

  function getResource(node) {
    if (wuwei.resource && typeof wuwei.resource.getResource === 'function') {
      return wuwei.resource.getResource(node);
    }
    return (node && node.resource && typeof node.resource === 'object') ? node.resource : {};
  }

  function getImageUrl(node) {
    if (wuwei.resource && typeof wuwei.resource.getPrimaryPreviewUrl === 'function') {
      return wuwei.resource.getPrimaryPreviewUrl(node) || '';
    }
    if (wuwei.resource && typeof wuwei.resource.getOriginalUrl === 'function') {
      return wuwei.resource.getOriginalUrl(node) || '';
    }
    var resource = getResource(node);
    return String(resource.canonicalUri || resource.uri || '');
  }

  function wireEvents(src) {
    var openLink = document.getElementById('infoImageOpen');
    if (openLink) {
      openLink.addEventListener('click', function () {
        if (wuwei.info && typeof wuwei.info.openWindow === 'function') {
          wuwei.info.openWindow(src, 'wuwei_image', 'width=900,height=700,menubar=no,location=no,resizable=yes,scrollbars=yes,status=no');
        }
      }, false);
    }
  }

  function canOpen(node) {
    return !!(node && wuwei.resource && typeof wuwei.resource.isImage === 'function' && wuwei.resource.isImage(node));
  }

  function open(param) {
    param = param || {};
    var node = param.node || param;
    var src = getImageUrl(node);
    var pane = document.getElementById('info-image');
    if (!pane) {
      return false;
    }
    pane.innerHTML = wuwei.info.image.markup.template({
      node: node,
      resource: getResource(node),
      src: src,
      option: param.option || {}
    });
    pane.style.display = 'block';
    return true;
  }

  function close() {
    var pane = document.getElementById('info-image');
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
})(wuwei.info.image);
// info.image.js
