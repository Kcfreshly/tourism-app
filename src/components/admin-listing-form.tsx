"use client";
import type { z } from "zod";
import categories from "../../tourism-v1-handoff/data/categories.json";
import {
  arrivalModes,
  confirmationModes,
  intensities,
  listingReadiness,
  listingKinds,
  listingStatuses,
  wheelchairAccesses,
  zoneIds,
  type catalogueEditSchema,
} from "@/modules/catalogue/domain/catalogue";
import {
  displayName,
  formatDuration,
  formatMoney,
  kindLabels,
  priceBasisLabel,
  wheelchairLabels,
  zoneLabels,
} from "@/modules/catalogue/domain/experience-content";
import {
  ageLabel,
  arrivalLabel,
  cancellationLabel,
  confirmationLabel,
} from "@/modules/catalogue/domain/listing-details";
import { eventTypeLabels, eventTypes } from "@/modules/catalogue/domain/events";
import { nigeriaPhotos } from "@/modules/catalogue/domain/photos";
import TagPicker from "./admin-tag-picker";
import PhotoUploader from "./admin-photo-uploader";
import ListingHistory from "./admin-listing-history";

export type Edit = z.infer<typeof catalogueEditSchema>;
// The editor always holds every optional section filled in.
export type FullEdit = Edit &
  Required<
    Pick<
      Edit,
      | "story"
      | "details"
      | "availability"
      | "sessions"
      | "mobility"
      | "tags"
      | "inclusions"
      | "exclusions"
      | "unavailableDates"
      | "images"
    >
  >;

export const sections = [
  { id: "basics", label: "Basics" },
  { id: "story", label: "Story" },
  { id: "pricing", label: "Pricing & party" },
  { id: "schedule", label: "Schedule" },
  { id: "logistics", label: "Logistics & terms" },
  { id: "access", label: "Access & inclusions" },
  { id: "media", label: "Photos & event" },
  { id: "review", label: "Publishing" },
  { id: "history", label: "History" },
] as const;
export type SectionId = (typeof sections)[number]["id"];
// Partners fill in the same listing, then send it to staff. The publication
// status, the night-time security review and the audit history stay with staff.
export const partnerSections = sections
  .filter((s) => s.id !== "history")
  .map((s) => (s.id === "review" ? { ...s, label: "Submit" } : s));
export type Audience = "staff" | "partner";

const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const statusHints: Record<string, string> = {
  DRAFT: "Draft: not visible to travellers.",
  RESEARCHED: "Researched: not visible to travellers.",
  DEMO_VERIFIED: "Approved but not published: not visible to travellers.",
  DEMO_PUBLISHED: "Published: live in browse, the planner and booking.",
  PAUSED: "Unpublished: hidden from new bookings; saved trips keep it.",
};

// Shifts an HH:MM time by whole minutes; closing times past midnight are
// stored as 24:00 or later (28:00 is 04:00 the next morning).
function shiftClock(time: string, by: number) {
  const value = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)) + by;
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

// One entry per line in the textarea; blank lines are dropped on save.
function linesOf(text: string) {
  return text.split("\n");
}

export function Money({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (minor: number) => void;
  hint?: string;
}) {
  return (
    <label>
      {label}
      <input
        required
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        value={Math.round(value / 100)}
        onChange={(e) => onChange(Math.round(Number(e.target.value) * 100))}
      />
      <small className="form-hint">
        {formatMoney(value)}
        {hint ? ` · ${hint}` : ""}
      </small>
    </label>
  );
}

export function Num({
  label,
  value,
  onChange,
  min,
  max,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  hint?: string;
}) {
  return (
    <label>
      {label}
      <input
        required
        type="number"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && <small className="form-hint">{hint}</small>}
    </label>
  );
}

export function Choice<T extends string>({
  label,
  value,
  options,
  labels,
  onChange,
  hint,
}: {
  label: string;
  value: T;
  options: readonly T[];
  labels?: Record<string, string>;
  onChange: (value: T) => void;
  hint?: string;
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {labels?.[o] ?? o}
          </option>
        ))}
      </select>
      {hint && <small className="form-hint">{hint}</small>}
    </label>
  );
}

export function Lines({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  hint?: string;
}) {
  return (
    <label>
      {label}
      <textarea
        rows={Math.max(3, value.length + 1)}
        value={value.join("\n")}
        onChange={(e) => onChange(linesOf(e.target.value))}
      />
      {hint && <small className="form-hint">{hint}</small>}
    </label>
  );
}

// What a traveller sees on the card and booking panel, from unsaved values.
function CustomerPreview({ edit }: { edit: FullEdit }) {
  const basis = edit.priceBasis ?? "PER_ADULT";
  const d = { ...edit.details, minAge: edit.minAge ?? 0 };
  return (
    <aside className="admin-preview" aria-label="Customer preview">
      <p className="eyebrow">Customer preview</p>
      <strong>{displayName(edit.name)}</strong>
      <p>{edit.story.teaser || "No teaser yet."}</p>
      <p className="admin-preview-meta">
        {formatMoney(edit.rateMinor)} {priceBasisLabel(basis)} ·{" "}
        {formatDuration(edit.durationMinMinutes, edit.durationMaxMinutes)} ·{" "}
        {zoneLabels[edit.zoneId]}
      </p>
      <ul className="plain-list">
        <li>{ageLabel(d)}</li>
        <li>{confirmationLabel(d)}</li>
        <li>{arrivalLabel(d)}</li>
        <li>{cancellationLabel(d)}</li>
      </ul>
    </aside>
  );
}

export default function ListingForm({
  edit,
  set,
  section,
  audience = "staff",
}: {
  edit: FullEdit;
  set: (patch: Partial<FullEdit>) => void;
  section: SectionId;
  audience?: Audience;
}) {
  const staff = audience === "staff";
  const details = (patch: Partial<FullEdit["details"]>) =>
    set({ details: { ...edit.details, ...patch } });
  const fixed = edit.schedulingType === "FIXED";
  const lateClose = edit.availability.closesAt >= "24:00";
  const photo = nigeriaPhotos.find((p) => p.id === edit.photoId);
  const missing = listingReadiness({
    ...edit,
    inclusions: edit.inclusions.filter((i) => i.trim()),
  });

  switch (section) {
    case "basics":
      return (
        <>
          <label>
            Name
            <input
              required
              minLength={5}
              maxLength={140}
              value={edit.name}
              onChange={(e) => set({ name: e.target.value })}
            />
            <small className="form-hint">
              Shown as “{displayName(edit.name)}”. The demo marker is kept
              automatically.
            </small>
          </label>
          <div className="field-grid">
            <label>
              Category
              <select
                value={edit.categoryId}
                onChange={(e) =>
                  set({ categoryId: e.target.value as Edit["categoryId"] })
                }
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <Choice
              label="Area"
              value={edit.zoneId}
              options={zoneIds}
              labels={zoneLabels}
              onChange={(zoneId) => set({ zoneId })}
            />
            <Choice
              label="Kind"
              value={edit.kind}
              options={listingKinds}
              labels={kindLabels}
              onChange={(kind) => set({ kind })}
              hint="Light activities fill gaps; full days take the whole day."
            />
          </div>
          <TagPicker value={edit.tags} onChange={(tags) => set({ tags })} />
        </>
      );
    case "story":
      return (
        <>
          <label>
            Teaser
            <input
              required
              minLength={10}
              maxLength={140}
              value={edit.story.teaser}
              onChange={(e) =>
                set({ story: { ...edit.story, teaser: e.target.value } })
              }
            />
            <small className="form-hint">
              One line on cards and search results. {edit.story.teaser.length}
              /140
            </small>
          </label>
          <label>
            Summary
            <textarea
              required
              rows={4}
              minLength={20}
              maxLength={600}
              value={edit.story.summary}
              onChange={(e) =>
                set({ story: { ...edit.story, summary: e.target.value } })
              }
            />
            <small className="form-hint">
              Opening paragraph of the detail page and overlay.
            </small>
          </label>
          <label>
            Why go
            <textarea
              rows={2}
              maxLength={300}
              value={edit.story.why}
              onChange={(e) =>
                set({ story: { ...edit.story, why: e.target.value } })
              }
            />
            <small className="form-hint">
              The reason it’s worth the time. Optional.
            </small>
          </label>
          <CustomerPreview edit={edit} />
        </>
      );
    case "pricing":
      return (
        <>
          <div className="field-grid">
            <Choice
              label="Price basis"
              value={edit.priceBasis ?? "PER_ADULT"}
              options={["PER_ADULT", "PER_GROUP"] as const}
              labels={{ PER_ADULT: "Per adult", PER_GROUP: "Per group" }}
              onChange={(priceBasis) => set({ priceBasis })}
            />
            <Money
              label="Rate (₦)"
              value={edit.rateMinor}
              onChange={(rateMinor) => set({ rateMinor })}
            />
            <Money
              label="Child rate (₦)"
              value={edit.details.childRateMinor}
              onChange={(childRateMinor) => details({ childRateMinor })}
              hint={
                edit.priceBasis === "PER_GROUP"
                  ? "Children count towards the group"
                  : "Per child"
              }
            />
            <Num
              label="Minimum party"
              min={1}
              max={50}
              value={edit.minParty ?? 1}
              onChange={(minParty) => set({ minParty })}
            />
            <Num
              label="Maximum party"
              min={1}
              max={50}
              value={edit.maxParty ?? 8}
              onChange={(maxParty) => set({ maxParty })}
            />
            <Num
              label="Minimum age"
              min={0}
              max={21}
              value={edit.minAge ?? 0}
              onChange={(minAge) => set({ minAge })}
              hint={`${ageLabel({ minAge: edit.minAge ?? 0 })}. 12 or under shows as family friendly.`}
            />
            <Choice
              label="Capacity counted in"
              value={edit.capacityUnit ?? "PERSON"}
              options={["PERSON", "GROUP"] as const}
              labels={{ PERSON: "People", GROUP: "Groups" }}
              onChange={(capacityUnit) => set({ capacityUnit })}
            />
            <Num
              label="Capacity per slot"
              min={1}
              max={100}
              value={edit.capacityPerSlot}
              onChange={(capacityPerSlot) => set({ capacityPerSlot })}
              hint="Default for sessions without their own capacity."
            />
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={edit.hostIncluded ?? false}
              onChange={(e) => set({ hostIncluded: e.target.checked })}
            />
            A local host joins the group
          </label>
        </>
      );
    case "schedule":
      return (
        <>
          <fieldset className="admin-days">
            <legend>Days it runs</legend>
            {dayNames.map((name, i) => {
              const day = i + 1;
              const on = edit.availability.days.includes(day);
              return (
                <label className="check" key={name}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() =>
                      set({
                        availability: {
                          ...edit.availability,
                          days: on
                            ? edit.availability.days.filter((d) => d !== day)
                            : [...edit.availability.days, day].sort(),
                        },
                      })
                    }
                  />
                  {name}
                </label>
              );
            })}
          </fieldset>
          <div className="field-grid">
            <label>
              Opens
              <input
                type="time"
                required
                value={edit.availability.opensAt}
                onChange={(e) =>
                  set({
                    availability: {
                      ...edit.availability,
                      opensAt: e.target.value,
                    },
                  })
                }
              />
            </label>
            <label>
              Closes
              <input
                type="time"
                required
                value={
                  lateClose
                    ? shiftClock(edit.availability.closesAt, -1440)
                    : edit.availability.closesAt
                }
                onChange={(e) =>
                  set({
                    availability: {
                      ...edit.availability,
                      closesAt: lateClose
                        ? shiftClock(e.target.value, 1440)
                        : e.target.value,
                    },
                  })
                }
              />
              <span className="check">
                <input
                  type="checkbox"
                  checked={lateClose}
                  onChange={() =>
                    set({
                      availability: {
                        ...edit.availability,
                        closesAt: shiftClock(
                          edit.availability.closesAt,
                          lateClose ? -1440 : 1440,
                        ),
                      },
                    })
                  }
                />
                Closes after midnight (next morning)
              </span>
            </label>
            <Num
              label="Shortest visit (minutes)"
              min={30}
              max={420}
              value={edit.durationMinMinutes}
              onChange={(durationMinMinutes) => set({ durationMinMinutes })}
            />
            <Num
              label="Longest visit (minutes)"
              min={30}
              max={480}
              value={edit.durationMaxMinutes}
              onChange={(durationMaxMinutes) => set({ durationMaxMinutes })}
              hint={`Shown as ${formatDuration(edit.durationMinMinutes, edit.durationMaxMinutes)}.`}
            />
            <Num
              label="Minimum booking notice (hours)"
              min={0}
              max={168}
              value={edit.bookingCutoffHours ?? 0}
              onChange={(bookingCutoffHours) => set({ bookingCutoffHours })}
              hint="0 lets travellers book until the session starts."
            />
            <Choice
              label="Scheduling"
              value={edit.schedulingType ?? "FLEXIBLE"}
              options={["FLEXIBLE", "FIXED"] as const}
              labels={{
                FLEXIBLE: "Flexible: arrive any time while open",
                FIXED: "Fixed: set start times",
              }}
              onChange={(schedulingType) => set({ schedulingType })}
            />
          </div>
          {fixed && (
            <fieldset className="admin-sessions">
              <legend>Sessions</legend>
              <p className="form-hint">
                Leave dates empty for a session that runs on every open day. Add
                dates (YYYY-MM-DD, comma separated) for dated events.
              </p>
              {edit.sessions.map((s, i) => {
                const update = (patch: Partial<typeof s>) =>
                  set({
                    sessions: edit.sessions.map((x, j) =>
                      j === i ? { ...x, ...patch } : x,
                    ),
                  });
                return (
                  <div className="admin-session" key={i}>
                    <label>
                      Starts
                      <input
                        type="time"
                        required
                        value={s.startTime}
                        onChange={(e) => update({ startTime: e.target.value })}
                      />
                    </label>
                    <Num
                      label="Minutes"
                      min={15}
                      max={720}
                      value={s.durationMinutes}
                      onChange={(durationMinutes) =>
                        update({ durationMinutes })
                      }
                    />
                    <Num
                      label="Capacity"
                      min={1}
                      max={500}
                      value={s.capacity ?? edit.capacityPerSlot}
                      onChange={(capacity) => update({ capacity })}
                    />
                    <label className="admin-session-dates">
                      Dates
                      <input
                        placeholder="Every open day"
                        value={(s.dates ?? []).join(",")}
                        onChange={(e) =>
                          update({
                            dates: e.target.value
                              ? e.target.value.split(",")
                              : undefined,
                          })
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() =>
                        set({
                          sessions: edit.sessions.filter((_, j) => j !== i),
                        })
                      }
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  set({
                    sessions: [
                      ...edit.sessions,
                      {
                        startTime: edit.availability.opensAt,
                        durationMinutes: edit.durationMinMinutes,
                        capacity: edit.capacityPerSlot,
                      },
                    ],
                  })
                }
              >
                Add session
              </button>
            </fieldset>
          )}
          <label>
            Closed dates
            <input
              placeholder="2026-12-25, 2027-01-01"
              value={edit.unavailableDates.join(",")}
              onChange={(e) =>
                set({
                  unavailableDates: e.target.value
                    ? e.target.value.split(",")
                    : [],
                })
              }
            />
            <small className="form-hint">
              Holidays or partner closures. YYYY-MM-DD, comma separated.
            </small>
          </label>
        </>
      );
    case "logistics":
      return (
        <>
          <div className="field-grid">
            <label>
              Operator
              <input
                required
                maxLength={120}
                value={edit.details.operator}
                onChange={(e) => details({ operator: e.target.value })}
              />
            </label>
            <label>
              Venue or meeting point
              <input
                required
                maxLength={160}
                value={edit.details.venue}
                onChange={(e) => details({ venue: e.target.value })}
              />
            </label>
            <Choice
              label="Getting there"
              value={edit.details.arrival}
              options={arrivalModes}
              labels={{
                SELF: "Make your own way",
                PICKUP_OPTIONAL: "Own way, or add pickup",
                PICKUP_REQUIRED: "Pickup included",
              }}
              onChange={(arrival) => details({ arrival })}
            />
            {edit.details.arrival === "PICKUP_OPTIONAL" && (
              <Money
                label="Pickup add-on (₦)"
                value={edit.details.pickupRateMinor}
                onChange={(pickupRateMinor) => details({ pickupRateMinor })}
              />
            )}
            {staff && (
              <label className="check">
                <input
                  type="checkbox"
                  checked={edit.nightVisitAllowed ?? false}
                  onChange={(e) => set({ nightVisitAllowed: e.target.checked })}
                />
                Night visit allowed: the night-time security review has passed.
                Required to publish a listing that runs past midnight.
              </label>
            )}
            <Choice
              label="Confirmation"
              value={edit.details.confirmation}
              options={confirmationModes}
              labels={{
                INSTANT: "Instant",
                PARTNER: "Partner confirms",
              }}
              onChange={(confirmation) => details({ confirmation })}
            />
            {edit.details.confirmation === "PARTNER" && (
              <Num
                label="Partner replies within (hours)"
                min={1}
                max={168}
                value={edit.details.partnerHours}
                onChange={(partnerHours) => details({ partnerHours })}
              />
            )}
            <Num
              label="Free cancellation (hours before)"
              min={0}
              max={720}
              value={edit.details.freeCancellationHours}
              onChange={(freeCancellationHours) =>
                details({ freeCancellationHours })
              }
            />
          </div>
          <CustomerPreview edit={edit} />
        </>
      );
    case "access":
      return (
        <>
          <div className="field-grid">
            <Choice
              label="Walking"
              value={edit.mobility.intensity as (typeof intensities)[number]}
              options={intensities}
              onChange={(intensity) =>
                set({ mobility: { ...edit.mobility, intensity } })
              }
            />
            <Choice
              label="Wheelchair access"
              value={
                edit.mobility
                  .wheelchairAccess as (typeof wheelchairAccesses)[number]
              }
              options={wheelchairAccesses}
              labels={wheelchairLabels}
              onChange={(wheelchairAccess) =>
                set({ mobility: { ...edit.mobility, wheelchairAccess } })
              }
            />
          </div>
          <Lines
            label="Included"
            value={edit.inclusions}
            onChange={(inclusions) => set({ inclusions })}
            hint="One per line."
          />
          <Lines
            label="Not included"
            value={edit.exclusions}
            onChange={(exclusions) => set({ exclusions })}
            hint="One per line. Be explicit about transport, food and tips."
          />
        </>
      );
    case "history":
      return staff ? (
        <ListingHistory id={edit.id} version={edit.expectedVersion} />
      ) : null;
    case "media":
      return (
        <>
          <PhotoUploader
            images={edit.images}
            onChange={(images) => set({ images })}
            uploadUrl={staff ? undefined : "/api/v1/partner/media"}
          />
          <label>
            Inspiration photo
            <select
              value={edit.photoId ?? ""}
              onChange={(e) => set({ photoId: e.target.value })}
            >
              <option value="">Automatic (matched to category)</option>
              {nigeriaPhotos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            <small className="form-hint">
              {edit.images.length
                ? "Not shown while this listing has its own photos."
                : "Used until you upload photos. Licensed photos only; credits are shown with them."}
            </small>
          </label>
          {photo && !edit.images.length && (
            <img className="admin-photo" src={photo.src} alt={photo.title} />
          )}
          <label>
            Video URL
            <input
              placeholder="https://… or /assets/…"
              value={edit.videoUrl ?? ""}
              onChange={(e) => set({ videoUrl: e.target.value })}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={!!edit.event}
              onChange={(e) =>
                set(
                  e.target.checked
                    ? {
                        event: { type: "CONCERT" },
                        schedulingType: "FIXED",
                        sessions: edit.sessions.length
                          ? edit.sessions
                          : [
                              {
                                startTime: edit.availability.opensAt,
                                durationMinutes: edit.durationMinMinutes,
                                capacity: edit.capacityPerSlot,
                                dates: [],
                              },
                            ],
                      }
                    : { event: null },
                )
              }
            />
            This is a dated event
          </label>
          {edit.event && (
            <>
              <Choice
                label="Event type"
                value={edit.event.type}
                options={eventTypes}
                labels={eventTypeLabels}
                onChange={(type) => set({ event: { ...edit.event!, type } })}
                hint="Set the event dates on its sessions under Schedule."
              />
              <label>
                Always included
                <textarea
                  rows={2}
                  maxLength={300}
                  value={edit.event.guaranteed ?? ""}
                  onChange={(e) =>
                    set({
                      event: { ...edit.event!, guaranteed: e.target.value },
                    })
                  }
                />
              </label>
              <label>
                May happen, never promised
                <textarea
                  rows={2}
                  maxLength={300}
                  value={edit.event.bonus ?? ""}
                  onChange={(e) =>
                    set({ event: { ...edit.event!, bonus: e.target.value } })
                  }
                />
                <small className="form-hint">
                  For example a live shoot during a studio visit.
                </small>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={!!edit.event.guestCheckout}
                  onChange={(e) =>
                    set({
                      event: {
                        ...edit.event!,
                        guestCheckout: e.target.checked,
                      },
                    })
                  }
                />
                Buyers can pay without creating an account
              </label>
              <small className="form-hint">
                They enter their name, email and phone at checkout. Leave this
                off to ask every buyer to sign in first.
              </small>
            </>
          )}
        </>
      );
    case "review":
      if (!staff)
        return (
          <>
            <div className="admin-readiness">
              <h3>Ready to submit?</h3>
              {missing.length ? (
                <ul>
                  {missing.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              ) : (
                <p>Everything travellers need is filled in.</p>
              )}
              <p className="form-hint">
                Use Submit for review below. Fastlife checks the listing and
                either publishes it or sends it back with what to change.
              </p>
            </div>
            <CustomerPreview edit={edit} />
          </>
        );
      return (
        <>
          <p className="admin-status-line">
            <span className="status-dot" data-status={edit.status} />
            {statusHints[edit.status]}
          </p>
          <div className="admin-readiness">
            <h3>Ready to publish?</h3>
            {missing.length ? (
              <ul>
                {missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            ) : (
              <p>Everything travellers need is filled in.</p>
            )}
            <p className="form-hint">
              Use Publish below. As staff, publishing is your approval: the
              review is recorded in the audit log.
            </p>
          </div>
          <details className="admin-advanced">
            <summary>Other statuses</summary>
            <Choice
              label="Status"
              value={edit.status}
              options={listingStatuses}
              onChange={(status) => set({ status })}
              hint="Saved with “Save changes”. Publish and Unpublish set this for you."
            />
          </details>
          <CustomerPreview edit={edit} />
        </>
      );
  }
}
