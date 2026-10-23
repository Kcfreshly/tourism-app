# Tourism user experience refinements

Implemented in the existing local demo:

- Plan with Kemi and Explore Experiences entry paths with explicit save / schedule / booking distinctions.
- Browser-persistent bucket, visible count and removal, retained across navigation and sign-in. The existing profile contract supports up to 30 selections; the bucket explains that limit.
- Onboarding dialog with manual entry or browser speech transcription, reviewable extraction and a shared editable profile. Draft fields persist in this browser; completed onboarding opens the planner.
- My Bucket and All Experiences library tabs, profile and zone informed suggestions, shuffle without itinerary changes, and explicit replacement previews with timing and price changes.
- Native detail dialogs with keyboard dismissal, permanent URLs, optional media, and retained parent screen state.
- Shared placement validation used by manual edits, day drops, recommendations, generated proposals, workspace writes, proposal application and profile updates. Rejects overlaps, insufficient transfer buffers, closed dates/hours, invalid durations, capacity violations, invalid fixed sessions and full-day conflicts before persistence.
- Fixed demo sessions for cooking, hosted music and market experiences; other existing records explicitly resolve to flexible scheduling. Existing record-specific sessions and closed dates take precedence.

## Demo boundaries

The existing application has no payment, paid-booking or change-request implementation. This change creates no paid bookings and does not introduce a bypass for paid-booking changes. Inventory is demo configuration, not live supplier inventory. Supplied catalogue media consists of category illustrations; the UI labels them and supports venue photos/video when records provide them. Kemi remains a deterministic intake helper rather than a connected AI service. Browser speech support and microphone permission are required for voice; the same editable manual form remains available.

## Validation

Domain tests cover full-duration closing times, fixed session timing/duration/date/capacity, closures, personal-block travel conflicts, full days and non-mutating replacement previews. The planner API integration checks rejected writes leave items and version unchanged, optimistic versioning, access control, preview/apply and locked item preservation. Visual and microphone verification require an available browser.


## Guided journey revision

The Kemi entry now displays the conversation alone. Its next stage is a full review summary with Edit details manually and Ask Kemi to edit actions. Manual entry also leads to that review, rather than immediately saving or navigating away. Saving creates a named independent draft and presents Explore & add to bucket and Go to my trip choices. My trips lists named drafts and can create another independent draft from a profile. Fresh-trip entry is available separately from profile reuse.

Explore explains shortlist versus scheduling and carries the active draft into the planner. The planner library has a bounded, keyboard-focusable scrolling activity list with a visible scrollbar, with search and filters above it. Detail overlays render in a portal so card-title styling and card clipping do not affect their contents.

Four real Nigerian photographs are stored in public/assets/photos, with author, source and reuse licence in credits.json and a visible /photo-credits page. They replace placeholder images as destination inspiration, without implying real bookable supply. Downloading is reproducible with scripts/download-nigeria-photos.py.

The ui-formatting skill is stored in skills/ui-formatting and installed in the user's Codex skills directory. AGENTS.md routes future UI work to it. Journey component tests exercise agent and manual stages, edits, saving independent drafts and bucket state restoration. Browser inventory was empty in this session, so actual rendered layout and microphone behaviour remain a manual verification item.
