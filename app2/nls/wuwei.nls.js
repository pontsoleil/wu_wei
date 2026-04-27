/**
 * wuwei.nls.CN.js
 * CN translation map
 *
 * WuWei is a free to use open source knowledge modeling tool.
 * More information on WuWei can be found on WuWei homepage.
 * https://wuwei.space/blog/
 *
 * WuWei is licensed under the MIT License
 * Copyright (c) 2013-2019, Nobuyuki SAMBUICHI
 **/
wuwei.nls = (function () {
  const notEmpty = (v) => {
    const ret = (v !== undefined && v !== null);
    return ret;
  };

  function translate(value) {
    const
      nlsMap = {
        cn: wuwei.nls.CN,
        en: wuwei.nls.EN,
        ja: wuwei.nls.JA,
        kr: wuwei.nls.KR,
        tw: wuwei.nls.TW,
        et: wuwei.nls.ET,
        fi: wuwei.nls.FI
      },
      lang = wuwei.common.nls.LANG;
    let _text,
      text = value;
    if (notEmpty(nlsMap[lang])) {
      _text = nlsMap[lang][value];
      if (_text) {
        text = _text;
      }
    }
    return text;
  }

  return {
    translate: translate
  };
})();
