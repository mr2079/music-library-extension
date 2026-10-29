import { fileStore } from "./store.js";
const MAX_REMOTE_BYTES = 20 * 1024 * 1024;

async function remoteBlob(url, signal) {
  const response = await fetch(url, { signal, credentials: "omit" });
  if (!response.ok) throw new Error("Audio source unavailable.");
  if (Number(response.headers.get("content-length")) > MAX_REMOTE_BYTES) {
    await response.body.cancel();
    throw new Error("Metadata file too large.");
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REMOTE_BYTES) throw new Error("Metadata file too large.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return new Blob(chunks, {
    type: response.headers.get("content-type") || "audio/mpeg",
  });
}

function readTags(blob) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({}), 5000);
    try {
      globalThis.jsmediatags.read(blob, {
        onSuccess: (result) => {
          clearTimeout(timer);
          resolve(result.tags || {});
        },
        onError: () => {
          clearTimeout(timer);
          resolve({});
        },
      });
    } catch {
      clearTimeout(timer);
      resolve({});
    }
  });
}

function readDuration(blob) {
  return new Promise((resolve) => {
    const audio = new Audio();
    const url = URL.createObjectURL(blob);
    const finish = (value) => {
      clearTimeout(timer);
      audio.onloadedmetadata = audio.onerror = null;
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timer = setTimeout(() => finish(0), 5000);
    audio.onloadedmetadata = () => {
      audio.onloadedmetadata = audio.onerror = null;
      finish(Number.isFinite(audio.duration) ? audio.duration : 0);
    };
    audio.onerror = () => {
      audio.onloadedmetadata = audio.onerror = null;
      finish(0);
    };
    audio.preload = "metadata";
    audio.src = url;
  });
}

async function readCover(picture) {
  if (!picture?.data || picture.data.length > 8 * 1024 * 1024) return null;
  let bitmap;
  try {
    bitmap = await createImageBitmap(
      new Blob([new Uint8Array(picture.data)], { type: picture.format }),
    );
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas
      .getContext("2d")
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.75);
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
}

export async function extractMetadata(track) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const blob = track.url.startsWith("local:")
      ? await fileStore("get", track.id)
      : await remoteBlob(track.url, controller.signal);
    if (!blob) throw new Error("File unavailable.");
    const [tags, duration] = await Promise.all([
      readTags(blob),
      readDuration(blob),
    ]);
    const patch = { metadataState: "ready" };
    for (const key of ["title", "artist", "album"])
      if (typeof tags[key] === "string" && tags[key].trim())
        patch[key] = tags[key].trim();
    if (duration > 0) patch.duration = duration;
    const cover = await readCover(tags.picture);
    if (cover) patch.cover = cover;
    return patch;
  } catch {
    return { metadataState: "unavailable" };
  } finally {
    clearTimeout(timer);
  }
}

export function createMetadataQueue(save) {
  const seen = new Set();
  const pending = [];
  let active = 0;
  const pump = () => {
    while (active < 2 && pending.length) {
      const track = pending.shift();
      active++;
      extractMetadata(track)
        .then((patch) => save(track.id, patch))
        .catch(() => {
          seen.delete(track.id);
        })
        .finally(() => {
          active--;
          pump();
        });
    }
  };
  return (tracks) => {
    for (const track of tracks)
      if (track.metadataState === "pending" && !seen.has(track.id)) {
        seen.add(track.id);
        pending.push(track);
      }
    pump();
  };
}
