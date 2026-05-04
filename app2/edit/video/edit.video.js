/**
 * edit.video.js
 * edit.video module with iframe preview for hosted videos
 * 
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.edit = wuwei.edit || {};
wuwei.edit.video = wuwei.edit.video || {};

( function (ns) {
  const common = wuwei.common;
  const model = wuwei.model;
  const draw = wuwei.draw;

  function initColorPalettePicker(param) {
    $('#nodeColor').colorPalettePicker({ lines: 4, bootstrap: 4, dropdownTitle: '標準色', buttonClass: 'btn btn-light btn-sm dropdown-toggle', buttonPreviewName: 'nodeColorPaletteSelected', onSelected: function (color) { var input = document.getElementById('nColor'); if (input) { input.value = color; input.dispatchEvent(new Event('change', { bubbles: true })); } } });
    $('#nodeFont_color').colorPalettePicker({ lines: 4, bootstrap: 4, dropdownTitle: '標準色', buttonClass: 'btn btn-light btn-sm dropdown-toggle', buttonPreviewName: 'textColorPaletteSelected', onSelected: function (color) { var input = document.getElementById('nFont_color'); if (input) { input.value = color; input.dispatchEvent(new Event('change', { bubbles: true })); } } });
  }

  function toAbsUri(resourceUri) {
    if (!resourceUri) return '';
    if (/^(https?:|blob:|data:)/i.test(resourceUri)) return resourceUri;
    if (resourceUri.startsWith('/')) return resourceUri;
    let base_url = '';
    try {
      const m = location.href && location.href.match(/^(.*)\/index\.html(.*)$/);
      base_url = m ? m[1] : location.href.substr(0, location.href.lastIndexOf('/'));
    } catch (e) { base_url = ''; }
    return base_url ? `${base_url}/${resourceUri}` : resourceUri;
  }

  function isHostedVideoUrl(url) {
    var s = String(url || '').toLowerCase();
    return (/^https?:\/\/(www\.)?(youtube\.com|m\.youtube\.com|youtu\.be)\b/.test(s) || /^https?:\/\/(www\.)?(vimeo\.com|player\.vimeo\.com)\b/.test(s));
  }
  function parseTimeToSeconds(s) {
    if (s == null) return 0; const str = String(s).trim(); if (!str) return 0; if (/^\d+(\.\d+)?$/.test(str)) return Math.max(0, parseFloat(str)); const parts = str.split(':').map(p => p.trim()); if (parts.some(p => p === '' || isNaN(p))) return 0; let sec = 0; if (parts.length === 3) sec = (+parts[0]) * 3600 + (+parts[1]) * 60 + (+parts[2]); else if (parts.length === 2) sec = (+parts[0]) * 60 + (+parts[1]); else sec = +parts[0]; return Math.max(0, sec);
  }
  function formatSeconds(sec) { sec = Math.max(0, Number(sec) || 0); const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60); const s = Math.floor(sec % 60); return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }
  function getMediaDuration(resource, node) {
    const res = getResource(node, resource);
    const media = res && res.media && typeof res.media === 'object' ? res.media : {};
    const range = getTimeRange(node);
    const values = [
      res && res.duration,
      media.duration,
      range && range.end
    ];
    for (let i = 0; i < values.length; i += 1) {
      const duration = Number(values[i]);
      if (Number.isFinite(duration) && duration > 0) {
        return duration;
      }
    }
    return 0;
  }
  function getResource(node, fallback) {
    return (node && node.resource && typeof node.resource === 'object')
      ? node.resource
      : (fallback || {});
  }
  function getTimeRange(node) {
    return (node && node.timeRange && typeof node.timeRange === 'object')
      ? node.timeRange
      : {};
  }
  function ensureTimeRange(node) {
    if (!node.timeRange || typeof node.timeRange !== 'object') {
      node.timeRange = {};
    }
    if (!Number.isFinite(Number(node.timeRange.start))) {
      node.timeRange.start = 0;
    }
    if (!Object.prototype.hasOwnProperty.call(node.timeRange, 'end')) {
      node.timeRange.end = null;
    }
    return node.timeRange;
  }
  function isVideo(resource, node) { const res = getResource(node, resource); const resourceMimeType = String(res.mimeType || '').toLowerCase(); const resourceUri = String(res.canonicalUri || res.uri || '').toLowerCase(); const resourceKind = String(res.kind || '').toLowerCase(); return resourceKind === 'video' || resourceMimeType.startsWith('video/') || /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/.test(resourceUri) || isHostedVideoUrl(resourceUri); }
  function extractYouTubeId(url) { const s = String(url || ''); let m = s.match(/[?&]v=([A-Za-z0-9_-]{11})/); if (m) return m[1]; m = s.match(/youtu\.be\/([A-Za-z0-9_-]{11})/); if (m) return m[1]; m = s.match(/youtube\.com\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/); return m ? m[1] : ''; }
  function extractVimeoId(url) { const s = String(url || ''); const m = s.match(/vimeo\.com\/(?:video\/)?([0-9]+)/); return m ? m[1] : ''; }
  function buildPreview(resource, node) {
    const res = getResource(node, resource);
    const source = wuwei.video && typeof wuwei.video.detectSource === 'function'
      ? wuwei.video.detectSource({ resource: res })
      : null;
    const resourceUri = toAbsUri((res && (res.canonicalUri || res.uri)) || '');
    const range = getTimeRange(node);
    const start = Number(range.start || 0);
    if (source && source.provider === 'youtube') return { hosted: true, html: '<iframe src="https://www.youtube.com/embed/' + encodeURIComponent(source.id || extractYouTubeId(resourceUri)) + '?playsinline=1&rel=0&start=' + Math.floor(start) + '" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen style="width:100%;aspect-ratio:16/9;"></iframe>' };
    if (source && source.provider === 'vimeo') return { hosted: true, html: '<iframe src="https://player.vimeo.com/video/' + encodeURIComponent(source.id || extractVimeoId(resourceUri)) + (source.h ? ('?h=' + encodeURIComponent(source.h)) : '') + '#t=' + Math.floor(start) + 's" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen style="width:100%;aspect-ratio:16/9;"></iframe>' };
    return { hosted: false, html: '<video id="editVideoPlayer" controls playsinline preload="metadata" src="' + encodeURI(resourceUri) + '" style="width:100%;height:auto;"></video>' };
  }

  function setNodeMediaDuration(node, resource, duration) {
    const value = Number(duration);
    if (!Number.isFinite(value) || value <= 0) {
      return false;
    }
    resource = getResource(node, resource);
    if (node) {
      node.resource = resource;
    }
    resource.duration = value;
    resource.media = (resource.media && typeof resource.media === 'object') ? resource.media : {};
    resource.media.duration = value;
    if (node) {
      if (!node.timeRange || typeof node.timeRange !== 'object') {
        node.timeRange = {};
      }
      if (node.timeRange.end == null || !Number.isFinite(Number(node.timeRange.end)) || Number(node.timeRange.end) <= 0) {
        node.timeRange.end = value;
      }
      node.changed = true;
    }
    return true;
  }

  function syncDurationDisplayFromNode(node, resource) {
    const el = document.getElementById('editVideoDuration');
    if (el) {
      el.textContent = formatSeconds(getMediaDuration(resource, node));
    }
  }

  function applyResolvedDurationToNodeAndPane(node, resource, duration) {
    if (setNodeMediaDuration(node, resource, duration)) {
      syncDurationDisplayFromNode(node, resource);
    }
  }

  function resolveDurationForDisplay(node, resource, hosted) {
    const current = getMediaDuration(resource, node);
    const player = document.getElementById('editVideoPlayer');
    if (current > 0) {
      applyResolvedDurationToNodeAndPane(node, resource, current);
      return;
    }
    if (!hosted && player) {
      player.addEventListener('loadedmetadata', function onMeta() {
        player.removeEventListener('loadedmetadata', onMeta);
        applyResolvedDurationToNodeAndPane(node, resource, Number(player.duration || 0));
      });
      return;
    }
    if (wuwei.timeline && typeof wuwei.timeline.resolveMediaDuration === 'function') {
      wuwei.timeline.resolveMediaDuration(node).then(function (duration) {
        applyResolvedDurationToNodeAndPane(node, resource, duration);
      }).catch(function () { });
    }
  }

  function wireVideoControls(param, hosted) {
    const node = param.node;
    const range = ensureTimeRange(node);
    const player = document.getElementById('editVideoPlayer');
    const startI = document.getElementById('editVideoStart');
    const endI = document.getElementById('editVideoEnd');
    if (!startI || !endI) {
      document.getElementById('editVideoOpenPlayer')?.addEventListener('click', () => { if (window.wuwei && wuwei.menu && wuwei.menu.video && typeof wuwei.menu.video.open === 'function') wuwei.menu.video.open(node); });
      return;
    }
    startI.value = formatSeconds(range.start || 0); endI.value = (range.end == null) ? '' : formatSeconds(range.end);
    function parseEndOrNull(str) { const s = String(str || '').trim(); if (!s) return null; const v = parseTimeToSeconds(s); return Number.isFinite(v) ? v : null; }
    if (!hosted && player) {
      player.addEventListener('loadedmetadata', function onMeta() { player.removeEventListener('loadedmetadata', onMeta); try { player.currentTime = parseTimeToSeconds(startI.value); } catch (e) {} });
      player.addEventListener('timeupdate', function () { const endVal = parseEndOrNull(endI.value); if (endVal != null && player.currentTime >= endVal) player.pause(); });
    }
    document.getElementById('editVideoJumpStart')?.addEventListener('click', () => { if (player) player.currentTime = parseTimeToSeconds(startI.value); });
    document.getElementById('editVideoJumpEnd')?.addEventListener('click', () => { const e = parseEndOrNull(endI.value); if (player && e != null) player.currentTime = e; });
    document.getElementById('editVideoSetStartHere')?.addEventListener('click', () => { if (player) startI.value = formatSeconds(player.currentTime || 0); });
    document.getElementById('editVideoSetEndHere')?.addEventListener('click', () => { if (player) endI.value = formatSeconds(player.currentTime || 0); });
    document.getElementById('editVideoClearEnd')?.addEventListener('click', () => { endI.value = ''; });
    document.getElementById('editVideoSaveRange')?.addEventListener('click', () => { const targetRange = ensureTimeRange(node); targetRange.start = parseTimeToSeconds(startI.value); targetRange.end = parseEndOrNull(endI.value); node.changed = true; if (model && typeof model.updateNode === 'function') model.updateNode(node); if (draw && typeof draw.refresh === 'function') draw.refresh(); });
    document.getElementById('editVideoOpenPlayer')?.addEventListener('click', () => { if (window.wuwei && wuwei.menu && wuwei.menu.video && typeof wuwei.menu.video.open === 'function') wuwei.menu.video.open(node); });
  }

  function open(param) {
    if (param.option === undefined) param.option = {};
    return new Promise((resolve) => {
      const node = param.node;
      const resource = getResource(node, param.resource);
      const range = ensureTimeRange(node);
      const preview = buildPreview(resource, node);
      const duration = getMediaDuration(resource, node);
      const el = document.getElementById('edit-video');
      el.innerHTML = wuwei.edit.video.markup.template(param = Object.assign({}, param, { resource: resource, previewHtml: preview.html, hosted: preview.hosted, startStr: formatSeconds(range.start || 0), endStr: range.end == null ? '' : formatSeconds(range.end), durationStr: formatSeconds(duration) }));
      el.style.display = 'block';
      initColorPalettePicker(param);
      resolveDurationForDisplay(node, resource, preview.hosted);
      if (isVideo(resource, node)) wireVideoControls(param, preview.hosted);
      resolve(el);
    });
  }
  function close() { const el = document.getElementById('edit-video'); if (el) { el.innerHTML = ''; el.style.display = 'none'; } }

  ns.open = open;
  ns.close = close;
})(wuwei.edit.video);
// edit.video.js last modified 2026-04-07
