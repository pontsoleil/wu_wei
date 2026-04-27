/**
 * wuwei.video.js
 * modal video player with timeline segment start support
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
(function (root) {
  'use strict';

  var wuwei = root.wuwei = root.wuwei || {};
  wuwei.video = wuwei.video || {};

  function ensureModal() {
    var overlay = root.document.getElementById('video-modal');
    if (overlay) {
      return overlay;
    }

    overlay = root.document.createElement('div');
    overlay.id = 'video-modal';
    overlay.className = 'video-modal';
    overlay.style.cssText = [
      'display:none',
      'position:fixed',
      'inset:0',
      'z-index:3000',
      'background:rgba(0,0,0,0.8)'
    ].join(';');

    overlay.innerHTML = [
      '<div class="video-modal-dialog" style="position:absolute;left:5vw;top:6vh;width:90vw;height:88vh;background:#111;display:flex;flex-direction:column;">',
      '<div class="video-modal-toolbar" style="display:flex;justify-content:flex-end;padding:8px;">',
      '<button id="video-modal-close" type="button">close</button>',
      '</div>',
      '<div id="video-modal-body" style="flex:1;min-height:0;padding:8px;"></div>',
      '</div>'
    ].join('');

    root.document.body.appendChild(overlay);

    overlay.addEventListener('click', function (ev) {
      if (ev.target === overlay || ev.target.id === 'video-modal-close') {
        close();
      }
    }, false);

    return overlay;
  }

  function close() {
    var overlay = root.document.getElementById('video-modal');
    if (!overlay) {
      return;
    }
    var body = root.document.getElementById('video-modal-body');
    if (body) {
      body.innerHTML = '';
    }
    overlay.style.display = 'none';
  }

  function open(node, option) {
    option = option || {};
    var overlay = ensureModal();
    var body = root.document.getElementById('video-modal-body');
    if (!overlay || !body || !wuwei.video || !wuwei.video.markup || typeof wuwei.video.markup.render !== 'function') {
      return false;
    }

    body.innerHTML = wuwei.video.markup.render(node, option, 'modal');
    overlay.style.display = 'block';

    var nativeVideo = body.querySelector('video');
    if (nativeVideo && wuwei.info && wuwei.info.video && typeof wuwei.info.video.seekNativeVideo === 'function') {
      wuwei.info.video.seekNativeVideo(nativeVideo, option.startSeconds);
    }
    return true;
  }

  wuwei.video.open = open;
  wuwei.video.close = close;
})(window);
