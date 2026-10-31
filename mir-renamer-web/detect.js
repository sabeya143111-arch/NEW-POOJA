// Pure detection logic (no browser APIs) so it can run in the page and be tested in Node.
(function (root) {
  const REF_RE = /([A-Z0-9]+(?:-[A-Z0-9]+)*-MAT-\d+)(?:-R(\d+))?/i;

  // Returns { ref, rev } from OCR text. rev: number (R1 -> 1, none -> 0)
  function findReference(text) {
    const tryLine = (s) => {
      // only glue spaces around hyphens (OCR "KAB - IR - MAT"); keep other spaces so a label like "Ref" is not merged into the ref
      const m = REF_RE.exec(s.replace(/\s*-\s*/g, "-"));
      return m ? { ref: m[1].toUpperCase(), rev: m[2] ? parseInt(m[2], 10) : 0 } : null;
    };
    for (const line of text.split(/\r?\n/)) {
      if (/MAT/i.test(line)) {
        const r = tryLine(line);
        if (r) return r;
      }
    }
    return tryLine(text) || { ref: null, rev: null };
  }

  // rgba: Uint8ClampedArray of the whole page, width/height of the page, y0 = top of the lowest "Check" word.
  // Returns { box: 0|1|2|null, scores: [..], note }
  function findTickedBox(rgba, width, height, y0) {
    const top = Math.max(y0 - 5, 0);
    const bot = Math.min(y0 + 110, height);
    const h = bot - top;
    const mask = new Uint8Array(width * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < width; x++) {
        const i = ((y + top) * width + x) * 4;
        const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
        if (r < 130 && g < 130 && b < 130 && Math.abs(r - b) < 40) mask[y * width + x] = 1;
      }
    }
    // close gaps (<=4px) inside a row: a pen tick can cut a box outline in two
    for (let y = 0; y < h; y++) {
      let last = -1;
      for (let x = 0; x < width; x++) {
        if (mask[y * width + x]) {
          if (last >= 0 && x - last > 1 && x - last <= 5) {
            for (let k = last + 1; k < x; k++) mask[y * width + k] = 1;
          }
          last = x;
        }
      }
    }
    // connected components (8-neighbour)
    const seen = new Uint8Array(width * h);
    const boxes = [];
    const stack = [];
    for (let sy = 0; sy < h; sy++) {
      for (let sx = 0; sx < width; sx++) {
        const s = sy * width + sx;
        if (!mask[s] || seen[s]) continue;
        let minX = sx, maxX = sx, minY = sy, maxY = sy;
        stack.push(s);
        seen[s] = 1;
        while (stack.length) {
          const p = stack.pop();
          const py = (p / width) | 0, px = p - py * width;
          if (px < minX) minX = px; if (px > maxX) maxX = px;
          if (py < minY) minY = py; if (py > maxY) maxY = py;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nx = px + dx, ny = py + dy;
              if (nx < 0 || ny < 0 || nx >= width || ny >= h) continue;
              const n = ny * width + nx;
              if (mask[n] && !seen[n]) { seen[n] = 1; stack.push(n); }
            }
          }
        }
        const w = maxX - minX + 1, hh = maxY - minY + 1;
        if (w >= 25 && w <= 110 && hh >= 15 && hh <= 50 && w > hh) {
          boxes.push({ x: minX, y: minY + top, w, h: hh });
        }
      }
    }
    boxes.sort((a, b) => a.x - b.x);
    const uniq = [];
    for (const bx of boxes) if (!uniq.length || bx.x - uniq[uniq.length - 1].x > 60) uniq.push(bx);
    if (uniq.length < 3) return { box: null, scores: [], note: "could not find the 3 status boxes" };

    const scores = uniq.slice(0, 3).map((bx) => {
      let n = 0;
      const ya = Math.max(bx.y - 30, 0), yb = Math.min(bx.y + bx.h + 5, height);
      const xa = Math.max(bx.x - 5, 0), xb = Math.min(bx.x + bx.w + 5, width);
      for (let y = ya; y < yb; y++) {
        for (let x = xa; x < xb; x++) {
          const i = (y * width + x) * 4;
          if (rgba[i + 2] > rgba[i] + 40 && rgba[i + 2] > 120) n++;
        }
      }
      return n;
    });
    let best = 0;
    for (let i = 1; i < 3; i++) if (scores[i] > scores[best]) best = i;
    if (scores[best] < 80) return { box: null, scores, note: "no tick found" };
    return { box: best, scores, note: "box " + (best + 1) };
  }

  const api = { findReference, findTickedBox };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MIRDetect = api;
})(typeof window !== "undefined" ? window : globalThis);
