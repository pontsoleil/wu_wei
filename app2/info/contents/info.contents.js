/**
 * info.contents.js
 * Contents axis and PageMarker info controller
 */
wuwei.info = wuwei.info || {};
wuwei.info.contents = wuwei.info.contents || {};

(function (ns) {
  'use strict';

  var contents = wuwei.contents;
  var model = wuwei.model;
  var stateMap = { point: null, group: null };



  function ensureInfoRoot() {
    var infoPane = document.getElementById('info');
    var editPane = document.getElementById('edit');
    var hasHeader;

    if (editPane) {
      editPane.style.display = 'none';
    }
    if (!infoPane) {
      return null;
    }

    hasHeader = !!(
      infoPane.querySelector('header') &&
      infoPane.querySelector('#infoDismiss') &&
      infoPane.querySelector('#infoWiden')
    );

    /*
     * Contents info can also be opened directly from the context-menu [i]
     * command.  Ensure the shared info header exists so edit / info / widen /
     * close controls are always available.
     */
    if (wuwei.info && wuwei.info.markup && typeof wuwei.info.markup.template === 'function') {
      if (!hasHeader || !document.getElementById('info-contents')) {
        infoPane.innerHTML = wuwei.info.markup.template();
      }
    }
    infoPane.style.display = 'block';
    return infoPane;
  }

  function hideSiblingPanes() {
    [
      'info-generic',
      'info-group',
      'info-uploaded',
      'info-video',
      'info-asciidoc',
      'info-timeline'
    ].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) { el.style.display = 'none'; }
    });
  }

  function setInfoDataset(target) {
    var infoPane = document.getElementById('info');
    if (!infoPane) { return; }
    delete infoPane.dataset.page_marker_id;
    delete infoPane.dataset.edit_node_id;
    delete infoPane.dataset.group_id;

    if (target && (target.type === 'PageMarker') && target.id) {
      infoPane.dataset.node_id = target.id;
      infoPane.dataset.page_marker_id = target.id;
      infoPane.dataset.edit_node_id = target.id;
      return;
    }
    if (target && target.id) {
      infoPane.dataset.node_id = target.id;
      infoPane.dataset.group_id = target.id;
    }
  }

  function ensurePane() {
    var infoPane = ensureInfoRoot();
    var pane = document.getElementById('info-contents');
    if (pane) {
      hideSiblingPanes();
      return pane;
    }
    if (!infoPane || !wuwei.info.contents.markup) { return null; }
    infoPane.insertAdjacentHTML('beforeend', wuwei.info.contents.markup.paneTemplate());
    hideSiblingPanes();
    return document.getElementById('info-contents');
  }

  function close() {
    var pane = document.getElementById('info-contents');
    if (!pane) { return; }
    pane.innerHTML = '';
    pane.style.display = 'none';
    stateMap.point = null;
    stateMap.group = null;
  }

  function getSpec(target) {
    return contents && typeof contents.getContentTargetSpec === 'function'
      ? contents.getContentTargetSpec(target)
      : null;
  }

  function canOpen(target) {
    return !!getSpec(target);
  }

  function getDocumentName(spec) {
    var node = spec && spec.documentNode;
    return node ? (node.label || node.name || node.id || '') : '';
  }

  function getResourceTextForTypeCheck(node) {
    var resource = (node && node.resource && typeof node.resource === 'object') ? node.resource : {};
    var media = (resource.media && typeof resource.media === 'object') ? resource.media : {};
    var contentsMeta = (resource.contents && typeof resource.contents === 'object') ? resource.contents : {};
    var storageFiles = (resource.storage && Array.isArray(resource.storage.files)) ? resource.storage.files : [];
    var textParts = [
      resource.mimeType,
      media.mimeType,
      node && (node.contenttype || node.contentType),
      contentsMeta.type,
      resource.kind,
      resource.type,
      resource.canonicalUri,
      resource.uri,
      resource.file,
      resource.filename
    ];

    storageFiles.forEach(function (file) {
      if (file) {
        textParts.push(file.path, file.file, file.name, file.role);
      }
    });

    if (wuwei.util && typeof wuwei.util.getResourceOriginalUri === 'function') {
      textParts.push(wuwei.util.getResourceOriginalUri(node));
    }
    if (wuwei.util && typeof wuwei.util.getResourcePreviewUri === 'function') {
      textParts.push(wuwei.util.getResourcePreviewUri(node));
    }

    return textParts.map(function (value) {
      return String(value || '').toLowerCase();
    }).join(' ');
  }

  function isPdfDocumentNode(node) {
    var text = getResourceTextForTypeCheck(node);
    return !!(node && node.type === 'Content' && (
      text.indexOf('application/pdf') >= 0 ||
      /\.pdf(?:[?#]|\s|$)/i.test(text) ||
      /(?:^|\s)pdf(?:\s|$)/i.test(text)
    ));
  }

  function shouldShowPageOffset(spec, pageOffset) {
    var offset = Number(pageOffset);
    return !!(spec && isPdfDocumentNode(spec.documentNode) && Number.isFinite(offset) && offset > 0);
  }

  function memberId(member) {
    if (!member) { return ''; }
    return member.nodeId || member.id || (typeof member === 'string' ? member : '');
  }

  function getDescriptionText(point) {
    if (!point) { return ''; }
    if (point.description) {
      if ('string' === typeof point.description) {
        return point.description;
      }
      if ('object' === typeof point.description) {
        return point.description.body || point.description.text || '';
      }
    }
    return point.value || point.memo || point.note || '';
  }

  function isFullHref(value) {
    return /^(https?:|blob:|data:|\/)/i.test(String(value || '').trim());
  }

  function getPageMarkerAnchorHref(point) {
    var candidates = [
      point && point.targetHref,
      point && point.href,
      point && point.htmlAnchorHref,
      point && point.anchorHref,
      point && point.sectionId,
      point && point.anchor,
      point && point.fragment,
      point && point.contentAnchor
    ];
    var i, value;

    for (i = 0; i < candidates.length; i++) {
      value = String(candidates[i] || '').trim();
      if (!value) { continue; }
      if (value.charAt(0) === '#') { return value; }
      if (value.indexOf('#') >= 0 || isFullHref(value)) { return value; }
      if (!/^page=/i.test(value)) { return '#' + value.replace(/^#+/, ''); }
    }
    return '';
  }

  function markerAxisPosition(group, point) {
    var value = Number(point && point.axisPos);
    var vertical = !group || group.orientation !== 'horizontal';

    if (Number.isFinite(value)) { return value; }
    value = Number(point && (vertical ? point.y : point.x));
    return Number.isFinite(value) ? value : 0;
  }

  function collectMarkerRows(spec) {
    var group = spec && spec.group;
    var documentNode = spec && spec.documentNode;
    var rows;

    if (!group || !Array.isArray(group.members)) { return []; }

    rows = group.members.map(function (member) {
      var id = memberId(member);
      var point = id && model && typeof model.findNodeById === 'function'
        ? model.findNodeById(id)
        : null;
      var anchorHref;
      var pageNumber;

      if (!point || point.type !== 'PageMarker') { return null; }
      anchorHref = getPageMarkerAnchorHref(point);
      pageNumber = Math.max(1, Math.floor(Number(point.pageNumber || 1)));

      return {
        id: point.id,
        label: point.label || '',
        description: getDescriptionText(point),
        pageNumber: pageNumber,
        anchorHref: anchorHref,
        axisPos: markerAxisPosition(group, point),
        viewerUri: documentNode && contents && typeof contents.getContentTargetViewerUrl === 'function'
          ? contents.getContentTargetViewerUrl(documentNode, pageNumber, point)
          : ''
      };
    }).filter(Boolean);

    rows.sort(function (a, b) {
      if (a.anchorHref || b.anchorHref) {
        return a.axisPos - b.axisPos;
      }
      return a.pageNumber - b.pageNumber;
    });

    return rows;
  }

  function openAxis(groupOrTarget) {
    var spec = getSpec(groupOrTarget);
    var pane = ensurePane();
    var group;

    if (!pane || !spec || !spec.group) { return false; }
    group = spec.group;
    setInfoDataset(group);
    stateMap.group = group;
    stateMap.point = null;

    var pageOffset = wuwei.contents && typeof wuwei.contents.getPageNumberOffset === 'function'
      ? wuwei.contents.getPageNumberOffset(group)
      : 0;

    pane.innerHTML = wuwei.info.contents.markup.axisTemplate({
      group: group,
      documentName: getDocumentName(spec),
      markerCount: Array.isArray(group.members) ? group.members.length : 0,
      pageOffset: pageOffset,
      showPageOffset: shouldShowPageOffset(spec, pageOffset),
      markers: collectMarkerRows(spec)
    });
    pane.style.display = 'block';
    return true;
  }

  function openMarker(pointOrTarget) {
    var spec = getSpec(pointOrTarget);
    var pane = ensurePane();

    if (!pane || !spec || !spec.point) { return false; }
    setInfoDataset(spec.point);
    stateMap.group = spec.group;
    stateMap.point = spec.point;

    pane.innerHTML = wuwei.info.contents.markup.markerTemplate({
      point: spec.point,
      axisName: spec.group ? (spec.group.name || spec.group.id) : '',
      documentName: getDocumentName(spec),
      pageNumber: spec.pageNumber
    });
    pane.style.display = 'block';
    return true;
  }

  function open(target, option) {
    var point = option && (option.displayedContentTarget || option.contentTarget || option.contentTargetPoint || option.displayedPageMarker || option.contentsPoint);
    var spec;

    if (point && openMarker(point)) {
      return true;
    }

    spec = getSpec(target);
    if (!spec) { return false; }
    if (spec.point) {
      return openMarker(spec.point);
    }
    return openAxis(spec.group);
  }

  function openContentTargetInInfo(point) {
    ensureInfoRoot();
    return openMarker(point);
  }

  function openContentsAxisInInfo(group) {
    ensureInfoRoot();
    return openAxis(group);
  }

  function getCurrentMarker() {
    return stateMap.point;
  }

  ns.open = open;
  ns.openAxis = openAxis;
  ns.openMarker = openMarker;
  ns.close = close;
  ns.canOpen = canOpen;
  ns.getCurrentMarker = getCurrentMarker;
  ns.openContentTargetInInfo = openContentTargetInInfo;
  ns.openPageMarkerInInfo = openContentTargetInInfo;
  ns.openContentsAxisInInfo = openContentsAxisInInfo;
  wuwei.info.openContentTargetInInfo = openContentTargetInInfo;
  wuwei.info.openPageMarkerInInfo = openContentTargetInInfo;
  wuwei.info.openContentsAxisInInfo = openContentsAxisInInfo;
})(wuwei.info.contents);
