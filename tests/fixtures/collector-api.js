// Preview-only stand-in for content-script APIs. Never loaded by the extension.
globalThis.chrome = {
  storage: {
    local: {
      async get() {
        return {
          music_library_v2: JSON.parse(
            localStorage.getItem("music_library_v2") || "null",
          ),
        };
      },
    },
    onChanged: {
      addListener(listener) {
        window.addEventListener("storage", (event) => {
          if (event.key === "music_library_v2")
            listener(
              { music_library_v2: { newValue: JSON.parse(event.newValue) } },
              "local",
            );
        });
      },
    },
  },
  runtime: {
    async sendMessage(message) {
      const model = await import("../../js/model.js");
      const current = model.normalizeLibrary(
        JSON.parse(localStorage.getItem(model.LIBRARY_KEY) || "null"),
      );
      const updated = model.reduceLibrary(current, message.action);
      localStorage.setItem(model.LIBRARY_KEY, JSON.stringify(updated));
      return { saved: true };
    },
  },
};
