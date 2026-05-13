/**
 * search.youtube.markup.js
 * wuwei search.youtube template
 *
 * WuWei is a free to use open source knowledge modeling tool.
 * More information on WuWei can be found on WuWei homepage.
 * https://www.wuwei.space/blog/
 *
 * WuWei is licensed under the MIT License
 * Copyright (c) 2013-2020, Nobuyuki SAMBUICHI
 **/
wuwei.search.youtube.markup = ( function () {
  const template = function (results) {
    if (!results) {
      results = [];
    }
    let totalResults = wuwei.search.youtube.service.stateMap.pageInfo.totalResults,
        total = `${totalResults ? totalResults : ''}`;
    total = total.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
    var html = `
<form class="form">
  <div class="form-group w3-row">
    <input type="search" id="search-text" name="q" class="w3-col s9"
            aria-label="Enter search string">
    <button id="search-button" class="w3-col s3">${translate('Search')}</button>
  </div>
</form>

<div id="loading" class="loader hidden"></div>
<div id="loaded">
  <span>${translate('Total items')} ${total}<span>
  ${wuwei.search.youtube.service.stateMap.nextPageToken
    ? `<a class="next-page">
        <i class="fas fa-forward" onclick="wuwei.search.youtube.service.nextPage()"></i>
      </a>`
    : ''}
  ${wuwei.search.youtube.service.stateMap.prevPageToken
    ? `<a class="prev-page">
        <i class="fas fa-backward" onclick="wuwei.search.youtube.service.prevPage()"></i>
      </a>`
    : ''}
</div>

<ul class="list-group">
  ${results.map(video => 
  `<li class="list-item w3-row">
    <img src="${video.snippet.thumbnails.default.url}"
        class="w3-col s3"
        onclick="wuwei.search.youtube.service.showDetail('${video.id.videoId}')">
    <div class="content w3-col s8">${video.snippet.title}</div>
    <div class="action w3-col s1">
      <a>
        <i id="${video.id.videoId}" class="fas fa-plus"
            onclick="wuwei.search.youtube.service.videorecord()">
        </i>
      </a>
      <a>
        <i class="fas fa-info"
            onclick="wuwei.search.youtube.service.showDetail('${video.id.videoId}')">
        </i>
      </a>
    </div>
    <div class="content w3-col s12">${video.snippet.publishedAt.substr(0,10)}</div>
    <div class="content w3-col s12">${video.snippet.description}</div>
  </li>`
  ).join('')}
</ul>
  `;
    return html;
  };

  function translate(str) {
    return wuwei.nls.translate(str);
  }

  return {
    template: template
  };
})();
// search.youtube.markup.js
