/**
 * wuwei.viewpoint.js
 * document viewpoint axis helpers
 *
 * A viewpoint axis manages PageMarker nodes.
 * The target content can be PDF, Office preview, HTML, image, or another
 * previewable content resource.  PDF page numbers are one possible form
 * of PageMarker metadata.
 */
wuwei.viewpoint = wuwei.viewpoint || {};

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

  function expandNodeRuntimeStyle(node) {
    if (wuwei && wuwei.style &&
        typeof wuwei.style.expandNodeRuntimeStyle === 'function') {
      wuwei.style.expandNodeRuntimeStyle(node);
    }
    else if (wuwei && wuwei.note && wuwei.note.v2 &&
        typeof wuwei.note.v2.expandNodeRuntimeStyle === 'function') {
      wuwei.note.v2.expandNodeRuntimeStyle(node);
    }
    return node;
  }

  function getCurrentPage() {
    return common && common.current ? common.current.page || null : null;
  }

  function isGenericGroup(group) {
    return !!(group && (
      group.type === 'simple' ||
      group.type === 'horizontal' ||
      group.type === 'vertical'
    ));
  }

  function getParentGenericGroupIdForNode(nodeId) {
    var groups;
    if (!nodeId || !model || typeof model.findGroupsByNodeId !== 'function') {
      return '';
    }
    groups = model.findGroupsByNodeId(nodeId).filter(isGenericGroup);
    return groups.length ? groups[0].id : '';
  }

  function getViewpointGroupTargetNodeId(group) {
    if (!group) { return ''; }
    return group.targetNodeId || group.documentRef || group.mediaRef || '';
  }

  function getAttachedViewpointGroupsForNode(nodeOrId) {
    var nodeId = (typeof nodeOrId === 'string') ? nodeOrId : (nodeOrId && nodeOrId.id);
    var page = getCurrentPage();
    if (!nodeId || !page || !Array.isArray(page.groups)) {
      return [];
    }
    return page.groups.filter(function (group) {
      return isViewpointGroup(group) && getViewpointGroupTargetNodeId(group) === nodeId;
    });
  }

  function hasAttachedViewpointGroup(nodeOrId) {
    return getAttachedViewpointGroupsForNode(nodeOrId).length > 0;
  }

  function ensurePageCollections(page) {
    if (!page) { return; }
    if (!Array.isArray(page.nodes)) { page.nodes = []; }
    if (!Array.isArray(page.links)) { page.links = []; }
    if (!Array.isArray(page.groups)) { page.groups = []; }
  }

  function isViewpointGroup(group) {
    return !!(group && group.type === 'viewpoint');
  }

  function isViewpointRelation(value) {
    return value === 'viewpoint';
  }

  function isViewpointEntryRole(value) {
    return value === 'viewpoint-entry';
  }

  function isViewpointFirstEntryRole(value) {
    return value === 'viewpoint-first-entry';
  }

  function isViewpointPageNode(node) {
    return !!(node && node.type === 'PageMarker' && node.groupRef);
  }

  function findViewpointGroupByRepresentativeNode(node) {
    var group, page;

    if (!node || !node.id) { return null; }

    if (node.groupRef && model && typeof model.findGroupById === 'function') {
      group = model.findGroupById(node.groupRef);
      if (isViewpointGroup(group) && (
        group.representativeNodeId === node.id ||
        node.groupRole === 'representative' ||
        node.topicKind === 'viewpoint-representative'
      )) {
        return group;
      }
    }

    page = getCurrentPage();
    if (!page || !Array.isArray(page.groups)) { return null; }
    return page.groups.find(function (item) {
      return isViewpointGroup(item) && item.representativeNodeId === node.id;
    }) || null;
  }

  function isViewpointRepresentativeNode(node) {
    return !!findViewpointGroupByRepresentativeNode(node);
  }

  function isViewpointAxisLink(link) {
    return !!(link && link.type === 'Link' &&
      (link.groupType === 'viewpointAxis' ||
      link.linkType === 'viewpoint-axis'));
  }

  function isHtmlResourceNode(node) {
    return !!(wuwei.document &&
      typeof wuwei.document.isHtmlDocumentNode === 'function' &&
      wuwei.document.isHtmlDocumentNode(node));
  }

  function isHtmlViewpointGroup(group) {
    var documentNode;
    if (!group || !isViewpointGroup(group)) { return false; }
    documentNode = findDocumentNodeForGroup(group, null);
    return isHtmlResourceNode(documentNode);
  }

  function isContentTargetResourceNode(node) {
    return !!(wuwei.document &&
      typeof wuwei.document.isContentTargetNode === 'function' &&
      wuwei.document.isContentTargetNode(node));
  }

  function getDocumentPageCount(node) {
    return (wuwei.document && typeof wuwei.document.getPageCount === 'function')
      ? wuwei.document.getPageCount(node)
      : 0;
  }

  function hasKnownDocumentPages(node) {
    return getDocumentPageCount(node) > 0;
  }

  function getResourceDocumentPageMeta(node, create) {
    return (wuwei.document && typeof wuwei.document.getDocumentPageMeta === 'function')
      ? wuwei.document.getDocumentPageMeta(node, create)
      : null;
  }

  function getDocumentNode(group) {
    return findDocumentNodeForGroup(group);
  }

  function getDocumentFirstPageNumber(documentNode) {
    return (wuwei.document && typeof wuwei.document.getFirstPageNumber === 'function')
      ? wuwei.document.getFirstPageNumber(documentNode)
      : 1;
  }

  function getDocumentPageNumberOffset(documentNode) {
    return (wuwei.document && typeof wuwei.document.getPageOffset === 'function')
      ? wuwei.document.getPageOffset(documentNode)
      : Math.max(0, getDocumentFirstPageNumber(documentNode) - 1);
  }

  function setDocumentFirstPageNumber(documentNode, firstPageNumber) {
    return !!(wuwei.document &&
      typeof wuwei.document.setFirstPageNumber === 'function' &&
      wuwei.document.setFirstPageNumber(documentNode, firstPageNumber));
  }

  function setDocumentPageNumberOffset(documentNode, pageOffset) {
    return !!(wuwei.document &&
      typeof wuwei.document.setPageOffset === 'function' &&
      wuwei.document.setPageOffset(documentNode, pageOffset));
  }

  function getPageNumberOffset(group) {
    return getDocumentPageNumberOffset(getDocumentNode(group));
  }

  function getFirstPageNumber(group) {
    return getDocumentFirstPageNumber(getDocumentNode(group));
  }

  function toViewerPageNumber(group, pageNumber) {
    var documentNode = getDocumentNode(group);
    return (wuwei.document && typeof wuwei.document.toViewerPageNumber === 'function')
      ? wuwei.document.toViewerPageNumber(documentNode, pageNumber)
      : Math.max(1, Math.floor(Number(pageNumber || getFirstPageNumber(group))) - getPageNumberOffset(group));
  }

  function toDisplayedPageNumber(group, viewerPageNumber) {
    var documentNode = getDocumentNode(group);
    return (wuwei.document && typeof wuwei.document.toDocumentPageNumber === 'function')
      ? wuwei.document.toDocumentPageNumber(documentNode, viewerPageNumber)
      : Math.max(1, Math.floor(Number(viewerPageNumber || 1)) + getPageNumberOffset(group));
  }

  function isAutomaticPageMarkerLabel(label, oldPageNumber) {
    var value = String(label || '').trim();
    if (!value) { return true; }
    return value === String(Math.max(1, Math.floor(Number(oldPageNumber || 1))));
  }

  function recomputePageNumbersFromPageNumbers(group, previousOffset) {
    var members, offset;

    if (!group || !isViewpointGroup(group)) { return false; }

    offset = getPageNumberOffset(group);
    previousOffset = Number.isFinite(Number(previousOffset))
      ? Math.max(0, Math.floor(Number(previousOffset)))
      : offset;

    members = getMemberNodes(group);
    members.forEach(function (node) {
      var oldPageNumber = Math.max(1, Math.floor(Number(node && node.pageNumber || 1)));
      var viewerPage = Math.max(1, oldPageNumber - previousOffset);
      var newPageNumber = Math.max(1, viewerPage + offset);

      node.pageNumber = newPageNumber;
      if (isAutomaticPageMarkerLabel(node.label, oldPageNumber)) {
        node.label = String(newPageNumber);
      }
      node.changed = true;
    });
    return true;
  }

  function updateFirstPageNumberMapping(group, firstPageNumber) {
    var documentNode, previousOffset, page, documentId, groups;

    if (!group || !Number.isFinite(Number(firstPageNumber))) {
      return false;
    }

    documentNode = getDocumentNode(group);
    if (!documentNode) {
      return false;
    }

    previousOffset = getDocumentPageNumberOffset(documentNode);
    firstPageNumber = Math.max(1, Math.floor(Number(firstPageNumber)));

    if (!setDocumentFirstPageNumber(documentNode, firstPageNumber)) {
      return false;
    }

    page = getCurrentPage();
    documentId = documentNode.id;
    groups = page && Array.isArray(page.groups)
      ? page.groups.filter(function (candidate) {
        return isViewpointGroup(candidate) &&
          (candidate.documentRef === documentId || candidate.mediaRef === documentId);
      })
      : [group];

    groups.forEach(function (candidate) {
      candidate.axis = candidate.axis || {};
      candidate.axis.start = getFirstPageNumber(candidate);
      recomputePageNumbersFromPageNumbers(candidate, previousOffset);
      layoutAxisGroup(candidate);
    });

    return true;
  }

  function updatePageOffsetMapping(group, pageOffset) {
    if (!Number.isFinite(Number(pageOffset))) {
      return false;
    }
    return updateFirstPageNumberMapping(group, Math.max(0, Math.floor(Number(pageOffset))) + 1);
  }

  function getViewpointAxisPageCount(group) {
    var documentNode = getDocumentNode(group);
    var pageCount = getDocumentPageCount(documentNode);

    if (!(pageCount > 0)) {
      pageCount = Number(group && (group.documentPageCount || group.physicalPageCount || 0));
      pageCount = Number.isFinite(pageCount) && pageCount > 0 ? Math.floor(pageCount) : 0;
    }
    return Math.max(1, pageCount);
  }

  function getKnownViewpointAxisPageCount(group) {
    var documentNode = getDocumentNode(group);
    var pageCount = getDocumentPageCount(documentNode);

    if (!(pageCount > 0)) {
      pageCount = Number(group && (group.documentPageCount || group.physicalPageCount || 0));
      pageCount = Number.isFinite(pageCount) && pageCount > 0 ? Math.floor(pageCount) : 0;
    }
    return pageCount > 0 ? pageCount : 0;
  }

  function getDocumentPageNumberRange(documentNode) {
    return (wuwei.document && typeof wuwei.document.getPageNumberRange === 'function')
      ? wuwei.document.getPageNumberRange(documentNode)
      : {
        min: getDocumentFirstPageNumber(documentNode),
        max: null
      };
  }

  function getPageMarkerPageNumberRange(group) {
    var documentNode = getDocumentNode(group);
    var offset = getPageNumberOffset(group);
    var pageCount = getKnownViewpointAxisPageCount(group);
    var range = getDocumentPageNumberRange(documentNode);
    var min = range.min || 1;
    var max = pageCount > 0 ? range.max : null;

    if (max != null && max < min) {
      max = min;
    }
    return {
      hasPageCount: !!(max != null),
      min: min,
      max: max,
      pageOffset: offset,
      pageCount: pageCount
    };
  }

  function clampPageMarkerPageNumber(group, pageNumber) {
    var value = Math.floor(Number(pageNumber || 1));
    var range = getPageMarkerPageNumberRange(group);

    if (!Number.isFinite(value)) { value = range.min || 1; }
    value = Math.max(1, value);
    if (range.hasPageCount) {
      value = Math.max(range.min, Math.min(range.max, value));
    }
    return value;
  }

  function getViewpointAxisDisplayEnd(group) {
    return toDisplayedPageNumber(group, getViewpointAxisPageCount(group));
  }

  function makeContentTargetLabel(group, pageNumber, option) {
    if (option && option.label) {
      return option.label;
    }
    if (group && false === group.hasPageCount) {
      return 'content';
    }
    // PageMarker labels are human-facing labels.  The pageNumber is the
    // page number printed in the source document, not the physical PDF page.
    return String(pageNumber || 1);
  }

  function nodeHalfWidth(node) {
    var size = node && node.size;
    if (size && Number.isFinite(Number(size.width))) {
      return Math.max(1, Number(size.width) / 2);
    }
    if (Number.isFinite(Number(node && node.width))) {
      return Math.max(1, Number(node.width) / 2);
    }
    if (size && Number.isFinite(Number(size.radius))) {
      return Math.max(1, Number(size.radius));
    }
    return 50;
  }

  function nodeHalfHeight(node) {
    var size = node && node.size;
    if (size && Number.isFinite(Number(size.height))) {
      return Math.max(1, Number(size.height) / 2);
    }
    if (Number.isFinite(Number(node && node.height))) {
      return Math.max(1, Number(node.height) / 2);
    }
    if (size && Number.isFinite(Number(size.radius))) {
      return Math.max(1, Number(size.radius));
    }
    return 35;
  }

  function defaultAxisOrigin(documentNode, orientation) {
    var x = Number.isFinite(Number(documentNode && documentNode.x)) ? Number(documentNode.x) : 0;
    var y = Number.isFinite(Number(documentNode && documentNode.y)) ? Number(documentNode.y) : 0;
    var gap = 70;

    /*
     * Viewpoint groups should be placed deterministically next to the source
     * Content.  Using model.newPosition() introduced a random offset, so an
     * uploaded PDF/Office document and its Viewpoint axis could appear shifted
     * from each other.
     */
    if (orientation === 'vertical') {
      return { x: x, y: y + nodeHalfHeight(documentNode) + gap };
    }
    return { x: x + nodeHalfWidth(documentNode) + gap, y: y };
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

  function ensureDocumentEntryLinkEndArrow(link) {
    if (!link) { return null; }
    link.routing = (link.routing && typeof link.routing === 'object') ? link.routing : {};
    link.routing.endArrow = (link.routing.endArrow && typeof link.routing.endArrow === 'object')
      ? link.routing.endArrow
      : {};
    link.routing.endArrow.kind = link.routing.endArrow.kind || 'ARROW';
    if (!Number.isFinite(Number(link.routing.endArrow.size)) || Number(link.routing.endArrow.size) <= 0) {
      link.routing.endArrow.size = 12;
    }
    return link;
  }

  function makeDocumentEntryLink(group, documentNode, entryNode) {
    return ensureDocumentEntryLinkEndArrow({
      id: makeUuid(),
      type: 'Link',
      from: documentNode.id,
      to: entryNode.id,
      relation: 'viewpoint',
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
      linkRole: 'viewpoint-entry',
      linkType: 'viewpoint-source',
      audit: makeAudit()
    });
  }

  function getViewpointRepresentativeNode(group) {
    var representative;
    if (!group) { return null; }
    representative = group.representativeNodeId ? model.findNodeById(group.representativeNodeId) : null;
    if (!representative && model && typeof model.ensureGroupRepresentativeTopic === 'function') {
      representative = model.ensureGroupRepresentativeTopic(group, {
        topicKind: 'viewpoint-representative',
        label: group.name || 'Viewpoint'
      });
    }
    return representative || null;
  }

  function getLinkSourceId(link) {
    if (!link) { return ''; }
    return link.from ? ((link.from && link.from.id) ? link.from.id : link.from) : '';
  }

  function getLinkTargetId(link) {
    if (!link) { return ''; }
    return link.to ? ((link.to && link.to.id) ? link.to.id : link.to) : '';
  }

  function setLinkTargetId(link, id) {
    if (!link || !id) { return; }
    link.to = id;

  }

  function ensureDocumentEntryLink(group) {
    var page = getCurrentPage();
    var documentNode, representative, exists, link;
    if (!page || !group) { return null; }
    documentNode = findDocumentNodeForGroup(group, null);
    representative = getViewpointRepresentativeNode(group);
    if (!documentNode || !representative) { return null; }

    page.links = (page.links || []).filter(function (item) {
      if (!item || item.from !== documentNode.id || item.groupRef !== group.id) {
        return true;
      }
      if (!isViewpointEntryRole(item.linkRole) && !isViewpointRelation(item.relation)) {
        return true;
      }
      return item.to === representative.id;
    });

    exists = null;
    (page.links || []).some(function (item) {
      if (item && item.from === documentNode.id && item.to === representative.id &&
        (isViewpointEntryRole(item.linkRole) || item.groupRef === group.id || isViewpointRelation(item.relation))) {
        exists = item;
        return true;
      }
      return false;
    });
    if (exists) {
      exists.visible = true;
      exists.changed = true;
      exists.relation = exists.relation || 'viewpoint';
      exists.groupRef = group.id;
      exists.linkRole = exists.linkRole || 'viewpoint-entry';
      exists.linkType = exists.linkType || 'viewpoint-source';
      setLinkTargetId(exists, representative.id);
      return ensureDocumentEntryLinkEndArrow(exists);
    }
    link = makeDocumentEntryLink(group, documentNode, representative);

    page.links.push(link);
    return link;
  }

  function makeViewpointRepresentativeEntryLink(group, representative, entryNode) {
    return {
      id: makeUuid(),
      type: 'Link',
      from: representative.id,
      to: entryNode.id,
      relation: 'viewpoint',
      label: '',
      description: { format: 'plain', body: '' },
      shape: 'NORMAL',
      visible: true,
      changed: true,
      style: {
        font: common.defaultFont,
        line: { kind: 'SOLID', color: '#c0c0c0', width: 2 }
      },
      color: '#c0c0c0',
      size: 2,
      groupRef: group.id,
      linkRole: 'viewpoint-first-entry',
      linkType: 'viewpoint-first-entry',
      audit: makeAudit()
    };
  }

  function isPageMarkerNodeForGroup(node, group) {
    return !!(node && group && node.type === 'PageMarker' && node.groupRef === group.id);
  }

  function isLinkBetweenViewpointRepresentativeAndMarker(group, representative, link) {
    var sourceId, targetId, sourceNode, targetNode;

    if (!group || !representative || !representative.id || !link) {
      return false;
    }

    sourceId = getLinkSourceId(link);
    targetId = getLinkTargetId(link);
    sourceNode = sourceId ? model.findNodeById(sourceId) : null;
    targetNode = targetId ? model.findNodeById(targetId) : null;

    return (
      sourceId === representative.id && isPageMarkerNodeForGroup(targetNode, group)
    ) || (
      targetId === representative.id && isPageMarkerNodeForGroup(sourceNode, group)
    );
  }

  function isLinkBetweenViewpointRepresentativeAndNode(group, representative, node, link) {
    var sourceId, targetId;

    if (!group || !representative || !node || !link) {
      return false;
    }

    sourceId = getLinkSourceId(link);
    targetId = getLinkTargetId(link);

    return (
      sourceId === representative.id && targetId === node.id
    ) || (
      targetId === representative.id && sourceId === node.id
    );
  }

  function isViewpointRepresentativeEntryCandidate(group, representative, link) {
    var role, linkType, representativeMarkerLink;

    if (!group || !representative || !link) {
      return false;
    }

    role = String(link.linkRole || '');
    linkType = String(link.linkType || '');
    representativeMarkerLink = isLinkBetweenViewpointRepresentativeAndMarker(group, representative, link);

    /*
     * Older data may contain a representative-to-PageMarker line without
     * groupRef/linkRole, or with stale D3 source/target objects.  Treat every
     * line between the Viewpoint representative and any PageMarker in this
     * group as a managed viewpoint-first-entry line so that stale lines are
     * removed when the nearest endpoint changes.
     */
    if (representativeMarkerLink) {
      return true;
    }

    if (isViewpointFirstEntryRole(role) || isViewpointFirstEntryRole(linkType)) {
      return link.groupRef === group.id;
    }

    return false;
  }

  function normalizeViewpointRepresentativeEntryLink(link, group, representative, endNode) {
    if (!link) { return null; }
    link.type = 'Link';
    link.from = representative.id;
    link.to = endNode.id;
    link.relation = 'viewpoint';
    link.groupRef = group.id;
    link.linkRole = 'viewpoint-first-entry';
    link.linkType = 'viewpoint-first-entry';
    link.shape = link.shape || 'NORMAL';
    link.visible = true;
    link.changed = true;
    return link;
  }

  function ensureViewpointRepresentativeEntryLink(group) {
    var page = getCurrentPage();
    var representative;
    var endNode;
    var kept;
    var shouldCreate;
    var link;

    if (!page || !group) { return null; }
    ensurePageCollections(page);
    representative = getViewpointRepresentativeNode(group);
    endNode = getNearestAxisEndpoint(group, representative);
    if (!representative || !endNode) { return null; }

    kept = null;
    shouldCreate = false;

    page.links = (page.links || []).filter(function (item) {
      if (!isViewpointRepresentativeEntryCandidate(group, representative, item)) {
        return true;
      }

      /*
       * There must be only one link from the Viewpoint representative node to
       * the current nearest endpoint PageMarker.  When the endpoint changes,
       * remove the old line and create a fresh link, instead of keeping stale
       * D3 source/target objects or duplicate historical links.
       */
      if (!shouldCreate && !kept &&
        isLinkBetweenViewpointRepresentativeAndNode(group, representative, endNode, item)) {
        kept = normalizeViewpointRepresentativeEntryLink(item, group, representative, endNode);
        return true;
      }

      shouldCreate = true;
      return false;
    });

    if (kept && !shouldCreate) {
      return kept;
    }

    if (kept) {
      page.links = (page.links || []).filter(function (item) {
        return item !== kept;
      });
    }

    link = makeViewpointRepresentativeEntryLink(group, representative, endNode);
    page.links.push(link);
    return link;
  }

  function createPageNode(group, pageNumber, option) {
    option = option || {};
    return {
      id: option.id || makeUuid(),
      type: 'PageMarker',
      topicKind: 'viewpoint-page',
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
    node.type = 'PageMarker';
    node.topicKind = 'viewpoint-page';
    node.groupRef = group.id;
    node.documentRef = group.documentRef;
    node.pageNumber = Math.max(1, Math.floor(Number(node.pageNumber || index + 1)));
    node.axisRole = node.axisRole || 'entry';
    node.label = node.label || makeContentTargetLabel(group, node.pageNumber, null);
    node.shape = normalizeNodeShapeForViewpoint(node.shape, 'CIRCLE');
    node.size = normalizeNodeSizeForViewpoint(node.shape, node.size, defaultViewpointPageMarkerSize());
    node.style = (node.style && 'object' === typeof node.style) ? node.style : {};
    node.style.fill = node.style.fill || node.color || '#ffffff';
    node.style.font = node.style.font || common.defaultFont;
    node.style.line = (node.style.line && 'object' === typeof node.style.line) ? node.style.line : {};
    node.style.line.kind = node.style.line.kind || 'SOLID';
    node.style.line.color = node.style.line.color || node.outline || '#4c6b8a';
    node.style.line.width = Math.max(0, Number(node.style.line.width || node.outlineWidth || 1));
    expandNodeRuntimeStyle(node);
    node.visible = (false !== node.visible);
    node.changed = true;
    if (!Number.isFinite(Number(node.x))) { node.x = 0; }
    if (!Number.isFinite(Number(node.y))) { node.y = 0; }
    return node;
  }

  function clampPageNumber(group, pageNumber) {
    return clampPageMarkerPageNumber(group, pageNumber);
  }

  function axisOrientation(group) {
    return (group && group.orientation === 'vertical') ? 'vertical' : 'horizontal';
  }

  function finiteNumber(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function normalizeNodeShapeForViewpoint(value, fallback) {
    var shape = String(value || fallback || '').toUpperCase();
    var allowed = (common && Array.isArray(common.shapes) ? common.shapes : []).some(function (item) {
      return item && item.value === shape && shape !== 'THUMBNAIL';
    });
    return allowed ? shape : (fallback || 'CIRCLE');
  }

  function defaultViewpointPageMarkerSize() {
    return { radius: 18, width: 36, height: 36 };
  }

  function defaultViewpointRepresentativeSize() {
    var defaults = common.defaultSize || {};
    return {
      radius: Math.max(1, Number(defaults.radius || 20)),
      width: Math.max(1, Number(defaults.width || 120)),
      height: Math.max(1, Number(defaults.height || 32))
    };
  }

  function positiveNumber(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  function normalizeNodeSizeForViewpoint(shape, size, defaults) {
    var out = {};
    var radius;
    var width;
    var height;

    size = (size && 'object' === typeof size) ? size : {};
    defaults = defaults || defaultViewpointPageMarkerSize();

    if ('CIRCLE' === shape) {
      radius = positiveNumber(size.radius, null);
      if (!radius) {
        width = positiveNumber(size.width, defaults.width);
        height = positiveNumber(size.height, defaults.height);
        radius = Math.max(1, Math.round(Math.sqrt((width * height) / Math.PI)));
      }
      out.radius = radius;
      return out;
    }

    radius = positiveNumber(size.radius, null);
    out.width = positiveNumber(size.width, radius ? radius * 2 : defaults.width);
    out.height = positiveNumber(size.height, radius ? radius * 2 : defaults.height);
    return out;
  }

  function applyNodeShapeSizeForViewpoint(node, shape, size, defaults) {
    if (!node) {
      return;
    }
    shape = normalizeNodeShapeForViewpoint(shape || node.shape, 'RECTANGLE');
    node.shape = shape;
    node.size = normalizeNodeSizeForViewpoint(shape, size || node.size, defaults || defaultViewpointRepresentativeSize());
    node.changed = true;
  }

  function axisAnchor(group) {
    var axis = (group && group.axis) || {};
    return {
      x: (axis.anchor && Number.isFinite(Number(axis.anchor.x))) ? Number(axis.anchor.x) : ((group && group.origin && Number.isFinite(Number(group.origin.x))) ? Number(group.origin.x) : 0),
      y: (axis.anchor && Number.isFinite(Number(axis.anchor.y))) ? Number(axis.anchor.y) : ((group && group.origin && Number.isFinite(Number(group.origin.y))) ? Number(group.origin.y) : 0)
    };
  }

  function representativeAxisAnchor(group) {
    var representative = getViewpointRepresentativeNode(group);
    var fallback = axisAnchor(group);

    if (representative &&
      Number.isFinite(Number(representative.x)) &&
      Number.isFinite(Number(representative.y))) {
      return { x: Number(representative.x), y: Number(representative.y) };
    }
    return fallback;
  }

  function setAxisAnchor(group, anchor) {
    anchor = anchor || axisAnchor(group);
    group.axis = group.axis || {};
    group.axis.anchor = {
      x: finiteNumber(anchor.x, 0),
      y: finiteNumber(anchor.y, 0)
    };
    group.origin = {
      x: group.axis.anchor.x,
      y: group.axis.anchor.y
    };
    return group.axis.anchor;
  }

  function axisScalarForOrientation(orientation, node, fallback) {
    if (Number.isFinite(Number(node && node.axisPos))) {
      return Number(node.axisPos);
    }
    if (orientation === 'vertical') {
      return finiteNumber(node && node.y, fallback);
    }
    return finiteNumber(node && node.x, fallback);
  }

  function syncAxisStartToRepresentative(group) {
    var oldAnchor;
    var anchor;
    var orientation;
    var oldAnchorPos;
    var newAnchorPos;
    var delta;

    if (!group) {
      return null;
    }

    oldAnchor = axisAnchor(group);
    anchor = representativeAxisAnchor(group);
    orientation = axisOrientation(group);
    oldAnchorPos = orientation === 'vertical' ? finiteNumber(oldAnchor.y, 0) : finiteNumber(oldAnchor.x, 0);
    newAnchorPos = orientation === 'vertical' ? finiteNumber(anchor.y, 0) : finiteNumber(anchor.x, 0);
    delta = newAnchorPos - oldAnchorPos;

    if (Number.isFinite(delta) && Math.abs(delta) > 0.0001) {
      getMemberNodes(group).forEach(function (node) {
        if (!node) { return; }
        if (Number.isFinite(Number(node.axisPos))) {
          node.axisPos = Number(node.axisPos) + delta;
        }
        else if (orientation === 'vertical' && Number.isFinite(Number(node.y))) {
          node.axisPos = Number(node.y) + delta;
        }
        else if (orientation === 'horizontal' && Number.isFinite(Number(node.x))) {
          node.axisPos = Number(node.x) + delta;
        }
      });
    }

    setAxisAnchor(group, anchor);
    return anchor;
  }

  function rotateViewpointMembersToOrientation(group, previousOrientation, nextOrientation, previousAnchor, nextAnchor) {
    var oldAnchorPos;
    var newAnchorPos;

    if (!group || previousOrientation === nextOrientation) {
      return false;
    }

    previousOrientation = previousOrientation === 'vertical' ? 'vertical' : 'horizontal';
    nextOrientation = nextOrientation === 'vertical' ? 'vertical' : 'horizontal';
    previousAnchor = previousAnchor || axisAnchor(group);
    nextAnchor = nextAnchor || representativeAxisAnchor(group);
    oldAnchorPos = previousOrientation === 'vertical' ? finiteNumber(previousAnchor.y, 0) : finiteNumber(previousAnchor.x, 0);
    newAnchorPos = nextOrientation === 'vertical' ? finiteNumber(nextAnchor.y, 0) : finiteNumber(nextAnchor.x, 0);

    group.orientation = nextOrientation;
    setAxisAnchor(group, nextAnchor);

    getMemberNodes(group).forEach(function (node) {
      var oldPos = axisScalarForOrientation(previousOrientation, node, oldAnchorPos);
      var delta = Number.isFinite(Number(oldPos)) ? (Number(oldPos) - oldAnchorPos) : 0;
      setNodeOnAxis(group, node, newAnchorPos + delta);
    });
    return true;
  }

  function rescaleViewpointMembersToAxisLength(group, previousLength, nextLength, anchor) {
    var members;
    var orientation;
    var anchorPos;

    if (!group) {
      return false;
    }

    previousLength = Math.max(1, Number(previousLength || group.length || AXIS_LENGTH));
    nextLength = Math.max(60, Number(nextLength || group.length || AXIS_LENGTH));
    if (!Number.isFinite(previousLength) || !Number.isFinite(nextLength)) {
      return false;
    }

    members = getMemberNodes(group);
    if (!members.length) {
      group.length = nextLength;
      return false;
    }

    orientation = axisOrientation(group);
    anchor = anchor || axisAnchor(group);
    anchorPos = orientation === 'vertical' ? finiteNumber(anchor.y, 0) : finiteNumber(anchor.x, 0);

    members.forEach(function (node, index) {
      var currentPos = getAxisPos(group, node);
      var ratio;

      if (Number.isFinite(Number(currentPos)) && previousLength > 0) {
        ratio = (Number(currentPos) - anchorPos) / previousLength;
      }
      else if (members.length > 1) {
        ratio = index / (members.length - 1);
      }
      else {
        ratio = 0;
      }

      if (!Number.isFinite(Number(ratio))) {
        ratio = 0;
      }
      ratio = Math.max(0, Math.min(1, Number(ratio)));
      setNodeOnAxis(group, node, anchorPos + (nextLength * ratio));
    });

    group.length = nextLength;
    return true;
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

  function axisPositionSort(group, a, b) {
    var pa = getAxisPos(group, a);
    var pb = getAxisPos(group, b);
    var pageA = Number(a && a.pageNumber || 0);
    var pageB = Number(b && b.pageNumber || 0);

    if (Number.isFinite(pa) && Number.isFinite(pb) && pa !== pb) {
      return pa - pb;
    }
    if (Number.isFinite(pa) && !Number.isFinite(pb)) { return -1; }
    if (!Number.isFinite(pa) && Number.isFinite(pb)) { return 1; }
    if (pageA !== pageB) { return pageA - pageB; }
    return String(a && a.id || '').localeCompare(String(b && b.id || ''));
  }

  function orderedAxisMembers(group) {
    return getMemberNodes(group).slice().sort(function (a, b) {
      return axisPositionSort(group, a, b);
    });
  }

  function shouldKeepPageMarkerPageOrder(group) {
    /*
     * HTML Viewpoint uses anchors/sections and has no reliable physical page
     * order, so PageMarkers can be freely reordered geometrically.  PDF and
     * Office document Viewpoint have pageNumber semantics and keep that order.
     */
    return !isHtmlViewpointGroup(group);
  }

  function orderedEndpointMembers(group) {
    var members = shouldKeepPageMarkerPageOrder(group)
      ? orderedPageMembers(group)
      : orderedAxisMembers(group);

    if (!shouldKeepPageMarkerPageOrder(group)) {
      setMemberIds(group, members.map(function (node) { return node.id; }));
    }
    return members;
  }

  function getAxisEndpointMembers(group) {
    var members = orderedEndpointMembers(group);
    var startNode = members.length ? members[0] : null;
    var endNode = members.length ? members[members.length - 1] : null;

    return {
      startNode: startNode,
      endNode: endNode,
      members: members
    };
  }

  function distanceSquared(a, b) {
    var dx = finiteNumber(a && a.x, 0) - finiteNumber(b && b.x, 0);
    var dy = finiteNumber(a && a.y, 0) - finiteNumber(b && b.y, 0);
    return dx * dx + dy * dy;
  }

  function getNearestAxisEndpoint(group, representative) {
    var endpoints = getAxisEndpointMembers(group);
    var startNode = endpoints.startNode;
    var endNode = endpoints.endNode;

    if (!startNode) { return null; }
    if (!endNode || startNode.id === endNode.id || !representative) { return startNode; }

    return distanceSquared(representative, startNode) <= distanceSquared(representative, endNode)
      ? startNode
      : endNode;
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
    var viewerPage = toViewerPageNumber(group, node && node.pageNumber);
    return Math.max(0, Math.min(1, (viewerPage - 1) / range));
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

  function enforceDocumentPageOrderPositions(group, members) {
    var positions;

    if (!shouldKeepPageMarkerPageOrder(group) || !members || members.length < 2) {
      return false;
    }

    positions = members.map(function (node) {
      return getAxisPos(group, node);
    }).filter(function (value) {
      return Number.isFinite(Number(value));
    }).map(Number).sort(function (a, b) { return a - b; });

    if (positions.length !== members.length) {
      return false;
    }

    members.forEach(function (node, index) {
      node.axisPos = positions[index];
    });
    return true;
  }

  function updateAxisBoundsFromPositions(group) {
    var endpoints, members, orientation, anchor, positions, minPos, maxPos, minLength;
    var startNode, endNode, startPos, endPos;

    if (!group) {
      return false;
    }

    group.axis = group.axis || {};
    anchor = axisAnchor(group);
    endpoints = getAxisEndpointMembers(group);
    members = endpoints.members || [];
    startNode = endpoints.startNode;
    endNode = endpoints.endNode;
    orientation = axisOrientation(group);

    positions = members.map(function (node) {
      return getAxisPos(group, node);
    }).filter(function (value) {
      return Number.isFinite(Number(value));
    }).map(Number);

    if (!positions.length) {
      group.length = Math.max(60, Number(group.length || AXIS_LENGTH));
      delete group.axis.startNodeId;
      delete group.axis.endNodeId;
      return false;
    }

    minPos = Math.min.apply(null, positions);
    maxPos = Math.max.apply(null, positions);

    if (shouldKeepPageMarkerPageOrder(group) && startNode) {
      /*
       * For PDF / Office documents, the axis starts at the lowest pageNumber
       * PageMarker and ends at the highest pageNumber PageMarker.  Dragging is
       * clamped so this order is not inverted.  If the page number itself is
       * changed, layout reassigns the geometric slots before this function.
       */
      startPos = getAxisPos(group, startNode);
      endPos = endNode ? getAxisPos(group, endNode) : startPos;
      if (Number.isFinite(Number(startPos))) {
        minPos = Number(startPos);
      }
      if (Number.isFinite(Number(endPos))) {
        maxPos = Math.max(Number(endPos), minPos);
      }
    }

    /*
     * HTML Viewpoint has no fixed page order.  Its endpoints are the current
     * geometric minimum and maximum PageMarkers, so dragging a marker across
     * another marker can redefine both ends of the visible axis.
     */
    if (orientation === 'vertical') {
      anchor.y = minPos;
    }
    else {
      anchor.x = minPos;
    }
    setAxisAnchor(group, anchor);

    minLength = members.length > 1
      ? 1
      : Math.max(60, Number(group.length || group.minAxisLength || AXIS_LENGTH));
    group.length = Math.max(minLength, maxPos - minPos);

    if (startNode) {
      group.axis.startNodeId = startNode.id;
    }
    else {
      delete group.axis.startNodeId;
    }
    if (endNode) {
      group.axis.endNodeId = endNode.id;
    }
    else {
      delete group.axis.endNodeId;
    }
    return true;
  }

  function layoutAxisGroup(group) {
    var axis, pageCount, displayStart, displayEnd, length, anchor, members;
    if (!group) { return null; }

    axis = group.axis || {};
    pageCount = getViewpointAxisPageCount(group);
    getMemberNodes(group).forEach(function (node) {
      pageCount = Math.max(pageCount, toViewerPageNumber(group, node && node.pageNumber));
    });
    displayStart = getFirstPageNumber(group);
    displayEnd = toDisplayedPageNumber(group, pageCount);
    length = Math.max(60, Number(group.length || AXIS_LENGTH));
    anchor = axisAnchor(group);

    group.axis = group.axis || {};
    delete group.pageOffset;
    delete group.firstPageNumber;
    delete group.firstDisplayedPageNumber;
    delete group.documentFirstPageNumber;
    group.axis.anchor = anchor;
    group.origin = { x: anchor.x, y: anchor.y };
    group.axis.start = displayStart;
    group.axis.end = displayEnd;
    group.axis.unit = (false === group.hasPageCount) ? 'pageMarker' : 'page';
    group.pageCount = displayEnd;
    group.documentPageCount = pageCount;
    if (false === group.hasPageCount) {
      group.documentPageCount = 0;
    }
    group.length = length;

    members = shouldKeepPageMarkerPageOrder(group)
      ? orderedPageMembers(group)
      : orderedEndpointMembers(group);
    members.forEach(function (node, index) {
      var pageNumber = clampPageNumber(group, node.pageNumber || toDisplayedPageNumber(group, index + 1));
      ensurePageNodeDefaults(group, node, index);
      node.pageNumber = pageNumber;
    });

    assignMissingAxisPositions(group, members, pageCount);
    enforceDocumentPageOrderPositions(group, members);
    members.forEach(function (node) {
      setNodeOnAxis(group, node, getAxisPos(group, node));
    });
    updateAxisBoundsFromPositions(group);

    return group;
  }

  function findDocumentNodeForGroup(group, point) {
    var page = getCurrentPage();
    var ids, nodes, found;
    if (!page || !group) { return null; }
    ids = [
      group.targetNodeId,
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
    group.type = 'viewpoint';
    group.groupType = 'axis';
    group.targetNodeId = group.targetNodeId || group.documentRef || group.mediaRef || '';
    if (!group.documentRef && group.targetNodeId) {
      group.documentRef = group.targetNodeId;
    }
    if (!group.mediaRef && group.targetNodeId) {
      group.mediaRef = group.targetNodeId;
    }
    if (!group.parentGroupId && group.targetNodeId) {
      group.parentGroupId = getParentGenericGroupIdForNode(group.targetNodeId);
    }
    group.hierarchical = true;
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
    group.axis.unit = (false === group.hasPageCount) ? 'pageMarker' : 'page';
    group.axis.anchor = group.axis.anchor || {};
    if (!Number.isFinite(Number(group.axis.anchor.x))) {
      group.axis.anchor.x = Number.isFinite(Number(group.origin && group.origin.x)) ? Number(group.origin.x) : 0;
    }
    if (!Number.isFinite(Number(group.axis.anchor.y))) {
      group.axis.anchor.y = Number.isFinite(Number(group.origin && group.origin.y)) ? Number(group.origin.y) : 0;
    }
    group.origin = group.origin || { x: Number(group.axis.anchor.x || 0), y: Number(group.axis.anchor.y || 0) };
    if (!Array.isArray(group.members)) { group.members = []; }
    group.length = Math.max(60, Number(group.length || AXIS_LENGTH));
    if (model && typeof model.ensureGroupRepresentativeTopic === 'function') {
      model.ensureGroupRepresentativeTopic(group, {
        topicKind: 'viewpoint-representative',
        label: group.name || 'Viewpoint'
      });
    }
    if (!group.documentRef) {
      var documentNode = findDocumentNodeForGroup(group, null);
      if (documentNode) {
        group.targetNodeId = documentNode.id;
        group.documentRef = documentNode.id;
        group.mediaRef = group.mediaRef || documentNode.id;
        group.parentGroupId = group.parentGroupId || getParentGenericGroupIdForNode(documentNode.id);
      }
    }
    getMemberNodes(group).forEach(function (node, index) {
      ensurePageNodeDefaults(group, node, index);
      if (!node.documentRef && group.documentRef) {
        node.documentRef = group.documentRef;
      }
    });
    ensureDocumentEntryLink(group);
    layoutAxisGroup(group);
    ensureViewpointRepresentativeEntryLink(group);
    return group;
  }

  function normalizeAllAxisGroups(page) {
    ((page && page.groups) || []).forEach(function (group) {
      if (isViewpointGroup(group)) {
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
    var members, index, gap, prev, next;

    /*
     * Only HTML Viewpoint PageMarkers can be dragged across neighbouring
     * markers.  PDF / Office PageMarkers represent ordered page numbers, so
     * dragging is clamped between the previous and next pageNumber markers.
     * Changing pageNumber is handled by layout and may move a marker across
     * neighbours to its new page-order slot.
     */
    if (!group || !pageNode || !shouldKeepPageMarkerPageOrder(group)) {
      return { min: -Infinity, max: Infinity };
    }

    members = orderedPageMembers(group);
    index = members.findIndex(function (node) { return node && node.id === pageNode.id; });
    gap = Math.max(4, Number(group.minAxisGap || 8));
    prev = index > 0 ? members[index - 1] : null;
    next = (index >= 0 && index < members.length - 1) ? members[index + 1] : null;
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
    if (!group || !isViewpointGroup(group) || !pageNode || pageNode.type !== 'PageMarker') {
      return false;
    }
    normalizeAxisGroup(group);
    pageNode = model.findNodeById(pageNode.id) || pageNode;
    pos = clampAxisPosition(axisScalar(group, x, y), getDragBounds(group, pageNode));
    setNodeOnAxis(group, pageNode, pos);
    updateAxisBoundsFromPositions(group);
    ensureViewpointRepresentativeEntryLink(group);
    return true;
  }

  function handlePageMarkerDrag(nodeOrId, eventX, eventY) {
    var pageNode = (typeof nodeOrId === 'string') ? model.findNodeById(nodeOrId) : (nodeOrId && nodeOrId.id ? (model.findNodeById(nodeOrId.id) || nodeOrId) : null);
    var group;
    if (!pageNode || pageNode.type !== 'PageMarker') {
      return false;
    }
    group = model.findGroupById(pageNode.groupRef);
    if (!group || !isViewpointGroup(group)) {
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

  function buildViewpointAxisPseudoLink(group) {
    if (!group || false === group.enabled || !isViewpointGroup(group)) {
      return null;
    }
    return {
      id: group.axisPseudoLinkId || makeUuid(),
      type: 'Link',
      pseudo: true,
      shape: (group.orientation === 'vertical') ? 'VERTICAL' : 'HORIZONTAL',
      linkType: 'viewpoint-axis',
      groupType: 'viewpointAxis',
      groupRef: group.id,
      visible: true,
      color: (group.spine && group.spine.color) || group.strokeColor || '#4c6b8a',
      size: (group.spine && group.spine.width) || group.strokeWidth || 4,
      font: { size: '12pt', color: common.Color.linkText, family: 'Arial' },
      audit: makeAudit()
    };
  }

  function createAxisGroup(axis, documentCandidate, option) {
    var page, documentNode, pageCount, pageOffset, firstPageNumber, displayEnd, origin, group, nodes, axisStartPos, parentGroupId;
    option = option || {};
    page = getCurrentPage();
    if (!page) { return null; }
    ensurePageCollections(page);
    documentNode = documentCandidate && documentCandidate.id
      ? (model.findNodeById(documentCandidate.id) || documentCandidate)
      : null;
    if (!isContentTargetResourceNode(documentNode)) {
      if (!option.silent) {
        window.alert(t('Select one viewpoint target content before creating viewpoint.'));
      }
      return null;
    }
    parentGroupId = getParentGenericGroupIdForNode(documentNode.id);
    pageCount = getDocumentPageCount(documentNode);
    firstPageNumber = Number.isFinite(Number(option.firstPageNumber || option.firstDisplayedPageNumber))
      ? Math.max(1, Math.floor(Number(option.firstPageNumber || option.firstDisplayedPageNumber)))
      : (Number.isFinite(Number(option.pageOffset))
        ? Math.max(1, Math.floor(Number(option.pageOffset)) + 1)
        : getDocumentFirstPageNumber(documentNode));
    setDocumentFirstPageNumber(documentNode, firstPageNumber);
    pageOffset = firstPageNumber - 1;
    displayEnd = firstPageNumber + Math.max(1, pageCount || 1) - 1;

    origin = defaultAxisOrigin(documentNode, axis === 'vertical' ? 'vertical' : 'horizontal');
    group = model.createGroup({
      id: makeUuid(),
      name: 'Viewpoint',
      type: 'viewpoint',
      groupType: 'axis',
      orientation: axis === 'vertical' ? 'vertical' : 'horizontal',
      targetNodeId: documentNode.id,
      parentGroupId: parentGroupId,
      hierarchical: true,
      documentRef: documentNode.id,
      pageCount: displayEnd,
      documentPageCount: pageCount || 0,
      hasPageCount: pageCount > 0,
      spine: { visible: true, color: '#4c6b8a', width: 4, padding: 12 },
      axis: {
        mode: 'document',
        unit: pageCount > 0 ? 'page' : 'pageMarker',
        start: firstPageNumber,
        end: displayEnd,
        anchor: { x: origin.x, y: origin.y }
      },
      origin: origin,
      length: AXIS_LENGTH,
      members: []
    });
    group.targetNodeId = documentNode.id;
    group.parentGroupId = parentGroupId;
    group.hierarchical = true;
    group.documentRef = documentNode.id;
    group.mediaRef = documentNode.id;
    group.pageCount = displayEnd;
    group.documentPageCount = pageCount || 0;
    group.hasPageCount = pageCount > 0;
    page.groups.push(group);
    axisStartPos = group.orientation === 'vertical' ? origin.y : origin.x;
    if (pageCount > 1) {
      nodes = [
        createPageNode(group, firstPageNumber, { axisRole: 'entry', axisPos: axisStartPos }),
        createPageNode(group, displayEnd, { axisRole: 'entry', axisPos: axisStartPos + AXIS_LENGTH })
      ];
    }
    else {
      nodes = [createPageNode(group, firstPageNumber, {
        axisRole: 'entry',
        label: pageCount > 0 ? String(firstPageNumber) : 'content',
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

  function addViewpointAxis(documentCandidate, option) {
    option = option || {};
    return createAxisGroup(option.axis || 'horizontal', documentCandidate, option);
  }

  function updateAxisGroup(group, props) {
    var previousOrientation;
    var nextOrientation;
    var previousAnchor;
    var nextAnchor;
    var previousLength;
    var nextLength;
    var lengthChanged;
    var orientationChanged;

    if (!group || !isViewpointGroup(group)) { return false; }

    previousOrientation = axisOrientation(group);
    previousAnchor = axisAnchor(group);
    normalizeAxisGroup(group);
    previousOrientation = axisOrientation(group);
    previousAnchor = axisAnchor(group);
    previousLength = Math.max(60, Number(group.length || AXIS_LENGTH));

    props = props || {};
    nextOrientation = (props.orientation === 'vertical' || props.orientation === 'horizontal')
      ? props.orientation
      : previousOrientation;
    orientationChanged = previousOrientation !== nextOrientation;
    nextAnchor = orientationChanged ? representativeAxisAnchor(group) : axisAnchor(group);
    nextLength = Number.isFinite(Number(props.length))
      ? Math.max(60, Number(props.length))
      : previousLength;
    lengthChanged = Math.abs(nextLength - previousLength) > 0.0001;

    group.orientation = nextOrientation;

    if (Object.prototype.hasOwnProperty.call(props, 'label')) {
      var nextLabel = String(props.label || '').trim();
      var representativeNode = getViewpointRepresentativeNode(group);
      if (!nextLabel) {
        nextLabel = 'Viewpoint';
      }
      group.name = nextLabel;
      group.label = nextLabel;
      if (representativeNode) {
        representativeNode.label = nextLabel;
      }
    }

    if (props.representativeShape || props.representativeSize) {
      applyNodeShapeSizeForViewpoint(
        getViewpointRepresentativeNode(group),
        props.representativeShape,
        props.representativeSize,
        defaultViewpointRepresentativeSize()
      );
    }

    group.length = nextLength;
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
    if (Number.isFinite(Number(props.firstPageNumber))) {
      updateFirstPageNumberMapping(group, props.firstPageNumber);
    }
    else if (Number.isFinite(Number(props.pageOffset))) {
      updatePageOffsetMapping(group, props.pageOffset);
    }

    setAxisAnchor(group, nextAnchor);

    if (orientationChanged) {
      /*
       * The representative topic may have moved independently along the axis.
       * On an h/v switch, move the axis start to the representative centre
       * first, then project the content targets to the new axis.
       */
      rotateViewpointMembersToOrientation(group, previousOrientation, nextOrientation, nextAnchor, nextAnchor);
    }

    if (lengthChanged) {
      rescaleViewpointMembersToAxisLength(group, previousLength, nextLength, nextAnchor);
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
    node.pendingViewpointEntry = true;
    node.viewpointEntryDraft = true;
    return node;
  }

  function commitEntryDraft(node) {
    var page = getCurrentPage();
    var group = node && model.findGroupById(node.groupRef);
    if (!page || !group || !isViewpointGroup(group)) { return false; }
    ensurePageCollections(page);
    group.members = Array.isArray(group.members) ? group.members : [];
    delete node.pendingViewpointEntry;
    delete node.viewpointEntryDraft;
    ensurePageNodeDefaults(group, node, group.members.length);
    node.pageNumber = clampPageNumber(group, node.pageNumber);
    page.nodes.push(node);
    appendMember(group, node.id, 'member');
    normalizeAxisGroup(group);
    rebuildGraphAndRefresh();
    return true;
  }


  function distributePageMarkers(groupOrTarget) {
    var spec = getContentTargetSpec(groupOrTarget);
    var group = spec && spec.group;
    var members;
    var positions;
    var anchor;
    var minPos;
    var maxPos;
    var step;

    if (!group || !isViewpointGroup(group)) { return false; }

    normalizeAxisGroup(group);
    members = shouldKeepPageMarkerPageOrder(group)
      ? orderedPageMembers(group)
      : orderedAxisMembers(group);

    if (members.length < 2) { return false; }

    positions = members.map(function (node) {
      return getAxisPos(group, node);
    }).filter(function (value) {
      return Number.isFinite(Number(value));
    }).map(Number);

    if (positions.length >= 2) {
      minPos = Math.min.apply(null, positions);
      maxPos = Math.max.apply(null, positions);
    }
    else {
      anchor = axisAnchor(group);
      minPos = axisOrientation(group) === 'vertical' ? anchor.y : anchor.x;
      maxPos = minPos + Math.max(60, Number(group.length || AXIS_LENGTH));
    }

    if (!Number.isFinite(Number(minPos)) || !Number.isFinite(Number(maxPos))) {
      return false;
    }

    if (minPos === maxPos) {
      maxPos = minPos + Math.max(60, Number(group.length || AXIS_LENGTH));
    }

    step = (maxPos - minPos) / (members.length - 1);
    members.forEach(function (node, index) {
      setNodeOnAxis(group, node, minPos + (step * index));
    });
    setMemberIds(group, members.map(function (node) { return node.id; }));
    updateAxisBoundsFromPositions(group);
    ensureViewpointRepresentativeEntryLink(group);
    rebuildGraphAndRefresh();
    return true;
  }

  function updateEntryFromNode(node) {
    var group = node && model.findGroupById(node.groupRef);
    if (!group || !isViewpointGroup(group)) { return false; }
    ensurePageNodeDefaults(group, node, 0);
    node.pageNumber = clampPageNumber(group, node.pageNumber);
    normalizeAxisGroup(group);
    rebuildGraphAndRefresh();
    return true;
  }

  function clonePlainObject(value) {
    if (!value || typeof value !== 'object') { return value; }
    try {
      return JSON.parse(JSON.stringify(value));
    }
    catch (e) {
      return value;
    }
  }

  function insertMemberAfter(group, sourceId, newId) {
    var members = Array.isArray(group.members) ? group.members.slice() : [];
    var index = members.findIndex(function (item) { return memberId(item) === sourceId; });
    var member = { nodeId: newId, role: 'member' };
    if (index >= 0) {
      members.splice(index + 1, 0, member);
    }
    else {
      members.push(member);
    }
    group.members = members;
  }

  function copyTarget(target) {
    var spec = getContentTargetSpec(target);
    var page = getCurrentPage();
    var group = spec && spec.group;
    var point = spec && spec.point;
    var clone, gap, basePos, copiedGroupLog;

    if (!page || !group) { return null; }

    if (!point) {
      if (model && typeof model.copyGroup === 'function') {
        copiedGroupLog = model.copyGroup(target);
        if (copiedGroupLog) {
          rebuildGraphAndRefresh();
        }
        return copiedGroupLog;
      }
      return null;
    }

    if (point.type !== 'PageMarker') { return null; }
    ensurePageCollections(page);

    clone = clonePlainObject(point);
    clone.id = makeUuid();
    clone.changed = true;
    clone.visible = true;
    clone.copying = false;
    clone.groupRef = group.id;
    clone.documentRef = point.documentRef || group.documentRef;
    clone.audit = makeAudit();

    gap = Math.max(24, Number(group.axisGap || group.minAxisGap || 40));
    basePos = Number.isFinite(Number(point.axisPos)) ? Number(point.axisPos) : getAxisPos(group, point);
    clone.axisPos = basePos + gap;
    setNodeOnAxis(group, clone, clone.axisPos);

    page.nodes.push(clone);
    insertMemberAfter(group, point.id, clone.id);
    normalizeAxisGroup(group);
    ensureViewpointRepresentativeEntryLink(group);
    rebuildGraphAndRefresh();
    return clone;
  }

  function deleteTarget(target) {
    var spec = getContentTargetSpec(target);
    var page = getCurrentPage();
    var group = spec && spec.group;
    var point = spec && spec.point;
    if (!page || !group) { return false; }
    if (!point && (isViewpointAxisLink(target) || isViewpointGroup(target) || isViewpointRepresentativeNode(target))) {
      page.links = (page.links || []).filter(function (link) {
        return !(link && (
          link.groupRef === group.id ||
          link.from === group.representativeNodeId ||
          link.to === group.representativeNodeId
        ));
      });
      page.nodes = (page.nodes || []).filter(function (node) {
        return !(node && (node.groupRef === group.id || node.id === group.representativeNodeId));
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
    if (isViewpointPageNode(target)) {
      point = model.findNodeById(target.id) || target;
      group = model.findGroupById(point.groupRef);
    }
    else if (isViewpointAxisLink(target)) {
      group = model.findGroupById(target.groupRef);
    }
    else if (isViewpointRepresentativeNode(target)) {
      group = findViewpointGroupByRepresentativeNode(target);
    }
    else if (isViewpointGroup(target)) {
      group = target;
    }
    if (!group || !isViewpointGroup(group)) { return null; }
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
    var text = String(uri || '').trim();
    var parsed, path;

    if (!text) { return false; }
    if (/\.pdf(?:[?#].*)?$/i.test(text)) { return true; }
    try {
      parsed = new URL(text, window.location && window.location.href ? window.location.href : undefined);
      path = parsed.searchParams.get('path') || parsed.pathname || '';
      try { path = decodeURIComponent(path); } catch (e) { /* keep path */ }
      return /\.pdf$/i.test(String(path || '').split(/[?#]/)[0]);
    }
    catch (e2) {
      return false;
    }
  }

  function appendPageFragment(uri, pageNumber) {
    var page = Number(pageNumber);
    if (!Number.isFinite(page)) { page = 1; }
    page = Math.max(1, Math.floor(page));
    var base = toDirectUploadContentUri(String(uri || '').replace(/#.*$/, ''));
    if (!base) { return ''; }
    return base + '#page=' + encodeURIComponent(page);
  }

  function extractNonPageFragment(value) {
    var text = String(value || '').trim();
    var hashIndex;

    if (!text) { return ''; }
    hashIndex = text.indexOf('#');
    if (hashIndex >= 0) {
      text = text.slice(hashIndex + 1);
    }
    text = text.replace(/^#+/, '').trim();
    if (!text || /^page=/i.test(text)) {
      return '';
    }
    return text;
  }

  function getContentTargetFragment(contentTarget) {
    var candidates;
    var i;
    var fragment;

    if (!contentTarget) { return ''; }

    candidates = [
      contentTarget.anchorHref,
      contentTarget.htmlAnchorHref
    ];

    for (i = 0; i < candidates.length; i++) {
      fragment = extractNonPageFragment(candidates[i]);
      if (fragment) { return fragment; }
    }
    return '';
  }

  function isFullHref(value) {
    return /^(https?:|blob:|data:|\/)/i.test(String(value || '').trim());
  }

  function getContentTargetFullHref(contentTarget) {
    var candidates;
    var i;
    var value;

    if (!contentTarget) { return ''; }
    candidates = [
      contentTarget.htmlAnchorHref,
      contentTarget.anchorHref
    ];
    for (i = 0; i < candidates.length; i++) {
      value = String(candidates[i] || '').trim();
      if (value && isFullHref(value) && !/^#/i.test(value)) {
        return value;
      }
    }
    return '';
  }

  function removeHash(uri) {
    return String(uri || '').replace(/#.*$/, '');
  }

  function appendNonPageFragment(base, fragment) {
    base = String(base || '').trim();
    fragment = String(fragment || '').replace(/^#+/, '').trim();
    if (!base) { return ''; }
    if (!fragment || /^page=/i.test(fragment)) { return base; }
    return removeHash(base) + '#' + fragment;
  }

  function buildContentTargetViewerUrl(uri, pageNumber, contentTarget) {
    var base = String(uri || '').trim();
    var fullHref = getContentTargetFullHref(contentTarget);
    var fragment = getContentTargetFragment(contentTarget);

    if (!base && fullHref) {
      base = fullHref;
    }
    if (!base) { return ''; }
    if (isPdfLikeUri(base)) {
      return appendPageFragment(base, pageNumber);
    }

    if (fullHref && !isPdfLikeUri(fullHref)) {
      if (extractNonPageFragment(fullHref)) {
        return fullHref;
      }
      if (fragment) {
        return appendNonPageFragment(fullHref, fragment);
      }
      return fullHref;
    }

    if (fragment) {
      return appendNonPageFragment(base, fragment);
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
    var contentTarget = arguments.length > 2 ? arguments[2] : null;
    var group = contentTarget && contentTarget.groupRef && model && typeof model.findGroupById === 'function'
      ? model.findGroupById(contentTarget.groupRef)
      : null;
    var viewerPageNumber = group ? toViewerPageNumber(group, pageNumber) : pageNumber;

    if (!documentNode) { return ''; }

    if (isOfficeDocumentNode(documentNode)) {
      uri = getOfficeDocumentViewerUrl(documentNode, viewerPageNumber, contentTarget);
      if (uri) {
        return buildContentTargetViewerUrl(uri, viewerPageNumber, contentTarget);
      }
    }

    if (isHtmlDocumentNode(documentNode)) {
      uri = getHtmlDocumentViewerUrl(documentNode);
      if (uri) {
        return buildContentTargetViewerUrl(uri, viewerPageNumber, contentTarget);
      }
    }

    if (util && typeof util.getResourcePreviewUri === 'function') {
      uri = util.getResourcePreviewUri(documentNode) || '';
    }
    if (!uri && util && typeof util.getResourceOriginalUri === 'function') {
      uri = util.getResourceOriginalUri(documentNode) || '';
    }
    return buildContentTargetViewerUrl(uri, viewerPageNumber, contentTarget);
  }

  function isHtmlDocumentNode(documentNode) {
    return !!(wuwei.document &&
      typeof wuwei.document.isHtmlDocumentNode === 'function' &&
      wuwei.document.isHtmlDocumentNode(documentNode));
  }

  function getHtmlDocumentViewerUrl(documentNode) {
    if (wuwei.document && typeof wuwei.document.getViewerUrl === 'function') {
      return wuwei.document.getViewerUrl(documentNode);
    }
    return '';
  }

  function isOfficeDocumentNode(documentNode) {
    var resource = (documentNode && documentNode.resource && 'object' === typeof documentNode.resource) ? documentNode.resource : {};
    var documentKind = String(resource.documentKind || '').toLowerCase();
    return !!(documentNode && documentNode.type === 'Content' && (
      documentKind === 'office' ||
      (util && typeof util.isDocumentKindByExtension === 'function' &&
        util.isDocumentKindByExtension(documentNode, resource, '', 'office'))
    ));
  }

  function isPageMarkerContentTarget(contentTarget) {
    return !!(contentTarget && (
      contentTarget.type === 'PageMarker' ||
      contentTarget.nodeKind === 'PageMarker' ||
      contentTarget.kind === 'PageMarker' ||
      contentTarget.topicKind === 'viewpoint-page'
    ));
  }

  function getOfficeDocumentViewerUrl(documentNode, pageNumber, contentTarget) {
    var previewUri = util && typeof util.getResourcePdfPreviewUri === 'function'
      ? util.getResourcePdfPreviewUri(documentNode)
      : '';
    var originalUri = util && typeof util.getResourceOriginalUri === 'function'
      ? util.getResourceOriginalUri(documentNode)
      : String(documentNode && documentNode.resource && (documentNode.resource.canonicalUri || documentNode.resource.uri) || '');

    /*
     * Office Viewer cannot jump to a page.  Therefore a Viewpoint PageMarker
     * for an Office document must use the OpenOffice/LibreOffice converted
     * PDF preview, even on the EC2 server.  The Office Content itself still
     * uses Office Viewer on EC2, while localhost uses the converted PDF.
     */
    if (previewUri && isPageMarkerContentTarget(contentTarget)) {
      return appendPageFragment(previewUri, pageNumber);
    }
    if (previewUri && util && typeof util.isLocalHost === 'function' && util.isLocalHost()) {
      return appendPageFragment(previewUri, pageNumber);
    }
    if (canOfficeViewerFetch(originalUri)) {
      return 'https://view.officeapps.live.com/op/embed.aspx?src=' +
        encodeURIComponent(toOfficeViewerFetchUri(originalUri, documentNode));
    }
    return previewUri ? appendPageFragment(previewUri, pageNumber) : (originalUri || '');
  }

  function canOfficeViewerFetch(uri) {
    var parsed;
    if (!/^https?:\/\//i.test(String(uri || ''))) {
      return false;
    }
    try {
      parsed = new URL(uri, window.location.href);
      return !/^(?:localhost|127\.0\.0\.1|\[?::1\]?)$/i.test(parsed.hostname);
    }
    catch (e) {
      return false;
    }
  }

  function toOfficeViewerFetchUri(uri, documentNode) {
    var parsed, area, path, uid;
    var text = String(uri || '').trim();

    try {
      parsed = new URL(text, window.location.href);
    }
    catch (e) {
      return text;
    }

    area = parsed.searchParams.get('area') || '';
    path = parsed.searchParams.get('path') || '';
    uid = parsed.searchParams.get('user_id') || getDocumentOwnerId(documentNode);
    if (!path || area !== 'upload' || !/(?:^|\/)(?:cgi-bin|server)\/load-file\.(?:py|cgi)\?/i.test(parsed.pathname + parsed.search)) {
      return parsed.href;
    }
    return new URL(getAppBasePath() + 'data/' + encodeURIComponent(uid) + '/upload/' + encodeStoragePath(path), window.location.origin).href;
  }

  function getDocumentOwnerId(documentNode) {
    var resource = (documentNode && documentNode.resource && 'object' === typeof documentNode.resource) ? documentNode.resource : {};
    var audit = (resource.audit && 'object' === typeof resource.audit) ? resource.audit : {};
    var rights = (resource.rights && 'object' === typeof resource.rights) ? resource.rights : {};
    var nodeAudit = (documentNode && documentNode.audit && 'object' === typeof documentNode.audit) ? documentNode.audit : {};
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

  ns.getCurrentPage = getCurrentPage;
  ns.isViewpointGroup = isViewpointGroup;
  ns.isViewpointPageNode = isViewpointPageNode;
  ns.isViewpointRepresentativeNode = isViewpointRepresentativeNode;
  ns.isViewpointAxisLink = isViewpointAxisLink;
  ns.isContentTargetResourceNode = isContentTargetResourceNode;
  ns.getAttachedViewpointGroupsForNode = getAttachedViewpointGroupsForNode;
  ns.hasAttachedViewpointGroup = hasAttachedViewpointGroup;
  ns.isHtmlResourceNode = isHtmlResourceNode;
  ns.getDocumentPageCount = getDocumentPageCount;
  ns.hasKnownDocumentPages = hasKnownDocumentPages;
  ns.getFirstPageNumber = getFirstPageNumber;
  ns.getDocumentFirstPageNumber = getDocumentFirstPageNumber;
  ns.setDocumentFirstPageNumber = setDocumentFirstPageNumber;
  ns.getPageNumberOffset = getPageNumberOffset;
  ns.toViewerPageNumber = toViewerPageNumber;
  ns.toDisplayedPageNumber = toDisplayedPageNumber;
  ns.getPageMarkerPageNumberRange = getPageMarkerPageNumberRange;
  ns.clampPageMarkerPageNumber = clampPageMarkerPageNumber;
  ns.recomputePageNumbersFromPageNumbers = recomputePageNumbersFromPageNumbers;
  ns.updateFirstPageNumberMapping = updateFirstPageNumberMapping;
  ns.updatePageOffsetMapping = updatePageOffsetMapping;
  ns.createAxisGroup = createAxisGroup;
  ns.addViewpointAxis = addViewpointAxis;
  ns.updateAxisGroup = updateAxisGroup;
  ns.addEntry = addEntry;
  ns.distributePageMarkers = distributePageMarkers;
  ns.createEntryDraft = createEntryDraft;
  ns.commitEntryDraft = commitEntryDraft;
  ns.updateEntryFromNode = updateEntryFromNode;
  ns.copyTarget = copyTarget;
  ns.deleteTarget = deleteTarget;
  ns.normalizeAxisGroup = normalizeAxisGroup;
  ns.normalizeAllAxisGroups = normalizeAllAxisGroups;
  ns.buildViewpointAxisPseudoLink = buildViewpointAxisPseudoLink;
  ns.updateAxisBoundsFromPositions = updateAxisBoundsFromPositions;
  ns.updatePageMarkerAxisPosition = updatePageMarkerAxisPosition;
  ns.handlePageMarkerDrag = handlePageMarkerDrag;
  ns.getContentTargetSpec = getContentTargetSpec;
  ns.getContentTargetViewerUrl = getDocumentViewerUrl;
  ns.getDocumentViewerUrl = getDocumentViewerUrl;
})(wuwei.viewpoint);
// wuwei.viewpoint.js last modified 2026-05-19
