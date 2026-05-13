/**
 * search.youtube.service.js
 * search.youtube.service module
 *
 * WuWei is a free to use open source knowledge modeling tool.
 * More information on WuWei can be found on WuWei homepage.
 * https://www.wuwei.space/blog/
 *
 * WuWei is licensed under the MIT License
 * Copyright (c) 2013-2020, Nobuyuki SAMBUICHI
 **/
wuwei.search.youtube.service = ( function () {
  const
    stateMap = {
      'term': null,
      'results': null,
      'map': new Map(),
      'kind': null,// "youtube#searchListResponse",
      'etag': null,// "\"ksCrgYQhtFrXgbHAhi9Fo5t0C2I/rtoD6gl5PCKpiyoSCHMdYycSBqY\"",
      'nextPageToken': null,// "CDIQAA",
      'prevPageToken': null,// "CDIQAA",
      'regionCode': null,// "JP",
      'pageInfo': {
        'totalResults': null,// 1000000,
        'resultsPerPage': null// 50
      }
    };

  class YoutubeItem {
    constructor( param ) {
      this.kind = param.kind;
      this.etag = param.etag;
      this.id = {
        kind: param.id.kind,
        videoId: param.id.videoId
      };
      this.snippet = {
        publishedAt: param.snippet.publishedAt,
        channelId: param.snippet.channelId,
        title: param.snippet.title,
        description: param.snippet.description,
        thumbnails: {
          default: {
            url: param.snippet.thumbnails.default.url,
            width: param.snippet.thumbnails.default.width,
            height: param.snippet.thumbnails.default.height
          },
          medium: {
            url: param.snippet.thumbnails.medium.url,
            width: param.snippet.thumbnails.medium.width,
            height: param.snippet.thumbnails.medium.height
          },
          high: {
            url: param.snippet.thumbnails.high.url,
            width: param.snippet.thumbnails.high.width,
            height: param.snippet.thumbnails.high.height
          }
        },
        channelTitle: param.snippet.channelTitle,
        liveBroadcastContent: param.snippet.liveBroadcastContent
      };
      if (param.value) {
        this.value = param.value;
      }
      return this;
    }
  }

  const apiRoot = constants.GOOGLE_ENV.API_ROOT.YouTube;
  const apiSearch = 'search';
  const apiVideos = 'videos';
  const API_KEY = constants.GOOGLE_ENV.API_KEY.YouTube;
      // see https://developers.google.com/youtube/v3/code_samples/javascript?hl=ja
      // also https://stackoverflow.com/questions/36411632/error-403-forbidden-whith-youtube-api-v3
      // 'API Restrictions' on the APIs credentials page added it to restrict to the YouTube ABI,
      // now it's working fine.
  function gapiStart() {
    // 1. Load the JavaScript client library.
    gapi.load('client', googleApiClientReady);
  }

  function renderSearchResponse(response) {
    stateMap.kind = response.kind,// "youtube#searchListResponse",
    stateMap.etag = response.etag,// "\"ksCrgYQhtFrXgbHAhi9Fo5t0C2I/rtoD6gl5PCKpiyoSCHMdYycSBqY\"",
    stateMap.nextPageToken = response.nextPageToken,// "CDIQAA",
    stateMap.prevPageToken = response.prevPageToken,// "CDIQAA",
    stateMap.regionCode = response.regionCode,// "JP",
    stateMap.pageInfo.totalResults = response.pageInfo.totalResults;
    stateMap.pageInfo.resultsPerPage = response.pageInfo.resultsPerPage;
    let results = response.items.map(item => {
      return new YoutubeItem({
        'kind': item.kind, // "youtube#searchResult",
        'etag': item.etag, // "\"RmznBCICv9YtgWaaa_nWDIH1_GM/Vx8fYkhs8I5jFp1wTP4FYXMmn9M\"",
        'id': item.id,     // {"kind": "youtube#video", "videoId": "VjZ2aavJI-w"},
        'snippet': item.snippet,
        'value': item
      });
    });
    stateMap.results = results;
    stateMap.map.clear();
    results.map(item => stateMap.map.set(item.id.videoId, item) );
    document.getElementById('search-youtube').innerHTML = wuwei.search.youtube.markup.template(results);
    wuwei.search.youtube.registerButton();
  }

  function search(term) {
    stateMap.term = term;
    const loading = document.getElementById('loading');
    loading.classList.remove('hidden');
    function loadApi() {
      return new Promise(function(resolve,reject){
        gapi.client.setApiKey(API_KEY);
        gapi.client.load('youtube', 'v3', resolve);
      });
    };
    loadApi()
    .then(function() {
      var request = gapi.client.youtube.search.list({
        'q': term,
        'part': 'snippet',
        'order': 'rating',
        'maxResults': 50
      });
      request.execute(function(response) {
        loading.classList.remove('hidden');
        console.log(response);
        renderSearchResponse(response);
      });
    });
  }

  function prevPage() {
    const loading = document.getElementById('loading'),
          term = stateMap.term,
          prevPageToken = stateMap.prevPageToken,
          apiURL = `${apiRoot}/${apiSearch}` +
              `?q=${term}&part=snippet&maxResults=50&pageToken=${prevPageToken}&order=rating&key=${API_KEY}`;
    loading.classList.remove('hidden');
    console.log(`prevPageToken ${prevPageToken}`);
    return ajaxRequest(apiURL, undefined, 'GET')
    .then(function(responseText) {
      loading.classList.remove('hidden');
      let response;
      try {
        response = JSON.parse(responseText);
      }
      catch(e) { console.log(e); }
      console.log(response);
      renderSearchResponse(response);
    });
  }

  function nextPage() {
    const loading = document.getElementById('loading'),
          term = stateMap.term,
          nextPageToken = stateMap.nextPageToken,
          apiURL = `${apiRoot}/${apiSearch}` +
              `?q=${term}&part=snippet&maxResults=50&pageToken=${nextPageToken}&order=rating&key=${API_KEY}`;
    loading.classList.remove('hidden');
    console.log(`nextPageToken ${nextPageToken}`);
    return ajaxRequest(apiURL, undefined, 'GET')
    .then(function(responseText) {
      loading.classList.remove('hidden');
      let response;
      try {
        response = JSON.parse(responseText);
      }
      catch(e) { console.log(e); }
      console.log(response);
      renderSearchResponse(response);
    });
  }

  function showDetail(id) {
    let //id = event.target.id,
        video = stateMap.map.get(id);
    console.log(video);
    const apiURL = `${apiRoot}/${apiVideos}` +
              `?id=${id}&part=snippet,contentDetails,topicDetails,statistics&key=${API_KEY}`;
    return ajaxRequest(apiURL, undefined, 'GET')
    .then(function(responseText) {
      let results, map;
      try {
        results = JSON.parse(responseText);
        console.log(results);
        return results.items.map(
          video => {
            map = {
              'command': 'openInfo',
              'param': {
                'node': {
                  'type': 'Content',
                  'label': video.snippet.title,
                  'thumbnail': video.snippet.thumbnails.medium.url,
                  'description': video.snippet.description
                },
                'resource': {
                  'option': 'youtube',
                  'name': video.snippet.title,
                  // uri: 'https://www.youtube.com/embed/' + video.id,
                  'uri': `https://youtu.be/${video.id}`,
                  'thumbnail': video.snippet.thumbnails.medium.url,
                  'smallThumbnail': video.snippet.thumbnails.default.url,
                  'value': video, // video.snippet.description,
                  'creator': video.snippet.channelTitle
                }
              }
            };
            wuwei.search.searchRender(map);
          },
          error => {
            console.log(error);
          }
        );
      }
      catch(e) {
        console.log(e);
      }
    });
  }

  function videorecord() {
    let
      id = event.target.id,
      video = stateMap.map.get(id);
    console.log(video);
    const apiURL = `${apiRoot}/${apiVideos}` +
              `?id=${id}&part=snippet,contentDetails,topicDetails,statistics&key=${API_KEY}`;
    return ajaxRequest(apiURL, undefined, 'GET')
    .then(function(responseText) {
      const results = JSON.parse(responseText);
      console.log(results);
      return results.items.map(
        video => {
          const
            map = {
              'command': 'videorecord',
              'param': {
                'id': id,
                'video': video
              }
            };
          wuwei.search.searchRender(map);
        },
        error => {
          console.log(error);
        }
      );
    });
  }

  return {
    stateMap: stateMap,
    gapiStart: gapiStart,
    search: search,
    prevPage: prevPage,
    nextPage: nextPage,
    showDetail: showDetail,
    videorecord: videorecord
  };

})();
// search.youtube.service.js
