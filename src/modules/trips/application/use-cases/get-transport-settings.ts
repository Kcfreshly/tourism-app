import type { TransportSettingsRepository } from "../ports/transport-settings-repository";

// The transport and guide rules pricing uses now, with their version for
// staff edits.
export class GetTransportSettings {
  constructor(private readonly settings: TransportSettingsRepository) {}

  execute() {
    return this.settings.get();
  }
}
