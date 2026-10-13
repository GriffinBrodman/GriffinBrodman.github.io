# web/js/

| File | Purpose |
|------|---------|
| `art.js` | Pixel-art engine: paper-doll heroes, monsters, pets, party banners, class-path emblems, items, graves |
| `paint.js` | Shaded pixel painter (material/shade/layer buffers, hue-shifted ramps, dither, inner outlines) and hero bust portraits |
| `beasts.js` | Shaded monster sprites for the non-humanoid bodies (quadrupeds, spiders, dragons, golems, kraken...) |
| `anim.js` | Ambient pixel animation: one shared, visibility-gated ticker (`Anim.stage`) and small looping actors (villagers, birds, bats, skeletons, torches, smoke, snow, waves...) that any scene can reuse; API listed at the top of the file |
| `scenes.js` | Daylight backdrops by biome and story vignettes, brought to life with `Anim` actors chosen per place |
| `tavern.js` | Isometric pixel rooms: the shared stage, actor, speech-bubble and loop helpers; `Tavern.inn` (the common room for any cast) and `Tavern.scene`, the preseason tavern on the Crier (lines from `league.voice.tavern_chatter`) |
| `camp.js` | Tonight, on the hero page: the hero at the end of today by a campfire, on a dungeon floor, in a cell, the stables, a rented room, a home or the inn's common room, with partymates and pets talking (lines from `league.voice.night_lines` via the `tonight` export) |
| `isle.js` | World map: terraced island in oblique view with cliffs, river and falls, towns, dungeons, labels, heroes |
| `app.js` | Data access, DOM helpers, sprite helpers, event feed, router, "my hero" pinning |
| `views.js` | Pages: Crier, roster, hero, parties, party, map, digest, world, history, guide, finale, songs |
| `replay.js` | Animated fight replays |
| `quiz.js` | Join quiz with live preview and hero-code output |
| `audio.js` | All sound, synthesised with WebAudio: page ambience, scene ambience for the hero page's tonight scene, UI and fight effects, the bard's sung songs, sound settings |

## Load order (`web/index.html`)

Plain `<script>` tags, no modules and no build step, so everything works from `file://`. Order matters:

1. `data/static.js`, `data/league.js` (written by `league/export.py`): fill `window.LD.static` and `window.LD.league`. Per-hero, per-party and per-fight files (`data/hero/<id>.js` and so on) are loaded on demand by `App.load`.
2. `audio.js` (defines `Sound`; uses only WebAudio), `art.js` (`Art`), `paint.js` (`Paint`), `beasts.js` (`Beasts`), `anim.js` (`Anim`), `scenes.js` (`Scenes`), `tavern.js` (`Tavern`), `camp.js` (`Night`, after `tavern.js`), `isle.js` (`Isle`). These reference each other only inside functions (`Art` calls `Paint` and `Beasts` when drawing, `Scenes` calls `Isle` and `Anim`, `Night` calls `Tavern` and, when present, `Anim`), so the order among them is not load-critical, but all must load before `app.js`.
3. `app.js` (`App`; reads `LD`, builds lookup tables, registers nothing yet), `views.js` (registers the main routes with `App.route`), `replay.js` (`#/fight/<id>`), `quiz.js` (`#/join`).
4. The inline `App.start()` runs the router, so every route must be registered before it.

Each file is one IIFE that publishes one global. Files only use globals defined above them, except `Sound`, which `app.js` and `replay.js` guard with `window.Sound`.

## Globals

| Global | Defined in | What it is |
|--------|-----------|------------|
| `LD` | `data/*.js` | Exported game data: `LD.static` (map, goods, monsters, classes, factions, quiz) and `LD.league` (current state). Never written by the site |
| `App` | `app.js` | `el`, `esc`, `plural`, `cap`, sprite helpers (`heroSprite`, `heroPortrait`, ...), `heroLink`/`partyLink`, `eventRow`/`feed`, `load` (fetch a detail file), `mine` (pinned hero), `route`, `start`. Also `App.L`, `App.S`, and `heroes`/`parties`/`events` lookup tables by id |
| `Art` | `art.js` | Low-level `Grid`, colour ramps, `hash`/`rng` for deterministic art, hero/monster/pet/banner/item sprites |
| `Paint` | `paint.js` | Shaded painter and `portraitGrid` (bust portraits) |
| `Beasts` | `beasts.js` | `draw(body, pal, frame, boss, palette)` for non-humanoid monsters; called from `Art.monsterGrid` |
| `Anim` | `anim.js` | `stage(canvas, base, actors, opts)` plus actor factories (`villager`, `bat`, `torch`, `snow`...); every actor is a pure function of time. Respects `prefers-reduced-motion` |
| `Scenes` | `scenes.js` | `backdrop`, `vignette`, `locKind`, plus `drawMap` and `nearestNode` that forward to `Isle`. The canvases it returns animate themselves once on screen (the place is recognised from the seed `Art.hash(id)`) |
| `Isle` | `isle.js` | The map renderer: `drawMap`, `nearestNode`, `project`, terrain props |
| `Tavern` | `tavern.js` | `scene` (preseason), `inn`, and the shared `stage`, `actor`, `talk`, `loop` helpers used by `camp.js` |
| `Night` | `camp.js` | `scene(h, L)`: the hero page's tonight panel from `h.tonight`, or `null` |
| `Sound` | `audio.js` | `sfx`, `setPage` (ambience per route), `scene` (a visible scene's own ambience: camp, inn, room, stable, dungeon, cell), `playSong`/`stopSong`, `syllables`, settings |

## Pages and who owns them

| Route | File | Notes |
|-------|------|-------|
| `#/` (Crier) | `views.js` | Weather strip, hyper-event banner, headline, finale panel, tables of heroes/parties/bonds, songs panel, mini map |
| `#/roster`, `#/hero/<id>/<tab>` | `views.js` + `camp.js` | Tonight scene above the tabs; hero page tabs: story (with dirge for the dead), diary, character, people, record; reputation, artifact and faction panels |
| `#/parties`, `#/party/<id>` | `views.js` | |
| `#/map/<node>` | `views.js` + `isle.js` | Side panel: town ledger, civic panel (ruler, edict, Watch), node details |
| `#/digest/<season>/<week>` | `views.js` | Weekly digest |
| `#/world` | `views.js` | Factions and legendary figures |
| `#/history` | `views.js` | Seasons, memorial, artifacts panel |
| `#/songs/<id>` | `views.js` | Songbook and the bard's karaoke stage (uses `Sound.playSong`) |
| `#/guide`, `#/finale/<season>` | `views.js` | |
| `#/fight/<id>` | `replay.js` | Animated replay of a stored fight log |
| `#/join` | `quiz.js` | Quiz; its output is the hero code that `league/heroes.py` decodes |

Rules: the site only renders `LD`; it never computes game state. Anything shown must be exported by `league/export.py` first, and secret faction membership is already stripped there. Do not rename an exported field without changing both sides.
