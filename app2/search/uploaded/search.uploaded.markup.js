/**
 * search.uploaded.markup.js
 * wuwei search.uploaded template
 *
 * WuWei is a free to use open source knowledge modeling tool.
 * More information on WuWei can be found on WuWei homepage.
 * https://www.wuwei.space/blog/
 *
 * WuWei is licensed under the MIT License
 * Copyright (c) 2013-2020, Nobuyuki SAMBUICHI
 **/
wuwei.search.uploaded.markup = ( function () {
  let _files;
  
  const template = function (year, month, files) {
    if (files) {
      _files = files;
    } else {
      _files = [];
    }
    let total = _files.length || '';
    // Weekdays
    var weekdayData = ['日', '月', '火', '水', '木', '金', '土'];
    function fileIcon(file) {
      const format = file.contenttype || '';
      let html = ``;
      if (format.indexOf('image') >= 0 || 'application/pdf' === format) {
        html = `
          <img src="${file.value.thumbnail.uri}" class="w3-col s3" id="${file.id}"
              ${'application/pdf' === format ? `style="border:solid 1px #a0a0a079"` : ``}
              onclick="wuwei.search.uploaded.showInfo('${file.id}')">`;
      } else if (format && (
          0 === format.indexOf('application/vnd') ||
          0 === format.indexOf('application/msword') ||
          'text/plain' === format)) {
        html = `
          <span class="icon w3-col s3"
              onclick="wuwei.search.uploaded.showInfo('${file.id}')">
          ${format.indexOf('.openxmlformats-officedocument.presentationml') > 0 ||
            format.indexOf('.ms-powerpoint') > 0 ?
              `<i class="far fa-file-powerpoint fa-2x"></i>` :
              format.indexOf('.openxmlformats-officedocument.spreadsheetml') > 0 ||
              format.indexOf('.ms-excel') > 0?
                `<i class="far fa-file-excel fa-2x"></i>` :
                format.indexOf('.openxmlformats-officedocument.wordprocessingml') > 0 ||
                0 == format.indexOf('application/msword') ?
                  `<i class="far fa-file-word fa-2x"></i>` :
                  'text/plain' === format ? `<i class="far fa-file-alt fa-2x"></i>` : ``
          }
          </span>`;
      }
      return html;
    }
    var html = `
<form class="form">
  <div class="form-group w3-row">
    <input type="search" id="search-text" name="q" class="w3-col s9"
            aria-label="Enter search string">
    <button id="search-button" class="w3-col s3">${translate('Search')}</button>
  </div>
<!--  <div class="calendar">
    <div class="month">      
      <ul>
        <li class="prev">&#10094;</li>
        <li class="next">&#10095;</li>
        <li class="current">${setCurrentMonth(year, month)}</li>
      </ul>
    </div>
    <ul class="weekdays">
    ${weekdayData.map(d => {return `<li>${d}</li>`; }).join('')}
    </ul>
    <ul class="days"></ul>
  </div>
-->
</form>

<div id="loading" class="loader hidden"></div>
<div id="loaded">${translate('Total items')} ${total}</div>

<ul class="list-group">
  ${_files.map(file => 
  `<li class="list-item w3-row">
    ${fileIcon(file)}
    <div class="content w3-col s8">${file.name}</div>
    <div class="action w3-col s1">
      <a>
        <i id="${file.id}"
          class="fas fa-plus"
          onclick="wuwei.search.uploaded.filerecord('${file.id}')">
        </i>
      </a>
      <a>
        <i class="fas fa-info"
          onclick="wuwei.search.uploaded.showInfo('${file.id}')">
        </i>
      </a>
    </div>
  </li>`
  ).join('')}
</ul>
  `;
    return html;
  };

  function setCurrentMonth(year, month) {
    return `<span>${month}</span><br><span style="font-size:12px">${year}</span>`;
  }

  /**
   * Display the calender for the given year and month
   * @param {number} year    - specify year
   * @param {number} month   - specify month
   */
  function add_calendar(year, month) {
    const wrapper = document.querySelector('#search-uploaded .calendar');
    generate_calendar_header(wrapper, year, month);
    generate_calendar_days(wrapper, year, month);
  }

  /**
  * Return header element for the given year and month
  * @param {number} year    - specify year
  * @param {number} month   - specify month
  */
  function generate_calendar_header(wrapper, year, month) {
    const currentMonthEl = wrapper.querySelector('.current');
    var nextMonth = new Date(year, (month - 1));
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    var prevMonth = new Date(year, (month - 1));
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    // Prev button
    var cPrev = wrapper.querySelector('.month .prev');
    cPrev.addEventListener('click', function() {
      const
        prevMYear = prevMonth.getFullYear(),
        prevMMonth = prevMonth.getMonth() + 1;
      currentMonthEl.innerHTML = setCurrentMonth(prevMYear, prevMMonth);
      add_calendar(prevMYear, prevMMonth);
    }, false);
    // Next button
    var cNext = wrapper.querySelector('.month .next');
    cNext.addEventListener('click', function() {
      const
        nextMYear = nextMonth.getFullYear(),
        nextMMonth = nextMonth.getMonth() + 1;
      currentMonthEl.innerHTML = setCurrentMonth(nextMYear, nextMMonth);
      add_calendar(nextMYear, nextMMonth);
    }, false);
  }

  /**
  * @param {number} year
  * @param {number} month
  */
  function generate_calendar_days(wrapper, year, month) {
    var i, newLi, newContent;
    var today = new Date();
    var thisMonth = today.getMonth() + 1;
    var date = today.getDate();
    // get calendar data
    var calendarData = get_month_calendar(year, month);
    i = calendarData[0].weekday; // get the weekday of the first date
    // fill 
    while (i > 0) {
      i--;
      calendarData.unshift({
        day: '',
        weekday: i
      });
    }
    // Dates
    var daysUl = wrapper.querySelector('.days');
    daysUl.innerHTML = '';
    var day, weekday;
    for (i = 0; i < calendarData.length; i++) {
      newLi = document.createElement('li'); 
      day = calendarData[i].day;
      weekday = calendarData[i].weekday;
      if(day > 0) {
        newContent = document.createTextNode(day);
        newLi.appendChild(newContent);
        if (date === day && month === thisMonth) {
          newLi.classList.add('today');
        }
        if(0 === weekday) {
          newLi.classList.add('sunday');
        }
      }
      daysUl.appendChild(newLi);
    }
  }

  /**
  * return calender information for given month and year
  * @param {number} year  - set year
  * @param {number} month - set month
  */
  function get_month_calendar(year, month) {
    var firstDate = new Date(year, (month - 1), 1); // The first date for given year and month
    var lastDay = new Date(year, (firstDate.getMonth() + 1), 0).getDate(); // The last date for the given year and month
    var weekday = firstDate.getDay(); // The week day for the first date
    var calendarData = [];
    var weekdayCount = weekday;
    for (var i = 0; i < lastDay; i++) {
      calendarData[i] = {
        day: i + 1,
        weekday: weekdayCount
      };
      // When weekday count reaches 6(Saturday) reset to 0(Sunday)
      if(weekdayCount >= 6) {
        weekdayCount = 0;
      } else {
        weekdayCount++;
      }
    }
    return calendarData;
  }

  function translate(str) {
    return wuwei.nls.translate(str);
  }

  return {
    add_calendar: add_calendar,
    template: template
  };
})();
// search.uploaded.markup.js
