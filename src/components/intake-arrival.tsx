"use client";
import { useId } from "react";
import { formatMoney } from "@/modules/catalogue/domain/experience-content";
import { clockLabel, shortDay } from "@/modules/catalogue/domain/schedule";
import {
  airports,
  type AirportId,
  type AirportPickup,
  type Profile,
} from "@/modules/trips/domain/profile";

// The arrival as one summary line, or null when they haven't said.
export function arrivalSummary(
  p: Pick<Profile, "fromAbroad" | "airportPickup">,
) {
  if (p.fromAbroad === undefined) return null;
  if (!p.fromAbroad) return "From within Nigeria";
  const a = p.airportPickup;
  if (!a) return "From abroad · no airport pickup";
  return [
    `From abroad · airport pickup ${shortDay(a.landingDate)}`,
    a.flight ? `flight ${a.flight}` : "flight to add",
    a.landingTime
      ? `lands ${clockLabel(a.landingTime)}`
      : "landing time to add",
    `${a.travellers} ${a.travellers === 1 ? "traveller" : "travellers"}, ${a.bags} ${a.bags === 1 ? "bag" : "bags"}`,
  ].join(" · ");
}

function YesNo({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | undefined;
  onChange: (value: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="arrival-question">
      <span id={id}>{label}</span>
      <div className="segmented" role="group" aria-labelledby={id}>
        <button
          type="button"
          aria-pressed={value === true}
          onClick={() => onChange(true)}
        >
          Yes
        </button>
        <button
          type="button"
          aria-pressed={value === false}
          onClick={() => onChange(false)}
        >
          No
        </button>
      </div>
    </div>
  );
}

// Asked right after the dates: are they flying in, and should a driver meet
// them? Flight details can wait; the planner reminds them before landing.
export default function ArrivalFields({
  profile,
  priceMinor,
  onChange,
}: {
  profile: Profile;
  priceMinor?: number;
  onChange: (next: Pick<Profile, "fromAbroad" | "airportPickup">) => void;
}) {
  const pickup = profile.airportPickup;
  const set = (changes: Partial<AirportPickup>) =>
    pickup &&
    onChange({ fromAbroad: true, airportPickup: { ...pickup, ...changes } });
  return (
    <div className="arrival-fields" id="arrival">
      <YesNo
        label="Are you travelling from outside Nigeria?"
        value={profile.fromAbroad}
        onChange={(fromAbroad) =>
          onChange({
            fromAbroad,
            airportPickup: fromAbroad ? profile.airportPickup : undefined,
          })
        }
      />
      {profile.fromAbroad && (
        <YesNo
          label="Do you want us to pick you up at the airport?"
          value={profile.fromAbroad ? !!pickup : undefined}
          onChange={(wanted) =>
            onChange({
              fromAbroad: true,
              airportPickup: wanted
                ? (pickup ?? {
                    airport: "LOS",
                    flight: "",
                    landingDate: profile.startDate,
                    landingTime: "",
                    travellers: profile.adults,
                    bags: profile.adults,
                  })
                : undefined,
            })
          }
        />
      )}
      {pickup && (
        <>
          <p className="form-hint">
            A driver meets you at arrivals and takes you to your stay
            {priceMinor !== undefined
              ? `, ${formatMoney(priceMinor)} per pickup, paid with your trip`
              : ", paid with your trip"}
            . Don’t have your flight yet? Leave it blank and add it later; we’ll
            remind you before you land.
          </p>
          <div className="field-grid">
            <label>
              Arrival airport
              <select
                value={pickup.airport}
                onChange={(e) => set({ airport: e.target.value as AirportId })}
              >
                {(Object.keys(airports) as AirportId[]).map((id) => (
                  <option key={id} value={id}>
                    {airports[id]}
                  </option>
                ))}
                <option disabled>Abuja · coming soon</option>
              </select>
            </label>
            <label>
              Flight number (optional for now)
              <input
                maxLength={12}
                placeholder="e.g. BA75"
                autoCapitalize="characters"
                value={pickup.flight}
                onChange={(e) => set({ flight: e.target.value })}
              />
            </label>
            <label>
              Landing date
              <input
                type="date"
                required
                min={profile.startDate}
                max={profile.endDate}
                value={pickup.landingDate}
                onChange={(e) => set({ landingDate: e.target.value })}
              />
            </label>
            <label>
              Landing time, Lagos (optional for now)
              <input
                type="time"
                value={pickup.landingTime}
                onChange={(e) => set({ landingTime: e.target.value })}
              />
            </label>
            <label>
              Travellers on this flight
              <input
                type="number"
                min="1"
                max={profile.adults}
                value={pickup.travellers}
                onChange={(e) => set({ travellers: Number(e.target.value) })}
              />
            </label>
            <label>
              Bags to carry
              <input
                type="number"
                min="0"
                max="30"
                value={pickup.bags}
                onChange={(e) => set({ bags: Number(e.target.value) })}
              />
            </label>
          </div>
        </>
      )}
    </div>
  );
}
