/**
 * wuwei.util.js
 * General JavaScript utilities
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2013-2020,2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.util = (function () {
  'use strict';
  var
    /** wuwei */
    common = wuwei.common,
    graph = common.graph,
    current = common.current,
    state = common.state,
    miniature = common.miniature,
    /** model */
    model = wuwei.model,
    /** function */
    isEquivalent,
    clone,
    dist,
    getCookie,
    deleteCookie,
    urlExists,
    getTeamname,
    whichBrowser,
    pad,
    createUuid,
    isUUID,
    isUUIDid,
    logIsoDateTime,
    toISOString,
    toISOStringH,
    toISOStringM,
    clean_text,
    toText,
    getLineFeedCode,
    escapeLineFeed,
    unescapeLineFeed,
    maybeDecodeURIComponent,
    trimToHtmlDocument,
    parseEncodedResponse,
    decodeHtml,
    encodeHtml,
    escapeChar,
    unescapeChar,
    isEmpty,
    notEmpty,
    isEmptyObject,
    notEmptyObject,
    isEmptySelection,
    notEmptySelection,
    isNumber,
    round,
    precisionRound,
    isASCII,
    random,
    append,
    prepend,
    remove,
    findById,
    appendById,
    removeById,
    deleteFromArray,
    contains,
    /** draw */
    parse,
    getTransform,
    pContext,
    pScreen,
    getPosition,
    setScale,
    zoomin,
    zoomout,
    resetview,
    createThumbnail,
    /** miniature */
    setupMiniature,
    translate,
    getBorder,
    getBorderByNodes,
    shiftPath,
    miniatureUtil,
    drawMiniature,
    buildMiniatureSvgString,
    /** sub window */
    openWindow,
    closeWindow,
    /** menu */
    // OperationsList,
    /** misc */
    isNode,
    isResource,
    isLink,
    getLinkPoints,
    copyObject,
    updateObject,
    toArray,
    getLineHeight,
    getEmSize,
    checkPDF, checkOffice, checkImage, checkMP3, checkMOV,
    pushUniqueItem,
    isLocalHost, getAction, getServerUrl, isOfficeDocument, getOfficeIcon,
    getPageTransform,
    setPageTransform,
    getNodeHidden,
    getLinkHidden,
    isShown,
    setHidden,
    getNodeShape,
    getNodeSize,
    getCurrentUserId,
    toStorageRelativePath,
    toPublicResourceUri,
      getResourceFile,
      getResourceFilePath,
      getResourceFileUri,
      getResourcePreviewUri,
      getResourceOriginalPath,
      getResourceOriginalUri,
    getResourceThumbnailUri,
    getThumbnailUri,
    getResource,
    getResourceUri,
    getResourceViewer,
    getNoteOwnerUserId,
    /** init */
    initModule;

  // cf. http://stackoverflow.com/questions/610406/javascript-equivalent-to-printf-string-format
  // First, checks if it isn't implemented yet.
  if (!String.prototype.format) {
    String.prototype.format = function () {
      var args = arguments;
      return this.replace(/{(\d+)}/g, function (match, number) {
        return typeof args[number] != 'undefined' ? args[number] : 'none'
          ;
      });
    };
  }

  // see http://adripofjavascript.com/blog/drips/object-equality-in-javascript.html
  isEquivalent = function (a, b) {
    if (null === a || undefined === a) {
      if (null === b || undefined === b) {
        return true;
      }
      return false;
    }
    if ('string' === typeof a) {
      if ('string' !== typeof b || a !== b) { return false; }
      return true;
    }
    if ('number' === typeof a) {
      if ('number' !== typeof b || a !== b) { return false; }
      return true;
    }
    // Create arrays of property names
    let aProps, bProps;
    try {
      aProps = Object.getOwnPropertyNames(a);
      bProps = Object.getOwnPropertyNames(b);
    }
    catch (e) { console.log(e); return false; }
    // If number of properties is different,
    // objects are not equivalent
    if (aProps.length != bProps.length) {
      return false;
    }
    for (var i = 0; i < aProps.length; i++) {
      var propName = aProps[i];
      // If values of same property are not equal,
      // objects are not equivalent
      if (!isEquivalent(a[propName], b[propName])) {
        return false;
      }
    }
    // If we made it this far, objects
    // are considered equivalent
    return true;
  };


  // see https://stackoverflow.com/questions/728360/how-do-i-correctly-clone-a-javascript-object
  clone = function (obj) {
    var copy;
    // Handle the 3 simple types, and null or undefined
    if (null == obj || 'object' != typeof obj) return obj;
    // Node
    if (isNode(obj)) {
      copy = model.NodeFactory(obj);
    }
    if (isResource(obj)) {
      copy = model.ResourceFactory(obj);
    }
    // Link
    if (isLink(obj)) {
      copy = model.LinkFactory(obj);
    }
    // Handle Date
    if (obj instanceof Date) {
      copy = new Date();
      copy.setTime(obj.getTime());
      return copy;
    }
    // Handle Array
    if (obj instanceof Array) {
      copy = [];
      for (var i = 0, len = obj.length; i < len; i++) {
        copy[i] = clone(obj[i]);
      }
      return copy;
    }
    // Handle Object
    if (obj instanceof Object) {
      copy = {};
      for (var attr in obj) {
        if (obj.hasOwnProperty(attr)) {
          try {
            copy[attr] = clone(obj[attr]);
          }
          catch (e) { console.log(e); }
        }
      }
      return copy;
    }
    throw new Error("Unable to copy obj! Its type isn't supported.");
  }


  dist = function (from, to) {
    var dx = from.x - to.x;
    var dy = from.y - to.y;
    return Math.sqrt(dx * dx + dy * dy);
  };


  getCookie = function (cookie_name) {
    // Get name followed by anything except a semicolon
    var cookie_string = RegExp("" + cookie_name + "[^;]+").exec(document.cookie);
    // Return everything after the equal sign, or an empty string if the cookie name not found
    return decodeURIComponent(!!cookie_string ? cookie_string.toString().replace(/^[^=]+./, "") : "");
  };
  //Sample usage
  //var cookieValue = getCook('MYBIGCOOKIE');


  deleteCookie = function (cookie_name) {
    document.cookie = cookie_name + '=; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
  };


  urlExists = function (url) {
    // cf. http://stackoverflow.com/questions/3646914/how-do-i-check-if-file-exists-in-jquery-or-javascript
    var http = new XMLHttpRequest();
    http.open('HEAD', url, false);
    http.send();
    return http.status === 200;
  };


  getTeamname = function () {
    var
      pathname = window.location.pathname,
      team = pathname.split('/')[1];
    return team;
  };


  whichBrowser = function () {
    var userAgent = window.navigator.userAgent;
    var browsers = { chrome: /[Cc]hrome/i, safari: /[Ss]afari/i, firefox: /[Ff]irefox/i, ie: /internet explorer/i };
    for (var key in browsers) {
      if (browsers[key].test(userAgent)) {
        return key;
      }
    }
    // cf. http://stackoverflow.com/questions/9847580/how-to-detect-safari-chrome-ie-firefox-and-opera-browser
    // Internet Explorer 6-11
    var isIE, isEdge, isSafari, isChrome, isFirefox, isOpera, isBlink;
    isIE = /*@cc_on!@*/false || !!document.documentMode;
    if (isIE) { return 'IE'; }
    // Edge 20+
    isEdge = !!window.StyleMedia;
    if (isEdge) { return 'Edge'; }
    // At least Safari 3+: "[object HTMLElementConstructor]"
    isSafari = Object.prototype.toString.call(window.HTMLElement).indexOf('Constructor') > 0;
    if (isSafari) { return 'Safari'; }
    // Chrome 1+
    isChrome = !!window.chrome && !!window.chrome.webstore;
    if (isChrome) { return 'Chrome'; }
    // Firefox 1.0+
    isFirefox = typeof InstallTrigger !== 'undefined';
    if (isFirefox) { return 'Firefox'; }
    // Opera 8.0+
    isOpera = (!!window.opr && !!window.opr.addons) ||
      !!window.opera ||
      navigator.userAgent.indexOf(' OPR/') >= 0;
    if (isOpera) { return 'Opera'; }
    // Blink engine detection
    isBlink = (isChrome || isOpera) && !!window.CSS;
    if (isBlink) { return 'Blink'; }

    return 'unknown';
  };


  pad = function (number) {
    if (number < 10) {
      return '0' + number;
    }
    return number;
  };


  createUuid = function () {
    if (typeof uuid !== 'undefined' && uuid && typeof uuid.v4 === 'function') {
      return `_${uuid.v4()}`;
    }
    if (typeof crypto !== 'undefined' && crypto && typeof crypto.randomUUID === 'function') {
      return `_${crypto.randomUUID()}`;
    }
    return `_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }


  isUUID = function (id) {
    // see https://stackoverflow.com/questions/6603015/check-whether-a-string-matches-a-regex-in-js
    var rex = new RegExp(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    return rex.test(id);
  };


  isUUIDid = function (id) {
    var rex = new RegExp(/^_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    return rex.test(id);
  };


  logIsoDateTime = function (msg) {
    console.log(msg + ' ' + (new Date()).toISOString());
  };


  toISOString = function (millisec) {
    var date = new Date(millisec + 9 * 60 * 60 * 1000);
    return date.getUTCFullYear() +
      '-' + this.pad(date.getUTCMonth() + 1) +
      '-' + this.pad(date.getUTCDate()) +
      'T' + this.pad(date.getUTCHours()) +
      ':' + this.pad(date.getUTCMinutes()) +
      ':' + this.pad(date.getUTCSeconds()) +
      // '.' + (date.getUTCMilliseconds() / 1000).toFixed(3).slice(2, 5) +
      '+09:00';
  };


  toISOStringH = function (millisec) {
    var date = new Date(millisec + 9 * 60 * 60 * 1000);
    return '' + this.pad(date.getUTCHours()) +
      ':' + this.pad(date.getUTCMinutes()) +
      ':' + this.pad(date.getUTCSeconds()) +
      // '.' + (date.getUTCMilliseconds() / 1000).toFixed(3).slice(2, 5) +
      '+09:00';
  };


  toISOStringM = function (millisec) {
    var date = new Date(millisec + 9 * 60 * 60 * 1000);
    return '' + this.pad(date.getUTCMinutes()) +
      ':' + this.pad(date.getUTCSeconds()) +
      '.' + (date.getUTCMilliseconds() / 1000).toFixed(3).slice(2, 5) +
      '+09:00';
  };


  // -----------------------------------------------------------------------------
  // Text cleaning helpers
  // -----------------------------------------------------------------------------

  clean_text = function (value, options) {
    var opts = options || {};
    var preserveNewlines = opts.preserveNewlines !== false;
    var preserveTabs = !!opts.preserveTabs;
    var trim = opts.trim !== false;
    var replaceControlsWithSpace = !!opts.replaceControlsWithSpace;
    var text, re;

    if (value === null || value === undefined) {
      return '';
    }

    text = String(value);

    // Remove BOM at start, normalise CRLF/CR to LF
    text = text.replace(/^\uFEFF/, '');
    text = text.replace(/\r\n?/g, '\n');

    // Unicode normalisation if supported
    if (typeof text.normalize === 'function') {
      text = text.normalize('NFC');
    }

    // Remove hidden zero-width characters often introduced by copy/paste
    text = text.replace(/[\u200B-\u200D\u2060]/g, '');

    // Remove control characters
    if (preserveNewlines && preserveTabs) {
      re = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
    } else if (preserveNewlines) {
      re = /[\u0000-\u0008\u0009\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
    } else if (preserveTabs) {
      re = /[\u0000-\u0008\u000A-\u001F\u007F-\u009F]/g;
    } else {
      re = /[\u0000-\u001F\u007F-\u009F]/g;
    }

    text = text.replace(re, replaceControlsWithSpace ? ' ' : '');

    // Collapse repeated spaces, but keep line breaks
    text = text.replace(/[ \t]{2,}/g, ' ');

    // Clean extra blank lines
    text = text.replace(/\n{3,}/g, '\n\n');

    if (trim) {
      text = text.trim();
    }

    return text;
  };


  // -----------------------------------------------------------------------------
  // HTML -> plain text
  // -----------------------------------------------------------------------------

  toText = function (html) {
    var parser, doc, out, blockTags;

    if (typeof html !== 'string') {
      return '';
    }

    parser = new DOMParser();
    doc = parser.parseFromString(html, 'text/html');
    out = [];

    blockTags = {
      ADDRESS: true,
      ARTICLE: true,
      ASIDE: true,
      BLOCKQUOTE: true,
      DIV: true,
      DL: true,
      DT: true,
      DD: true,
      FIELDSET: true,
      FIGCAPTION: true,
      FIGURE: true,
      FOOTER: true,
      FORM: true,
      H1: true,
      H2: true,
      H3: true,
      H4: true,
      H5: true,
      H6: true,
      HEADER: true,
      HR: true,
      LI: true,
      MAIN: true,
      NAV: true,
      OL: true,
      P: true,
      PRE: true,
      SECTION: true,
      TABLE: true,
      TBODY: true,
      THEAD: true,
      TFOOT: true,
      TR: true,
      TD: true,
      TH: true,
      UL: true
    };

    function walk(node) {
      var i, tag;

      if (!node) {
        return;
      }

      if (node.nodeType === Node.TEXT_NODE) {
        out.push(node.nodeValue);
        return;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return;
      }

      tag = node.tagName;

      // Skip non-visible or unsafe content
      if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/i.test(tag)) {
        return;
      }

      if (tag === 'BR') {
        out.push('\n');
        return;
      }

      if (tag === 'LI') {
        out.push(' * ');
      }

      for (i = 0; i < node.childNodes.length; i += 1) {
        walk(node.childNodes[i]);
      }

      if (blockTags[tag]) {
        out.push('\n');
      }
    }

    walk(doc.body || doc);

    return clean_text(out.join(''), {
      preserveNewlines: true,
      preserveTabs: true,
      trim: true
    });
  };

  // -----------------------------------------------------------------------------
  // Newline escaping / unescaping
  // -----------------------------------------------------------------------------

  getLineFeedCode = function () {
    var el = document.getElementById('LFtextarea');

    if (!el) {
      return '\n';
    }

    if (typeof el.value === 'string' && el.value.length > 0) {
      return el.value;
    }

    if (typeof el.textContent === 'string' && el.textContent.length > 0) {
      return el.textContent;
    }

    if (typeof el.innerHTML === 'string' && el.innerHTML.length > 0) {
      return el.innerHTML;
    }

    return '\n';
  };


  escapeLineFeed = function (str) {
    if (str === null || str === undefined) {
      return '';
    }

    return clean_text(str, {
      preserveNewlines: true,
      preserveTabs: true,
      trim: false
    }).replace(/\n/g, '\\n');
  };


  unescapeLineFeed = function (str) {
    if (str === null || str === undefined) {
      return '';
    }

    return String(str).replace(/\\n/g, getLineFeedCode());
  };


  // Backward-compatible aliases
  escapeChar = escapeLineFeed;
  unescapeChar = unescapeLineFeed;

  // -----------------------------------------------------------------------------
  // HTML entity encode / decode
  // -----------------------------------------------------------------------------

  decodeHtml = function (input) {
    var textarea;

    if (input === null || input === undefined) {
      return '';
    }

    textarea = document.createElement('textarea');
    textarea.innerHTML = String(input);
    return textarea.value;
  };

  encodeHtml = function (input) {
    var map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };

    return String(input === null || input === undefined ? '' : input)
      .replace(/[&<>"']/g, function (ch) {
        return map[ch];
      });
  };

  // -----------------------------------------------------------------------------
  // Response decoding / HTML document handling
  // -----------------------------------------------------------------------------

  maybeDecodeURIComponent = function (text) {
    if (typeof text !== 'string') {
      return '';
    }

    // Only try decodeURIComponent when the string looks percent-encoded.
    if (!/%[0-9A-Fa-f]{2}/.test(text)) {
      return text;
    }

    try {
      return decodeURIComponent(text);
    } catch (e) {
      console.warn('decodeURIComponent failed, using raw response:', e);
      return text;
    }
  };


  trimToHtmlDocument = function (text) {
    var start, m;

    if (typeof text !== 'string') {
      return '';
    }

    text = text.replace(/^\uFEFF/, '').trim();

    // Drop junk before the start of HTML, if any
    start = text.search(/<(?:!doctype|html|body)\b/i);
    if (start > 0) {
      text = text.slice(start);
    }

    // Trim junk after closing HTML/body if present
    m = text.match(/[\s\S]*<\/html>/i);
    if (m) {
      return m[0];
    }

    m = text.match(/[\s\S]*<\/body>/i);
    if (m) {
      return m[0];
    }

    return text;
  };


  parseEncodedResponse = function (response, expr) {
    var content;

    if (typeof response !== 'string' || !state.doc || !state.win) {
      return Promise.resolve(null);
    }

    content = maybeDecodeURIComponent(response);
    content = clean_text(content, {
      preserveNewlines: true,
      preserveTabs: true,
      trim: true
    });
    content = trimToHtmlDocument(content);

    return Promise.resolve(expr)
      .then(function (resolvedExpr) {
        state.doc.open();
        state.doc.write(content);
        state.doc.close();
        return resolvedExpr;
      })
      .then(function (resolvedExpr) {
        function scrollToExpr() {
          var el, rectSource, rects, top, scrollTop;

          if (!resolvedExpr) {
            return;
          }

          el = wuwei.annotate.element(resolvedExpr, state.doc);
          if (!el) {
            return;
          }

          rectSource = el;
          rects = rectSource.getClientRects ? rectSource.getClientRects() : null;

          if ((!rects || !rects.length) && el.parentElement) {
            rectSource = el.parentElement;
            rects = rectSource.getClientRects ? rectSource.getClientRects() : null;
          }

          if (!rects || !rects.length) {
            return;
          }

          top = rects[0].top;
          scrollTop = Math.max(0, state.win.scrollY + top - 80);
          state.win.scrollTo(0, scrollTop);
        }

        if (!resolvedExpr) {
          return null;
        }

        if (state.doc.readyState === 'complete') {
          scrollToExpr();
        } else if (state.win.addEventListener) {
          state.win.addEventListener('load', scrollToExpr, { once: true });
        } else {
          state.win.onload = scrollToExpr;
        }

        return null;
      })
      .catch(function (error) {
        console.error('parseEncodedResponse failed:', error);
        return null;
      });
  };


  isEmpty = function (v) {
    if (v === undefined || v === null) {
      return true;
    }

    if (typeof v === 'string') {
      v = v.replace(/^[\s\u3000]+|[\s\u3000]+$/g, '');
      return v === '' || v === 'undefined' || v === 'null';
    }

    return false;
  };


  notEmpty = function (v) {
    return !isEmpty(v);
  };


  isEmptyObject = function (v) {
    return v &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      Object.keys(v).length === 0;
  };


  notEmptyObject = function (v) {
    return v &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      Object.keys(v).length > 0;
  };


  isEmptySelection = function (v) {
    return !(v && typeof v.node === 'function' && v.node());
  };


  notEmptySelection = function (v) {
    return !!(v && typeof v.node === 'function' && v.node());
  };

  isNumber = function (v) {
    return typeof v === 'number' && !Number.isNaN(v);
  };
  // if you also want numeric strings like "123" to count, that is a different function
  // isNumeric = function (v) {
  //   return v !== null && v !== '' && !Number.isNaN(Number(v));
  // };


  round = function (v) {
    if (undefined === v || null === v || '' === v) {
      v = 1;
    }
    v = Math.round(0.5 + 100 * v) / 100;
    if (v < 0.01) { v = 0.01; }
    return v;
  };


  precisionRound = function (number, precision) {
    var factor = Math.pow(10, precision);
    return Math.round(number * factor) / factor;
  };


  isASCII = function (str) {
    return typeof str === 'string' && /^[\x00-\x7F]*$/.test(str);
  };


  random = function () {
    var min = 0;
    var max = 1;
    if (arguments.length === 1) {
      max = arguments[0];
    } else {
      min = arguments[0];
      max = arguments[1];
    }
    return Math.floor(Math.random() * (max - min)) + min;
  };


  append = function (items, item) {
    var self = this;
    if (items instanceof Array && notEmpty(item)) {
      var index = items.indexOf(item);
      if (index >= 0) {
        var v = items.splice(index, 1)[0];
        items.push(item);
      } else {
        items.push(item);
      }
      return items;
    }
    return null;
  };


  prepend = function (items, item) {
    var self = this;
    if (items instanceof Array && notEmpty(item)) {
      var index = items.indexOf(item);
      if (index >= 0) {
        var v = items.splice(index, 1)[0];
      }
      items.splice(0, 0, item);
      return items;
    }
    return null;
  };


  remove = function (items, item) {
    var self = this;
    if (items instanceof Array && notEmpty(item)) {
      var index = items.indexOf(item);
      if (index >= 0) {
        var v = items.splice(index, 1)[0];
      }
      return items;
    }
    return null;
  };


  findById = function (items, id) {
    var self = this;
    if (items instanceof Array) {
      var i;
      var len = items.length;
      for (i = 0; i < len; i++) {
        if (id === items[i].id) {
          return items[i];
        }
      }
    }
    return null;
  };


  appendById = function (items, item) {
    if (!item.id) {
      return null;
    }
    var i;
    if (items instanceof Array && item) {
      var len = items.length;
      for (i = 0; i < len; i++) {
        if (items[i].id && item.id === items[i].id) {
          items.splice(i, 1);
          items.push(item);
          return items;
        }
      }
      items.push(item);
      return items;
    }
    return null;
  };


  removeById = function (items, id) {
    if (items instanceof Array) {
      var i;
      var len = items.length;
      for (i = 0; i < len; i++) {
        if (id === items[i].id) {
          items.splice(i, 1);
          return items;
        }
      }
    }
    return false;
  };


  deleteFromArray = function (items, item) {
    if (items instanceof Array) {
      var index = items.indexOf(item);
      if (index >= 0) {
        items.splice(index, 1);
        return items;
      }
    }
    return false;
  };


  contains = function (items, item) {
    if (!items || !item) { return false; }
    if (items instanceof Array) {
      return items.indexOf(item) > -1;
    }
    return false;
  };


  parse = function (a) {
    if (!a) {
      return null;
    }
    var b = {};
    for (var i in a = a.match(/(\w+\((\-?\d+\.?\d*e?\-?\d*[,\s]?)+\))+/g)) {
      if (a.hasOwnProperty(i)) {
        var c = a[i].match(/[\w\.\-]+/g);
        b[c.shift()] = c;
      }
    }
    return b;
  };


  getTransform = function (canvasId) {
    var
      container = d3.select(canvasId);
    var transform = container.attr('transform');
    if (transform) {
      var parsed = parse(transform);
      var translate = (parsed.translate && parsed.translate.map(parseFloat)) || [0, 0];
      var
        scale = (parsed.scale && parseFloat(parsed.scale[0])) || 1,
        x = +translate[0],
        y = +translate[1];
      graph.transform = {
        x: x,
        y: y,
        scale: scale
      };

      return graph.transform;
    }
    // no translation & no scale
    return null;
  };


  pContext = function (param) {
    if (!param || !isFinite(param.x) || !isFinite(param.y)) {
      return null;
    }
    var
      x = param.x, y = param.y,
      svg = d3.select('svg#' + common.state.svgId),
      viewBox = svg.attr('viewBox'),
      trns = getTransform('g#' + common.state.canvasId);
    if (viewBox) {
      var vbox = [], vx, vy;
      vbox = viewBox.split(' ');
      vx = parseFloat(vbox[0]);
      vy = parseFloat(vbox[1]);
      if (trns && trns.scale > 0) {
        return {
          x: (x + vx - trns.x) / trns.scale,
          y: (y + vy - trns.y) / trns.scale
        };
      } else {
        return {
          x: x + vx,
          y: y + vy
        };
      }
    } else {
      return {
        x: x - window.innerWidth / 2,
        y: y - window.innerHeight / 2
      };
    }
  };

  pScreen = function (param) {
    if (!param || !isFinite(param.x) || !isFinite(param.y)) {
      return null;
    }
    var
      x = param.x, y = param.y,
      svg = d3.select('svg#' + common.state.svgId),
      viewBox = svg.attr('viewBox'),
      trns = getTransform('g#' + common.state.canvasId);
    if (viewBox) {
      var vbox = [], vx, vy;
      vbox = viewBox.split(' ');
      vx = parseFloat(vbox[0]);
      vy = parseFloat(vbox[1]);
      if (trns && trns.scale > 0) {
        return {
          x: (x - vx + trns.x) * trns.scale,
          y: (y - vy + trns.y) * trns.scale
        };
      } else {
        return {
          x: x - vx,
          y: y - vy
        };
      }
    } else {
      return {
        x: x,
        y: y
      };
    }
  };


  getPosition = function (node) {
    var
      id = node.id;
    var
      element, shape, size,
      transform, parsed,
      x, y, translate;
    if (!node) {
      return { 'x': 0, 'y': 0, 'shape': shape, 'size': size };
    }
    if (id) {
      element = document.getElementById(id);
      shape = node.shape || (node.style && node.style.shape);
      size = node.size || (node.style && node.style.size);
    } else {
      x = y = 0;
    }
    if (element) {
      transform = element.getAttribute('transform');
      if (transform) {
        parsed = parse(transform);
        if (parsed && parsed.translate) {
          translate = parsed.translate.map(Number) || [0, 0];
          x = +translate[0];
          y = +translate[1];
        } else {
          x = y = 0;
        }
      } else {
        x = y = 0;
      }
    } else {
      x = y = 0;
    }
    if (isFinite(size.radius)) {
      size.radius = +size.radius;
    }
    if (isFinite(size.width)) {
      size.width = +size.width;
    }
    if (isFinite(size.height)) {
      size.height = +size.height;
    }
    return { 'x': x, 'y': y, 'shape': shape, 'size': size };
  };

  setScale = function (s) {
    var id = 'g#' + common.state.canvasId,
      canvas = d3.select(id);
    var transform, x, y, scale;

    transform = getTransform(id);
    if (transform) {
      x = transform.x;
      y = transform.y;
      scale = transform.scale;
    } else {
      x = 0;
      y = 0;
      scale = 1;
    }

    scale = scale * s;
    scale = Math.round(scale * 100) / 100;
    if (scale < 0.2) {
      scale = 0.2;
    } else if (scale > 5) {
      scale = 5;
    }

    var translate = 'translate(' + [x, y] + ') scale(' + scale + ')';
    canvas.attr('transform', translate);
    setPageTransform(current.page, Object.assign({}, getPageTransform(current.page), {
      x: x,
      y: y,
      scale: scale
    }));
    return scale;
  };

  zoomin = function () {
    var
      scale = setScale(1.2);
    setPageTransform(current.page, Object.assign({}, getPageTransform(current.page), { scale: scale }));
    return scale;
  };


  zoomout = function () {
    var
      scale = setScale(0.98333);
    setPageTransform(current.page, Object.assign({}, getPageTransform(current.page), { scale: scale }));
    return scale;
  };


  resetview = function () {
    var
      self = this,
      id = 'g#' + common.state.canvasId,
      canvas = d3.select(id),
      transform = getTransform(id),
      xTrans, yTrans;
    if (transform) {
      xTrans = Math.round(transform.x || 0);
      yTrans = Math.round(transform.y || 0);
    } else {
      xTrans = yTrans = 0;
    }
    var
      translate;
    translate = 'translate(' + [xTrans, yTrans] + ') scale(1)';
    canvas.attr('transform', translate);
    setPageTransform(current.page, { x: xTrans, y: yTrans, scale: 1 });
  };


  createThumbnail = function (param) {
    var svgString = buildMiniatureSvgString({
      width: 200,
      height: 200,
      nodes: param && param.nodes,
      links: param && param.links
    });

    return 'data:image/svg+xml;base64,' + window.btoa(unescape(encodeURIComponent(svgString)));
  };


  translate = function (canvasId, x, y) {
    var
      canvas = d3.select('g#' + canvasId);
    var
      transform,
      scale;
    transform = getTransform('g#' + canvasId);
    var translate = '';
    if (transform) {
      scale = transform.scale;
      if (scale) {
        translate = 'translate(' + [x, y] + ') scale(' + scale + ')';
      } else {
        translate = 'translate(' + [x, y] + ')';
      }
    } else {
      translate = 'translate(' + [x, y] + ')';
    }
    canvas.attr('transform', translate);
  };


  getBorder = function (nodes) {
    if (!nodes || 0 === nodes.length) {
      return null;
    }
    var
      xMin = Number.MAX_VALUE / 2,
      xMax = -Number.MAX_VALUE / 2,
      yMin = Number.MAX_VALUE / 2,
      yMax = -Number.MAX_VALUE / 2,
      rect, circle, memo,
      r, width, height, d, dH, dV,
      _left, _right, _top, _bottom,
      i, node, transform, parsed, translate, translateX, translateY,
      x1, y1, x2, y2, cx, cy, border;
    // RECT CIRCLE ROUNDED ELLIPSE MEMO
    function left(node, translateX) {
      if (circle) { return translateX - r; }
      if (rect) { return translateX - width / 2; }
      if (memo) { return translateX - dH; }
      return null;
    }
    function right(node, translateX) {
      if (circle) { return translateX + r; }
      if (rect) { return translateX + width / 2; }
      if (memo) { return translateX + dH; }
      return null;
    }
    function top(node, translateY) {
      if (circle) { return translateY - r; }
      if (rect) { return translateY - height / 2; }
      if (memo) { return translateY - dV; }
      return null;
    }
    function bottom(node, translateY) {
      if (circle) { return translateY - r; }
      if (rect) { return translateY + height / 2; }
      if (memo) { return translateY + dV; }
      return null;
    }

    for (i = 0; i < nodes.length; i++) {
      node = nodes[i];
      rect = node.querySelector('rect') ||
        node.querySelector('polygon') ||
        node.querySelector('image');
      if (rect) {
        width = +rect.getAttribute('width');
        height = +rect.getAttribute('height');
      }
      circle = node.querySelector('circle');
      if (circle) {
        r = +circle.getAttribute('r');
      }
      memo = node.querySelector('path');
      if (memo) {
        d = memo.getAttribute('d');
        if (d) {
          d = d.substr(1, d.indexOf(' '));
          d = d.split(',');
          dH = -d[0];
          dV = -d[1];
        }
      }
      transform = node.getAttribute('transform');
      if (transform) {
        parsed = parse(transform);
        translate = parsed.translate || [0, 0];
        translateX = +translate[0];
        translateY = +translate[1];
        _left = left(node, translateX);
        _right = right(node, translateX);
        _top = top(node, translateY);
        _bottom = bottom(node, translateY);
        if (_left < xMin) {
          xMin = _left;
        }
        if (xMax < _right) {
          xMax = _right;
        }
        if (_top < yMin) {
          yMin = _top;
        }
        if (yMax < _bottom) {
          yMax = _bottom;
        }
      }
      // console.log('-- getBorders', node, 'translateX=' + translateX + ' translateY=' + translateY);
    }

    x1 = xMin;
    y1 = yMin;
    x2 = xMax;
    y2 = yMax;
    cx = (x1 + x2) / 2;
    cy = (y1 + y2) / 2;
    width = x2 - x1;
    height = y2 - y1;

    border = {
      left: x1,
      top: y1,
      right: x2,
      bottom: y2,
      cx: cx,
      cy: cy,
      width: width,
      height: height
    };
    return border;
  };


  getBorderByNodes = function (nodes) {
    if (!nodes || 0 === nodes.length) {
      return null;
    }
    var
      xMin = Number.MAX_VALUE / 2,
      xMax = -Number.MAX_VALUE / 2,
      yMin = Number.MAX_VALUE / 2,
      yMax = -Number.MAX_VALUE / 2,
      _left, _right, _top, _bottom,
      shape, size, width, height, radius,
      i, node,
      x1, y1, x2, y2, cx, cy,
      border;
    // RECT CIRCLE ROUNDED ELLIPSE
    for (i = 0; i < nodes.length; i++) {
      node = nodes[i];
      shape = node.shape;
      size = node.size;
      width = size.width;
      height = size.height;
      radius = size.radius;
      if ('CIRCLE' === shape) {
        _left = node.x - radius;
        _right = node.x + radius;
        _top = node.y - radius;
        _bottom = node.y + radius;
      } else {
        _left = node.x - width / 2;
        _right = node.x + width / 2;
        _top = node.y - height / 2;
        _bottom = node.y + height / 2;
      }
      if (_left < xMin) {
        xMin = _left;
      }
      if (xMax < _right) {
        xMax = _right;
      }
      if (_top < yMin) {
        yMin = _top;
      }
      if (yMax < _bottom) {
        yMax = _bottom;
      }
      // console.log('-- getBorders', node, 'translateX=' + translateX + ' translateY=' + translateY);
    }
    x1 = xMin;
    y1 = yMin;
    x2 = xMax;
    y2 = yMax;
    cx = (x1 + x2) / 2;
    cy = (y1 + y2) / 2;
    width = x2 - x1;
    height = y2 - y1;

    border = {
      left: x1,
      top: y1,
      right: x2,
      bottom: y2,
      cx: cx,
      cy: cy,
      width: width,
      height: height
    };
    return border;
  };


  shiftPath = function (d, cx, cy) {
    var points = model.pathString2points(d);
    if (points && points.length >= 2) {
      for (var i = 0, len = points.length; i < len; i++) {
        if (points[i]) {
          if (points[i].x) { points[i].x -= cx; }
          if (points[i].y) { points[i].y -= cy; }
        }
      }
      var pathString = points.map(function (d) {
        return `${d.code ? d.code : ''}${d.x},${d.y}`;
      }).join(' ');
      return pathString;
    }
    return null;
  };


  var miniatureUtil = (function () {
    'use strict';

    var SVG_NS = 'http://www.w3.org/2000/svg';
    var miniDragState = null;

    function q(sel, root) {
      return (root || document).querySelector(sel);
    }

    function qa(sel, root) {
      return Array.prototype.slice.call((root || document).querySelectorAll(sel));
    }

    function createSvgEl(tag) {
      return document.createElementNS(SVG_NS, tag);
    }

    function clearElement(el) {
      if (!el) {
        return;
      }
      while (el.firstChild) {
        el.removeChild(el.firstChild);
      }
    }

    function isVisibleElement(el) {
      if (!el) {
        return false;
      }
      if (el.style && el.style.display === 'none') {
        return false;
      }
      if (el.getAttribute && el.getAttribute('display') === 'none') {
        return false;
      }
      return true;
    }

    function getBBoxSafe(el) {
      try {
        if (!el || !el.getBBox || !isVisibleElement(el)) {
          return null;
        }
        var bb = el.getBBox();
        if (!bb ||
          !isFinite(bb.x) ||
          !isFinite(bb.y) ||
          !isFinite(bb.width) ||
          !isFinite(bb.height)) {
          return null;
        }
        return bb;
      } catch (e) {
        return null;
      }
    }

    function expandBorder(b, left, top, right, bottom) {
      if (!isFinite(left) || !isFinite(top) || !isFinite(right) || !isFinite(bottom)) {
        return b;
      }
      if (!b) {
        return {
          left: left,
          top: top,
          right: right,
          bottom: bottom
        };
      }
      if (left < b.left) { b.left = left; }
      if (top < b.top) { b.top = top; }
      if (right > b.right) { b.right = right; }
      if (bottom > b.bottom) { b.bottom = bottom; }
      return b;
    }

    function finalizeBorder(b) {
      if (!b) {
        return null;
      }
      b.width = Math.max(1, b.right - b.left);
      b.height = Math.max(1, b.bottom - b.top);
      return b;
    }

    function getHalfW(nodeObj) {
      if (!nodeObj || !nodeObj.size) {
        return 50;
      }
      if (isFinite(+nodeObj.size.radius)) {
        return +nodeObj.size.radius;
      }
      if (isFinite(+nodeObj.size.width)) {
        return +nodeObj.size.width / 2;
      }
      return 50;
    }

    function getHalfH(nodeObj) {
      if (!nodeObj || !nodeObj.size) {
        return 25;
      }
      if (isFinite(+nodeObj.size.radius)) {
        return +nodeObj.size.radius;
      }
      if (isFinite(+nodeObj.size.height)) {
        return +nodeObj.size.height / 2;
      }
      if (isFinite(+nodeObj.size.width)) {
        return +nodeObj.size.width / 2;
      }
      return 25;
    }

    function resolveParams(param) {
      param = param || {};
      return {
        svgId: param.svgId || state.svgId || 'draw',
        canvasId: param.canvasId || state.canvasId || 'canvas',
        miniatureId: param.miniatureId || param.miniCanvas || 'miniCanvas',
        width: +(param.width || miniature.width || 200),
        height: +(param.height || miniature.height || 200),
        padding: isFinite(+param.padding) ? +param.padding : 8,
        outerMargin: isFinite(+param.outerMargin) ? +param.outerMargin : 64,
        nodes: param.nodes || graph.nodes || [],
        links: param.links || graph.links || [],
        useDataOnly: param.useDataOnly === true,
        showViewFrame: param.showViewFrame !== false,
        backgroundFill: param.backgroundFill || '#9a9a9a',
        frameFill: param.frameFill || 'rgba(255,255,255,0.98)',
        frameStroke: param.frameStroke || '#222'
      };
    }

    function getMiniatureRoot() {
      return document.getElementById('miniature');
    }

    function getMiniSvg() {
      return q('#miniature svg.miniSvg') || q('#miniature svg');
    }

    function getMiniCanvasElement(id) {
      if (!id) {
        return q('#miniature .miniCanvas') || q('#miniature g.miniCanvas') || q('#miniature g#miniCanvas');
      }
      return document.getElementById(id) ||
        q('#' + id) ||
        q('#miniature .' + id) ||
        q('#miniature g.' + id) ||
        q('#miniature g#' + id);
    }

    function ensureMiniatureDom() {
      var root = getMiniatureRoot(),
        miniSvg = getMiniSvg(),
        miniCanvas;

      if (!root) {
        return null;
      }

      if (!miniSvg) {
        miniSvg = createSvgEl('svg');
        miniSvg.setAttribute('class', 'miniSvg');
        root.appendChild(miniSvg);
      }

      miniCanvas = q('g.miniCanvas', miniSvg) || q('g#miniCanvas', miniSvg);
      if (!miniCanvas) {
        miniCanvas = createSvgEl('g');
        miniCanvas.setAttribute('class', 'miniCanvas');
        miniSvg.insertBefore(miniCanvas, miniSvg.firstChild || null);
      }

      return {
        root: root,
        svg: miniSvg,
        canvas: miniCanvas
      };
    }

    function getMiniSize(miniSvg, fallbackWidth, fallbackHeight) {
      var rect, width, height;

      if (miniSvg) {
        rect = miniSvg.getBoundingClientRect();
        if (rect && rect.width > 0 && rect.height > 0) {
          width = rect.width;
          height = rect.height;
        } else {
          width = +(miniSvg.getAttribute('width') || fallbackWidth || 200);
          height = +(miniSvg.getAttribute('height') || fallbackHeight || 200);
        }
      } else {
        width = +(fallbackWidth || 200);
        height = +(fallbackHeight || 200);
      }

      return {
        width: width,
        height: height
      };
    }

    function setMiniScaleLabel(value) {
      var el = q('#miniature .miniScale');
      if (el) {
        el.textContent = '1 / ' + value;
      }
    }

    function getDomNodeItems(nodesArg, canvasEl) {
      var list = [], i, nodeObj, el;

      if (nodesArg && nodesArg.length) {
        for (i = 0; i < nodesArg.length; i++) {
          nodeObj = nodesArg[i];
          if (!nodeObj || nodeObj.visible === false) {
            continue;
          }
          el = nodeObj.id ? document.getElementById(nodeObj.id) : null;
          if (el && el.tagName && el.tagName.toLowerCase() === 'g') {
            list.push(el);
          }
        }
        return list;
      }

      if (canvasEl) {
        return qa('g.node', canvasEl);
      }

      return list;
    }

    function getDomLinkItems(linksArg, canvasEl) {
      var list = [], i, linkObj, el, isTimelineAxis;

      if (linksArg && linksArg.length) {
        for (i = 0; i < linksArg.length; i++) {
          linkObj = linksArg[i];
          if (!linkObj || linkObj.visible === false) {
            continue;
          }

          isTimelineAxis = !!(
            linkObj &&
            linkObj.type === 'Link' &&
            (
              linkObj.groupType === 'timelineAxis' ||
              linkObj.linkType === 'timeline-axis'
            )
          );

          if (isTimelineAxis) {
            el = document.getElementById(linkObj.id + '__back') ||
              document.getElementById(linkObj.id);
          }
          else {
            el = linkObj.id ? document.getElementById(linkObj.id) : null;
          }

          if (el && el.tagName && el.tagName.toLowerCase() === 'g') {
            list.push(el);
          }
        }
        return list;
      }

      if (canvasEl) {
        return qa('g.link', canvasEl);
      }

      return list;
    }

    function buildBorderFromDom(nodeItems, linkItems) {
      var i, el, bb, b = null;

      if (linkItems && linkItems.length) {
        for (i = 0; i < linkItems.length; i++) {
          el = linkItems[i];
          bb = getBBoxSafe(el);
          if (bb) {
            b = expandBorder(b, bb.x, bb.y, bb.x + bb.width, bb.y + bb.height);
          }
        }
      }

      if (nodeItems && nodeItems.length) {
        for (i = 0; i < nodeItems.length; i++) {
          el = nodeItems[i];
          bb = getBBoxSafe(el);
          if (bb) {
            b = expandBorder(b, bb.x, bb.y, bb.x + bb.width, bb.y + bb.height);
          }
        }
      }

      return finalizeBorder(b);
    }

    function buildNodeIndex(nodesArg) {
      var index = {};
      var i, nodeObj;

      if (!nodesArg || !nodesArg.length) {
        return index;
      }

      for (i = 0; i < nodesArg.length; i++) {
        nodeObj = nodesArg[i];
        if (nodeObj && nodeObj.id) {
          index[nodeObj.id] = nodeObj;
        }
      }
      return index;
    }

    function resolveEndpoint(ref, nodeIndex) {
      if (ref && typeof ref === 'object' && ref.id) {
        return (nodeIndex && nodeIndex[ref.id]) || ref;
      }
      if (typeof ref === 'string') {
        return (nodeIndex && nodeIndex[ref]) || (model.findNodeById ? model.findNodeById(ref) : null);
      }
      return null;
    }

    function buildBorderFromData(nodesArg, linksArg) {
      var b = null;
      var i, nodeObj, linkObj, source, target, sx, sy, tx, ty, hw, hh, nodeIndex, x, y, x2, y2;

      nodeIndex = buildNodeIndex(nodesArg);

      if (nodesArg && nodesArg.length) {
        for (i = 0; i < nodesArg.length; i++) {
          nodeObj = nodesArg[i];
          if (!nodeObj || nodeObj.visible === false) {
            continue;
          }
          hw = getHalfW(nodeObj);
          hh = getHalfH(nodeObj);
          b = expandBorder(
            b,
            (+nodeObj.x || 0) - hw,
            (+nodeObj.y || 0) - hh,
            (+nodeObj.x || 0) + hw,
            (+nodeObj.y || 0) + hh
          );
        }
      }

      if (linksArg && linksArg.length) {
        for (i = 0; i < linksArg.length; i++) {
          linkObj = linksArg[i];
          if (!linkObj || linkObj.visible === false) {
            continue;
          }

          if (isMiniatureTimelineAxisLink(linkObj)) {
            b = expandBorder(
              b,
              Math.min(+linkObj.x1, +linkObj.x2),
              Math.min(+linkObj.y1, +linkObj.y2),
              Math.max(+linkObj.x1, +linkObj.x2),
              Math.max(+linkObj.y1, +linkObj.y2)
            );
            continue;
          }

          source = resolveEndpoint(linkObj.from || linkObj.source, nodeIndex);
          target = resolveEndpoint(linkObj.to || linkObj.target, nodeIndex);

          sx = source && isFinite(source.x) ? +source.x : null;
          sy = source && isFinite(source.y) ? +source.y : null;
          tx = target && isFinite(target.x) ? +target.x : null;
          ty = target && isFinite(target.y) ? +target.y : null;

          if (isFinite(sx) && isFinite(sy) && isFinite(tx) && isFinite(ty)) {
            b = expandBorder(
              b,
              Math.min(sx, tx),
              Math.min(sy, ty),
              Math.max(sx, tx),
              Math.max(sy, ty)
            );
          }

          x = isFinite(+linkObj.x) ? +linkObj.x : null;
          y = isFinite(+linkObj.y) ? +linkObj.y : null;
          x2 = isFinite(+linkObj.x2) ? +linkObj.x2 : null;
          y2 = isFinite(+linkObj.y2) ? +linkObj.y2 : null;

          if (isFinite(x) && isFinite(y)) {
            b = expandBorder(b, x - 16, y - 16, x + 16, y + 16);
          }
          if (isFinite(x2) && isFinite(y2)) {
            b = expandBorder(b, x2 - 16, y2 - 16, x2 + 16, y2 + 16);
          }
        }
      }

      return finalizeBorder(b);
    }

    function cloneForMini(el) {
      var clone, descendants, i, d;

      function setStrokeIfPresent(shape, color, width) {
        if (!shape) {
          return;
        }
        if (shape.hasAttribute('stroke') && shape.getAttribute('stroke') !== 'none') {
          shape.setAttribute('stroke', color);
          if (width != null) {
            shape.setAttribute('stroke-width', String(width));
          }
        }
      }

      if (!el) {
        return null;
      }

      clone = el.cloneNode(true);
      clone.removeAttribute('id');
      clone.style.pointerEvents = 'none';

      descendants = clone.querySelectorAll('*');
      for (i = 0; i < descendants.length; i++) {
        d = descendants[i];
        d.removeAttribute('id');

        if (d.tagName === 'foreignObject' || d.tagName === 'text') {
          if (d.parentNode) {
            d.parentNode.removeChild(d);
          }
          continue;
        }

        if (d.classList &&
          (
            d.classList.contains('link-count') ||
            d.classList.contains('node-label') ||
            d.classList.contains('selected')
          )) {
          if (d.parentNode) {
            d.parentNode.removeChild(d);
          }
          continue;
        }

        if (d.style) {
          d.style.pointerEvents = 'none';
          d.style.filter = 'none';
        }
        if (d.hasAttribute('filter')) {
          d.removeAttribute('filter');
        }
      }

      // ---- miniature link / axis ----
      if (clone.classList && clone.classList.contains('link')) {
        qa('line.timeline-axis, line.group-axis, path.Path, path.Marker', clone).forEach(function (shape) {
          var cls = shape.getAttribute('class') || '';

          if (cls.indexOf('Marker') >= 0) {
            shape.setAttribute('fill', '#222');
            shape.setAttribute('stroke', '#222');
            shape.setAttribute('stroke-width', '2');
          }
          else if (cls.indexOf('timeline-axis') >= 0 || cls.indexOf('group-axis') >= 0) {
            shape.setAttribute('stroke', '#222');
            shape.setAttribute('stroke-width', '6');
          }
          else {
            shape.setAttribute('stroke', '#444');
            shape.setAttribute('stroke-width', '2');
          }
        });
      }

      // ---- miniature node outline ----
      if (clone.classList && clone.classList.contains('node')) {
        qa('rect.shape-node, circle.shape-node, polygon.shape-node, path.shape-node, path.memo-node, rect.thumbnail-outline', clone)
          .forEach(function (shape) {
            var cls = shape.getAttribute('class') || '';

            if (cls.indexOf('memo-node') >= 0) {
              shape.setAttribute('stroke', '#666');
              shape.setAttribute('stroke-width', '1.8');
              return;
            }

            setStrokeIfPresent(shape, '#777', 1.8);
          });
      }

      return clone;
    }

    function appendFallbackNode(nodeObj, sceneEl) {
      var gEl, shapeEl, x, y, w, h, r, fill, stroke, shape, d;

      if (!nodeObj || nodeObj.visible === false) {
        return;
      }

      gEl = createSvgEl('g');
      gEl.setAttribute('class', 'node');
      gEl.setAttribute('transform', 'translate(' + [+(nodeObj.x || 0), +(nodeObj.y || 0)] + ')');

      fill = nodeObj.color || '#EEEFFF';
      stroke = '#555';
      shape = nodeObj.shape || 'RECTANGLE';

      if (shape === 'CIRCLE') {
        r = +(nodeObj.size && nodeObj.size.radius || 32);
        shapeEl = createSvgEl('circle');
        shapeEl.setAttribute('cx', '0');
        shapeEl.setAttribute('cy', '0');
        shapeEl.setAttribute('r', '' + r);
        shapeEl.setAttribute('fill', fill);
        shapeEl.setAttribute('stroke', stroke);
        shapeEl.setAttribute('stroke-width', '2');
      }
      else if (shape === 'MEMO') {
        w = +(nodeObj.size && nodeObj.size.width || 160);
        h = +(nodeObj.size && nodeObj.size.height || 160);
        d =
          'M' + (-w / 2) + ',' + (-h / 2) +
          ' l0,' + (4 * h / 5) +
          ' a' + (w / 10) + ',' + (h / 5) + ' 0 0,0 ' + (w / 10) + ',' + (h / 5) +
          ' l' + w + ',0' +
          ' a' + (w / 10) + ',' + (h / 5) + ' 0 0,1 -' + (w / 10) + ',-' + (h / 5) +
          ' l0,-' + (4 * h / 5) + ' z';
        shapeEl = createSvgEl('path');
        shapeEl.setAttribute('d', d);
        shapeEl.setAttribute('fill', fill);
        shapeEl.setAttribute('stroke', stroke);
        shapeEl.setAttribute('stroke-width', '2');
      }
      else {
        w = +(nodeObj.size && nodeObj.size.width || 100);
        h = +(nodeObj.size && nodeObj.size.height || 60);
        x = -w / 2;
        y = -h / 2;
        shapeEl = createSvgEl('rect');
        shapeEl.setAttribute('x', '' + x);
        shapeEl.setAttribute('y', '' + y);
        shapeEl.setAttribute('width', '' + w);
        shapeEl.setAttribute('height', '' + h);
        shapeEl.setAttribute('fill', fill);
        shapeEl.setAttribute('stroke', stroke);
        shapeEl.setAttribute('stroke-width', '2');
      }

      gEl.appendChild(shapeEl);
      sceneEl.appendChild(gEl);
    }

    function appendFallbackLink(linkObj, sceneEl, nodeIndex) {
      var source, target, sx, sy, tx, ty, pathEl, markerEl, dx, dy, len, ux, uy;
      var arrowLen = 16, arrowW = 6, bx, by, cx, cy;

      if (!linkObj || linkObj.visible === false) {
        return;
      }

      if (isMiniatureTimelineAxisLink(linkObj)) {
        pathEl = createSvgEl('line');
        pathEl.setAttribute('x1', '' + (+linkObj.x1));
        pathEl.setAttribute('y1', '' + (+linkObj.y1));
        pathEl.setAttribute('x2', '' + (+linkObj.x2));
        pathEl.setAttribute('y2', '' + (+linkObj.y2));
        pathEl.setAttribute('fill', 'none');
        pathEl.setAttribute('stroke', '#555');
        pathEl.setAttribute('stroke-width', '' + Math.max(5, Number(linkObj.size || 4)));
        pathEl.setAttribute('stroke-linecap', 'round');
        pathEl.setAttribute('opacity', '1');
        sceneEl.appendChild(pathEl);
        return;
      }

      source = resolveEndpoint(linkObj.from || linkObj.source, nodeIndex);
      target = resolveEndpoint(linkObj.to || linkObj.target, nodeIndex);

      sx = source && isFinite(source.x) ? +source.x : null;
      sy = source && isFinite(source.y) ? +source.y : null;
      tx = target && isFinite(target.x) ? +target.x : null;
      ty = target && isFinite(target.y) ? +target.y : null;

      if (!isFinite(sx) || !isFinite(sy) || !isFinite(tx) || !isFinite(ty)) {
        return;
      }

      pathEl = createSvgEl('path');
      pathEl.setAttribute('d', 'M' + sx + ',' + sy + ' L' + tx + ',' + ty);
      pathEl.setAttribute('fill', 'none');
      pathEl.setAttribute('stroke', '#444');
      pathEl.setAttribute('stroke-width', '2');
      pathEl.setAttribute('opacity', '1');
      sceneEl.appendChild(pathEl);

      dx = tx - sx;
      dy = ty - sy;
      len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0.001) {
        ux = dx / len;
        uy = dy / len;
        bx = tx - ux * arrowLen - uy * arrowW;
        by = ty - uy * arrowLen + ux * arrowW;
        cx = tx - ux * arrowLen + uy * arrowW;
        cy = ty - uy * arrowLen - ux * arrowW;

        markerEl = createSvgEl('path');
        markerEl.setAttribute('d', 'M' + tx + ',' + ty + ' L' + bx + ',' + by + ' L' + cx + ',' + cy + ' Z');
        markerEl.setAttribute('fill', '#444');
        markerEl.setAttribute('stroke', '#444');
        markerEl.setAttribute('stroke-width', '1');
        sceneEl.appendChild(markerEl);
      }
    }

    function getCanvasTransform(canvasEl) {
      var tr = canvasEl ? canvasEl.getAttribute('transform') : '';
      var m = tr && tr.match(/translate\(([-0-9.]+)[ ,]([-0-9.]+)\)\s*scale\(([-0-9.]+)\)/);
      if (m) {
        return {
          x: +m[1] || 0,
          y: +m[2] || 0,
          scale: +m[3] || 1
        };
      }
      return {
        x: 0,
        y: 0,
        scale: 1
      };
    }

    function parseViewBox(svgEl) {
      var vb = (svgEl && svgEl.getAttribute('viewBox') || '').trim().split(/\s+/);

      if (!vb || vb.length < 4) {
        return {
          left: 0,
          top: 0,
          width: svgEl ? (svgEl.clientWidth || 0) : 0,
          height: svgEl ? (svgEl.clientHeight || 0) : 0
        };
      }

      return {
        left: +vb[0] || 0,
        top: +vb[1] || 0,
        width: +vb[2] || 0,
        height: +vb[3] || 0
      };
    }

    function clamp(value, min, max) {
      if (!isFinite(min) || !isFinite(max) || max < min) {
        return value;
      }
      return Math.max(min, Math.min(max, value));
    }

    function getMiniLocalPoint(evt, miniSvg) {
      var rect = miniSvg.getBoundingClientRect();
      return {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top
      };
    }

    function getWorldPointFromMiniEvent(evt, miniSvg) {
      var local, zoom, border;

      zoom = +miniature.zoom || 1;
      border = miniature.border;
      if (!miniSvg || !border || !isFinite(zoom) || zoom <= 0) {
        return null;
      }

      local = getMiniLocalPoint(evt, miniSvg);

      return {
        localX: local.x,
        localY: local.y,
        worldX: border.left + (local.x - (+miniature.offsetH || 0)) / zoom,
        worldY: border.top + (local.y - (+miniature.offsetV || 0)) / zoom
      };
    }

    function applyMainCanvasTransform(newX, newY, k) {
      // console.log('applyMainCanvasTransform', {
      //   newX: newX,
      //   newY: newY,
      //   k: k,
      //   zoomBehavior: !!state.zoomBehavior
      // });

      var svgSel, canvasSel, t, targetMiniCanvas;

      if (window.d3) {
        svgSel = d3.select('svg#' + (state.svgId || 'draw'));
        canvasSel = d3.select('g#' + (state.canvasId || 'canvas'));

        // d3 zoom と同期して反映
        if (!svgSel.empty() && state.zoomBehavior && d3.zoomIdentity) {
          t = d3.zoomIdentity.translate(newX, newY).scale(k);
          svgSel.call(state.zoomBehavior.transform, t);
          return;
        }

        if (!canvasSel.empty()) {
          canvasSel.attr('transform', 'translate(' + newX + ',' + newY + ') scale(' + k + ')');
        }
      }

      graph.transform = {
        x: newX,
        y: newY,
        scale: k
      };

      if (common.current && common.current.page) {
        setPageTransform(common.current.page, graph.transform);
      }

      if (menu && menu.updateResetview) {
        menu.updateResetview();
      }

      targetMiniCanvas = getMiniCanvasElement();
      if (targetMiniCanvas) {
        renderToElement(targetMiniCanvas, resolveParams());
      }
    }

    function moveViewportFromMiniEvent(evt) {
      // console.log('moveViewportFromMiniEvent', {
      //   border: miniature.border,
      //   zoom: miniature.zoom,
      //   offsetH: miniature.offsetH,
      //   offsetV: miniature.offsetV
      // });

      var miniSvg = getMiniSvg();
      var drawSvg = document.getElementById(state.svgId || 'draw') || q('svg#draw');
      var canvasEl = document.getElementById(state.canvasId || 'canvas') || q('g#canvas');
      var pt, vb, tr, k, viewLeft, viewTop, viewWidth, viewHeight;
      var centerX, centerY, newLeft, newTop, newX, newY, border;

      if (!miniSvg || !drawSvg || !canvasEl || !miniature.border) {
        return;
      }

      pt = getWorldPointFromMiniEvent(evt, miniSvg);
      if (!pt) {
        return;
      }

      vb = parseViewBox(drawSvg);
      tr = getCanvasTransform(canvasEl);
      k = (+tr.scale) || 1;

      viewLeft = vb.left + ((-tr.x) / k);
      viewTop = vb.top + ((-tr.y) / k);
      viewWidth = vb.width / k;
      viewHeight = vb.height / k;

      centerX = pt.worldX - (miniDragState ? miniDragState.anchorDx : 0);
      centerY = pt.worldY - (miniDragState ? miniDragState.anchorDy : 0);

      newLeft = centerX - viewWidth / 2;
      newTop = centerY - viewHeight / 2;

      border = miniature.border;
      if (border) {
        // content が viewport より広いときだけ制限する
        if (border.width > viewWidth) {
          newLeft = clamp(newLeft, border.left, border.right - viewWidth);
        }
        // content が viewport より高いときだけ制限する
        if (border.height > viewHeight) {
          newTop = clamp(newTop, border.top, border.bottom - viewHeight);
        }
      }

      newX = -k * (newLeft - vb.left);
      newY = -k * (newTop - vb.top);

      applyMainCanvasTransform(newX, newY, k);
    }

    function onMiniMouseMove(evt) {
      if (!miniDragState || !miniDragState.active) {
        return;
      }
      evt.preventDefault();
      moveViewportFromMiniEvent(evt);
    }

    function onMiniMouseUp() {
      var miniSvg = getMiniSvg();

      miniDragState = null;
      document.removeEventListener('mousemove', onMiniMouseMove, true);
      document.removeEventListener('mouseup', onMiniMouseUp, true);

      if (miniSvg) {
        miniSvg.style.cursor = 'grab';
      }
    }

    function onMiniMouseDown(evt) {
      var miniSvg = getMiniSvg();
      var drawSvg = document.getElementById(state.svgId || 'draw') || q('svg#draw');
      var canvasEl = document.getElementById(state.canvasId || 'canvas') || q('g#canvas');
      var pt, vb, tr, k, viewLeft, viewTop, viewWidth, viewHeight, centerX, centerY;

      if (evt.button !== 0) {
        return;
      }
      if (!miniSvg || !drawSvg || !canvasEl || !miniature.border) {
        return;
      }

      evt.preventDefault();

      pt = getWorldPointFromMiniEvent(evt, miniSvg);
      if (!pt) {
        return;
      }

      vb = parseViewBox(drawSvg);
      tr = getCanvasTransform(canvasEl);
      k = (+tr.scale) || 1;

      viewLeft = vb.left + ((-tr.x) / k);
      viewTop = vb.top + ((-tr.y) / k);
      viewWidth = vb.width / k;
      viewHeight = vb.height / k;

      centerX = viewLeft + viewWidth / 2;
      centerY = viewTop + viewHeight / 2;

      // つかんだ位置を保ったままドラッグできるようにする
      miniDragState = {
        active: true,
        anchorDx: pt.worldX - centerX,
        anchorDy: pt.worldY - centerY
      };

      document.addEventListener('mousemove', onMiniMouseMove, true);
      document.addEventListener('mouseup', onMiniMouseUp, true);

      miniSvg.style.cursor = 'grabbing';

      moveViewportFromMiniEvent(evt);
    }

    function bindMiniPan(svgEl) {
      var handlers;

      if (!svgEl) {
        console.log('bindMiniPan: no svgEl');
        return;
      }

      // 以前のハンドラがあれば、いったん外す
      handlers = svgEl.__miniPanHandlers;
      if (handlers) {
        if (handlers.mousedown) {
          svgEl.removeEventListener('mousedown', handlers.mousedown, false);
        }
        if (handlers.dragstart) {
          svgEl.removeEventListener('dragstart', handlers.dragstart, false);
        }
      }

      handlers = {
        mousedown: onMiniMouseDown,
        dragstart: function (evt) {
          evt.preventDefault();
        }
      };

      svgEl.__miniPanHandlers = handlers;

      svgEl.style.cursor = 'grab';
      svgEl.style.userSelect = 'none';

      svgEl.addEventListener('mousedown', handlers.mousedown, false);
      svgEl.addEventListener('dragstart', handlers.dragstart, false);

      // console.log('bindMiniPan: bound');
    }

    function appendBackground(parentEl, width, height, fill) {
      var bg = createSvgEl('rect');
      bg.setAttribute('x', '0');
      bg.setAttribute('y', '0');
      bg.setAttribute('width', '' + width);
      bg.setAttribute('height', '' + height);
      bg.setAttribute('fill', fill || '#fcfcfc');
      bg.setAttribute('stroke', 'none');
      parentEl.appendChild(bg);
    }

    function appendViewFrame(parentEl, svgEl, canvasEl, border, zoom, offsetX, offsetY, frameFill, frameStroke) {
      var viewBox, vb, tr, k, left, top, width, height, frameEl;

      if (!parentEl || !svgEl || !border) {
        return;
      }

      viewBox = svgEl.getAttribute('viewBox');
      if (!viewBox) {
        return;
      }

      vb = viewBox.trim().split(/\s+/);
      if (!vb || vb.length < 4) {
        return;
      }

      tr = getCanvasTransform(canvasEl);
      k = +tr.scale || 1;

      left = (+vb[0]) + ((-tr.x) / k);
      top = (+vb[1]) + ((-tr.y) / k);
      width = (+vb[2]) / k;
      height = (+vb[3]) / k;

      frameEl = createSvgEl('rect');
      frameEl.setAttribute('id', 'miniFrame');
      frameEl.setAttribute('x', '' + (offsetX + (left - border.left) * zoom));
      frameEl.setAttribute('y', '' + (offsetY + (top - border.top) * zoom));
      frameEl.setAttribute('width', '' + (width * zoom));
      frameEl.setAttribute('height', '' + (height * zoom));
      frameEl.setAttribute('fill', frameFill || 'rgba(255,255,255,0.98)');
      frameEl.setAttribute('stroke', frameStroke || '#222');
      frameEl.setAttribute('stroke-width', '1');
      parentEl.appendChild(frameEl);
    }

    function addBorderMargin(border, margin) {
      if (!border) {
        return null;
      }
      margin = isFinite(+margin) ? +margin : 24;

      border.left -= margin;
      border.top -= margin;
      border.right += margin;
      border.bottom += margin;
      border.width = Math.max(1, border.right - border.left);
      border.height = Math.max(1, border.bottom - border.top);

      return border;
    }


    function buildScene(param) {
      var p = resolveParams(param);
      var svgEl = document.getElementById(p.svgId) || q('svg#' + p.svgId) || q('svg#draw');
      var canvasEl = document.getElementById(p.canvasId) || q('g#' + p.canvasId) || q('svg#draw g#canvas');
      var domNodes = p.useDataOnly ? [] : getDomNodeItems(p.nodes, canvasEl);
      var domLinks = p.useDataOnly ? [] : getDomLinkItems(p.links, canvasEl);
      var nodeIndex = buildNodeIndex(p.nodes);

      // ここを変更
      // 変更前:
      // var border = buildBorderFromDom(domNodes, domLinks);
      // if (!border) {
      //   border = buildBorderFromData(p.nodes, p.links);
      // }

      // 変更後:
      // 配置済み図形の中心を優先して miniSVG の中心を決める
      var border = buildBorderFromData(p.nodes, p.links);
      if (!border) {
        border = buildBorderFromDom(domNodes, domLinks);
      }

      var innerWidth, innerHeight, zoom, offsetX, offsetY, ratio;
      var miniSvg, miniCanvas, sceneEl, i, cloned;

      border = addBorderMargin(border, p.outerMargin);

      miniSvg = createSvgEl('svg');
      miniSvg.setAttribute('class', 'miniSvg');
      miniSvg.setAttribute('xmlns', SVG_NS);
      miniSvg.setAttribute('width', '' + p.width);
      miniSvg.setAttribute('height', '' + p.height);
      miniSvg.setAttribute('viewBox', '0 0 ' + p.width + ' ' + p.height);

      miniCanvas = createSvgEl('g');
      miniCanvas.setAttribute('class', 'miniCanvas');
      miniSvg.appendChild(miniCanvas);

      appendBackground(miniCanvas, p.width, p.height, p.backgroundFill);

      if (!border) {
        return {
          svgEl: miniSvg,
          miniCanvas: miniCanvas,
          border: null,
          zoom: 1,
          ratio: 1,
          offsetX: p.padding,
          offsetY: p.padding,
          params: p
        };
      }

      innerWidth = Math.max(1, p.width - p.padding * 2);
      innerHeight = Math.max(1, p.height - p.padding * 2);
      zoom = Math.min(innerWidth / border.width, innerHeight / border.height);
      if (!isFinite(zoom) || zoom <= 0) {
        zoom = 1;
      }

      offsetX = Math.max(p.padding, Math.round((p.width - border.width * zoom) / 2));
      offsetY = Math.max(p.padding, Math.round((p.height - border.height * zoom) / 2));
      ratio = Math.max(1, Math.ceil(1 / zoom));

      if (p.showViewFrame) {
        appendViewFrame(
          miniCanvas,
          svgEl,
          canvasEl,
          border,
          zoom,
          offsetX,
          offsetY,
          p.frameFill,
          p.frameStroke
        );
      }

      sceneEl = createSvgEl('g');
      sceneEl.setAttribute(
        'transform',
        'translate(' + [
          offsetX - border.left * zoom,
          offsetY - border.top * zoom
        ] + ') scale(' + zoom + ')'
      );

      if ((domLinks && domLinks.length) || (domNodes && domNodes.length)) {
        if (domLinks && domLinks.length) {
          for (i = 0; i < domLinks.length; i++) {
            cloned = cloneForMini(domLinks[i]);
            if (cloned) {
              sceneEl.appendChild(cloned);
            }
          }
        }
        if (domNodes && domNodes.length) {
          for (i = 0; i < domNodes.length; i++) {
            cloned = cloneForMini(domNodes[i]);
            if (cloned) {
              sceneEl.appendChild(cloned);
            }
          }
        }
      } else {
        if (p.links && p.links.length) {
          for (i = 0; i < p.links.length; i++) {
            appendFallbackLink(p.links[i], sceneEl, nodeIndex);
          }
        }
        if (p.nodes && p.nodes.length) {
          for (i = 0; i < p.nodes.length; i++) {
            appendFallbackNode(p.nodes[i], sceneEl);
          }
        }
      }

      miniCanvas.appendChild(sceneEl);

      return {
        svgEl: miniSvg,
        miniCanvas: miniCanvas,
        border: border,
        zoom: zoom,
        ratio: ratio,
        offsetX: offsetX,
        offsetY: offsetY,
        params: p
      };
    }


    function renderToElement(targetMiniCanvas, param) {
      var scene = buildScene(param);
      var builtMiniCanvas, miniSvg, miniSize;

      if (!targetMiniCanvas) {
        return scene;
      }

      clearElement(targetMiniCanvas);

      miniSvg = targetMiniCanvas.ownerSVGElement || getMiniSvg();
      if (miniSvg) {
        miniSize = getMiniSize(miniSvg, scene.params.width, scene.params.height);
        scene.params.width = +miniSize.width || scene.params.width;
        scene.params.height = +miniSize.height || scene.params.height;
        scene = buildScene(scene.params);
      }

      builtMiniCanvas = scene.miniCanvas;
      while (builtMiniCanvas.firstChild) {
        targetMiniCanvas.appendChild(builtMiniCanvas.firstChild);
      }

      miniature.width = scene.params.width;
      miniature.height = scene.params.height;
      miniature.scale = scene.ratio;
      miniature.zoom = scene.zoom;
      miniature.border = scene.border;
      miniature.offsetH = scene.offsetX;
      miniature.offsetV = scene.offsetY;
      miniature.x1 = scene.border ? scene.border.left : 0;
      miniature.y1 = scene.border ? scene.border.top : 0;

      setMiniScaleLabel(scene.ratio);
      return scene;
    }


    function serialize(param) {
      var scene = buildScene(param);
      return new XMLSerializer().serializeToString(scene.svgEl);
    }


    return {
      resolveParams: resolveParams,
      ensureMiniatureDom: ensureMiniatureDom,
      getMiniCanvasElement: getMiniCanvasElement,
      getMiniSize: getMiniSize,
      renderToElement: renderToElement,
      serialize: serialize,
      bindMiniPan: bindMiniPan
    };
  })();


  setupMiniature = function () {
    var dom = miniatureUtil.ensureMiniatureDom();
    var size;

    if (!dom) {
      return null;
    }

    size = miniatureUtil.getMiniSize(dom.svg, miniature.width || 200, miniature.height || 200);
    miniature.width = size.width;
    miniature.height = size.height;

    if (!dom.svg.getAttribute('viewBox')) {
      dom.svg.setAttribute('viewBox', '0 0 ' + miniature.width + ' ' + miniature.height);
    }
    if (!dom.svg.getAttribute('width')) {
      dom.svg.setAttribute('width', '' + miniature.width);
    }
    if (!dom.svg.getAttribute('height')) {
      dom.svg.setAttribute('height', '' + miniature.height);
    }

    miniatureUtil.bindMiniPan(dom.svg);

    return dom;
  };

  function darkenMiniatureGroupLines(root) {
    var scope = root && root.querySelectorAll
      ? root
      : document.getElementById('miniature');

    if (!scope) {
      return;
    }

    // v/h topicGroup 軸
    scope.querySelectorAll('line.group-axis-hit').forEach(function (el) {
      el.setAttribute('stroke', '#444');
      el.setAttribute('stroke-width', '6');
    });

    // timeline 軸
    scope.querySelectorAll('line.timeline-axis-hit').forEach(function (el) {
      el.setAttribute('stroke', '#444');
      el.setAttribute('stroke-width', '5');
    });

    // simpleGroup 枠
    scope.querySelectorAll('rect.group-box').forEach(function (el) {
      el.setAttribute('stroke', '#444');
      el.setAttribute('stroke-width', '2.2');
    });
  }

  drawMiniature = function (param) {
    var dom = setupMiniature();
    var p, targetMiniCanvas;

    if (!dom) {
      return;
    }

    p = miniatureUtil.resolveParams(param);
    targetMiniCanvas = miniatureUtil.getMiniCanvasElement(p.miniatureId) || dom.canvas;
    miniatureUtil.renderToElement(targetMiniCanvas, p);
    darkenMiniatureGroupLines(dom.canvas);
  };


  buildMiniatureSvgString = function (param) {
    var p = miniatureUtil.resolveParams(param);
    return miniatureUtil.serialize(p);
  };

  function getMiniatureLinks(page) {
    var links = [];
    var graphLinks = (wuwei.common && wuwei.common.graph && wuwei.common.graph.links) || [];
    var seen = {};

    function endpointId(ep) {
      if (!ep) { return null; }
      if ('string' === typeof ep) { return ep; }
      if ('object' === typeof ep) { return ep.id || null; }
      return null;
    }

    function cloneLink(link) {
      return JSON.parse(JSON.stringify(link));
    }

    function append(link) {
      if (!link || !link.id || seen[link.id]) {
        return;
      }
      seen[link.id] = true;
      links.push(link);
    }

    function buildTimelineAxisMiniLink(group) {
      var axis, anchor, orientation, length;

      if (!group || false === group.enabled) {
        return null;
      }
      if (!((group.type === 'topicGroup' || group.type === 'Group') && group.groupType === 'axis')) {
        return null;
      }

      axis = group.axis || {};
      anchor = {
        x: (axis.anchor && Number.isFinite(Number(axis.anchor.x))) ? Number(axis.anchor.x)
          : ((group.origin && Number.isFinite(Number(group.origin.x))) ? Number(group.origin.x) : 0),
        y: (axis.anchor && Number.isFinite(Number(axis.anchor.y))) ? Number(axis.anchor.y)
          : ((group.origin && Number.isFinite(Number(group.origin.y))) ? Number(group.origin.y) : 0)
      };
      orientation = ('vertical' === group.orientation) ? 'vertical' : 'horizontal';
      length = Math.max(60, Number(group.length || 480));

      return {
        id: group.axisPseudoLinkId || ('mini_axis_' + group.id),
        type: 'Link',
        pseudo: true,
        linkType: 'timeline-axis',
        groupType: 'timelineAxis',
        groupRef: group.id,
        visible: true,
        color: (group.spine && group.spine.color) || group.strokeColor || '#333',
        size: Number((group.spine && group.spine.width) || group.strokeWidth || 4),
        x1: anchor.x,
        y1: anchor.y,
        x2: ('vertical' === orientation) ? anchor.x : (anchor.x + length),
        y2: ('vertical' === orientation) ? (anchor.y + length) : anchor.y
      };
    }

    function hasTimelineAxisPseudoLink(items) {
      return (items || []).some(function (link) {
        return !!(
          link &&
          link.type === 'Link' &&
          (
            link.groupType === 'timelineAxis' ||
            link.linkType === 'timeline-axis'
          )
        );
      });
    }

    if (page && Array.isArray(page.links)) {
      ((page && page.links) || []).forEach(function (link) {
        if (link && false !== link.visible) {
          append(cloneLink(link));
        }
      });
    }
    else if (Array.isArray(graphLinks) && graphLinks.length > 0) {
      graphLinks.forEach(function (link) {
        if (link && false !== link.visible) {
          append(cloneLink(link));
        }
      });
    }

    if (!hasTimelineAxisPseudoLink(links)) {
      ((page && page.groups) || []).forEach(function (group) {
        var axisLink = buildTimelineAxisMiniLink(group);
        if (axisLink) {
          append(axisLink);
        }
      });
    }

    links = links.filter(function (link) {
      if (!link || false === link.visible) {
        return false;
      }

      if (link.linkType === 'timeline-axis' || link.groupType === 'timelineAxis') {
        return Number.isFinite(Number(link.x1)) &&
          Number.isFinite(Number(link.y1)) &&
          Number.isFinite(Number(link.x2)) &&
          Number.isFinite(Number(link.y2));
      }

      return !!(
        (endpointId(link.from) || endpointId(link.source)) &&
        (endpointId(link.to) || endpointId(link.target))
      );
    });

    return links;
  }

  function isMiniatureTimelineAxisLink(link) {
    return !!(
      link &&
      link.type === 'Link' &&
      (
        link.groupType === 'timelineAxis' ||
        link.linkType === 'timeline-axis'
      ) &&
      Number.isFinite(Number(link.x1)) &&
      Number.isFinite(Number(link.y1)) &&
      Number.isFinite(Number(link.x2)) &&
      Number.isFinite(Number(link.y2))
    );
  }

  // Window open/close
  openWindow = function (url, viewWindow) {
    closeWindow(viewWindow);
    var features = 'height=400,width=400,top=80,left=80';
    viewWindow = window.open(url, 'wuwei', features);
  };


  closeWindow = function (viewWindow) {
    if (viewWindow) {
      viewWindow.close();
    }
  };


  isNode = function (el) {
    if (el &&
      ('Node' === el.constructor.name ||
        // Segment is a real node stored in page.nodes for timeline points.
        ['Content', 'Topic', 'Memo', 'Table', 'Segment', 'PageMarker'].indexOf(el.type) >= 0)) {
      return true;
    }
    return false;
  };


  isResource = function (el) {
    if (el && 'Resource' === el.constructor.name) {
      return true;
    }
    return false;
  };


  isLink = function (el) {
    if (el &&
      ('Link' === el.constructor.name || 'Link' === el.type)) {
      return true;
    }
    return false;
  };


  getLinkPoints = function (link) {
    var
      drawing = this,
      path = link.select('.Path');
    if (!path) {
      return null;
    }
    var
      pathString = path.attr('d'),
      i,
      array = pathString
        .split(/(?=[LMQZ])/)
        .map(function (d) {
          var command = d.substr(0, 1);
          var pairsArray = [];
          var pointsArray = [];
          if ('M' === command || 'L' === command) {
            pointsArray = d.slice(1, d.length).split(',');
            for (i = 0; i < pointsArray.length; i += 2) {
              pairsArray.push([command, +pointsArray[i], +pointsArray[i + 1]]);
            }
          } else if ('Q' === command) {
            pointsArray = d.slice(1, d.length)
              .split(' ')
              .map(function (e) { return e.split(','); });
            for (i = 0; i < pointsArray.length; i += 1) {
              pairsArray.push([command, +pointsArray[i][0], +pointsArray[i][1]]);
            }
          }
          return pairsArray;
        }
        );
    var x1, y1, xC, yC, x2, y2, x, y;
    if ('L' === array[1][0][0]) {
      // M x1 y1 L x2 y2
      // x = (x1 + x2)/1; y = (y1 + y2)/2;
      x1 = array[0][0][1]; y1 = array[0][0][2];
      x2 = array[1][0][1]; y2 = array[1][0][2];
      x = (x1 + x2) / 2;
      y = (y1 + y2) / 2;
    } else if ('Q' === array[1][0][0]) {
      // M x1 y1 Q xC yC x2 y2
      // x = xC/2 + (x1 + x2)/4; y = yC/2 + (y1 + y2)/4;
      x1 = array[0][0][1]; y1 = array[0][0][2];
      xC = array[1][0][1]; yC = array[1][0][2];
      x2 = array[1][1][1]; y2 = array[1][1][2];
      x = xC / 2 + (x1 + x2) / 4;
      y = yC / 2 + (y1 + y2) / 4;
    } else {
      return null;
    }
    var parsed = [[x1, y1], [x, y], [x2, y2]];
    return parsed;
  };


  copyObject = function (from_data, to_data) {
    var
      self = this;
    if (undefined === to_data) {
      to_data = {};
    }
    if (undefined === from_data ||
      null === from_data) {
      return to_data;
    }
    if (to_data !== from_data) {
      if ('number' === typeof from_data ||
        'string' === typeof from_data ||
        'boolean' === typeof from_data) {
        to_data = from_data;
      } else if ('[object Array]' === Object.prototype.toString.call(from_data)) {
        to_data = from_data.slice(0);
      } else if ('[object Object]' === Object.prototype.toString.call(from_data)) {
        Object.keys(from_data).forEach(function (key) {
          if (from_data.hasOwnProperty(key) &&
            to_data[key] !== from_data[key]) {
            if (undefined !== from_data[key] ||
              null !== from_data[key] ||
              'number' === typeof from_data[key] ||
              'string' === typeof from_data[key] ||
              'boolean' === typeof from_data[key]) {
              to_data[key] = from_data[key];
            } else if ('[object Array]' === Object.prototype.toString.call(from_data[key])) {
              to_data[key] = from_data[key].slice(0);
            } else if ('[object Object]' === Object.prototype.toString.call(from_data[key])) {
              to_data[key] = copyObject(from_data[key], to_data[key]);
            }
          }
        });
      }
    }
    return to_data;
  };


  updateObject = function (from_data, to_data) {
    var
      self = this;
    if (undefined === to_data) {
      to_data = {};
    }
    if (undefined === from_data ||
      null === from_data) {
      return to_data;
    }
    if (to_data !== from_data) {
      if ('number' === typeof from_data ||
        'string' === typeof from_data ||
        'boolean' === typeof from_data) {
        to_data = from_data;
      } else if ('[object Array]' === Object.prototype.toString.call(from_data)) {
        to_data = from_data.slice(0);
      } else if ('[object Object]' === Object.prototype.toString.call(from_data)) {
        Object.keys(to_data).forEach(function (key) {
          if (from_data.hasOwnProperty(key) &&
            to_data[key] !== from_data[key]) {
            if (undefined !== from_data[key] ||
              null !== from_data[key] ||
              'number' === typeof from_data[key] ||
              'string' === typeof from_data[key] ||
              'boolean' === typeof from_data[key]) {
              to_data[key] = from_data[key];
            } else if ('[object Array]' === Object.prototype.toString.call(from_data[key])) {
              to_data[key] = from_data[key].slice(0);
            } else if ('[object Object]' === Object.prototype.toString.call(from_data[key])) {
              to_data[key] = updateObject(from_data[key], to_data[key]);
            }
          }
        });
      }
    }
    return to_data;
  };


  toArray = function (object) {
    var
      self = this;
    var
      array = [],
      element;
    if (notEmpty(object)) {
      Object.keys(object).forEach(function (key) {
        element = object[key];
        append(array, element);
      });
    } else {
      array = [];
    }
    return array;
  };


  getLineHeight = function (element) {
    // cf. http://stackoverflow.com/questions/4392868/javascript-find-divs-line-height-not-css-property-but-actual-line-height
    var temp = document.createElement(element.nodeName);
    temp.setAttribute('style',
      'margin:0px;padding:0px;font-family:' + element.style.fontFamily +
      ';font-size:' + element.style.fontSize);
    temp.innerHTML = 'いろは';
    temp = element.parentNode.appendChild(temp);
    var ret = temp.clientHeight;
    temp.parentNode.removeChild(temp);
    return ret;
  };


  getEmSize = function (element) {
    return Number(
      getComputedStyle(element, '').fontSize.match(/\d*\.?\d*/)[0]
    );
  };


  checkPDF = function (uri) {
    uri = uri.toLowerCase();
    let match = uri.match(/.*(.pdf)/);
    if (match) {
      return common.mimeTypes[match[1]];
    }
    return null;
  }


  checkOffice = function (uri) {
    uri = uri.toLowerCase();
    let match = uri.match(/.*(.docx)/) ||
      uri.match(/.*(.pptx)/) ||
      uri.match(/.*(.xlsx)/);
    if (match) {
      return common.mimeTypes[match[1]];
    }
    return null;
  }


  checkImage = function (uri) {
    uri = uri.toLowerCase();
    let match = uri.match(/.*(.tiff)/) || uri.match(/.*(.tif)/) ||
      uri.match(/.*(.jpeg)/) || uri.match(/.*(.jpg)/) ||
      uri.match(/.*(.png)/);
    if (match) {
      return common.mimeTypes[match[1]];
    }
    return null;
  }


  checkMP3 = function (uri) {
    uri = uri.toLowerCase();
    let match = uri.match(/.*(.mp3)/);
    if (match) {
      return common.mimeTypes[match[1]];
    }
    return null;
  }


  checkMOV = function (uri) {
    uri = uri.toLowerCase();
    let match = uri.match(/.*(.mov)/);
    if (match) {
      return common.mimeTypes[match[1]];
    }
    return null;
  }


  pushUniqueItem = function (list, item) {
    if (!list.includes(item)) {
      list.push(item);
    }
  }


  function closestColor(rgbCode, colorPalette) {
    /**
     * この関数は、与えられた色とパレット内の各色との間の距離を計算し、最も近い色を見つけます。
     * 距離の計算にはユークリッド距離を使用します。
     * この関数は、指定した16進RGBコードとパレット内のすべての色との間の距離を計算し、最も距離が近い色の名前を返します。
     * ユークリッド距離の計算は色空間内の2点間の直線距離を表します。
     * 使用方法としては、closestColor関数に検索したい16進RGBコードと色パレットを引数として渡します。
     * 戻り値は、与えられた色に最も近い色の名前です。
     * // Usage
     * console.log(closestColor("#3e82fc", colorPalette)); // returns the closest color name
     */
    // Convert hex to RGB first
    var r = parseInt(rgbCode.slice(1, 3), 16),
      g = parseInt(rgbCode.slice(3, 5), 16),
      b = parseInt(rgbCode.slice(5, 7), 16);

    // Then to Rgb string
    var rgb = `rgb(${r}, ${g}, ${b})`;

    var minDistance = Infinity;
    var closestColorName = '';
    var colorPalette = common.colorPalette;
    for (const colorName in colorPalette) {
      const paletteColor = colorPalette[colorName]
        .replace(/[^\d,]/g, '')
        .split(',');

      const paletteR = parseInt(paletteColor[0]);
      const paletteG = parseInt(paletteColor[1]);
      const paletteB = parseInt(paletteColor[2]);

      // calculate Euclidean distance between the target color and the color from the palette
      const distance = Math.sqrt(
        (r - paletteR) ** 2 + (g - paletteG) ** 2 + (b - paletteB) ** 2
      );

      if (distance < minDistance) {
        minDistance = distance;
        closestColorName = colorName;
      }
    }

    return closestColorName;
  }


  function getFontSizeLabel(fontSize) {
    for (var i = 0; i < common.fontSizes.length; i++) {
      if (common.fontSizes[i].value === fontSize) {
        return common.fontSizes[i].label;
      }
    }

    return 'Unknown';
  }


  isLocalHost = function () {
    const host = (window.location.hostname || '').toLowerCase();
    return (
      host === 'localhost' ||
      host === '127.0.0.1'
    );
  };


  getAction = function (name) {
    if (isLocalHost()) {
      return `/wu_wei2/cgi-bin/${name}.py`;
    }
    return `/wu_wei2/server/${name}.cgi`;
  };


  getServerUrl = function (name) {
    const
      origin = window.location.origin,
      action = getAction(name);
    return `${origin}${action}`;
  };


  isOfficeDocument = function (format) {
    const fmt = (format || '').toLowerCase();
    return (
      fmt.indexOf('application/vnd.openxmlformats-officedocument.wordprocessingml') === 0 ||
      fmt.indexOf('application/vnd.openxmlformats-officedocument.spreadsheetml') === 0 ||
      fmt.indexOf('application/vnd.openxmlformats-officedocument.presentationml') === 0 ||
      fmt.indexOf('application/msword') === 0 ||
      fmt.indexOf('application/vnd.ms-excel') === 0 ||
      fmt.indexOf('application/vnd.ms-powerpoint') === 0
    );
  };


  getOfficeIcon = function (format) {
    const fmt = (format || '').toLowerCase();

    if (
      fmt.indexOf('presentationml') >= 0 ||
      fmt.indexOf('ms-powerpoint') >= 0 ||
      fmt.indexOf('powerpoint') >= 0
    ) {
      return 'fa-file-powerpoint';
    }
    if (
      fmt.indexOf('spreadsheetml') >= 0 ||
      fmt.indexOf('ms-excel') >= 0 ||
      fmt.indexOf('excel') >= 0
    ) {
      return 'fa-file-excel';
    }
    if (
      fmt.indexOf('wordprocessingml') >= 0 ||
      fmt.indexOf('application/msword') === 0 ||
      fmt.indexOf('word') >= 0
    ) {
      return 'fa-file-word';
    }
    return 'fa-file';
  };


  var asciidoctorProcessor = null;

  function getAsciidoctorProcessor() {
    if (!asciidoctorProcessor) {
      if (window.asciidoctor && typeof window.asciidoctor.convert === 'function') {
        asciidoctorProcessor = window.asciidoctor;
      }
      else if (window.Asciidoctor && typeof window.Asciidoctor === 'function') {
        try {
          asciidoctorProcessor = window.Asciidoctor();
        }
        catch (err) {
          console.error('getAsciidoctorProcessor: Asciidoctor init failed', err);
          return null;
        }
      }
      else {
        return null;
      }
    }
    return asciidoctorProcessor;
  }

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function sanitizeHtml(html) {
    if (window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
      return window.DOMPurify.sanitize(html, {
        USE_PROFILES: { html: true }
      });
    }
    return html;
  }

  function hasHtmlIgnoringAsciiDoc(text) {
    let s = String(text || '');

    // 1) Remove code blocks first
    s = s
      .replace(/^\[source[^\]]*\]\s*$(?:\r?\n)?^-{4,}[\s\S]*?^-{4,}\s*$/gm, ' ')
      .replace(/^`{3,}[\s\S]*?^`{3,}\s*$/gm, ' ');

    // 2) Remove AsciiDoc cross references: <<ref>>, <<ref,label>>
    s = s.replace(/<<[^>\r\n]+>>/g, ' ');

    // 3) Remove inline macros such as:
    //    link:...[], xref:...[], image:...[], footnote:[...], pass:[...]
    s = s.replace(
      /\b(?:link|xref|image|footnote|pass|kbd|btn|menu):[^\s\[]+\[[^\]]*]/g,
      ' '
    );

    // 4) Remove block attributes and admonition labels
    //    [source,js], [NOTE], [IMPORTANT], etc.
    s = s
      .replace(/^\[[^\]\r\n]+\]\s*$/gm, ' ')
      .replace(/^(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION):.*$/gm, ' ');

    // 5) Remove headings, list markers, and line continuation markers
    s = s
      .replace(/^=+\s+/gm, '')
      .replace(/^[*.-]+\s+/gm, '')
      .replace(/[ \t]\+\s*$/gm, '');

    // 6) Now test for actual HTML-like tags
    return /<\/?[a-z][a-z0-9:-]*(?:\s+[^<>]*?)?\s*\/?>/i.test(s);
  }

  function looksLikeHtml(text) {
    return hasHtmlIgnoringAsciiDoc(text)
    // return /<\/?[a-z][\s\S]*>/i.test(String(text || ''));
  }

  function plainTextToHtml(text) {
    return '<pre class="plainText">' + escapeHtml(text || '') + '</pre>';
  }


  function renderAsciiDoc(source, options) {
    var text = String(source || '');
    var opts = options || {};
    var processor;
    var html;
    var attrs;

    if (!text.trim()) {
      return '';
    }

    if (opts.allowHtml !== false && looksLikeHtml(text)) {
      return sanitizeHtml(text);
    }

    attrs = Object.assign(
      { icons: 'font' },
      opts.attributes || {}
    );

    if (opts.showtitle === true) {
      attrs.showtitle = true;
    } else if (opts.showtitle === false) {
      delete attrs.showtitle;
    }

    try {
      processor = getAsciidoctorProcessor();
      if (processor) {
        html = processor.convert(text, {
          safe: 'secure',
          standalone: false,
          attributes: attrs
        });

        if (window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
          html = window.DOMPurify.sanitize(html, {
            USE_PROFILES: { html: true }
          });
        }
        return html;
      }
    }
    catch (err) {
      console.error('renderAsciiDoc failed:', err);
    }

    if (window.wuwei &&
      wuwei.edit &&
      typeof asciiDocToHtml === 'function') {
      try {
        html = asciiDocToHtml(text);

        if (window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
          html = window.DOMPurify.sanitize(html, {
            USE_PROFILES: { html: true }
          });
        }
        return html;
      }
      catch (err2) {
        console.error('fallback asciiDocToHtml failed:', err2);
      }
    }

    return plainTextToHtml(text);
  }

  function getNodeAsciiDocSource(node) {
    if (!node) {
      return '';
    }
    if (typeof node.value === 'string' && node.value.trim()) {
      return node.value;
    }
    return '';
  }

  function asciiDocToHtml(asciiDocText) {
    function asciiDoc_format(line) {
      /**
      In AsciiDoc, you can apply formatting to text using various symbols and markers. 
      Here are some common formatting options:
      */
      // 1. <b> Bold Text:
      //   To make text bold, enclose it in double asterisks (`**`).
      line = line.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
      // 2. <i> Italic Text:
      //   To make text italic, enclose it in single asterisks (*) or single underscores (_).
      line = line.replace(/_(.*?)_/g, '<i>$1</i>');
      // 3. <u> Underline Text:
      //   To underline text, enclose it in plus signs (+).
      line = line.replace(/\+(.*?)\+/g, '<u>$1</u>');
      // 4. <del> Strikethrough Text:
      //   To strike through text, enclose it in double tildes (`~~`).
      line = line.replace(/~~(.*?)~~/g, '<del>$1</del>');
      // 5. <sup> Superscript and <sub> Subscript:
      //   You can use caret (`^`) for superscript and tilde (`~`) for subscript.
      // 5a. Superscript (^)
      line = line.replace(/\^(.*?)\^/g, '<sup>$1</sup>');
      // 5b. Subscript (~)
      line = line.replace(/~(.*?)~/g, '<sub>$1</sub>');

      return line;
    }

    function escapeHtml(unsafe) {
      let safetext = unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
      return asciiDoc_format(safetext);
    }

    function clearNthList(html) {
      if (nthList.length > 0) {
        let last = nthList.pop();
        html += `</${last}>`;
      }
      return html;
    }

    if (!asciiDocText) {
      return '';
    }

    let lines = asciiDocText.split('\n');
    let html = '';
    let inPBlock = false;
    let inCodeBlock = false;
    let codeLanguage = '';
    let startCodeBlock = false;
    let inLi = false;
    const nthList = [];
    for (let line of lines) {
      if (line.endsWith('+') && !inCodeBlock) {
        if (html.endsWith('<p>')) {
          html = html.slice(0, -3); // Remove the <p> tag added in the previous line
        }
        html += '<p>' + escapeHtml(line.slice(0, -1)) + '<br>'; // Add <br> for line continuation
        inPBlock = true;
        continue;
      }

      if (line.startsWith('----')) {
        if (startCodeBlock) {
          startCodeBlock = false;
        } else if (inCodeBlock) {
          html += `</code></pre>`;
          inCodeBlock = false;
        } else {
          startCodeBlock = true;
        }
        continue;
      }

      if (inCodeBlock) {
        html += escapeHtml(line) + '<br>';
        continue;
      }

      if (line.startsWith('[source,')) {
        html = clearNthList(html);
        const sourceParts = line.match(/^\[source,(.*?)\]/);
        if (sourceParts && sourceParts.length > 1) {
          codeLanguage = sourceParts[1].trim();
          html += `<pre><code class="${codeLanguage}">`;
          inCodeBlock = true;
          startCodeBlock = true;
        } else {
          // Handle invalid [source, ] block
          html += escapeHtml(line) + '<br>';
        }
        continue;
      }

      if (line.startsWith('=')) {
        // Handle header
        let depth = 0;
        while (line.startsWith('=')) {
          depth++;
          line = line.substr(1).trim();
        }
        html += `<h${depth}>${escapeHtml(line)}</h${depth}>`;
      } else if (line.startsWith('*')) {
        // Handle unordered list item
        let depth = 0;
        while (line.startsWith('*')) {
          depth++;
          line = line.substr(1).trim();
        }
        if (depth <= nthList.length) {
          while (nthList.length > depth) {
            let last = nthList.pop();
            html += `</${last}>`;
          }
        }
        if ('ul' == nthList[depth - 1]) {
          html += `<li>${escapeHtml(line)}</li>`;
        } else {
          html += `<ul><li>${escapeHtml(line)}</li>`;
        }
        nthList[depth - 1] = 'ul';
      } else if (line.startsWith('.')) {
        // Handle ordered list item
        let depth = 0;
        while (line.startsWith('.')) {
          depth++;
          line = line.substr(1).trim();
        }
        /*
        Default type by level:
        1: 1(numeric), 2: a(alpha), 3: i(roman)
        */
        let olClass, olType;
        switch (depth) {
          case 1:
            olClass = 'numeric'; olType = '1'; break;
          case 2:
            olClass = 'alpha'; olType = 'a'; break;
          case 2:
            olClass = 'roman'; olType = 'i'; break;
          default:
            olClass = 'numeric'; olType = '1';
        }
        if (depth <= nthList.length) {
          while (nthList.length > depth) {
            let last = nthList.pop();
            html += `</${last}>`;
          }
        }
        if ('ol' == nthList[depth - 1]) {
          html += `<li>${escapeHtml(line)}</li>`;
        } else {
          /**
          Here are some other common type attribute values for ordered lists:
            1: Use Arabic numerals (default). .numeric
            a: Use lowercase letters for labeling items. .loweralpha
            i: Use lowercase Roman numerals for labeling items. .lowerroman
            A: Use uppercase letters for labeling items. .upperalpha
            I: Use uppercase Roman numerals for labeling items. .upperroman
          */
          html += `<ol class="${olClass}" type="${olType}"><li>${escapeHtml(line)}</li>`;
        }
        nthList[depth - 1] = 'ol';
      } else {
        line = line.trim();
        if (line.length > 0) {
          if (inPBlock) {
            html += `${escapeHtml(line.trim())}</p>`;
            inPBlock = false;
          } else {
            html += `<p>${escapeHtml(line.trim())}</p>`;
          }
        } else {
          html = clearNthList(html);
          html += '<br>';
        }
      }
    }

    if (inCodeBlock) {
      html += `</code></pre>`;
    }

    while (nthList.length > 0) {
      let last = nthList.pop();
      html += `</${last}>`;
    }

    return html;
  }

  function htmlToAsciiDoc(htmlText) {
    if (!htmlText) {
      return '';
    }

    function unescapeHtml(escapedText) {
      return escapedText
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, "\"")
        .replace(/&#039;/g, "'");
    }

    function processNode(node, level, asciiDocLines) {
      let text = '';
      if (node.nodeType === Node.ELEMENT_NODE) {
        text = node.innerHTML.trim();
        text = getNodeText(text);
        const tagName = node.tagName.toLowerCase();
        switch (tagName) {
          case 'h1':
            asciiDocLines.push(`= ${text}`);
            break;
          case 'h2':
            asciiDocLines.push(`== ${text}`);
            break;
          case 'h3':
            asciiDocLines.push(`=== ${text}`);
            break;
          case 'h4':
            asciiDocLines.push(`==== ${text}`);
            break;
          case 'h5':
            asciiDocLines.push(`===== ${text}`);
            break;
          case 'h6':
            asciiDocLines.push(`====== ${text}`);
            break;
          case 'ul':
            processList(node, level, asciiDocLines, '*'.repeat(level));
            break;
          case 'ol':
            processList(node, level, asciiDocLines, '.'.repeat(level));
            break;
          case 'pre':
            const codeElement = node.querySelector('code');
            if (codeElement) {
              const codeLanguage = codeElement.className;
              asciiDocLines.push(`[source,${codeLanguage}]`);
              asciiDocLines.push('----');
              const codeLines = codeElement.innerHTML.split('<br>');
              const unescapedCodeLines = codeLines.map(line => unescapeHtml(line));
              asciiDocLines.push(...unescapedCodeLines);
              asciiDocLines.push('----');
            }
            break;
          case 'p':
            asciiDocLines.push(text);
            break;
          case 'br':
            asciiDocLines.push('');
            break;
          default:
            // Handle other HTML tags as plain text
            asciiDocLines.push(node.outerHTML);
            break;
        }
      } else if (node.nodeType === Node.TEXT_NODE) {
        text = node.textContent.trim();
        text = getNodeText(text);
        asciiDocLines.push(text);
      }
    }

    function processList(node, level, asciiDocLines, marker) {
      let text = '';
      level += 1;
      for (const childNode of node.childNodes) {
        if (childNode.nodeType === Node.ELEMENT_NODE) {
          text = childNode.textContent.trim();
          text = getNodeText(text);
          let tagName = childNode.tagName;
          tagName = tagName.toLowerCase();
          switch (tagName) {
            case 'ul':
              processList(childNode, level, asciiDocLines, '*'.repeat(level));
              break;
            case 'ol':
              processList(childNode, level, asciiDocLines, '.'.repeat(level));
              break;
            case 'li':
              asciiDocLines.push(`${marker} ${text}`);
              break;
            case 'p':
              asciiDocLines.push(text);
              break;
          }
        } else if (childNode.nodeType === Node.TEXT_NODE) {
          text = childNode.textContent.trim();
          text = getNodeText(text);
          asciiDocLines.push(text);
        }
      }
    }

    function getNodeText(text) {
      let _text = '';
      if (typeof text === 'string') {
        // Reversing the formatting options from HTML to AsciiDoc
        _text = text.replace(/<b>(.*?)<\/b>/g, '**$1**');     // Bold Text
        _text = _text.replace(/<i>(.*?)<\/i>/g, '*$1*');       // Italic Text
        _text = _text.replace(/<u>(.*?)<\/u>/g, '+$1+');       // Underline Text
        _text = _text.replace(/<del>(.*?)<\/del>/g, '~~$1~~'); // Strikethrough Text
        _text = _text.replace(/<sup>(.*?)<\/sup>/g, '^$1^');   // Superscript
        _text = _text.replace(/<sub>(.*?)<\/sub>/g, '~$1~');   // Subscript
        // Replace <br> with '' +\n'
        text = text.replace(/<br>/g, ' +\n');
      } else if (text.nodeType === Node.ELEMENT_NODE) {
        _text = text.textContent.trim();
        _text = getNodeText(_text)
      }
      return _text;
    }

    // Remove newline characters ('\n') using regular expression
    let txtContent = htmlText.replace(/\n/g, '');
    // Create a temporary div element
    const tempDiv = document.createElement('div');
    // Set the updated text content back to the element            
    tempDiv.innerHTML = txtContent;
    // Process the child nodes of tempDiv
    const asciiDocLines = [];
    let level = 1;
    for (const childNode of tempDiv.childNodes) {
      if (childNode.nodeType === Node.ELEMENT_NODE || childNode.nodeType === Node.TEXT_NODE) {
        processNode(childNode, level, asciiDocLines);
      }
    }

    // Join the lines and set them as the output
    const asciiDoc = asciiDocLines.join('\n');
    return asciiDoc;
  }


  getPageTransform = function (page) {
    var target = page || (common.current && common.current.page);
    if (!target) {
      return { x: 0, y: 0, scale: 1 };
    }
    if (!target.transform || 'object' !== typeof target.transform) {
      if (target.translate && 'object' === typeof target.translate) {
        target.transform = {
          x: Number(target.translate.x || 0),
          y: Number(target.translate.y || 0),
          scale: Number(target.translate.scale || 1) || 1
        };
      } else {
        target.transform = { x: 0, y: 0, scale: 1 };
      }
    }
    return target.transform;
  };

  setPageTransform = function (page, transform) {
    var target = page || (common.current && common.current.page);
    var next = transform || { x: 0, y: 0, scale: 1 };
    if (!target) {
      return { x: Number(next.x || 0), y: Number(next.y || 0), scale: Number(next.scale || 1) || 1 };
    }
    target.transform = {
      x: Number(next.x || 0),
      y: Number(next.y || 0),
      scale: Number(next.scale || 1) || 1
    };
    return target.transform;
  };

  getNodeHidden = function (node) {
    return !!(node && node.visible === false);
  };

  getLinkHidden = function (link) {
    return !!(link && link.visible === false);
  };

  isShown = function (obj) {
    return !!(obj && obj.visible !== false && !obj.filterout);
  };

  setHidden = function (obj, hidden) {
    if (!obj || 'object' !== typeof obj) { return obj; }
    obj.visible = !hidden;
    return obj;
  };

  getNodeShape = function (node) {
    return (node && node.shape) ? node.shape : 'RECTANGLE';
  };

  getNodeSize = function (node) {
    return (node && node.size && 'object' === typeof node.size) ? node.size : {};
  };

  getCurrentUserId = function () {
    var cu = (state && state.currentUser) || {};
    return String(cu.user_id || getCookie('wuwei_user_id') || '').trim();
  };

  toStorageRelativePath = function (uriOrPath, userId, area) {
    var text = String(uriOrPath || '').replace(/\\/g, '/').trim();
    var uid = String(userId || getCurrentUserId() || '').trim();
    var areaName = String(area || '').replace(/^\/+|\/+$/g, '');
    var idx, m, parsedUrl, queryPath, queryArea;

    if (!text || /^(?:https?:)?\/\//i.test(text) && !/^https?:\/\/(?:localhost|127\.0\.0\.1|[^/]+)\/wu_wei2\//i.test(text)) {
      return text;
    }

    try {
      if (/^https?:\/\//i.test(text) || text.indexOf('?') >= 0) {
        parsedUrl = new URL(text, window.location.href);
        queryPath = parsedUrl.searchParams.get('path');
        queryArea = parsedUrl.searchParams.get('area');
        if (queryPath) {
          if (!areaName && queryArea) {
            areaName = queryArea;
          }
          return String(queryPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
        }
        text = parsedUrl.pathname;
      }
    }
    catch (e) { /* keep the raw value */ }

    idx = text.indexOf('/wu_wei2/');
    if (idx >= 0) {
      text = text.slice(idx + '/wu_wei2/'.length);
    }

    text = text.replace(/^\/+/, '');
    text = text.replace(/^data\//, '');

    if (uid && text.indexOf(uid + '/') === 0) {
      text = text.slice(uid.length + 1);
    }

    m = text.match(/^(upload|resource|note|thumbnail|content)\/(.+)$/);
    if (m) {
      text = m[2];
      if (uid && text.indexOf(uid + '/') === 0) {
        text = text.slice(uid.length + 1);
      }
    }

    if (areaName && text.indexOf(areaName + '/') === 0) {
      text = text.slice(areaName.length + 1);
    }

    return text.replace(/^\/+/, '');
  };

  toPublicResourceUri = function (area, relativePath, userId) {
    var areaName = String(area || '').replace(/^\/+|\/+$/g, '');
    var uid = String(userId || getCurrentUserId() || '').trim();
    var path = String(relativePath || '').replace(/\\/g, '/').trim();
    var m, query;

    if (!path || /^https?:\/\//i.test(path)) {
      return path;
    }
    if (path.indexOf('/wu_wei2/data/') >= 0) {
      path = path.replace(/^.*\/wu_wei2\/data\//, '');
    } else if (path.indexOf('/wu_wei2/') >= 0) {
      path = path.replace(/^.*\/wu_wei2\//, '');
    }
    path = path.replace(/^\/+/, '');
    if (path.indexOf('data/') === 0) {
      path = path.slice('data/'.length);
    }
    if (uid && path.indexOf(uid + '/') === 0) {
      path = path.slice(uid.length + 1);
    }
    if (!areaName) {
      m = path.match(/^(upload|resource|note|thumbnail|content)\/(.+)$/);
      if (m) {
        areaName = m[1];
        path = m[2];
      } else {
        return path;
      }
    }
    if (path.indexOf(areaName + '/') === 0) {
      path = path.slice(areaName.length + 1);
    }
    if (uid && path.indexOf(uid + '/') === 0) {
      path = path.slice(uid.length + 1);
    }
    path = toStorageRelativePath(path, uid, areaName);
    if (!path || path.indexOf('..') >= 0) {
      return '';
    }
    query = '?area=' + encodeURIComponent(areaName) +
      '&path=' + encodeURIComponent(path);
    if (uid) {
      query += '&user_id=' + encodeURIComponent(uid);
    }
    return getServerUrl('load-file') + query;
  };

  getResourceFile = function (resource, role) {
    var storage = (resource && resource.storage && 'object' === typeof resource.storage) ? resource.storage : {};
    var files = Array.isArray(storage.files) ? storage.files : [];
    var expected = String(role || '').toLowerCase();
    var i, file;

    for (i = 0; i < files.length; i += 1) {
      file = files[i] || {};
      if (String(file.role || '').toLowerCase() === expected) {
        return file;
      }
    }
    return null;
  };

  function chooseResourceFilePathValue(file) {
    var candidates = [
      file && file.path,
      file && file.sourcePath,
      file && file.uri,
      file && file.url
    ];
    var fallback = '';
    var text, i;

    for (i = 0; i < candidates.length; i += 1) {
      text = String(candidates[i] || '').replace(/\\/g, '/').trim();
      if (!text) {
        continue;
      }
      if (!fallback) {
        fallback = text;
      }
      if (/^(?:cgi-bin|server)\/load-file\.(?:py|cgi)\?/i.test(text) ||
        /^\d{4}\/\d{2}(?:\/\d{2})?\//.test(text) ||
        /\/wu_wei2\/data\//.test(text) ||
        /\/wu_wei2\//.test(text) ||
        /(?:^|\/)(upload|resource|note|thumbnail|content)\//.test(text)) {
        return text;
      }
    }

    return fallback;
  }

  function getResourceOwnerUserId(resource, node) {
    var audit = (resource && resource.audit && 'object' === typeof resource.audit) ? resource.audit : {};
    var rights = (resource && resource.rights && 'object' === typeof resource.rights) ? resource.rights : {};
    var storage = (resource && resource.storage && 'object' === typeof resource.storage) ? resource.storage : {};
    var files = Array.isArray(storage.files) ? storage.files : [];
    var currentUid = String(getCurrentUserId() || '').trim();
    var kind = String(resource && resource.kind || '').toLowerCase();
    var isManagedUpload = kind === 'upload';
    var explicitOwner = String(
      resource && resource.owner ||
      rights.owner ||
      audit.owner ||
      audit.createdBy ||
      ''
    ).trim();
    var i;

    for (i = 0; !isManagedUpload && i < files.length; i += 1) {
      if (files[i] && String(files[i].area || '').toLowerCase() === 'upload') {
        isManagedUpload = true;
      }
    }

    if (isManagedUpload) {
      return explicitOwner || currentUid;
    }

    return String(
      audit.owner ||
      audit.createdBy ||
      rights.owner ||
      (node && node.audit && (node.audit.owner || node.audit.createdBy)) ||
      currentUid ||
      ''
    ).trim();
  }

  getResourceFileUri = function (resource, role, node) {
    var file = getResourceFile(resource, role);
    var area, path, raw, uid;

    if (!file) {
      return '';
    }

    raw = chooseResourceFilePathValue(file);
    if (!raw) {
      return '';
    }
    if (/^https?:\/\//i.test(raw) && raw.indexOf('/wu_wei2/') < 0) {
      return raw;
    }

    area = String(file.area || '').trim();
    if (!area) {
      area = (String(role || '').toLowerCase() === 'original') ? 'upload' : 'note';
    }
    uid = getResourceOwnerUserId(resource, node);
    path = toStorageRelativePath(raw, uid, area);
    return toPublicResourceUri(area, path, uid);
  };

  getResourceFilePath = function (resource, role, node) {
    var file = getResourceFile(resource, role);
    var area, raw, uid;

    if (!file) {
      return '';
    }

    raw = chooseResourceFilePathValue(file);
    if (!raw) {
      return '';
    }
    if (/^https?:\/\//i.test(raw) && raw.indexOf('/wu_wei2/') < 0) {
      return raw;
    }

    area = String(file.area || '').trim();
    if (!area) {
      area = (String(role || '').toLowerCase() === 'original') ? 'upload' : 'note';
    }
    uid = getResourceOwnerUserId(resource, node);
    return toStorageRelativePath(raw, uid, area);
  };

  getResourcePreviewUri = function (node) {
    var resource = getResource(node);
    var viewer = (resource && resource.viewer && 'object' === typeof resource.viewer) ? resource.viewer : {};
    var embed = (viewer.embed && 'object' === typeof viewer.embed) ? viewer.embed : {};
    var snapshotSources = (resource && resource.snapshotSources && 'object' === typeof resource.snapshotSources) ? resource.snapshotSources : {};
    var uid = getResourceOwnerUserId(resource, node);
    var originalFile = getResourceFile(resource, 'original');
    var originalMime = String(
      originalFile && originalFile.mimeType ||
      resource && resource.mimeType ||
      resource && resource.media && resource.media.mimeType ||
      ''
    ).toLowerCase();
    var originalUri;
    function legacyUploadUri(filename) {
      var date = String(resource && resource.date || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
      var id = String(resource && resource.id || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
      var file = String(filename || resource && resource.file || '').replace(/\\/g, '/').split('/').pop();
      if (!date || !id || !file) {
        return '';
      }
      return toPublicResourceUri('upload', date + '/' + id + '/' + file, uid);
    }
    function localUri(value, area) {
      var text = String(value || '').replace(/\\/g, '/').trim();
      if (!text || /^https?:\/\//i.test(text) && text.indexOf('/wu_wei2/') < 0) {
        return text;
      }
      if (/^(?:cgi-bin|server)\/load-file\.(?:py|cgi)\?/i.test(text) ||
        /^\d{4}\/\d{2}\/\d{2}\//.test(text)) {
        return toPublicResourceUri(area, toStorageRelativePath(text, uid, area), uid);
      }
      if (text.indexOf(area + '/') === 0 || text.indexOf('/' + area + '/') >= 0) {
        return toPublicResourceUri(area, toStorageRelativePath(text, uid, area), uid);
      }
      return text;
    }
    if (originalMime.indexOf('application/pdf') === 0) {
      originalUri = getResourceFileUri(resource, 'original', node) || legacyUploadUri();
      if (originalUri) {
        return originalUri;
      }
    }
    return String(
      getResourceFileUri(resource, 'preview', node) ||
      localUri(embed.uri, 'resource') ||
      localUri(snapshotSources.previewUri, 'resource') ||
      localUri(resource.uri, 'upload') ||
      localUri(resource.canonicalUri, 'upload') ||
      getResourceFileUri(resource, 'original', node) ||
      legacyUploadUri() ||
      localUri(snapshotSources.originalUri, 'upload') ||
      ''
    );
  };

  getResourceOriginalUri = function (node) {
    var resource = getResource(node);
    var snapshotSources = (resource && resource.snapshotSources && 'object' === typeof resource.snapshotSources) ? resource.snapshotSources : {};
    var uid = getResourceOwnerUserId(resource, node);
    function legacyUploadUri() {
      var date = String(resource && resource.date || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
      var id = String(resource && resource.id || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
      var file = String(resource && resource.file || '').replace(/\\/g, '/').split('/').pop();
      if (!date || !id || !file) {
        return '';
      }
      return toPublicResourceUri('upload', date + '/' + id + '/' + file, uid);
    }
    function localUri(value) {
      var text = String(value || '').replace(/\\/g, '/').trim();
      if (!text || /^https?:\/\//i.test(text) && text.indexOf('/wu_wei2/') < 0) {
        return text;
      }
      if (/^(?:cgi-bin|server)\/load-file\.(?:py|cgi)\?/i.test(text) ||
        /^\d{4}\/\d{2}\/\d{2}\//.test(text)) {
        return toPublicResourceUri('upload', toStorageRelativePath(text, uid, 'upload'), uid);
      }
      if (text.indexOf('upload/') === 0 || text.indexOf('/upload/') >= 0) {
        return toPublicResourceUri('upload', toStorageRelativePath(text, uid, 'upload'), uid);
      }
      return text;
    }
    return String(
      getResourceFileUri(resource, 'original', node) ||
      localUri(snapshotSources.originalUri) ||
      localUri(resource.canonicalUri) ||
      localUri(resource.uri) ||
      legacyUploadUri() ||
      ''
    );
  };

  getResourceOriginalPath = function (node) {
    var resource = getResource(node);
    var path = getResourceFilePath(resource, 'original', node);
    var text;
    var uid = getResourceOwnerUserId(resource, node);
    if (path) {
      return path;
    }
    text = String((resource && (resource.canonicalUri || resource.uri)) || '').replace(/\\/g, '/').trim();
    if (!text || /^https?:\/\//i.test(text) && text.indexOf('/wu_wei2/') < 0) {
      return text;
    }
    return toStorageRelativePath(text, uid, 'upload');
  };

  getResourceThumbnailUri = function (node) {
    var resource = getResource(node);
    var viewer = (resource && resource.viewer && 'object' === typeof resource.viewer) ? resource.viewer : {};
    var embed = (viewer.embed && 'object' === typeof viewer.embed) ? viewer.embed : {};
    var snapshotSources = (resource && resource.snapshotSources && 'object' === typeof resource.snapshotSources) ? resource.snapshotSources : {};
    var uid = getResourceOwnerUserId(resource, node);
    function localUri(value) {
      var text = String(value || '').replace(/\\/g, '/').trim();
      var area;
      if (!text || /^https?:\/\//i.test(text) && text.indexOf('/wu_wei2/') < 0) {
        return text;
      }
      area = (text.indexOf('note/') === 0 || text.indexOf('/note/') >= 0) ? 'note' : 'resource';
      if (/^(?:cgi-bin|server)\/load-file\.(?:py|cgi)\?/i.test(text) ||
        /^\d{4}\/\d{2}\/\d{2}\//.test(text) ||
        text.indexOf(area + '/') === 0 ||
        text.indexOf('/' + area + '/') >= 0) {
        return toPublicResourceUri(area, toStorageRelativePath(text, uid, area), uid);
      }
      return text;
    }
    return String(
      getResourceFileUri(resource, 'thumbnail', node) ||
      localUri(node && node.thumbnailUri) ||
      localUri(viewer.thumbnailUri) ||
      localUri(embed.thumbnailUri) ||
      localUri(snapshotSources.thumbnailUri) ||
      ''
    );
  };

  getThumbnailUri = function (node) {
    return getResourceThumbnailUri(node) || String((node && node.thumbnailUri) || '');
  };

  getResource = function (node) {
    return (node && node.resource && 'object' === typeof node.resource) ? node.resource : {};
  };

  getResourceUri = function (node) {
    return getResourcePreviewUri(node) || getResourceOriginalUri(node);
  };

  getResourceViewer = function (node) {
    var resource = getResource(node);
    if (!resource.viewer || 'object' !== typeof resource.viewer) {
      resource.viewer = { supportedModes: ['infoPane', 'newTab', 'newWindow', 'download'], defaultMode: 'infoPane' };
    }
    return resource.viewer;
  };

  getNoteOwnerUserId = function (note) {
    var audit = note && note.audit;
    return String((audit && audit.createdBy) || '');
  };


  initModule = function () {
    model = wuwei.model;
  };


  return {
    isEquivalent: isEquivalent,
    clone: clone,
    dist: dist,
    getCookie: getCookie,
    deleteCookie: deleteCookie,
    urlExists: urlExists,
    getTeamname: getTeamname,
    whichBrowser: whichBrowser,
    pad: pad,
    createUuid: createUuid,
    isUUID: isUUID,
    isUUIDid: isUUIDid,
    logIsoDateTime: logIsoDateTime,
    toISOString: toISOString,
    toISOStringH: toISOStringH,
    toISOStringM: toISOStringM,
    clean_text: clean_text,
    toText: toText,
    escapeLineFeed: escapeLineFeed,
    unescapeLineFeed: unescapeLineFeed,
    maybeDecodeURIComponent: maybeDecodeURIComponent,
    trimToHtmlDocument: trimToHtmlDocument,
    parseEncodedResponse: parseEncodedResponse,
    decodeHtml: decodeHtml,
    encodeHtml: encodeHtml,
    escapeChar: escapeChar,
    unescapeChar: unescapeChar,
    isEmpty: isEmpty,
    notEmpty: notEmpty,
    isEmptyObject: isEmptyObject,
    notEmptyObject: notEmptyObject,
    isEmptySelection: isEmptySelection,
    notEmptySelection: notEmptySelection,
    isNumber: isNumber,
    round: round,
    precisionRound: precisionRound,
    isASCII: isASCII,
    random: random,
    append: append,
    prepend: prepend,
    remove: remove,
    findById: findById,
    appendById: appendById,
    removeById: removeById,
    deleteFromArray: deleteFromArray,
    contains: contains,
    parse: parse,
    getTransform: getTransform,
    pContext: pContext,
    pScreen: pScreen,
    getPosition: getPosition,
    setScale: setScale,
    zoomin: zoomin,
    zoomout: zoomout,
    resetview: resetview,
    createThumbnail: createThumbnail,
    setupMiniature: setupMiniature,
    translate: translate,
    getBorder: getBorder,
    getBorderByNodes: getBorderByNodes,
    shiftPath: shiftPath,

    miniatureUtil: miniatureUtil,
    drawMiniature: drawMiniature,
    buildMiniatureSvgString: buildMiniatureSvgString,
    getMiniatureLinks: getMiniatureLinks,
    isMiniatureTimelineAxisLink: isMiniatureTimelineAxisLink,

    openWindow: openWindow,
    closeWindow: closeWindow,
    // OperationsList: OperationsList,
    isNode: isNode,
    isResource: isResource,
    isLink: isLink,
    getLinkPoints: getLinkPoints,
    copyObject: copyObject,
    updateObject: updateObject,
    toArray: toArray,
    getLineHeight: getLineHeight,
    getEmSize: getEmSize,

    checkImage: checkImage,
    checkPDF: checkPDF,
    checkOffice: checkOffice,
    checkMP3: checkMP3,
    checkMOV: checkMOV,

    pushUniqueItem: pushUniqueItem,

    closestColor: closestColor,
    getFontSizeLabel: getFontSizeLabel,

    isLocalHost: isLocalHost,
    getAction: getAction,
    getServerUrl: getServerUrl,
    isOfficeDocument: isOfficeDocument,
    getOfficeIcon: getOfficeIcon,
    getPageTransform: getPageTransform,
    setPageTransform: setPageTransform,
    getNodeHidden: getNodeHidden,
    getLinkHidden: getLinkHidden,
    isShown: isShown,
    setHidden: setHidden,
    getNodeShape: getNodeShape,
    getNodeSize: getNodeSize,
    getCurrentUserId: getCurrentUserId,
    toStorageRelativePath: toStorageRelativePath,
    toPublicResourceUri: toPublicResourceUri,
      getResourceFile: getResourceFile,
      getResourceFilePath: getResourceFilePath,
      getResourceFileUri: getResourceFileUri,
      getResourcePreviewUri: getResourcePreviewUri,
      getResourceOriginalPath: getResourceOriginalPath,
      getResourceOriginalUri: getResourceOriginalUri,
    getResourceThumbnailUri: getResourceThumbnailUri,
    getThumbnailUri: getThumbnailUri,
    getResource: getResource,
    getResourceUri: getResourceUri,
    getResourceViewer: getResourceViewer,
    getNoteOwnerUserId: getNoteOwnerUserId,

    escapeHtml: escapeHtml,
    sanitizeHtml: sanitizeHtml,
    looksLikeHtml: looksLikeHtml,
    plainTextToHtml: plainTextToHtml,
    renderAsciiDoc: renderAsciiDoc,
    getNodeAsciiDocSource: getNodeAsciiDocSource,

    asciiDocToHtml: asciiDocToHtml,
    htmlToAsciiDoc: htmlToAsciiDoc,

    initModule: initModule
  };
})();
// wuwei.util.js last modified 2026-04-16
