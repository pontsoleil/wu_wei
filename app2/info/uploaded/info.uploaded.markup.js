/**
 * info.uploaded.markup.js
 * wuwei info.uploaded template
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2013-2019, 2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.info = wuwei.info || {};
wuwei.info.uploaded = wuwei.info.uploaded || {};
wuwei.info.uploaded.markup = ( function () {
  const template = function( param ) {
    let
      node = param.node,
      option = param.option;
    const
      common = wuwei.common,
      lang = common.nls.LANG,
      value = node.value,
      creativeCommons = common.nls.creativeCommons[lang],
      base_url = location.href.substr(0, location.href.lastIndexOf('/'));
    let uri = (node && node.resource && node.resource.uri) || "";
    let label = (node && node.label) || "";
    let size;
    let width, height;
    if (node && !!node.size) {
      size = node.size;
      width = size.width;
      height = size.height;
    } else {
      width = null; height = null;
    }
    if ('upload' !== node.option) {
      return '';
    }
    if (uri) {
      uri = uri.toLowerCase().indexOf('pdf') > 0 && uri.toLowerCase().indexOf('http') < 0
      ? `${base_url}/${uri}`
      : uri.match(/upload\/[0-9a-fA-F]{8}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{12}\/[0-9]{4}\/[0-9]{2}\/.*.docx/) ||
        uri.match(/upload\/[0-9a-fA-F]{8}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{12}\/[0-9]{4}\/[0-9]{2}\/.*.pptx/) ||
        uri.match(/upload\/[0-9a-fA-F]{8}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{12}\/[0-9]{4}\/[0-9]{2}\/.*.xlsx/)
        ? 'https://view.officeapps.live.com/op/view.aspx?src=https%3A%2F%2Fwww.wuwei.space%2Fwu_wei2%2F' + encodeURIComponent(uri)
        : uri;
    }
    var html = `
<form id="infoform" class="form-group info">
  ${label
    ? `<div class="w3-row">
        <textarea id="rName" name="label" data-path="label" class="w3-col s12" rows="${rowcount(label)}" 
            placeholder="${translate('Label')}" disabled>${label}</textarea>
      </div>`
    : ''
  }
  ${uri
    ? `<iframe id="infoFrame" onerror="wuwei.info.iframeError()" src="${encodeURI(uri)}"
        style="width:100%; min-height:480px; border:none; overflow:auto;"></iframe>`
    : ``
  }
  ${uri
    ? `<span class="player w3-row" onclick="wuwei.info.openWindow('${uri}', 'wuwei', 'width=600, height=400')">
        ${translate('Click to open window')}<i class="fas fa-external-link-alt"></i>
      </span>`
    : ``
  }
  ${node.value && 'string' === typeof node.value && node.value.length > 0
    ? `<div class="w3-row">
        <textarea id="rValue" name="description.body" data-path="description.body" class="w3-col s12" rows="${rowcount(node.value)}"
            placeholder="${translate('Comment')}" disabled>${toText(node.value)}</textarea>
      </div>`
    : ''
  }
</form>
`;
    return html;
  };

  function toText(str) {
    str = str.replace(/\n/gi, "");
    str = str.replace(/<br\s*[\/]?>/gi, "\n");
    return str;
  }

  function rowcount(str) {
    return wuwei.info.markup.rowcount(str);
  }

  function translate(str) {
    return wuwei.info.markup.translate(str);
  }

  return {
    template: template
  };
} ());
// info.uploaded.markup.js last modified 2026-04-20
