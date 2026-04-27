/**
 * menu.setting.js
 * menu.setting module
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2013-2019, 2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.menu = wuwei.menu || {};
wuwei.menu.setting = wuwei.menu.setting || {};

( function (ns) {
  const draw = wuwei.draw;

  // convenience function to update everything (run after UI input)
  function updateAll() {
    draw.updateForces();
    draw.refresh();
  }

  function open(param) {
    const
      settingEl = document.getElementById('settingPane');
    settingEl.innerHTML = wuwei.menu.setting.markup.template();
    // settingEl.style.display='block';
    settingEl.classList.remove('hidden');
    /*const chargeStrengthSlider = document.getElementById('chargeStrengthSlider');
    chargeStrengthSlider.oninput = function() {
      const chargeStrengthValue = document.getElementById('chargeStrengthValue');
      chargeStrengthValue.innerHTML = this.value;
      draw.forceProperties.collide.strength = this.value;
      updateAll();
    };
    const distanceSlider = document.getElementById('distanceSlider');
    distanceSlider.oninput = function() {
      const distanceValue = document.getElementById('distanceValue');
      distanceValue.innerHTML = this.value;
      draw.forceProperties.link.distance = this.value;
      updateAll();
    };
    const radiusSlider = document.getElementById('radiusSlider');
    radiusSlider.oninput = function() {
      const radiusValue = document.getElementById('radiusValue');
      radiusValue.innerHTML = this.value;
      draw.forceProperties.link.radius = this.value;
      updateAll();
    };*/
  }

  function close() {
    const settingEl = document.getElementById('settingPane');
    settingEl.innerHTML = '';
    settingEl.classList.add('hidden');
    // settingEl.style.display = 'none';
  }

  return {
    updateAll: updateAll,
    open: open,
    close: close
  };
})(wuwei.menu.setting);
// menu.setting.js revised 2026-04-07