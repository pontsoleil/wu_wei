(function ($) {
    "use strict";

    var paletteObj = {
        Maroon:"rgb(128, 0, 0)", // red,3202.6
        DarkRed:"rgb(139, 0, 0)", // red,3421.9
        Brown:"rgb(165, 42, 42)", // red,4102.2
        FireBrick:"rgb(178, 34, 34)", // red,4269.2
        Crimson:"rgb(220, 20, 60)", // red,4989.6
        IndianRed:"rgb(205, 92, 92)", // red,5402.8
        Red:"rgb(255, 0, 0)", // red,5569.4
        PaleVioletRed:"rgb(219, 112, 147)", // red,6003.5
        Tomato:"rgb(255, 99, 71)", // red,6177.2
        RosyBrown:"rgb(188, 143, 143)", // red,6240.5
        LightCoral:"rgb(240, 128, 128)", // red,6479.9
        Salmon:"rgb(250, 128, 114)", // red,6579.2
        DarkSalmon:"rgb(233, 150, 122)", // red,6784.2
        LightPink:"rgb(255, 182, 193)", // red,7733.8
        Pink:"rgb(255, 192, 203)", // red,7947.8
        Gold:"rgb(255, 215, 0)", // red,8243.1
        LawnGreen:"rgb(124, 252, 0)", // red,8420.6
        Chartreuse:"rgb(127, 255, 0)", // red,8505.1
        MistyRose:"rgb(255, 228, 225)", // red,8717.1
        LavenderBlush:"rgb(255, 240, 245)", // red,9007.2
        Snow:"rgb(255, 250, 250)", // red,9226.2

        SaddleBrown:"rgb(139, 69, 19)", // orange,4029.8
        Sienna:"rgb(160, 82, 45)", // orange,4569.3
        Chocolate:"rgb(210, 105, 30)", // orange,5624.2
        OrangeRed:"rgb(255, 69, 0)", // orange,5829.3
        DarkGoldenrod:"rgb(184, 134, 11)", // orange,5878.7
        Peru:"rgb(205, 133, 63)", // orange,6095.0
        Coral:"rgb(255, 127, 80)", // orange,6587.5
        DarkOrange:"rgb(255, 140, 0)", // orange,6775.6
        Goldenrod:"rgb(218, 165, 32)", // orange,6868.0
        SandyBrown:"rgb(244, 164, 96)", // orange,7134.7
        LightSalmon:"rgb(255, 160, 122)", // orange,7200.7
        Tan:"rgb(210, 180, 140)", // orange,7210.9
        Orange:"rgb(255, 165, 0)", // orange,7230.0
        BurlyWood:"rgb(222, 184, 135)", // orange,7386.5
        Wheat:"rgb(245, 222, 179)", // orange,8436.2
        PeachPuff:"rgb(255, 218, 185)", // orange,8436.6
        NavajoWhite:"rgb(255, 222, 173)", // orange,8500.8
        Moccasin:"rgb(255, 228, 181)", // orange,8638.5
        Bisque:"rgb(255, 228, 196)", // orange,8662.8
        AntiqueWhite:"rgb(250, 235, 215)", // orange,8808.3
        BlanchedAlmond:"rgb(255, 235, 205)", // orange,8824.8
        PapayaWhip:"rgb(255, 239, 213)", // orange,8922.9
        Linen:"rgb(250, 240, 230)", // orange,8942.6
        OldLace:"rgb(253, 245, 230)", // orange,9067.7
        Seashell:"rgb(255, 245, 238)", // orange,9096.7
        Cornsilk:"rgb(255, 248, 220)", // orange,9125.3
        FloralWhite:"rgb(255, 250, 240)", // orange,9205.6

        DarkOliveGreen:"rgb(85, 107, 47)", // yellow,4405.9
        Olive:"rgb(128, 128, 0)", // yellow,5243.3
        OliveDrab:"rgb(107, 142, 35)", // yellow,5480.2
        DarkKhaki:"rgb(189, 183, 107)", // yellow,7075.5
        YellowGreen:"rgb(154, 205, 50)", // yellow,7353.6
        Khaki:"rgb(240, 230, 140)", // yellow,8520.9
        PaleGoldenrod:"rgb(238, 232, 170)", // yellow,8588.7
        GreenYellow:"rgb(173, 255, 47)", // yellow,8671.7
        Beige:"rgb(245, 245, 220)", // yellow,8997.0
        Yellow:"rgb(255, 255, 0)", // yellow,9110.8
        LightGoldenrodYellow:"rgb(250, 250, 210)", // yellow,9118.1
        LemonChiffon:"rgb(255, 250, 205)", // yellow,9142.0
        LightYellow:"rgb(255, 255, 224)", // yellow,9281.0
        Ivory:"rgb(255, 255, 240)", // yellow,9311.0

        DarkGreen:"rgb(0, 100, 0)", // green,3942.4
        Green:"rgb(0, 128, 0)", // green,4806.1
        ForestGreen:"rgb(34, 139, 34)", // green,5158.0
        SeaGreen:"rgb(46, 139, 87)", // green,5225.5
        MediumSeaGreen:"rgb(60, 179, 113)", // green,6403.1
        DarkSeaGreen:"rgb(143, 188, 143)", // green,6965.3
        LimeGreen:"rgb(50, 205, 50)", // green,7043.3
        MediumAquamarine:"rgb(102, 205, 170)", // green,7282.6
        LightGreen:"rgb(144, 238, 144)", // green,8206.1
        MediumSpringGreen:"rgb(0, 250, 154)", // green,8306.4
        Lime:"rgb(0, 255, 0)", // green,8352.2
        SpringGreen:"rgb(0, 255, 127)", // green,8404.7
        PaleGreen:"rgb(152, 251, 152)", // green,8564.0
        Aquamarine:"rgb(127, 255, 212)", // green,8676.0
        Honeydew:"rgb(240, 255, 240)", // green,9219.7
        MintCream:"rgb(245, 255, 250)", // green,9269.9

        MidnightBlue:"rgb(25, 25, 112)", // blue,2215.8
        Navy:"rgb(0, 0, 128)", // blue,2229.2
        DarkBlue:"rgb(0, 0, 139)", // blue,2382.2
        MediumBlue:"rgb(0, 0, 205)", // blue,3256.2
        DarkSlateGray:"rgb(47, 79, 79)", // blue,3454.8
        Blue:"rgb(0, 0, 255)", // blue,3880.2
        RoyalBlue:"rgb(65, 105, 225)", // blue,4917.6
        Teal:"rgb(0, 128, 128)", // blue,4963.2
        SteelBlue:"rgb(70, 130, 180)", // blue,5295.7
        DarkCyan:"rgb(0, 139, 139)", // blue,5302.6
        SlateGray:"rgb(112, 128, 144)", // blue,5313.2
        LightSlateGray:"rgb(119, 136, 153)", // blue,5577.9
        DodgerBlue:"rgb(30, 144, 255)", // blue,5917.7
        CadetBlue:"rgb(95, 158, 160)", // blue,6034.2
        CornflowerBlue:"rgb(100, 149, 237)", // blue,6106.5
        LightSeaGreen:"rgb(32, 178, 170)", // blue,6454.5
        DeepSkyBlue:"rgb(0, 191, 255)", // blue,7045.2
        DarkTurquoise:"rgb(0, 206, 209)", // blue,7276.9
        MediumTurquoise:"rgb(72, 209, 204)", // blue,7392.3
        LightSteelBlue:"rgb(176, 196, 222)", // blue,7506.3
        SkyBlue:"rgb(135, 206, 235)", // blue,7576.6
        LightSkyBlue:"rgb(135, 206, 250)", // blue,7621.3
        Turquoise:"rgb(64, 224, 208)", // blue,7769.8
        LightBlue:"rgb(173, 216, 230)", // blue,7964.9
        PowderBlue:"rgb(176, 224, 230)", // blue,8162.9
        PaleTurquoise:"rgb(175, 238, 238)", // blue,8498.7
        Aqua:"rgb(0, 255, 255)", // blue,8624.7
        Cyan:"rgb(0, 255, 255)", // blue,8624.7
        Lavender:"rgb(230, 230, 250)", // blue,8646.0
        AliceBlue:"rgb(240, 248, 255)", // blue,9101.5
        GhostWhite:"rgb(248, 248, 255)", // blue,9150.7
        LightCyan:"rgb(224, 255, 255)", // blue,9160.8
        Azure:"rgb(240, 255, 255)", // blue,9250.9

        Indigo:"rgb(75, 0, 130)", // indigo,2742.8
        DarkSlateBlue:"rgb(72, 61, 139)", // indigo,3436.0
        BlueViolet:"rgb(138, 43, 226)", // indigo,4505.0
        SlateBlue:"rgb(106, 90, 205)", // indigo,4692.9
        MediumSlateBlue:"rgb(123, 104, 238)", // indigo,5280.3
        Amethyst:"rgb(153, 102, 204)", // indigo,5307.0
        MediumPurple:"rgb(147, 112, 219)", // indigo,5511.9

        Purple:"rgb(128, 0, 128)", // violet,3531.9
        DarkMagenta:"rgb(139, 0, 139)", // violet,3773.7
        DarkViolet:"rgb(148, 0, 211)", // violet,4377.1
        DarkOrchid:"rgb(153, 50, 204)", // violet,4587.3
        MediumVioletRed:"rgb(199, 21, 133)", // violet,4775.3
        MediumOrchid:"rgb(186, 85, 211)", // violet,5427.2
        DeepPink:"rgb(255, 20, 147)", // violet,5746.3
        Fuchsia:"rgb(255, 0, 255)", // violet,6140.9
        Magenta:"rgb(255, 0, 255)", // violet,6140.9
        Orchid:"rgb(218, 112, 214)", // violet,6197.2
        HotPink:"rgb(255, 105, 180)", // violet,6444.2
        Violet:"rgb(238, 130, 238)", // violet,6782.1
        Plum:"rgb(221, 160, 221)", // violet,7078.5
        Thistle:"rgb(216, 191, 216)", // violet,7645.1

        Black:"rgb(0, 0, 0)", // gray,0.0
        DimGray:"rgb(105, 105, 105)", // gray,4586.5
        Gray:"rgb(128, 128, 128)", // gray,5376.3
        DarkGray:"rgb(169, 169, 169)", // gray,6718.1
        Silver:"rgb(192, 192, 192)", // gray,7441.6
        LightGrey:"rgb(211, 211, 211)", // gray,8026.2
        Gainsboro:"rgb(220, 220, 220)", // gray,8299.4
        WhiteSmoke:"rgb(245, 245, 245)", // gray,9046.9
        White:"rgb(255, 255, 255)", // gray,9341.6
    }

    var palette = [
        'RosyBrown','DarkGray','Gainsboro','Salmon','Seashell','Linen','BlanchedAlmond','Moccasin','Wheat','FloralWhite','Gold','Khaki','LemonChiffon','Ivory','Chartreuse','DarkSeaGreen','LimeGreen','Honeydew','MediumSpringGreen','Turquoise','LightCyan','CadetBlue','PowderBlue','LightSkyBlue','AliceBlue','CornflowerBlue','Thistle','Orchid','HotPink','PaleVioletRed','White','Black'
    ];
    
    var rgb2hex = function (rgbColor) {
        var rgbComponent = rgbColor.match(/\d+/g);
        var red = parseInt(rgbComponent[0]);
        var green = parseInt(rgbComponent[1]);
        var blue = parseInt(rgbComponent[2]);
        var hexColor = "#" + red.toString(16).padStart(2,"0") + green.toString(16).padStart(2,"0") + blue.toString(16).padStart(2,"0");
        return hexColor;
    }

    var methods = {
        init: function (params) {
            const defaults = $.fn.colorPalettePicker.defaults;
            if (params.bootstrap == 3) {
                $(this).addClass('dropdown');
                defaults.buttonClass = 'btn btn-default dropdown-toggle';
                defaults.button = '<button type="button" id="colorpaletterbuttonid" name="colorpalettebutton" class="{buttonClass}" data-toggle="dropdown" aria-haspopup="true" aria-expanded="true"><!-- span name="{buttonPreviewName}" style="display:none">■ </span -->{buttonText} <span class="caret"></span></button>';
                defaults.dropdown = '<ul class="dropdown-menu" aria-labelledby="colorpaletterbuttonid"><h5 class="dropdown-header text-center">{dropdownTitle}</h5>';
                defaults.menu = '<ul class="list-inline" style="padding-left:4px;padding-right:4px">';
                defaults.item = '<li><div name="picker_{name}" style="background-color:{color};width:20px;height:20px;border-radius:5px;border: 1px solid #666;margin: 0px;cursor:pointer" data-toggle="tooltip" title="{name}" data-color="{color}"></div></li>';
            }
            const options = $.extend({}, defaults, params);

            // button configuration
            const btn = $(options.button
                .replace('{buttonText}', options.buttonText)
                // .replace('{buttonPreviewName}', options.buttonPreviewName)
                .replace('{buttonClass}', options.buttonClass));
            $(this).html(btn);
            // dropdown configuration
            const dropdown = $(options.dropdown.replace('{dropdownTitle}', options.dropdownTitle));
            // check if colors passed throught data-colors
            const dataColors = $(this).attr('data-colors');
            if (dataColors != undefined) {
                options.palette = dataColors.split(',');
            }
            // check if lines passed throught data-lines
            const dataLines = $(this).attr('data-lines');
            if (dataLines != undefined)
                options.lines = dataLines;
            // calculating items per line
            const paletteLength = options.palette.length;
            const itemsPerLine = Math.round(paletteLength / options.lines);
            let paletteIndex = 0;
            for (let i = 0; i < options.lines; i++) {
                const menu = $(options.menu);

                for (let j = 0; j < itemsPerLine; j++) {
                    const paletteObjItem = paletteObj[options.palette[paletteIndex]];
                    if (paletteObjItem != undefined) {
                        menu.append(options.item.replace(/{name}/gi, options.palette[paletteIndex]).replace(/{color}/gi, paletteObjItem));
                    }
                    paletteIndex++;
                }
                dropdown.append(menu);
            }
            $(this).append(dropdown);

            // ---- dropdown toggle fallback (no Bootstrap JS required) ----
            $(this).addClass('dropdown');
            const $menu = dropdown; // dropdown-menu
            const $btn = btn;      // button

            if (typeof $.fn.dropdown !== 'function') {
                $btn.off('click.wuwei_cpp').on('click.wuwei_cpp', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    $('.dropdown-menu.show').not($menu).removeClass('show');
                    $menu.toggleClass('show');
                });

                $menu.off('click.wuwei_cpp').on('click.wuwei_cpp', function (e) {
                    e.stopPropagation();
                });

                if (!$(document).data('wuwei_cpp_bound')) {
                    $(document).data('wuwei_cpp_bound', true);
                    $(document).on('click.wuwei_cpp', function () {
                        $('.dropdown-menu.show').removeClass('show');
                    });
                }
            }
	    // item click bindings
            $(this).find('div[name^=picker_]').on('click',
                function () {
                    const selectedColor = $(this).attr('data-color');
                    // const colorSquare = $('span[name=' + options.buttonPreviewName + ']');
                    // colorSquare.css('color', selectedColor);
                    // if (!colorSquare.is(':visible'))
                    //     colorSquare.show();
                    if (typeof options.onSelected === 'function') {
                        var hexColor = rgb2hex(selectedColor);
                        options.onSelected(hexColor);
                        dropdown.removeClass('show');
		    }
                });
        }
    }

    $.fn.colorPalettePicker = function (options) {
        if (methods[options]) {
            return methods[options].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof options === 'object' || !options) {
            return methods.init.apply(this, arguments);
        } else {
            $.error('Option ' + options + ' not found in colorPalettePicker');
        }
    };

    $.fn.colorPalettePicker.defaults = {
        button: '<button type="button" name="colorpalettebutton" class="{buttonClass}" data-toggle="dropdown"><!-- span name="{buttonPreviewName}" style="display:inline-block">■ </span -->{buttonText}</button>',
        buttonClass: 'btn btn-outline-light dropdown-toggle',
        // buttonPreviewName: 'colorpaletteselected',
        buttonText: '色選択',
        dropdown: '<div class="dropdown-menu"><h5 class="dropdown-header text-center">{dropdownTitle}</h5>',
        dropdownTitle: '',
        menu: '<ul class="list-inline" style="padding-left:4px;padding-right:4px;margin-bottom:0px;">',
        item: '<li class="list-inline-item"><div name="picker_{name}" style="background-color:{color};width:20px;height:20px;border-radius:5px;border: 1px solid #666;margin: 0px;cursor:pointer" data-toggle="tooltip" title="{name}" data-color="{color}"></div></li>',
        palette: palette,
        lines: 1,
        bootstrap: 4,
        onSelected: null
    };
})(jQuery);
