"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  initialProfile,
  profileSchema,
  type Profile,
} from "@/modules/trips/domain/profile";
import {
  formatMoney,
  zoneLabel,
} from "@/modules/catalogue/domain/experience-content";
import categories from "../../tourism-v1-handoff/data/categories.json";
import { useBucket } from "@/hooks/use-bucket";
import { activateTrip } from "@/hooks/use-active-trip";
import Icon from "./icons";
import { TripEvents } from "./whats-on";

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
const suggestions = [
  "2 adults",
  "We love art, food and nature",
  "Base: Lekki",
  "Relaxed pace",
  "Budget: NGN 500000",
  "It’s our anniversary",
];
const paceLabels: Record<Profile["pace"], string> = {
  RELAXED: "relaxed",
  BALANCED: "balanced",
  FULL: "full",
};
const assistanceLabels: Record<Profile["assistance"], string> = {
  DRIVER_ONLY: "Driver only",
  ACTIVITY_GUIDE: "Guide for selected activities",
  FULL_DAY_GUIDE: "Full-day guide",
};
function longDate(value: string) {
  const date = new Date(value + "T12:00:00Z");
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
}
export default function Intake({
  id,
  mode: entry = "chat",
  offer,
  fresh = false,
  embedded = false,
  onContinue,
  onSaved,
}: {
  id?: string;
  mode?: string;
  offer?: string;
  fresh?: boolean;
  embedded?: boolean;
  onContinue?: () => void;
  onSaved?: (id: string) => void;
}) {
  const router = useRouter();
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
  const [questions, setQuestions] = useState<string[]>([]);
  const [listening, setListening] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(!!id);
  const recognition = useRef<Speech | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);
  useEffect(() => () => recognition.current?.stop(), []);
  useEffect(() => {
    // Move focus to the new step heading, but not on first render.
    if (mounted.current) heading.current?.focus();
    mounted.current = true;
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
            setStatus("");
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
  // A session can expire mid-journey: keep the details and come back here
  // after signing in.
  function signInAgain(current: Profile) {
    if (!id) localStorage.setItem("tourism.profile", JSON.stringify(current));
    onContinue?.();
    router.push(
      `/account?next=${encodeURIComponent(id ? `/trips/${id}/profile` : "/plan/new")}`,
    );
  }
  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((previous) => {
      const next = { ...previous, [key]: value };
      if (!id) localStorage.setItem("tourism.profile", JSON.stringify(next));
      return next;
    });
    setStatus("");
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
    setQuestions([]);
    setStage("review");
    setStatus("");
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
      setStatus("Listening… speak naturally, then press Stop.");
    } catch {
      setStatus("Voice could not start. Please retry or type your message.");
    }
  }
  async function askKemi() {
    setBusy(true);
    setStatus("Kemi is reading your message…");
    try {
      const response = await fetch("/api/v1/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, message: note }),
      });
      if (response.status === 401) return signInAgain(profile);
      const body = await response.json();
      if (!response.ok) throw Error(body.error.message);
      recognition.current?.stop();
      setListening(false);
      setProfile(body.data.profile);
      setQuestions(body.data.questions ?? []);
      localStorage.setItem(
        "tourism.profile",
        JSON.stringify(body.data.profile),
      );
      setHasReviewed(true);
      setStage("review");
      setStatus(
        body.data.changes.length
          ? "Kemi updated your summary. Check every detail before saving."
          : "Kemi didn’t find new details. Review the summary or edit it yourself.",
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
    setStatus("Saving your trip…");
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
      if (response.status === 401) return signInAgain(profile);
      const body = await response.json();
      if (!response.ok) throw Error(body.error.message);
      setSaved(body.data);
      setProfile(body.data.profile);
      localStorage.setItem(
        "tourism.profile",
        JSON.stringify(body.data.profile),
      );
      activateTrip(body.data.id);
      onSaved?.(body.data.id);
      setStage("saved");
      setStatus("");
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
  function chooseMode(next: "chat" | "form") {
    recognition.current?.stop();
    setListening(false);
    setMode(next);
  }
  const rows: [string, string, boolean?][] = [
    ["Destination", "Lagos, Nigeria"],
    [
      "Travel dates",
      `${longDate(profile.startDate)} – ${longDate(profile.endDate)}`,
    ],
    ["Travellers", `${profile.adults} adults`],
    [
      "Staying in",
      profile.accommodation
        ? `${profile.accommodation}${profile.zoneId !== "UNDECIDED" ? ` · ${zoneLabel(profile.zoneId)}` : ""}`
        : profile.zoneId !== "UNDECIDED"
          ? zoneLabel(profile.zoneId)
          : "Not decided yet",
      !profile.accommodation && profile.zoneId === "UNDECIDED",
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
      `${formatMoney(profile.budgetMinor)} ${profile.budgetBasis === "PERSON" ? "per person" : "for the whole party"}`,
    ],
    ["Pace", paceLabels[profile.pace]],
    [
      "Transport",
      profile.transport === "OWN"
        ? "Own transport (request)"
        : "Dedicated vehicle",
    ],
    ["Guide", assistanceLabels[profile.assistance]],
    ["Dietary needs", profile.dietary || "None", !profile.dietary],
    ["Accessibility", profile.accessibility || "None", !profile.accessibility],
    ["Walking comfort", profile.walking === "LOW" ? "Low" : "Moderate"],
    ["Alcohol", profile.alcohol === "NO_ALCOHOL" ? "No alcohol" : "Optional"],
    ["Occasion or requests", profile.occasion || "None", !profile.occasion],
  ];
  const stepIndex = stage === "details" ? 0 : stage === "review" ? 1 : 2;
  const steps = ["Your details", "Check summary", "Saved"];
  return (
    <section
      className={`intake-page ${embedded ? "intake-page--embedded" : ""}`}
      data-chat={(stage === "details" && mode === "chat") || undefined}
    >
      <ol className="journey-steps" aria-label="Trip planning steps">
        {steps.map((label, index) => (
          <li
            key={label}
            aria-current={index === stepIndex ? "step" : undefined}
            data-done={index < stepIndex}
          >
            {label}
          </li>
        ))}
      </ol>
      <div className="intake-heading">
        {!embedded && (
          <p className="eyebrow">
            {stage === "saved" ? "Trip saved" : "Plan your stay"}
          </p>
        )}
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
            ? "Nothing is booked. Add more ideas to your bucket, or start arranging your days."
            : stage === "review"
              ? "This is the profile Kemi and the planner will use. Correct anything that isn’t right."
              : "Your dates, who’s coming and what you love. You’ll check a summary before anything is saved."}
        </p>
      </div>
      {stage === "details" && (
        <div className="intake-workspace">
          <div
            className="method-switch segmented"
            role="group"
            aria-label="How would you like to share your details?"
          >
            <button
              type="button"
              aria-pressed={mode === "chat"}
              onClick={() => chooseMode("chat")}
            >
              <Icon name="chat" size={18} />
              Talk to Kemi
            </button>
            <button
              type="button"
              aria-pressed={mode === "form"}
              onClick={() => chooseMode("form")}
            >
              <Icon name="list" size={18} />
              Enter details manually
            </button>
          </div>
          {mode === "chat" ? (
            <div className="kemi-conversation">
              <div className="kemi-message">
                <span className="kemi-avatar" aria-hidden="true">
                  K
                </span>
                <div className="kemi-bubble">
                  <h2>
                    {hasReviewed
                      ? "What would you like to change?"
                      : "Hello, I’m Kemi."}
                  </h2>
                  <p>
                    {hasReviewed
                      ? "I’ll keep everything you’ve told me. Just mention what’s different."
                      : "When are you visiting Lagos, how many adults are coming, and what makes a great trip for you?"}
                  </p>
                </div>
              </div>
              <div className="composer">
                <label htmlFor="kemi-message" className="sr-only">
                  {hasReviewed
                    ? "Ask Kemi to edit your trip"
                    : "Your trip, in your own words"}
                </label>
                <div className="composer-box">
                  <textarea
                    id="kemi-message"
                    rows={2}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    onKeyDown={(event) => {
                      // Enter sends, as in any chat; Shift+Enter adds a line.
                      if (
                        event.key === "Enter" &&
                        !event.shiftKey &&
                        !event.nativeEvent.isComposing
                      ) {
                        event.preventDefault();
                        if (note.trim() && !busy) void askKemi();
                      }
                    }}
                    maxLength={3000}
                    placeholder={
                      hasReviewed
                        ? "Make the pace relaxed. Budget: NGN 500000. Dietary: vegetarian."
                        : "2026-11-10 to 2026-11-16, 2 adults. We love art, food and nature. Base: Lekki."
                    }
                  />
                  <div className="composer-actions">
                    <button
                      className="voice-button"
                      type="button"
                      disabled={busy}
                      aria-pressed={listening}
                      aria-label={listening ? "Stop listening" : "Use voice"}
                      title={listening ? "Stop listening" : "Use voice"}
                      onClick={() => {
                        if (listening) {
                          recognition.current?.stop();
                          setListening(false);
                          setStatus("");
                        } else speak();
                      }}
                    >
                      <Icon name="mic" size={18} />
                    </button>
                    <span className="composer-keys">
                      {busy && "Preparing your summary…"}
                    </span>
                    <button
                      type="button"
                      className="composer-send"
                      disabled={busy || !note.trim()}
                      aria-label={
                        busy
                          ? "Preparing summary..."
                          : hasReviewed
                            ? "Review Kemi's changes"
                            : "Review my trip summary"
                      }
                      title={
                        hasReviewed
                          ? "Review Kemi's changes"
                          : "Review my trip summary"
                      }
                      onClick={() => void askKemi()}
                    >
                      <Icon name="arrowUp" size={20} />
                    </button>
                  </div>
                </div>
                <div className="suggestion-row" aria-label="Quick additions">
                  {suggestions.map((text) => (
                    <button
                      key={text}
                      type="button"
                      className="chip"
                      onClick={() =>
                        setNote((previous) =>
                          `${previous.trim()}${previous.trim() ? ". " : ""}${text}`.trim(),
                        )
                      }
                    >
                      <Icon name="plus" size={14} />
                      {text}
                    </button>
                  ))}
                </div>
                <p className="composer-note">
                  Write dates as YYYY-MM-DD. Voice uses your browser’s speech
                  service. You’ll check everything before it’s saved.
                </p>
              </div>
              {hasReviewed && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setStage("review")}
                >
                  Back to my summary
                </button>
              )}
            </div>
          ) : (
            <form
              className="intake-form"
              onSubmit={(event) => {
                event.preventDefault();
                review();
              }}
            >
              <fieldset className="form-section" disabled={busy}>
                <legend>When and who</legend>
                <div className="field-grid">
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
                    City
                    <select value={profile.cityId} onChange={() => {}}>
                      <option value="lagos">Lagos</option>
                      <option disabled>Abuja · coming soon</option>
                    </select>
                  </label>
                </div>
                <p className="form-hint">
                  Trips of 1–30 days. All times are Lagos time.
                </p>
                <TripEvents start={profile.startDate} end={profile.endDate} />
              </fieldset>
              <fieldset className="form-section" disabled={busy}>
                <legend>What you love</legend>
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
                <div className="field-grid">
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
                  <label>
                    Anything to celebrate? (optional)
                    <input
                      maxLength={160}
                      value={profile.occasion}
                      onChange={(e) => update("occasion", e.target.value)}
                    />
                  </label>
                </div>
              </fieldset>
              <fieldset className="form-section" disabled={busy}>
                <legend>Where you’re staying and getting around</legend>
                <div className="field-grid">
                  <label>
                    Accommodation or starting area (optional)
                    <input
                      maxLength={300}
                      placeholder="Not decided yet"
                      value={profile.accommodation}
                      onChange={(e) => update("accommodation", e.target.value)}
                    />
                  </label>
                  <label>
                    Area
                    <select
                      value={profile.zoneId}
                      onChange={(e) =>
                        update("zoneId", e.target.value as Profile["zoneId"])
                      }
                    >
                      <option value="UNDECIDED">Not decided</option>
                      <option value="LEKKI">Lekki</option>
                      <option value="VI">Victoria Island</option>
                      <option value="MAINLAND">Mainland</option>
                    </select>
                  </label>
                  <label>
                    Transport preference
                    <select
                      value={profile.transport ?? "DEDICATED"}
                      onChange={(e) =>
                        update(
                          "transport",
                          e.target.value as Profile["transport"],
                        )
                      }
                    >
                      <option value="DEDICATED">Dedicated vehicle</option>
                      <option value="OWN">Own transport (request)</option>
                    </select>
                  </label>
                  <label>
                    Guide preference
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
                        Guide for selected activities
                      </option>
                      <option value="FULL_DAY_GUIDE">Full-day guide</option>
                    </select>
                  </label>
                </div>
              </fieldset>
              <fieldset className="form-section" disabled={busy}>
                <legend>Budget and needs</legend>
                <div className="field-grid">
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
                    Budget is for
                    <select
                      value={profile.budgetBasis}
                      onChange={(e) =>
                        update(
                          "budgetBasis",
                          e.target.value as Profile["budgetBasis"],
                        )
                      }
                    >
                      <option value="PARTY">The whole party</option>
                      <option value="PERSON">Each person</option>
                    </select>
                  </label>
                </div>
                <p className="form-hint">
                  Covers experiences, transport and guides — not flights or
                  accommodation.
                </p>
                <div className="field-grid">
                  <label>
                    Dietary requests (optional)
                    <input
                      maxLength={300}
                      value={profile.dietary}
                      onChange={(e) => update("dietary", e.target.value)}
                    />
                  </label>
                  <label>
                    Accessibility requirements (optional)
                    <input
                      maxLength={300}
                      value={profile.accessibility ?? ""}
                      onChange={(e) => update("accessibility", e.target.value)}
                    />
                  </label>
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
                  Next: check summary
                  <Icon name="arrowRight" size={18} />
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
          <div className="card form-card trip-review">
            {questions.length > 0 && (
              <div className="kemi-message">
                <span className="kemi-avatar" aria-hidden="true">
                  K
                </span>
                <div className="kemi-bubble">
                  <h2>A couple of things to check</h2>
                  {questions.map((question) => (
                    <p key={question}>{question}</p>
                  ))}
                </div>
              </div>
            )}
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
              {rows.map(([label, value, missing]) => (
                <div key={label} data-missing={!!missing}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <TripEvents start={profile.startDate} end={profile.endDate} />
            <div className="actions">
              <button
                className="secondary"
                disabled={busy}
                onClick={() => edit("form")}
              >
                <Icon name="edit" size={16} />
                Edit details manually
              </button>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => edit("chat")}
              >
                <Icon name="chat" size={16} />
                Ask Kemi to edit
              </button>
            </div>
          </div>
          <aside className="review-next">
            <p className="eyebrow">Next</p>
            <h2>Save your starting point</h2>
            <p>
              Your {bucket.length} saved{" "}
              {bucket.length === 1 ? "activity comes" : "activities come"} with
              you, still unscheduled and unbooked.
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
            <p>
              Drafts are saved to your account. You can keep several for
              different dates or budgets.
            </p>
          </aside>
        </div>
      )}
      {stage === "saved" && saved && (
        <div className="saved-journey">
          <div className="saved-draft-banner">
            <span className="saved-mark" aria-hidden="true">
              <Icon name="check" size={22} />
            </span>
            <div>
              <p className="eyebrow">Draft saved</p>
              <h2>{profile.draftName || "My Lagos trip"}</h2>
              <p>
                {longDate(profile.startDate)} – {longDate(profile.endDate)} ·{" "}
                {profile.adults} adults · {bucket.length} saved{" "}
                {bucket.length === 1 ? "activity" : "activities"}
              </p>
            </div>
          </div>
          <h3 className="saved-question">What would you like to do next?</h3>
          <div className="next-step-grid">
            <article className="card next-step-card">
              <span className="step-number" aria-hidden="true">
                <Icon name="compass" size={18} />
              </span>
              <h2>Explore experiences</h2>
              <p>
                Browse Lagos and add favourites to your bucket. Saving doesn’t
                book an activity or give it a time.
              </p>
              <Link
                className="button"
                href={`/explore?trip=${saved.id}`}
                onClick={onContinue}
              >
                Explore experiences
                <Icon name="arrowRight" size={18} />
              </Link>
            </article>
            <article className="card next-step-card">
              <span className="step-number" aria-hidden="true">
                <Icon name="list" size={18} />
              </span>
              <h2>Go to my drafts</h2>
              <p>
                See this draft beside your other trips. Open the planner from
                any draft whenever you’re ready to arrange your days.
              </p>
              <Link
                className="button secondary"
                href={`/trips?saved=${saved.id}`}
                onClick={onContinue}
              >
                Go to my drafts
                <Icon name="arrowRight" size={18} />
              </Link>
            </article>
          </div>
          <div className="actions saved-more">
            <Link
              className="text-link"
              href={`/trips/${saved.id}/plan`}
              onClick={onContinue}
            >
              Or open the trip planner now
            </Link>
            <button
              className="text-button"
              onClick={() => {
                setStage("review");
                setStatus("");
              }}
            >
              Edit this draft
            </button>
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
