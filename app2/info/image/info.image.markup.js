/**
 * info.image.markup.js
 * wuwei info.image template
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.info = wuwei.info || {};
wuwei.info.image = wuwei.info.image || {};

wuwei.info.image.markup = (function () {
  'use strict';

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function t(str) {
    return wuwei.nls.translate(str);
  }

  function rowcount(str) {
    return wuwei.info.markup.rowcount(str || '');
  }

  function shouldRenderDescription(description) {
    var role, format;
    if (!description || typeof description !== 'object') {
      return false;
    }
    if (wuwei.info && typeof wuwei.info.shouldRenderInfoDescription === 'function') {
      return wuwei.info.shouldRenderInfoDescription(description);
    }
    role = String(description.role || 'original').toLowerCase();
    format = String(description.format || 'plain/text').toLowerCase();
    if (role !== 'original') {
      return true;
    }
    return format === 'plain' || format === 'text' || format === 'txt' ||
      format === 'plain/text' || format === 'text/plain';
  }

  function renderDescription(description) {
    var format;
    var body;
    var html;
    if (!shouldRenderDescription(description)) {
      return '';
    }
    format = String(description.format || 'plain/text').toLowerCase();
    body = String(description.body || '');
    if (!body.trim()) {
      return '';
    }
    if ((format.indexOf('asciidoc') >= 0 || format === 'adoc') &&
      wuwei.util && typeof wuwei.util.renderAsciiDoc === 'function') {
      try {
        html = wuwei.util.renderAsciiDoc(body, { showtitle: false, allowHtml: true });
      }
      catch (e) {
        html = '';
      }
    }
    if (!html) {
      html = '<p>' + escapeHtml(body).replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>') + '</p>';
    }
    return html;
  }

  function resourceUrlByRole(node, role) {
    if (wuwei.resource && typeof wuwei.resource.getRuntimeUrl === 'function') {
      return wuwei.resource.getRuntimeUrl(node, role || 'original') || '';
    }
    return '';
  }

  function nonEmptyRow(label, value) {
    if (value == null || String(value).trim() === '') {
      return '';
    }
    return '<dt>' + t(label) + '</dt><dd>' + escapeHtml(value) + '</dd>';
  }

  function getReferenceUrl(resource) {
    resource = resource || {};
    if (resource.original && typeof resource.original === 'object') {
      return resource.original.url || resource.original.sourceUrl || '';
    }
    return resource.uri || '';
  }

  function getCanonicalUrl(resource) {
    resource = resource || {};
    if (resource.original && typeof resource.original === 'object') {
      return resource.original.canonicalUrl || resource.original.canonicalUri || '';
    }
    return resource.canonicalUri || '';
  }

  function metadataRows(node, resource, src) {
    var rights = (resource && resource.rights && typeof resource.rights === 'object') ? resource.rights : {};

    /*
     * The image information pane shows the same descriptive metadata that used
     * to be shown in the image edit pane Content tab, but it intentionally hides
     * display-only / runtime fields:
     * - image preview / thumbnail
     * - Runtime URL
     * - Original URL
     * - Preview URL
     * - width / height
     */
    return [
      '<dl class="info-image-metadata">',
      nonEmptyRow('Source', resource.source || ''),
      nonEmptyRow('Media type', resource.kind || 'image'),
      nonEmptyRow('Image kind', resource.imageKind || ''),
      nonEmptyRow('Title', resource.title || ''),
      nonEmptyRow('MIME', resource.mimeType || ''),
      rights.owner ? '<dt>' + t('Owner') + '</dt><dd>' + escapeHtml(rights.owner) + '</dd>' : '',
      rights.license ? '<dt>' + t('License') + '</dt><dd>' + escapeHtml(rights.license) + '</dd>' : '',
      rights.attribution ? '<dt>' + t('Credit') + '</dt><dd>' + escapeHtml(rights.attribution) + '</dd>' : '',
      '</dl>'
    ].join('\n');
  }

  function template(param) {
    var node = param.node;
    var resource = param.resource || {};
    var src = param.src || '';
    var title = (node && node.label) || resource.title || src || 'Image';
    var descriptionHtml = renderDescription(node && node.description);
    var html = [];

    html.push(
      '<div class="info image-info">',
      '<h5 id="label" rows="' + rowcount(title) + '">' + escapeHtml(title) + '</h5>'
    );
    html.push(metadataRows(node, resource, src));
    if (descriptionHtml) {
      html.push('<div class="w3-container image-description rich-description">' + descriptionHtml + '</div>');
    }
    html.push('</div>');
    return html.join('\n');
  }

  return { template: template };
})();
// info.image.markup.js
