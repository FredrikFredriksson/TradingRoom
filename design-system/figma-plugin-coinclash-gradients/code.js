/**
 * CoinClash Gradients — Figma plugin
 * Creates 9 gradient Paint styles in one click (or updates existing). Re-run to refresh.
 * Run: Plugins → Development → CoinClash Gradients
 */
/* global figma */

(function () {
  function hexToRgb(hex, a = 1) {
    const m = hex.replace('#', '').match(/.{2}/g);
    if (!m) return { r: 0, g: 0, b: 0, a: a };
    return {
      r: parseInt(m[0], 16) / 255,
      g: parseInt(m[1], 16) / 255,
      b: parseInt(m[2], 16) / 255,
      a: a
    };
  }

  // Design-system angle: 90°=left-right, 180°=top-bottom. Figma: (1,0) maps to (a,b). We use
  // rotation (1,0)->(cos θ, sin θ) so 180°→θ=90°→(0,1)=down. Matrix [[a,c,e],[b,d,f]]:
  // x'=ax+cy+e, y'=bx+dy+f. Rotation: a=cos, c=-sin, b=sin, d=cos. Translation: center (0.5,0.5) fixed.
  function angleToTransform(angleDeg) {
    const θ = (angleDeg - 90) * Math.PI / 180;
    const c = Math.cos(θ);
    const s = Math.sin(θ);
    const e = 0.5 * (1 - c + s);
    const f = 0.5 * (1 - s - c);
    return [[c, -s, e], [s, c, f]];
  }

  const gradients = [
    {
      name: 'CoinClash/Gradient/Background metallic',
      angle: 145,
      stops: [
        { position: 0, color: hexToRgb('#0c1524') },
        { position: 0.5, color: hexToRgb('#050a12') },
        { position: 1, color: hexToRgb('#03060c') }
      ]
    },
    {
      name: 'CoinClash/Gradient/Background app',
      angle: 180,
      stops: [
        { position: 0, color: hexToRgb('#080e1a') },
        { position: 0.45, color: hexToRgb('#050a12') },
        { position: 1, color: hexToRgb('#03060c') }
      ]
    },
    {
      name: 'CoinClash/Gradient/Card',
      angle: 165,
      stops: [
        { position: 0, color: hexToRgb('#134e4a') },
        { position: 0.3, color: hexToRgb('#0c1524') },
        { position: 1, color: hexToRgb('#050a12') }
      ]
    },
    {
      name: 'CoinClash/Gradient/Shine',
      angle: 90,
      stops: [
        { position: 0, color: hexToRgb('#0c1524') },
        { position: 0.5, color: hexToRgb('#1e293b') },
        { position: 1, color: hexToRgb('#0c1524') }
      ]
    },
    {
      name: 'CoinClash/Gradient/Success',
      angle: 180,
      stops: [
        { position: 0, color: hexToRgb('#5eead4') },
        { position: 0.4, color: hexToRgb('#2dd4bf') },
        { position: 1, color: hexToRgb('#14b8a6') }
      ]
    },
    {
      name: 'CoinClash/Gradient/Success CTA',
      angle: 135,
      stops: [
        { position: 0, color: hexToRgb('#2dd4bf') },
        { position: 1, color: hexToRgb('#14b8a6') }
      ]
    },
    {
      name: 'CoinClash/Gradient/Danger',
      angle: 180,
      stops: [
        { position: 0, color: hexToRgb('#fb7185') },
        { position: 0.4, color: hexToRgb('#f43f5e') },
        { position: 1, color: hexToRgb('#e11d48') }
      ]
    },
    {
      name: 'CoinClash/Gradient/Accent focus',
      angle: 135,
      stops: [
        { position: 0, color: hexToRgb('#2dd4bf') },
        { position: 1, color: hexToRgb('#14b8a6') }
      ]
    },
    {
      name: 'CoinClash/Gradient/Glass',
      angle: 145,
      stops: [
        { position: 0, color: hexToRgb('#0c1524', 0.92) },
        { position: 0.5, color: hexToRgb('#080e1a', 0.88) },
        { position: 1, color: hexToRgb('#03060c', 0.92) }
      ]
    }
  ];

  const existingByName = {};
  figma.getLocalPaintStyles().forEach(function (s) { existingByName[s.name] = s; });

  try {
    gradients.forEach(function (g) {
      var existing = existingByName[g.name];
      if (existing) {
        existing.remove();
      }
      var style = figma.createPaintStyle();
      style.name = g.name;
      style.paints = [{
        type: 'GRADIENT_LINEAR',
        gradientStops: g.stops,
        gradientTransform: angleToTransform(g.angle),
        visible: true,
        opacity: 1,
        blendMode: 'NORMAL'
      }];
    });
    figma.notify('Created 9 CoinClash gradient styles. In Fill, pick from the style list (paint icon), not the variable (4-dot) picker.');
  } catch (e) {
    figma.notify('Error: ' + (e.message || String(e)), { error: true });
  }

  figma.closePlugin();
})();
