"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { initialProfile, profileSchema, type Profile } from "@/domain/profile";
import categories from "../../tourism-v1-handoff/data/categories.json";
import { activateTrip, useBucket } from "./trip-store";

type Saved = { id: string; version: number; profile: Profile };
type Stage = "details" | "review" | "saved";
type Speech = {
  lang: string;
  onresult: (event: {
    results: ArrayLike<ArrayLike<{ transcript: string }>>;
  }) => void;
  onerror: () => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
};
export default function Intake({
  id,
  mode: entry = "chat",
  offer,
  fresh = false,
  onContinue,
}: {
  id?: string;
  mode?: string;
  offer?: string;
  fresh?: boolean;
  onContinue?: () => void;
}) {
  const { ids: bucket } = useBucket();
  const [profile, setProfile] = useState<Profile>({
    ...initialProfile,
    draftName: "",
    selectedOfferIds: offer ? [offer] : [],
  });
  const [mode, setMode] = useState(entry === "form" ? "form" : "chat");
  const [stage, setStage] = useState<Stage>(id ? "review" : "details");
  const [saved, setSaved] = useState<Saved | null>(null);
  const [busy, setBusy] = useState(!!id);
  const [status, setStatus] = useState(
    id ? "Loading your trip profile..." : "",
  );
  const [note, setNote] = useState("");
  const [listening, setListening] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(!!id);
  const recognition = useRef<Speech | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => () => recognition.current?.stop(), []);
  useEffect(() => {
    heading.current?.focus();
  }, [stage]);
  useEffect(() => {
    let active = true;
    if (id) {
      fetch(`/api/v1/trips/${id}`)
        .then(async (response) => {
          const body = await response.json();
          if (!response.ok) throw Error(body.error.message);
          if (active) {
            setSaved(body.data);
            setProfile(body.data.profile);
            setStatus("Your saved profile is ready to review.");
          }
        })
        .catch((error) => {
          if (active) setStatus(error.message);
        })
        .finally(() => {
          if (active) setBusy(false);
        });
    } else if (!fresh) {
      Promise.resolve().then(() => {
        try {
          const raw = JSON.parse(
            localStorage.getItem("tourism.profile") || "null",
          );
          const draft = profileSchema.safeParse(raw);
          if (active && draft.success)
            setProfile({
              ...draft.data,
              draftName: "",
              selectedOfferIds: offer
                ? [...new Set([...draft.data.selectedOfferIds, offer])]
                : draft.data.selectedOfferIds,
            });
        } catch {
          /* Keep the editable defaults. */
        }
      });
    }
    return () => {
      active = false;
    };
  }, [id, offer, fresh]);
  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((previous) => {
      const next = { ...previous, [key]: value };
      if (!id) localStorage.setItem("tourism.profile", JSON.stringify(next));
      return next;
    });
    setStatus("Changes are ready to review.");
  }
  function review() {
    const result = profileSchema.safeParse(profile);
    if (!result.success) {
      setStatus(result.error.issues.map((issue) => issue.message).join(" "));
      return;
    }
    recognition.current?.stop();
    setListening(false);
    setHasReviewed(true);
    setStage("review");
    setStatus("Check your details before saving this draft.");
  }
  function speak() {
    const browser = window as unknown as {
      SpeechRecognition?: new () => Speech;
      webkitSpeechRecognition?: new () => Speech;
    };
    const Constructor =
      browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Constructor) {
      setStatus(
        "Voice is unavailable in this browser. Type your message or choose manual details.",
      );
      return;
    }
    const speech = new Constructor();
    recognition.current = speech;
    speech.lang = "en-NG";
    speech.onresult = (event) =>
      setNote((previous) =>
        `${previous} ${Array.from(event.results)
          .map((result) => result[0].transcript)
          .join(" ")}`.trim(),
      );
    speech.onerror = () => {
      setListening(false);
      setStatus(
        "Microphone unavailable. Type your message or enter details manually.",
      );
    };
    speech.onend = () => setListening(false);
    try {
      speech.start();
      setListening(true);
    } catch {
      setStatus("Voice could not start. Please retry or type your message.");
    }
  }
  async function askKemi() {
    setBusy(true);
    setStatus("Preparing your trip summary...");
    try {
      const response = await fetch("/api/v1/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, message: note }),
      });
      const body = await response.json();
      if (!response.ok) throw Error(body.error.message);
      recognition.current?.stop();
      setListening(false);
      setProfile(body.data.profile);
      localStorage.setItem(
        "tourism.profile",
        JSON.stringify(body.data.profile),
      );
      setHasReviewed(true);
      setStage("review");
      setStatus(
        body.data.changes.length
          ? "Kemi updated your summary. Review every detail, then save your draft."
          : "No new details were recognised. Review the summary or edit your details manually.",
      );
      setNote("");
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Please retry. Your details are retained.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function save(asNew = false) {
    setBusy(true);
    setStatus("Saving your draft...");
    try {
      const submitted = {
        ...profile,
        draftName: profile.draftName?.trim() || "My Lagos trip",
        selectedOfferIds: [
          ...new Set([...bucket, ...(offer ? [offer] : [])]),
        ].slice(0, 30),
      };
      const existing = saved && !asNew;
      const response = await fetch(
        existing ? `/api/v1/trips/${saved.id}` : "/api/v1/trips",
        {
          method: existing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            existing
              ? { expectedVersion: saved.version, profile: submitted }
              : submitted,
          ),
        },
      );
      const body = await response.json();
      if (!response.ok) throw Error(body.error.message);
      setSaved(body.data);
      setProfile(body.data.profile);
      setStage("saved");
      localStorage.setItem(
        "tourism.profile",
        JSON.stringify(body.data.profile),
      );
      activateTrip(body.data.id);
      setStatus("Draft saved. Your bucket is still here. Nothing is booked.");
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Save failed. Your details are retained.",
      );
    } finally {
      setBusy(false);
    }
  }
  function edit(nextMode: "chat" | "form") {
    setMode(nextMode);
    setStage("details");
    setStatus("");
  }
  const rows = [
    ["Destination", "Lagos, Nigeria"],
    ["Travel dates", `${profile.startDate} to ${profile.endDate}`],
    ["Travellers", `${profile.adults} adults`],
    [
      "Starting area",
      `${profile.accommodation || "Not decided"}${profile.zoneId !== "UNDECIDED" ? ` / ${profile.zoneId}` : ""}`,
    ],
    [
      "Interests",
      profile.interests
        .map(
          (interest) =>
            categories.find((category) => category.id === interest)?.label,
        )
        .join(", "),
    ],
    [
      "Budget",
      `NGN ${(profile.budgetMinor / 100).toLocaleString("en-NG")} / ${profile.budgetBasis === "PERSON" ? "person" : "whole party"}`,
    ],
    ["Pace", profile.pace.toLowerCase()],
    [
      "Transport",
      profile.transport === "OWN"
        ? "Own transport requested"
        : "Dedicated vehicle",
    ],
    ["Guide", profile.assistance.replaceAll("_", " ").toLowerCase()],
    ["Dietary requirements", profile.dietary || "None specified"],
    ["Accessibility", profile.accessibility || "None specified"],
    ["Walking comfort", profile.walking.toLowerCase()],
    ["Alcohol", profile.alcohol === "NO_ALCOHOL" ? "No alcohol" : "Optional"],
    ["Occasion / requests", profile.occasion || "None specified"],
  ];
  return (
    <section className="intake-page">
      <nav className="journey-steps" aria-label="Trip planning steps">
        <span aria-current={stage === "details" ? "step" : undefined}>
          1. Your details
        </span>
        <span aria-current={stage === "review" ? "step" : undefined}>
          2. Review summary
        </span>
        <span aria-current={stage === "saved" ? "step" : undefined}>
          3. Save & explore
        </span>
      </nav>
      <p className="eyebrow">YOUR TRIP, ONE STEP AT A TIME</p>
      <h1 ref={heading} tabIndex={-1}>
        {stage === "saved"
          ? "Your trip draft is ready."
          : stage === "review"
            ? "Does this feel like your trip?"
            : mode === "chat"
              ? "Tell Kemi about your trip."
              : "Make the trip yours."}
      </h1>
      <p className="lede">
        {stage === "saved"
          ? "Explore ideas first or start organising your days. You can return to your profile and create more drafts at any time."
          : stage === "review"
            ? "Review the details Kemi will use to tailor your trip. Edit them yourself or ask Kemi to make a change."
            : "Start with your dates, who is coming and what you love. Your next step is a summary you can review before saving."}
      </p>
      {stage === "details" && (
        <div className="intake-workspace card form-card">
          <div className="chips">
            <button
              type="button"
              aria-pressed={mode === "chat"}
              onClick={() => {
                recognition.current?.stop();
                setListening(false);
                setMode("chat");
              }}
            >
              Talk to Kemi
            </button>
            <button
              type="button"
              aria-pressed={mode === "form"}
              onClick={() => {
                recognition.current?.stop();
                setListening(false);
                setMode("form");
              }}
            >
              Enter details manually
            </button>
          </div>
          {mode === "chat" ? (
            <div className="kemi-conversation">
              <div className="kemi-message">
                <span className="kemi-avatar" aria-hidden="true">
                  K
                </span>
                <div>
                  <h2>
                    {hasReviewed
                      ? "What would you like to change?"
                      : "Hello, I'm Kemi."}
                  </h2>
                  <p>
                    {hasReviewed
                      ? "Your current details are kept. Tell me only what needs changing, then review the updated summary."
                      : "Tell me when you're visiting Lagos, how many adults are coming, and what makes a great trip for you."}
                  </p>
                </div>
              </div>
              <label htmlFor="kemi-message">
                {hasReviewed
                  ? "Ask Kemi to edit your trip"
                  : "Your trip, in your own words"}
                <textarea
                  id="kemi-message"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={3000}
                  placeholder={
                    hasReviewed
                      ? "Make the pace relaxed. Budget: NGN 500000. Dietary: vegetarian."
                      : "2026-11-10 to 2026-11-16, 2 adults. We love art, food and nature. Base: Lekki. Budget: NGN 500000."
                  }
                />
              </label>
              <div className="conversation-actions">
                <button
                  className="secondary"
                  type="button"
                  disabled={busy}
                  aria-pressed={listening}
                  onClick={() => {
                    if (listening) {
                      recognition.current?.stop();
                      setListening(false);
                    } else speak();
                  }}
                >
                  {listening ? "Stop listening" : "Use voice"}
                </button>
                <button
                  disabled={busy || !note.trim()}
                  onClick={() => void askKemi()}
                >
                  {busy
                    ? "Preparing summary..."
                    : hasReviewed
                      ? "Review Kemi's changes"
                      : "Review my trip summary"}
                </button>
              </div>
              <p className="muted">
                Voice uses your browser&apos;s speech service. Kemi&apos;s demo
                helper recognises dates and simple preferences. You can correct
                every field in the next step.
              </p>
              {hasReviewed && (
                <button
                  className="text-button"
                  onClick={() => setStage("review")}
                >
                  Back to my summary
                </button>
              )}
            </div>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                review();
              }}
            >
              <label>
                Draft name (optional)
                <input
                  maxLength={80}
                  value={profile.draftName ?? ""}
                  onChange={(event) => update("draftName", event.target.value)}
                  placeholder="A relaxed week in Lagos"
                />
              </label>
              <fieldset disabled={busy}>
                <legend>01 / Dates & travellers</legend>
                <div className="field-grid">
                  <label>
                    City
                    <select value={profile.cityId} onChange={() => {}}>
                      <option value="lagos">Lagos</option>
                      <option disabled>Abuja · coming soon</option>
                    </select>
                  </label>
                  <label>
                    Adults (18+)
                    <input
                      type="number"
                      min="1"
                      max="8"
                      value={profile.adults}
                      onChange={(e) => update("adults", Number(e.target.value))}
                    />
                  </label>
                  <label>
                    Arrival date
                    <input
                      required
                      type="date"
                      value={profile.startDate}
                      onChange={(e) => update("startDate", e.target.value)}
                    />
                  </label>
                  <label>
                    Departure date
                    <input
                      required
                      type="date"
                      value={profile.endDate}
                      onChange={(e) => update("endDate", e.target.value)}
                    />
                  </label>
                </div>
                <p className="muted">
                  1–30 days. All service dates and times use Africa/Lagos.
                </p>
              </fieldset>
              <fieldset disabled={busy}>
                <legend>02 / The things you love</legend>
                <div className="interest-grid">
                  {categories.map((c) => (
                    <label className="check" key={c.id}>
                      <input
                        type="checkbox"
                        checked={profile.interests.includes(
                          c.id as Profile["interests"][number],
                        )}
                        onChange={(e) =>
                          update(
                            "interests",
                            e.target.checked
                              ? [
                                  ...profile.interests,
                                  c.id as Profile["interests"][number],
                                ]
                              : profile.interests.filter((i) => i !== c.id),
                          )
                        }
                      />
                      {c.label}
                    </label>
                  ))}
                </div>
                <label>
                  Anything you’d like us to celebrate? (optional)
                  <input
                    maxLength={160}
                    value={profile.occasion}
                    onChange={(e) => update("occasion", e.target.value)}
                  />
                </label>
                <label>
                  Your pace
                  <select
                    value={profile.pace}
                    onChange={(e) =>
                      update("pace", e.target.value as Profile["pace"])
                    }
                  >
                    <option value="RELAXED">Relaxed</option>
                    <option value="BALANCED">Balanced</option>
                    <option value="FULL">Full</option>
                  </select>
                </label>
              </fieldset>
              <label>
                Accessibility requirements
                <input
                  maxLength={300}
                  value={profile.accessibility ?? ""}
                  onChange={(e) => update("accessibility", e.target.value)}
                />
              </label>
              <label>
                Transport preference
                <select
                  value={profile.transport ?? "DEDICATED"}
                  onChange={(e) =>
                    update("transport", e.target.value as Profile["transport"])
                  }
                >
                  <option value="DEDICATED">Dedicated vehicle</option>
                  <option value="OWN">Own transport (request)</option>
                </select>
              </label>
              <fieldset disabled={busy}>
                <legend>03 / Your base & support</legend>
                <label>
                  Accommodation / pickup base (optional for a draft)
                  <input
                    maxLength={300}
                    placeholder="Not decided yet"
                    value={profile.accommodation}
                    onChange={(e) => update("accommodation", e.target.value)}
                  />
                </label>
                <div className="field-grid">
                  <label>
                    Service zone
                    <select
                      value={profile.zoneId}
                      onChange={(e) =>
                        update("zoneId", e.target.value as Profile["zoneId"])
                      }
                    >
                      <option value="UNDECIDED">Not decided</option>
                      <option>LEKKI</option>
                      <option>VI</option>
                      <option>MAINLAND</option>
                    </select>
                  </label>
                  <label>
                    Assistance
                    <select
                      value={profile.assistance}
                      onChange={(e) =>
                        update(
                          "assistance",
                          e.target.value as Profile["assistance"],
                        )
                      }
                    >
                      <option value="DRIVER_ONLY">Driver only</option>
                      <option value="ACTIVITY_GUIDE">
                        Selected-activity guide
                      </option>
                      <option value="FULL_DAY_GUIDE">Full-day guide</option>
                    </select>
                  </label>
                  <label>
                    Budget (NGN)
                    <input
                      type="number"
                      min="0"
                      max="100000000"
                      value={profile.budgetMinor / 100}
                      onChange={(e) =>
                        update(
                          "budgetMinor",
                          Math.round(Number(e.target.value) * 100),
                        )
                      }
                    />
                  </label>
                  <label>
                    Budget basis
                    <select
                      value={profile.budgetBasis}
                      onChange={(e) =>
                        update(
                          "budgetBasis",
                          e.target.value as Profile["budgetBasis"],
                        )
                      }
                    >
                      <option value="PARTY">Whole party</option>
                      <option value="PERSON">Per person</option>
                    </select>
                  </label>
                </div>
                <p className="muted">
                  Budget covers platform services; excludes flights and
                  accommodation. Transport is included for off-base booked
                  experiences under each assistance level, with separate price
                  lines.
                </p>
                <label>
                  Dietary requests (optional)
                  <input
                    maxLength={300}
                    value={profile.dietary}
                    onChange={(e) => update("dietary", e.target.value)}
                  />
                </label>
                <div className="field-grid">
                  <label>
                    Alcohol preference
                    <select
                      value={profile.alcohol}
                      onChange={(e) =>
                        update("alcohol", e.target.value as Profile["alcohol"])
                      }
                    >
                      <option value="OPTIONAL">Optional</option>
                      <option value="NO_ALCOHOL">No alcohol</option>
                    </select>
                  </label>
                  <label>
                    Walking comfort
                    <select
                      value={profile.walking}
                      onChange={(e) =>
                        update("walking", e.target.value as Profile["walking"])
                      }
                    >
                      <option value="MODERATE">Moderate</option>
                      <option value="LOW">Low</option>
                    </select>
                  </label>
                </div>
              </fieldset>

              <div className="form-footer">
                <button type="submit" disabled={busy}>
                  Review trip summary
                </button>
                {hasReviewed && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setStage("review")}
                  >
                    Back to summary
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      )}
      {stage === "review" && (
        <div className="review-layout">
          <div className="card trip-review">
            <label>
              Give this draft a name
              <input
                value={profile.draftName ?? ""}
                maxLength={80}
                onChange={(event) => update("draftName", event.target.value)}
                placeholder="A relaxed week in Lagos"
              />
            </label>
            <dl className="trip-summary-grid">
              {rows.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <div className="actions">
              <button
                className="secondary"
                disabled={busy}
                onClick={() => edit("form")}
              >
                Edit details manually
              </button>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => edit("chat")}
              >
                Ask Kemi to edit
              </button>
            </div>
          </div>
          <aside className="card review-next">
            <p className="eyebrow">NEXT: YOUR DRAFT</p>
            <h2>Save a starting point.</h2>
            <p>
              This saves your trip preferences. Your {bucket.length} bucket
              activities stay saved, without a scheduled time or booking.
            </p>
            <button disabled={busy} onClick={() => void save()}>
              {busy
                ? "Saving..."
                : saved
                  ? "Save draft changes"
                  : "Save my trip draft"}
            </button>
            {saved && (
              <button
                className="secondary"
                disabled={busy}
                onClick={() => void save(true)}
              >
                Save as another draft
              </button>
            )}
            <p className="muted">
              Keep different drafts for different dates, budgets or travel
              styles. Saving a new draft leaves the original in My trips.
            </p>
          </aside>
        </div>
      )}
      {stage === "saved" && saved && (
        <div className="saved-journey">
          <div className="saved-draft-banner">
            <span className="saved-mark" aria-hidden="true">
              &#10003;
            </span>
            <div>
              <p className="eyebrow">DRAFT SAVED</p>
              <h2>{profile.draftName || "My Lagos trip"}</h2>
              <p>
                {profile.startDate} to {profile.endDate} / {profile.adults}{" "}
                adults / {bucket.length} saved activities
              </p>
            </div>
          </div>
          <div className="next-step-grid">
            <article className="card next-step-card">
              <span className="step-number">01</span>
              <h2>Explore experiences</h2>
              <p>
                Browse ideas and add favourites to your bucket. The bucket is a
                shortlist: it doesn&apos;t book activities or give them a time.
              </p>
              <Link
                className="button"
                href={`/explore?trip=${saved.id}`}
                onClick={onContinue}
              >
                Explore & add to bucket
              </Link>
            </article>
            <article className="card next-step-card">
              <span className="step-number">02</span>
              <h2>Open your trip planner</h2>
              <p>
                Use My Bucket for your saved ideas, or All Experiences for the
                full catalogue. Add activities to your days and choose valid
                times.
              </p>
              <Link
                className="button secondary"
                href={`/trips/${saved.id}/plan`}
                onClick={onContinue}
              >
                Go to my trip
              </Link>
            </article>
          </div>
          <div className="actions">
            <button
              className="secondary"
              onClick={() => {
                setStage("review");
                setStatus("");
              }}
            >
              Review or create another draft
            </button>
            <Link href="/trips" onClick={onContinue}>
              See all my trip drafts
            </Link>
            <button
              className="text-button"
              onClick={() => {
                setSaved(null);
                setProfile({ ...initialProfile, draftName: "" });
                setHasReviewed(false);
                setMode("chat");
                setStage("details");
                setStatus("");
                localStorage.removeItem("tourism.profile");
              }}
            >
              Start a different trip
            </button>
          </div>
        </div>
      )}
      <p className="save-status" role="status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
