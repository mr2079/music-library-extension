(() => {
  const found = new Map();
  const logo =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="18" fill="#1db954"/><circle cx="32" cy="32" r="22" fill="#101713"/><circle cx="32" cy="32" r="16" fill="none" stroke="#1db954" stroke-width="1.5" opacity=".55"/><path d="m27 22 16 10-16 10Z" fill="#1db954"/><path d="M17 47h11" stroke="#1db954" stroke-width="2" stroke-linecap="round"/></svg>';
  const closeIcon =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg>';
  const plusIcon =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  let host, shadow, panel, launcher;

  function collect() {
    const sources = new Set();
    for (const audio of document.querySelectorAll("audio")) {
      for (const source of [
        audio.currentSrc,
        audio.src,
        ...Array.from(audio.querySelectorAll("source"), (item) => item.src),
      ]) {
        try {
          const url = new URL(source, location.href);
          if (source && ["http:", "https:"].includes(url.protocol))
            sources.add(url.href);
        } catch {
          /* Ignore invalid sources. */
        }
      }
    }
    for (const link of document.querySelectorAll("a[href]")) {
      try {
        const url = new URL(link.href);
        if (
          ["http:", "https:"].includes(url.protocol) &&
          /\.(mp3|wav|flac|aac|ogg|m4a|opus|webm|wma)$/i.test(url.pathname)
        )
          sources.add(url.href);
      } catch {
        /* Ignore invalid links. */
      }
    }
    let changed = false;
    for (const src of sources)
      if (!found.has(src)) {
        found.set(src, false);
        changed = true;
      }
    if (!found.size) return;
    mount();
    launcher.querySelector(".count").textContent = found.size;
    if (changed && panel.open) render();
  }

  function mount() {
    if (host || !document.body) return;
    host = document.createElement("div");
    host.id = "music-library-collector";
    host.style.cssText =
      "all:initial;position:fixed;bottom:20px;right:20px;z-index:2147483647;";
    shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
      :host{--bg:#121212;--panel:#1b1b1b;--raised:#262626;--text:#edf0e7;--muted:#a0a497;--line:#30332c;--accent:#1db954;font:14px/1.5 system-ui,sans-serif;color:var(--text)}
      :host([data-theme=light]){--bg:#f5f6ef;--panel:#e8edde;--raised:#dde5d0;--text:#232c1c;--muted:#65705b;--line:#d9dfd0}
      *{box-sizing:border-box;font-family:system-ui,sans-serif}button,input{font:inherit}button{cursor:pointer;border:0;border-radius:7px;color:var(--text)}button:focus-visible,input:focus-visible{outline:2px solid var(--accent);outline-offset:3px}button:disabled{opacity:.45;cursor:default}svg{display:block;width:19px;height:19px;flex-shrink:0}
      .launcher,dialog{font-family:system-ui,sans-serif}
      .launcher{display:flex;align-items:center;gap:10px;background:var(--bg);border:1px solid var(--line);padding:9px 12px 9px 9px;box-shadow:0 4px 24px #0004;font-size:13px;font-weight:600;border-radius:11px}.launcher>svg{width:29px;height:29px}.count{background:var(--accent);color:#071d0f;font-size:11px;min-width:21px;text-align:center;border-radius:5px;padding:2px 5px}.launcher:hover{background:var(--raised)}
      dialog{position:fixed;inset:0;margin:auto;width:min(450px,calc(100vw - 28px));max-height:calc(100dvh - 40px);padding:25px;background:var(--bg);color:var(--text);border:1px solid var(--line);border-radius:14px;box-shadow:0 25px 100px #0007;overflow-y:auto}dialog::backdrop{background:#080c08b3;backdrop-filter:blur(7px)}
      .brand{display:flex;align-items:center;gap:8px;font-size:16px;font-weight:700;letter-spacing:-.5px}.brand>svg{width:30px;height:30px}.brand span span{font-weight:400}.heading{display:flex;align-items:center;justify-content:space-between;gap:15px}.close{display:grid;place-items:center;background:transparent;padding:8px;color:var(--muted)}.close:hover{background:var(--raised)}.eyebrow{font-size:9px;letter-spacing:1.6px;font-weight:600;color:var(--muted);margin-top:25px}h2{font-size:26px;line-height:1.2;letter-spacing:-.7px;margin:8px 0 10px}p{font-size:13px;color:var(--muted);margin:0 0 20px;line-height:1.7}
      .list{max-height:min(40dvh,300px);overflow-y:auto;scrollbar-width:thin;border-block:1px solid var(--line)}label{display:flex;align-items:flex-start;gap:12px;padding:13px 2px;font-size:13px;border-bottom:1px solid var(--line);cursor:pointer}label:last-child{border-bottom:0}input{accent-color:var(--accent);margin:4px 0 0;width:16px;height:16px;flex-shrink:0}.source{min-width:0;overflow-wrap:anywhere}.source strong{display:block;font-size:13px;font-weight:500}.source small{display:block;font-size:11px;color:var(--muted);margin-top:3px}
      .footer{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:20px}.save{display:flex;align-items:center;justify-content:center;gap:7px;background:var(--accent);color:#071d0f;padding:11px 14px;font-size:13px;font-weight:600}.save svg{width:16px;height:16px}.status{font-size:11px;color:var(--muted);max-width:190px}.privacy{font-size:10px;letter-spacing:.4px;margin:18px 0 0;color:var(--muted)}
      @media(max-width:400px){dialog{padding:21px}h2{font-size:24px}.launcher{font-size:12px}.footer{align-items:flex-start;flex-direction:column}.save{width:100%}.status{max-width:none}}
    `;
    launcher = document.createElement("button");
    launcher.className = "launcher";
    launcher.innerHTML = `${logo}<span>Save music</span><span class="count"></span>`;
    launcher.setAttribute("aria-expanded", "false");
    launcher.setAttribute("aria-haspopup", "dialog");
    panel = document.createElement("dialog");
    panel.setAttribute("aria-labelledby", "collector-title");
    panel.innerHTML = `<div class="heading"><div class="brand">${logo}<span>music<span>library</span></span></div><button class="close" aria-label="Close music collector">${closeIcon}</button></div><div class="eyebrow">A GOOD FIND DESERVES A PLACE</div><h2 id="collector-title">Find it. Keep it.</h2><p>Add audio from this page to your personal library.</p><div class="list"></div><div class="footer"><span class="status" role="status">Choose the tracks you want to keep.</span><button class="save">${plusIcon}Add selected</button></div><p class="privacy">SAVED ON THIS DEVICE · NO ACCOUNT NEEDED</p>`;
    shadow.append(style, panel, launcher);
    document.body.append(host);
    launcher.addEventListener("click", () => {
      render();
      panel.showModal();
      launcher.setAttribute("aria-expanded", "true");
    });
    panel
      .querySelector(".close")
      .addEventListener("click", () => panel.close());
    panel.addEventListener("close", () => {
      launcher.setAttribute("aria-expanded", "false");
      launcher.focus();
    });
    panel.addEventListener("click", (event) => {
      if (event.target !== panel) return;
      const rect = panel.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        panel.close();
    });
    panel.querySelector(".save").addEventListener("click", save);
    chrome.storage.local
      .get("music_library_v2")
      .then((saved) => {
        host.dataset.theme = saved.music_library_v2?.settings?.theme || "dark";
      })
      .catch(() => {});
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.music_library_v2)
        host.dataset.theme =
          changes.music_library_v2.newValue?.settings?.theme || "dark";
    });
  }

  async function save() {
    const tracks = Array.from(found)
      .filter(([, checked]) => checked)
      .map(([url]) => ({ url }));
    if (!tracks.length) return;
    const button = panel.querySelector(".save");
    button.disabled = true;
    try {
      const response = await chrome.runtime.sendMessage({
        channel: "music-library",
        action: { type: "add", tracks },
      });
      if (response?.error || !response?.saved) throw new Error("Save failed.");
      panel.querySelector(".status").textContent =
        "Saved. Find them in your new-tab library.";
      for (const { url } of tracks) found.set(url, false);
      render();
    } catch {
      panel.querySelector(".status").textContent =
        "Could not save. Reload this page and try again.";
    } finally {
      button.disabled = !Array.from(found.values()).some(Boolean);
    }
  }

  function render() {
    const list = document.createDocumentFragment();
    for (const [src, checked] of found) {
      const label = document.createElement("label"),
        input = document.createElement("input"),
        source = document.createElement("span"),
        name = document.createElement("strong"),
        domain = document.createElement("small");
      input.type = "checkbox";
      input.checked = checked;
      source.className = "source";
      let text = new URL(src).pathname.split("/").pop() || "Audio track";
      try {
        text = decodeURIComponent(text);
      } catch {
        /* Preserve malformed filenames. */
      }
      name.textContent = text;
      name.title = src;
      domain.textContent = new URL(src).hostname;
      input.addEventListener("change", () => {
        found.set(src, input.checked);
        panel.querySelector(".save").disabled = !Array.from(
          found.values(),
        ).some(Boolean);
      });
      source.append(name, domain);
      label.append(input, source);
      list.append(label);
    }
    panel.querySelector(".list").replaceChildren(list);
    panel.querySelector(".save").disabled = !Array.from(found.values()).some(
      Boolean,
    );
  }
  let timer;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(collect, 300);
  };
  new MutationObserver((records) => {
    if (records.some((record) => !host?.contains(record.target))) schedule();
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src", "href"],
  });
  document.addEventListener("loadedmetadata", schedule, true);
  collect();
})();
