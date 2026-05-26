/**
 * info.audio.js
 * info.audio module
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.info = wuwei.info || {};
wuwei.info.audio = wuwei.info.audio || {};

(function (ns) {
  'use strict';

  function getResource(node) {
    if (wuwei.resource && typeof wuwei.resource.getResource === 'function') {
      return wuwei.resource.getResource(node);
    }
    return (node && node.resource && typeof node.resource === 'object') ? node.resource : {};
  }

  function formatSeconds(sec) {
    sec = Math.max(0, Number(sec) || 0);
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = Math.floor(sec % 60);
    return String(h).padStart(2, '0') + ':' +
      String(m).padStart(2, '0') + ':' +
      String(s).padStart(2, '0');
  }

  function getDuration(node) {
    if (wuwei.audio && typeof wuwei.audio.getDuration === 'function') {
      return wuwei.audio.getDuration(node);
    }
    var resource = getResource(node);
    var media = resource && resource.media && typeof resource.media === 'object' ? resource.media : {};
    var n = Number(media.durationSeconds || media.duration || resource.duration || 0);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function getAudioSource(node) {
    if (wuwei.audio && typeof wuwei.audio.getAudioSource === 'function') {
      return wuwei.audio.getAudioSource(node) || '';
    }
    if (wuwei.resource && typeof wuwei.resource.getPrimaryPreviewUrl === 'function') {
      return wuwei.resource.getPrimaryPreviewUrl(node) || '';
    }
    var resource = getResource(node);
    return String((resource.original && resource.original.url) || (resource.original && resource.original.url) || resource.uri || resource.canonicalUri || '');
  }

  function wireEvents(node, src) {
    var player = document.getElementById('infoAudioPlayer');
    var openLink = document.getElementById('infoAudioOpen');
    var duration = document.getElementById('infoAudioDuration');
    if (player && duration) {
      player.addEventListener('loadedmetadata', function () {
        if (Number.isFinite(Number(player.duration)) && Number(player.duration) > 0) {
          duration.textContent = formatSeconds(player.duration);
        }
      }, { once: true });
    }
    if (openLink) {
      openLink.addEventListener('click', function () {
        if (wuwei.info && typeof wuwei.info.openWindow === 'function') {
          wuwei.info.openWindow(src, 'wuwei_audio', 'width=600,height=320,menubar=no,location=no,resizable=yes,scrollbars=yes,status=no');
        }
      }, false);
    }
  }

  function canOpen(node) {
    return !!(node && wuwei.audio && typeof wuwei.audio.isAudioNode === 'function' && wuwei.audio.isAudioNode(node));
  }

  function open(param) {
    param = param || {};
    var node = param.node || param;
    var src = getAudioSource(node);
    var duration = getDuration(node);
    var pane = document.getElementById('info-audio');
    if (!pane) {
      return false;
    }
    pane.innerHTML = wuwei.info.audio.markup.template({
      node: node,
      resource: getResource(node),
      src: src,
      duration: duration,
      durationStr: formatSeconds(duration),
      option: param.option || {}
    });
    pane.style.display = 'block';
    wireEvents(node, src);
    return true;
  }

  function close() {
    var pane = document.getElementById('info-audio');
    if (pane) {
      pane.innerHTML = '';
      pane.style.display = 'none';
    }
  }

  function initModule() { }

  ns.canOpen = canOpen;
  ns.open = open;
  ns.close = close;
  ns.formatSeconds = formatSeconds;
  ns.initModule = initModule;
})(wuwei.info.audio);
// info.audio.js
