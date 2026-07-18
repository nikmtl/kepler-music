import { nameMatchRelevance } from "../relevance";
import { err, ok, SearchOutcome, TrackResult } from "../types";

// YouTube's "Music" video category, used to bias search results toward songs
// rather than unrelated videos (there's no official YouTube Music search API).
const MUSIC_CATEGORY_ID = "10";

export async function fetchYoutubeMusic(
  query: string,
  apiKey: string,
): Promise<SearchOutcome> {
  if (!query.trim()) return ok([]);
  if (!apiKey) {
    return err(
      "YouTube Data API Key is missing. Add it in the Music Search settings.",
    );
  }
  const url =
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video` +
    `&videoCategoryId=${MUSIC_CATEGORY_ID}&maxResults=15` +
    `&q=${encodeURIComponent(query)}&key=${encodeURIComponent(apiKey)}`;

  let res: KeplerResponse;
  try {
    res = await fetch(url);
  } catch {
    return err("Couldn't reach YouTube Music. Check your internet connection.");
  }
  if (!res.ok) {
    return err(
      res.status === 400 || res.status === 403
        ? "YouTube rejected the API Key. Check your credentials in settings."
        : `YouTube Music search failed (HTTP ${res.status}).`,
    );
  }
  try {
    const data = (await res.json()) as {
      items: Array<{
        id: { videoId: string };
        snippet: {
          title: string;
          channelTitle: string;
          thumbnails: { high?: { url: string }; default?: { url: string } };
        };
      }>;
    };
    const tracks: TrackResult[] = data.items.map((v, i) => ({
      id: `ytm-${v.id.videoId}`,
      kind: "track",
      title: v.snippet.title,
      subtitle: v.snippet.channelTitle,
      imageUrl:
        v.snippet.thumbnails.high?.url ?? v.snippet.thumbnails.default?.url,
      url: `https://music.youtube.com/watch?v=${v.id.videoId}`,
      relevance: nameMatchRelevance(v.snippet.title, query, i),
    }));
    return ok(tracks);
  } catch {
    return err("YouTube Music returned an unexpected response.");
  }
}
