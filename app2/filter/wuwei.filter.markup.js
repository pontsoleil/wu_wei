/**
 * wuwei.filter.template.js
 * wuwei filter template
 *
 * WuWei is a free to use open source knowledge modeling tool.
 * More information on WuWei can be found on WuWei homepage.
 * https://wuwei.space/blog/
 *
 * WuWei is licensed under the MIT License
 * Copyright (c) 2013-2019,2023 Nobuyuki SAMBUICHI
 **/
wuwei.filter.markup = ( function () {
  const template = function () {
    var html = `
<!--Card-->
<!--Card header-->
<div class="w3-container card-header">
  <h2>
  <i class="fas fa-filter fa-lg fa-fw"></i>
  </h2>
  <!-- DISMISS BUTTON -->
  <a id="filterDismiss" onclick="wuwei.filter.close()">
    <i class="fa fa-times fa-lg fa-fw"></i>
  </a>
  <!-- SEARCH BUTTON 
  <a id="searchOpen" onclick="wuwei.filter.searchOpen()">
    <i class="fas fa-search fa-lg fa-fw"></i>
  </a> -->
  <!-- MENU -->
</div>
<!--/.Card header-->
<!--Card content-->
<div id="filter-generic" class="card-body">
  <div class="year-check">
    <input class="form-check-input" type="checkbox" id="yearCheckbox" checked>
    <label class="form-check-label" for="yearCheckbox">
      年の範囲を指定
    </label>
  </div>
  <div id="year_slider"></div>
  <!--p id="selected_year_range"></p-->
  <div class="year-range">
    <label for="start_year">指定期間</label>
    <input id="start_year" name="start_year" type="text" pattern="\d{4}" title="4桁の数字を入力">
    <label for="end_year">年〜</label>
    <input id="end_year" name="end_year" type="text" pattern="\d{4}" title="4桁の数字を入力">
    <p>年</p>
  </div>
  <div calss="category">
    <label for="category_text">分類</label>
    <input id="category_text" name="category_text" type="text">
  </div>
  <div calss="filter-text">
    <label for="filter_text">文字</label>
    <input id="filter_text" name="filter_text" type="text">
  </div>
  <div class="buttons">
    <button type="button" class="btn btn-primary btn-sm" onclick="wuwei.filter.filterRender()">絞込み</button>
    <button type="button" class="btn btn-success btn-sm" onclick="wuwei.filter.showAll()">全て表示</button>
    <button type="button" class="btn btn-secondary btn-sm" onclick="wuwei.filter.hideAll()">全て消去</button>
  </div>
</div>
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
// wuwei.filter.markup.js 2023-07-21
