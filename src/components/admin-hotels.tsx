"use client";
import { useEffect, useState } from "react";
import { zoneLabel } from "@/modules/catalogue/domain/experience-content";
import {
  hotelZones,
  type Hotel,
  type HotelInput,
} from "@/modules/trips/domain/hotels";
import { stayTypes, type StayType } from "@/modules/trips/domain/profile";
import { showToast } from "./toast";

async function call(method: "GET" | "POST", body?: unknown) {
  const r = await fetch("/api/v1/admin/hotels", {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await r.json();
  if (!r.ok) throw Error(json.error.message);
  return json.data;
}

const blank: HotelInput = {
  name: "",
  aliases: [],
  zoneId: "LEKKI",
  type: "HOTEL",
  address: "",
  active: true,
};

function HotelForm({
  hotel,
  onSaved,
  onCancel,
}: {
  hotel?: Hotel;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [edit, setEdit] = useState<HotelInput>(hotel ?? blank);
  const [aliases, setAliases] = useState((hotel?.aliases ?? []).join(", "));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (changes: Partial<HotelInput>) =>
    setEdit((e) => ({ ...e, ...changes }));
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const input = {
      ...edit,
      aliases: aliases
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean),
    };
    try {
      await call(
        "POST",
        hotel
          ? { id: hotel.id, expectedVersion: hotel.version, hotel: input }
          : { hotel: input },
      );
      showToast({ message: `${input.name} saved.` });
      if (!hotel) {
        setEdit(blank);
        setAliases("");
      }
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="admin-service-form" onSubmit={save}>
      <label className="field">
        <span>Name</span>
        <input
          required
          minLength={2}
          maxLength={120}
          value={edit.name}
          onChange={(e) => set({ name: e.target.value })}
        />
      </label>
      <label className="field">
        <span>Other names (comma separated)</span>
        <input
          maxLength={600}
          placeholder="Eko, Eko Hotel and Suites"
          value={aliases}
          onChange={(e) => setAliases(e.target.value)}
        />
      </label>
      <label className="field">
        <span>Area</span>
        <select
          value={edit.zoneId}
          onChange={(e) =>
            set({ zoneId: e.target.value as HotelInput["zoneId"] })
          }
        >
          {hotelZones.map((z) => (
            <option key={z} value={z}>
              {zoneLabel(z)}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Type</span>
        <select
          value={edit.type}
          onChange={(e) => set({ type: e.target.value as StayType })}
        >
          {(Object.keys(stayTypes) as StayType[]).map((t) => (
            <option key={t} value={t}>
              {stayTypes[t]}
            </option>
          ))}
        </select>
      </label>
      <label className="field admin-service-wide">
        <span>Address</span>
        <input
          required
          minLength={5}
          maxLength={300}
          value={edit.address}
          onChange={(e) => set({ address: e.target.value })}
        />
      </label>
      <label className="check admin-service-wide">
        <input
          type="checkbox"
          checked={edit.active}
          onChange={(e) => set({ active: e.target.checked })}
        />
        Shown in travellers’ search
      </label>
      {error && (
        <p className="field-error admin-service-wide" role="alert">
          {error}
        </p>
      )}
      <div className="admin-save-actions">
        {onCancel && (
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" disabled={busy}>
          {hotel ? "Save hotel" : "Add hotel"}
        </button>
      </div>
    </form>
  );
}

// Staff keep the list travellers search when they say where they'd like to
// stay. Inactive hotels stay on the list but aren't suggested.
export default function AdminHotels() {
  const [hotels, setHotels] = useState<Hotel[] | null>(null);
  const [error, setError] = useState("");
  const [loads, setLoads] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    call("GET")
      .then((data) => active && setHotels(data))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [loads]);
  const reload = () => {
    setEditing(null);
    setLoads((n) => n + 1);
  };
  return (
    <div className="admin-hotels">
      <div className="card admin-service">
        <h3>Add a place to stay</h3>
        <HotelForm onSaved={reload} />
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {!hotels && !error && <p className="muted">Loading hotels…</p>}
      {hotels && !hotels.length && (
        <p className="muted">
          No hotels yet. Travellers can still name a place or ask us to
          recommend one.
        </p>
      )}
      {hotels && hotels.length > 0 && (
        <ul className="admin-services-list">
          {hotels.map((h) => (
            <li key={`${h.id}:${h.version}`} className="card admin-service">
              {editing === h.id ? (
                <HotelForm
                  hotel={h}
                  onSaved={reload}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <div className="admin-service-head">
                  <div>
                    <h3>{h.name}</h3>
                    <p className="muted">
                      {zoneLabel(h.zoneId)} · {stayTypes[h.type]} · {h.address}
                      {h.aliases.length > 0 &&
                        ` · also “${h.aliases.join("”, “")}”`}
                    </p>
                  </div>
                  <span className="admin-stay-offer-actions">
                    <span
                      className="status-chip"
                      data-tone={h.active ? "ok" : undefined}
                    >
                      {h.active ? "In search" : "Hidden"}
                    </span>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setEditing(h.id)}
                    >
                      Edit
                    </button>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
