# Keeping demo event dates current

Demo events (`src/data/events.demo.json`) run on fixed dates, which slip into
the past during development. `npm run db:refresh-dates` moves them forward in
the local database.

```
npm run db:refresh-dates                 # relative to today in Lagos
npm run db:refresh-dates -- 2026-12-30   # as if it were that day
```

Stop `npm run dev` first when using the embedded database (`.local/demo-db`):
only one process can open it. With `DATABASE_URL` set it can run alongside.

## What it does

- Works out how many days the JSON's earliest event date is behind tomorrow,
  rounded up to whole weeks, so every session keeps its weekday and stays
  inside the listing's opening days.
- Rewrites only `sessions[].dates` of the seeded event rows, computed from the
  JSON each time, and bumps each row's version. Names, prices, notice and other
  staff edits are kept.
- Running it twice on the same day changes nothing further. The JSON and the
  tests keep their fixed dates, so the repo shows no daily diff.

## Not covered

- Package departure dates (`src/data/packages.demo.json`) are read straight
  from the JSON, not the database. They currently run to January 2027.
- Saved trips keep the dates the traveller chose.
