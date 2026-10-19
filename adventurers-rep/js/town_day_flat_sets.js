/* The street seen side-on: a row of house fronts in the town's own look, a kerb and the road along the bottom, a handcart, a bench, washing across, a lamp; the flat camera of town_day_flat.js. */
(function (root) {
  "use strict";
  const R = Math.round;
  const K = () => root.TownSets.kit;

  // a handcart with a barrel and a sack in it, its wheel to the viewer
  function handcart(k, x, y) {
    const { shade } = K(), wd = "#8a6038";
    k.prop(y, (c) => {
      c.fillStyle = shade(wd, -0.4); c.fillRect(x - 14, y - 9, 30, 2); c.fillRect(x + 15, y - 12, 10, 1);
      c.fillStyle = wd; c.fillRect(x - 14, y - 16, 28, 7); c.fillStyle = shade(wd, 0.2); c.fillRect(x - 14, y - 16, 28, 1);
      for (let i = 0; i < 4; i++) { c.fillStyle = shade(wd, -0.3); c.fillRect(x - 14 + i * 9, y - 16, 1, 7); }
      c.fillStyle = "#6a4a2a"; c.fillRect(x - 8, y - 25, 9, 9); c.fillStyle = "#3a3a40"; c.fillRect(x - 8, y - 23, 9, 1); c.fillRect(x - 8, y - 19, 9, 1);
      c.fillStyle = "#c8b080"; c.fillRect(x + 3, y - 22, 8, 6); c.fillStyle = "#a89060"; c.fillRect(x + 4, y - 23, 6, 1);
      const cx = x - 2, cy = y - 6;
      for (let a = 0; a < 24; a++) { const t = (a / 24) * Math.PI * 2; c.fillStyle = "#3a2414"; c.fillRect(R(cx + Math.cos(t) * 6), R(cy + Math.sin(t) * 6), 1, 1); }
      c.fillStyle = "#5a3a1e"; for (let a = 0; a < 4; a++) { const t = (a / 4) * Math.PI; for (let d = -5; d <= 5; d++) c.fillRect(R(cx + Math.cos(t) * d), R(cy + Math.sin(t) * d), 1, 1); }
      c.fillStyle = "#2a1a10"; c.fillRect(cx - 1, cy - 1, 2, 2);
    });
  }
  // washing on a line strung between two upper windows, the cloths swaying
  function washing(k, x0, x1, y) {
    const cols = ["#f4f0e4", "#c84a3a", "#4a7ab0", "#e8d8a0", "#f4f0e4", "#6a9a5a"];
    k.overs.push((c, t, still) => {
      for (let x = x0; x <= x1; x++) { const s = (x - x0) / (x1 - x0); c.fillStyle = "#3a2a1a"; c.fillRect(x, R(y + Math.sin(s * Math.PI) * 5), 1, 1); }
      for (let i = 0; i < cols.length; i++) {
        const s = (i + 0.7) / (cols.length + 0.4), x = R(x0 + s * (x1 - x0)), yy = R(y + Math.sin(s * Math.PI) * 5) + 1, sw = still ? 0 : R(Math.sin(t * 2.2 + i) * 1.2), h = 6 + (i % 3);
        c.fillStyle = cols[i]; c.fillRect(x, yy, 5, h); c.fillRect(x + sw, yy + h, 5, 1);
        c.fillStyle = "rgba(0,0,0,0.15)"; c.fillRect(x + 4, yy, 1, h);
        c.fillStyle = "#8a6a4a"; c.fillRect(x + 1, yy - 1, 1, 2); c.fillRect(x + 3, yy - 1, 1, 2);
      }
    });
  }

  root.TownFlat.register("street", (k) => {
    const { GY, W, H } = k, { pix } = K();
    k.sky(40);
    const doors = k.houses(-6, W + 6, GY - 1, { signs: { 1: "boot", 3: "loaf", 4: "key" } });
    k.ground();
    washing(k, 40, 92, 22);
    // a cat asleep on a sill, a dog on a doorstep
    const d0 = doors[0] != null ? doors[0] : 30;
    k.prop(GY + 1, (c) => pix(c, d0 + 7, GY - 4, ["..x....x", "..xx..xx.", ".xxxxxxxx", "xxxxxxxxx"], { x: "#6a4a2a" }));
    k.bench(26, GY + 7, 22);
    k.barrel(150, GY + 6); k.barrel(160, GY + 7); k.crate(142, GY + 9);
    handcart(k, 170, GY + 22);
    k.lampPost(60, GY + 8);
    // townsfolk keep to the kerb and the far side of the road
    k.npc = { kind: "local", name: null };
    const door = doors.find((d) => d > 80 && d < 130) || 100;
    k.spot("act", 96, GY + 22, -1); k.spot("walk", 96, GY + 22, -1);
    k.spot("in", W + 10, GY + 24, -1);
    k.spot("door", door + 2, GY + 6, -1);
    k.spot("bench", 26, GY + 6, 1, "sit");
    k.spot("cart", 150, GY + 24, 1); k.spot("crate", 136, GY + 12, 1);
    k.spot("mate", 112, GY + 22, -1); k.spot("other", 74, GY + 22, 1); k.spot("pet", 84, GY + 30, 1);
    k.spot("npc", door - 12, GY + 6, 1);
    k.crowd([[40, GY + 12, 1], [128, GY + 9, -1], [178, GY + 11, -1]]);
    // passers-by keep to the far kerb, behind whatever the hero is doing
    k.walk([[[-12, GY + 8], [W + 12, GY + 8]], [[W + 12, GY + 11], [-12, GY + 11]]]);
  });
})(typeof window !== "undefined" ? window : globalThis);
