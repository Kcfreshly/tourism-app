# Explore link state: root cause and fix

November 2026. Covers why Explore lost a traveller's search, what changed, and
how it is tested. A separate report of the home page "scrolling sideways" is
at the end; it was not an app bug.

## The symptom

A traveller filters Explore (for example **Nature** and the search "garden"),
opens an experience, maybe starts booking, then comes back. Explore opened
empty: no category, no search, top of the list.

## Root causes

There were three separate faults. Any one of them was enough to lose the search.

### 1. The back link on the experience page was hard-coded

`src/app/experiences/[slug]/page.tsx` rendered:

```tsx
<Link className="back-link" href="/explore">Things to do</Link>
```

The experience page had no way to know which Explore view the traveller came
from, so "← Things to do" always went to plain `/explore`. Booking happens on
the same page (`?book=1`), so it had the same problem.

### 2. Browser Back replayed a stale first render

Explore already copied most filters into the address with
`window.history.replaceState`, so the URL looked right while browsing. Browser
Back still lost them. Two things combined:

- **Wrong history state.** The code called
  `replaceState(window.history.state, …)`. That object is Next.js's own
  internal state (it carries `__NA: true`). Next.js patches `replaceState` and
  skips its bookkeeping for calls carrying its own marker, so the router never
  learned the address had changed.
- **Initial state taken from server props.** `CatalogueBrowser` built its
  starting filters from the `initial` prop, which the server page passes from
  its `searchParams`. On Back, Next.js reuses the cached server render of the
  page as it was first loaded: `/explore` with no filters. The component
  mounted with empty filters, and its URL-sync effect then wrote that empty
  state over the address bar. The filters were not just missing; they were
  erased.

A history trace in a real browser showed the correct address
(`/explore?category=nature`) just before leaving the page, and `/explore` after
returning. That pointed at the remount, not the departure.

### 3. Some filters never reached the address

Search text, **Length** and **Wheelchair access** were kept only in component
state. Even when everything else worked, a typed search was lost on reload or
return.

## The fix

### The address is the single record of where the traveller is in Explore

New module `src/modules/catalogue/domain/explore-link.ts`:

| Function | Purpose |
|---|---|
| `exploreQuery` / `exploreHref` | Turn the filter state into a stable query string. Every filter is included: `category`, `q`, `date` or `from`/`to`, `price`, `family`, `arrival`, `area`, `kind`, `access`, `view`, `trip`. |
| `cardAnchor` | The id a results card carries (`exp-<seedKey>`), so a return link can scroll to it. |
| `withBack` | Adds `back=<explore address>#<card anchor>` to an experience link. |
| `safeExploreHref` | Validates a `back` value. Only `/explore`, `/explore?…` or `/explore#…` is accepted; anything else (another site, `//host`, `/explorer`, backslashes, spaces) falls back to `/explore`. This stops the parameter being used as an open redirect. |

### Changes per file

- **`src/components/catalogue-browser.tsx`**
  - Starting filters come from the live address via `useSearchParams()`, not
    from the server props. On Back the address is correct even when the replayed
    server render is not, so the component restores the right view.
  - All filters, including search, length and access, are written to the
    address with `replaceState(null, "", here + hash)`. Passing `null` lets
    Next.js record the new address (as its docs show). Replacing rather than
    pushing means typing a search never adds history entries.
  - Results cards get an `id` anchor, and the "Book for <day>" link carries
    `back=`.
- **`src/components/experience-overlay.tsx`**: when opened on `/explore`, the
  overlay's **Choose date** and **Open in new tab** links carry `back=`.
  Opened anywhere else, links stay plain.
- **`src/app/experiences/[slug]/page.tsx`**: the back link uses
  `safeExploreHref(back)`.
- **`src/app/explore/page.tsx`**: accepts the new `q`, `kind` and `access`
  parameters.

### Returning to the card

The back link ends in `#exp-<seedKey>`. Next.js scrolls to that id on
navigation, and the existing `scroll-padding-top` on `html` keeps the card
clear of the fixed header. The URL sync keeps the hash, so changing a filter
afterwards does not drop it.

## The flow after the fix

```
/explore?category=nature&q=garden          (filters written as they change)
  │ open card → Choose date
  ▼
/experiences/gardens?book=1&back=%2Fexplore%3Fcategory%3Dnature%26q%3Dgarden%23exp-gardens
  │ "← Things to do"               │ browser Back
  ▼                                ▼
/explore?category=nature&q=garden#exp-gardens    /explore?category=nature&q=garden
  filters restored, scrolled to the card          filters restored from the address
```

## How it is tested

| Test file | Covers |
|---|---|
| `tests/explore-link.test.ts` | Query building, range handling, encoding, anchors, `withBack`, and the `safeExploreHref` allow/deny list. |
| `tests/explore.test.tsx` | Every filter written to and restored from the address; anchor kept; card and overlay links carry `back=`; starting from the live address over a stale server render; all date modes, empty states, Bucket view and tray. |
| `tests/explore-page.test.tsx` | The Explore route (filters, trip, unknown city, catalogue failure) and the experience page back link, safe and unsafe. |
| `tests/experience-overlay.test.tsx` | Overlay behaviour: close and focus return, sessions, events, photos, Tab trap, backdrop click, add-to-trip. |

Coverage: `explore/page.tsx`, `catalogue-browser.tsx` and `explore-link.ts` at
100% lines and branches; `experience-overlay.tsx` at 98.7% lines, 95.5% branches.

The jsdom tests could not reproduce fault 2, because it lives in the
Next.js router. It was found and verified in Edge at 390, 768 and 1440px:
back link, browser Back, Forward then Back, reload, cleared filters staying
cleared, and the header's "Things to do" link opening plain Explore.

## Known gaps

- The cart's "Keep exploring" links still go to plain `/explore`, because the
  cart is reached from many places. Remembering the last Explore address for
  those is a possible follow-up.
- On mobile and tablet the booking sheet opens over the experience page, so the
  traveller closes it before reaching the back link. This is existing design.

## Separate report: home page "scrolling sideways"

Not an app bug. The page was pinch-zoomed in the browser (touchpad pinch, or a
Ctrl+scroll registered as a pinch). The giveaway was that the header and preview
bar moved with the content: they sit in `div.site-chrome`, which is
`position: fixed`, and fixed elements do not move when a page scrolls; they move
only when the visual viewport is zoomed and panned. At normal zoom the page
measures exactly the window width at every size tested. `visualViewport.scale`
above `1` confirms it; pinching out or reloading resets it. No code change.
