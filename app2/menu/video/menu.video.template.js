/**
 * menu.video.template.js
 * Modal player templates for uploaded video / YouTube / Vimeo.
 */
wuwei.menu = wuwei.menu || {};
wuwei.menu.video = wuwei.menu.video || {};
wuwei.menu.video.template = (function () {
  'use strict';

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function stripQueryAndHash(value) {
    return String(value || '').split('#')[0].split('?')[0];
  }

  function modal(param) {
    param = param || {};
    return [
      '<div id="videoModal" class="video-modal" style="display:none;position:fixed;inset:0;z-index:9999;">',
        '<div id="videoModalBackdrop" style="position:absolute;inset:0;background:rgba(0,0,0,.55);"></div>',
        '<div class="video-modal-dialog" style="position:relative;max-width:1080px;margin:3vh auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.3);">',
          '<div class="video-modal-header" style="display:flex;align-items:center;justify-content:space-between;padding:.75rem 1rem;border-bottom:1px solid #ddd;">',
            '<div class="video-modal-title"><span class="title">' + esc(param.title || 'Video player') + '</span></div>',
            '<button type="button" id="videoModalClose" aria-label="Close" style="font-size:1.5rem;background:none;border:none;cursor:pointer;">x</button>',
          '</div>',
          '<div class="video-modal-body" style="padding:0;background:#000;">',
            '<div id="videoPlayerHost"></div>',
          '</div>',
        '</div>',
      '</div>'
    ].join('');
  }

  function iframe(param) {
    param = param || {};
    return [
      '<iframe',
      ' class="' + esc(param.className || 'info-video-frame') + '"',
      ' src="' + esc(param.src || '') + '"',
      ' title="' + esc(param.title || 'video') + '"',
      ' allow="autoplay; fullscreen; picture-in-picture; encrypted-media"',
      ' allowfullscreen',
      ' frameborder="0"',
      ' style="display:block;width:100%;height:100%;border:0;background:#000;"',
      '></iframe>'
    ].join('');
  }

  function nativeVideo(param) {
    param = param || {};
    return [
      '<video class="' + esc(param.className || 'info-video-native') + '" controls preload="metadata"',
      param.poster ? ' poster="' + esc(stripQueryAndHash(param.poster)) + '"' : '',
      ' style="display:block;width:100%;height:100%;background:#000;"',
      '>',
      '<source src="' + esc(param.src || '') + '" type="' + esc(param.mimeType || 'video/mp4') + '">',
      '</video>'
    ].join('');
  }

  function html5Player(param) {
    param = param || {};
    return '<video id="' + esc(param.id || 'videoHtml5Player') +
      '" controls autoplay playsinline preload="metadata" src="' + esc(param.src || '') +
      '" style="display:block;width:100%;height:auto;max-height:80vh;"></video>';
  }

  function playerHolder(param) {
    param = param || {};
    return '<div id="' + esc(param.id || 'videoPlayerHolder') +
      '" style="width:100%;aspect-ratio:16/9;min-height:270px;"></div>';
  }

  function unsupported() {
    return '<div style="padding:1rem;background:#fff;">Unsupported video source</div>';
  }

  return {
    template: modal,
    modal: modal,
    iframe: iframe,
    nativeVideo: nativeVideo,
    html5Player: html5Player,
    playerHolder: playerHolder,
    unsupported: unsupported
  };
})();
