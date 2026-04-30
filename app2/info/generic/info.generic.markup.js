/**
 * info.generic.markup.js
 * wuwei info.generic template
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2013-2020,2023,2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 **/
wuwei.info = wuwei.info || {};
wuwei.info.generic = wuwei.info.generic || {};
wuwei.info.generic.markup = (function () {
  const template = function (param) {
    let
      node = param.node;
    const util = wuwei.util;
    let uri = resolveInfoUri(node);
    let label = node.label || '';
    let value = '';
    let fontSize = (node.style && node.style.font && node.style.font.size) || 14;
    let fontClass = 'font-size-M';
    let thumbnailUri = resolveThumbnailUri(node);
    if ('string' === typeof node.value) {
      value = node.value;
    }
    else if (node.value && 'object' === typeof node.value && 'string' === typeof node.value.comment) {
      value = node.value.comment;
    }
    let width, height;
    if ('object' === typeof node.size && node.size.width) {
      width = +node.size.width;
      height = +node.size.height;
      height = 256 * height / width;
      width = 256;
    }
    var html = `
<!--Card-->
<div class="info">
  <!--Card image-->
  ${'Memo' !== node.type && label
        ? `<div class="w3-row info-title-wrap">
        <h5 id="rName" name="label" data-path="label" class="w3-col s12 info-title"></h5>
      </div>`
        : ''
      }
  ${uri
      ? `<iframe id="infoFrame"
          src="${wuwei.util.encodeHtml(uri)}"
          data-resource-uri="${wuwei.util.encodeHtml(uri)}"
          onload="this.dataset.loaded='1'"
          onerror="wuwei.info.iframeError()"
          style="display:block; width:100%; min-height:768px; border:none; overflow:auto; box-sizing:border-box;"></iframe>
        <div class="iframe-fallback" style="display:none;">
          ${translate('This site refused to be displayed in an iframe.')}
          <br><a href="${wuwei.util.encodeHtml(uri)}" target="_blank" rel="noopener noreferrer">${wuwei.util.encodeHtml(uri)}</a>
        </div>
        <div class="link" onclick="window.open('${uri}', 'wuwei', 'width=600,height=400')">
          ${translate('Click to open window')}<i class="fas fa-external-link-alt"></i>
        </div>`
      : (thumbnailUri
        ? `<div class="frame">
            <img src="${wuwei.util.encodeHtml(thumbnailUri)}"
              style="display:block; max-width:100%; height:auto;"
              ${uri
                ? `onclick="window.open('${uri}', 'wuwei', 'width=600,height=400')"`
                : ''
              }>
          </div>`
        : '')
  }
  <!--/.Card image-->
  <div class="w3-container ${fontClass}" style="font-size:${Number(fontSize) || 14}px;">
      <!--Card content-->
      ${value
        ? `<p class="value">${wuwei.util.encodeHtml(
            String(value).replace(/\\n/g, '\n')
          )}</p>`
        : ``
      }
    </div>
  <!--/.Card content-->
</div>
<!--/.Card-->
`;
    return html;
  };

  function translate(str) {
    return wuwei.nls.translate(str);
  }

  function resolveInfoUri(node) {
    var util = wuwei.util || {};
    var resource = util.getResource && util.getResource(node);
    var viewer = (resource && resource.viewer && 'object' === typeof resource.viewer) ? resource.viewer : {};
    var embed = (viewer.embed && 'object' === typeof viewer.embed) ? viewer.embed : {};
    var uri = '';

    if (resource && util.getResourceFileUri) {
      uri = util.getResourceFileUri(resource, 'preview', node) ||
        util.getResourceFileUri(resource, 'original', node);
    }
    if (uri) {
      return uri;
    }

    // Current model: external references are represented as normal URLs.
    uri = String(embed.uri || (resource && (resource.uri || resource.canonicalUri)) || '').trim();
    if (/^https?:\/\//i.test(uri) && uri.indexOf('/wu_wei2/') < 0) {
      return uri;
    }
    return '';
  }

  function resolveThumbnailUri(node) {
    var util = wuwei.util || {};
    var resource = util.getResource && util.getResource(node);
    if (resource && util.getResourceFileUri) {
      return util.getResourceFileUri(resource, 'thumbnail', node) || '';
    }
    return '';
  }

  function iframe_error() {
    setTimeout(function () {
      document.getElementById('info_iframe').classList.add('d-none');
    }, 1000);
  }

  return {
    template: template
  };
})();
// info.generic.markup.js last modified 2026-03-28
