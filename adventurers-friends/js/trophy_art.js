/* Trophy keepsakes: one pixel trophy per season award, a ribbon rosette per honour, and the cabinet strip on hero and party pages. */
(function (root) {
  "use strict";
  const W = 24, H = 28, O = [40, 26, 16];
  const BRASS = [[255, 236, 160], [236, 197, 106], [200, 150, 62], [150, 104, 36], [96, 64, 24]];
  const OAK = [[176, 118, 66], [140, 90, 48], [104, 64, 32], [70, 42, 20]];
  const TIN = [[236, 238, 240], [196, 200, 206], [150, 154, 162], [104, 108, 116]];
  const RED = [[232, 110, 88], [200, 70, 58], [150, 42, 36], [104, 28, 24]];
  const BLUE = [[130, 176, 220], [74, 122, 176], [46, 78, 122], [30, 50, 84]];
  const GREEN = [[150, 206, 110], [90, 154, 58], [58, 106, 42], [36, 70, 28]];
  const INK = [[92, 84, 96], [58, 52, 62], [38, 34, 42], [24, 20, 28]];
  const BONE = [[252, 246, 228], [236, 222, 190], [196, 178, 140], [150, 132, 100]];
  const LEATHER = [[196, 140, 86], [160, 104, 58], [118, 72, 38], [80, 48, 24]];

  function buf(w, h) {
    const d = new Uint8ClampedArray(w * h * 4);
    const b = {
      w, h, d,
      px(x, y, c) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= w || y >= h || !c) return; const o = (y * w + x) * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255; },
      on(x, y) { return x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] === 255; },
      rect(x, y, rw, rh, c) { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) b.px(x + i, y + j, c); },
      line(x0, y0, x1, y1, c) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let i = 0; i <= n; i++) b.px(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c); },
    };
    return b;
  }
  // an upright roll shaded across its width (as games_replay.js draws its trophies), the top corners knocked off when round
  function roll(b, x, y, w, h, ramp, round) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (round && j === 0 && (i === 0 || i === w - 1)) continue;
      const u = w === 1 ? 0.3 : i / (w - 1), k = u < 0.25 ? 0 : u < 0.55 ? 1 : u < 0.85 ? 2 : 3;
      b.px(x + i, y + j, ramp[Math.min(ramp.length - 1, k + (j > h - 2 ? 1 : 0))]);
    }
  }
  // a filled ellipse lit from the top left
  function ell(b, cx, cy, rx, ry, ramp) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, dd = nx * nx + ny * ny;
      if (dd > 1) continue;
      const l = -nx * 0.6 - ny * 0.7 + (1 - dd) * 0.35;
      b.px(x, y, ramp[l > 0.7 ? 0 : l > 0.15 ? 1 : l > -0.45 ? 2 : Math.min(3, ramp.length - 1)]);
    }
  }
  function plinth(b, y, w, plate) {
    const x = 12 - (w >> 1);
    roll(b, x, y, w, 5, OAK);
    b.rect(x, y, w, 1, OAK[0]);
    b.rect(x - 1, y + 4, w + 2, 2, OAK[3]);
    b.rect(x - 1, y + 4, w + 2, 1, OAK[2]);
    if (plate) { b.rect(x + 3, y + 2, w - 6, 2, BRASS[2]); b.rect(x + 3, y + 2, w - 6, 1, BRASS[1]); }
  }
  function outline(b) {
    const add = [];
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (!b.on(x, y) && (b.on(x + 1, y) || b.on(x - 1, y) || b.on(x, y + 1) || b.on(x, y - 1))) add.push([x, y]);
    for (const [x, y] of add) { const o = (y * b.w + x) * 4; b.d[o] = O[0]; b.d[o + 1] = O[1]; b.d[o + 2] = O[2]; b.d[o + 3] = 254; }
    return b;
  }
  // a cup: the bowl tapering to a stem, a knot, a stepped foot; hw the bowl's half-width, top its rim row
  function cup(b, top, hw, ramp, handles) {
    for (let y = top; y < top + 9; y++) { const w = y - top < 5 ? hw : Math.max(2, Math.round(hw - (y - top - 4) * 1.5)); roll(b, 12 - w, y, w * 2, 1, ramp); }
    b.rect(12 - hw, top, hw * 2, 1, ramp[0]);
    b.rect(13 - hw, top + 1, hw * 2 - 2, 1, ramp[3]);
    roll(b, 11, top + 9, 2, 3, ramp);
    roll(b, 10, top + 10, 4, 1, ramp);
    roll(b, 9, top + 12, 6, 1, ramp);
    roll(b, 8, top + 13, 8, 2, ramp);
    if (handles) for (const s of [-1, 1]) {
      const x0 = 12 + s * hw - (s > 0 ? 0 : 1);
      [[1, 1], [2, 2], [2, 3], [2, 4], [1, 5]].forEach(([dx, dy]) => b.px(x0 + s * dx, top + dy, ramp[s < 0 ? 1 : 3]));
    }
  }
  const pennant = (b, x, y, len, ramp, s) => { b.line(x, y, x, y + len + 4, OAK[2]); for (let j = 0; j < 4; j++) for (let i = 0; i < 6 - j * 1.5; i++) b.px(x + s * (1 + i), y + j, ramp[j < 2 ? 1 : 2]); };

  function standard(b, ramp) {
    roll(b, 11, 1, 2, 20, OAK);
    b.rect(5, 3, 14, 1, BRASS[1]); b.px(5, 2, BRASS[0]); b.px(18, 2, BRASS[2]);
    for (let y = 4; y < 16; y++) for (let x = 6; x < 18; x++) {
      if (y >= 13 && Math.abs(x + 0.5 - 12) < (y - 12) * 1.6) continue;
      b.px(x, y, ramp[x === 6 ? 0 : x === 17 || y === 15 ? 3 : y === 4 ? 1 : 2 - ((x + y) % 7 === 0 ? 1 : 0)]);
    }
    ell(b, 12, 9, 2.6, 2.6, BRASS);
    for (const [x, y] of [[12, 5], [12, 13], [8, 9], [16, 9]]) b.px(x, y, BRASS[1]);
    plinth(b, 20, 14, true);
  }

  const DRAW = {
    // the Hero of the Season's laurel cup: gold, a band of laurel round the bowl, a ruby at its heart
    mvp(b) {
      cup(b, 3, 7, BRASS, true);
      for (let x = 6; x < 18; x++) { b.px(x, 8, GREEN[(x % 2) + 1]); if (x % 3 !== 1) b.px(x, 9, GREEN[x % 3 ? 2 : 1]); }
      b.px(11, 8, RED[1]); b.px(12, 8, RED[0]); b.px(11, 9, RED[2]); b.px(12, 9, RED[1]);
      b.px(9, 5, BRASS[0]); b.px(9, 6, BRASS[0]);
      plinth(b, 20, 16, true);
    },
    // the Party of the Season's cup: silver and wide, with the crews' pennants flying from it
    party_mvp(b) {
      pennant(b, 7, 0, 3, RED, -1); pennant(b, 16, 0, 3, BLUE, 1);
      cup(b, 5, 8, TIN, true);
      for (let x = 5; x < 19; x++) b.px(x, 9, x % 2 ? BRASS[1] : BRASS[2]);
      plinth(b, 20, 16, true);
    },
    // the Golden Purse: a gilded pouch drawn tight with a red cord, a coin leaning on it
    richest(b) {
      ell(b, 12, 14, 6.5, 5.5, BRASS);
      roll(b, 10, 7, 4, 3, BRASS);
      for (const [x, y] of [[8, 5], [9, 6], [10, 5], [12, 5], [13, 6], [14, 5], [15, 6], [11, 6]]) b.px(x, y, BRASS[(x + y) % 2 ? 1 : 2]);
      b.rect(9, 9, 6, 1, RED[1]); b.px(14, 10, RED[2]); b.px(15, 11, RED[1]);
      b.px(9, 12, BRASS[0]); b.px(9, 13, BRASS[0]); b.px(10, 11, BRASS[0]);
      ell(b, 18, 18, 2.2, 2.2, BRASS); b.px(18, 18, BRASS[3]);
      plinth(b, 20, 16, true);
    },
    // the Butcher's Cleaver on a walnut shield
    killer(b) {
      for (let y = 1; y < 26; y++) { const hw = y < 18 ? 10 : Math.round(10 - (y - 17) * 1.25); if (hw > 0) for (let x = 12 - hw; x < 12 + hw; x++) b.px(x, y, x === 12 - hw || y === 1 ? OAK[0] : x === 11 + hw ? OAK[3] : (x + y * 3) % 11 === 0 ? OAK[2] : OAK[1]); }
      roll(b, 4, 6, 11, 8, TIN);
      b.rect(4, 6, 11, 1, TIN[0]); b.rect(4, 13, 11, 1, TIN[0]); b.rect(4, 12, 11, 1, TIN[1]);
      b.px(6, 8, OAK[3]); b.px(7, 8, OAK[3]); b.px(6, 9, OAK[3]); b.px(7, 9, OAK[3]);
      roll(b, 15, 8, 6, 3, LEATHER); b.px(16, 9, BRASS[1]); b.px(19, 9, BRASS[1]);
      b.rect(8, 18, 8, 2, BRASS[2]); b.rect(8, 18, 8, 1, BRASS[1]);
    },
    // Deepest Delver: a pick, head up, with a gold band on the haft
    delver(b) {
      roll(b, 11, 6, 2, 15, OAK);
      for (let x = 4; x <= 19; x++) { const d = Math.abs(x - 11.5), y = 3 + Math.round((d * d) / 22); b.px(x, y, TIN[d > 6 ? 2 : 1]); b.px(x, y + 1, TIN[d > 6 ? 3 : 2]); if (d < 5) b.px(x, y - 1, TIN[0]); }
      b.rect(10, 4, 4, 3, TIN[2]); b.rect(10, 4, 4, 1, TIN[1]);
      b.rect(11, 8, 2, 1, BRASS[1]); b.rect(11, 9, 2, 1, BRASS[2]);
      plinth(b, 20, 14, true);
    },
    // Honest Day's Work: a gilded spade, grip up, the blade planted in the plinth
    worker(b) {
      for (const [x, y] of [[9, 1], [10, 1], [11, 1], [12, 1], [13, 1], [14, 1], [9, 2], [14, 2], [9, 3], [14, 3]]) b.px(x, y, OAK[y === 1 ? 0 : x < 12 ? 1 : 2]);
      b.rect(10, 4, 4, 1, OAK[1]);
      roll(b, 11, 5, 2, 9, OAK);
      b.rect(10, 12, 4, 2, BRASS[3]);
      for (let y = 14; y < 21; y++) { const hw = y < 19 ? 5 : 5 - (y - 18) * 2; roll(b, 12 - hw, y, hw * 2, 1, TIN); }
      b.rect(7, 14, 10, 1, TIN[0]); b.rect(7, 15, 10, 1, TIN[3]);
      for (let y = 16; y < 19; y++) b.px(11, y, TIN[2]);
      plinth(b, 20, 14, true);
    },
    // Most Stitches: a spool of red thread with the needle through it
    stitches(b) {
      roll(b, 6, 6, 12, 2, OAK); b.rect(6, 6, 12, 1, OAK[0]);
      for (let y = 8; y < 17; y++) { roll(b, 8, y, 8, 1, RED); if (y % 2) b.rect(9, y, 6, 1, RED[2]); }
      roll(b, 6, 17, 12, 2, OAK);
      b.line(19, 1, 13, 12, TIN[1]); b.px(19, 1, TIN[0]); b.px(18, 2, TIN[3]);
      b.line(19, 2, 21, 6, RED[1]); b.line(21, 6, 20, 11, RED[1]);
      plinth(b, 20, 14, true);
    },
    // Worn Boots: one boot, bronzed, laces and all
    wanderer(b) {
      const ramp = BRASS.slice(1);
      roll(b, 7, 3, 7, 12, ramp);
      b.rect(6, 3, 9, 2, BRASS[1]); b.rect(6, 3, 9, 1, BRASS[0]); b.rect(6, 4, 9, 1, BRASS[2]);
      for (let y = 6; y < 14; y += 2) { b.px(12, y, BRASS[4]); b.px(13, y + 1, BRASS[4]); b.px(14, y, BRASS[0]); }
      const toe = [[7, 15], [7, 17], [7, 18], [7, 19], [7, 19]];
      for (let j = 0; j < 5; j++) roll(b, toe[j][0], 14 + j, toe[j][1] - toe[j][0] + 1, 1, ramp);
      b.px(18, 15, BRASS[3]); b.px(19, 16, BRASS[3]); b.px(15, 14, BRASS[2]); b.px(16, 15, BRASS[1]); b.px(17, 16, BRASS[1]);
      b.rect(6, 19, 15, 1, OAK[3]); b.rect(6, 18, 4, 2, OAK[2]);
      plinth(b, 20, 16, true);
    },
    // High Roller: a pair of gilded dice, one cocked on the other
    gambler(b) {
      const die = (x, y, s, pips) => {
        b.rect(x, y, s, 2, BRASS[0]);
        roll(b, x, y + 2, s, s - 2, [BRASS[1], BRASS[1], BRASS[2], BRASS[3]]);
        for (const [i, j] of pips) b.px(x + i, y + 2 + j, INK[2]);
      };
      die(4, 11, 9, [[2, 1], [4, 3], [6, 5]]);
      die(12, 5, 8, [[2, 1], [5, 1], [2, 4], [5, 4]]);
      die(13, 12, 8, [[3, 2]]);
      plinth(b, 20, 18, true);
    },
    // The Undertaker's Friend: a coffin stood on end, brass handles
    ghoul(b) {
      for (let y = 1; y < 21; y++) { const hw = y < 6 ? 3 + (y - 1) * 0.6 : 6 - (y - 6) * 0.2; roll(b, Math.round(12 - hw), y, Math.round(hw * 2), 1, OAK); }
      for (let y = 2; y < 20; y++) b.px(12, y, OAK[2]);
      b.rect(8, 9, 2, 1, BRASS[1]); b.rect(15, 9, 2, 1, BRASS[2]); b.rect(9, 15, 2, 1, BRASS[1]); b.rect(14, 15, 2, 1, BRASS[2]);
      b.rect(11, 5, 3, 1, BRASS[1]); b.px(12, 4, BRASS[0]); b.px(12, 6, BRASS[2]);
      plinth(b, 21, 14, false);
    },
    // Menace of the Roads: a studded club
    brute(b) {
      for (let k = 0; k < 17; k++) { const t = 1 + Math.round(k / 6); for (let j = 0; j < t; j++) { b.px(6 + k * 0.75 + j, 19 - k, OAK[j === 0 ? 0 : j === t - 1 ? 3 : 1]); b.px(7 + k * 0.75 + j, 19 - k, OAK[2]); } }
      for (const [x, y] of [[14, 4], [17, 6], [16, 2], [19, 3], [13, 8], [18, 9], [20, 6]]) { b.px(x, y, TIN[0]); b.px(x + 1, y, TIN[2]); }
      b.rect(7, 16, 3, 2, LEATHER[1]);
      plinth(b, 20, 14, true);
    },
    // Villain of the Season: a black mask on a stick
    villain(b) {
      b.line(12, 12, 12, 20, TIN[2]); b.px(12, 12, TIN[1]);
      for (let y = 4; y < 12; y++) for (let x = 3; x < 21; x++) {
        const dx = Math.abs(x - 11.5), top = 4 + (dx < 2 ? 2 : 0), bot = dx < 2 ? 9 : 11 - Math.max(0, (dx - 6) * 0.6);
        if (y < top || y > bot) continue;
        b.px(x, y, y === top ? INK[0] : y === Math.floor(bot) ? INK[3] : INK[(x + y) % 5 ? 2 : 1]);
      }
      for (const cx of [7, 16]) { b.rect(cx - 2, 6, 4, 3, O); b.rect(cx - 1, 9, 2, 1, O); b.px(cx - 2, 5, INK[0]); b.px(cx + 1, 5, INK[0]); }
      b.line(3, 6, 1, 4, RED[1]); b.line(20, 6, 22, 4, RED[1]);
      plinth(b, 20, 12, true);
    },
    // the Gilded Ledger: a gold-bound book with its clasp
    party_gold(b) {
      for (let y = 4; y < 19; y++) b.rect(18, y + 1, 2, 1, BONE[(y % 2) + 1]);
      roll(b, 5, 3, 14, 16, BRASS);
      b.rect(5, 3, 1, 16, BRASS[3]); b.rect(6, 3, 1, 16, BRASS[4]);
      b.rect(8, 5, 9, 1, BRASS[0]); b.rect(8, 16, 9, 1, BRASS[3]); b.rect(8, 5, 1, 12, BRASS[0]); b.rect(16, 5, 1, 12, BRASS[3]);
      ell(b, 12.5, 10.5, 2.5, 2.5, RED);
      b.rect(18, 9, 3, 3, TIN[1]); b.px(20, 10, TIN[3]);
      plinth(b, 20, 18, false);
    },
    // the Bane Standard: a crimson banner with a skull, on a pole
    party_bosses(b) {
      roll(b, 6, 2, 2, 19, OAK); b.rect(5, 1, 4, 1, BRASS[1]); b.px(6, 0, BRASS[0]);
      b.rect(6, 3, 13, 1, OAK[1]);
      for (let y = 4; y < 17; y++) for (let x = 8; x < 19; x++) { const notch = y > 13 && Math.abs(x - 13) < y - 13; if (!notch) b.px(x, y, x === 18 || y === 16 ? RED[3] : (x + y) % 7 === 0 ? RED[2] : RED[1]); }
      b.rect(11, 6, 5, 4, BONE[1]); b.rect(12, 10, 3, 1, BONE[2]); b.px(12, 7, O); b.px(14, 7, O); b.px(13, 9, BONE[3]);
      plinth(b, 20, 12, false);
    },
    // Deepest Company: a brass lantern, lit
    party_floors(b) {
      b.rect(11, 0, 3, 1, BRASS[2]); b.px(11, 1, BRASS[2]); b.px(13, 1, BRASS[2]);
      for (let y = 2; y < 6; y++) roll(b, 12 - (y - 1), y, (y - 1) * 2 + 1, 1, BRASS);
      for (let y = 6; y < 16; y++) for (let x = 7; x < 18; x++) {
        const bar = x === 7 || x === 17 || x === 12;
        const glow = Math.hypot(x - 12, (y - 11) * 0.8);
        b.px(x, y, bar ? BRASS[x === 7 ? 1 : 3] : glow < 2 ? [255, 246, 200] : glow < 3.6 ? [255, 210, 110] : [214, 150, 70]);
      }
      b.px(12, 10, [255, 252, 230]); b.px(12, 11, [255, 220, 120]);
      roll(b, 6, 16, 13, 2, BRASS); roll(b, 8, 18, 9, 2, BRASS);
      plinth(b, 20, 14, true);
    },
    // Thick as Thieves: two tankards clinking, foam flying
    party_morale(b) {
      const mug = (x, s) => {
        roll(b, x, 8, 7, 12, TIN);
        b.rect(x, 9, 7, 1, TIN[2]); b.rect(x, 17, 7, 1, TIN[2]);
        b.rect(x, 6, 7, 2, BONE[0]); b.px(x + 1, 5, BONE[1]); b.px(x + 4, 5, BONE[0]);
        const hx = s < 0 ? x - 1 : x + 7;
        for (let y = 11; y < 16; y++) b.px(hx + s * (y === 11 || y === 15 ? 0 : 1), y, TIN[2]);
      };
      mug(4, -1); mug(13, 1);
      for (const [x, y] of [[11, 3], [12, 2], [10, 4], [13, 4]]) b.px(x, y, BONE[0]);
      plinth(b, 20, 18, false);
    },
    // the Shouting Match: a brass speaking-horn on a stand
    party_drama(b) {
      for (let x = 4; x < 20; x++) { const hw = 1 + Math.pow((x - 4) / 15, 2) * 5.5; for (let y = Math.round(9 - hw); y <= Math.round(9 + hw); y++) b.px(x, y, BRASS[y < 9 - hw * 0.4 ? 0 : y < 9 + hw * 0.2 ? 1 : y < 9 + hw * 0.7 ? 2 : 3]); }
      for (let y = 3; y < 16; y++) b.px(20, y, BRASS[y < 7 ? 1 : 3]);
      b.rect(2, 8, 2, 3, BRASS[3]);
      b.line(12, 13, 12, 20, TIN[2]); b.line(12, 20, 8, 20, TIN[2]); b.line(12, 20, 16, 20, TIN[2]);
      plinth(b, 21, 14, false);
    },
    // the Black Flag
    party_pvp(b) {
      roll(b, 5, 1, 2, 20, OAK); b.px(5, 0, BRASS[1]); b.px(6, 0, BRASS[2]);
      for (let y = 2; y < 14; y++) for (let x = 7; x < 21; x++) { const wave = Math.round(Math.sin((x - 7) * 0.55) * 1.2); if (y + wave >= 2 && y + wave < 13) b.px(x, y + wave, x === 20 ? INK[3] : (x + y) % 9 === 0 ? INK[1] : INK[2]); }
      b.rect(12, 5, 4, 3, BONE[1]); b.px(13, 6, O); b.px(15, 6, O);
      b.line(11, 9, 16, 11, BONE[2]); b.line(16, 9, 11, 11, BONE[2]);
      plinth(b, 20, 12, false);
    },
    // Old Guard: a round shield, iron-rimmed, a brass chevron
    // a season theme's own prize: the season's standard, a gold star on a hanging banner (green for a hero, red for a crew)
    theme(b) { standard(b, GREEN); },
    party_theme(b) { standard(b, RED); },
    party_old(b) {
      for (let y = 1; y < 21; y++) for (let x = 2; x < 22; x++) {
        const d = Math.hypot(x + 0.5 - 12, y + 0.5 - 11);
        if (d > 9.6) continue;
        let c = d > 8.4 ? TIN[d > 9.1 ? 3 : 1] : (x - 2) % 4 === 0 ? OAK[3] : OAK[x < 12 ? 1 : 2];
        const v = Math.abs(x + 0.5 - 12), cy = 13 - v * 0.7;
        if (d <= 8.4 && y >= cy - 1 && y <= cy + 1) c = BRASS[y < cy ? 0 : y > cy ? 3 : 1];
        b.px(x, y, c);
      }
      ell(b, 12, 11, 1.8, 1.8, TIN);
      plinth(b, 20, 14, false);
    },
  };

  // a ribbon rosette for an honour: proud ones in a crest colour picked by the honour, teases in a two-tone motley
  const CRESTS = [RED, BLUE, GREEN];
  function hashOf(s) { let h = 2166136261; s = String(s || ""); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function ribbon(b, id, tease) {
    const h = hashOf(id), a = tease ? GREEN : CRESTS[h % 3], c = tease ? BRASS : a;
    for (const [x0, s] of [[10, -1], [14, 1]]) for (let j = 0; j < 12; j++) {
      const x = x0 + s * Math.round(j * 0.35);
      for (let i = 0; i < 3; i++) if (!(j === 11 && i === 1)) b.px(x + i - 1, 14 + j, a[i === 0 ? 1 : i === 2 ? 3 : 2]);
    }
    for (let k = 0; k < 16; k++) {
      const ang = (k / 16) * Math.PI * 2, r0 = 4.6, r1 = 8.4;
      for (let r = r0; r <= r1; r += 0.5) {
        const x = 12 + Math.cos(ang) * r, y = 10 + Math.sin(ang) * r, ramp = tease && k % 2 ? c : a;
        b.px(x, y, ramp[r > 7.6 ? 3 : (Math.cos(ang) + Math.sin(ang)) < -0.4 ? 0 : 1]);
      }
    }
    ell(b, 12, 10, 4.6, 4.6, tease ? BONE : BRASS);
    if (tease) { b.px(11, 9, INK[2]); b.px(13, 9, INK[2]); b.px(11, 12, INK[2]); b.px(12, 12, INK[2]); b.px(13, 12, INK[2]); b.px(10, 11, INK[2]); b.px(14, 11, INK[2]); }
    else { b.px(12, 8, BRASS[0]); b.px(11, 10, BRASS[3]); b.px(13, 11, BRASS[3]); }
  }

  const cache = new Map();
  function grid(kind, id, tone) {
    const key = kind === "honour" ? `honour:${tone}:${hashOf(id) % 3}` : kind;
    if (cache.has(key)) return cache.get(key);
    const b = buf(W, H);
    if (kind === "honour") ribbon(b, id, tone === "tease");
    else (DRAW[kind] || DRAW.mvp)(b);
    outline(b);
    cache.set(key, b);
    return b;
  }
  function canvas(kind, scale, id, tone) {
    const g = grid(kind, id, tone), cv = root.document.createElement("canvas");
    cv.width = g.w; cv.height = g.h;
    const ctx = cv.getContext("2d"), img = ctx.createImageData(g.w, g.h);
    img.data.set(g.d);
    ctx.putImageData(img, 0, 0);
    const k = scale || 2;
    cv.style.width = g.w * k + "px"; cv.style.height = g.h * k + "px";
    cv.className = "trophy-px";
    return cv;
  }
  // the scenes' trophy: drawn at 1x onto a scene canvas, by its foot
  function sprite(kind) {
    const key = "cv:" + kind;
    if (!cache.has(key)) {
      const g = grid(kind), cv = root.document.createElement("canvas");
      cv.width = g.w; cv.height = g.h;
      const ctx = cv.getContext("2d"), img = ctx.createImageData(g.w, g.h);
      img.data.set(g.d); ctx.putImageData(img, 0, 0);
      cache.set(key, cv);
    }
    return cache.get(key);
  }

  // ---------- the scenes' own trophies: drawn small by hand (Ceremony Night holds them up beside 32px heroes), not the keepsake shrunk ----------
  const SP = { Y: BRASS[0], y: BRASS[1], b: BRASS[2], d: BRASS[3], t: TIN[0], T: TIN[1], s: TIN[2], S: TIN[3], w: OAK[0], W: OAK[1], k: OAK[2], K: OAK[3],
    r: RED[0], R: RED[1], e: RED[2], g: GREEN[0], G: GREEN[1], i: INK[1], I: INK[2], j: INK[3], n: BONE[0], N: BONE[1], m: BONE[2], L: LEATHER[1],
    F: [255, 214, 110], f: [255, 248, 210] };
  const PLINTH = ["..wWWbbWWk..", ".KKKKKKKKKK."];
  const SMALL = {
    mvp: ["..YYYYYYYY..", "b.yddddddb.b", "b.yYyyyybb.b", ".bgGRrGgGbb.", "..yYyyyybb..", "...yYyybb...", "....Yybb....", ".....yb.....", "....yYbb....", "...yYyybb...", ...PLINTH],
    party_mvp: ["..tttttttt..", "T.sSSSSSSs.T", "T.tTTTTTss.T", ".TybybybyTs.", "..tTTTTTss..", "...tTTTss...", "....tTss....", ".....Ts.....", "....tTss....", "...tTTTss...", ...PLINTH],
    richest: ["...b.y.b....", "....yYyb....", "....RRRR....", "...yYyyyb...", "..yYYyyyyb..", ".yYyyyyyyyb.", ".yYyyyyyybb.", ".yyyyyyybbYy", "..bbbbbbddyb", ...PLINTH],
    killer: ["wwwwwwwwwwwk", "wtttttttWWWk", "wTkTTTTTLLLk", "wTTTTTTTLLLk", "wTTTTTTTWWWk", "wsssssssWWWk", "wWWWWWWWWWWk", "wWWWybbyWWWk", ".kWWWWWWWWk.", "..kWWWWWWk..", "...kkkkkk..."],
    delver: ["...tttttt...", ".tTTTwkTTTs.", "tT...wk...Ts", "s....wk....s", ".....wk.....", ".....yb.....", ".....wk.....", ".....wk.....", ".....wk.....", ...PLINTH],
    worker: ["...wwwwww...", "...w....k...", "...wwWWkk...", ".....wk.....", ".....wk.....", ".....bd.....", "..tttttTTs..", "..TTTTTTTs..", "..TTTsTTTs..", "...TTsTTs...", "....sTs.....", ...PLINTH],
    stitches: [".........t..", "..wwwwwwtw..", "...rRRRtR...", "...RrRtRe...", "...rRtRRe...", "...RtRRRe...", "...tRRRRe...", "..kkkkkkkk..", ...PLINTH],
    wanderer: ["...ybbbb....", "...yYyYb....", "...yYybb....", "...yYyYb....", "...yYybb....", "...yYyyybb..", "...yYyyyyyb.", "...yYyyyyyyb", "...ddddddddd", ...PLINTH],
    gambler: ["......YYYYY.", "......yIyyb.", "......yyyyb.", ".YYYYYyyyIb.", ".yIyyyybbbb.", ".yyyyyb.....", ".yyyIyb.....", ".yyyyyb.....", ".bbbbbb.....", ...PLINTH],
    ghoul: ["....wWWk....", "...wWWWWk...", "..wWWyWWWk..", "..wWWWWWWk..", "..wbWWWWbk..", "..wWWWWWWk..", "...wWWWWk...", "...wbWWbk...", "...wWWWWk...", "....wWWk....", ...PLINTH],
    brute: ["........tT..", ".......kWWt.", "......tWWWk.", ".....kWWWWt.", "......kWWk..", ".....wk.....", "....wk......", "...wk.......", "..LL........", "..LL........", ...PLINTH],
    villain: ["R..........R", ".RiiiiiiiiR.", "iiiiiiiiiiii", "ijnnjiijnnji", "iiiiiiiiiiii", ".iiiI..Iiii.", ".....TS.....", ".....TS.....", ...PLINTH],
    party_gold: [".dYYYYYYYYn.", ".dyyyyyyyyN.", ".dyYbbbbYyN.", ".dyYbRrbYyNt", ".dyYbeRbYyNT", ".dyYbbbbYyN.", ".dyyyyyyyyN.", ".ddddddddddm", ...PLINTH],
    party_bosses: ["y...........", "kwwwwwwwwww.", "kRRRRRRRRRe.", "kRRnnnnRRRe.", "kRRnjnjRRRe.", "kRRRnNRRRRe.", "kRRRRRRRRRe.", "kRRRe..RRRe.", "kRRe....RRe.", "k...........", ...PLINTH],
    party_floors: [".....bb.....", "....b..b....", "...yYYYYb...", "..yYYYYYYb..", "..ydFFFFdb..", "..yFFffFFb..", "..yFffffFb..", "..yFFffFFb..", "..ydFFFFdb..", "..yyyyyyyb..", "...bbbbbb...", ...PLINTH],
    party_morale: ["....n..n....", ".nnnn..nnnn.", ".NNNN..NNNN.", "stTTs..tTTss", "stSTs..tSTss", "stTTs..tTTss", ".tTTs..tTTs.", ".ssss..ssss.", ...PLINTH],
    party_drama: ["..........Y.", ".........yY.", "........yyYb", "bb....yyyyYb", "bbyyyyYyyyYb", "bb....bbbbbd", "........bbbd", ".........bd.", "..........d.", ".....S......", "....SSS.....", ...PLINTH],
    party_pvp: ["y...........", "kiiiiiiiiiI.", "kiiinnnniiI.", "kiiinjnjiiI.", "kiiiinniiiI.", "kiinIiiniiI.", "kiiiniiniiI.", "kiiiiiiiiiI.", "k...........", "k...........", ...PLINTH],
    theme: [".....yb.....", "..wwwwwwwk..", "..gGGGGGGG..", "..gGGyYGGG..", "..gGyYYbGG..", "..gGGbbGGG..", "..gGGGGGGG..", "..gG.wk.GG..", ".....wk.....", ".....wk.....", ...PLINTH],
    party_theme: [".....yb.....", "..wwwwwwwk..", "..rRRRRRRR..", "..rRRyYRRR..", "..rRyYYbRR..", "..rRRbbRRR..", "..rRRRRRRR..", "..rR.wk.RR..", ".....wk.....", ".....wk.....", ...PLINTH],
    party_old: ["...sTTTTs...", "..TWWWWWWs..", ".TWWWWWWWWs.", "TWWWWyWWWWWs", "TWWWybyWWWWs", "TWWybWbyWWWs", "TWybWWWbyWWs", ".TWWWWWWWWs.", "..TWWWWWWs..", "...sTTTTs..."],
  };
  function scene(kind) {
    const key = "scene:" + kind;
    if (cache.has(key)) return cache.get(key);
    const rows = SMALL[kind] || SMALL.mvp, w = Math.max(...rows.map((r) => r.length)) + 2, h = rows.length + 2, b = buf(w, h);
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (SP[ch]) b.px(x + 1, y + 1, SP[ch]); }));
    outline(b);
    const cv = root.document.createElement("canvas");
    cv.width = w; cv.height = h;
    const ctx = cv.getContext("2d"), img = ctx.createImageData(w, h);
    img.data.set(b.d); ctx.putImageData(img, 0, 0);
    cache.set(key, cv);
    return cv;
  }

  // ---------- the cabinet: every award, honour and Closing Games trophy a hero or crew has kept ----------
  const ORDER = { award: 0, games_trophy: 1, honour: 2 };
  function sorted(entries) {
    return (entries || []).slice().sort((a, b) => (a.season - b.season) || (ORDER[a.kind] - ORDER[b.kind]) || ((a.award === "mvp" || a.award === "party_mvp") ? -1 : 0) - ((b.award === "mvp" || b.award === "party_mvp") ? -1 : 0));
  }
  function tip(x) {
    const val = x.value != null ? ` · ${Number(x.value).toLocaleString("en-US")}${x.unit ? " " + x.unit : ""}` : "";
    if (x.kind === "honour") return `${x.name} · an honour of season ${x.season}${x.tone === "tease" ? " (said with love)" : ""}`;
    if (x.kind === "games_trophy") return `${cap(x.name)}, the Closing Games of season ${x.season}${x.what ? ": " + x.what : ""}`;
    return `${x.name} · season ${x.season}${val}`;
  }
  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  function summary(entries) {
    const n = (k) => entries.filter(k).length, crowns = n((x) => x.award === "mvp" || x.award === "party_mvp"), tro = n((x) => x.kind === "award") - crowns, games = n((x) => x.kind === "games_trophy"), hon = n((x) => x.kind === "honour");
    const part = (k, one, many) => (k ? `${k} ${k === 1 ? one : many}` : null);
    return [part(crowns, "crown", "crowns"), part(tro, "trophy", "trophies"), part(games, "Games trophy", "Games trophies"), part(hon, "honour", "honours")].filter(Boolean).join(", ");
  }
  function item(x) {
    const A = root.App, el = A.el;
    let art;
    if (x.kind === "games_trophy") art = root.GamesReplay ? GamesReplay.trophy(x.event, 2) : A.later(["games_replay"], () => GamesReplay.trophy(x.event, 2));
    else art = canvas(x.kind === "honour" ? "honour" : x.award, 2, x.honour || x.id, x.tone);
    return el("div", { class: `cab-item cab-${x.kind}${x.award === "mvp" || x.award === "party_mvp" ? " cab-crown" : ""}`, title: tip(x), tabindex: "0" },
      el("div", { class: "cab-art" }, art), el("div", { class: "cab-name" }, cap(x.name)), el("div", { class: "cab-season" }, `S${x.season}`));
  }
  // one shelf strip; opts.title for the panel's heading, opts.link a season's Your Season card
  function cabinet(entries, opts) {
    const A = root.App, el = A.el, o = opts || {};
    const list = sorted(entries);
    if (!list.length) return null;
    return el("section", { class: "panel cabinet" },
      el("h2", null, o.title || "Trophy cabinet"),
      el("p", { class: "small muted cab-sum" }, summary(list), o.extra || null),
      el("div", { class: "cab-shelf" }, list.map(item)));
  }

  root.Trophies = { grid, canvas, sprite, scene, cabinet, sorted, summary, tip, KINDS: Object.keys(DRAW), W, H };
})(typeof window !== "undefined" ? window : globalThis);
