/**
 * menu.setting.template.js
 * menu.setting template
 *
 * WuWei is a free to use open source knowledge modeling tool.
 * More information on WuWei can be found on WuWei homepage.
 * https://www.wuwei.space/blog/
 *
 * WuWei is licensed under the MIT License
 * Copyright (c) 2013-2020, Nobuyuki SAMBUICHI
 **/
wuwei.menu.setting.markup = ( function () {
  function optionList(options, value) {
    return (options || []).map(function (option) {
      var optionValue = String(option && option.value || '');
      return '<option value="' + optionValue + '"' + (String(value || '') === optionValue ? ' selected' : '') + '>' +
        String(option && option.label || optionValue) + '</option>';
    }).join('');
  }

  function fontSizeValue(value) {
    if (Number.isFinite(Number(value))) {
      return String(Number(value)) + 'pt';
    }
    return value || '12pt';
  }

  function topicDefaultStyleRows() {
    var common = wuwei.common || {};
    var current = common.current || {};
    var noteStyle = (current.noteStyle && typeof current.noteStyle === 'object') ? current.noteStyle : {};
    var nodeStyle = (noteStyle.topic && typeof noteStyle.topic === 'object')
      ? noteStyle.topic
      : ((noteStyle.node && typeof noteStyle.node === 'object') ? noteStyle.node : {});
    var base = (common.defaultStyle && common.defaultStyle.topic) || {};
    var style = {
      fill: nodeStyle.fill || base.fill || '#FFFFF0',
      font: Object.assign({}, base.font || common.defaultFont || {}, nodeStyle.font || {}),
      line: Object.assign({}, base.line || {}, nodeStyle.line || {})
    };
    var fontAlignOptions = [
      { value: 'left', label: translate('left') },
      { value: 'center', label: translate('center') },
      { value: 'right', label: translate('right') }
    ];

    return `
    <div class="force note-default-style">
      <p><label>${translate('Topic default style')}</label></p>
      <label>
        ${translate('Background')}
        <input type="color" id="noteDefaultFill" value="${style.fill}">
        <div id="noteDefaultFillPalette" class="note-default-color-palette"></div>
      </label>
      <label>
        ${translate('Text')}
        <input type="color" id="noteDefaultFontColor" value="${style.font.color || '#303030'}">
        <div id="noteDefaultFontColorPalette" class="note-default-color-palette"></div>
        <select id="noteDefaultFontSize">${optionList(common.fontSizes, fontSizeValue(style.font.size))}</select>
      </label>
      <label>
        ${translate('Font')}
        <input type="text" id="noteDefaultFontFamily" value="${style.font.family || 'sans-serif'}">
      </label>
      <label>
        ${translate('align')}
        <select id="noteDefaultFontAlign">${optionList(fontAlignOptions, style.font.align || 'center')}</select>
      </label>
      <label>
        ${translate('Outline')}
        <select id="noteDefaultLineKind">${optionList(common.strokeDasharray, style.line.kind || 'SOLID')}</select>
        <input type="number" id="noteDefaultLineWidth" value="${Number.isFinite(Number(style.line.width)) ? Number(style.line.width) : 1}" min="0" step="1">
        <input type="color" id="noteDefaultLineColor" value="${style.line.color || '#d7d8d9'}">
        <div id="noteDefaultLineColorPalette" class="note-default-color-palette"></div>
      </label>
      <div>
        <button type="button" id="noteDefaultStyleApply">${translate('Apply')}</button>
        <button type="button" id="noteDefaultStyleReset">${translate('Reset')}</button>
      </div>
    </div>`;
  }

  function linkDefaultStyleRows() {
    var common = wuwei.common || {};
    var current = common.current || {};
    var noteStyle = (current.noteStyle && typeof current.noteStyle === 'object') ? current.noteStyle : {};
    var linkStyle = (noteStyle.link && typeof noteStyle.link === 'object') ? noteStyle.link : {};
    var baseLabel = (common.defaultStyle && common.defaultStyle.label) || {};
    var color = (common.Color && common.Color.link) || '#888888';
    var style = {
      font: Object.assign({}, common.defaultFont || {}, linkStyle.font || {}),
      line: Object.assign({ kind: 'SOLID', color: color, width: 2 }, linkStyle.line || {}),
      label: Object.assign({ offset: Object.assign({ x: 0, y: 0 }, baseLabel.offset || {}) }, linkStyle.label || {})
    };
    var offset = style.label.offset || {};

    return `
    <div class="force note-default-style">
      <p><label>${translate('Link default style')}</label></p>
      <label>
        ${translate('Line')}
        <select id="noteDefaultLinkLineKind">${optionList(common.strokeDasharray, style.line.kind || 'SOLID')}</select>
        <input type="number" id="noteDefaultLinkLineWidth" value="${Number.isFinite(Number(style.line.width)) ? Number(style.line.width) : 2}" min="0" step="1">
        <input type="color" id="noteDefaultLinkLineColor" value="${style.line.color || '#888888'}">
        <div id="noteDefaultLinkLineColorPalette" class="note-default-color-palette"></div>
      </label>
      <label>
        ${translate('Text')}
        <input type="color" id="noteDefaultLinkFontColor" value="${style.font.color || '#303030'}">
        <div id="noteDefaultLinkFontColorPalette" class="note-default-color-palette"></div>
        <select id="noteDefaultLinkFontSize">${optionList(common.fontSizes, fontSizeValue(style.font.size))}</select>
      </label>
      <label>
        ${translate('Font')}
        <input type="text" id="noteDefaultLinkFontFamily" value="${style.font.family || 'sans-serif'}">
      </label>
      <label>
        ${translate('offset X')}
        <input type="number" id="noteDefaultLinkLabelOffsetX" value="${Number.isFinite(Number(offset.x)) ? Number(offset.x) : 0}" step="1">
        ${translate('offset Y')}
        <input type="number" id="noteDefaultLinkLabelOffsetY" value="${Number.isFinite(Number(offset.y)) ? Number(offset.y) : 0}" step="1">
      </label>
      <div>
        <button type="button" id="noteDefaultLinkStyleApply">${translate('Apply')}</button>
        <button type="button" id="noteDefaultLinkStyleReset">${translate('Reset')}</button>
      </div>
    </div>`;
  }

  function groupDefaultStyleRows() {
    var common = wuwei.common || {};
    var current = common.current || {};
    var noteStyle = (current.noteStyle && typeof current.noteStyle === 'object') ? current.noteStyle : {};
    var groupStyle = (noteStyle.group && typeof noteStyle.group === 'object') ? noteStyle.group : {};
    var base = (common.defaultStyle && common.defaultStyle.group) || {};
    var style = Object.assign({}, base, groupStyle);

    return `
    <div class="force note-default-style">
      <p><label>${translate('Group default style')}</label></p>
      <label>
        ${translate('Outline')}
        <select id="noteDefaultGroupLineKind">${optionList(common.strokeDasharray, style.kind || 'SOLID')}</select>
        <input type="number" id="noteDefaultGroupLineWidth" value="${Number.isFinite(Number(style.width)) ? Number(style.width) : 6}" min="0" step="1">
        <input type="color" id="noteDefaultGroupLineColor" value="${style.color || '#888888'}">
        <div id="noteDefaultGroupLineColorPalette" class="note-default-color-palette"></div>
      </label>
      <label>
        ${translate('Padding')}
        <input type="number" id="noteDefaultGroupPadding" value="${Number.isFinite(Number(style.padding)) ? Number(style.padding) : 12}" min="0" step="1">
        ${translate('Distance')}
        <input type="number" id="noteDefaultGroupDist" value="${Number.isFinite(Number(style.dist)) ? Number(style.dist) : 40}" min="0" step="1">
      </label>
      <div>
        <button type="button" id="noteDefaultGroupStyleApply">${translate('Apply')}</button>
        <button type="button" id="noteDefaultGroupStyleReset">${translate('Reset')}</button>
      </div>
    </div>`;
  }

  function forceControlRows() {
    return `
    <div class="force alpha">
      <p><label>alpha</label> Simulation activity</p>
      <div class="alpha_bar" onclick="wuwei.menu.setting.updateAll();">
        <div id="alpha_value"></div>
      </div>
    </div>

    <div class="force">
      <p><label>
          <input type="checkbox" checked
              onchange="wuwei.draw.forceProperties.charge.enabled=this.checked;
                  wuwei.menu.setting.updateAll();
                  return false;"> charge</label> Attracts (+) or repels (-) nodes to/from each other.</p>
      <label title="Negative strength repels nodes. Positive strength attracts nodes.">
        strength
        <output id="charge_StrengthSliderOutput">-30</output>
        <input type="range" min="-1000" max="100" value="-30" step="5"
            oninput="d3.select('#charge_StrengthSliderOutput').text(value);
                wuwei.draw.forceProperties.charge.strength=value;
                wuwei.menu.setting.updateAll();
                return false;">
      </label>
      <label title="Minimum distance where force is applied">
        distanceMin
        <output id="charge_distanceMinSliderOutput">1</output>
        <input type="range" min="0" max="200" value="1" step="10"
            oninput="d3.select('#charge_distanceMinSliderOutput').text(value);
                wuwei.draw.forceProperties.charge.distanceMin=value;
                wuwei.menu.setting.updateAll();
                return false;">
      </label>
      <label title="Maximum distance where force is applied">
        distanceMax
        <output id="charge_distanceMaxSliderOutput">2000</output>
        <input type="range" min="0" max="2000" value="2000" step="10"
            oninput="d3.select('#charge_distanceMaxSliderOutput').text(value);
                wuwei.draw.forceProperties.charge.distanceMax=value;
                wuwei.menu.setting.updateAll();
                return false;">
      </label>
    </div>
  
    <div class="force">
      <p><label>
        <input type="checkbox" checked
            onchange="wuwei.draw.forceProperties.link.enabled=this.checked;
                wuwei.menu.setting.updateAll();
                return false;"> link</label> Sets link length</p>
      <label title="The force will push/pull nodes to make links this long">
        distance
        <output id="link_DistanceSliderOutput">30</output>
        <input type="range" min="0" max="500" value="30" step="5"
            oninput="d3.select('#link_DistanceSliderOutput').text(value);
                wuwei.draw.forceProperties.link.distance=value;
                wuwei.menu.setting.updateAll();
                return false;">
      </label>
    </div>

    <div class="force">
      <p><label><input type="checkbox" checked
          onchange="wuwei.draw.forceProperties.collide.enabled=this.checked;
              wuwei.menu.setting.updateAll();
              return false;"> collide</label> Prevents nodes from overlapping</p>
      <label>
        strength
        <output id="collide_StrengthSliderOutput">0.7</output>
        <input type="range" min="0" max="2" value="0.7" step="0.1"
            oninput="d3.select('#collide_StrengthSliderOutput').text(value);
                wuwei.draw.forceProperties.collide.strength=value;
                wuwei.menu.setting.updateAll();
                return false;">
      </label>
      <label title="Size of nodes">
        radius
        <output id="collide_radiusSliderOutput">5</output>
        <input type="range" min="0" max="100" value="5" step="5"
            oninput="d3.select('#collide_radiusSliderOutput').text(value);
                wuwei.draw.forceProperties.collide.radius=value;
                wuwei.menu.setting.updateAll();
                return false;">
      </label>
    </div>
  
    <div class="force">
      <p><label>
          <input type="checkbox"
              onchange="wuwei.draw.forceProperties.forceX.enabled=this.checked;
                  wuwei.menu.setting.updateAll();
                  return false;"
              checked> forceX</label> Acts like gravity. Pulls all points towards an X location.</p>
      <label>
        strength
        <output id="forceX_StrengthSliderOutput">0.1</output>
        <input type="range" min="0" max="1" value=".1" step="0.01"
            oninput="d3.select('#forceX_StrengthSliderOutput').text(value);
            wuwei.draw.forceProperties.forceX.strength=value;
            wuwei.menu.setting.updateAll();
            return false;">
      </label>
    </div>
  
    <div class="force">
      <p><label>
        <input type="checkbox"
            onchange="wuwei.draw.forceProperties.forceY.enabled=this.checked;
                wuwei.menu.setting.updateAll();
                return false;"
            checked> forceY</label> Acts like gravity. Pulls all points towards a Y location.</p>
      <label>
        strength
        <output id="forceY_StrengthSliderOutput">0.1</output>
        <input type="range" min="0" max="1" value=".1" step="0.01"
            oninput="d3.select('#forceY_StrengthSliderOutput').text(value);
                wuwei.draw.forceProperties.forceY.strength=value;
                wuwei.menu.setting.updateAll();
                return false;">
      </label>
    </div>
    `;
  }

  const template = function () {
    var graph = (wuwei.common && wuwei.common.graph) || {};
    return `
    <div class="controls">
    <button type="button" class="setting-pane-close" title="${translate('Close')}">
      <i class="fas fa-times"></i>
    </button>
    ${topicDefaultStyleRows()}
    ${linkDefaultStyleRows()}
    ${groupDefaultStyleRows()}
    ${('simulation' === graph.mode) ? forceControlRows() : ''}
  </div>
    `;
  };

  function translate(str) {
    return wuwei.nls.translate(str);
  }

  return {
    template: template
  };
})();
