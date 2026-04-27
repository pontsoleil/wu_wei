/**
 * uiWebview.js
 * xpath module by Google
 * Wicked Good XPath is a Google-authored pure JavaScript implementation of 
 * the DOM Level 3 XPath specification. It enables XPath evaluation for HTML
 * documents in every browser. We believe it to be the fastest XPath implementation
 * available in JavaScript.
 * The MIT License
Copyright (c) 2007 Cybozu Labs, Inc.
Copyright (c) 2012 Google Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
 **/

uiWebview = ( function () {
    
  function fixIERangeObject(range, win) { //Only for IE8 and below.
    win = win || window;

    if (!range) return null;
    if (!range.startContainer && win.document.selection) { //IE8 and below

      var _findTextNode = function (parentElement, text) {
        //Iterate through all the child text nodes and check for matches
        //As we go through each text node keep removing the text value (substring) from the beginning of the text variable.
        var container = null, offset = -1;
        for (var node = parentElement.firstChild; node; node = node.nextSibling) {
          if (node.nodeType == 3) {//Text node
            var find = node.nodeValue;
            var pos = text.indexOf(find);
            if (pos == 0 && text != find) { //text==find is a special case
              text = text.substring(find.length);
            } else {
              container = node;
              offset = text.length - 1; //Offset to the last character of text. text[text.length-1] will give the last character.
              break;
            }
          }
        }
        //Debug Message
        //alert(container.nodeValue);
        return { node: container, offset: offset }; //nodeInfo
      }

      var rangeCopy1 = range.duplicate(), rangeCopy2 = range.duplicate(); //Create a copy
      var rangeObj1 = range.duplicate(), rangeObj2 = range.duplicate(); //More copies :P

      rangeCopy1.collapse(true); //Go to beginning of the selection
      rangeCopy1.moveEnd('character', 1); //Select only the first character
      rangeCopy2.collapse(false); //Go to the end of the selection
      rangeCopy2.moveStart('character', -1); //Select only the last character

      //Debug Message
      // alert(rangeCopy1.text); //Should be the first character of the selection
      var parentElement1 = rangeCopy1.parentElement(), parentElement2 = rangeCopy2.parentElement();


      rangeObj1.moveToElementText(parentElement1); //Select all text of parentElement
      rangeObj1.setEndPoint('EndToEnd', rangeCopy1); //Set end point to the first character of the 'real' selection
      rangeObj2.moveToElementText(parentElement2);
      rangeObj2.setEndPoint('EndToEnd', rangeCopy2); //Set end point to the last character of the 'real' selection

      var text1 = rangeObj1.text; //Now we get all text from parentElement's first character upto the real selection's first character    
      var text2 = rangeObj2.text; //Here we get all text from parentElement's first character upto the real selection's last character

      var nodeInfo1 = _findTextNode(parentElement1, text1);
      var nodeInfo2 = _findTextNode(parentElement2, text2);

      //Finally we are here
      range.startContainer = nodeInfo1.node;
      range.startOffset = nodeInfo1.offset;
      range.endContainer = nodeInfo2.node;
      range.endOffset = nodeInfo2.offset + 1; //End offset comes 1 position after the last character of selection.
    }
    return range;
  }

  function getRangeObject(win) { //Gets the first range object
    win = win || window;
    if (win.getSelection) { // Firefox/Chrome/Safari/Opera/IE9
      var selection = win.getSelection();
      if (!!selection) {
        var type = selection.type; // None, Caret, Range
        if ('Range' === type) {
          return selection.getRangeAt(0); //W3C DOM Range Object
        } else { /* If no text is selected an exception might be thrown */
          return type;
        }
      }
      return null;
    }
    else if (win.document.selection) { // IE8
      var range = win.document.selection.createRange(); //Microsoft TextRange Object
      return fixIERangeObject(range, win);
    }
    return null;
  }

  function nsResolver(prefix) {
    var ns = {
        'mathml': 'http://www.w3.org/1998/Math/MathML', // for example's sake only
        'h': 'http://www.w3.org/1999/xhtml'
    };
    return ns[prefix];
  }

  function makeXPath(node, currentPath) {
    /**
     * this should suffice in HTML documents for selectable nodes,
     * XML with namespaces needs more code
     */
    currentPath = currentPath || '';
    switch (node.nodeType) {
      case 3:
      case 4:
        return makeXPath(node.parentNode,
          'text()[' + (
            document.evaluate('preceding-sibling::text()',
              node, nsResolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null).snapshotLength + 1
          ) + ']');
      case 1:
        return makeXPath(node.parentNode,
          node.tagName + '[' + (
            document.evaluate('preceding-sibling::' + 'h:' + node.tagName,
              node, nsResolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null).snapshotLength + 1
          ) + ']' + (currentPath ? '/' + currentPath : ''));
      case 9:
        return '/' + currentPath;
      default:
        return '';
    }
  }

  var xpath = {};

  function storeSelection(win) {
    var range = getRangeObject(win);
    if (range != null && 'object' === (typeof range).toLowerCase()) {
      if (range.startContainer && isFinite(range.startOffset) &&
          range.endContainer && isFinite(range.endOffset)) {
        xpath = {
          startContainer: makeXPath(range.startContainer),
          startOffset: range.startOffset,
          endContainer: makeXPath(range.endContainer),
          endOffset: range.endOffset
        };
        // alert(JSON.stringify(xpath));
        return xpath;
      }
      return null;
    }
    return null; // "elsif\n:" + "html\n:" + html;
  }

  return {
    getRangeObject: getRangeObject,
    storeSelection: storeSelection
  }
})();

