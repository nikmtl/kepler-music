import { Action, Command, Icon } from "@kepler-app/plugin-sdk";
import { Feature } from "..";
import { Setting } from "./settings";
import { fetchResults, searchUrl, sourceIcon, sourceTitle } from "./sources";
import { SourceId } from "./types";

// At the moment there is no way to implement debouncing in the SDK, so we have to track the latest query for each source and ignore stale results.
const latestQueryBySource = new Map<SourceId, string>();

const MIN_QUERY_LENGTH: Record<SourceId, number> = {
  "apple-music": 1,
  spotify: 2,
  genius: 1,
  "youtube-music": 2,
};

export const music: Feature = {
  settings: [
    {
      id: Setting.SOURCE,
      title: "Music Source",
      kind: "picker",
      description:
        "Choose which service to search. Apple Music works out of the box. Spotify, Genius and YouTube Music require API credentials.",
      defaultValue: "apple-music",
      options: [
        { id: "apple-music", title: "Apple Music" },
        { id: "spotify", title: "Spotify" },
        { id: "genius", title: "Genius" },
        { id: "youtube-music", title: "YouTube Music" },
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
    {
      id: Setting.YOUTUBE_MUSIC_API_KEY,
      title: "YouTube Data API Key",
      kind: "secureText",
      description:
        "Only needed when YouTube Music is selected above. Create a free API key at console.cloud.google.com with the YouTube Data API v3 enabled.",
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
          // ToDo: Make the artist profile image fully circular when the sdk supports it
          action: Action.url(r.url),
        }));

        return [openSearchItem, ...items];
      },
    }),
  ],
};
