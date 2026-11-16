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
  const [picked, setPicked] = useState("");
  const date = when === "pick" ? picked : when;
  function explore() {
    const query = new URLSearchParams({ city });
    if (date) query.set("date", date);
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
              ["pick", "Pick a date"],
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
          {when === "pick" && (
            <label className="destination-date">
              <span className="sr-only">Date</span>
              <input
                type="date"
                min={today}
                value={picked}
                onChange={(e) => setPicked(e.target.value)}
              />
            </label>
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
