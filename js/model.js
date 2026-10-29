export const LIBRARY_KEY = "music_library_v2";
export const LEGACY_KEY = "audio_playlists";
const DEFAULT_SETTINGS = {
  theme: "dark",
  volume: 0.7,
  shuffle: false,
  repeat: "off",
};
export function validUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
export function filename(url) {
  try {
    const name =
      new URL(url).pathname.split("/").filter(Boolean).pop() ||
      "Untitled track";
    let decoded = name;
    try {
      decoded = decodeURIComponent(name);
    } catch {
      /* Preserve malformed names. */
    }
    return decoded
      .replace(/\.(mp3|m4a|wav|ogg|flac|aac|opus|webm|wma)$/i, "")
      .replace(/_+/g, " ");
  } catch {
    return "Untitled track";
  }
}
export function makeTrack(input) {
  if (!input || typeof input !== "object") return null;
  const url =
    validUrl(input.url) ||
    (/^local:[\w-]+$/.test(input.url) ? input.url : null);
  if (!url) return null;
  return {
    id: input.id || crypto.randomUUID(),
    url,
    title: String(input.title || filename(url)).slice(0, 300),
    artist: String(input.artist || "").slice(0, 300),
    album: String(input.album || "").slice(0, 300),
    duration:
      Number.isFinite(input.duration) && input.duration > 0
        ? input.duration
        : 0,
    addedAt:
      Number.isFinite(input.addedAt) &&
      Math.abs(input.addedAt) <= 8640000000000000
        ? input.addedAt
        : Date.now(),
    favorite: !!input.favorite,
    metadataState: input.metadataState || "pending",
    cover:
      typeof input.cover === "string" &&
      /^data:image\/(jpeg|png|webp);base64,/.test(input.cover) &&
      input.cover.length < 180000
        ? input.cover
        : null,
  };
}
export function normalizeLibrary(value, legacy = []) {
  const items = Array.isArray(value?.tracks)
    ? value.tracks
    : Array.isArray(legacy)
      ? legacy.map((url) => ({ url }))
      : [];
  const seen = new Set();
  const tracks = items
    .map((item) => item && makeTrack(item))
    .filter((track) => {
      if (!track || seen.has(track.url)) return false;
      seen.add(track.url);
      return true;
    });
  const saved = value?.settings || {};
  return {
    version: 2,
    tracks,
    settings: {
      theme: saved.theme === "light" ? "light" : DEFAULT_SETTINGS.theme,
      volume: Number.isFinite(saved.volume)
        ? Math.max(0, Math.min(1, saved.volume))
        : DEFAULT_SETTINGS.volume,
      shuffle: !!saved.shuffle,
      repeat: ["off", "all", "one"].includes(saved.repeat)
        ? saved.repeat
        : DEFAULT_SETTINGS.repeat,
    },
  };
}
export function reduceLibrary(library, action) {
  const next = structuredClone(library);
  switch (action.type) {
    case "add": {
      const urls = new Set(next.tracks.map((track) => track.url));
      for (const input of action.tracks || []) {
        const track = makeTrack(input);
        if (track && !urls.has(track.url)) {
          next.tracks.push(track);
          urls.add(track.url);
        }
      }
      break;
    }
    case "patch": {
      const track = next.tracks.find((track) => track.id === action.id);
      if (track) {
        const patch = Object.fromEntries(
          Object.entries(action.patch || {}).filter(([key]) =>
            [
              "title",
              "artist",
              "album",
              "duration",
              "cover",
              "metadataState",
            ].includes(key),
          ),
        );
        if (action.automatic && track.metadataState === "edited") {
          if (Number.isFinite(patch.duration) && patch.duration > 0)
            track.duration = patch.duration;
          if (patch.cover && !track.cover)
            track.cover = makeTrack({ ...track, cover: patch.cover }).cover;
        } else Object.assign(track, makeTrack({ ...track, ...patch }));
      }
      break;
    }
    case "favorite": {
      const track = next.tracks.find((track) => track.id === action.id);
      if (track) track.favorite = !track.favorite;
      break;
    }
    case "remove":
      next.tracks = next.tracks.filter((track) => track.id !== action.id);
      break;
    case "move": {
      const from = next.tracks.findIndex((track) => track.id === action.id);
      if (
        from < 0 ||
        action.id === action.targetId ||
        !next.tracks.some((track) => track.id === action.targetId)
      )
        break;
      const [track] = next.tracks.splice(from, 1);
      const to = next.tracks.findIndex((item) => item.id === action.targetId);
      next.tracks.splice(to + (action.after ? 1 : 0), 0, track);
      break;
    }
    case "settings":
      next.settings = normalizeLibrary({
        tracks: [],
        settings: { ...next.settings, ...action.settings },
      }).settings;
      break;
    default:
      throw new Error("Unknown library action.");
  }
  return next;
}
export function selectTracks(
  tracks,
  { query = "", view = "all", sort = "custom" } = {},
) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const result = tracks.filter(
    (track) =>
      (view !== "favorites" || track.favorite) &&
      words.every((word) =>
        `${track.title} ${track.artist} ${track.album}`
          .toLocaleLowerCase()
          .includes(word),
      ),
  );
  if (sort === "newest" || (view === "recent" && sort === "custom"))
    result.sort((a, b) => b.addedAt - a.addedAt);
  if (sort === "title" || sort === "artist")
    result.sort((a, b) =>
      a[sort].localeCompare(b[sort], undefined, {
        sensitivity: "base",
        numeric: true,
      }),
    );
  return result;
}
export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const t = Math.floor(seconds);
  return t >= 3600
    ? `${Math.floor(t / 3600)}:${String(Math.floor(t / 60) % 60).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`
    : `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}
