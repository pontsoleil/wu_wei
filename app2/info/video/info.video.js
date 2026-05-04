/**
 * info.video.js
 * info.video module (hosted video aware with Vimeo fallback)
 *
 * WuWei is a free, open-source knowledge modelling tool.
 * - HTML5 video: inline preview with jump/set-here controls
 * - YouTube / Vimeo: iframe preview in info pane
 * - Accurate playback is delegated to wuwei.menu.video.open()
 * - Vimeo embed refusal is handled by always showing fallback guidance
 *
 * Licensed under the MIT License.
 * Copyright (c) 2013-2020,2023,2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.info = wuwei.info || {};
wuwei.info.video = wuwei.info.video || {};

(function (ns) {
  'use strict';

  var
    /** model */
    model = wuwei.model,
    util = wuwei.util,
    /** state */
    stateMap = {
      node: null,
      resource: null,
      provider: '',
      rawUrl: '',
      embedUrl: '',
      onTimeUpdate: null
    },
    /** function */
    isHostedYouTube,
    isHostedVimeo,
    getNodeResource,
    getTimeRange,
    ensureTimeRange,
    detectProvider,
    isVideoResource,
    toAbsUri,
    extractYouTubeId,
    extractVimeoInfo,
    buildEmbedUrl,
    parseTimeToSeconds,
    formatSeconds,
    getMediaDuration,
    getPlayerEl,
    getStartInputEl,
    getEndInputEl,
    jumpToStart,
    jumpToEnd,
    setStartHere,
    setEndHere,
    saveRange,
    ensureTimeUpdateHandler,
    // syncHostedControls,
    openModal,
    openNewTab,
    getResourceUrl,
    wireEvents,
    open,
    close,
    loadScript,
    updateNodeDuration,
    syncDurationDisplayFromNode,
    setEndFromDuration,
    ensureDurationFromPreview,
    initModule;

  isHostedYouTube = function (url) {
    var s = String(url || '').toLowerCase();
    return /^https?:\/\/(www\.)?(youtube\.com|m\.youtube\.com|youtu\.be)\b/.test(s);
  };

  isHostedVimeo = function (url) {
    var s = String(url || '').toLowerCase();
    return /^https?:\/\/(www\.)?(vimeo\.com|player\.vimeo\.com)\b/.test(s);
  };

  getNodeResource = function (node) {
    return (util && typeof util.getResource === 'function')
      ? util.getResource(node)
      : ((node && node.resource && 'object' === typeof node.resource) ? node.resource : {});
  };

  getResourceUrl = function (resource) {
    return String(resource && (resource.canonicalUri || resource.uri) || '');
  };

  getTimeRange = function (node) {
    return (node && node.timeRange && 'object' === typeof node.timeRange) ? node.timeRange : {};
  };

  ensureTimeRange = function (node) {
    if (!node) {
      return {};
    }
    if (!node.timeRange || 'object' !== typeof node.timeRange) {
      node.timeRange = {};
    }
    if (!Number.isFinite(Number(node.timeRange.start))) {
      node.timeRange.start = 0;
    }
    return node.timeRange;
  };

  detectProvider = function (resource) {
    var fmt, uri, title, kind;

    if (!resource) {
      return '';
    }

    fmt = String(resource.mimeType || '').toLowerCase();
    uri = getResourceUrl(resource).toLowerCase();
    title = String(resource.title || '').toLowerCase();
    kind = String(resource.kind || '').toLowerCase();

    if (isHostedYouTube(uri)) {
      return 'youtube';
    }
    if (isHostedVimeo(uri)) {
      return 'vimeo';
    }
    if (
      kind === 'video' ||
      fmt.indexOf('video/') === 0 ||
      /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/.test(uri) ||
      /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/.test(title)
    ) {
      return 'html5';
    }
    return '';
  };

  isVideoResource = function (resource) {
    return !!detectProvider(resource);
  };

  toAbsUri = function (uri) {
    var base;
    if (!uri) {
      return '';
    }
    if (/^https?:\/\//i.test(uri)) {
      return uri;
    }
    if (uri.charAt(0) === '/') {
      return uri;
    }
    base = location.href.substr(0, location.href.lastIndexOf('/'));
    return base + '/' + uri;
  };

  extractYouTubeId = function (url) {
    var s = String(url || '').trim();
    var m = s.match(/[?&]v=([A-Za-z0-9_-]{11})/);
    if (m) {
      return m[1];
    }

    m = s.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
    if (m) {
      return m[1];
    }

    m = s.match(/youtube\.com\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/);
    return m ? m[1] : '';
  };

  extractVimeoInfo = function (url) {
    var out = {
      id: '',
      h: '',
      url: String(url || '').trim()
    };
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
  };

  buildEmbedUrl = function (resource, provider, start) {
    var rawUrl = getResourceUrl(resource);
    var startSec = Math.max(0, Math.floor(Number(start || 0)));
    var id, vimeo, qs, q, t;

    if (provider === 'youtube') {
      id = extractYouTubeId(rawUrl);
      if (!id) {
        return '';
      }
      return 'https://www.youtube.com/embed/' + encodeURIComponent(id) +
        '?playsinline=1&rel=0&enablejsapi=1&origin=' + encodeURIComponent(location.origin) +
        (startSec > 0 ? '&start=' + startSec : '');
    }

    if (provider === 'vimeo') {
      vimeo = extractVimeoInfo(rawUrl);
      if (!vimeo.id) {
        return '';
      }

      qs = [];
      if (vimeo.h) {
        qs.push('h=' + encodeURIComponent(vimeo.h));
      }
      q = qs.length ? ('?' + qs.join('&')) : '';
      t = startSec > 0 ? ('#t=' + startSec + 's') : '';

      return 'https://player.vimeo.com/video/' +
        encodeURIComponent(vimeo.id) + q + t;
    }

    return '';
  };

  parseTimeToSeconds = function (s) {
    var str, parts, sec;
    if (s == null) {
      return 0;
    }
    str = String(s).trim();
    if (!str) {
      return 0;
    }

    if (/^\d+(\.\d+)?$/.test(str)) {
      return Math.max(0, parseFloat(str));
    }

    parts = str.split(':').map(function (p) { return p.trim(); });
    if (parts.some(function (p) { return p === '' || isNaN(p); })) {
      return 0;
    }

    sec = 0;
    if (parts.length === 3) {
      sec = (+parts[0]) * 3600 + (+parts[1]) * 60 + (+parts[2]);
    }
    else if (parts.length === 2) {
      sec = (+parts[0]) * 60 + (+parts[1]);
    }
    else {
      sec = +parts[0];
    }

    return Math.max(0, sec);
  };

  formatSeconds = function (sec) {
    var h, m, s, hh, mm, ss;
    sec = Math.max(0, Number(sec) || 0);
    h = Math.floor(sec / 3600);
    m = Math.floor((sec % 3600) / 60);
    s = sec % 60;
    hh = String(h).padStart(2, '0');
    mm = String(m).padStart(2, '0');

    ss = (Math.round(s * 1000) / 1000).toString();
    if (ss.indexOf('.') >= 0) {
      ss = ss.replace(/0+$/, '').replace(/\.$/, '');
    }
    ss = ss.padStart(2, '0');

    return hh + ':' + mm + ':' + ss;
  };

  getMediaDuration = function (resource, node) {
    var res = resource || getNodeResource(node);
    var media = res && 'object' === typeof res.media ? res.media : {};
    var range = getTimeRange(node);
    var values = [
      res && res.duration,
      media.duration,
      range && range.end
    ];
    var i, duration;
    for (i = 0; i < values.length; i += 1) {
      duration = Number(values[i]);
      if (Number.isFinite(duration) && duration > 0) {
        return duration;
      }
    }
    return 0;
  };

  getPlayerEl = function () {
    return document.getElementById('infoVideoPlayer');
  };

  getStartInputEl = function () {
    return document.getElementById('infoVideoStart');
  };

  getEndInputEl = function () {
    return document.getElementById('infoVideoEnd');
  };

  jumpToStart = function () {
    var player = getPlayerEl();
    var input = getStartInputEl();
    var start;

    if (stateMap.provider !== 'html5') {
      return;
    }
    if (!player || !input) {
      return;
    }

    start = parseTimeToSeconds(input.value);
    if (Number.isFinite(start)) {
      player.currentTime = start;
    }
  };

  jumpToEnd = function () {
    var player = getPlayerEl();
    var input = getEndInputEl();
    var end;

    if (stateMap.provider !== 'html5') {
      return;
    }
    if (!player || !input) {
      return;
    }

    end = parseTimeToSeconds(input.value);
    if (Number.isFinite(end) && end > 0) {
      player.currentTime = end;
    }
  };

  setStartHere = function () {
    var player = getPlayerEl();
    var input = getStartInputEl();

    if (stateMap.provider !== 'html5') {
      return;
    }
    if (!player || !input) {
      return;
    }

    input.value = formatSeconds(player.currentTime || 0);
  };

  setEndHere = function () {
    var player = getPlayerEl();
    var input = getEndInputEl();

    if (stateMap.provider !== 'html5') {
      return;
    }
    if (!player || !input) {
      return;
    }

    input.value = formatSeconds(player.currentTime || 0);
  };

  loadScript = function (src, test, key) {
    if (test()) {
      return Promise.resolve();
    }
    stateMap[key] = stateMap[key] || new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return stateMap[key];
  };

  updateNodeDuration = function (sec) {
    sec = Number(sec || 0);
    if (!stateMap.node || !Number.isFinite(sec) || sec <= 0) {
      return;
    }

    stateMap.resource = stateMap.resource || getNodeResource(stateMap.node);
    stateMap.node.resource = stateMap.resource;
    stateMap.resource.duration = sec;
    stateMap.resource.media = (stateMap.resource.media && 'object' === typeof stateMap.resource.media)
      ? stateMap.resource.media
      : {};
    stateMap.resource.media.duration = sec;
    if (!stateMap.node.timeRange || 'object' !== typeof stateMap.node.timeRange) {
      stateMap.node.timeRange = {};
    }
    if (stateMap.node.timeRange.end == null ||
      !Number.isFinite(Number(stateMap.node.timeRange.end)) ||
      Number(stateMap.node.timeRange.end) <= 0) {
      stateMap.node.timeRange.end = sec;
    }
    stateMap.node.changed = true;
    syncDurationDisplayFromNode();

    if (model && typeof model.updateNode === 'function') {
      model.updateNode(stateMap.node);
    }
  };

  syncDurationDisplayFromNode = function () {
    var el = document.getElementById('infoVideoDuration');
    if (el) {
      el.textContent = formatSeconds(getMediaDuration(stateMap.resource, stateMap.node));
    }
  };

  setEndFromDuration = function (sec) {
    var endEl, currentEnd;

    sec = Number(sec || 0);
    if (!Number.isFinite(sec) || sec <= 0) {
      return;
    }

    endEl = getEndInputEl();
    if (!endEl) {
      return;
    }

    currentEnd = parseTimeToSeconds(endEl.value);
    if (!currentEnd || currentEnd <= 0) {
      endEl.value = formatSeconds(sec);
    }
  };

  ensureDurationFromPreview = function () {
    var player, iframeEl, retry, durationTimer;

    if (stateMap.provider === 'html5') {
      player = getPlayerEl();
      if (!player) {
        return;
      }

      player.addEventListener('loadedmetadata', function onMeta() {
        player.removeEventListener('loadedmetadata', onMeta);
        updateNodeDuration(player.duration);
        setEndFromDuration(player.duration);
      });

      if (player.readyState >= 1) {
        updateNodeDuration(player.duration);
        setEndFromDuration(player.duration);
      }
      return;
    }

    if (stateMap.provider === 'vimeo') {
      iframeEl = document.getElementById('infoVideoFrame');
      if (!iframeEl || !stateMap.embedUrl) {
        return;
      }

      loadScript(
        'https://player.vimeo.com/api/player.js',
        function () { return !!(window.Vimeo && window.Vimeo.Player); },
        'vimeoApiLoading'
      ).then(function () {
        var p = new window.Vimeo.Player(iframeEl);
        p.getDuration().then(function (dur) {
          updateNodeDuration(dur);
          setEndFromDuration(dur);
        }).catch(function () { });
      }).catch(function () { });
      return;
    }

    if (stateMap.provider === 'youtube') {
      iframeEl = document.getElementById('infoVideoFrame');
      if (!iframeEl || !stateMap.embedUrl) {
        return;
      }

      loadScript(
        'https://www.youtube.com/player_api',
        function () { return !!(window.YT && window.YT.Player); },
        'youtubeApiLoading'
      ).then(function () {
        function createPlayer() {
          var ytPlayer = new YT.Player('infoVideoFrame', {
            events: {
              onReady: function () {
                retry = 0;
                durationTimer = setInterval(function () {
                  var dur = 0;
                  retry += 1;
                  try {
                    dur = Number(ytPlayer.getDuration() || 0);
                  } catch (e) {
                    dur = 0;
                  }
                  if (dur > 0 || retry >= 20) {
                    clearInterval(durationTimer);
                    if (dur > 0) {
                      updateNodeDuration(dur);
                      setEndFromDuration(dur);
                    }
                  }
                }, 250);
              }
            }
          });
        }

        if (window.YT && window.YT.Player) {
          createPlayer();
        } else {
          window.onYouTubeIframeAPIReady = createPlayer;
        }
      }).catch(function () { });
    }
  };

  saveRange = function () {
    var startEl = getStartInputEl();
    var endEl = getEndInputEl();
    var start, endRaw, end;

    if (!startEl || !stateMap.node) {
      return;
    }

    start = parseTimeToSeconds(startEl.value);
    endRaw = endEl ? endEl.value : '';
    end = endRaw ? parseTimeToSeconds(endRaw) : null;

    var range = ensureTimeRange(stateMap.node);
    range.start = start;

    if (end != null && end > 0) {
      range.end = end;
    }
    else {
      delete range.end;
    }

    stateMap.node.changed = true;

    if (model && typeof model.updateNode === 'function') {
      model.updateNode(stateMap.node);
    }

    if (wuwei.draw && typeof wuwei.draw.refresh === 'function') {
      wuwei.draw.refresh();
    }

    if ('youtube' === stateMap.provider || 'vimeo' === stateMap.provider) {
      open({
        node: stateMap.node,
        resource: stateMap.resource
      });
    }
  };

  ensureTimeUpdateHandler = function () {
    var player = getPlayerEl();

    if (!player || stateMap.provider !== 'html5') {
      return;
    }

    if (stateMap.onTimeUpdate) {
      player.removeEventListener('timeupdate', stateMap.onTimeUpdate);
      stateMap.onTimeUpdate = null;
    }

    stateMap.onTimeUpdate = function () {
      var endEl = getEndInputEl();
      var end;

      if (!endEl) {
        return;
      }

      end = parseTimeToSeconds(endEl.value);
      if (!end || end <= 0) {
        return;
      }

      if (player.currentTime >= end) {
        player.pause();
      }
    };

    player.addEventListener('timeupdate', stateMap.onTimeUpdate);
  };

/*  syncHostedControls = function () {
    var btnJumpS = document.getElementById('infoVideoJumpStart');
    var btnJumpE = document.getElementById('infoVideoJumpEnd');
    var btnHereS = document.getElementById('infoVideoSetStartHere');
    var btnHereE = document.getElementById('infoVideoSetEndHere');
    var hostedHint = document.getElementById('infoVideoHostedHint');
    var disable = stateMap.provider !== 'html5';

    [btnJumpS, btnJumpE, btnHereS, btnHereE].forEach(function (btn) {
      if (!btn) {
        return;
      }
      btn.disabled = disable;
      btn.style.opacity = disable ? '0.5' : '';
      btn.style.pointerEvents = disable ? 'none' : '';
    });

    if (hostedHint) {
      hostedHint.style.display = disable ? 'block' : 'none';
    }
  };*/

  openModal = function (node) {
    var target = node || stateMap.node || stateMap.resource;
    if (window.wuwei &&
      wuwei.menu &&
      wuwei.menu.video &&
      typeof wuwei.menu.video.open === 'function' &&
      target) {
      wuwei.menu.video.open(target);
    }
  };

  openNewTab = function (url) {
    var href = url || stateMap.rawUrl || '';
    if (!href) {
      return;
    }
    window.open(href, '_blank', 'noopener');
  };

  wireEvents = function () {
    var btnJumpS = document.getElementById('infoVideoJumpStart');
    var btnJumpE = document.getElementById('infoVideoJumpEnd');
    var btnHereS = document.getElementById('infoVideoSetStartHere');
    var btnHereE = document.getElementById('infoVideoSetEndHere');
    var btnSave = document.getElementById('infoVideoSaveRange');
    var btnOpenTab = document.getElementById('infoVideoOpenTab');
    var btnOpenPlayer = document.getElementById('infoVideoOpenPlayer');

    if (btnJumpS) {
      btnJumpS.onclick = jumpToStart;
    }
    if (btnJumpE) {
      btnJumpE.onclick = jumpToEnd;
    }
    if (btnHereS) {
      btnHereS.onclick = setStartHere;
    }
    if (btnHereE) {
      btnHereE.onclick = setEndHere;
    }
    if (btnSave) {
      btnSave.onclick = saveRange;
    }
    if (btnOpenTab) {
      btnOpenTab.onclick = function () {
        openNewTab();
      };
    }
    if (btnOpenPlayer) {
      btnOpenPlayer.onclick = function () {
        openModal();
      };
    }

    // syncHostedControls();
    ensureTimeUpdateHandler();
  };

  open = function (param) {
    var pane = document.getElementById('info-video');
    var start, end, player, inputStart, onMeta;

    if (!pane) {
      return;
    }

    stateMap.node = param.node ? (model.findNodeById(param.node.id) || param.node) : null;
    stateMap.resource = param.resource || getNodeResource(stateMap.node);
    stateMap.provider = detectProvider(stateMap.resource);
    stateMap.rawUrl = getResourceUrl(stateMap.resource);

    if (!isVideoResource(stateMap.resource)) {
      pane.innerHTML = '';
      pane.style.display = 'none';
      return;
    }

    var range = getTimeRange(stateMap.node);
    start = (range && range.start != null)
      ? range.start
      : 0;
    end = (range && range.end != null)
      ? range.end
      : null;

    stateMap.embedUrl = buildEmbedUrl(stateMap.resource, stateMap.provider, start);

    pane.innerHTML = wuwei.info.video.markup.template({
      node: stateMap.node,
      resource: stateMap.resource,
      provider: stateMap.provider,
      start: start,
      end: end,
      duration: getMediaDuration(stateMap.resource, stateMap.node),
      src: toAbsUri(stateMap.rawUrl),
      rawUrl: stateMap.rawUrl,
      embedUrl: stateMap.embedUrl
    });

    ensureDurationFromPreview();

    pane.style.display = 'block';

    wireEvents();

    if (stateMap.provider === 'html5') {
      player = getPlayerEl();
      inputStart = getStartInputEl();
      if (player && inputStart) {
        onMeta = function () {
          var startSec = parseTimeToSeconds(inputStart.value);
          try {
            player.currentTime = startSec;
          }
          catch (e) { }
          player.removeEventListener('loadedmetadata', onMeta);
        };
        player.addEventListener('loadedmetadata', onMeta);
      }
    }
  };

  close = function () {
    var pane = document.getElementById('info-video');
    var player = getPlayerEl();

    if (player && stateMap.provider === 'html5') {
      try {
        player.pause();
      }
      catch (e) { }
      if (stateMap.onTimeUpdate) {
        player.removeEventListener('timeupdate', stateMap.onTimeUpdate);
      }
      player.removeAttribute('src');
      try {
        player.load();
      }
      catch (e) { }
    }

    if (pane) {
      pane.innerHTML = '';
      pane.style.display = 'none';
    }

    stateMap.node = null;
    stateMap.resource = null;
    stateMap.provider = '';
    stateMap.rawUrl = '';
    stateMap.embedUrl = '';
    stateMap.onTimeUpdate = null;
    stateMap.youtubeApiLoading = null;
    stateMap.vimeoApiLoading = null;
  };

  initModule = function () { };

    ns.open = open;
  ns.close = close;
  ns.openModal = openModal;
  ns.openNewTab = openNewTab;
  ns.parseTimeToSeconds = parseTimeToSeconds;
  ns.formatSeconds = formatSeconds;
  ns.jumpToStart = jumpToStart;
  ns.jumpToEnd = jumpToEnd;
  ns.setStartHere = setStartHere;
  ns.setEndHere = setEndHere;
  ns.saveRange = saveRange;
  ns.initModule = initModule;
})(wuwei.info.video);
// info.video.js last modified 2026-04-06
