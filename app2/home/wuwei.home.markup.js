/**
 * wuwei.home.markup.js
 *
 * markup module for home page
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2013-2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.home = wuwei.home || {};
wuwei.home.markup = (function () {
  'use strict';

  const state = wuwei.common.state;
  const activeDays = {};

  function translate(key) {
    return (wuwei.nls && wuwei.nls.translate) ? (wuwei.nls.translate(key) || key) : key;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeDecode(value) {
    if (typeof value !== 'string') {
      return value || '';
    }
    try {
      return decodeURIComponent(value);
    }
    catch (e) {
      return value;
    }
  }

  function sanitizeDescriptionHtml(html) {
    const template = document.createElement('template');
    template.innerHTML = String(html || '');
    template.content.querySelectorAll('script, style, iframe, object, embed').forEach(function (el) {
      el.remove();
    });
    template.content.querySelectorAll('*').forEach(function (el) {
      Array.from(el.attributes).forEach(function (attr) {
        const name = attr.name.toLowerCase();
        const value = String(attr.value || '');
        if (name.indexOf('on') === 0 || (/(href|src|xlink:href)/.test(name) && /^\s*javascript:/i.test(value))) {
          el.removeAttribute(attr.name);
        }
      });
    });
    return template.innerHTML;
  }

  function plainTextToHtml(text) {
    return '<p>' + escapeHtml(text || '').replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>') + '</p>';
  }

  function convertMarkdown(source) {
    const text = String(source || '');
    if (window.marked && typeof window.marked.parse === 'function') {
      try { return sanitizeDescriptionHtml(window.marked.parse(text)); }
      catch (e) { }
    }
    if (window.markdownit && typeof window.markdownit === 'function') {
      try { return sanitizeDescriptionHtml(window.markdownit({ html: false, linkify: true }).render(text)); }
      catch (e2) { }
    }
    return plainTextToHtml(text);
  }

  function convertAsciiDoc(source) {
    const text = String(source || '');
    if (window.asciidoctor && typeof window.asciidoctor.convert === 'function') {
      try {
        return sanitizeDescriptionHtml(window.asciidoctor.convert(text, {
          safe: 'secure',
          standalone: false,
          attributes: { showtitle: false, icons: 'font' }
        }));
      }
      catch (e) { }
    }
    if (window.wuwei && wuwei.edit && typeof wuwei.edit.asciiDocToHtml === 'function') {
      try { return sanitizeDescriptionHtml(wuwei.edit.asciiDocToHtml(text)); }
      catch (e2) { }
    }
    return plainTextToHtml(text);
  }

  function getDescription(file) {
    const value = file && file.value && typeof file.value === 'object' ? file.value : {};
    const resource = file && file.resource && typeof file.resource === 'object' ? file.resource : {};
    const source = file && file.description
      ? file.description
      : (resource.description ? resource.description : value.description);
    if (source && typeof source === 'object') {
      return {
        format: String(source.format || 'plain/text').toLowerCase(),
        body: String(source.body || '')
      };
    }
    return {
      format: 'plain/text',
      body: safeDecode(source || value.comment || '')
    };
  }

  function renderDescriptionSummary(file) {
    const description = getDescription(file);
    const body = String(description.body || '');
    const format = String(description.format || 'plain/text').toLowerCase();
    if (!body.trim()) {
      return '<p class="empty">' + escapeHtml(translate('No comment yet')) + '</p>';
    }
    if (format.indexOf('html') >= 0) {
      return sanitizeDescriptionHtml(body);
    }
    if (format.indexOf('markdown') >= 0 || format === 'md') {
      return convertMarkdown(body);
    }
    if (format.indexOf('asciidoc') >= 0 || format === 'adoc') {
      return convertAsciiDoc(body);
    }
    return plainTextToHtml(body);
  }

  function getTimestamp(file) {
    const value = file && file.value ? file.value : {};
    const resource = file && file.resource && typeof file.resource === 'object' ? file.resource : {};
    const audit = resource.audit && typeof resource.audit === 'object' ? resource.audit : {};
    const filePath = value.file || '';
    const retrieved = value.retrieved || '';
    const lastmodified = value.lastmodified || audit.lastModifiedAt || audit.createdAt || '';
    const option = file && file.option ? file.option : '';

    let timestamp = '';
    if (filePath) {
      const start = filePath.indexOf('datetime=');
      if (start > 0) {
        timestamp = filePath.substr(start + 9, 19);
        timestamp = timestamp.substr(0, 4) + '-' + timestamp.substr(5, 2) + '-' + timestamp.substr(8);
      }
    }
    if (!timestamp) {
      timestamp = ('webpage' === option && retrieved) || lastmodified || '';
    }
    return timestamp;
  }

  function parseTimestamp(timestamp) {
    const m = String(timestamp || '').trim().match(/^(\d{4}-\d{2}-\d{2})(?:[T\s]+(\d{2}:\d{2})(?::\d{2})?)?/);
    return m ? { date: m[1], time: m[2] || '' } : null;
  }

  function getDateTimeLabel(file) {
    const timestamp = getTimestamp(file);
    const parsed = parseTimestamp(timestamp);
    let date = 'YYYY-MM-DD';
    let time = 'HH:MM';
    let rgx, datetime;

    if (parsed) {
      return parsed;
    }

    rgx = /^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2}):\d{2}/;
    datetime = rgx.exec(timestamp);
    if (datetime && datetime.length > 2) {
      date = datetime[1];
      time = datetime[2];
    }
    return { date: date, time: time };
  }

  function getThumbnailSize(file) {
    const value = file && file.value ? file.value : {};
    const thumb_size = value.thumbnail && value.thumbnail.size ? value.thumbnail.size : '';
    const image_size = value.imagesize || '';
    const SIZE = 200;
    let W = SIZE;
    let H = SIZE;
    let wh;

    if (thumb_size) {
      wh = thumb_size.split('x');
      W = +wh[0] || SIZE;
      H = +wh[1] || SIZE;
    }
    else if (image_size) {
      wh = image_size.split('x');
      if (2 === wh.length) {
        W = +wh[0] || SIZE;
        H = +wh[1] || SIZE;
        if (W > H) {
          H = Math.round(H * SIZE / W);
          W = SIZE;
        }
        else {
          W = Math.round(W * SIZE / H);
          H = SIZE;
        }
      }
    }
    return { width: W, height: H };
  }

  function getTypeLabel(file) {
    if (wuwei.info && typeof wuwei.info.getContentTypeLabel === 'function') {
      return wuwei.info.getContentTypeLabel(file);
    }

    const resource = file && file.resource && typeof file.resource === 'object' ? file.resource : {};
    const media = resource.media && typeof resource.media === 'object' ? resource.media : {};
    const identity = resource.identity && typeof resource.identity === 'object' ? resource.identity : {};
    const kind = String(media.kind || file.option || '').toLowerCase();
    const mime = String(media.mimeType || file.contenttype || '').toLowerCase();
    const uri = safeDecode(
      file && (file.preview_url || file.download_url || file.url || file.uri) ||
      identity.uri ||
      identity.canonicalUri ||
      ''
    ).toLowerCase();

    if (kind === 'video' || mime.indexOf('video/') === 0 || /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/.test(uri)) {
      return 'VIDEO';
    }
    if (kind === 'audio' || mime.indexOf('audio/') === 0 || /\.(mp3|wav|m4a|ogg|oga)(\?|#|$)/.test(uri)) {
      return 'AUDIO';
    }
    if (kind === 'image' || mime.indexOf('image/') === 0 || /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/.test(uri)) {
      return 'IMAGE';
    }
    if (kind === 'webpage' || mime === 'text/html' || /\.html?(\?|#|$)/.test(uri)) {
      return 'HTML';
    }
    if (mime === 'application/pdf' || /\.pdf(\?|#|$)/.test(uri)) {
      return 'PDF';
    }
    if (/officedocument|msword|ms-excel|ms-powerpoint|vnd\.ms-|\.docx?(\?|#|$)|\.xlsx?(\?|#|$)|\.pptx?(\?|#|$)/.test(mime + ' ' + uri)) {
      return 'OFFICE';
    }
    if (mime.indexOf('text/') === 0 || /\.(txt|csv|tsv|md|adoc|json|xml)(\?|#|$)/.test(uri)) {
      return 'TEXT';
    }
    return translate('File');
  }

  function getSourceLabel(file) {
    const url = safeDecode(file && file.url ? file.url : '');
    const uri = safeDecode(file && file.uri ? file.uri : '');
    return url || uri || '';
  }

  function toCurrentLocalOrigin(uri) {
    let parsed;
    const value = safeDecode(uri || '');

    if (!value || !/^https?:\/\//i.test(value) || !window.location || !location.hostname) {
      return value;
    }

    try {
      parsed = new URL(value, location.href);
    } catch (e) {
      return value;
    }

    if (!['localhost', '127.0.0.1', '::1'].includes(String(parsed.hostname || '').toLowerCase())) {
      return value;
    }
    if (!['localhost', '127.0.0.1', '::1'].includes(String(location.hostname || '').toLowerCase())) {
      return value;
    }

    parsed.protocol = location.protocol;
    parsed.host = location.host;
    return parsed.href;
  }

  function getInfoPreviewKind(file) {
    if (window.wuwei && wuwei.info && typeof wuwei.info.getPreviewKind === 'function') {
      return wuwei.info.getPreviewKind(file);
    }
    const value = file && file.value ? file.value : {};
    const viewerType = String(value.viewerType || '').toLowerCase();
    const format = String(file && file.contenttype || '').toLowerCase();
    const url = safeDecode(file && (file.preview_url || file.url || file.uri) || '').toLowerCase();
    if (viewerType === 'youtube' || viewerType === 'vimeo' || viewerType === 'video') {
      return 'video';
    }
    if (viewerType === 'pdf' || format === 'application/pdf' || /\.pdf(\?|#|$)/i.test(url)) {
      return 'pdf';
    }
    if (viewerType === 'image' || format.indexOf('image/') === 0) {
      return 'image';
    }
    if (viewerType === 'thumbnail') {
      return 'thumbnail';
    }
    if (viewerType === 'iframe' || file.option === 'webpage') {
      return 'iframe';
    }
    return '';
  }

  function getInfoPreviewSrc(file) {
    if (window.wuwei && wuwei.info && typeof wuwei.info.getPreviewSrc === 'function') {
      return toCurrentLocalOrigin(wuwei.info.getPreviewSrc(file));
    }
    const value = file && file.value ? file.value : {};
    return toCurrentLocalOrigin(safeDecode(file && file.preview_url ? file.preview_url : '') ||
      value.previewUri ||
      (value.thumbnail && value.thumbnail.uri) ||
      safeDecode(file && file.url ? file.url : '') ||
      safeDecode(file && file.uri ? file.uri : '') ||
      '');
  }

  /*  function renderThumbnail(file) {
      const id = file.id;
      const name = safeDecode(file.name || '');
      const typeLabel = escapeHtml(getTypeLabel(file));
      const previewMarkup = (wuwei.info && typeof wuwei.info.renderPreviewBody === 'function')
        ? wuwei.info.renderPreviewBody(file, { variant: 'gallery', alt: name })
        : '';
  
      return `
        <button type="button" class="file-thumb" onclick="wuwei.home.updateTop('${id}'); return false;">
          ${previewMarkup}
          <span class="file-badge">${typeLabel}</span>
        </button>`;
    }*/
  function renderThumbnail(file) {
    const id = file.id;
    const name = escapeHtml(safeDecode(file.name || ''));
    const typeLabel = escapeHtml(getTypeLabel(file));
    const value = file.value || {};
    const format = String(file.contenttype || '').toLowerCase();
    const option = file.option || '';
    const size = getThumbnailSize(file);
    const previewKind = getInfoPreviewKind(file);
    const previewSrc = getInfoPreviewSrc(file);
    const thumbUri = toCurrentLocalOrigin(
      value.thumbnail && value.thumbnail.uri
        ? value.thumbnail.uri
        : (
          (previewKind === 'image' || previewKind === 'thumbnail') && previewSrc
            ? previewSrc
            : ''
        )
    );

    if (thumbUri && thumbUri.indexOf('undefined') < 0) {
      return `
        <button type="button" class="file-thumb" onclick="wuwei.home.updateTop('${id}'); return false;">
          <img class="thumbnail" src="${thumbUri}" alt="${name}" width="${size.width}" height="${size.height}">
          <span class="file-badge">${typeLabel}</span>
        </button>`;
    }

    let iconClass = 'far fa-file-alt';
    if ('webpage' === option) {
      iconClass = 'fas fa-globe';
    }
    else if (previewKind === 'video' || format.indexOf('video') >= 0) {
      iconClass = 'far fa-play-circle';
    }
    else if (previewKind === 'pdf' || format === 'application/pdf') {
      iconClass = 'far fa-file-pdf';
    }
    else if (previewKind === 'image' || format.indexOf('image') >= 0) {
      iconClass = 'far fa-image';
    }
    else if (format.indexOf('audio') >= 0) {
      iconClass = 'far fa-file-audio';
    }

    return `
      <button type="button" class="file-thumb file-thumb-text" onclick="wuwei.home.updateTop('${id}'); return false;">
        <span class="icon"><i class="${iconClass}"></i></span>
        <span class="label">${typeLabel}</span>
      </button>`;
  }

  function fileGallery(files) {
    if (!files || files.length === 0) {
      return `
        <div class="gallery-empty">
          <div class="gallery-empty-title">${escapeHtml(translate('No content in selected period'))}</div>
          <div class="gallery-empty-text">${escapeHtml(translate('Upload content or choose another date from the calendar.'))}</div>
        </div>`;
    }

    return files.map(function (file) {
      const id = file.id;
      const name = escapeHtml(safeDecode(file.name || ''));
      const value = file.value || {};
      const file_size = value.totalsize ? wuwei.menu.markup.nFormatter(value.totalsize, 1) : '';
      const dt = getDateTimeLabel(file);
      const summary = renderDescriptionSummary(file);

      return `
        <article class="file-card" id="file_${id}" data-id="${id}">
          <input type="hidden" class="file_id" value="${id}">
          <button type="button" class="file-remove" title="${escapeHtml(translate('Hide from gallery'))}" onclick="wuwei.home.hideResource('${id}'); return false;">
            <i class="far fa-trash-alt"></i>
          </button>
          ${renderThumbnail(file)}
          <div class="file-body">
            <button type="button" class="file-title" onclick="wuwei.home.updateTop('${id}'); return false;">${name}</button>
            <div class="file-meta">
              <span class="file-meta-date">${escapeHtml(dt.date)} ${escapeHtml(dt.time)}</span>
              ${file_size ? `<span class="file-meta-size">${escapeHtml(file_size)}</span>` : ''}
            </div>
            <div class="file-comment rich-description">${summary}</div>
          </div>
        </article>`;
    }).join('');
  }

  function setCurrentMonth(year, month) {
    return `<span class="Month">${month}</span><br><span class="Year">${year}</span>`;
  }

  /**
   * Display the calendar for the given year and month
   * @param {number} year - specify year
   * @param {number} month - specify month
   */
  function add_calendar(year, month, days, months) {
    if (!year || !month) {
      const today = new Date();
      year = today.getFullYear();
      month = today.getMonth() + 1;
    }
    state.year = year;
    state.month = month;
    if (days) {
      activeDays[year + '-' + month] = days;
    }
    else {
      days = activeDays[year + '-' + month] || {};
    }
    const wrapper = document.querySelector('#home .calendar');
    if (!wrapper) { return; }
    generate_calendar_header(wrapper, year, month, months);
    generate_calendar_days(wrapper, year, month, days);
  }

  /**
   * Return header element for the given year and month
   * @param {HTMLElement} wrapper - wrapper element
   * @param {number} year - specify year
   * @param {number} month - specify month
   */
  function generate_calendar_header(wrapper, year, month, months) {
    const today = new Date();
    const this_year = today.getFullYear();
    const this_month = today.getMonth() + 1;
    if (!months) {
      months = [];
    }
    const currentMonthEl = wrapper.querySelector('.current');
    if (!currentMonthEl) { return; }
    currentMonthEl.querySelector('.Year').innerText = year;
    currentMonthEl.querySelector('.Month').innerText = +month;
    const thisMonth = year + '-' + ('number' === typeof month && month < 10 ? '0' + month : month);
    const index = months.indexOf(thisMonth);

    const cPrev = wrapper.querySelector('.month .prev');
    if (cPrev) {
      cPrev.onclick = null;
      if (index > 0 || (months.length > 0 && (thisMonth > months[months.length - 1] || (this_year === year && this_month === month)))) {
        cPrev.style.display = 'block';
        let prevMonth;
        if (index >= 0) {
          prevMonth = months[index - 1];
        }
        else {
          prevMonth = months[months.length - 1];
        }
        cPrev.onclick = function () {
          const prevM = prevMonth && prevMonth.match(/(\d{4})-(\d{2})/);
          if (prevM && prevM.length > 2) {
            wuwei.home.listFile({
              year: +prevM[1],
              month: +prevM[2]
            });
          }
        };
      }
      else {
        cPrev.style.display = 'none';
      }
    }

    const cNext = wrapper.querySelector('.month .next');
    if (cNext) {
      cNext.onclick = null;
      if (index < months.length - 1 && (months.length > 0 && thisMonth < months[months.length - 1])) {
        cNext.style.display = 'block';
        const nextMonth = months[index + 1];
        cNext.onclick = function () {
          const nextM = nextMonth.match(/(\d{4})-(\d{2})/);
          if (nextM && nextM.length > 2) {
            wuwei.home.listFile({
              year: +nextM[1],
              month: +nextM[2]
            });
          }
        };
      }
      else {
        cNext.style.display = 'none';
      }
    }
  }

  /**
   * Return days element for the given year and month
   * @param {HTMLElement} wrapper - wrapper element
   * @param {number} year - specify year
   * @param {number} month - specify month
   */
  function generate_calendar_days(wrapper, year, month, days) {
    if (!wrapper) { return; }
    const ulDays = wrapper.querySelector('ul.days');
    if (!ulDays) { return; }

    const firstDay = new Date(year, month - 1, 1).getDay();
    const lastDate = new Date(year, month, 0).getDate();

    let html = '';
    for (let i = 0; i < firstDay; i++) {
      html += '<li class="empty"></li>';
    }
    for (let d = 1; d <= lastDate; d++) {
      const dayStr = ('' + d).padStart(2, '0');
      const monthStr = ('' + month).padStart(2, '0');
      const ymd = `${year}-${monthStr}-${dayStr}`;
      const isActive = days && days[ymd];
      const selectedDate = state.homeSelectedDate || '';
      const rangeStart = state.homeDateRangeStart || '';
      const rangeEnd = state.homeDateRangeEnd || '';
      const isSelected = selectedDate === ymd;
      const isInRange = rangeStart && rangeEnd && ymd >= rangeStart && ymd <= rangeEnd;
      const isToday = (function () {
        const t = new Date();
        return t.getFullYear() === year && (t.getMonth() + 1) === month && t.getDate() === d;
      })();
      html += `<li data-date="${ymd}" class="${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''} ${isInRange ? 'in-range' : ''} ${isToday ? 'today' : ''}">${d}</li>`;
    }
    ulDays.innerHTML = html;
  }

  function template(files) {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const weekdayData = [
      translate('Sun'),
      translate('Mon'),
      translate('Tue'),
      translate('Wed'),
      translate('Thu'),
      translate('Fri'),
      translate('Sat')
    ];

    return `
  <div class="home-shell">
    <header class="home-header">
      <div class="home-title-row">
        <div class="home-title-row-left">
          <button type="button" class="home-sidebar-toggle" onclick="wuwei.home.sidebarOpen(); return false;">
            <i class="fa fa-bars"></i>
          </button>
          <div class="home-title-block">
            <div class="home-title">${escapeHtml(translate('WuWei Home'))}</div>
            <div class="home-subtitle">${escapeHtml(translate('Browse uploaded content and saved webpages, add comments, and start note editing from the selected content.'))}</div>
          </div>
        </div>
      </div>
      <div class="home-command-row">
        <div class="home-header-actions">
          <button type="button" class="home-command workbench" onclick="wuwei.home.toggleHome(); return false;">
            <i class="fas fa-wind"></i><span>${escapeHtml(translate('WuWei'))}</span>
          </button>
          <button type="button" class="home-command upload upload-only" onclick="wuwei.menu.upload.open(); return false;">
            <i class="fas fa-cloud-upload-alt"></i><span>${escapeHtml(translate('Upload'))}</span>
          </button>
          <button type="button" class="home-command login login-only" onclick="wuwei.menu.login.open(); return false;">
            <i class="fas fa-sign-in-alt"></i><span>${escapeHtml(translate('Login'))}</span>
          </button>
          <button type="button" class="home-command logout logout-only" onclick="wuwei.menu.login.logout(); return false;">
            <i class="fas fa-sign-out-alt"></i><span>${escapeHtml(translate('Logout'))}</span>
          </button>
        </div>
        <div class="home-header-search">
          <p class="search" title="${escapeHtml(translate('Search content'))}">
            <i class="fas fa-search"></i>
            <i class="fas fa-times hidden"></i>
          </p>
          <p class="search-text hidden">
            <input type="search" placeholder="${escapeHtml(translate('Search content'))}">
          </p>
        </div>
      </div>
    </header>

    <div id="overlay" onclick="wuwei.home.sidebarClose(); return false;"></div>

    <div class="home-layout">
      <aside id="sidebar" class="home-sidebar side-panel home-panel">
        <section class="home-panel home-selected-panel side-selected-panel">
          <div class="selected-panel-title">${escapeHtml(translate('Selected content'))}</div>
          <div id="homeSelectedTitleName" class="selected-resource-name muted">-</div>
          <div class="selected-panel-body">
            <div id="title" class="home-preview">
              <div id="homePreviewEmpty" class="preview-empty">${escapeHtml(translate('Click a card to preview the content and start working.'))}</div>
              <div id="homeSelectedPreviewBody" class="home-selected-preview-body"></div>
            </div>

            <div class="selected-panel-main">
              <div class="detail-fields compact selected-comment-only">
                <div class="detail-field selected-hidden-meta hidden">
                  <div id="homeSelectedName" class="detail-value muted">—</div>
                  <div id="homeSelectedType" class="detail-value muted">—</div>
                  <div id="homeSelectedDate" class="detail-value muted">—</div>
                  <a id="homeSelectedSource" class="detail-link hidden" target="_blank" rel="noopener noreferrer"></a>
                  <div id="homeSelectedSourceEmpty" class="detail-value muted">—</div>
                </div>
                <div class="detail-field">
                  <div class="detail-label-row">
                    <div class="detail-label">${escapeHtml(translate('Comment'))}</div>
                    <div class="description-mode-actions">
                      <button id="homeDescriptionEditButton" type="button" disabled>${escapeHtml(translate('Edit'))}</button>
                      <button id="homeDescriptionSaveButton" type="button" class="hidden" disabled>${escapeHtml(translate('Save'))}</button>
                      <button id="homeDescriptionCancelButton" type="button" class="hidden" disabled>${escapeHtml(translate('Cancel'))}</button>
                    </div>
                  </div>
                  <div id="homeSelectedComment" class="detail-comment muted">${escapeHtml(translate('No comment yet'))}</div>
                  <div id="homeDescriptionEditor" class="description-editor hidden">
                    <select id="homeDescriptionFormat" aria-label="${escapeHtml(translate('Format'))}">
                      <option value="asciidoc">AsciiDoc</option>
                      <option value="markdown">Markdown</option>
                      <option value="plain/text">Plain text</option>
                      <option value="html">HTML</option>
                    </select>
                    <textarea id="homeDescriptionBody" rows="6"></textarea>
                  </div>
                </div>
              </div>

              <div class="detail-actions compact-actions button-row">
                <button id="homeAnnotateOpenButton" type="button" disabled>
                  <i class="far fa-edit"></i><span>${escapeHtml(translate('Add to note'))}</span>
                </button>
                <button id="homeAnnotateNewButton" type="button" disabled>
                  <i class="far fa-plus-square"></i><span>${escapeHtml(translate('New note'))}</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        <section class="calendar-panel">
          <div class="calendar">
            <div class="month">
              <ul>
                <li class="prev">&#10094;</li>
                <li class="current">${setCurrentMonth(year, month)}</li>
                <li class="next">&#10095;</li>
              </ul>
            </div>
            <ul class="weekdays">
              ${weekdayData.map(function (d) { return `<li>${d}</li>`; }).join('')}
            </ul>
            <ul class="days"></ul>
          </div>
          <div class="home-date-filter">
            <div class="date-filter-row">
              <label for="homeDateStart">${escapeHtml(translate('Start date'))}</label>
              <input id="homeDateStart" type="date">
            </div>
            <div class="date-filter-row">
              <label for="homeDateEnd">${escapeHtml(translate('End date'))}</label>
              <input id="homeDateEnd" type="date">
            </div>
            <div class="date-filter-row">
              <label for="homeRangeTarget">${escapeHtml(translate('Range target'))}</label>
              <select id="homeRangeTarget">
                <option value="all">${escapeHtml(translate('All content in range'))}</option>
                <option value="selected">${escapeHtml(translate('Selected content in range'))}</option>
              </select>
            </div>
            <div class="date-filter-row">
              <label for="homeSearchScope">${escapeHtml(translate('Search scope'))}</label>
              <select id="homeSearchScope">
                <option value="current">${escapeHtml(translate('Current date range'))}</option>
                <option value="all">${escapeHtml(translate('All registered content'))}</option>
              </select>
            </div>
            <div class="date-filter-actions">
              <button type="button" onclick="wuwei.home.applyDateFilter(); return false;">${escapeHtml(translate('Apply'))}</button>
              <button type="button" onclick="wuwei.home.clearDateFilter(); return false;">${escapeHtml(translate('Clear'))}</button>
            </div>
          </div>
        </section>

      </aside>

      <main id="main" class="home-main">
        <section class="home-toolbar home-panel">
          <div class="toolbar-meta">
            <div class="toolbar-title">${escapeHtml(translate('Content gallery'))}</div>
            <div id="homeCurrentRange" class="toolbar-range"></div>
          </div>
          <div id="files" class="toolbar-stats">
            <div class="toolbar-stat"><span>${escapeHtml(translate('Total items'))}: </span><span id="total-files"></span></div>
            <div id="Items" class="toolbar-items"></div>
          </div>
        </section>

        <section class="home-panel gallery-panel">
          <div id="gallery">${fileGallery(files)}</div>
        </section>
      </main>
    </div>
  </div>`;
  }

  return {
    fileGallery: fileGallery,
    add_calendar: add_calendar,
    template: template
  };
})();
// wuwei.home.markup.js 2026-04-19 revised home layout
