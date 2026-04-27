/**
 * wuwei.draw.markup.js
 * wuwei draw template
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2013-2020, 2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.draw = wuwei.draw || {};

wuwei.draw.markup = ( function () {
  const template = `
   <defs>
<!-- following icons are provided under Font Awesome Free License Last updated on July 12, 2018 https://fontawesome.com/license/free
-->
      <svg id="fa-file" aria-hidden="true" data-prefix="far" data-icon="file" class="svg-inline--fa fa-file fa-w-12" role="img" viewBox="0 0 384 512">
        <path d="M369.9 97.9L286 14C277 5 264.8-.1 252.1-.1H48C21.5 0 0 21.5 0 48v416c0 26.5 21.5 48 48 48h288c26.5 0 48-21.5 48-48V131.9c0-12.7-5.1-25-14.1-34zM332.1 128H256V51.9l76.1 76.1zM48 464V48h160v104c0 13.3 10.7 24 24 24h104v288H48z"></path>
      </svg>

      <svg id="fa-file-alt" aria-hidden="true" data-prefix="far" data-icon="file-alt" class="svg-inline--fa fa-file-alt fa-w-12" role="img" viewBox="0 0 384 512">
        <path d="M288 248v28c0 6.6-5.4 12-12 12H108c-6.6 0-12-5.4-12-12v-28c0-6.6 5.4-12 12-12h168c6.6 0 12 5.4 12 12zm-12 72H108c-6.6 0-12 5.4-12 12v28c0 6.6 5.4 12 12 12h168c6.6 0 12-5.4 12-12v-28c0-6.6-5.4-12-12-12zm108-188.1V464c0 26.5-21.5 48-48 48H48c-26.5 0-48-21.5-48-48V48C0 21.5 21.5 0 48 0h204.1C264.8 0 277 5.1 286 14.1L369.9 98c9 8.9 14.1 21.2 14.1 33.9zm-128-80V128h76.1L256 51.9zM336 464V176H232c-13.3 0-24-10.7-24-24V48H48v416h288z">
      </svg>

      <svg id="fa-file-archive" aria-hidden="true" data-prefix="far" data-icon="file-archive" class="svg-inline--fa fa-file-archive fa-w-12" role="img" viewBox="0 0 384 512">
        <path d="M369.941 97.941l-83.882-83.882A48 48 0 0 0 252.118 0H48C21.49 0 0 21.49 0 48v416c0 26.51 21.49 48 48 48h288c26.51 0 48-21.49 48-48V131.882a48 48 0 0 0-14.059-33.941zM256 51.882L332.118 128H256V51.882zM336 464H48V48h79.714v16h32V48H208v104c0 13.255 10.745 24 24 24h104v288zM192.27 96h-32V64h32v32zm-32 0v32h-32V96h32zm0 64v32h-32v-32h32zm32 0h-32v-32h32v32zm1.909 105.678A12 12 0 0 0 182.406 256H160.27v-32h-32v32l-19.69 97.106C101.989 385.611 126.834 416 160 416c33.052 0 57.871-30.192 51.476-62.62l-17.297-87.702zM160.27 390.073c-17.918 0-32.444-12.105-32.444-27.036 0-14.932 14.525-27.036 32.444-27.036s32.444 12.105 32.444 27.036c0 14.931-14.526 27.036-32.444 27.036zm32-166.073h-32v-32h32v32z"></path>
      </svg>

      <svg id="fa-file-audio" aria-hidden="true" data-prefix="far" data-icon="file-audio" class="svg-inline--fa fa-file-audio fa-w-12" role="img" viewBox="0 0 384 512">
        <path fill="currentColor" d="M369.941 97.941l-83.882-83.882A48 48 0 0 0 252.118 0H48C21.49 0 0 21.49 0 48v416c0 26.51 21.49 48 48 48h288c26.51 0 48-21.49 48-48V131.882a48 48 0 0 0-14.059-33.941zM332.118 128H256V51.882L332.118 128zM48 464V48h160v104c0 13.255 10.745 24 24 24h104v288H48zm144-76.024c0 10.691-12.926 16.045-20.485 8.485L136 360.486h-28c-6.627 0-12-5.373-12-12v-56c0-6.627 5.373-12 12-12h28l35.515-36.947c7.56-7.56 20.485-2.206 20.485 8.485v135.952zm41.201-47.13c9.051-9.297 9.06-24.133.001-33.439-22.149-22.752 12.235-56.246 34.395-33.481 27.198 27.94 27.212 72.444.001 100.401-21.793 22.386-56.947-10.315-34.397-33.481z"></path>
      </svg>

      <svg id="fa-file-code" aria-hidden="true" data-prefix="far" data-icon="file-code" class="svg-inline--fa fa-file-code fa-w-12" role="img" viewBox="0 0 384 512">
        <path fill="currentColor" d="M369.941 97.941l-83.882-83.882A48 48 0 0 0 252.118 0H48C21.49 0 0 21.49 0 48v416c0 26.51 21.49 48 48 48h288c26.51 0 48-21.49 48-48V131.882a48 48 0 0 0-14.059-33.941zM332.118 128H256V51.882L332.118 128zM48 464V48h160v104c0 13.255 10.745 24 24 24h104v288H48zm101.677-115.115L116.854 320l32.822-28.885a8.793 8.793 0 0 0 .605-12.624l-17.403-18.564c-3.384-3.613-8.964-3.662-12.438-.401L62.78 313.58c-3.703 3.474-3.704 9.367.001 12.84l57.659 54.055a8.738 8.738 0 0 0 6.012 2.381 8.746 8.746 0 0 0 6.427-2.782l17.403-18.563a8.795 8.795 0 0 0-.605-12.626zm84.284-127.85l-24.401-7.084a8.796 8.796 0 0 0-10.905 5.998L144.04 408.061c-1.353 4.66 1.338 9.552 5.998 10.905l24.403 7.084c4.68 1.355 9.557-1.354 10.905-5.998l54.612-188.112c1.354-4.66-1.337-9.552-5.997-10.905zm87.258 92.545l-57.658-54.055c-3.526-3.307-9.099-3.165-12.439.401l-17.403 18.563a8.795 8.795 0 0 0 .605 12.625L267.146 320l-32.822 28.885a8.793 8.793 0 0 0-.605 12.624l17.403 18.564a8.797 8.797 0 0 0 12.439.401h-.001l57.66-54.055c3.703-3.473 3.703-9.366-.001-12.839z"></path>
      </svg>

      <svg id="fa-file-csv" aria-hidden="true" data-prefix="fas" data-icon="file-csv" class="svg-inline--fa fa-file-csv fa-w-12" role="img" viewBox="0 0 384 512">
        <path fill="currentColor" d="M224 136V0H24C10.7 0 0 10.7 0 24v464c0 13.3 10.7 24 24 24h336c13.3 0 24-10.7 24-24V160H248c-13.2 0-24-10.8-24-24zm-96 144c0 4.42-3.58 8-8 8h-8c-8.84 0-16 7.16-16 16v32c0 8.84 7.16 16 16 16h8c4.42 0 8 3.58 8 8v16c0 4.42-3.58 8-8 8h-8c-26.51 0-48-21.49-48-48v-32c0-26.51 21.49-48 48-48h8c4.42 0 8 3.58 8 8v16zm44.27 104H160c-4.42 0-8-3.58-8-8v-16c0-4.42 3.58-8 8-8h12.27c5.95 0 10.41-3.5 10.41-6.62 0-1.3-.75-2.66-2.12-3.84l-21.89-18.77c-8.47-7.22-13.33-17.48-13.33-28.14 0-21.3 19.02-38.62 42.41-38.62H200c4.42 0 8 3.58 8 8v16c0 4.42-3.58 8-8 8h-12.27c-5.95 0-10.41 3.5-10.41 6.62 0 1.3.75 2.66 2.12 3.84l21.89 18.77c8.47 7.22 13.33 17.48 13.33 28.14.01 21.29-19 38.62-42.39 38.62zM256 264v20.8c0 20.27 5.7 40.17 16 56.88 10.3-16.7 16-36.61 16-56.88V264c0-4.42 3.58-8 8-8h16c4.42 0 8 3.58 8 8v20.8c0 35.48-12.88 68.89-36.28 94.09-3.02 3.25-7.27 5.11-11.72 5.11s-8.7-1.86-11.72-5.11c-23.4-25.2-36.28-58.61-36.28-94.09V264c0-4.42 3.58-8 8-8h16c4.42 0 8 3.58 8 8zm121-159L279.1 7c-4.5-4.5-10.6-7-17-7H256v128h128v-6.1c0-6.3-2.5-12.4-7-16.9z"></path>
      </svg>

      <svg id="fa-file-excel" aria-hidden="true" data-prefix="far" data-icon="file-excel" class="svg-inline--fa fa-file-excel fa-w-12" role="img" viewBox="0 0 384 512">
        <path d="M369.9 97.9L286 14C277 5 264.8-.1 252.1-.1H48C21.5 0 0 21.5 0 48v416c0 26.5 21.5 48 48 48h288c26.5 0 48-21.5 48-48V131.9c0-12.7-5.1-25-14.1-34zM332.1 128H256V51.9l76.1 76.1zM48 464V48h160v104c0 13.3 10.7 24 24 24h104v288H48zm212-240h-28.8c-4.4 0-8.4 2.4-10.5 6.3-18 33.1-22.2 42.4-28.6 57.7-13.9-29.1-6.9-17.3-28.6-57.7-2.1-3.9-6.2-6.3-10.6-6.3H124c-9.3 0-15 10-10.4 18l46.3 78-46.3 78c-4.7 8 1.1 18 10.4 18h28.9c4.4 0 8.4-2.4 10.5-6.3 21.7-40 23-45 28.6-57.7 14.9 30.2 5.9 15.9 28.6 57.7 2.1 3.9 6.2 6.3 10.6 6.3H260c9.3 0 15-10 10.4-18L224 320c.7-1.1 30.3-50.5 46.3-78 4.7-8-1.1-18-10.3-18z"></path>
      </svg>

      <svg id="fa-file-image" aria-hidden="true" data-prefix="far" data-icon="file-image" class="svg-inline--fa fa-file-image fa-w-12" role="img" viewBox="0 0 384 512">
        <path fill="currentColor" d="M369.9 97.9L286 14C277 5 264.8-.1 252.1-.1H48C21.5 0 0 21.5 0 48v416c0 26.5 21.5 48 48 48h288c26.5 0 48-21.5 48-48V131.9c0-12.7-5.1-25-14.1-34zM332.1 128H256V51.9l76.1 76.1zM48 464V48h160v104c0 13.3 10.7 24 24 24h104v288H48zm32-48h224V288l-23.5-23.5c-4.7-4.7-12.3-4.7-17 0L176 352l-39.5-39.5c-4.7-4.7-12.3-4.7-17 0L80 352v64zm48-240c-26.5 0-48 21.5-48 48s21.5 48 48 48 48-21.5 48-48-21.5-48-48-48z"></path>
      </svg>

      <svg id="fa-file-pdf" aria-hidden="true" data-prefix="far" data-icon="file-pdf" class="svg-inline--fa fa-file-pdf fa-w-12" role="img" viewBox="0 0 384 512">
        <path fill="currentColor" d="M369.9 97.9L286 14C277 5 264.8-.1 252.1-.1H48C21.5 0 0 21.5 0 48v416c0 26.5 21.5 48 48 48h288c26.5 0 48-21.5 48-48V131.9c0-12.7-5.1-25-14.1-34zM332.1 128H256V51.9l76.1 76.1zM48 464V48h160v104c0 13.3 10.7 24 24 24h104v288H48zm250.2-143.7c-12.2-12-47-8.7-64.4-6.5-17.2-10.5-28.7-25-36.8-46.3 3.9-16.1 10.1-40.6 5.4-56-4.2-26.2-37.8-23.6-42.6-5.9-4.4 16.1-.4 38.5 7 67.1-10 23.9-24.9 56-35.4 74.4-20 10.3-47 26.2-51 46.2-3.3 15.8 26 55.2 76.1-31.2 22.4-7.4 46.8-16.5 68.4-20.1 18.9 10.2 41 17 55.8 17 25.5 0 28-28.2 17.5-38.7zm-198.1 77.8c5.1-13.7 24.5-29.5 30.4-35-19 30.3-30.4 35.7-30.4 35zm81.6-190.6c7.4 0 6.7 32.1 1.8 40.8-4.4-13.9-4.3-40.8-1.8-40.8zm-24.4 136.6c9.7-16.9 18-37 24.7-54.7 8.3 15.1 18.9 27.2 30.1 35.5-20.8 4.3-38.9 13.1-54.8 19.2zm131.6-5s-5 6-37.3-7.8c35.1-2.6 40.9 5.4 37.3 7.8z"></path>
      </svg>

      <svg id="fa-file-powerpoint" aria-hidden="true" data-prefix="far" data-icon="file-powerpoint" class="svg-inline--fa fa-file-powerpoint fa-w-12" role="img" viewBox="0 0 384 512">
        <path d="M369.9 97.9L286 14C277 5 264.8-.1 252.1-.1H48C21.5 0 0 21.5 0 48v416c0 26.5 21.5 48 48 48h288c26.5 0 48-21.5 48-48V131.9c0-12.7-5.1-25-14.1-34zM332.1 128H256V51.9l76.1 76.1zM48 464V48h160v104c0 13.3 10.7 24 24 24h104v288H48zm72-60V236c0-6.6 5.4-12 12-12h69.2c36.7 0 62.8 27 62.8 66.3 0 74.3-68.7 66.5-95.5 66.5V404c0 6.6-5.4 12-12 12H132c-6.6 0-12-5.4-12-12zm48.5-87.4h23c7.9 0 13.9-2.4 18.1-7.2 8.5-9.8 8.4-28.5.1-37.8-4.1-4.6-9.9-7-17.4-7h-23.9v52z"></path>
      </svg>

      <svg id="fa-file-video" aria-hidden="true" data-prefix="far" data-icon="file-video" class="svg-inline--fa fa-file-video fa-w-12" role="img" viewBox="0 0 384 512">
        <path fill="currentColor" d="M369.941 97.941l-83.882-83.882A48 48 0 0 0 252.118 0H48C21.49 0 0 21.49 0 48v416c0 26.51 21.49 48 48 48h288c26.51 0 48-21.49 48-48V131.882a48 48 0 0 0-14.059-33.941zM332.118 128H256V51.882L332.118 128zM48 464V48h160v104c0 13.255 10.745 24 24 24h104v288H48zm228.687-211.303L224 305.374V268c0-11.046-8.954-20-20-20H100c-11.046 0-20 8.954-20 20v104c0 11.046 8.954 20 20 20h104c11.046 0 20-8.954 20-20v-37.374l52.687 52.674C286.704 397.318 304 390.28 304 375.986V264.011c0-14.311-17.309-21.319-27.313-11.314z"></path>
      </svg>

      <svg id="fa-file-word" aria-hidden="true" data-prefix="far" data-icon="file-word" class="svg-inline--fa fa-file-word fa-w-12" role="img" viewBox="0 0 384 512">
        <path d="M369.9 97.9L286 14C277 5 264.8-.1 252.1-.1H48C21.5 0 0 21.5 0 48v416c0 26.5 21.5 48 48 48h288c26.5 0 48-21.5 48-48V131.9c0-12.7-5.1-25-14.1-34zM332.1 128H256V51.9l76.1 76.1zM48 464V48h160v104c0 13.3 10.7 24 24 24h104v288H48zm220.1-208c-5.7 0-10.6 4-11.7 9.5-20.6 97.7-20.4 95.4-21 103.5-.2-1.2-.4-2.6-.7-4.3-.8-5.1.3.2-23.6-99.5-1.3-5.4-6.1-9.2-11.7-9.2h-13.3c-5.5 0-10.3 3.8-11.7 9.1-24.4 99-24 96.2-24.8 103.7-.1-1.1-.2-2.5-.5-4.2-.7-5.2-14.1-73.3-19.1-99-1.1-5.6-6-9.7-11.8-9.7h-16.8c-7.8 0-13.5 7.3-11.7 14.8 8 32.6 26.7 109.5 33.2 136 1.3 5.4 6.1 9.1 11.7 9.1h25.2c5.5 0 10.3-3.7 11.6-9.1l17.9-71.4c1.5-6.2 2.5-12 3-17.3l2.9 17.3c.1.4 12.6 50.5 17.9 71.4 1.3 5.3 6.1 9.1 11.6 9.1h24.7c5.5 0 10.3-3.7 11.6-9.1 20.8-81.9 30.2-119 34.5-136 1.9-7.6-3.8-14.9-11.6-14.9h-15.8z"></path>
      </svg>

      <svg id="fa-square" aria-hidden="true" focusable="false" data-prefix="far" data-icon="square" class="svg-inline--fa fa-square fa-w-14" role="img" viewBox="0 0 448 512">
        <path fill="currentColor" d="M400 32H48C21.5 32 0 53.5 0 80v352c0 26.5 21.5 48 48 48h352c26.5 0 48-21.5 48-48V80c0-26.5-21.5-48-48-48zm-6 400H54c-3.3 0-6-2.7-6-6V86c0-3.3 2.7-6 6-6h340c3.3 0 6 2.7 6 6v340c0 3.3-2.7 6-6 6z"></path>
      </svg>
<!-- above icons are provided under Font Awesome Free License Last updated on July 12, 2018 -->

      <linearGradient id="vertical-gradation" x1="0%" x2="0%" y1="0%" y2="100%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="1"></stop>
        <stop offset="80%" stop-color="#fefefe" stop-opacity="1"></stop>
        <stop offset="90%" stop-color="#fafafa" stop-opacity="1"></stop>
        <stop offset="100%" stop-color="#e0e0e0" stop-opacity="1"></stop>
      </linearGradient>
              
      <filter id="dropshadow" height="130%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="4"></feGaussianBlur>
        <feOffset dx="2" dy="5" result="offsetBlur"></feOffset>
        <feComponentTransfer>
          <feFuncA type="linear" slope="0.7" intercept="0" in="offsetBlur" result="linearTransfer"></feFuncA>
        </feComponentTransfer>
        <feMerge> 
          <feMergeNode in="linearTransfer"></feMergeNode>
          <feMergeNode in="SourceGraphic"></feMergeNode>
        </feMerge>
      </filter>

      <filter id="slow-shadow" height="110%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="1"></feGaussianBlur>
        <feOffset dx="0.5" dy="1.5" result="offsetBlur"></feOffset>
        <feComponentTransfer>
          <feFuncA type="linear" slope="0.5" intercept="0" in="offsetBlur" result="linearTransfer"></feFuncA>
        </feComponentTransfer>
        <feMerge> 
          <feMergeNode in="linearTransfer"></feMergeNode>
          <feMergeNode in="SourceGraphic"></feMergeNode>
        </feMerge>
      </filter>

      <filter id="quick-shadow" height="130%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="3"></feGaussianBlur>
        <feOffset dx="1" dy="4" result="offsetBlur"></feOffset>
        <feComponentTransfer>
          <feFuncA type="linear" slope="0.5" intercept="0" in="offsetBlur" result="linearTransfer"></feFuncA>
        </feComponentTransfer>
        <feMerge> 
          <feMergeNode in="linearTransfer"></feMergeNode>
          <feMergeNode in="SourceGraphic"></feMergeNode>
        </feMerge>
      </filter>

      <filter id="moving-shadow" height="120%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="2"></feGaussianBlur>
        <feOffset dx="0.5" dy="3" result="offsetBlur"></feOffset>
        <feComponentTransfer>
          <feFuncA type="linear" slope="0.5" intercept="0" in="offsetBlur" result="linearTransfer"></feFuncA>
        </feComponentTransfer>
        <feMerge> 
          <feMergeNode in="linearTransfer"></feMergeNode>
          <feMergeNode in="SourceGraphic"></feMergeNode>
        </feMerge>
      </filter>

      <filter id="fixed-shadow" height="120%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="2"></feGaussianBlur>
        <feOffset dx="0.5" dy="3" result="offsetBlur"></feOffset>
        <feComponentTransfer>
          <feFuncA type="linear" slope="0.5" intercept="0" in="offsetBlur" result="linearTransfer"></feFuncA>
        </feComponentTransfer>
        <feMerge> 
          <feMergeNode in="linearTransfer"></feMergeNode>
          <feMergeNode in="SourceGraphic"></feMergeNode>
        </feMerge>
      </filter>

<!-- HRIZONTAl / VERTICAL menu icons -->
      <svg class="symbols" xmlns="http://www.w3.org/2000/svg" style="display: none;">
        <symbol id="horizontal" viewBox="0 0 100 100">
          <path opacity="1" stroke-width="16"
              d="M16.7,86.9 L23.5,86.9 Q39.5,86.9 39.5,70.9 V34.9 Q39.5,18.9 55.5,18.9 L82.9,18.9"></path>
        </symbol>
        <symbol id="vertical" viewBox="0 0 100 100">
          <path opacity="1" stroke-width="16"
              d="M8.7,91.9 L8.7,74.5 Q8.7,58.5 24.7,58.5 H71.9 Q87.9,58.5 87.9,42.5 L87.9,9.9"></path>
        </symbol>
        <symbol id="horizontal2" viewBox="0 0 100 100">
          <path opacity="1" stroke-width="16"
              d="M2.7,94.5 L13.5,94.5 Q29.5,94.5 29.5,78.5 V19.5 Q29.5,3.5 45.5,3.5 L77.9,3.5 Q93.9,3.5 93.9,19.5 L93.9,43.9"></path>
        </symbol>
        <symbol id="vertical2" viewBox="0 0 100 100">
          <path opacity="1" stroke-width="16"
              d="M10.5,91.9 L10.5,70.5 Q10.5,54.5 26.5,54.5 H75.5 Q91.5,54.5 91.5,38.5 L91.5,31.9 Q91.5,15.9 75.5,15.9 L14.9,15.91967025832568"></path>
        </symbol>
      </svg>

    </defs>

    <g id="canvas">
      <g class="axis">
        <path d="M-540,0 L-20,0"></path>
        <path d="M20,0 L540,0"></path>
        <path d="M0,-540 L0,-20"></path>
        <path d="M0,20 L0,540"></path>
        <path d="M-480,-400 L480,-400"></path><path d="M-480,-300 L480,-300"></path>
        <path d="M-480,-200 L480,-200"></path><path d="M-480,-100 L480,-100"></path>
        <path d="M-480,100 L480,100"></path><path d="M-480,200 L480,200"></path>
        <path d="M-480,300 L480,300"></path><path d="M-480,400 L480,400"></path>
        <path d="M-400,-480 L-400,480"></path><path d="M-300,-480 L-300,480"></path>
        <path d="M-200,-480 L-200,480"></path><path d="M-100,-480 L-100,480"></path>
        <path d="M100,-480 L100,480"></path><path d="M200,-480 L200,480"></path>
        <path d="M300,-480 L300,480"></path><path d="M400,-480 L400,480"></path>
        <circle cx="0" cy="0" r="100"></circle>
        <circle cx="0" cy="0" r="200"></circle>
        <text stroke="none" fill="#EFF8FB" x="6" y="-400">-400</text>
        <text stroke="none" fill="#EFF8FB" x="6" y="-300">-300</text>
        <text stroke="none" fill="#EFF8FB" x="6" y="-200">-200</text>
        <text stroke="none" fill="#EFF8FB" x="6" y="-100">-100</text>
        <text stroke="none" fill="#EFF8FB" x="6" y="100">100</text>
        <text stroke="none" fill="#EFF8FB" x="6" y="200">200</text>
        <text stroke="none" fill="#EFF8FB" x="6" y="300">300</text>
        <text stroke="none" fill="#EFF8FB" x="6" y="400">400</text>
        <text stroke="none" fill="#EFF8FB" x="-400" y="16">-400</text>
        <text stroke="none" fill="#EFF8FB" x="-300" y="16">-300</text>
        <text stroke="none" fill="#EFF8FB" x="-200" y="16">-200</text>
        <text stroke="none" fill="#EFF8FB" x="-100" y="16">-100</text>
        <text stroke="none" fill="#EFF8FB" x="100" y="16">100</text>
        <text stroke="none" fill="#EFF8FB" x="200" y="16">200</text>
        <text stroke="none" fill="#EFF8FB" x="300" y="16">300</text>
        <text stroke="none" fill="#EFF8FB" x="400" y="16">400</text>
      </g>

      <circle id="Editing" style="opacity:0" r="32" fill="none" stroke="${wuwei.common.Color.outerEditing}" stroke-width="4">
      </circle>
      
      <circle id="Start" style="opacity:0" r="32" fill="none" stroke="${wuwei.common.Color.outerStart}" stroke-width="4">
      </circle>

      <circle id="Pointer" style="opacity:0" r="8" fill="${wuwei.common.Color.innerFocused}" stroke="none">
      </circle>

    </g>

    <g id="ContextMenu" class="collapsed">
      <circle id="Hovered" r="32" stroke-width="8" stroke="${wuwei.common.Color.outerHovered }" fill="none"></circle>
      <circle id="Selected"></circle>
      <text id="MenuCMND" class="ContextMenu" x="10"  y="-10"></text>
      <text id="MenuINFO" class="ContextMenu" x="10"  y="30"></text>
      <text id="MenuEDIT" class="ContextMenu" x="-30" y="30"></text>
      <text id="MenuSEL"  class="ContextMenu" x="-30" y="-10"></text>
    </g>

<!--
    <g id="ContextMenu" class="collapsed fixed">
      <circle id="Hovered" r="32" stroke-width="8" stroke="${wuwei.common.Color.outerHovered }" fill="none"></circle>
      <circle id="Selected"></circle>
      <text id="MenuCMND" class="ContextMenu" x="15" y="-5">&#xf013;</text>
      <text id="MenuINFO" class="ContextMenu" x="10" y="30">&#xf05a;</text>
      <text id="MenuEDIT" class="ContextMenu" x="-30" y="30">&#xf044;</text>
      <text id="MenuSEL"  class="ContextMenu" x="-35" y="-5">&#xf0c8;</text>
      <text id="MenuPIN"  class="ContextMenu" x="-8" y="-24">&#xf08d;</text>
    </g>
-->
`;
  return {
    template: template
  };
})();
