/**
 * search.youtube.js
 * search.youtube module
 *
 * WuWei is a free to use open source knowledge modeling tool.
 * More information on WuWei can be found on WuWei homepage.
 * https://www.wuwei.space/blog/
 *
 * WuWei is licensed under the MIT License
 * Copyright (c) 2013-2020, Nobuyuki SAMBUICHI
 **/
wuwei.search.youtube = ( function () {

  function registerButton() {
    let button = document.getElementById('search-button'),
        text = button.innerHTML;
    button.innerHTML = `YouTube<br>${text}`;
    button.style.fontSize = '6pt';
    button.style.lineHeight = '11px';
    wuwei.search.youtube.service.stateMap.kind = null,// "youtube#searchListResponse",
    wuwei.search.youtube.service.stateMap.etag = null,// "\"ksCrgYQhtFrXgbHAhi9Fo5t0C2I/rtoD6gl5PCKpiyoSCHMdYycSBqY\"",
    wuwei.search.youtube.service.stateMap.nextPageToken = null,// "CDIQAA",
    wuwei.search.youtube.service.stateMap.prevPageToken = null,// "CDIQAA",
    wuwei.search.youtube.service.stateMap.regionCode = null,// "JP",
    wuwei.search.youtube.service.stateMap.pageInfo.totalResults = null;
    wuwei.search.youtube.service.stateMap.pageInfo.resultsPerPage = null;
    document.getElementById('search-button').addEventListener('click', function(e) {
      e.preventDefault();
      var term = document.getElementById('search-text').value;
      wuwei.search.youtube.service.search(term);
    });
  }

  function open() {
    document.getElementById('search-youtube').style.display = 'block';
    document.getElementById('search-youtube').innerHTML = wuwei.search.youtube.markup.template();
    registerButton();
  }

  function close() {
    document.getElementById('search-youtube').style.display = 'none';
  }

  function initModule() {  }

  return {
    registerButton: registerButton,
    open: open,
    close: close,
    initModule: initModule
  };
})();
// search.youtube.js
