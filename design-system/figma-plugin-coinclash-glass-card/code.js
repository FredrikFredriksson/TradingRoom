/**
 * CoinClash Glass Card — Figma plugin
 * Creates a glassmorphism card (Frame) with gradient, border, blur, and inner highlight.
 * Run: Plugins → Development → CoinClash Glass Card
 */

(function () {
  function hexToRgb(hex, a) {
    if (a === undefined) a = 1;
    const m = hex.replace('#', '').match(/.{2}/g);
    if (!m) return { r: 0, g: 0, b: 0, a: a };
    return {
      r: parseInt(m[0], 16) / 255,
      g: parseInt(m[1], 16) / 255,
      b: parseInt(m[2], 16) / 255,
      a: a
    };
  }

  function angleToTransform(angleDeg) {
    const θ = (angleDeg - 90) * Math.PI / 180;
    const c = Math.cos(θ);
    const s = Math.sin(θ);
    const e = 0.5 * (1 - c + s);
    const f = 0.5 * (1 - s - c);
    return [[c, -s, e], [s, c, f]];
  }

  async function run() {
    const W = 360;
    const H = 200;

    // Glass base: more transparent (68–75%) so BACKGROUND_BLUR reads clearly as frosted glass
    const glassGradient = {
      type: 'GRADIENT_LINEAR',
      gradientStops: [
        { position: 0, color: hexToRgb('#0c1524', 0.74) },
        { position: 0.5, color: hexToRgb('#080e1a', 0.68) },
        { position: 1, color: hexToRgb('#03060c', 0.74) }
      ],
      gradientTransform: angleToTransform(145)
    };

    // Card overlay: stronger top-edge shine (glass reflection)
    const cardOverlay = {
      type: 'GRADIENT_LINEAR',
      gradientStops: [
        { position: 0, color: hexToRgb('#22d3ee', 0.12) },
        { position: 0.08, color: hexToRgb('#bae6fd', 0.06) },
        { position: 0.35, color: hexToRgb('#FFFFFF', 0.03) },
        { position: 1, color: { r: 0, g: 0, b: 0, a: 0 } }
      ],
      gradientTransform: angleToTransform(165)
    };

    // Extra soft fill: very subtle cyan tint across the whole surface (glass tint)
    const glassTint = {
      type: 'GRADIENT_LINEAR',
      gradientStops: [
        { position: 0, color: hexToRgb('#22d3ee', 0.04) },
        { position: 1, color: hexToRgb('#06b6d4', 0.02) }
      ],
      gradientTransform: angleToTransform(135)
    };

    const frame = figma.createFrame();
    frame.name = 'CoinClash Glass Card';
    frame.resize(W, H);
    frame.fills = [glassGradient, glassTint, cardOverlay];
    frame.strokes = [{ type: 'SOLID', color: hexToRgb('#22d3ee'), opacity: 0.22 }];
    frame.strokeWeight = 1;
    frame.cornerRadius = 4;
    frame.effects = [
      { type: 'BACKGROUND_BLUR', radius: 36, visible: true },
      {
        type: 'INNER_SHADOW',
        color: hexToRgb('#bae6fd'),
        offset: { x: 0, y: -1 },
        radius: 12,
        spread: 0,
        visible: true
      },
      {
        type: 'DROP_SHADOW',
        color: hexToRgb('#000000'),
        offset: { x: 0, y: 4 },
        radius: 16,
        spread: 0,
        visible: true
      }
    ];
    frame.layoutMode = 'VERTICAL';
    frame.primaryAxisSizingMode = 'FIXED';
    frame.counterAxisSizingMode = 'FIXED';
    frame.paddingTop = 20;
    frame.paddingBottom = 20;
    frame.paddingLeft = 20;
    frame.paddingRight = 20;
    frame.itemSpacing = 8;

    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
    const label = figma.createText();
    label.characters = 'Glass card';
    label.fontSize = 12;
    label.fills = [{ type: 'SOLID', color: hexToRgb('#94a3b8') }];
    frame.appendChild(label);

    figma.currentPage.appendChild(frame);
    frame.x = figma.viewport.center.x - W / 2;
    frame.y = figma.viewport.center.y - H / 2;
    figma.currentPage.selection = [frame];
    figma.viewport.scrollAndZoomIntoView([frame]);

    figma.notify('Glass card created. Place it over other layers (e.g. a gradient or orbs) to see the background blur.');
    figma.closePlugin();
  }

  run().catch(function (err) {
    figma.notify('Error: ' + (err.message || String(err)));
    figma.closePlugin();
  });
})();
