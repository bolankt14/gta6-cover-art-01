// Vice Cover Studio — the editor.
//
// Wires the page: pick photos, choose a layout, drag to crop, grade each
// panel, letter the caption, export a PNG. A `?shot=` query sets up a
// fixed scene for a screenshot instead (./shots.js), and `?selftest=1`
// renders every layout at every export size and reports into the DOM.
import { drawCover, renderCover, defaultState, LAYOUTS, GRADES, EXPORT_SIZES, layoutPanels } from './cover.js';

const $ = (id) => document.getElementById(id);
const canvas = $('preview');
const ctx = canvas.getContext('2d');

const state = defaultState();
let exportSize = EXPORT_SIZES[0];
let selectedPanel = 0;
let library = []; // { id, label, img }
let selectedPhoto = null;

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`cannot load ${url}`));
    img.src = url;
  });
}

const SAMPLES = [
  { id: 'vice-street', label: 'Neon street' },
  { id: 'sunset-portrait', label: 'Golden hour' },
  { id: 'boulevard', label: 'Boulevard' },
  { id: 'pier', label: 'Pier' },
];

async function loadSamples() {
  const loaded = [];
  for (const s of SAMPLES) {
    try {
      const img = await loadImage(`samples/${s.id}.jpg`);
      loaded.push({ ...s, img });
    } catch (err) {
      console.warn('sample missing:', s.id);
    }
  }
  return loaded;
}

function panelsFor(layout) {
  const n = LAYOUTS[layout].panels;
  while (state.panels.length < n) {
    state.panels.push({ photo: null, zoom: 1.15, ox: 0, oy: 0, grade: 'clean' });
  }
  state.panels.length = n;
  if (selectedPanel >= n) selectedPanel = 0;
}

function redraw() {
  canvas.width = exportSize.w;
  canvas.height = exportSize.h;
  drawCover(ctx, exportSize.w, exportSize.h, state);
  updatePanelControls();
}

// ---------------------------------------------------------------- library UI

function renderLibrary() {
  const strip = $('library');
  strip.innerHTML = '';
  for (const item of library) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'thumb' + (selectedPhoto === item ? ' picked' : '');
    btn.title = item.label;
    const img = document.createElement('img');
    img.src = item.img.src;
    img.alt = item.label;
    btn.appendChild(img);
    btn.addEventListener('click', () => {
      selectedPhoto = item;
      state.panels[selectedPanel].photo = item.img;
      state.panels[selectedPanel].ox = 0;
      state.panels[selectedPanel].oy = 0;
      renderLibrary();
      redraw();
      setStatus(`${item.label} → panel ${selectedPanel + 1}`);
    });
    strip.appendChild(btn);
  }
}

$('upload').addEventListener('change', async (e) => {
  const files = [...e.target.files].filter((f) => f.type.startsWith('image/'));
  for (const file of files) {
    try {
      const img = await loadImage(URL.createObjectURL(file));
      library.push({ id: `up-${Date.now()}-${library.length}`, label: file.name, img });
    } catch (err) {
      setStatus(`Could not read ${file.name}`);
    }
  }
  renderLibrary();
  if (files.length) setStatus(`${files.length} photo${files.length > 1 ? 's' : ''} added to the library`);
  e.target.value = '';
});

$('fill-all').addEventListener('click', () => {
  const photo = (selectedPhoto || library[0] || {}).img;
  if (!photo) return;
  state.panels.forEach((p) => {
    p.photo = photo;
    p.ox = 0;
    p.oy = 0;
  });
  redraw();
  setStatus('One photo fills every panel');
});

// ---------------------------------------------------------------- layout UI

function renderLayouts() {
  const box = $('layouts');
  box.innerHTML = '';
  for (const [key, def] of Object.entries(LAYOUTS)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip' + (state.layout === key ? ' active' : '');
    btn.textContent = def.label;
    btn.addEventListener('click', () => {
      state.layout = key;
      panelsFor(key);
      renderLayouts();
      redraw();
    });
    box.appendChild(btn);
  }
}

function renderSizes() {
  const box = $('sizes');
  box.innerHTML = '';
  for (const size of EXPORT_SIZES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip' + (exportSize === size ? ' active' : '');
    btn.textContent = size.label;
    btn.addEventListener('click', () => {
      exportSize = size;
      redraw();
    });
    box.appendChild(btn);
  }
}

// ---------------------------------------------------------------- panel UI

function updatePanelControls() {
  const panel = state.panels[selectedPanel];
  $('panel-label').textContent = `Panel ${selectedPanel + 1} of ${state.panels.length}`;
  $('zoom').value = panel.zoom;
  $('zoom-val').textContent = `${panel.zoom.toFixed(2)}×`;
  document.querySelectorAll('#grades button').forEach((b) => {
    b.classList.toggle('active', b.dataset.grade === panel.grade);
  });
  document.querySelectorAll('#panel-tabs button').forEach((b, i) => {
    b.classList.toggle('active', i === selectedPanel);
  });
}

function renderPanelTabs() {
  const box = $('panel-tabs');
  box.innerHTML = '';
  state.panels.forEach((_, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip';
    btn.textContent = `Panel ${i + 1}`;
    btn.addEventListener('click', () => {
      selectedPanel = i;
      redraw();
    });
    box.appendChild(btn);
  });
  const grades = $('grades');
  grades.innerHTML = '';
  for (const [key, label] of Object.entries(GRADES)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip';
    btn.dataset.grade = key;
    btn.textContent = label;
    btn.addEventListener('click', () => {
      state.panels[selectedPanel].grade = key;
      redraw();
    });
    grades.appendChild(btn);
  }
}

$('zoom').addEventListener('input', (e) => {
  state.panels[selectedPanel].zoom = parseFloat(e.target.value);
  redraw();
});

$('reset-panel').addEventListener('click', () => {
  const p = state.panels[selectedPanel];
  p.zoom = 1.15;
  p.ox = 0;
  p.oy = 0;
  p.grade = 'clean';
  redraw();
});

// Drag to pan, click to select a panel, wheel to zoom.
function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * canvas.width,
    y: ((e.clientY - r.top) / r.height) * canvas.height,
  };
}

function hitPanel(p) {
  const rects = layoutPanels(state.layout, canvas.width, canvas.height);
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return i;
  }
  return -1;
}

let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const p = canvasPoint(e);
  const i = hitPanel(p);
  if (i < 0) return;
  selectedPanel = i;
  drag = { x: p.x, y: p.y };
  canvas.setPointerCapture(e.pointerId);
  redraw();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = canvasPoint(e);
  const rects = layoutPanels(state.layout, canvas.width, canvas.height);
  const rect = rects[selectedPanel];
  const panel = state.panels[selectedPanel];
  panel.ox += (p.x - drag.x) / rect.w;
  panel.oy += (p.y - drag.y) / rect.h;
  drag = { x: p.x, y: p.y };
  redraw();
});
canvas.addEventListener('pointerup', () => {
  drag = null;
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const panel = state.panels[selectedPanel];
  panel.zoom = Math.max(1, Math.min(3, panel.zoom * Math.exp(-e.deltaY * 0.0012)));
  redraw();
}, { passive: false });

// ---------------------------------------------------------------- caption UI

function bindCaption(id, key) {
  $(id).addEventListener('input', (e) => {
    state[key] = e.target.value;
    redraw();
  });
}
bindCaption('line1', 'line1');
bindCaption('line2', 'line2');
bindCaption('tagline', 'tagline');
bindCaption('badge', 'badge');

// ---------------------------------------------------------------- export

function download(canvasEl, name) {
  canvasEl.toBlob((blob) => {
    if (!blob) {
      setStatus('Export failed — try again');
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    setStatus(`Saved ${name}`);
  }, 'image/png');
}

$('export').addEventListener('click', () => {
  const c = renderCover(exportSize.w, exportSize.h, state);
  download(c, `vice-cover-${exportSize.w}x${exportSize.h}.png`);
});

$('export-all').addEventListener('click', () => {
  for (const size of EXPORT_SIZES) {
    const c = renderCover(size.w, size.h, size === exportSize ? state : state);
    download(c, `vice-cover-${size.w}x${size.h}.png`);
  }
  setStatus('Saved all three sizes');
});

function setStatus(text) {
  $('status').textContent = text;
}

// ---------------------------------------------------------------- boot

const query = new URLSearchParams(location.search);

async function boot() {
  library = await loadSamples();
  selectedPhoto = library[0] || null;
  // Default spread: a different sample in each panel.
  const spread = [library[0], library[1], library[2]];
  state.panels.forEach((p, i) => {
    if (spread[i]) p.photo = spread[i].img;
  });
  renderLayouts();
  renderSizes();
  renderPanelTabs();
  renderLibrary();
  try {
    await document.fonts.load('100px Anton');
    await document.fonts.ready;
  } catch (_) {
    /* system fallback fonts still render */
  }
  redraw();
  if (query.has('shot') || query.has('selftest')) {
    const shots = await import('./shots.js');
    await shots.runShot(query, {
      state, library, loadImage, redraw,
      setLayout(layout) {
        state.layout = layout;
        panelsFor(layout);
        renderLayouts();
        renderPanelTabs();
      },
      setSize(size) {
        exportSize = size;
      },
      setStatus,
    });
  }
}

boot();
