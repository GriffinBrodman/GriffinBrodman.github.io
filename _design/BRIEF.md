# Brief: griffinbrodman.com — high-fidelity build

Griffin Brodman's new personal site. A single-page personal hub ("Direction D") plus a 404 page.
Two competing visual styles are being built to production quality: **Koi Pond** and **Arcane**.
These are not mockups: they are the real, shippable static site (GitHub Pages, plain HTML/CSS/JS, no build step, no frameworks).

## Output (per style)
Folder: `/tmp/claude-0/-home-user-GriffinBrodman-github-io/a4ce9ba0-dc29-5a50-8bdd-312aa76c5d90/scratchpad/hifi/<style>/`
- `index.html`: the home page
- `404.html`: the 404 page
- `assets/` (optional): CSS/JS split out if you like. All JS/CSS must be local files or inline.
- External requests allowed ONLY to Google Fonts (`fonts.googleapis.com` / `fonts.gstatic.com`). No CDNs, no analytics, no images from the web.
- Images: none are available yet. Headshot and painting photos are tasteful designed placeholders (not grey boxes with "[PLACEHOLDER]"). Make them easy to swap: `assets/headshot.jpg`, `assets/mini-1.jpg`… referenced in HTML with a graceful fallback when the file is missing (e.g. `onerror` hides the img and shows the designed placeholder).

## Content (exact; do not invent facts, numbers, quotes or projects)
- Name: **Griffin Brodman**. The name MUST be set in **Bree Serif** (Google Fonts). This is a private easter egg (the font of his 2014 site). Do not explain it anywhere on the page.
- Tagline: "Engineering leader. I like startups, scaling them, and fixing whatever crops up along the way." (light edits ok; he also says he likes building autonomous teams and is mentorship/coaching-focused)
- Location: Buffalo, NY.
- Links:
  - Email: griffinbrodman@gmail.com, but the address must NOT appear in the HTML source as plain text or a plain mailto. A button "Email me" assembles it in JS on click (e.g. from reversed/split parts), reveals it with a mailto link and a "Copy" button (Clipboard API, label changes to "Copied").
  - LinkedIn: https://www.linkedin.com/in/griffinbrodman
  - GitHub: https://github.com/GriffinBrodman
  - Mentoring: MentorCruise (use https://mentorcruise.com/ as a placeholder href, add a TODO comment for his profile URL)
  - Instagram (miniature painting): https://www.instagram.com/p/C_dSvOFOVC8/ (TODO comment: swap for his profile URL)
- **Now** (must never need updating): Engineering Lead for Core at Apollo.io: Rep Experience, Controls, Deliverability and Warm Outbound. Also coaches engineering managers on MentorCruise.
- **Before**:
  - Apollo.io, 2021–present: Engineering Lead, Core · Engineering Manager II, Search & Discovery · Engineering Manager, Prospecting & Chrome Extension
  - Barracuda FX, 2021: Senior Engineering Manager, led an engineering team of nine on the flagship dealer-to-customer product
  - Broadway Technology, 2016–2021: Software Development Consultant building trading systems in Python and C++, then Senior Software Engineering Manager
  - Riot Games, 2015: Development Management Intern
- **Painting desk**: "Currently painting the Thousand Sons." with 3 photo placeholders and a link to Instagram. (No "now playing" etc. — he does not want anything that needs updating.)
- Footer: Buffalo, NY · © 2026 Griffin Brodman. NO link to any archive / old site.
- No headshot yet: designed placeholder.

## 404 page
"Confess your sins to the Helix Fossil." (Twitch Plays Pokémon reference; his 2014 app.) A drawn Helix Fossil (an ammonite-like spiral shell; draw it in SVG/canvas, no images), a textarea "Your confession", a Confess button. On confess: the response "The Helix Fossil has forgiven you." plus a link home. Also a "skip the confession and go home" link. Nothing is sent anywhere. Styled in the same visual language as its style's home page.

## Quality bar (non-negotiable)
- Production quality, jaw-dropping craft. Think Awwwards-level polish but restrained and tasteful; a senior engineering leader's site that hiring managers and peers will see.
- Responsive: flawless at 390px (phone), 768px and 1440px. No horizontal scroll. Touch targets ≥ 44px.
- Accessible: semantic HTML, real buttons/links, visible focus states, WCAG AA text contrast, alt text / aria-hidden on decoration, labels on inputs.
- `prefers-reduced-motion: reduce` → animations stop or become static, still beautiful.
- Performance: 60fps on a laptop; pause animation when tab hidden (`visibilitychange`) and when the canvas is off-screen (IntersectionObserver); cap devicePixelRatio at 2; no layout thrash. Page weight small (fonts aside).
- Animation must never make text hard to read. Content is the point; the animation is the delight.
- Meta: title, description, theme-color, Open Graph tags, an inline SVG favicon in the style.

## Verifying your work
Chromium + Playwright are preinstalled (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`; do not run `playwright install`). Use node or python Playwright (check what is installed; `npm i playwright` in a scratch dir under the scratchpad is fine if needed, with PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1, or launch with executablePath `/opt/pw-browsers/chromium`-style path found via `ls /opt/pw-browsers`). Serve the folder with `python3 -m http.server` (pick a free port) and take screenshots at 1440×900, 768×1024 and 390×844, several frames over time for animations (e.g. t=0.5s, 2s, 4s, 8s), and a scroll-down capture. Look at your screenshots with the Read tool. Google Fonts may not load in the sandbox; that's fine, but check fallback stacks look decent. Put screenshots in `<style>/shots/`. Check the browser console for errors.
