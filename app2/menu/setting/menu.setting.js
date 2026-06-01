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

  function ensureTopicDefaultStyle() {
    wuwei.common.current = wuwei.common.current || {};
    var current = wuwei.common.current;
    current.noteStyle = ('object' === typeof current.noteStyle && current.noteStyle) ? current.noteStyle : {};
    current.noteStyle.topic =
      ('object' === typeof current.noteStyle.topic && current.noteStyle.topic)
        ? current.noteStyle.topic
        : {};
    wuwei.common.current.noteStyle = current.noteStyle;
    return current.noteStyle.topic;
  }

  function ensureNoteStyleKey(key) {
    wuwei.common.current = wuwei.common.current || {};
    wuwei.common.current.noteStyle =
      ('object' === typeof wuwei.common.current.noteStyle && wuwei.common.current.noteStyle)
        ? wuwei.common.current.noteStyle
        : {};
    wuwei.common.current.noteStyle[key] =
      ('object' === typeof wuwei.common.current.noteStyle[key] && wuwei.common.current.noteStyle[key])
        ? wuwei.common.current.noteStyle[key]
        : {};
    return wuwei.common.current.noteStyle[key];
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

  function currentLinkDefaultStyleFromPane() {
    var common = wuwei.common || {};
    var style = {
      font: Object.assign({}, common.defaultFont || {}),
      line: { kind: 'SOLID', color: '#888888', width: 2 },
      label: { offset: { x: 0, y: 0 } }
    };
    var lineKindEl = document.getElementById('noteDefaultLinkLineKind');
    var lineWidthEl = document.getElementById('noteDefaultLinkLineWidth');
    var lineColorEl = document.getElementById('noteDefaultLinkLineColor');
    var fontColorEl = document.getElementById('noteDefaultLinkFontColor');
    var fontSizeEl = document.getElementById('noteDefaultLinkFontSize');
    var fontFamilyEl = document.getElementById('noteDefaultLinkFontFamily');
    var offsetXEl = document.getElementById('noteDefaultLinkLabelOffsetX');
    var offsetYEl = document.getElementById('noteDefaultLinkLabelOffsetY');
    style.line.kind = lineKindEl ? lineKindEl.value : style.line.kind;
    style.line.width = lineWidthEl ? Number(lineWidthEl.value || 0) : style.line.width;
    style.line.color = lineColorEl ? lineColorEl.value : style.line.color;
    style.font.color = fontColorEl ? fontColorEl.value : style.font.color;
    style.font.size = fontSizeEl ? fontSizeEl.value : style.font.size;
    style.font.family = fontFamilyEl ? fontFamilyEl.value : style.font.family;
    style.label.offset.x = offsetXEl ? Number(offsetXEl.value || 0) : 0;
    style.label.offset.y = offsetYEl ? Number(offsetYEl.value || 0) : 0;
    return style;
  }

  function currentGroupDefaultStyleFromPane() {
    var style = {};
    var kindEl = document.getElementById('noteDefaultGroupLineKind');
    var widthEl = document.getElementById('noteDefaultGroupLineWidth');
    var colorEl = document.getElementById('noteDefaultGroupLineColor');
    var paddingEl = document.getElementById('noteDefaultGroupPadding');
    var distEl = document.getElementById('noteDefaultGroupDist');
    style.kind = kindEl ? kindEl.value : 'SOLID';
    style.width = widthEl ? Number(widthEl.value || 0) : 6;
    style.color = colorEl ? colorEl.value : '#888888';
    style.padding = paddingEl ? Number(paddingEl.value || 0) : 12;
    style.dist = distEl ? Number(distEl.value || 0) : 40;
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
    ensureTopicDefaultStyle();
    wuwei.common.current.noteStyle.topic = currentNodeDefaultStyleFromPane();
    snackbar('success', 'Topic default style was updated.');
  }

  function applyLinkDefaultStyle() {
    ensureNoteStyleKey('link');
    wuwei.common.current.noteStyle.link = currentLinkDefaultStyleFromPane();
    snackbar('success', 'Link default style was updated.');
  }

  function applyGroupDefaultStyle() {
    ensureNoteStyleKey('group');
    wuwei.common.current.noteStyle.group = currentGroupDefaultStyleFromPane();
    snackbar('success', 'Group default style was updated.');
  }

  function resetNodeDefaultStyle() {
    var current = wuwei.common.current || {};
    if (current.noteStyle && 'object' === typeof current.noteStyle) {
      delete current.noteStyle.node;
      delete current.noteStyle.topic;
    }
    open();
    snackbar('success', 'Topic default style was reset.');
  }

  function resetNoteStyleKey(key, message) {
    var current = wuwei.common.current || {};
    if (current.noteStyle && 'object' === typeof current.noteStyle) {
      delete current.noteStyle[key];
    }
    open();
    snackbar('success', message);
  }

  function bindNodeDefaultStyleControls(settingEl) {
    var applyEl = settingEl.querySelector('#noteDefaultStyleApply');
    var resetEl = settingEl.querySelector('#noteDefaultStyleReset');
    var linkApplyEl = settingEl.querySelector('#noteDefaultLinkStyleApply');
    var linkResetEl = settingEl.querySelector('#noteDefaultLinkStyleReset');
    var groupApplyEl = settingEl.querySelector('#noteDefaultGroupStyleApply');
    var groupResetEl = settingEl.querySelector('#noteDefaultGroupStyleReset');
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
    if (linkApplyEl) {
      linkApplyEl.addEventListener('click', applyLinkDefaultStyle, false);
    }
    if (linkResetEl) {
      linkResetEl.addEventListener('click', function () {
        resetNoteStyleKey('link', 'Link default style was reset.');
      }, false);
    }
    if (groupApplyEl) {
      groupApplyEl.addEventListener('click', applyGroupDefaultStyle, false);
    }
    if (groupResetEl) {
      groupResetEl.addEventListener('click', function () {
        resetNoteStyleKey('group', 'Group default style was reset.');
      }, false);
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
    wuwei.edit.style.markup.initPalette('noteDefaultLinkLineColorPalette', 'noteDefaultLinkLineColor');
    wuwei.edit.style.markup.initPalette('noteDefaultLinkFontColorPalette', 'noteDefaultLinkFontColor');
    wuwei.edit.style.markup.initPalette('noteDefaultGroupLineColorPalette', 'noteDefaultGroupLineColor');
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
  ns.applyLinkDefaultStyle = applyLinkDefaultStyle;
  ns.applyGroupDefaultStyle = applyGroupDefaultStyle;
  ns.resetNodeDefaultStyle = resetNodeDefaultStyle;
  ns.open = open;
  ns.close = close;
  return ns;
})(wuwei.menu.setting);
// menu.setting.js revised 2026-04-07
