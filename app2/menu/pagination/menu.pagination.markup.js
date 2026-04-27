/**
 * menu.pagination.markup.js
 * menu.pagination template
 *
 * WuWei is a free to use open source knowledge modeling tool.
 * More information on WuWei can be found on WuWei homepage.
 * https://www.wuwei.space/blog/
 *
 * WuWei is licensed under the MIT License
 * Copyright (c) 2013-2019, Nobuyuki SAMBUICHI
 **/
wuwei.menu.pagination.markup = ( function () { /**
   * 
   * @param [{name: string, value: any}] items - 
   */
  function checkPrevVisible(pagination_id, current_page) {
    var
      pagination = document.getElementById(pagination_id),
      visibility;
    if (current_page === 1) {
      visibility = 'hidden'
    } else {
      visibility = 'visible'
    }
    if (pagination && pagination.querySelector('.btn-prev')) {
      pagination.querySelector('.btn-prev').style.visibility = visibility;
    }
    return visibility;
  }

  function checkNextVisible(pagination_id, current_page, count, per_page, total) {
    var
      pagination = document.getElementById(pagination_id),
      visibility;
    if (current_page * per_page * count >= total) {
      visibility = 'hidden';
    } else {
      visibility = 'visible';
    }
    if (pagination && pagination.querySelector('.btn-next')) {
      pagination.querySelector('.btn-next').style.visibility = visibility;
    }
    return visibility;
  }

  function checkPageIndex(pagination_id, count, per_page, total) {
    var
      pagination = document.getElementById(pagination_id),
      visibility;
    if (per_page * count >= total) {
      visibility = 'hidden';
    } else {
      visibility = 'visible';
    }
    if (pagination && pagination.querySelector('#page')) {
      pagination.querySelector('#page').style.visibility = visibility;
    }
    return visibility;
  }

  function template(_records, current_page, count, per_page, total) {
    let
      seq = 0,
      num_pages,
      records = [];
    num_pages = Math.ceil(total / count / per_page);
    for (var i = 0; i < per_page && i < _records.length; i++) {
      if (_records[i]){
        records.push(_records[i]);
      }
    }
    if (total < count) {
      return null;
    }
    return `
  <div class="pagination w3-card-4">
    <i onclick="wuwei.menu.pagination.prev(this)" 
        style-"visibility:${checkPrevVisible(null, current_page)}
        class="btn-prev fas fa-caret-square-left"></i>
    ${records.map(record => {
      return `<div data-seq=${seq} data-value="${record.value}">
        <a href="#" data-seq=${seq++} data-value="${record.value}">${record.name}</a>
        <span class="tooltiptext">${record.value}</span>
      </div>`;
    }).join('')}
    <i onclick="wuwei.menu.pagination.next(this)"
        style="visibility:${checkNextVisible(null, current_page, count, per_page, total)}"
        class="btn-next fas fa-caret-square-right"></i>
    <span id="page"> ${current_page} / ${num_pages}</span>
  </div>
  `;
  }

  return {
    template: template,
    checkPrevVisible: checkPrevVisible,
    checkNextVisible: checkNextVisible,
    checkPageIndex: checkPageIndex
  };
})();
// menu.pagination.markup.js
