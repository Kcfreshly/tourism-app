import { createAnthropic } from "@ai-sdk/anthropic";
import {
  createProviderRegistry,
  defaultSettingsMiddleware,
  wrapLanguageModel,
  type LanguageModel,
} from "ai";

import { modelProfiles, type ModelProfile, type ProfileName } from "../config.js";

type Providers = Parameters<typeof createProviderRegistry>[0];

export type Models = {
  /** The language model for a profile, with the profile's default settings applied. */
  get(profile: ProfileName): LanguageModel;
};

// Resolves profile names to AI SDK models through a provider registry. To add
// a provider, install its @ai-sdk package and register it here.
export function createModels(options: {
  providers: Providers;
  profiles?: Record<ProfileName, ModelProfile>;
  overrides?: NodeJS.ProcessEnv;
}): Models {
  const registry = createProviderRegistry(options.providers);
  const profiles = options.profiles ?? modelProfiles;
  return {
    get(name) {
      const profile = profiles[name];
      const override = options.overrides?.[`MODEL_${name.replaceAll(".", "_").toUpperCase()}`];
      const id = (override || profile.model) as `${string}:${string}`;
      const model = registry.languageModel(id);
      const settings = profile.settings;
      return settings
        ? wrapLanguageModel({ model, middleware: defaultSettingsMiddleware({ settings }) })
        : model;
    },
  };
}

export function providersFromEnv(env: { ANTHROPIC_API_KEY?: string | undefined }): Providers {
  return {
    anthropic: createAnthropic(env.ANTHROPIC_API_KEY ? { apiKey: env.ANTHROPIC_API_KEY } : {}),
  };
}
