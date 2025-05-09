const DB_KEY = "audio_playlists";

let listAudio = [];
let currentAudio = document.getElementById("myAudio");
let indexAudio = 0;
let playListContainer = document.querySelector(".playlist-ctn");

const previousElement = document.querySelector("#previous");
const rewindElement = document.querySelector("#rewind");
const toggleAudioElement = document.querySelector("#toggleAudio");
const forwardElement = document.querySelector("#forward");
const nextElement = document.querySelector("#next");
const toggleMuteElement = document.querySelector("#toggleMute");

previousElement.addEventListener("click", previous);
rewindElement.addEventListener("click", rewind);
toggleAudioElement.addEventListener("click", toggleAudio);
forwardElement.addEventListener("click", forward);
nextElement.addEventListener("click", next);
toggleMuteElement.addEventListener("click", toggleMute);

async function getSavedAudios() {
  return new Promise((resolve) => {
    chrome.storage.local.get([DB_KEY], (result) => {
      resolve(result[DB_KEY] || []);
    });
  });
}

function createTrackItem(index, name, duration, file) {
  const trackItem = document.createElement("div");
  trackItem.className = "playlist-track-ctn";
  trackItem.id = `ptc-${index}`;
  trackItem.dataset.index = index;

  const playBtnItem = document.createElement("div");
  playBtnItem.className = "playlist-btn-play";
  playBtnItem.id = `pbp-${index}`;

  const btnImg = document.createElement("i");
  btnImg.className = "fas fa-play";
  btnImg.id = `p-img-${index}`;

  playBtnItem.appendChild(btnImg);

  const trackInfoItem = document.createElement("div");
  trackInfoItem.className = "playlist-info-track";
  trackInfoItem.textContent = name;

  const trackDurationItem = document.createElement("div");
  trackDurationItem.className = "playlist-duration";
  trackDurationItem.textContent = duration;

  const removeBtn = document.createElement("button");
  removeBtn.className = "remove-btn";
  removeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    removeAudio(file);
  });

  const icon = document.createElement("i");
  icon.className = "fas fa-times";
  removeBtn.appendChild(icon);

  removeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    removeAudio(file);
  });

  trackItem.appendChild(playBtnItem);
  trackItem.appendChild(trackInfoItem);
  trackItem.appendChild(trackDurationItem);
  trackItem.appendChild(removeBtn);

  trackItem.addEventListener("click", () => {
    if (index === indexAudio) {
      toggleAudio();
    } else {
      loadNewTrack(index);
    }
  });

  playListContainer.appendChild(trackItem);
}

async function removeAudio(file) {
  const audios = await getSavedAudios();
  const updated = audios.filter((src) => src !== file);
  chrome.storage.local.set({ [DB_KEY]: updated }, () => {
    location.reload();
  });
}

async function renderPlaylist() {
  const audios = await getSavedAudios();
  if (audios.length === 0) return;

  listAudio = audios.map((src) => ({
    name: decodeURIComponent(src.split("/").pop()),
    file: src,
    duration: "",
  }));

  listAudio.forEach((audio, i) =>
    createTrackItem(i, audio.name, audio.duration, audio.file)
  );

  document.querySelector("#source-audio").src = listAudio[indexAudio].file;
  document.querySelector(".title").textContent = listAudio[indexAudio].name;
  currentAudio.load();
}

renderPlaylist();

function loadNewTrack(index) {
  currentAudio.pause();
  document.querySelector("#source-audio").src = listAudio[index].file;
  document.querySelector(".title").textContent = listAudio[index].name;
  currentAudio.load();
  toggleAudio();
  updateStylePlaylist(indexAudio, index);
  indexAudio = index;
}

function toggleAudio() {
  if (currentAudio.paused) {
    document.querySelector("#icon-play").style.display = "none";
    document.querySelector("#icon-pause").style.display = "block";
    document.querySelector(`#ptc-${indexAudio}`).classList.add("active-track");
    playToPause(indexAudio);
    currentAudio.play();
  } else {
    document.querySelector("#icon-play").style.display = "block";
    document.querySelector("#icon-pause").style.display = "none";
    pauseToPlay(indexAudio);
    currentAudio.pause();
  }
}

function pauseAudio() {
  currentAudio.pause();
  clearInterval(interval1);
}

currentAudio.ontimeupdate = onTimeUpdate;

function onTimeUpdate() {
  const t = currentAudio.currentTime;
  document.querySelector(".timer").textContent = getMinutes(t);
  setBarProgress();
  if (currentAudio.ended) {
    document.querySelector("#icon-play").style.display = "block";
    document.querySelector("#icon-pause").style.display = "none";
    pauseToPlay(indexAudio);
    if (indexAudio < listAudio.length - 1) {
      loadNewTrack(indexAudio + 1);
    }
  }
}

function setBarProgress() {
  const progress = (currentAudio.currentTime / currentAudio.duration) * 100;
  document.getElementById("myBar").style.width = `${progress}%`;
}

function getMinutes(t) {
  const min = String(Math.floor(t / 60)).padStart(2, "0");
  const sec = String(Math.floor(t % 60)).padStart(2, "0");
  return `${min}:${sec}`;
}

document.querySelector("#myProgress").addEventListener("click", (event) => {
  const percent = event.offsetX / event.currentTarget.offsetWidth;
  currentAudio.currentTime = percent * currentAudio.duration;
  document.getElementById("myBar").style.width = `${percent * 100}%`;
});

function forward() {
  currentAudio.currentTime += 5;
  setBarProgress();
}

function rewind() {
  currentAudio.currentTime -= 5;
  setBarProgress();
}

function next() {
  if (indexAudio < listAudio.length - 1) {
    loadNewTrack(indexAudio + 1);
  }
}

function previous() {
  if (indexAudio > 0) {
    loadNewTrack(indexAudio - 1);
  }
}

function updateStylePlaylist(oldIndex, newIndex) {
  document.querySelector(`#ptc-${oldIndex}`).classList.remove("active-track");
  pauseToPlay(oldIndex);
  document.querySelector(`#ptc-${newIndex}`).classList.add("active-track");
  playToPause(newIndex);
}

function playToPause(index) {
  const ele = document.querySelector(`#p-img-${index}`);
  ele.classList.replace("fa-play", "fa-pause");
}

function pauseToPlay(index) {
  const ele = document.querySelector(`#p-img-${index}`);
  ele.classList.replace("fa-pause", "fa-play");
}

function toggleMute() {
  const volUp = document.querySelector("#icon-vol-up");
  const volMute = document.querySelector("#icon-vol-mute");
  currentAudio.muted = !currentAudio.muted;
  volUp.style.display = currentAudio.muted ? "none" : "block";
  volMute.style.display = currentAudio.muted ? "block" : "none";
}

const searchContainer = document.querySelector(".search-container");
const searchInput = document.getElementById("search-bar");

function performSearch(query) {
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(
    query
  )}`;
  window.open(searchUrl, "_blank");
}

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    const query = searchInput.value;
    if (query.trim()) {
      performSearch(query);
    }
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && document.activeElement !== searchInput) {
    event.preventDefault();
    searchInput.focus();
  }
});

const suggestionsBox = document.getElementById("suggestions-box");
let debounceTimer;

searchInput.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const query = searchInput.value.trim();
    if (query.length === 0) {
      suggestionsBox.innerHTML = "";
      suggestionsBox.style.display = "none";
      return;
    }

    fetch(`http://localhost:3000/suggest/${encodeURIComponent(query)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          suggestionsBox.innerHTML = data.data
            .map(
              (suggestion) =>
                `<li style="padding: 5px; cursor: pointer;">${suggestion}</li>`
            )
            .join("");
          suggestionsBox.style.display = "block";

          suggestionsBox.querySelectorAll("li").forEach((li) => {
            li.addEventListener("click", () => {
              suggestionsBox.style.display = "none";
              performSearch(li.textContent);
            });
          });
        } else {
          suggestionsBox.innerHTML = "";
          suggestionsBox.style.display = "none";
        }
      })
      .catch(() => {
        suggestionsBox.innerHTML = "";
        suggestionsBox.style.display = "none";
      });
  }, 500);
});

document.addEventListener("click", (e) => {
  if (!searchContainer.contains(e.target)) {
    suggestionsBox.style.display = "none";
  }
});
