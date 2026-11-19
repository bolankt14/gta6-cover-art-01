// Vice Cover Studio
// Fixed scenes for screenshots and headless checks.
//
//   ?shot=cover&layout=sunset-grid&size=1920x1080&photo=sunset-portrait&photo2=vice-street&photo3=boulevard&line1=VICE&line2=CITY
//     renders the cover alone, filling the window.
//   ?shot=editor&photo=vice-street
//     shows the editor with a sample loaded.
//   ?selftest=1
//     renders every layout at every export size off-screen, checks the
//     pixels are not blank, and writes PASS/FAIL lines into #selftest-result
//     (and into document.title) so a headless run can read it with --dump-dom.
//
// window.__shotReady is set once the scene is painted.
import { renderCover, EXPORT_SIZES, LAYOUTS } from './cover.js';

function sampleById(library, id) {
  return library.find((s) => s.id === id) || library[0] || null;
}

function setCoverMode() {
  document.body.classList.add('shot-cover');
  const stage = document.getElementById('stage');
  const canvas = document.getElementById('preview');
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  stage.style.maxWidth = 'none';
  stage.style.padding = '0';
}

function markReady() {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shotReady = true;
  }));
}

async function selftest(api) {
  const out = document.getElementById('selftest-result');
  const lines = [];
  let ok = true;
  const photos = [api.library[0], api.library[1], api.library[2]].map((s) => (s ? s.img : null));
  for (const layout of Object.keys(LAYOUTS)) {
    api.setLayout(layout);
    api.state.panels.forEach((p, i) => {
      p.photo = photos[i % photos.length];
      p.grade = ['sunset', 'neon', 'noir'][i % 3];
    });
    for (const size of EXPORT_SIZES) {
      try {
        const c = renderCover(size.w, size.h, api.state);
        const g = c.getContext('2d');
        const data = g.getImageData(0, 0, size.w, size.h).data;
        let sum = 0;
        for (let i = 0; i < data.length; i += 9973) sum += data[i];
        const blank = sum === 0;
        lines.push(`${layout} ${size.w}x${size.h}: ${blank ? 'FAIL blank' : 'ok'}`);
        if (blank) ok = false;
      } catch (err) {
        lines.push(`${layout} ${size.w}x${size.h}: FAIL ${err.message}`);
        ok = false;
      }
    }
  }
  // Export path: a PNG blob must come out of the canvas.
  try {
    const c = renderCover(1080, 1080, api.state);
    const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
    lines.push(`export png: ${blob && blob.size > 10000 ? 'ok' : 'FAIL'} (${blob ? blob.size : 0} bytes)`);
    if (!blob || blob.size <= 10000) ok = false;
  } catch (err) {
    lines.push(`export png: FAIL ${err.message}`);
    ok = false;
  }
  const verdict = ok ? 'SELFTEST PASS' : 'SELFTEST FAIL';
  lines.unshift(verdict);
  out.textContent = lines.join('\n');
  document.title = verdict;
  window.__shotReady = true;
  return ok;
}

export async function runShot(query, api) {
  if (query.has('selftest')) {
    document.body.classList.add('shot-cover');
    await selftest(api);
    return;
  }
  const shot = query.get('shot');
  const layout = query.get('layout');
  if (layout && LAYOUTS[layout]) api.setLayout(layout);

  const photoIds = [query.get('photo'), query.get('photo2'), query.get('photo3')];
  api.state.panels.forEach((p, i) => {
    const pick = photoIds[i] ? sampleById(api.library, photoIds[i]) : null;
    if (pick) p.photo = pick.img;
  });

  if (query.get('line1') !== null) {
    api.state.line1 = query.get('line1');
    document.getElementById('line1').value = api.state.line1;
  }
  if (query.get('line2') !== null) {
    api.state.line2 = query.get('line2');
    document.getElementById('line2').value = api.state.line2;
  }
  if (query.get('tagline') !== null) {
    api.state.tagline = query.get('tagline');
    document.getElementById('tagline').value = api.state.tagline;
  }

  if (shot === 'cover') {
    setCoverMode();
    const size = query.get('size');
    if (size) {
      const [w, h] = size.split('x').map(Number);
      if (w > 0 && h > 0) api.setSize({ label: `${w} × ${h}`, w, h });
    }
    try {
      await document.fonts.load('100px Anton');
      await document.fonts.ready;
    } catch (_) { /* fallback fonts */ }
    api.redraw();
    markReady();
    return;
  }

  // shot=editor: the editor itself, with the requested photo loaded.
  api.redraw();
  markReady();
}
