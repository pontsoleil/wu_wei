/**
 * wuwei.tablock.js
 * Same-browser edit lock for one user + one note.
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 **/
wuwei.tablock = (function () {
  'use strict';

  var common = null;
  var graph = null;
  var channel = null;
  var heartbeatTimer = null;
  var activeKey = '';
  var tabId = '';
  var HEARTBEAT_MS = 2000;
  var STALE_MS = 8000;
  var STORAGE_PREFIX = 'wuwei.activeTab.';
  var CHANNEL_NAME = 'wuwei.note.tablock';

  function now() {
    return Date.now();
  }

  function ensureTabId() {
    var key = 'wuwei.tabId';
    try {
      tabId = window.sessionStorage ? window.sessionStorage.getItem(key) || '' : '';
      if (!tabId) {
        tabId = 'tab_' + now() + '_' + Math.random().toString(16).slice(2);
        if (window.sessionStorage) {
          window.sessionStorage.setItem(key, tabId);
        }
      }
    } catch (e) {
      tabId = tabId || ('tab_' + now() + '_' + Math.random().toString(16).slice(2));
    }
    return tabId;
  }

  function storageKey(userId, noteId) {
    return STORAGE_PREFIX + encodeURIComponent(userId) + '.' + encodeURIComponent(noteId);
  }

  function parseRecord(text) {
    if (!text) { return null; }
    try {
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  }

  function readRecord(key) {
    try {
      return parseRecord(window.localStorage && window.localStorage.getItem(key));
    } catch (e) {
      return null;
    }
  }

  function writeRecord(key, record) {
    try {
      if (window.localStorage) {
        window.localStorage.setItem(key, JSON.stringify(record));
      }
    } catch (e) { }
  }

  function removeRecord(key) {
    try {
      if (window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (e) { }
  }

  function isFresh(record) {
    return !!(record && record.tabId && Number(record.ts) && (now() - Number(record.ts)) < STALE_MS);
  }

  function noteId() {
    var current = common && common.current ? common.current : {};
    return String(current.note_id || current.id || '').trim();
  }

  function userId() {
    var user = common && common.state ? common.state.currentUser || {} : {};
    return String(user.user_id || '').trim();
  }

  function canLock(note) {
    if (!note || note.charAt(0) === '_') { return false; }
    if (!userId() || userId() === (common && common.GUEST_USER_ID)) { return false; }
    if (common && common.state && common.state.published) { return false; }
    return true;
  }

  function post(message) {
    if (!message) { return; }
    message.sender = tabId;
    if (channel) {
      try { channel.postMessage(message); } catch (e) { }
    }
  }

  function setReadOnly(message) {
    if (!common || !common.state) { return; }
    common.state.viewOnly = true;
    common.state.tabLockReadOnly = true;
    if (graph) {
      graph.mode = 'view';
    }
    if (wuwei.menu && wuwei.menu.snackbar && typeof wuwei.menu.snackbar.open === 'function') {
      wuwei.menu.snackbar.open({
        type: 'warning',
        message: message || 'This note is open for editing in another tab. This tab is read-only.'
      });
    }
  }

  function setEditable() {
    if (!common || !common.state) { return; }
    common.state.tabLockReadOnly = false;
    if (!common.state.published) {
      common.state.viewOnly = false;
    }
  }

  function release() {
    var record;
    if (!activeKey) { return; }
    record = readRecord(activeKey);
    if (record && record.tabId === tabId) {
      removeRecord(activeKey);
      post({ type: 'release', key: activeKey });
    }
    activeKey = '';
  }

  function heartbeat() {
    var record;
    if (!activeKey) { return; }
    record = readRecord(activeKey);
    if (record && record.tabId === tabId) {
      record.ts = now();
      writeRecord(activeKey, record);
    }
  }

  function startHeartbeat() {
    if (heartbeatTimer) { return; }
    heartbeatTimer = window.setInterval(heartbeat, HEARTBEAT_MS);
  }

  function acquire(force) {
    var uid = userId();
    var nid = noteId();
    var key;
    var existing;
    var takeover;
    var record;

    release();

    if (!canLock(nid)) {
      return { mode: 'unlocked' };
    }

    key = storageKey(uid, nid);
    existing = readRecord(key);

    if (!force && isFresh(existing) && existing.tabId !== tabId) {
      takeover = window.confirm(
        'This note is already open for editing in another tab.\n\n' +
        'OK: edit in this tab\n' +
        'Cancel: open read-only'
      );
      if (!takeover) {
        activeKey = '';
        setReadOnly();
        post({ type: 'readonly-opened', key: key, noteId: nid, userId: uid });
        return { mode: 'readonly', owner: existing };
      }
      post({ type: 'takeover', key: key, noteId: nid, userId: uid, previousTabId: existing.tabId });
    }

    record = {
      tabId: tabId,
      userId: uid,
      noteId: nid,
      ts: now()
    };
    writeRecord(key, record);
    activeKey = key;
    setEditable();
    startHeartbeat();
    post({ type: 'acquire', key: key, noteId: nid, userId: uid });
    return { mode: 'edit', owner: record };
  }

  function activateForCurrentNote() {
    return acquire(false);
  }

  function takeOverCurrentNote() {
    return acquire(true);
  }

  function handleMessage(message) {
    if (!message || message.sender === tabId) { return; }
    if (!activeKey || message.key !== activeKey) { return; }
    if ('takeover' === message.type) {
      release();
      setReadOnly('Another tab took over editing this note. This tab is now read-only.');
    }
  }

  function handleStorage(event) {
    var record;
    if (!event || !activeKey || event.key !== activeKey) { return; }
    record = parseRecord(event.newValue);
    if (record && record.tabId && record.tabId !== tabId && isFresh(record)) {
      release();
      setReadOnly('Another tab is editing this note. This tab is now read-only.');
    }
  }

  function initModule() {
    common = wuwei.common;
    graph = common && common.graph;
    ensureTabId();
    if ('BroadcastChannel' in window) {
      try {
        channel = new BroadcastChannel(CHANNEL_NAME);
        channel.onmessage = function (event) {
          handleMessage(event && event.data);
        };
      } catch (e) {
        channel = null;
      }
    }
    window.addEventListener('storage', handleStorage);
    window.addEventListener('beforeunload', release);
    startHeartbeat();
  }

  return {
    initModule: initModule,
    activateForCurrentNote: activateForCurrentNote,
    takeOverCurrentNote: takeOverCurrentNote,
    release: release,
    getTabId: function () { return tabId; }
  };
})();
// wuwei.tablock.js
