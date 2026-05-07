/**
 * wuwei.contents.js
 * document contents axis helpers
 *
 * Step 1: PDF page axis.
 */
wuwei.contents = wuwei.contents || {};

(function (ns) {
  'use strict';

  var common = wuwei.common;
  var state = common.state;
  var graph = common.graph;
  var model = wuwei.model;
  var util = wuwei.util;
  var AXIS_LENGTH = 400;

  function makeUuid() {
    return (util && typeof util.createUuid === 'function')
      ? util.createUuid()
      : ('_' + Date.now() + '_' + Math.random().toString(16).slice(2));
  }

  function getCurrentOwnerId() {
    return (common && typeof common.getCurrentOwnerId === 'function')
      ? common.getCurrentOwnerId()
      : ((state && state.currentUser && state.currentUser.user_id) || '');
  }

  function makeAudit() {
    return {
      owner: 'guest',
      createdBy: getCurrentOwnerId(),
      createdAt: new Date().toISOString(),
      lastModifiedBy: '',
      lastModifiedAt: ''
    };
  }

  function getCurrentPage() {
    return common && common.current ? common.current.page || null : null;
  }

  function ensurePageCollections(page) {
    if (!page) { return; }
    if (!Array.isArray(page.nodes)) { page.nodes = []; }
    if (!Array.isArray(page.links)) { page.links = []; }
    if (!Array.isArray(page.groups)) { page.groups = []; }
  }

  function isContentsGroup(group) {
    return !!(group && group.type === 'contents');
  }

  function isContentsPageNode(node) {
    return !!(node && node.topicKind === 'contents-page' && node.contentsRef);
  }

  function isContentsAxisLink(link) {
    return !!(link && link.type === 'Link' &&
      (link.groupType === 'contentsAxis' || link.linkType === 'contents-axis'));
  }

  function isPdfResourceNode(node) {
    var resource = (node && node.resource && typeof node.resource === 'object') ? node.resource : {};
    var media = (resource.media && typeof resource.media === 'object') ? resource.media : {};
    var contents = (resource.contents && typeof resource.contents === 'object') ? resource.contents : {};
    var mime = String(resource.mimeType || media.mimeType || node && (node.contenttype || node.contentType) || '').toLowerCase();
    var storageFiles = (resource.storage && Array.isArray(resource.storage.files)) ? resource.storage.files : [];
    var originalFile = storageFiles.find(function (file) {
      return file && String(file.role || '').toLowerCase() === 'original';
    }) || {};
    var previewFile = storageFiles.find(function (file) {
      return file && String(file.role || '').toLowerCase() === 'preview';
    }) || {};
    var fileName = String(resource.file || resource.filename || originalFile.path || '').toLowerCase();
    var previewName = String(previewFile.path || previewFile.file || '').toLowerCase();
    var uri = String(
      (util && typeof util.getResourceOriginalUri === 'function' ? util.getResourceOriginalUri(node) : '') ||
      resource.canonicalUri ||
      resource.uri ||
      ''
    ).toLowerCase();
    var hasPageAxis = String(contents.type || '').toLowerCase() === 'pdf' &&
      Number(contents.pageCount || media.pageCount || resource.pageCount || node && node.pageCount || 0) > 0;
    return !!(node && node.type === 'Content' &&
      (mime.indexOf('application/pdf') === 0 ||
        /\.pdf(?:[?#].*)?$/.test(uri) ||
        /\.pdf(?:[?#].*)?$/.test(fileName) ||
        /\.pdf(?:[?#].*)?$/.test(previewName) ||
        hasPageAxis));
  }

  function getDocumentPageCount(node) {
    var resource = (node && node.resource && typeof node.resource === 'object') ? node.resource : {};
    var media = (resource.media && typeof resource.media === 'object') ? resource.media : {};
    var contents = (resource.contents && typeof resource.contents === 'object') ? resource.contents : {};
    var n = Number(
      contents.pageCount ||
      media.pageCount ||
      resource.pageCount ||
      node && node.pageCount ||
      0
    );
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }

  function defaultAxisOrigin(documentNode) {
    var x = Number.isFinite(Number(documentNode && documentNode.x)) ? Number(documentNode.x) : 0;
    var y = Number.isFinite(Number(documentNode && documentNode.y)) ? Number(documentNode.y) : 0;
    var p = model && typeof model.newPosition === 'function' ? model.newPosition(x, y) : null;
    if (p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y))) {
      return { x: Number(p.x), y: Number(p.y) };
    }
    return { x: x + 90, y: y + 90 };
  }

  function setMemberIds(group, ids) {
    group.members = (ids || []).filter(Boolean).slice();
  }

  function getMemberNodes(group) {
    var page = getCurrentPage();
    var ids = [];
    if (!page || !group || !Array.isArray(group.members)) {
      return [];
    }
    ids = group.members.map(function (member) {
      return (member && member.nodeId) ? member.nodeId : member;
    }).filter(Boolean);
    return ids.map(function (id) {
      return model.findNodeById(id);
    }).filter(Boolean);
  }

  function memberId(member) {
    return (member && member.nodeId) ? member.nodeId : member;
  }

  function makeDocumentEntryLink(group, documentNode, entryNode) {
    return {
      id: makeUuid(),
      type: 'Link',
      from: documentNode.id,
      to: entryNode.id,
      relation: 'contents',
      label: '',
      description: { format: 'plain', body: '' },
      shape: 'NORMAL',
      visible: true,
      style: {
        font: common.defaultFont,
        line: { kind: 'SOLID', color: '#c0c0c0', width: 2 }
      },
      color: '#c0c0c0',
      size: 2,
      contentsRef: group.id,
      linkRole: 'contents-entry',
      audit: makeAudit()
    };
  }

  function ensureDocumentEntryLink(group) {
    var page = getCurrentPage();
    var documentNode, entryNode, exists;
    if (!page || !group || !Array.isArray(group.members) || !group.members.length) { return null; }
    documentNode = findDocumentNodeForGroup(group, null);
    entryNode = model.findNodeById(memberId(group.members[0]));
    if (!documentNode || !entryNode) { return null; }
    exists = (page.links || []).some(function (link) {
      return link && link.from === documentNode.id && link.to === entryNode.id &&
        (link.linkRole === 'contents-entry' || link.contentsRef === group.id || link.relation === 'contents');
    });
    if (exists) { return null; }
    var link = makeDocumentEntryLink(group, documentNode, entryNode);
    page.links.push(link);
    return link;
  }

  function createPageNode(group, pageNumber, option) {
    option = option || {};
    return {
      id: option.id || makeUuid(),
      type: 'PageMarker',
      topicKind: 'contents-page',
      contentsRef: group.id,
      documentRef: group.documentRef,
      pageNumber: pageNumber,
      axisRole: option.axisRole || 'entry',
      label: option.label || ('p.' + pageNumber),
      description: { format: 'plain/text', body: option.comment || option.description || '' },
      shape: 'CIRCLE',
      size: { radius: 18 },
      color: '#ffffff',
      outline: '#4c6b8a',
      style: {
        font: common.defaultFont,
        line: { kind: 'SOLID', color: '#4c6b8a', width: 1 }
      },
      font: common.defaultFont,
      visible: true,
      changed: true,
      x: Number.isFinite(Number(option.x)) ? Number(option.x) : 0,
      y: Number.isFinite(Number(option.y)) ? Number(option.y) : 0,
      fx: null,
      fy: null,
      audit: makeAudit()
    };
  }

  function ensurePageNodeDefaults(group, node, index) {
    node.id = node.id || makeUuid();
    node.type = 'PageMarker';
    node.topicKind = 'contents-page';
    node.contentsRef = group.id;
    node.documentRef = group.documentRef;
    node.pageNumber = Math.max(1, Math.floor(Number(node.pageNumber || index + 1)));
    node.axisRole = node.axisRole || 'entry';
    node.label = node.label || ('p.' + node.pageNumber);
    node.shape = 'CIRCLE';
    node.size = { radius: Number((node.size && node.size.radius) || 18) };
    node.color = node.color || '#ffffff';
    node.outline = node.outline || '#4c6b8a';
    node.style = (node.style && 'object' === typeof node.style) ? node.style : {};
    node.style.font = node.style.font || common.defaultFont;
    node.style.line = (node.style.line && 'object' === typeof node.style.line) ? node.style.line : {};
    node.style.line.kind = node.style.line.kind || 'SOLID';
    node.style.line.color = node.style.line.color || node.outline;
    node.style.line.width = Math.max(0, Number(node.style.line.width || node.outlineWidth || 1));
    node.outline = node.style.line.color;
    node.outlineWidth = node.style.line.width;
    node.font = node.font || common.defaultFont;
    node.visible = (false !== node.visible);
    node.changed = true;
    if (!Number.isFinite(Number(node.x))) { node.x = 0; }
    if (!Number.isFinite(Number(node.y))) { node.y = 0; }
    return node;
  }

  function clampPageNumber(group, pageNumber) {
    var value = Math.floor(Number(pageNumber || 1));
    if (!Number.isFinite(value)) { value = 1; }
    if (value < 1) { value = 1; }
    return value;
  }

  function layoutAxisGroup(group) {
    var axis, pageCount, length, orientation, anchor, members, range;
    if (!group) { return null; }

    axis = group.axis || {};
    pageCount = Math.max(1, Math.floor(Number(group.pageCount || axis.end || 1)));
    getMemberNodes(group).forEach(function (node) {
      pageCount = Math.max(pageCount, clampPageNumber(group, node && node.pageNumber));
    });
    length = Math.max(60, Number(group.length || AXIS_LENGTH));
    orientation = (group.orientation === 'vertical') ? 'vertical' : 'horizontal';
    anchor = {
      x: (axis.anchor && Number.isFinite(Number(axis.anchor.x))) ? Number(axis.anchor.x) : ((group.origin && Number.isFinite(Number(group.origin.x))) ? Number(group.origin.x) : 0),
      y: (axis.anchor && Number.isFinite(Number(axis.anchor.y))) ? Number(axis.anchor.y) : ((group.origin && Number.isFinite(Number(group.origin.y))) ? Number(group.origin.y) : 0)
    };

    group.axis = group.axis || {};
    group.axis.anchor = anchor;
    group.origin = { x: anchor.x, y: anchor.y };
    group.axis.start = 1;
    group.axis.end = pageCount;
    group.axis.unit = 'page';
    group.pageCount = pageCount;
    group.length = length;
    range = Math.max(pageCount - 1, 1);

    members = getMemberNodes(group).sort(function (a, b) {
      return Number(a.pageNumber || 0) - Number(b.pageNumber || 0);
    });
    members.forEach(function (node, index) {
      var pageNumber = clampPageNumber(group, node.pageNumber || index + 1);
      var ratio = (pageNumber - 1) / range;
      node.pageNumber = pageNumber;
      node.x = (orientation === 'vertical') ? anchor.x : (anchor.x + (length * ratio));
      node.y = (orientation === 'vertical') ? (anchor.y + (length * ratio)) : anchor.y;
      node.fx = node.x;
      node.fy = node.y;
      ensurePageNodeDefaults(group, node, index);
    });

    return group;
  }

  function findDocumentNodeForGroup(group, point) {
    var page = getCurrentPage();
    var ids, nodes, found;
    if (!page || !group) { return null; }
    ids = [
      group.documentRef,
      group.mediaRef,
      point && point.documentRef
    ].filter(Boolean);
    for (var i = 0; i < ids.length; i += 1) {
      found = model.findNodeById(ids[i]);
      if (isPdfResourceNode(found)) {
        return found;
      }
    }
    nodes = (page.nodes || []).filter(function (node) {
      return isPdfResourceNode(node);
    });
    if (nodes.length === 1) {
      return nodes[0];
    }
    return null;
  }

  function normalizeAxisGroup(group) {
    var page = getCurrentPage();
    if (!group) { return null; }
    ensurePageCollections(page);
    group.type = 'contents';
    group.groupType = 'axis';
    group.enabled = (false !== group.enabled);
    group.orientation = (group.orientation === 'vertical') ? 'vertical' : 'horizontal';
    group.spine = group.spine || {};
    group.spine.visible = (false !== group.spine.visible);
    group.spine.color = group.spine.color || group.strokeColor || common.defaultStyle.group.contents.color;
    group.spine.width = Math.max(1, Number(group.spine.width || group.strokeWidth || common.defaultStyle.group.contents.width));
    group.strokeColor = group.spine.color;
    group.strokeWidth = group.spine.width;
    group.axisPseudoLinkId = group.axisPseudoLinkId || makeUuid();
    group.axis = group.axis || {};
    group.axis.mode = group.axis.mode || 'document';
    group.axis.unit = 'page';
    group.axis.anchor = group.axis.anchor || {};
    if (!Number.isFinite(Number(group.axis.anchor.x))) {
      group.axis.anchor.x = Number.isFinite(Number(group.origin && group.origin.x)) ? Number(group.origin.x) : 0;
    }
    if (!Number.isFinite(Number(group.axis.anchor.y))) {
      group.axis.anchor.y = Number.isFinite(Number(group.origin && group.origin.y)) ? Number(group.origin.y) : 0;
    }
    group.origin = group.origin || { x: Number(group.axis.anchor.x || 0), y: Number(group.axis.anchor.y || 0) };
    if (!Array.isArray(group.members)) { group.members = []; }
    group.entries = Array.isArray(group.entries) ? group.entries : [];
    if (!group.members.length && group.entries.length) {
      group.members = group.entries.map(function (entry, index) {
        return {
          nodeId: entry && (entry.nodeId || entry.id) || '',
          order: Number(entry && entry.order || index + 1),
          role: 'member'
        };
      }).filter(function (member) {
        return !!member.nodeId;
      });
    }
    group.length = Math.max(60, Number(group.length || AXIS_LENGTH));
    if (!group.documentRef) {
      var documentNode = findDocumentNodeForGroup(group, null);
      if (documentNode) {
        group.documentRef = documentNode.id;
      }
    }
    getMemberNodes(group).forEach(function (node, index) {
      ensurePageNodeDefaults(group, node, index);
      if (!node.documentRef && group.documentRef) {
        node.documentRef = group.documentRef;
      }
    });
    delete group.contents;
    ensureDocumentEntryLink(group);
    return layoutAxisGroup(group);
  }

  function normalizeAllAxisGroups(page) {
    ((page && page.groups) || []).forEach(function (group) {
      if (isContentsGroup(group)) {
        normalizeAxisGroup(group);
      }
    });
    return page;
  }

  function rebuildGraphAndRefresh() {
    var page = getCurrentPage();
    if (page) {
      normalizeAllAxisGroups(page);
    }
    model.setGraphFromCurrentPage();
    wuwei.draw.reRender();
  }

  function buildContentsAxisPseudoLink(group) {
    if (!group || false === group.enabled || !isContentsGroup(group)) {
      return null;
    }
    return {
      id: group.axisPseudoLinkId || makeUuid(),
      type: 'Link',
      pseudo: true,
      shape: (group.orientation === 'vertical') ? 'VERTICAL' : 'HORIZONTAL',
      linkType: 'contents-axis',
      groupType: 'contentsAxis',
      groupRef: group.id,
      visible: true,
      color: (group.spine && group.spine.color) || group.strokeColor || common.defaultStyle.group.contents.color,
      size: (group.spine && group.spine.width) || group.strokeWidth || common.defaultStyle.group.contents.width,
      font: { size: '12pt', color: common.Color.linkText, family: 'Arial' },
      audit: makeAudit()
    };
  }

  function createAxisGroup(axis, documentCandidate, option) {
    var page, documentNode, pageCount, origin, group, nodes;
    option = option || {};
    if (model && typeof model.syncPageFromGraph === 'function') {
      model.syncPageFromGraph();
    }
    page = getCurrentPage();
    if (!page) { return null; }
    ensurePageCollections(page);
    documentNode = documentCandidate && documentCandidate.id
      ? (model.findNodeById(documentCandidate.id) || documentCandidate)
      : null;
    if (!isPdfResourceNode(documentNode)) {
      if (!option.silent) {
        window.alert('PDFまたはOffice文書を 1 件選択してから contents を作成してください。');
      }
      return null;
    }
    pageCount = getDocumentPageCount(documentNode);
    if (!pageCount) {
      if (!option.silent) {
        window.alert('文書のページ数が未取得のため contents を作成できません。アップロードし直すか resource の pageCount を設定してください。');
      }
      return null;
    }

    origin = defaultAxisOrigin(documentNode);
    group = model.createGroup({
      id: makeUuid(),
      name: 'Contents',
      type: 'contents',
      groupType: 'axis',
      orientation: axis === 'vertical' ? 'vertical' : 'horizontal',
      documentRef: documentNode.id,
      pageCount: pageCount,
      spine: {
        visible: true,
        color: common.defaultStyle.group.contents.color,
        width: common.defaultStyle.group.contents.width,
        padding: common.defaultStyle.group.padding
      },
      axis: { mode: 'document', unit: 'page', start: 1, end: pageCount, anchor: { x: origin.x, y: origin.y } },
      origin: origin,
      length: AXIS_LENGTH,
      members: []
    });
    group.documentRef = documentNode.id;
    group.mediaRef = documentNode.id;
    group.pageCount = pageCount;
    page.groups.push(group);
    nodes = [createPageNode(group, 1, { axisRole: 'entry' })];
    nodes.forEach(function (node) {
      page.nodes.push(node);
    });
    setMemberIds(group, nodes.map(function (node) { return node.id; }));
    page.links.push(makeDocumentEntryLink(group, documentNode, nodes[0]));
    normalizeAxisGroup(group);
    rebuildGraphAndRefresh();
    return group;
  }

  function updateAxisGroup(group, props) {
    var orientationChanged = false;
    var resetStyle;
    if (!group || !isContentsGroup(group)) { return false; }
    props = props || {};
    if (props.orientation === 'vertical' || props.orientation === 'horizontal') {
      orientationChanged = group.orientation !== props.orientation;
      group.orientation = props.orientation;
    }
    resetStyle = orientationChanged &&
      !Object.prototype.hasOwnProperty.call(props, 'strokeWidth') &&
      !Object.prototype.hasOwnProperty.call(props, 'strokeColor');
    if (Number.isFinite(Number(props.length))) {
      group.length = Math.max(60, Number(props.length));
    }
    if (resetStyle) {
      group.spine = group.spine || {};
      group.spine.color = common.defaultStyle.group.contents.color;
      group.spine.width = Math.max(1, Number(common.defaultStyle.group.contents.width || 4));
      group.strokeColor = group.spine.color;
      group.strokeWidth = group.spine.width;
    }
    if (Number.isFinite(Number(props.strokeWidth))) {
      group.spine = group.spine || {};
      group.spine.width = Math.max(1, Number(props.strokeWidth));
      group.strokeWidth = group.spine.width;
    }
    if (props.strokeColor) {
      group.spine = group.spine || {};
      group.spine.color = props.strokeColor;
      group.strokeColor = props.strokeColor;
    }
    normalizeAxisGroup(group);
    rebuildGraphAndRefresh();
    return true;
  }

  function addEntry(groupOrTarget, pageNumber, entryOption) {
    var spec = getPageTargetSpec(groupOrTarget);
    var page = getCurrentPage();
    var group = spec && spec.group;
    var used, next, node;
    entryOption = entryOption || {};
    if (!page || !group) { return null; }
    ensurePageCollections(page);
    group.members = Array.isArray(group.members) ? group.members : [];
    used = getMemberNodes(group).map(function (n) { return Number(n.pageNumber || 0); });
    next = Math.max.apply(null, used.concat([0])) + 1;
    pageNumber = clampPageNumber(group, pageNumber || next);
    node = createPageNode(group, pageNumber, { axisRole: 'entry', comment: entryOption.comment || '' });
    page.nodes.push(node);
    group.members.push(node.id);
    normalizeAxisGroup(group);
    rebuildGraphAndRefresh();
    return node;
  }

  function createEntryDraft(groupOrTarget) {
    var spec = getPageTargetSpec(groupOrTarget);
    var group = spec && spec.group;
    var used, next, node;
    if (!group) { return null; }
    used = getMemberNodes(group).map(function (n) { return Number(n.pageNumber || 0); });
    next = Math.max.apply(null, used.concat([0])) + 1;
    node = createPageNode(group, clampPageNumber(group, next), {
      axisRole: 'entry',
      label: '',
      comment: ''
    });
    node.pendingContentsEntry = true;
    node.contentsEntryDraft = true;
    return node;
  }

  function commitEntryDraft(node) {
    var page = getCurrentPage();
    var group = node && model.findGroupById(node.contentsRef);
    if (!page || !group || !isContentsGroup(group)) { return false; }
    ensurePageCollections(page);
    group.members = Array.isArray(group.members) ? group.members : [];
    delete node.pendingContentsEntry;
    delete node.contentsEntryDraft;
    ensurePageNodeDefaults(group, node, group.members.length);
    node.pageNumber = clampPageNumber(group, node.pageNumber);
    page.nodes.push(node);
    group.members.push(node.id);
    normalizeAxisGroup(group);
    rebuildGraphAndRefresh();
    return true;
  }

  function updateEntryFromNode(node) {
    var group = node && model.findGroupById(node.contentsRef);
    if (!group || !isContentsGroup(group)) { return false; }
    ensurePageNodeDefaults(group, node, 0);
    node.pageNumber = clampPageNumber(group, node.pageNumber);
    normalizeAxisGroup(group);
    rebuildGraphAndRefresh();
    return true;
  }

  function deleteTarget(target) {
    var spec = getPageTargetSpec(target);
    var page = getCurrentPage();
    var group = spec && spec.group;
    var point = spec && spec.point;
    if (!page || !group) { return false; }
    if (!point && (isContentsAxisLink(target) || isContentsGroup(target))) {
      page.links = (page.links || []).filter(function (link) {
        return !(link && (link.groupRef === group.id || link.contentsRef === group.id));
      });
      page.nodes = (page.nodes || []).filter(function (node) {
        return !(node && node.contentsRef === group.id);
      });
      page.groups = (page.groups || []).filter(function (item) { return item && item.id !== group.id; });
      rebuildGraphAndRefresh();
      return true;
    }
    if (!point) { return false; }
    group.members = (group.members || []).filter(function (item) { return memberId(item) !== point.id; });
    page.links = (page.links || []).filter(function (link) {
      return !(link && (link.from === point.id || link.to === point.id || link.contentsRef === group.id && link.to === point.id));
    });
    page.nodes = (page.nodes || []).filter(function (node) { return !(node && node.id === point.id); });
    if (!group.members.length) {
      page.groups = (page.groups || []).filter(function (item) { return item && item.id !== group.id; });
    }
    rebuildGraphAndRefresh();
    return true;
  }

  function getPageTargetSpec(target) {
    var point, group, documentNode;
    if (!target) { return null; }
    if (isContentsPageNode(target)) {
      point = model.findNodeById(target.id) || target;
      group = model.findGroupById(point.contentsRef);
    }
    else if (isContentsAxisLink(target)) {
      group = model.findGroupById(target.groupRef);
    }
    else if (isContentsGroup(target)) {
      group = target;
    }
    if (!group || !isContentsGroup(group)) { return null; }
    documentNode = findDocumentNodeForGroup(group, point);
    if (documentNode) {
      group.documentRef = documentNode.id;
      if (point) {
        point.documentRef = documentNode.id;
      }
    }
    return {
      target: target,
      point: point || null,
      group: group,
      documentNode: documentNode,
      pageNumber: point ? Math.max(1, Math.floor(Number(point.pageNumber || 1))) : 1
    };
  }

  function appendPageFragment(uri, pageNumber) {
    var page = Math.max(1, Math.floor(Number(pageNumber || 1)));
    var base = toDirectUploadPdfUri(String(uri || '').replace(/#.*$/, ''));
    if (!base) { return ''; }
    return base + '#page=' + encodeURIComponent(page);
  }

  function buildDirectPdfViewerUrl(uri, pageNumber) {
    var page = Math.max(1, Math.floor(Number(pageNumber || 1)));
    var pdfUri = toDirectUploadPdfUri(String(uri || '').replace(/#.*$/, ''));
    if (!pdfUri) { return ''; }
    return appendPageFragment(pdfUri, page);
  }

  function encodeStoragePath(path) {
    return String(path || '')
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .split('/')
      .map(function (part) { return encodeURIComponent(part); })
      .join('/');
  }

  function getAppBasePath() {
    var path = (window.location && window.location.pathname) ? window.location.pathname : '/wu_wei2/';
    var marker = '/wu_wei2/';
    var idx = path.indexOf(marker);
    if (idx >= 0) {
      return path.slice(0, idx + marker.length);
    }
    return '/wu_wei2/';
  }

  function getResourceOwnerId(resource, node) {
    var audit = (resource && resource.audit && typeof resource.audit === 'object') ? resource.audit : {};
    var rights = (resource && resource.rights && typeof resource.rights === 'object') ? resource.rights : {};
    var nodeAudit = (node && node.audit && typeof node.audit === 'object') ? node.audit : {};

    return String(
      audit.owner ||
      audit.createdBy ||
      rights.owner ||
      nodeAudit.owner ||
      nodeAudit.createdBy ||
      (util && typeof util.getCurrentUserId === 'function' ? util.getCurrentUserId() : '') ||
      ''
    ).trim();
  }

  function toDirectUploadPdfUriFromPath(path, userId) {
    var rel = String(path || '').replace(/\\/g, '/').replace(/^\/+/, '');
    var uid = String(userId || '').trim();

    if (!rel || !uid || !/\.pdf$/i.test(rel)) {
      return '';
    }
    if (rel.indexOf('upload/') === 0) {
      rel = rel.slice('upload/'.length);
    }
    if (uid && rel.indexOf(uid + '/') === 0) {
      rel = rel.slice(uid.length + 1);
    }
    return new URL(
      getAppBasePath() + 'data/' + encodeURIComponent(uid) + '/upload/' + encodeStoragePath(rel),
      window.location.origin
    ).href;
  }

  function getDirectDocumentPdfUri(documentNode) {
    var resource = (documentNode && documentNode.resource && typeof documentNode.resource === 'object') ? documentNode.resource : {};
    var uid = getResourceOwnerId(resource, documentNode);
    var previewPath = '';
    var originalPath = '';

    if (util && typeof util.getResourceFilePath === 'function') {
      previewPath = util.getResourceFilePath(resource, 'preview', documentNode);
      originalPath = util.getResourceFilePath(resource, 'original', documentNode);
    }
    return toDirectUploadPdfUriFromPath(previewPath, uid) ||
      toDirectUploadPdfUriFromPath(originalPath, uid);
  }

  function toDirectUploadPdfUri(uri) {
    var parsed, area, path, uid;
    if (!uri || typeof window === 'undefined' || !window.location) { return uri; }
    try {
      parsed = new URL(uri, window.location.href);
    }
    catch (e) {
      return uri;
    }
    area = parsed.searchParams.get('area') || '';
    path = parsed.searchParams.get('path') || '';
    uid = parsed.searchParams.get('user_id') || '';
    if (area !== 'upload' || !path || !uid) { return uri; }
    if (!/(?:^|\/)(?:cgi-bin|server)\/load-file\.(?:py|cgi)$/i.test(parsed.pathname)) { return uri; }
    if (!/\.pdf$/i.test(path)) { return uri; }
    return new URL(
      getAppBasePath() + 'data/' + encodeURIComponent(uid) + '/upload/' + encodeStoragePath(path),
      window.location.origin
    ).href;
  }

  function getDocumentViewerUrl(documentNode, pageNumber) {
    var uri = getDirectDocumentPdfUri(documentNode);
    if (!documentNode) { return ''; }
    if (uri) {
      return appendPageFragment(uri, pageNumber);
    }
    if (util && typeof util.getResourcePreviewUri === 'function') {
      uri = util.getResourcePreviewUri(documentNode) || '';
    }
    if (!uri && util && typeof util.getResourceOriginalUri === 'function') {
      uri = util.getResourceOriginalUri(documentNode) || '';
    }
    return buildDirectPdfViewerUrl(uri, pageNumber);
  }

  ns.getCurrentPage = getCurrentPage;
  ns.isContentsGroup = isContentsGroup;
  ns.isContentsPageNode = isContentsPageNode;
  ns.isContentsAxisLink = isContentsAxisLink;
  ns.isPdfResourceNode = isPdfResourceNode;
  ns.getDocumentPageCount = getDocumentPageCount;
  ns.createAxisGroup = createAxisGroup;
  ns.updateAxisGroup = updateAxisGroup;
  ns.addEntry = addEntry;
  ns.createEntryDraft = createEntryDraft;
  ns.commitEntryDraft = commitEntryDraft;
  ns.updateEntryFromNode = updateEntryFromNode;
  ns.deleteTarget = deleteTarget;
  ns.normalizeAxisGroup = normalizeAxisGroup;
  ns.normalizeAllAxisGroups = normalizeAllAxisGroups;
  ns.buildContentsAxisPseudoLink = buildContentsAxisPseudoLink;
  ns.getPageTargetSpec = getPageTargetSpec;
  ns.getDocumentViewerUrl = getDocumentViewerUrl;
})(wuwei.contents);
// wuwei.contents.js
