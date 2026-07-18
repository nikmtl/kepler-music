import { base64Encode } from "../base64";
import { interleaveByRelevance, nameMatchRelevance } from "../relevance";
import { err, ok, SearchError, SearchOutcome, TrackResult } from "../types";

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

export async function fetchSpotify(
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
