"use client";
import { useEffect, useId, useState } from "react";
import { zoneLabel } from "@/modules/catalogue/domain/experience-content";
import {
  linkSources,
  readStayLink,
  stayRecommendHours,
  stayTypes,
  type Profile,
  type StayChoice,
  type StayRequest,
  type StayType,
} from "@/modules/trips/domain/profile";
import type { HotelMatch } from "@/modules/trips/domain/hotels";
import Icon from "./icons";

const recommend: StayChoice = { kind: "RECOMMEND" };

function ChosenPlace({
  choice,
  onChange,
}: {
  choice: StayChoice;
  onChange: () => void;
}) {
  const label =
    choice.kind === "LISTED"
      ? choice.name
      : choice.kind === "NAMED"
        ? `${choice.name} · we’ll check it for you`
        : choice.kind === "LINK"
          ? `${linkSources[choice.source]} · ${new URL(choice.url).hostname}`
          : `No preference · we’ll send you stay recommendations within ${stayRecommendHours} hours`;
  return (
    <div className="stay-chosen" role="status">
      <Icon
        name={choice.kind === "RECOMMEND" ? "compass" : "check"}
        size={16}
      />
      <span>{label}</span>
      <button type="button" className="text-button" onClick={onChange}>
        Change
      </button>
    </div>
  );
}

// When Fastlife books the stay: the type of place, an optional budget per
// night, then one box that searches our list, keeps a name we don't list,
// or recognises a pasted link. "No preference" asks us to recommend.
export default function StayFields({
  profile,
  onChange,
}: {
  profile: Profile;
  onChange: (stay: StayRequest) => void;
}) {
  const stay: StayRequest = profile.stay ?? {
    type: "HOTEL",
    choice: recommend,
  };
  const [typed, setTyped] = useState("");
  const [searching, setSearching] = useState(!profile.stay);
  const [matches, setMatches] = useState<HotelMatch[]>([]);
  const [error, setError] = useState("");
  const typeLabel = useId();
  const listId = useId();
  const link = readStayLink(typed);
  const looksLikeLink = /^\s*(https?:|www\.)/i.test(typed);

  useEffect(() => {
    const q = typed.trim();
    if (!searching || q.length < 2 || looksLikeLink) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const params = new URLSearchParams({
        q,
        zoneId: profile.zoneId,
        type: stay.type,
      });
      fetch(`/api/v1/hotels?${params}`, { signal: controller.signal })
        .then(async (r) => {
          const body = await r.json();
          if (!r.ok) throw Error(body.error?.message ?? "Search failed.");
          setMatches(body.data);
          setError("");
        })
        .catch((e: Error) => {
          if (e.name !== "AbortError") setError(e.message);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [typed, searching, looksLikeLink, profile.zoneId, stay.type]);

  const choose = (choice: StayChoice) => {
    onChange({ ...stay, choice });
    setSearching(false);
    setTyped("");
    setMatches([]);
  };
  const shown = typed.trim().length >= 2 && !looksLikeLink ? matches : [];

  return (
    <div className="stay-fields">
      <div className="stay-type">
        <span id={typeLabel}>Type of stay</span>
        <div className="chip-row" role="group" aria-labelledby={typeLabel}>
          {(Object.keys(stayTypes) as StayType[]).map((t) => (
            <button
              key={t}
              type="button"
              className="chip"
              aria-pressed={stay.type === t}
              onClick={() => onChange({ ...stay, type: t })}
            >
              {stayTypes[t]}
            </button>
          ))}
        </div>
      </div>
      <div className="field-grid">
        <label>
          Budget per night (NGN, optional)
          <input
            type="number"
            min="0"
            step="5000"
            placeholder="Leave blank if you’re flexible"
            value={
              stay.budgetPerNightMinor === undefined
                ? ""
                : stay.budgetPerNightMinor / 100
            }
            onChange={(e) =>
              onChange({
                ...stay,
                budgetPerNightMinor:
                  e.target.value === ""
                    ? undefined
                    : Math.round(Number(e.target.value) * 100),
              })
            }
          />
        </label>
      </div>
      <div className="stay-place">
        {!searching ? (
          <>
            <span className="stay-place-label">Place in mind</span>
            <ChosenPlace
              choice={stay.choice}
              onChange={() => setSearching(true)}
            />
          </>
        ) : (
          <>
            <label>
              Do you have a place in mind?
              <input
                maxLength={500}
                autoComplete="off"
                placeholder="Hotel name, or paste a Booking.com, Airbnb or hotel link"
                aria-describedby={`${listId}-hint`}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
              />
            </label>
            <p id={`${listId}-hint`} className="form-hint">
              We search our list in{" "}
              {profile.zoneId === "UNDECIDED"
                ? "every area"
                : `${zoneLabel(profile.zoneId)} first`}
              . Not listed? Keep your own choice and we’ll check it.
            </p>
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            {typed.trim() && (
              <ul className="stay-options" id={listId} aria-live="polite">
                {looksLikeLink ? (
                  link ? (
                    <li>
                      <button
                        type="button"
                        onClick={() => choose({ kind: "LINK", ...link })}
                      >
                        <strong>{linkSources[link.source]}</strong>
                        <span>{new URL(link.url).hostname}</span>
                      </button>
                    </li>
                  ) : (
                    <li className="field-error">
                      Paste the full link, starting with https:// (up to 500
                      characters).
                    </li>
                  )
                ) : (
                  <>
                    {shown.map((h) => (
                      <li key={h.id}>
                        <button
                          type="button"
                          onClick={() =>
                            choose({
                              kind: "LISTED",
                              hotelId: h.id,
                              name: h.name,
                            })
                          }
                        >
                          <strong>{h.name}</strong>
                          <span>
                            {zoneLabel(h.zoneId)} · {stayTypes[h.type]}
                          </span>
                        </button>
                      </li>
                    ))}
                    {typed.trim().length >= 2 && (
                      <li>
                        <button
                          type="button"
                          className="stay-own"
                          onClick={() =>
                            choose({
                              kind: "NAMED",
                              name: typed.trim().slice(0, 120),
                            })
                          }
                        >
                          <strong>Use ‘{typed.trim().slice(0, 120)}’</strong>
                          <span>Not on our list; we’ll check it for you</span>
                        </button>
                      </li>
                    )}
                  </>
                )}
              </ul>
            )}
            <div className="stay-place-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => choose(recommend)}
              >
                No preference: recommend somewhere
              </button>
              {profile.stay && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setSearching(false)}
                >
                  Keep my choice
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
