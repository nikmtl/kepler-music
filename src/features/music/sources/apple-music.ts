import { interleaveByRelevance, nameMatchRelevance } from "../relevance";
import { err, ok, SearchOutcome, TrackResult } from "../types";

export async function fetchAppleMusic(
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
