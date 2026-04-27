/**
 * menu.pagination.js
 * menu.pagination module
 * 
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2013-2019,2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 **/
wuwei.menu = wuwei.menu || {};
wuwei.menu.pagination = wuwei.menu.pagination || {};

( function (ns) {
  var
    current_page,
    per_page = 5,
    start,
    count,
    total,
    num_pages,
    pagination_id,
    records = [],
    custom_records = null,
    cb,
    menu = wuwei.menu;


  function addClickEvent(id) {
    function activate(event) {
      event.preventDefault();
      event.stopPropagation();

      const currentDiv = event.currentTarget;
      if (!currentDiv) {
        return false;
      }

      const selectedValue = Number(currentDiv.dataset.value);
      if (!Number.isFinite(selectedValue)) {
        return false;
      }

      const pageEls = document.querySelectorAll('#' + id + ' .pagination > div[data-value]');
      pageEls.forEach(pageEl => {
        pageEl.classList.remove('active');
      });
      currentDiv.classList.add('active');

      if (cb) {
        cb(selectedValue, count);
      }

      let nextCurrentPage = 1;

      if (Array.isArray(custom_records) && custom_records.length > 0) {
        const idx = custom_records.findIndex(record => Number(record.value) === selectedValue);
        if (idx >= 0) {
          nextCurrentPage = 1 + Math.floor(idx / per_page);
        }
      } else {
        nextCurrentPage = 1 + Math.floor((selectedValue - 1) / (count * per_page));
      }

      create(pagination_id, nextCurrentPage, count, per_page, total, cb, custom_records);
      return false;
    }

    const pageEls = document.querySelectorAll('#' + id + ' .pagination > div[data-value]');
    pageEls.forEach(pageEl => {
      pageEl.removeEventListener('click', activate, false);
      pageEl.addEventListener('click', activate, false);
    });
  }


  function page_records(current_page, count, per_page, total) {
    if (Array.isArray(custom_records) && custom_records.length > 0) {
      const startIndex = (current_page - 1) * per_page;
      return custom_records.slice(startIndex, startIndex + per_page);
    }

    const
      records = [],
      start = 1 + (current_page - 1) * per_page * count,
      current_name = 1 + (start - 1) / count;

    for (let i = 0; i < per_page && start + count * i <= total; i++) {
      records.push({ 'name': current_name + i, 'value': start + count * i });
    }
    return records;
  }


  function prev(el) {
    if (current_page > 1) {
      current_page--;
      create(pagination_id, current_page, count, per_page, total, cb, custom_records);
      if ('block' === document.getElementById('Pagination').style.display) {
        wuwei.menu.registerPagebuttonEvent();
      }
    }
  }


  function next(el) {
    if (current_page < num_pages) {
      current_page++;
      create(pagination_id, current_page, count, per_page, total, cb, custom_records);
      if ('block' === document.getElementById('Pagination').style.display) {
        wuwei.menu.registerPagebuttonEvent();
      }
    }
  }


  function create(id, _current_page, _count, _per_page, _total, _cb, _records) {
    var markup = menu.pagination.markup;

    pagination_id = id;
    current_page = _current_page || 1;
    count = _count;
    per_page = _per_page;
    cb = _cb;
    custom_records = Array.isArray(_records) ? _records.slice() : custom_records;
    total = Array.isArray(custom_records) ? custom_records.length : _total;
    start = 1 + (current_page - 1) * per_page * count;
    records = page_records(current_page, count, per_page, total);
    num_pages = Math.ceil(total / per_page);

    const paginationEl = document.getElementById(pagination_id);
    paginationEl.style.display = 'block';
    paginationEl.innerHTML = markup.template(records, current_page, count, per_page, total);

    addClickEvent(pagination_id);
    markup.checkPrevVisible(pagination_id, current_page);
    markup.checkNextVisible(pagination_id, current_page, count, per_page, total);
    markup.checkPageIndex(pagination_id, count, per_page, total);
    return paginationEl;
  }

  ns.current_page = current_page;
  ns.per_page = per_page;
  ns.next = next;
  ns.prev = prev;
  ns.create = create;
})(wuwei.menu.pagination);
// menu.pagination.js revised 2026-04-07