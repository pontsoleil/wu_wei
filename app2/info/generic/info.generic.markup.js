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
      node = param.node,
      base_url = location.href.substr(0, location.href.lastIndexOf('/'));
    const util = wuwei.util;
    let uri = util.getResourceUri(node);
    let label = node.label || '';
    let value = '';
    let fontSize = (node.style && node.style.font && node.style.font.size) || 14;
    let fontClass = 'font-size-M';
    let thumbnailUri = util.getThumbnailUri(node);
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
    if (uri) {
      uri = uri.toLowerCase().indexOf('pdf') > 0 && uri.toLowerCase().indexOf('http') < 0
        ? `${base_url}/pdf.js/web/viewer.html?file=${base_url}/${uri}`
        : uri.match(/upload\/[0-9a-fA-F]{8}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{12}\/[0-9]{4}\/[0-9]{2}\/.*.docx/) ||
          uri.match(/upload\/[0-9a-fA-F]{8}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{12}\/[0-9]{4}\/[0-9]{2}\/.*.pptx/) ||
          uri.match(/upload\/[0-9a-fA-F]{8}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{12}\/[0-9]{4}\/[0-9]{2}\/.*.xlsx/)
          ? 'https://view.officeapps.live.com/op/view.aspx?src=https%3A%2F%2Fwww.wuwei.space%2Fwu_wei2%2F' + encodeURIComponent(uri)
          : uri;
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
