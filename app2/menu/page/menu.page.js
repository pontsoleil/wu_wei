/**
 * menu.page.js
 * menu.page module
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2013-2019, 2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.menu = wuwei.menu || {};
wuwei.menu.page = wuwei.menu.page || {};

(function (ns) {
  const
    common = wuwei.common,
    menu = wuwei.menu,
    draw = wuwei.draw;
  let pageArray = [],
    listMode = 'list';

  function stopEvent(ev) {
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();
    }
  }

  function buildPageSlots() {
    const current = wuwei.common.current;
    const pages = current.pages || {};
    const keys = Object.keys(pages)
      .map(Number)
      .filter(Number.isFinite)
      .sort((a, b) => a - b);

    const maxpp = keys.length ? keys[keys.length - 1] : 1;
    const slots = new Array(maxpp).fill(null);

    keys.forEach(pp => {
      slots[pp - 1] = pages[String(pp)];
    });

    return slots;
  }


  function rerenderList() {
    const pageEl = document.getElementById('page-list');
    if (!pageEl || pageEl.style.display !== 'block') {
      return;
    }
    pageEl.innerHTML = wuwei.menu.page.markup.list_template(pageArray, listMode);
  }


  function open() {
    const pageEl = document.getElementById('page-pane');
    pageEl.innerHTML = wuwei.menu.page.markup.template();
    pageEl.style.display = 'block';
  }


  function namePageOpen() {
    var page = wuwei.common.current.page;
    var pageEl = document.getElementById('page-pane');
    var param = wuwei.common.current.page;

    pageEl.innerHTML = wuwei.menu.page.markup.name_form(param);

    document.getElementById('name').value = page.name || '';
    document.getElementById('description').value = page.description || '';
    pageEl.style.display = 'block';
  }


  function editPage(pp, ev) {
    stopEvent(ev);
    var pageEl = document.getElementById('page-pane');
    var page = wuwei.common.current.pages[pp];
    var param = page;

    if (!page) {
      return;
    }

    pageEl.innerHTML = wuwei.menu.page.markup.name_form(param);

    document.getElementById('name').value = page.name || '';
    document.getElementById('description').value = page.description || '';
    pageEl.style.display = 'block';
  }


  function copyPage(pp, ev) {
    stopEvent(ev);
    const pageNo = Number(pp) || 1;

    if (!wuwei.common.current.pages || !wuwei.common.current.pages[String(pageNo)]) {
      return;
    }

    wuwei.note.copyPage(pageNo);
    menu.updateResetview('reset');

    if ('simulation' === common.graph.mode && typeof draw.restart === 'function') {
      draw.restart();
    } else {
      draw.refresh();
    }

    if (wuwei.note && typeof wuwei.note.updatePageThumbnail === 'function') {
      wuwei.note.updatePageThumbnail();
    }
    pageArray = buildPageSlots();
    rerenderList();
    menu.refreshPagenation();
    menu.checkPage();
  }

  function addPage(ev) {
    stopEvent(ev);
    wuwei.note.newPage();
    menu.updateResetview('reset');

    if ('simulation' === common.graph.mode && typeof draw.restart === 'function') {
      draw.restart();
    } else {
      draw.refresh();
    }

    if (wuwei.note && typeof wuwei.note.updatePageThumbnail === 'function') {
      wuwei.note.updatePageThumbnail();
    }
    pageArray = buildPageSlots();
    rerenderList();
    menu.refreshPagenation();
    menu.checkPage();
  }


  function namePage(pp, ev) {
    stopEvent(ev)
    var form = document.querySelector('#page-pane form'),
      name = form.name.value,
      description = form.description.value;
    const current = wuwei.common.current;
    current.pages[pp].name = name;
    current.pages[pp].description = description;
    let page_name = document.querySelector('#page_name');
    if (+pp === current.page.pp) {
      page_name.querySelector('.name').innerHTML = name;
      let descriptionEl = page_name.querySelector('.description')
      descriptionEl.innerHTML = description;
      if (description.length > 0) {
        descriptionEl.classList.add('active');
      }
      else {
        descriptionEl.classList.remove('active');
      }
    }
    let page_list = document.querySelector('#page-list');
    if (page_list && 'block' === page_list.style.display) {
      page_list.querySelector(`.list #gallery #page_${pp} .name`).innerHTML = name;
      let descriptionEl = page_list.querySelector(`.list #gallery #page_${pp} .description`);
      descriptionEl.innerHTML = description;
    }
    wuwei.menu.refreshPagenation();
    close_pane();
  }


  function openPage(pp, ev) {
    stopEvent(ev)
    wuwei.note.openPage(pp);
    close_list();
  }


  function removePage(pp, ev) {
    stopEvent(ev);

    const current = wuwei.common.current;
    const pageNo = Number(pp) || 1;

    if (!current.pages || !current.pages[String(pageNo)]) {
      return;
    }

    wuwei.note.removePage(pageNo);

    if (pageArray && pageArray.length >= pageNo) {
      pageArray[pageNo - 1] = null;
    }

    rerenderList();
    menu.updateResetview('reset');
    menu.refreshPagenation();
    menu.checkPage();

    if ('simulation' === common.graph.mode && typeof draw.restart === 'function') {
      draw.restart();
    } else {
      draw.refresh();
    }
  }


  function list(mode) {
    const
      galleryWidth = window.innerWidth - 60,
      pageWidth = wuwei.common.state.iOS ? 108 : 216,
      galleryHeight = wuwei.common.state.iOS ? window.innerHeight - 100 : window.innerHeight - 200,
      pageHeight = wuwei.common.state.iOS ? 108 : 216;

    if (wuwei.note && typeof wuwei.note.updatePageThumbnail === 'function') {
      wuwei.note.updatePageThumbnail();
    }
    listMode = mode || 'list';
    pageArray = buildPageSlots();

    let rowcount = Math.floor(galleryHeight / pageHeight);
    if (rowcount <= 0) {
      rowcount = 1;
    }

    const pageEl = document.getElementById('page-list'),
      html = wuwei.menu.page.markup.list_template(pageArray, listMode);

    pageEl.innerHTML = html;
    pageEl.style.display = 'block';
  }

  function close_pane() {
    const pageEl = document.getElementById('page-pane');
    pageEl.innerHTML = '';
    pageEl.style.display = 'none';
  }


  function close_list() {
    pageArray = [];
    listMode = 'list';
    const pageEl = document.getElementById('page-list');
    pageEl.innerHTML = '';
    pageEl.style.display = 'none';
  }

  ns.namePageOpen = namePageOpen;
  ns.namePage = namePage;
  ns.editPage = editPage;
  ns.copyPage = copyPage;
  ns.addPage = addPage;
  ns.openPage = openPage;
  ns.removePage = removePage;
  ns.open = open;
  ns.list = list;
  ns.close_pane = close_pane;
  ns.close_list = close_list;
})(wuwei.menu.page);
// menu.page.js revised 2026-04-07
