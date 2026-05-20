/**
 * wuwei.collab.js
 * Collaboration edit policy helper
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.collab = wuwei.collab || {};

(function (ns) {
  var common = wuwei.common;
  var syncTimer = null;
  var pendingOperations = [];
  var syncIntervalMs = 3000;

  function currentNote() {
    return (common && common.current) || {};
  }

  function isEnabled(note) {
    var target = note || currentNote();
    return !!(target && target.collaboration && target.collaboration.enabled);
  }

  function currentUserId() {
    return String(
      (common && common.state && common.state.currentUser && common.state.currentUser.user_id) ||
      (common && common.state && common.state.user_id) ||
      ''
    );
  }

  function isImportedNote(note) {
    var target = note || currentNote();
    var exchange = target && target.exchange;
    var noteCreator = String(target && target.audit && target.audit.createdBy || '');
    var uid = currentUserId();
    if (exchange && typeof exchange === 'object' &&
      (exchange.imported === true || exchange.mode === 'imported' || exchange.source === 'import')) {
      return true;
    }
    return !!(!isEnabled(target) && uid && noteCreator && noteCreator !== uid);
  }

  function getMode(note) {
    if (isEnabled(note)) {
      return 'collaboration';
    }
    if (isImportedNote(note)) {
      return 'exchange';
    }
    return 'personal';
  }

  function normalizeMetadata(value) {
    var src = (value && typeof value === 'object') ? value : {};
    var revision = Number(src.revision);
    return {
      enabled: !!src.enabled,
      revision: Number.isFinite(revision) && revision >= 0 ? Math.floor(revision) : 0,
      updatedAt: String(src.updatedAt || '')
    };
  }

  function start(note) {
    var target = note || currentNote();
    if (target) {
      target.collaboration = normalizeMetadata(target.collaboration);
      target.collaboration.enabled = true;
    }
    stop();
    syncTimer = window.setInterval(sync, syncIntervalMs);
  }

  function stop() {
    if (syncTimer) {
      window.clearInterval(syncTimer);
      syncTimer = null;
    }
  }

  function getRevision(note) {
    return normalizeMetadata((note || currentNote()).collaboration).revision;
  }

  function queueOperation(operation) {
    if (!operation || typeof operation !== 'object') {
      return false;
    }
    pendingOperations.push(operation);
    return true;
  }

  function applyRemoteChanges(changes) {
    var list = Array.isArray(changes) ? changes : [];
    list.forEach(function (change) {
      var op = change && change.op;
      var value = change && change.value;
      if (!op || !value || !wuwei.model) {
        return;
      }
      if ((op === 'addNode' || op === 'addMemo' || op === 'updateNode') &&
        typeof wuwei.model.updateNode === 'function') {
        wuwei.model.updateNode(value);
      }
      else if ((op === 'addLink' || op === 'updateLink') &&
        typeof wuwei.model.updateLink === 'function') {
        wuwei.model.updateLink(value);
      }
    });
    if (wuwei.shell && typeof wuwei.shell.refreshCurrentDraw === 'function') {
      wuwei.shell.refreshCurrentDraw();
    }
  }

  function sync() {
    if (!isEnabled()) {
      return Promise.resolve({ status: 'disabled' });
    }
    return Promise.resolve({
      status: 'queued',
      revision: getRevision(),
      queued: pendingOperations.length
    });
  }

  function canEditObject(record) {
    if (!record || !isEnabled()) {
      return true;
    }
    if (!wuwei.auth || typeof wuwei.auth.canEditRecord !== 'function') {
      return true;
    }
    try {
      return wuwei.auth.canEditRecord(record);
    }
    catch (e) {
      console.warn('collaboration edit policy rejected record:', e);
      return false;
    }
  }

  function isOwnObject(record) {
    if (!record) {
      return false;
    }
    if (!wuwei.auth || typeof wuwei.auth.canEditRecord !== 'function') {
      return true;
    }
    try {
      return wuwei.auth.canEditRecord(record);
    }
    catch (e) {
      return false;
    }
  }

  function isDisplayPath(kind, path) {
    var p = String(path || '');
    if (!p) {
      return false;
    }
    if (kind === 'node') {
      return p === 'x' || p === 'y' || p === 'visible' ||
        p === 'shape' || p.indexOf('size.') === 0 ||
        p.indexOf('style.') === 0 || p.indexOf('text.') === 0;
    }
    if (kind === 'link') {
      return p === 'visible' ||
        p.indexOf('style.') === 0 || p.indexOf('routing.') === 0;
    }
    if (kind === 'group') {
      return p === 'visible' || p === 'orientation' || p === 'moveTogether' ||
        p.indexOf('style.') === 0 || p.indexOf('spine.') === 0;
    }
    return false;
  }

  function canEditPath(record, path, kind) {
    if (!record) {
      return false;
    }
    if (isOwnObject(record)) {
      return true;
    }
    if (isEnabled()) {
      return false;
    }
    if (!isImportedNote()) {
      return true;
    }
    return isDisplayPath(kind, path);
  }

  function canDeleteObject(record) {
    if (!record) {
      return false;
    }
    if (isOwnObject(record)) {
      return true;
    }
    return !isEnabled();
  }

  function canEditSelection(records) {
    var list = Array.isArray(records) ? records : [records];
    return list.every(function (record) {
      return canEditObject(record);
    });
  }

  function readOnlyMessage() {
    if (isEnabled()) {
      return 'This item was created by another user. Add a memo instead of editing it directly.';
    }
    return 'This field is protected for imported notes. Only display attributes can be changed.';
  }

  function notifyReadOnly() {
    var param = { type: 'warning', message: readOnlyMessage() };
    if (wuwei.shell && typeof wuwei.shell.openSnackbar === 'function') {
      wuwei.shell.openSnackbar(param);
    }
    else if (wuwei.menu && wuwei.menu.snackbar &&
      typeof wuwei.menu.snackbar.open === 'function') {
      wuwei.menu.snackbar.open(param);
    }
    else {
      window.alert(param.message);
    }
  }

  function createMemoForTarget(target, text) {
    var result;
    var memo;
    var link;

    if (!target || !wuwei.util || !wuwei.util.isNode(target) ||
      !wuwei.model || typeof wuwei.model.addMemo !== 'function') {
      return null;
    }

    result = wuwei.model.addMemo([target]);
    memo = result && result.param && result.param.node && result.param.node[0];
    link = result && result.param && result.param.link && result.param.link[0];
    if (!memo) {
      return null;
    }
    memo.description = memo.description && typeof memo.description === 'object'
      ? memo.description
      : { format: 'asciidoc', body: '' };
    memo.description.body = String(text || '');

    if (wuwei.auth && typeof wuwei.auth.touchCreatedRecord === 'function') {
      wuwei.auth.touchCreatedRecord(memo);
      if (link) {
        wuwei.auth.touchCreatedRecord(link);
      }
    }
    if (typeof wuwei.model.updateNode === 'function') {
      wuwei.model.updateNode(memo);
    }
    if (link && typeof wuwei.model.updateLink === 'function') {
      wuwei.model.updateLink(link);
    }
    queueOperation({
      op: 'addMemo',
      targetType: 'node',
      targetId: target.id || '',
      value: memo
    });
    if (wuwei.shell && typeof wuwei.shell.refreshCurrentDraw === 'function') {
      wuwei.shell.refreshCurrentDraw();
    }
    return memo;
  }

  ns.start = start;
  ns.stop = stop;
  ns.isEnabled = isEnabled;
  ns.isImportedNote = isImportedNote;
  ns.getMode = getMode;
  ns.getRevision = getRevision;
  ns.normalizeMetadata = normalizeMetadata;
  ns.queueOperation = queueOperation;
  ns.sync = sync;
  ns.applyRemoteChanges = applyRemoteChanges;
  ns.canEditObject = canEditObject;
  ns.canEditPath = canEditPath;
  ns.canDeleteObject = canDeleteObject;
  ns.canEditSelection = canEditSelection;
  ns.readOnlyMessage = readOnlyMessage;
  ns.notifyReadOnly = notifyReadOnly;
  ns.createMemoForTarget = createMemoForTarget;
})(wuwei.collab);
