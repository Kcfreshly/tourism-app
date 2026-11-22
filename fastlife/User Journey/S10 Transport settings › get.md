---
step: S10
journey: Shared
layer: Repository
file: src/modules/trips/infrastructure/persistence/drizzle-transport-settings-repository.ts
function: "DrizzleTransportSettingsRepository.get"
line: 24
tags: [user-journey]
---
# S10 · Transport settings › get

`src/modules/trips/infrastructure/persistence/drizzle-transport-settings-repository.ts` → **`DrizzleTransportSettingsRepository.get`** (line 24)

**The traveller:** —

**What runs:** Staff-edited car blocks, night car, late-return time, guide notice and pickup reminder hours (Admin → Transport & guides). Defaults when nothing is saved.

**Called from:** [[A05 Experience page › Detail]] (pages.transportSettings()), [[B26 SaveWorkspace › execute]] (transport.get()), [[S09 GetWorkspace › execute]] (transport.get())

Back to the story: [[User Journey]]
