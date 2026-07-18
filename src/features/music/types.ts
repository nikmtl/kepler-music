export type SourceId = "apple-music" | "spotify" | "genius";

export type ResultKind = "track" | "artist";

export interface TrackResult {
  id: string;
  kind: ResultKind;
  title: string;
  subtitle: string;
  imageUrl?: string;
  url: string;
  relevance: number; // 0-100 score used to interleave tracks and artists
}

export interface SearchError {
  message: string;
}

export type SearchOutcome =
  { ok: true; results: TrackResult[] } | { ok: false; error: SearchError };

export function ok(results: TrackResult[]): SearchOutcome {
  return { ok: true, results };
}

export function err(message: string): SearchOutcome {
  return { ok: false, error: { message } };
}
