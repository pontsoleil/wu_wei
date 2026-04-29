/**
 * wuwei.draw.js
 * draw module
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2013-2020, 2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.draw = wuwei.draw || {};

(function (ns) {
  // var RADIUS = 50;
  var FORCE = {}
  //   "SIMULATE": true,
  //   "TRANSPARENT": {
  //     "EXPIRE": true,
  //     "TIMEOUT": 60000,
  //     "MAX_TOUCH": 5,
  //     "FACTOR": 0.6
  //   },
  //   "LINK": {
  //     "DISTANCE": 384,
  //     "ITERATIONS": 1
  //   },
  //   "CHARGE": {
  //     "STRENGTH": -384,
  //     "DISTANCE": {
  //       "MIN": 256,
  //       "MAX": 512
  //     }
  //   },
  //   "COLLIDE" : {
  //     "STRENGTH": 1,
  //     "RADIUS": 256,
  //     "ITERATIONS": 1
  //   },
  //   "ALPHA_TARGET": 0,
  //   "VELOCITY_DECAY": 0.4,
  //   "ALPHA_DECAY": 0.0228
  // };
  var
    /** common */
    common = wuwei.common,
    state = common.state,
    graph = common.graph,
    previous = common.previous,
    // nodeIndexer = common.nodeIndexer,
    // linkIndexer = common.linkIndexer,
    defaultSize = common.defaultSize,
    miniature = common.miniature,
    /** constants */
    constants,
    // FORCE,
    // values for all forces
    forceProperties = {
      /*center: {
          x: 0,
          y: 0
      },*/
      charge: {
        enabled: true,
        strength: -300, // -30,
        distanceMin: 1,
        distanceMax: 1000
      },
      collide: {
        enabled: true,
        strength: 0.7,
        iterations: 1,
        radius: 5 // 5
      },
      forceX: {
        enabled: true,
        strength: 0.05,
        x: 0
      },
      forceY: {
        enabled: true,
        strength: 0.05,
        y: 0
      },
      link: {
        enabled: true,
        distance: 300, // 2023-05-18
        iterations: 1
      }
    },

    /** model */
    model = wuwei.model,
    Node = model.Node,
    Link = model.Link,
    /** wuwei */
    util = wuwei.util,
    menu,
    log,
    /** constant */
    MENU_TIMEOUT = 1000,
    /** var */
    simulation,
    svg,
    canvas,
    node,
    link,
    miniatureTimer,
    expireTimer,
    // menuTimer,
    /** function */
    restart,
    ticked,
    refresh,

    prepareSimulationGroupLayout,
    applySimulationGroupLayout,
    clearSimulationGroupLayout,
    buildSimulationForceLinks,

    initModule;

  function reRender() {
    if ('simulation' === graph.mode) {
      restart();
    }
    else {
      refresh();
    }
  }

  function getCurrentPage() {
    const note = common.current || {};
    if (wuwei.model && typeof wuwei.model.getCurrentPage === 'function') {
      return wuwei.model.getCurrentPage();
    }
    if (!Array.isArray(note.pages)) {
      return null;
    }
    const page = note.pages.find(function (item) { return item && item.id === note.currentPage; }) || note.pages[0] || null;
    if (page) {
      note.page = page;
    }
    return page;
  }

  function bindGraphToCurrentPage() {
    if (wuwei.note && typeof wuwei.note.bindGraphToCurrentPage === 'function') {
      return wuwei.note.bindGraphToCurrentPage();
    }
    const page = getCurrentPage();
    if (!page) {
      return null;
    }
    graph.nodes = page.nodes;
    graph.links = page.links;
    graph.groups = page.groups || [];
    graph.transform = util.getPageTransform(page);
    return page;
  }

  function checkExpire() {
    if ('draw' === graph.mode) {
      return;
    }

    const C = constants;
    const timeout = C?.FORCE?.TRANSPARENT?.TIMEOUT ?? 60000;
    const transparent_factor = C?.FORCE?.TRANSPARENT?.FACTOR ?? 0.6;
    const now = Date.now();

    for (const node of graph.nodes) {
      const nodeId = node.id;
      const d3node = d3.select('g.node#' + nodeId);

      if (d3node && d3node.node() && node.opacity < 0.05) {
        d3node.remove();
        util.removeById(graph.nodes, nodeId);

        const pageNode = model.findNodeById(nodeId);
        if (pageNode) {
          pageNode.visible = false;
          const links = model.findLinksByNode(pageNode);
          if (links) {
            const allLinks = links.links || [];
            for (const link of allLinks) {
              const linkId = link.id;
              const d3link = d3.select('g.link#' + linkId);
              if (d3link && d3link.node()) {
                d3link.remove();
              }
              util.removeById(graph.links, linkId);
              link.visible = false;
            }
          }
        }
      }
      else if (node.expire < now) {
        if (node.checked) {
          node.opacity = 1;
          d3node.style('opacity', 1);
        }
        else {
          node.opacity *= transparent_factor;
          d3node.style('opacity', node.opacity);

          const pageNode = model.findNodeById(nodeId);
          const visibleLinks = pageNode ? (model.findLinksByNode(pageNode).visibles || []) : [];
          for (const pageLink of visibleLinks) {
            const otherNode = model.findOtherNode(pageLink, pageNode);
            const d3link = d3.select('g.link#' + pageLink.id);
            let otherOpacity = 1;

            if (otherNode) {
              otherOpacity = otherNode.opacity;
            }
            if (d3link && d3link.node()) {
              const linkOpacity = +d3link.style('opacity');
              if (node.opacity < linkOpacity) {
                d3link.style('opacity', node.opacity);
              }
              if (otherOpacity < linkOpacity) {
                d3link.style('opacity', otherOpacity);
              }
            }
          }
        }
        node.expire = now + timeout;
      }
    }

    model.updateLinkCount();
  }

  function toggleSelectedNode(nodeData) {
    var d3node = d3.select('g.node#' + nodeData.id);
    var selectedCircle = d3node.select('circle.selected');

    if (!selectedCircle.empty()) {
      d3node.classed('selected', false);
      selectedCircle.remove();
    }
    else {
      d3node
        .classed('selected', true)
        .append('circle')
        .attr('class', 'selected')
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('r', 32)
        .attr('fill', 'none')
        .attr('stroke', common.Color.outerSelected)
        .attr('stroke-width', 2)
        .datum(nodeData);
    }
  }

  function ensureGroupOverlayLayer(canvasSel) {
    let layer = canvasSel.select('g.group-overlays');
    if (!layer.node()) {
      layer = canvasSel.append('g').attr('class', 'group-overlays');
    }
    const axisLayer = canvasSel.select('g.axis').node();
    const layerNode = layer.node();
    if (axisLayer && layerNode && axisLayer.parentNode && axisLayer.nextSibling !== layerNode) {
      axisLayer.parentNode.insertBefore(layerNode, axisLayer.nextSibling);
    }
    return layer;
  }

  function groupDragStart(d) {
    if ('view' === graph.mode) { return; }
    const page = getCurrentPage();
    const nodes = model.findGroupNodes(d.group).filter(Boolean);
    const group = page && d && d.group ? model.findGroupById(d.group) : null;
    state.dragging = true;
    state.groupDragIds = nodes.map(function (n) { return n.id; });
    state.groupDragAnchor = { x: d3.event.x, y: d3.event.y };
    state.groupDragOrigin = {};
    state.groupDragAxisOrigin = (group && group.axis && group.axis.anchor)
      ? { x: group.axis.anchor.x, y: group.axis.anchor.y }
      : null;
    nodes.forEach(function (n) {
      state.groupDragOrigin[n.id] = { x: n.x, y: n.y };
    });
    menu.closeContextMenu();
  }

  function groupDragMove(d) {
    if ('view' === graph.mode || !Array.isArray(state.groupDragIds) || !state.groupDragAnchor || !state.groupDragOrigin) {
      return;
    }
    const dx = d3.event.x - state.groupDragAnchor.x;
    const dy = d3.event.y - state.groupDragAnchor.y;
    state.groupDragIds.forEach(function (id) {
      const node = model.findNodeById(id);
      const origin = state.groupDragOrigin[id];
      if (node && origin) {
        node.x = origin.x + dx;
        node.y = origin.y + dy;
        node.fx = node.x;
        node.fy = node.y;
      }
    });
    const page = getCurrentPage();
    const group = page && d && d.group ? model.findGroupById(d.group) : null;
    if (group && group.axis && group.axis.anchor && state.groupDragAxisOrigin) {
      if (Number.isFinite(Number(state.groupDragAxisOrigin.x))) {
        group.axis.anchor.x = Number(state.groupDragAxisOrigin.x) + dx;
      }
      if (Number.isFinite(Number(state.groupDragAxisOrigin.y))) {
        group.axis.anchor.y = Number(state.groupDragAxisOrigin.y) + dy;
      }
    }
    reRender();
  }

  function groupDragEnd() {
    state.dragging = false;
    state.groupDragIds = null;
    state.groupDragAnchor = null;
    state.groupDragOrigin = null;
    state.groupDragAxisOrigin = null;
    util.drawMiniature();
    if (log && typeof log.storeLog === 'function') {
      log.storeLog({ command: 'dragGroup' });
    }
  }

  function toggleSelectedGroup(groupId) {
    if (!groupId) {
      return;
    }
    if (!Array.isArray(state.selectedGroupIds)) {
      state.selectedGroupIds = [];
    }
    if (state.selectedGroupIds.indexOf(groupId) >= 0) {
      state.selectedGroupIds = state.selectedGroupIds.filter(function (id) { return id !== groupId; });
    }
    else {
      state.selectedGroupIds.push(groupId);
    }
  }

  function bindGroupOverlayHover(selection) {
    selection
      .on('mouseover', function (d) {
        if (!state.Selecting) {
          return;
        }
        clearTimeout(state.menuTimer);
        menu.openContextMenu({ groupOverlay: d });
      })
      .on('mouseout', function () {
        if (!state.Selecting) {
          return;
        }
        clearTimeout(state.menuTimer);
        state.menuTimer = setTimeout(function () {
          menu.closeContextMenu();
        }, MENU_TIMEOUT);
      });
  }

  function isTimelineAxisPseudoLink(link) {
    return !!(
      link &&
      link.type === 'Link' &&
      (
        link.groupType === 'timelineAxis' ||
        link.linkType === 'timeline-axis'
      )
    );
  }

  function renderGraphLink(link) {
    if (!link) {
      return;
    }

    if (isTimelineAxisPseudoLink(link)) {
      model.renderLink(link);
    }
    else if (['HORIZONTAL', 'VERTICAL'].includes(link.shape)) {
      model.hierarchyLink(link);
    }
    else if (['HORIZONTAL2', 'VERTICAL2'].includes(link.shape)) {
      model.hierarchyLink2(link);
    }
    else {
      model.renderLink(link);
    }
  }

  restart = function () {
    if ('draw' === graph.mode) {
      console.log('--- restart Quit due to draw mode');
      return;
    }

    console.log('--- restart');

    model.setGraphFromCurrentPage();

    var
      nodes = graph.nodes.slice(),
      links = graph.links.slice(),
      simulationNodes,
      canvasSel,
      nodeSel,
      linkSel,
      enterNode,
      enterLink,
      d3node,
      d3link,
      n,
      l;

    function linkKey(d) {
      return d.id;
    }

    canvasSel = d3.select('g#' + state.canvasId);
    canvas = canvasSel;

    d3.select('.Marker2').remove();

    // ----------------------------
    // nodes
    // ----------------------------
    nodeSel = canvasSel.selectAll('g.node')
      .data(nodes, function (d) {
        return d.id;
      });

    nodeSel.exit().remove();

    enterNode = nodeSel.enter()
      .append('g')
      .attr('id', function (d) {
        return d.id;
      })
      .attr('class', 'node')
      .datum(function (d) {
        return d;
      })
      .on('mouseover', function (d) {
        const page = getCurrentPage();
        if (state.Selecting && model.isNodeInAnyGroup(d.id)) {
          menu.closeContextMenu();
          return;
        }
        clearTimeout(state.menuTimer);
        menu.openContextMenu({ node: d });
      })
      .on('mouseout', function () {
        const page = getCurrentPage();
        if (state.Selecting && model.isNodeInAnyGroup(d3.select(this).datum().id)) {
          return;
        }
        clearTimeout(state.menuTimer);
        state.menuTimer = setTimeout(function () {
          menu.closeContextMenu();
        }, MENU_TIMEOUT);
      })
      .on('click', function (d) {
        if (!state.Selecting || 'view' === graph.mode) {
          return;
        }
        d3.event.stopPropagation();
        toggleSelectedNode(d);
        if (menu && typeof menu.closeContextMenu === 'function') {
          menu.closeContextMenu();
        }
      })
      .call(
        d3.drag()
          .on('start', Node.prototype.dragstarted)
          .on('drag', Node.prototype.dragged)
          .on('end', Node.prototype.dragended)
      );

    nodeSel = nodeSel.merge(enterNode);
    node = nodeSel;

    nodeSel.each(function (d) {
      var C, timeout, now;

      if (!d || !d.id) {
        return;
      }

      C = constants;
      timeout = C?.FORCE?.TRANSPARENT?.TIMEOUT ?? 60000;
      d3node = d3.select(this);

      if (!d3node || !d3node.node()) {
        return;
      }

      if (0 === d3node.node().childNodes.length || d.changed) {
        n = model.findNodeById(d.id) || (d.pseudo ? d : null);
        if (n && util.isShown(n)) {
          now = Date.now();
          n.expire = now + timeout;
          n.opacity = 1;
          model.renderNode(n);
        }
        d.changed = false;
      } else if (!util.isShown(d)) {
        d3node.remove();
      }
    });

    // ----------------------------
    // links
    // ----------------------------
    linkSel = canvasSel.selectAll('g.link')
      .data(links, function (d) {
        return linkKey(d);
      });

    linkSel.exit().remove();

    enterLink = linkSel.enter()
      .append('g')
      .attr('id', function (d) {
        return d.id;
      })
      .attr('class', 'link')
      .datum(function (d) {
        return d;
      })
      .on('mouseover', function (d) {
        clearTimeout(state.menuTimer);
        var ev = (d3.event && d3.event.sourceEvent) ? d3.event.sourceEvent : d3.event;
        var x = ev && Number.isFinite(Number(ev.clientX)) ? Number(ev.clientX) :
          (ev && Number.isFinite(Number(ev.x)) ? Number(ev.x) : NaN);
        var y = ev && Number.isFinite(Number(ev.clientY)) ? Number(ev.clientY) :
          (ev && Number.isFinite(Number(ev.y)) ? Number(ev.y) : NaN);
        menu.openContextMenu({
          link: d,
          position: (Number.isFinite(x) && Number.isFinite(y)) ? wuwei.util.pContext({ x: x, y: y }) : null
        });
      })
      .on('mouseout', function () {
        clearTimeout(state.menuTimer);
        state.menuTimer = setTimeout(function () {
          menu.closeContextMenu();
        }, MENU_TIMEOUT);
      });

    linkSel = linkSel.merge(enterLink);
    link = linkSel;

    linkSel.each(function (d) {
      if (!d || !d.id) {
        return;
      }

      d3link = d3.select(this);

      if (!d3link || !d3link.node()) {
        return;
      }

      if (0 === d3link.node().childNodes.length || d.changed) {
        l = model.findLinkById(d.id);
        if (l && util.isShown(l)) {
          model.renderLink(l);
        }
        d.changed = false;
      } else if (!util.isShown(d)) {
        d3link.remove();
      }
    });

    // ----------------------------
    // simulation
    // ----------------------------
    if ('simulation' === graph.mode && common.current && common.current.page) {
      prepareSimulationGroupLayout(common.current.page);
    }

    simulationNodes = nodes.filter(function (item) {
      return item && !item.pseudo && util.isShown(item);
    });

    simulation.nodes(simulationNodes);

    if (simulation.force('link')) {
      simulation.force('link')
        .links(buildSimulationForceLinks(links, simulationNodes))
        .distance(forceProperties.link.distance)
        .strength(forceProperties.link.enabled ? 1 : 0);
    }

    simulation.alpha(1).restart();

    model.updateLinkCount();

    // miniature
    util.drawMiniature();

    if (miniatureTimer) {
      clearInterval(miniatureTimer);
    }
    miniatureTimer = setInterval(function () {
      util.drawMiniature();
    }, 2000);

    /*
    if (expireTimer) {
      clearInterval(expireTimer);
    }
    expireTimer = setInterval(function () {
      checkExpire();
    }, 5000);
    */
  };

  // set up the simulation and event to update locations after each tick
  function initializeSimulation() {
    simulation.nodes(graph.nodes);
    initializeForces();
    simulation.on("tick", ticked);
  }

  // add forces to the simulation
  function initializeForces() {
    // add forces and associate each with a name
    simulation
      .force("link", d3.forceLink())
      .force("charge", d3.forceManyBody())
      .force("collide", d3.forceCollide())
      .force("center", d3.forceCenter())
      .force("forceX", d3.forceX())
      .force("forceY", d3.forceY());
    // apply properties to each of the forces
    updateForces();
  }

  // apply new force properties
  function updateForces() {
    // get each force by name and update the properties
    /*simulation.force("center")
        .x(forceProperties.center.x)
        .y(forceProperties.center.y);*/
    simulation.force("charge")
      .strength(forceProperties.charge.strength * forceProperties.charge.enabled)
      .distanceMin(forceProperties.charge.distanceMin)
      .distanceMax(forceProperties.charge.distanceMax);
    simulation.force("collide")
      .strength(forceProperties.collide.strength * forceProperties.collide.enabled)
      .radius(forceProperties.collide.radius)
      .iterations(forceProperties.collide.iterations);
    simulation.force("forceX")
      .strength(forceProperties.forceX.strength * forceProperties.forceX.enabled)
      .x(forceProperties.forceX.x);
    simulation.force("forceY")
      .strength(forceProperties.forceY.strength * forceProperties.forceY.enabled)
      .y(forceProperties.forceY.y);
    simulation.force("link")
      .id(function (d) { return d.id; })
      .distance(forceProperties.link.distance)
      .strength(forceProperties.link.enabled ? 1 : 0)
      .iterations(forceProperties.link.iterations)
      .links(buildSimulationForceLinks(graph.links, graph.nodes));
    // updates ignored until this is run
    // restarts the simulation (important if simulation has already slowed down)
    restart(); // simulation.alpha(1).restart();
  }

  function buildSimulationForceLinks(sourceLinks, sourceNodes) {
    var nodeIndex = {};

    (sourceNodes || []).forEach(function (node) {
      if (node && node.id && !node.pseudo && util.isShown(node)) {
        nodeIndex[node.id] = true;
      }
    });

    return (sourceLinks || []).filter(function (link) {
      return !!(link &&
        !link.pseudo &&
        util.isShown(link) &&
        link.from &&
        link.to &&
        nodeIndex[link.from] &&
        nodeIndex[link.to]);
    }).map(function (link) {
      return {
        id: link.id,
        source: link.from,
        target: link.to
      };
    });
  }

  ticked = function () {
    if ('draw' === graph.mode) {
      return;
    }
    /** alpha */
    var
      alpha = simulation.alpha(),
      stopAlpha = 0;//.001;
    /** setting menue indicator */
    const alphaValueEl = d3.select('#alpha_value');
    if (alphaValueEl && alphaValueEl.node()) {
      alphaValueEl.style('flex-basis', (simulation.alpha() * 100) + '%');
    }
    // console.log('ticked alpha=' + alpha);
    if (alpha <= stopAlpha && !state.dragging) {
      if (common.current && common.current.page) {
        clearSimulationGroupLayout(common.current.page);
      }

      simulation.alpha(0).stop();
      clearInterval(miniatureTimer);
      console.log('--- ticked simulation STOP alpha(' + alpha + ') < ' + stopAlpha);
      d3.selectAll('.shape-node, .memo-node')
        .style('filter', function (d) {
          return null;
        });

      return;
    }

    if ('simulation' === graph.mode && common.current && common.current.page) {
      applySimulationGroupLayout(common.current.page, graph.nodes);
    }

    /** node */
    node
      .datum(d => d) // d: SimNode
      .attr('transform', function (d) {
        const
          n = model.findNodeById(d.id); // d is SimNode, n is Node
        let d3node, transform;
        if (n && util.isShown(n) /*&& !n.filterout*/) {
          d3node = d3.select('g.node#' + d.id);
          if (d3node) {
            transform = d3node.attr('transform');
            if (transform) {
              const
                parsed = util.parse(transform),
                translate = (parsed.translate && parsed.translate.map(parseFloat)) || [0, 0],
                x = translate[0],
                y = translate[1];
              if (isFinite(d.x) && isFinite(d.y)) {
                if (d.fixed) {
                  // console.log('--- ticked "' + d.label + '" id=' + d.id + ' simNode Fixed to nodeEl(' + [x, y] + ')');
                  d.x = x;
                  d.y = y;
                }
              } else {
                // console.log('--- ticked "' + d.label + '" id=' + d.id + ' SimNode has NaN Fix to nodeEl(' + [x, y] + ')');
                d.x = x;
                d.y = y;
              }
            }
            const MAX_V = 64;
            if (d.vx < - MAX_V) { d.vx = - MAX_V; }
            if (d.vx > MAX_V) { d.vx = MAX_V; }
            if (d.vy < - MAX_V) { d.vy = - MAX_V; }
            if (d.vy > MAX_V) { d.vy = MAX_V; }
            if (d.vx * d.vx > 8 || d.vy * d.vy > 8) {
              d3node.select('.shape-node, .memo-node')
                .style('filter', function (d) {
                  return 'url(#moving-shadow)';
                });
            } else if (d.vx * d.vx > 2 || d.vy * d.vy > 2) {
              d3node.select('.shape-node, .memo-node')
                .style('filter', function (d) {
                  return 'url(#moving-shadow)';
                });
            } else if (d.vx * d.vx > 0.2 || d.vy * d.vy > 0.2) {
              d3node.select('.shape-node, .memo-node')
                .style('filter', function (d) {
                  return 'url(#moving-shadow)';
                });
            } else {
              d3node.select('.shape-node, .memo-node')
                .style('filter', function (d) {
                  return null;
                });
            }
          }
          n.x = d.x;
          n.y = d.y;
        }
        return 'translate(' + [d.x, d.y] + ')';
      });

    /** link */
    link.each(function (d, i) {
      if (!d) {
        return;
      }
      var link = model.findLinkById(d.id);
      if (!link) {
        return;
      }
      renderGraphLink(link);
    });

    d3.selectAll('g.node.group-node').remove();
    (graph.nodes || []).forEach(function (d) {
      if (d && d.pseudo && d.type === 'Group' && d.groupType === 'simple' && util.isShown(d)) {
        model.renderNode(d);
      }
    });
  };

  refresh = function () {
    if ('simulation' === graph.mode) {
      return;
    }
    if (model && typeof model.setGraphFromCurrentPage === 'function') {
      model.setGraphFromCurrentPage();
    }
    /** Node */
    d3.selectAll('g.node').remove();
    for (let node of graph.nodes) {
      if (util.isShown(node) /*&& !node.filterout*/) {
        model.renderNode(node);
      }
    }
    /** Link */
    d3.selectAll('g.link').remove();
    const links = graph.links.slice();
    for (let link of links) {
      // console.log(`refresh link.visible=${link.visible} link.filterout=${link.filterout}`);
      if (util.isShown(link) /*&& ! link.filterout*/) {
        // console.log(`refresh render link id=${link.id}`);
        renderGraphLink(link);
      } else {
        // console.log(`refresh remove link id=${link.id}`);
        d3.select('g.link#' + link.id).remove();
      }
    }

    model.updateLinkCount();
    /** miniature */
    util.drawMiniature();
  };

  function activateZoom() {
    state.zoomActive = true;
    var svg = d3.select('svg#draw'),
      canvas = d3.select(`svg#draw #${state.canvasId}`),
      zoom = d3.zoom()
        .scaleExtent([1 / 8, 4])
        .on('zoom', zoomed);

    // 追加: miniSVG からもこの zoom を使えるように保存
    state.zoomBehavior = zoom;
    state.zoomSvg = svg;

    function zoomed() {
      var currentTransform = d3.event.transform;
      x = currentTransform.x,
        y = currentTransform.y,
        k = currentTransform.k;
      if (isNaN(x) || isNaN(y)) {
        currentTransform.x = 0;
        currentTransform.y = 0;
      }
      var canvasTransform = canvas.attr('transform');
      if (canvasTransform) {
        canvasTransform = canvasTransform.match(/translate\(([-]?\d+\.?\d*),([-]?\d+\.?\d*)\) scale\((\d+\.?\d*)\)/);
      }
      var scale = 1;
      if (canvasTransform && canvasTransform[3]) {
        scale = canvasTransform[3];
        if (scale != k) {
          currentTransform.k = scale;
        }
      }
      // console.log(currentTransform);
      canvas.attr("transform", currentTransform);
      graph.transform = {
        x: currentTransform.x,
        y: currentTransform.y,
        scale: scale
      };
      if (common.current && common.current.page) { common.current.page.transform = graph.transform; }
      /** show scale on control button */
      menu.updateResetview();
      /** draw miniature */
      util.drawMiniature();
    }

    svg
      .call(zoom)
      .call(zoom.transform, d3.zoomTransform(this).scale(1));
    /**
      * see https://stackoverflow.com/questions/11786023/how-to-disable-double-click-zoom-for-d3-behavior-zoom
      */
    svg.on('dblclick.zoom', null);
  }

  function disableZoom() {
    state.zoomActive = false;
    state.zoomBehavior = null;
    state.zoomSvg = null;
    d3.select('svg#draw').on(".zoom", null);
  }


  function testForce() {
    var
      a = model.addSimpleTopic().param, // new Node('a');
      aNode = a.node[0],
      aResource = a.resource[0];
    aNode.visible = true;
    aNode.shape = 'CIRCLE';
    aNode.size = {
      radius: defaultSize.radius
    };
    aNode.color = '#87CEEB';
    aNode.label = 'A';
    aResource.name = aNode.label;
    aResource.type = 'TextualBody';
    aResource.value = '';

    var
      b = model.addSimpleContent().param, // new Node('b');
      bNode = b.node[0],
      bResource = b.resource[0];
    bNode.visible = true;
    bNode.shape = 'THUMBNAIL';
    bNode.size = {
      width: defaultSize.width,
      height: defaultSize.width
    };
    bNode.label = 'b.国家';
    bNode.thumbnail = 'http://books.google.com/books/content?id=hC9UQQAACAAJ&printsec=frontcover&img=1&zoom=1&imgtk=AFLRE71K2QIkZTGfybx80qh6SnDN7qbV3KDzKEV8i-GQcYzR2WJpjqFf63rqSvf830Q-KeN4IPLwy5zhrSjU4fgs7QSGAKYLtM_bMLYwcaHB-1CUsZ8iozCNp9bAEyH-Ba5A03v2PiWz&source=gbs_api';
    bResource.name = '国家';
    bResource.uri = '/assets/『夢十夜』.pdf';
    bResource.thumbnail = 'http://books.google.com/books/content?id=hC9UQQAACAAJ&printsec=frontcover&img=1&zoom=1&imgtk=AFLRE71K2QIkZTGfybx80qh6SnDN7qbV3KDzKEV8i-GQcYzR2WJpjqFf63rqSvf830Q-KeN4IPLwy5zhrSjU4fgs7QSGAKYLtM_bMLYwcaHB-1CUsZ8iozCNp9bAEyH-Ba5A03v2PiWz&source=gbs_api';
    bResource.type = 'Book';
    bResource.value = 'ソクラテスの口を通じて語られた理想国における哲人統治の主張にひきつづき対話は更に展開する。では、その任に当る哲学者は何を学ぶべきか。この問いに対して善のイデアとそこに至る哲学的認識の在り方があの名高い「太陽」「線分」「洞窟」の比喩によって説かれ、終極のところ正義こそが人間を幸福にするのだと結論される。';
    bResource.format = 'n/a';
    bResource.creator = 'プラトン';
    bResource.generator = '岩波書店';
    // this.nodeIndexer[bNode.id] = bNode;
    var
      c = model.addSimpleTopic().param,
      cNode = c.node[0],
      cResource = c.resource[0];
    cNode.visible = true;
    cNode.shape = 'ELLIPSE';
    cNode.size = {
      width: 100,
      height: 40
    };
    cNode.color = '#FFFF00';
    cNode.label = 'C';
    cResource.name = cNode.label;
    cResource.type = 'TextualBody';
    cResource.value = '';

    var
      d = model.addSimpleMemo().param,
      dNode = d.node[0],
      dResource = d.resource[0];
    dNode.visible = true;
    dNode.description = 'Lorem ipsum\ndolor sit amet, consectetur adipiscing elit. Donec in arcu diam.\nClass aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Sed sit amet urna velit. Duis tempor sit amet quam elementum tincidunt. Etiam nisi tellus, condimentum ac nunc sed, efficitur accumsan diam. Maecenas et ex ut tortor faucibus euismod et vel lectus. Suspendisse sagittis commodo nisl, a dictum elit convallis non. Fusce vitae magna quis lectus luctus volutpat. Nam mattis, nisi a commodo maximus, mauris augue scelerisque arcu, nec gravida tellus leo eget augue.\n';
    dResource.value = '<h3>Lorem ipsum</h3><p>dolor sit amet, consectetur adipiscing elit. Donec in arcu diam.</p><p>Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Sed sit amet urna velit. Duis tempor sit amet quam elementum tincidunt. Etiam nisi tellus, condimentum ac nunc sed, efficitur accumsan diam. Maecenas et ex ut tortor faucibus euismod et vel lectus. Suspendisse sagittis commodo nisl, a dictum elit convallis non. Fusce vitae magna quis lectus luctus volutpat. Nam mattis, nisi a commodo maximus, mauris augue scelerisque arcu, nec gravida tellus leo eget augue.</p>';

    var
      e = model.addYouTube(
        test_data.youtube[1]
      ).param,
      eNode = e.node[0],
      eResource = e.resource[0];

    var
      a_b = model.connect(aNode, bNode).param.link[0],
      a_c = model.connect(aNode, cNode).param.link[0],
      a_d = model.connect(aNode, dNode).param.link[0],
      b_c = model.connect(bNode, cNode).param.link[0],
      b_e = model.connect(bNode, eNode).param.link[0];
    a_b.visible = true;
    a_c.visible = true;
    a_d.visible = true;
    b_c.visible = true;
    b_e.visible = true;

    graph.nodes = [];
    graph.links = [];
    d3.selectAll('g.node').remove();
    d3.selectAll('g.link').remove();

    setTimeout(function () {
      showNode([aNode]);
      if ('simulation' === graph.mode) {
        restart();
      }
    }, 500);
    setTimeout(function () {
      showNode([bNode, cNode]);
      showLink([a_b, a_c]);
      if ('simulation' === graph.mode) {
        restart();
      }
    }, 1000);
    setTimeout(function () {
      showNode([dNode]);
      showLink([a_d]);
      if ('simulation' === graph.mode) {
        restart();
      }
    }, 1500);
    setTimeout(function () {
      showLink([b_c]);
      if ('simulation' === graph.mode) {
        restart();
      }
    }, 2000);
    setTimeout(function () {
      showNode([eNode]);
      showLink([b_e]);
      if ('simulation' === graph.mode) {
        restart();
      }
    }, 2500);
    setTimeout(function () {
      hideLink([a_b]);
      if ('simulation' === graph.mode) {
        restart();
      }
    }, 3000);
    // setTimeout(function() {
    //   hideNode([bNode]);
    //   if ('simulation' === graph.mode) {
    //     restart();
    //   }
    // }, 3500);
    setTimeout(function () {
      eraseLink([a_d]);
      if ('simulation' === graph.mode) {
        restart();
      }
    }, 4000);
    // setTimeout(function() {
    //   eraseNode([dNode]);
    //   if ('simulation' === graph.mode) {
    //     restart();
    //   }
    // }, 4500);
    setTimeout(function () {
      util.drawMiniature();
    }, 5000);

  }

  function showNode(nodes) {
    for (let node of nodes) {
      if (!node) { continue; }
      node.visible = true;
      model.createNode(node);
      if ('draw' === graph.mode) {
        model.renderNode(node);
      }
    }
    model.updateLinkCount();
  }

  function showLink(links) {
    for (let link of links) {
      if (!link) { continue; }
      link.visible = true;
      model.createLink(link);
      if ('draw' === graph.mode) {
        model.renderLink(link);
      }
    }
    model.updateLinkCount();
  }

  function hideNode(nodes) {
    var connectedLinks, links;
    for (let node of nodes) {
      if (!node) { continue; }
      node.visible = false;

      connectedLinks = model.findLinksByNode(node);
      links = connectedLinks ? connectedLinks.visibles : [];
      if (links && links.length > 0) {
        hideLink(links);
      }

      if ('draw' === graph.mode) {
        d3.select('g.node#' + node.id).remove();
      }
    }
    model.updateLinkCount();
  }

  function hideLink(links) {
    for (let link of links) {
      if (!link) { continue; }
      link.visible = false;
      if ('draw' === graph.mode) {
        d3.select('g.link#' + link.id).remove();
      }
    }
    model.updateLinkCount();
  }

  function eraseNode(nodes) {
    var connectedLinks, links;
    for (let node of nodes) {
      if (!node) { continue; }

      connectedLinks = model.findLinksByNode(node);
      links = connectedLinks ? connectedLinks.links : [];
      if (links && links.length > 0) {
        eraseLink(links);
      }

      model.removeNode(node);

      if ('draw' === graph.mode) {
        d3.select('g.node#' + node.id).remove();
      }
    }
    model.updateLinkCount();
  }

  function eraseLink(links) {
    for (let link of links) {
      if (!link) { continue; }
      if ('draw' === graph.mode) {
        d3.select('g.link#' + link.id).remove();
      }
      model.removeLink(link);
    }
    model.updateLinkCount();
  }

  function prepareSimulationGroupLayout(page) {
    if (!page || !Array.isArray(page.groups)) {
      return;
    }

    (page.groups || []).forEach(function (group) {
      var nodes = model.findGroupNodes(group.id).filter(Boolean);
      var cx, cy;

      if (!nodes.length) {
        return;
      }

      cx = nodes.reduce(function (sum, n) { return sum + (Number(n.x) || 0); }, 0) / nodes.length;
      cy = nodes.reduce(function (sum, n) { return sum + (Number(n.y) || 0); }, 0) / nodes.length;

      group._sim = group._sim || {};
      group._sim.anchor = { x: cx, y: cy };

      model.getGroupMembers(group).forEach(function (member) {
        var node = nodes.find(function (n) { return n.id === member.nodeId; });
        if (!node) {
          return;
        }

        if ('horizontal' === group.type || 'vertical' === group.type) {
          if ('horizontal' === group.type || 'horizontal' === group.orientation) {
            member._simDx = (Number(node.x) || 0) - cx;
            member._simDy = 0;
          } else if ('vertical' === group.type || 'vertical' === group.orientation) {
            member._simDx = 0;
            member._simDy = (Number(node.y) || 0) - cy;
          } else {
            member._simDx = (Number(node.x) || 0) - cx;
            member._simDy = (Number(node.y) || 0) - cy;
          }
        } else {
          member._simDx = (Number(node.x) || 0) - cx;
          member._simDy = (Number(node.y) || 0) - cy;
        }
      });
    });
  }

  function applySimulationGroupLayout(page, simNodes) {
    var simIndex = {};

    if (!page || !Array.isArray(page.groups) || !Array.isArray(simNodes)) {
      return;
    }

    simNodes.forEach(function (d) {
      if (d && d.id) {
        simIndex[d.id] = d;
      }
    });

    (page.groups || []).forEach(function (group) {
      var members, cx, cy;

      if (!group || !Array.isArray(model.getGroupMembers(group)) || model.getGroupMembers(group).length < 2) {
        return;
      }

      members = model.getGroupMembers(group)
        .map(function (member) { return simIndex[member.nodeId]; })
        .filter(Boolean);

      if (!members.length) {
        return;
      }

      cx = members.reduce(function (sum, d) { return sum + (Number(d.x) || 0); }, 0) / members.length;
      cy = members.reduce(function (sum, d) { return sum + (Number(d.y) || 0); }, 0) / members.length;

      if (group._sim && group._sim.anchor) {
        group._sim.anchor.x = cx;
        group._sim.anchor.y = cy;
      }

      model.getGroupMembers(group).forEach(function (member) {
        var d = simIndex[member.nodeId];
        if (!d) {
          return;
        }

        d.x = cx + (Number(member._simDx) || 0);
        d.y = cy + (Number(member._simDy) || 0);

        d.vx = 0;
        d.vy = 0;
      });

      if (('horizontal' === group.type || 'vertical' === group.type) && group.axis && group.axis.anchor) {
        group.axis.anchor.x = cx;
        group.axis.anchor.y = cy;
      }
    });
  }

  function clearSimulationGroupLayout(page) {
    if (!page || !Array.isArray(page.groups)) {
      return;
    }

    (page.groups || []).forEach(function (group) {
      if (group && group._sim) {
        delete group._sim;
      }
      model.getGroupMembers(group).forEach(function (member) {
        delete member._simDx;
        delete member._simDy;
      });
    });
  }

  initModule = function (setting) {
    var
      drawModeEl,
      vbox_width = +window.innerWidth,
      vbox_height = +window.innerHeight,
      vbox_x = vbox_width / 2,
      vbox_y = vbox_height / 2,
      // using graph.nodes, graph.links results unnecessary change location in draaw mode
      nodes = [],
      links = [];
    document.getElementById('draw').innerHTML = wuwei.draw.markup.template;
    menu = wuwei.menu;
    constants = common.constants;
    // FORCE = constants.FORCE;
    drawModeEl = document.getElementById('draw_mode');
    graph.mode = drawModeEl ? drawModeEl.className : 'draw';
    common.current.note_id = `_${uuid.v4()}`;

    svg = d3.select('svg#draw');
    svg
      .attr('width', vbox_width)
      .attr('height', vbox_height)
      .attr('viewBox', '-' + vbox_x + ' -' + vbox_y + ' ' + vbox_width + ' ' + vbox_height);

    activateZoom();

    util.setupMiniature();
    util.drawMiniature();

    // force simulator
    simulation = d3.forceSimulation();
    // set up the simulation and event to update locations after each tick
    initializeSimulation();
    common.simulation = simulation;
    canvas = d3.select('g#' + state.canvasId);
    link = canvas.selectAll('g.link');
    node = canvas.selectAll('g.node');
  };

  ns.simulation = simulation;
  ns.restart = restart;
  ns.ticked = ticked;
  ns.refresh = refresh;
  ns.reRender = reRender;
  // init: init,
  ns.initializeSimulation = initializeSimulation;
  ns.updateForces = updateForces;
  ns.testForce = testForce;
  ns.activateZoom = activateZoom;
  ns.disableZoom = disableZoom;
  ns.initModule = initModule;
})(wuwei.draw);
// wuwei.draw.js revised 2026-04-16
