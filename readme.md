# Kepler Music Plugin

A [Kepler](https://trykepler.app) plugin that lets you search for music across multiple platforms.

## What it does

Type `/music` in Kepler to open the music search mode, then enter any artist or song name to query your selected music source.

**Supported sources:**

| Source                                            | Data                                 |
| ------------------------------------------------- | ------------------------------------ |
| [Spotify](https://www.spotify.com)                | Artist, album, track names, and more |
| [Apple Music](https://www.apple.com/apple-music/) | Artist, album, track names, and more |
| [Genius](https://genius.com)                      | Song lyrics and annotations          |


## Installation

**Requirements:** [Node.js](https://nodejs.org) and [pnpm](https://pnpm.io)

```bash
git clone https://github.com/nikmtl/kepler-music.git
cd kepler-music
pnpm install
pnpm build
```

The build step bundles the plugin and writes it to:

```
~/Library/Application Support/Kepler/Plugins/nikmtls-kepler-music.keplugin/
```

Then in Kepler:

1. Open Settings → Plugins
2. Enable **Community Plugins** if not already active
3. The Music plugin should appear in the list — enable it
4. Use `/music` or type `music` in the global search to open it

After any code change, run `pnpm build` again and reload the plugin in Kepler.

## Configuration

In the plugin settings you can toggle each source on or off individually:

- **Enable Spotify**: Show Spotify results in search
- **Enable Apple Music**: Show Apple Music results in search
- **Enable Genius**: Show Genius results in search