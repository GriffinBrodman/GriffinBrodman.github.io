# Koi Pond — review round 1: NOT YET

Scores: koi realism 6, motion 6.5, water & lighting 6, composition 7, cards 8.5, mobile 6, interaction 6.5, polish 7.5, a11y 8, perf risk 6.

Summary: a big step up and the cards are excellent, but someone who owns a real koi pond sees "nice vector koi over a procedural tile":
- round paddle fins and sequin dots
- every fish at one fixed depth, so overlaps look like stacked stickers
- marching schools
- a uniform caustic net, stones that read as bubbles, comma-shaped specks
- no surface reflection

Lily pads and flowers are the best element.

Reviewer screenshots are in koi/review-shots/: d-t10.png, z-koi-sheet.png, feed-sheet.png, p-strip.png, seq-sheet.png, d-t25.png.
Reviewer scripts are in scratchpad/review/.

## Changes, most impactful first

1. **Living depth layers** (Koi, updateFish, drawFish, underwater()).
   - Each koi gets a target depth that changes every 8–20s: `f.depth += (f.depthT - f.depth)*dt*0.3`, range 0.05–0.85.
   - In `underwater()`, depth lowers contrast and saturation (`mix(col, uWater, 0.08+0.75*d)`) and multiplies by `1-0.35*d`.
   - Scale the drawn fish by `1-0.12*d` about its centre.
   - Shadow alpha falls to ~0.25 for deep fish; the offset is fine as is.
   - Draw deep fish so they visibly sit under shallow ones: a half-res target with a 2-tap blur, or alpha bias `1-0.3*d`.
   - Re-sort by depth every frame.

2. **Pectoral fins** (`fin()` and the `fins` spec in `buildFish`).
   - Replace the ellipse with a fan:
     - a straight, opaque, slightly cream leading edge on the forward side, and a convex trailing edge
     - width growing from 0.35 at the root to 1.0 at ~70% length
     - rays radiating from the root (`cos(ang*22)`, low amplitude)
     - membrane alpha 0.75 at the root falling to 0.30 at the tip, with a 1px brighter rim
   - Fold the fins against the body during thrust (~0.35 rad) and spread them to ~1.1 rad when gliding or braking.
   - Give one or two butterfly-style fish longer pectorals (~0.26L).

3. **Sheen instead of sequins** (`body()`).
   - Delete the per-cell glint.
   - Add a soft specular band that slides with turning: `exp(-pow((u-0.45-0.2*sin(uSheen))/0.12,2))*nz`, at 0.15 strength (0.45 for metallic types).
   - Scales become subtle reticulation (sEdge darkening 6–10%) with no bright dots.
   - Keep the metallic types smooth.

4. **Head and anatomy** (`bodyHalfWidth`, `body()`).
   - Wider shoulders: peak half-width ~0.165L at u≈0.30.
   - Thicker caudal peduncle: raise the 0.31 floor to ~0.38.
   - A blunter U-shaped nose for u<0.06.
   - Two short barbel pairs at the mouth corners: 1.2px tapered strokes, ~0.035L long, flesh-coloured, alpha 0.7.
   - Nostril dots at u≈0.05.
   - Eyes that bulge slightly beyond the outline at u≈0.09.

5. **Colour patterns.**
   - Kohaku red becomes crimson: `vec3(0.84,0.17,0.09)` → `vec3(0.68,0.08,0.06)`.
   - Crisp kiwa edges at the rear of red patches, soft sashi edges at the front.
   - Keep red off the lower flanks: weight by `1-smoothstep(0.55,0.85,av)`.
   - Tancho spot: slightly oval and deeper red.
   - Showa and sanke: bigger black that wraps the flanks; on showa it reaches the pectoral roots.

6. **Schooling** (`updateFish`).
   - Alignment 0.22 → 0.05; cohesion 0.12 → 0.04.
   - Add a hover state: ~15% chance, 2–5s at `target=0.08*cruise`, pectorals sculling (paddle ×2), almost no tail beat.
   - Replace the hard `prefer` wall with a soft field so fish can pass under the cards.
   - Desynchronise the swim/glide timers.
   - Some vertical "rise/sink" life comes through depth changes (item 1).

7. **Caustics and floor** (FS_FLOOR, FS_BED).
   - Modulate caustic intensity with `smoothstep(0.3,0.7,fbm(p/600+t*0.01))` so bright patches drift and shady areas stay calm.
   - Caustic gain `0.20-0.09*depth` → `0.13-0.08*depth`.
   - Primary caustic scale p/78 → p/120.
   - Domain-warp the pebble SDF (`r += 0.25*(vnoise(rr*3)-0.5)`) so stones are irregular.
   - Add dark crevice AO between stones.
   - Lit rim `0.92+0.16*lit` → `0.95+0.06*lit`, so stones stop reading as bubbles.
   - Add sparse dark algae streaks.

8. **Surface** (FS_COMP).
   - Remove or heavily damp the `hf*0.05` term in Gs: it causes the white comma specks.
   - Add a slow sky/foliage reflection: `refl=fbm(p/500+G*8+t*0.01)`, `col=mix(col,vec3(0.78,0.86,0.84),0.05+0.07*smoothstep(0.45,0.8,refl))`.
   - Add one soft sun-glint zone near the top right, with small sparkles following the wind normals.

9. **Let the pond show through the cards.**
   - `--paper` to rgba(250,246,236,0.78), with blur 28px and saturate(1.15). Re-verify AA contrast, especially the --ink-3 labels.
   - Add a faint noise texture to the cards so pads under them stop leaving bright smudges.
   - Between 721 and 980px and on phones, `prefer` returns the visible band above the hero card (y < 40vh) so koi swim where they can be seen. Today at 768 only 1–2 koi are visible.

10. **Feeding.**
    - Fish within 1.5L converge and slow.
    - The first one rises to depth 0 and opens a mouth "O" (a dark ellipse at the nose for 0.25s), with a ring ripple and 2–3 droplet glints.
    - Pellets: ~4px, glossy, bobbing.
    - Cap converging fish at 4; the rest hang back.
    - A short separation impulse after a bite, so there is no pile-up.

11. **Detritus and the hint.**
    - Petals 14 → 4 on desktop and 2 on phone; larger and slightly translucent.
    - Fade the `.pond-hint` out after the first feed or after 10s.
    - On phones, put the hint below the hero card instead of over the swimming area.

12. **Performance and robustness.**
    - `bufferSubData` into preallocated buffers.
    - Seeded rng instead of Math.random in the sim, so step() is deterministic.
    - Handle `webglcontextrestored`.
    - Reduce backdrop-filter cost: drop to solid paper at ≤720px or on low-power devices, or reduce work when no card-free pond area is visible.
    - Let `monitor()` raise quality back up after recovery.
