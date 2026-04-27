/**
 * menu.setting.template.js
 * menu.setting template
 *
 * WuWei is a free to use open source knowledge modeling tool.
 * More information on WuWei can be found on WuWei homepage.
 * https://www.wuwei.space/blog/
 *
 * WuWei is licensed under the MIT License
 * Copyright (c) 2013-2020, Nobuyuki SAMBUICHI
 **/
wuwei.menu.setting.markup = ( function () {
  const template = function () {
    return `
    <div class="controls">
    <div class="force alpha">
      <p><label>alpha</label> Simulation activity</p>
      <div class="alpha_bar" onclick="wuwei.menu.setting.updateAll();">
        <div id="alpha_value"></div>
      </div>
    </div>
  
    <div class="force">
      <p><label>
          <input type="checkbox" checked
              onchange="wuwei.draw.forceProperties.charge.enabled=this.checked;
                  wuwei.menu.setting.updateAll();
                  return false;"> charge</label> Attracts (+) or repels (-) nodes to/from each other.</p>
      <label title="Negative strength repels nodes. Positive strength attracts nodes.">
        strength
        <output id="charge_StrengthSliderOutput">-30</output>
        <input type="range" min="-1000" max="100" value="-30" step="5"
            oninput="d3.select('#charge_StrengthSliderOutput').text(value);
                wuwei.draw.forceProperties.charge.strength=value;
                wuwei.menu.setting.updateAll();
                return false;">
      </label>
      <label title="Minimum distance where force is applied">
        distanceMin
        <output id="charge_distanceMinSliderOutput">1</output>
        <input type="range" min="0" max="200" value="1" step="10"
            oninput="d3.select('#charge_distanceMinSliderOutput').text(value);
                wuwei.draw.forceProperties.charge.distanceMin=value;
                wuwei.menu.setting.updateAll();
                return false;">
      </label>
      <label title="Maximum distance where force is applied">
        distanceMax
        <output id="charge_distanceMaxSliderOutput">2000</output>
        <input type="range" min="0" max="2000" value="2000" step="10"
            oninput="d3.select('#charge_distanceMaxSliderOutput').text(value);
                wuwei.draw.forceProperties.charge.distanceMax=value;
                wuwei.menu.setting.updateAll();
                return false;">
      </label>
    </div>
  
    <div class="force">
      <p><label>
        <input type="checkbox" checked
            onchange="wuwei.draw.forceProperties.link.enabled=this.checked;
                wuwei.menu.setting.updateAll();
                return false;"> link</label> Sets link length</p>
      <label title="The force will push/pull nodes to make links this long">
        distance
        <output id="link_DistanceSliderOutput">30</output>
        <input type="range" min="0" max="500" value="30" step="5"
            oninput="d3.select('#link_DistanceSliderOutput').text(value);
                wuwei.draw.forceProperties.link.distance=value;
                wuwei.menu.setting.updateAll();
                return false;">
      </label>
    </div>

    <div class="force">
      <p><label><input type="checkbox" checked
          onchange="wuwei.draw.forceProperties.collide.enabled=this.checked;
              wuwei.menu.setting.updateAll();
              return false;"> collide</label> Prevents nodes from overlapping</p>
      <label>
        strength
        <output id="collide_StrengthSliderOutput">0.7</output>
        <input type="range" min="0" max="2" value="0.7" step="0.1"
            oninput="d3.select('#collide_StrengthSliderOutput').text(value);
                wuwei.draw.forceProperties.collide.strength=value;
                wuwei.menu.setting.updateAll();
                return false;">
      </label>
      <label title="Size of nodes">
        radius
        <output id="collide_radiusSliderOutput">5</output>
        <input type="range" min="0" max="100" value="5" step="5"
            oninput="d3.select('#collide_radiusSliderOutput').text(value);
                wuwei.draw.forceProperties.collide.radius=value;
                wuwei.menu.setting.updateAll();
                return false;">
      </label>
    </div>
  
    <div class="force">
      <p><label>
          <input type="checkbox"
              onchange="wuwei.draw.forceProperties.forceX.enabled=this.checked;
                  wuwei.menu.setting.updateAll();
                  return false;"
              checked> forceX</label> Acts like gravity. Pulls all points towards an X location.</p>
      <label>
        strength
        <output id="forceX_StrengthSliderOutput">0.1</output>
        <input type="range" min="0" max="1" value=".1" step="0.01"
            oninput="d3.select('#forceX_StrengthSliderOutput').text(value);
            wuwei.draw.forceProperties.forceX.strength=value;
            wuwei.menu.setting.updateAll();
            return false;">
      </label>
    </div>
  
    <div class="force">
      <p><label>
        <input type="checkbox"
            onchange="wuwei.draw.forceProperties.forceY.enabled=this.checked;
                wuwei.menu.setting.updateAll();
                return false;"
            checked> forceY</label> Acts like gravity. Pulls all points towards a Y location.</p>
      <label>
        strength
        <output id="forceY_StrengthSliderOutput">0.1</output>
        <input type="range" min="0" max="1" value=".1" step="0.01"
            oninput="d3.select('#forceY_StrengthSliderOutput').text(value);
                wuwei.draw.forceProperties.forceY.strength=value;
                wuwei.menu.setting.updateAll();
                return false;">
      </label>
    </div>

  </div>
    `;
  };

  function translate(str) {
    return wuwei.nls.translate(str);
  }

  return {
    template: template
  };
})();
