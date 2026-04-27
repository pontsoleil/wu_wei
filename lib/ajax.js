
/**
 * see https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/Using_XMLHttpRequest
 */
var AJAXSubmit = (function () {

  function ajaxSuccess () {
    /* console.log("AJAXSubmit - Success!"); */
    console.log( this.responseText );
    /* you can get the serialized data through the "submittedData" custom property: */
    console.log(JSON.stringify( this.submittedData ));
    var
      responseText = decodeURI( this.responseText ),
      resultEl = document.getElementsByClassName( 'ajax_result' )[0];
    if ( resultEl ) {
      resultEl.innerHTML = responseText;
    } else {
      alert( responseText );
    }
  }

  function submitData ( oData ) {
    /* the AJAX request... */
    var oReq = new XMLHttpRequest();

    // progress on transfers from the server to the client (downloads)
    function updateProgress ( oEvent ) {
      if ( oEvent.lengthComputable ) {
        var percentComplete = oEvent.loaded / oEvent.total * 100;
        console.log('updateProgress percentComplete=' + percentComplete);
        // ...
      } else {
        // Unable to compute progress information since the total size is unknown
      }
    }

    function transferComplete( evt ) {
      console.log("The transfer is complete.");
    }

    function transferFailed( evt ) {
      console.log("An error occurred while transferring the file.");
    }

    function transferCanceled( evt ) {
      console.log("The transfer has been canceled by the user.");
    }

    oReq.addEventListener( "progress", updateProgress );
    oReq.addEventListener( "load", transferComplete );
    oReq.addEventListener( "error", transferFailed );
    oReq.addEventListener( "abort", transferCanceled );

    oReq.submittedData = oData;
    oReq.onload = ajaxSuccess;
    if (oData.technique === 0) { /* method is GET */
      oReq.open(
        "get",
        oData.receiver.replace( /(?:\?.*)?$/, oData.segments.length > 0 ? "?" + oData.segments.join("&") : "" ),
        true
      );
      oReq.send(null);
    } else { /* method is POST */
      oReq.open("post", oData.receiver, true);
      if (oData.technique === 3) { /* enctype is multipart/form-data */
        var sBoundary = "---------------------------" + Date.now().toString(16);
        oReq.setRequestHeader("Content-Type", "multipart\/form-data; boundary=" + sBoundary);
        oReq.sendAsBinary("--" + sBoundary + "\r\n" + oData.segments.join("--" + sBoundary + "\r\n") + "--" + sBoundary + "--\r\n");
      } else { /* enctype is application/x-www-form-urlencoded or text/plain */
        oReq.setRequestHeader("Content-Type", oData.contentType);
        oReq.send(oData.segments.join(oData.technique === 2 ? "\r\n" : "&"));
      }
    }
  }

  function processStatus ( oData ) {
    if (oData.status > 0) { return; }
    /* the form is now totally serialized! do something before sending it to the server... */
    /* doSomething( oData ); */
    console.log("AJAXSubmit - The form is now serialized. Submitting...");
    submitData ( oData );
  }

  function pushSegment ( oFREvt ) {
    this.owner.segments[this.segmentIdx] += oFREvt.target.result + "\r\n";
    this.owner.status--;
    processStatus(this.owner);
  }

  // function plainEscape ( sText ) {
  //   /* How should I treat a text/plain form encoding?
  //      What characters are not allowed? this is what I suppose...: */
  //   /* "4\3\7 - Einstein said E=mc2" ----> "4\\3\\7\ -\ Einstein\ said\ E\=mc2" */
  //   return sText.replace(/[\s\=\\]/g, "\\$&");
  // }

  function SubmitRequest ( oTarget ) {
    var
      nFile,
      sFieldType,
      oField,
      oSegmReq,
      oFile,
      bIsPost = oTarget.method.toLowerCase() === "post";
    console.log("AJAXSubmit - Serializing form...");
    this.contentType = bIsPost && oTarget.enctype ? oTarget.enctype : "application\/x-www-form-urlencoded";
    this.technique = bIsPost ?
      ( this.contentType === "multipart\/form-data" ?
        3
      : ( this.contentType === "text\/plain" ? 2 : 1 )
      )
    : 0;
    this.receiver = oTarget.action;
    this.status = 0;
    this.segments = [];
    // var fFilter = this.technique === 2 ? plainEscape : escape;
    for ( var nItem = 0; nItem < oTarget.elements.length; nItem++ ) {
      oField = oTarget.elements[ nItem ];
      if (!oField.hasAttribute("name")) { continue; }
      sFieldType = oField.nodeName.toUpperCase() === "INPUT" ?
        oField.getAttribute("type").toUpperCase()
      : "TEXT";
      if (sFieldType === "FILE" && oField.files.length > 0) {
        if (this.technique === 3) { /* enctype is multipart/form-data */
          for ( nFile = 0; nFile < oField.files.length; nFile++ ) {
            oFile = oField.files[ nFile ];
            oSegmReq = new FileReader();
            /* (custom properties:) */
            oSegmReq.segmentIdx = this.segments.length;
            oSegmReq.owner = this;
            /* (end of custom properties) */
            oSegmReq.onload = pushSegment;
            this.segments.push(
              "Content-Disposition: form-data; name=\"" + oField.name +
              "\"; filename=\"" + oFile.name +
              "\"\r\nContent-Type: " + oFile.type +
              "\r\n\r\n"
            );
            this.status++;
            oSegmReq.readAsBinaryString( oFile );
          }
        } else { /* enctype is application/x-www-form-urlencoded or text/plain or
                    method is GET: files will not be sent! */
          for ( nFile = 0; nFile < oField.files.length;
              this.segments.push(encodeURI( oField.name ) + "=" + encodeURI( oField.files[ nFile++ ].name )));
        }
      } else if (( sFieldType !== "RADIO" && sFieldType !== "CHECKBOX" ) || oField.checked ) {
        /* NOTE: this will submit _all_ submit buttons. Detecting the correct one is non-trivial. */
        /* field type is not FILE or is FILE but is empty */
        this.segments.push(
          this.technique === 3 ? /* enctype is multipart/form-data */
            "Content-Disposition: form-data; name=\"" + oField.name + "\"\r\n\r\n" + oField.value + "\r\n"
          : /* enctype is application/x-www-form-urlencoded or text/plain or method is GET */
            encodeURI( oField.name ) + "=" + encodeURI( oField.value )
        );
      }
    }
    processStatus(this);
  }

  return function ( oFormElement ) {
    if ( ! oFormElement.action ) { return; }
    new SubmitRequest( oFormElement );
  };

})();
