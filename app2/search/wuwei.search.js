/**
 * wuwei.search.js
 * search module
 *
 * WuWei is a free to use open source knowledge modeling tool.
 * More information on WuWei can be found on WuWei homepage.
 * https://www.wuwei.space/blog/
 *
 * WuWei is licensed under the MIT License
 * Copyright (c) 2013-2020, Nobuyuki SAMBUICHI
 **/
wuwei.search = ( function () {
  let
    graph,
    model,
    draw;

  function clear() {
    document.getElementById('search-this_note').innerHTML = '';
/*    document.getElementById('search-note').innerHTML = '';
    document.getElementById('search-uploaded').innerHTML = '';
    document.getElementById('search-youtube').innerHTML = '';
    document.getElementById('search-wikipedia').innerHTML = '';
    document.getElementById('search-google-books').innerHTML = '';
    document.getElementById('search-itunes').innerHTML = '';
    document.getElementById('search-s3object').innerHTML = '';
  */
   }

  function clicked(menu) {
    clear();
    switch (menu) {
      case 'this_note':
        wuwei.search.this_note.open();
        break;
/*      case 'note':
        wuwei.search.note.open();
        break;
      case 'uploaded':
        wuwei.search.uploaded.open();
        break;
      case 'youTube':
        wuwei.search.youtube.open();
        break;
      case 'wikipedia':
        wuwei.search.wikipedia.open();
        break;
      case 's3object':
        wuwei.search.s3object.open();
        break;
      case 'googleBooks':
        wuwei.search.googlebooks.open();
        break;
      case 'iTunes':
        wuwei.search.itunes.open();
        break;
      case 'ISO_PC295':
        wuwei.search.pc295.open();
        break;
*/
      default:
    }
  }

  function open(mode) {
    var searchPane = document.getElementById('search');
    if (!searchPane) { return; }
    searchPane.style.display = 'block';
    clear();
    if (wuwei.search.this_note && typeof wuwei.search.this_note.open === 'function') {
      wuwei.search.this_note.open(mode || 'search');
    }
  }

  function close() {
    var searchPane = document.getElementById('search');
    if (wuwei.search.this_note && typeof wuwei.search.this_note.close === 'function') {
      wuwei.search.this_note.close();
    }
    if (searchPane) {
      searchPane.style.display = 'none';
    }
  }

  function filterOpen() {
    open('filter');
  }

  function searchRender(data) {
    console.log('- DrawComponent searchRender data:', data);
    const
      self = this,
      command = data.command,
      param = data.param;
    let refresh = false;
    if ('openInfo' === command) {
      wuwei.info.open(param.node, param.resource);
    }
    else if ('noderecord' === command) {
      console.log('noderecord ' + param);
      model.addNodeContent(param.node);
      refresh = true;
    }
    else if ('filerecord' === command) {
      console.log('filerecord ' + param);
      model.addUploadedContent(param.file);
      refresh = true;
    }
    else if ('bookmark' === command) {
      console.log('bookmark ' + param);
      model.addGoogkeBook(param);
      refresh = true;
    }
    else if ('videorecord' === command) {
      console.log('videorecord ' + param);
      model.addYouTube(param);
      refresh = true;
    }
    else if ('wikipedia' === command) {
      console.log('wikipedia ' + param);
      model.addWikipedia(param);
      refresh = true;
    }
    else if ('s3object' === command) {
      console.log('s3object ' + param);
      model.addS3object(param.s3object);
      refresh = true;
    }
    else if ('noterecord' === command) {
      console.log('noterecord ' + param);
      model.addUploadedContent(param.file);
      refresh = true;
    }
    else if ('addPC295' === command) {
      addPC295(param);
      refresh = true;
    }
    else if ('clearSearch' === command) {
      clearSearch();
    }
    else if ('filterOpen' === command) {

    }
    if (refresh) {
      if ('draw' === graph.mode) {
        draw.refresh();
      } else if ('simulation' === graph.mode) {
        draw.restart();
      }
    }
  }

  // function infoOpen() {}
  function addPC295(param) {}
  function clearSearch() {}

  function initModule() {
    graph = wuwei.common.graph;
    model = wuwei.model;
    draw = wuwei.draw;
    var searchPane = document.getElementById('search');
    if (searchPane && wuwei.search.markup && typeof wuwei.search.markup.template === 'function') {
      searchPane.innerHTML = wuwei.search.markup.template();
    }
  }

  return {
    open: open,
    close: close,
    clicked: clicked,
    filterOpen: filterOpen,
    searchRender: searchRender,
    initModule: initModule
  };
})();

