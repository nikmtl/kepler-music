import {
  PluginCommand,
  PluginLookAhead,
  PluginProvider,
  PluginResolver,
  PluginSettingDefinition,
} from "@kepler-app/plugin-sdk";

export interface Feature {
  settings?: PluginSettingDefinition[];
  searchModes?: PluginCommand[];
  searchProviders?: PluginProvider[];
  widgets?: PluginResolver[];
  lookAhead?: PluginLookAhead[];
}

export function registerFeatures(features: Feature[]) {
  return {
    settings: features.flatMap((f) => f.settings ?? []),
    searchModes: features.flatMap((f) => f.searchModes ?? []),
    searchProviders: features.flatMap((f) => f.searchProviders ?? []),
    widgets: features.flatMap((f) => f.widgets ?? []),
    lookAhead: features.flatMap((f) => f.lookAhead ?? []),
  };
}
