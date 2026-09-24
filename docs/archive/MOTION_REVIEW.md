# Motion & Interaction Review — British ProCare

Design-engineering pass over `src/`, applying Emil Kowalski's motion principles (*Animations on the Web*, Sonner, Vaul):

- **Ease-out for anything entering or responding to the user.** `ease` and `ease-in-out` make UI feel sluggish on arrival.
- **Duration scales with distance.** Hover/color = 100–150ms. Panels/drawers = 300–500ms.
- **Animate only compositable properties** — `transform` and `opacity`. Never `letter-spacing`, `filter`, `width`, `height`.
- **Never block the user for the sake of a transition.**
- **Always honour `prefers-reduced-motion`.**

---

## 1. Foundations

| # | Location | Before | After | Why |
|---|---|---|---|---|
| 1 | `globals.css` `@theme` | No easing tokens. `cubic-bezier(0.16, 1, 0.3, 1)` is hand-typed in 8+ places (`template.tsx`, `SplashScreen.tsx`, `login/page.tsx`, 3× in `globals.css`) | Add tokens:<br>`--ease-out: cubic-bezier(0.22, 1, 0.36, 1);`<br>`--ease-out-soft: cubic-bezier(0.32, 0.72, 0, 1);`<br>`--ease-standard: cubic-bezier(0.4, 0, 0.2, 1);`<br>`--dur-fast: 120ms; --dur-base: 200ms; --dur-slow: 320ms;` | A single hardcoded curve applied to everything is why the app reads as "one animation speed". Tokens make the system tunable and enforce the ease-out default. |
| 2 | `globals.css` (everywhere) | `cubic-bezier(0.16, 1, 0.3, 1)` — easeOutExpo. Fires ~90% of its distance in the first third of the timeline | `cubic-bezier(0.22, 1, 0.36, 1)` for UI-scale motion; reserve expo for the splash/login hero only | Expo is a *large-travel* curve. On a 14px card fade it just looks like a snap plus a long tail — motion you pay for in time but don't perceive. |
| 3 | `globals.css` | No `prefers-reduced-motion` block anywhere in the codebase | ```@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; } }``` | Non-negotiable, and doubly so for a clinical tool. `glow-pulse` runs infinitely and `reveal-stagger` fires on every page — both are vestibular triggers today. |

---

## 2. Jarring transitions

| # | Location | Before | After | Why |
|---|---|---|---|---|
| 4 | `app/(dashboard)/template.tsx` | `animation: 'fade-up 0.4s cubic-bezier(0.16,1,0.3,1) both'` — 14px vertical slide on **every** route change | `animation: 'fade-in 0.18s var(--ease-out) both'` with a new opacity-only keyframe (`from { opacity: 0 }`) | This is the single most jarring thing in the app. Every nav — including instant cached ones — pushes the whole page down 14px and floats it back. Distance-based motion on a full page reads as lag, not polish. Opacity-only at ~180ms feels instant but still softens the swap. |
| 5 | `globals.css` `.reveal-stagger` | `0.55s` duration, `nth-child` delays to **330ms**, applied to the dashboard KPI grid and the whole login card | Cap at 3 stagger steps, `0.28s` duration, `40ms` increments, `translateY(6px)` | 880ms before the last KPI settles, on data that was already server-rendered. Stagger is for communicating list ordering — not for gating a metrics grid the user opens 30× a day. |
| 6 | `components/SplashScreen.tsx` | Full-screen overlay hard-gates the app for **3.2s**, exit begins at 2.6s | Reduce to ~1.1s total, add `onClick={() => setShow(false)}` and dismiss on any keypress | A splash the user can't skip is the definition of blocking. Once per session is still 3.2s of a clinician standing at a chairside tablet. |
| 7 | `globals.css` `@keyframes splash-exit` | `to { opacity: 0; visibility: hidden; }` | `to { opacity: 0 }` + `pointer-events: none`, then unmount on `animationend` | `visibility` is a discrete property — it flips at the 50% mark, not on a curve. The overlay swallows clicks for 300ms after it looks gone. |
| 8 | `globals.css` `@keyframes letter-in` | Animates `letter-spacing: 0.35em → 0.12em` | Animate `transform: translateY(10px) scale(0.98) → none` + `opacity` | `letter-spacing` triggers layout on **every frame** — text reflows 60×/sec and the surrounding block jitters. It's the one keyframe in this codebase that can't run on the compositor. |
| 9 | `globals.css` `@keyframes logo-bloom` | `filter: blur(6px) → 0` alongside scale | Drop the blur; keep `scale(0.92) → 1` + `opacity` | Animated `filter` forces a full re-rasterisation per frame. On the low-power tablets this is deployed to, it's a visible stutter right at first impression. |
| 10 | `globals.css` `@keyframes glow-pulse` | `2.4s ease-in-out infinite` on splash + login, unconditional | Keep, but gate behind reduced-motion (#3) and cap the login one to 3 iterations | Perpetual motion in peripheral vision is a persistent low-grade distraction, and it holds the compositor awake on battery. |

---

## 3. Hover, press & focus

| # | Location | Before | After | Why |
|---|---|---|---|---|
| 11 | `components/ui/button.tsx` | `transition-all` on the base variant | `transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out` | `transition-all` tweens *every* animatable property — including `width` and `padding` from the size variants and `opacity` from `disabled:`. Any layout-affecting change gets silently animated, which is where unexplained lag comes from. |
| 12 | `components/ui/button.tsx` | `active:not-aria-[haspopup]:translate-y-px`, tweened by `transition-all` | `active:scale-[0.97] transition-transform duration-75` (or `duration-0` on the active state) | Press feedback must be perceptually instantaneous. A 150ms tween on the down-state is the classic "this button feels unresponsive" bug. `scale` also reads better than a 1px nudge on touch. |
| 13 | ~50 call sites (`transition-colors`, no duration) | Falls back to Tailwind's default: `150ms` + **`ease`** | Add `ease-out` to the shared button classes, or set `--default-transition-timing-function: var(--ease-out)` in `@theme` | `ease` is symmetric — slow start, slow end. Hover states should commit immediately on the way in. One `@theme` line fixes every site at once. |
| 14 | `globals.css` `.card-lift` | `transition: box-shadow 0.3s ease, transform 0.3s ease;` → `translateY(-2px)` | `transition: box-shadow 200ms var(--ease-out), transform 200ms var(--ease-out);` | 300ms `ease` on a 2px move means the card is still settling well after the cursor has moved on. Distance is tiny — duration should be too. |
| 15 | `components/SidebarNav.tsx` | Active indicator bar is conditionally rendered — it **pops** in/out with no transition, while the row itself uses `transition-all duration-200` | Render the bar always with `scale-y-0 → scale-y-100 opacity-0 → opacity-100`, `transition-transform duration-200 ease-out`; swap `transition-all` for `transition-colors` | Half the element animates and half snaps. The mismatch is what makes nav changes feel unfinished. |
| 16 | `components/DeleteButton.tsx` | `transition-all`; label swaps `"Delete"` → `"Confirm delete?"`, so the button **jumps width** mid-transition | `transition-colors duration-150 ease-out` + a `min-w-[8.5rem]` sized to the longer label | A destructive control that resizes under the cursor invites mis-clicks. Reserve the space; animate only colour. |
| 17 | `reception/steps/StepVisit.tsx:237` | `className="text-ink/40 transition-transform ${showChart ? 'rotate-180' : ''}"` | `transition-transform duration-200 ease-out` | Inherits the default `ease` — the chevron drifts into place rather than tracking the disclosure. |

---

## 4. Drawer & loading states

| # | Location | Before | After | Why |
|---|---|---|---|---|
| 18 | `components/AppShell.tsx:72` | Panel: `transition-transform duration-300 ease-out`. Backdrop: conditionally rendered, **no transition at all** | Panel `duration-400` with `cubic-bezier(0.32, 0.72, 0, 1)`; backdrop always mounted with `opacity-0/opacity-100 transition-opacity duration-300` | The backdrop hard-cuts to black while the panel is still travelling — the two halves of one gesture disagree. That Vaul curve exists precisely for full-height sheets: fast commit, long soft settle, no overshoot. |
| 19 | `components/AppShell.tsx:72` | The drawer is in the DOM on desktop with `md:translate-x-0` and a live transition | Add `md:transition-none` | On a viewport resize across the `md` breakpoint the sidebar visibly slides in from off-screen — a transition firing on a layout change, not a user action. |
| 20 | `LabelSheet.tsx:122`, `GalleryGrid.tsx:45` | `animate-pulse` — Tailwind's `opacity: 1 → .5` on `cubic-bezier(0.4, 0, 0.6, 1)` | Custom: `opacity: .65 → 1`, `1.6s ease-in-out infinite` (or a `translateX` shimmer) | Tailwind's pulse has too much contrast swing; a grid of them flickers. A skeleton should read as "pending", not blink. |
| 21 | `PatientReportButton.tsx`, `DentalChart.tsx` | Icon swaps instantly to `Loader2` and instantly back | Enforce a ~350ms minimum visible duration on the spinner | Sub-100ms server actions flash the spinner for a single frame. A strobe is worse feedback than none — a floor turns it into a legible state change. |

---

## Suggested order

1. **#3** — reduced-motion block. One paragraph, removes the accessibility gap entirely.
2. **#4, #5, #6** — the page-transition slide, the stagger delays, and the splash gate. Biggest perceived-speed win in the app.
3. **#1, #13** — tokens + the `@theme` easing default. Corrects ~50 call sites in two lines.
4. **#8, #9** — the two non-compositable keyframes.
5. Everything else as polish.
