"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { destinations } from "@/modules/catalogue/domain/destinations";
import Icon from "./icons";

// Home search: where (only destinations with inventory) and, optionally, when.
export default function DestinationSearch({ today }: { today: string }) {
  const router = useRouter();
  const [city, setCity] = useState(destinations[0].id);
  const [when, setWhen] = useState("");
  // "My dates": a visit, or a single day when both dates match.
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  function explore() {
    const query = new URLSearchParams({ city });
    if (when === "range") {
      if (from) query.set("from", from);
      query.set(from ? "to" : "when", from ? to || from : "range");
    } else if (when) query.set("date", when);
    router.push(`/explore?${query}`);
  }
  return (
    <form
      className="destination-search"
      onSubmit={(event) => {
        event.preventDefault();
        explore();
      }}
    >
      <div className="destination-search-fields">
        <label className="destination-field">
          <span>
            <Icon name="pin" size={16} /> Where
          </span>
          <select value={city} onChange={(e) => setCity(e.target.value)}>
            {destinations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="destination-when">
          <legend>
            <Icon name="calendar" size={16} /> When
          </legend>
          <div className="chip-row">
            {[
              ["", "Any date"],
              [today, "Today"],
              ["weekend", "This weekend"],
              ["range", "My dates"],
            ].map(([value, label]) => (
              <button
                type="button"
                key={label}
                className="chip"
                aria-pressed={when === value}
                onClick={() => setWhen(value)}
              >
                {label}
              </button>
            ))}
          </div>
          {when === "range" && (
            <div className="destination-range">
              <label className="destination-date">
                <span>From</span>
                <input
                  type="date"
                  min={today}
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    if (to && e.target.value > to) setTo(e.target.value);
                  }}
                />
              </label>
              <label className="destination-date">
                <span>Until</span>
                <input
                  type="date"
                  min={from || today}
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
            </div>
          )}
        </fieldset>
      </div>
      <button type="submit" className="hero-cta hero-cta--primary">
        Explore experiences
        <Icon name="arrowRight" size={18} />
      </button>
    </form>
  );
}
