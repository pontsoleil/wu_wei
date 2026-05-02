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
    var mime = String(resource.mimeType || media.mimeType || node && (node.contenttype || node.contentType) || '').toLowerCase();
    var storageFiles = (resource.storage && Array.isArray(resource.storage.files)) ? resource.storage.files : [];
    var originalFile = storageFiles.find(function (file) {
      return file && String(file.role || '').toLowerCase() === 'original';
    }) || {};
    var fileName = String(resource.file || resource.filename || originalFile.path || '').toLowerCase();
    var uri = String(
      (util && typeof util.getResourceOriginalUri === 'function' ? util.getResourceOriginalUri(node) : '') ||
      resource.canonicalUri ||
      resource.uri ||
      ''
    ).toLowerCase();
    return !!(node && node.type === 'Content' &&
      (mime.indexOf('application/pdf') === 0 || /\.pdf(?:[?#].*)?$/.test(uri) || /\.pdf(?:[?#].*)?$/.test(fileName)));
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
      type: 'Topic',
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
    node.type = node.type || 'Topic';
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
    node.font = node.font || common.defaultFont;
    node.visible = (false !== node.visible);
    node.changed = true;
    if (!Number.isFinite(Number(node.x))) { node.x = 0; }
    if (!Number.isFinite(Number(node.y))) { node.y = 0; }
    return node;
  }

  function layoutAxisGroup(group) {
    var axis, pageCount, length, orientation, anchor, members, range;
    if (!group) { return null; }

    axis = group.axis || {};
    pageCount = Math.max(1, Math.floor(Number(group.pageCount || axis.end || 1)));
    length = AXIS_LENGTH;
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
      var pageNumber = Math.max(1, Math.min(pageCount, Math.floor(Number(node.pageNumber || index + 1))));
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
      group.contents && group.contents.documentRef,
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
    group.spine.color = group.spine.color || group.strokeColor || '#4c6b8a';
    group.spine.width = Math.max(1, Number(group.spine.width || group.strokeWidth || 4));
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
    group.length = AXIS_LENGTH;
    group.entries = Array.isArray(group.entries) ? group.entries : [];
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
    if (!group.entries.length && group.members.length) {
      var firstMember = group.members[0];
      var firstId = firstMember && firstMember.nodeId ? firstMember.nodeId : firstMember;
      group.entries = [{
        role: 'entry',
        nodeId: firstId,
        pageNumber: 1
      }];
    }
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
      color: (group.spine && group.spine.color) || group.strokeColor || '#4c6b8a',
      size: (group.spine && group.spine.width) || group.strokeWidth || 4,
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
        window.alert('PDF文書を 1 件選択してから contents を作成してください。');
      }
      return null;
    }
    pageCount = getDocumentPageCount(documentNode);
    if (!pageCount) {
      if (!option.silent) {
        window.alert('PDFのページ数が未取得のため contents を作成できません。アップロードし直すか resource の pageCount を設定してください。');
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
      spine: { visible: true, color: '#4c6b8a', width: 4, padding: 12 },
      axis: { mode: 'document', unit: 'page', start: 1, end: pageCount, anchor: { x: origin.x, y: origin.y } },
      origin: origin,
      length: AXIS_LENGTH,
      members: [],
      contents: {
        type: 'pdf',
        axis: { unit: 'page', nodeType: 'page' },
        documentRef: documentNode.id,
        pageCount: pageCount
      }
    });
    group.documentRef = documentNode.id;
    group.mediaRef = documentNode.id;
    group.pageCount = pageCount;
    group.contents = {
      type: 'pdf',
      axis: { unit: 'page', nodeType: 'page' },
      documentRef: documentNode.id,
      pageCount: pageCount
    };
    page.groups.push(group);
    nodes = [createPageNode(group, 1, { axisRole: 'entry' })];
    nodes.forEach(function (node) {
      page.nodes.push(node);
    });
    setMemberIds(group, nodes.map(function (node) { return node.id; }));
    group.entries = [{ role: 'entry', nodeId: nodes[0].id, pageNumber: 1 }];
    page.links.push(makeDocumentEntryLink(group, documentNode, nodes[0]));
    normalizeAxisGroup(group);
    rebuildGraphAndRefresh();
    return group;
  }

  function updateAxisGroup(group, props) {
    if (!group || !isContentsGroup(group)) { return false; }
    props = props || {};
    if (props.orientation === 'vertical' || props.orientation === 'horizontal') {
      group.orientation = props.orientation;
    }
    normalizeAxisGroup(group);
    rebuildGraphAndRefresh();
    return true;
  }

  function addEntry(groupOrTarget, pageNumber, entryOption) {
    var spec = getPageTargetSpec(groupOrTarget);
    var page = getCurrentPage();
    var group = spec && spec.group;
    var used, next, node, pageInput, commentInput, maxPage;
    entryOption = entryOption || {};
    if (!page || !group) { return null; }
    used = getMemberNodes(group).map(function (n) { return Number(n.pageNumber || 0); });
    next = Math.max.apply(null, used.concat([0])) + 1;
    maxPage = Math.max(1, Number(group.pageCount || group.axis && group.axis.end || 1));
    if ((pageNumber == null || pageNumber === '') && !entryOption.silent &&
      typeof window !== 'undefined' && typeof window.prompt === 'function') {
      pageInput = window.prompt('ページ番号:', String(Math.min(next, maxPage)));
      if (pageInput === null) { return null; }
      pageNumber = pageInput;
      commentInput = window.prompt('コメント:', '');
      entryOption.comment = (commentInput === null) ? '' : commentInput;
    }
    pageNumber = Math.floor(Number(pageNumber || next));
    if (!Number.isFinite(pageNumber)) { pageNumber = next; }
    pageNumber = Math.max(1, pageNumber);
    if (pageNumber > maxPage) {
      pageNumber = maxPage;
    }
    node = createPageNode(group, pageNumber, { axisRole: 'entry', comment: entryOption.comment || '' });
    page.nodes.push(node);
    group.members.push(node.id);
    group.entries = Array.isArray(group.entries) ? group.entries : [];
    group.entries.push({ role: 'entry', nodeId: node.id, pageNumber: pageNumber, comment: entryOption.comment || '' });
    normalizeAxisGroup(group);
    rebuildGraphAndRefresh();
    return node;
  }

  function deleteTarget(target) {
    var spec = getPageTargetSpec(target);
    var page = getCurrentPage();
    var group = spec && spec.group;
    var point = spec && spec.point;
    if (!page || !group) { return false; }
    if (!point && isContentsAxisLink(target)) {
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
    group.entries = (group.entries || []).filter(function (item) { return memberId(item) !== point.id; });
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
    var base = String(uri || '').replace(/#.*$/, '');
    if (!base) { return ''; }
    return base + '#page=' + encodeURIComponent(page);
  }

  function getDocumentViewerUrl(documentNode, pageNumber) {
    var uri = '';
    if (!documentNode) { return ''; }
    if (util && typeof util.getResourcePreviewUri === 'function') {
      uri = util.getResourcePreviewUri(documentNode) || '';
    }
    if (!uri && util && typeof util.getResourceOriginalUri === 'function') {
      uri = util.getResourceOriginalUri(documentNode) || '';
    }
    return appendPageFragment(uri, pageNumber);
  }

  function getPageOpenUrl(point) {
    var spec = getPageTargetSpec(point);
    if (!spec || !spec.documentNode) { return ''; }
    return getDocumentViewerUrl(spec.documentNode, spec.pageNumber);
  }

  function openPageInInfo(point) {
    var spec = getPageTargetSpec(point);
    if (!spec || !spec.documentNode || !wuwei.info || typeof wuwei.info.open !== 'function') {
      return false;
    }
    wuwei.info.open(spec.documentNode, { page: spec.pageNumber, contentsPage: true });
    return true;
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
  ns.deleteTarget = deleteTarget;
  ns.normalizeAxisGroup = normalizeAxisGroup;
  ns.normalizeAllAxisGroups = normalizeAllAxisGroups;
  ns.buildContentsAxisPseudoLink = buildContentsAxisPseudoLink;
  ns.getPageTargetSpec = getPageTargetSpec;
  ns.getDocumentViewerUrl = getDocumentViewerUrl;
  ns.getPageOpenUrl = getPageOpenUrl;
  ns.openPageInInfo = openPageInInfo;
})(wuwei.contents);
// wuwei.contents.js
