/**
 * edit.video.js
 * edit.video module (separated from edit.uploaded)
 *
 * - shows embedded <video> preview
 * - edits node.media.start/end (seconds)
 */
wuwei.edit.video = (function () {
  const common = wuwei.common;
  const state = common.state;
  const util = wuwei.util;
  const model = wuwei.model;
  const draw = wuwei.draw;

  function initColorPalettePicker(param) {
    $('#nodeColor').colorPalettePicker({
      lines: 4,
      bootstrap: 4,
      dropdownTitle: '標準色',
      buttonClass: 'btn btn-light btn-sm dropdown-toggle',
      buttonPreviewName: 'nodeColorPaletteSelected',
      onSelected: function (color) {
        document.getElementById('nColor').value = color;
        param.node.color = color;
      }
    });
    $('#nodeFont_color').colorPalettePicker({
      lines: 4,
      bootstrap: 4,
      dropdownTitle: '標準色',
      buttonClass: 'btn btn-light btn-sm dropdown-toggle',
      buttonPreviewName: 'textColorPaletteSelected',
      onSelected: function (color) {
        document.getElementById('nFont_color').value = color;
        param.node.font.color = color;
      }
    });
  }

  // Resolve relative URIs under subpath (.../index.html)
  function toAbsUri(uri) {
    if (!uri) return '';
    if (/^https?:\/\//i.test(uri)) return uri;
    if (uri.startsWith('/')) return uri;
    let base_url = '';
    try {
      const m = location.href && location.href.match(/^(.*)\/index\.html(.*)$/);
      base_url = m ? m[1] : location.href.substr(0, location.href.lastIndexOf('/'));
    } catch (e) { base_url = ''; }
    return base_url ? `${base_url}/${uri}` : uri;
  }

  function parseTimeToSeconds(s) {
    if (s == null) return 0;
    const str = String(s).trim();
    if (!str) return 0;
    if (/^\d+(\.\d+)?$/.test(str)) return Math.max(0, parseFloat(str));
    const parts = str.split(':').map(p => p.trim());
    if (parts.some(p => p === '' || isNaN(p))) return 0;
    let sec = 0;
    if (parts.length === 3) sec = (+parts[0]) * 3600 + (+parts[1]) * 60 + (+parts[2]);
    else if (parts.length === 2) sec = (+parts[0]) * 60 + (+parts[1]);
    else sec = +parts[0];
    return Math.max(0, sec);
  }

  function formatSeconds(sec) {
    sec = Math.max(0, Number(sec) || 0);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    let ss = (Math.round(s * 1000) / 1000).toString();
    if (ss.indexOf('.') >= 0) ss = ss.replace(/0+$/, '').replace(/\.$/, '');
    ss = ss.padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  function isVideo(resource, node) {
    const fmt = ((resource && (resource.format || resource.contenttype)) || (node && node.format) || '').toLowerCase();
    const uri = ((resource && (resource.uri || resource.url)) || (node && (node.uri || node.url)) || '').toLowerCase();
    return fmt.startsWith('video/') || /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/.test(uri);
  }

  function ensureMedia(node) {
    if (!node.media || typeof node.media !== 'object') node.media = {};
    if (!Number.isFinite(Number(node.media.start))) node.media.start = 0;
    if (!('end' in node.media)) {
      const dur = node.value && node.value.duration != null ? parseFloat(node.value.duration) : NaN;
      node.media.end = Number.isFinite(dur) ? dur : null;
    }
  }

  function wireVideoControls(param) {
    const node = param.node;
    const resource = param.resource || node;
    ensureMedia(node);

    const player = document.getElementById('editVideoPlayer');
    const startI = document.getElementById('editVideoStart');
    const endI   = document.getElementById('editVideoEnd');
    const uriI   = document.getElementById('rUri');

    if (!player) return;

    // display as HH:MM:SS
    startI.value = formatSeconds(node.media.start || 0);
    endI.value = (node.media.end == null) ? '' : formatSeconds(node.media.end);

    function loadFromUri() {
      const uri = (uriI && uriI.value) ? uriI.value : (resource.uri || resource.url || '');
      const src = toAbsUri(uri);
      player.pause();
      player.removeAttribute('src');
      player.load();
      player.src = src;
      // once metadata ready, seek to start
      player.addEventListener('loadedmetadata', function onMeta() {
        player.removeEventListener('loadedmetadata', onMeta);
        try { player.currentTime = parseTimeToSeconds(startI.value); } catch (e) {}
      });
      // force load
      player.load();
    }

    loadFromUri();

    // update preview when url changes
    if (uriI) {
      uriI.addEventListener('change', loadFromUri);
      uriI.addEventListener('blur', loadFromUri);
    }

    function parseEndOrNull(str) {
      const s = String(str || '').trim();
      if (!s) return null;
      const v = parseTimeToSeconds(s);
      return Number.isFinite(v) ? v : null;
    }

    // stop at end if set
    const onTimeUpdate = () => {
      const endVal = parseEndOrNull(endI.value);
      if (endVal != null && player.currentTime >= endVal) {
        player.pause();
      }
    };
    player.addEventListener('timeupdate', onTimeUpdate);

    // buttons
    document.getElementById('editVideoJumpStart')?.addEventListener('click', () => {
      player.currentTime = parseTimeToSeconds(startI.value);
    });
    document.getElementById('editVideoJumpEnd')?.addEventListener('click', () => {
      const e = parseEndOrNull(endI.value);
      if (e != null) player.currentTime = e;
    });
    document.getElementById('editVideoSetStartHere')?.addEventListener('click', () => {
      startI.value = formatSeconds(player.currentTime || 0);
    });
    document.getElementById('editVideoSetEndHere')?.addEventListener('click', () => {
      endI.value = formatSeconds(player.currentTime || 0);
    });
    document.getElementById('editVideoClearEnd')?.addEventListener('click', () => {
      endI.value = '';
    });

    document.getElementById('editVideoSaveRange')?.addEventListener('click', () => {
      node.media.start = parseTimeToSeconds(startI.value);
      node.media.end = parseEndOrNull(endI.value);
      node.changed = true;
      if (model && typeof model.updateNode === 'function') model.updateNode(node);
      if (draw && typeof draw.refresh === 'function') draw.refresh();
    });

    document.getElementById('editVideoOpenPlayer')?.addEventListener('click', () => {
      if (window.wuwei && wuwei.video && typeof wuwei.video.open === 'function') {
        wuwei.video.open(node);
      }
    });
  }

  function open(param) {
    if (param.option === undefined) param.option = {};
    return new Promise((resolve) => {
      const el = document.getElementById('edit-video');
      el.innerHTML = wuwei.edit.video.markup.template(param);
      el.style.display = 'block';
    
      initColorPalettePicker(param);
      // only wire when it is video upload
      if (isVideo(param.resource, param.node)) {
        wireVideoControls(param);
      }
      resolve(el);
    });
  }

  function close() {
    const el = document.getElementById('edit-video');
    if (el) {
      el.innerHTML = '';
      el.style.display = 'none';
    }
  }

  function initModule() {}

  return {
    open: open,
    close: close,
    initModule: initModule
  };
})();

