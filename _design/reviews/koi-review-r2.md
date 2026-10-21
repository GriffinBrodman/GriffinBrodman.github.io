# Koi Pond — review round 2: NOT YET (but close)

Scores: koi realism 7.5, motion 7.5, water & lighting 6, composition 8, cards 7.5 (they went grey), mobile 8, interaction 7.5, polish 7.5, a11y 8, perf 6.5.

The koi now look like koi, and depth, mobile and schooling all work. What still holds it back is the light: the pond is dim, grey and murky, with almost no sun or caustic shimmer. The floor reads as a flat paver mosaic, and the cards turn sage-grey over it. One lighting and grading pass should tip it over.

Reviewer shots are in koi/review-shots/r2/: d-t25.png, z-full.png, feed-sheet.png, p-strip.png, seq-sheet.png (the chimera overlap).

1. **Bring the sun back** (FS_FLOOR).
   - Caustic mask `(0.08+0.92*patchy*patchy)` → `(0.35+0.65*patchy)`.
   - Caustic gain `(0.13-0.08*depth)*1.5` → `(0.20-0.10*depth)*1.5`.
   - Base light `(0.40+0.62*light)` → `(0.50+0.65*light)`.
   - Shallow water `vec3(0.10,0.34,0.32)` → `vec3(0.13,0.36,0.30)`.
   - The goal is a sunlit pond with bright, slow light webs in sunny patches.
2. **Remove the grey veil** (FS_COMP).
   - Reflection mix → `0.0 + 0.08*smoothstep(0.55,0.85,refl)`, so it shows only as drifting patches.
   - Vignette 0.55 → 0.40.
   - Sun-glint zone and sparkles about 1.5x stronger.
3. **Floor** (FS_BED).
   - The pebbles are uniform flat polygons and read as terrazzo. Widen the size distribution: fewer small stones, plus a few boulders 2–3x larger with darker edges and an occlusion skirt.
   - Fade pebbles into smooth silt and algae in deep areas (mix by depth).
   - Cut mid-pebble contrast by about 40% so the fish stay the subject.
4. **Cards back to warm cream.**
   - `backdrop-filter: blur(28px) saturate(1.2) brightness(1.12)`, or alpha 0.84 with a warmer `rgba(251,246,234,…)`.
   - Recheck AA for --ink-3.
5. **Metallic koi stay radiant.**
   - For uType 3–5, halve the desaturation and water mix in `underwater()` and keep the sheen visible at depth. Gold goes khaki at mid depth today.
   - Keep koi heads out from under lily pads: no hovering under a pad. A gold koi parked under a pad with only its head showing reads as a turtle.
6. **Stop chimera overlaps.**
   - Cross-layer separation factor 0.25 → 0.55.
   - If bodies overlap and |Δheading| < 0.5, steer the shallower fish 0.3 rad away. A deep fish aligned under a shallow one looks like one fish with two heads.
7. **Feeding finish.**
   - Approach from distinct angles: offset each feeder's target by ±0.4·L perpendicular to its approach until it is within 0.6L. Today they knot into white bodies with their heads together.
   - Mouth "O" about 1.5x larger and darker.
   - A brief bright surface bulge (crest highlight) at each bite.
   - Droplets about 2x brighter.
   - Turn rate near food 3.0, so the last pellet isn't left milling for 2s.
8. **Swim energy.** In swim mode, `ampT = L*(0.03 + 0.055*thrust)`, so the tail beat reads at a glance.
9. **Desktop edge hugging.** No hover mode within 60px of the card edge, so koi don't park half under the card.
10. **Performance.**
    - About 15 draw calls per fish: consider batching fins and barbels into one strip with uPart as a vertex attribute.
    - On phones, consider a 0.75x-resolution composite or skipping the reflection fbm.
