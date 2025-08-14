const DB_KEY = "audio_playlists";

async function getAllAudios() {
  return new Promise((resolve) => {
    chrome.storage.local.get([DB_KEY], (result) => {
      resolve(result[DB_KEY] || []);
    });
  });
}

async function addAudio(src) {
  const current = await getAllAudios();
  if (!current.includes(src)) {
    current.push(src);
    chrome.storage.local.set({ [DB_KEY]: current });
  }
}

let audioSrcs = [];

const modalButton = document.createElement("button");
modalButton.id = "modal-button";
modalButton.innerHTML = `🎧 Music Library`;

Object.assign(modalButton.style, {
  position: "fixed",
  bottom: "30px",
  right: "30px",
  zIndex: 1000,
  outline: "none",
  border: "none",
  borderRadius: "15px",
  padding: "12px 20px",
  background: "#2d2d2d",
  color: "#ffc266",
  fontSize: "16px",
  fontWeight: "bold",
  fontFamily: "Montserrat, sans-serif",
  cursor: "pointer",
  boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
  transition: "all 0.3s ease",
  display: "flex",
  alignItems: "center",
  gap: "8px",
});

modalButton.addEventListener("mouseenter", () => {
  modalButton.style.background = "#3a3a3a";
  modalButton.style.boxShadow = "0 6px 12px rgba(0,0,0,0.4)";
});

modalButton.addEventListener("mouseleave", () => {
  modalButton.style.background = "#2d2d2d";
  modalButton.style.boxShadow = "0 4px 8px rgba(0,0,0,0.3)";
});

document.body.appendChild(modalButton);

const modal = document.createElement("div");
modal.id = "audio-playlist-modal";
Object.assign(modal.style, {
  position: "fixed",
  top: "20%",
  left: "50%",
  transform: "translateX(-50%)",
  width: "400px",
  height: "60vh",
  background: "#373737",
  color: "#ffc266",
  padding: "0",
  border: "2px solid #555",
  borderRadius: "15px",
  zIndex: 9999,
  boxShadow: "0 0 15px rgba(0, 0, 0, 0.5)",
  fontFamily: "Montserrat, sans-serif",
  display: "flex",
  flexDirection: "column",
});

function renderModalContent() {
  modal.innerHTML = `
    <div style="padding: 16px; border-bottom: 1px solid #555;">
      <h3 style="margin: 0; color: #ffc266;">🎵 Add Audio Sources</h3>
    </div>
    <div id="playlist-scroll" style="
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    ">
      <ul style="list-style: none; padding: 0; margin: 0; font-family: Montserrat, sans-serif;">
        ${audioSrcs
          .map(
            (src, i) => `
              <li style="margin-bottom: 10px; color: #ffc266; word-break: break-word;">
                <label style="display: flex; align-items: center; gap: 10px;">
                  <input type="checkbox" data-src="${src}" id="checkbox-${i}" />
                  ${decodeURIComponent(src.split("/").pop())}
                </label>
              </li>`
          )
          .join("")}
      </ul>
    </div>
    <div style="padding: 16px; border-top: 1px solid #555; text-align: right;">
      <button id="add-audio-selected" style="
        background-color: #2d2d2d;
        color: #ffc266;
        border: none;
        padding: 8px 16px;
        border-radius: 8px;
        cursor: pointer;
        font-family: Montserrat, sans-serif;
        margin-right: 10px;
      ">Add Selected</button>
      <button id="close-audio-modal" style="
        background-color: #444;
        color: #ffc266;
        border: none;
        padding: 8px 16px;
        border-radius: 8px;
        cursor: pointer;
        font-family: Montserrat, sans-serif;
      ">Close</button>
    </div>
  `;

  modal.querySelector("#close-audio-modal").addEventListener("click", () => {
    modal.remove();
  });

  modal
    .querySelector("#add-audio-selected")
    .addEventListener("click", async () => {
      const checkedBoxes = modal.querySelectorAll(
        'input[type="checkbox"]:checked'
      );
      const selectedSrcs = Array.from(checkedBoxes).map((cb) => cb.dataset.src);

      for (const src of selectedSrcs) {
        await addAudio(src);
      }

      modal.remove();
    });
}

modalButton.addEventListener("click", () => {
  renderModalContent();
  document.body.appendChild(modal);
});

function collectSrcs() {
  const musicExtensionRegex = /\.(mp3|wav|flac|aac|ogg|m4a|wma)$/i;

  const audioTags = document.querySelectorAll("audio");

  return [...audioTags]
    .map((audio) => audio.src || audio.querySelector("source")?.src)
    .filter(
      (src) => src && musicExtensionRegex.test(src) && !audioSrcs.includes(src)
    );
}

(async () => {
  setInterval(async () => {
    const srcs = collectSrcs();

    if (srcs.length > 0) {
      audioSrcs.push(...srcs);
      if (document.body.contains(modal)) {
        renderModalContent();
      }
    }
  }, 5000);
})();
