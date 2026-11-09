import type { Item, Services } from "../../domain/planner";
import type { Profile } from "../../domain/profile";

export type TripOwner = { id: string; kind: string };

// A stored trip. Profile, items and services are parsed by the use cases.
export type TripRow = {
  id: string;
  ownerId: string;
  ownerType: string;
  version: number;
  profile: unknown;
  items: unknown;
  services: unknown;
  updatedAt: Date;
};

export type TripChanges = {
  profile?: Profile;
  items?: Item[];
  services?: Services;
};

export interface TripRepository {
  listOwned(owner: TripOwner): Promise<TripRow[]>;
  findOwned(id: string, owner: TripOwner): Promise<TripRow | null>;
  create(trip: {
    id: string;
    owner: TripOwner;
    profile: Profile;
    services: Services;
  }): Promise<TripRow>;
  // Writes the changes and bumps the version only while `expectedVersion`
  // still matches. Returns null when another save won.
  update(
    id: string,
    owner: TripOwner,
    expectedVersion: number,
    changes: TripChanges,
  ): Promise<TripRow | null>;
}
