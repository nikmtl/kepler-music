# Documentation

## Project structure

```
src/
  index.ts             Plugin entry point — registers metadata, permissions, and features
  features/
    index.ts            Feature interface + registerFeatures() aggregator
    music.ts             Music search feature: settings, source adapters, search mode
plugin.config.json      Plugin id/name/version/bundle name, read by src/index.ts and tsup.config.ts
tsup.config.ts          Bundles src/index.ts to an IIFE and writes it into Kepler's plugin directory
```

A **feature** (see `src/features/index.ts`) is a self-contained bundle of settings, search modes,
search providers, widgets, and look-aheads. `src/index.ts` combines all features via
`registerFeatures()` and hands the result to `definePlugin()`. Currently `music` is the only feature;
new features follow the same shape and get added to the `features` array in `src/index.ts`.

### The plugin runtime

Plugins run inside Kepler's embedded JavaScriptCore host, **not** a browser or Node:

- Only `fetch`, `XMLHttpRequest`, and `console` are injected (see
  `node_modules/@kepler-app/plugin-sdk/runtime.d.ts` for the exact surface).
- There are **no timers** — no `setTimeout`/`setInterval` — and no DOM, no Node builtins, no module
  system at runtime (plugins are pre-bundled to a single script by tsup).
- `fetch` returns a `KeplerResponse`, a reduced subset of the standard `Response` (notably
  `res.headers` is a plain lowercase-keyed object, not a `Headers` instance).
- Network access requires declaring `permissions: ["network"]` and an explicit `networkUrls`
  allowlist in the plugin metadata (`src/index.ts`) — requests to undeclared hosts will fail.

This matters most for `music.ts`'s search mode: `run(query, ctx)` is invoked by the host on every
change to the search box, effectively once per keystroke, and the plugin cannot delay or cancel that
call — see below.

### Music source adapters

Each source (`fetchAppleMusic`, `fetchSpotify`, `fetchGenius` in `src/features/music.ts`) follows the
same shape: take a query and any needed credentials, return a `SearchOutcome`
(`{ ok: true, results }` or `{ ok: false, error }`). `fetchResults()` dispatches to the right adapter
based on the selected `Music Source` setting and layers a short-TTL results cache on top (see below).


## Spotify rate limits

### Why this happens

Kepler's search mode calls `run(query, ctx)` on (roughly) every keystroke — there is no built-in
debouncing from the host, and the plugin runtime has no timers to implement a real delay-then-fire
debounce itself (see [The plugin runtime](#the-plugin-runtime)). Combined with Spotify's Client
Credentials flow having its own request-based rate limit, typing a single query like `radiohead`
naively fires one Spotify search request per character. That burns through Spotify's rate limit
quickly and results in `429 Too Many Requests` responses.

### What's already mitigated automatically

`src/features/music.ts` includes several mitigations for this, all implemented without timers:

- **Token caching** (`getSpotifyToken`) — the OAuth access token is cached in memory and reused until
  shortly before it expires, so authentication doesn't cost a request on every search.
- **Backoff on 429** (`spotifyRateLimitedUntil`) — when Spotify returns `429`, its `Retry-After`
  header is used to suppress further Spotify requests until that window passes, returning a friendly
  error instead of hammering the API further.
- **Result caching** (`resultCache` / `RESULT_CACHE_TTL_MS`) — successful responses are cached per
  `source:query` for 60 seconds. Retyping or backspacing back to an already-seen query reuses the
  cached result instead of re-fetching. Errors are intentionally not cached, so a rate-limited query
  retries on the next attempt.
- **Minimum query length** (`MIN_QUERY_LENGTH`) — Spotify requests only fire once the query is at
  least 2 characters, cutting out the most wasteful single-character searches.
- **Stale-response guard** (`latestQueryBySource`) — if the user keeps typing while a request is in
  flight, the response is discarded once it resolves if it's no longer the latest query for that
  source, avoiding flicker and wasted rendering (though the request itself has already been sent).

### What this doesn't fix

These mitigations reduce request volume and avoid piling on further requests once rate-limited, but
they don't eliminate the fundamental issue: **every keystroke past the minimum length still fires a
request on a cache miss.** A user typing a long, unique query character-by-character can still trip
the limit. If this keeps happening in practice, the more complete fixes (in rough order of effort)
are:

1. Increase `MIN_QUERY_LENGTH` for Spotify further (e.g. to 3), trading responsiveness for fewer
   requests.
2. Increase `RESULT_CACHE_TTL_MS` so repeated searches within a session are cheaper.
3. Move search execution to a host-provided debounce mechanism, if/when the Kepler SDK exposes one
   (check `@kepler-app/plugin-sdk` release notes for a query-debounce or `AbortSignal` addition to
   `run()`).
4. Proxy Spotify search through a small external service that can batch/cache across all users of the
   plugin, decoupling the rate limit from individual keystrokes — a much larger architectural change.