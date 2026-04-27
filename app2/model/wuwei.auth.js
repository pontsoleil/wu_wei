/**
 * wuwei.auth.js
 * audit / edit permission helper
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.auth = wuwei.auth || {};

(function (ns) {
  var common = wuwei.common;

  function pad2(n) {
    n = Number(n) || 0;
    return (n < 10 ? '0' : '') + n;
  }

  function formatTimestamp(date) {
    var d = date instanceof Date ? date : new Date();
    return d.getFullYear() + '-' +
      pad2(d.getMonth() + 1) + '-' +
      pad2(d.getDate()) + 'T' +
      pad2(d.getHours()) + ':' +
      pad2(d.getMinutes()) + ':' +
      pad2(d.getSeconds());
  }

  function ensureCurrentUser(currentUser) {
    var cu = currentUser || (common && common.state && common.state.currentUser) || null;
    if (!cu || !cu.user_id) {
      cu = common.createGuestCurrentUser();
      if (common && common.state) {
        common.state.currentUser = cu;
      }
    }
    if (!cu.role) {
      cu.role = 'general';
    }
    return cu;
  }

  function getCurrentUserId(currentUser) {
    var cu = ensureCurrentUser(currentUser);
    return cu && cu.user_id ? cu.user_id : '';
  }

  function getCurrentUserRole(currentUser) {
    var cu = ensureCurrentUser(currentUser);
    return cu && cu.role ? cu.role : 'general';
  }

  function detectOwner(record, currentUser) {
    var cu = ensureCurrentUser(currentUser);
    var href = '';

    if (!record || typeof record !== 'object') {
      return cu.user_id || '';
    }

    if (Object.prototype.hasOwnProperty.call(record, 'owner') ||
      Object.prototype.hasOwnProperty.call(record, 'url') ||
      Object.prototype.hasOwnProperty.call(record, 'uri')) {
      throw new Error('Runtime record contains legacy fields in wuwei.auth.detectOwner');
    }

    href =
      (record.resource && (record.resource.canonicalUri || record.resource.uri)) ||
      '';

    href = String(href || '').trim();
    if (!href) {
      return cu.user_id || '';
    }

    try {
      var u = new URL(href, location.href);
      if (/^https?:$/i.test(u.protocol)) {
        return u.origin;
      }
    } catch (e) {
      // ignore
    }

    return cu.user_id || '';
  }

  function normalizeAudit(audit, record, currentUser) {
    var cu = ensureCurrentUser(currentUser);
    audit = audit || {};

    if (record && (
      Object.prototype.hasOwnProperty.call(record, 'owner') ||
      Object.prototype.hasOwnProperty.call(record, 'createdBy') ||
      Object.prototype.hasOwnProperty.call(record, 'createdAt') ||
      Object.prototype.hasOwnProperty.call(record, 'lastModifiedBy') ||
      Object.prototype.hasOwnProperty.call(record, 'lastModifiedAt')
    )) {
      throw new Error('Runtime record contains legacy top-level audit fields');
    }

    return {
      owner: String(
        audit.owner || ''
      ),
      createdBy: String(
        audit.createdBy || ''
      ),
      createdAt: String(
        audit.createdAt || ''
      ),
      lastModifiedBy: String(
        audit.lastModifiedBy || ''
      ),
      lastModifiedAt: String(
        audit.lastModifiedAt || ''
      )
    };
  }

  function touchCreatedRecord(record, currentUser) {
    var cu = ensureCurrentUser(currentUser);
    var now = formatTimestamp(new Date());

    if (!record || typeof record !== 'object') {
      return record;
    }

    record.audit = normalizeAudit(record.audit, record, cu);

    if (!record.audit.owner) {
      record.audit.owner = detectOwner(record, cu);
    }
    if (!record.audit.createdBy) {
      record.audit.createdBy = cu.user_id;
    }
    if (!record.audit.createdAt) {
      record.audit.createdAt = now;
    }
    if (!record.audit.lastModifiedBy) {
      record.audit.lastModifiedBy = cu.user_id;
    }
    if (!record.audit.lastModifiedAt) {
      record.audit.lastModifiedAt = now;
    }

    return record;
  }

  function touchModifiedRecord(record, currentUser) {
    var cu = ensureCurrentUser(currentUser);
    var now = formatTimestamp(new Date());

    if (!record || typeof record !== 'object') {
      return record;
    }

    record.audit = normalizeAudit(record.audit, record, cu);

    if (!record.audit.owner) {
      record.audit.owner = detectOwner(record, cu);
    }
    if (!record.audit.createdBy) {
      record.audit.createdBy = cu.user_id;
    }
    if (!record.audit.createdAt) {
      record.audit.createdAt = now;
    }

    record.audit.lastModifiedBy = cu.user_id;
    record.audit.lastModifiedAt = now;

    return record;
  }

  function canEditRecord(record, currentUser) {
    var cu = ensureCurrentUser(currentUser);
    var role = getCurrentUserRole(cu);
    var audit = record && record.audit ? record.audit : null;

    if (!record) {
      return false;
    }

    if (role === 'privileged' || role === 'teacher' || role === 'admin') {
      return true;
    }

    if (!audit || !audit.createdBy) {
      throw new Error('Runtime record must provide audit.createdBy');
    }

    return audit.createdBy === cu.user_id;
  }

  ns.formatTimestamp = formatTimestamp;
  ns.ensureCurrentUser = ensureCurrentUser;
  ns.getCurrentUserId = getCurrentUserId;
  ns.getCurrentUserRole = getCurrentUserRole;
  ns.normalizeAudit = normalizeAudit;
  ns.touchCreatedRecord = touchCreatedRecord;
  ns.touchModifiedRecord = touchModifiedRecord;
  ns.canEditRecord = canEditRecord;
  ns.detectOwner = detectOwner;
})(wuwei.auth);
