import { Icon } from "@kepler-app/plugin-sdk";
import { Setting } from "../settings";
import { SearchOutcome, SourceId } from "../types";
import { fetchAppleMusic } from "./apple-music";
import { fetchGenius } from "./genius";
import { fetchSpotify } from "./spotify";

export function searchUrl(source: SourceId, query: string): string {
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

export function sourceIcon(source: SourceId) {
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

export function sourceTitle(source: SourceId): string {
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

export async function fetchResults(
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
