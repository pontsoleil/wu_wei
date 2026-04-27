/**
 * info.asciidoc.js
 * info.asciidoc module
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 **/
wuwei.info = wuwei.info || {};
wuwei.info.asciidoc = wuwei.info.asciidoc || {};

(function (ns) {
  'use strict';

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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
  }


  function sanitizeHtml(html) {
    if (window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
      return window.DOMPurify.sanitize(html, {
        USE_PROFILES: { html: true }
      });
    }
    return html;
  }

  function plainTextToHtml(text) {
    return '<pre class="plainText">' + escapeHtml(text || '') + '</pre>';
  }

  function convertMarkdown(source) {
    var text = String(source || '');
    var html = '';

    if (!text.trim()) {
      return '';
    }

    if (window.marked && typeof window.marked.parse === 'function') {
      try {
        html = window.marked.parse(text);
        return sanitizeHtml(html);
      }
      catch (err) {
        console.error('info.asciidoc: marked render failed', err);
      }
    }

    if (window.markdownit && typeof window.markdownit === 'function') {
      try {
        html = window.markdownit({ html: false, linkify: true }).render(text);
        return sanitizeHtml(html);
      }
      catch (err) {
        console.error('info.asciidoc: markdown-it render failed', err);
      }
    }

    return plainTextToHtml(text);
  }


  function convertAsciiDoc(source) {
    var text = String(source || '');

    if (!text.trim()) {
      return '';
    }

    if (looksLikeHtml(text)) {
      return sanitizeHtml(text);
    }

    if (window.asciidoctor && typeof window.asciidoctor.convert === 'function') {
      try {
        return sanitizeHtml(window.asciidoctor.convert(text, {
          safe: 'secure',
          standalone: false,
          attributes: {
            showtitle: false,
            icons: 'font'
          }
        }));
      }
      catch (err) {
        console.error('info.asciidoc: Asciidoctor render failed', err);
      }
    }

    if (window.wuwei && wuwei.edit && typeof wuwei.edit.asciiDocToHtml === 'function') {
      try {
        return sanitizeHtml(wuwei.edit.asciiDocToHtml(text));
      }
      catch (err) {
        console.error('info.asciidoc: fallback render failed', err);
      }
    }

    return '<pre class="adoc-fallback">' + escapeHtml(text) + '</pre>';
  }


  function getSource(node) {
    if (!node) {
      return { format: '', body: '' };
    }
    if (node.description && typeof node.description.body === 'string' && String(node.description.body).trim()) {
      return {
        format: String(node.description.format || 'plain').toLowerCase(),
        body: String(node.description.body)
      };
    }
    return { format: '', body: '' };
  }

  function convertRichText(source, format) {
    var fmt = String(format || 'plain').toLowerCase();
    var text = String(source || '');

    if (!text.trim()) {
      return '';
    }

    if (fmt === 'asciidoc' || fmt === 'adoc') {
      return convertAsciiDoc(text);
    }

    if (fmt === 'markdown' || fmt === 'md') {
      return convertMarkdown(text);
    }

    return plainTextToHtml(text);
  }


  function open(param) {
    var pane = document.getElementById('info-asciidoc');
    var node = param && param.node ? param.node : null;
    var richText = getSource(node);
    var html = '';

    if (!pane) {
      return;
    }

    if (!richText.body) {
      pane.innerHTML = '';
      pane.style.display = 'none';
      return;
    }

    html = convertRichText(richText.body, richText.format);
    pane.innerHTML = wuwei.info.asciidoc.markup.template({
      node: node,
      html: html
    });
    pane.style.display = 'block';
  }


  function close() {
    var pane = document.getElementById('info-asciidoc');
    if (!pane) {
      return;
    }
    pane.innerHTML = '';
    pane.style.display = 'none';
  }

  ns.open = open;
  ns.close = close;
  ns.convertAsciiDoc = convertAsciiDoc;
  ns.getSource = getSource;
})(wuwei.info.asciidoc);
// info.asciidoc.js last modified 2026-03-28
