/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */
/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* globals DownloadManager, getFileName */

'use strict';

var DocumentAnnotationsList = function documentAnnotationsList(options) {
  var
    annotations     = options.annotations,
    annotationsList = options.annotationsList;
  while (annotationsList.firstChild) {
    annotationsList.removeChild(annotationsList.firstChild);
  }

  if (!annotations) {
    return;
  }

  var linkService = options.linkService;

  function bindItemLink(domObj, item) {
    domObj.href    = linkService.getDestinationHash([item.page]);
    domObj.onclick = function documentannotationsListOnclick(e) {
      linkService.navigateTo([item.page - 1, {name: 'Fit'}]);
      return false;
    };
  }

  /*var names = Object.keys(annotations).sort(function(a,b) {
    return a.toLowerCase().localeCompare(b.toLowerCase());
  });*/
  for (var i = 0, ii = annotations.length; i < ii; i++) {
    var
      item = annotations[i],
      div  = document.createElement('div'),
      a    = document.createElement('a');
    bindItemLink(a, item);
    a.href = '#page=' + item.page;
    a.textContent = '# ' + item.page + ' ' + item.content;
    div.className = 'annotationsItem';
    div.appendChild(a);
    annotationsList.appendChild(div);
  }
};
