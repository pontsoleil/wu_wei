/**
 * video.template.js
 * modal player template for WuWei video player
 */
wuwei.menu = wuwei.menu || {};
wuwei.menu.video = wuwei.menu.video || {};
wuwei.menu.video.template = (function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function template(param) {
    param = param || {};
    return '' +
      '<div id="videoModal" class="video-modal" style="display:none;position:fixed;inset:0;z-index:9999;">' +
        '<div id="videoModalBackdrop" style="position:absolute;inset:0;background:rgba(0,0,0,.55);"></div>' +
        '<div class="video-modal-dialog" style="position:relative;max-width:1080px;margin:3vh auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.3);">' +
          '<div class="video-modal-header" style="display:flex;align-items:center;justify-content:space-between;padding:.75rem 1rem;border-bottom:1px solid #ddd;">' +
            '<div class="video-modal-title"><span class="title">' + esc(param.title || 'Video player') + '</span></div>' +
            '<button type="button" id="videoModalClose" style="font-size:1.5rem;background:none;border:none;cursor:pointer;">×</button>' +
          '</div>' +
          '<div class="video-modal-body" style="padding:0;background:#000;">' +
            '<div id="videoPlayerHost"></div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  return { template: template };
})();
