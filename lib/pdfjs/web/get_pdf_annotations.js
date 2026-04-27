/*
 * https://github.com/jlegewie/zotfile/blob/c0175c4966ed23103c23b52470dd7677e5b5181d/chrome/content/zotfile/pdfextract/pdfjs/src/getPDFAnnotations.js
 */
/**
 * PDF.js extension that extracts highlighted text and annotations from pdf files.
 * Based on modified version of pdf.js available here https://github.com/jlegewie/pdf.js
 * (see various extract branches). See 'PDF Reference Manual 1.7' section 8.4 for details on
 * annotations in pdf files.
 */
/**
 * @return {Promise} A promise that is resolved with an Object
 * that includes elements for path, time, and annotations.
 */
PDFJS.getPDFAnnotations = function(url, progress, debug) {
  // set default values
  // progress = typeof progress !== 'undefined' ? progress : function(x, y) { };
  debug = typeof debug !== 'undefined' ? debug : false;
  /* see http://www.html5rocks.com/en/tutorials/es6/promises*/
  var extract = function(resolve, reject) {
    var
      SUPPORTED_ANNOTS = [
        'Text',
        'FreeText',
        'Highlight',
        'Underline',
        'Strikeout',
        'Stamp',
        'Ink',
        'Link'
      ],
      obj = {
        annotations : [],
        time        : null,
        url         : typeof url == 'string' ? url : ''
      };
    // Fetch the PDF document from the URL using promices
    PDFJS.getDocument(url).then(function(pdf) {
      var
        n_annos    = 0,
        numPages   = pdf.numPages,
        time_start = performance.now();

      // function to handle page (render and extract annotations)
      var getAnnotationsFromPage = function(page) {
        var scale     = 1;
        var viewport  = page.getViewport(scale);
        // Prepare canvas using PDF page dimensions
        var canvas    = document.getElementById('the-canvas');
        var context   = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width  = viewport.width;
        // Render PDF page into canvas context
        var renderContext = {
          canvasContext : context,
          viewport      : viewport
        };
        // error handler
        var errorHandler = function(error) {
          //progress(page.pageNumber, numPages);
          console.log(error);
          // continue with next page
          if (numPages > page.pageNumber)
            pdf.getPage(page.pageNumber + 1).then(getAnnotationsFromPage, function(err) {
              console.log(err);
              reject(err);
            });
          else {
            var end  = performance.now();
            obj.time = end - time_start;
            resolve(obj);
          }
        };
        // get annotations
        page.getAnnotations().then(function extractAnno(annos) {
          // compatibility for old pdf.js version and filter for supported annotations
          annos = annos.map(function(anno) {
            if (anno.subtype === undefined)
              anno.subtype = anno.type;
            return anno;
          }).filter(function(anno) {
            return SUPPORTED_ANNOTS.indexOf(anno.subtype) >= 0;
          });
          // skip page if there is nothing interesting
          if (annos.length === 0) {
            //progress(page.pageNumber, numPages);
            if (numPages > page.pageNumber)
              pdf.getPage(page.pageNumber + 1).then(getAnnotationsFromPage, function(err) {
                console.log(err);
                reject(err);
              });
            else {
              var end = performance.now();
              obj.time = end - time_start;
              resolve(obj);
            }
            return;
          }
          // render page
          var render = page.render(renderContext, annos);
          if (render.promise !== undefined) {
            render = render.promise;
          }
          render.then(function() {
            // clean markup
            annos = annos.map(function(anno) {
              anno.page = page.pageNumber;
              // clean anno
              if (!debug) {
                delete anno.annotationFlags;
                delete anno.borderWidth;
                delete anno.chars;
                delete anno.hasAppearance;
                delete anno.markupGeom;
                delete anno.quadPoints;
                delete anno.rect;
                delete anno.rect;
                delete anno.spaceSize;
                delete anno.name;
              }
              // return
              return anno;
            });
            // add annotations to return object
            obj.annotations.push.apply(obj.annotations, annos);
            // console.log(obj.annotations);
            // render next page
            // progress(page.pageNumber, numPages);
            if (numPages > page.pageNumber) {
              pdf.getPage(page.pageNumber + 1).then(getAnnotationsFromPage, function(err) {
                console.log(err);
                reject(err);
              });
            } else {
              var end = performance.now();
              obj.time = end - time_start;
              resolve(obj);
            }
          }, errorHandler);
        }, errorHandler);
      };

      // Using promise to fetch the page
      pdf.getPage(1).then(getAnnotationsFromPage, function(err) {
        console.log('error getting the page:' + err);
      });

    }, function(err) {
      console.log('unable to open pdf: ' + err);
      reject(err);
    });
  };
  return new Promise(extract);
};
