# Flxw's Kepler Plugin Template

A TypeScript template for building [Kepler](https://trykepler.app) plugins using the `@kepler-app/plugin-sdk`.

## Features

- Feature-based architecture — each feature encapsulates its own settings, search modes, look-ahead items, search providers, and widgets
- Built with [tsup](https://tsup.egoist.dev/) for fast bundling
- Auto-generates the Kepler plugin manifest on build

## Project Structure

```
plugin.config.json   # Plugin metadata (id, name, version, author, icon)
src/
  index.ts           # Entry point — registers all features and exports the plugin
  features/
    index.ts         # Feature interface and registerFeatures() utility
    coinflip.ts      # Example feature: a coin flip command
scripts/
  manifest.js        # Generates manifest.json into the Kepler plugins directory
```

## Getting Started

```bash
git clone https://github.com/zFlxw/kepler-plugin-template.git
cd kepler-plugin-template
pnpm install
```

Edit `plugin.config.json` to set your plugin's `id`, `name`, `version`, `author`, `icon`, `bundleName`, and `packageName`.

## Adding a Feature

Create a new file in `src/features/` that exports a `Feature` object:

```ts
import { Command, Icon } from '@kepler-app/plugin-sdk';
import { Feature } from '.';

export const myFeature: Feature = {
  settings: [...],
  searchModes: [...],
  lookAhead: [...],
  widgets: [...],
};
```

Then add it to the `features` array in `src/index.ts`.

A `Feature` can include any combination of:

| Field             | Type                        | Description                          |
| ----------------- | --------------------------- | ------------------------------------ |
| `settings`        | `PluginSettingDefinition[]` | Toggle/input settings shown in UI    |
| `searchModes`     | `PluginCommand[]`           | Commands surfaced in search          |
| `searchProviders` | `PluginProvider[]`          | Providers for search results         |
| `lookAhead`       | `PluginLookAhead[]`         | Items shown proactively while typing |
| `widgets`         | `PluginResolver[]`          | Inline widgets rendered in results   |

## Building & Installing

```bash
pnpm build
```

This bundles the plugin with `tsup` and writes the manifest to:

```
~/Library/Application Support/Kepler/Plugins/<bundleName>.keplugin/manifest.json
```

Open Kepler, enable Community Plugins if you haven't already, and reload the plugin list.
