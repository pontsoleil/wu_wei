/**
 * wuwei.style.js
 * shared style helpers
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 **/
wuwei.style = (function () {
  'use strict';

  var common = wuwei.common || {};
  var Color = common.Color || {};
  var defaultFont = common.defaultFont || {};
  var defaultStyle = common.defaultStyle || {};

  function isObject(value) {
    return !!(value && typeof value === 'object' && !Array.isArray(value));
  }

  function finiteOr(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function textAnchorToAlign(anchor) {
    if (anchor === 'start') {
      return 'left';
    }
    if (anchor === 'end') {
      return 'right';
    }
    return 'center';
  }

  function textAnchorFromAlign(align) {
    if (align === 'left') {
      return 'start';
    }
    if (align === 'right') {
      return 'end';
    }
    return 'middle';
  }

  function defineRuntimeField(record, name, value) {
    if (!record || typeof record !== 'object') {
      return record;
    }
    try {
      Object.defineProperty(record, name, {
        value: value,
        writable: true,
        configurable: true,
        enumerable: false
      });
    } catch (e) {
      /*
       * Older browsers may reject defineProperty on host objects.  This
       * fallback preserves execution, but normal note/page objects should use
       * the non-enumerable branch above so runtime mirrors are not saved.
       */
      record[name] = value;
    }
    return record;
  }

  function normalizeLabelStyle(label, opt) {
    var defaultLines = defaultStyle && defaultStyle.label && defaultStyle.label.lines;
    opt = opt || {};
    label = isObject(label) ? label : {};
    label.lines = finiteOr(label.lines, finiteOr(opt.lines, finiteOr(defaultLines, 1)));
    if (label.width !== undefined) {
      label.width = finiteOr(label.width, finiteOr(opt.width, 200));
    }
    if (!isObject(label.offset)) {
      label.offset = { x: 0, y: 0 };
    } else {
      if (Number.isFinite(Number(label.offset.x))) {
        label.offset.x = Number(label.offset.x);
      } else {
        delete label.offset.x;
      }
      if (Number.isFinite(Number(label.offset.y))) {
        label.offset.y = Number(label.offset.y);
      } else {
        delete label.offset.y;
      }
    }
    return label;
  }

  function normalizeLineStyle(line, legacy) {
    legacy = legacy || {};
    line = isObject(line) ? line : {};
    line.kind = line.kind || 'SOLID';
    line.color = line.color || legacy.outline || Color.nodeOutline || '#d7d8d9';
    line.width = finiteOr(line.width, finiteOr(legacy.outlineWidth, 1));
    return line;
  }

  function normalizeFontStyle(font, legacy) {
    var oldFont;
    legacy = legacy || {};
    oldFont = isObject(legacy.font) ? legacy.font : {};
    font = isObject(font) ? font : {};
    font.family = font.family || oldFont.family || defaultFont.family || 'sans-serif';
    font.size = finiteOr(font.size, finiteOr(oldFont.size, finiteOr(defaultFont.size, 14)));
    font.color = font.color || oldFont.color || defaultFont.color || '#303030';
    font.align = font.align || textAnchorToAlign(oldFont['text-anchor']);
    return font;
  }

  function normalizeNodeStyle(node, opt) {
    var style;
    opt = opt || {};
    if (!node || typeof node !== 'object') {
      return {};
    }
    style = isObject(node.style) ? node.style : {};
    style.fill = style.fill || node.color || opt.fill || Color.nodeFill || '#FFFFF0';
    style.line = normalizeLineStyle(style.line, {
      outline: node.outline,
      outlineWidth: node.outlineWidth
    });
    style.font = normalizeFontStyle(style.font, { font: node.font });
    if (node.type === 'Memo') {
      delete style.label;
    } else {
      style.label = normalizeLabelStyle(style.label);
    }
    node.style = style;
    expandNodeRuntimeStyle(node);
    return style;
  }

  function expandNodeRuntimeStyle(node) {
    var style, line, font, runtimeFont;
    if (!node || typeof node !== 'object') {
      return node;
    }
    style = isObject(node.style) ? node.style : {};
    line = isObject(style.line) ? style.line : {};
    font = isObject(style.font) ? style.font : {};
    runtimeFont = {
      family: font.family || defaultFont.family || 'sans-serif',
      size: finiteOr(font.size, finiteOr(defaultFont.size, 14)),
      color: font.color || defaultFont.color || '#303030',
      'text-anchor': textAnchorFromAlign(font.align || 'center')
    };
    defineRuntimeField(node, 'color', style.fill || Color.nodeFill || '#FFFFF0');
    defineRuntimeField(node, 'outline', line.color || Color.nodeOutline || '#d7d8d9');
    defineRuntimeField(node, 'outlineWidth', finiteOr(line.width, 1));
    defineRuntimeField(node, 'font', runtimeFont);
    return node;
  }

  function stripNodeRuntimeStyleFields(node) {
    if (!node || typeof node !== 'object') {
      return node;
    }
    delete node.color;
    delete node.outline;
    delete node.outlineWidth;
    delete node.font;
    return node;
  }

  function initModule() { }

  return {
    finiteOr: finiteOr,
    textAnchorToAlign: textAnchorToAlign,
    textAnchorFromAlign: textAnchorFromAlign,
    defineRuntimeField: defineRuntimeField,
    normalizeLabelStyle: normalizeLabelStyle,
    normalizeLineStyle: normalizeLineStyle,
    normalizeFontStyle: normalizeFontStyle,
    normalizeNodeStyle: normalizeNodeStyle,
    expandNodeRuntimeStyle: expandNodeRuntimeStyle,
    stripNodeRuntimeStyleFields: stripNodeRuntimeStyleFields,
    initModule: initModule
  };
})();
// wuwei.style.js
