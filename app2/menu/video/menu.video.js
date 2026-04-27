/**
 * video.js
 * modal player for uploaded video / YouTube / Vimeo
 */
wuwei.menu = wuwei.menu || {};
wuwei.menu.video = wuwei.menu.video || {};

( function (ns) {
  'use strict';

  var stateMap = {
    node: null,
    provider: '',
    html5Player: null,
    youtubePlayer: null,
    vimeoPlayer: null,
    endWatchTimer: null,
    youtubeApiLoading: null,
    vimeoApiLoading: null
  };

  function toAbsUrl(href) {
    if (!href) return '';
    if (/^(https?:|blob:|data:)/i.test(href)) return href;
    if (href.charAt(0) === '/') return href;
    return location.href.slice(0, location.href.lastIndexOf('/') + 1) + href.replace(/^\.\//, '');
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;'); }
  function isYoutube(url) {
    return /^https?:\/\/(www\.)?(youtube\.com|m\.youtube\.com|youtu\.be)\b/i.test(String(url || ''));
  }
  function isVimeo(url) {
    return /^https?:\/\/(www\.)?(vimeo\.com|player\.vimeo\.com)\b/i.test(String(url || ''));
  }
  function extractYouTubeId(url) {
    var s = String(url || '');
    var m = s.match(/[?&]v=([A-Za-z0-9_-]{11})/);
    if (m) return m[1];
    m = s.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
    if (m) return m[1];
    m = s.match(/youtube\.com\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/); return m ? m[1] : '';
  }
  function extractVimeoId(url) {
    var s = String(url || '');
    var m = s.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
    return m ? m[1] : '';
  }
  function getResource(node) {
    return (node && node.resource && typeof node.resource === 'object') ? node.resource : {};
  }
  function getTimeRange(node) {
    return (node && node.timeRange && typeof node.timeRange === 'object') ? node.timeRange : {};
  }
  function detectSource(node) {
    var resource = getResource(node);
    var url = String(resource.canonicalUri || resource.uri || '');
    var kind = String(resource.kind || '').toLowerCase();
    var format = String(resource.mimeType || '').toLowerCase();
    if (isYoutube(url)) {
      return { provider: 'youtube', id: extractYouTubeId(url), url: url };
    }
    if (isVimeo(url)) {
      return { provider: 'vimeo', id: extractVimeoId(url), url: url };
    }
    if (kind === 'video' || format.indexOf('video/') === 0 || /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(url)) {
      return { provider: 'html5', src: toAbsUrl(url), url: url };
    }
    return { provider: 'unknown', url: url }; }
  function stopEndWatch() {
    if (stateMap.endWatchTimer) {
      clearInterval(stateMap.endWatchTimer);
      stateMap.endWatchTimer = null;
    }
  }
  function startEndWatch(provider, api, endSec) {
    stopEndWatch(); endSec = Number(endSec);
    if (!Number.isFinite(endSec) || endSec <= 0)
      return;
    stateMap.endWatchTimer = window.setInterval(function () {
      if (!api) {
        stopEndWatch(); return;
      }
      if (provider === 'html5') {
        if (Number(api.currentTime || 0) >= endSec) {
          api.pause(); stopEndWatch(); } return;
        }
      if (provider === 'youtube') {
        try {
          if (Number(api.getCurrentTime() || 0) >= endSec) {
            api.pauseVideo(); stopEndWatch();
          }
        }
        catch (e) { } 
        return;
      }
      if (provider === 'vimeo') {
        api.getCurrentTime()
          .then(function (sec) {
            if (Number(sec) >= endSec) {
              api.pause(); stopEndWatch();
            }
          })
          .catch(function () { });
      }
    }, 200);
  }
  function cleanup() {
    stopEndWatch();
    if (stateMap.html5Player) {
      try {
        stateMap.html5Player.pause();
      }
      catch (e) { } 
      stateMap.html5Player = null;
    }
    if (stateMap.youtubePlayer) {
      try {
        stateMap.youtubePlayer.destroy();
      }
      catch (e) { } 
      stateMap.youtubePlayer = null;
    }
    if (stateMap.vimeoPlayer) {
      try {
        stateMap.vimeoPlayer.unload();
      } 
      catch (e) { } 
      stateMap.vimeoPlayer = null;
    }
  }
  function ensureRoot(title) {
    var root = document.getElementById('video-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'video-root';
      document.body.appendChild(root);
    }
    root.innerHTML = (ns.template && ns.template.template 
      ? ns.template.template({ title: title }) 
      : `<div id="videoModal">
  <div id="videoModalBackdrop"></div>
  <div>
    <button id="videoModalClose">×</button>
    <div id="videoPlayerHost"></div>
  </div>
</div>`
    );
    document.getElementById('videoModalClose').onclick = close;
    document.getElementById('videoModalBackdrop').onclick = close;
    document.getElementById('videoModal').style.display = 'block';
    return document.getElementById('videoPlayerHost');
  }
  function loadScript(src, test, key) {
    if (test()) return Promise.resolve();
    if (stateMap[key]) return stateMap[key];
    stateMap[key] = new Promise(function (resolve, reject) { var s = document.createElement('script'); s.src = src; s.async = true; s.onload = function () { resolve(); }; s.onerror = reject; document.head.appendChild(s); });
    return stateMap[key];
  }
  function renderHtml5(host, source, start, end) {
    host.innerHTML = '<video id="videoHtml5Player" controls autoplay playsinline preload="metadata" src="' + esc(source.src) + '" style="display:block;width:100%;height:auto;max-height:80vh;"></video>';
    var player = document.getElementById('videoHtml5Player'); stateMap.html5Player = player;
    player.addEventListener('loadedmetadata', function onMeta() { player.removeEventListener('loadedmetadata', onMeta); try { player.currentTime = Number(start || 0); } catch (e) { } var p = player.play(); if (p && p.catch) p.catch(function () { }); startEndWatch('html5', player, end); });
  }
  function renderYouTube(host, source, start, end) {
    host.innerHTML = '<div id="videoYouTubePlayer" style="width:100%;aspect-ratio:16/9;min-height:270px;"></div>';
    loadScript('https://www.youtube.com/player_api', function () { return !!(window.YT && window.YT.Player); }, 'youtubeApiLoading').then(function () {
      function create() {
        stateMap.youtubePlayer = new YT.Player('videoYouTubePlayer', { videoId: source.id, playerVars: { autoplay: 1, playsinline: 1, rel: 0 }, events: { onReady: function () { if (Number(start || 0) > 0) stateMap.youtubePlayer.seekTo(Number(start), true); stateMap.youtubePlayer.playVideo(); }, onStateChange: function (ev) { if (ev.data === YT.PlayerState.PLAYING) startEndWatch('youtube', stateMap.youtubePlayer, end); else stopEndWatch(); } } });
      }
      if (window.YT && window.YT.Player) create(); else window.onYouTubeIframeAPIReady = create;
    }).catch(function () { host.innerHTML = '<iframe src="https://www.youtube.com/embed/' + encodeURIComponent(source.id) + '?playsinline=1&rel=0&start=' + Math.floor(start || 0) + '" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen style="width:100%;aspect-ratio:16/9;"></iframe>'; });
  }
  function renderVimeo(host, source, start, end) {
    host.innerHTML = '<div id="videoVimeoPlayer" style="width:100%;aspect-ratio:16/9;min-height:270px;"></div>';
    loadScript('https://player.vimeo.com/api/player.js', function () { return !!(window.Vimeo && window.Vimeo.Player); }, 'vimeoApiLoading').then(function () {
      stateMap.vimeoPlayer = new window.Vimeo.Player('videoVimeoPlayer', { url: source.url, autoplay: true, responsive: true, title: false, byline: false, portrait: false });
      stateMap.vimeoPlayer.ready().then(function () { if (Number(start || 0) > 0) return stateMap.vimeoPlayer.setCurrentTime(Number(start)); }).then(function () { return stateMap.vimeoPlayer.play(); }).then(function () { startEndWatch('vimeo', stateMap.vimeoPlayer, end); }).catch(function () { });
    }).catch(function () { host.innerHTML = '<iframe src="https://player.vimeo.com/video/' + encodeURIComponent(source.id) + '#t=' + Math.floor(start || 0) + 's" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen style="width:100%;aspect-ratio:16/9;"></iframe>'; });
  }
  function open(node) {
    if (!node) return; cleanup(); stateMap.node = node; var source = detectSource(node); var resource = getResource(node); var range = getTimeRange(node); var host = ensureRoot(node.label || resource.title || resource.uri || 'Video player'); var start = Number(range.start || 0); var end = range.end != null ? Number(range.end) : null; if (source.provider === 'html5') { renderHtml5(host, source, start, end); return; } if (source.provider === 'youtube') { renderYouTube(host, source, start, end); return; } if (source.provider === 'vimeo') { renderVimeo(host, source, start, end); return; } host.innerHTML = '<div style="padding:1rem;background:#fff;">Unsupported video source</div>';
  }
  function close() { cleanup(); var modal = document.getElementById('videoModal'); if (modal) modal.style.display = 'none'; var root = document.getElementById('video-root'); if (root) root.innerHTML = ''; }

  ns.open = open;
  ns.close = close;
  return ns;
})(wuwei.menu.video);
// menu.video.js last modified 2026-04-07
