# Research and catalogue preparation prompt

Goal: identify candidate experiences for the configured launch city and organise evidence for human verification. You are not authorised to publish products, promise availability, contact businesses on behalf of the owner or book anything through this prompt.

Research eight categories in docs/04. Use permitted public sources, prioritising official business/venue pages. Instagram and other social pages are leads only unless a current official statement supports a particular fact. Respect access restrictions; do not bypass login/captcha or copy media without permission.

For each candidate return structured records: candidateId, experienceName, primaryCategory, tags, venueName, area/address, source URLs with retrievedAt, known duration/hours/rates with currency and basis, unknowns, conflicting claims, accessibility evidence, proposed main/light/full-day classification, potential host requirement, contact source and next verification action. Mark inferred fields explicitly. Do not turn a price you saw online into an agreed supplier rate.

Deduplicate by venue/address/official identity. Distinguish venue, experience and offer variant. No filler to reach an arbitrary activity count. Prefer 20–30 well-evidenced candidates over hundreds of weak records for initial launch.

Set status RESEARCHED and isBookable false. A human must confirm prices, capacity, route, inclusions, policy, rights and partner agreement before publication. Provide a concise field-verification checklist for the local lead. For hosted local-life experiences, include route acceptance, host credentials, meeting/return transport and participant comfort considerations. Never label an area categorically safe based on online appearance.

Output research JSON plus a list of unresolved verification tasks. External communications require a separate explicit instruction from the owner.
