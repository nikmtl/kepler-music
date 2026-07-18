# Kepler Music Search Plugin

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

### Option 1: Install from GitHub Releases (recommended, most stable)

1. Open the [Releases page](https://github.com/nikmtl/kepler-music-search/releases) and download the latest release asset.
2. If the asset is a zip file, extract it.
3. Copy the resulting `nikmtls-kepler-music-search.keplugin` folder into:

```
~/Library/Application Support/Kepler/Plugins/
```

Then in Kepler:

1. Open Settings -> Plugins
2. Enable **Community Plugins** if not already active
3. The Music plugin should appear in the list; enable it
4. Use `/music` to search for music

### Option 2: Build from source

**Requirements:** [Node.js](https://nodejs.org) and [pnpm](https://pnpm.io)

```bash
git clone https://github.com/nikmtl/kepler-music.git
cd kepler-music
pnpm install
pnpm build
```

The build step bundles the plugin and writes it to:

```
~/Library/Application Support/Kepler/Plugins/nikmtls-kepler-music-search.keplugin/
```

Then in Kepler:

1. Open Settings → Plugins
2. Enable **Community Plugins** if not already active
3. The Music plugin should appear in the list — enable it
4. Use `/music` or type `music` in the global search to open it

After any code change, run `pnpm build` again and reload the plugin in Kepler.

## Configuration

Open the plugin settings in Kepler to select your music source and configure tokens.

### Apple Music

No token required. Apple Music search uses the public iTunes Search API.

### Spotify

Spotify requires a Client ID and Client Secret from a registered app. 

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and log in.
2. Click **Create app**, fill in any name and description, set the redirect URI to `https://localhost` (required by the form but not used), and enable the **Web API** checkbox.
3. Open your new app, go to **Settings**, and copy the **Client ID** and **Client Secret**.
4. Paste them into **Spotify Client ID** and **Spotify Client Secret** in the plugin settings.

### Genius

Genius requires a Client Access Token from a registered app.

1. Go to [Genius API Clients](https://genius.com/api-clients) and log in (or create a free account).
2. Click **New API Client**, fill in any app name and set the website URL to `http://localhost`.
3. Open the created client and copy the **Client Access Token**.
4. Paste it into **Genius Client Access Token** in the plugin settings.

## Known Limitations

Spotify rate limits are relatively low, so you may encounter rate limit errors. At the moment kepler fires a request on every keystroke, as there is sadly no built-in debouncing in the plugin SDK. Current workarounds include: result caching, minimum search length and a stale-response guard. 
