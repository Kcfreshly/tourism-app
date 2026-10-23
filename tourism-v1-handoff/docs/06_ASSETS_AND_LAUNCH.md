# Assets, configuration and launch inventory

## Supplied assets

- `assets/design-tokens.css`: colour, type, spacing, radii and elevation variables.
- `assets/wireframes/01-home.svg`: entry and category layout.
- `assets/wireframes/02-planner.svg`: desktop activity library, timeline and price rail.
- `assets/wireframes/03-checkout.svg`: review, capacity hold and payment hierarchy.
- `assets/wireframes/04-pocket-mobile.svg`: Today mobile view and pending/assigned identity treatment.
- `assets/wireframes/05-admin.svg`: operational queues, fulfilment and exception priorities.
- `assets/wireframes/06-intake-mobile.svg`: unified profile/chat mobile intake.
- `assets/illustrations/category-*.svg`: eight original abstract category illustrations.
- `assets/illustrations/brand-mark.svg`: original draft compass-style mark. Working identity only; not trademark-cleared.
- `data/categories.json`, `experiences.demo.json`, `pricing.demo.json`, `trip.demo.json`, `operations.demo.json`: fixtures.
- `contracts/planner-output.schema.json`, `contracts/catalogue.schema.json`: schemas.
- `qa/pricing-cases.json`: exact expected arithmetic.

Wireframes illustrate hierarchy and component placement, not every validation state. Screen specifications govern behavior. Category art is a clearly stylised placeholder, not an image of a real venue. All original vectors may be modified for this build; no third-party photo licensing is implied.

## Still required from the business

| Asset/configuration | Minimum requirement | Until supplied |
|---|---|---|
| Final identity | approved name, logo, domain, business contact | working name and draft mark |
| Experience images | 3–5 licensed photos per product, attribution/license record and alt text | category illustrations |
| Supplier details | verified contact, agreement, rate, capacity, fulfilment and refund terms | demo offers cannot go live |
| Personnel | consented photo, valid identity/check status, public display name, permitted phone, schedule | fictional inactive identities |
| Vehicles | verified vehicle, passenger/luggage limits and required checks | demo capacity only |
| Payment account | eligible merchant account, sandbox/live keys, webhook URL and secret | mock/sandbox mode |
| Communications | transactional email sender/domain, staff destination and notification templates | local outbox preview |
| Model provider | server-only key, approved model, spend limits | deterministic planner |
| Maps/travel | validated zones, time-band estimates or chosen API with key | fictional demo matrix |
| Policies | approved terms, privacy/retention, cancellations, refunds, supplier-specific terms | demo policy label; live disabled |
| Support | staffed number/hours, escalation owner and verified local emergency contacts | help form, no false availability |
| Connectivity | real partner process and activation eligibility | unavailable add-on |

Do not copy GetYourGuide branding, photos, content or design assets. It is a functional reference for browsing/booking only. This package does not rely on claims about its current interface.

## Photo specifications

Hero landscape 1600×1000 or larger; listing 4:3 crop, 1200×900; profile 1:1, 512×512. Convert licensed source images to responsive WebP/AVIF where supported, keep original records and focal point; generate sizes rather than shipping full-resolution originals to mobile. Descriptive alt text states visible content without invented accessibility or safety claims. No sensitive identity documents in public assets. No face photos of fictional people presented as real staff.

## Environment template expected in implementation

```dotenv
APP_MODE=demo
PUBLIC_APP_URL=http://localhost:3000
DATABASE_URL=postgresql://LOCAL_ONLY_EXAMPLE
AUTH_SECRET=GENERATE_LOCALLY
PAYMENT_PROVIDER=mock
PAYMENT_SECRET_KEY=
PAYMENT_WEBHOOK_SECRET=
PLANNER_PROVIDER=deterministic
PLANNER_MODEL=
PLANNER_API_KEY=
EMAIL_PROVIDER=local
EMAIL_FROM=
EMAIL_API_KEY=
OBJECT_STORAGE_BUCKET=
OBJECT_STORAGE_KEY=
LIVE_CHECKOUT_ENABLED=false
SUPPORT_PHONE=
SUPPORT_HOURS=
```

Names are illustrative; implementation documents actual names. No secret is public-prefixed. Production must refuse mock payment, demo suppliers and default auth secrets, even if a UI flag is toggled.

## Initial copy

Home: “Your Lagos stay, thoughtfully arranged.” / “Build a trip around what you love. We’ll coordinate the experiences, transport and local support.” Entry: “Plan with AI” / “Use the trip form.” Planner empty: “Leave room for life. Add an experience or keep this time free.” Pending assignment: “Your driver details will appear here before your pickup.” Price note: “Your total includes the services shown below.” Demo banner: “Demo experience — sample prices and availability. No real booking will be made.” Support pending: “Request sent. We’ll show an update when the team responds.”

## Production readiness flags

Live checkout requires verified published products, backed resource capacity, current rates, approved policies, supported routes, real provider credentials/webhook tests and active support configuration. Seed fixtures have `isDemo: true` and cannot be promoted by merely changing their published flag. Real records must pass independent verification gates.

## Asset manifest maintenance

Implementation should retain filename, purpose, source/creator, license/consent, verification owner, date and replacement status for every public asset. This package's `ASSET_MANIFEST.json` lists supplied vector assets; add real-image rights records when replacing them. Design tokens and wireframes use system fonts, so no font license/download is needed.
