import type { TransportSettings } from "../../domain/transport-settings";

// Version 0 means nothing is stored yet and the defaults apply.
export type StoredTransportSettings = {
  settings: TransportSettings;
  version: number;
};

export interface TransportSettingsRepository {
  get(): Promise<StoredTransportSettings>;
  // Saves with its audit event in one transaction. Returns null when
  // `expectedVersion` no longer matches.
  save(input: {
    settings: TransportSettings;
    expectedVersion: number;
    actorId: string;
    changed: string[];
  }): Promise<StoredTransportSettings | null>;
}
