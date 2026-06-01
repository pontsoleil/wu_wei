/**
 * menu.setting.js
 * menu.setting module
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2013-2019, 2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.menu = wuwei.menu || {};
wuwei.menu.setting = wuwei.menu.setting || {};

( function (ns) {
  const draw = wuwei.draw;

  function clonePlain(value) {
    if (!value || 'object' !== typeof value) {
      return {};
    }
    return JSON.parse(JSON.stringify(value));
  }

  function ensureNodeDefaultStyle() {
    wuwei.common.current = wuwei.common.current || {};
    var current = wuwei.common.current;
    current.noteStyle = ('object' === typeof current.noteStyle && current.noteStyle) ? current.noteStyle : {};
    current.noteStyle.node = ('object' === typeof current.noteStyle.node && current.noteStyle.node) ? current.noteStyle.node : {};
    wuwei.common.current.noteStyle = current.noteStyle;
    return current.noteStyle.node;
  }

  function defaultTopicStyle() {
    var common = wuwei.common || {};
    var defaults = common.defaultStyle || {};
    var style = clonePlain(defaults.topic || {});
    style.font = Object.assign({}, common.defaultFont || {}, style.font || {});
    style.line = Object.assign({}, style.line || {});
    return style;
  }

  function currentNodeDefaultStyleFromPane() {
    var style = defaultTopicStyle();
    var fillEl = document.getElementById('noteDefaultFill');
    var fontColorEl = document.getElementById('noteDefaultFontColor');
    var fontSizeEl = document.getElementById('noteDefaultFontSize');
    var fontFamilyEl = document.getElementById('noteDefaultFontFamily');
    var fontAlignEl = document.getElementById('noteDefaultFontAlign');
    var lineKindEl = document.getElementById('noteDefaultLineKind');
    var lineWidthEl = document.getElementById('noteDefaultLineWidth');
    var lineColorEl = document.getElementById('noteDefaultLineColor');

    style.fill = fillEl ? fillEl.value : style.fill;
    style.font = style.font || {};
    style.font.color = fontColorEl ? fontColorEl.value : style.font.color;
    style.font.size = fontSizeEl ? fontSizeEl.value : style.font.size;
    style.font.family = fontFamilyEl ? fontFamilyEl.value : style.font.family;
    style.font.align = fontAlignEl ? fontAlignEl.value : style.font.align;
    style.line = style.line || {};
    style.line.kind = lineKindEl ? lineKindEl.value : style.line.kind;
    style.line.width = lineWidthEl ? Number(lineWidthEl.value || 0) : style.line.width;
    style.line.color = lineColorEl ? lineColorEl.value : style.line.color;
    return style;
  }

  function snackbar(type, message) {
    if (wuwei.menu && wuwei.menu.snackbar && 'function' === typeof wuwei.menu.snackbar.open) {
      wuwei.menu.snackbar.open({ type: type || 'info', message: wuwei.nls.translate(message) });
    }
  }

  // convenience function to update everything (run after UI input)
  function updateAll() {
    draw.updateForces();
    draw.refresh();
  }

  function applyNodeDefaultStyle() {
    ensureNodeDefaultStyle();
    wuwei.common.current.noteStyle.node = currentNodeDefaultStyleFromPane();
    snackbar('success', 'Node default style was updated.');
  }

  function resetNodeDefaultStyle() {
    var current = wuwei.common.current || {};
    if (current.noteStyle && 'object' === typeof current.noteStyle) {
      delete current.noteStyle.node;
    }
    open();
    snackbar('success', 'Node default style was reset.');
  }

  function bindNodeDefaultStyleControls(settingEl) {
    var applyEl = settingEl.querySelector('#noteDefaultStyleApply');
    var resetEl = settingEl.querySelector('#noteDefaultStyleReset');
    var closeEl = settingEl.querySelector('.setting-pane-close');
    if (closeEl) {
      closeEl.addEventListener('click', close, false);
    }
    if (applyEl) {
      applyEl.addEventListener('click', applyNodeDefaultStyle, false);
    }
    if (resetEl) {
      resetEl.addEventListener('click', resetNodeDefaultStyle, false);
    }
  }

  function initNodeDefaultStylePalettes() {
    if (!wuwei.edit || !wuwei.edit.style || !wuwei.edit.style.markup ||
      'function' !== typeof wuwei.edit.style.markup.initPalette) {
      return;
    }
    wuwei.edit.style.markup.initPalette('noteDefaultFillPalette', 'noteDefaultFill');
    wuwei.edit.style.markup.initPalette('noteDefaultFontColorPalette', 'noteDefaultFontColor');
    wuwei.edit.style.markup.initPalette('noteDefaultLineColorPalette', 'noteDefaultLineColor');
  }

  function open(param) {
    const
      settingEl = document.getElementById('settingPane');
    settingEl.innerHTML = wuwei.menu.setting.markup.template();
    bindNodeDefaultStyleControls(settingEl);
    initNodeDefaultStylePalettes();
    // settingEl.style.display='block';
    settingEl.classList.remove('hidden');
    /*const chargeStrengthSlider = document.getElementById('chargeStrengthSlider');
    chargeStrengthSlider.oninput = function() {
      const chargeStrengthValue = document.getElementById('chargeStrengthValue');
      chargeStrengthValue.innerHTML = this.value;
      draw.forceProperties.collide.strength = this.value;
      updateAll();
    };
    const distanceSlider = document.getElementById('distanceSlider');
    distanceSlider.oninput = function() {
      const distanceValue = document.getElementById('distanceValue');
      distanceValue.innerHTML = this.value;
      draw.forceProperties.link.distance = this.value;
      updateAll();
    };
    const radiusSlider = document.getElementById('radiusSlider');
    radiusSlider.oninput = function() {
      const radiusValue = document.getElementById('radiusValue');
      radiusValue.innerHTML = this.value;
      draw.forceProperties.link.radius = this.value;
      updateAll();
    };*/
  }

  function close() {
    const settingEl = document.getElementById('settingPane');
    settingEl.innerHTML = '';
    settingEl.classList.add('hidden');
    // settingEl.style.display = 'none';
  }

  ns.updateAll = updateAll;
  ns.applyNodeDefaultStyle = applyNodeDefaultStyle;
  ns.resetNodeDefaultStyle = resetNodeDefaultStyle;
  ns.open = open;
  ns.close = close;
  return ns;
})(wuwei.menu.setting);
// menu.setting.js revised 2026-04-07
