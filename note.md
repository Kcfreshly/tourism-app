# Tourism Application — User Experience Updates

Implement these refinements alongside the existing product specification.

## 1. Two Clear Entry Paths

Present two options when users arrive:

### Plan with Kemi
“Tell Kemi about your trip. Get a personalised itinerary you can customise.”

### Explore Experiences
“Save activities to your bucket, then organise them into your trip.”

Explain clearly:
- Saving an activity does not book it.
- Adding an activity to the bucket does not assign it a time.
- Users can customise their plan regardless of how they started.

## 2. Activity Bucket

Allow users to explore and collect activities before planning.

Requirements:
- Add and remove activities.
- Display a visible bucket count.
- Preserve selections while browsing, onboarding and signing in.
- Provide a “Plan my trip” action.
- Keep saved activities, scheduled activities and paid bookings distinct.

## 3. Onboarding Before Planning

When a user who has not completed onboarding clicks “Plan my trip,” open an overlay:

“We’d like to know you—let’s tailor your trip.”

Offer:
1. Talk to Kemi using voice.
2. Enter details manually.

Both methods populate the same editable trip profile.

Collect:
- Destination and travel dates.
- Number of travellers.
- Accommodation or starting area.
- Interests and preferred experiences.
- Budget.
- Preferred pace.
- Transport and guide preferences.
- Relevant accessibility or dietary requirements.
- Optional occasion or special requests.

Let users review and correct voice-populated fields.

If Kemi already collected information, reuse it and request only missing details.

After onboarding, open the planner with the bucket preserved.

## 4. Activity Library Inside the Planner

Provide two views:

### My Bucket
Activities the user previously saved.

### All Experiences
The wider catalogue, with recommendations informed by the user’s profile and selections.

Users can add activities from either view.

Show relevant availability and explain when an activity cannot fit the trip or schedule.

## 5. Flexible and Fixed Scheduling

Each activity must declare its scheduling type.

### Flexible-Time Activities
Users can select a start time and permitted duration.

The entire activity must fit within:
- Opening and closing hours.
- Date-specific availability.
- Permitted duration limits.
- Capacity constraints.
- Existing itinerary blocks and travel buffers.

Example:
An attraction opens at 09:00 and closes at 18:00. A two-hour visit must start no later than 16:00.

### Fixed-Time Activities
Activities such as cooking classes, events and organised tours have scheduled sessions.

Requirements:
- Show available sessions.
- Preserve the session’s start time and duration.
- Do not allow arbitrary time changes.
- When moving an activity, offer valid alternative sessions.

## 6. Prevent Overlapping Blocks

Users cannot place an activity into occupied time.

Requirements:
- Validate the full activity duration and required travel buffers.
- Visually show valid and invalid drop positions.
- Reject conflicting drops without moving or overwriting existing activities.
- Apply identical rules to dragging, manual edits and AI planning.
- Enforce validation on the server.

Message:
“This time is already occupied. Choose another time or day.”

### Full-Day Activities
If an activity occupies the entire usable day:
- Show that day as full.
- Prevent additional overlapping activities.
- Explain why another activity cannot be added.

## 7. Activity Detail Overlay

Clicking an activity opens a detail overlay without leaving the current screen.

Include:
- Activity name.
- What the experience is.
- Where it is.
- Why it is worth visiting.
- Photos.
- Optional video, displayed only when available.
- Price and pricing basis.
- Duration.
- Flexible-time or fixed-session rules.
- Availability.
- Inclusions and exclusions.

Actions:
- Close.
- Add to bucket.
- Open in new tab.
- Add to itinerary, when inside the planner.

Each activity must have a permanent detail URL.

Closing the overlay must preserve:
- Search and filters.
- Scroll position.
- Bucket selections.
- Itinerary edits.

Support keyboard navigation and mobile layouts.

## 8. Shuffle and Nearby Recommendations

Allow users to discover alternatives based on their selections.

Recommendations should consider:
- Geographic proximity.
- Interests.
- Available time.
- Opening hours and fixed sessions.
- Activity duration.
- Budget.
- Travel buffers.

Explain recommendations briefly:
“Nearby and fits your afternoon.”

### Shuffle Behaviour
- Shuffling refreshes suggestions without automatically changing the itinerary.
- Replacing a scheduled activity requires explicit confirmation.
- Preview timing and price changes before applying.
- Preserve locked activities and personal blocks.
- Validate the resulting schedule.
- Changes to paid bookings must use the existing change-request process.

## 9. Acceptance Criteria

A user can:
1. Explore experiences.
2. Save multiple activities to their bucket.
3. Complete onboarding by voice or manually.
4. Enter the planner without losing selections.
5. Switch between My Bucket and All Experiences.
6. Inspect activity details without losing their work.
7. Schedule flexible activities within valid opening hours.
8. Choose valid sessions for fixed-time activities.
9. See when a day is full.
10. Shuffle suggestions and approve replacements.

The application consistently prevents overlapping or otherwise invalid placements.