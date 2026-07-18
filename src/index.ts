import { definePlugin, Icon, KeplerPluginMeta } from "@kepler-app/plugin-sdk";
import { registerFeatures } from "./features";
import { music } from "./features/music";
import config from "../plugin.config.json";

const features = [music];
const { settings, ...registrations } = registerFeatures(features);

const metadata: KeplerPluginMeta = {
  id: config.id,
  name: config.name,
  version: config.version,
  author: config.author,
  icon: Icon.sfSymbol(config.icon),
  permissions: ["network"],
  networkUrls: [
    "itunes.apple.com",
    "accounts.spotify.com",
    "api.spotify.com",
    "api.genius.com",
    "www.googleapis.com",
  ],
  settings,
};

export default definePlugin({ metadata, ...registrations });
