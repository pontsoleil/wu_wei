/**
 * wuwei.search.template.js
 * wuwei search template
 *
 * WuWei is a free to use open source knowledge modeling tool.
 * More information on WuWei can be found on WuWei homepage.
 * https://www.wuwei.space/blog/
 *
 * WuWei is licensed under the MIT License
 * Copyright (c) 2013-2020,2023 Nobuyuki SAMBUICHI
 **/
wuwei.search.markup = ( function () {
  const template = function () {
    var html = `
<!--Card-->
<!--Card header-->
<header class="w3-container">
  <h2>
  <i class="fas fa-search fa-lg fa-fw"></i>
  </h2>
  <!-- DISMISS BUTTON -->
  <a id="searchDismiss" onclick="wuwei.search.close()">
    <i class="fa fa-times fa-lg fa-fw"></i>
  </a>
  <!-- FILTER BUTTON 2023-05-29
  <a id="filterOpen" onclick="wuwei.search.filterOpen()">
    <i class="fas fa-filter fa-lg fa-fw"></i>
  </a> -->
  <!-- MENU -->
  <!--
  <ul>
    <li>
      <a id="note" onclick="wuwei.search.clicked('note')">
        <span class="font-weight-bold"><i class="fas fa-book"></i>${translate('Notebook')}</span>
      </a>
    </li>
    -->
    <!--
    <li>
      <a id="uploaded" onclick="wuwei.search.clicked('uploaded')">
        <span class="font-weight-bold"><i class="fas fa-cloud"></i>${translate('Upload')}</span>
      </a>
    </li>
    -->
    <!--
    <li>
      <a id="youTube" onclick="wuwei.search.clicked('youTube')">
        <span class="font-weight-bold"><i class="fab fa-youtube "></i> YouTube</span>
      </a>
    </li>
    <li>
      <a id="wikipedia" onclick="wuwei.search.clicked('wikipedia')">
        <span class="font-weight-bold"><i class="fab fa-wikipedia-w"></i>ikipedia</span>
      </a>
    </li>
    -->
  <!--
  </ul>
  -->
</header>
<!--/.Card header-->
<!--Card content-->
<div id="search-this_note"></div>
<!--
<div id="search-note"></div>
<div id="search-uploaded"></div>
<div id="search-youtube"></div>
<div id="search-wikipedia"></div>
-->
<!--/.Card content-->
<!--/.Card-->
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
// wuwei.search.markup.js 2023-05-29
