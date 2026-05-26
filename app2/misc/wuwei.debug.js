/**
 * wuwei.debug.js
 * Debug-only helpers for WuWei.
 *
 * These functions are intended for browser console use during development.
 */
window.wuwei = window.wuwei || {};
wuwei.debug = wuwei.debug || {};

(function (ns) {
  'use strict';

  function currentNote() {
    return wuwei.common && wuwei.common.current ? wuwei.common.current : null;
  }

  function currentUserId() {
    return (wuwei.common &&
      wuwei.common.state &&
      wuwei.common.state.currentUser &&
      wuwei.common.state.currentUser.user_id) || '';
  }

  function currentOwnerId() {
    if (wuwei.auth && typeof wuwei.auth.getCurrentUserId === 'function') {
      return wuwei.auth.getCurrentUserId();
    }
    if (currentUserId()) {
      return currentUserId();
    }
    if (wuwei.common && typeof wuwei.common.getCurrentOwnerId === 'function') {
      return wuwei.common.getCurrentOwnerId();
    }
    return '';
  }

  function nowIsoString() {
    return new Date().toISOString();
  }

  function translate(key) {
    if (wuwei.nls && typeof wuwei.nls.translate === 'function') {
      return wuwei.nls.translate(key);
    }
    return key;
  }

  function getDisplayName(note) {
    var base = String(note && note.note_name || '');
    var suffix = '(' + translate('Joint Note') + ')';

    if (!isTeamNote(note)) {
      return base.replace(new RegExp('\\(' + translate('Joint Note').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\)$'), '');
    }
    return base.slice(-suffix.length) === suffix ? base : base + suffix;
  }

  function updateNoteNameDisplay(note) {
    var nameEl;
    var descEl;

    if (wuwei.note && typeof wuwei.note.updateNoteNameDisplay === 'function') {
      wuwei.note.updateNoteNameDisplay(note || currentNote());
      return;
    }

    nameEl = document.querySelector('#note_name .name');
    descEl = document.querySelector('#note_name .description');
    if (nameEl) {
      nameEl.textContent = getDisplayName(note || currentNote());
    }
    if (descEl) {
      descEl.textContent = note && note.description || '';
    }
  }

  function isTeamNote(note) {
    if (wuwei.joint && typeof wuwei.joint.isTeamNote === 'function') {
      return wuwei.joint.isTeamNote(note || currentNote());
    }

    var n = note || currentNote();
    var state;
    var scope;
    var origin;
    var originType;
    var originSource;

    if (!n) {
      return false;
    }

    state = String(n.jointNoteState || n.collabNoteState || '').toLowerCase();
    scope = String(n.note_scope || '').toLowerCase();
    origin = (n.origin && typeof n.origin === 'object') ? n.origin : {};
    originType = String(origin.type || '').toLowerCase();
    originSource = String(origin.source || '').toLowerCase();

    if (state === 'team') {
      return true;
    }
    if (state === 'own' || state === 'imported') {
      return false;
    }
    if (originType === 'import' || originSource === 'export-package') {
      return false;
    }

    return !!(
      scope === 'team' ||
      (n.joint && n.joint.enabled === true) ||
      (n.collaboration && n.collaboration.enabled === true) ||
      originType === 'team' ||
      originSource === 'team-note' ||
      n.team_id
    );
  }

  function setAuditModified(note) {
    var uid = currentOwnerId();

    note.audit = note.audit && typeof note.audit === 'object' ? note.audit : {};
    if (!note.audit.createdBy) {
      note.audit.createdBy = uid || '';
    }
    if (!note.audit.createdAt) {
      note.audit.createdAt = nowIsoString();
    }
    note.audit.lastModifiedBy = uid || note.audit.lastModifiedBy || '';
    note.audit.lastModifiedAt = nowIsoString();
  }

  function enableTeamNote(note, teamId) {
    var uid = currentOwnerId();

    note.jointNoteState = 'team';
    delete note.collabNoteState;
    note.note_scope = 'team';
    note.team_id = String(teamId || note.team_id || 't-debug');

    note.joint = Object.assign({}, note.joint || {}, {
      enabled: true,
      revision: Number(note.joint && note.joint.revision || 0),
      updatedAt: nowIsoString()
    });
    delete note.collaboration;

    note.origin = Object.assign({}, note.origin || {}, {
      type: 'team',
      source: 'team-note',
      debug: true,
      setBy: uid || '',
      setAt: nowIsoString()
    });

    setAuditModified(note);
  }

  function disableTeamNote(note) {
    note.jointNoteState = 'own';
    delete note.collabNoteState;
    note.note_scope = 'personal';

    if (note.joint && typeof note.joint === 'object') {
      note.joint.enabled = false;
      note.joint.state = 'own';
      delete note.joint.team_id;
    }

    delete note.collaboration;
    delete note.team_id;

    if (note.origin &&
      typeof note.origin === 'object' &&
      (note.origin.debug === true || note.origin.source === 'team-note')) {
      delete note.origin;
    }

    setAuditModified(note);
  }

  /**
   * Toggle the current note's debug team-note state.
   *
   * Usage:
   *   wuwei.debug.teamNote(true)        // mark current note as Joint Note / team note
   *   wuwei.debug.teamNote(false)       // mark current note as ordinary personal note
   *   wuwei.debug.teamNote()            // toggle current state
   *   wuwei.debug.teamNote(true, 't-test')
   */
  function teamNote(flag, teamId) {
    var note = currentNote();
    var enable;

    if (!note) {
      if (window.console && console.warn) {
        console.warn('wuwei.debug.teamNote: no current note is loaded.');
      }
      return null;
    }

    enable = (typeof flag === 'boolean') ? flag : !isTeamNote(note);

    if (enable) {
      enableTeamNote(note, teamId);
    }
    else {
      disableTeamNote(note);
    }

    updateNoteNameDisplay(note);

    if (window.console && console.info) {
      console.info('wuwei.debug.teamNote:', {
        enabled: isTeamNote(note),
        note_id: note.note_id,
        note_name: note.note_name,
        jointNoteState: note.jointNoteState,
        note_scope: note.note_scope,
        team_id: note.team_id || ''
      });
    }

    return {
      enabled: isTeamNote(note),
      note: note
    };
  }

  function cloneValue(value) {
    if (typeof value === 'undefined') {
      return undefined;
    }
    try {
      return JSON.parse(JSON.stringify(value));
    }
    catch (e) {
      return value;
    }
  }

  function snapshotJointFields(note) {
    var keys = [
      'jointNoteState',
      'collabNoteState',
      'note_scope',
      'team_id',
      'joint',
      'collaboration',
      'origin',
      'exchange'
    ];
    var snapshot = {};
    keys.forEach(function (key) {
      snapshot[key] = cloneValue(note[key]);
    });
    return snapshot;
  }

  function restoreJointFields(note, snapshot) {
    Object.keys(snapshot || {}).forEach(function (key) {
      if (typeof snapshot[key] === 'undefined') {
        delete note[key];
      }
      else {
        note[key] = cloneValue(snapshot[key]);
      }
    });
  }

  function normalizeNoteDisplay(note) {
    updateNoteNameDisplay(note);
    if (wuwei.draw && typeof wuwei.draw.restart === 'function') {
      try {
        wuwei.draw.restart();
      }
      catch (e) {
        /* Debug helpers should not fail only because redraw is unavailable. */
      }
    }
  }

  function setJointImported(option) {
    var note = currentNote();
    var opt = option || {};
    var uid = currentOwnerId();

    if (!note) {
      console.warn('wuwei.debug.setJointImported: no current note is loaded.');
      return null;
    }

    note.jointNoteState = 'imported';
    delete note.collabNoteState;
    note.note_scope = 'personal';
    note.team_id = '';
    if (note.joint && typeof note.joint === 'object') {
      note.joint.enabled = false;
    }
    delete note.collaboration;
    note.origin = Object.assign({}, note.origin || {}, {
      type: 'import',
      source: 'export-package',
      importedBy: uid || '',
      importedAt: opt.importedAt || nowIsoString()
    });
    note.exchange = Object.assign({}, note.exchange || {}, {
      imported: true,
      mode: 'imported',
      source: 'import',
      importedBy: uid || '',
      importedAt: opt.importedAt || nowIsoString()
    });
    setAuditModified(note);
    normalizeNoteDisplay(note);
    return jointState(note);
  }

  function setJointTeam(option) {
    var note = currentNote();
    var opt = option || {};

    if (!note) {
      console.warn('wuwei.debug.setJointTeam: no current note is loaded.');
      return null;
    }

    enableTeamNote(note, opt.team_id || opt.teamId);
    normalizeNoteDisplay(note);
    return jointState(note);
  }

  function setJointOwn() {
    var note = currentNote();

    if (!note) {
      console.warn('wuwei.debug.setJointOwn: no current note is loaded.');
      return null;
    }

    disableTeamNote(note);
    if (note.origin &&
      typeof note.origin === 'object' &&
      (note.origin.type === 'import' || note.origin.source === 'export-package')) {
      delete note.origin;
    }
    note.exchange = Object.assign({}, note.exchange || {}, {
      imported: false,
      mode: '',
      source: ''
    });
    normalizeNoteDisplay(note);
    return jointState(note);
  }

  function jointState(note) {
    var n = note || currentNote();
    var joint = wuwei.joint || {};
    if (!n) {
      return null;
    }
    return {
      note_id: n.note_id || '',
      jointNoteState: n.jointNoteState || '',
      collabNoteState: n.collabNoteState || '',
      note_scope: n.note_scope || '',
      team_id: n.team_id || '',
      origin: cloneValue(n.origin || null),
      exchange: cloneValue(n.exchange || null),
      isImportedNote: typeof joint.isImportedNote === 'function' ? joint.isImportedNote(n) : false,
      isTeamNote: typeof joint.isTeamNote === 'function' ? joint.isTeamNote(n) : isTeamNote(n),
      noteState: typeof joint.getNoteState === 'function' ? joint.getNoteState(n) : ''
    };
  }

  function makeDebugRecord(ownerId) {
    return {
      id: 'debug-record-' + String(ownerId || 'other').replace(/[^A-Za-z0-9_-]/g, '_'),
      type: 'Content',
      label: 'Debug record',
      x: 10,
      y: 10,
      visible: true,
      description: {
        format: 'asciidoc',
        body: 'debug'
      },
      audit: {
        createdBy: ownerId,
        createdAt: nowIsoString(),
        lastModifiedBy: '',
        lastModifiedAt: ''
      }
    };
  }

  function exportCurrentNoteJson() {
    if (wuwei.note && typeof wuwei.note.exportNoteText === 'function') {
      return JSON.parse(wuwei.note.exportNoteText());
    }
    return null;
  }

  function pushCheck(checks, name, actual, expected) {
    var ok = actual === expected;
    checks.push({
      ok: ok,
      name: name,
      actual: actual,
      expected: expected
    });
    return ok;
  }

  function checkExportState(checks, prefix, expectedState, expectedScope, expectedOriginType, expectedOriginSource) {
    var exported;
    try {
      exported = exportCurrentNoteJson();
    }
    catch (e) {
      checks.push({
        ok: false,
        name: prefix + ': exportNoteText',
        actual: e && e.message ? e.message : String(e),
        expected: 'exportable JSON'
      });
      return;
    }
    if (!exported) {
      checks.push({
        ok: false,
        name: prefix + ': exportNoteText',
        actual: 'unavailable',
        expected: 'exportable JSON'
      });
      return;
    }
    pushCheck(checks, prefix + ': exported jointNoteState', exported.jointNoteState, expectedState);
    pushCheck(checks, prefix + ': exported note_scope', exported.note_scope, expectedScope);
    pushCheck(checks, prefix + ': exported origin.type',
      exported.origin && exported.origin.type, expectedOriginType);
    pushCheck(checks, prefix + ': exported origin.source',
      exported.origin && exported.origin.source, expectedOriginSource);
  }

  function runJointStep1NoServerTest(option) {
    var opt = option || {};
    var note = currentNote();
    var joint = wuwei.joint || {};
    var snapshot;
    var checks = [];
    var ownRecord;
    var otherRecord;
    var ownerId = currentOwnerId() || 'debug-current-user';
    var otherOwnerId = opt.otherOwnerId || 'debug-other-user';
    var restore = opt.restore !== false;

    if (!note) {
      return {
        ok: false,
        error: 'No current note is loaded. Open a note first.'
      };
    }
    if (!joint || typeof joint.canEditPath !== 'function' || typeof joint.canDeleteObject !== 'function') {
      return {
        ok: false,
        error: 'wuwei.joint is not loaded.'
      };
    }

    snapshot = snapshotJointFields(note);
    ownRecord = makeDebugRecord(ownerId);
    otherRecord = makeDebugRecord(otherOwnerId);

    setJointImported();
    pushCheck(checks, 'import: getNoteState', joint.getNoteState(note), 'imported');
    pushCheck(checks, 'import: isImportedNote', joint.isImportedNote(note), true);
    pushCheck(checks, 'import: isTeamNote', joint.isTeamNote(note), false);
    pushCheck(checks, 'import: own label edit', joint.canEditPath(ownRecord, 'label', 'node'), true);
    pushCheck(checks, 'import: other description supplement', joint.canEditPath(otherRecord, 'description.body', 'node'), true);
    pushCheck(checks, 'import: other layout edit', joint.canEditPath(otherRecord, 'x', 'node'), true);
    pushCheck(checks, 'import: other semantic edit', joint.canEditPath(otherRecord, 'label', 'node'), false);
    pushCheck(checks, 'import: other soft delete', joint.canDeleteObject(otherRecord), true);
    checkExportState(checks, 'import', 'imported', 'personal', 'import', 'export-package');

    setJointTeam({ team_id: opt.team_id || opt.teamId || 't-debug' });
    pushCheck(checks, 'team: getNoteState', joint.getNoteState(note), 'team');
    pushCheck(checks, 'team: isTeamNote', joint.isTeamNote(note), true);
    pushCheck(checks, 'team: isImportedNote', joint.isImportedNote(note), false);
    pushCheck(checks, 'team: own label edit', joint.canEditPath(ownRecord, 'label', 'node'), true);
    pushCheck(checks, 'team: other description edit', joint.canEditPath(otherRecord, 'description.body', 'node'), false);
    pushCheck(checks, 'team: other layout edit', joint.canEditPath(otherRecord, 'x', 'node'), false);
    pushCheck(checks, 'team: other delete', joint.canDeleteObject(otherRecord), false);
    checkExportState(checks, 'team', 'team', 'team', 'team', 'team-note');

    setJointOwn();
    pushCheck(checks, 'own: getNoteState', joint.getNoteState(note), 'own');
    pushCheck(checks, 'own: isTeamNote', joint.isTeamNote(note), false);
    pushCheck(checks, 'own: isImportedNote', joint.isImportedNote(note), false);

    if (restore) {
      restoreJointFields(note, snapshot);
      normalizeNoteDisplay(note);
    }

    var result = {
      ok: checks.every(function (item) { return item.ok; }),
      restored: restore,
      checks: checks,
      state: jointState(note)
    };

    if (window.console && console.table) {
      console.table(checks);
    }
    if (window.console && console.info) {
      console.info('wuwei.debug.runJointStep1NoServerTest:', result);
    }
    return result;
  }

  ns.isTeamNote = isTeamNote;
  ns.teamNote = teamNote;
  ns.jointState = jointState;
  ns.setJointImported = setJointImported;
  ns.setJointTeam = setJointTeam;
  ns.setJointOwn = setJointOwn;
  ns.runJointStep1NoServerTest = runJointStep1NoServerTest;
})(wuwei.debug);
// wuwei.debug.js 2026-05-25
