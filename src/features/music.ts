import { Action, Command, Icon } from "@kepler-app/plugin-sdk";
import { Feature } from ".";

const enum Setting {
  SOURCE = "music-sources-select",
  SEARCH_ARTISTS = "music-search-artists",
  SPOTIFY_CLIENT_ID = "music-spotify-client-id",
  SPOTIFY_CLIENT_SECRET = "music-spotify-client-secret",
  GENIUS_TOKEN = "music-genius-token",
}

type SourceId = "apple-music" | "spotify" | "genius";

type ResultKind = "track" | "artist";

interface TrackResult {
  id: string;
  kind: ResultKind;
  title: string;
  subtitle: string;
  imageUrl?: string;
  url: string;
  relevance: number; // 0-100 score used to interleave tracks and artists
}

interface SearchError {
  message: string;
}

type SearchOutcome =
  { ok: true; results: TrackResult[] } | { ok: false; error: SearchError };

function ok(results: TrackResult[]): SearchOutcome {
  return { ok: true, results };
}

function err(message: string): SearchOutcome {
  return { ok: false, error: { message } };
}

function nameMatchRelevance(
  name: string,
  query: string,
  apiRank: number,
): number {
  const n = name.toLowerCase().trim();
  const q = query.toLowerCase().trim();
  let score: number;
  if (n === q) score = 100;
  else if (n.startsWith(q)) score = 85;
  else if (n.includes(q)) score = 65;
  else score = 45;
  // Small tiebreaker so the API's own ordering still matters among equally-scored results, without letting it override a better match.
  return score - Math.min(apiRank, 9);
}

/**
 * Merge and rank track and artist results by relevance.
 * Boosts strong artist matches (score >= 85) and limits artists to 1 per 4 results.
 */
function interleaveByRelevance(
  tracks: TrackResult[],
  artists: TrackResult[],
): TrackResult[] {
  const ARTIST_BOOST = 8;
  const STRONG_MATCH = 85;
  const MAX_ARTIST_RATIO = 4;

  const boosted = artists.map((a) => ({
    ...a,
    sortScore:
      a.relevance >= STRONG_MATCH ? a.relevance + ARTIST_BOOST : a.relevance,
  }));
  const scoredTracks = tracks.map((t) => ({ ...t, sortScore: t.relevance }));

  const merged = [...boosted, ...scoredTracks].sort(
    (a, b) => b.sortScore - a.sortScore,
  );

  const result: TrackResult[] = [];
  let artistCount = 0;
  const overflowArtists: TrackResult[] = [];
  for (const item of merged) {
    if (item.kind === "artist") {
      const allowedSoFar =
        Math.floor((result.length + 1) / MAX_ARTIST_RATIO) + 1;
      if (artistCount >= allowedSoFar) {
        overflowArtists.push(item);
        continue;
      }
      artistCount++;
    }
    result.push(item);
  }
  // Any artists bumped for ratio reasons still belong in the list
  result.push(...overflowArtists);
  return result;
}

async function fetchAppleMusic(
  query: string,
  includeArtists: boolean,
): Promise<SearchOutcome> {
  if (!query.trim()) return ok([]);
  const q = encodeURIComponent(query);

  const trackUrl = `https://itunes.apple.com/search?term=${q}&media=music&entity=song&limit=15`;
  const artistUrl = `https://itunes.apple.com/search?term=${q}&media=music&entity=musicArtist&limit=5`;

  let trackRes: KeplerResponse;
  try {
    trackRes = await fetch(trackUrl);
  } catch {
    return err("Couldn't reach Apple Music. Check your internet connection.");
  }
  if (!trackRes.ok) {
    return err(`Apple Music search failed (HTTP ${trackRes.status}).`);
  }

  let artistRes: KeplerResponse | null = null;
  if (includeArtists) {
    try {
      artistRes = await fetch(artistUrl);
    } catch {
      return err("Couldn't reach Apple Music. Check your internet connection.");
    }
    if (!artistRes.ok) {
      return err(`Apple Music search failed (HTTP ${artistRes.status}).`);
    }
  }

  try {
    const trackData = (await trackRes.json()) as {
      results: Array<{
        trackId: number;
        trackName: string;
        artistName: string;
        collectionName: string;
        trackViewUrl: string;
        artworkUrl100: string;
      }>;
    };
    const tracks: TrackResult[] = trackData.results.map((t, i) => ({
      id: `am-${t.trackId}`,
      kind: "track",
      title: t.trackName,
      subtitle: `${t.artistName} — ${t.collectionName}`,
      imageUrl: t.artworkUrl100,
      url: t.trackViewUrl,
      relevance: nameMatchRelevance(t.trackName, query, i),
    }));

    let artists: TrackResult[] = [];
    if (artistRes) {
      const artistData = (await artistRes.json()) as {
        results: Array<{
          artistId: number;
          artistName: string;
          artistLinkUrl: string;
        }>;
      };
      artists = artistData.results.map((a, i) => ({
        id: `am-artist-${a.artistId}`,
        kind: "artist",
        title: a.artistName,
        subtitle: "Artist",
        url: a.artistLinkUrl,
        relevance: nameMatchRelevance(a.artistName, query, i),
      }));
    }

    return ok(interleaveByRelevance(tracks, artists));
  } catch {
    return err("Apple Music returned an unexpected response.");
  }
}

const BASE64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function utf8Bytes(input: string): number[] {
  const bytes: number[] = [];
  for (const char of input) {
    const codePoint = char.codePointAt(0)!;
    if (codePoint < 0x80) {
      bytes.push(codePoint);
    } else if (codePoint < 0x800) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint < 0x10000) {
      bytes.push(
        0xe0 | (codePoint >> 12),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    } else {
      bytes.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    }
  }
  return bytes;
}

function base64Encode(input: string): string {
  const bytes = utf8Bytes(input);
  let output = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i];
    const b2 = bytes[i + 1];
    const b3 = bytes[i + 2];
    output += BASE64_CHARS[b1 >> 2];
    output +=
      BASE64_CHARS[((b1 & 0x03) << 4) | (b2 === undefined ? 0 : b2 >> 4)];
    output +=
      b2 === undefined
        ? "="
        : BASE64_CHARS[((b2 & 0x0f) << 2) | (b3 === undefined ? 0 : b3 >> 6)];
    output += b3 === undefined ? "=" : BASE64_CHARS[b3 & 0x3f];
  }
  return output;
}

let spotifyTokenCache: { token: string; expiresAt: number } | null = null;

type TokenOutcome =
  { ok: true; token: string } | { ok: false; error: SearchError };

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
      error: {
        message: "Couldn't reach Spotify. Check your internet connection.",
      },
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
      error: {
        message:
          "Spotify returned an unexpected response during authentication.",
      },
    };
  }
}

let spotifyRateLimitedUntil = 0;

async function fetchSpotify(
  query: string,
  clientId: string,
  clientSecret: string,
  includeArtists: boolean,
): Promise<SearchOutcome> {
  if (!query.trim()) return ok([]);
  if (!clientId || !clientSecret) {
    return err(
      "Spotify Client ID/Secret is missing. Add it in the Music Search settings.",
    );
  }
  if (Date.now() < spotifyRateLimitedUntil) {
    return err(
      "Spotify is rate-limiting requests. Please wait a moment and try again.",
    );
  }
  const tokenResult = await getSpotifyToken(clientId, clientSecret);
  if (!tokenResult.ok) {
    return { ok: false, error: tokenResult.error };
  }
  const types = includeArtists ? "track,artist" : "track";
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${types}&limit=10`;
  let res: KeplerResponse;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${tokenResult.token}` },
    });
  } catch {
    return err("Couldn't reach Spotify. Check your internet connection.");
  }
  if (res.status === 429) {
    const retryAfterSeconds = Number(res.headers["retry-after"]);
    const delayMs =
      (Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : 5) * 1000;
    spotifyRateLimitedUntil = Date.now() + delayMs;
    return err(
      "Spotify is rate-limiting requests. Please wait a moment and try again.",
    );
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
          popularity?: number;
        }>;
      };
      artists?: {
        items: Array<{
          id: string;
          name: string;
          genres?: string[];
          images: Array<{ url: string }>;
          popularity?: number;
        }>;
      };
    };
    // Some app registrations no longer receive `popularity` from this
    // endpoint — fall back to the name-match heuristic when it's missing
    // rather than letting `relevance` silently become `undefined`.
    const tracks: TrackResult[] = data.tracks.items.map((t, i) => ({
      id: `sp-${t.id}`,
      kind: "track",
      title: t.name,
      subtitle: `${t.artists.map((a) => a.name).join(", ")} — ${t.album.name}`,
      imageUrl: t.album.images[0]?.url,
      url: `spotify:track:${t.id}`,
      relevance: t.popularity ?? nameMatchRelevance(t.name, query, i),
    }));
    const artists: TrackResult[] = (data.artists?.items ?? []).map((a, i) => ({
      id: `sp-artist-${a.id}`,
      kind: "artist",
      title: a.name,
      subtitle:
        a.genres && a.genres.length > 0 ? `Artist — ${a.genres[0]}` : "Artist",
      imageUrl: a.images[0]?.url,
      url: `spotify:artist:${a.id}`,
      relevance: a.popularity ?? nameMatchRelevance(a.name, query, i),
    }));
    return ok(interleaveByRelevance(tracks, artists));
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
      data.response.hits.map((h, i) => ({
        id: `genius-${h.result.id}`,
        kind: "track",
        title: h.result.title,
        subtitle: h.result.primary_artist.name,
        imageUrl: h.result.song_art_image_thumbnail_url,
        url: h.result.url,
        relevance: nameMatchRelevance(h.result.title, query, i),
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

const RESULT_CACHE_TTL_MS = 60_000;
const resultCache = new Map<
  string,
  { outcome: SearchOutcome; expiresAt: number }
>();

function getCachedResults(key: string): SearchOutcome | null {
  const entry = resultCache.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    resultCache.delete(key);
    return null;
  }
  return entry.outcome;
}

function setCachedResults(key: string, outcome: SearchOutcome): void {
  resultCache.set(key, {
    outcome,
    expiresAt: Date.now() + RESULT_CACHE_TTL_MS,
  });
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
  const includeArtists =
    (ctx.settings[Setting.SEARCH_ARTISTS] as boolean) ?? true;
  const cacheKey = `${source}:${includeArtists}:${query}`;
  const cached = getCachedResults(cacheKey);
  if (cached) return cached;

  let outcome: SearchOutcome;
  switch (source) {
    case "apple-music":
      outcome = await fetchAppleMusic(query, includeArtists);
      break;
    case "spotify":
      outcome = await fetchSpotify(
        query,
        (ctx.settings[Setting.SPOTIFY_CLIENT_ID] as string) ?? "",
        (ctx.settings[Setting.SPOTIFY_CLIENT_SECRET] as string) ?? "",
        includeArtists,
      );
      break;
    case "genius":
      outcome = await fetchGenius(
        query,
        (ctx.settings[Setting.GENIUS_TOKEN] as string) ?? "",
      );
      break;
  }

  if (outcome.ok) setCachedResults(cacheKey, outcome);
  return outcome;
}

// The runtime has no timers, so we can't delay-then-fire a real debounce.
// Instead we track the most recent query per source and, once a fetch
// resolves, drop its results if the user has since typed something else.
const latestQueryBySource = new Map<SourceId, string>();

const MIN_QUERY_LENGTH: Record<SourceId, number> = {
  "apple-music": 1,
  spotify: 2,
  genius: 1,
};

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
      id: Setting.SEARCH_ARTISTS,
      title: "Search Artists",
      kind: "toggle",
      description:
        "Also search for matching artists (Spotify and Apple Music only)",
      defaultValue: true,
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

        if (q.length < MIN_QUERY_LENGTH[source]) return [openSearchItem];

        latestQueryBySource.set(source, q);
        const outcome = await fetchResults(source, q, ctx);

        // A newer keystroke has already superseded this query — drop the
        // stale response instead of racing it against the latest one.
        if (latestQueryBySource.get(source) !== q) return [];

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
            : Icon.sfSymbol(
                r.kind === "artist" ? "person.crop.circle" : "music.note",
              ),
          // ToDo: Make the artist profile image fully circular when the runtime supports it.
          action: Action.url(r.url),
        }));

        return [openSearchItem, ...items];
      },
    }),
  ],
};
