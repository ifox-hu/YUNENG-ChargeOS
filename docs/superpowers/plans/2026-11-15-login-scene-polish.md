# Login scene polish implementation plan

**Goal:** Implement the login-scene improvements accepted in the conversation: clearer metal rails, quieter directional energy, keyboard scene controls, compact mobile login and adaptive rendering.

**Architecture:** Keep the existing Vue 2 login and self-hosted Three.js r160 scene. Expose pause, reset, focus and completion methods through EnergyScene. No new runtime dependencies. Implement in the current publishing worktree and verify locally before publishing Pages.

**Accepted design:** Preserve the energy-core composition and blue/cyan branding. Add narrow reflection highlights and softer core edges. Reduce scattered particles and give orbital particles a common flow. Slow motion during form focus, show a short success pulse, and retain keyboard pause/reset with no visible scene buttons (user steering). Mobile uses normal document flow and a compact scene that allows touch scrolling. Respect reduced motion, hidden tabs, unavailable WebGL and existing authentication behavior.

## Tasks

- [x] Extend `scripts/test-energy-login.cjs`: pixel ratio bounds; no visible scene buttons, keyboard pause freezes frames, resume and reset work; focus slows animation; reduced motion rests; mobile username visible at 390x844 and scroll gesture works; login/logout/fallback remain usable. Run against the previous build to establish the missing behavior.
- [x] Update `yuneng-admin/src/components/EnergyScene/{index.vue,scene.js}`: renderer lifecycle and controls, input-aware motion, quality tiers, scene materials and particles. Keep disposal complete, including generated environment textures.
- [x] Update `yuneng-admin/src/views/login.vue`: focus/loading/completion integration and mobile grid layout; do not change credentials or authentication semantics.
- [x] Build Pages, run login and coordinate regressions, review desktop and phone screenshots, update README/development guide/screenshots, and prepare the verified release.

## Review focus

- Reduced-motion preference changes during a visit: stop automatic movement and keep explicit controls working.
- Pausing during a pulse or form submission: keep login usable, resolve completion promptly, and do not resume against the user's choice.
- Mobile swipes over the model: scroll normally without model interception.
- Losing the WebGL context or navigating away: stop frames and release listeners, resources and pending completion.
- Saved credentials, captcha refresh, failed login and remount: preserve the existing form behavior.

## Proof

`scripts/build-pages.ps1`, `node scripts/test-energy-login.cjs`, `node scripts/test-demo-station-coordinates.cjs`, focused ESLint, screenshot review, Pages action success and the same login regression against the published URL.

## Verification record

- RED: original build failed the adaptive-resolution test (2 instead of <= 1.5).
- GREEN: login regression passes adaptive canvas, no visible controls, keyboard pause/reset, focused input, drag/inertia/zoom, 1440/1024/820/768/736/390/320 layouts, 390x844 first-screen account, real touch scrolling, reduced-motion changes, login/logout remount and both runtime/context failure fallbacks. No page or shader errors.
- Focused ESLint: 0 errors, 0 warnings. Screenshot capture: 13 current pages, no failed resources, external requests or page errors.
- Ruling: user requested removal of scene buttons during implementation; remove all visible scene controls, retain P/Home keyboard shortcuts and normal phone scrolling.
- Taste skill gate: GATE: OFF (existing Vue app, no armed taste build). Used the existing browser regression and actual desktop/phone screenshots for scoped verification.

## Release procedure

Commit the intended source, docs, screenshots and site assets only; push to master, wait for Pages success, run the same login regression against Pages, and sync targeted source and artifacts to the original workspace.
