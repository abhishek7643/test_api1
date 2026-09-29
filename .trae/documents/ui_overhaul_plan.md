# UI Overhaul + Visual Bug Fixes Implementation Plan

## Repository Research

**Current state of the site (from file reads + browser snapshot):**
- Bootstrap 5.3.3 shell in `templates/base.html`: dark navbar, `main.container-fluid` with `py-4`.
- Main editor UI at `core/templates/core/index.html`:
  - 2-column layout: `col-lg-3` sidebar (only `d-none d-lg-block`) + `col-lg-9` main panel.
  - Mobile: only an offcanvas "Sidebar" toggle button appears at top of `col-lg-9`.
  - Request builder card: method select + URL input + Send/Save buttons in a row; URL Preview; tabs (Params/Headers/Body/Auth).
  - Response card: status pill, time chip, tabs (Body/Headers), scrollable pre block.
  - Multiple modal forms: Save, Edit Saved, Edit Collection.
- Custom CSS in `static/app.css` (172 lines): sidebar items, method pills, accordion tweaks, response sizing, absolute-positioned `#addCollectionBtn`/`#clearHistoryBtn`.
- Login page `templates/registration/login.html` and Register `accounts/templates/accounts/register.html`: centered card with basic form.

**Issues observed / documented:**
1. **Overlapping elements**: `#addCollectionBtn` and `#clearHistoryBtn` are `position: absolute; right: 0.75rem; z-index: 10;` on `.accordion-header` — but the `.accordion-button` inside uses flex layout with full width, and when the header text expands or badge is present, the badge + absolute button can overlap. Also the header `h2` is `d-flex align-items-center` but accordion-button takes most of the space; the `me-2` margin shrinks the button so text collides with action buttons.
2. **Tabs + response area clipped**: In the snapshot at 740x336 the tablists report "(offscreen)" — the 336px-height viewport and fixed `py-4` main padding causes everything below URL preview to be pushed into overflow with no scroll.
3. **Inconsistent vertical rhythm**: Cards use default `.card-body p-3` but response card uses `.card-body p-0.5` — buttons inside request builder row use `.btn-sm` with 2 different paddings.
4. **Method + URL bar not responsive on narrow widths**: `methodSelect col-md-2` / url `col-md-7` / buttons `col-md-3` break under md (768px). On tablet/phone columns go 100% which is acceptable but leave large gaps. The row has `gap-2 align-items-center mb-2` which is good, but flex-wrap might be missing for very small widths.
5. **3-dot menu (dropdown button) on navbar**: No issue visible right now, but should preserve vertical alignment / sizing consistency on mobile collapse.
6. **No layout min-height for cards**: The response area shows "No response body" without a visual frame. Table inputs inside params/headers tabs can squeeze rows.
7. **Auth config inside the same tab panel can overflow**: Fields in api-key row layout need wrapping on tablet.
8. **Typography**: `body { min-height: 100vh }` but no sticky footer / `:root` font tweaks. Cards have default `.shadow-sm` (login) or no shadow (main editor cards).
9. **Sidebar accordion body hard `max-height: 300px` with `overflow-y: auto`**: Fine, but no visual indication of scrollability.
10. **Mobile offcanvas sidebar**: Button shown, but no guarantee the sidebar content (`#mobileSidebarContent`) is a proper copy of the sidebar panels — should verify app.js actually copies.

## Files and Modules
- `templates/base.html`: global shell (navbar, main padding, root font/style); add modern base styles, fix `body` to use min-height with flex layout so main area fills the viewport.
- `static/app.css`: **Primary edit target**. Add a complete UI overhaul layer: design tokens (spacing scale, radii, shadows), responsive CSS Grid request bar, non-overlapping accordion header layout, sticky response tabs container, auth panel responsive fields, sidebar item refinements, method pill sizing, modal spacing, mobile media queries, overflow guards.
- `core/templates/core/index.html`: Minor structural fixes — replace absolute-positioned sidebar action buttons with proper flex layout, wrap request bar inputs, adjust tabs/card paddings, add sticky header for response area, fix sidebar accordion header markup so badge and buttons don't overlap.
- `templates/registration/login.html`: Minor responsive layout polish — tighten paddings, add shadow, mobile breakpoints.
- `accounts/templates/accounts/register.html`: Same as login + responsive field rows for username/email/passwords.

## Implementation Steps (dependency order)
1. **Global shell + base styles (base.html)**:
   - Convert body to a flex column with min-height 100dvh.
   - Move the 2 inline styles (body + .navbar-brand) into `app.css` or preserve via a `<style>` block in base.html.
   - Ensure `main` fills space and uses sensible max-width on desktop.
   - Preserve navbar color scheme and 3-dot dropdown.

2. **Refactor sidebar accordion header markup (index.html)**:
   - Rework `h2.accordion-header.d-flex` so instead of using `position:absolute` for add/clear buttons we use a proper flex layout: a container wrapping `.accordion-button` + the action button, with `flex:1` on the button and fixed size action button in the same row.
   - Use `gap` on the `d-flex` so badge + action buttons have breathing room, completely eliminating overlap even with long collection names.
   - Move the "collectionsCount / savedCount / historyCount" badges so they don't get clipped.

3. **Rewrite app.css**:
   - **Tokens**: `:root` variables for border-radius scale, shadow scale, spacing, font families.
   - **Global body**: smooth scroll, better `font-family` stack (Inter fallback), `display: flex; flex-direction: column; min-height: 100dvh;`.
   - **Navbar**: consistent vertical padding, `--bs-link-hover-color` so 3-dot dropdown aligns.
   - **Cards**: `.card` { border-radius, box-shadow, border none }, `.card-header` { lighter bg, border-bottom proper radius }.
   - **Request Bar (`#requestBar`)**: On desktop use CSS Grid `grid-template-columns: 140px 1fr auto auto; gap: .75rem; align-items: center;` so method, url, send, save don't squeeze the URL textbox. On `< md` collapse to 2-column grid (method 1fr, url full row, buttons row).
   - **Tabs**: `.nav-tabs .nav-link` active highlight, proper padding.
   - **Builder tables (params/headers)**: fixed column widths so checkbox / delete columns don't collapse, input padding reset so text doesn't overflow.
   - **Auth tab**: Row-based layouts for API Key fields; mobile breakpoint stacks the 3 columns.
   - **Sidebar items**: `min-width: 0` on flex items, `text-overflow: ellipsis` on all children + hover actions positioned without pushing content.
   - **Accordion**: remove `position:relative` + absolute buttons (replaced by flex layout above), smooth scroll on `accordion-body`.
   - **Response area**:
     - Card header `position: sticky; top: 0; z-index: 5;` only within the card.
     - Body/Headers tab scrollable area with `max-height: 50vh;`.
     - Use `overflow-wrap: anywhere;` on the response `<pre>` so long JSON lines don't scroll horizontally endlessly (scroll still available, but line breaks on char boundaries).
   - **Modals**: `max-width: min(560px, 92vw);`, nicer form spacing, `form-select` width: 100%.
   - **Responsive breakpoints** (md < 768, sm < 576): shrink method pill width, collapse request bar, stack form rows, smaller paddings on main (`py-3 px-2`).
   - **No-overlap guard** `.no-overflow { overflow: hidden; }` and `* { box-sizing: border-box; }` (already default in Bootstrap but ensure container elements).

4. **Responsive form pages (login/register)**:
   - Set max-width to `min(440px, 95vw)` with better card padding (p-4 → p-md-5 p-3), shadow.
   - Label + input spacing, mobile-friendly "Create one" link.
   - Register template: the fields iterated via `{% for field in form %}` — type is determined by widget. Ensure each `mb-3` has appropriate sizes.

5. **Browser verification**:
   - Navigate to `/accounts/login/`, `/accounts/register/`, `/` (post-login via manual flow or just check snapshot).
   - Use browser snapshot to confirm:
     - No element reports overlap / offscreen (offscreen is OK for overflow content).
     - Dropdown in navbar (3-dot menu) does not clip.
     - Request bar visible and all inputs aligned.
     - Response tabs visible.

## Dependencies and Considerations
- Relies **only** on Bootstrap 5.3.3 already loaded (CSS + JS bundle). No new libraries.
- All existing features must remain operational: sidebar toggle, request builder rows (app.js inserts row DOM), dropdowns via `data-bs-toggle="dropdown"` (Bootstrap), modals via `data-bs-toggle="modal"`.
- No changes to JavaScript business logic (no app.js logic changes). Only pure CSS/HTML layout changes.
- The `@login_required` on the main index view means unauthenticated visits to `/` redirect to `/accounts/login/?next=/` — so `/` UI won't be seen without login. That's expected and unchanged.

## Validation
1. `python manage.py check` → must return "System check identified no issues".
2. IDE Diagnostics (GetDiagnostics) → 0 errors.
3. Live browser checks:
   - `/accounts/login/` snapshot: no overlap, form centered, 3-dot menu visible and clickable.
   - `/accounts/register/` snapshot: same.
   - Post-login `/` snapshot: request bar visible, tabs visible, sidebar acc buttons do not overlap, response area has visible frame with Body/Headers tabs.
4. CSS manual regression check: confirm no `!important` overrides except on `font-family` where Bootstrap uses `!important`.
5. Resize simulation: manually check CSS rules cover `< md` and `< sm` breakpoints (media queries in app.css).

## Risks
- **Risk 1 — App.js selects items by existing IDs/classes**: Removing `.accordion-button:not(.collapsed)` CSS color changes must not cause JS failures. Mitigation: only *add* CSS classes; do not rename any selectors app.js depends on (`#addCollectionBtn`, `#clearHistoryBtn`, `#collectionsList`, `#savedList`, `#historyList`).
- **Risk 2 — Overhauled accordion headers break JS**: The original header had `#collapseCollections`/etc. targeted by `data-bs-target` — IDs remain on the same elements. Mitigation: leave IDs and data attributes exactly as they are.
- **Risk 3 — Modal CSS rule too broad**: If we set a global `.modal-dialog { max-width: ... }` it constrains future modals unexpectedly. Mitigation: scope rule to existing modals or use `.modal-content` instead and keep sizes inside existing bootstrap grid framework defaults (prefer inline utility classes where possible instead of global overrides).
- **Risk 4 — Sticky response tabs on mobile might stick to navbar**: Mitigation: use `sticky-top: 0` only within a container with `overflow: hidden` or ensure proper z-index layering (navbar has z-index ~1030 by default).
