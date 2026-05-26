/**
 * info.admin.js
 * Admin pane controller
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 **/
wuwei.info = wuwei.info || {};
wuwei.info.admin = wuwei.info.admin || {};

(function (ns) {
  'use strict';

  const
    common = wuwei.common,
    model = wuwei.model,
    util = wuwei.util;

  function getCurrentPage() {
    return common && common.current ? common.current.page : null;
  }

  function getCurrentGraph() {
    return common ? common.graph : null;
  }

  function getCurrentUserRole() {
    if (wuwei.auth && typeof wuwei.auth.getCurrentUserRole === 'function') {
      return wuwei.auth.getCurrentUserRole();
    }
    return String((common && common.state && common.state.currentUser && common.state.currentUser.role) || '');
  }

  function canOpen() {
    return getCurrentUserRole() === 'admin';
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function isPlainObject(value) {
    return !!(value && typeof value === 'object' && !Array.isArray(value));
  }

  function safeStringify(value) {
    var seen = [];
    try {
      return JSON.stringify(value, function (key, val) {
        if (typeof val === 'function') {
          return '[Function]';
        }
        if (val && typeof val === 'object') {
          if (seen.indexOf(val) >= 0) {
            return '[Circular]';
          }
          seen.push(val);
        }
        return val;
      }, 2);
    }
    catch (e) {
      return String(e && e.message ? e.message : e);
    }
  }

  function valueAtPath(obj, path) {
    return String(path || '').split('.').reduce(function (acc, key) {
      if (!acc || typeof acc !== 'object') {
        return undefined;
      }
      return acc[key];
    }, obj);
  }

  function rowHtml(label, value) {
    var text;
    if (typeof value === 'undefined') {
      text = '';
    }
    else if (value === null) {
      text = 'null';
    }
    else if (typeof value === 'object') {
      text = Array.isArray(value) ? 'Array(' + value.length + ')' : 'Object';
    }
    else {
      text = String(value);
    }
    return '<tr><th>' + escapeHtml(label) + '</th><td>' + escapeHtml(text) + '</td></tr>';
  }

  function tableHtml(rows) {
    return '<table><tbody>' + rows.join('') + '</tbody></table>';
  }

  function detailsHtml(title, body, open) {
    return '<details' + (open ? ' open' : '') + '><summary>' + escapeHtml(title) + '</summary>' + body + '</details>';
  }

  function preJsonHtml(value) {
    return '<pre>' + escapeHtml(safeStringify(value)) + '</pre>';
  }

  function findPageNodeById(id) {
    var page = getCurrentPage();
    var nodes = page && Array.isArray(page.nodes) ? page.nodes : [];
    var i;
    for (i = 0; i < nodes.length; i += 1) {
      if (nodes[i] && nodes[i].id === id) {
        return nodes[i];
      }
    }
    return null;
  }

  function findPageLinkById(id) {
    var page = getCurrentPage();
    var links = page && Array.isArray(page.links) ? page.links : [];
    var i;
    for (i = 0; i < links.length; i += 1) {
      if (links[i] && links[i].id === id) {
        return links[i];
      }
    }
    return null;
  }

  function findGraphNodeById(id) {
    var graph = getCurrentGraph();
    var nodes = graph && Array.isArray(graph.nodes) ? graph.nodes : [];
    var i;
    for (i = 0; i < nodes.length; i += 1) {
      if (nodes[i] && nodes[i].id === id) {
        return nodes[i];
      }
    }
    return null;
  }

  function findGraphLinkById(id) {
    var graph = getCurrentGraph();
    var links = graph && Array.isArray(graph.links) ? graph.links : [];
    var i;
    for (i = 0; i < links.length; i += 1) {
      if (links[i] && links[i].id === id) {
        return links[i];
      }
    }
    return null;
  }

  function findSvgElementSummary(id) {
    var el;
    var bbox = null;
    var result;

    if (!id || typeof document === 'undefined') {
      return null;
    }

    el = document.getElementById(id);
    if (!el) {
      return null;
    }

    try {
      if (typeof el.getBBox === 'function') {
        bbox = el.getBBox();
      }
    }
    catch (e) {
      bbox = null;
    }

    result = {
      tagName: el.tagName,
      id: el.id || '',
      className: String(el.getAttribute('class') || ''),
      childElementCount: el.childElementCount || 0
    };

    if (bbox) {
      result.bbox = {
        x: Number(bbox.x),
        y: Number(bbox.y),
        width: Number(bbox.width),
        height: Number(bbox.height)
      };
    }

    return result;
  }

  function resolveTarget(target) {
    if (!target || !target.id) {
      return target || null;
    }
    if (util && typeof util.isLink === 'function' &&
        util.isLink(target) &&
        model && typeof model.findLinkById === 'function') {
      return model.findLinkById(target.id) || target;
    }
    if (model && typeof model.findNodeById === 'function') {
      return model.findNodeById(target.id) || target;
    }
    return target;
  }

  function resolveAdminTarget(target) {
    var pageNode, pageLink, graphNode, graphLink, group, graphTarget;

    if (!target || !target.id) {
      return {
        inputTarget: target || null,
        targetKind: target && target.type ? String(target.type) : '',
        pageRecord: target || null,
        graphRecord: target || null,
        svgRecord: target && target.id ? findSvgElementSummary(target.id) : null
      };
    }

    pageNode = findPageNodeById(target.id);
    pageLink = findPageLinkById(target.id);
    graphNode = findGraphNodeById(target.id);
    graphLink = findGraphLinkById(target.id);
    group = (model && typeof model.findGroupById === 'function') ? model.findGroupById(target.id) : null;

    graphTarget = graphNode || graphLink || target;
    if (!group && target.groupRef && model && typeof model.findGroupById === 'function') {
      group = model.findGroupById(target.groupRef);
    }

    return {
      inputTarget: target,
      targetKind: pageNode ? 'node' : (pageLink ? 'link' : (group ? 'group' : (graphLink ? 'pseudo-link' : (graphNode ? 'graph-node' : String(target.type || 'unknown'))))),
      pageRecord: pageNode || pageLink || group || null,
      graphRecord: graphTarget || null,
      groupRecord: group || null,
      svgRecord: findSvgElementSummary(target.id)
    };
  }

  function collectValidationMessages(ctx) {
    var messages = [];
    var page = getCurrentPage();
    var pageNodes = page && Array.isArray(page.nodes) ? page.nodes : [];
    var pageLinks = page && Array.isArray(page.links) ? page.links : [];
    var record = ctx.pageRecord || ctx.inputTarget;
    var resource = record && record.resource;
    var original;
    var storageFiles;

    pageNodes.forEach(function (n) {
      if (n && n.pseudo) {
        messages.push({ level: 'warning', message: 'pseudo node exists in current.page.nodes[]: ' + (n.id || '') });
      }
    });

    pageLinks.forEach(function (l) {
      if (l && l.pseudo) {
        messages.push({ level: 'warning', message: 'pseudo link exists in current.page.links[]: ' + (l.id || '') });
      }
    });

    if (resource && typeof resource === 'object') {
      if (Object.prototype.hasOwnProperty.call(resource, 'contents')) {
        messages.push({ level: 'warning', message: 'legacy resource.contents remains; new data should use resource.viewpoint.' });
      }
      ['uri', 'canonicalUri', 'thumbnailUri', 'title'].forEach(function (key) {
        if (Object.prototype.hasOwnProperty.call(resource, key)) {
          messages.push({ level: 'warning', message: 'legacy resource.' + key + ' remains in this resource.' });
        }
      });

      original = isPlainObject(resource.original) ? resource.original : null;
      storageFiles = resource.storage && Array.isArray(resource.storage.files) ? resource.storage.files : [];

      if (resource.source === 'upload') {
        if (!original || original.type !== 'upload' || !original.storageRole) {
          messages.push({ level: 'warning', message: 'upload resource should define resource.original.type="upload" and storageRole.' });
        }
        if (!storageFiles.some(function (f) { return f && f.role === ((original && original.storageRole) || 'original'); })) {
          messages.push({ level: 'warning', message: 'upload resource original storage file was not found.' });
        }
      }

      if (resource.source === 'remote') {
        if (!original || original.type !== 'remote' || !original.url) {
          messages.push({ level: 'warning', message: 'remote resource should define resource.original.type="remote" and url.' });
        }
      }
    }

    if (ctx.graphRecord && ctx.graphRecord.pseudo && ctx.pageRecord && ctx.pageRecord.id === ctx.graphRecord.id) {
      messages.push({ level: 'warning', message: 'pseudo graph record appears to have a same-id page record.' });
    }

    if (!messages.length) {
      messages.push({ level: 'ok', message: 'No diagnostic warnings detected.' });
    }

    return messages;
  }

  function buildAdminSummary(ctx) {
    var target = ctx.inputTarget || {};
    var record = ctx.pageRecord || target;
    var resource = record && record.resource;
    var rows = [];

    rows.push(rowHtml('target kind', ctx.targetKind || ''));
    rows.push(rowHtml('id', target.id || (record && record.id) || ''));
    rows.push(rowHtml('type', target.type || (record && record.type) || ''));
    rows.push(rowHtml('label', (record && record.label) || target.label || ''));
    rows.push(rowHtml('resource.source', valueAtPath(record, 'resource.source')));
    rows.push(rowHtml('resource.kind', valueAtPath(record, 'resource.kind')));
    rows.push(rowHtml('resource.documentKind', valueAtPath(record, 'resource.documentKind')));
    rows.push(rowHtml('resource.videoKind', valueAtPath(record, 'resource.videoKind')));
    rows.push(rowHtml('resource.viewpoint', valueAtPath(record, 'resource.viewpoint')));
    rows.push(rowHtml('groupRef', target.groupRef || (record && record.groupRef) || ''));
    rows.push(rowHtml('pseudo', !!(target.pseudo || (ctx.graphRecord && ctx.graphRecord.pseudo))));
    rows.push(rowHtml('page record', ctx.pageRecord ? 'found' : 'not found'));
    rows.push(rowHtml('graph record', ctx.graphRecord ? 'found' : 'not found'));
    rows.push(rowHtml('svg record', ctx.svgRecord ? 'found' : 'not found'));

    if (resource) {
      rows.push(rowHtml('original.url', valueAtPath(record, 'resource.original.url')));
      rows.push(rowHtml('original.canonicalUrl', valueAtPath(record, 'resource.original.canonicalUrl')));
      rows.push(rowHtml('storage.files', valueAtPath(record, 'resource.storage.files')));
    }

    return tableHtml(rows);
  }

  function buildValidationHtml(messages) {
    return '<ul>' + messages.map(function (item) {
      var cls = item.level === 'ok' ? 'admin-validation-ok' : 'admin-validation-warn';
      return '<li class="' + cls + '">' + escapeHtml(item.message) + '</li>';
    }).join('') + '</ul>';
  }

  function appendAdminContainer(infoPane) {
    if (!infoPane || document.getElementById('info-admin')) {
      return;
    }
    if (ns.markup && typeof ns.markup.container === 'function') {
      infoPane.insertAdjacentHTML('beforeend', ns.markup.container());
    }
    else {
      infoPane.insertAdjacentHTML('beforeend', '<div id="info-admin"></div>');
    }
  }

  function setPaneTitle() {
    var icon = document.getElementById('infoPaneTitleIcon');
    var text = document.getElementById('infoPaneTitleText');

    if (icon) {
      icon.className = ns.markup && typeof ns.markup.iconClass === 'function'
        ? ns.markup.iconClass()
        : 'fas fa-tools fa-lg fa-fw';
    }
    if (text) {
      text.textContent = ns.markup && typeof ns.markup.titleText === 'function'
        ? ns.markup.titleText()
        : '管理(Admin)ペイン';
    }
  }

  function ensureInfoRoot() {
    var infoPane = document.getElementById('info');

    if (!infoPane) {
      return null;
    }

    if (wuwei.info && wuwei.info.markup && typeof wuwei.info.markup.template === 'function') {
      infoPane.innerHTML = wuwei.info.markup.template();
    }

    appendAdminContainer(infoPane);
    setPaneTitle();
    infoPane.style.display = 'block';

    return infoPane;
  }

  function open(target, option) {
    var infoPane;
    var adminPane;
    var resolvedTarget;
    var ctx;
    var messages;
    var html = [];

    if (!canOpen()) {
      if (window.console && console.warn) {
        console.warn('管理(Admin)ペイン is available only for admin users.');
      }
      return false;
    }

    if (wuwei.info && typeof wuwei.info.closeEditPaneForInfo === 'function') {
      wuwei.info.closeEditPaneForInfo();
    }

    infoPane = ensureInfoRoot();
    if (!infoPane) {
      return false;
    }

    resolvedTarget = resolveTarget(target) || target;
    ctx = resolveAdminTarget(resolvedTarget || target || {});
    messages = collectValidationMessages(ctx);

    if (ctx.pageRecord && ctx.pageRecord.id) {
      infoPane.dataset.node_id = ctx.pageRecord.id;
    }
    else if (ctx.graphRecord && ctx.graphRecord.id) {
      infoPane.dataset.node_id = ctx.graphRecord.id;
    }

    if (wuwei.info && typeof wuwei.info.showInfoPane === 'function') {
      wuwei.info.showInfoPane('info-admin');
    }
    else {
      adminPane = document.getElementById('info-admin');
      if (adminPane) {
        adminPane.style.display = 'block';
      }
    }

    adminPane = document.getElementById('info-admin');
    if (!adminPane) {
      return false;
    }

    html.push('<div class="admin-diagnostic-pane">');
    html.push('<div class="admin-title"><i class="fas fa-tools fa-fw"></i> 管理(Admin)ペイン</div>');
    html.push(detailsHtml('Summary', buildAdminSummary(ctx), true));
    html.push(detailsHtml('Validation', buildValidationHtml(messages), true));
    html.push(detailsHtml('current.page record', preJsonHtml(ctx.pageRecord), true));
    html.push(detailsHtml('graph record', preJsonHtml(ctx.graphRecord), false));
    html.push(detailsHtml('group record', preJsonHtml(ctx.groupRecord), false));
    html.push(detailsHtml('SVG element', preJsonHtml(ctx.svgRecord), false));
    html.push(detailsHtml('input target', preJsonHtml(ctx.inputTarget), false));
    html.push('</div>');

    adminPane.innerHTML = html.join('\n');
    return true;
  }

  ns.open = open;
  ns.canOpen = canOpen;
  ns.resolveAdminTarget = resolveAdminTarget;
  ns.collectValidationMessages = collectValidationMessages;
})(wuwei.info.admin);
