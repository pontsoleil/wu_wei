/**
 * wuwei.contents.js
 * document contents axis helpers
 *
 * A contents axis manages contentTarget markers.
 * The target content can be PDF, Office preview, HTML, image, or another
 * previewable content resource.  PDF page numbers are only one possible
 * form of contentTarget metadata.
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
    return !!(node && node.type === 'PageMarker' && node.groupRef);
  }

  function isContentsAxisLink(link) {
    return !!(link && link.type === 'Link' &&
      (link.groupType === 'contentsAxis' || link.linkType === 'contents-axis'));
  }

  function isContentTargetResourceNode(node) {
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
    var contentType = String(contents.type || resource.kind || resource.type || '').toLowerCase();
    var pageCount = Number(contents.pageCount || media.pageCount || resource.pageCount || node && node.pageCount || 0);
    var fileText = [uri, fileName, previewName].join(' ');
    var isPdf = mime.indexOf('application/pdf') === 0 || /\.pdf(?:[?#].*)?$/i.test(fileText);
    var isOffice = /(msword|officedocument|ms-excel|ms-powerpoint|vnd\.ms-|vnd\.openxmlformats)/i.test(mime) ||
      /\.(docx?|xlsx?|pptx?|odt|ods|odp)(?:[?#].*)?$/i.test(fileText);
    var isHtml = mime.indexOf('text/html') === 0 || /\.(html?|xhtml)(?:[?#].*)?$/i.test(fileText) || contentType === 'html' || contentType === 'web';
    var isPreviewable = isPdf || isOffice || isHtml || contentType === 'document' || contentType === 'contents' || contentType === 'content';
    var hasContentTargets = Number.isFinite(pageCount) && pageCount > 0;

    return !!(node && node.type === 'Content' && (isPreviewable || hasContentTargets));
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

  function hasKnownDocumentPages(node) {
    return getDocumentPageCount(node) > 0;
  }

  function getContentsAxisPageCount(group) {
    var pageCount = Number(group && (group.documentPageCount || group.pageCount || group.axis && group.axis.end) || 0);
    pageCount = Number.isFinite(pageCount) && pageCount > 0 ? Math.floor(pageCount) : 0;
    return Math.max(1, pageCount);
  }

  function makeContentTargetLabel(group, pageNumber, option) {
    if (option && option.label) {
      return option.label;
    }
    if (group && false === group.hasPageCount) {
      return 'content';
    }
    return 'p.' + pageNumber;
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

  function makeGroupMember(nodeId, index, role) {
    return {
      nodeId: nodeId,
      order: index + 1,
      role: role || 'member'
    };
  }

  function setMemberIds(group, ids) {
    group.members = (ids || []).filter(Boolean).map(function (id, index) {
      return makeGroupMember(id, index, 'member');
    });
  }

  function appendMember(group, nodeId, role) {
    if (!group || !nodeId) { return; }
    if (!Array.isArray(group.members)) { group.members = []; }
    if (getMemberNodes(group).some(function (node) { return node && node.id === nodeId; })) {
      return;
    }
    group.members.push(makeGroupMember(nodeId, group.members.length, role || 'member'));
  }

  function getMemberNodes(group) {
    var ids = [];
    if (!group || !Array.isArray(group.members)) {
      return [];
    }
    ids = group.members.map(function (member) {
      return member && member.nodeId;
    }).filter(Boolean);
    return ids.map(function (id) {
      return model.findNodeById(id);
    }).filter(Boolean);
  }

  function memberId(member) {
    return member && member.nodeId;
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
      groupRef: group.id,
      linkRole: 'contents-entry',
      audit: makeAudit()
    };
  }

  function getContentsRepresentativeNode(group) {
    var representative;
    if (!group) { return null; }
    representative = group.representativeNodeId ? model.findNodeById(group.representativeNodeId) : null;
    if (!representative && model && typeof model.ensureGroupRepresentativeTopic === 'function') {
      representative = model.ensureGroupRepresentativeTopic(group, {
        topicKind: 'contents-representative',
        label: group.name || 'Contents'
      });
    }
    return representative || null;
  }

  function ensureDocumentEntryLink(group) {
    var page = getCurrentPage();
    var documentNode, representative, exists, link;
    if (!page || !group) { return null; }
    documentNode = findDocumentNodeForGroup(group, null);
    representative = getContentsRepresentativeNode(group);
    if (!documentNode || !representative) { return null; }

    page.links = (page.links || []).filter(function (item) {
      if (!item || item.from !== documentNode.id || item.groupRef !== group.id) {
        return true;
      }
      if (item.linkRole !== 'contents-entry' && item.relation !== 'contents') {
        return true;
      }
      return item.to === representative.id;
    });

    exists = (page.links || []).some(function (item) {
      return item && item.from === documentNode.id && item.to === representative.id &&
        (item.linkRole === 'contents-entry' || item.groupRef === group.id || item.relation === 'contents');
    });
    if (exists) { return null; }
    link = makeDocumentEntryLink(group, documentNode, representative);
    page.links.push(link);
    return link;
  }

  function createPageNode(group, pageNumber, option) {
    option = option || {};
    return {
      id: option.id || makeUuid(),
      type: 'PageMarker',
      nodeKind: 'contentTarget',
      targetKind: 'contentTarget',
      topicKind: 'contents-page',
      groupRef: group.id,
      documentRef: group.documentRef,
      pageNumber: pageNumber,
      axisRole: option.axisRole || 'entry',
      label: makeContentTargetLabel(group, pageNumber, option),
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
      axisPos: Number.isFinite(Number(option.axisPos)) ? Number(option.axisPos) : undefined,
      fx: null,
      fy: null,
      audit: makeAudit()
    };
  }

  function ensurePageNodeDefaults(group, node, index) {
    node.id = node.id || makeUuid();
    node.type = 'PageMarker'; // kept for renderer/backward compatibility
    node.nodeKind = node.nodeKind || 'contentTarget';
    node.targetKind = node.targetKind || 'contentTarget';
    node.topicKind = 'contents-page';
    node.groupRef = group.id;
    node.documentRef = group.documentRef;
    node.pageNumber = Math.max(1, Math.floor(Number(node.pageNumber || index + 1)));
    node.axisRole = node.axisRole || 'entry';
    node.label = node.label || makeContentTargetLabel(group, node.pageNumber, null);
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

  function axisOrientation(group) {
    return (group && group.orientation === 'vertical') ? 'vertical' : 'horizontal';
  }

  function axisAnchor(group) {
    var axis = (group && group.axis) || {};
    return {
      x: (axis.anchor && Number.isFinite(Number(axis.anchor.x))) ? Number(axis.anchor.x) : ((group && group.origin && Number.isFinite(Number(group.origin.x))) ? Number(group.origin.x) : 0),
      y: (axis.anchor && Number.isFinite(Number(axis.anchor.y))) ? Number(axis.anchor.y) : ((group && group.origin && Number.isFinite(Number(group.origin.y))) ? Number(group.origin.y) : 0)
    };
  }

  function axisScalar(group, x, y) {
    return axisOrientation(group) === 'vertical' ? Number(y || 0) : Number(x || 0);
  }

  function getAxisPos(group, node) {
    var value = Number(node && node.axisPos);
    if (Number.isFinite(value)) {
      return value;
    }
    return axisOrientation(group) === 'vertical' ? Number(node && node.y || 0) : Number(node && node.x || 0);
  }

  function setNodeOnAxis(group, node, axisPos) {
    var anchor = axisAnchor(group);
    axisPos = Number(axisPos);
    if (!Number.isFinite(axisPos)) {
      axisPos = axisOrientation(group) === 'vertical' ? anchor.y : anchor.x;
    }
    node.axisPos = axisPos;
    if (axisOrientation(group) === 'vertical') {
      node.x = anchor.x;
      node.y = axisPos;
    }
    else {
      node.x = axisPos;
      node.y = anchor.y;
    }
    node.fx = node.x;
    node.fy = node.y;
    node.vx = 0;
    node.vy = 0;
    node.changed = true;
  }

  function pageRatio(group, node, pageCount) {
    var range = Math.max(pageCount - 1, 1);
    var pageNumber = clampPageNumber(group, node && node.pageNumber);
    return Math.max(0, Math.min(1, (pageNumber - 1) / range));
  }

  function orderedPageMembers(group) {
    var members = getMemberNodes(group).sort(function (a, b) {
      var pa = Number(a.pageNumber || 0);
      var pb = Number(b.pageNumber || 0);
      if (pa !== pb) {
        return pa - pb;
      }
      return String(a.id).localeCompare(String(b.id));
    });
    setMemberIds(group, members.map(function (node) { return node.id; }));
    return members;
  }

  function assignMissingAxisPositions(group, members, pageCount) {
    var anchor = axisAnchor(group);
    var anchorPos = axisOrientation(group) === 'vertical' ? anchor.y : anchor.x;
    var length = Math.max(60, Number(group.length || AXIS_LENGTH));
    var gap = Math.max(40, Number(group.axisGap || 80));
    var anyPositioned = members.some(function (node) {
      return Number.isFinite(Number(node.axisPos));
    });

    if (!anyPositioned) {
      members.forEach(function (node) {
        node.axisPos = anchorPos + (length * pageRatio(group, node, pageCount));
      });
      return;
    }

    members.forEach(function (node, index) {
      var prev, next, i;
      if (Number.isFinite(Number(node.axisPos))) {
        node.axisPos = Number(node.axisPos);
        return;
      }
      for (i = index - 1; i >= 0; i -= 1) {
        if (Number.isFinite(Number(members[i].axisPos))) {
          prev = members[i];
          break;
        }
      }
      for (i = index + 1; i < members.length; i += 1) {
        if (Number.isFinite(Number(members[i].axisPos))) {
          next = members[i];
          break;
        }
      }
      if (prev && next) {
        node.axisPos = (Number(prev.axisPos) + Number(next.axisPos)) / 2;
      }
      else if (prev) {
        node.axisPos = Number(prev.axisPos) + gap;
      }
      else if (next) {
        node.axisPos = Number(next.axisPos) - gap;
      }
      else {
        node.axisPos = anchorPos + (length * pageRatio(group, node, pageCount));
      }
    });
  }

  function updateAxisBoundsFromPositions(group) {
    var members, representatives, nodes, orientation, anchor, positions, minPos, maxPos, minLength;
    if (!group) {
      return false;
    }
    group.axis = group.axis || {};
    anchor = axisAnchor(group);
    members = getMemberNodes(group);
    representatives = (model && typeof model.getGroupRepresentativeNodes === 'function')
      ? model.getGroupRepresentativeNodes(group)
      : [];
    nodes = members.concat(representatives || []);
    orientation = axisOrientation(group);
    positions = nodes.map(function (node) {
      if (!node) {
        return null;
      }
      if (Number.isFinite(Number(node.axisPos))) {
        return Number(node.axisPos);
      }
      return orientation === 'vertical' ? Number(node.y) : Number(node.x);
    }).filter(function (value) {
      return Number.isFinite(value);
    });

    if (!positions.length) {
      group.axis.anchor = anchor;
      group.origin = { x: anchor.x, y: anchor.y };
      group.length = Math.max(60, Number(group.length || AXIS_LENGTH));
      return false;
    }

    minPos = Math.min.apply(null, positions);
    maxPos = Math.max.apply(null, positions);
    minLength = Math.max(60, Number(group.minAxisLength || 60));

    if (orientation === 'vertical') {
      group.axis.anchor = { x: anchor.x, y: minPos };
      group.origin = { x: anchor.x, y: minPos };
    }
    else {
      group.axis.anchor = { x: minPos, y: anchor.y };
      group.origin = { x: minPos, y: anchor.y };
    }
    group.length = Math.max(minLength, maxPos - minPos);
    return true;
  }

  function layoutAxisGroup(group) {
    var axis, pageCount, length, anchor, members;
    if (!group) { return null; }

    axis = group.axis || {};
    pageCount = getContentsAxisPageCount(group);
    getMemberNodes(group).forEach(function (node) {
      pageCount = Math.max(pageCount, clampPageNumber(group, node && node.pageNumber));
    });
    length = Math.max(60, Number(group.length || AXIS_LENGTH));
    anchor = axisAnchor(group);

    group.axis = group.axis || {};
    group.axis.anchor = anchor;
    group.origin = { x: anchor.x, y: anchor.y };
    group.axis.start = 1;
    group.axis.end = pageCount;
    group.axis.unit = (false === group.hasPageCount) ? 'contentTarget' : 'page';
    group.pageCount = pageCount;
    if (false === group.hasPageCount) {
      group.documentPageCount = 0;
    }
    group.length = length;

    members = orderedPageMembers(group);
    members.forEach(function (node, index) {
      var pageNumber = clampPageNumber(group, node.pageNumber || index + 1);
      ensurePageNodeDefaults(group, node, index);
      node.pageNumber = pageNumber;
    });

    assignMissingAxisPositions(group, members, pageCount);
    updateAxisBoundsFromPositions(group);
    members.forEach(function (node) {
      setNodeOnAxis(group, node, getAxisPos(group, node));
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
      if (isContentTargetResourceNode(found)) {
        return found;
      }
    }
    nodes = (page.nodes || []).filter(function (node) {
      return isContentTargetResourceNode(node);
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
    group.axis.unit = (false === group.hasPageCount) ? 'contentTarget' : 'page';
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
    if (model && typeof model.ensureGroupRepresentativeTopic === 'function') {
      model.ensureGroupRepresentativeTopic(group, {
        topicKind: 'contents-representative',
        label: group.name || 'Contents'
      });
    }
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

  function getDragBounds(group, pageNode) {
    var members = orderedPageMembers(group);
    var index = members.findIndex(function (node) { return node && node.id === pageNode.id; });
    var gap = Math.max(4, Number(group.minAxisGap || 8));
    var prev = index > 0 ? members[index - 1] : null;
    var next = (index >= 0 && index < members.length - 1) ? members[index + 1] : null;
    return {
      min: prev ? (getAxisPos(group, prev) + gap) : -Infinity,
      max: next ? (getAxisPos(group, next) - gap) : Infinity
    };
  }

  function clampAxisPosition(value, bounds) {
    value = Number(value || 0);
    if (bounds && Number.isFinite(bounds.min)) {
      value = Math.max(bounds.min, value);
    }
    if (bounds && Number.isFinite(bounds.max)) {
      value = Math.min(bounds.max, value);
    }
    return value;
  }

  function updatePageMarkerAxisPosition(group, pageNode, x, y) {
    var pos;
    if (!group || !isContentsGroup(group) || !pageNode || pageNode.type !== 'PageMarker') {
      return false;
    }
    normalizeAxisGroup(group);
    pageNode = model.findNodeById(pageNode.id) || pageNode;
    pos = clampAxisPosition(axisScalar(group, x, y), getDragBounds(group, pageNode));
    setNodeOnAxis(group, pageNode, pos);
    updateAxisBoundsFromPositions(group);
    return true;
  }

  function handlePageMarkerDrag(nodeOrId, eventX, eventY) {
    var pageNode = (typeof nodeOrId === 'string') ? model.findNodeById(nodeOrId) : (nodeOrId && nodeOrId.id ? (model.findNodeById(nodeOrId.id) || nodeOrId) : null);
    var group;
    if (!pageNode || pageNode.type !== 'PageMarker') {
      return false;
    }
    group = model.findGroupById(pageNode.groupRef);
    if (!group || !isContentsGroup(group)) {
      return false;
    }
    if (!updatePageMarkerAxisPosition(group, pageNode, Number(eventX || 0), Number(eventY || 0))) {
      return false;
    }
    if (model && typeof model.pruneGroups === 'function') {
      model.pruneGroups();
    }
    if (model && typeof model.setGraphFromCurrentPage === 'function') {
      model.setGraphFromCurrentPage();
    }
    return true;
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
    var page, documentNode, pageCount, origin, group, nodes, axisStartPos;
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
    if (!isContentTargetResourceNode(documentNode)) {
      if (!option.silent) {
        window.alert('contents 対象のコンテンツを 1 件選択してから contents を作成してください。');
      }
      return null;
    }
    pageCount = getDocumentPageCount(documentNode);

    origin = defaultAxisOrigin(documentNode);
    group = model.createGroup({
      id: makeUuid(),
      name: 'Contents',
      type: 'contents',
      groupType: 'axis',
      orientation: axis === 'vertical' ? 'vertical' : 'horizontal',
      documentRef: documentNode.id,
      pageCount: Math.max(1, pageCount || 1),
      documentPageCount: pageCount || 0,
      hasPageCount: pageCount > 0,
      spine: { visible: true, color: '#4c6b8a', width: 4, padding: 12 },
      axis: {
        mode: 'document',
        unit: pageCount > 0 ? 'page' : 'contentTarget',
        start: 1,
        end: Math.max(1, pageCount || 1),
        anchor: { x: origin.x, y: origin.y }
      },
      origin: origin,
      length: AXIS_LENGTH,
      members: []
    });
    group.documentRef = documentNode.id;
    group.mediaRef = documentNode.id;
    group.pageCount = Math.max(1, pageCount || 1);
    group.documentPageCount = pageCount || 0;
    group.hasPageCount = pageCount > 0;
    page.groups.push(group);
    axisStartPos = group.orientation === 'vertical' ? origin.y : origin.x;
    if (pageCount > 1) {
      nodes = [
        createPageNode(group, 1, { axisRole: 'entry', axisPos: axisStartPos }),
        createPageNode(group, pageCount, { axisRole: 'entry', axisPos: axisStartPos + AXIS_LENGTH })
      ];
    }
    else {
      nodes = [createPageNode(group, 1, {
        axisRole: 'entry',
        label: pageCount > 0 ? 'p.1' : 'content',
        axisPos: axisStartPos + (AXIS_LENGTH / 2)
      })];
    }
    nodes.forEach(function (node) {
      page.nodes.push(node);
    });
    setMemberIds(group, nodes.map(function (node) { return node.id; }));
    normalizeAxisGroup(group);
    rebuildGraphAndRefresh();
    return group;
  }

  function addTableOfContents(documentCandidate, option) {
    option = option || {};
    return createAxisGroup(option.axis || 'horizontal', documentCandidate, option);
  }

  function updateAxisGroup(group, props) {
    if (!group || !isContentsGroup(group)) { return false; }
    props = props || {};
    if (props.orientation === 'vertical' || props.orientation === 'horizontal') {
      group.orientation = props.orientation;
    }
    if (Number.isFinite(Number(props.length))) {
      group.length = Math.max(60, Number(props.length));
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
    var spec = getContentTargetSpec(groupOrTarget);
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
    appendMember(group, node.id, 'member');
    normalizeAxisGroup(group);
    rebuildGraphAndRefresh();
    return node;
  }

  function createEntryDraft(groupOrTarget) {
    var spec = getContentTargetSpec(groupOrTarget);
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
    var group = node && model.findGroupById(node.groupRef);
    if (!page || !group || !isContentsGroup(group)) { return false; }
    ensurePageCollections(page);
    group.members = Array.isArray(group.members) ? group.members : [];
    delete node.pendingContentsEntry;
    delete node.contentsEntryDraft;
    ensurePageNodeDefaults(group, node, group.members.length);
    node.pageNumber = clampPageNumber(group, node.pageNumber);
    page.nodes.push(node);
    appendMember(group, node.id, 'member');
    normalizeAxisGroup(group);
    rebuildGraphAndRefresh();
    return true;
  }

  function updateEntryFromNode(node) {
    var group = node && model.findGroupById(node.groupRef);
    if (!group || !isContentsGroup(group)) { return false; }
    ensurePageNodeDefaults(group, node, 0);
    node.pageNumber = clampPageNumber(group, node.pageNumber);
    normalizeAxisGroup(group);
    rebuildGraphAndRefresh();
    return true;
  }

  function deleteTarget(target) {
    var spec = getContentTargetSpec(target);
    var page = getCurrentPage();
    var group = spec && spec.group;
    var point = spec && spec.point;
    if (!page || !group) { return false; }
    if (!point && (isContentsAxisLink(target) || isContentsGroup(target))) {
      page.links = (page.links || []).filter(function (link) {
        return !(link && (link.groupRef === group.id || link.groupRef === group.id));
      });
      page.nodes = (page.nodes || []).filter(function (node) {
        return !(node && node.groupRef === group.id);
      });
      page.groups = (page.groups || []).filter(function (item) { return item && item.id !== group.id; });
      rebuildGraphAndRefresh();
      return true;
    }
    if (!point) { return false; }
    group.members = (group.members || []).filter(function (item) { return memberId(item) !== point.id; });
    page.links = (page.links || []).filter(function (link) {
      return !(link && (link.from === point.id || link.to === point.id || link.groupRef === group.id && link.to === point.id));
    });
    page.nodes = (page.nodes || []).filter(function (node) { return !(node && node.id === point.id); });
    if (!group.members.length) {
      page.groups = (page.groups || []).filter(function (item) { return item && item.id !== group.id; });
    }
    rebuildGraphAndRefresh();
    return true;
  }

  function getContentTargetSpec(target) {
    var point, group, documentNode;
    if (!target) { return null; }
    if (isContentsPageNode(target)) {
      point = model.findNodeById(target.id) || target;
      group = model.findGroupById(point.groupRef);
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

  function isPdfLikeUri(uri) {
    var text = String(uri || '').split('?path=').pop() || String(uri || '');
    return /\.pdf(?:[?#].*)?$/i.test(text);
  }

  function appendPageFragment(uri, pageNumber) {
    var page = Math.max(1, Math.floor(Number(pageNumber || 1)));
    var base = toDirectUploadContentUri(String(uri || '').replace(/#.*$/, ''));
    if (!base) { return ''; }
    return base + '#page=' + encodeURIComponent(page);
  }

  function buildContentTargetViewerUrl(uri, pageNumber, contentTarget) {
    var base = String(uri || '').trim();
    var anchor = contentTarget && (contentTarget.anchor || contentTarget.fragment || contentTarget.contentAnchor);
    if (!base) { return ''; }
    if (isPdfLikeUri(base)) {
      return appendPageFragment(base, pageNumber);
    }
    if (anchor) {
      return base.replace(/#.*$/, '') + '#' + encodeURIComponent(String(anchor).replace(/^#/, ''));
    }
    return base;
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

  function toDirectUploadContentUri(uri) {
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
    var uri = '';
    if (!documentNode) { return ''; }
    if (util && typeof util.getResourcePreviewUri === 'function') {
      uri = util.getResourcePreviewUri(documentNode) || '';
    }
    if (!uri && util && typeof util.getResourceOriginalUri === 'function') {
      uri = util.getResourceOriginalUri(documentNode) || '';
    }
    return buildContentTargetViewerUrl(uri, pageNumber, arguments.length > 2 ? arguments[2] : null);
  }

  ns.getCurrentPage = getCurrentPage;
  ns.isContentsGroup = isContentsGroup;
  ns.isContentsPageNode = isContentsPageNode;
  ns.isContentsAxisLink = isContentsAxisLink;
  ns.isContentTargetResourceNode = isContentTargetResourceNode;
  ns.getDocumentPageCount = getDocumentPageCount;
  ns.hasKnownDocumentPages = hasKnownDocumentPages;
  ns.createAxisGroup = createAxisGroup;
  ns.addTableOfContents = addTableOfContents;
  ns.updateAxisGroup = updateAxisGroup;
  ns.addEntry = addEntry;
  ns.createEntryDraft = createEntryDraft;
  ns.commitEntryDraft = commitEntryDraft;
  ns.updateEntryFromNode = updateEntryFromNode;
  ns.deleteTarget = deleteTarget;
  ns.normalizeAxisGroup = normalizeAxisGroup;
  ns.normalizeAllAxisGroups = normalizeAllAxisGroups;
  ns.buildContentsAxisPseudoLink = buildContentsAxisPseudoLink;
  ns.updateAxisBoundsFromPositions = updateAxisBoundsFromPositions;
  ns.updatePageMarkerAxisPosition = updatePageMarkerAxisPosition;
  ns.handlePageMarkerDrag = handlePageMarkerDrag;
  ns.getContentTargetSpec = getContentTargetSpec;
  ns.getContentTargetViewerUrl = getDocumentViewerUrl;
  ns.getDocumentViewerUrl = getDocumentViewerUrl;
})(wuwei.contents);
// wuwei.contents.js
// wuwei.contents.js last modified 2026-05-11
