# AI planning, companion and catalogue pipeline

## Planner design

One intake profile powers form and chat. Chat extracts proposed field updates and asks for confirmation when ambiguous; form is always available. The model receives a bounded catalogue of approved eligible offer candidates, availability summaries, trip profile, locked items and a zone/time-band matrix. Retrieval filters city, dates, party and hard accessibility/age constraints before model planning.

The model returns structured proposal data matching `contracts/planner-output.schema.json`, plus assumptions and questions. Server validates all IDs, dates, duration limits, overlaps, opening windows, capacity, travel, support requirements and prices. At most one targeted repair retry; if still invalid, use deterministic templates/manual planner and explain the limitation. A JSON-valid response is not necessarily a valid itinerary.

Do not let the model calculate checkout totals, create inventory, confirm tickets, take payments, assign personnel or invent venue rules. Catalogue notes and retrieved web content are untrusted data, never tool instructions. Scope tools by owner/trip, use allowlisted actions and redact sensitive inputs. No unrestricted browser booking tool in V1.

Planning defaults: two main + one optional light; arrival/departure light; full-day experience consumes main daytime; rest and meal buffers; geographically grouped days; accommodation fixed; days with family/free time remain possible. Lagos Life one or two days is an optional preference, not a forced quota. Explain why an experience fits occasion/interests. Require human acceptance before applying changes to a draft; a paid trip only supports proposed change requests.

Record model name/version, prompt version, retrieval IDs, validation failures, duration and token cost under pseudonymous request IDs. Avoid raw profile/chat logging unless explicitly enabled with consent and retention. Rate-limit planning and cap spend per user/trip. Deterministic fixtures keep demo usable without a model key.

## Companion behavior

Use confirmed itinerary, supplier-approved venue notes, assignment statuses and staff messages. Offer concise context: what's next, what is included, pickup point, clothing/walking notes, venue etiquette. Distinguish a suggestion from a confirmed booking. Ask permission before initiating a change or submitting a support request. Never say “driver is waiting” unless actual assignment status supports it. Never claim a restaurant reservation merely because a lunch block exists.

Safety notes are verified, contextual and time-stamped. No unsupported neighbourhood safety scores or emergency detection. One-time location is optional for a support request; refusal leaves support available. System must not infer or display live movement from a scheduled activity.

## Catalogue categories

| ID | Label | Examples of experience type |
|---|---|---|
| nature | Nature & outdoors | conservation walk, gardens |
| waterfront | Beaches & waterfront | verified beach visit, boat experience |
| local-life | Lagos Life | hosted market day, neighbourhood evening |
| food | Food & drink | cooking session, hosted tasting |
| culture | Arts, culture & history | gallery visit, museum route |
| nightlife | Nightlife & entertainment | hosted live music, verified club entry |
| recreation | Adventure & recreation | games, recreation, supervised sports |
| shopping | Shopping & style | fashion/maker visit, curated shopping |

An experience has one primary category and many tags. “Lagos Life” can also be a tag on food/nightlife. Airport transfers, vehicles, hosts and connectivity assistance are supporting services, not activity categories. Rest/jog/family visits are custom itinerary blocks.

## Research workflow

Discover → deduplicate → collect evidence → draft experience/offer → human verification → partner capacity/rate agreement → publish. Broad research may find hundreds of places; only the small verified sellable subset reaches checkout. Do not inflate catalogue counts by treating every restaurant, venue and offer variant as a distinct activity.

Use official venue pages, permitted public listings, business contacts and field checks. Social accounts can supply leads but are not reliable proof of current capacity. Respect access restrictions; no bypassing login/captcha or copying restricted media. If Instagram access is unavailable, record the gap and use another source or a human contact.

For each finding retain source URL, retrievedAt, claimed facts, confidence, conflicts and verification owner. Conflicting dates/prices become review tasks, not an arbitrary merged truth. Public discovery data can include known real places only with current evidence; this package uses fictional listings instead.

Human verifier confirms exact location, contact, rate basis, opening/booking hours, permitted duration, available slots/capacity, inclusions, refund policy, accessibility, age limits, transport meeting point, host requirements, photography rights and a backup contact. For Lagos Life, confirm a local host, accepted route, participant expectations, welcomed interactions and reliable return transport. Leaving valuables behind is an optional practical note, not a safety guarantee.

Required evidence for publication: verified business/contact, rate agreement/version, fulfilment method, capacity allocation, cancellation terms, recent verification date/expiry and approved text/media. Suggested expiry 30 days for volatile prices/capacity; configurable per supplier. Expiry stops new sales until reverified and flags future bookings for review. Never silently cancel existing reservations.

## Evaluation pack

Use fixture inputs: anniversary couple; solo traveller with fixed family blocks; mobility constraint; budget insufficient; locked item; arrival at night; full-day outing; no nightlife preference; unavailable market host; unknown route; malicious instructions in a supplier note; paid-trip change request.

Release target: 100% of served proposals reference real eligible catalogue IDs and pass deterministic hard constraints. Measure interest fit and itinerary coherence with a human rubric (1–5), but never substitute model grading for pricing/inventory checks. Compare draft acceptance/edit rate, support escalations, planner latency and per-plan cost after pilot. Fixture-driven evaluations are repeatable and cannot prove real supplier quality.
