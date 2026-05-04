/**
 * menu.timeline.js
 * thin menu-facing wrapper around wuwei.timeline
 */
wuwei.menu = wuwei.menu || {};
wuwei.menu.timeline = wuwei.menu.timeline || {};

(function (ns) {
  'use strict';

  var timeline = wuwei.timeline;
  var previewApiPromises = {};

  function getCurrentPage() { return timeline.getCurrentPage(); }
  function isAxisGroup(group) { return timeline.isAxisGroup(group); }
  function isTimelinePoint(node) { return timeline.isTimelinePoint(node); }
  function isTimelineAxisLink(link) { return timeline.isTimelineAxisLink(link); }
  function createAxisGroup(axis, videoNode, option) { return timeline.createAxisGroup(axis, videoNode, option); }
  function addTimePoint() { return timeline.addTimePoint(); }
  function addTimePointToGroup(group, patch) { return timeline.addTimePointToGroup(group, patch); }
  function relayoutAxisGroup(groupOrId) { return timeline.relayoutAxisGroup(groupOrId); }
  function updateAxisGroup(groupOrId, patch) { return timeline.updateAxisGroup(groupOrId, patch); }
  function updateTimePoint(pointOrId, patch) { return timeline.updateTimePoint(pointOrId, patch); }
  function deleteTimePoint(pointOrId) { return timeline.deleteTimePoint(pointOrId); }

  function deleteSelectedPoint() {
    var point = timeline.getSelectedTimelinePoint();
    if (!point) { return false; }
    if (!window.confirm('この時刻点を削除しますか？')) { return false; }
    return timeline.deleteTimePoint(point);
  }

  function editSelected() {
    var point = timeline.getSelectedTimelinePoint();
    var group;
    if (point) {
      if (wuwei.edit && typeof wuwei.edit.open === 'function') {
        wuwei.edit.open(point, { editor: false, citation: false, cc: false });
      }
      else if (wuwei.edit && wuwei.edit.timeline && typeof wuwei.edit.timeline.open === 'function') {
        wuwei.edit.timeline.open(point);
      }
      return point;
    }
    group = timeline.findAxisGroupFromSelection();
    if (group) {
      if (wuwei.edit && typeof wuwei.edit.open === 'function') {
        wuwei.edit.open(group, { editor: false, citation: false, cc: false });
      }
      else if (wuwei.edit && wuwei.edit.timeline && typeof wuwei.edit.timeline.open === 'function') {
        wuwei.edit.timeline.open(group);
      }
      return group;
    }
    return null;
  }

  function getTimelinePlaybackSpec(point) { return timeline.getTimelinePlaybackSpec(point); }
  function getTimelineTargetSpec(target) { return timeline.getTimelineTargetSpec(target); }
  function confirmSavedRender(target) { return timeline.confirmSavedRender(target); }
  function formatTime(seconds) { return timeline.formatTime(seconds); }

  function loadScriptOnce(slot, src, test) {
    if (test()) {
      return Promise.resolve();
    }
    if (previewApiPromises[slot]) {
      return previewApiPromises[slot];
    }
    previewApiPromises[slot] = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return previewApiPromises[slot];
  }

  function ensureYouTubeApi() {
    if (window.YT && window.YT.Player) {
      return Promise.resolve();
    }
    return loadScriptOnce('youtube', 'https://www.youtube.com/iframe_api', function () {
      return !!(window.YT && window.YT.Player);
    }).then(function () {
      if (window.YT && window.YT.Player) {
        return;
      }
      return new Promise(function (resolve) {
        var previousReady = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = function () {
          if (typeof previousReady === 'function') {
            try { previousReady(); } catch (e) { }
          }
          resolve();
        };
      });
    });
  }

  function ensureVimeoApi() {
    if (window.Vimeo && window.Vimeo.Player) {
      return Promise.resolve();
    }
    return loadScriptOnce('vimeo', 'https://player.vimeo.com/api/player.js', function () {
      return !!(window.Vimeo && window.Vimeo.Player);
    });
  }

  function cleanupEmbeddedPreview(previewState, host) {
    var timer = previewState && (previewState.timer || previewState.timeWatchTimer);
    var kind = previewState && (previewState.kind || previewState.provider || '');
    var player = previewState && (previewState.player || previewState.html5Player || previewState.youtubePlayer || previewState.vimeoPlayer);
    if (timer) {
      clearInterval(timer);
    }
    if (player) {
      try {
        if (kind === 'html5') {
          player.pause();
          player.removeAttribute('src');
          player.load();
        }
        else if (kind === 'youtube') {
          player.destroy();
        }
        else if (kind === 'vimeo') {
          player.unload();
        }
      }
      catch (e) { }
    }
    if (previewState) {
      previewState.timer = null;
      previewState.timeWatchTimer = null;
      previewState.kind = '';
      previewState.provider = '';
      previewState.player = null;
      previewState.html5Player = null;
      previewState.youtubePlayer = null;
      previewState.vimeoPlayer = null;
      previewState.host = null;
      previewState.hostId = '';
    }
    if (host) {
      host.innerHTML = '';
    }
  }

  function startEmbeddedPreviewEndWatch(previewState, provider, api, endSec) {
    var key = (previewState && ('timeWatchTimer' in previewState)) ? 'timeWatchTimer' : 'timer';
    if (previewState && previewState[key]) {
      clearInterval(previewState[key]);
      previewState[key] = null;
    }
    endSec = Number(endSec);
    if (!Number.isFinite(endSec) || endSec <= 0 || !previewState) {
      return;
    }
    previewState[key] = window.setInterval(function () {
      if (!api) {
        clearInterval(previewState[key]);
        previewState[key] = null;
        return;
      }
      if (provider === 'html5') {
        if (Number(api.currentTime || 0) >= endSec) {
          api.pause();
        }
        return;
      }
      if (provider === 'youtube') {
        try {
          if (Number(api.getCurrentTime() || 0) >= endSec) {
            api.pauseVideo();
          }
        }
        catch (e) { }
        return;
      }
      if (provider === 'vimeo') {
        api.getCurrentTime().then(function (sec) {
          if (Number(sec || 0) >= endSec) {
            api.pause().catch(function () { });
          }
        }).catch(function () { });
      }
    }, 200);
  }

  function renderHtml5EmbeddedPreview(host, source, startAt, endAt, previewState) {
    var video, p;
    host.innerHTML = ns.markup.html5Preview({ src: source.src });
    video = host.querySelector('video');
    if (!previewState) { previewState = {}; }
    previewState.kind = previewState.provider = 'html5';
    previewState.player = previewState.html5Player = video;
    previewState.host = host;
    if (!video) {
      return video;
    }
    video.addEventListener('loadedmetadata', function onMeta() {
      video.removeEventListener('loadedmetadata', onMeta);
      try { video.currentTime = Number(startAt || 0); } catch (e) { }
      startEmbeddedPreviewEndWatch(previewState, 'html5', video, endAt);
      p = video.play();
      if (p && typeof p.catch === 'function') {
        p.catch(function () { });
      }
    });
    return video;
  }

  function renderYouTubeEmbeddedPreview(host, source, startAt, endAt, previewState) {
    return ensureYouTubeApi().then(function () {
      var holderId = 'timelinePreviewYT_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
      host.innerHTML = ns.markup.playerHolder({ id: holderId });
      if (!previewState) { previewState = {}; }
      previewState.kind = previewState.provider = 'youtube';
      previewState.host = host;
      previewState.hostId = holderId;
      var playerVars = {
        autoplay: 1,
        controls: 1,
        playsinline: 1,
        rel: 0,
        start: Math.floor(Number(startAt || 0)),
        enablejsapi: 1,
        origin: location.origin
      };
      if (Number.isFinite(Number(endAt)) && Number(endAt) > Number(startAt || 0)) {
        playerVars.end = Math.floor(Number(endAt));
      }
      previewState.player = previewState.youtubePlayer = new YT.Player(holderId, {
        videoId: source.id,
        playerVars: playerVars,
        events: {
          onReady: function (ev) {
            try { ev.target.seekTo(Number(startAt || 0), true); } catch (e) { }
            try { ev.target.playVideo(); } catch (e2) { }
            startEmbeddedPreviewEndWatch(previewState, 'youtube', ev.target, endAt);
          }
        }
      });
      return previewState.youtubePlayer;
    });
  }

  function renderVimeoEmbeddedPreview(host, source, startAt, endAt, previewState) {
    return ensureVimeoApi().then(function () {
      var player;
      host.innerHTML = '';
      player = new window.Vimeo.Player(host, {
        url: source.url,
        autoplay: true,
        controls: true,
        responsive: true,
        title: false,
        byline: false,
        portrait: false
      });
      if (!previewState) { previewState = {}; }
      previewState.kind = previewState.provider = 'vimeo';
      previewState.player = previewState.vimeoPlayer = player;
      previewState.host = host;
      player.ready().then(function () {
        return player.setCurrentTime(Number(startAt || 0));
      }).then(function () {
        return player.play();
      }).catch(function () { });
      player.on('timeupdate', function (data) {
        if (Number.isFinite(Number(endAt)) &&
          Number(endAt) > Number(startAt || 0) &&
          Number(data && data.seconds || 0) >= Number(endAt)) {
          player.pause().catch(function () { });
        }
      });
      return player;
    });
  }

  function initModule() { return true; }

  ns.initModule = initModule;
  ns.getCurrentPage = getCurrentPage;
  ns.createAxisGroup = createAxisGroup;
  ns.addTimePoint = addTimePoint;
  ns.addTimePointToGroup = addTimePointToGroup;
  ns.editSelected = editSelected;
  ns.deleteSelectedPoint = deleteSelectedPoint;
  ns.deleteTimePoint = deleteTimePoint;
  ns.updateAxisGroup = updateAxisGroup;
  ns.updateTimePoint = updateTimePoint;
  ns.isAxisGroup = isAxisGroup;
  ns.isTimelinePoint = isTimelinePoint;
  ns.relayoutAxisGroup = relayoutAxisGroup;
  ns.getTimelinePlaybackSpec = getTimelinePlaybackSpec;
  ns.formatTime = formatTime;
  ns.isTimelineAxisLink = isTimelineAxisLink;
  ns.getTimelineTargetSpec = getTimelineTargetSpec;
  ns.confirmSavedRender = confirmSavedRender;
  ns.cleanupEmbeddedPreview = cleanupEmbeddedPreview;
  ns.startEmbeddedPreviewEndWatch = startEmbeddedPreviewEndWatch;
  ns.renderHtml5EmbeddedPreview = renderHtml5EmbeddedPreview;
  ns.renderYouTubeEmbeddedPreview = renderYouTubeEmbeddedPreview;
  ns.renderVimeoEmbeddedPreview = renderVimeoEmbeddedPreview;
})(wuwei.menu.timeline);
