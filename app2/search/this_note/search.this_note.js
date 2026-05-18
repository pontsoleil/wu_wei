/**
 * search.this_note.js
 * Current-page search and display-condition entry point.
 */
wuwei.search = wuwei.search || {};
wuwei.search.this_note = (function (ns) {
  var common = wuwei.common;
  var model = wuwei.model;
  var util = wuwei.util;
  var draw = wuwei.draw;
  var resultMap = {};
  var lastCondition = null;
  var infoTargetId = '';

  function getCurrentPage() {
    return common && common.current ? common.current.page || null : null;
  }

  function asText(value) {
    if (value == null) { return ''; }
    if (typeof value === 'string') { return value; }
    if (typeof value === 'number' || typeof value === 'boolean') { return String(value); }
    if (typeof value === 'object') {
      return [value.label, value.title, value.name, value.body, value.description]
        .map(asText)
        .filter(Boolean)
        .join(' ');
    }
    return '';
  }

  function getResource(node) {
    return node && node.resource && typeof node.resource === 'object' ? node.resource : {};
  }

  function normaliseContentKind(kind) {
    kind = String(kind || '').toLowerCase();
    if (kind === 'document') { return 'pdf'; }
    if (kind === 'webpage' || kind === 'html') { return 'web'; }
    return kind;
  }

  function getContentKind(node) {
    var resource = getResource(node);
    var contents = resource.contents && typeof resource.contents === 'object' ? resource.contents : {};
    var storage = resource.storage && typeof resource.storage === 'object' ? resource.storage : {};
    var files = Array.isArray(storage.files) ? storage.files : [];
    var original = files.find(function (file) {
      return file && String(file.role || '').toLowerCase() === 'original';
    }) || {};
    var preview = files.find(function (file) {
      return file && String(file.role || '').toLowerCase() === 'preview';
    }) || {};
    var uri = String([
      resource.canonicalUri,
      resource.uri,
      original.path,
      original.file,
      preview.path,
      preview.file
    ].filter(Boolean).join(' ')).toLowerCase();
    var mime = String(resource.mimeType || original.mimeType || preview.mimeType || '').toLowerCase();
    var kind = normaliseContentKind(resource.documentKind || resource.kind || '');

    /*
     * resource.kind may be a storage/origin kind such as "upload".
     * Do not return that value as the content kind.  In that case, inspect
     * mime type and file names so an uploaded PDF still matches the PDF
     * condition.
     */
    if (/\.pdf(?:[?#].*)?$/.test(uri) || mime.indexOf('application/pdf') === 0 || kind === 'pdf') { return 'pdf'; }
    if (/\.(docx?|xlsx?|pptx?|odt|ods|odp)(?:[?#].*)?$/.test(uri) || /officedocument|msword|ms-excel|ms-powerpoint|vnd\.ms-/i.test(mime) || kind === 'office') { return 'office'; }
    if (/\.(png|jpe?g|gif|webp|svg)(?:[?#].*)?$/.test(uri) || mime.indexOf('image/') === 0 || kind === 'image') { return 'image'; }
    if (/\.(mp4|webm|ogg|mov|m4v)(?:[?#].*)?$/.test(uri) || mime.indexOf('video/') === 0 || kind === 'video') { return 'video'; }
    if (kind === 'web' || /^https?:\/\//.test(String(resource.canonicalUri || resource.uri || ''))) { return 'web'; }
    return '';
  }

  function readCondition() {
    var textEl = document.getElementById('search-text');
    return {
      keyword: textEl ? String(textEl.value || '').trim() : ''
    };
  }

  function keywordTerms(condition) {
    return String(condition && condition.keyword || '')
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
  }

  function matchesKeyword(text, condition) {
    var terms = keywordTerms(condition);
    var hay = String(text || '').toLowerCase();
    if (!terms.length) { return true; }
    return terms.every(function (term) { return hay.indexOf(term) >= 0; });
  }



  function getFoundColor() {
    if (common && common.actionColor && common.actionColor.found) {
      return common.actionColor.found.color || common.actionColor.found.background || '#9ACD32';
    }
    if (common && common.Color && common.Color.searchMatch) {
      return common.Color.searchMatch;
    }
    return '#9ACD32';
  }

  function applyFoundColorVariable() {
    if (document && document.documentElement && document.documentElement.style) {
      document.documentElement.style.setProperty('--wuwei-search-match-color', getFoundColor());
    }
  }

  function getInformationColor() {
    if (common && common.actionColor && common.actionColor.info) {
      return common.actionColor.info.color || common.actionColor.info.background || '#8B008B';
    }
    return '#8B008B';
  }

  function applyInformationColorVariable() {
    if (document && document.documentElement && document.documentElement.style) {
      document.documentElement.style.setProperty('--wuwei-info-mark-color', getInformationColor());
    }
  }

  function findGroupRepresentativeId(group) {
    var representative;
    if (!group) { return ''; }
    if (group.representativeNodeId) { return group.representativeNodeId; }
    if (model && typeof model.findGroupByTarget === 'function') {
      group = model.findGroupByTarget(group) || group;
      if (group && group.representativeNodeId) { return group.representativeNodeId; }
    }
    if (model && typeof model.ensureGroupRepresentativeTopic === 'function') {
      representative = model.ensureGroupRepresentativeTopic(group);
      if (representative && representative.id) { return representative.id; }
    }
    return group && group.id ? group.id : '';
  }

  function infoMarkerIdForTarget(target) {
    var type;
    if (!target) { return ''; }
    type = String(target.type || '');
    if (Array.isArray(target.members) || ['Group', 'simple', 'horizontal', 'vertical', 'timeline', 'contents'].indexOf(type) >= 0) {
      return findGroupRepresentativeId(target);
    }
    return target.id || '';
  }

  function updateInfoResultClass() {
    var items;
    applyInformationColorVariable();
    if (!document || !document.querySelectorAll) { return; }
    items = document.querySelectorAll('#search-this_note .search-result-item');
    Array.prototype.forEach.call(items, function (item) {
      var targetId = item.getAttribute('data-target-id') || '';
      var markerId = item.getAttribute('data-marker-id') || '';
      var active = !!infoTargetId && (infoTargetId === targetId || infoTargetId === markerId);
      item.classList.toggle('search-result-info-current', active);
    });
  }

  function setInfoTarget(target) {
    infoTargetId = typeof target === 'string' ? target : infoMarkerIdForTarget(target);
    updateInfoResultClass();
  }

  function clearInfoTarget() {
    infoTargetId = '';
    updateInfoResultClass();
  }

  function objectSearchText(obj) {
    var resource = getResource(obj);
    var contents = resource.contents && typeof resource.contents === 'object' ? resource.contents : {};
    var storage = resource.storage && typeof resource.storage === 'object' ? resource.storage : {};
    var files = Array.isArray(storage.files) ? storage.files : [];
    return [
      obj && obj.label,
      obj && obj.title,
      obj && obj.description,
      obj && obj.role,
      obj && obj.relation,
      obj && obj.linkRole,
      obj && obj.linkType,
      obj && obj.shape,
      obj && obj.pageNumber,
      obj && obj.anchorHref,
      resource.title,
      resource.uri,
      resource.canonicalUri,
      resource.mimeType,
      resource.description,
      contents.pageCount,
      files.map(function (file) {
        return [file.role, file.path, file.file, file.name, file.mimeType].map(asText).join(' ');
      }).join(' ')
    ].map(asText).join(' ');
  }

  function objectType(obj) {
    var type;
    if (!obj) { return ''; }
    type = String(obj.type || '');
    if (type === 'Link') { return 'Link'; }
    if (type === 'contents') { return 'Contents'; }
    if (type === 'timeline' || obj.groupType === 'timeline' || obj.groupType === 'axis') { return 'Timeline'; }
    if (type === 'Group' || ['simple', 'horizontal', 'vertical'].indexOf(type) >= 0) { return 'Group'; }
    if (type === 'PageMarker' || obj.topicKind === 'contents-page') { return 'Contents'; }
    return type;
  }

  function matchesObject(obj, condition) {
    /*
     * Search / display filtering is a text match over the object data only.
     * The result classification such as Topic, Content/PDF, Memo, Group,
     * Timeline, Contents or Link is shown in the result list after matching.
     * It is not used as a pre-search condition.
     */
    return matchesKeyword(objectSearchText(obj), condition);
  }

  function labelFor(obj) {
    if (!obj) { return ''; }
    if (obj.label) { return obj.label; }
    if (obj.name) { return obj.name; }
    if (obj.title) { return obj.title; }
    if (obj.resource && (obj.resource.title || obj.resource.label)) { return obj.resource.title || obj.resource.label; }
    if (obj.type === 'Link') { return obj.role || obj.relation || 'Link'; }
    return obj.type || '';
  }

  function detailFor(obj) {
    var type;
    if (!obj) { return ''; }
    type = String(obj.type || '');
    if (type === 'Content') { return getContentKind(obj) || ''; }
    if (type === 'Link') { return [obj.role || obj.relation || '', obj.linkType || obj.groupType || '', obj.shape || ''].filter(Boolean).join(' / '); }
    if (type === 'PageMarker') { return obj.pageNumber ? ('p.' + obj.pageNumber) : ''; }
    if (type === 'contents') { return 'Contents'; }
    return '';
  }

  function resultFromObject(obj) {
    var id = obj && obj.id;
    return {
      id: id,
      target: obj,
      markerId: infoMarkerIdForTarget(obj),
      type: objectType(obj),
      label: labelFor(obj),
      detail: detailFor(obj),
      status: util && typeof util.isShown === 'function' && util.isShown(obj) ? 'visible' : 'hidden',
      openable: obj && obj.type === 'Content' && !!(obj.resource && (obj.resource.uri || obj.resource.canonicalUri))
    };
  }

  function search(condition) {
    var page = getCurrentPage();
    var objects = [];
    var results;
    condition = condition || readCondition();
    lastCondition = condition;
    applyFoundColorVariable();
    clearSearchMatch();
    if (!page) { return []; }
    objects = objects
      .concat(page.nodes || [])
      .concat(page.links || [])
      .concat(page.groups || []);
    results = objects.filter(function (obj) { return matchesObject(obj, condition); }).map(resultFromObject);
    resultMap = {};
    results.forEach(function (result) {
      resultMap[result.id] = result;
      if (result.target) {
        /*
         * Mark every matched object. Hidden or off-window objects may not have
         * a DOM element, but visible matched objects must all receive the same
         * search-match outline while the search results are shown.
         */
        result.target.searchMatch = true;
      }
    });
    render(condition, results);
    refreshDrawForSearchMatch();
    return results;
  }

  function refreshDrawForSearchMatch() {
    if (draw && typeof draw.refresh === 'function') {
      draw.refresh();
    }
    window.setTimeout(applySearchMatchClass, 0);
    window.setTimeout(applySearchMatchClass, 80);
    window.setTimeout(applySearchMatchClass, 250);
  }

  function clearSearchMatch() {
    var page = getCurrentPage();
    if (!page) { return; }
    (page.nodes || []).forEach(function (item) { delete item.searchMatch; });
    (page.links || []).forEach(function (item) { delete item.searchMatch; });
    (page.groups || []).forEach(function (item) { delete item.searchMatch; });
    removeFoundOutlines();
    applySearchMatchClass();
  }

  function getElementById(id) {
    if (!id || !document || typeof document.getElementById !== 'function') {
      return null;
    }
    return document.getElementById(id);
  }

  function removeFoundOutlines() {
    var items = document.querySelectorAll ? document.querySelectorAll('.search-found-outline') : [];
    Array.prototype.forEach.call(items, function (item) {
      if (item && item.parentNode) {
        item.parentNode.removeChild(item);
      }
    });
  }

  function nodeIsDisplayed(node) {
    if (!node) { return false; }
    if (util && typeof util.isShown === 'function') {
      return !!util.isShown(node);
    }
    return node.visible !== false && node.filterout !== true;
  }

  function finiteNumber(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function getNodeSvgBox(node) {
    var el;
    var box;
    if (!node || !node.id) { return null; }
    el = getElementById(node.id);
    if (!el || typeof el.getBBox !== 'function') { return null; }
    try {
      box = el.getBBox();
    }
    catch (ignore) {
      return null;
    }
    if (!box || !Number.isFinite(Number(box.x)) || !Number.isFinite(Number(box.y)) ||
      !Number.isFinite(Number(box.width)) || !Number.isFinite(Number(box.height)) ||
      Number(box.width) <= 0 || Number(box.height) <= 0) {
      return null;
    }
    return {
      x: Number(box.x),
      y: Number(box.y),
      width: Number(box.width),
      height: Number(box.height)
    };
  }

  function keepInformationMarkOnTop() {
    var circle = document.getElementById('Information');
    var canvas = document.getElementById('canvas');
    if (circle && canvas && circle.parentNode === canvas) {
      canvas.appendChild(circle);
    }
  }

  function appendFoundNodeOutline(canvas, node) {
    var size;
    var width;
    var height;
    var radius;
    var padding = 5;
    var shape;
    var outline;
    var box;
    var el;

    if (!canvas || !node || !node.searchMatch || !nodeIsDisplayed(node)) {
      return;
    }

    el = getElementById(node.id);

    /*
     * Prefer the actual rendered SVG bounding box.  getBBox() on a rendered
     * node group returns coordinates in that group's local coordinate system.
     * Therefore the outline must be appended to the same node group, not to
     * the root canvas.  Appending the local box to the root canvas causes the
     * visible offset that was seen around Content thumbnails and groups.
     */
    box = getNodeSvgBox(node);
    if (box && el) {
      outline = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      outline.setAttribute('x', String(box.x - padding));
      outline.setAttribute('y', String(box.y - padding));
      outline.setAttribute('width', String(box.width + padding * 2));
      outline.setAttribute('height', String(box.height + padding * 2));
      outline.setAttribute('rx', '8');
      outline.setAttribute('ry', '8');
    }
    else {
      if (!Number.isFinite(Number(node.x)) || !Number.isFinite(Number(node.y))) {
        return;
      }
      size = node.size || {};
      width = finiteNumber(size.width, finiteNumber(node.width, 80));
      height = finiteNumber(size.height, finiteNumber(node.height, 50));
      radius = finiteNumber(size.radius, Math.max(width, height) / 2);
      shape = String(node.shape || '').toUpperCase();

      if (shape === 'CIRCLE') {
        outline = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        outline.setAttribute('cx', String(Number(node.x)));
        outline.setAttribute('cy', String(Number(node.y)));
        outline.setAttribute('r', String(radius + padding));
      }
      else {
        outline = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        outline.setAttribute('x', String(Number(node.x) - width / 2 - padding));
        outline.setAttribute('y', String(Number(node.y) - height / 2 - padding));
        outline.setAttribute('width', String(width + padding * 2));
        outline.setAttribute('height', String(height + padding * 2));
        if (shape === 'ROUNDED' || shape === 'ELLIPSE') {
          outline.setAttribute('rx', String(Math.min(16, (width + padding * 2) / 2)));
          outline.setAttribute('ry', String(Math.min(16, (height + padding * 2) / 2)));
        }
      }
    }

    outline.setAttribute('class', 'search-found-outline');
    outline.setAttribute('fill', 'none');
    outline.setAttribute('stroke', getFoundColor());
    outline.setAttribute('stroke-width', '4');
    outline.setAttribute('pointer-events', 'none');

    if (box && el) {
      /* Keep the marker in node-local coordinates.  Insert it first so that
       * it acts as an outline behind the node content but remains visible
       * outside the actual shape.
       */
      el.insertBefore(outline, el.firstChild || null);
    }
    else {
      canvas.appendChild(outline);
    }
  }

  function appendFoundLinkOutline(canvas, link) {
    /*
     * Link outlines are primarily handled by the search-match class.  This
     * helper intentionally does not draw a duplicate path because link routing
     * can use several internal SVG forms.
     */
    return;
  }

  function renderFoundOutlines(page) {
    var canvas = document.getElementById('canvas');
    removeFoundOutlines();
    if (!page || !canvas || !document.createElementNS) {
      return;
    }
    (page.nodes || []).forEach(function (node) {
      appendFoundNodeOutline(canvas, node);
    });
    (page.links || []).forEach(function (link) {
      appendFoundLinkOutline(canvas, link);
    });
  }

  function applySearchMatchClass() {
    var page = getCurrentPage();
    applyFoundColorVariable();
    if (!page) { return; }

    /*
     * Use D3 data binding where possible instead of relying only on
     * document.getElementById().  Some rendered SVG groups can be recreated
     * during refresh; classing by bound datum ensures every visible matched
     * node/link receives the YellowGreen search outline while results are
     * displayed.
     */
    if (typeof d3 !== 'undefined') {
      d3.selectAll('g.node').classed('search-match', function (d) {
        return !!(d && d.searchMatch);
      });
      d3.selectAll('g.link').classed('search-match', function (d) {
        return !!(d && d.searchMatch);
      });
    }

    (page.nodes || []).forEach(function (node) {
      var el = getElementById(node && node.id);
      if (el && el.classList) {
        el.classList.toggle('search-match', !!node.searchMatch);
      }
    });

    (page.links || []).forEach(function (link) {
      var el = getElementById(link && link.id);
      if (el && el.classList) {
        el.classList.toggle('search-match', !!link.searchMatch);
      }
    });

    renderFoundOutlines(page);
    keepInformationMarkOnTop();
  }

  function reapplySearchMatch() {
    applySearchMatchClass();
  }

  function scheduleReapplySearchMatch() {
    window.setTimeout(applySearchMatchClass, 0);
    window.setTimeout(applySearchMatchClass, 80);
    window.setTimeout(applySearchMatchClass, 250);
  }

  function isContentPageMarker(target) {
    return !!(target && (
      target.type === 'PageMarker' ||
      target.topicKind === 'contents-page'
    ));
  }

  function openInfo(id) {
    var result = resultMap[id];
    var target = result && result.target;
    if (!target) { return; }
    setInfoTarget(target);
    if (target.type === 'Link') {
      wuwei.info.open({ link: target });
      scheduleReapplySearchMatch();
      return;
    }
    if (isContentPageMarker(target) &&
      wuwei.menu && wuwei.menu.contents &&
      typeof wuwei.menu.contents.openContentTargetInInfo === 'function') {
      wuwei.menu.contents.openContentTargetInInfo(target);
      scheduleReapplySearchMatch();
      return;
    }
    if (wuwei.info && typeof wuwei.info.open === 'function') {
      wuwei.info.open(target, target.resource || null);
      scheduleReapplySearchMatch();
    }
  }

  function openTarget(id, mode) {
    var result = resultMap[id];
    var target = result && result.target;
    var resource = target && target.resource;
    var uri = resource && (resource.canonicalUri || resource.uri);
    var features;
    if (!uri) { return; }

    if (mode === 'window') {
      features = 'noopener,width=1200,height=900,menubar=yes,toolbar=yes,location=yes,resizable=yes,scrollbars=yes';
      window.open(uri, 'wuwei_resource_window', features);
      return;
    }

    window.open(uri, '_blank', 'noopener');
  }

  function render(condition, results) {
    var host = document.getElementById('search-this_note');
    if (!host) { return; }
    host.innerHTML = ns.markup.template({ condition: condition || {}, results: results || [] });
    bindEvents();
    updateInfoResultClass();
  }

  function bindEvents() {
    var searchButton = document.getElementById('search-button');
    var showAllButton = document.getElementById('show-page-all-button');
    var host = document.getElementById('search-this_note');

    if (searchButton) {
      searchButton.addEventListener('click', function (ev) {
        ev.preventDefault();
        search(readCondition());
      });
    }
    if (showAllButton) {
      showAllButton.addEventListener('click', function (ev) {
        ev.preventDefault();
        if (wuwei.filter && typeof wuwei.filter.showAllPageData === 'function') {
          wuwei.filter.showAllPageData();
        }
      });
    }
    if (host) {
      host.addEventListener('click', function (ev) {
        var info = ev.target.closest && ev.target.closest('.search-info');
        var openTab = ev.target.closest && ev.target.closest('.search-open-tab');
        var openWindow = ev.target.closest && ev.target.closest('.search-open-window');
        if (info) {
          ev.preventDefault();
          openInfo(info.getAttribute('data-result-id'));
        }
        if (openTab) {
          ev.preventDefault();
          openTarget(openTab.getAttribute('data-result-id'), 'tab');
        }
        if (openWindow) {
          ev.preventDefault();
          openTarget(openWindow.getAttribute('data-result-id'), 'window');
        }
      });
    }
  }

  function open(mode) {
    var host = document.getElementById('search-this_note');
    if (!host) { return; }
    host.style.display = 'block';
    applyInformationColorVariable();
    render(lastCondition || {}, []);
    if (mode === 'filter') {
      var input = document.getElementById('search-text');
      if (input) { input.focus(); }
    }
  }

  function close() {
    var host = document.getElementById('search-this_note');
    if (host) { host.style.display = 'none'; }
    clearInfoTarget();
    clearSearchMatch();
  }

  function initModule() {}

  ns.showInfo = openInfo;
  ns.searchNode = search;
  ns.search = search;
  ns.matchesObject = matchesObject;
  ns.readCondition = readCondition;
  ns.open = open;
  ns.close = close;
  ns.initModule = initModule;
  ns.clearSearchMatch = clearSearchMatch;
  ns.reapplySearchMatch = reapplySearchMatch;
  ns.applySearchMatchClass = applySearchMatchClass;
  ns.setInfoTarget = setInfoTarget;
  ns.clearInfoTarget = clearInfoTarget;
  return ns;
})(wuwei.search.this_note || {});
// search.this_note.js
