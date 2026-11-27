"use client";
import { useEffect, useState } from "react";
import { showToast } from "./toast";
import {
  transportSettingsSchema,
  type TransportSettings,
} from "@/modules/trips/domain/transport-settings";
import { formatMoney } from "@/modules/catalogue/domain/experience-content";

type Stored = { settings: TransportSettings; version: number };

async function call(method: "GET" | "PUT", payload?: unknown) {
  const r = await fetch("/api/v1/admin/transport-settings", {
    method,
    headers: { "Content-Type": "application/json" },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  const body = await r.json();
  if (!r.ok) throw Error(body.error?.message ?? "Request failed. Retry.");
  return body.data as Stored;
}

// Naira in the form, minor units in the settings.
function Naira({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (minor: number) => void;
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        min={0}
        step={500}
        required
        value={value / 100}
        onChange={(e) => onChange(Math.round(Number(e.target.value) * 100))}
      />
    </label>
  );
}

function Whole({
  label,
  value,
  min,
  max,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  hint?: string;
  onChange: (n: number) => void;
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={1}
        required
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && <small className="form-hint">{hint}</small>}
    </label>
  );
}

// Staff edit the transport and guide rules the planner prices with. A save
// applies to the next estimate; trips already priced recalculate on load.
export default function AdminTransportSettings() {
  const [stored, setStored] = useState<Stored | null>(null);
  const [edit, setEdit] = useState<TransportSettings | null>(null);
  const [status, setStatus] = useState("Loading transport settings…");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    call("GET")
      .then((data) => {
        setStored(data);
        setEdit(data.settings);
        setStatus(
          data.version
            ? `Saved settings, version ${data.version}.`
            : "Using the default demo settings. Nothing saved yet.",
        );
      })
      .catch((error) => setStatus(error.message));
  }, []);
  if (!edit || !stored)
    return (
      <p className="muted" role="status">
        {status}
      </p>
    );
  const set = (patch: Partial<TransportSettings>) =>
    setEdit({ ...edit, ...patch });
  const parsed = transportSettingsSchema.safeParse(edit);
  const problems = parsed.success
    ? []
    : parsed.error.issues.map((i) => i.message);
  const changed = JSON.stringify(edit) !== JSON.stringify(stored.settings);
  async function save() {
    if (!parsed.success) return;
    setBusy(true);
    try {
      const data = await call("PUT", {
        expectedVersion: stored!.version,
        settings: parsed.data,
      });
      setStored(data);
      setEdit(data.settings);
      setStatus(`Saved. Version ${data.version} applies to new estimates.`);
      showToast({ message: "Transport settings saved." });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Please retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="admin-transport"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <fieldset
        className="card admin-transport-card admin-transport-day"
        disabled={busy}
      >
        <legend>Car for the day</legend>
        <p className="muted">
          The lengths travellers can book on a day, shortest first. Longer
          blocks are overtime on top of a full day; agree driver hours with
          partners before offering more than 8.
        </p>
        <table className="admin-blocks">
          <thead>
            <tr>
              <th scope="col">Hours</th>
              <th scope="col">Price per car (₦)</th>
              <th scope="col">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {edit.dayBlocks.map((block, i) => (
              <tr key={i}>
                <td>
                  <input
                    aria-label={`Block ${i + 1} hours`}
                    type="number"
                    min={1}
                    max={16}
                    required
                    value={block.hours}
                    onChange={(e) =>
                      set({
                        dayBlocks: edit.dayBlocks.map((b, j) =>
                          j === i ? { ...b, hours: Number(e.target.value) } : b,
                        ),
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    aria-label={`Block ${i + 1} price per car`}
                    type="number"
                    min={0}
                    step={500}
                    required
                    value={block.rateMinor / 100}
                    onChange={(e) =>
                      set({
                        dayBlocks: edit.dayBlocks.map((b, j) =>
                          j === i
                            ? {
                                ...b,
                                rateMinor: Math.round(
                                  Number(e.target.value) * 100,
                                ),
                              }
                            : b,
                        ),
                      })
                    }
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="text-button"
                    disabled={edit.dayBlocks.length === 1}
                    onClick={() =>
                      set({
                        dayBlocks: edit.dayBlocks.filter((_, j) => j !== i),
                      })
                    }
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          className="secondary"
          disabled={edit.dayBlocks.length >= 6}
          onClick={() => {
            const last = edit.dayBlocks.at(-1)!;
            set({
              dayBlocks: [
                ...edit.dayBlocks,
                { hours: last.hours + 2, rateMinor: last.rateMinor },
              ],
            });
          }}
        >
          Add a longer block
        </button>
        <div className="field-grid">
          <Whole
            label="Seats per car"
            min={1}
            max={20}
            value={edit.seatsPerCar}
            hint="Larger groups get more cars."
            onChange={(seatsPerCar) => set({ seatsPerCar })}
          />
          <Naira
            label="Cross-area surcharge per car (₦)"
            value={edit.crossZoneSurchargeMinor}
            onChange={(crossZoneSurchargeMinor) =>
              set({ crossZoneSurchargeMinor })
            }
          />
        </div>
      </fieldset>
      <fieldset className="card admin-transport-card" disabled={busy}>
        <legend>Night out</legend>
        <p className="muted">
          A separate car and driver for the evening. It can run past midnight,
          up to 06:00, and covers activities starting from its start time.
        </p>
        <div className="field-grid">
          <Whole
            label="Night car hours"
            min={2}
            max={10}
            value={edit.night.hours}
            onChange={(hours) => set({ night: { ...edit.night, hours } })}
          />
          <Naira
            label="Night car price per car (₦)"
            value={edit.night.rateMinor}
            onChange={(rateMinor) =>
              set({ night: { ...edit.night, rateMinor } })
            }
          />
          <label>
            Night car starts from
            <input
              type="time"
              required
              value={edit.night.startsFrom}
              onChange={(e) =>
                set({ night: { ...edit.night, startsFrom: e.target.value } })
              }
            />
          </label>
          <label>
            Late return from
            <input
              type="time"
              required
              value={edit.lateReturnFrom}
              onChange={(e) => set({ lateReturnFrom: e.target.value })}
            />
            <small className="form-hint">
              Travellers making their own way confirm how they’ll get back from
              anything ending at or after this time.
            </small>
          </label>
        </div>
      </fieldset>
      <fieldset className="card admin-transport-card" disabled={busy}>
        <legend>Airport pickup</legend>
        <p className="muted">
          For travellers arriving from abroad: a driver meets them at arrivals
          and takes them to their stay. Paid trips keep the price they paid.
        </p>
        <div className="field-grid">
          <Naira
            label="Airport pickup price (₦)"
            value={edit.airportPickupMinor}
            onChange={(airportPickupMinor) => set({ airportPickupMinor })}
          />
        </div>
      </fieldset>
      <fieldset className="card admin-transport-card" disabled={busy}>
        <legend>Guides and pickups</legend>
        <div className="field-grid">
          <Whole
            label="Pickup address reminder (hours)"
            min={0}
            max={168}
            value={edit.pickupAddressNoticeHours}
            hint="Travellers who book their own stay are asked for a pickup address until this long before their first pickup."
            onChange={(pickupAddressNoticeHours) =>
              set({ pickupAddressNoticeHours })
            }
          />
          <Whole
            label="Guide notice (hours)"
            min={0}
            max={168}
            value={edit.guideNoticeHours}
            hint="Guides can’t be added closer than this to the start."
            onChange={(guideNoticeHours) => set({ guideNoticeHours })}
          />
        </div>
      </fieldset>
      {problems.length > 0 && (
        <ul className="field-error admin-problems" role="alert">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      <div className="card admin-savebar">
        <p role="status">
          {changed ? "Unsaved changes." : status} Example: the longest day for 5
          people is {Math.ceil(5 / Math.max(1, edit.seatsPerCar))} cars ×{" "}
          {formatMoney(edit.dayBlocks.at(-1)?.rateMinor ?? 0)}.
        </p>
        <button
          type="submit"
          disabled={busy || !changed || problems.length > 0}
        >
          Save transport settings
        </button>
      </div>
    </form>
  );
}
