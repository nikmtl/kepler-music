import { TrackResult } from "./types";

export function nameMatchRelevance(
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
 * Merge track and artist results into a single relevance-ranked list.
 *
 * Both lists are already scored 0-100 on their own terms (API popularity or
 * name-match strength), so a plain merge-sort on that score already gets top
 * hits in roughly the right order. On top of that we apply two tweaks that
 * make the blend feel smarter than a naive sort:
 *
 *  - An artist that matches the query very closely (score >= 85, i.e. an
 *    exact or prefix name match) gets a small boost. Someone typing an
 *    artist's name is usually looking for the artist page/profile, and a
 *    single well-matched artist getting buried under a dozen so-so tracks
 *    reads as broken, not correct.
 *  - Beyond that boosted lead-in, artists are capped to at most one in every
 *    four results so a long tail of loosely-related artists can't crowd out
 *    tracks the user is more likely to actually want.
 */
export function interleaveByRelevance(
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
