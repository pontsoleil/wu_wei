/**
 * menu.video.js
 * Modal player UI for uploaded video / YouTube / Vimeo.
 */
wuwei.menu = wuwei.menu || {};
wuwei.menu.video = wuwei.menu.video || {};

(function (ns) {
  'use strict';

  var stateMap = {
    node: null,
    html5Player: null,
    youtubePlayer: null,
    vimeoPlayer: null,
    endWatchTimer: null,
    youtubeApiLoading: null,
    vimeoApiLoading: null
  };

  function toAbsUrl(href) {
    if (!href) { return ''; }
    if (/^(https?:|blob:|data:)/i.test(href)) { return href; }
    if (href.charAt(0) === '/') { return href; }
    return location.href.slice(0, location.href.lastIndexOf('/') + 1) + href.replace(/^\.\//, '');
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function isYoutube(url) {
    return /^https?:\/\/(www\.)?(youtube\.com|m\.youtube\.com|youtu\.be)\b/i.test(String(url || ''));
  }

  function isVimeo(url) {
    return /^https?:\/\/(www\.)?(vimeo\.com|player\.vimeo\.com)\b/i.test(String(url || ''));
  }

  function extractYouTubeId(url) {
    var s = String(url || '');
    var m = s.match(/[?&]v=([A-Za-z0-9_-]{11})/);
    if (m) { return m[1]; }
    m = s.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
    if (m) { return m[1]; }
    m = s.match(/youtube\.com\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/);
    return m ? m[1] : '';
  }

  function extractVimeoInfo(url) {
    if (wuwei.video && typeof wuwei.video.extractVimeoInfo === 'function') {
      return wuwei.video.extractVimeoInfo(url);
    }
    var out = { id: '', h: '', url: String(url || '').trim() };
    var u, m;
    try {
      u = new URL(out.url, location.href);
      out.h = u.searchParams.get('h') || '';
      m = u.pathname.match(/\/(?:video\/)?([0-9]+)(?:\/([A-Za-z0-9_-]+))?/);
      if (m) {
        out.id = m[1];
        out.h = out.h || m[2] || '';
      }
    }
    catch (e) {
      m = out.url.match(/vimeo\.com\/(?:video\/)?([0-9]+)(?:\/([A-Za-z0-9_-]+))?/);
      if (m) {
        out.id = m[1];
        out.h = out.h || m[2] || '';
      }
    }
    return out;
  }

  function extractVimeoId(url) {
    return extractVimeoInfo(url).id;
  }

  function getResource(node) {
    return (node && node.resource && typeof node.resource === 'object') ? node.resource : {};
  }

  function getTimeRange(node) {
    return (node && node.timeRange && typeof node.timeRange === 'object') ? node.timeRange : {};
  }

  function detectSource(node) {
    if (wuwei.video && typeof wuwei.video.detectSource === 'function') {
      return wuwei.video.detectSource(node);
    }
    var resource = getResource(node);
    var url = String(resource.canonicalUri || resource.uri || '');
    var kind = String(resource.kind || '').toLowerCase();
    var format = String(resource.mimeType || '').toLowerCase();
    if (isYoutube(url)) {
      return { provider: 'youtube', id: extractYouTubeId(url), url: url };
    }
    if (isVimeo(url)) {
      var vimeo = extractVimeoInfo(url);
      return { provider: 'vimeo', id: vimeo.id, h: vimeo.h, url: vimeo.url };
    }
    if (kind === 'video' || format.indexOf('video/') === 0 || /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(url)) {
      return { provider: 'html5', src: toAbsUrl(url), url: url };
    }
    return { provider: 'unknown', url: url };
  }

  function stopEndWatch() {
    if (stateMap.endWatchTimer) {
      clearInterval(stateMap.endWatchTimer);
      stateMap.endWatchTimer = null;
    }
  }

  function startEndWatch(provider, api, endSec) {
    stopEndWatch();
    endSec = Number(endSec);
    if (!Number.isFinite(endSec) || endSec <= 0) {
      return;
    }
    stateMap.endWatchTimer = window.setInterval(function () {
      if (!api) {
        stopEndWatch();
        return;
      }
      if (provider === 'html5') {
        if (Number(api.currentTime || 0) >= endSec) {
          api.pause();
          stopEndWatch();
        }
        return;
      }
      if (provider === 'youtube') {
        try {
          if (Number(api.getCurrentTime() || 0) >= endSec) {
            api.pauseVideo();
            stopEndWatch();
          }
        }
        catch (e) { }
        return;
      }
      if (provider === 'vimeo') {
        api.getCurrentTime()
          .then(function (sec) {
            if (Number(sec) >= endSec) {
              api.pause();
              stopEndWatch();
            }
          })
          .catch(function () { });
      }
    }, 200);
  }

  function cleanup() {
    stopEndWatch();
    if (stateMap.html5Player) {
      try { stateMap.html5Player.pause(); } catch (e) { }
      stateMap.html5Player = null;
    }
    if (stateMap.youtubePlayer) {
      try { stateMap.youtubePlayer.destroy(); } catch (e2) { }
      stateMap.youtubePlayer = null;
    }
    if (stateMap.vimeoPlayer) {
      try { stateMap.vimeoPlayer.unload(); } catch (e3) { }
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
    root.innerHTML = ns.template.template({ title: title });
    document.getElementById('videoModalClose').onclick = close;
    document.getElementById('videoModalBackdrop').onclick = close;
    document.getElementById('videoModal').style.display = 'block';
    return document.getElementById('videoPlayerHost');
  }

  function loadScript(src, test, key) {
    if (test()) { return Promise.resolve(); }
    if (stateMap[key]) { return stateMap[key]; }
    stateMap[key] = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = function () { resolve(); };
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return stateMap[key];
  }

  function renderHtml5(host, source, start, end) {
    var player;
    host.innerHTML = ns.template.html5Player({ id: 'videoHtml5Player', src: source.src });
    player = document.getElementById('videoHtml5Player');
    stateMap.html5Player = player;
    player.addEventListener('loadedmetadata', function onMeta() {
      var p;
      player.removeEventListener('loadedmetadata', onMeta);
      try { player.currentTime = Number(start || 0); } catch (e) { }
      p = player.play();
      if (p && p.catch) { p.catch(function () { }); }
      startEndWatch('html5', player, end);
    });
  }

  function renderYouTube(host, source, start, end) {
    host.innerHTML = ns.template.playerHolder({ id: 'videoYouTubePlayer' });
    loadScript('https://www.youtube.com/player_api', function () {
      return !!(window.YT && window.YT.Player);
    }, 'youtubeApiLoading').then(function () {
      function create() {
        stateMap.youtubePlayer = new YT.Player('videoYouTubePlayer', {
          videoId: source.id,
          playerVars: { autoplay: 1, playsinline: 1, rel: 0 },
          events: {
            onReady: function () {
              if (Number(start || 0) > 0) { stateMap.youtubePlayer.seekTo(Number(start), true); }
              stateMap.youtubePlayer.playVideo();
            },
            onStateChange: function (ev) {
              if (ev.data === YT.PlayerState.PLAYING) {
                startEndWatch('youtube', stateMap.youtubePlayer, end);
              }
              else {
                stopEndWatch();
              }
            }
          }
        });
      }
      if (window.YT && window.YT.Player) { create(); }
      else { window.onYouTubeIframeAPIReady = create; }
    }).catch(function () {
      host.innerHTML = ns.template.iframe({
        src: 'https://www.youtube.com/embed/' + encodeURIComponent(source.id) +
          '?playsinline=1&rel=0&start=' + Math.floor(start || 0)
      });
    });
  }

  function renderVimeo(host, source, start, end) {
    host.innerHTML = ns.template.playerHolder({ id: 'videoVimeoPlayer' });
    loadScript('https://player.vimeo.com/api/player.js', function () {
      return !!(window.Vimeo && window.Vimeo.Player);
    }, 'vimeoApiLoading').then(function () {
      stateMap.vimeoPlayer = new window.Vimeo.Player('videoVimeoPlayer', {
        url: source.url,
        autoplay: true,
        responsive: true,
        title: false,
        byline: false,
        portrait: false
      });
      stateMap.vimeoPlayer.ready()
        .then(function () {
          if (Number(start || 0) > 0) {
            return stateMap.vimeoPlayer.setCurrentTime(Number(start));
          }
          return null;
        })
        .then(function () { return stateMap.vimeoPlayer.play(); })
        .then(function () { startEndWatch('vimeo', stateMap.vimeoPlayer, end); })
        .catch(function () { });
    }).catch(function () {
      host.innerHTML = ns.template.iframe({
        src: 'https://player.vimeo.com/video/' + encodeURIComponent(source.id) +
          (source.h ? ('?h=' + encodeURIComponent(source.h)) : '') +
          '#t=' + Math.floor(start || 0) + 's'
      });
    });
  }

  function open(node, option) {
    var source, resource, range, host, start, end;
    if (!node) { return false; }
    cleanup();
    option = option || {};
    stateMap.node = node;
    source = detectSource(node);
    resource = getResource(node);
    range = getTimeRange(node);
    host = ensureRoot(node.label || resource.title || resource.uri || 'Video player');
    start = Number(option.startSeconds != null ? option.startSeconds : (range.start || 0));
    end = option.endSeconds != null ? Number(option.endSeconds) : (range.end != null ? Number(range.end) : null);
    if (source.provider === 'html5') {
      renderHtml5(host, source, start, end);
      return true;
    }
    if (source.provider === 'youtube') {
      renderYouTube(host, source, start, end);
      return true;
    }
    if (source.provider === 'vimeo') {
      renderVimeo(host, source, start, end);
      return true;
    }
    host.innerHTML = ns.template.unsupported();
    return false;
  }

  function close() {
    var modal, root;
    cleanup();
    modal = document.getElementById('videoModal');
    if (modal) { modal.style.display = 'none'; }
    root = document.getElementById('video-root');
    if (root) { root.innerHTML = ''; }
  }

  ns.open = open;
  ns.close = close;
  ns.detectSource = detectSource;
})(wuwei.menu.video);
