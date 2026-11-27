import { AppError } from "@/shared/application/app-error";
import type { TransportSettings } from "../../domain/transport-settings";
import type { TransportSettingsRepository } from "../ports/transport-settings-repository";

// Staff edit of the transport and guide rules; version-checked and audited.
export class UpdateTransportSettings {
  constructor(private readonly settings: TransportSettingsRepository) {}

  async execute(command: {
    actorId: string;
    expectedVersion: number;
    settings: TransportSettings;
  }) {
    const current = await this.settings.get();
    const changed = (
      Object.keys(command.settings) as (keyof TransportSettings)[]
    ).filter(
      (key) =>
        JSON.stringify(command.settings[key]) !==
        JSON.stringify(current.settings[key]),
    );
    let saved;
    try {
      saved = await this.settings.save({ ...command, changed });
    } catch (error) {
      if (/transport_settings/.test(String(error)))
        throw new AppError(
          "CONFLICT",
          "MIGRATION_REQUIRED",
          "Transport settings can't be saved yet. Stop the app and run npm run db:migrate.",
        );
      throw error;
    }
    if (!saved)
      throw new AppError(
        "CONFLICT",
        "VERSION_CONFLICT",
        "Transport settings changed. Reload before editing again.",
      );
    return saved;
  }
}
