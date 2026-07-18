import { nameMatchRelevance } from "../relevance";
import { err, ok, SearchOutcome } from "../types";

export async function fetchGenius(
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
