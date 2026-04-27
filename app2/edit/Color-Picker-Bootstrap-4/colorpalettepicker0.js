colorPalettePicker = (function (options) {
    "use strict";
  
    var paletteObj = {
      // 赤:
      'maroon': 'rgb(128, 0, 0)', //明度: 27.2
      'darkred': 'rgb(139, 0, 0)', //明度: 29.5
      'red': 'rgb(255, 0, 0)', //明度: 54.2
      'blush': 'rgb(222, 93, 131)', //明度: 123.1
      'dustyrose': 'rgb(209, 146, 144)', //明度: 159.2
      'lightpeach': 'rgb(255, 216, 177)', //明度: 219.9
      'peach': 'rgb(255, 218, 185)', //明度: 226.9
      // 橙:
      'coral': 'rgb(255, 127, 80)', //明度: 150.8
      'darkorange': 'rgb(255, 140, 0)', //明度: 154.3
      'orange': 'rgb(255, 165, 0)', //明度: 172.2
      'peach': 'rgb(255, 218, 185)', //明度: 223.4
      // 黄:
      'paleorange': 'rgb(255, 179, 71)', //明度: 187.3
      'gold': 'rgb(255, 215, 0)', //明度: 207.9
      'buttermilk': 'rgb(255, 241, 181)', //明度: 239.6
      'paleyellow': 'rgb(255, 255, 192)', //明度: 250.4
      'creamyyellow': 'rgb(255, 255, 204)', //明度: 251.3
      // 緑:
      'darkgreen': 'rgb(0, 100, 0)', //明度: 71.5
      'green': 'rgb(0, 128, 0)', //明度: 91.5
      'pistachio': 'rgb(147, 197, 114)', //明度: 180.3
      'lime': 'rgb(0, 255, 0)', //明度: 182.3
      'seafoam green': 'rgb(159, 226, 191)', //明度: 209.2
      'lightgreen': 'rgb(144, 238, 144)', //明度: 211.2
      'mintgreen': 'rgb(152, 251, 152)', //明度: 222.8
      // 青:
      'navy': 'rgb(0, 0, 128)', //明度: 9.2
      'darkblue': 'rgb(0, 0, 139)', //明度: 10.0
      'blue': 'rgb(0, 0, 255)', //明度: 18.4
      'robineggblue': 'rgb(0, 204, 204)', //明度: 160.6
      'skyblue': 'rgb(135, 206, 250)', //明度: 194.0
      // 藍:
      'cyan': 'rgb(0, 255, 255)', //明度: 200.7
      'lightblue': 'rgb(173, 216, 230)', //明度: 207.8
      'lightturquoise': 'rgb(175, 238, 238)', //明度: 224.6
      'lightcyan': 'rgb(224, 255, 255)', //明度: 248.4
      // 紫:
      'purple': 'rgb(128, 0, 128)', //明度: 36.4
      'darkmagenta': 'rgb(139, 0, 139)', //明度: 39.5
      'darkviolet': 'rgb(148, 0, 211)', //明度: 46.6
      'darkorchid': 'rgb(153, 50, 204)', //明度: 83.0
      'lightviolet': 'rgb(204, 153, 255)', //明度: 171.2
      'periwinkle': 'rgb(204, 204, 255)', //明度: 207.6
      // 灰:
      'black': 'rgb(0,0,0)',
      'grey': 'rgb(128, 128, 128)',
      'darkgrey': 'rgb(169, 169, 169)',
      'silver': 'rgb(192, 192, 192)',
      'lightgrey': 'rgb(211, 211, 211)',
      'white': 'rgb(255,255,255)'
    };

    var defaults = {
        // button: '<button name="colorpalettebutton" class="{buttonClass}" data-toggle="dropdown">{buttonText}</button>',
        buttonClass: 'btn btn-secondary dropdown-toggle',
        buttonPreviewName: 'colorpaletteselected',
        buttonText: '色選択',
        // dropdownHeader: '<h5 class="dropdown-header text-center">{dropdownTitle}</h5>',
        dropdownTitle: '',
        // menu: '<ul class="list-inline" style="padding-left:4px;padding-right:4px;margin-bottom:0px;">',
        // item: '<li class="list-inline-item"><div name="picker_{name}" style="background-color:{color};width:20px;height:20px;border-radius:5px;border: 1px solid #666;margin: 0px;cursor:pointer" data-toggle="tooltip" title="{name}" data-color="{color}"></div></li>',
        palette: [
            'black', 'darkred', 'coral', 'paleorange', 'darkgreen', 'darkblue', 'skyblue', 'darkmagenta',
            'grey', 'red', 'darkorange', 'gold', 'pistachio', 'blue', 'lightblue', 'darkorchid',
            'silver', 'lightpeach', 'orange', 'buttermilk', 'lime', 'robineggblue', 'lightturquoise', 'lightviolet',
            'white', 'peach', 'peach', 'creamyyellow', 'mintgreen', 'cyan', 'lightcyan', 'periwinkle'
        ],
        lines: 1,
        bootstrap: 4,
        onSelected: null
    };

    function rgb2hex(rgbColor) {
        var rgbComponent = rgbColor.match(/\d+/g);
        var red = parseInt(rgbComponent[0]);
        var green = parseInt(rgbComponent[1]);
        var blue = parseInt(rgbComponent[2]);
        var hexColor = "#" + red.toString(16).padStart(2,"0") + green.toString(16).padStart(2,"0") + blue.toString(16).padStart(2,"0");
        return hexColor;
    }

    var initModule = function (element, params) {

        var options = Object.assign({}, defaults, params);

        // button configuration
        var btn = document.createElement('button');
        btn.setAttribute('name', 'colorpalettebutton');
        var cls = options.buttonClass.split(' ')
        btn.classList.add(...cls);
        btn.setAttribute('data-toggle', 'dropdown');
        var buttonText = document.createTextNode(options.buttonText);
        btn.appendChild(buttonText);
        element.appendChild(btn);

        // dropdown configuration
        var dropdown = document.createElement('div');
        dropdown.classList.add('dropdown-menu');
        dropdown.setAttribute('style', 'z-index: 100;');
        var dropdownHeader = document.createElement('h5');
        var headercls = ['dropdown-header', 'text-center'];
        dropdownHeader.classList.add(...headercls);
        var headerText = document.createTextNode(options.dropdownTitle);
        dropdownHeader.appendChild(headerText);
        dropdown.appendChild(dropdownHeader);

        // check if colors passed through data-colors
        var dataColors = element.getAttribute('data-colors');
        if (dataColors) {
            options.palette = dataColors.split(',');
        }

        // check if lines passed through data-lines
        var dataLines = element.getAttribute('data-lines');
        if (dataLines) {
          options.lines = parseInt(dataLines, 10);
        }
  
        // var flexContainer = document.createElement('div');
        // flexContainer.setAttribute('style', 'display:flex; justify-content: center;');
        // calculating items per line
        var paletteLength = options.palette.length;
        var itemsPerLine = Math.round(paletteLength / options.lines);
        var paletteIndex = 0;
        for (var i = 0; i < options.lines; i++) {
          var menu = document.createElement('ul');
          menu.classList.add('d-inline-flex');
          menu.setAttribute('style', 'padding-left:4px; padding-right:4px; margin-top:0px; margin-bottom:0px; list-style-type:none;');
  
          for (var j = 0; j < itemsPerLine; j++) {
            var paletteObjItem = paletteObj[options.palette[paletteIndex]];
            if (paletteObjItem) {
              var item = document.createElement('li');
              var div = document.createElement('div');
              div.setAttribute('name', 'picker_' + options.palette[paletteIndex]);
              div.style.backgroundColor = paletteObjItem;
              div.style.width = '20px';
              div.style.height = '20px';
              div.style.borderRadius = '5px';
              div.style.border = '1px solid #666';
              div.style.margin = '0px';
              div.style.cursor = 'pointer';
              div.setAttribute('data-toggle', 'tooltip');
              div.setAttribute('title', options.palette[paletteIndex]);
              div.setAttribute('data-color', paletteObjItem);
              item.appendChild(div);
              menu.appendChild(item);
            }
            paletteIndex++;
          }
          dropdown.appendChild(menu);
        }
        // dropdown.appendChild(flexContainer);
        element.appendChild(dropdown);
  
        // item click bindings
        var items = element.querySelectorAll('div[name^=picker_]');
        items.forEach(function (item) {
          item.addEventListener('click', function () {
            var selectedColor = this.getAttribute('data-color');
            // var colorSquare = document.querySelector('span[name=' + options.buttonPreviewName + ']');
            // colorSquare.style.color = rgb2hex(selectedColor);
            if (typeof options.onSelected === 'function') {
              options.onSelected(rgb2hex(selectedColor));

            }
          });
        });
    }

    return {
        initModule: initModule
    };
})();
  
