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

async function fetchAppleMusic(query: string): Promise<TrackResult[]> {
  if (!query.trim()) return [];
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=15`;
  const res = await fetch(url);
  if (!res.ok) return [];
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
  return data.results.map((t) => ({
    id: `am-${t.trackId}`,
    title: t.trackName,
    subtitle: `${t.artistName} — ${t.collectionName}`,
    imageUrl: t.artworkUrl100,
    url: t.trackViewUrl,
  }));
}

let spotifyTokenCache: { token: string; expiresAt: number } | null = null;

async function getSpotifyToken(
  clientId: string,
  clientSecret: string,
): Promise<string> {
  if (spotifyTokenCache && Date.now() < spotifyTokenCache.expiresAt) {
    return spotifyTokenCache.token;
  }
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    console.error(
      `[kepler-music] Spotify token fetch failed: ${res.status}`,
      await res.text(),
    );
    return "";
  }
  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  spotifyTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return spotifyTokenCache.token;
}

async function fetchSpotify(
  query: string,
  clientId: string,
  clientSecret: string,
): Promise<TrackResult[]> {
  if (!query.trim() || !clientId || !clientSecret) return [];
  const token = await getSpotifyToken(clientId, clientSecret);
  if (!token) {
    console.error(
      "[kepler-music] Spotify: no token available, skipping search",
    );
    return [];
  }
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=15`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.error(
      `[kepler-music] Spotify search failed: ${res.status}`,
      await res.text(),
    );
    return [];
  }
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
  return data.tracks.items.map((t) => ({
    id: `sp-${t.id}`,
    title: t.name,
    subtitle: `${t.artists.map((a) => a.name).join(", ")} — ${t.album.name}`,
    imageUrl: t.album.images[0]?.url,
    url: t.external_urls.spotify,
  }));
}

async function fetchGenius(
  query: string,
  token: string,
): Promise<TrackResult[]> {
  if (!query.trim() || !token) return [];
  const url = `https://api.genius.com/search?q=${encodeURIComponent(query)}&per_page=15`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
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
  return data.response.hits.map((h) => ({
    id: `genius-${h.result.id}`,
    title: h.result.title,
    subtitle: h.result.primary_artist.name,
    imageUrl: h.result.song_art_image_thumbnail_url,
    url: h.result.url,
  }));
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
): Promise<TrackResult[]> {
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
      description: "Select which music source to search.",
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
        "Spotify app Client ID. Required when Spotify is selected as source.",
      defaultValue: "",
    },
    {
      id: Setting.SPOTIFY_CLIENT_SECRET,
      title: "Spotify Client Secret",
      kind: "secureText",
      description:
        "Spotify app Client Secret. Tokens are fetched and refreshed automatically.",
      defaultValue: "",
    },
    {
      id: Setting.GENIUS_TOKEN,
      title: "Genius Client Access Token",
      kind: "secureText",
      description:
        "Genius API client access token. Required when Genius is selected as source.",
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

        const results = await fetchResults(source, q, ctx);

        const items = results.map((r) => ({
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
