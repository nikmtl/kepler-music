import { Action, Command, Icon } from "@kepler-app/plugin-sdk";
import { Feature } from ".";

const enum Setting {
  SOURCE = "music-sources-select",
  SPOTIFY_CLIENT_ID = "music-spotify-client-id",
  SPOTIFY_CLIENT_SECRET = "music-spotify-client-secret",
  GENIUS_TOKEN = "music-genius-token",
}

type SourceId = "apple-music" | "spotify" | "genius";

interface TrackResult {
  id: string;
  title: string;
  subtitle: string;
  imageUrl?: string;
  url: string;
}

interface SearchError {
  message: string;
}

type SearchOutcome =
  | { ok: true; results: TrackResult[] }
  | { ok: false; error: SearchError };

function ok(results: TrackResult[]): SearchOutcome {
  return { ok: true, results };
}

function err(message: string): SearchOutcome {
  return { ok: false, error: { message } };
}

async function fetchAppleMusic(query: string): Promise<SearchOutcome> {
  if (!query.trim()) return ok([]);
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=15`;
  let res: KeplerResponse;
  try {
    res = await fetch(url);
  } catch {
    return err("Couldn't reach Apple Music. Check your internet connection.");
  }
  if (!res.ok) {
    return err(`Apple Music search failed (HTTP ${res.status}).`);
  }
  try {
    const data = (await res.json()) as {
      results: Array<{
        trackId: number;
        trackName: string;
        artistName: string;
        collectionName: string;
        trackViewUrl: string;
        artworkUrl100: string;
      }>;
    };
    return ok(
      data.results.map((t) => ({
        id: `am-${t.trackId}`,
        title: t.trackName,
        subtitle: `${t.artistName} — ${t.collectionName}`,
        imageUrl: t.artworkUrl100,
        url: t.trackViewUrl,
      })),
    );
  } catch {
    return err("Apple Music returned an unexpected response.");
  }
}

const BASE64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64Encode(input: string): string {
  let output = "";
  for (let i = 0; i < input.length; i += 3) {
    const b1 = input.charCodeAt(i);
    const b2 = input.charCodeAt(i + 1);
    const b3 = input.charCodeAt(i + 2);
    output += BASE64_CHARS[b1 >> 2];
    output += BASE64_CHARS[((b1 & 0x03) << 4) | (isNaN(b2) ? 0 : b2 >> 4)];
    output += isNaN(b2)
      ? "="
      : BASE64_CHARS[((b2 & 0x0f) << 2) | (isNaN(b3) ? 0 : b3 >> 6)];
    output += isNaN(b3) ? "=" : BASE64_CHARS[b3 & 0x3f];
  }
  return output;
}

let spotifyTokenCache: { token: string; expiresAt: number } | null = null;

type TokenOutcome =
  | { ok: true; token: string }
  | { ok: false; error: SearchError };

async function getSpotifyToken(
  clientId: string,
  clientSecret: string,
): Promise<TokenOutcome> {
  if (spotifyTokenCache && Date.now() < spotifyTokenCache.expiresAt) {
    return { ok: true, token: spotifyTokenCache.token };
  }
  let res: KeplerResponse;
  try {
    res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${base64Encode(`${clientId}:${clientSecret}`)}`,
      },
      body: "grant_type=client_credentials",
    });
  } catch {
    return {
      ok: false,
      error: { message: "Couldn't reach Spotify. Check your internet connection." },
    };
  }
  if (!res.ok) {
    return {
      ok: false,
      error: {
        message:
          res.status === 400 || res.status === 401
            ? "Spotify rejected the Client ID/Secret. Check your credentials in settings."
            : `Spotify authentication failed (HTTP ${res.status}).`,
      },
    };
  }
  try {
    const data = (await res.json()) as {
      access_token: string;
      expires_in: number;
    };
    spotifyTokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    };
    return { ok: true, token: spotifyTokenCache.token };
  } catch {
    return {
      ok: false,
      error: { message: "Spotify returned an unexpected response during authentication." },
    };
  }
}

async function fetchSpotify(
  query: string,
  clientId: string,
  clientSecret: string,
): Promise<SearchOutcome> {
  if (!query.trim()) return ok([]);
  if (!clientId || !clientSecret) {
    return err(
      "Spotify Client ID/Secret is missing. Add it in the Music Search settings.",
    );
  }
  const tokenResult = await getSpotifyToken(clientId, clientSecret);
  if (!tokenResult.ok) {
    return { ok: false, error: tokenResult.error };
  }
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`;
  let res: KeplerResponse;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${tokenResult.token}` },
    });
  } catch {
    return err("Couldn't reach Spotify. Check your internet connection.");
  }
  if (!res.ok) {
    return err(`Spotify search failed (HTTP ${res.status}).`);
  }
  try {
    const data = (await res.json()) as {
      tracks: {
        items: Array<{
          id: string;
          name: string;
          artists: Array<{ name: string }>;
          album: { name: string; images: Array<{ url: string }> };
          external_urls: { spotify: string };
        }>;
      };
    };
    return ok(
      data.tracks.items.map((t) => ({
        id: `sp-${t.id}`,
        title: t.name,
        subtitle: `${t.artists.map((a) => a.name).join(", ")} — ${t.album.name}`,
        imageUrl: t.album.images[0]?.url,
        url: `spotify:track:${t.id}`,
      })),
    );
  } catch {
    return err("Spotify returned an unexpected response.");
  }
}

async function fetchGenius(
  query: string,
  token: string,
): Promise<SearchOutcome> {
  if (!query.trim()) return ok([]);
  if (!token) {
    return err(
      "Genius Client Access Token is missing. Add it in the Music Search settings.",
    );
  }
  const url = `https://api.genius.com/search?q=${encodeURIComponent(query)}&per_page=15`;
  let res: KeplerResponse;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return err("Couldn't reach Genius. Check your internet connection.");
  }
  if (!res.ok) {
    return err(
      res.status === 401
        ? "Genius rejected the Client Access Token. Check your token in settings."
        : `Genius search failed (HTTP ${res.status}).`,
    );
  }
  try {
    const data = (await res.json()) as {
      response: {
        hits: Array<{
          result: {
            id: number;
            title: string;
            primary_artist: { name: string };
            url: string;
            song_art_image_thumbnail_url: string;
          };
        }>;
      };
    };
    return ok(
      data.response.hits.map((h) => ({
        id: `genius-${h.result.id}`,
        title: h.result.title,
        subtitle: h.result.primary_artist.name,
        imageUrl: h.result.song_art_image_thumbnail_url,
        url: h.result.url,
      })),
    );
  } catch {
    return err("Genius returned an unexpected response.");
  }
}

function searchUrl(source: SourceId, query: string): string {
  const q = encodeURIComponent(query);
  switch (source) {
    case "apple-music":
      return `https://music.apple.com/search?term=${q}`;
    case "spotify":
      return `spotify:search:${q}`;
    case "genius":
      return `https://genius.com/search?q=${q}`;
  }
}

function sourceIcon(source: SourceId) {
  switch (source) {
    case "apple-music":
      return Icon.appIcon("/System/Applications/Music.app");
    case "spotify":
      return Icon.appIcon("/Applications/Spotify.app");
    case "genius":
      return Icon.rounded(
        Icon.url(
          "https://play-lh.googleusercontent.com/P3Qcr71hle0VO9GDQk0BZ4GxAEKiExkQh29kjIrnRhhXD0n2IIgGd4FvFSezIWjkM2EHMVSZ8uNUUXUtQsnFQQ=w480-h960",
        ),
      );
  }
}

function sourceTitle(source: SourceId): string {
  switch (source) {
    case "apple-music":
      return "Apple Music";
    case "spotify":
      return "Spotify";
    case "genius":
      return "Genius";
  }
}

async function fetchResults(
  source: SourceId,
  query: string,
  ctx: {
    settings: Record<
      string,
      string | number | boolean | Array<Record<string, string>>
    >;
  },
): Promise<SearchOutcome> {
  switch (source) {
    case "apple-music":
      return fetchAppleMusic(query);
    case "spotify":
      return fetchSpotify(
        query,
        (ctx.settings[Setting.SPOTIFY_CLIENT_ID] as string) ?? "",
        (ctx.settings[Setting.SPOTIFY_CLIENT_SECRET] as string) ?? "",
      );
    case "genius":
      return fetchGenius(
        query,
        (ctx.settings[Setting.GENIUS_TOKEN] as string) ?? "",
      );
  }
}

export const music: Feature = {
  settings: [
    {
      id: Setting.SOURCE,
      title: "Music Source",
      kind: "picker",
      description:
        "Choose which service to search. Apple Music works out of the box. Spotify and Genius require API credentials.",
      defaultValue: "apple-music",
      options: [
        { id: "apple-music", title: "Apple Music" },
        { id: "spotify", title: "Spotify" },
        { id: "genius", title: "Genius" },
      ],
    },
    {
      id: Setting.SPOTIFY_CLIENT_ID,
      title: "Spotify Client ID",
      kind: "secureText",
      description:
        "Only needed when Spotify is selected above. Create a free app at developer.spotify.com/dashboard, then copy the Client ID from its Settings page.",
      defaultValue: "",
    },
    {
      id: Setting.SPOTIFY_CLIENT_SECRET,
      title: "Spotify Client Secret",
      kind: "secureText",
      description:
        "Only needed when Spotify is selected above. Found alongside the Client ID in your Spotify app's Settings page.",
      defaultValue: "",
    },
    {
      id: Setting.GENIUS_TOKEN,
      title: "Genius Client Access Token",
      kind: "secureText",
      description:
        "Only needed when Genius is selected above. Create a free API client at genius.com/api-clients and copy the Client Access Token.",
      defaultValue: "",
    },
  ],
  searchModes: [
    Command.search({
      id: "music-mode",
      title: "Music Search",
      icon: Icon.sfSymbol("music.note.square.stack"),
      subtitle: "Search for songs and artists",
      keywords: ["music", "song", "artist", "track"],
      shortcutPrefix: "music",
      placeholder: "Search for a song or artist ...",
      async run(query, ctx) {
        const source = ctx.settings[Setting.SOURCE] as SourceId;
        const q = query.raw.trim(); 

        const openSearchItem = {
          id: "music-open-search",
          title: `Search "${q}" on ${sourceTitle(source)}`,
          subtitle: `Open full ${sourceTitle(source)} search`,
          icon: sourceIcon(source),
          action: Action.url(searchUrl(source, q || "")),
        };

        if (!q) return [];

        const outcome = await fetchResults(source, q, ctx);

        if (!outcome.ok) {
          const errorItem = {
            id: "music-search-error",
            title: outcome.error.message,
            subtitle: `${sourceTitle(source)} search error`,
            icon: Icon.sfSymbol("exclamationmark.triangle"),
          };
          return [openSearchItem, errorItem];
        }

        const items = outcome.results.map((r) => ({
          id: r.id,
          title: r.title,
          subtitle: r.subtitle,
          icon: r.imageUrl
            ? Icon.rounded(Icon.url(r.imageUrl))
            : Icon.sfSymbol("music.note"),
          action: Action.url(r.url),
        }));

        return [openSearchItem, ...items];
      },
    }),
  ],
};
