// Vice Cover Studio — cover rendering engine.
//
// Pure Canvas 2D, no dependencies, no network. A cover is a set of photo
// panels (each with its own photo, zoom, pan and colour grade) plus big
// condensed caption lettering drawn on top. Everything here is drawn by
// hand: layouts, grades, vignette, grain and the sticker badge.
//
// State shape (see defaultState):
//   layout   one of LAYOUTS below
//   line1    caption line one (big)
//   line2    caption line two (big, may be empty)
//   tagline  small line under the title
//   badge    short sticker text, top-right of the hero panel
//   panels   one entry per panel of the layout:
//            { photo, zoom, ox, oy, grade }
//            photo is an HTMLImageElement (or null for an empty panel),
//            zoom 1..3, ox/oy pan as a fraction of the panel size,
//            grade one of 'sunset' | 'neon' | 'noir' | 'clean'.

export const LAYOUTS = {
  'sunset-grid': { label: 'Sunset Grid', panels: 3 },
  'neon-triptych': { label: 'Neon Triptych', panels: 3 },
  'vice-split': { label: 'Vice Split', panels: 3 },
  postcard: { label: 'Postcard', panels: 1 },
};

export const GRADES = {
  sunset: 'Sunset',
  neon: 'Neon',
  noir: 'Noir',
  clean: 'Clean',
};

export const TITLE_FONT = '"Anton", "Arial Narrow", "Noto Sans Condensed", sans-serif';
export const TAG_FONT = '"Noto Sans Condensed", "Arial Narrow", sans-serif';

export function defaultState() {
  return {
    layout: 'sunset-grid',
    line1: 'VICE',
    line2: 'CITY',
    tagline: 'Neon nights. Big scores.',
    badge: 'LEONIDA • 2026',
    panels: [
      { photo: null, zoom: 1.15, ox: 0, oy: 0, grade: 'sunset' },
      { photo: null, zoom: 1.15, ox: 0, oy: 0, grade: 'neon' },
      { photo: null, zoom: 1.15, ox: 0, oy: 0, grade: 'noir' },
    ],
  };
}

/** Panel rectangles for a layout, as fractions of the cover (x, y, w, h). */
export function layoutPanels(layout, W, H) {
  const m = 0.028; // outer margin, as a fraction of the short side
  const g = 0.018; // gap between panels
  const mx = m * Math.min(W, H);
  const my = m * Math.min(W, H);
  const gx = g * Math.min(W, H);
  const gy = g * Math.min(W, H);
  const innerW = W - mx * 2;
  const innerH = H - my * 2;
  switch (layout) {
    case 'neon-triptych': {
      const w = (innerW - gx * 2) / 3;
      return [0, 1, 2].map((i) => ({ x: mx + i * (w + gx), y: my, w, h: innerH }));
    }
    case 'vice-split': {
      const heroW = innerW * 0.62;
      const sideW = innerW - heroW - gx;
      const sideH = (innerH - gy) / 2;
      return [
        { x: mx, y: my, w: heroW, h: innerH },
        { x: mx + heroW + gx, y: my, w: sideW, h: sideH },
        { x: mx + heroW + gx, y: my + sideH + gy, w: sideW, h: sideH },
      ];
    }
    case 'postcard':
      return [{ x: mx, y: my, w: innerW, h: innerH }];
    case 'sunset-grid':
    default: {
      const heroH = innerH * 0.56;
      const lowH = innerH - heroH - gy;
      const lowW = (innerW - gx) / 2;
      return [
        { x: mx, y: my, w: innerW, h: heroH },
        { x: mx, y: my + heroH + gy, w: lowW, h: lowH },
        { x: mx + lowW + gx, y: my + heroH + gy, w: lowW, h: lowH },
      ];
    }
  }
}

// ---------------------------------------------------------------- grain

let grainTile = null;
function grainPattern(ctx) {
  if (!grainTile) {
    const t = document.createElement('canvas');
    t.width = 160;
    t.height = 160;
    const c = t.getContext('2d');
    const img = c.createImageData(160, 160);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 118 + Math.floor(Math.random() * 40);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    grainTile = ctx.createPattern(t, 'repeat');
  }
  return grainTile;
}

// ---------------------------------------------------------------- grades

function gradeFilter(grade) {
  switch (grade) {
    case 'neon':
      return 'saturate(1.55) contrast(1.12) brightness(1.02)';
    case 'noir':
      return 'grayscale(1) contrast(1.18) brightness(1.07)';
    case 'sunset':
      return 'saturate(1.3) contrast(1.06) brightness(1.0)';
    case 'clean':
    default:
      return 'saturate(1.08) contrast(1.03)';
  }
}

function gradeOverlay(ctx, rect, grade) {
  const { x, y, w, h } = rect;
  let grad;
  switch (grade) {
    case 'sunset':
      grad = ctx.createLinearGradient(x, y, x, y + h);
      grad.addColorStop(0, 'rgba(255,122,24,0.20)');
      grad.addColorStop(0.55, 'rgba(255,46,136,0.10)');
      grad.addColorStop(1, 'rgba(46,0,92,0.22)');
      ctx.globalCompositeOperation = 'soft-light';
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, w, h);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(255,150,60,0.07)';
      ctx.fillRect(x, y, w, h);
      break;
    case 'neon':
      grad = ctx.createLinearGradient(x, y, x, y + h);
      grad.addColorStop(0, 'rgba(255,0,150,0.26)');
      grad.addColorStop(1, 'rgba(0,214,255,0.24)');
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, w, h);
      ctx.globalCompositeOperation = 'source-over';
      break;
    case 'noir': {
      grad = ctx.createLinearGradient(x, y, x, y + h);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.34)');
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, w, h);
      break;
    }
    case 'clean':
    default:
      break;
  }
}

function clampPan(panel, rect) {
  // Keep the photo covering its panel: pan is limited by how much the
  // zoomed photo overflows the panel.
  const img = panel.photo;
  if (!img || !img.naturalWidth) return { ox: 0, oy: 0 };
  const s = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight) * panel.zoom;
  const maxOx = Math.max(0, (img.naturalWidth * s - rect.w) / 2 / rect.w);
  const maxOy = Math.max(0, (img.naturalHeight * s - rect.h) / 2 / rect.h);
  return {
    ox: Math.max(-maxOx, Math.min(maxOx, panel.ox || 0)),
    oy: Math.max(-maxOy, Math.min(maxOy, panel.oy || 0)),
  };
}

function drawPanel(ctx, rect, panel, scale) {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  if (panel.photo && panel.photo.naturalWidth) {
    const img = panel.photo;
    const pan = clampPan(panel, rect);
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight) * panel.zoom;
    const dw = img.naturalWidth * s;
    const dh = img.naturalHeight * s;
    const dx = x + (w - dw) / 2 + pan.ox * w;
    const dy = y + (h - dh) / 2 + pan.oy * h;
    ctx.filter = gradeFilter(panel.grade);
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.filter = 'none';
  } else {
    // Empty panel: a warm dusk gradient with a hint to drop a photo in.
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, '#3a1c5e');
    g.addColorStop(0.55, '#c94b7c');
    g.addColorStop(1, '#ff7a18');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `700 ${Math.max(14, 22 * scale)}px ${TAG_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Drop a photo here', x + w / 2, y + h / 2);
  }

  gradeOverlay(ctx, rect, panel.grade);

  // Vignette: darkens the panel edges so the caption reads.
  const v = ctx.createRadialGradient(
    x + w / 2, y + h / 2, Math.min(w, h) * 0.42,
    x + w / 2, y + h / 2, Math.max(w, h) * 0.75,
  );
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.30)');
  ctx.fillStyle = v;
  ctx.fillRect(x, y, w, h);

  // Film grain, faint.
  ctx.globalAlpha = 0.055;
  ctx.fillStyle = grainPattern(ctx);
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;
  ctx.restore();

  // Thin white frame, the poster-panel look.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = Math.max(2, 3 * scale);
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

// ---------------------------------------------------------------- lettering

function fitFont(ctx, text, maxWidth, startSize, family, weight = 400) {
  let size = startSize;
  ctx.font = `${weight} ${size}px ${family}`;
  while (size > 12 && ctx.measureText(text).width > maxWidth) {
    size *= 0.94;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

function drawTitleLine(ctx, text, cx, baselineY, maxWidth, size) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const fitted = fitFont(ctx, text, maxWidth, size, TITLE_FONT, 400);
  try {
    ctx.letterSpacing = `${Math.max(1, fitted * 0.015)}px`;
  } catch (_) {
    /* letterSpacing is new; older engines ignore it */
  }
  const grad = ctx.createLinearGradient(0, baselineY - fitted, 0, baselineY + fitted * 0.12);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.62, '#fff6d8');
  grad.addColorStop(1, '#ffd23f');
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.strokeStyle = '#0d0518';
  ctx.lineWidth = Math.max(3, fitted * 0.085);
  ctx.strokeText(text, cx, baselineY);
  ctx.fillStyle = grad;
  ctx.fillText(text, cx, baselineY);
  // A second, thinner dark pass sharpens the edge against bright photos.
  ctx.strokeStyle = 'rgba(13,5,24,0.55)';
  ctx.lineWidth = Math.max(1, fitted * 0.02);
  ctx.strokeText(text, cx, baselineY);
  ctx.restore();
  return fitted;
}

function drawBadge(ctx, text, x, y, scale) {
  if (!text) return;
  const pad = 14 * scale;
  const h = 34 * scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.07);
  ctx.font = `400 ${Math.max(11, 17 * scale)}px ${TITLE_FONT}`;
  const tw = ctx.measureText(text.toUpperCase()).width;
  const w = tw + pad * 2;
  ctx.fillStyle = '#ffd23f';
  ctx.strokeStyle = '#0d0518';
  ctx.lineWidth = Math.max(2, 2.5 * scale);
  roundRect(ctx, -w / 2, -h / 2, w, h, h / 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#0d0518';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.toUpperCase(), 0, 1);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------------------------------------------------------------- the cover

/** Draw the whole cover into ctx at W x H. `state` follows defaultState(). */
export function drawCover(ctx, W, H, state) {
  const scale = Math.min(W, H) / 1080;
  // Dusk backdrop behind the panel gaps.
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#160a2e');
  bg.addColorStop(0.5, '#2b0f3d');
  bg.addColorStop(1, '#12081f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const rects = layoutPanels(state.layout, W, H);
  const panels = state.panels.slice(0, rects.length);
  rects.forEach((rect, i) => {
    drawPanel(ctx, rect, panels[i] || { photo: null, zoom: 1, ox: 0, oy: 0, grade: 'clean' }, scale);
  });

  // Caption zone: over the hero panel (first panel), or across the bottom
  // for the triptych, where no single panel owns the title.
  const hero = rects[0];
  const lines = [state.line1, state.line2].map((s) => (s || '').trim()).filter(Boolean);
  const tagline = (state.tagline || '').trim();

  if (state.layout === 'neon-triptych') {
    const bandH = H * 0.2;
    const bandY = H - bandH;
    const shade = ctx.createLinearGradient(0, bandY - H * 0.06, 0, H);
    shade.addColorStop(0, 'rgba(13,5,24,0)');
    shade.addColorStop(1, 'rgba(13,5,24,0.72)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, bandY - H * 0.06, W, H - bandY + H * 0.06);
    const maxW = W * 0.88;
    const lineSize = Math.min(W * 0.105, (bandH * 0.62) / Math.max(1, lines.length));
    // Anchor the block from the bottom up so nothing ever runs off-canvas:
    // tagline sits lowest, the title lines stack above it.
    const tagSize = Math.max(13, 26 * scale);
    let lastTitleY = H - 34 * scale;
    if (tagline) lastTitleY -= tagSize + 14 * scale;
    let y = lastTitleY - (lines.length - 1) * lineSize * 0.98;
    lines.forEach((line) => {
      drawTitleLine(ctx, line.toUpperCase(), W / 2, y, maxW, lineSize);
      y += lineSize * 0.98;
    });
    if (tagline) {
      ctx.save();
      ctx.font = `700 ${tagSize}px ${TAG_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffe9a8';
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 6 * scale;
      ctx.fillText(tagline, W / 2, H - 30 * scale);
      ctx.restore();
    }
    drawBadge(ctx, state.badge, W - W * 0.13, H * 0.075, scale);
  } else {
    // Shade the bottom of the hero panel so the title always reads.
    const shade = ctx.createLinearGradient(0, hero.y + hero.h * 0.42, 0, hero.y + hero.h);
    shade.addColorStop(0, 'rgba(13,5,24,0)');
    shade.addColorStop(1, 'rgba(13,5,24,0.68)');
    ctx.save();
    ctx.beginPath();
    ctx.rect(hero.x, hero.y, hero.w, hero.h);
    ctx.clip();
    ctx.fillStyle = shade;
    ctx.fillRect(hero.x, hero.y + hero.h * 0.42, hero.w, hero.h * 0.58);
    ctx.restore();

    const maxW = hero.w * 0.92;
    const lineSize = Math.min(hero.w * 0.16, hero.h * 0.30);
    let y = hero.y + hero.h - 14 * scale;
    if (tagline) y -= Math.max(18, 34 * scale);
    y -= (lines.length - 1) * lineSize * 0.98;
    lines.forEach((line) => {
      drawTitleLine(ctx, line.toUpperCase(), hero.x + hero.w / 2, y, maxW, lineSize);
      y += lineSize * 0.98;
    });
    if (tagline) {
      ctx.save();
      ctx.font = `700 ${Math.max(13, 26 * scale)}px ${TAG_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffe9a8';
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 6 * scale;
      ctx.fillText(tagline, hero.x + hero.w / 2, hero.y + hero.h - 12 * scale);
      ctx.restore();
    }
    drawBadge(ctx, state.badge, hero.x + hero.w - hero.w * 0.14, hero.y + hero.h * 0.075, scale);
  }
}

/** Render a cover to a fresh canvas at W x H. */
export function renderCover(W, H, state) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  drawCover(canvas.getContext('2d'), W, H, state);
  return canvas;
}

export const EXPORT_SIZES = [
  { label: 'Square 1080 × 1080', w: 1080, h: 1080 },
  { label: 'Portrait 1080 × 1350', w: 1080, h: 1350 },
  { label: 'Landscape 1920 × 1080', w: 1920, h: 1080 },
];
