# Koi Pond — review round 3: NOT YET (very close; one polish pass)

Scores: realism 8, motion 8, water 8, composition 8.5, cards 8.5, mobile 8, interaction 7.5, polish 8, a11y 8.5, perf 7.

AA was measured numerically and passes comfortably: ink-3 is 6.1–6.4:1 and ink-2 is 6.7–7.0:1 against the sampled backdrop, which is about #d8d9cd (greige).

Reviewer shots are in koi/review-shots/r3/: feed-sheet.png, z-koi-sheet.png, seq-sheet.png, z-full.png, p-strip.png.

1. **Feeding knot** (updateFish separation). All feeders go to depthT=0, so the layer exemption no longer applies, and R for feeders (0.45) is too tight. The two tancho cross into an X.
   - When both fish are feeding: R=(f.L+o.L)*0.55 with full weight.
   - Body-capsule check: if either fish's head is within 0.35·L of the other's spine joints 2–8, push it perpendicular to that spine (weight 2.0).
   - Feeder depth targets 0.0, 0.08 and 0.16 by rank, so one sits visibly over another.
2. **Tube bodies** (bodyHalfWidth). The yamabuki and showa read as constant-width tubes with a squared head.
   - Head taper: about 0.70 of peak at u=0.06 and 0.90 at u=0.15.
   - Peak at u≈0.32.
   - Peduncle 0.30.
   - Superellipse nose with exponent ~1.8 instead of the flat front.
   - Widest just behind the pectorals, with a visible taper after.
3. **Card tint.** Use `--paper: rgba(252,247,236,0.90)` or add sepia(0.12) to the backdrop-filter. The target sampled colour is about #e9e4d6, and there is ~1.5:1 of contrast headroom.
4. **Glint smears** (FS_COMP spark). The large sparkles are 30px white smudges.
   - Exponent 14 and length factor 20, so they become tight points capped at 2–3px.
   - Add a short twinkle: hash(floor(t*6)+cell).
5. **Pebble polka dots** (FS_BED).
   - Halve small-pebble density in open areas.
   - Cluster pebbles along boulder skirts with an fbm(p/260) mask.
   - Radius 0.5x–1.5x.
6. **Caustics on phones.** When W<560, caustic gain ×0.8 and cell scale ×1.2.
